import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isBusy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-lg max-w-md w-full p-5 space-y-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {variant === 'danger' && (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <h3
              id="confirm-dialog-title"
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            aria-label="Fermer la fenêtre de confirmation"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-[#2c313a]">
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-[#2c313a] bg-white dark:bg-[#1f2329] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md text-white text-xs font-medium transition-colors disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
