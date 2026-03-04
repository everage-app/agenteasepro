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
        {icon && <div className="text-3xl mb-2">{icon}</div>}
        <p className="text-sm font-medium text-slate-300 mb-1">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-medium underline"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-6">
      {icon && (
        <div className="text-5xl mb-4 animate-[bounce_2s_ease-in-out_infinite]">{icon}</div>
      )}
      <h3 className="text-xl font-semibold text-slate-50 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      <div className="flex items-center justify-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-105 transition-all"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
      {tips && tips.length > 0 && (
        <div className="mt-8 max-w-sm mx-auto">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-2 font-semibold">Quick tips</p>
          <div className="space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-cyan-400 mt-0.5">&#x2022;</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
