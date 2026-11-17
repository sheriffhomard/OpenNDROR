import React from 'react';
import {
  Activity,
  HardDrive,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Radio,
  Server,
  Layers,
} from 'lucide-react';
import { SystemService, NetworkInterfaceConfig, StorageMetrics, EngineTelemetry } from '../types/system';

interface DashboardViewProps {
  services: SystemService[];
  interfaces: NetworkInterfaceConfig[];
  storage: StorageMetrics | null;
  telemetry?: EngineTelemetry | null;
  canManageSystem: boolean;
  onNavigateToCapture?: () => void;
  onNavigateToInterfaces: () => void;
  onNavigateToValidation: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  services,
  interfaces,
  storage,
  telemetry,
  onNavigateToCapture,
  onNavigateToInterfaces,
  onNavigateToValidation,
}) => {
  const passiveInterface = interfaces.find((i) => i.role === 'CAPTURE_PASSIVE');
  const adminInterface = interfaces.find((i) => i.role === 'ADMINISTRATION');
  const isPassiveCompliant = passiveInterface?.isStealthCompliant ?? true;
  const isCaptureRunning = telemetry?.is_running ?? false;
  const packetsReceived = telemetry?.packets_received ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Platform */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">OpenNDR Platform — Version V0.2</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-emerald-400 font-medium">
                {isCaptureRunning ? 'Passive Capture & L2–L4 Decoding Active' : 'L2–L4 Network Engine Operational'}
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Autonomous Network Detection and Response sensor for Debian 13.
              AF_PACKET (PACKET_MMAP) passive capture, PCAP/PCAPNG ingestion, hierarchical L2–L4 decoding, and rotating local PCAP storage.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToCapture && (
              <button
                onClick={onNavigateToCapture}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Capture & PCAP
              </button>
            )}
            <button
              onClick={onNavigateToValidation}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Run Validation
            </button>
          </div>
        </div>

        {/* Warning if stealth mode violated */}
        {!isPassiveCompliant && (
          <div className="mt-4 p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg flex items-start justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>CRITICAL SECURITY ALERT:</strong> The passive capture interface has an isolation violation (IP assigned).
              </span>
            </div>
            <button
              onClick={onNavigateToInterfaces}
              className="text-xs underline hover:text-white shrink-0 font-medium"
            >
              Inspect interface
            </button>
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Capture Engine Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Rust Network Engine V0.2</span>
            <Radio className={`w-4 h-4 ${isCaptureRunning ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className={`text-lg font-bold tracking-tight font-mono ${isCaptureRunning ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isCaptureRunning ? `ACTIVE (${telemetry?.capture_mode || 'AF_PACKET'})` : 'STANDBY (V0.2)'}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            Decoded packets: <span className="text-slate-200">{packetsReceived.toLocaleString('en-US')}</span>
            {telemetry && telemetry.current_mbps > 0 ? ` · ${telemetry.current_mbps.toFixed(2)} Mbps` : ''}
          </div>
        </div>

        {/* Card 2: Stealth Compliance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Stealth Compliance</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className={`text-lg font-bold tracking-tight font-mono ${isPassiveCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPassiveCompliant ? '100% STEALTH' : 'VIOLATION DETECTED'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            TX traffic: <span className="font-mono text-slate-300">0 frames (Zero IP)</span>
          </div>
        </div>

        {/* Card 3: Storage PCAP Quota */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Local PCAP Storage</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 tracking-tight font-mono">
            {storage ? `${storage.usedStorageGb} / ${storage.maxStorageGb} GB` : 'Local Quota'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Retention: <span className="text-slate-300">{storage ? `${storage.retentionDays} days` : '30 days'}</span> (Local disk)
          </div>
        </div>

        {/* Card 4: Platform Target */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Target Platform</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 tracking-tight font-mono">
            Debian 13 (Trixie)
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Architecture: <span className="text-slate-300 font-mono">systemd + PostgreSQL</span>
          </div>
        </div>
      </div>

      {/* Services Supervision */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">OpenNDR Services Supervision</h3>
            <p className="text-xs text-slate-400">Real-time systemd unit states</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">/etc/systemd/system/</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {services.map((service) => {
            const isActive = service.status === 'active';
            const isReady = service.status === 'ready';
            return (
              <div key={service.unit} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      isActive ? 'bg-emerald-500' : isReady ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{service.name}</span>
                      <span className="text-xs font-mono text-slate-500">{service.unit}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{service.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      isActive
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : isReady
                        ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                        : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                    }`}
                  >
                    {service.status.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Network Interfaces Quick Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin Interface */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">SOC Administration Interface</span>
            <span className="text-xs font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">ADMIN</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Interface name</span>
            <span className="font-mono text-slate-200">{adminInterface?.name || 'eth0'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Assigned IP address</span>
            <span className="font-mono text-slate-200">{adminInterface?.ipAddress || 'Configured for management'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Purpose</span>
            <span className="text-slate-300">Web HTTPS / FastAPI REST API</span>
          </div>
        </div>

        {/* Capture Interface */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Passive Capture Interface</span>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                isPassiveCompliant
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                  : 'text-rose-400 bg-rose-950/60 border-rose-800/40 font-bold'
              }`}
            >
              {isPassiveCompliant ? 'PASSIVE_STEALTH' : 'VIOLATION'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Interface name</span>
            <span className="font-mono text-slate-200">{passiveInterface?.name || 'eth1'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Assigned IP address</span>
            <span className="font-mono text-slate-200">
              {passiveInterface?.ipAddress || 'NONE (Stealth compliant)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Capture mode</span>
            <span className="text-slate-300">Strict promiscuous (SPAN mirror link)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
