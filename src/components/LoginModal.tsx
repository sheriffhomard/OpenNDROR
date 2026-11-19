import React, { useState } from 'react';
import { Lock, X, AlertCircle, Loader2 } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
      onClose();
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Échec de l\'authentification.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-[#2c313a]">
          <div className="flex items-center gap-2.5">
            <AppLogo className="w-7 h-7" />
            <h3 id="login-modal-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Connexion à la console OpenNDR
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer la fenêtre de connexion"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-300 text-xs rounded-md flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label
              htmlFor="login-email-input"
              className="block text-gray-700 dark:text-gray-300 mb-1.5 font-medium"
            >
              Adresse e-mail
            </label>
            <input
              id="login-email-input"
              type="email"
              required
              autoComplete="username"
              placeholder="utilisateur@domaine.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          <div>
            <label
              htmlFor="login-password-input"
              className="block text-gray-700 dark:text-gray-300 mb-1.5 font-medium"
            >
              Mot de passe
            </label>
            <input
              id="login-password-input"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-white dark:bg-[#111318] border border-gray-300 dark:border-[#2c313a] rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          <div className="p-2.5 bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-[#2c313a] rounded-md text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>Authentification vérifiée côté serveur via Argon2id et jeton JWT.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Connexion...' : 'Se connecter'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
