# OpenNDR — Open Source Network Detection and Response

OpenNDR est une plateforme open source de **Network Detection and Response (NDR)** autonome conçue pour Debian 13, dédiée à la surveillance passive du trafic réseau, au décodage de protocoles, à l'inspection approfondie (DPI), à la détection d'anomalies et à la réponse à incident en environnement SOC.

> **Règle fondamentale** : OpenNDR est un logiciel entièrement autonome. Il possède ses propres moteurs de capture, décodage, reconstruction de flux, détection comportementale et corrélation, sans dépendance obligatoire vers des outils tiers (Suricata, Zeek, Arkime).

---

## 🚀 Version Actuelle : V0.1 (Fondations Techniques)

La version V0.1 établit les fondations logicielles, sécuritaires et architecturales de la plateforme :
- **Architecture modulaire à 3 niveaux** : Moteur réseau autonome en Rust, Backend d'orchestration en FastAPI/Python, Interface Web SOC en React/TypeScript.
- **Séparation stricte des interfaces réseau** :
  - *Interface d'administration (`eth0`)* : accessible par l'équipe SOC, adresse IP statique, API/Web.
  - *Interface de capture passive (`eth1`)* : mode promisc, **zéro adresse IP**, aucune émission de trames, isolation totale.
- **Authentification & Contrôle d'accès basé sur les rôles (RBAC)** :
  - Rôles `Administrator`, `Analyst`, `Observer` avec validation stricte côté serveur.
  - Hachage de mots de passe Argon2id / PBKDF2 et jetons de session sécurisés.
- **Supervision & Journaux d'audit** : traçabilité des accès, état des services systemd, contrôle d'intégrité.
- **Déploiement Debian 13 natif** : scripts `install.sh`, `uninstall.sh`, unités systemd, migrations de base de données PostgreSQL/Alembic.

---

## 🏛️ Architecture Générale

```
                           RÉSEAU SURVEILLÉ (SPAN / Mirror / TAP)
                                          │
                                          ▼
                      ┌──────────────────────────────────────┐
                      │    Interface de Capture Passive      │
                      │       (eth1: No IP, Promisc)         │
                      └──────────────────┬───────────────────┘
                                         │ AF_PACKET / libpcap
                                         ▼
                      ┌──────────────────────────────────────┐
                      │      OpenNDR Network Engine (Rust)   │
                      │  - Capture & Buffer en anneau        │
                      │  - Décodage L2-L4                    │
                      │  - Reconstruction flux TCP/UDP       │
                      │  - Analyseurs protocolaires & DPI    │
                      │  - Moteur de détection & corrélation │
                      └──────────────────┬───────────────────┘
                                         │ IPC Sécurisé (UNIX Socket)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │      OpenNDR Backend (FastAPI)       │
                      │  - API REST & WebSocket              │
                      │  - Authentification & RBAC           │
                      │  - Gestion sessions & alertes        │
                      │  - Stockage PostgreSQL & PCAP local  │
                      └──────────────────┬───────────────────┘
                                         │ HTTPS / WSS
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       OpenNDR Web Interface          │
                      │   (React / TypeScript / Tailwind)    │
                      │      Tableaux de bord SOC & PWA      │
                      └──────────────────────────────────────┘
```

---

## 📦 Structure du Dépôt

```text
openndr/
├── README.md               # Ce document
├── LICENSE                 # Licence AGPL-3.0
├── CONTRIBUTING.md          # Guide de contribution et standards de code
├── SECURITY.md             # Politique de sécurité et divulgation responsable
├── CHANGELOG.md            # Historique des versions
├── .env.example            # Variables d'environnement de référence
├── docs/                   # Documentation technique et spécifications
│   ├── specifications/     # Cahier des charges et exigences
│   ├── architecture/       # ADR, diagrammes et architecture
│   ├── installation/       # Guides de déploiement Debian 13
│   ├── administration/     # Gestion RBAC et configuration
│   └── api/                # Spécifications de l'API REST
├── backend/                # Backend FastAPI / SQLAlchemy / Alembic
├── engine/                 # Moteur réseau natif en Rust
├── frontend/               # Interface Web React / TypeScript / Vite
├── database/               # Schémas SQL et données de référence
└── deployment/             # Unités systemd et scripts Debian
```

---

## 🛠️ Prérequis et Installation sur Debian 13

### Matériel recommandé (Laboratoire)
- CPU : 8 cœurs (x86_64)
- RAM : 32 Go (8 Go minimum en environnement de test)
- Disque : 1 To NVMe pour l'historique PCAP et base de données
- Réseau : 2 interfaces réseau physiques distinctes

### Déploiement automatique
```bash
# Cloner le dépôt
git clone https://github.com/openndr/openndr.git /opt/openndr
cd /opt/openndr

# Exécuter le script de prérequis et d'installation
sudo bash deployment/debian/check-prerequisites.sh
sudo bash deployment/debian/install.sh
```

---

## 🛡️ Sécurité et Confidentialité

OpenNDR est strictement un outil d'observation et de cyberdéfense passive. Par conception :
- L'interface de capture ne répond à aucun paquet ARP, ICMP ou TCP.
- Les données PCAP brutes sont isolées avec des permissions strictes `chmod 700` et ne sont pas stockées dans la base de données relationnelle.
- Les accès administratifs sont audités systématiquement dans un journal d'événements inviolable.

---

## 📄 Licence
OpenNDR est publié sous licence GNU Affero General Public License v3.0 (AGPL-3.0). Voir le fichier [LICENSE](./LICENSE) pour plus de détails.
