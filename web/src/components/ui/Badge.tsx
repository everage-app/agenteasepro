import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
  /** Show a colored dot indicator before the label */
  dot?: boolean;
  /** Slight pulse on the dot (useful for "live" / online states) */
  pulse?: boolean;
}

// Refined: thin border, soft tint, no heavy shadow — premium and quiet
const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[#f8f3e6] text-[#7a5a24] ring-1 ring-inset ring-[#d6b56d]/[0.38] ' +
    'dark:bg-[#d6b56d]/[0.12] dark:text-[#f2d894] dark:ring-[#f2d894]/[0.25]',
  success:
    'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 ' +
    'dark:bg-emerald-500/[0.10] dark:text-emerald-200 dark:ring-emerald-400/20',
  warning:
    'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80 ' +
    'dark:bg-amber-500/[0.10] dark:text-amber-200 dark:ring-amber-400/20',
  danger:
    'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/70 ' +
    'dark:bg-red-500/[0.10] dark:text-red-200 dark:ring-red-400/20',
  info:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 ' +
    'dark:bg-slate-300/[0.10] dark:text-slate-200 dark:ring-slate-200/20',
  neutral:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 ' +
    'dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/[0.08]',
  purple:
    'bg-[#f6edd6] text-[#7a5a24] ring-1 ring-inset ring-[#d6b56d]/[0.32] ' +
    'dark:bg-[#d6b56d]/[0.10] dark:text-[#f2d894] dark:ring-[#f2d894]/[0.20]',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[#d6b56d]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-slate-300',
  neutral: 'bg-slate-400',
  purple: 'bg-[#d6b56d]',
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1',
  sm: 'px-2 py-0.5 text-[11px] gap-1.5',
  md: 'px-2.5 py-1 text-[11px] gap-1.5',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  className,
  children,
  dot = false,
  pulse = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold uppercase tracking-[0.08em] leading-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                'absolute inset-0 rounded-full opacity-60 animate-ping',
                dotColors[variant],
              )}
            />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotColors[variant])} />
        </span>
      )}
      {children}
    </span>
  );
}

