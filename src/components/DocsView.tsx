import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';
import { PageContainer, PageHeader, SectionCard } from './ui';

type DocSection = 'arch' | 'adr' | 'install' | 'specs' | 'roadmap';

const DOC_NAV: { id: DocSection; label: string }[] = [
  { id: 'arch', label: 'Vue d\'architecture' },
  { id: 'adr', label: 'Décisions d\'architecture (ADR)' },
  { id: 'install', label: 'Installation Debian 13' },
  { id: 'specs', label: 'Référence API REST' },
  { id: 'roadmap', label: 'Feuille de route produit' },
];

export const DocsView: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<DocSection>('arch');

  const roadmapMilestones = [
    {
      version: 'V0.1',
      title: 'Fondations techniques et sécurité',
      status: 'IMPLÉMENTÉ',
      completed: true,
      points: [
        'Architecture 3 tiers modulaire (moteur Rust, backend FastAPI, console React)',
        'Contrôle d\'accès RBAC vérifié côté serveur (Administrateur, Analyste, Observateur)',
        'Séparation stricte entre l\'interface d\'administration et l\'interface de capture passive',
        'Schémas PostgreSQL, révocation JWT persistante et migrations Alembic',
        'Unités systemd et scripts d\'installation natifs Debian 13',
      ],
    },
    {
      version: 'V0.2',
      title: 'Capture réseau et décodage L2–L4',
      status: 'IMPLÉMENTÉ',
      completed: true,
      points: [
        'Capture passive AF_PACKET (PACKET_MMAP TPACKET_V2) et compatibilité libpcap',
        'Ingestion et analyse de traces PCAP / PCAPNG',
        'Décodage hiérarchique L2–L4 : Ethernet II, VLAN 802.1Q, ARP, IPv4, IPv6, ICMP, TCP, UDP',
        'Écriture rotative locale des fichiers PCAP et explorateur de paquets',
      ],
    },
    {
      version: 'V0.3',
      title: 'Flux et analyse protocolaire',
      status: 'PLANIFIÉ',
      completed: false,
      points: [
        'Reconstruction de flux TCP/UDP et suivi d\'état des sessions',
        'Parseurs applicatifs : DNS, DHCP, HTTP, métadonnées TLS (SNI/JA3), SSH',
        'Gestion mémoire bornée des sessions réseau actives',
      ],
    },
    {
      version: 'V0.4',
      title: 'Moteur de détection autonome',
      status: 'PLANIFIÉ',
      completed: false,
      points: [
        'Moteur de règles de signatures et détection comportementale',
        'Détection par seuils (scans de ports, balayages, tunneling DNS)',
        'Génération d\'alertes de sécurité accompagnées de preuves techniques',
      ],
    },
    {
      version: 'V0.5',
      title: 'Corrélation et gestion des incidents',
      status: 'PLANIFIÉ',
      completed: false,
      points: [
        'Moteur de corrélation temporelle multi-sources',
        'Dossiers d\'incidents de sécurité et chronologie d\'investigation',
        'Déduplication et réduction du bruit opérationnel',
      ],
    },
    {
      version: 'V1.0',
      title: 'Première version de production stable',
      status: 'CIBLE',
      completed: false,
      points: [
        'Plateforme NDR autonome sans dépendance cloud obligatoire',
        'Empaquetage Debian complet, essais de charge et audits de sécurité',
      ],
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Documentation"
        description="Référentiels d'architecture, guides d'installation Debian 13, contrats API et documentation produit."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Menu de documentation */}
        <SectionCard title="Sommaire" noPadding>
          <nav aria-label="Sections de documentation" className="p-2 space-y-0.5">
            {DOC_NAV.map((item) => {
              const active = activeDoc === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveDoc(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1f2329]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </SectionCard>

        {/* Contenu documentaire */}
        <div className="lg:col-span-3 space-y-6">
          {activeDoc === 'arch' && (
            <SectionCard
              title="Architecture logicielle OpenNDR"
              description="Séparation stricte entre plan d'analyse, plan d'orchestration et interface web"
            >
              <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <p>
                  OpenNDR repose sur trois composants distincts conçus pour fonctionner nativement
                  sous Debian 13 (Trixie) sans dépendance à des services cloud externes :
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      1. Moteur de capture Rust
                    </div>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      Capture passive AF_PACKET/PACKET_MMAP sur port SPAN/TAP, décodage L2–L4 et
                      ingestion PCAP/PCAPNG.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      2. Backend d&apos;administration FastAPI
                    </div>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      API REST <span className="font-mono">/api/v1</span>, authentification JWT avec
                      révocation persistante PostgreSQL et journal d&apos;audit immuable.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      3. Console d&apos;administration Web
                    </div>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      Interface de supervision affichant uniquement l&apos;état réel remonté par les
                      services et les endpoints API.
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {activeDoc === 'adr' && (
            <div className="space-y-4">
              <SectionCard
                title="ADR-001 · Choix de Rust pour le moteur d'analyse réseau"
                actions={<span className="font-mono text-xs text-gray-500">Accepté</span>}
              >
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  Tous les décodeurs de paquets et l&apos;ingestion PCAP sont implémentés en Rust afin
                  d&apos;éliminer les vulnérabilités mémoire lors du traitement de trafic non fiable,
                  tout en conservant des performances prévisibles sans ramasse-miettes.
                </p>
              </SectionCard>

              <SectionCard
                title="ADR-002 · Backend d'orchestration FastAPI et PostgreSQL"
                actions={<span className="font-mono text-xs text-gray-500">Accepté</span>}
              >
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  Le service FastAPI gère l&apos;API REST, l&apos;authentification, le RBAC et la
                  traçabilité d&apos;audit. Il ne réalise aucune capture brute dans les workers HTTP et
                  pilote le moteur natif via un canal UNIX local dédié.
                </p>
              </SectionCard>

              <SectionCard
                title="ADR-003 · Séparation stricte des interfaces d'administration et de capture"
                actions={<span className="font-mono text-xs text-gray-500">Accepté</span>}
              >
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  La plateforme impose une séparation claire entre l&apos;interface d&apos;administration
                  (dotée d&apos;une adresse IP pour la console et l&apos;API) et l&apos;interface de capture
                  passive raccordée au port miroir (sans adresse IP ni routage sortant).
                </p>
              </SectionCard>
            </div>
          )}

          {activeDoc === 'install' && (
            <SectionCard
              title="Procédure d'installation sous Debian 13 (Trixie)"
              description="Déploiement natif géré par systemd"
            >
              <div className="space-y-4 text-xs">
                <p className="text-gray-600 dark:text-gray-400">
                  Exécutez les commandes suivantes avec les privilèges administrateur sur un hôte Debian 13 :
                </p>
                <div className="font-mono bg-gray-50 dark:bg-[#111318] p-4 rounded-md border border-gray-200 dark:border-[#2c313a] space-y-2 text-gray-800 dark:text-gray-200 overflow-x-auto">
                  <div className="text-gray-500"># 1. Vérifier les prérequis système (CPU, RAM, interfaces)</div>
                  <div>sudo bash deployment/debian/check-prerequisites.sh</div>
                  <div className="text-gray-500 pt-2"># 2. Exécuter l&apos;installation native</div>
                  <div>sudo bash deployment/debian/install.sh</div>
                  <div className="text-gray-500 pt-2"># 3. Activer et démarrer les services systemd</div>
                  <div>sudo systemctl enable --now openndr-backend openndr-engine openndr-web</div>
                  <div className="text-gray-500 pt-2"># 4. Contrôler l&apos;état de santé de l&apos;API</div>
                  <div>curl -s http://127.0.0.1:8000/api/v1/health</div>
                </div>
              </div>
            </SectionCard>
          )}

          {activeDoc === 'specs' && (
            <SectionCard
              title="Contrat d'interface REST /api/v1"
              description="Endpoints HTTP exposés par le backend"
              noPadding
            >
              <div className="divide-y divide-gray-200 dark:divide-[#2c313a] font-mono text-xs">
                {[
                  ['GET', '/api/v1/health', 'Public · Santé globale de la plateforme et du moteur'],
                  ['POST', '/api/v1/auth/login', 'Public · Authentification Argon2id / émission JWT'],
                  ['GET', '/api/v1/auth/me', 'Authentifié · Profil utilisateur et permissions'],
                  ['GET', '/api/v1/system/status', 'system:view · État des services et télémétrie'],
                  ['GET', '/api/v1/system/capture/telemetry', 'system:view · Débit, pertes et compteurs L2–L4'],
                  ['POST', '/api/v1/system/capture/start | stop', 'interfaces:manage · Démarrage / arrêt capture'],
                  ['POST', '/api/v1/system/capture/ingest-pcap | upload-pcap', 'interfaces:manage · Analyse de fichier PCAP'],
                  ['GET', '/api/v1/system/interfaces/isolation-check', 'interfaces:view · Vérification d\'isolation passive'],
                  ['GET', '/api/v1/system/updates', 'État de version et planification des mises à jour'],
                  ['GET', '/api/v1/system/audit', 'audit:view · Journal d\'audit horodaté'],
                ].map(([method, route, desc]) => (
                  <div
                    key={route}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`font-bold ${
                          method === 'GET'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {method}
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">{route}</span>
                    </div>
                    <span className="font-sans text-gray-500 dark:text-gray-400">{desc}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {activeDoc === 'roadmap' && (
            <SectionCard
              title="Feuille de route produit (documentation indicative)"
              description="Jalons fonctionnels prévus entre la V0.1 et la V1.0"
            >
              <div className="mb-4 p-3 rounded-md border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <span>
                  Cette section présente la documentation produit indicative des jalons OpenNDR ; elle ne
                  constitue pas une mesure d&apos;état temps réel du capteur.
                </span>
              </div>

              <div className="space-y-3">
                {roadmapMilestones.map((m) => (
                  <div
                    key={m.version}
                    className="p-4 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">
                          {m.version}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {m.title}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                          m.completed
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {m.points.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          {m.completed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                          )}
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </PageContainer>
  );
};
