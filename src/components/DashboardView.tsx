import React from 'react';
import {
  Activity,
  HardDrive,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { SystemService, NetworkInterfaceConfig, StorageMetrics, EngineTelemetry } from '../types/system';
import { HelpTooltip } from './HelpTooltip';

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                OpenNDR Platform — Version V0.2
              </span>
              <HelpTooltip
                title="OpenNDR Platform Status"
                description="Overview of your local network sensor. Shows whether the passive capture engine and host services are ready."
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {isCaptureRunning ? 'Passive Capture & L2–L4 Decoding Active' : 'L2–L4 Network Engine Operational'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Autonomous Network Detection and Response sensor for Debian 13.
              AF_PACKET (PACKET_MMAP) passive capture, PCAP/PCAPNG ingestion, hierarchical L2–L4 decoding, and rotating local PCAP storage.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToCapture && (
              <button
                type="button"
                onClick={onNavigateToCapture}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Capture &amp; PCAP
              </button>
            )}
            <button
              type="button"
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
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 rounded-lg flex items-start justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                <strong>CRITICAL SECURITY ALERT:</strong> The passive capture interface has an isolation violation (IP assigned).
              </span>
            </div>
            <button
              type="button"
              onClick={onNavigateToInterfaces}
              className="text-xs underline hover:text-rose-950 dark:hover:text-white shrink-0 font-medium"
            >
              Inspect interface
            </button>
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Capture Engine Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Rust Network Engine V0.2</span>
              <HelpTooltip
                title="Capture Engine State"
                description="STANDBY means the engine is ready to decode files or start live listening. ACTIVE means it is actively reading frames from the network port."
              />
            </span>
            <Radio className={`w-4 h-4 ${isCaptureRunning ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className={`text-lg font-bold tracking-tight font-mono ${isCaptureRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {isCaptureRunning ? `ACTIVE (${telemetry?.capture_mode || 'AF_PACKET'})` : 'STANDBY (V0.2)'}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Decoded packets:{' '}
            <span className="text-slate-900 dark:text-slate-200">{packetsReceived.toLocaleString('en-US')}</span>
            {telemetry && telemetry.current_mbps > 0 ? ` · ${telemetry.current_mbps.toFixed(2)} Mbps` : ''}
          </div>
        </div>

        {/* Card 2: Stealth Compliance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Stealth Compliance</span>
              <HelpTooltip
                title="Stealth Isolation"
                description="Ensures the capture network card has zero IP address so it listens silently without revealing itself on the monitored network."
              />
            </span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          <div className={`text-lg font-bold tracking-tight font-mono ${isPassiveCompliant ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isPassiveCompliant ? '100% STEALTH' : 'VIOLATION DETECTED'}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            TX traffic: <span className="font-mono text-slate-700 dark:text-slate-300">0 frames (Zero IP)</span>
          </div>
        </div>

        {/* Card 3: Storage PCAP Quota */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Local PCAP Storage</span>
              <HelpTooltip
                title="Local Disk Quota"
                description="Tracks how much local disk storage is used by rotated packet capture (.pcap) files and how many days old captures are retained."
              />
            </span>
            <HardDrive className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono tabular-nums">
            {storage ? `${storage.usedStorageGb} / ${storage.maxStorageGb} GB` : 'Local Quota'}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Retention: <span className="text-slate-700 dark:text-slate-300">{storage ? `${storage.retentionDays} days` : '30 days'}</span> (Local disk)
          </div>
        </div>

        {/* Card 4: Platform Target */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Target Platform</span>
              <HelpTooltip
                title="Host Operating System"
                description="OpenNDR is engineered natively for Debian 13 (Trixie) using systemd daemons and a local PostgreSQL database."
              />
            </span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
            Debian 13 (Trixie)
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Architecture: <span className="text-slate-700 dark:text-slate-300 font-mono">systemd + PostgreSQL</span>
          </div>
        </div>
      </div>

      {/* Services Supervision */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>OpenNDR Services Supervision</span>
              <HelpTooltip
                title="Systemd Services"
                description="Live state of the four core software components running on your server (API backend, Rust capture engine, PostgreSQL database, and Web console)."
              />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time systemd unit states</p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/etc/systemd/system/</span>
        </div>

        {services.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
            Sign in via <strong>SOC Sign In</strong> to inspect live systemd unit states.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
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
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">{service.name}</span>
                        <span className="text-xs font-mono text-slate-500">{service.unit}</span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{service.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                          : isReady
                          ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                          : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                      }`}
                    >
                      {service.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Network Interfaces Quick Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin Interface */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-300 flex items-center gap-1.5">
              <span>SOC Administration Interface</span>
              <HelpTooltip
                title="Administration Interface"
                description="Dedicated network port used exclusively by analysts to open this web console and REST API."
              />
            </span>
            <span className="text-xs font-mono text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800/40">
              ADMIN
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <span>Interface name</span>
              <HelpTooltip title="OS Interface Identifier" description="Linux network device name (such as eth0 or ens3) assigned to management traffic." />
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">{adminInterface?.name || 'eth0'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <span>Assigned IP address</span>
              <HelpTooltip title="Management IP" description="IPv4 address used to reach the console and API over HTTPS." />
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">{adminInterface?.ipAddress || 'Configured for management'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <span>Purpose</span>
              <HelpTooltip title="Port Role" description="Defines what traffic is allowed through this interface." />
            </span>
            <span className="text-slate-700 dark:text-slate-300">Web HTTPS / FastAPI REST API</span>
          </div>
        </div>

        {/* Capture Interface */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-300 flex items-center gap-1.5">
              <span>Passive Capture Interface</span>
              <HelpTooltip
                title="Passive Capture Interface"
                description="Dedicated port wired to a switch SPAN/mirror or optical TAP. It captures copies of network packets with zero outbound transmission."
              />
            </span>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                isPassiveCompliant
                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/40'
                  : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/40 font-bold'
              }`}
            >
              {isPassiveCompliant ? 'PASSIVE_STEALTH' : 'VIOLATION'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <span>Interface name</span>
              <HelpTooltip title="Capture Port Name" description="Linux interface name dedicated to receiving mirrored packets." />
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">{passiveInterface?.name || 'eth1'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <span>Assigned IP address</span>
              <HelpTooltip title="Stealth IP Check" description="Must remain NONE so the sensor cannot reply to ARP/ICMP probes on the monitored wire." />
            </span>
            <span className="font-mono text-slate-900 dark:text-slate-200">
              {passiveInterface?.ipAddress || 'NONE (Stealth compliant)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <span>Capture mode</span>
              <HelpTooltip title="Promiscuous Mode" description="Instructs the NIC to pass every Ethernet frame on the wire to the Rust engine regardless of destination MAC." />
            </span>
            <span className="text-slate-700 dark:text-slate-300">Strict promiscuous (SPAN mirror link)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
