# Journal des Modifications (CHANGELOG) — OpenNDR

Toutes les modifications notables apportées à ce projet sont consignées dans ce document.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [0.1.0] - 2026-11-06

### Ajouté
- **Architecture de base V0.1** :
  - Définition du cadre architectural global (Moteur Rust, Backend FastAPI, Frontend React/TypeScript).
  - Spécifications fonctionnelles, techniques et ADR d'architecture.
- **Backend FastAPI** :
  - API de santé et supervision `/api/v1/health`.
  - Authentification locale sécurisée avec hachage Argon2id / PBKDF2.
  - Gestion des rôles et autorisations (RBAC : `Administrator`, `Analyst`, `Observer`).
  - Validation et gestion de la séparation des interfaces d'administration et de capture passive.
  - Journalisation structurée et audit trails des actions sensibles.
- **Base de données & Migrations** :
  - Schéma relationnel initial PostgreSQL avec tables `users`, `roles`, `permissions`, `network_interfaces`, `audit_logs`, `system_settings`.
  - Configuration et migrations Alembic.
- **Moteur Réseau (Rust Engine)** :
  - Squelette du workspace Rust modulaire (`openndr-common`, `openndr-capture`).
  - Types de données sécurisés, protocoles et définitions IPC.
- **Déploiement Debian 13** :
  - Unités systemd `openndr-backend.service`, `openndr-engine.service`, `openndr-web.service`.
  - Scripts `check-prerequisites.sh`, `install.sh`, `uninstall.sh`.
- **Frontend SOC Web** :
  - Tableau de bord de supervision SOC avec thème sombre haute lisibilité.
  - Gestion des utilisateurs et de la matrice de droits RBAC.
  - Inspecteur d'interface de capture et validation de non-émission.
  - Console de diagnostic et d'exécution des tests automatisés V0.1.
  - Explorateur de documentation et ADR intégrés.
- **Intégration Continue (CI)** :
  - Workflows GitHub Actions pour les vérifications de linting, typage, tests et sécurité.
