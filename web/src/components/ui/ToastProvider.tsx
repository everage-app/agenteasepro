import { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components outside provider
    return {
      addToast: (_t: Omit<Toast, 'id'>) => {},
      success: (_title: string, _message?: string) => {},
      error: (_title: string, _message?: string) => {},
      info: (_title: string, _message?: string) => {},
      warning: (_title: string, _message?: string) => {},
    };
  }
  return {
    addToast: ctx.addToast,
    success: (title: string, message?: string) => ctx.addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => ctx.addToast({ type: 'error', title, message }),
    info: (title: string, message?: string) => ctx.addToast({ type: 'info', title, message }),
    warning: (title: string, message?: string) => ctx.addToast({ type: 'warning', title, message }),
  };
}

const typeConfig: Record<ToastType, { icon: string; borderColor: string; bgColor: string; progressColor: string }> = {
  success: {
    icon: '✓',
    borderColor: 'border-emerald-400/40',
    bgColor: 'from-emerald-500/20 to-emerald-600/5',
    progressColor: 'bg-emerald-400',
  },
  error: {
    icon: '✕',
    borderColor: 'border-red-400/40',
    bgColor: 'from-red-500/20 to-red-600/5',
    progressColor: 'bg-red-400',
  },
  info: {
    icon: 'ℹ',
    borderColor: 'border-cyan-400/40',
    bgColor: 'from-cyan-500/20 to-cyan-600/5',
    progressColor: 'bg-cyan-400',
  },
  warning: {
    icon: '⚠',
    borderColor: 'border-amber-400/40',
    bgColor: 'from-amber-500/20 to-amber-600/5',
    progressColor: 'bg-amber-400',
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const config = typeConfig[toast.type];
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(onRemove, duration);
    return () => clearTimeout(timer);
  }, [duration, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative overflow-hidden rounded-2xl border ${config.borderColor} bg-gradient-to-r ${config.bgColor} backdrop-blur-xl shadow-2xl min-w-[300px] max-w-[420px]`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${config.borderColor} bg-white/10 text-sm font-bold text-white`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{toast.title}</div>
          {toast.message && (
            <div className="mt-0.5 text-xs text-slate-300 leading-relaxed">{toast.message}</div>
          )}
          {toast.action && (
            <button
              onClick={() => { toast.action!.onClick(); onRemove(); }}
              className="mt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-0.5 w-full bg-white/5">
          <motion.div
            className={`h-full ${config.progressColor}`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]); // Keep max 5 visible
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
