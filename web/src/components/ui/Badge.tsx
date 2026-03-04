import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-blue-100 text-blue-700 border-blue-200 shadow-[0_8px_20px_rgba(37,99,235,0.12)] dark:bg-blue-500/15 dark:text-blue-100 dark:border-blue-400/30 dark:shadow-[0_8px_20px_rgba(37,99,235,0.25)]',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-[0_8px_20px_rgba(16,185,129,0.12)] dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/30 dark:shadow-[0_8px_20px_rgba(16,185,129,0.25)]',
  warning: 'bg-amber-100 text-amber-700 border-amber-200 shadow-[0_8px_20px_rgba(251,191,36,0.12)] dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-400/30 dark:shadow-[0_8px_20px_rgba(251,191,36,0.25)]',
  danger: 'bg-red-100 text-red-700 border-red-200 shadow-[0_8px_20px_rgba(239,68,68,0.12)] dark:bg-red-500/15 dark:text-red-100 dark:border-red-400/30 dark:shadow-[0_8px_20px_rgba(239,68,68,0.25)]',
  info: 'bg-cyan-100 text-cyan-700 border-cyan-200 shadow-[0_8px_20px_rgba(8,145,178,0.12)] dark:bg-cyan-500/15 dark:text-cyan-100 dark:border-cyan-400/30 dark:shadow-[0_8px_20px_rgba(8,145,178,0.25)]',
};

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] backdrop-blur-md',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
