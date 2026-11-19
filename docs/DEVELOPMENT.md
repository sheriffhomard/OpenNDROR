# Guide de Développement Local — OpenNDR V0.2

Ce guide permet d'initialiser un environnement de développement local sur OpenNDR V0.2 (FastAPI + PostgreSQL/SQLite dev + Moteur Rust + Console Vite).

---

## 1. Variables d'Environnement Locales

Avant de démarrer le backend FastAPI, définissez explicitement `SECRET_KEY` (au moins 32 caractères) et `DATABASE_URL` :

```bash
export OPENNDR_ENV=development
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
export DATABASE_URL="sqlite:///./openndr_dev.db"
# Ou avec PostgreSQL local :
# export DATABASE_URL="postgresql+psycopg2://openndr:<MOT_DE_PASSE>@127.0.0.1:5432/openndr_db"
```

---

## 2. Environnement Python Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Appliquer obligatoirement les migrations Alembic (aucun create_all automatique)
alembic upgrade head

# Initialiser un premier compte administrateur local (saisie interactive du mot de passe)
openndr-admin create-first-admin --email admin@openndr.local --full-name "Admin Dev"

# Démarrer le serveur de développement Uvicorn
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

---

## 3. Environnement Frontend React

```bash
# À la racine du projet : cibler explicitement le backend FastAPI via VITE_API_PROXY_TARGET
npm install
VITE_API_PROXY_TARGET="http://127.0.0.1:8001" npm run dev
```

Sans `VITE_API_PROXY_TARGET`, le serveur Vite sert uniquement les fichiers statiques sans simuler ni détourner les routes `/api/*`.

---

## 4. Moteur Réseau Rust

```bash
cd engine
cargo build
cargo test
```
