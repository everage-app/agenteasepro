import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Small label above the title (e.g. "Workspace") */
  eyebrow?: string;
  /** Optional icon shown beside the title */
  icon?: ReactNode;
  actions?: ReactNode;
  /** Render the title with a subtle brand gradient */
  gradient?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  gradient = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 pb-4 border-b border-slate-200/60 dark:border-[#f2d894]/[0.10]',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a5a24] dark:text-[#d6b56d] mb-1.5">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#d6b56d]/[0.16] to-slate-900/[0.05] dark:from-[#d6b56d]/[0.14] dark:to-white/[0.04] ring-1 ring-inset ring-[#d6b56d]/[0.30] dark:ring-[#f2d894]/[0.16] text-[#7a5a24] dark:text-[#f2d894] flex-shrink-0">
              {icon}
            </span>
          )}
          <h1
            className={cn(
              'text-2xl md:text-[28px] font-semibold tracking-tight leading-tight',
              gradient
                ? 'bg-clip-text text-transparent bg-[linear-gradient(135deg,#172235_0%,#334155_45%,#9f7933_100%)] dark:bg-[linear-gradient(135deg,#f7f4ee_0%,#f2d894_58%,#9f7933_100%)]'
                : 'text-slate-900 dark:text-white',
            )}
          >
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end sm:pl-4 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

