import React from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  meta,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-gray-200 dark:border-[#2c313a]">
      <div className="space-y-1 min-w-0">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">
          {description}
        </p>
        {meta && (
          <div className="pt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="space-y-6">{children}</div>;
};
