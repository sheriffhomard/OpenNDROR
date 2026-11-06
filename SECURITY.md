# Politique de Sécurité — OpenNDR

## 1. Principes de Conception Défensive

OpenNDR est une solution de cyberdéfense dédiée à la surveillance passive et à la réponse aux incidents.
La sécurité de l'application est régie par les principes suivants :

- **Isolation des privilèges** : Le moteur de capture fonctionne sous un utilisateur dédié non-root (`openndr-capture`) doté uniquement des capacités Linux minimales (`CAP_NET_RAW`, `CAP_NET_ADMIN`).
- **Aucun traitement applicatif avec les privilèges root** : Le backend FastAPI et l'interface Web s'exécutent sous l'utilisateur de service sans privilège `openndr`.
- **Mode passif strict** : L'interface de capture réseau ne doit recevoir aucune adresse IP, ni route par défaut, et ne doit jamais émettre de paquets sur le lien surveillé.
- **Défense en profondeur contre les paquets malveillants** : Le moteur d'analyse réseau (écrit en Rust) ne doit jamais paniquer sur des trames réseau tronquées, corrompues ou forgées.
- **Stockage PCAP sécurisé** : Les fichiers pcap sont stockés dans `/var/lib/openndr/captures` avec des permissions `0700` et ne sont accessibles que par les utilisateurs autorisés.

## 2. Signalement d'une Vulnérabilité

Si vous identifiez une vulnérabilité de sécurité dans OpenNDR :
- **Ne publiez pas de problème public** sur GitHub ou d'autres forums publics.
- Envoyez un rapport détaillé et chiffré par e-mail à : `security@openndr.local`.
- Veuillez inclure une description technique de la vulnérabilité, un scénario de reproduction (PoC), et vos coordonnées pour l'attribution.

L'équipe OpenNDR s'engage à accuser réception dans les 48 heures ouvrées et à proposer un correctif de sécurité dans un délai raisonnable.
