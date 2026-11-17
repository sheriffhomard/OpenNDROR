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
            print("[SECURITY ERROR] Database is not ready or migrations are incomplete.")
            print(f"Missing required tables: {', '.join(sorted(missing))}")
            print("Please run official migrations before administrator bootstrap:")
            print("    alembic upgrade head")
            sys.exit(1)
    except Exception as e:
        print(f"[SECURITY ERROR] Unable to verify database state: {e}")
        print("Ensure PostgreSQL is running and accessible via DATABASE_URL.")
        sys.exit(1)


def init_roles_and_permissions(db):
    """Initializes canonical V0.1 roles and permissions in the migrated database."""
    roles_def = [
        ("Administrator", "Full management of sensor, users, and configurations"),
        ("Analyst", "Event investigation, alerts, and log consultation"),
        ("Observer", "Read-only viewing of platform metrics"),
    ]

    permissions_def = [
        ("system:view", "View overall status and metrics", "system"),
        ("system:manage", "Manage services and configurations", "system"),
        ("interfaces:view", "View network configuration", "network"),
        ("interfaces:manage", "Configure and validate interfaces", "network"),
        ("users:view", "View user accounts", "users"),
        ("users:manage", "Create, edit, or disable users", "users"),
        ("audit:view", "View security audit log", "audit"),
        ("storage:manage", "Manage PCAP quotas and retention", "storage"),
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

    # Administrator assignment: all permissions
    admin_role = created_roles["Administrator"]
    admin_role.permissions = list(created_perms.values())

    # Analyst assignment
    analyst_role = created_roles["Analyst"]
    analyst_role.permissions = [
        created_perms["system:view"],
        created_perms["interfaces:view"],
        created_perms["users:view"],
        created_perms["audit:view"],
    ]

    # Observer assignment
    observer_role = created_roles["Observer"]
    observer_role.permissions = [
        created_perms["system:view"],
        created_perms["interfaces:view"],
    ]

    db.commit()


def init_admin(email: str, full_name: str, password: str):
    """
    Protected initialization of the first administrator:
    - Verifies Alembic migrations have been applied (no create_all).
    - Fails immediately if an administrator already exists.
    - Validates password policy compliance.
    - Hashes with mandatory Argon2id.
    - Records the audit event.
    """
    check_database_migrated()
    db = SessionLocal()
    try:
        init_roles_and_permissions(db)

        # Mandatory rule 3.3: prevent re-creation if an admin already exists
        admin_role = db.query(Role).filter(Role.name == "Administrator").first()
        existing_admin = (
            db.query(User)
            .join(User.roles)
            .filter(Role.name == "Administrator")
            .first()
        )
        if existing_admin:
            print("[SECURITY ERROR] An administrator already exists in the database.")
            print("For security reasons, this command can only be executed once.")
            sys.exit(1)

        # Password policy check
        is_valid, err = validate_password_strength(password)
        if not is_valid:
            print(f"[SECURITY ERROR] Invalid password: {err}")
            sys.exit(1)

        # Administrator creation
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

        print(f"[SUCCESS] First administrator created: {admin_user.email} (ID: {admin_user.id})")
    finally:
        db.close()


import getpass

def main():
    parser = argparse.ArgumentParser(description="OpenNDR V0.1 CLI Administration Tool")
    subparsers = parser.add_subparsers(dest="command")

    for cmd_name in ["create-first-admin", "init-admin"]:
        admin_parser = subparsers.add_parser(cmd_name, help="Securely initialize the first administrator account")
        admin_parser.add_argument("--email", required=True, help="Administrator email address")
        admin_parser.add_argument("--full-name", required=True, help="Administrator full name")
        admin_parser.add_argument("--password", required=False, default=None, help="Strong password (prompted if omitted)")

    args = parser.parse_args()
    if args.command in ["create-first-admin", "init-admin"]:
        password = args.password
        if not password:
            password = getpass.getpass("Enter password for the first administrator: ")
            confirm = getpass.getpass("Confirm password: ")
            if password != confirm:
                print("[ERROR] Passwords do not match.")
                sys.exit(1)
        init_admin(args.email, args.full_name, password)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

