import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Network,
  Users,
  FileText,
  CheckCircle2,
  Settings,
  BookOpen,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'capture'
  | 'interfaces'
  | 'rbac'
  | 'audit'
  | 'validation'
  | 'settings'
  | 'docs';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  hasViolation: boolean;
  updateAvailable?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  hasViolation,
  updateAvailable,
}) => {
  const tabs: {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    alert?: boolean;
    dot?: boolean;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'capture', label: 'Capture & Decoding V0.2', icon: Activity },
    {
      id: 'interfaces',
      label: 'Interfaces & Isolation',
      icon: Network,
      alert: hasViolation,
    },
    { id: 'rbac', label: 'RBAC & Access', icon: Users },
    { id: 'audit', label: 'Audit Log', icon: FileText },
    { id: 'validation', label: 'Validation & Probes', icon: CheckCircle2 },
    { id: 'settings', label: 'System Settings', icon: Settings, dot: updateAvailable },
    { id: 'docs', label: 'Architecture & Docs', icon: BookOpen },
  ];

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1.5 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700/60'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.alert && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" title="Isolation alert detected" />
                )}
                {tab.dot && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Update available" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
