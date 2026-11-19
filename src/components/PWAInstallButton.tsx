import React, { useState } from 'react';
import { Download, Smartphone, Monitor, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppLogo } from './AppLogo';

interface PWAInstallButtonProps {
  onNotify?: (type: 'success' | 'error', text: string) => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onNotify }) => {
  const { canNativeInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleClick = async () => {
    if (canNativeInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        onNotify?.('success', 'OpenNDR a été installé en tant qu\'application.');
        return;
      }
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isInstalled}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
          isInstalled
            ? 'border border-gray-200 dark:border-[#2c313a] bg-gray-100 dark:bg-[#1f2329] text-gray-500 dark:text-gray-400 cursor-default'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isInstalled ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Application installée</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Installer l&apos;application</span>
          </>
        )}
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-[#2c313a]">
              <div className="flex items-center gap-2.5">
                <AppLogo className="w-7 h-7" />
                <div>
                  <h3 id="pwa-install-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Installer l&apos;application OpenNDR
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Ajout sur poste de travail ou écran d&apos;accueil mobile
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded"
                aria-label="Fermer le guide d'installation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {isIOS ? (
                <div className="p-3.5 rounded-md bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="space-y-1.5 text-gray-600 dark:text-gray-300">
                    <li className="flex items-center gap-1.5">
                      <span>1. Appuyez sur</span>
                      <Share className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400" />
                      <strong>Partager</strong>
                      <span>dans la barre Safari.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span>2. Choisissez</span>
                      <PlusSquare className="w-3.5 h-3.5 inline text-blue-600 dark:text-blue-400" />
                      <strong>Sur l&apos;écran d&apos;accueil</strong>.
                    </li>
                    <li>3. Confirmez en appuyant sur <strong>Ajouter</strong>.</li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-md bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                      <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Ordinateur (Chrome, Edge, Chromium)</span>
                    </div>
                    <p>
                      Cliquez sur l&apos;icône d&apos;installation dans la barre d&apos;adresse du navigateur ou
                      ouvrez le menu du navigateur puis sélectionnez <strong>Installer OpenNDR</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-md bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                      <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Mobile (Android Chrome / iOS Safari)</span>
                    </div>
                    <p>
                      Sur Android, ouvrez le menu du navigateur et choisissez <strong>Installer l&apos;application</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
