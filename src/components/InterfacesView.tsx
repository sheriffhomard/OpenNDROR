import React, { useState } from 'react';
import {
  Network,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Radio,
} from 'lucide-react';
import { NetworkInterfaceConfig } from '../types/system';
import { HelpTooltip } from './HelpTooltip';

interface InterfacesViewProps {
  interfaces: NetworkInterfaceConfig[];
  canManageInterfaces: boolean;
}

export const InterfacesView: React.FC<InterfacesViewProps> = ({
  interfaces,
}) => {
  const [selectedIface, setSelectedIface] = useState<string>('eth1');

  const current = interfaces.find((i) => i.name === selectedIface) || interfaces[0];
  const isPassive = current?.role === 'CAPTURE_PASSIVE';

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Network Interface Configuration &amp; Separation</span>
              <HelpTooltip
                title="NIC Role Separation"
                description="Audits every host network adapter to ensure the management interface stays isolated from the zero-IP passive capture link."
              />
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              OpenNDR enforces strict isolation between the administration interface (IP, Web HTTPS, REST API)
              and the passive capture interface (SPAN/TAP, zero TX, no IP, strict promiscuous mode).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 rounded">
              Debian 13 · AF_PACKET / PACKET_MMAP (V0.2)
            </span>
          </div>
        </div>
      </div>

      {/* Interface selection tabs */}
      {interfaces.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Sign in via <strong>SOC Sign In</strong> to discover live host network interfaces.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {interfaces.map((iface) => {
            const isSelected = current?.name === iface.name;
            const isCompliant = iface.isStealthCompliant;
            return (
              <button
                key={iface.name}
                type="button"
                onClick={() => setSelectedIface(iface.name)}
                className={`p-5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-50/50 dark:bg-slate-800/70 border-emerald-500/50 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Network className={`w-4 h-4 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{iface.name}</span>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded ${
                      iface.role === 'ADMINISTRATION'
                        ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40'
                        : isCompliant
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 font-bold'
                    }`}
                  >
                    {iface.role}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      {iface.ipAddress || 'No IP (Stealth compliant)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Promiscuous Mode:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      {iface.isPromiscuous ? 'ENABLED (Promisc)' : 'DISABLED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sensor Role:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {iface.role === 'CAPTURE_PASSIVE' ? 'SPAN Mirror (RX Only)' : 'Management & API'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Interface Detail & Technical Properties */}
      {current && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-mono">
                  {current.name}
                </h3>
                {current.isStealthCompliant ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Compliance Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Non-Compliant
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{current.complianceReason}</p>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Persisted in PostgreSQL (`network_interfaces` table)
            </div>
          </div>

          {/* Technical properties grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>MAC Address</span>
                <HelpTooltip title="Hardware MAC Address" description="Unique Layer 2 physical address burned into the network adapter." />
              </div>
              <div className="text-xs font-mono font-medium text-slate-900 dark:text-slate-200 mt-1">{current.macAddress}</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Link Speed</span>
                <HelpTooltip title="Interface Bandwidth" description="Negotiated physical link capacity (e.g., 1 Gbps or 10 Gbps)." />
              </div>
              <div className="text-xs font-mono font-medium text-slate-900 dark:text-slate-200 mt-1">{current.speedMbps / 1000} Gbps</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>MTU</span>
                <HelpTooltip title="Maximum Transmission Unit" description="Largest Ethernet payload size accepted without fragmentation (standard is 1500 bytes)." />
              </div>
              <div className="text-xs font-mono font-medium text-slate-900 dark:text-slate-200 mt-1">{current.mtu} bytes</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Frame Drops (Rx Drop)</span>
                <HelpTooltip title="NIC Receive Drops" description="Packets discarded at the driver level before reaching the NDR engine. Ideally 0." />
              </div>
              <div className={`text-xs font-mono font-medium mt-1 ${current.rxDropped > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {current.rxDropped} frames
              </div>
            </div>
          </div>

          {/* Sysctl & Kernel hardening checklist for passive capture */}
          {isPassive && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-300">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span>Kernel Sysctl Stealth Hardening Parameters (Debian 13)</span>
                <HelpTooltip title="Debian Kernel Hardening" description="Apply these sysctl flags on Debian 13 so the capture port ignores ARP requests and disables IPv6 autoconfiguration." />
              </div>
              <div className="font-mono text-xs text-slate-600 dark:text-slate-400 space-y-1.5 bg-white dark:bg-slate-900/90 p-3 rounded border border-slate-200 dark:border-slate-800">
                <div># Disable ARP replies on the passive capture interface</div>
                <div className="text-emerald-700 dark:text-emerald-400">net.ipv4.conf.{current.name}.arp_ignore = 8</div>
                <div className="text-emerald-700 dark:text-emerald-400">net.ipv4.conf.{current.name}.arp_announce = 2</div>
                <div># Completely disable IPv6 on the capture link</div>
                <div className="text-emerald-700 dark:text-emerald-400">net.ipv6.conf.{current.name}.disable_ipv6 = 1</div>
                <div># Enable promiscuous mode and disable ARP</div>
                <div className="text-emerald-700 dark:text-emerald-400">ip link set {current.name} promisc on arp off up</div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                <Radio className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>V0.2 Engine:</strong> Zero-emission passive capture runs over an AF_PACKET socket (TPACKET_V2 mmap ring) with hierarchical L2–L4 decoding and automatic trace rotation under /var/lib/openndr/captures/.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
