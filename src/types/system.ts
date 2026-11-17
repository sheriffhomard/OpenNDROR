export interface SystemService {
  name: string;
  unit: string;
  status: 'active' | 'ready' | 'stopped' | 'failed';
  description: string;
  pid?: number;
  memoryMb?: number;
  cpuPct?: number;
  uptimeSeconds?: number;
}

export interface NetworkInterfaceConfig {
  name: string;
  role: 'ADMINISTRATION' | 'CAPTURE_PASSIVE';
  ipAddress: string | null;
  macAddress: string;
  isPromiscuous: boolean;
  isUp: boolean;
  mtu: number;
  speedMbps: number;
  rxPackets: number;
  txPackets: number;
  rxBytes: number;
  txBytes: number;
  rxDropped: number;
  isStealthCompliant: boolean;
  complianceReason?: string;
}

export interface StorageMetrics {
  pcapDirectory: string;
  maxStorageGb: number;
  usedStorageGb: number;
  retentionDays: number;
  maxFileDurationMin: number;
  integrityCheckEnabled: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILURE';
  details: Record<string, unknown>;
  ipAddress: string;
}

export interface ValidationTestItem {
  id: string;
  category: 'ARCH' | 'SECURITY' | 'NETWORK' | 'DATABASE' | 'SYSTEMD';
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  details?: string;
  durationMs?: number;
}

export interface ProtocolStats {
  tcp_packets: number;
  udp_packets: number;
  icmp_packets: number;
  arp_packets: number;
  ipv4_packets: number;
  ipv6_packets: number;
  vlan_packets: number;
  other_packets: number;
}

export interface PacketSummary {
  timestamp_us: number;
  raw_len: number;
  protocol: string;
  vlan_id: number | null;
  src_mac: string;
  dst_mac: string;
  src_ip: string | null;
  dst_ip: string | null;
  src_port: number | null;
  dst_port: number | null;
  tcp_flags: string | null;
  info: string;
}

export interface EngineTelemetry {
  engine_version: string;
  is_running: boolean;
  capture_mode: string;
  active_interface: string | null;
  packets_received: number;
  packets_dropped: number;
  bytes_processed: number;
  current_mbps: number;
  ring_buffer_usage_pct: number;
  protocol_stats: ProtocolStats;
  last_capture_file: string | null;
  recent_packets?: PacketSummary[];
  socket_error?: string;
}

export interface PcapIngestionResult {
  file_path: string;
  file_size_bytes: number;
  packets_processed: number;
  bytes_processed: number;
  duration_seconds: number;
  protocol_stats: ProtocolStats;
  first_packet_timestamp?: number | null;
  last_packet_timestamp?: number | null;
  packet_summaries: PacketSummary[];
}
