import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  Cpu,
  Shield,
  FileCheck,
  Milestone,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const DocsView: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<'adr' | 'install' | 'specs' | 'roadmap'>('roadmap');

  const roadmapMilestones = [
    {
      version: 'V0.1',
      title: 'Fondations Techniques & Architecture',
      status: 'TERMINÉ',
      completed: true,
      points: [
        'Architecture modulaire à 3 niveaux (Moteur Rust, Backend FastAPI, Web React)',
        'Contrôle RBAC serveur (Administrator, Analyst, Observer)',
        'Séparation étanche des interfaces réseau (eth0 admin vs eth1 capture passive)',
        'Schémas PostgreSQL et migrations Alembic initiales',
        'Unités systemd Debian 13 et scripts install/uninstall',
      ],
    },
    {
      version: 'V0.2',
      title: 'Capture & Décodage des Paquets',
      status: 'PROCHAINE ÉTAPE',
      completed: false,
      points: [
        'Capture passive temps réel AF_PACKET / libpcap et ring buffer mmap',
        'Import de traces réseau PCAP / PCAPNG',
        'Décodage hiérarchique : Ethernet II, VLAN 802.1Q, ARP, IPv4, IPv6, TCP, UDP',
        'Explorateur de paquets initial dans l’interface Web',
      ],
    },
    {
      version: 'V0.3',
      title: 'Flux & Protocoles',
      status: 'PLANIFIÉ',
      completed: false,
      points: [
        'Reconstruction des communications TCP/UDP et gestion des sessions',
        'Analyseurs de protocoles : DNS, DHCP, HTTP, métadonnées TLS (SNI/JA3), SSH',
        'Gestion mémoire bornée pour les sessions réseau actives',
      ],
    },
    {
      version: 'V0.4',
      title: 'Moteur de Détection Autonome',
      status: 'PLANIFIÉ',
      completed: false,
      points: [
        'Moteur de règles de détection par signatures et motifs réseau',
        'Détection comportementale et par seuils (port scans, balayages, tunnels DNS)',
        'Système d’alertes de sécurité avec justification technique explicable',
      ],
    },
    {
      version: 'V0.5',
      title: 'Corrélation & Gestion d’Incidents',
      status: 'PLANIFIÉ',
      completed: false,
      points: [
        'Moteur de corrélation temporelle d’alertes multi-sources',
        'Dossiers d’incidents de sécurité, chronologie et notes d’investigation',
        'Déduplication et réduction du bruit d’alertes',
      ],
    },
    {
      version: 'V1.0',
      title: 'Première Version Stable Production',
      status: 'OBJECTIF FINAL',
      completed: false,
      points: [
        'Plateforme NDR totalement souveraine, sans dépendance tierce obligatoire',
        'Packaging Debian complet, tests de charge 100 Mbit/s+, audits de sécurité',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Documentation Technique & Feuilles de Route
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Consultez les spécifications, décisions d'architecture (ADR) et guides d'exploitation
              directement embarqués dans la plateforme OpenNDR.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setActiveDoc('roadmap')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'roadmap' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Roadmap (V0.1 - V1.0)
            </button>
            <button
              onClick={() => setActiveDoc('adr')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'adr' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Décisions ADR
            </button>
            <button
              onClick={() => setActiveDoc('install')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'install' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Installation Debian 13
            </button>
            <button
              onClick={() => setActiveDoc('specs')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeDoc === 'specs' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Spécifications & API
            </button>
          </div>
        </div>
      </div>

      {/* Doc Content Area */}
      {activeDoc === 'roadmap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Milestone className="w-4 h-4 text-emerald-400" />
              Feuille de Route Officielle du Produit OpenNDR
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Évolution méthodique par version jalonnée, avec critères d'acceptation stricts avant chaque transition.
            </p>
          </div>

          <div className="space-y-4">
            {roadmapMilestones.map((m) => (
              <div
                key={m.version}
                className={`p-4 rounded-xl border transition-colors ${
                  m.completed
                    ? 'bg-slate-950/70 border-emerald-500/40'
                    : 'bg-slate-950/40 border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-100">{m.version}</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs font-semibold text-slate-200">{m.title}</span>
                  </div>

                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                      m.completed
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : m.status === 'PROCHAINE ÉTAPE'
                        ? 'bg-sky-950 text-sky-400 border border-sky-800/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {m.points.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {m.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 mt-0.5 text-slate-600 shrink-0" />
                      )}
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeDoc === 'adr' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-400">ADR-001</span>
              <span className="text-xs text-slate-400 font-mono">Accepté · 2026-11-06</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Choix du langage Rust pour le moteur d’analyse réseau
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Décision :</strong> Implémenter l'ensemble des analyseurs de paquets, la machine à états de flux et le DPI en Rust.
              Élimine par conception les vulnérabilités de corruption mémoire (Buffer Overflows, Use-After-Free) qui affectent traditionnellement les décodeurs C/C++ sur des flux non fiables, tout en maintenant un débit équivalent sans Garbage Collector.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-sky-400">ADR-002</span>
              <span className="text-xs text-slate-400 font-mono">Accepté · 2026-11-06</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Backend d’orchestration en FastAPI & SQLAlchemy
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Décision :</strong> Utiliser FastAPI (Python 3.10+) pour le service de gestion, l'API REST, la gestion des utilisateurs et l'authentification.
              Le backend ne réalise aucune capture de paquets sur ses processus HTTP et dialogue avec le moteur Rust uniquement par socket UNIX local dédié.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-purple-400">ADR-003</span>
              <span className="text-xs text-slate-400 font-mono">Accepté · 2026-11-06</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Séparation stricte entre interface d’administration et de capture
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Décision :</strong> Imposer 2 interfaces réseau matérielles distinctes. L'interface passive connectée au SPAN/TAP ne doit posséder aucune adresse IP (0.0.0.0), aucun routage, et bloque toute réponse ARP ou émission de paquet par durcissement sysctl kernel.
            </p>
          </div>
        </div>
      )}

      {activeDoc === 'install' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Guide d’Installation & Déploiement sur Debian 13 (Trixie)
          </h3>
          <p className="text-xs text-slate-400">
            OpenNDR est conçu pour fonctionner nativement sous Debian sans Docker obligatoire, géré par systemd.
          </p>

          <div className="space-y-3 font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-slate-500"># 1. Vérification des prérequis système (CPU, RAM, interfaces)</div>
            <div className="text-emerald-400">sudo bash deployment/debian/check-prerequisites.sh</div>

            <div className="text-slate-500 pt-2"># 2. Exécution du script d’installation natif</div>
            <div className="text-emerald-400">sudo bash deployment/debian/install.sh</div>

            <div className="text-slate-500 pt-2"># 3. Démarrage des démons systemd</div>
            <div className="text-emerald-400">sudo systemctl enable --now openndr-backend openndr-engine openndr-web</div>

            <div className="text-slate-500 pt-2"># 4. Vérification de l’état de santé</div>
            <div className="text-emerald-400">curl -s http://127.0.0.1:8000/api/v1/health | jq</div>
          </div>
        </div>
      )}

      {activeDoc === 'specs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Spécification des Endpoints de l’API REST V0.1
          </h3>
          <p className="text-xs text-slate-400">
            Contrats d'interface OpenAPI normalisés pour l'intégration avec le SIEM ou l'interface SOC.
          </p>

          <div className="divide-y divide-slate-800 font-mono text-xs">
            <div className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">GET</span>
                <span className="text-slate-200">/api/v1/health</span>
              </div>
              <span className="text-slate-500">Public · Vérification de santé</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sky-400 font-bold">POST</span>
                <span className="text-slate-200">/api/v1/auth/login</span>
              </div>
              <span className="text-slate-500">Public · Authentification Argon2/JWT</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">GET</span>
                <span className="text-slate-200">/api/v1/auth/me</span>
              </div>
              <span className="text-slate-500">Bearer Auth · Profil utilisateur</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">GET</span>
                <span className="text-slate-200">/api/v1/system/status</span>
              </div>
              <span className="text-slate-500">system:view · Télémétrie services</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">GET</span>
                <span className="text-slate-200">/api/v1/system/audit</span>
              </div>
              <span className="text-slate-500">audit:view · Journal d’audit de sécurité</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
