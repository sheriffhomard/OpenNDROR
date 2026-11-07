# Schéma & Base de Données — OpenNDR V0.1

Base de données cible : **PostgreSQL 15+**  
Moteur de migration : **Alembic** (exclusivement)  
ORM : **SQLAlchemy 2.0**

---

## 1. Dictionnaire des Tables Relationnelles

### Table `users`
Stocke les comptes utilisateurs habilités sur la plateforme.
- `id` : `String(36)` (UUID v4), clé primaire.
- `email` : `String(255)`, unique, indexé.
- `hashed_password` : `String(255)`, condensat cryptographique Argon2id.
- `full_name` : `String(128)`, nom complet.
- `is_active` : `Boolean`, état du compte.
- `created_at` : `DateTime(timezone=True)`.
- `last_login_at` : `DateTime(timezone=True)`, horodatage de la dernière authentification.

### Table `roles`
Définit les rôles du modèle RBAC (`Administrator`, `Analyst`, `Observer`).
- `id` : `Integer`, clé primaire.
- `name` : `String(64)`, unique.
- `description` : `Text`.
- `created_at` : `DateTime(timezone=True)`.

### Table `permissions`
Définit les privilèges applicatifs granulaires (`system:view`, `users:manage`, etc.).
- `id` : `Integer`, clé primaire.
- `code` : `String(64)`, unique, indexé.
- `description` : `Text`.
- `module` : `String(32)`.

### Table `user_roles`
Table d'association Many-to-Many entre utilisateurs et rôles.

### Table `role_permissions`
Table d'association Many-to-Many entre rôles et permissions.

### Table `revoked_tokens`
Assure la révocation persistante et partagée des jetons JWT entre tous les workers Uvicorn.
- `id` : `Integer`, clé primaire.
- `jti` : `String(64)`, identifiant unique du jeton révoqué, indexé.
- `user_id` : `String(36)`, référence vers `users.id` (ondelete=CASCADE).
- `revoked_at` : `DateTime(timezone=True)`.
- `expires_at` : `DateTime(timezone=True)`, date d'expiration naturelle du jeton pour purge automatique.

### Table `audit_logs`
Journal d'audit de sécurité append-only.
- `id` : `Integer`, clé primaire.
- `timestamp` : `DateTime(timezone=True)`, horodatage UTC.
- `user_id` : `String(36)`, clé étrangère vers `users.id` (ondelete=SET NULL).
- `user_email` : `String(255)`.
- `ip_address` : `String(45)`.
- `action` : `String(64)`, code d'action normalisé.
- `resource_type` : `String(64)`.
- `resource_id` : `String(128)`.
- `details_json` : `Text`, métadonnées sanitisées (sans secrets).
- `status` : `String(16)` (`SUCCESS`, `DENIED`, `FAILURE`).

### Table `network_interfaces`
Enregistre la configuration et l'état de conformité furtive des interfaces.
- `id` : `Integer`, clé primaire.
- `name` : `String(32)`, unique (ex: `eth0`, `eth1`).
- `role` : `String(16)` (`ADMINISTRATION` ou `CAPTURE_PASSIVE`).
- `ip_address` : `String(45)` (doit être `NULL` pour `CAPTURE_PASSIVE`).
- `mac_address` : `String(17)`.
- `is_promiscuous` : `Boolean`.
- `is_up` : `Boolean`.
- `mtu` : `Integer`.
- `speed_mbps` : `Integer`.
- `rx_dropped` : `Integer`.
- `updated_at` : `DateTime(timezone=True)`.

---

## 2. Procédures de Migration Alembic

Les modifications de schéma sont impérativement gérées par Alembic :
```bash
# Vérifier l'état actuel des migrations
alembic current

# Appliquer les migrations
alembic upgrade head

# Annuler la dernière révision
alembic downgrade -1
```
