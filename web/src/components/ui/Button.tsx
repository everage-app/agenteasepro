import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
}

const baseClasses =
  'ae-button-wow relative inline-flex items-center justify-center gap-2 font-semibold rounded-full ' +
  'transition-[transform,box-shadow,background,filter,color,border-color] duration-200 ease-out ae-motion-button ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#06080d] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-[0.6] disabled:hover:transform-none ' +
  'tracking-[0.005em] whitespace-nowrap select-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'text-white dark:text-[#171106] border border-[#d6b56d]/[0.34] dark:border-[#f2d894]/[0.30] ' +
    'bg-[linear-gradient(135deg,#172235_0%,#0b1220_62%,#9f7933_100%)] ' +
    'dark:bg-[linear-gradient(135deg,#f2d894_0%,#d6b56d_48%,#9f7933_100%)] ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_28px_-10px_rgba(15,23,42,0.58)] ' +
    'dark:shadow-[0_1px_0_rgba(255,255,255,0.36)_inset,0_10px_28px_-8px_rgba(214,181,109,0.44)] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_14px_34px_-10px_rgba(15,23,42,0.62)] dark:hover:shadow-[0_1px_0_rgba(255,255,255,0.42)_inset,0_14px_34px_-8px_rgba(214,181,109,0.52)] ' +
    'hover:brightness-[1.06] active:brightness-95 ' +
    'focus-visible:ring-[#d6b56d]/[0.60] dark:focus-visible:ring-[#d6b56d]/[0.65]',
  secondary:
    'text-slate-800 dark:text-[#f7f4ee] ' +
    'border border-slate-300 dark:border-[#f2d894]/[0.14] ' +
    'bg-white dark:bg-[#101827]/[0.80] backdrop-blur ' +
    'shadow-[0_4px_12px_rgba(15,23,42,0.10)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ' +
    'hover:bg-[#fff8e8] dark:hover:bg-[#161f2d] ' +
    'hover:border-[#d6b56d]/[0.60] dark:hover:border-[#f2d894]/[0.25] ' +
    'hover:shadow-[0_8px_20px_-4px_rgba(15,23,42,0.18)] ' +
    'focus-visible:ring-slate-300/70 dark:focus-visible:ring-[#d6b56d]/[0.40]',
  outline:
    'border border-slate-400/80 dark:border-[#f2d894]/[0.20] bg-white/[0.62] ' +
    'text-slate-800 dark:text-[#f7f4ee] shadow-[0_2px_8px_rgba(15,23,42,0.07)] ' +
    'hover:border-[#d6b56d]/[0.68] dark:hover:border-[#f2d894]/[0.40] ' +
    'hover:bg-[#fff8e8] dark:hover:bg-[#d6b56d]/[0.08] ' +
    'focus-visible:ring-slate-300/60 dark:focus-visible:ring-[#d6b56d]/[0.35]',
  ghost:
    'bg-transparent text-slate-700 dark:text-slate-300 ' +
    'hover:bg-[#fff8e8] dark:hover:bg-[#d6b56d]/[0.08] ' +
    'hover:text-slate-900 dark:hover:text-[#f7f4ee] ' +
    'focus-visible:ring-slate-300/50 dark:focus-visible:ring-[#d6b56d]/[0.30]',
  subtle:
    'border border-[#d6b56d]/[0.42] ' +
    'bg-[#f8f3e6] dark:bg-[#d6b56d]/[0.12] text-[#7a5a24] dark:text-[#f2d894] ' +
    'shadow-[0_4px_12px_rgba(159,121,51,0.12)] hover:bg-[#f1e3bd] dark:hover:bg-[#d6b56d]/[0.18] ' +
    'focus-visible:ring-[#d6b56d]/[0.50] dark:focus-visible:ring-[#d6b56d]/[0.45]',
  success:
    'text-white border border-white/15 ' +
    'bg-[linear-gradient(135deg,#10b981_0%,#059669_50%,#0d9488_100%)] ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_24px_-6px_rgba(16,185,129,0.50)] ' +
    'hover:brightness-[1.06] focus-visible:ring-emerald-500/60',
  danger:
    'text-white border border-white/15 ' +
    'bg-[linear-gradient(135deg,#ef4444_0%,#dc2626_50%,#b91c1c_100%)] ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_24px_-6px_rgba(239,68,68,0.55)] ' +
    'hover:brightness-[1.06] focus-visible:ring-red-500/60',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'text-[11px] px-2.5 py-1.5 gap-1.5',
  sm: 'text-xs px-3.5 py-2 gap-1.5',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-[15px] px-6 py-3',
};

const iconOnlyClasses: Record<ButtonSize, string> = {
  xs: 'p-1.5',
  sm: 'p-2',
  md: 'p-2.5',
  lg: 'p-3',
};

const Spinner = ({ size }: { size: ButtonSize }) => {
  const dim = size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <svg className={cn('animate-spin -ml-0.5', dim)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', className, children, loading, disabled, iconOnly, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          baseClasses,
          variantClasses[variant],
          iconOnly ? iconOnlyClasses[size] : sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner size={size} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

