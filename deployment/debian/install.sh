#!/usr/bin/env bash
# ==============================================================================
# OpenNDR V0.1 — Installateur Complet, Robuste et Idempotent pour Debian 13 (Trixie)
# Dépôt officiel : https://github.com/sheriffhomard/OpenNDROR
# ==============================================================================
set -Eeuo pipefail

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1" >&2; }

# Trap d'erreur fatal : arrêt immédiat avec identification de la ligne défaillante
trap 'log_error "ÉCHEC CRITIQUE à la ligne $LINENO (commande: \"$BASH_COMMAND\", code sortie: $?). Installation interrompue."; exit 1' ERR

# Constantes d'arborescence
OPENNDR_DIR="/opt/openndr"
OPENNDR_CONF_DIR="/etc/openndr"
OPENNDR_VAR_DIR="/var/lib/openndr"
OPENNDR_LOG_DIR="/var/log/openndr"
OPENNDR_RUN_DIR="/run/openndr"

echo "======================================================================"
echo "      Installation Complète de la Plateforme OpenNDR V0.1"
echo "           Système Cible : Debian 13 (Trixie) GNU/Linux"
echo "======================================================================"

# ------------------------------------------------------------------------------
# Étape 1 : Vérification des privilèges root
# ------------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
    log_error "Ce script doit impérativement être exécuté avec les privilèges root (sudo bash install.sh)."
    exit 1
fi

# ------------------------------------------------------------------------------
# Étape 2 : Pré-vérifications système
# ------------------------------------------------------------------------------
log_info "1/10 - Contrôle des prérequis système..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    log_info "Distribution détectée : $NAME $VERSION ($ID)"
    if [ "$ID" != "debian" ] && [ "$ID" != "ubuntu" ]; then
        log_warn "Distribution non-Debian ($ID). Poursuite sous réserve de compatibilité."
    fi
else
    log_error "Fichier /etc/os-release introuvable. Impossible d'identifier le système."
    exit 1
fi

# Contrôle CPU et RAM
CPU_CORES=$(nproc)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))

log_info "Cœurs CPU : $CPU_CORES (Requis min : 2)"
log_info "Mémoire RAM : ${TOTAL_RAM_GB} Go (Requis min : 4 Go, recommandé : 8+ Go)"

if [ "$CPU_CORES" -lt 2 ]; then
    log_error "Nombre de cœurs CPU insuffisant ($CPU_CORES < 2 pour le moteur et l'API)."
    exit 1
fi

if [ "$TOTAL_RAM_GB" -lt 3 ]; then
    log_warn "Mémoire RAM inférieure à 4 Go ($TOTAL_RAM_GB Go). Risque d'OOM avec Argon2id."
fi

# ------------------------------------------------------------------------------
# Étape 3 : Installation des dépendances système Debian
# ------------------------------------------------------------------------------
log_info "2/10 - Installation des paquets système via apt..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    libpq-dev \
    postgresql \
    postgresql-contrib \
    nginx \
    curl \
    git \
    iproute2 \
    ethtool \
    libcap2-bin

# Vérification Rust / Cargo
if ! command -v cargo >/dev/null 2>&1; then
    log_info "Installation de l'environnement Rust / Cargo..."
    apt-get install -y cargo rustc || {
        log_warn "Installation apt échouée pour Rust, tentative d'amorce..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        export PATH="$HOME/.cargo/bin:$PATH"
    }
fi
log_success "Dépendances système opérationnelles."

# ------------------------------------------------------------------------------
# Étape 4 : Création des comptes et groupes système dédiés
# ------------------------------------------------------------------------------
log_info "3/10 - Configuration des utilisateurs et groupes de sécurité..."

if ! getent group openndr >/dev/null; then
    groupadd --system openndr
    log_success "Groupe système 'openndr' créé."
fi

if ! id -u openndr >/dev/null 2>&1; then
    useradd --system --gid openndr --home-dir /var/lib/openndr --shell /usr/sbin/nologin --comment "OpenNDR Daemon User" openndr
    log_success "Utilisateur système 'openndr' créé."
fi

if ! id -u openndr-capture >/dev/null 2>&1; then
    useradd --system --gid openndr --home-dir /var/lib/openndr --shell /usr/sbin/nologin --comment "OpenNDR Capture Engine" openndr-capture
    log_success "Utilisateur restreint 'openndr-capture' créé."
fi

# ------------------------------------------------------------------------------
# Étape 5 : Création et durcissement des répertoires
# ------------------------------------------------------------------------------
log_info "4/10 - Préparation de l'arborescence et des permissions..."

mkdir -p "$OPENNDR_DIR"
mkdir -p "$OPENNDR_CONF_DIR"
mkdir -p "$OPENNDR_VAR_DIR/captures"
mkdir -p "$OPENNDR_VAR_DIR/data"
mkdir -p "$OPENNDR_LOG_DIR"
mkdir -p "$OPENNDR_RUN_DIR"

chown -R root:openndr "$OPENNDR_CONF_DIR"
chmod 750 "$OPENNDR_CONF_DIR"

chown -R openndr-capture:openndr "$OPENNDR_VAR_DIR/captures"
chmod 700 "$OPENNDR_VAR_DIR/captures"

chown -R openndr:openndr "$OPENNDR_LOG_DIR" "$OPENNDR_RUN_DIR" "$OPENNDR_VAR_DIR/data"
chmod 750 "$OPENNDR_LOG_DIR" "$OPENNDR_RUN_DIR"

# ------------------------------------------------------------------------------
# Étape 6 : Déploiement des sources applicatives
# ------------------------------------------------------------------------------
log_info "5/10 - Déploiement des sources applicatives vers $OPENNDR_DIR..."
cp -r backend "$OPENNDR_DIR/"
cp -r engine "$OPENNDR_DIR/"
cp -r deployment "$OPENNDR_DIR/"
cp -r src "$OPENNDR_DIR/"
cp -r public "$OPENNDR_DIR/" 2>/dev/null || true
cp package.json tsconfig.json vite.config.ts index.html "$OPENNDR_DIR/"

# ------------------------------------------------------------------------------
# Étape 7 : PostgreSQL, Génération des Secrets & Fichier d'Environnement
# ------------------------------------------------------------------------------
log_info "6/10 - Configuration sécurisée de PostgreSQL et des variables d'environnement..."

# Démarrer le service PostgreSQL s'il est inactif
if command -v systemctl >/dev/null 2>&1; then
    systemctl start postgresql
fi

if [ ! -f "$OPENNDR_CONF_DIR/backend.env" ]; then
    RANDOM_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
    PG_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(24))")

    # Initialisation de la base PostgreSQL et de l'utilisateur dédié
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='openndr'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER openndr WITH PASSWORD '$PG_PASSWORD';"

    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='openndr_db'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE openndr_db OWNER openndr;"

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE openndr_db TO openndr;"

    cat <<EOF > "$OPENNDR_CONF_DIR/backend.env"
# ==============================================================================
# OpenNDR V0.1 — Variables d'Environnement Backend (/etc/openndr/backend.env)
# ==============================================================================
OPENNDR_ENV=production
OPENNDR_LOG_LEVEL=INFO

API_HOST=127.0.0.1
API_PORT=8000
SECRET_KEY=${RANDOM_SECRET}
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

DATABASE_URL=postgresql+psycopg2://openndr:${PG_PASSWORD}@127.0.0.1:5432/openndr_db
ADMIN_INTERFACE=eth0
CAPTURE_INTERFACE=eth1

ENGINE_SOCKET_PATH=/run/openndr/engine.sock
PCAP_STORAGE_PATH=/var/lib/openndr/captures
MAX_PCAP_STORAGE_GB=500
PCAP_RETENTION_DAYS=30
LOG_RETENTION_DAYS=90
EOF
    chown root:openndr "$OPENNDR_CONF_DIR/backend.env"
    chmod 640 "$OPENNDR_CONF_DIR/backend.env"
    log_success "Fichier /etc/openndr/backend.env généré avec clés cryptographiques fortes."
else
    log_info "Fichier /etc/openndr/backend.env déjà existant, préservation des secrets."
fi

# Copie du gabarit openndr.conf si absent
if [ ! -f "$OPENNDR_CONF_DIR/openndr.conf" ]; then
    cp "$OPENNDR_DIR/deployment/configuration/openndr.conf.template" "$OPENNDR_CONF_DIR/openndr.conf"
    chown root:openndr "$OPENNDR_CONF_DIR/openndr.conf"
    chmod 644 "$OPENNDR_CONF_DIR/openndr.conf"
fi

# ------------------------------------------------------------------------------
# Étape 8 : Virtualenv Python, Dépendances & Migrations Alembic OBLIGATOIRES
# ------------------------------------------------------------------------------
log_info "7/10 - Installation du virtualenv Python et application des migrations Alembic..."
cd "$OPENNDR_DIR/backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e .

# Exécution stricte des migrations Alembic
log_info "Application stricte des migrations Alembic sur PostgreSQL..."
set -a
. "$OPENNDR_CONF_DIR/backend.env"
set +a

# Contrôle du code de retour d'Alembic (aucun create_all de secours autorisé)
.venv/bin/alembic upgrade head
log_success "Migrations Alembic appliquées avec succès. Schéma PostgreSQL à jour."

# ------------------------------------------------------------------------------
# Étape 9 : Compilation du Frontend Vite
# ------------------------------------------------------------------------------
log_info "8/10 - Compilation des assets de production Frontend (Vite)..."
cd "$OPENNDR_DIR"
if command -v npm >/dev/null 2>&1; then
    npm ci --production=false || npm install
    npm run build
    chown -R openndr:openndr "$OPENNDR_DIR/dist"
    log_success "Frontend compilé avec succès dans $OPENNDR_DIR/dist."
else
    log_error "npm introuvable. Impossible de compiler les assets Frontend."
    exit 1
fi

# ------------------------------------------------------------------------------
# Étape 10 : Compilation du Moteur Réseau Rust & Services systemd
# ------------------------------------------------------------------------------
log_info "9/10 - Compilation du binaire Rust 'openndr-engine' et installation systemd..."
cd "$OPENNDR_DIR/engine"
cargo build --release --manifest-path Cargo.toml
ENGINE_BIN="$OPENNDR_DIR/engine/target/release/openndr-engine"

if [ -f "$ENGINE_BIN" ]; then
    log_success "Binaire Rust compilé avec succès ($ENGINE_BIN)."
    setcap cap_net_raw,cap_net_admin=eip "$ENGINE_BIN" || true
else
    log_error "Échec de compilation du binaire Rust openndr-engine."
    exit 1
fi

# Configuration Nginx
if [ -d /etc/nginx/sites-available ]; then
    cp "$OPENNDR_DIR/deployment/debian/nginx-openndr.conf" /etc/nginx/sites-available/openndr.conf
    ln -sf /etc/nginx/sites-available/openndr.conf /etc/nginx/sites-enabled/openndr.conf
    rm -f /etc/nginx/sites-enabled/default || true
    nginx -t
    systemctl reload nginx || systemctl restart nginx
    log_success "Nginx configuré pour servir le frontend et proxyfier l'API."
fi

# Installation des unités systemd
if [ -d /etc/systemd/system ]; then
    cp "$OPENNDR_DIR/deployment/systemd/openndr-backend.service" /etc/systemd/system/
    cp "$OPENNDR_DIR/deployment/systemd/openndr-engine.service" /etc/systemd/system/
    cp "$OPENNDR_DIR/deployment/systemd/openndr-web.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable openndr-backend.service
    systemctl enable openndr-engine.service
    systemctl enable openndr-web.service
    log_success "Unités systemd installées et activées."
fi

# Lien symbolique vers openndr-admin dans /usr/local/bin
ln -sf "$OPENNDR_DIR/backend/.venv/bin/openndr-admin" /usr/local/bin/openndr-admin

# ------------------------------------------------------------------------------
# Résumé final
# ------------------------------------------------------------------------------
echo "======================================================================"
log_success "Installation complète et vérifiée d'OpenNDR V0.1 terminée !"
echo "======================================================================"
echo ""
echo "Prochaines étapes de mise en service :"
echo "1. Initialiser le premier administrateur (obligatoire avant premier démarrage) :"
echo "   openndr-admin create-first-admin --email admin@votre-domaine.local --full-name 'Admin SOC'"
echo ""
echo "2. Démarrer les services OpenNDR :"
echo "   sudo systemctl start openndr-backend"
echo "   sudo systemctl start openndr-engine"
echo ""
echo "3. Vérifier l'état réel des services :"
echo "   sudo systemctl status openndr-backend"
echo "   sudo systemctl status openndr-engine"
echo ""
echo "4. Accéder à l'interface d'exploitation Web sur : http://<IP_SERVEUR>/"
echo "======================================================================"
exit 0
