"""
Interface en ligne de commande (CLI) d'administration OpenNDR V0.1
Permet l'initialisation sécurisée du premier compte administrateur et des rôles.
"""
import argparse
import sys
from sqlalchemy import inspect
from app.core.database import SessionLocal, engine
from app.models.user import User, Role, Permission, role_permissions
from app.core.security import hash_password, validate_password_strength
from app.services.audit_service import AuditService


def check_database_migrated():
    """
    Vérifie impérativement que les migrations de schéma Alembic ont été appliquées.
    L'appel direct à Base.metadata.create_all est strictement banni : Alembic est
    l'unique mécanisme autorisé pour gouverner le schéma de production.
    """
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        required_tables = {"users", "roles", "permissions", "revoked_tokens", "audit_logs"}

        if not required_tables.issubset(existing_tables):
            missing = required_tables - existing_tables
            print("[ERREUR SÉCURITÉ] La base de données n'est pas prête ou les migrations sont incomplètes.")
            print(f"Tables requises manquantes : {', '.join(sorted(missing))}")
            print("Veuillez exécuter les migrations officielles avant le bootstrap administrateur :")
            print("    alembic upgrade head")
            sys.exit(1)
    except Exception as e:
        print(f"[ERREUR SÉCURITÉ] Impossible de vérifier l'état de la base de données : {e}")
        print("Vérifiez que PostgreSQL est démarré et accessible via DATABASE_URL.")
        sys.exit(1)


def init_roles_and_permissions(db):
    """Initialise les rôles et permissions canoniques V0.1 dans la base migrée."""
    roles_def = [
        ("Administrator", "Gestion intégrale de la sonde, utilisateurs et configurations"),
        ("Analyst", "Investigation des événements, alertes et consultation des journaux"),
        ("Observer", "Consultation en lecture seule des métriques de la plateforme"),
    ]

    permissions_def = [
        ("system:view", "Consulter l'état général et les métriques", "system"),
        ("system:manage", "Gérer les services et configurations", "system"),
        ("interfaces:view", "Consulter la configuration réseau", "network"),
        ("interfaces:manage", "Configurer et valider les interfaces", "network"),
        ("users:view", "Consulter les comptes utilisateurs", "users"),
        ("users:manage", "Créer, modifier ou désactiver des utilisateurs", "users"),
        ("audit:view", "Consulter le journal d'audit de sécurité", "audit"),
        ("storage:manage", "Gérer les quotas et la rétention PCAP", "storage"),
    ]

    created_roles = {}
    for name, desc in roles_def:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name, description=desc)
            db.add(role)
            db.commit()
            db.refresh(role)
        created_roles[name] = role

    created_perms = {}
    for code, desc, mod in permissions_def:
        perm = db.query(Permission).filter(Permission.code == code).first()
        if not perm:
            perm = Permission(code=code, description=desc, module=mod)
            db.add(perm)
            db.commit()
            db.refresh(perm)
        created_perms[code] = perm

    # Attribution Administrator : toutes les permissions
    admin_role = created_roles["Administrator"]
    admin_role.permissions = list(created_perms.values())

    # Attribution Analyst
    analyst_role = created_roles["Analyst"]
    analyst_role.permissions = [
        created_perms["system:view"],
        created_perms["interfaces:view"],
        created_perms["users:view"],
        created_perms["audit:view"],
    ]

    # Attribution Observer
    observer_role = created_roles["Observer"]
    observer_role.permissions = [
        created_perms["system:view"],
        created_perms["interfaces:view"],
    ]

    db.commit()


def init_admin(email: str, full_name: str, password: str):
    """
    Initialisation protégée du premier administrateur :
    - Vérifie que les migrations Alembic ont été appliquées (aucun create_all).
    - Échoue immédiatement si un administrateur existe déjà.
    - Valide la conformité de la politique de mot de passe.
    - Hache avec Argon2id obligatoire.
    - Enregistre l'événement d'audit.
    """
    check_database_migrated()
    db = SessionLocal()
    try:
        init_roles_and_permissions(db)

        # Règle impérative 3.3 : impossibilité de recréer si un admin existe déjà
        admin_role = db.query(Role).filter(Role.name == "Administrator").first()
        existing_admin = (
            db.query(User)
            .join(User.roles)
            .filter(Role.name == "Administrator")
            .first()
        )
        if existing_admin:
            print("[ERREUR SÉCURITÉ] Un administrateur existe déjà dans la base de données.")
            print("Pour des raisons de sécurité, cette commande ne peut être exécutée qu'une seule fois.")
            sys.exit(1)

        # Vérification politique de mot de passe
        is_valid, err = validate_password_strength(password)
        if not is_valid:
            print(f"[ERREUR SÉCURITÉ] Mot de passe invalide : {err}")
            sys.exit(1)

        # Création de l'administrateur
        admin_user = User(
            email=email.lower().strip(),
            full_name=full_name.strip(),
            hashed_password=hash_password(password),
            is_active=True,
            roles=[admin_role],
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        AuditService.log_event(
            db=db,
            action="FIRST_ADMIN_INITIALIZED",
            resource_type="USER",
            resource_id=admin_user.id,
            status="SUCCESS",
            user_email=admin_user.email,
            user_id=admin_user.id,
            details={"email": admin_user.email, "role": "Administrator"},
        )

        print(f"[SUCCÈS] Premier administrateur créé : {admin_user.email} (ID: {admin_user.id})")
    finally:
        db.close()


import getpass

def main():
    parser = argparse.ArgumentParser(description="Outil d'administration CLI OpenNDR V0.1")
    subparsers = parser.add_subparsers(dest="command")

    for cmd_name in ["create-first-admin", "init-admin"]:
        admin_parser = subparsers.add_parser(cmd_name, help="Initialiser de façon sécurisée le premier compte administrateur")
        admin_parser.add_argument("--email", required=True, help="Adresse e-mail de l'administrateur")
        admin_parser.add_argument("--full-name", required=True, help="Nom complet de l'administrateur")
        admin_parser.add_argument("--password", required=False, default=None, help="Mot de passe robuste (invité si omis)")

    args = parser.parse_args()
    if args.command in ["create-first-admin", "init-admin"]:
        password = args.password
        if not password:
            password = getpass.getpass("Saisissez le mot de passe pour le premier administrateur : ")
            confirm = getpass.getpass("Confirmez le mot de passe : ")
            if password != confirm:
                print("[ERREUR] Les deux mots de passe ne correspondent pas.")
                sys.exit(1)
        init_admin(args.email, args.full_name, password)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

