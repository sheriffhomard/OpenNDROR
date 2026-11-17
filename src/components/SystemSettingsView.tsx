import React, { useState } from 'react';
import {
  RefreshCw,
  DownloadCloud,
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Sun,
  Moon,
  Scale,
  Compass,
  Smartphone,
  History,
  Zap,
} from 'lucide-react';
import { SystemUpdateState } from '../types/system';
import { HelpTooltip } from './HelpTooltip';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeMode } from '../hooks/useTheme';

interface SystemSettingsViewProps {
  updateState: SystemUpdateState | null;
  isCheckingUpdate: boolean;
  isForcingUpdate: boolean;
  isSavingConfig: boolean;
  onCheckForUpdates: () => Promise<void>;
  onForceUpdate: () => Promise<void>;
  onUpdateAutoConfig: (enabled: boolean, intervalMinutes: number) => Promise<void>;
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
  showGuide: boolean;
  onSetShowGuide: (visible: boolean) => void;
  onOpenLegalModal: () => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not scheduled';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  updateState,
  isCheckingUpdate,
  isForcingUpdate,
  isSavingConfig,
  onCheckForUpdates,
  onForceUpdate,
  onUpdateAutoConfig,
  theme,
  onSetTheme,
  showGuide,
  onSetShowGuide,
  onOpenLegalModal,
  onNotify,
}) => {
  const [selectedInterval, setSelectedInterval] = useState<number>(
    updateState?.check_interval_minutes ?? 15
  );

  const autoEnabled = updateState?.auto_update_enabled ?? true;
  const currentInterval = updateState?.check_interval_minutes ?? selectedInterval;

  const handleToggleAutoUpdate = async () => {
    await onUpdateAutoConfig(!autoEnabled, currentInterval);
  };

  const handleIntervalChange = async (minutes: number) => {
    setSelectedInterval(minutes);
    await onUpdateAutoConfig(autoEnabled, minutes);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                System Settings & Automated Updates
              </h2>
              <HelpTooltip
                title="System Settings"
                description="Central control panel for checking software releases, forcing synchronization, enabling automatic background updates, switching display themes, and installing the app."
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Monitor release versions, check and install updates automatically in the background,
              switch between Light and Dark themes, or install OpenNDR as a standalone desktop/mobile app.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCheckForUpdates}
              disabled={isCheckingUpdate || isForcingUpdate}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
            </button>

            <button
              type="button"
              onClick={onForceUpdate}
              disabled={isForcingUpdate || isCheckingUpdate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isForcingUpdate ? 'animate-bounce' : ''}`} />
              <span>{isForcingUpdate ? 'Updating...' : 'Force Update'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Release & Check Timestamps KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Current Version</span>
              <HelpTooltip
                title="Current Installed Version"
                description="Shows the semantic version and build revision of the OpenNDR platform currently running on this sensor."
              />
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            v{updateState?.current_version || '0.2.0'}{' '}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              (rev {updateState?.build_revision ?? 1})
            </span>
          </div>
          <div className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {updateState?.update_available
              ? `New release v${updateState.available_version} available`
              : 'Status: Up to date'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Release Date</span>
              <HelpTooltip
                title="Release Date"
                description="Official publication date of the currently active OpenNDR release or latest forced synchronization."
              />
            </span>
            <Calendar className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {updateState?.release_date || '2026-11-17'}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Channel: <span className="font-mono text-slate-700 dark:text-slate-300">{updateState?.channel || 'stable'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Last Update Check</span>
              <HelpTooltip
                title="Last Check Date"
                description="Exact date and time when OpenNDR last checked for new versions manually or via the background scheduler."
              />
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatDateTime(updateState?.last_checked_at)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Next scheduled: <span className="font-mono">{formatDateTime(updateState?.next_scheduled_check_at)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <span>Background Auto-Updater</span>
              <HelpTooltip
                title="Background Auto-Update Service"
                description="When active, both the server scheduler and the PWA Service Worker check periodically for new releases and apply them automatically in the background."
              />
            </span>
            <Zap className={`w-4 h-4 ${autoEnabled ? 'text-emerald-500' : 'text-slate-400'}`} />
          </div>
          <div className={`text-lg font-bold font-mono ${autoEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {autoEnabled ? 'ACTIVE' : 'PAUSED'}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Last install: {formatDateTime(updateState?.last_updated_at)}
          </div>
        </div>
      </div>

      {/* Auto-Update Policy + Appearance & Install Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Background Auto-Update Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Background Auto-Update Policy</span>
                <HelpTooltip
                  title="Automatic Background Updates"
                  description="Periodically verifies release manifests, Rust engine binary health, and frontend PWA Service Worker caches without interrupting active capture."
                />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure unattended verification and automatic installation cadence
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              PWA autoUpdate
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Enable automatic background updates</span>
                  <HelpTooltip
                    title="Auto-Update Toggle"
                    description="Turn ON to let OpenNDR automatically poll and install updates in the background. Turn OFF to restrict updates to manual checks only."
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Server worker &amp; client Service Worker stay synchronized automatically.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoEnabled}
                disabled={isSavingConfig}
                onClick={handleToggleAutoUpdate}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  autoEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                    autoEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <label
                  htmlFor="update-interval-select"
                  className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5"
                >
                  <span>Background check frequency</span>
                  <HelpTooltip
                    title="Polling Interval"
                    description="How often the background scheduler checks for new software releases and verifies component integrity."
                  />
                </label>
                <p className="text-slate-500 dark:text-slate-400">
                  Applies to server background task &amp; active browser session
                </p>
              </div>
              <select
                id="update-interval-select"
                value={currentInterval}
                disabled={isSavingConfig || !autoEnabled}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value={1}>Every 1 min</option>
                <option value={5}>Every 5 min</option>
                <option value={15}>Every 15 min</option>
                <option value={60}>Every 1 hour</option>
                <option value={360}>Every 6 hours</option>
              </select>
            </div>

            {updateState?.release_notes && (
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Active Release Notes
                </div>
                <p className="leading-relaxed">{updateState.release_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Appearance, Onboarding, Legal & App Install */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Appearance, Onboarding & App Installation</span>
              <HelpTooltip
                title="Console Preferences & PWA"
                description="Customize Light/Dark contrast, enable or hide beginner explanations, review legal liability terms, or install OpenNDR onto your desktop or phone."
              />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Display theme, guided help controls, and progressive web app installation
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Theme Selector */}
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Color Theme</span>
                  <HelpTooltip
                    title="Light & Dark Theme"
                    description="Switch between the crisp Light Theme for bright offices and the SOC Dark Theme for low-light operations rooms."
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Saved automatically in your browser preferences
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onSetTheme('light')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetTheme('dark')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            {/* Install App Card */}
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Install OpenNDR App (Desktop &amp; Mobile)</span>
                  <HelpTooltip
                    title="Install App (PWA)"
                    description="Adds OpenNDR directly to your smartphone home screen or computer desktop so novice users can launch it in one click like a native app."
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Dedicated standalone window with offline shell caching
                </p>
              </div>
              <PWAInstallButton variant="card" onNotify={onNotify} />
            </div>

            {/* Contextual Onboarding & Legal Notice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => onSetShowGuide(!showGuide)}
                  className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
                >
                  <Compass className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{showGuide ? 'Hide Contextual Guide' : 'Show Contextual Guide'}</span>
                </button>
                <HelpTooltip
                  title="Contextual Onboarding"
                  description="Displays a step-by-step plain-English walkthrough banner at the top of every screen."
                  align="right"
                />
              </div>

              <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={onOpenLegalModal}
                  className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
                >
                  <Scale className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Review Legal Notice</span>
                </button>
                <HelpTooltip
                  title="Legal Disclaimer"
                  description="Opens the legal terms specifying that the author is not responsible for the data provided in the application."
                  align="right"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Update Check & Installation History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Update Verification & Installation Log
            </h3>
            <HelpTooltip
              title="Update History"
              description="Chronological log of every manual check, background auto-update poll, and forced update performed on this OpenNDR instance."
            />
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {updateState?.history?.length ?? 0} entries
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
          {(updateState?.history || []).map((entry) => (
            <div key={entry.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {entry.trigger}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      v{entry.from_version} → v{entry.to_version}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{entry.details}</p>
                </div>
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                {formatDateTime(entry.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
