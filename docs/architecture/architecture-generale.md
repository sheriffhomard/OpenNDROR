# Architecture Générale — OpenNDR

## 1. Vue d'ensemble du Système

OpenNDR est articulé en trois sous-systèmes indépendants et découplés :

```
[ Réseau Surveillé ] ---> [ Moteur Réseau Rust ]
                                 │
                   (IPC Socket UNIX / Protobuf/JSON-RPC)
                                 │
                                 ▼
                         [ Backend FastAPI ] <---> [ PostgreSQL ]
                                 ▲
                           (REST / WS)
                                 ▼
                     [ Interface Web React / SOC ]
```

### 1.1 Le Moteur Réseau (Rust)
- Développé en Rust moderne pour garantir la sécurité mémoire (Memory Safety) sans Garbage Collector.
- Responsable de la capture des trames brutes (AF_PACKET / ring buffer mmap), du décodage hiérarchique (Ethernet, IP, TCP/UDP), de la reconstruction d'état de sessions et des analyseurs DPI.
- Ne communique avec le reste du système que via un socket UNIX local `/run/openndr/engine.sock`.

### 1.2 Le Backend d'Orchestration (FastAPI / Python)
- Expose l'API REST v1 sécurisée pour la gestion des utilisateurs, des politiques de rétention, des interfaces et des alertes.
- Contrôle le cycle de vie du moteur réseau via l'interface IPC.
- Assure la persistance dans PostgreSQL via SQLAlchemy ORM et Alembic pour les migrations.

### 1.3 L'Interface Web (React / TypeScript)
- Interface utilisateur SOC réactive, conforme aux exigences de contraste et de lisibilité opérationnelle.
- Tableaux de bord de flux, gestion des alertes et incidents, investigation par paquets et administration de la plateforme.

## 2. Décisions d'Architecture Clés (ADR)
- **ADR-001** : Choix de Rust pour le moteur d'analyse réseau (sécurité mémoire, performances prédictibles).
- **ADR-002** : Choix de FastAPI / SQLAlchemy pour le backend de gestion (rapidité de développement, validation Pydantic, écosystème Python riche).
- **ADR-003** : Séparation physique et logique stricte des interfaces réseau (sécurité de la sonde NDR).
