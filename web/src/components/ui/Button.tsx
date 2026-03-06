import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 ae-motion-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#040b18] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#0ea5e9] text-white shadow-[0_15px_40px_rgba(37,99,235,0.45)] hover:shadow-[0_18px_50px_rgba(14,165,233,0.45)] border border-white/10 hover:translate-y-[-1px] hover:scale-[1.015] active:scale-[0.97] focus:ring-blue-500/60',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-300/60 shadow-[0_10px_30px_rgba(15,23,42,0.12)] hover:shadow-[0_15px_40px_rgba(15,23,42,0.18)] hover:translate-y-[-1px] dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:border-white/40 dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)] dark:hover:shadow-[0_15px_40px_rgba(2,6,23,0.55)]',
  outline: 'border-2 border-slate-300 bg-transparent text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:ring-slate-300/60 hover:translate-y-[-1px] dark:border-white/30 dark:text-slate-100 dark:hover:border-white/60 dark:hover:bg-white/5 dark:focus:ring-white/40',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300/50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
  danger: 'bg-gradient-to-br from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 focus:ring-red-500/60 shadow-[0_12px_30px_rgba(239,68,68,0.45)] hover:translate-y-[-1px]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-2',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-6 py-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
