# Architecture Technique — OpenNDR V0.1

## 1. Principes Directeurs
OpenNDR est une solution de détection et réponse réseau autonome respectant les principes suivants :
1. **Souveraineté et autonomie** : Fonctionnement local intégral sans dépendance cloud ni licence externe.
2. **Cloisonnement strict** : Séparation physique ou logique étanche entre l'interface d'administration IP (`eth0`) et l'interface de capture passive (`eth1`).
3. **Furtivité absolue** : L'interface de capture passive n'émet aucun paquet (ARP off, IPv6 désactivé, zéro IP assignée).
4. **Moindre privilège** :
   - Le moteur réseau `openndr-engine` s'exécute sous le compte `openndr-capture` avec les seules capacités `CAP_NET_RAW` et `CAP_NET_ADMIN`.
   - Le backend FastAPI s'exécute sous `openndr` sans droits root.
5. **Persistance éprouvée** : Schémas relationnels PostgreSQL gérés exclusivement via migrations Alembic.

---

## 2. Découpage en Composants

### 2.1 Backend FastAPI (`/opt/openndr/backend`)
- **Rôle** : Orchestration, authentification, RBAC, API REST et métriques système.
- **Technologies** : Python 3.11, FastAPI, Pydantic V2, SQLAlchemy 2.0, Alembic, Argon2id (`argon2-cffi`).
- **Écoute** : `127.0.0.1:8000` (exposé publiquement via le reverse proxy Nginx).
- **Communication IPC** : Échange avec le moteur Rust via socket Unix `/run/openndr/engine.sock`.

### 2.2 Moteur Réseau Rust (`/opt/openndr/engine`)
- **Rôle** : Skeleton V0.1 servant de fondation pour le futur moteur de capture AF_PACKET (V0.2).
- **Technologies** : Rust (crate `openndr-engine`), tokio (socket Unix asynchrone).
- **IPC Protocol** : JSON sur socket Unix local (`{"cmd": "health"}`, `{"status": "ok"}`).

### 2.3 Interface Web SOC (`/opt/openndr/dist`)
- **Rôle** : Console d'exploitation pour les analystes de sécurité.
- **Technologies** : React 19, TypeScript, Tailwind CSS, Vite.
- **Hébergement** : Fichiers statiques compilés servis par Nginx avec SPA fallback.

### 2.4 Base de Données PostgreSQL
- **Rôle** : Persistance transactionnelle des comptes utilisateurs, rôles, permissions, révocation de jetons et journaux d'audit.
- **Règle** : Les fichiers PCAP ne sont **jamais** stockés dans PostgreSQL mais sur le système de fichiers local (`/var/lib/openndr/captures`).
