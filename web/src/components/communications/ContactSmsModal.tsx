import { useState } from 'react';
import { contactSmsApi, ContactSmsType } from '../../lib/contactSmsApi';
import { Button } from '../ui/Button';

interface ContactSmsModalProps {
  open: boolean;
  contactType: ContactSmsType;
  contactId: string;
  contactName: string;
  contactPhone: string;
  onClose: () => void;
  onSent?: () => void;
}

export function ContactSmsModal({
  open,
  contactType,
  contactId,
  contactName,
  contactPhone,
  onClose,
  onSent,
}: ContactSmsModalProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;
  const maxChars = 1600;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      await contactSmsApi.sendSms({
        contactType,
        contactId,
        text,
      });
      setText('');
      if (onSent) onSent();
      onClose();
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      setError(err?.response?.data?.error || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-[480px] rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Send SMS</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{contactName}</h3>
              <div className="text-xs text-slate-500 dark:text-slate-400">{contactPhone || 'No phone number available'}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSend} className="mt-4 space-y-3">
            <div>
              <textarea
                placeholder="Type your message here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[150px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:placeholder:text-slate-500"
                disabled={sending}
                autoFocus
              />
              <div className="mt-1 flex justify-end text-xs text-slate-500 dark:text-slate-400">
                <span className={charCount > maxChars ? 'text-red-500 dark:text-red-300' : ''}>
                  {charCount} / {maxChars} characters
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" variant="success" disabled={!text.trim() || sending || !contactPhone || charCount > maxChars}>
                {sending ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
