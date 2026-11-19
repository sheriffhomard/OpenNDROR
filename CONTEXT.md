# Contexte Produit & Architecture — OpenNDR (`OpenNDROR`)

**Version active :** V0.2 (`0.2.0`)  
**Dépôt :** https://github.com/sheriffhomard/OpenNDROR  
**Cible système :** Debian 13 (Trixie) `x86_64`

---

## 1. Mission & Identité du Projet

**OpenNDR** est une plateforme open source souveraine de **Network Detection and Response (NDR)** déployée sur site, sans dépendance cloud ni sonde tierce propriétaire (ni Suricata, ni Zeek, ni Arkime).

### Principes directeurs non négociables
1. **Honnêteté technique stricte** : aucune métrique simulée, aucun état système factice, aucune donnée fictive ou valeur de repli trompeuse dans l'interface React. Si le serveur est inaccessible, si l'interface passive possède une adresse IP, ou si aucune capture n'a eu lieu, la console affiche l'état exact (`Serveur indisponible`, `Non conforme`, `Aucune donnée de capture disponible`, `Non disponible`).
2. **Séparation stricte des plans réseau** : interface d'administration dédiée à l'accès HTTPS/API isolée de l'interface de capture passive sans IP en mode promiscuous.
3. **Sécurité fail-closed** : hachage Argon2id obligatoire, JWT HS256 avec claims complets (`sub`, `iss`, `aud`, `exp`, `iat`, `jti`), révocation persistante en base (`revoked_tokens`), RBAC serveur (3 rôles, 8 permissions) et journal d'audit append-only (`audit_logs`).
4. **Interface d'administration sobre et unifiée** : navigation unique par barre latérale persistante (`Sidebar`) et tiroir mobile, barre supérieure minimaliste (`TopBar`), thèmes **Clair** et **Sombre** classiques, composants UI standardisés, onboarding légal explicite et installation PWA intégrée dans les préférences.

---

## 2. Architecture Logicielle en Trois Niveaux

```text
[ Navigateur Desktop / Mobile / PWA Standalone ]
                     │ HTTPS (Rest API /api/v1/*)
                     ▼
[ Serveur Web Nginx (prod: /opt/openndr/dist) / Vite Dev (port 3000 + VITE_API_PROXY_TARGET) ]
  ├── Console React 19 + TypeScript + Tailwind CSS v4 (Clair & Sombre)
  ├── Navigation unifiée (Sidebar + TopBar) filtrée selon RBAC
  ├── Service Worker PWA (registerType: 'autoUpdate', offline shell)
  └── Proxy REST vers FastAPI /api/v1/* (Auth, RBAC, Capture, Interfaces, Audit, Updates)
                     │
       ┌─────────────┴──────────────┐
       │                            │
       ▼                            ▼
[ Backend FastAPI + PostgreSQL ]  [ Moteur Rust `openndr-engine` V0.2 ]
  - SQLAlchemy 2.0 + Alembic        - AF_PACKET / PACKET_MMAP (TPACKET_V2)
  - Argon2id exclusif & JWT         - Décodeur L2–L4 (Eth/VLAN/ARP/IP/ICMP/TCP/UDP)
  - CLI `openndr-admin`             - Lecteur/Écrivain PCAP rotatif + IPC UNIX
```

---

## 3. Modules Frontend Clés (`src/`)

| Module | Rôle |
|---|---|
| `App.tsx` | Orchestrateur central : session JWT, polling `/api/v1/health`, invalidation des données obsolètes hors ligne, garde RBAC, thème, mentions légales. |
| `config/navigation.ts` | Configuration unique des 8 sections réparties en 4 groupes (*Principal*, *Surveillance*, *Sécurité*, *Administration*) avec permissions associées. |
| `components/Sidebar.tsx` | Barre latérale persistante et rétractable sur bureau + tiroir responsive mobile/tablette. |
| `components/TopBar.tsx` | Barre supérieure épurée : bouton menu mobile, fil d'Ariane, état réel de connexion API, thème Clair/Sombre et menu utilisateur. |
| `components/ui/` | Composants standardisés (`PageHeader`, `PageContainer`, `SectionCard`, `StatusBadge`, `StateBlocks`, `DataTable`, `ConfirmDialog`). |
| `components/DashboardView.tsx` | Vue d'ensemble : statuts réels des 7 composants, indicateurs réseau sans valeurs inventées et guide de première utilisation calculé en temps réel. |
| `components/SystemSettingsView.tsx` | Paramètres système structurés en 5 catégories (*Système*, *Mises à jour*, *Affichage*, *Préférences utilisateur*, *Informations légales*). |
| `components/LegalOnboardingModal.tsx` | Modale d'accueil précisant que l'auteur n'est pas responsable des données fournies, importées ou traitées dans l'application. |
| `components/HelpTooltip.tsx` | Infobulle `?` accessible au survol, au focus clavier et au clic sur les champs de formulaire. |
| `components/PWAInstallButton.tsx` | Bouton *Installer l'application* disponible dans *Préférences utilisateur*. |
| `hooks/useTheme.ts` & `hooks/usePWAInstall.ts` | Gestion réactive du thème (`light`/`dark`) et de l'événement `beforeinstallprompt`. |

---

## 4. Cycle de Mise à Jour & PWA

- **Côté backend FastAPI (`backend/app/api/v1/system.py` + `system_settings`)** :
  - `GET /api/v1/system/updates` : expose l'état persisté dans PostgreSQL (`current_version`, `release_date` issue de `OPENNDR_RELEASE_DATE` ou `null`, `last_checked_at`, `last_updated_at`, `next_scheduled_check_at`, `auto_update_enabled`, `check_interval_minutes`, `engine_integrity_ok` réel et l'historique d'exécution).
  - `POST /api/v1/system/updates/check` *(permission `system:manage`)* : vérifie l'intégrité du moteur et journalise dans PostgreSQL.
  - `POST /api/v1/system/updates/force` *(permission `system:manage`)* : force la vérification et synchronise l'état dans PostgreSQL + `audit_logs`.
  - `PUT /api/v1/system/updates/config` *(permission `system:manage`)* : persiste la périodicité dans PostgreSQL (`system_settings`).
- **Côté client (`vite.config.ts`)** :
  - `vite-plugin-pwa` configuré en `registerType: 'autoUpdate'` avec exclusion explicite `/^\/api\//` du fallback hors-ligne afin de ne jamais masquer les appels REST d'authentification ou de santé.

---

## 5. Vérifications & Garde-fous Qualité

- `npm test` exécute `scripts/verify-frontend.mjs` (scanner anti-prototypage sur `src/`, `backend/`, `deployment/`, `package.json` et `vite.config.ts`), `scripts/test-anti-mock.mjs` (test négatif de régression du scanner), `scripts/verify-ui.mts` (vérification de rendu SSR pour les états RBAC, les 5 états du moteur Rust, valeurs `null` et serveur indisponible) suivi de `tsc --noEmit`.
- `npm run build` compile le bundle production et génère le manifeste PWA + Service Worker Workbox dans `dist/`.
- `alembic upgrade head`, `cargo test --manifest-path engine/Cargo.toml` et `pytest backend/tests -v` valident les migrations de schéma, les couches natives Rust et FastAPI/PostgreSQL.
