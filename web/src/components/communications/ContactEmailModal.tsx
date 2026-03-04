import { useEffect, useMemo, useState } from 'react';
import { contactEmailApi, ContactEmailHistoryItem, ContactEmailType } from '../../lib/contactEmailApi';

interface ContactEmailModalProps {
  open: boolean;
  contactType: ContactEmailType;
  contactId: string;
  contactName: string;
  contactEmail: string;
  onClose: () => void;
  onSent?: () => void;
}

function eventLabel(eventType: string | null): string {
  if (!eventType) return 'Event';
  const t = eventType.toUpperCase();
  if (t === 'INBOUND_REPLY') return 'Reply received';
  if (t === 'DELIVERED') return 'Delivered';
  if (t === 'OPEN') return 'Opened';
  if (t === 'CLICK') return 'Clicked';
  if (t === 'BOUNCE') return 'Bounced';
  if (t === 'DROPPED') return 'Dropped';
  if (t === 'DEFERRED') return 'Deferred';
  if (t === 'SPAMREPORT') return 'Spam report';
  if (t === 'UNSUBSCRIBE') return 'Unsubscribed';
  if (t === 'PROCESSED') return 'Processed';
  return t.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function ContactEmailModal({
  open,
  contactType,
  contactId,
  contactName,
  contactEmail,
  onClose,
  onSent,
}: ContactEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ccAgent, setCcAgent] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<ContactEmailHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubject(`Quick update for ${contactName}`);
    setBody('');
    setError(null);
  }, [open, contactName, contactId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const res = await contactEmailApi.history({ contactType, contactId });
        if (!cancelled) {
          setHistory(Array.isArray(res.data?.items) ? res.data.items : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Failed to load email history');
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, contactType, contactId]);

  const canSend = useMemo(() => {
    return subject.trim().length > 0 && body.trim().length > 0 && !sending;
  }, [subject, body, sending]);

  const submit = async () => {
    if (!canSend) return;
    try {
      setSending(true);
      setError(null);
      await contactEmailApi.send({
        contactType,
        contactId,
        subject: subject.trim(),
        body: body.trim(),
        ccAgent,
      });
      const historyRes = await contactEmailApi.history({ contactType, contactId });
      setHistory(Array.isArray(historyRes.data?.items) ? historyRes.data.items : []);
      setBody('');
      onSent?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-4 md:inset-x-[12%] md:inset-y-[8%] rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] h-full">
          <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-300/80">Send email</div>
                <h3 className="text-lg font-semibold text-white">{contactName}</h3>
                <div className="text-xs text-slate-400">{contactEmail}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  placeholder="Subject"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  placeholder="Write your message…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={ccAgent}
                  onChange={(e) => setCcAgent(e.target.checked)}
                  className="rounded border-white/20 bg-slate-800"
                />
                CC me on this email
              </label>

              {error && <div className="text-xs text-rose-300">{error}</div>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-xl border border-white/15 text-slate-300 hover:bg-white/10"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSend}
                  className="px-3 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-60"
                >
                  {sending ? 'Sending…' : 'Send email'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6 overflow-y-auto">
            <div className="text-sm font-semibold text-white mb-3">Email timeline</div>
            {loadingHistory ? (
              <div className="text-sm text-slate-400">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-500">No email activity yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-white">
                        {item.kind === 'sent' && 'Sent'}
                        {item.kind === 'failed' && 'Send failed'}
                        {item.kind === 'reply' && 'Reply received'}
                        {item.kind === 'event' && eventLabel(item.eventType)}
                      </div>
                      <div className="text-[11px] text-slate-400">{new Date(item.at).toLocaleString()}</div>
                    </div>
                    {item.subject && <div className="mt-1 text-xs text-slate-300">Subject: {item.subject}</div>}
                    {item.snippet && <div className="mt-1 text-xs text-slate-300/90">“{item.snippet}”</div>}
                    {item.error && <div className="mt-1 text-xs text-rose-300">{item.error}</div>}
                    {item.fromEmail && <div className="mt-1 text-[11px] text-slate-500">From: {item.fromEmail}</div>}
                    {item.toEmail && <div className="mt-1 text-[11px] text-slate-500">To: {item.toEmail}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
