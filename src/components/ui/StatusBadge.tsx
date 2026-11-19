import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  HelpCircle,
  CircleSlash,
} from 'lucide-react';

export type OperationalState =
  | 'operational'
  | 'degraded'
  | 'stopped'
  | 'unavailable'
  | 'unconfigured'
  | 'unknown';

interface StatusBadgeProps {
  state: OperationalState;
  label?: string;
  size?: 'sm' | 'md';
}

const STATE_STYLES: Record<
  OperationalState,
  {
    defaultLabel: string;
    classes: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  operational: {
    defaultLabel: 'Opérationnel',
    classes:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70',
    Icon: CheckCircle2,
  },
  degraded: {
    defaultLabel: 'En fonctionnement dégradé',
    classes:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
    Icon: AlertTriangle,
  },
  stopped: {
    defaultLabel: 'Arrêté',
    classes:
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700',
    Icon: CircleSlash,
  },
  unavailable: {
    defaultLabel: 'Indisponible',
    classes:
      'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/70',
    Icon: XCircle,
  },
  unconfigured: {
    defaultLabel: 'Non configuré',
    classes:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    Icon: MinusCircle,
  },
  unknown: {
    defaultLabel: 'Inconnu',
    classes:
      'bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    Icon: HelpCircle,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  state,
  label,
  size = 'sm',
}) => {
  const cfg = STATE_STYLES[state];
  const Icon = cfg.Icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border whitespace-nowrap ${padding} ${cfg.classes}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
};
