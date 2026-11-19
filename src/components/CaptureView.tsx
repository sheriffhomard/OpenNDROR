import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Upload,
  FolderOpen,
  Search,
  FileCheck2,
  Layers,
} from 'lucide-react';
import { EngineTelemetry, PacketSummary, PcapIngestionResult, ProtocolStats } from '../types/system';
import { apiService } from '../services/api';
import { HelpTooltip } from './HelpTooltip';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  DataTable,
  ConfirmDialog,
} from './ui';

interface CaptureViewProps {
  telemetry: EngineTelemetry | null;
  telemetryError: string | null;
  canManageCapture: boolean;
  onRefreshTelemetry: () => Promise<void>;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

const EMPTY_PROTOCOL_STATS: ProtocolStats = {
  tcp_packets: 0,
  udp_packets: 0,
  icmp_packets: 0,
  arp_packets: 0,
  ipv4_packets: 0,
  ipv6_packets: 0,
  vlan_packets: 0,
  other_packets: 0,
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function formatTimestampUs(us: number): string {
  if (!us || us <= 0) return '-';
  const date = new Date(Math.floor(us / 1000));
  const msPart = String(Math.floor((us % 1000000) / 1000)).padStart(3, '0');
  return `${date.toLocaleTimeString('fr-FR', { hour12: false })}.${msPart}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  telemetry,
  telemetryError,
  canManageCapture,
  onRefreshTelemetry,
  onNotify,
}) => {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [serverPathInput, setServerPathInput] = useState('');
  const [lastIngestion, setLastIngestion] = useState<PcapIngestionResult | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isRunning = telemetry?.is_running ?? false;
  const stats: ProtocolStats | null =
    lastIngestion?.protocol_stats || telemetry?.protocol_stats || null;

  const hasCapturedData =
    lastIngestion !== null ||
    (telemetry !== null &&
      (telemetry.is_running ||
        (telemetry.packets_received ?? 0) > 0 ||
        (telemetry.bytes_processed ?? 0) > 0 ||
        (telemetry.recent_packets?.length ?? 0) > 0));

  const displayedPackets: PacketSummary[] = useMemo(() => {
    if (lastIngestion?.packet_summaries && lastIngestion.packet_summaries.length > 0) {
      return lastIngestion.packet_summaries;
    }
    return telemetry?.recent_packets || [];
  }, [lastIngestion, telemetry]);

  const filteredPackets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayedPackets.filter((pkt) => {
      if (protocolFilter !== 'ALL') {
        if (protocolFilter === 'VLAN') {
          if (pkt.vlan_id === null || pkt.vlan_id === undefined) return false;
        } else if (!pkt.protocol.toUpperCase().includes(protocolFilter)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        pkt.protocol.toLowerCase().includes(q) ||
        pkt.src_mac.toLowerCase().includes(q) ||
        pkt.dst_mac.toLowerCase().includes(q) ||
        (pkt.src_ip || '').toLowerCase().includes(q) ||
        (pkt.dst_ip || '').toLowerCase().includes(q) ||
        String(pkt.src_port || '').includes(q) ||
        String(pkt.dst_port || '').includes(q) ||
        pkt.info.toLowerCase().includes(q)
      );
    });
  }, [displayedPackets, protocolFilter, searchQuery]);

  const effectiveStats = stats || EMPTY_PROTOCOL_STATS;

  const totalTransportOrL2 = Math.max(
    1,
    effectiveStats.tcp_packets +
      effectiveStats.udp_packets +
      effectiveStats.icmp_packets +
      effectiveStats.arp_packets +
      effectiveStats.other_packets
  );

  const protocolBreakdown = [
    { label: 'TCP', count: effectiveStats.tcp_packets },
    { label: 'UDP', count: effectiveStats.udp_packets },
    { label: 'ICMP', count: effectiveStats.icmp_packets },
    { label: 'ARP', count: effectiveStats.arp_packets },
    { label: 'Autres', count: effectiveStats.other_packets },
  ];

  const handleStartCapture = async () => {
    if (!canManageCapture) return;
    setIsActionLoading(true);
    setErrorDetail(null);
    try {
      const res = await apiService.startCapture();
      onNotify('success', res.message || 'Capture passive démarrée');
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du démarrage de la capture';
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopCapture = async () => {
    if (!canManageCapture) return;
    setIsActionLoading(true);
    setErrorDetail(null);
    try {
      const res = await apiService.stopCapture();
      onNotify('success', res.message || 'Capture passive arrêtée');
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'arrêt de la capture';
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsActionLoading(false);
      setConfirmStopOpen(false);
    }
  };

  const handleIngestServerFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverPathInput.trim()) return;
    setIsIngesting(true);
    setErrorDetail(null);
    try {
      const res = await apiService.ingestPcap(serverPathInput.trim());
      setLastIngestion(res);
      onNotify('success', `${res.packets_processed} paquet(s) décodé(s) depuis ${res.file_path}`);
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de l\'analyse PCAP';
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsIngesting(true);
    setErrorDetail(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const res = await apiService.uploadPcap(file.name, base64);
      setLastIngestion(res);
      onNotify('success', `Fichier ${file.name} analysé (${res.packets_processed} paquets)`);
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'analyse du fichier PCAP';
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsIngesting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const engineBadge = (() => {
    if (telemetry === null) {
      return { state: 'unavailable' as const, label: 'Indisponible' };
    }
    const raw = telemetry.engine_status?.toUpperCase();
    if (raw === 'UNAVAILABLE') {
      return { state: 'unavailable' as const, label: 'Indisponible' };
    }
    if (raw === 'DEGRADED' || telemetry.ipc_error || telemetry.socket_error) {
      return { state: 'degraded' as const, label: 'En fonctionnement dégradé' };
    }
    if (raw === 'STOPPED' || (!telemetry.is_running && telemetry.ipc_reachable === false)) {
      return { state: 'stopped' as const, label: 'Arrêté' };
    }
    if (raw === 'UNKNOWN') {
      return { state: 'unknown' as const, label: 'Inconnu' };
    }
    if (telemetry.is_running) {
      return { state: 'operational' as const, label: 'Actif' };
    }
    if (raw === 'OPERATIONAL') {
      return { state: 'stopped' as const, label: 'Arrêté (en veille)' };
    }
    return { state: 'stopped' as const, label: 'Arrêté (en veille)' };
  })();

  const engineUnavailableByIpc = telemetry !== null && telemetry.ipc_reachable === false;

  return (
    <PageContainer>
      <PageHeader
        title="Capture réseau"
        description="Pilotage de l'écoute passive, ingestion de captures PCAP et exploration des paquets décodés."
        actions={
          <>
            <button
              type="button"
              onClick={() => onRefreshTelemetry()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>

            {canManageCapture && telemetry !== null && !engineUnavailableByIpc && (
              isRunning ? (
                <button
                  type="button"
                  onClick={() => setConfirmStopOpen(true)}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Arrêter la capture</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartCapture}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Démarrer la capture</span>
                </button>
              )
            )}
          </>
        }
      />

      {(telemetryError || errorDetail || telemetry?.ipc_error || telemetry?.socket_error) && (
        <ErrorState
          message={
            errorDetail ||
            telemetry?.ipc_error ||
            telemetry?.socket_error ||
            telemetryError ||
            'Erreur télémétrie'
          }
          onRetry={onRefreshTelemetry}
        />
      )}

      {/* 1. État du moteur & Contrôle de capture */}
      <SectionCard
        title="État du moteur et contrôle de capture"
        actions={<StatusBadge state={engineBadge.state} label={engineBadge.label} />}
      >
        {telemetry === null ? (
          <EmptyState
            title="Télémétrie du moteur indisponible"
            description="Les informations du moteur de capture n'ont pas pu être récupérées depuis le serveur."
          />
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Version du moteur</dt>
              <dd className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100">
                {telemetry.engine_version || 'Non disponible'}
              </dd>
            </div>
            <div className="p-3 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Mode de capture</dt>
              <dd className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100">
                {telemetry.capture_mode || 'Non disponible'}
              </dd>
            </div>
            <div className="p-3 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Interface d&apos;écoute active</dt>
              <dd className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100">
                {telemetry.active_interface || 'Aucune interface active'}
              </dd>
            </div>
            <div className="p-3 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Dernier fichier traité</dt>
              <dd className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100 truncate" title={telemetry.last_capture_file || undefined}>
                {telemetry.last_capture_file || 'Aucun'}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>

      {/* 2. Import PCAP & 3. Statistiques réseau */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SectionCard
          title="Import PCAP"
          description="Analyser un fichier .pcap ou .pcapng local ou présent sur le serveur"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label
                htmlFor="pcap-upload-input"
                className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                <span>Téléverser un fichier depuis ce poste (.pcap, .pcapng, .cap)</span>
                <HelpTooltip
                  title="Import PCAP navigateur"
                  description="Le fichier est transmis au serveur puis décodé par le binaire openndr-engine et supprimé après lecture."
                  align="left"
                />
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pcap,.pcapng,.cap"
                onChange={handleFileUpload}
                disabled={!canManageCapture || isIngesting}
                className="hidden"
                id="pcap-upload-input"
              />
              <label
                htmlFor="pcap-upload-input"
                className={`w-full px-4 py-2.5 rounded-md border border-dashed flex items-center justify-center gap-2 font-medium transition-colors ${
                  canManageCapture && !isIngesting
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer'
                    : 'border-gray-300 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318] text-gray-400 cursor-not-allowed'
                }`}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>
                  {isIngesting
                    ? 'Analyse en cours...'
                    : canManageCapture
                    ? 'Sélectionner un fichier PCAP'
                    : 'Droit interfaces:manage requis'}
                </span>
              </label>
            </div>

            <form onSubmit={handleIngestServerFile} className="space-y-1.5">
              <label
                htmlFor="server-pcap-path"
                className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300"
              >
                <span>Chemin d&apos;un fichier sur le serveur</span>
                <HelpTooltip
                  title="Chemin serveur"
                  description="Chemin absolu d'une capture existante sur l'hôte (la traversée de répertoire .. est refusée)."
                  align="left"
                />
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <FolderOpen className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="server-pcap-path"
                    type="text"
                    value={serverPathInput}
                    onChange={(e) => setServerPathInput(e.target.value)}
                    placeholder="/chemin/vers/fichier.pcap"
                    disabled={!canManageCapture || isIngesting}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-xs font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!canManageCapture || isIngesting || !serverPathInput.trim()}
                  className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Analyser
                </button>
              </div>
            </form>

            {lastIngestion && (
              <div className="p-3 rounded-md border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 space-y-1">
                <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-medium">
                  <span className="flex items-center gap-1.5 truncate">
                    <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-mono">{lastIngestion.file_path}</span>
                  </span>
                  <span className="font-mono tabular-nums shrink-0 ml-2">
                    {lastIngestion.packets_processed} paquets
                  </span>
                </div>
                <div className="text-gray-600 dark:text-gray-400 font-mono tabular-nums flex flex-wrap gap-2">
                  <span>Taille : {formatBytes(lastIngestion.file_size_bytes)}</span>
                  <span>·</span>
                  <span>Volume utile : {formatBytes(lastIngestion.bytes_processed)}</span>
                  <span>·</span>
                  <span>Durée : {lastIngestion.duration_seconds.toFixed(3)} s</span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Statistiques réseau"
          description="Compteurs réels et répartition protocolaire L2–L4"
        >
          {!hasCapturedData ? (
            <EmptyState
              title="Aucune donnée de capture disponible"
              description="Démarrez une capture passive ou importez un fichier PCAP pour afficher les débits, pertes et protocoles."
            />
          ) : (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                <div className="p-2.5 rounded border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                  <div className="font-sans text-gray-500 dark:text-gray-400">Débit</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {telemetry?.current_mbps !== null && telemetry?.current_mbps !== undefined
                      ? `${telemetry.current_mbps.toFixed(3)} Mbps`
                      : 'Non disponible'}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                  <div className="font-sans text-gray-500 dark:text-gray-400">Reçus</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {lastIngestion
                      ? lastIngestion.packets_processed.toLocaleString('fr-FR')
                      : telemetry?.packets_received !== null && telemetry?.packets_received !== undefined
                      ? telemetry.packets_received.toLocaleString('fr-FR')
                      : 'Non disponible'}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                  <div className="font-sans text-gray-500 dark:text-gray-400">Pertes</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {telemetry?.packets_dropped !== null && telemetry?.packets_dropped !== undefined
                      ? telemetry.packets_dropped.toLocaleString('fr-FR')
                      : 'Non disponible'}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                  <div className="font-sans text-gray-500 dark:text-gray-400">Volume</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {lastIngestion
                      ? formatBytes(lastIngestion.bytes_processed)
                      : telemetry?.bytes_processed !== null && telemetry?.bytes_processed !== undefined
                      ? formatBytes(telemetry.bytes_processed)
                      : 'Non disponible'}
                  </div>
                </div>
              </div>

              {stats ? (
                <>
                  <div className="space-y-2.5">
                    {protocolBreakdown.map((row) => {
                      const pct = Math.round((row.count / totalTransportOrL2) * 100);
                      return (
                        <div key={row.label} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{row.label}</span>
                            <span className="font-mono tabular-nums text-gray-600 dark:text-gray-400">
                              {row.count.toLocaleString('fr-FR')} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-[#2c313a] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 dark:bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-[#2c313a] flex flex-wrap gap-3 font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    <span>IPv4 : {stats.ipv4_packets.toLocaleString('fr-FR')}</span>
                    <span>IPv6 : {stats.ipv6_packets.toLocaleString('fr-FR')}</span>
                    <span>VLAN 802.1Q : {stats.vlan_packets.toLocaleString('fr-FR')}</span>
                  </div>
                </>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  Répartition protocolaire non disponible pour cette session.
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 4. Exploration des paquets */}
      <SectionCard
        title="Exploration des paquets"
        description={`${filteredPackets.length} trame(s) affichée(s)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] rounded-md">
              {['ALL', 'TCP', 'UDP', 'ICMP', 'ARP', 'VLAN'].map((proto) => (
                <button
                  key={proto}
                  type="button"
                  onClick={() => setProtocolFilter(proto)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    protocolFilter === proto
                      ? 'bg-white dark:bg-[#1f2329] text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {proto === 'ALL' ? 'Tous' : proto}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer IP, MAC, port..."
                className="pl-8 pr-3 py-1.5 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        }
        noPadding={filteredPackets.length > 0}
      >
        {filteredPackets.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Aucune donnée de capture disponible"
            description="Aucun paquet décodé à afficher. Lancez une capture passive ou importez un fichier PCAP pour inspecter les trames."
          />
        ) : (
          <DataTable>
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318] text-gray-500 dark:text-gray-400">
                <th className="py-2.5 px-4 font-medium">Horodatage</th>
                <th className="py-2.5 px-4 font-medium">Protocole</th>
                <th className="py-2.5 px-4 font-medium">VLAN</th>
                <th className="py-2.5 px-4 font-medium">Source</th>
                <th className="py-2.5 px-4 font-medium">Destination</th>
                <th className="py-2.5 px-4 font-medium">Drapeaux</th>
                <th className="py-2.5 px-4 font-medium text-right">Taille</th>
                <th className="py-2.5 px-4 font-medium">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2c313a] font-mono tabular-nums">
              {filteredPackets.map((pkt, idx) => {
                const srcAddr = pkt.src_ip
                  ? pkt.src_port !== null
                    ? `${pkt.src_ip}:${pkt.src_port}`
                    : pkt.src_ip
                  : pkt.src_mac;
                const dstAddr = pkt.dst_ip
                  ? pkt.dst_port !== null
                    ? `${pkt.dst_ip}:${pkt.dst_port}`
                    : pkt.dst_ip
                  : pkt.dst_mac;
                return (
                  <tr key={`${pkt.timestamp_us}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-[#1f2329]">
                    <td className="py-2 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatTimestampUs(pkt.timestamp_us)}
                    </td>
                    <td className="py-2 px-4 text-blue-700 dark:text-blue-400 font-medium whitespace-nowrap">
                      {pkt.protocol}
                    </td>
                    <td className="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {pkt.vlan_id !== null ? pkt.vlan_id : '-'}
                    </td>
                    <td className="py-2 px-4 text-gray-900 dark:text-gray-100 whitespace-nowrap" title={pkt.src_mac}>
                      {srcAddr}
                    </td>
                    <td className="py-2 px-4 text-gray-900 dark:text-gray-100 whitespace-nowrap" title={pkt.dst_mac}>
                      {dstAddr}
                    </td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {pkt.tcp_flags || '-'}
                    </td>
                    <td className="py-2 px-4 text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">
                      {pkt.raw_len} o
                    </td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-400 font-sans max-w-xs truncate" title={pkt.info}>
                      {pkt.info}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </SectionCard>

      <ConfirmDialog
        isOpen={confirmStopOpen}
        title="Arrêter la capture passive ?"
        message="L'écoute réseau sur l'interface dédiée sera interrompue jusqu'à sa réactivation manuelle."
        confirmLabel="Arrêter la capture"
        variant="danger"
        isBusy={isActionLoading}
        onConfirm={handleStopCapture}
        onCancel={() => setConfirmStopOpen(false)}
      />
    </PageContainer>
  );
};
