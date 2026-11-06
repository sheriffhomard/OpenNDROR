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
