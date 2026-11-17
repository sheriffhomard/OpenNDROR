import React from 'react';
import {
  LogOut,
  UserCheck,
  Menu,
  Sun,
  Moon,
  Compass,
  Settings,
} from 'lucide-react';
import { User } from '../types/auth';
import { AppLogo } from './AppLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeMode } from '../hooks/useTheme';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  showGuide: boolean;
  onToggleGuide: () => void;
  updateAvailable?: boolean;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenLogin,
  onOpenMenu,
  onOpenSettings,
  theme,
  onToggleTheme,
  showGuide,
  onToggleGuide,
  updateAvailable,
  onNotify,
}) => {
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'Administrator':
        return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
      case 'Analyst':
        return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
      case 'Observer':
        return 'bg-sky-50 dark:bg-blue-500/10 text-sky-700 dark:text-blue-400 border-sky-200 dark:border-blue-500/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/85 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left: Hamburger Button + Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            title="Open categorized navigation menu"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <AppLogo className="w-9 h-9 shrink-0" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-slate-900 dark:text-slate-100 tracking-tight truncate">
                OpenNDR
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">·</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono hidden sm:inline">
                v0.2.0
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate hidden md:block">
              Sovereign NDR Sensor · Debian 13 (Trixie)
            </div>
          </div>
        </div>

        {/* Right: Quick Controls + Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Contextual Guide Toggle */}
          <button
            type="button"
            onClick={onToggleGuide}
            title={showGuide ? 'Hide contextual screen guide' : 'Show contextual screen guide'}
            aria-label="Toggle contextual onboarding guide"
            className={`p-2 rounded-lg border text-xs transition-colors shrink-0 ${
              showGuide
                ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Compass className="w-4 h-4" />
          </button>

          {/* Light / Dark Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Install App Button (PWA) */}
          <PWAInstallButton variant="header" onNotify={onNotify} />

          {/* System Settings Shortcut */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="System Settings, Updates & Preferences"
            aria-label="Open System Settings"
            className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
            {updateAvailable && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"
                title="Update available"
              />
            )}
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2 shrink-0 pl-1">
              <span
                className={`hidden sm:inline-flex px-2.5 py-1 rounded-md text-xs font-mono font-medium border whitespace-nowrap ${getRoleBadgeClass(
                  currentUser.role
                )}`}
              >
                {currentUser.role}
              </span>

              <div className="text-right hidden lg:block">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-200">
                  {currentUser.fullName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {currentUser.email}
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Secure sign out (JWT token revocation)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-900/50 text-xs whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>SOC Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
