# Politique et Modèle de Sécurité — OpenNDR V0.2

## 1. Modèle Cryptographique & Hachage des Mots de Passe
- **Algorithme exclusif** : **Argon2id** (`time_cost=3`, `memory_cost=64MB`, `parallelism=4`, sel 16 octets, condensat 32 octets).
- **Aucun fallback** : les condensats hérités PBKDF2 ou autres algorithmes sont strictement rejetés (`$argon2id$` requis). Si `argon2-cffi` est absent, le backend refuse toute opération de hachage/vérification et bloque le démarrage en production.
- **Politique de complexité** :
  - 12 caractères minimum.
  - Au moins 1 lettre majuscule `[A-Z]`.
  - Au moins 1 lettre minuscule `[a-z]`.
  - Au moins 1 chiffre `[0-9]`.
  - Au moins 1 caractère spécial.

---

## 2. Jetons de Session JWT & Révocation Fail-Closed
- **Algorithme** : HMAC-SHA256 (`HS256`).
- **Signature & Clé** : `SECRET_KEY` est obligatoire dans tous les environnements (`>= 32` caractères, aucun secret par défaut ni placeholder autorisé).
- **Claims obligatoires validés** :
  - `sub` : Identifiant UUID de l'utilisateur.
  - `iss` : `"openndr"`.
  - `aud` : `"openndr-api"`.
  - `iat` : Date d'émission (rejet des dates futures de plus de 60s).
  - `exp` : Date d'expiration (par défaut 60 minutes).
  - `jti` : Identifiant cryptographique unique du jeton (16 octets aléatoires).
- **Révocation persistante et fail-closed** :
  - Lors de `POST /api/v1/auth/logout`, le `jti` est enregistré dans PostgreSQL (`revoked_tokens`).
  - `decode_token`, `is_token_revoked` et `revoke_token` exigent impérativement une session de base de données active en tout environnement et lèvent `DatabaseSecurityError` (HTTP `503`) en cas d'indisponibilité — aucun jeu `REVOKED_TOKENS` en mémoire n'existe.
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

## 4. Gouvernance du Schéma & Journalisation d'Audit Immuable
- **Schéma PostgreSQL** : géré exclusivement via Alembic (`alembic upgrade head`) ; `Base.metadata.create_all()` est totalement supprimé du démarrage applicatif.
- **Audit** : chaque tentative de connexion, déconnexion, création/modification d'utilisateur, pilotage capture ou mise à jour système est enregistrée dans `audit_logs` avec sanitisation (`[REDACTED]`) et rollback transactionnel si la journalisation échoue.
