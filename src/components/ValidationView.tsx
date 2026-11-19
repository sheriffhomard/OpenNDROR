import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Terminal,
  ShieldCheck,
  Server,
  Layers,
  Database,
  HardDrive,
} from 'lucide-react';
import { ValidationTestItem } from '../types/system';
import { apiService } from '../services/api';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  OperationalState,
} from './ui';

interface ValidationViewProps {
  isAuthenticated: boolean;
}

const INITIAL_TESTS: ValidationTestItem[] = [
  {
    id: 'probe-live',
    category: 'ARCH',
    name: 'Disponibilité API (Liveness)',
    description: 'Interroge /api/v1/health/live pour vérifier que le serveur répond via HTTP.',
    status: 'pending',
  },
  {
    id: 'probe-health',
    category: 'ARCH',
    name: 'Rapport de santé plateforme',
    description: 'Interroge /api/v1/health pour lire l\'état global, la version et la cible OS.',
    status: 'pending',
  },
  {
    id: 'probe-ready',
    category: 'DATABASE',
    name: 'Connectivité base de données (Readiness)',
    description: 'Interroge /api/v1/health/ready pour confirmer l\'état de la connexion relationnelle.',
    status: 'pending',
  },
  {
    id: 'probe-auth-guard',
    category: 'SECURITY',
    name: 'Barrière d\'accès anonyme (HTTP 401)',
    description: 'Vérifie que GET /api/v1/users sans jeton JWT renvoie strictement un HTTP 401.',
    status: 'pending',
  },
  {
    id: 'probe-invalid-creds',
    category: 'SECURITY',
    name: 'Rejet d\'identifiants invalides',
    description: 'Vérifie le refus HTTP 401 lors d\'une tentative d\'authentification erronée.',
    status: 'pending',
  },
  {
    id: 'probe-engine-telemetry',
    category: 'SYSTEMD',
    name: 'Moteur de capture Rust et télémétrie',
    description: 'Vérifie /api/v1/system/capture/telemetry et l\'intégrité du binaire via /api/v1/system/updates.',
    status: 'pending',
  },
  {
    id: 'probe-stealth-check',
    category: 'NETWORK',
    name: 'Isolation de l\'interface passive',
    description: 'Interroge /api/v1/system/interfaces/isolation-check pour confirmer l\'absence d\'adresse IP.',
    status: 'pending',
  },
  {
    id: 'probe-storage-quota',
    category: 'SYSTEMD',
    name: 'Répertoire et quota de stockage PCAP',
    description: 'Interroge /api/v1/system/storage pour vérifier la présence du dossier et l\'espace local.',
    status: 'pending',
  },
];

const CATEGORY_LABELS: Record<ValidationTestItem['category'], string> = {
  ARCH: 'Backend API',
  DATABASE: 'Base de données',
  SECURITY: 'Sécurité',
  NETWORK: 'Interfaces réseau',
  SYSTEMD: 'Moteur & Stockage',
};

const CATEGORY_ICONS: Record<ValidationTestItem['category'], React.ComponentType<{ className?: string }>> = {
  ARCH: Layers,
  SECURITY: ShieldCheck,
  NETWORK: Server,
  DATABASE: Database,
  SYSTEMD: HardDrive,
};

function mapTestStatusToBadge(status: ValidationTestItem['status']): {
  state: OperationalState;
  label: string;
} {
  switch (status) {
    case 'passed':
      return { state: 'operational', label: 'Conforme' };
    case 'warning':
      return { state: 'degraded', label: 'Vérification requise' };
    case 'failed':
      return { state: 'unavailable', label: 'Échec' };
    case 'running':
      return { state: 'unknown', label: 'En cours...' };
    default:
      return { state: 'unknown', label: 'Non exécuté' };
  }
}

export const ValidationView: React.FC<ValidationViewProps> = ({ isAuthenticated }) => {
  const [tests, setTests] = useState<ValidationTestItem[]>(INITIAL_TESTS);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'Console de diagnostics prête. Aucun test n\'a encore été exécuté dans cette session.',
  ]);

  const updateTest = (id: string, partial: Partial<ValidationTestItem>) => {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...partial } : t)));
  };

  const appendLog = (line: string) => {
    setConsoleLogs((prev) => [...prev, line]);
  };

  const handleRunAll = async () => {
    setIsRunning(true);
    setTests(INITIAL_TESTS.map((t) => ({ ...t, status: 'pending', details: undefined, durationMs: undefined })));
    appendLog(`--- Début des vérifications à ${new Date().toLocaleTimeString('fr-FR')} ---`);

    // 1. Liveness
    updateTest('probe-live', { status: 'running' });
    const t0 = performance.now();
    try {
      const res = await apiService.getLiveness();
      const dur = Math.round(performance.now() - t0);
      if (res && res.status === 'UP') {
        updateTest('probe-live', {
          status: 'passed',
          durationMs: dur,
          details: `Serveur API joignable via HTTP (status: ${res.status})`,
        });
        appendLog(`[OK] Liveness (${dur} ms) : status=${res.status}`);
      } else {
        throw new Error(`Réponse inattendue : ${JSON.stringify(res)}`);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-live', { status: 'failed', durationMs: dur, details: msg });
      appendLog(`[ÉCHEC] Liveness (${dur} ms) : ${msg}`);
    }

    // 2. Platform Health
    updateTest('probe-health', { status: 'running' });
    const t1 = performance.now();
    try {
      const res = await apiService.getHealth();
      const dur = Math.round(performance.now() - t1);
      const isHealthy = res.status === 'HEALTHY';
      updateTest('probe-health', {
        status: isHealthy ? 'passed' : 'warning',
        durationMs: dur,
        details: `Statut ${res.status} · Version ${res.version} · Cible : ${res.target_platform}`,
      });
      appendLog(`[${isHealthy ? 'OK' : 'AVERT.'}] Health (${dur} ms) : ${res.status} v${res.version}`);
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t1);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-health', { status: 'failed', durationMs: dur, details: msg });
      appendLog(`[ÉCHEC] Health (${dur} ms) : ${msg}`);
    }

    // 3. Database readiness
    updateTest('probe-ready', { status: 'running' });
    const t2 = performance.now();
    try {
      const res = await apiService.getReadiness();
      const dur = Math.round(performance.now() - t2);
      if (res && res.database_connected) {
        updateTest('probe-ready', {
          status: 'passed',
          durationMs: dur,
          details: `Base de données connectée (${res.status})`,
        });
        appendLog(`[OK] Readiness DB (${dur} ms) : connexion confirmée`);
      } else {
        throw new Error(res?.details || 'Base de données non prête');
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t2);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-ready', { status: 'failed', durationMs: dur, details: msg });
      appendLog(`[ÉCHEC] Readiness DB (${dur} ms) : ${msg}`);
    }

    // 4. Auth 401 guard
    updateTest('probe-auth-guard', { status: 'running' });
    const t3 = performance.now();
    try {
      const rawRes = await fetch('/api/v1/users', { headers: { Accept: 'application/json' } });
      const dur = Math.round(performance.now() - t3);
      if (rawRes.status === 401) {
        updateTest('probe-auth-guard', {
          status: 'passed',
          durationMs: dur,
          details: 'Accès anonyme strictement rejeté par HTTP 401.',
        });
        appendLog(`[OK] Barrière 401 (${dur} ms) : accès anonyme bloqué`);
      } else {
        throw new Error(`Statut HTTP inattendu : ${rawRes.status} (attendu : 401)`);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t3);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-auth-guard', { status: 'failed', durationMs: dur, details: msg });
      appendLog(`[ÉCHEC] Barrière 401 (${dur} ms) : ${msg}`);
    }

    // 5. Invalid credentials rejection
    updateTest('probe-invalid-creds', { status: 'running' });
    const t4 = performance.now();
    try {
      const loginRes = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: 'invalid_probe@test.local',
          password: 'WrongPassword123!',
        }),
      });
      const dur = Math.round(performance.now() - t4);
      if (loginRes.status === 401) {
        updateTest('probe-invalid-creds', {
          status: 'passed',
          durationMs: dur,
          details: 'Authentification erronée rejetée (HTTP 401).',
        });
        appendLog(`[OK] Rejet identifiants (${dur} ms) : HTTP 401 confirmé`);
      } else {
        throw new Error(`Statut HTTP inattendu : ${loginRes.status}`);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t4);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-invalid-creds', { status: 'failed', durationMs: dur, details: msg });
      appendLog(`[ÉCHEC] Rejet identifiants (${dur} ms) : ${msg}`);
    }

    // 6. Rust engine telemetry + binary integrity check
    updateTest('probe-engine-telemetry', { status: 'running' });
    const t5 = performance.now();
    if (!isAuthenticated) {
      try {
        const upd = await apiService.getUpdateStatus();
        const dur = Math.round(performance.now() - t5);
        updateTest('probe-engine-telemetry', {
          status: 'warning',
          durationMs: dur,
          details: upd.engine_integrity_ok
            ? 'Binaire détecté, mais authentification requise pour lire la télémétrie.'
            : 'Binaire Rust non compilé dans cet environnement (authentification requise pour la télémétrie).',
        });
        appendLog(`[AVERT.] Moteur Rust (${dur} ms) : connexion utilisateur requise pour télémétrie`);
      } catch (err: unknown) {
        const dur = Math.round(performance.now() - t5);
        const msg = err instanceof Error ? err.message : String(err);
        updateTest('probe-engine-telemetry', { status: 'failed', durationMs: dur, details: msg });
        appendLog(`[ÉCHEC] Moteur Rust (${dur} ms) : ${msg}`);
      }
    } else {
      try {
        const [telem, upd] = await Promise.all([
          apiService.getCaptureTelemetry(),
          apiService.getUpdateStatus().catch(() => null),
        ]);
        const dur = Math.round(performance.now() - t5);
        if (upd && !upd.engine_integrity_ok) {
          updateTest('probe-engine-telemetry', {
            status: 'warning',
            durationMs: dur,
            details: `API télémétrie joignable (v${telem.engine_version}), mais binaire natif absent sur cet hôte.`,
          });
          appendLog(`[AVERT.] Moteur Rust (${dur} ms) : binaire natif non compilé localement`);
        } else {
          updateTest('probe-engine-telemetry', {
            status: 'passed',
            durationMs: dur,
            details: `Moteur v${telem.engine_version} (${telem.capture_mode}) · ${telem.packets_received} paquet(s) reçu(s).`,
          });
          appendLog(`[OK] Moteur Rust (${dur} ms) : mode=${telem.capture_mode}, paquets=${telem.packets_received}`);
        }
      } catch (err: unknown) {
        const dur = Math.round(performance.now() - t5);
        const msg = err instanceof Error ? err.message : String(err);
        updateTest('probe-engine-telemetry', { status: 'failed', durationMs: dur, details: msg });
        appendLog(`[ÉCHEC] Moteur Rust (${dur} ms) : ${msg}`);
      }
    }

    // 7. Passive interface isolation
    updateTest('probe-stealth-check', { status: 'running' });
    const t6 = performance.now();
    if (!isAuthenticated) {
      updateTest('probe-stealth-check', {
        status: 'warning',
        details: 'Authentification requise pour inspecter les interfaces réseau.',
      });
      appendLog('[AVERT.] Isolation passive : authentification requise');
    } else {
      try {
        const isolationRes = await apiService.getIsolationCheck();
        const dur = Math.round(performance.now() - t6);
        if (isolationRes.is_isolated) {
          updateTest('probe-stealth-check', {
            status: 'passed',
            durationMs: dur,
            details: `Interface ${isolationRes.interface} conforme (${isolationRes.status})`,
          });
          appendLog(`[OK] Isolation passive (${dur} ms) : ${isolationRes.details}`);
        } else {
          updateTest('probe-stealth-check', {
            status: isolationRes.status === 'NOT_CONFIGURED' ? 'warning' : 'failed',
            durationMs: dur,
            details: `${isolationRes.status} : ${isolationRes.details}`,
          });
          appendLog(`[AVERT.] Isolation passive (${dur} ms) : ${isolationRes.status} — ${isolationRes.details}`);
        }
      } catch (err: unknown) {
        const dur = Math.round(performance.now() - t6);
        const msg = err instanceof Error ? err.message : String(err);
        updateTest('probe-stealth-check', { status: 'failed', durationMs: dur, details: msg });
        appendLog(`[ÉCHEC] Isolation passive (${dur} ms) : ${msg}`);
      }
    }

    // 8. PCAP storage readiness
    updateTest('probe-storage-quota', { status: 'running' });
    const t7 = performance.now();
    if (!isAuthenticated) {
      updateTest('probe-storage-quota', {
        status: 'warning',
        details: 'Authentification requise pour vérifier le répertoire de stockage PCAP.',
      });
      appendLog('[AVERT.] Stockage PCAP : authentification requise');
    } else {
      try {
        const storageRes = await apiService.getStorageMetrics();
        const dur = Math.round(performance.now() - t7);
        const ready = storageRes.status === 'READY';
        updateTest('probe-storage-quota', {
          status: ready ? 'passed' : 'warning',
          durationMs: dur,
          details: `${storageRes.pcapDirectory} · Statut : ${storageRes.status || 'Inconnu'} · Quota ${storageRes.maxStorageGb} Go`,
        });
        appendLog(`[${ready ? 'OK' : 'AVERT.'}] Stockage PCAP (${dur} ms) : statut=${storageRes.status}`);
      } catch (err: unknown) {
        const dur = Math.round(performance.now() - t7);
        const msg = err instanceof Error ? err.message : String(err);
        updateTest('probe-storage-quota', { status: 'failed', durationMs: dur, details: msg });
        appendLog(`[ÉCHEC] Stockage PCAP (${dur} ms) : ${msg}`);
      }
    }

    setIsRunning(false);
    appendLog(`--- Fin des vérifications à ${new Date().toLocaleTimeString('fr-FR')} ---`);
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const warningCount = tests.filter((t) => t.status === 'warning').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;
  const executedCount = tests.filter((t) => t.status !== 'pending').length;

  return (
    <PageContainer>
      <PageHeader
        title="État et diagnostics"
        description="Vérification technique distincte de la joignabilité HTTP du serveur et de l'état fonctionnel réel des composants."
        meta={
          <span className="tabular-nums">
            {executedCount === 0
              ? 'Aucune vérification exécutée'
              : `${passedCount} conforme(s) · ${warningCount} avertissement(s) · ${failedCount} échec(s) sur ${tests.length}`}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={handleRunAll}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Exécution en cours...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Lancer les diagnostics</span>
              </>
            )}
          </button>
        }
      />

      {/* Liste structurée des diagnostics */}
      <SectionCard
        title="Contrôles techniques par composant"
        description="Les contrôles non encore exécutés restent explicitement marqués « Non exécuté »."
        noPadding
      >
        <div className="divide-y divide-gray-200 dark:divide-[#2c313a]">
          {tests.map((test) => {
            const Icon = CATEGORY_ICONS[test.category];
            const badge = mapTestStatusToBadge(test.status);

            return (
              <div
                key={test.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {test.name}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        · {CATEGORY_LABELS[test.category]}
                      </span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">{test.description}</p>
                    {test.details && (
                      <p className="font-mono text-gray-700 dark:text-gray-300 pt-0.5">
                        {test.details}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                  {test.durationMs !== undefined && (
                    <span className="font-mono text-gray-500 dark:text-gray-400 tabular-nums">
                      {test.durationMs} ms
                    </span>
                  )}
                  <StatusBadge state={badge.state} label={badge.label} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Journal d'exécution */}
      <SectionCard
        title={
          <>
            <Terminal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>Journal d&apos;exécution des sondes HTTP</span>
          </>
        }
      >
        <div className="p-3 bg-gray-50 dark:bg-[#111318] rounded-md border border-gray-200 dark:border-[#2c313a] font-mono text-xs text-gray-700 dark:text-gray-300 space-y-1 max-h-56 overflow-y-auto">
          {consoleLogs.map((log, idx) => (
            <div
              key={idx}
              className={
                log.startsWith('[OK]')
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : log.startsWith('[ÉCHEC]')
                  ? 'text-red-700 dark:text-red-400'
                  : log.startsWith('[AVERT.]')
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
              }
            >
              {log}
            </div>
          ))}
        </div>
      </SectionCard>
    </PageContainer>
  );
};
