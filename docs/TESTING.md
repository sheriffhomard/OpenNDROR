# Procédures de Test & Assurance Qualité — OpenNDR V0.2

Ce document recense les suites de tests automatisés et les commandes de validation d'OpenNDR V0.2.

---

## 1. Tests Backend & Migrations (Python / FastAPI / Alembic)

Les tests backend sont situés dans `backend/tests/` et utilisent `pytest`, `httpx` et `alembic`.

```bash
# Vérification du schéma Alembic (upgrade / downgrade / upgrade) sur PostgreSQL
cd backend
alembic upgrade head
alembic downgrade base
alembic upgrade head

# Exécution de la suite complète
cd ..
PYTHONPATH=backend python3 -m pytest backend/tests -v --tb=short
```

### Couverture des tests :
- `backend/tests/test_auth.py` :
  - Hachage Argon2id exclusif (`$argon2id$`) et rejet absolu des condensats PBKDF2 ou malformés.
  - Validation des invariants de production (`SECRET_KEY`, `DATABASE_URL` non-SQLite, absence de placeholders).
  - Révocation JWT persistante avec schéma créé via Alembic (upgrade/downgrade roundtrip).
  - Comportement **fail-closed** (`DatabaseSecurityError`) si session DB absente ou en erreur.
- `backend/tests/test_rbac.py` :
  - Matrice des 3 rôles et 8 permissions (`Administrator`, `Analyst`, `Observer`).
- `backend/tests/test_api_and_db.py` :
  - Connexion, rejet 401 des comptes désactivés/invalides, révocation au logout et HTTP 503 en panne DB.
  - Contrôle RBAC HTTP 403 (`Observer` bloqué sur `users`, `audit`, `capture/start`, `updates/*`).
  - Persistance `/api/v1/system/updates*` sans `release_date` fictive.
  - Honnêteté des interfaces (`null` si sysfs indisponible), sonde d'isolation (`NOT_CONFIGURED`, `CONFIG_CONFLICT`), écriture PCAP réelle (`isWritable`) et sonde IPC moteur.

---

## 2. Tests Frontend, Anti-Prototypage & Build (Node.js / TypeScript / Vite)

```bash
# Scanner anti-mock + test négatif de régression + rendu SSR UI/RBAC + tsc --noEmit
npm test

# Vérification TypeScript seule
npm run lint

# Compilation de production Vite + PWA
npm run build
```

---

## 3. Tests Moteur Réseau (Rust)

```bash
cargo fmt --manifest-path engine/Cargo.toml -- --check
cargo clippy --manifest-path engine/Cargo.toml -- -D warnings
cargo test --manifest-path engine/Cargo.toml
cargo build --manifest-path engine/Cargo.toml --release
```

---

## 4. Tests d'Installation et Scripts Shell (Debian 13)

```bash
bash -n deployment/debian/check-prerequisites.sh
bash -n deployment/debian/install.sh
bash -n deployment/debian/uninstall.sh
bash deployment/debian/check-prerequisites.sh
```
