import React, { useState } from 'react';
import {
  Search,
  Filter,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { AuditLogItem } from '../types/system';
import { HelpTooltip } from './HelpTooltip';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  LoadingState,
  EmptyState,
  ErrorState,
  DataTable,
} from './ui';

interface AuditViewProps {
  logs: AuditLogItem[];
  isLoading?: boolean;
  error?: string | null;
  hasViewPermission: boolean;
  onRetry?: () => void;
}

const STATUS_OPTIONS: { value: 'ALL' | 'SUCCESS' | 'DENIED' | 'FAILURE'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'SUCCESS', label: 'Succès' },
  { value: 'DENIED', label: 'Refusés' },
  { value: 'FAILURE', label: 'Échecs' },
];

export const AuditView: React.FC<AuditViewProps> = ({
  logs,
  isLoading = false,
  error = null,
  hasViewPermission,
  onRetry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'DENIED' | 'FAILURE'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const filtered = logs.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.action.toLowerCase().includes(q) ||
      item.userEmail.toLowerCase().includes(q) ||
      item.resourceType.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PageContainer>
      <PageHeader
        title="Journal d'audit"
        description="Traçabilité horodatée des actions administratives, authentifications et opérations système."
        meta={<span className="font-mono">Source : PostgreSQL / table audit_logs</span>}
      />

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!hasViewPermission ? (
        <SectionCard title="Journal des événements">
          <EmptyState
            title="Accès restreint"
            description="Votre rôle actuel ne dispose pas du privilège audit:view requis pour consulter le journal d'audit."
          />
        </SectionCard>
      ) : (
        <>
          {/* Barre de recherche et de filtrage */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par action, utilisateur ou ressource..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#181b20] border border-gray-300 dark:border-[#2c313a] rounded-md text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <HelpTooltip
                title="Recherche dans l'audit"
                description="Filtre les événements selon le code d'action, l'adresse e-mail de l'opérateur ou le type de ressource."
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-md text-xs shrink-0">
              <Filter className="w-3.5 h-3.5 text-gray-400 ml-2 mr-1" />
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="pr-1">
                <HelpTooltip
                  title="Filtre de résultat"
                  description="Limite la vue aux événements réussis (SUCCESS), bloqués par RBAC (DENIED) ou en échec (FAILURE)."
                  align="right"
                />
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Tableau chronologique */}
            <div>
              <SectionCard
                title="Événements enregistrés"
                actions={
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tabular-nums">
                    {filtered.length} entrée(s)
                  </span>
                }
                noPadding
              >
                {isLoading && logs.length === 0 ? (
                  <LoadingState message="Chargement des événements d'audit..." />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    title="Aucun événement d'audit"
                    description="Aucun enregistrement ne correspond aux filtres sélectionnés."
                  />
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <DataTable>
                      <thead className="bg-gray-50 dark:bg-[#111318] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#2c313a]">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Date</th>
                          <th className="px-4 py-2.5 font-medium">Utilisateur</th>
                          <th className="px-4 py-2.5 font-medium">Action</th>
                          <th className="px-4 py-2.5 font-medium">Résultat</th>
                          <th className="px-4 py-2.5 font-medium">Adresse IP</th>
                          <th className="px-4 py-2.5 font-medium text-right">Détails</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-[#2c313a]">
                        {filtered.map((item) => {
                          const isSelected = selectedLog?.id === item.id;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedLog(item)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50/70 dark:bg-blue-950/30'
                                  : 'hover:bg-gray-50 dark:hover:bg-[#1f2329]'
                              }`}
                            >
                              <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap">
                                {new Date(item.timestamp).toLocaleString('fr-FR')}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                                {item.userEmail}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                                  {item.action}
                                </span>
                                <span className="text-gray-400 mx-1.5">·</span>
                                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                                  {item.resourceType}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 font-mono ${
                                    item.status === 'SUCCESS'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : item.status === 'DENIED'
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-red-700 dark:text-red-400'
                                  }`}
                                >
                                  {item.status === 'SUCCESS' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {item.status === 'DENIED' && <AlertTriangle className="w-3.5 h-3.5" />}
                                  {item.status === 'FAILURE' && <XCircle className="w-3.5 h-3.5" />}
                                  <span>{item.status}</span>
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap">
                                {item.ipAddress}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLog(item);
                                  }}
                                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                  Inspecter
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </DataTable>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Inspecteur d'événement sélectionné */}
            <SectionCard
              title={
                <>
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Détails de l&apos;événement</span>
                </>
              }
            >
              {selectedLog ? (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Identifiant unique</div>
                    <div className="font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#111318] p-2 rounded border border-gray-200 dark:border-[#2c313a]">
                      {selectedLog.id}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Horodatage exact (UTC)</div>
                    <div className="font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#111318] p-2 rounded border border-gray-200 dark:border-[#2c313a]">
                      {selectedLog.timestamp}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-1">Utilisateur</div>
                      <div className="font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#111318] p-2 rounded border border-gray-200 dark:border-[#2c313a] truncate">
                        {selectedLog.userEmail}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-1">Rôle</div>
                      <div className="font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#111318] p-2 rounded border border-gray-200 dark:border-[#2c313a] truncate">
                        {selectedLog.userRole || 'Non renseigné'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Adresse IP source</div>
                    <div className="font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#111318] p-2 rounded border border-gray-200 dark:border-[#2c313a]">
                      {selectedLog.ipAddress}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                      Charge utile structurée (JSON)
                    </div>
                    <pre className="font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-[#111318] p-3 rounded border border-gray-200 dark:border-[#2c313a] overflow-x-auto text-xs leading-relaxed">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
                  Sélectionnez une ligne dans le journal pour inspecter ses métadonnées complètes.
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </PageContainer>
  );
};
