export type EngineOperationalStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'STOPPED'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export interface SystemService {
  name: string;
  unit: string;
  status:
    | 'active'
    | 'ready'
    | 'stopped'
    | 'failed'
    | 'ACTIVE'
    | 'INACTIVE'
    | 'FAILED'
    | 'NOT_FOUND'
    | 'UNKNOWN';
  description: string;
  pid?: number;
  main_pid?: number | null;
  memoryMb?: number;
  cpuPct?: number;
  uptimeSeconds?: number;
}

export interface NetworkInterfaceConfig {
  name: string;
  role: 'ADMINISTRATION' | 'CAPTURE_PASSIVE' | 'LOOPBACK' | 'MONITOR';
  ipAddress: string | null;
  macAddress: string | null;
  isPromiscuous: boolean;
  isUp: boolean;
  mtu: number | null;
  speedMbps: number | null;
  rxPackets?: number | null;
  txPackets?: number | null;
  rxBytes?: number | null;
  txBytes?: number | null;
  rxDropped: number | null;
  isStealthCompliant: boolean;
  complianceReason?: string;
  operstate?: string;
  isPhysical?: boolean;
  ipv4Addresses?: string[];
  ipv6Addresses?: string[];
}

export interface IsolationCheckResult {
  interface: string;
  status: string;
  validation_result?: string;
  is_isolated: boolean;
  has_ip: boolean;
  has_routes: boolean;
  is_promiscuous: boolean;
  details: string;
  expected_config?: {
    admin_interface: string;
    capture_interface: string;
    require_distinct_from_admin: boolean;
    require_no_ip: boolean;
    require_no_routes: boolean;
    require_promiscuous: boolean;
    require_link_up: boolean;
  };
  observed_state?: {
    interface_exists: boolean;
    is_same_as_admin: boolean;
    ipv4_addresses: string[];
    ipv6_addresses: string[];
    routes: string[];
    is_up: boolean;
    operstate: string;
    is_promiscuous: boolean;
    capture_ready: boolean;
  };
}

export interface StorageMetrics {
  pcapDirectory: string;
  maxStorageGb: number;
  usedStorageGb: number | null;
  usedStoragePercent?: number | null;
  retentionDays: number;
  maxFileDurationMin?: number;
  pcapFilesCount?: number | null;
  status?: string;
  isWritable?: boolean;
  writeError?: string | null;
  integrityCheckEnabled: boolean;
  filesystem?: {
    mount_point: string;
    total_gb: number | null;
    used_gb: number | null;
    free_gb: number | null;
    used_pct: number | null;
    error?: string | null;
  };
  pcap_storage?: {
    directory: string;
    status: string;
    is_writable: boolean;
    write_error?: string | null;
    used_bytes: number | null;
    used_gb: number | null;
    file_count: number | null;
    quota_gb: number;
    remaining_quota_gb: number | null;
    quota_used_pct: number | null;
    retention_days: number;
  };
}

export interface PlatformHealth {
  status: string;
  version: string;
  target_platform: string;
  database: { connected?: boolean; status: string; details?: string };
  capture_engine: {
    engine_status?: EngineOperationalStatus;
    service_status?: string | null;
    version?: string | null;
    mode?: string | null;
    ipc_socket?: string;
    binary_present?: boolean;
    socket_ready?: boolean;
    socket_present?: boolean;
    ipc_reachable?: boolean;
    ipc_error?: string | null;
    capture_active?: boolean;
    active_interface?: string | null;
    packets_received?: number | null;
    status?: string;
    notice?: string;
  };
  timestamp: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: string | null;
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
  engine_version: string | null;
  engine_status?: EngineOperationalStatus;
  service_status?: string | null;
  binary_present?: boolean;
  socket_present?: boolean;
  ipc_reachable?: boolean;
  ipc_error?: string | null;
  is_running: boolean;
  capture_mode: string | null;
  active_interface: string | null;
  packets_received: number | null;
  packets_dropped: number | null;
  bytes_processed: number | null;
  current_mbps: number | null;
  ring_buffer_usage_pct: number | null;
  protocol_stats: ProtocolStats | null;
  last_capture_file: string | null;
  recent_packets?: PacketSummary[];
  socket_error?: string | null;
  error?: string | null;
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

export interface SystemUpdateEvent {
  id: string;
  timestamp: string;
  trigger: 'MANUAL_CHECK' | 'FORCE_UPDATE' | 'BACKGROUND_AUTO';
  from_version: string;
  to_version: string;
  status: 'SUCCESS' | 'UP_TO_DATE' | 'FAILED';
  details: string;
}

export interface SystemUpdateState {
  current_version: string;
  available_version: string;
  release_date: string | null;
  last_checked_at: string | null;
  last_updated_at: string | null;
  next_scheduled_check_at: string | null;
  auto_update_enabled: boolean;
  check_interval_minutes: number;
  background_worker_active: boolean;
  update_available: boolean;
  build_revision: number;
  channel: string;
  status: 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'INSTALLING' | 'UPDATED';
  release_notes: string;
  engine_integrity_ok: boolean;
  history: SystemUpdateEvent[];
}
