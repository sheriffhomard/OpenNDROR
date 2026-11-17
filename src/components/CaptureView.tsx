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
import { HelpTooltip } from './HelpTooltip';

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
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimestampUs(us: number): string {
  if (!us || us <= 0) return '-';
  const date = new Date(Math.floor(us / 1000));
  const msPart = String(Math.floor((us % 1000000) / 1000)).padStart(3, '0');
  return `${date.toLocaleTimeString('en-US', { hour12: false })}.${msPart}`;
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
    { label: 'TCP', count: stats.tcp_packets, barClass: 'bg-sky-500', tip: 'Connection-oriented transport traffic (HTTP, SSH, TLS, databases).' },
    { label: 'UDP', count: stats.udp_packets, barClass: 'bg-emerald-500', tip: 'Connectionless fast transport traffic (DNS, DHCP, NTP, streaming).' },
    { label: 'ICMP (v4/v6)', count: stats.icmp_packets, barClass: 'bg-amber-500', tip: 'Network diagnostic and control packets such as ping and unreachable notices.' },
    { label: 'ARP', count: stats.arp_packets, barClass: 'bg-violet-500', tip: 'Local Layer 2 address resolution mapping IP addresses to MAC addresses.' },
    { label: 'Other L2/L3', count: stats.other_packets, barClass: 'bg-slate-500', tip: 'Unclassified Ethernet or Layer 3 control frames.' },
  ];

  const handleToggleCapture = async () => {
    if (!canManageCapture) return;
    setIsActionLoading(true);
    setErrorDetail(null);
    try {
      if (isRunning) {
        const res = await apiService.stopCapture();
        onNotify('success', res.message || 'Passive capture stopped');
      } else {
        const res = await apiService.startCapture();
        onNotify('success', res.message || 'AF_PACKET passive capture started');
      }
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Engine command error';
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
      onNotify('success', `${res.packets_processed} packet(s) decoded from ${res.file_path}`);
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PCAP ingestion failed';
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
      onNotify('success', `Trace ${file.name} analyzed (${res.packets_processed} packets)`);
      await onRefreshTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error analyzing PCAP file';
      setErrorDetail(msg);
      onNotify('error', msg);
    } finally {
      setIsIngesting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Capture Engine V0.2 Control Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Passive Capture Engine &amp; L2–L4 Decoding
              </h2>
              <HelpTooltip
                title="Capture & L2–L4 Engine"
                description="Controls the native Rust packet engine. You can start passive live listening on eth1 or upload saved .pcap/.pcapng traces for immediate inspection."
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                Version {telemetry?.engine_version || '0.2.0'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
              <span className={`text-xs font-mono font-medium ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isRunning ? `ACTIVE (${captureMode})` : 'STANDBY'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Interface: {telemetry?.active_interface || 'eth1 (passive)'}</span>
              <span aria-hidden="true">·</span>
              <span>Pipeline: Ethernet II / 802.1Q / IPv4 / IPv6 / ARP / ICMP / TCP / UDP</span>
              {telemetry?.last_capture_file && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-md" title={telemetry.last_capture_file}>
                    Last file: {telemetry.last_capture_file}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onRefreshTelemetry()}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>

            {canManageCapture && (
              <button
                type="button"
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
                    Stop capture
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Start capture
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {(errorDetail || telemetry?.socket_error) && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-slate-950 border border-amber-300 dark:border-slate-800 rounded-lg text-xs text-amber-800 dark:text-slate-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{errorDetail || telemetry?.socket_error}</span>
          </div>
        )}
      </div>

      {/* Real-time KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Instant Throughput</span>
            <HelpTooltip title="Live Bitrate (Mbps)" description="Current network speed passing through the capture engine measured over a 1-second sliding window." />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {(telemetry?.current_mbps ?? 0).toFixed(3)} Mbps
          </div>
          <div className="mt-1.5 text-xs text-slate-500">1s sliding window measurement</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Captured Packets / Drops</span>
            <HelpTooltip title="Packet Counter & Kernel Drops" description="Total packets read versus packets dropped if the Linux ring buffer fills faster than disk writes." />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {(telemetry?.packets_received ?? 0).toLocaleString('en-US')}
            <span className="text-slate-500 text-sm font-normal">
              {' / '}
              {(telemetry?.packets_dropped ?? 0).toLocaleString('en-US')} drop
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Kernel PACKET_STATISTICS counter</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Processed Frame Volume</span>
            <HelpTooltip title="Total Bytes Decoded" description="Cumulative size of all Ethernet frames decoded by the Rust engine or ingested from PCAP traces." />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatBytes(telemetry?.bytes_processed ?? 0)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Local rotating PCAP storage</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
            <span>Ring Buffer Saturation</span>
            <HelpTooltip title="TPACKET_V2 Ring Usage" description="Percentage of shared kernel memory currently queued for processing. Under 80% indicates healthy zero-drop capture." />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400">
            {(telemetry?.ring_buffer_usage_pct ?? 0).toFixed(1)} %
          </div>
          <div className="mt-1.5 text-xs text-slate-500">Zero-copy TPACKET_V2 mmap ring</div>
        </div>
      </div>

      {/* L2-L4 Protocol Breakdown & PCAP/PCAPNG Ingestion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>L2–L4 Protocol Breakdown</span>
              <HelpTooltip title="Protocol Distribution" description="Shows how your analyzed traffic breaks down across Layer 2 (ARP, VLAN), Layer 3 (IPv4, IPv6, ICMP), and Layer 4 (TCP, UDP)." />
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
              <span>IPv4: {stats.ipv4_packets.toLocaleString('en-US')}</span>
              <span aria-hidden="true">·</span>
              <span>IPv6: {stats.ipv6_packets.toLocaleString('en-US')}</span>
              <span aria-hidden="true">·</span>
              <span>VLAN 802.1Q: {stats.vlan_packets.toLocaleString('en-US')}</span>
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
                    <span className="text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1">
                      <span>{row.label}</span>
                      <HelpTooltip title={row.label} description={row.tip} align="left" />
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {row.count.toLocaleString('en-US')} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${row.barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PCAP / PCAPNG File Ingestion & Analysis */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>PCAP / PCAPNG Trace Ingestion &amp; Decoding</span>
              <HelpTooltip title="Offline Trace Analysis" description="Upload a Wireshark/tcpdump capture file from your computer or enter an existing file path on the Debian server to decode packets." />
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Upload a local network capture file or specify a server path to run the Rust L2–L4 parser.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Browser Upload (.pcap / .pcapng / .cap)</span>
                <HelpTooltip title="Upload Local Capture File" description="Pick a packet trace file from your device. It is parsed once by openndr-engine and temporary files are immediately deleted." align="left" />
              </div>
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
                    ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 cursor-pointer'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>
                  {isIngesting
                    ? 'Running Rust L2–L4 analysis...'
                    : canManageCapture
                    ? 'Upload a .pcap or .pcapng trace'
                    : 'interfaces:manage permission required to ingest a trace'}
                </span>
              </label>
            </div>

            <form onSubmit={handleIngestServerFile} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Server Trace File Path</span>
                <HelpTooltip title="Server File Ingestion" description="Full local filesystem path on the sensor host (for example /var/lib/openndr/captures/trace.pcap). Directory traversal (..) is blocked." align="left" />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <FolderOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serverPathInput}
                    onChange={(e) => setServerPathInput(e.target.value)}
                    placeholder="/var/lib/openndr/captures/trace.pcap"
                    disabled={!canManageCapture || isIngesting}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!canManageCapture || isIngesting || !serverPathInput.trim()}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white dark:text-slate-100 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Analyze path
                </button>
              </div>
            </form>
          </div>

          {lastIngestion && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5 truncate">
                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{lastIngestion.file_path}</span>
                </span>
                <span className="font-mono tabular-nums shrink-0 ml-2">
                  {lastIngestion.packets_processed} packets
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                <span>Size: {formatBytes(lastIngestion.file_size_bytes)}</span>
                <span aria-hidden="true">·</span>
                <span>Payload: {formatBytes(lastIngestion.bytes_processed)}</span>
                <span aria-hidden="true">·</span>
                <span>Trace duration: {lastIngestion.duration_seconds.toFixed(3)} s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decoded L2-L4 Packet Inspector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Decoded L2–L4 Frame Inspector</span>
              <HelpTooltip title="Packet Table Inspector" description="Displays individual decoded frames from live telemetry or uploaded PCAPs, including MAC/IP endpoints, VLAN tags, and TCP flags." />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredPackets.length} frame(s) extracted by the Rust decoder
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              {['ALL', 'TCP', 'UDP', 'ICMP', 'ARP', 'VLAN'].map((proto) => (
                <button
                  key={proto}
                  type="button"
                  onClick={() => setProtocolFilter(proto)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    protocolFilter === proto
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {proto === 'ALL' ? 'All' : proto}
                </button>
              ))}
            </div>

            <div className="relative flex items-center gap-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter IP, MAC, port..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
              <HelpTooltip title="Search Packets" description="Filter visible packets instantly by IP address, MAC address, port number, or protocol summary text." align="right" />
            </div>
          </div>
        </div>

        {filteredPackets.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-lg space-y-2">
            <Layers className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto" />
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              No decoded frames to display
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              OpenNDR never injects simulated traffic. Upload a .pcap/.pcapng file or start passive capture on the listening interface.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Timestamp</th>
                  <th className="py-2.5 px-3 font-medium">Protocol</th>
                  <th className="py-2.5 px-3 font-medium">VLAN</th>
                  <th className="py-2.5 px-3 font-medium">Source</th>
                  <th className="py-2.5 px-3 font-medium">Destination</th>
                  <th className="py-2.5 px-3 font-medium">Flags</th>
                  <th className="py-2.5 px-3 font-medium text-right">Length</th>
                  <th className="py-2.5 px-3 font-medium">L2–L4 Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-xs font-mono tabular-nums">
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
                    <tr key={`${pkt.timestamp_us}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatTimestampUs(pkt.timestamp_us)}
                      </td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                        {pkt.protocol}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {pkt.vlan_id !== null ? pkt.vlan_id : '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-900 dark:text-slate-200 whitespace-nowrap" title={pkt.src_mac}>
                        {srcAddr}
                      </td>
                      <td className="py-2 px-3 text-slate-900 dark:text-slate-200 whitespace-nowrap" title={pkt.dst_mac}>
                        {dstAddr}
                      </td>
                      <td className="py-2 px-3 text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        {pkt.tcp_flags || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                        {pkt.raw_len} B
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-sans max-w-xs truncate" title={pkt.info}>
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
