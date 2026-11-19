import React, { useState } from 'react';
import {
  RefreshCw,
  DownloadCloud,
  Sun,
  Moon,
  Scale,
  Smartphone,
} from 'lucide-react';
import { PlatformHealth, SystemUpdateState } from '../types/system';
import { HelpTooltip } from './HelpTooltip';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeMode } from '../hooks/useTheme';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
  DataTable,
  ConfirmDialog,
} from './ui';

interface SystemSettingsViewProps {
  health: PlatformHealth | null;
  updateState: SystemUpdateState | null;
  isLoadingUpdates?: boolean;
  updatesError?: string | null;
  onRetryUpdates?: () => void;
  isCheckingUpdate: boolean;
  isForcingUpdate: boolean;
  isSavingConfig: boolean;
  onCheckForUpdates: () => Promise<void>;
  onForceUpdate: () => Promise<void>;
  onUpdateAutoConfig: (enabled: boolean, intervalMinutes: number) => Promise<void>;
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
  onOpenLegalModal: () => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Non disponible';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
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
  health,
  updateState,
  isLoadingUpdates = false,
  updatesError = null,
  onRetryUpdates,
  isCheckingUpdate,
  isForcingUpdate,
  isSavingConfig,
  onCheckForUpdates,
  onForceUpdate,
  onUpdateAutoConfig,
  theme,
  onSetTheme,
  onOpenLegalModal,
  onNotify,
}) => {
  const [confirmForceOpen, setConfirmForceOpen] = useState(false);

  const autoEnabled = updateState?.auto_update_enabled;
  const currentInterval = updateState?.check_interval_minutes;

  const handleToggleAutoUpdate = async () => {
    if (!updateState) return;
    await onUpdateAutoConfig(!updateState.auto_update_enabled, updateState.check_interval_minutes);
  };

  const handleIntervalChange = async (minutes: number) => {
    if (!updateState) return;
    await onUpdateAutoConfig(updateState.auto_update_enabled, minutes);
  };

  const handleConfirmForceUpdate = async () => {
    await onForceUpdate();
    setConfirmForceOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Paramètres système"
        description="Administration de la plateforme, gestion des mises à jour, apparence de la console, préférences locales et mentions légales."
      />

      {updatesError && <ErrorState message={updatesError} onRetry={onRetryUpdates} />}

      {/* 1. Système */}
      <SectionCard
        title="Système"
        description="Informations générales fournies par le serveur d'administration"
      >
        {isLoadingUpdates && !updateState && !health ? (
          <LoadingState message="Lecture des informations système..." />
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Version installée</dt>
              <dd className="mt-1 font-mono font-semibold text-sm text-gray-900 dark:text-gray-100 tabular-nums">
                {updateState?.current_version
                  ? `v${updateState.current_version} (rév. ${updateState.build_revision})`
                  : health?.version
                  ? `v${health.version}`
                  : 'Non disponible'}
              </dd>
            </div>

            <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Plateforme cible</dt>
              <dd className="mt-1 font-semibold text-sm text-gray-900 dark:text-gray-100">
                {health?.target_platform || 'Non disponible'}
              </dd>
            </div>

            <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400 mb-1">Intégrité du moteur Rust</dt>
              <dd>
                {updateState === null ? (
                  <StatusBadge state="unknown" label="Inconnu" />
                ) : updateState.engine_integrity_ok ? (
                  <StatusBadge state="operational" label="Binaire vérifié" />
                ) : (
                  <StatusBadge state="degraded" label="Binaire absent sur l'hôte" />
                )}
              </dd>
            </div>

            <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Date de sortie</dt>
              <dd className="mt-1 font-mono font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                {updateState?.release_date || 'Non disponible'}
              </dd>
            </div>

            <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Canal de diffusion</dt>
              <dd className="mt-1 font-mono font-semibold text-gray-900 dark:text-gray-100">
                {updateState?.channel || 'Non disponible'}
              </dd>
            </div>

            <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
              <dt className="text-gray-500 dark:text-gray-400">Base de données</dt>
              <dd className="mt-1 font-mono font-semibold text-gray-900 dark:text-gray-100">
                {health?.database?.status || 'Non disponible'}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>

      {/* 2. Mises à jour */}
      <SectionCard
        title={
          <>
            <span>Mises à jour</span>
            <HelpTooltip
              title="Gestion des mises à jour"
              description="Permet de vérifier la disponibilité d'une version, de forcer la synchronisation ou de régler le service automatique en arrière-plan."
            />
          </>
        }
        description="Vérification manuelle et politique de synchronisation automatique"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCheckForUpdates}
              disabled={!updateState || isCheckingUpdate || isForcingUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Vérification...' : 'Vérifier les mises à jour'}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmForceOpen(true)}
              disabled={!updateState || isForcingUpdate || isCheckingUpdate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>{isForcingUpdate ? 'Mise à jour...' : 'Forcer la mise à jour'}</span>
            </button>
          </div>
        }
      >
        {!updateState ? (
          <EmptyState
            title="État des mises à jour indisponible"
            description="Les informations de version et de planification n'ont pas pu être récupérées depuis le serveur."
            action={
              onRetryUpdates && (
                <button
                  type="button"
                  onClick={onRetryUpdates}
                  className="px-3.5 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1f2329]"
                >
                  Réessayer
                </button>
              )
            }
          />
        ) : (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">Dernière vérification</div>
                <div className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatDateTime(updateState.last_checked_at)}
                </div>
              </div>

              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">Prochaine vérification planifiée</div>
                <div className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {updateState.auto_update_enabled
                    ? formatDateTime(updateState.next_scheduled_check_at)
                    : 'Désactivée'}
                </div>
              </div>

              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="text-gray-500 dark:text-gray-400">Dernière installation</div>
                <div className="mt-1 font-mono font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatDateTime(updateState.last_updated_at)}
                </div>
              </div>
            </div>

            {/* Politique automatique */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between gap-4 p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    Mises à jour automatiques en arrière-plan
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                    Synchronise périodiquement l&apos;état applicatif et le cache PWA.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(autoEnabled)}
                  disabled={isSavingConfig}
                  onClick={handleToggleAutoUpdate}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    autoEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
                      autoEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div>
                  <label
                    htmlFor="update-interval-select"
                    className="font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Fréquence de vérification
                  </label>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                    Intervalle de contrôle automatique côté serveur
                  </p>
                </div>
                <select
                  id="update-interval-select"
                  value={currentInterval ?? 15}
                  disabled={isSavingConfig || !autoEnabled}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#181b20] text-gray-900 dark:text-gray-100 font-mono text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value={1}>Toutes les 1 min</option>
                  <option value={5}>Toutes les 5 min</option>
                  <option value={15}>Toutes les 15 min</option>
                  <option value={60}>Toutes les 1 h</option>
                  <option value={360}>Toutes les 6 h</option>
                </select>
              </div>
            </div>

            {updateState.release_notes && (
              <div className="p-3.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318]">
                <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Notes de version
                </div>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {updateState.release_notes}
                </p>
              </div>
            )}

            {/* Historique */}
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Historique des vérifications et installations ({updateState.history.length})
              </div>
              {updateState.history.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  Aucun événement de mise à jour enregistré.
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-[#2c313a] rounded-md overflow-hidden max-h-60 overflow-y-auto">
                  <DataTable>
                    <thead className="bg-gray-50 dark:bg-[#111318] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#2c313a]">
                      <tr>
                        <th className="px-3.5 py-2 font-medium">Date</th>
                        <th className="px-3.5 py-2 font-medium">Déclencheur</th>
                        <th className="px-3.5 py-2 font-medium">Version</th>
                        <th className="px-3.5 py-2 font-medium">Détails</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#2c313a]">
                      {updateState.history.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3.5 py-2 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">
                            {formatDateTime(entry.timestamp)}
                          </td>
                          <td className="px-3.5 py-2 font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {entry.trigger}
                          </td>
                          <td className="px-3.5 py-2 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            v{entry.from_version} → v{entry.to_version}
                          </td>
                          <td className="px-3.5 py-2 text-gray-600 dark:text-gray-300">
                            {entry.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* 3. Affichage & 4. Préférences utilisateur & 5. Informations légales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Affichage */}
        <SectionCard
          title="Affichage"
          description="Thème visuel de la console"
        >
          <div className="space-y-3 text-xs">
            <p className="text-gray-600 dark:text-gray-400">
              Choisissez entre le thème clair (environnement bureautique) et le thème sombre.
            </p>
            <div className="inline-flex rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-100 dark:bg-[#111318] p-1 gap-1">
              <button
                type="button"
                onClick={() => onSetTheme('light')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Clair</span>
              </button>
              <button
                type="button"
                onClick={() => onSetTheme('dark')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#1f2329] text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Sombre</span>
              </button>
            </div>
          </div>
        </SectionCard>

        {/* 4. Préférences utilisateur */}
        <SectionCard
          title={
            <>
              <Smartphone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>Préférences utilisateur</span>
            </>
          }
          description="Installation locale de la console (PWA)"
        >
          <div className="space-y-3 text-xs">
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Installez l&apos;application sur votre poste de travail ou appareil mobile pour un
              accès direct dans une fenêtre dédiée.
            </p>
            <PWAInstallButton onNotify={onNotify} />
          </div>
        </SectionCard>

        {/* 5. Informations légales */}
        <SectionCard
          title={
            <>
              <Scale className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>Informations légales</span>
            </>
          }
          description="Licence et clause de non-responsabilité"
        >
          <div className="space-y-3 text-xs">
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Consultez les mentions légales précisant que l&apos;auteur de l&apos;application
              n&apos;est pas responsable des données affichées ou fournies.
            </p>
            <button
              type="button"
              onClick={onOpenLegalModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-100 font-medium transition-colors"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Consulter les mentions légales</span>
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Confirmation forcer la mise à jour */}
      <ConfirmDialog
        isOpen={confirmForceOpen}
        title="Forcer la synchronisation de mise à jour ?"
        message="Cette action vérifie immédiatement l'intégrité du moteur et applique la dernière version disponible côté serveur."
        confirmLabel="Forcer la mise à jour"
        variant="primary"
        isBusy={isForcingUpdate}
        onConfirm={handleConfirmForceUpdate}
        onCancel={() => setConfirmForceOpen(false)}
      />
    </PageContainer>
  );
};
