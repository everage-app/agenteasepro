import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  hover?: boolean;
  tone?: 'solid' | 'subtle';
  onClick?: () => void;
}

export function Card({ 
  className, 
  children, 
  title, 
  description, 
  headerAction, 
  hover = false,
  tone = 'solid',
  onClick
}: CardProps) {
  const baseStyles = tone === 'solid' 
    ? 'bg-gradient-to-br from-white via-slate-50/90 to-white dark:bg-gradient-to-br dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 backdrop-blur-xl border-indigo-200/80 dark:border-white/10 shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]'
    : 'bg-gradient-to-br from-white/90 via-slate-50/80 to-white/90 dark:bg-white/6 backdrop-blur-xl border-indigo-200/70 dark:border-white/10 shadow-[0_14px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_15px_50px_rgba(2,6,23,0.55)]';

  return (
    <div 
      className={cn(
        'rounded-[28px] border transition-all duration-500 ae-motion-card',
        baseStyles,
        hover && 'hover:shadow-[0_16px_45px_rgba(59,130,246,0.18)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 cursor-pointer hover:border-indigo-300/80 dark:hover:border-white/20',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {(title || description || headerAction) && (
        <div className={cn(
          "px-6 py-5 flex items-start justify-between gap-4",
          tone === 'solid' ? 'border-b border-slate-200/60 dark:border-white/5' : 'border-b border-slate-200/60 dark:border-white/5'
        )}>
          <div className="flex-1">
            {title && <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>}
            {description && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">{description}</p>}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="px-6 py-6 md:py-7">{children}</div>
    </div>
  );
}
