# Guide de Dépannage (Troubleshooting) — OpenNDR V0.1

Ce guide résout les anomalies fréquentes rencontrées lors de l'exploitation ou de l'installation d'OpenNDR.

---

## 1. Refus de démarrage : "Démarrage refusé en mode PRODUCTION : SECRET_KEY est manquant ou faible"
- **Cause** : `OPENNDR_ENV=production` est défini et `SECRET_KEY` est manquant, inférieur à 32 caractères, ou utilise une valeur d'exemple proscrite.
- **Résolution** :
  Générez une clé sécurisée :
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
  Inscrivez-la dans `/etc/openndr/backend.env` sous `SECRET_KEY=...` et redémarrez le backend :
  ```bash
  sudo systemctl restart openndr-backend
  ```

---

## 2. Refus de création d'administrateur : "Un administrateur existe déjà"
- **Cause** : La commande `openndr-admin create-first-admin` est à usage unique et refuse de s'exécuter si un compte administrateur est déjà enregistré.
- **Résolution** : Connectez-vous avec le compte administrateur existant ou utilisez un compte administrateur pour créer un autre utilisateur depuis l'API ou l'interface Web.

---

## 3. Erreur 401 Unauthorized persistante après déconnexion
- **Cause** : Le jeton JWT a été révoqué dans la table `revoked_tokens` lors de la déconnexion.
- **Résolution** : Reconnectez-vous via `POST /api/v1/auth/login` pour obtenir un nouveau jeton d'accès valide.

---

## 4. Alerte de violation d'interface passive (Stealth Violation)
- **Cause** : Une adresse IP a été assignée à l'interface de capture passive (`eth1`) ou l'interface n'est pas en mode promiscuous.
- **Résolution** :
  Révoquez l'adresse IP et activez le mode promiscuous sans ARP :
  ```bash
  sudo ip addr flush dev eth1
  sudo ip link set eth1 promisc on arp off up
  ```

---

## 5. Moteur Rust : "Engine: standby (V0.1)"
- **Normalité** : En version V0.1, le moteur réseau fonctionne en mode attente (skeleton IPC) et ne capture pas encore de paquets réseau réels. La capture `AF_PACKET` sera activée lors de la V0.2.
