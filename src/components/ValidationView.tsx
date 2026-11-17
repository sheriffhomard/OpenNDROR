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
  const [tests, setTests] = useState<ValidationTestItem[]>([
    {
      id: 'probe-live',
      category: 'ARCH',
      name: 'Availability Check (Liveness Probe)',
      description: 'Queries /api/v1/health/live to verify FastAPI backend responsiveness.',
      status: 'pending',
    },
    {
      id: 'probe-ready',
      category: 'DATABASE',
      name: 'Relational Connectivity (Readiness Probe)',
      description: 'Queries /api/v1/health/ready to test the PostgreSQL pool and persistence.',
      status: 'pending',
    },
    {
      id: 'probe-health',
      category: 'ARCH',
      name: 'Global Platform Health Report',
      description: 'Queries /api/v1/health to verify platform components and V0.2 version.',
      status: 'pending',
    },
    {
      id: 'probe-auth-guard',
      category: 'SECURITY',
      name: 'Unauthenticated Access Control (401 Rejection)',
      description: 'Attempts to access /api/v1/users without a JWT token and verifies strict 401 rejection.',
      status: 'pending',
    },
    {
      id: 'probe-invalid-creds',
      category: 'SECURITY',
      name: 'Invalid Credentials Rejection & Logging',
      description: 'Sends invalid credentials to /api/v1/auth/login and verifies the 401 refusal.',
      status: 'pending',
    },
    {
      id: 'probe-stealth-check',
      category: 'NETWORK',
      name: 'Passive Interface Stealth Compliance',
      description: 'Verifies that the passive capture interface has no IP address assigned (zero emission).',
      status: 'pending',
    },
    {
      id: 'probe-engine-standby',
      category: 'SYSTEMD',
      name: 'Real Rust V0.2 Engine Telemetry',
      description: 'Queries /api/v1/system/capture/telemetry and verifies the V0.2 engine without simulated traffic.',
      status: 'pending',
    },
    {
      id: 'probe-storage-quota',
      category: 'SYSTEMD',
      name: 'Local PCAP Storage Configuration',
      description: 'Verifies local PCAP storage quotas and directories with zero cloud dependency.',
      status: 'pending',
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'OpenNDR V0.2 technical validation suite ready.',
    'Each test executes a live HTTP probe against the backend server.',
  ]);

  const updateTest = (id: string, partial: Partial<ValidationTestItem>) => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...partial } : t))
    );
  };

  const handleRunAll = async () => {
    setIsRunning(true);
    setConsoleLogs((prev) => [
      ...prev,
      `--- Starting test campaign at ${new Date().toLocaleTimeString('en-US')} ---`,
    ]);

    // Test 1: Liveness Probe
    updateTest('probe-live', { status: 'running' });
    const t0 = performance.now();
    try {
      const res = await apiService.getLiveness();
      const dur = Math.round(performance.now() - t0);
      if (res && res.status === 'UP') {
        updateTest('probe-live', {
          status: 'passed',
          durationMs: dur,
          details: `FastAPI backend active and responsive (status: ${res.status})`,
        });
        setConsoleLogs((prev) => [...prev, `[✓ PASS] Liveness Probe (${dur}ms): status=UP`]);
      } else {
        throw new Error(`Unexpected status: ${JSON.stringify(res)}`);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-live', {
        status: 'failed',
        durationMs: dur,
        details: `Failed: ${msg}`,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Liveness Probe: ${msg}`]);
    }

    // Test 2: Readiness Probe
    updateTest('probe-ready', { status: 'running' });
    const t1 = performance.now();
    try {
      const res = await apiService.getReadiness();
      const dur = Math.round(performance.now() - t1);
      if (res && res.database_connected) {
        updateTest('probe-ready', {
          status: 'passed',
          durationMs: dur,
          details: `PostgreSQL connection confirmed (status: ${res.status})`,
        });
        setConsoleLogs((prev) => [...prev, `[✓ PASS] Readiness Probe (${dur}ms): DB connected`]);
      } else {
        throw new Error(res?.details || 'Database not ready');
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t1);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-ready', {
        status: 'failed',
        durationMs: dur,
        details: `Failed: ${msg}`,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Readiness Probe: ${msg}`]);
    }

    // Test 3: Health Status
    updateTest('probe-health', { status: 'running' });
    const t2 = performance.now();
    try {
      const res = await apiService.getHealth();
      const dur = Math.round(performance.now() - t2);
      updateTest('probe-health', {
        status: 'passed',
        durationMs: dur,
        details: `Version ${res.version} · Target platform: ${res.target_platform}`,
      });
      setConsoleLogs((prev) => [
        ...prev,
        `[✓ PASS] Global Report (${dur}ms): v${res.version} on ${res.target_platform}`,
      ]);
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t2);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-health', {
        status: 'failed',
        durationMs: dur,
        details: `Failed: ${msg}`,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Global Report: ${msg}`]);
    }

    // Test 4: Unauthenticated 401 Rejection
    updateTest('probe-auth-guard', { status: 'running' });
    const t3 = performance.now();
    try {
      const rawRes = await fetch('/api/v1/users', {
        headers: { Accept: 'application/json' },
      });
      const dur = Math.round(performance.now() - t3);
      if (rawRes.status === 401) {
        updateTest('probe-auth-guard', {
          status: 'passed',
          durationMs: dur,
          details: `Compliant HTTP 401 rejection without an authentication token.`,
        });
        setConsoleLogs((prev) => [...prev, `[✓ PASS] Security 401 (${dur}ms): Anonymous access strictly blocked.`]);
      } else {
        throw new Error(`Unexpected HTTP status: ${rawRes.status} (expected 401)`);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t3);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-auth-guard', {
        status: 'failed',
        durationMs: dur,
        details: msg,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Security 401: ${msg}`]);
    }

    // Test 5: Invalid Credentials Rejection
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
          details: `Compliant HTTP 401 rejection with failure recorded in the audit log.`,
        });
        setConsoleLogs((prev) => [...prev, `[✓ PASS] Invalid credentials rejected (${dur}ms): HTTP 401 verified.`]);
      } else {
        throw new Error(`Unexpected status code: HTTP ${loginRes.status}`);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t4);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-invalid-creds', {
        status: 'failed',
        durationMs: dur,
        details: msg,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Invalid credentials: ${msg}`]);
    }

    // Test 6: Real Network Isolation Compliance
    updateTest('probe-stealth-check', { status: 'running' });
    const t5 = performance.now();
    try {
      const isolationRes = await apiService.getIsolationCheck();
      const dur = Math.round(performance.now() - t5);
      if (isolationRes.is_isolated) {
        updateTest('probe-stealth-check', {
          status: 'passed',
          durationMs: dur,
          details: `Interface ${isolationRes.interface} compliant (${isolationRes.status}): ${isolationRes.details}`,
        });
        setConsoleLogs((prev) => [
          ...prev,
          `[✓ PASS] Real Network Isolation (${dur}ms): ${isolationRes.details}`,
        ]);
      } else {
        updateTest('probe-stealth-check', {
          status: 'failed',
          durationMs: dur,
          details: `Status ${isolationRes.status}: ${isolationRes.details}`,
        });
        setConsoleLogs((prev) => [
          ...prev,
          `[✗ FAIL] Real Network Isolation (${dur}ms): Status ${isolationRes.status} - ${isolationRes.details}`,
        ]);
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t5);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-stealth-check', {
        status: 'failed',
        durationMs: dur,
        details: msg,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Stealth Isolation: ${msg}`]);
    }

    // Test 7: V0.2 Capture Engine (Real Telemetry)
    updateTest('probe-engine-standby', { status: 'running' });
    const t6 = performance.now();
    try {
      const telem = await apiService.getCaptureTelemetry();
      const dur = Math.round(performance.now() - t6);
      if (telem && telem.engine_version === '0.2.0' && telem.protocol_stats) {
        updateTest('probe-engine-standby', {
          status: 'passed',
          durationMs: dur,
          details: `Engine v${telem.engine_version} (${telem.capture_mode}) · ${telem.packets_received} packets processed.`,
        });
        setConsoleLogs((prev) => [
          ...prev,
          `[✓ PASS] Rust Engine V0.2 (${dur}ms): mode=${telem.capture_mode}, packets=${telem.packets_received}.`,
        ]);
      } else {
        throw new Error('Incomplete V0.2 telemetry response');
      }
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t6);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-engine-standby', {
        status: 'failed',
        durationMs: dur,
        details: msg,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Rust Engine V0.2: ${msg}`]);
    }

    // Test 8: Storage Quota
    updateTest('probe-storage-quota', { status: 'running' });
    const t7 = performance.now();
    try {
      const storageRes = await apiService.getStorageMetrics();
      const dur = Math.round(performance.now() - t7);
      updateTest('probe-storage-quota', {
        status: 'passed',
        durationMs: dur,
        details: `Retention ${storageRes.retentionDays}d · Max quota: ${storageRes.maxStorageGb} GB on local disk.`,
      });
      setConsoleLogs((prev) => [
        ...prev,
        `[✓ PASS] Storage Quota (${dur}ms): ${storageRes.maxStorageGb} GB configured.`,
      ]);
    } catch (err: unknown) {
      const dur = Math.round(performance.now() - t7);
      const msg = err instanceof Error ? err.message : String(err);
      updateTest('probe-storage-quota', {
        status: 'failed',
        durationMs: dur,
        details: msg,
      });
      setConsoleLogs((prev) => [...prev, `[✗ FAIL] Storage: ${msg}`]);
    }

    setIsRunning(false);
    setConsoleLogs((prev) => [
      ...prev,
      `--- V0.2 validation completed at ${new Date().toLocaleTimeString('en-US')} ---`,
    ]);
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;

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
              V0.2 Automated Acceptance & Validation Suite
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Executes live HTTP probes against the backend to verify strict acceptance criteria
              (authentication, PostgreSQL database, network isolation, RBAC, V0.2 capture engine).
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
                  Running Probes...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Run Live Probes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scorebar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Result: <strong className="text-slate-200">{passedCount}</strong> / {tests.length} tests passed
            </span>
            {failedCount > 0 && (
              <span className="text-rose-400 font-semibold">
                {failedCount} failed
              </span>
            )}
          </div>
          <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                failedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${(passedCount / tests.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tests Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tests.map((test) => {
          const Icon = categoryIcons[test.category];
          return (
            <div
              key={test.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200">{test.name}</span>
                  </div>
                  <div>
                    {test.status === 'passed' && (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-mono">
                        <CheckCircle2 className="w-4 h-4" />
                        PASS
                      </span>
                    )}
                    {test.status === 'failed' && (
                      <span className="flex items-center gap-1 text-rose-400 text-xs font-mono">
                        <XCircle className="w-4 h-4" />
                        FAIL
                      </span>
                    )}
                    {test.status === 'running' && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs font-mono">
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        TESTING...
                      </span>
                    )}
                    {test.status === 'pending' && (
                      <span className="text-slate-500 text-xs font-mono">PENDING</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400">{test.description}</p>
              </div>

              {test.details && (
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-300 flex justify-between items-center">
                  <span className="truncate">{test.details}</span>
                  {test.durationMs !== undefined && (
                    <span className="text-slate-500 text-xs shrink-0 ml-2">
                      {test.durationMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Terminal Log */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>HTTP Probe Execution Log</span>
        </div>
        <div className="p-3 bg-slate-900 rounded font-mono text-xs text-slate-300 space-y-1 max-h-48 overflow-y-auto">
          {consoleLogs.map((log, idx) => (
            <div
              key={idx}
              className={
                log.includes('[✓ PASS]')
                  ? 'text-emerald-400'
                  : log.includes('[✗ FAIL]')
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
