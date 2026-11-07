import React from 'react';
import { Shield, LogOut, UserCheck } from 'lucide-react';
import { User } from '../types/auth';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenLogin,
}) => {
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'Administrator':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'Analyst':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Observer':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-slate-100 tracking-tight">OpenNDR</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400 font-mono">v0.1.0</span>
            </div>
            <div className="text-xs text-slate-400">
              Sonde NDR souveraine · Debian 13 (Trixie)
            </div>
          </div>
        </div>

        {/* User state and actions */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {/* Authenticated user role badge */}
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${getRoleBadgeClass(
                  currentUser.role
                )}`}
              >
                {currentUser.role}
              </span>

              {/* User identifier */}
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-slate-200">{currentUser.fullName}</div>
                <div className="text-xs text-slate-400 font-mono">{currentUser.email}</div>
              </div>

              {/* Real Logout button */}
              <button
                onClick={onLogout}
                title="Déconnexion sécurisée (invalidation du JWT)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors border border-slate-800 hover:border-rose-900/50 text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnexion</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              <UserCheck className="w-4 h-4" />
              Connexion SOC
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
