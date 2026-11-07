# Feuille de Route Technique (Roadmap) — OpenNDR

Ce document présente les étapes de développement officiel d'OpenNDR depuis les fondations V0.1 jusqu'à la première version de production V1.0.

---

## V0.1 — Fondations Techniques & Architecture Système (Version Actuelle)
- **Objectif** : Base logicielle fiable, sécurisée, installable sur Debian 13 et testable.
- **Livrables réalisés** :
  - Architecture modulaire à 3 niveaux (FastAPI, Rust Engine, React SPA).
  - Authentification durcie avec Argon2id obligatoire en production.
  - Gestion des sessions JWT avec révocation persistante multi-workers dans PostgreSQL.
  - Rôles RBAC stricts (`Administrator`, `Analyst`, `Observer`) appliqués côté serveur.
  - Commande CLI d'initialisation du premier administrateur (`openndr-admin create-first-admin`).
  - Journal d'audit de sécurité append-only transactionnel.
  - Déploiement complet Debian 13 avec installateur automatique et unités systemd.
  - Statut honnête des services (moteur Rust en standby, zéro simulation).

---

## V0.2 — Capture Réseau Passive & Décodage des Paquets
- **Objectif** : Rendre la sonde capable d'ingérer du trafic réseau réel.
- **Prérequis indispensables** : La validation stricte de la V0.1.
- **Fonctionnalités prévues** :
  - Moteur de capture passive haute performance en Rust via `AF_PACKET` (mode `PACKET_MMAP`) et `libpcap`.
  - Ingestion de fichiers de traces réseau au format `.pcap` et `.pcapng`.
  - Décodeur de protocoles hiérarchique L2 à L4 :
    - Liaison : Ethernet II, VLAN 802.1Q.
    - Réseau : IPv4, IPv6, ARP, ICMP.
    - Transport : TCP, UDP.
  - Calcul de métriques de débit et volumétrie réelles.
  - Écriture des captures en fichiers locaux rotatifs (`/var/lib/openndr/captures/`).

---

## V0.3 — Reconstruction des Flux & Analyse Protocoles (DPI)
- **Objectif** : Passer du niveau paquet au niveau communication applicative.
- **Fonctionnalités prévues** :
  - Suivi des états de sessions TCP/UDP (flow tracking birectionnel).
  - Analyseurs protocolaires applicatifs autonomes : DNS, HTTP/1.1, TLS (extraction SNI, empreintes JA3/JA4), SSH.
  - Gestion de mémoire bornée anti-déni de service pour les tables de flux.

---

## V0.4 — Moteur de Détection Autonome
- **Objectif** : Identifier les comportements malveillants et anomalies.
- **Fonctionnalités prévues** :
  - Moteur de règles par signatures et motifs réseau.
  - Détection heuristique et par seuils (scans de ports, balayages ARP, tunnels DNS).
  - Génération d'alertes de sécurité explicables et contextualisées.

---

## V0.5 — Corrélation & Dossiers d'Incident
- **Objectif** : Aider les analystes SOC à prioriser et enquêter.
- **Fonctionnalités prévues** :
  - Corrélation temporelle des alertes et déduplication du bruit.
  - Chronologie des incidents et export de rapports d'investigation.

---

## V1.0 — Version Stable de Production
- **Objectif** : Déploiement industriel et validation de performances.
- **Fonctionnalités prévues** :
  - Tests de charge validés à 1 Gbit/s+ sans perte de trames.
  - Packaging `.deb` Debian officiel.
  - Durcissement de sécurité certifié pour environnements OIV / OSE.
