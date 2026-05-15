import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface UnsavedChangesDialogProps {
  /** When true the dialog is rendered */
  open: boolean;
  /** Called when the user clicks "Discard" */
  onDiscard: () => void;
  /** Called when the user clicks "Keep Editing" */
  onCancel: () => void;
  /** Optional: called when the user clicks "Save Draft" — if omitted the button is hidden */
  onSaveDraft?: () => void;
}

export function UnsavedChangesDialog({ open, onDiscard, onCancel, onSaveDraft }: UnsavedChangesDialogProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setIsVisible(true));
    else setIsVisible(false);
  }, [open]);

  if (!open) return null;

  const dialog = (
    <div
      className={`fixed inset-0 z-[10000] transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Unsaved changes"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`relative w-full max-w-sm transform transition-all duration-200 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header icon */}
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 mb-3">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unsaved Changes</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                You have unsaved work. What would you like to do?
              </p>
            </div>

            {/* Draft recovered indicator */}
            <div className="px-6 pb-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your progress is auto-saved as a draft
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 pt-3 flex flex-col gap-2">
              {/* Keep editing — primary */}
              <button
                type="button"
                onClick={onCancel}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f2d894] to-[#9f7933] text-[#171106] font-semibold text-sm hover:brightness-[1.05] transition-all shadow-lg shadow-[#d6b56d]/[0.20]"
              >
                Keep Editing
              </button>

              {onSaveDraft && (
                <button
                  type="button"
                  onClick={onSaveDraft}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                >
                  Save Draft &amp; Close
                </button>
              )}

              {/* Discard — destructive */}
              <button
                type="button"
                onClick={onDiscard}
                className="w-full px-4 py-2.5 rounded-xl text-red-500 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
