# Guide d'Installation sur Debian 13 (Trixie) — OpenNDR V0.2

Ce guide détaille l'installation d'OpenNDR V0.2 sur un système Debian 13 vierge.

---

## 1. Prérequis Système
- **Distribution** : Debian 13 (Trixie) 64 bits (`x86_64`).
- **Processeur** : 2 cœurs minimum (4 à 8 recommandés).
- **Mémoire** : 4 Go minimum (8 Go recommandés).
- **Disque** : 20 Go minimum pour le système et les journaux (`ext4` ou `xfs`).
- **Interfaces réseau** : 2 interfaces réseau distinctes :
  - `eth0` : Interface d'administration (connectée au réseau de gestion, avec IP statique).
  - `eth1` : Interface de capture passive (raccordée à un port miroir SPAN ou TAP réseau, sans IP ni routes).

---

## 2. Procédure Automatique via `install.sh`

```bash
# 1. Cloner le dépôt officiel
git clone https://github.com/sheriffhomard/OpenNDROR.git /opt/openndr
cd /opt/openndr

# 2. Exécuter le script d'installation en tant que root
sudo bash deployment/debian/install.sh
```

Le script effectue automatiquement :
1. La vérification des prérequis CPU, RAM et interfaces.
2. L'installation des paquets nécessaires (`postgresql`, `python3`, `nginx`, `nodejs`, `npm`, `cargo`/`rustc`, `libpcap-dev`, `libcap2-bin`).
3. La création des utilisateurs système restreints `openndr` et `openndr-capture`.
4. La sécurisation des répertoires (`/etc/openndr` en `0750`, `/etc/openndr/backend.env` et `/etc/openndr/openndr.conf` en `0640`, `/var/lib/openndr/captures` en `0700`).
5. La génération d'une clé secrète aléatoire et d'un mot de passe PostgreSQL aléatoire dans `/etc/openndr/backend.env`.
6. L'installation du virtualenv Python backend et l'application obligatoire des migrations Alembic (`alembic upgrade head`).
7. La compilation des assets statiques React/PWA via Vite dans `/opt/openndr/dist` (servis directement par Nginx).
8. La compilation de `openndr-engine` en release et l'application des capabilities `cap_net_raw,cap_net_admin=eip` (échec bloquant si impossible).
9. L'installation des unités systemd `openndr-backend.service` et `openndr-engine.service` ainsi que la configuration Nginx.

---

## 3. Initialisation du Premier Administrateur

OpenNDR ne comporte **aucun compte ou mot de passe par défaut**. Initialisez le premier administrateur avant le démarrage :

```bash
openndr-admin create-first-admin \
  --email "admin@votre-domaine.local" \
  --full-name "Administrateur Principal SOC"
```

---

## 4. Démarrage et Contrôle des Services

```bash
sudo systemctl start openndr-backend
sudo systemctl start openndr-engine

sudo systemctl status openndr-backend
sudo systemctl status openndr-engine
sudo systemctl status nginx

curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/health/ready
```

L'accès à l'interface Web s'effectue via Nginx sur `http://<IP_ADMIN>/`.
