# Politique et Modèle de Sécurité — OpenNDR V0.1

## 1. Modèle Cryptographique & Hachage des Mots de Passe
- **Algorithme obligatoire en production** : **Argon2id** (`time_cost=3`, `memory_cost=64MB`, `parallelism=4`, sel 16 octets, condensat 32 octets).
- **Interdiction de fallback silencieux** : Si `argon2-cffi` est manquant en environnement de production, l'application refuse immédiatement de démarrer (`RuntimeError`).
- **Migration progressive** : Si un hash existant commence par `pbkdf2:`, la connexion est acceptée si le mot de passe est valide et re-hachée automatiquement en Argon2id.
- **Politique de complexité** :
  - 12 caractères minimum.
  - Au moins 1 lettre majuscule `[A-Z]`.
  - Au moins 1 lettre minuscule `[a-z]`.
  - Au moins 1 chiffre `[0-9]`.
  - Au moins 1 caractère spécial.

---

## 2. Jetons de Session JWT & Révocation
- **Algorithme** : HMAC-SHA256 (`HS256`).
- **Signature & Clé** : La clé `SECRET_KEY` doit faire au moins 32 caractères. Les clés de démonstration (`secret`, `password`, `admin`) provoquent un arrêt fatal au démarrage en production.
- **Claims obligatoires validés** :
  - `sub` : Identifiant UUID de l'utilisateur.
  - `iss` : Doit être égal à `"openndr"`.
  - `aud` : Doit être égal à `"openndr-api"`.
  - `iat` : Date d'émission (rejet des dates futures de plus de 60s).
  - `exp` : Date d'expiration (par défaut 60 minutes).
  - `jti` : Identifiant cryptographique unique du jeton (16 octets aléatoires).
- **Révocation persistante** :
  - Lors de l'appel à `POST /api/v1/auth/logout`, le `jti` est enregistré dans la table PostgreSQL `revoked_tokens`.
  - Tous les workers partagent cette table ; un jeton révoqué est invalidé instantanément pour toutes les requêtes subséquentes.
  - Les jetons révoqués expirés sont purgés automatiquement.

---

## 3. Contrôle d'Accès Basé sur les Rôles (RBAC)
Le contrôle d'accès est exclusivement garanti par le backend FastAPI via la dépendance `require_permission(code)`.

| Rôle | Permissions par défaut |
|---|---|
| **Administrator** | `system:view`, `system:manage`, `interfaces:view`, `interfaces:manage`, `users:view`, `users:manage`, `audit:view`, `storage:manage` |
| **Analyst** | `system:view`, `interfaces:view`, `users:view`, `audit:view` |
| **Observer** | `system:view`, `interfaces:view` |

Un utilisateur ne peut jamais élever ses propres privilèges ou désactiver son propre compte s'il est l'unique administrateur actif.

---

## 4. Journalisation d'Audit Immuable
- Chaque tentative de connexion (succès, échec, compte bloqué), déconnexion, création/modification d'utilisateur ou opération critique est enregistrée dans la table `audit_logs`.
- **Sanitisation absolue** : Tout champ contenant les chaînes `pass`, `token`, `secret`, `key`, `cred` est automatiquement caviardé (`[REDACTED]`).
- **Transactionnalité stricte** : Si l'écriture dans le journal d'audit échoue, l'action sensible est annulée (`db.rollback()`) et interrompue pour éviter toute action clandestine.
