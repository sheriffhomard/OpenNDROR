import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Terminal,
  ShieldCheck,
  Server,
  Layers,
  Database,
  FileCode,
} from 'lucide-react';
import { ValidationTestItem } from '../types/system';
import { apiService } from '../services/api';

export const ValidationView: React.FC = () => {
  const [tests, setTests] = useState<ValidationTestItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'OpenNDR Test Runner v0.1.0 initialisé.',
    'Prêt pour l’évaluation des critères d’acceptation technique.',
  ]);

  const handleRunAll = async () => {
    setIsRunning(true);
    setConsoleLogs((prev) => [
      ...prev,
      `--- Démarrage de la suite de validation à ${new Date().toLocaleTimeString()} ---`,
    ]);

    const results = await apiService.runV01ValidationSuite((updated) => {
      setTests((current) => {
        const idx = current.findIndex((t) => t.id === updated.id);
        if (idx >= 0) {
          const next = [...current];
          next[idx] = updated;
          return next;
        }
        return [...current, updated];
      });

      if (updated.status === 'passed') {
        setConsoleLogs((prev) => [
          ...prev,
          `[✓ PASS] ${updated.name} (${updated.durationMs || 0}ms): ${updated.details}`,
        ]);
      } else if (updated.status === 'failed') {
        setConsoleLogs((prev) => [
          ...prev,
          `[✗ FAIL] ${updated.name}: ${updated.details}`,
        ]);
      }
    });

    setTests(results);
    setIsRunning(false);
    setConsoleLogs((prev) => [
      ...prev,
      `--- Validation V0.1 terminée. Tous les tests obligatoires ont été exécutés. ---`,
    ]);
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const totalCount = tests.length || 8;

  const categoryIcons = {
    ARCH: Layers,
    SECURITY: ShieldCheck,
    NETWORK: Server,
    DATABASE: Database,
    SYSTEMD: FileCode,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Banc de Recette & Validation Automatisée V0.1
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Exécution des tests de conformité aux critères de sortie stricts de la V0.1
              (architecture autonome, hachage cryptographique, isolation passive, RBAC, services systemd).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAll}
              disabled={isRunning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Tests en cours...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Exécuter tous les tests V0.1
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {tests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-4 text-xs">
            <div className="flex-1 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(passedCount / totalCount) * 100}%` }}
              />
            </div>
            <span className="font-mono text-slate-300 font-medium">
              {passedCount} / {totalCount} validés
            </span>
          </div>
        )}
      </div>

      {/* Test Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(tests.length > 0 ? tests : [
          { id: 'arch-1', category: 'ARCH', name: 'Autonomie logicielle (Zéro dépendance obligatoire tiers)', description: 'Vérification de l’absence de dépendance requise vers Suricata, Zeek ou Arkime', status: 'pending' },
          { id: 'arch-2', category: 'ARCH', name: 'Workspace Rust & Contrats IPC', description: 'Vérification des crates common et capture avec gestion d’erreurs sans panic', status: 'pending' },
          { id: 'sec-1', category: 'SECURITY', name: 'Hachage cryptographique & Secrets', description: 'Validation de l’algorithme PBKDF2/Argon2id et intégrité de signature HMAC-SHA256', status: 'pending' },
          { id: 'sec-2', category: 'SECURITY', name: 'Matrice RBAC côté serveur', description: 'Contrôle strict des privilèges Administrator, Analyst et Observer', status: 'pending' },
          { id: 'net-1', category: 'NETWORK', name: 'Isolation Stricte Interface Passive (eth1)', description: 'Validation : Zéro adresse IP assignée, promiscuous actif, non-émission de trames', status: 'pending' },
          { id: 'db-1', category: 'DATABASE', name: 'Schémas PostgreSQL & Migrations Alembic', description: 'Validation des tables initiales (users, roles, permissions, audit_logs)', status: 'pending' },
          { id: 'sys-1', category: 'SYSTEMD', name: 'Unités de service systemd Debian 13', description: 'Validation des fichiers openndr-backend, openndr-engine et openndr-web', status: 'pending' },
          { id: 'sys-2', category: 'SYSTEMD', name: 'Scripts d’installation et de désinstallation', description: 'Vérification de la non-suppression automatique des captures PCAP', status: 'pending' },
        ] as ValidationTestItem[]).map((test) => {
          const Icon = categoryIcons[test.category];
          return (
            <div
              key={test.id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-300">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{test.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{test.description}</div>
                  </div>
                </div>

                <div className="shrink-0">
                  {test.status === 'passed' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      SUCCÈS
                    </span>
                  )}
                  {test.status === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-mono font-medium">
                      <XCircle className="w-4 h-4" />
                      ÉCHEC
                    </span>
                  )}
                  {test.status === 'running' && (
                    <span className="text-xs text-sky-400 font-mono animate-pulse">
                      TEST EN COURS...
                    </span>
                  )}
                  {test.status === 'pending' && (
                    <span className="text-xs text-slate-500 font-mono">EN ATTENTE</span>
                  )}
                </div>
              </div>

              {test.details && (
                <div className="text-xs font-mono p-2 bg-slate-950 rounded border border-slate-800/80 text-slate-300">
                  {test.details}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Real-time execution logs console */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Console de Sortie d'Exécution des Tests</span>
          </div>
          <span className="text-slate-500">pytest & cargo test output</span>
        </div>

        <div className="p-4 space-y-1 text-slate-300 max-h-48 overflow-y-auto">
          {consoleLogs.map((line, idx) => (
            <div
              key={idx}
              className={
                line.includes('[✓ PASS]')
                  ? 'text-emerald-400'
                  : line.includes('[✗ FAIL]')
                  ? 'text-rose-400'
                  : line.startsWith('---')
                  ? 'text-sky-400'
                  : 'text-slate-400'
              }
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
