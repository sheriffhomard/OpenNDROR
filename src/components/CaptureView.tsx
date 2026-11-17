import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Upload,
  FolderOpen,
  Search,
  AlertCircle,
  FileCheck2,
  Layers,
} from 'lucide-react';
import { EngineTelemetry, PacketSummary, PcapIngestionResult, ProtocolStats } from '../types/system';
import { apiService } from '../services/api';

interface CaptureViewProps {
  telemetry: EngineTelemetry | null;
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
  canManageCapture,
  onRefreshTelemetry,
  onNotify,
}) => {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [serverPathInput, setServerPathInput] = useState('');
  const [lastIngestion, setLastIngestion] = useState<PcapIngestionResult | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isRunning = telemetry?.is_running ?? false;
  const captureMode = telemetry?.capture_mode || 'STANDBY';
  const stats = telemetry?.protocol_stats || EMPTY_PROTOCOL_STATS;

  // Fusionne les paquets de la dernière trace ingérée et les paquets temps réel du moteur
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

  const totalTransportOrL2 = Math.max(
    1,
    stats.tcp_packets + stats.udp_packets + stats.icmp_packets + stats.arp_packets + stats.other_packets
  );

  const protocolBreakdown = [
    { label: 'TCP', count: stats.tcp_packets, barClass: 'bg-sky-500' },
    { label: 'UDP', count: stats.udp_packets, barClass: 'bg-emerald-500' },
    { label: 'ICMP (v4/v6)', count: stats.icmp_packets, barClass: 'bg-amber-500' },
    { label: 'ARP', count: stats.arp_packets, barClass: 'bg-violet-500' },
    { label: 'Autres L2/L3', count: stats.other_packets, barClass: 'bg-slate-500' },
  ];

  const handleToggleCapture = async () => {
    if (!canManageCapture) return;
    setIsActionLoading(true);
    setErrorDetail(null);
    try {
      if (isRunning) {
        const res = await apiService.stopCapture();
        onNotify('success', res.message || 'Capture passive arrêtée');
      } else {
        const res = await apiService.startCapture();
        onNotify('success', res.message || 'Capture passive AF_PACKET démarrée');
      }
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de commande moteur';
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsActionLoading(false);
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
      const msg = err instanceof Error ? err.message : "Échec de l'ingestion PCAP";
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
      onNotify('success', `Trace ${file.name} analysée (${res.packets_processed} paquets)`);
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse du fichier PCAP";
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsIngesting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de contrôle Capture Engine V0.2 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                Moteur de Capture Passive & Décodage L2–L4
              </h2>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs font-mono text-slate-300">
                Version {telemetry?.engine_version || '0.2.0'}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className={`text-xs font-mono font-medium ${isRunning ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isRunning ? `ACTIF (${captureMode})` : 'EN VEILLE (STANDBY)'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Interface : {telemetry?.active_interface || 'eth1 (passive)'}</span>
              <span aria-hidden="true">·</span>
              <span>Pipeline : Ethernet II / 802.1Q / IPv4 / IPv6 / ARP / ICMP / TCP / UDP</span>
              {telemetry?.last_capture_file && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-300 truncate max-w-md" title={telemetry.last_capture_file}>
                    Dernier fichier : {telemetry.last_capture_file}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onRefreshTelemetry()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>

            {canManageCapture && (
              <button
                onClick={handleToggleCapture}
                disabled={isActionLoading}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  isRunning
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                } disabled:opacity-50`}
              >
                {isRunning ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Arrêter capture
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Démarrer capture
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {(errorDetail || telemetry?.socket_error) && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{errorDetail || telemetry?.socket_error}</span>
          </div>
        )}
      </div>

      {/* KPIs temps réel (valeurs strictement réelles, tabular-nums) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Débit instantané</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-100">
            {(telemetry?.current_mbps ?? 0).toFixed(3)} Mbps
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Mesure fenêtre glissante 1s
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Paquets capturés / Pertes</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
            {(telemetry?.packets_received ?? 0).toLocaleString('fr-FR')}
            <span className="text-slate-500 text-sm font-normal">
              {' / '}
              {(telemetry?.packets_dropped ?? 0).toLocaleString('fr-FR')} drop
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Compteur noyau PACKET_STATISTICS
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Volume de trames traité</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-100">
            {formatBytes(telemetry?.bytes_processed ?? 0)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Stockage PCAP rotatif local
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Saturation Ring Buffer</div>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-400">
            {(telemetry?.ring_buffer_usage_pct ?? 0).toFixed(1)} %
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Anneau mmap zero-copy TPACKET_V2
          </div>
        </div>
      </div>

      {/* Répartition protocolaire L2-L4 & Ingestion PCAP/PCAPNG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Répartition L2-L4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Répartition Protocolaire L2–L4</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 font-mono tabular-nums">
              <span>IPv4 : {stats.ipv4_packets.toLocaleString('fr-FR')}</span>
              <span aria-hidden="true">·</span>
              <span>IPv6 : {stats.ipv6_packets.toLocaleString('fr-FR')}</span>
              <span aria-hidden="true">·</span>
              <span>VLAN 802.1Q : {stats.vlan_packets.toLocaleString('fr-FR')}</span>
            </div>
          </div>

          <div className="space-y-3">
            {protocolBreakdown.map((row) => {
              const pct = stats.tcp_packets + stats.udp_packets + stats.icmp_packets + stats.arp_packets + stats.other_packets > 0
                ? Math.round((row.count / totalTransportOrL2) * 100)
                : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{row.label}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {row.count.toLocaleString('fr-FR')} ({pct} %)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${row.barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ingestion & Analyse de fichiers PCAP / PCAPNG */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Ingestion & Décodage de Traces PCAP / PCAPNG</h3>
            <p className="text-xs text-slate-400 mt-1">
              Chargez un fichier réseau local ou indiquez un chemin serveur pour exécuter le parseur Rust L2–L4.
            </p>
          </div>

          <div className="space-y-3">
            {/* Upload direct fichier PCAP/PCAPNG */}
            <div>
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
                className={`w-full px-4 py-2.5 rounded-lg border border-dashed text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                  canManageCapture && !isIngesting
                    ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40 cursor-pointer'
                    : 'border-slate-700 bg-slate-950 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>
                  {isIngesting
                    ? 'Analyse Rust L2–L4 en cours...'
                    : canManageCapture
                    ? 'Importer une trace .pcap ou .pcapng'
                    : 'Permission interfaces:manage requise pour ingérer une trace'}
                </span>
              </label>
            </div>

            {/* Ingestion par chemin serveur */}
            <form onSubmit={handleIngestServerFile} className="flex items-center gap-2">
              <div className="relative flex-1">
                <FolderOpen className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={serverPathInput}
                  onChange={(e) => setServerPathInput(e.target.value)}
                  placeholder="/var/lib/openndr/captures/trace.pcap"
                  disabled={!canManageCapture || isIngesting}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
              <button
                type="submit"
                disabled={!canManageCapture || isIngesting || !serverPathInput.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Analyser chemin
              </button>
            </form>
          </div>

          {lastIngestion && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5 truncate">
                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{lastIngestion.file_path}</span>
                </span>
                <span className="font-mono tabular-nums shrink-0 ml-2">
                  {lastIngestion.packets_processed} paquets
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono tabular-nums">
                <span>Taille : {formatBytes(lastIngestion.file_size_bytes)}</span>
                <span aria-hidden="true">·</span>
                <span>Charge utile : {formatBytes(lastIngestion.bytes_processed)}</span>
                <span aria-hidden="true">·</span>
                <span>Durée trace : {lastIngestion.duration_seconds.toFixed(3)} s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inspecteur de paquets décodés L2-L4 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Inspecteur de Trames Décodées L2–L4
            </h3>
            <p className="text-xs text-slate-400">
              Affichage des {filteredPackets.length} trame(s) extraite(s) par le décodeur Rust
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {['ALL', 'TCP', 'UDP', 'ICMP', 'ARP', 'VLAN'].map((proto) => (
                <button
                  key={proto}
                  onClick={() => setProtocolFilter(proto)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    protocolFilter === proto
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {proto === 'ALL' ? 'Tous' : proto}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer IP, MAC, port..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>
        </div>

        {filteredPackets.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-800 rounded-lg space-y-2">
            <Layers className="w-6 h-6 text-slate-500 mx-auto" />
            <div className="text-xs font-medium text-slate-300">
              Aucune trame décodée à afficher
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              OpenNDR n’injecte aucun trafic simulé. Importez un fichier .pcap/.pcapng ou démarrez la capture passive sur l’interface d’écoute.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-xs text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Horodatage</th>
                  <th className="py-2.5 px-3 font-medium">Protocole</th>
                  <th className="py-2.5 px-3 font-medium">VLAN</th>
                  <th className="py-2.5 px-3 font-medium">Source</th>
                  <th className="py-2.5 px-3 font-medium">Destination</th>
                  <th className="py-2.5 px-3 font-medium">Flags</th>
                  <th className="py-2.5 px-3 font-medium text-right">Taille</th>
                  <th className="py-2.5 px-3 font-medium">Détail L2–L4</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
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
                    <tr key={`${pkt.timestamp_us}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {formatTimestampUs(pkt.timestamp_us)}
                      </td>
                      <td className="py-2 px-3 text-emerald-400 font-medium whitespace-nowrap">
                        {pkt.protocol}
                      </td>
                      <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                        {pkt.vlan_id !== null ? pkt.vlan_id : '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-200 whitespace-nowrap" title={pkt.src_mac}>
                        {srcAddr}
                      </td>
                      <td className="py-2 px-3 text-slate-200 whitespace-nowrap" title={pkt.dst_mac}>
                        {dstAddr}
                      </td>
                      <td className="py-2 px-3 text-sky-400 whitespace-nowrap">
                        {pkt.tcp_flags || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-300 text-right whitespace-nowrap">
                        {pkt.raw_len} o
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans max-w-xs truncate" title={pkt.info}>
                        {pkt.info}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
