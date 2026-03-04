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
  iconGradient = 'from-cyan-500 to-blue-500',
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
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        onClick={handleBackdropClick}
      />

      {/* Floating particles/glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Modal Container - True center */}
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
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-[28px] blur-xl opacity-75" />

          {/* Main Modal */}
          <div className="relative rounded-[24px] border border-white/20 bg-gradient-to-b from-slate-900/98 via-slate-900/95 to-slate-950/98 shadow-2xl overflow-hidden">
            {/* Decorative top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

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
                          <div className={`absolute inset-0 bg-gradient-to-br ${iconGradient} rounded-xl blur-lg opacity-40`} />
                          <div className={`relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${iconGradient} bg-opacity-20 border border-white/20`}>
                            <div className="text-white">{icon}</div>
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                        {subtitle && (
                          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-4">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="relative px-6 py-5 bg-slate-950/60 border-t border-white/5">
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
      className="flex-1 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200 font-medium text-sm"
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
      className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:from-cyan-400 group-hover:to-blue-400 transition-all" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.3),transparent_70%)]" />
      </div>
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
      <label className="block text-sm font-semibold text-slate-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        {...props}
        className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
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
      <label className="block text-sm font-semibold text-slate-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <textarea
        {...props}
        className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
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
      <label className="block text-sm font-semibold text-slate-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        {...props}
        className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all [&>option]:bg-slate-900"
      >
        {children}
      </select>
    </div>
  );
}
