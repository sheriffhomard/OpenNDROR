import React, { useState } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  LogIn,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import {
  SystemService,
  NetworkInterfaceConfig,
  StorageMetrics,
  EngineTelemetry,
  PlatformHealth,
  AuditLogItem,
  SystemUpdateState,
} from '../types/system';
import { BackendConnectionState } from './TopBar';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  OperationalState,
  EmptyState,
  ErrorState,
} from './ui';

interface DashboardViewProps {
  isAuthenticated: boolean;
  connectionState: BackendConnectionState;
  lastRefreshedAt: string | null;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  health: PlatformHealth | null;
  services: SystemService[];
  interfaces: NetworkInterfaceConfig[];
  storage: StorageMetrics | null;
  telemetry: EngineTelemetry | null;
  auditLogs: AuditLogItem[];
  updateState: SystemUpdateState | null;
  statusError: string | null;
  onOpenLogin: () => void;
  onNavigateToCapture: () => void;
  onNavigateToInterfaces: () => void;
  onNavigateToDiagnostics: () => void;
}

type GuideStepState = 'todo' | 'in_progress' | 'passed' | 'failed' | 'unverifiable';

const GUIDE_BADGE: Record<GuideStepState, { label: string; classes: string }> = {
  todo: {
    label: 'À effectuer',
    classes: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
  in_progress: {
    label: 'En cours',
    classes: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70',
  },
  passed: {
    label: 'Validée',
    classes: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70',
  },
  failed: {
    label: 'Échec',
    classes: 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/70',
  },
  unverifiable: {
    label: 'Impossible à vérifier',
    classes: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
  },
};

function formatTime(iso: string | null): string {
  if (!iso) return 'Jamais actualisé';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function mapEngineOperationalStatus(status?: string | null): OperationalState | null {
  switch (status?.toUpperCase()) {
    case 'OPERATIONAL':
      return 'operational';
    case 'DEGRADED':
      return 'degraded';
    case 'STOPPED':
      return 'stopped';
    case 'UNAVAILABLE':
      return 'unavailable';
    case 'UNKNOWN':
      return 'unknown';
    default:
      return null;
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  isAuthenticated,
  connectionState,
  lastRefreshedAt,
  isRefreshing,
  onRefresh,
  health,
  services,
  interfaces,
  storage,
  telemetry,
  auditLogs,
  updateState,
  statusError,
  onOpenLogin,
  onNavigateToCapture,
  onNavigateToInterfaces,
  onNavigateToDiagnostics,
}) => {
  const [guideCollapsed, setGuideCollapsed] = useState(false);

  const adminInterface = interfaces.find((i) => i.role === 'ADMINISTRATION');
  const passiveInterface = interfaces.find((i) => i.role === 'CAPTURE_PASSIVE');
  const engineService = services.find((s) => s.name === 'openndr-engine');

  // --- Derive honest system component states ---
  const backendState: OperationalState =
    connectionState === 'unavailable'
      ? 'unavailable'
      : connectionState === 'checking'
      ? 'unknown'
      : health?.status === 'HEALTHY'
      ? 'operational'
      : health
      ? 'degraded'
      : 'unknown';

  const dbState: OperationalState =
    connectionState === 'unavailable'
      ? 'unavailable'
      : health?.database?.connected === true
      ? 'operational'
      : health?.database
      ? 'unavailable'
      : 'unknown';

  const rustEngineState: OperationalState = (() => {
    if (connectionState === 'unavailable') return 'unavailable';

    const rawStatus = telemetry?.engine_status ?? health?.capture_engine?.engine_status;
    const mappedStatus = mapEngineOperationalStatus(rawStatus);
    const binaryMissing =
      telemetry?.binary_present === false ||
      health?.capture_engine?.binary_present === false ||
      updateState?.engine_integrity_ok === false;
    const ipcExplicitlyDown =
      telemetry?.ipc_reachable === false ||
      health?.capture_engine?.ipc_reachable === false;
    const hasEngineError = Boolean(
      telemetry?.ipc_error ||
        telemetry?.socket_error ||
        health?.capture_engine?.ipc_error
    );

    if (mappedStatus) {
      if (mappedStatus === 'operational' && (binaryMissing || ipcExplicitlyDown || hasEngineError)) {
        return 'degraded';
      }
      return mappedStatus;
    }

    const svcStatus = engineService?.status?.toUpperCase();
    if (binaryMissing) {
      return telemetry?.is_running ? 'degraded' : 'unavailable';
    }
    if (hasEngineError || svcStatus === 'FAILED') {
      return 'degraded';
    }
    if (
      telemetry?.is_running ||
      ((svcStatus === 'ACTIVE' || svcStatus === 'READY') &&
        (telemetry?.ipc_reachable === true || health?.capture_engine?.ipc_reachable === true))
    ) {
      return 'operational';
    }
    if (svcStatus === 'INACTIVE' || svcStatus === 'STOPPED') {
      return 'stopped';
    }
    if (svcStatus === 'NOT_FOUND') {
      return 'unavailable';
    }
    if (ipcExplicitlyDown) {
      return 'unavailable';
    }
    return 'unknown';
  })();

  const captureServiceState: OperationalState =
    connectionState === 'unavailable'
      ? 'unavailable'
      : !isAuthenticated
      ? 'unknown'
      : telemetry === null
      ? 'unavailable'
      : telemetry.is_running
      ? 'operational'
      : telemetry.ipc_reachable === false
      ? 'unavailable'
      : 'stopped';

  const adminIfaceState: OperationalState =
    connectionState === 'unavailable'
      ? 'unavailable'
      : !isAuthenticated
      ? 'unknown'
      : !adminInterface
      ? interfaces.length === 0
        ? 'unknown'
        : 'unconfigured'
      : adminInterface.isUp
      ? 'operational'
      : 'stopped';

  const passiveIfaceState: OperationalState =
    connectionState === 'unavailable'
      ? 'unavailable'
      : !isAuthenticated
      ? 'unknown'
      : !passiveInterface
      ? 'unconfigured'
      : !passiveInterface.isStealthCompliant
      ? 'degraded'
      : passiveInterface.isUp
      ? 'operational'
      : 'stopped';

  const storageState: OperationalState =
    connectionState === 'unavailable'
      ? 'unavailable'
      : !isAuthenticated
      ? 'unknown'
      : !storage
      ? 'unavailable'
      : storage.status === 'READY' && storage.isWritable !== false
      ? 'operational'
      : storage.status === 'NOT_CREATED'
      ? 'unconfigured'
      : storage.status === 'PERMISSION_DENIED' ||
        storage.status === 'READ_ONLY' ||
        storage.isWritable === false
      ? 'degraded'
      : 'unknown';

  const engineBinaryMissing =
    telemetry?.binary_present === false ||
    health?.capture_engine?.binary_present === false ||
    updateState?.engine_integrity_ok === false;
  const engineIpcErr =
    telemetry?.ipc_error || telemetry?.socket_error || health?.capture_engine?.ipc_error;

  const systemRows: {
    component: string;
    state: OperationalState;
    detail: string;
  }[] = [
    {
      component: 'Backend API',
      state: backendState,
      detail:
        connectionState === 'unavailable'
          ? 'Serveur injoignable'
          : health
          ? `Version ${health.version} (${health.target_platform})`
          : 'En attente de réponse serveur',
    },
    {
      component: 'Base PostgreSQL',
      state: dbState,
      detail: health?.database?.status || 'Non vérifié',
    },
    {
      component: 'Moteur Rust',
      state: rustEngineState,
      detail: engineBinaryMissing
        ? 'Binaire openndr-engine absent sur cet hôte'
        : engineIpcErr
        ? `IPC moteur indisponible : ${engineIpcErr}`
        : rustEngineState === 'stopped'
        ? 'Service openndr-engine arrêté ou en attente de démarrage'
        : telemetry?.engine_version
        ? `Version ${telemetry.engine_version}`
        : health?.capture_engine?.version
        ? `Version ${health.capture_engine.version}`
        : health?.capture_engine?.notice || 'État non confirmé',
    },
    {
      component: 'Service de capture',
      state: captureServiceState,
      detail: !isAuthenticated
        ? 'Authentification requise'
        : telemetry
        ? telemetry.ipc_reachable === false
          ? telemetry.ipc_error || 'Socket IPC moteur non joignable'
          : telemetry.is_running
          ? `Capture active (${telemetry.capture_mode || 'LIVE'})`
          : `En veille (${telemetry.capture_mode || 'STANDBY'})`
        : 'Non disponible',
    },
    {
      component: 'Interface d\'administration',
      state: adminIfaceState,
      detail: !isAuthenticated
        ? 'Authentification requise'
        : adminInterface
        ? `${adminInterface.name} · ${adminInterface.ipAddress || 'Aucune IP'}`
        : 'Aucune interface d\'administration détectée',
    },
    {
      component: 'Interface passive',
      state: passiveIfaceState,
      detail: !isAuthenticated
        ? 'Authentification requise'
        : passiveInterface
        ? passiveInterface.isStealthCompliant
          ? `${passiveInterface.name} · Conforme (sans IP)`
          : `${passiveInterface.name} · Adresse IP détectée (${passiveInterface.ipAddress})`
        : 'Aucune interface de capture passive configurée',
    },
    {
      component: 'Stockage PCAP',
      state: storageState,
      detail: !isAuthenticated
        ? 'Authentification requise'
        : storage
        ? `${storage.pcapDirectory} (${storage.status || 'Inconnu'}${storage.isWritable === false ? ' · non accessible en écriture' : ''})`
        : 'Non disponible',
    },
  ];

  // --- Network metrics availability ---
  const hasCaptureActivity =
    telemetry !== null &&
    (telemetry.is_running ||
      (telemetry.packets_received ?? 0) > 0 ||
      (telemetry.bytes_processed ?? 0) > 0);

  // --- First-use 6-step setup guide ---
  const stepServer: GuideStepState =
    connectionState === 'connected'
      ? 'passed'
      : connectionState === 'unavailable'
      ? 'failed'
      : 'in_progress';

  const stepDb: GuideStepState =
    connectionState === 'unavailable'
      ? 'unverifiable'
      : health?.database?.connected
      ? 'passed'
      : health
      ? 'failed'
      : 'unverifiable';

  const stepInterfaces: GuideStepState =
    connectionState === 'unavailable' || !isAuthenticated
      ? 'unverifiable'
      : adminInterface && passiveInterface
      ? 'passed'
      : 'todo';

  const stepPassiveIsolation: GuideStepState =
    connectionState === 'unavailable' || !isAuthenticated
      ? 'unverifiable'
      : !passiveInterface
      ? 'todo'
      : passiveInterface.isStealthCompliant
      ? 'passed'
      : 'failed';

  const stepEngine: GuideStepState =
    connectionState === 'unavailable'
      ? 'unverifiable'
      : rustEngineState === 'operational'
      ? 'passed'
      : rustEngineState === 'degraded' || rustEngineState === 'unavailable'
      ? 'failed'
      : rustEngineState === 'stopped'
      ? 'todo'
      : 'unverifiable';

  const stepCapture: GuideStepState =
    connectionState === 'unavailable' || !isAuthenticated
      ? 'unverifiable'
      : hasCaptureActivity
      ? 'passed'
      : 'todo';

  const guideSteps: { id: number; label: string; state: GuideStepState; detail: string }[] = [
    {
      id: 1,
      label: 'Vérifier la connexion au serveur',
      state: stepServer,
      detail: connectionState === 'connected' ? 'API REST joignable.' : 'Serveur non joignable.',
    },
    {
      id: 2,
      label: 'Vérifier la base de données',
      state: stepDb,
      detail: health?.database?.connected ? 'Connexion relationnelle active.' : 'État non confirmé.',
    },
    {
      id: 3,
      label: 'Configurer les interfaces réseau',
      state: stepInterfaces,
      detail: !isAuthenticated
        ? 'Connectez-vous pour inspecter les interfaces.'
        : adminInterface && passiveInterface
        ? 'Interfaces d\'administration et passive présentes.'
        : 'Configuration incomplète.',
    },
    {
      id: 4,
      label: 'Vérifier l\'isolation de l\'interface passive',
      state: stepPassiveIsolation,
      detail: !isAuthenticated
        ? 'Connectez-vous pour vérifier l\'isolation.'
        : !passiveInterface
        ? 'Aucune interface passive détectée.'
        : passiveInterface.isStealthCompliant
        ? 'Aucune adresse IP détectée.'
        : 'Violation détectée : adresse IP présente sur l\'interface passive.',
    },
    {
      id: 5,
      label: 'Vérifier le moteur Rust',
      state: stepEngine,
      detail:
        rustEngineState === 'operational'
          ? 'Binaire présent et IPC moteur joignable.'
          : engineBinaryMissing
          ? 'Binaire openndr-engine absent ou non compilé sur cet hôte.'
          : engineIpcErr
          ? `Erreur IPC moteur : ${engineIpcErr}`
          : rustEngineState === 'stopped'
          ? 'Service openndr-engine arrêté.'
          : 'État réel du moteur non confirmé.',
    },
    {
      id: 6,
      label: 'Lancer une première capture ou analyser un fichier PCAP',
      state: stepCapture,
      detail: !isAuthenticated
        ? 'Connectez-vous pour consulter l\'état de capture.'
        : hasCaptureActivity
        ? `${telemetry?.packets_received ?? 0} paquet(s) traité(s).`
        : 'Aucune capture ni analyse PCAP enregistrée.',
    },
  ];

  const allStepsPassed = guideSteps.every((s) => s.state === 'passed');

  // --- Available Storage Calculation ---
  const availableStorageGb =
    storage && typeof storage.maxStorageGb === 'number' && typeof storage.usedStorageGb === 'number'
      ? Math.max(0, Number((storage.maxStorageGb - storage.usedStorageGb).toFixed(4)))
      : null;

  return (
    <PageContainer>
      {/* A. En-tête */}
      <PageHeader
        title="Vue d'ensemble"
        description="État général du capteur et de ses composants."
        meta={
          <>
            <span>Dernière actualisation : {formatTime(lastRefreshedAt)}</span>
            {health?.version && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">OpenNDR {health.version}</span>
              </>
            )}
          </>
        }
        actions={
          <>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Se connecter</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </>
        }
      />

      {connectionState === 'unavailable' && (
        <ErrorState
          unavailable
          message="Impossible de joindre le serveur API OpenNDR. Aucune métrique temps réel ne peut être confirmée."
          onRetry={onRefresh}
        />
      )}

      {statusError && connectionState !== 'unavailable' && (
        <ErrorState message={statusError} onRetry={onRefresh} />
      )}

      {/* B. État général du système */}
      <SectionCard
        title="État général du système"
        description="Statut vérifié en temps réel de chaque composant logiciel et réseau"
        noPadding
      >
        <div className="divide-y divide-gray-200 dark:divide-[#2c313a]">
          {systemRows.map((row) => (
            <div
              key={row.component}
              className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100">{row.component}</div>
                <div className="text-gray-500 dark:text-gray-400 mt-0.5">{row.detail}</div>
              </div>
              <div className="shrink-0">
                <StatusBadge state={row.state} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* C. Indicateurs réseau */}
      <SectionCard
        title="Indicateurs réseau"
        description="Mesures issues du moteur de capture passive et de l'analyse PCAP"
        actions={
          isAuthenticated && (
            <button
              type="button"
              onClick={onNavigateToCapture}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Ouvrir Capture réseau</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )
        }
      >
        {!isAuthenticated ? (
          <EmptyState
            title="Authentification requise"
            description="Connectez-vous pour consulter les indicateurs de capture et la répartition protocolaire."
            action={
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                Se connecter
              </button>
            }
          />
        ) : telemetry === null ? (
          <EmptyState
            title="Indisponible"
            description="La télémétrie du moteur de capture n'a pas pu être récupérée depuis le serveur."
          />
        ) : !hasCaptureActivity ? (
          <EmptyState
            title="Aucune donnée de capture disponible"
            description="Aucune capture active n'est en cours et aucun fichier PCAP n'a encore été analysé depuis le démarrage du service."
            action={
              <button
                type="button"
                onClick={onNavigateToCapture}
                className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
              >
                Aller à Capture réseau
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">État de la capture</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 font-mono">
                  {telemetry.is_running
                    ? `ACTIVE (${telemetry.capture_mode || 'LIVE'})`
                    : telemetry.capture_mode || 'INDISPONIBLE'}
                </div>
              </div>
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">Paquets reçus</div>
                <div className="mt-1 text-base font-semibold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {telemetry.packets_received !== null
                    ? telemetry.packets_received.toLocaleString('fr-FR')
                    : 'Non disponible'}
                </div>
              </div>
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">Débit réseau</div>
                <div className="mt-1 text-base font-semibold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {telemetry.current_mbps !== null
                    ? `${telemetry.current_mbps.toFixed(3)} Mbps`
                    : 'Non disponible'}
                </div>
              </div>
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">Paquets perdus</div>
                <div className="mt-1 text-base font-semibold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {telemetry.packets_dropped !== null
                    ? telemetry.packets_dropped.toLocaleString('fr-FR')
                    : 'Non disponible'}
                </div>
              </div>
            </div>

            {telemetry.protocol_stats ? (
              <div className="pt-2 border-t border-gray-200 dark:border-[#2c313a] text-xs flex flex-wrap items-center gap-4 font-mono tabular-nums text-gray-600 dark:text-gray-400">
                <span>TCP : {telemetry.protocol_stats.tcp_packets.toLocaleString('fr-FR')}</span>
                <span>UDP : {telemetry.protocol_stats.udp_packets.toLocaleString('fr-FR')}</span>
                <span>ICMP : {telemetry.protocol_stats.icmp_packets.toLocaleString('fr-FR')}</span>
                <span>ARP : {telemetry.protocol_stats.arp_packets.toLocaleString('fr-FR')}</span>
                <span>IPv4 : {telemetry.protocol_stats.ipv4_packets.toLocaleString('fr-FR')}</span>
                <span>IPv6 : {telemetry.protocol_stats.ipv6_packets.toLocaleString('fr-FR')}</span>
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-200 dark:border-[#2c313a] text-xs text-gray-500 dark:text-gray-400">
                Répartition protocolaire non disponible.
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* D. Interfaces réseau & E. Stockage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Interfaces réseau"
          description="Séparation des ports d'administration et de capture passive"
          actions={
            isAuthenticated && (
              <button
                type="button"
                onClick={onNavigateToInterfaces}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Configurer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )
          }
        >
          {!isAuthenticated ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-4">
              En attente de connexion utilisateur pour lire la configuration des interfaces.
            </div>
          ) : interfaces.length === 0 ? (
            <EmptyState
              title="Interfaces non configurées"
              description="Aucune interface réseau n'a été remontée par le serveur."
              action={
                <button
                  type="button"
                  onClick={onNavigateToInterfaces}
                  className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1f2329]"
                >
                  Voir les interfaces
                </button>
              }
            />
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Interface d&apos;administration
                  </span>
                  <StatusBadge state={adminIfaceState} />
                </div>
                {adminInterface ? (
                  <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400 pt-1">
                    <span>Nom : <strong className="font-mono text-gray-900 dark:text-gray-200">{adminInterface.name}</strong></span>
                    <span>IP : <strong className="font-mono text-gray-900 dark:text-gray-200">{adminInterface.ipAddress || 'Aucune'}</strong></span>
                    <span>Lien : {adminInterface.isUp ? 'Actif (UP)' : 'Inactif (DOWN)'}</span>
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">Non configurée.</div>
                )}
              </div>

              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Interface passive
                  </span>
                  <StatusBadge state={passiveIfaceState} />
                </div>
                {passiveInterface ? (
                  <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400 pt-1">
                    <span>Nom : <strong className="font-mono text-gray-900 dark:text-gray-200">{passiveInterface.name}</strong></span>
                    <span>IP : <strong className="font-mono text-gray-900 dark:text-gray-200">{passiveInterface.ipAddress || 'Aucune'}</strong></span>
                    <span>Lien : {passiveInterface.isUp ? 'Actif (UP)' : 'Inactif (DOWN)'}</span>
                    <span>Conformité : {passiveInterface.isStealthCompliant ? 'Conforme' : 'Non conforme'}</span>
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    Non configurée.{' '}
                    <button
                      type="button"
                      onClick={onNavigateToInterfaces}
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      Consulter la configuration réseau
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* E. Stockage */}
        <SectionCard
          title="Stockage"
          description="Utilisation locale des fichiers PCAP et politique de rétention"
        >
          {!isAuthenticated ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-4">
              En attente de connexion utilisateur pour consulter l&apos;état du stockage.
            </div>
          ) : !storage ? (
            <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
              Indisponible
            </div>
          ) : (
            <dl className="divide-y divide-gray-200 dark:divide-[#2c313a] text-xs">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Répertoire PCAP</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100 truncate">
                  {storage.pcapDirectory}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Espace utilisé</dt>
                <dd className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {storage.usedStorageGb !== null && storage.usedStorageGb !== undefined
                    ? `${storage.usedStorageGb} Go`
                    : 'Indisponible'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Quota configuré</dt>
                <dd className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {storage.maxStorageGb} Go
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Espace disponible</dt>
                <dd className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {availableStorageGb !== null ? `${availableStorageGb} Go` : 'Indisponible'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Politique de rétention</dt>
                <dd className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {storage.retentionDays} jours
                </dd>
              </div>
            </dl>
          )}
        </SectionCard>
      </div>

      {/* F. Alertes et événements récents */}
      <SectionCard
        title="Alertes et événements récents"
        description="Événements système et alertes de conformité effectivement remontés par le serveur"
        noPadding
      >
        {!isAuthenticated ? (
          <div className="p-5 text-xs text-gray-500 dark:text-gray-400">
            Connectez-vous pour consulter les alertes réseau et les derniers événements d&apos;audit.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-[#2c313a]">
            {passiveInterface && !passiveInterface.isStealthCompliant && (
              <div className="px-5 py-3 bg-red-50/70 dark:bg-red-950/25 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Non-conformité d&apos;isolation :</strong> l&apos;interface passive{' '}
                    <span className="font-mono">{passiveInterface.name}</span> possède une adresse IP (
                    <span className="font-mono">{passiveInterface.ipAddress}</span>).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToInterfaces}
                  className="text-xs font-medium text-red-800 dark:text-red-300 underline shrink-0"
                >
                  Inspecter
                </button>
              </div>
            )}

            {auditLogs.length === 0 ? (
              <div className="p-5 text-xs text-gray-500 dark:text-gray-400">
                Aucun événement récent remonté par le backend (ou privilège audit:view absent).
              </div>
            ) : (
              auditLogs.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {item.action}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400 truncate">
                      {item.userEmail}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono text-gray-500 dark:text-gray-400 tabular-nums">
                    <span
                      className={
                        item.status === 'SUCCESS'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : item.status === 'DENIED'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-red-700 dark:text-red-400'
                      }
                    >
                      {item.status}
                    </span>
                    <span>{new Date(item.timestamp).toLocaleTimeString('fr-FR')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SectionCard>

      {/* G. Guide de première utilisation */}
      <SectionCard
        title="Guide de première utilisation"
        description={
          allStepsPassed
            ? 'Toutes les étapes de mise en service sont validées.'
            : 'Parcours de vérification initial calculé à partir de l\'état réel du système'
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToDiagnostics}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              État et diagnostics
            </button>
            <button
              type="button"
              onClick={() => setGuideCollapsed((c) => !c)}
              aria-expanded={!guideCollapsed}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-gray-200 dark:border-[#2c313a] text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1f2329]"
            >
              {guideCollapsed ? (
                <>
                  <span>Afficher</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Replier</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        }
        noPadding={!guideCollapsed}
      >
        {!guideCollapsed && (
          <div className="divide-y divide-gray-200 dark:divide-[#2c313a]">
            {guideSteps.map((step) => {
              const badge = GUIDE_BADGE[step.state];
              return (
                <div
                  key={step.id}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono font-semibold text-gray-500 dark:text-gray-400 w-5 shrink-0">
                      {step.id}.
                    </span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{step.label}</div>
                      <div className="text-gray-500 dark:text-gray-400 mt-0.5">{step.detail}</div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 ${badge.classes}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
};
