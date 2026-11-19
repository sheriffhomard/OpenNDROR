import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  LogIn,
  ChevronDown,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { User } from '../types/auth';
import { getNavItemById, NavSectionId } from '../config/navigation';
import { ThemeMode } from '../hooks/useTheme';

export type BackendConnectionState = 'checking' | 'connected' | 'unavailable';

interface TopBarProps {
  activeSection: NavSectionId;
  currentUser: User | null;
  connectionState: BackendConnectionState;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  currentUser,
  connectionState,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  onOpenLogin,
  onLogout,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const currentNav = getNavItemById(activeSection);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userMenuOpen]);

  return (
    <header className="h-14 border-b border-gray-200 dark:border-[#2c313a] bg-white dark:bg-[#181b20] sticky top-0 z-30">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Mobile drawer trigger + Breadcrumb / Current Section */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Ouvrir le menu de navigation"
            className="lg:hidden p-2 rounded-md border border-gray-200 dark:border-[#2c313a] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1f2329] shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-semibold text-gray-900 dark:text-gray-100 lg:hidden shrink-0">
              OpenNDR
            </span>
            <span className="text-gray-400 dark:text-gray-500 hidden sm:inline shrink-0">
              {currentNav.section}
            </span>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline shrink-0" aria-hidden="true">
              /
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {currentNav.label}
            </span>
          </nav>
        </div>

        {/* Right: Server Connection + Theme + User Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Server connection status */}
          <div
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border whitespace-nowrap ${
              connectionState === 'connected'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : connectionState === 'unavailable'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/60'
                : 'bg-gray-100 dark:bg-[#1f2329] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2c313a]'
            }`}
            title="État de connexion au serveur API"
          >
            {connectionState === 'connected' && <Wifi className="w-3.5 h-3.5 shrink-0" />}
            {connectionState === 'unavailable' && <WifiOff className="w-3.5 h-3.5 shrink-0" />}
            {connectionState === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
            <span>
              {connectionState === 'connected'
                ? 'Serveur connecté'
                : connectionState === 'unavailable'
                ? 'Serveur indisponible'
                : 'Connexion...'}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
            title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
            className="p-2 rounded-md border border-gray-200 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User dropdown or Sign In */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-xs transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[130px] truncate">
                  {currentUser.fullName}
                </span>
                <span className="hidden sm:inline text-gray-400" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline text-gray-600 dark:text-gray-400">
                  {currentUser.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-60 rounded-md border border-gray-200 dark:border-[#2c313a] bg-white dark:bg-[#181b20] shadow-lg py-1.5 z-40"
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-[#2c313a]">
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {currentUser.email}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Rôle : {currentUser.role}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
