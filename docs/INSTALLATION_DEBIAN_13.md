# Guide d'Installation sur Debian 13 (Trixie) — OpenNDR V0.1

Ce guide détaille l'installation pas-à-pas d'OpenNDR V0.1 sur un système Debian 13 vierge.

---

## 1. Prérequis Système
- **Distribution** : Debian 13 (Trixie) 64 bits (x86_64).
- **Processeur** : 2 cœurs minimum (4 à 8 recommandés).
- **Mémoire** : 4 Go minimum (8 Go recommandés).
- **Disque** : 20 Go pour le système et les journaux (ext4 ou xfs).
- **Interfaces réseau** : 2 interfaces réseau distinctes :
  - `eth0` : Interface d'administration (connectée au réseau de gestion, avec IP statique).
  - `eth1` : Interface de capture passive (raccordée à un port miroir SPAN ou TAP réseau, sans IP).

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
2. L'installation des paquets nécessaires (PostgreSQL, Python 3.11, Nginx, Rust/Cargo, outils de compilation).
3. La création des utilisateurs système restreints `openndr` et `openndr-capture`.
4. La création et la sécurisation des répertoires de travail (`/etc/openndr`, `/var/lib/openndr`, `/var/log/openndr`).
5. La génération d'une clé secrète aléatoire de 64 caractères dans `/etc/openndr/backend.env`.
6. La création de l'environnement virtuel Python (`.venv`) et l'installation des dépendances backend.
7. L'application des migrations de base de données via Alembic (`alembic upgrade head`).
8. La compilation de l'exécutable Rust `openndr-engine`.
9. L'installation de la configuration Nginx et des unités systemd.

---

## 3. Initialisation du Premier Administrateur

Par mesure de sécurité absolue, OpenNDR ne comporte **aucun compte ou mot de passe par défaut**.  
Vous devez obligatoirement initialiser le premier administrateur avant le démarrage :

```bash
openndr-admin create-first-admin \
  --email "admin@votre-domaine.local" \
  --full-name "Administrateur Principal SOC"
```
Vous serez invité à saisir un mot de passe robuste conforme à la politique de sécurité (min. 12 caractères, majuscule, minuscule, chiffre, caractère spécial).

*Remarque : Cette commande est à usage unique. Si un administrateur existe déjà dans PostgreSQL, la commande est immédiatement rejetée.*

---

## 4. Démarrage et Contrôle des Services

```bash
# Démarrer les services
sudo systemctl start openndr-backend
sudo systemctl start openndr-engine

# Vérifier les statuts systemd
sudo systemctl status openndr-backend
sudo systemctl status openndr-engine

# Vérifier la réponse de l'API
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/health/ready
```

L'accès à l'interface Web s'effectue via navigateur sur `http://<IP_ADMIN>/`.
