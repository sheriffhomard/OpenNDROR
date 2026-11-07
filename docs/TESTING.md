# Procédures de Test & Assurance Qualité — OpenNDR V0.1

Ce document recense les suites de tests automatisés et les commandes de validation de la V0.1.

---

## 1. Tests Backend (Python / FastAPI)

Les tests backend sont situés dans `backend/tests/` et utilisent `pytest` et `httpx`.

```bash
# Exécution de la suite complète
PYTHONPATH=backend python3 -m pytest backend/tests -v

# Exécution avec rapport détaillé de couverture
PYTHONPATH=backend python3 -m pytest backend/tests -v --tb=short
```

### Couverture des tests unitaires et d'intégration :
- `test_security.py` :
  - Hachage Argon2id et vérification à temps constant.
  - Migration transparente des anciens hachages PBKDF2 vers Argon2id.
  - Rejet des mots de passe ne respectant pas la politique de complexité (12+ car, maj, min, chif, spec).
  - Génération de JWT avec signature HMAC-SHA256 et claims `sub`, `exp`, `iat`, `jti`, `iss`, `aud`.
  - Rejet des jetons altérés, expirés ou avec signature corrompue.
  - Révocation persistante multi-workers des jetons.
- `test_api.py` :
  - Connexion avec identifiants valides et génération du jeton.
  - Rejet 401 pour identifiants invalides ou comptes désactivés.
  - Déconnexion et vérification de non-réutilisation du jeton révoqué.
  - Matrice des permissions RBAC (Administrator, Analyst, Observer).
  - Création d'utilisateurs et attribution de rôles.
  - Endpoints de santé (`/health`, `/health/live`, `/health/ready`).
  - Journalisation transactionnelle des audits de sécurité avec masquage des secrets.

---

## 2. Tests Frontend (React / TypeScript)

```bash
# Vérification du typage TypeScript et règles ESLint
npm run lint

# Compilation de production Vite
npm run build
```

---

## 3. Tests Moteur Réseau (Rust)

```bash
# Vérification du formatage
cargo fmt --manifest-path engine/Cargo.toml -- --check

# Analyse statique Clippy
cargo clippy --manifest-path engine/Cargo.toml -- -D warnings

# Tests unitaires Rust
cargo test --manifest-path engine/Cargo.toml

# Compilation binaire release
cargo build --manifest-path engine/Cargo.toml --release
```

---

## 4. Tests d'Installation et Scripts Shell

```bash
# Validation de la syntaxe des scripts bash
bash -n deployment/debian/check-prerequisites.sh
bash -n deployment/debian/install.sh
bash -n deployment/debian/uninstall.sh

# Exécution du contrôle de prérequis en mode non-destructif
bash deployment/debian/check-prerequisites.sh
```
