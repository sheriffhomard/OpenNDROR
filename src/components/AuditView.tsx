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
import { HelpTooltip } from './HelpTooltip';

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Sensor Security &amp; Audit Log</span>
              <HelpTooltip title="Security Audit Trail" description="Chronological record of logins, logouts, user changes, PCAP analyses, and automated update events." />
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Full, immutable traceability of administrative actions, authentication attempts,
              and configuration changes across the OpenNDR platform.
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Storage: PostgreSQL / audit_logs table</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action, user, or resource..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <HelpTooltip title="Audit Log Search" description="Type any action name (e.g. AUTH_LOGIN_SUCCESS, SYSTEM_UPDATE_CHECK), email, or resource type." />
        </div>

        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
          {(['ALL', 'SUCCESS', 'DENIED', 'FAILURE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
          <span className="pr-1">
            <HelpTooltip title="Outcome Status Filter" description="Filter log entries by SUCCESS, DENIED (RBAC blocked), or FAILURE (bad credentials/error)." align="right" />
          </span>
        </div>
      </div>

      {/* Logs Table and Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Timestamped Events ({filtered.length})</span>
            <span className="font-mono">UTC Clock</span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800/80 max-h-[550px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No audit events match the selected criteria.
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedLog?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedLog(item)}
                    className={`w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-emerald-50/70 dark:bg-slate-800/80 ring-1 ring-inset ring-emerald-500/40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {item.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {item.status === 'DENIED' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {item.status === 'FAILURE' && <XCircle className="w-4 h-4 text-rose-500" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-200">{item.action}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{item.resourceType}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          By <span className="font-mono text-slate-700 dark:text-slate-300">{item.userEmail}</span> ({item.userRole})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {new Date(item.timestamp).toLocaleTimeString('en-US')}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Log Inspector */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-3">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>Audit Event Details</span>
            <HelpTooltip title="Structured Event Inspector" description="Shows exact metadata for the clicked event row, with sensitive secrets automatically redacted." align="right" />
          </div>

          {selectedLog ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <span>Unique Identifier</span>
                  <HelpTooltip title="Audit Record ID" description="Sequential primary key of this immutable log row." />
                </span>
                <div className="font-mono text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                  {selectedLog.id}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <span>Exact Timestamp</span>
                  <HelpTooltip title="ISO-8601 UTC Time" description="Exact UTC moment the operation was recorded on the server." />
                </span>
                <div className="font-mono text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                  {selectedLog.timestamp}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <span>Network Origin</span>
                  <HelpTooltip title="Source Client IP" description="IP address of the browser or operator workstation that initiated this request." />
                </span>
                <div className="font-mono text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                  {selectedLog.ipAddress}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <span>Structured Payload (JSONB)</span>
                  <HelpTooltip title="Event Metadata" description="Additional context recorded by the backend (file path, version, reason) with passwords redacted." />
                </span>
                <pre className="font-mono text-emerald-700 dark:text-emerald-400 bg-slate-50 dark:bg-slate-950 p-3 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto text-xs leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Select an event from the list to inspect its full payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
