#!/usr/bin/env bash
# ==============================================================================
# OpenNDR V0.1 — Script d'Installation Natif pour Debian 13
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "[✗] Ce script doit être exécuté avec les privilèges root (sudo)."
    exit 1
fi

OPENNDR_DIR="/opt/openndr"
OPENNDR_CONF_DIR="/etc/openndr"
OPENNDR_VAR_DIR="/var/lib/openndr"
OPENNDR_LOG_DIR="/var/log/openndr"
OPENNDR_RUN_DIR="/run/openndr"

echo "=== Début de l'installation d'OpenNDR V0.1 sur Debian ==="

# 1. Création des utilisateurs et groupes dédiés
if ! getent group openndr >/dev/null; then
    groupadd --system openndr
    echo "[✓] Groupe système 'openndr' créé"
fi

if ! id -u openndr >/dev/null 2>&1; then
    useradd --system --gid openndr --home-dir /var/lib/openndr --shell /usr/sbin/nologin --comment "OpenNDR Daemon User" openndr
    echo "[✓] Utilisateur système 'openndr' créé"
fi

if ! id -u openndr-capture >/dev/null 2>&1; then
    useradd --system --gid openndr --home-dir /var/lib/openndr --shell /usr/sbin/nologin --comment "OpenNDR Capture Engine" openndr-capture
    echo "[✓] Utilisateur de capture 'openndr-capture' créé"
fi

# 2. Création de l'arborescence
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
chmod 750 "$OPENNDR_LOG_DIR"

# 3. Copie des configurations par défaut
if [ ! -f "$OPENNDR_CONF_DIR/openndr.conf" ]; then
    cp deployment/configuration/openndr.conf.example "$OPENNDR_CONF_DIR/openndr.conf"
    echo "[✓] Fichier de configuration /etc/openndr/openndr.conf initialisé"
fi

# 4. Installation des services systemd
if [ -d /etc/systemd/system ]; then
    cp deployment/systemd/openndr-backend.service /etc/systemd/system/
    cp deployment/systemd/openndr-engine.service /etc/systemd/system/
    cp deployment/systemd/openndr-web.service /etc/systemd/system/
    command -v systemctl >/dev/null 2>&1 && systemctl daemon-reload || true
    echo "[✓] Unités systemd installées et rechargées"
fi

echo "=== Installation terminée avec succès pour OpenNDR V0.1 ==="
