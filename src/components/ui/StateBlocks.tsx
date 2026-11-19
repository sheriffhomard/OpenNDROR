import React from 'react';
import { Loader2, Inbox, AlertCircle, WifiOff } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Chargement des données en cours...',
}) => (
  <div className="py-10 px-4 flex flex-col items-center justify-center text-center gap-2.5 text-sm text-gray-500 dark:text-gray-400">
    <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
    <span>{message}</span>
  </div>
);

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon: Icon = Inbox,
}) => (
  <div className="py-10 px-4 flex flex-col items-center justify-center text-center gap-2">
    <Icon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
      {description}
    </p>
    {action && <div className="pt-2">{action}</div>}
  </div>
);

interface ErrorStateProps {
  title?: string;
  message: string;
  unavailable?: boolean;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  unavailable = false,
  onRetry,
}) => {
  const Icon = unavailable ? WifiOff : AlertCircle;
  return (
    <div
      role="alert"
      className="p-4 rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="text-xs font-semibold">
            {title || (unavailable ? 'Serveur backend indisponible' : 'Erreur lors du chargement')}
          </div>
          <p className="text-xs text-red-800 dark:text-red-300">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-[#181b20] text-red-800 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors shrink-0"
        >
          Réessayer
        </button>
      )}
    </div>
  );
};
