# Rapport d'Audit Initial — OpenNDR V0.1

**Date de réalisation :** 2026-11-06  
**Auditeur :** Ingénieur Cybersécurité & Architecte Logiciel Senior  
**Périmètre :** Dépôt OpenNDR (V0.1.0)  

---

## 1. Synthèse de l'Audit Initial par Composant

| Composant | Statut Initial | Constats Techniques |
| :--- | :--- | :--- |
| **Authentification Backend** | **Défectueux & Simulé** | Présence de `MOCK_USERS` en mémoire dans `app/main.py`. Mots de passe pré-hachés par PBKDF2 au lieu d'Argon2id. Aucun modèle d'utilisateurs en base. Clé secrète JWT faible par défaut. |
| **Initialisation Premier Admin**| **Absent** | Aucune procédure CLI ou interactive sécurisée pour créer l'administrateur initial. Pas de protection contre la recréation si un admin existe déjà. |
| **Contrôle d'Accès (RBAC)** | **Partiellement implémenté** | Décorateur de permissions rudimentaire vérifiant un tableau statique en mémoire sans contrôle d'accès persistant en base ni gestion des sessions révocables. |
| **Configuration CORS** | **Défectueux** | `allow_origins=["*"]` combiné avec `allow_credentials=True` dans `app/main.py`, ce qui constitue une faille de sécurité majeure (violation RFC et OWASP). |
| **Persistance PostgreSQL** | **Simulé / Absent** | Aucun modèle SQLAlchemy implémenté dans `backend/app/models/`. Aucune migration Alembic existante. La route `/api/v1/health` annonce faussement `database: CONNECTED` sans ping SQL réel. |
| **Journaux d'Audit** | **Simulé** | Stockés dans un tableau Python `MOCK_AUDIT_LOGS` en mémoire, perdus à chaque redémarrage et non protégés en écriture. |
| **Frontend Web** | **Simulé** | `src/services/api.ts` contient des listes statiques d'utilisateurs (`INITIAL_USERS`), d'interfaces (`INITIAL_INTERFACES`) et de faux tests avec `setTimeout(260ms)` dans `ValidationView.tsx`. Pas d'appels `fetch()` réels vers l'API. |
| **Moteur Réseau Rust** | **Incomplet / Absent** | Les crates de bibliothèque `openndr-common` et `openndr-capture` existent, mais il n'existe **aucun binaire exécutable `openndr-engine`** dans le workspace. Le service systemd pointe vers un binaire inexistant. |
| **Déploiement Debian 13** | **Incohérent & Incomplet** | `install.sh` crée uniquement des répertoires et copie les services sans compiler Rust, sans installer les dépendances Python/Node, sans initialiser la base. `openndr-web.service` référence `/opt/openndr/frontend/server.js` qui n'existe pas. |
| **Intégration Continue (CI)** | **Partiellement implémenté** | Workflows utilisant des actions non épinglées (`actions/checkout@v4`, `actions/setup-python@v5`), absence de tests Rust (`cargo clippy`, `cargo test`) et absence de service PostgreSQL pour les tests d'intégration. |

---

## 2. Classification Détaillée par Règles Impératives

- **Implémenté et testé :**
  - Contrats types Rust `openndr-common` et tests d'invariance d'absence d'IP (`test_invariants`).
  - Validation de non-régression compilation TypeScript / Tailwind v4.
- **Implémenté mais non testé :**
  - Scripts `uninstall.sh` et `check-prerequisites.sh` (syntaxe bash vérifiée mais non exécutés de bout en bout sur machine Debian 13 dédiée).
- **Partiellement implémenté :**
  - Configuration de base `Settings` dans `backend/app/core/config.py`.
  - Schéma SQL initial dans `database/schemas/001_initial_schema.sql` (existant mais non migré par Alembic).
- **Simulé :**
  - Authentification et utilisateurs (`MOCK_USERS` côté backend, `INITIAL_USERS` côté frontend).
  - Télémétrie d'interfaces et de stockage côté frontend.
  - Exécution des tests de recette dans la console Web (`ValidationView.tsx`).
- **Absent :**
  - Binaire exécutable Rust `openndr-engine`.
  - Modèles SQLAlchemy et migrations Alembic effectives.
  - Script CLI d'initialisation du premier administrateur.
  - Serveur de production Node `server.js` pour `openndr-web.service`.
- **Défectueux :**
  - Wildcard CORS avec identifiants.
  - Route de santé annonçant une base connectée sans vérification.
  - Chemins d'artefacts dans les unités systemd.

---

## 3. Plan d'Action Correctif

1. **Lot 1** : Hachage Argon2id, politique de mot de passe, secret JWT strict, RBAC serveur et CLI `init-admin`.
2. **Lot 2** : Modèles SQLAlchemy, migrations Alembic, moteur de base de données et health checks réels avec liveness/readiness.
3. **Lot 3** : Service d'audit persistant en base relationnelle avec horodatage UTC et IP.
4. **Lot 4** : Restriction stricte de CORS et assainissement des entrées/erreurs.
5. **Lot 5** : Nettoyage intégral des simulations frontend et intégration avec les endpoints API réels.
6. **Lot 6** : Création du crate binaire `openndr-engine` en Rust avec socket IPC et arrêt propre.
7. **Lot 7** : Refonte de `deployment/` (scripts d'installation complets, serveur `server.js`, unités systemd cohérentes).
8. **Lot 8** : Pipeline CI durci avec contrôle PostgreSQL, Rust, Python et Frontend.
9. **Lot 9** : Suite de tests automatisés exhaustive.
10. **Lot 10** : Documentation et rapport final.
