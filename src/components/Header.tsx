import React from 'react';
import { Shield, ShieldAlert, LogOut, UserCheck } from 'lucide-react';
import { User, UserRole } from '../types/auth';

interface HeaderProps {
  currentUser: User | null;
  onSwitchRole: (role: UserRole) => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchRole,
  onLogout,
  onOpenLogin,
}) => {
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
              {/* Role switcher for rapid testing */}
              <div className="hidden md:flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                {(['Administrator', 'Analyst', 'Observer'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => onSwitchRole(role)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      currentUser.role === role
                        ? 'bg-slate-800 text-emerald-400 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* User identifier */}
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-slate-200">{currentUser.fullName}</div>
                <div className="text-xs text-slate-400 font-mono">{currentUser.email}</div>
              </div>

              {/* Logout button */}
              <button
                onClick={onLogout}
                title="Se déconnecter"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
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
