import React, { useState } from 'react';
import { Download, Smartphone, Monitor, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppLogo } from './AppLogo';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card' | 'drawer';
  onNotify?: (type: 'success' | 'error', text: string) => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onNotify,
}) => {
  const { canNativeInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleClick = async () => {
    if (canNativeInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        onNotify?.('success', 'OpenNDR has been installed as an application.');
        return;
      }
    }
    setShowGuideModal(true);
  };

  if (isInstalled && variant === 'header') {
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleClick}
          title="Install OpenNDR on your desktop or mobile home screen"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Install App</span>
          <span className="md:hidden">Install</span>
        </button>
      )}

      {variant === 'drawer' && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium transition-colors"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 shrink-0" />
            <span>{isInstalled ? 'App Installed (Standalone)' : 'Install App on Device'}</span>
          </span>
          {!isInstalled && <span className="text-[11px] font-mono opacity-80">PWA</span>}
        </button>
      )}

      {variant === 'card' && (
        <button
          type="button"
          onClick={handleClick}
          disabled={isInstalled}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            isInstalled
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
          }`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Already Installed</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </>
          )}
        </button>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <AppLogo className="w-7 h-7" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Install OpenNDR Application
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Add to your desktop or mobile home screen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg"
                aria-label="Close installation guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isIOS ? (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                    <span>iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-1.5">
                      <span>1. Tap the</span>
                      <Share className="w-3.5 h-3.5 inline text-sky-500" />
                      <strong>Share</strong>
                      <span>button in Safari&apos;s toolbar.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span>2. Select</span>
                      <PlusSquare className="w-3.5 h-3.5 inline text-emerald-500" />
                      <strong>Add to Home Screen</strong>.
                    </li>
                    <li>3. Confirm the name &quot;OpenNDR&quot; and tap <strong>Add</strong>.</li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <Monitor className="w-4 h-4 text-emerald-500" />
                      <span>Desktop (Chrome, Edge, Brave, Debian Chromium)</span>
                    </div>
                    <p>
                      Click the <strong>Install OpenNDR</strong> icon in your browser&apos;s address bar
                      (top-right) or open the browser menu and select <strong>Install OpenNDR...</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <Smartphone className="w-4 h-4 text-sky-500" />
                      <span>Mobile (Android Chrome / iOS Safari)</span>
                    </div>
                    <p>
                      On Android, open the browser menu and tap <strong>Install app</strong> or{' '}
                      <strong>Add to Home screen</strong>. On iOS Safari, tap <strong>Share</strong> →{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Once installed, OpenNDR launches in its own dedicated window with automatic background updates
                enabled.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
