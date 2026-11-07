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
import { SystemService, NetworkInterfaceConfig, StorageMetrics } from '../types/system';

interface DashboardViewProps {
  services: SystemService[];
  interfaces: NetworkInterfaceConfig[];
  storage: StorageMetrics | null;
  canManageSystem: boolean;
  onNavigateToInterfaces: () => void;
  onNavigateToValidation: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  services,
  interfaces,
  storage,
  onNavigateToInterfaces,
  onNavigateToValidation,
}) => {
  const passiveInterface = interfaces.find((i) => i.role === 'CAPTURE_PASSIVE');
  const adminInterface = interfaces.find((i) => i.role === 'ADMINISTRATION');
  const isPassiveCompliant = passiveInterface?.isStealthCompliant ?? true;

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Platform */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Plateforme OpenNDR — Version V0.1</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-emerald-400 font-medium">Socle Technique Opérationnel</span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Sonde de détection et réponse réseau autonome pour Debian 13.
              Backend FastAPI opérationnel, base relationnelle PostgreSQL synchronisée par Alembic, moteur Rust minimal en attente V0.2.
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
                <strong>ALERTE CRITIQUE DE SÉCURITÉ :</strong> L’interface de capture passive présente une violation d’isolation (IP assignée).
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
        {/* Card 1: Capture Engine Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Moteur Réseau Rust</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-400 tracking-tight font-mono">
            STANDBY (V0.1)
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Capture passive : <span className="font-mono text-slate-300">Désactivée (V0.2)</span>
          </div>
        </div>

        {/* Card 2: Stealth Compliance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Conformité Furtive</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className={`text-lg font-bold tracking-tight font-mono ${isPassiveCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPassiveCompliant ? '100% FURTIF' : 'VIOLATION DÉTECTÉE'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Émission : <span className="font-mono text-slate-300">0 trame (Zéro IP)</span>
          </div>
        </div>

        {/* Card 3: Storage PCAP Quota */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Stockage PCAP Local</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 tracking-tight font-mono">
            {storage ? `${storage.usedStorageGb} / ${storage.maxStorageGb} Go` : 'Quota Local'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Rétention : <span className="text-slate-300">{storage ? `${storage.retentionDays} jours` : '30 jours'}</span> (Disque local)
          </div>
        </div>

        {/* Card 4: Platform Target */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Environnement Cible</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 tracking-tight font-mono">
            Debian 13 (Trixie)
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Architecture : <span className="text-slate-300 font-mono">systemd + PostgreSQL</span>
          </div>
        </div>
      </div>

      {/* Services Supervision */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Supervision des Services OpenNDR</h3>
            <p className="text-xs text-slate-400">État réel des unités système</p>
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
            <span className="text-xs font-semibold text-slate-300">Interface d'Administration SOC</span>
            <span className="text-xs font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">ADMIN</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Nom interface</span>
            <span className="font-mono text-slate-200">{adminInterface?.name || 'eth0'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Adresse IP assignée</span>
            <span className="font-mono text-slate-200">{adminInterface?.ipAddress || 'Configurée pour gestion'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Usage</span>
            <span className="text-slate-300">Web HTTPS / API FastAPI</span>
          </div>
        </div>

        {/* Capture Interface */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Interface de Capture Passive</span>
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
            <span className="text-slate-400">Nom interface</span>
            <span className="font-mono text-slate-200">{passiveInterface?.name || 'eth1'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Adresse IP assignée</span>
            <span className="font-mono text-slate-200">
              {passiveInterface?.ipAddress || 'AUCUNE (Conforme furtif)'}
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
