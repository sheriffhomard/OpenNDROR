# Configuration & Variables d'Environnement — OpenNDR V0.2

Emplacement cible sur Debian 13 : `/etc/openndr/backend.env` et `/etc/openndr/openndr.conf`  
Permissions requises : `root:openndr` (mode `0640`).

---

## 1. Variables Backend (`/etc/openndr/backend.env`)

| Variable | Type | Défaut / Requis | Description |
|---|---|---|---|
| `OPENNDR_ENV` | String | `development` (`production` sur Debian) | Environnement d'exécution. En `production`, les contrôles d'invariants bloquants sont activés. |
| `SECRET_KEY` | String | **Obligatoire** *(aucun défaut)* | Clé secrète HMAC-SHA256 pour la signature JWT (`>= 32` caractères, aucun placeholder accepté). |
| `DATABASE_URL` | String | **Obligatoire en prod** | Chaîne de connexion PostgreSQL (`postgresql+psycopg2://...`). SQLite interdit en production. |
| `OPENNDR_RELEASE_DATE` | String | `null` si absent | Date de sortie affichée dans l'API `/api/v1/system/updates` (jamais inventée si absente). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Integer | `60` | Durée de validité du jeton JWT en minutes. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Integer | `7` | Durée de rétention du jeton de renouvellement. |
| `ADMIN_INTERFACE` | String | `eth0` | Nom de l'interface réseau d'administration. |
| `CAPTURE_INTERFACE` | String | `eth1` | Nom de l'interface réseau de capture passive (SPAN / TAP, sans IP ni route). |
| `ENGINE_SOCKET_PATH` | String | `/run/openndr/engine.sock` | Chemin d'accès au socket Unix IPC du moteur Rust. |
| `PCAP_STORAGE_PATH` | String | `/var/lib/openndr/captures` | Répertoire local dédié au stockage des fichiers PCAP (`chmod 700`). |
| `MAX_PCAP_STORAGE_GB` | Integer | `500` | Quota maximal alloué aux captures sur le disque local. |
| `PCAP_RETENTION_DAYS` | Integer | `30` | Durée maximale de rétention des captures réseau en jours. |

---

## 2. Variables Frontend (`.env.example` — Développement uniquement)

| Variable | Type | Défaut | Description |
|---|---|---|---|
| `VITE_API_PROXY_TARGET` | String | *(non défini)* | Cible proxy Vite dev vers FastAPI (ex. `http://127.0.0.1:8001`). |
| `VITE_API_BASE_URL` | String | `/api/v1` | Préfixe des appels REST du client React. |

---

## 3. Invariants de Sécurité en Mode Production

Lorsque `OPENNDR_ENV=production` est défini, le backend applique les contrôles bloquants suivants au démarrage :
1. `SECRET_KEY` ne doit être ni vide, ni inférieure à 32 caractères, ni égale à une valeur d'exemple/placeholder connue.
2. `DATABASE_URL` doit être renseignée, pointer vers PostgreSQL (SQLite refusé) et ne contenir aucun mot de passe d'exemple.
3. La bibliothèque `argon2-cffi` doit être installée et opérationnelle.
