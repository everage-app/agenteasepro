import { useCallback, useEffect, useRef, useState } from 'react';

const DRAFT_PREFIX = 'aep_draft_';

/** Check whether any value in the object differs from the initial state */
function isDirtyCheck<T extends Record<string, unknown>>(initial: T, current: T): boolean {
  for (const key of Object.keys(initial)) {
    if (String(initial[key] ?? '') !== String(current[key] ?? '')) return true;
  }
  return false;
}

export interface UseUnsavedChangesOptions<T extends Record<string, unknown>> {
  /** Unique key for sessionStorage draft (e.g. 'new-client', 'edit-client-123') */
  draftKey: string;
  /** The initial/clean form state */
  initial: T;
  /** The current live form state */
  current: T;
  /** Whether the hook is active (default true) */
  enabled?: boolean;
}

export interface UseUnsavedChangesReturn<T extends Record<string, unknown>> {
  /** True when current form differs from initial */
  isDirty: boolean;
  /** True when showing the "unsaved changes" confirmation dialog */
  showConfirmDialog: boolean;
  /** Call this instead of directly closing the modal. If dirty, shows confirm dialog; else closes immediately. */
  requestClose: () => void;
  /** User confirmed they want to discard changes — call the real close callback inside this. */
  confirmDiscard: () => void;
  /** User cancelled the discard — keep the modal open. */
  cancelDiscard: () => void;
  /** Save current form state to sessionStorage as a recoverable draft */
  saveDraft: () => void;
  /** Load a previously saved draft from sessionStorage (returns null if none) */
  loadDraft: () => T | null;
  /** Clear the saved draft from sessionStorage */
  clearDraft: () => void;
}

export function useUnsavedChanges<T extends Record<string, unknown>>({
  draftKey,
  initial,
  current,
  enabled = true,
}: UseUnsavedChangesOptions<T>): UseUnsavedChangesReturn<T> {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const storageKey = DRAFT_PREFIX + draftKey;
  const isDirty = enabled ? isDirtyCheck(initial, current) : false;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Auto-save draft to sessionStorage on every change (debounced)
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!enabled || !isDirty) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(current));
      } catch { /* storage full — ignore */ }
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [enabled, isDirty, current, storageKey]);

  // Warn on browser tab close / navigation away
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  const requestClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowConfirmDialog(true);
    } else {
      setShowConfirmDialog(false);
    }
  }, []);

  const confirmDiscard = useCallback(() => {
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
    setShowConfirmDialog(false);
  }, [storageKey]);

  const cancelDiscard = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const saveDraft = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(current));
    } catch { /* ignore */ }
  }, [storageKey, current]);

  const loadDraft = useCallback((): T | null => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  return {
    isDirty,
    showConfirmDialog,
    requestClose,
    confirmDiscard,
    cancelDiscard,
    saveDraft,
    loadDraft,
    clearDraft,
  };
}
