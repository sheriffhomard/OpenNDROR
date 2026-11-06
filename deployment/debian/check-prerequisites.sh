#!/usr/bin/env bash
# ==============================================================================
# OpenNDR V0.1 — Script de Vérification des Prérequis (Debian 13 Trixie)
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo "  OpenNDR — Vérification des Prérequis Système"
echo "=========================================================="

# 1. Vérification de l'OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "[✓] Système détecté : $NAME $VERSION ($ID)"
    if [ "$ID" != "debian" ] && [ "$ID" != "ubuntu" ]; then
        echo "[!] Attention : OpenNDR est optimisé pour Debian 13 (Trixie). Poursuite possible sous réserve de compatibilité."
    fi
else
    echo "[✗] Fichier /etc/os-release introuvable."
    exit 1
fi

# 2. Vérification des ressources CPU & RAM
CPU_CORES=$(nproc)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))

echo "[i] Cœurs CPU disponibles : $CPU_CORES (Minimum requis : 4, recommandé : 8)"
echo "[i] Mémoire RAM totale    : ${TOTAL_RAM_GB} Go (Minimum requis : 8 Go, recommandé : 32 Go)"

if [ "$CPU_CORES" -lt 2 ]; then
    echo "[✗] Nombre de cœurs insuffisant pour garantir les performances de capture."
    exit 1
fi

# 3. Vérification des interfaces réseau
INTERFACES=$(ip -o link show | awk -F': ' '{print $2}' | grep -v 'lo')
INT_COUNT=$(echo "$INTERFACES" | wc -l)

echo "[i] Interfaces réseau détectées ($INT_COUNT) :"
for iface in $INTERFACES; do
    IP_ASSIGNED=$(ip -4 addr show "$iface" | grep inet | awk '{print $2}' || true)
    if [ -n "$IP_ASSIGNED" ]; then
        echo "    - $iface (IP: $IP_ASSIGNED) -> Eligible ADMIN"
    else
        echo "    - $iface (Aucune IP) -> Eligible CAPTURE PASSIVE"
    fi
done

if [ "$INT_COUNT" -lt 2 ]; then
    echo "[!] AVERTISSEMENT : Moins de 2 interfaces réseau détectées."
    echo "    OpenNDR exige en production 1 interface d'administration et 1 interface passive dédiée."
fi

# 4. Vérification des dépendances logicielles
command -v python3 >/dev/null 2>&1 && echo "[✓] Python3 présent ($(python3 --version))" || echo "[!] Python3 absent"
command -v systemctl >/dev/null 2>&1 && echo "[✓] systemd présent" || echo "[!] systemctl non disponible dans cet environnement"

echo "=========================================================="
echo "  Vérification terminée avec succès."
echo "=========================================================="
exit 0
