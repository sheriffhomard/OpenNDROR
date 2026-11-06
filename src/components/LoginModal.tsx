import React, { useState } from 'react';
import { Shield, Lock, X, AlertCircle } from 'lucide-react';
import { UserRole } from '../types/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [email, setEmail] = useState('admin@openndr.local');
  const [password, setPassword] = useState('OpenNDR-Admin-2026!');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      onLogin(email, password);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  const handleQuickSelect = (role: UserRole) => {
    const creds: Record<UserRole, { email: string; pass: string }> = {
      Administrator: { email: 'admin@openndr.local', pass: 'OpenNDR-Admin-2026!' },
      Analyst: { email: 'analyst@openndr.local', pass: 'OpenNDR-Analyst-2026!' },
      Observer: { email: 'observer@openndr.local', pass: 'OpenNDR-Observer-2026!' },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].pass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-100">Connexion Console SOC OpenNDR</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick select buttons for evaluation */}
        <div className="space-y-1.5 text-xs">
          <span className="text-slate-400">Comptes de test préconfigurés V0.1 :</span>
          <div className="grid grid-cols-3 gap-2">
            {(['Administrator', 'Analyst', 'Observer'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleQuickSelect(role)}
                className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 text-xs transition-colors font-mono"
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-2">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">Adresse E-mail SOC</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Hachage d’authentification protégé par sel aléatoire PBKDF2 / Argon2id.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              Fermer
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              S'authentifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
