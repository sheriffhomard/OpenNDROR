# OpenNDR — Open Source Network Detection and Response

**Dépôt officiel** : https://github.com/sheriffhomard/OpenNDROR  
**Version** : V0.1 (Fondations Logicielles et Architecture Système)  
**Licence** : AGPL-3.0  
**Système d'exploitation cible** : Debian 13 (Trixie) GNU/Linux  

---

## 1. Présentation Générale

OpenNDR est une plateforme open source souveraine de **Network Detection and Response (NDR)** autonome pour Debian 13.
Conçue pour les centres opérationnels de sécurité (SOC) et les infrastructures critiques, elle offre une traçabilité réseau totale sans dépendre de services cloud externes, abonnements ou sondes propriétaires.

> **Principe d'indépendance** : OpenNDR intègre ses propres composants logiciels sans imposer de dépendances obligatoires vers des moteurs tiers (Suricata, Zeek ou Arkime).

---

## 2. Périmètre et État Réel de la Version V0.1

Conformément au cahier des charges de développement, la **V0.1** établit un socle technique robuste, testé et audité.  
Elle ne simule **aucune** fonctionnalité non encore développée.

| Composant | État V0.1 | Description technique |
|---|---|---|
| **Backend REST** | **Implémenté & Testé** | FastAPI, Pydantic V2, SQLAlchemy 2.0, pool de connexions durci |
| **Authentification** | **Implémenté & Testé** | Argon2id natif obligatoire en production, rejet absolu des secrets par défaut |
| **Sessions JWT** | **Implémenté & Testé** | Validation stricte des claims (`sub`, `iss`, `aud`, `exp`, `iat`, `jti`), signature HMAC-SHA256 |
| **Révocation JWT** | **Implémenté & Testé** | Persistante et partagée multi-workers via table PostgreSQL `revoked_tokens` |
| **Contrôle d'accès** | **Implémenté & Testé** | RBAC strict (`Administrator`, `Analyst`, `Observer`) vérifié sur chaque endpoint serveur |
| **Bootstrap Admin** | **Implémenté & Testé** | Commande CLI `openndr-admin create-first-admin` à usage unique |
| **Base de données** | **Implémenté & Testé** | PostgreSQL relationnel, schémas pilotés exclusivement par Alembic |
| **Journal d'audit** | **Implémenté & Testé** | Table `audit_logs` append-only, horodatage UTC, IP, masquage strict des secrets |
| **Frontend Web** | **Implémenté & Testé** | React 19, TypeScript, Tailwind CSS, communication HTTP réelle avec l'API REST |
| **Moteur Réseau (Rust)** | **Skeleton / Standby** | Binaire natif `openndr-engine`, socket IPC `/run/openndr/engine.sock`, gestion SIGINT/SIGTERM |
| **Capture AF_PACKET** | *Prévu en V0.2* | **Non actif en V0.1** (0 paquets capturés, aucune simulation artificielle) |
| **Décodage & DPI** | *Prévu en V0.2/V0.3* | Non implémenté en V0.1 |
| **Moteur de détection** | *Prévu en V0.4* | Non implémenté en V0.1 |

---

## 3. Architecture Technique

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RÉSEAU SOC / SUPERVISION                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Port 443 / Reverse Proxy)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Serveur Web Nginx & Frontend SPA React (/opt/openndr/dist)           │
│  - Tableaux de bord de supervision                                     │
│  - Gestion RBAC des utilisateurs                                       │
│  - Journal d'audit et diagnostic de conformité                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ /api/v1/ (HTTP REST)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Backend d'Orchestration FastAPI (/opt/openndr/backend)               │
│  - Authentification Argon2id & Délivrance JWT                           │
│  - Middleware RBAC & Révocation persistante des jetons                 │
│  - Supervision système & sondes liveness/readiness                     │
│  - CLI d'administration : openndr-admin create-first-admin             │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │ SQLAlchemy                             │ UNIX Socket IPC
                ▼                                        ▼
┌────────────────────────────────┐      ┌────────────────────────────────┐
│ PostgreSQL 15+ & Alembic       │      │ Moteur Réseau Rust (Skeleton)  │
│ - Users, Roles, Permissions    │      │ - Standby V0.1 (attente V0.2)  │
│ - Revoked Tokens (persistant)  │      │ - IPC /run/openndr/engine.sock │
│ - Audit Logs (append-only)     │      │ - Capture passive (Zéro IP)    │
│ - Network Interfaces state     │      │ - Ring Buffer AF_PACKET (V0.2) │
└────────────────────────────────┘      └────────────────────────────────┘
```

---

## 4. Arborescence du Projet

```text
OpenNDROR/
├── backend/                    # Backend Python / FastAPI / SQLAlchemy / Alembic
│   ├── app/
│   │   ├── api/v1/             # Routes REST versionnées (auth, users, system, health)
│   │   ├── core/               # Configuration, base de données, sécurité Argon2id/JWT
│   │   ├── models/             # Modèles SQLAlchemy (User, Role, RevokedToken, AuditLog)
│   │   ├── schemas/            # Validation Pydantic V2
│   │   ├── services/           # Services métier (AuthService, UserService, AuditService)
│   │   └── cli.py              # CLI d'administration (openndr-admin)
│   ├── migrations/             # Migrations versionnées Alembic
│   ├── tests/                  # Suite de tests automatisés pytest
│   └── pyproject.toml          # Dépendances Python et script entrypoint
├── engine/                     # Workspace Rust (openndr-engine)
│   ├── crates/engine/          # Binaire serveur IPC et skeleton capture
│   └── Cargo.toml              # Dépendances et workspace Rust
├── deployment/                 # Déploiement natif Debian 13
│   ├── debian/                 # install.sh, uninstall.sh, check-prerequisites.sh, nginx
│   ├── systemd/                # openndr-backend.service, openndr-engine.service, openndr-web.service
│   └── configuration/          # backend.env.example, openndr.conf.example
├── docs/                       # Documentation d'ingénierie et spécifications
│   ├── ARCHITECTURE.md         # Décisions d'architecture détaillées
│   ├── INSTALLATION_DEBIAN_13.md# Guide complet d'installation pas-à-pas
│   ├── CONFIGURATION.md        # Guide des variables d'environnement et de configuration
│   ├── SECURITY.md             # Modèle de sécurité et politique de divulgation
│   ├── API.md                  # Spécification exhaustive des routes REST V1
│   ├── DATABASE.md             # Dictionnaire des tables et schéma Alembic
│   ├── DEVELOPMENT.md          # Guide de contribution locale
│   ├── TESTING.md              # Procédures de test et d'assurance qualité
│   ├── ROADMAP.md              # Feuille de route technique V0.1 -> V1.0
│   └── TROUBLESHOOTING.md      # Résolution des anomalies opérationnelles
├── src/                        # Interface Web React / TypeScript / Vite
├── index.html                  # Point d'entrée SPA
├── package.json                # Dépendances Node.js / React
├── vite.config.ts              # Configuration Vite avec proxy /api
└── .github/workflows/ci.yml    # Pipeline d'intégration continue GitHub Actions
```

---

## 5. Guide de Déploiement Rapide (Debian 13)

### 5.1 Prérequis
- Debian 13 (Trixie) x86_64
- 2 cœurs CPU minimum (4+ recommandés)
- 4 Go de mémoire RAM minimum (8+ Go recommandés)
- 2 interfaces réseau physiques (ex: `eth0` pour gestion IP, `eth1` pour écoute passive sans IP)

### 5.2 Installation Automatique
```bash
git clone https://github.com/sheriffhomard/OpenNDROR.git /opt/openndr
cd /opt/openndr
sudo bash deployment/debian/install.sh
```

### 5.3 Initialisation Obligatoire du Premier Administrateur
```bash
# La plateforme refuse tout démarrage avec des comptes par défaut
openndr-admin create-first-admin --email admin@votre-domaine.local --full-name "Admin SOC"
```

### 5.4 Démarrage des Services
```bash
sudo systemctl start openndr-backend
sudo systemctl start openndr-engine
```

### 5.5 Vérification des Statuts
```bash
curl -s http://127.0.0.1:8000/api/v1/health | jq .
curl -s http://127.0.0.1:8000/api/v1/health/ready | jq .
```

---

## 6. Prochaines Étapes : Préparation V0.2

La version **V0.2** introduira les mécanismes réels de capture réseau et de décodage :
1. Ring buffer kernel `AF_PACKET` (PACKET_MMAP) dans le moteur Rust.
2. Ingestion et rejeu de fichiers `.pcap` et `.pcapng`.
3. Décodeur hiérarchique L2 à L4 (Ethernet II, 802.1Q, ARP, IPv4, IPv6, TCP, UDP, ICMP).
4. Calcul des métriques de trafic en temps réel sans simulation.
