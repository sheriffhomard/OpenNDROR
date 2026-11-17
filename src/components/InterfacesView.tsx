import React, { useState } from 'react';
import {
  Network,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Radio,
} from 'lucide-react';
import { NetworkInterfaceConfig } from '../types/system';

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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Network Interface Configuration & Separation
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              OpenNDR enforces strict isolation between the administration interface (IP, Web HTTPS, REST API)
              and the passive capture interface (SPAN/TAP, zero TX, no IP, strict promiscuous mode).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded">
              Debian 13 · AF_PACKET / PACKET_MMAP (V0.2)
            </span>
          </div>
        </div>
      </div>

      {/* Interface selection tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {interfaces.map((iface) => {
          const isSelected = (current?.name === iface.name);
          const isCompliant = iface.isStealthCompliant;
          return (
            <button
              key={iface.name}
              onClick={() => setSelectedIface(iface.name)}
              className={`p-5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-slate-850 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Network className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="font-mono text-sm font-semibold text-slate-100">{iface.name}</span>
                </div>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    iface.role === 'ADMINISTRATION'
                      ? 'bg-sky-950 text-sky-400 border border-sky-800/40'
                      : isCompliant
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                      : 'bg-rose-950 text-rose-400 border border-rose-800/40 font-bold'
                  }`}
                >
                  {iface.role}
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>IP Address:</span>
                  <span className="font-mono text-slate-200">
                    {iface.ipAddress || 'No IP (Stealth compliant)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Promiscuous Mode:</span>
                  <span className="font-mono text-slate-200">
                    {iface.isPromiscuous ? 'ENABLED (Promisc)' : 'DISABLED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sensor Role:</span>
                  <span className="font-mono text-slate-300">
                    {iface.role === 'CAPTURE_PASSIVE' ? 'SPAN Mirror (RX Only)' : 'Management & API'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interface Detail & Technical Properties */}
      {current && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100 font-mono">
                  {current.name}
                </h3>
                {current.isStealthCompliant ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Compliance Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-400 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Non-Compliant
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{current.complianceReason}</p>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Persisted in PostgreSQL (`network_interfaces` table)
            </div>
          </div>

          {/* Technical properties grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">MAC Address</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1">{current.macAddress}</div>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">Link Speed</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1">{current.speedMbps / 1000} Gbps</div>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">MTU</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1">{current.mtu} bytes</div>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">Frame Drops (Rx Drop)</div>
              <div className={`text-xs font-mono font-medium mt-1 ${current.rxDropped > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {current.rxDropped} frames
              </div>
            </div>
          </div>

          {/* Sysctl & Kernel hardening checklist for passive capture */}
          {isPassive && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Kernel Sysctl Stealth Hardening Parameters (Debian 13)</span>
              </div>
              <div className="font-mono text-xs text-slate-400 space-y-1.5 bg-slate-900/90 p-3 rounded border border-slate-800">
                <div># Disable ARP replies on the passive capture interface</div>
                <div className="text-emerald-400">net.ipv4.conf.{current.name}.arp_ignore = 8</div>
                <div className="text-emerald-400">net.ipv4.conf.{current.name}.arp_announce = 2</div>
                <div># Completely disable IPv6 on the capture link</div>
                <div className="text-emerald-400">net.ipv6.conf.{current.name}.disable_ipv6 = 1</div>
                <div># Enable promiscuous mode and disable ARP</div>
                <div className="text-emerald-400">ip link set {current.name} promisc on arp off up</div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 flex items-start gap-2">
                <Radio className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
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
