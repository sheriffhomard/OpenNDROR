# Guide de Développement Local — OpenNDR V0.1

Ce guide permet d'initialiser rapidement un environnement de développement local sur OpenNDR.

---

## 1. Environnement Python Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Appliquer les migrations de base de données
alembic upgrade head

# Initialiser un premier compte administrateur local
openndr-admin create-first-admin --email admin@openndr.local --full-name "Admin Dev" --password "OpenNDR-Admin-2026!"

# Démarrer le serveur de développement Uvicorn
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

---

## 2. Environnement Frontend React

```bash
# À la racine du projet
npm install
npm run dev -- --port 3000
```
Le serveur Vite redirige automatiquement toutes les requêtes `/api/*` vers le backend local sur `http://127.0.0.1:8001/`.

---

## 3. Moteur Réseau Rust

```bash
cd engine
cargo build
cargo test
```
