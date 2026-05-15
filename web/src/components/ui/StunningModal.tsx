import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface StunningModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerContent?: ReactNode;
  icon?: ReactNode;
  iconGradient?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function StunningModal({
  isOpen,
  onClose,
  title,
  subtitle,
  headerContent,
  icon,
  iconGradient = 'from-[#f2d894] to-[#9f7933]',
  children,
  footer,
  size = 'md',
}: StunningModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop with blur — theme aware */}
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/75 backdrop-blur-xl"
        onClick={handleBackdropClick}
      />

      {/* Floating glow effects (subtle in light, vivid in dark) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 h-40 w-full bg-[#d6b56d]/[0.10] dark:bg-[#d6b56d]/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-40 w-full bg-slate-900/[0.05] dark:bg-white/[0.035] blur-3xl" />
      </div>

      {/* Modal Container */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto"
        onClick={handleBackdropClick}
      >
        <div
          className={`relative w-full ${sizeClasses[size]} transform transition-all duration-300 ease-out my-8 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Outer glow ring */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#d6b56d]/[0.18] via-slate-900/[0.05] to-[#9f7933]/[0.12] dark:from-[#d6b56d]/[0.18] dark:via-white/[0.04] dark:to-[#9f7933]/[0.14] rounded-[28px] blur-xl opacity-75" />

          {/* Main Modal */}
          <div className="relative rounded-2xl border border-slate-200/80 dark:border-[#f2d894]/[0.14] bg-white dark:bg-gradient-to-b dark:from-[#141d2b]/[0.98] dark:via-[#0b1220]/[0.96] dark:to-[#07090d]/[0.98] shadow-[0_20px_60px_-20px_rgba(15,23,42,0.30)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.86)] overflow-hidden ring-1 ring-inset ring-white/60 dark:ring-[#f2d894]/[0.08]">
            {/* Decorative top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b56d]/[0.55] dark:via-[#f2d894]/[0.50] to-transparent" />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-3 ${headerContent ? 'flex-1 justify-center pl-9' : ''}`}>
                  {headerContent ? (
                    headerContent
                  ) : (
                    <>
                      {icon && (
                        <div className="relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${iconGradient} rounded-xl blur-lg opacity-30 dark:opacity-40`} />
                          <div className={`relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${iconGradient} border border-white/30 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.18)]`}>
                            <div className="text-white">{icon}</div>
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h3>
                        {subtitle && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border bg-slate-50 border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-[#101827] dark:border-[#f2d894]/[0.12] dark:text-slate-400 dark:hover:bg-red-500/[0.15] dark:hover:text-red-300 dark:hover:border-red-500/30 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-4 text-slate-700 dark:text-slate-200">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="relative px-6 py-5 bg-slate-50/80 dark:bg-[#080c14]/[0.70] border-t border-slate-200/60 dark:border-[#f2d894]/[0.10]">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Pre-styled action buttons for modal footers
export function ModalCancelButton({ onClick, children = 'Cancel' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-5 py-3 rounded-xl border font-medium text-sm transition-all duration-200
                 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900
                 dark:bg-white/[0.05] dark:border-white/[0.10] dark:text-slate-300 dark:hover:bg-white/[0.10] dark:hover:text-white dark:hover:border-white/20"
    >
      {children}
    </button>
  );
}

export function ModalPrimaryButton({
  onClick,
  children,
  disabled,
  loading,
  icon,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white
                 border border-white/15 transition-all duration-200
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100
                 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_28px_-10px_rgba(15,23,42,0.58)] dark:shadow-[0_1px_0_rgba(255,255,255,0.34)_inset,0_8px_24px_-6px_rgba(214,181,109,0.42)] dark:text-[#171106]
                 hover:brightness-[1.06] hover:-translate-y-0.5 active:translate-y-0"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#172235_0%,#0b1220_62%,#9f7933_100%)] dark:bg-[linear-gradient(135deg,#f2d894_0%,#d6b56d_48%,#9f7933_100%)]" />
      <span className="relative flex items-center justify-center gap-2">
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          icon
        ) : null}
        {children}
      </span>
    </button>
  );
}

// Styled form input for use in modals
export function ModalInput({
  label,
  required,
  ...props
}: {
  label: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
      </label>
      <input
        {...props}
        className="w-full rounded-xl border px-4 py-3 transition-all
                   bg-white border-slate-200 text-slate-900 placeholder-slate-400
                   focus:border-[#d6b56d] focus:outline-none focus:ring-4 focus:ring-[#d6b56d]/[0.16]
                   dark:bg-[#0d141f]/[0.80] dark:border-[#f2d894]/[0.12] dark:text-white dark:placeholder-slate-500
                   dark:focus:border-[#d6b56d]/[0.60] dark:focus:ring-[#d6b56d]/[0.20]"
      />
    </div>
  );
}

export function ModalTextarea({
  label,
  required,
  ...props
}: {
  label: string;
  required?: boolean;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
      </label>
      <textarea
        {...props}
        className="w-full rounded-xl border px-4 py-3 transition-all resize-none
                   bg-white border-slate-200 text-slate-900 placeholder-slate-400
                   focus:border-[#d6b56d] focus:outline-none focus:ring-4 focus:ring-[#d6b56d]/[0.16]
                   dark:bg-[#0d141f]/[0.80] dark:border-[#f2d894]/[0.12] dark:text-white dark:placeholder-slate-500
                   dark:focus:border-[#d6b56d]/[0.60] dark:focus:ring-[#d6b56d]/[0.20]"
      />
    </div>
  );
}

export function ModalSelect({
  label,
  required,
  children,
  ...props
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
      </label>
      <select
        {...props}
        className="w-full rounded-xl border px-4 py-3 transition-all
                   bg-white border-slate-200 text-slate-900
                   focus:border-[#d6b56d] focus:outline-none focus:ring-4 focus:ring-[#d6b56d]/[0.16]
                   dark:bg-[#0d141f]/[0.80] dark:border-[#f2d894]/[0.12] dark:text-white
                   dark:focus:border-[#d6b56d]/[0.60] dark:focus:ring-[#d6b56d]/[0.20]
                   [&>option]:bg-white dark:[&>option]:bg-[#0b1220]"
      >
        {children}
      </select>
    </div>
  );
}

