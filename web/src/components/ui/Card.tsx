import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  hover?: boolean;
  tone?: 'solid' | 'subtle' | 'elevated' | 'glass';
  onClick?: () => void;
  /** Removes default inner padding for full-bleed content (e.g. tables, maps) */
  noPadding?: boolean;
  /** Optional accent color stripe at the top of the card */
  accent?: 'blue' | 'purple' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'none';
}

const toneStyles: Record<NonNullable<CardProps['tone']>, string> = {
  solid:
    'bg-white dark:bg-[#0d141f]/[0.88] ' +
    'border-slate-300/90 dark:border-[#f2d894]/[0.12] ' +
    'shadow-[0_2px_6px_rgba(15,23,42,0.08),0_16px_38px_-16px_rgba(15,23,42,0.24)] ' +
    'dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.82)]',
  subtle:
    'bg-white/[0.92] dark:bg-[#0a0f18]/[0.72] ' +
    'border-slate-300/80 dark:border-[#f2d894]/[0.09] ' +
    'shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:shadow-none',
  elevated:
    'bg-gradient-to-br from-white via-white to-[#faf7ef] dark:from-[#141d2b]/[0.94] dark:via-[#0b1220]/[0.92] dark:to-[#07090d]/[0.95] ' +
    'border-slate-300/90 dark:border-[#f2d894]/[0.14] ' +
    'shadow-[0_6px_16px_-4px_rgba(15,23,42,0.12),0_24px_56px_-20px_rgba(15,23,42,0.30),0_0_36px_-22px_rgba(214,181,109,0.52)] ' +
    'dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_30px_80px_-20px_rgba(0,0,0,0.88),0_0_40px_-24px_rgba(214,181,109,0.45)]',
  glass:
    'bg-white/[0.88] dark:bg-[#101827]/[0.70] backdrop-blur-2xl ' +
    'border-slate-300/80 dark:border-[#f2d894]/[0.12] ' +
    'shadow-[0_12px_36px_-12px_rgba(15,23,42,0.20)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.74)]',
};

const accentStripes: Record<NonNullable<CardProps['accent']>, string> = {
  none: '',
  blue: 'before:bg-gradient-to-r before:from-slate-400 before:via-amber-200 before:to-slate-500',
  purple: 'before:bg-gradient-to-r before:from-stone-300 before:via-amber-200 before:to-yellow-600',
  cyan: 'before:bg-gradient-to-r before:from-slate-300 before:via-amber-200 before:to-stone-400',
  emerald: 'before:bg-gradient-to-r before:from-emerald-400 before:via-teal-400 before:to-cyan-500',
  amber: 'before:bg-gradient-to-r before:from-amber-300 before:via-[#d6b56d] before:to-[#9f7933]',
  rose: 'before:bg-gradient-to-r before:from-rose-400 before:via-pink-500 before:to-fuchsia-500',
};

export function Card({
  className,
  children,
  title,
  description,
  headerAction,
  hover = false,
  tone = 'solid',
  onClick,
  noPadding = false,
  accent = 'none',
}: CardProps) {
  const isInteractive = hover || !!onClick;
  const accentClass =
    accent !== 'none'
      ? `relative overflow-hidden before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[2px] ${accentStripes[accent]}`
      : '';

  return (
    <div
      className={cn(
        'group/card ae-card-wow relative rounded-2xl border ae-motion-card',
        'ring-1 ring-inset ring-white/40 dark:ring-white/[0.04]',
        toneStyles[tone],
        accentClass,
        isInteractive &&
          'cursor-pointer hover:-translate-y-0.5 ' +
            'hover:shadow-[0_4px_10px_rgba(15,23,42,0.10),0_24px_54px_-16px_rgba(15,23,42,0.30),0_0_0_1px_rgba(214,181,109,0.24)] ' +
            'hover:border-[#d6b56d]/[0.62] dark:hover:border-[#f2d894]/[0.30] ' +
            'dark:hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_30px_80px_-20px_rgba(214,181,109,0.26)]',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {(title || description || headerAction) && (
        <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-slate-200/60 dark:border-[#f2d894]/[0.09]">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white tracking-tight leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'px-6 py-6')}>{children}</div>
    </div>
  );
}

