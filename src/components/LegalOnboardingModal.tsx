import React, { useState } from 'react';
import { Scale, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface LegalOnboardingModalProps {
  isOpen: boolean;
  alreadyAccepted: boolean;
  onAccept: () => void;
  onClose?: () => void;
}

export const LegalOnboardingModal: React.FC<LegalOnboardingModalProps> = ({
  isOpen,
  alreadyAccepted,
  onAccept,
  onClose,
}) => {
  const [checked, setChecked] = useState(alreadyAccepted);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-onboarding-title"
    >
      <div className="bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-lg max-w-lg w-full p-6 space-y-5 shadow-xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-[#2c313a]">
          <AppLogo className="w-9 h-9 shrink-0" />
          <div>
            <h2
              id="legal-onboarding-title"
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              OpenNDR — Conditions d&apos;utilisation et mentions légales
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Console d&apos;administration et de supervision réseau (NDR)
            </p>
          </div>
        </div>

        {/* Explicit Legal Disclaimer */}
        <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
            <Scale className="w-4 h-4 shrink-0" />
            <span>Clause de non-responsabilité</span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            <strong>Non-responsabilité sur les données fournies :</strong> l&apos;auteur, l&apos;éditeur et les
            contributeurs d&apos;OpenNDR ne sont <strong>pas responsables</strong> des données, captures
            réseau (PCAP/PCAPNG), journaux, adresses IP, comptes ou fichiers de configuration fournis,
            importés ou analysés dans cette application.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Ce logiciel est distribué sous licence <strong>AGPL-3.0</strong> en l&apos;état, sans aucune
            garantie. L&apos;opérateur demeure seul responsable de disposer des autorisations légales de
            supervision sur les réseaux inspectés et du respect des réglementations applicables.
          </p>
        </div>

        {/* Acceptance Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-md border border-gray-200 dark:border-[#2c313a] bg-gray-50 dark:bg-[#111318] cursor-pointer text-xs select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Je reconnais avoir pris connaissance des mentions légales et je confirme que l&apos;auteur
            n&apos;est pas responsable des données fournies ou traitées dans l&apos;application.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Consultable à tout moment dans Paramètres système
          </span>
          <div className="flex items-center gap-2">
            {alreadyAccepted && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
              >
                Fermer
              </button>
            )}
            <button
              type="button"
              disabled={!checked}
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              {checked ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              <span>{alreadyAccepted ? 'Confirmer' : 'Accepter et continuer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
