# Guide de Contribution — OpenNDR

Merci de votre intérêt pour OpenNDR ! Nous accueillons avec plaisir les contributions de la communauté.

## 1. Processus de Développement
- **Développement progressif par version** : Chaque fonctionnalité doit s'inscrire dans la roadmap définie (V0.1 -> V1.0). Ne développez pas de fonctionnalités anticipées sans accord préalable.
- **Branches Git** : Travaillez sur des branches nommées explicitement (`feat/v0.1-auth`, `fix/v0.1-interface-check`, `docs/v0.1-architecture`).
- **Commits conventionnels** : Adoptez les Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).

## 2. Standards de Qualité par Langage

### Python (Backend)
- Typage strict avec annotations de type complètes.
- Modèles de données validés via Pydantic v2.
- Respect des règles de formatage et linting via `ruff`.
- Tests unitaires et d'intégration systématiques sous `pytest`.

### Rust (Moteur réseau)
- Strictement **aucun `panic!`** lors de la manipulation de paquets ou de flux non fiables.
- Pas de bloc `unsafe` sans justification technique impérative et documentée.
- Validation avec `cargo clippy -- -D warnings` et `cargo test`.

### TypeScript / React (Frontend)
- TypeScript strict activé (`noImplicitAny`, etc.).
- Composants sans pillules superflues, typographie nette, contrastes WCAG AA.
- Aucun composant ou bouton sans logique d'action fonctionnelle.

## 3. Revue de Code et Tests
Chaque Pull Request doit inclure :
1. Une description claire des modifications et des tickets associés.
2. Des tests automatisés couvrant les nouvelles branches logiques.
3. La mise à jour de la documentation associée.
