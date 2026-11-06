#!/usr/bin/env bash
# ==============================================================================
# OpenNDR V0.1 — Script de Désinstallation Contrôlée (Debian 13)
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "[✗] Ce script doit être exécuté avec les privilèges root (sudo)."
    exit 1
fi

echo "=========================================================="
echo "  Désinstallation d'OpenNDR"
echo "=========================================================="

# 1. Arrêt des services systemd
echo "[*] Arrêt et désactivation des services systemd..."
for s in openndr-web openndr-backend openndr-engine; do
    if systemctl is-active --quiet "$s" 2>/dev/null; then
        systemctl stop "$s" || true
    fi
    if systemctl is-enabled --quiet "$s" 2>/dev/null; then
        systemctl disable "$s" || true
    fi
    rm -f "/etc/systemd/system/${s}.service"
done
systemctl daemon-reload 2>/dev/null || true

# 2. Protection des données utilisateur et PCAP
echo ""
echo "[i] Par mesure de sécurité et conformément aux exigences du cahier des charges,"
echo "    les captures PCAP (/var/lib/openndr/captures) et la base PostgreSQL"
echo "    NE SONT PAS SUPPRIMÉES automatiquement."
echo ""
read -r -p "Souhaitez-vous également supprimer les journaux et fichiers temporaires ? [o/N] " response || response="n"
if [[ "$response" =~ ^([oOyY])$ ]]; then
    rm -rf /var/log/openndr /run/openndr
    echo "[✓] Journaux et sockets temporaires supprimés."
fi

echo "Désinstallation terminée. Les données de capture restent archivées dans /var/lib/openndr/captures."
