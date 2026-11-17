import React from 'react';
import { Compass, X, HelpCircle, LogIn } from 'lucide-react';
import { TabId } from './Navigation';

interface ContextualOnboardingProps {
  activeTab: TabId;
  isVisible: boolean;
  isAuthenticated: boolean;
  onDismiss: () => void;
  onOpenLogin: () => void;
}

interface ScreenGuide {
  title: string;
  summary: string;
  steps: string[];
  noviceTip: string;
}

const SCREEN_GUIDES: Record<TabId, ScreenGuide> = {
  dashboard: {
    title: 'Dashboard Guide — Reading Sensor Health at a Glance',
    summary:
      'This home screen summarizes whether your network sensor is running properly, safely isolated, and how much local disk space captured files use.',
    steps: [
      'Sign in using the SOC Sign In button (top-right) to load live backend telemetry.',
      'Verify Stealth Compliance shows zero IP leak on the passive capture interface.',
      'Check the 4 systemd services at the bottom are active or ready.',
    ],
    noviceTip: 'Hover or tap any (?) icon beside a card or metric to read what it measures.',
  },
  capture: {
    title: 'Capture & Decoding Guide — Inspecting Real Network Traffic',
    summary:
      'Here you can start/stop live passive packet capture or upload a recorded .pcap / .pcapng file to inspect Ethernet, IP, TCP, UDP, ICMP, and ARP frames.',
    steps: [
      'Upload a .pcap or .pcapng trace from your computer, or enter a server trace path.',
      'Review the L2–L4 protocol breakdown bars to see traffic proportions.',
      'Use the protocol buttons or search box to filter individual decoded packets.',
    ],
    noviceTip: 'Passive capture only listens without transmitting anything back onto the network.',
  },
  interfaces: {
    title: 'Interfaces & Isolation Guide — Why Two Network Ports Matter',
    summary:
      'A secure NDR sensor separates the Administration port (used to view this dashboard) from the Passive Capture port (connected to a network mirror/SPAN).',
    steps: [
      'Click an interface card (e.g., eth0 or eth1) to inspect its link speed, MTU, and MAC.',
      'Verify that the CAPTURE_PASSIVE port has no IP address assigned.',
      'Use the kernel sysctl commands shown at the bottom when deploying on Debian 13.',
    ],
    noviceTip: 'Keeping the capture port without an IP makes the sensor invisible to attackers.',
  },
  rbac: {
    title: 'RBAC & Access Guide — Managing Team Permissions Safely',
    summary:
      'Role-Based Access Control ensures every user only sees and operates what their security role permits (Administrator, Analyst, or Observer).',
    steps: [
      'Review existing SOC accounts in the directory table.',
      'Administrators can click Create Account to provision an Analyst or Observer.',
      'Check the bottom matrix to see exact API permissions granted to each role.',
    ],
    noviceTip: 'Leave the password field empty when creating a user to generate a secure random temporary password.',
  },
  audit: {
    title: 'Audit Log Guide — Tracking Every Security Action',
    summary:
      'Every sign-in, failed login, user creation, update check, and PCAP ingestion is recorded chronologically so nothing happens unseen.',
    steps: [
      'Filter events by status (SUCCESS, DENIED, FAILURE) or search by user/action.',
      'Click any row on the left to inspect its structured JSONB details on the right.',
      'Watch for repeated FAILURE entries to spot unauthorized login attempts.',
    ],
    noviceTip: 'Timestamps are stored in UTC so logs stay consistent across servers.',
  },
  validation: {
    title: 'Validation & Probes Guide — Verifying System Readiness',
    summary:
      'Run automated live HTTP health checks against the OpenNDR server to verify database connectivity, authentication blocking, capture engine readiness, and storage.',
    steps: [
      'Click Run Live Probes to execute all 8 real-time system checks.',
      'Check each card for PASS/FAIL and response latency in milliseconds.',
      'Inspect the execution log at the bottom for detailed diagnostics.',
    ],
    noviceTip: 'Running probes does not alter your configuration—it only verifies health.',
  },
  settings: {
    title: 'System Settings & Updates Guide — Keeping OpenNDR Current',
    summary:
      'Manage platform updates, check release dates, configure automatic background updates, switch between Light & Dark themes, or install OpenNDR as an app.',
    steps: [
      'View your Release Date and Last Update Check timestamp in the top panel.',
      'Click Check for Updates to query release metadata, or Force Update to resynchronize.',
      'Enable Background Auto-Update to let OpenNDR verify and apply releases automatically.',
    ],
    noviceTip: 'You can also re-open the Legal Notice or reset contextual tips anytime from this page.',
  },
  docs: {
    title: 'Architecture & Docs Guide — Learning How OpenNDR Works',
    summary:
      'Browse the built-in product roadmap (V0.1–V1.0), Architecture Decision Records (ADRs), Debian 13 setup commands, and REST API contracts.',
    steps: [
      'Switch between Roadmap, ADR Decisions, Debian 13 Setup, and Specs & API.',
      'Follow the Debian 13 Setup tab if installing on a fresh server.',
      'Consult Specs & API when integrating OpenNDR with an external SIEM.',
    ],
    noviceTip: 'All documentation is bundled offline inside the console—no internet required.',
  },
};

export const ContextualOnboarding: React.FC<ContextualOnboardingProps> = ({
  activeTab,
  isVisible,
  isAuthenticated,
  onDismiss,
  onOpenLogin,
}) => {
  if (!isVisible) return null;

  const guide = SCREEN_GUIDES[activeTab];

  return (
    <section
      aria-label="Contextual guidance"
      className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Compass className="w-4 h-4" />
          </div>
          <div className="space-y-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {guide.title}
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed max-w-4xl">
                {guide.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              {guide.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-white/85 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
                >
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{guide.noviceTip}</span>
              </span>

              {!isAuthenticated && activeTab !== 'settings' && activeTab !== 'docs' && (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Sign in to view live data</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          title="Hide contextual guide (re-enable anytime from the top bar ? icon)"
          aria-label="Hide contextual guide"
          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 p-1 rounded-lg transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
