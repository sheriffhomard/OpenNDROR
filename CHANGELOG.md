# Journal des Modifications (CHANGELOG) — OpenNDR

Toutes les modifications notables apportées à ce projet sont consignées dans ce document.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [0.2.0] - 2026-11-19

### Ajouté
- **Moteur Réseau Rust V0.2 (`openndr-engine`)** :
  - Capture passive zéro-copie `AF_PACKET` / `PACKET_MMAP` (`TPACKET_V2`) sur l'interface SPAN dédiée.
  - Décodeur hiérarchique L2–L4 natif : Ethernet II, VLAN 802.1Q, ARP, IPv4, IPv6, ICMPv4/v6, TCP (drapeaux et options) et UDP.
  - Lecteur `.pcap` / `.pcapng` (`upload-pcap` et `ingest-pcap`) et écriture PCAP rotative locale.
- **Refonte Complète de l'Interface d'Administration (Navigation Unifiée & Honnêteté des Données)** :
  - Suppression de l'ancienne navigation dispersée (`Header`, barre horizontale `Navigation`, `HamburgerMenu`, bannière `ContextualOnboarding`) au profit d'une **barre latérale unique persistante** (`Sidebar`) avec 4 groupes (*Principal*, *Surveillance*, *Sécurité*, *Administration*) et tiroir mobile, couplée à une **barre supérieure épurée** (`TopBar`).
  - Nouvelle identité visuelle sobre et lisible (thème **Clair** `#f3f4f6` / `#ffffff` et thème **Sombre** `#111318` / `#181b20`) avec bibliothèque de composants UI unifiés (`PageHeader`, `SectionCard`, `StatusBadge`, `StateBlocks`, `DataTable`, `ConfirmDialog`).
  - Élimination de toute valeur de repli fictive (`eth0`/`eth1` codés en dur, versions/dates statiques, `'Audited User'`, compteurs factices) : affichage explicite des états réels (`Opérationnel`, `En fonctionnement dégradé`, `Arrêté`, `Indisponible`, `Non configuré`, `Inconnu`, `Aucune donnée de capture disponible`).
  - Filtrage RBAC effectif du menu selon les permissions de l'utilisateur connecté et invalidation immédiate des données obsolètes si le serveur devient inaccessible.
- **Paramètres Système & Mises à Jour Automatiques en Arrière-Plan** :
  - Réorganisation stricte de **Paramètres système** en 5 catégories (*Système*, *Mises à jour*, *Affichage*, *Préférences utilisateur*, *Informations légales*), avec confirmation avant mise à jour forcée et installation PWA intégrée.
  - Routes `/api/v1/system/updates*` et planificateur serveur `setInterval` couplé au Service Worker PWA `registerType: 'autoUpdate'`.
- **Onboarding Légal, Logo & Application Installable (PWA)** :
  - **Modale d'Onboarding Légal** au premier démarrage précisant que **l'auteur n'est pas responsable des données fournies, importées ou traitées dans l'application**.
  - Logo vectoriel officiel (`/public/icon.svg`, `/public/icon-maskable.svg`, `<AppLogo />`), icônes PWA et bouton **Installer l'application**.
- **Tests Automatisés & Documentation** :
  - Ajout de `scripts/verify-ui.mts` à `npm test` pour vérifier par rendu réel les garde-fous RBAC, les états d'erreur/indisponibilité et l'absence de données fictives.
  - Captures d'écran actualisées dans `docs/screenshots/` et mise à jour de `README.md`, `CONTEXT.md` et `CHANGELOG.md`.

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
