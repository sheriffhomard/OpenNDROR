# Exigences Techniques & Sécurité — OpenNDR V0.1

## 1. Exigences Système & OS
- **OS Cible** : Debian GNU/Linux 13 (Trixie) 64-bit.
- **Gestionnaire d'init** : systemd natif pour tous les démons.
- **Utilisateurs de service dédiés** :
  - `openndr-capture` : UID système avec `CAP_NET_RAW`, `CAP_NET_ADMIN`. Aucun shell interactif (`/usr/sbin/nologin`).
  - `openndr` : UID système exécutant le backend FastAPI et les tâches applicatives.
- **Permissions du système de fichiers** :
  - Configuration : `/etc/openndr` (propriétaire `root:openndr`, `0750`).
  - Données et captures : `/var/lib/openndr/captures` (propriétaire `openndr-capture:openndr`, `0750`).
  - Logs : `/var/log/openndr` (propriétaire `openndr:openndr`, `0755`).

## 2. Exigences Réseau & Séparation des Interfaces
1. **Interface d'administration (`eth0` ou configurée)** :
   - Adresse IP fixe ou DHCP dédiée.
   - Ports d'écoute : 443 (Reverse proxy HTTPS) et 8000 (API interne).
2. **Interface de capture passive (`eth1` ou configurée)** :
   - Raccordée à un port SPAN, TAP ou miroir réseau.
   - **Interdiction formelle d'assigner une adresse IPv4 ou IPv6**.
   - Activation du flag `PROMISC` au démarrage du moteur de capture.
   - Filtrage kernel par sysctl : `net.ipv4.conf.eth1.arp_ignore=8`, `net.ipv6.conf.eth1.disable_ipv6=1`.

## 3. Exigences Cryptographiques & d'Authentification
- Mots de passe utilisateurs : hachés avec Argon2id (paramètres de mémoire $m=65536$, itérations $t=3$, parallélisme $p=4$) ou PBKDF2-HMAC-SHA256 comme fallback standard.
- Politique de mot de passe : minimum 12 caractères, mélange de majuscules, minuscules, chiffres et caractères spéciaux.
- Jetons d'authentification : JWT signés HMAC-SHA256 avec clé secrète de minimum 256 bits, durée de vie maximale de 60 minutes avec renouvellement par jeton de rafraîchissement révocable.
