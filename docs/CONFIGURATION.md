# Configuration & Variables d'Environnement — OpenNDR V0.1

Emplacement cible sur Debian 13 : `/etc/openndr/backend.env`  
Permissions requises : `root:openndr` (mode `0640`).

---

## 1. Variables Backend

| Variable | Type | Valeur par défaut | Description |
|---|---|---|---|
| `OPENNDR_ENV` | String | `development` | Environnement d'exécution (`production` ou `development`). En `production`, les contrôles d'invariants stricts sont activés. |
| `SECRET_KEY` | String | *(Obligatoire en prod)* | Clé secrète de chiffrement et de signature JWT (min. 32 caractères). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Integer | `60` | Durée de validité du jeton JWT en minutes. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Integer | `7` | Durée de rétention du jeton de renouvellement. |
| `DATABASE_URL` | String | `postgresql+psycopg2://...` | Chaîne de connexion PostgreSQL standard (ex: `postgresql+psycopg2://openndr:secret@127.0.0.1:5432/openndr_db`). |
| `ADMIN_INTERFACE` | String | `eth0` | Nom de l'interface réseau d'administration (écoute HTTPS / SSH). |
| `CAPTURE_INTERFACE` | String | `eth1` | Nom de l'interface réseau de capture passive (SPAN / TAP, sans IP). |
| `ENGINE_SOCKET_PATH` | String | `/run/openndr/engine.sock` | Chemin d'accès au socket Unix IPC du moteur Rust. |
| `PCAP_STORAGE_PATH` | String | `/var/lib/openndr/captures` | Répertoire local dédié au stockage des fichiers PCAP. |
| `MAX_PCAP_STORAGE_GB` | Integer | `500` | Quota maximal alloué aux captures sur le disque local avant déclenchement de la purge. |
| `PCAP_RETENTION_DAYS` | Integer | `30` | Durée maximale de rétention des captures réseau en jours. |

---

## 2. Invariants de Sécurité en Mode Production

Lorsque `OPENNDR_ENV=production` est défini, le backend applique les contrôles bloquants suivants lors du démarrage :
1. `SECRET_KEY` ne doit être ni vide, ni égal à un secret d'exemple connu (`secret`, `admin`, `password`, etc.).
2. `SECRET_KEY` doit comporter un minimum strict de 32 caractères.
3. `DATABASE_URL` doit être configurée avec un compte PostgreSQL dédié (interdiction d'utiliser le compte par défaut `postgres`).
4. La bibliothèque `argon2-cffi` doit être installée et opérationnelle.
