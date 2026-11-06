# ADR-001 : Choix de Rust pour le Moteur Réseau

- **Statut** : Accepté
- **Date** : 2026-11-06
- **Décideurs** : Équipe d'Ingénierie & Sécurité OpenNDR

## Contexte
Le moteur de capture et d'analyse réseau d'une sonde NDR traite des millions de paquets par seconde provenant de sources non fiables. Historiquement, les moteurs en C/C++ (Snort, Tcpdump, Wireshark) ont souffert de nombreuses vulnérabilités d'exécution de code à distance (RCE) dues à des dépassements de tampon (buffer overflows) ou des erreurs de gestion mémoire.

## Décision
Nous choisissons Rust pour implémenter l'ensemble des composants d'analyse réseau (capture, décodage, reconstruction de flux, DPI, détection).

## Conséquences
- **Positives** :
  - Absence de vulnérabilités mémoire (Use-After-Free, Double-Free, Buffer Overflow) grâce au modèle d'ownership et de borrow checker.
  - Performances équivalentes au C/C++ sans latence de Garbage Collector.
  - Typage statique fort pour les structures de trames réseau et les machines à états de flux.
- **Négatives** :
  - Courbe d'apprentissage plus exigeante pour les nouveaux contributeurs.
  - Temps de compilation plus longs en mode release.
