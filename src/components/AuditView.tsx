import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { AuditLogItem } from '../types/system';

interface AuditViewProps {
  logs: AuditLogItem[];
}

export const AuditView: React.FC<AuditViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'DENIED' | 'FAILURE'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const filtered = logs.filter((item) => {
    const matchesSearch =
      item.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.resourceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Journal d’Audit & Sécurité de la Sonde</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Traçabilité intégrale et immuable des actions administratives, des tentatives d'authentification
              et des modifications de configuration sur la plateforme OpenNDR.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Stockage : PostgreSQL / Table audit_logs</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par action, utilisateur ou ressource..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
          {(['ALL', 'SUCCESS', 'DENIED', 'FAILURE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === st
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table and Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Événements horodatés ({filtered.length})</span>
            <span className="font-mono">Horloge UTC</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[550px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucun événement d'audit ne correspond aux critères sélectionnés.
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedLog?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedLog(item)}
                    className={`w-full text-left p-3.5 hover:bg-slate-850/50 transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-slate-850 border-l-2 border-emerald-400' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {item.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {item.status === 'DENIED' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {item.status === 'FAILURE' && <XCircle className="w-4 h-4 text-rose-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-200">{item.action}</span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs text-slate-400 font-mono">{item.resourceType}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Par <span className="font-mono text-slate-300">{item.userEmail}</span> ({item.userRole})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString('fr-FR')}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Log Inspector */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 border-b border-slate-800 pb-3">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Détail de l’Événement d’Audit</span>
          </div>

          {selectedLog ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400">Identifiant Unique</span>
                <div className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                  {selectedLog.id}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400">Horodatage précis</span>
                <div className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                  {selectedLog.timestamp}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400">Origine réseau</span>
                <div className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                  {selectedLog.ipAddress}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400">Charge Utile Structurée (JSONB)</span>
                <pre className="font-mono text-emerald-400 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto text-xs leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Sélectionnez un événement dans la liste pour inspecter sa charge utile complète.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
