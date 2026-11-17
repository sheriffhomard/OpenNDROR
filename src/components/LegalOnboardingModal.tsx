import React, { useState } from 'react';
import { Scale, ShieldAlert, CheckCircle2, HelpCircle, Menu, Settings, SunMoon } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-onboarding-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Welcome Header */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-slate-200 dark:border-slate-800">
          <AppLogo className="w-11 h-11 shrink-0" />
          <div>
            <h2
              id="legal-onboarding-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Welcome to OpenNDR — Quick Start & Legal Notice
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Sovereign Network Detection & Response Console (v0.2.0) designed to be clear and accessible even for first-time users.
            </p>
          </div>
        </div>

        {/* Novice Quick Tour */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
              <Menu className="w-3.5 h-3.5 text-emerald-500" />
              <span>Categorized Menu</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Use the top-left Hamburger icon to explore features organized cleanly by category.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
              <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
              <span>Field Tooltips</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Hover or tap any <span className="font-mono">(?)</span> icon on any screen to get plain-English explanations.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
              <SunMoon className="w-3.5 h-3.5 text-amber-500" />
              <span>Themes & Updates</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Switch between Light and Dark themes anytime and manage auto-updates in System Settings.
            </p>
          </div>
        </div>

        {/* Explicit Legal Disclaimer */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
            <Scale className="w-4 h-4 shrink-0" />
            <span>Legal Notice & Disclaimer of Responsibility</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong>Non-Responsibility for Provided Data:</strong> The author, publisher, and contributors of
            OpenNDR are <strong>not responsible</strong> for any data, PCAP/PCAPNG packet captures, network
            logs, IP addresses, user records, or configuration payloads provided, uploaded, or analyzed
            within this application.
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            This platform is distributed under the <strong>AGPL-3.0</strong> license &quot;as is&quot;, without
            warranty of any kind. As the operator, you remain solely responsible for holding legal
            authorization to monitor the targeted networks and for complying with applicable data
            protection regulations (such as GDPR).
          </p>
        </div>

        {/* Acceptance Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer text-xs select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
            I acknowledge the legal notices above and confirm that the author is not responsible for the
            data provided, uploaded, or processed in this application.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Settings className="w-3.5 h-3.5" />
            <span>Accessible anytime from System Settings</span>
          </div>
          <div className="flex items-center gap-2">
            {alreadyAccepted && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
              >
                Close
              </button>
            )}
            <button
              type="button"
              disabled={!checked}
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-sm"
            >
              {checked ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              <span>{alreadyAccepted ? 'Confirm & Close' : 'Accept & Continue'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
