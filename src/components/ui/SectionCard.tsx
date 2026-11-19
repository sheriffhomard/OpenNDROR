import React from 'react';

interface SectionCardProps {
  title?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  actions,
  children,
  noPadding = false,
  className = '',
}) => {
  return (
    <section
      className={`bg-white dark:bg-[#181b20] border border-gray-200 dark:border-[#2c313a] rounded-lg overflow-hidden ${className}`}
    >
      {(title || description || actions) && (
        <div className="px-5 py-3.5 border-b border-gray-200 dark:border-[#2c313a] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </section>
  );
};
