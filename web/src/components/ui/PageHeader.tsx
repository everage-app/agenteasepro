import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div className="flex-1">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
