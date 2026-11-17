import React, { useEffect } from 'react';
import {
  X,
  LayoutDashboard,
  Activity,
  Network,
  Users,
  FileText,
  CheckCircle2,
  Settings,
  BookOpen,
  Sun,
  Moon,
  Compass,
  Scale,
} from 'lucide-react';
import { TabId } from './Navigation';
import { AppLogo } from './AppLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeMode } from '../hooks/useTheme';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  hasViolation: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  showGuide: boolean;
  onToggleGuide: () => void;
  onOpenLegal: () => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

interface MenuCategory {
  title: string;
  items: {
    id: TabId;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    alert?: boolean;
  }[];
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  hasViolation,
  theme,
  onToggleTheme,
  showGuide,
  onToggleGuide,
  onOpenLegal,
  onNotify,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories: MenuCategory[] = [
    {
      title: 'Monitoring & Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          description: 'Sensor status, services & compliance KPIs',
          icon: LayoutDashboard,
        },
        {
          id: 'validation',
          label: 'Validation & Probes',
          description: 'Live HTTP readiness & integrity checks',
          icon: CheckCircle2,
        },
      ],
    },
    {
      title: 'Capture & Network',
      items: [
        {
          id: 'capture',
          label: 'Capture & Decoding V0.2',
          description: 'AF_PACKET capture, PCAP upload & L2–L4 frames',
          icon: Activity,
        },
        {
          id: 'interfaces',
          label: 'Interfaces & Isolation',
          description: 'Stealth NIC isolation & Debian sysctl hardening',
          icon: Network,
          alert: hasViolation,
        },
      ],
    },
    {
      title: 'Security & Governance',
      items: [
        {
          id: 'rbac',
          label: 'RBAC & Access',
          description: 'User directory & 8-permission matrix',
          icon: Users,
        },
        {
          id: 'audit',
          label: 'Audit Log',
          description: 'Immutable security events & JSONB inspector',
          icon: FileText,
        },
      ],
    },
    {
      title: 'System & Documentation',
      items: [
        {
          id: 'settings',
          label: 'System Settings & Updates',
          description: 'Release date, auto-updater, theme & install',
          icon: Settings,
        },
        {
          id: 'docs',
          label: 'Architecture & Docs',
          description: 'Roadmap, ADRs, Debian 13 setup & API specs',
          icon: BookOpen,
        },
      ],
    },
  ];

  const handleNavigate = (tab: TabId) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Application Menu">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 w-80 max-w-[88vw] h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-4 h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <AppLogo className="w-8 h-8" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                OpenNDR Menu
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                v0.2.0 · Categorized Navigation
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categorized Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {categories.map((cat) => (
            <div key={cat.title} className="space-y-1.5">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {cat.title}
              </div>
              <div className="space-y-1">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors border ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-900 dark:text-emerald-100'
                          : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">{item.label}</span>
                          {item.alert && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                              ALERT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Drawer Quick Controls Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-slate-900/40 shrink-0">
          <PWAInstallButton variant="drawer" onNotify={onNotify} />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-600" />
                  <span>Dark Theme</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleGuide();
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-500" />
              <span>{showGuide ? 'Hide Guide' : 'Show Guide'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onOpenLegal();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Legal Notice & Disclaimer</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
