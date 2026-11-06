import React from 'react';
import {
  LayoutDashboard,
  Network,
  Users,
  FileText,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'interfaces'
  | 'rbac'
  | 'audit'
  | 'validation'
  | 'docs';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  hasViolation: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  hasViolation,
}) => {
  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string; alert?: boolean }[] = [
    { id: 'dashboard', label: 'Tableau de bord V0.1', icon: LayoutDashboard },
    {
      id: 'interfaces',
      label: 'Interfaces & Isolation',
      icon: Network,
      alert: hasViolation,
    },
    { id: 'rbac', label: 'Accès & Rôles RBAC', icon: Users },
    { id: 'audit', label: 'Journal d’Audit', icon: FileText },
    { id: 'validation', label: 'Recette & Validation V0.1', icon: CheckCircle2 },
    { id: 'docs', label: 'Architecture & Déploiement', icon: BookOpen },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.alert && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" title="Alerte d'isolation détectée" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
