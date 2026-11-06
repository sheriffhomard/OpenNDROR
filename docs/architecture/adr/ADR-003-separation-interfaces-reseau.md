# ADR-003 : Séparation Stricte des Interfaces Réseau (Admin vs Capture)

- **Statut** : Accepté
- **Date** : 2026-11-06
- **Décideurs** : Architecte Cybersécurité & Administrateur Système

## Contexte
Une sonde NDR connectée à un port miroir (SPAN/TAP) observe le trafic d'un sous-réseau sensible. Si la sonde émet des trames ou possède une adresse IP sur cette interface, elle devient visible pour un attaquant (détection de sonde) et peut devenir un vecteur de compromission ou de rebond.

## Décision
1. La sonde OpenNDR exige obligatoirement deux interfaces réseau distinctes :
   - `ADMIN_INTERFACE` (ex: `eth0`) : dédiée à la gestion, avec IP, accessible uniquement par le VLAN d'administration SOC.
   - `CAPTURE_INTERFACE` (ex: `eth1`) : dédiée à la capture passive, connectée au SPAN.
2. L'interface de capture doit avoir :
   - Zéro adresse IPv4 (`0.0.0.0`) et IPv6 désactivé au niveau du kernel.
   - Le mode Promiscuous activé sans émission possible.
   - Le backend refuse de démarrer une capture si l'interface sélectionnée possède une adresse IP routable ou sert d'interface d'administration.

## Conséquences
- **Sécurité maximale** : Sonde totalement invisible (stealth mode) sur le réseau supervisé.
- **Protection contre les erreurs humaines** : L'administrateur ne peut pas capturer par mégarde sur son interface de management.
