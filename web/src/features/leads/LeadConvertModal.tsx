import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { MapPin, UserRoundPlus } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

type LeadConvertPayload = {
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
};

type LeadConvertModalProps = {
  open: boolean;
  leadName: string;
  initialValues?: LeadConvertPayload;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: LeadConvertPayload) => void | Promise<void>;
};

const EMPTY_FORM = {
  mailingAddress: '',
  mailingCity: '',
  mailingState: '',
  mailingZip: '',
};

const toFormData = (payload?: LeadConvertPayload) => ({
  mailingAddress: payload?.mailingAddress?.trim() || '',
  mailingCity: payload?.mailingCity?.trim() || '',
  mailingState: payload?.mailingState?.trim() || '',
  mailingZip: payload?.mailingZip?.trim() || '',
});

export function LeadConvertModal({ open, leadName, initialValues, saving = false, onClose, onConfirm }: LeadConvertModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const hasPrefilledAddress = Boolean(
    initialValues?.mailingAddress ||
      initialValues?.mailingCity ||
      initialValues?.mailingState ||
      initialValues?.mailingZip,
  );

  useEffect(() => {
    if (!open) return;
    setFormData(toFormData(initialValues));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [initialValues, open]);

  useEscapeKey(() => {
    if (!saving) onClose();
  }, open);

  const payload = useMemo<LeadConvertPayload>(
    () => ({
      mailingAddress: formData.mailingAddress.trim() || null,
      mailingCity: formData.mailingCity.trim() || null,
      mailingState: formData.mailingState.trim() || null,
      mailingZip: formData.mailingZip.trim() || null,
    }),
    [formData],
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm dark:bg-black/72" onClick={() => { if (!saving) onClose(); }} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="ae-theme-card-strong relative w-full max-w-xl rounded-[28px] border border-white/10 p-6 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close convert modal"
            className="ae-theme-button-muted absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 disabled:opacity-60"
          >
            ×
          </button>

          <div className="flex items-start gap-3">
            <div className="ae-tone-gold inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
              <UserRoundPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Client conversion
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                Convert {leadName || 'lead'} to client
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Mailing address is optional. Save it now if you have it so direct mail exports and mailing campaigns are easier later.
              </p>
            </div>
          </div>

          <div className="ae-theme-inset mt-5 rounded-2xl border p-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <MapPin className="h-4 w-4 text-[#9f7933] dark:text-[#f2d894]" aria-hidden="true" />
              Optional mailing info
            </div>
            <p className="mt-2 leading-5">
              Leave these blank if you do not have them yet. The client can still be created now, and the address can be added later from the client profile.
            </p>
            {hasPrefilledAddress && (
              <p className="mt-2 font-medium text-[#9f7933] dark:text-[#f2d894]">
                Prefilled from the imported lead record. Adjust anything before converting.
              </p>
            )}
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onConfirm(payload);
            }}
          >
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Street address
              </label>
              <input
                value={formData.mailingAddress}
                onChange={(event) => setFormData((current) => ({ ...current, mailingAddress: event.target.value }))}
                placeholder="123 Main St"
                className="ae-theme-field w-full rounded-2xl border px-4 py-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_100px_120px]">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  City
                </label>
                <input
                  value={formData.mailingCity}
                  onChange={(event) => setFormData((current) => ({ ...current, mailingCity: event.target.value }))}
                  placeholder="Salt Lake City"
                  className="ae-theme-field w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  State
                </label>
                <input
                  value={formData.mailingState}
                  onChange={(event) => setFormData((current) => ({ ...current, mailingState: event.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="UT"
                  className="ae-theme-field w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  ZIP
                </label>
                <input
                  value={formData.mailingZip}
                  onChange={(event) => setFormData((current) => ({ ...current, mailingZip: event.target.value }))}
                  placeholder="84000"
                  className="ae-theme-field w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="ae-theme-button-muted rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f2d894] to-[#9f7933] px-4 py-2 text-sm font-semibold text-[#171106] shadow-lg shadow-[#d6b56d]/25 transition hover:brightness-105 disabled:opacity-60"
              >
                {saving ? 'Converting…' : 'Convert to client'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}