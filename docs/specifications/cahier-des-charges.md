# Cahier des Charges — Plateforme OpenNDR (V0.1 à V1.0)

## 1. Contexte et Vision
OpenNDR est une solution souveraine et open source de **Network Detection and Response** conçue pour les équipes de sécurité (SOC, CERT, CSIRT, MSSP).
Face à l'augmentation des cyberattaques sophistiquées (mouvements latéraux, exfiltration discrète, ransomwares), la visibilité réseau passive est un pilier indispensable de la défense en profondeur.

## 2. Règle Fondamentale d'Autonomie
OpenNDR est conçu comme une plateforme totalement autonome :
- Il ne dépend ni de Suricata, ni de Zeek, ni d'Arkime pour fonctionner.
- Il développe ses propres structures de parsing réseau et d'assemblage de flux.
- Il garantit un fonctionnement local sans dépendance obligatoire vers des services cloud ou des abonnements tiers.

## 3. Périmètre de la Version V0.1
La V0.1 ne doit pas tenter de livrer immédiatement la capture à haute vitesse ou le moteur d'IA complexe. Elle a pour but unique et impératif de poser les fondations techniques :
1. Architecture modulaire testée et documentée.
2. Backend REST FastAPI avec authentification sécurisée et RBAC.
3. Base relationnelle PostgreSQL avec migrations Alembic testées.
4. Moteur réseau en Rust initialisé avec types et contrats d'interface stricts.
5. Interface Web responsive pour l'exploitation et la supervision.
6. Validation matérielle de l'isolation réseau entre interface d'administration et de capture.
7. Scripts d'installation et intégration systemd Debian 13.
