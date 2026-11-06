import React from 'react';
import {
  Activity,
  Server,
  HardDrive,
  Cpu,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { SystemService, NetworkInterfaceConfig, StorageMetrics } from '../types/system';

interface DashboardViewProps {
  services: SystemService[];
  interfaces: NetworkInterfaceConfig[];
  storage: StorageMetrics;
  canManageSystem: boolean;
  onRestartService: (unit: string) => void;
  onNavigateToInterfaces: () => void;
  onNavigateToValidation: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  services,
  interfaces,
  storage,
  canManageSystem,
  onRestartService,
  onNavigateToInterfaces,
  onNavigateToValidation,
}) => {
  const passiveInterface = interfaces.find((i) => i.role === 'CAPTURE_PASSIVE');
  const adminInterface = interfaces.find((i) => i.role === 'ADMINISTRATION');
  const isPassiveCompliant = passiveInterface?.isStealthCompliant ?? false;

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Platform */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Plateforme OpenNDR — Version V0.1</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-emerald-400 font-medium">Fondations Techniques Actives</span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Sonde de détection et réponse réseau autonome pour Debian 13.
              Moteur réseau Rust prêt, Backend FastAPI opérationnel, base relationnelle PostgreSQL synchronisée.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToValidation}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Lancer la Recette V0.1
            </button>
          </div>
        </div>

        {/* Warning if stealth mode violated */}
        {!isPassiveCompliant && (
          <div className="mt-4 p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg flex items-start justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>ALERTE CRITIQUE DE SÉCURITÉ :</strong> L’interface de capture passive présente une violation d’isolation (IP assignée ou fuite de trames).
              </span>
            </div>
            <button
              onClick={onNavigateToInterfaces}
              className="text-xs underline hover:text-white shrink-0 font-medium"
            >
              Inspecter l’interface
            </button>
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Capture Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Moteur Réseau Rust</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 tracking-tight font-mono">
            {passiveInterface?.isUp ? 'ÉCOUTE ACTIVE' : 'ARRÊTÉ'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Interface : <span className="font-mono text-slate-300">{passiveInterface?.name || 'N/A'}</span> (Promisc)
          </div>
        </div>

        {/* Card 2: Stealth Compliance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Conformité Furtive</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className={`text-xl font-bold tracking-tight font-mono ${isPassiveCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPassiveCompliant ? '100% FURTIF' : 'VIOLATION DÉTECTÉE'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Émission : <span className="font-mono text-slate-300">0 pkt/s</span> (Zéro IP)
          </div>
        </div>

        {/* Card 3: Storage PCAP Quota */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Stockage PCAP Local</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 tracking-tight font-mono">
            {storage.usedStorageGb} / {storage.maxStorageGb} Go
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Rétention : <span className="text-slate-300">{storage.retentionDays} jours</span> (Auto-purge)
          </div>
        </div>

        {/* Card 4: Platform Hardware */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Ressources Debian 13</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 tracking-tight font-mono">
            8 vCPU · 32 Go
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Charge CPU globale : <span className="text-slate-300 font-mono">3.4%</span>
          </div>
        </div>
      </div>

      {/* Services Systemd Supervision */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Services Démons systemd</h3>
            <p className="text-xs text-slate-400">État de fonctionnement des unités natives Debian</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">/etc/systemd/system/</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {services.map((service) => (
            <div key={service.unit} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-emerald-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{service.name}</span>
                    <span className="text-xs font-mono text-slate-500">{service.unit}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{service.description}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="hidden sm:block text-slate-400">
                  PID: <span className="text-slate-200">{service.pid || 'N/A'}</span>
                </div>
                <div className="hidden sm:block text-slate-400">
                  RAM: <span className="text-slate-200">{service.memoryMb ? `${service.memoryMb} Mo` : 'N/A'}</span>
                </div>
                {canManageSystem && (
                  <button
                    onClick={() => onRestartService(service.unit)}
                    title="Redémarrer le service systemd"
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network Interfaces Quick Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin Interface */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Interface d'Administration SOC</span>
            <span className="text-xs font-mono text-emerald-400">ADMIN</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Nom interface</span>
            <span className="font-mono text-slate-200">{adminInterface?.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Adresse IP assignée</span>
            <span className="font-mono text-slate-200">{adminInterface?.ipAddress}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Usage</span>
            <span className="text-slate-300">HTTPS (443) / API FastAPI (8000)</span>
          </div>
        </div>

        {/* Capture Interface */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Interface de Capture Passive</span>
            <span className={`text-xs font-mono ${isPassiveCompliant ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
              {isPassiveCompliant ? 'PASSIVE_STEALTH' : 'VIOLATION'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Nom interface</span>
            <span className="font-mono text-slate-200">{passiveInterface?.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Adresse IP assignée</span>
            <span className="font-mono text-slate-200">
              {passiveInterface?.ipAddress || 'AUCUNE (Conforme)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Mode d’écoute</span>
            <span className="text-slate-300">Promiscuous strict (Raccord miroir SPAN)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
