import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  tips?: string[];
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, secondaryAction, tips, compact = false }: EmptyStateProps) {
  if (compact) {
    return (
      <div className="text-center py-8">
        {icon && <div className="text-3xl mb-2 opacity-90">{icon}</div>}
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-3 text-xs font-semibold text-[#7a5a24] dark:text-[#f2d894] hover:text-[#172235] dark:hover:text-[#f7e7b0] underline-offset-2 hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-14 px-6">
      {icon && (
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f8f3e6] to-white ring-1 ring-inset ring-[#d6b56d]/[0.28] text-3xl shadow-[0_8px_24px_-10px_rgba(15,23,42,0.18)] dark:from-[#d6b56d]/[0.14] dark:to-white/[0.04] dark:ring-[#f2d894]/[0.14] dark:shadow-[0_8px_30px_-10px_rgba(214,181,109,0.32)]">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white dark:text-[#171106] border border-[#d6b56d]/[0.34] dark:border-[#f2d894]/[0.30] bg-[linear-gradient(135deg,#172235_0%,#0b1220_62%,#9f7933_100%)] dark:bg-[linear-gradient(135deg,#f2d894_0%,#d6b56d_48%,#9f7933_100%)] shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_28px_-10px_rgba(15,23,42,0.58)] dark:shadow-[0_1px_0_rgba(255,255,255,0.34)_inset,0_8px_24px_-6px_rgba(214,181,109,0.42)] hover:brightness-[1.05] hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#f2d894]/[0.14] bg-white dark:bg-[#101827]/[0.80] hover:bg-slate-50 dark:hover:bg-[#d6b56d]/[0.10] transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
      {tips && tips.length > 0 && (
        <div className="mt-8 max-w-sm mx-auto rounded-2xl border border-slate-200/70 bg-slate-50/70 dark:border-[#f2d894]/[0.10] dark:bg-[#101827]/[0.70] p-4 text-left">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-2 font-semibold">Quick tips</p>
          <div className="space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-[#d6b56d] dark:text-[#f2d894] mt-0.5">&#x2022;</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

