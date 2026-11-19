# Spécification de l'API REST — OpenNDR V0.2

Préfixe d'accès : `/api/v1`  
Format d'échange : JSON (`application/json`)  
Authentification : En-tête standard `Authorization: Bearer <JWT_TOKEN>`  

---

## 1. Endpoints de Santé & Supervision (Publics)

### `GET /api/v1/health`
- **Description** : Rapport global vérifié de la plateforme (connectivité base de données, présence binaire Rust, statut systemd et joignabilité socket IPC).
- **Réponse 200 (base connectée) / 503 (base indisponible)** :
  ```json
  {
    "status": "HEALTHY",
    "version": "0.2.0",
    "target_platform": "Debian 13 (Trixie)",
    "database": {
      "connected": true,
      "status": "CONNECTED",
      "details": "PostgreSQL connection operational"
    },
    "capture_engine": {
      "engine_status": "OPERATIONAL",
      "service_status": "ACTIVE",
      "version": "0.2.0",
      "mode": "STANDBY",
      "ipc_socket": "/run/openndr/engine.sock",
      "binary_present": true,
      "socket_present": true,
      "ipc_reachable": true,
      "ipc_error": null,
      "capture_active": false,
      "active_interface": null,
      "packets_received": 0,
      "notice": "Rust engine IPC verified and operational."
    },
    "timestamp": "2026-11-19T12:00:00+00:00"
  }
  ```

### `GET /api/v1/health/live`
- **Description** : Sonde de disponibilité du processus HTTP API.
- **Réponse 200** : `{"status": "UP", "timestamp": "..."}`

### `GET /api/v1/health/ready`
- **Description** : Sonde d'état prêt avec requête `SELECT 1` sur la base relationnelle.
- **Réponse 200** : `{"status": "READY", "database_connected": true, "timestamp": "..."}`
- **Réponse 503** : Base de données inaccessible.

---

## 2. Authentification & Profil (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Corps de requête** : `{"email": "admin@openndr.local", "password": "..."}`
- **Réponse 200** : `access_token`, `token_type`, `role`, `email`, `full_name`, `permissions`.
- **Réponse 401** : Identifiants invalides ou compte désactivé.

### `POST /api/v1/auth/logout` *(Protégé)*
- **Description** : Invalide le jeton JWT dans PostgreSQL (`revoked_tokens`) de façon **fail-closed** (retourne `503` si la persistance échoue).

### `GET /api/v1/auth/me` *(Protégé)*
- **Description** : Retourne le profil et les permissions de l'utilisateur connecté.

### `POST /api/v1/auth/change-password` *(Protégé)*
- **Corps de requête** : `{"current_password": "...", "new_password": "..."}`

---

## 3. Gestion des Utilisateurs (`/api/v1/users`)

- `GET /api/v1/users` *(Permission `users:view`)*
- `POST /api/v1/users` *(Permission `users:manage`)* — génère un mot de passe temporaire aléatoire si `password` est omis.
- `PUT /api/v1/users/{id}` *(Permission `users:manage`)*
- `POST /api/v1/users/{id}/toggle-active` *(Permission `users:manage`)*
- `DELETE /api/v1/users/{id}` *(Permission `users:manage`)*

---

## 4. Supervision, Capture & Mises à Jour (`/api/v1/system`)

- `GET /api/v1/system/status` *(Permission `system:view`)* : services systemd, isolation passive, stockage PCAP et télémétrie moteur.
- `GET /api/v1/system/capture/telemetry` *(Permission `system:view`)* : télémétrie IPC réelle (sans valeurs fictives si IPC injoignable).
- `POST /api/v1/system/capture/start` / `stop` *(Permission `interfaces:manage`)* : démarre ou arrête la capture via socket IPC (`503` si IPC injoignable).
- `POST /api/v1/system/capture/ingest-pcap` / `upload-pcap` *(Permission `interfaces:manage`)* : décodage PCAP/PCAPNG via `openndr-engine`.
- `GET /api/v1/system/interfaces` *(Permission `interfaces:view`)* : interfaces réseau réelles (`mac_address`, `mtu`, `speed_mbps`, `rx_dropped` à `null` si non collectables).
- `GET /api/v1/system/interfaces/isolation-check` *(Permission `interfaces:view`)* : audit IPv4/IPv6, routage et séparation admin/passive.
- `GET /api/v1/system/storage` *(Permission `system:view`)* : utilisation disque hôte, répertoire PCAP et test réel d'écriture (`isWritable`).
- `GET /api/v1/system/updates` : état de version et planification persistés dans `system_settings` (`release_date` nul si `OPENNDR_RELEASE_DATE` absent).
- `POST /api/v1/system/updates/check` *(Permission `system:manage`)*
- `POST /api/v1/system/updates/force` *(Permission `system:manage`)*
- `PUT /api/v1/system/updates/config` *(Permission `system:manage`)*
- `GET /api/v1/system/audit` *(Permission `audit:view`)* : journal `audit_logs` PostgreSQL.
