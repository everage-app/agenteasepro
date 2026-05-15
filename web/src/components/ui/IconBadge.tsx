import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type IconBadgeTone = 'gold' | 'cyan' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
type IconBadgeSize = 'sm' | 'md' | 'lg';
type IconBadgeShape = 'circle' | 'rounded';

interface IconBadgeProps {
  icon: LucideIcon;
  tone?: IconBadgeTone;
  size?: IconBadgeSize;
  shape?: IconBadgeShape;
  className?: string;
  iconClassName?: string;
  title?: string;
}

const toneClasses: Record<IconBadgeTone, string> = {
  gold:
    'border-[#d6b56d]/40 bg-[#f8f3e6] text-[#7a5a24] shadow-[0_8px_22px_-14px_rgba(159,121,51,0.45)] ' +
    'dark:border-[#f2d894]/25 dark:bg-[#d6b56d]/10 dark:text-[#f2d894]',
  cyan:
    'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-[0_8px_22px_-14px_rgba(8,145,178,0.42)] ' +
    'dark:border-cyan-400/25 dark:bg-cyan-500/10 dark:text-cyan-200',
  blue:
    'border-blue-200 bg-blue-50 text-blue-700 shadow-[0_8px_22px_-14px_rgba(37,99,235,0.42)] ' +
    'dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_8px_22px_-14px_rgba(5,150,105,0.42)] ' +
    'dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200',
  amber:
    'border-amber-200 bg-amber-50 text-amber-800 shadow-[0_8px_22px_-14px_rgba(217,119,6,0.42)] ' +
    'dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200',
  rose:
    'border-rose-200 bg-rose-50 text-rose-700 shadow-[0_8px_22px_-14px_rgba(225,29,72,0.42)] ' +
    'dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200',
  purple:
    'border-purple-200 bg-purple-50 text-purple-700 shadow-[0_8px_22px_-14px_rgba(126,34,206,0.42)] ' +
    'dark:border-purple-400/25 dark:bg-purple-500/10 dark:text-purple-200',
  slate:
    'border-slate-200 bg-slate-100 text-slate-700 shadow-[0_8px_22px_-14px_rgba(15,23,42,0.32)] ' +
    'dark:border-white/10 dark:bg-white/10 dark:text-slate-200',
};

const sizeClasses: Record<IconBadgeSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

const iconSizeClasses: Record<IconBadgeSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function IconBadge({
  icon: Icon,
  tone = 'gold',
  size = 'md',
  shape = 'rounded',
  className,
  iconClassName,
  title,
}: IconBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border ring-1 ring-white/35 dark:ring-white/5',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      title={title}
    >
      <Icon className={cn(iconSizeClasses[size], iconClassName)} strokeWidth={2.1} />
    </span>
  );
}
