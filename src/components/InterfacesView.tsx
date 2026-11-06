import React, { useState } from 'react';
import {
  Network,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { NetworkInterfaceConfig } from '../types/system';

interface InterfacesViewProps {
  interfaces: NetworkInterfaceConfig[];
  canManageInterfaces: boolean;
  onSimulateViolation: (name: string, badIp: string) => void;
  onRectifyInterface: (name: string) => void;
}

export const InterfacesView: React.FC<InterfacesViewProps> = ({
  interfaces,
  canManageInterfaces,
  onSimulateViolation,
  onRectifyInterface,
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
              Gestion & Isolation Stricte des Interfaces Réseau
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Conformément à l’ADR-003, la sonde OpenNDR applique une séparation étanche entre
              l’interface d’administration (IP, gestion) et l’interface de capture passive (SPAN/TAP,
              zéro émission, aucune IP, promisc strict).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Kernel Linux 6.x · AF_PACKET</span>
          </div>
        </div>
      </div>

      {/* Interface selection tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {interfaces.map((iface) => {
          const isSelected = selectedIface === iface.name;
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
                  <span>Adresse IP :</span>
                  <span className="font-mono text-slate-200">
                    {iface.ipAddress || 'Aucune IP (Conforme)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Mode Promiscuous :</span>
                  <span className="font-mono text-slate-200">
                    {iface.isPromiscuous ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Paquets émis (Tx) :</span>
                  <span className={`font-mono ${iface.txPackets === 0 && iface.role === 'CAPTURE_PASSIVE' ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {iface.txPackets}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interface Detail & Security Audit Box */}
      {current && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">
                  Inspection Détaillée · {current.name}
                </h3>
                {current.isStealthCompliant ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Conformité Validée
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-400 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Violation d'Isolation Détectée
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{current.complianceReason}</p>
            </div>

            {/* Actions for testing */}
            {canManageInterfaces && isPassive && (
              <div className="flex items-center gap-2">
                {current.isStealthCompliant ? (
                  <button
                    onClick={() => onSimulateViolation(current.name, '192.168.1.99/24')}
                    className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/50 text-rose-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    title="Simuler une configuration erronée où une IP est assignée à l'interface de capture passive"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    Simuler assignation IP accidentelle
                  </button>
                ) : (
                  <button
                    onClick={() => onRectifyInterface(current.name)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Rétablir l’isolation stricte (Révoquer IP)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Technical properties grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">Adresse MAC</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1">{current.macAddress}</div>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">Vitesse de liaison</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1">{current.speedMbps / 1000} Gbit/s</div>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">MTU</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1">{current.mtu} octets</div>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400">Pertes de paquets (Rx Drop)</div>
              <div className={`text-xs font-mono font-medium mt-1 ${current.rxDropped > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {current.rxDropped} trames
              </div>
            </div>
          </div>

          {/* Sysctl & Kernel hardening checklist for passive capture */}
          {isPassive && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Paramètres Kernel Sysctl d'Invisibilité Défensive (Debian 13)</span>
              </div>
              <div className="font-mono text-xs text-slate-400 space-y-1.5 bg-slate-900/90 p-3 rounded border border-slate-800">
                <div># Désactivation des réponses ARP sur l'interface passive</div>
                <div className="text-emerald-400">net.ipv4.conf.{current.name}.arp_ignore = 8</div>
                <div className="text-emerald-400">net.ipv4.conf.{current.name}.arp_announce = 2</div>
                <div># Désactivation totale d'IPv6 sur le lien de capture</div>
                <div className="text-emerald-400">net.ipv6.conf.{current.name}.disable_ipv6 = 1</div>
                <div># Blocage absolu de la transmission de paquets</div>
                <div className="text-emerald-400">ip link set {current.name} promisc on arp off up</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
