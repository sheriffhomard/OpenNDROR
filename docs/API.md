# Spécification de l'API REST — OpenNDR V0.1

Préfixe d'accès : `/api/v1`  
Format d'échange : JSON (`application/json`)  
Authentification : En-tête standard `Authorization: Bearer <JWT_TOKEN>`  

---

## 1. Endpoints de Santé & Supervision (Publics)

### `GET /api/v1/health`
- **Description** : Rapport global de santé de la plateforme.
- **Réponse 200** :
  ```json
  {
    "status": "healthy",
    "version": "0.1.0",
    "target_platform": "Debian 13 (Trixie)",
    "database": {"connected": true, "status": "active"},
    "capture_engine": {"socket_ready": false, "status": "standby_v0.1"},
    "timestamp": "2026-11-07T12:00:00Z"
  }
  ```

### `GET /api/v1/health/live`
- **Description** : Sonde de disponibilité (Liveness Probe pour systemd/Kubernetes).
- **Réponse 200** : `{"status": "UP", "timestamp": "..."}`

### `GET /api/v1/health/ready`
- **Description** : Sonde d'état prêt avec ping de base de données PostgreSQL.
- **Réponse 200** : `{"status": "READY", "database_connected": true, "timestamp": "..."}`
- **Réponse 503** : Base de données inaccessible.

---

## 2. Authentification & Profil (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Corps de requête** : `{"email": "admin@openndr.local", "password": "..."}`
- **Réponse 200** :
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "role": "Administrator",
    "email": "admin@openndr.local",
    "full_name": "Administrateur SOC",
    "permissions": ["system:view", "users:manage", ...]
  }
  ```
- **Réponse 401** : Identifiants invalides ou compte désactivé.

### `POST /api/v1/auth/logout` *(Protégé)*
- **Description** : Invalide le jeton JWT dans PostgreSQL (`revoked_tokens`) et journalise l'événement.
- **Réponse 200** : `{"message": "Déconnexion réussie"}`

### `GET /api/v1/auth/me` *(Protégé)*
- **Description** : Retourne les informations complètes et permissions du compte connecté.

### `POST /api/v1/auth/change-password` *(Protégé)*
- **Corps de requête** : `{"current_password": "...", "new_password": "..."}`
- **Réponse 200** : `{"message": "Mot de passe modifié avec succès"}`

---

## 3. Gestion des Utilisateurs (`/api/v1/users`) *(Permission `users:manage`)*

### `GET /api/v1/users`
- **Description** : Liste l'ensemble des comptes persistés dans PostgreSQL.

### `POST /api/v1/users`
- **Corps de requête** :
  ```json
  {
    "email": "analyste@openndr.local",
    "full_name": "Analyste N2",
    "role_name": "Analyst",
    "password": null
  }
  ```
- **Réponse 200** : Si le mot de passe est omis, un secret temporaire conforme à la politique est généré et retourné dans le champ `temporary_password` (affiché une seule fois).

### `POST /api/v1/users/{id}/toggle-active`
- **Description** : Active ou désactive un compte utilisateur.

---

## 4. Supervision Système (`/api/v1/system`)

### `GET /api/v1/system/status` *(Permission `system:view`)*
- **Description** : Retourne l'état des services systemd, interfaces et stockage.

### `GET /api/v1/system/interfaces` *(Permission `interfaces:view`)*
- **Description** : Retourne la liste des interfaces réseau et leur conformité furtive.

### `GET /api/v1/system/storage` *(Permission `system:view`)*
- **Description** : Retourne les quotas et chemins de stockage PCAP locaux.

### `GET /api/v1/system/audit` *(Permission `audit:view`)*
- **Description** : Consulte le journal d'audit de sécurité (`audit_logs`) avec filtres optionnels.
