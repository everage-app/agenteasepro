import { useEffect, useMemo, useState } from 'react';
import { contactEmailApi, ContactEmailHistoryItem, ContactEmailTemplate, ContactEmailType } from '../../lib/contactEmailApi';

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
  const [templates, setTemplates] = useState<ContactEmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [focusedField, setFocusedField] = useState<'subject' | 'body'>('body');
  const [error, setError] = useState<string | null>(null);

  const mergeTagOptions = useMemo(() => ([
    '{{firstName}}',
    '{{lastName}}',
    '{{fullName}}',
    '{{contactEmail}}',
    '{{agentName}}',
    '{{agentEmail}}',
    '{{today}}',
  ]), []);

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

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingTemplates(true);
        const res = await contactEmailApi.templates();
        if (!cancelled) {
          setTemplates(Array.isArray(res.data?.items) ? res.data.items : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Failed to load templates');
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

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
      if (selectedTemplateId) {
        void contactEmailApi.markTemplateUsed(selectedTemplateId);
      }
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

  const applyTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSubject(template.subject || '');
    setBody(template.body || '');
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !body.trim()) {
      setError('Template name, subject, and message are required');
      return;
    }

    try {
      setSavingTemplate(true);
      setError(null);
      const res = await contactEmailApi.createTemplate({
        name: templateName.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      const created = res.data?.item;
      if (created) {
        const next = [created, ...templates.filter((t) => t.id !== created.id)];
        setTemplates(next);
        setSelectedTemplateId(created.id);
      }
      setTemplateName('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteSelectedTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      setDeletingTemplate(true);
      setError(null);
      await contactEmailApi.deleteTemplate(selectedTemplateId);
      setTemplates((prev) => prev.filter((item) => item.id !== selectedTemplateId));
      setSelectedTemplateId('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete template');
    } finally {
      setDeletingTemplate(false);
    }
  };

  const insertMergeTag = (tag: string) => {
    if (focusedField === 'subject') {
      setSubject((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${tag}`);
      return;
    }
    setBody((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${tag}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Send email to ${contactName}`}>
      <div className="absolute inset-0 bg-slate-950/45 dark:bg-black/60" onClick={onClose} />
      <div className="absolute inset-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:text-white md:inset-x-[12%] md:inset-y-[8%]">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] h-full">
          <div className="overflow-y-auto border-b border-slate-200 p-5 dark:border-white/10 md:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-700 dark:text-cyan-300/80">Send email</div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{contactName}</h3>
                <div className="text-xs text-slate-600 dark:text-slate-400">{contactEmail}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/50">
                <div className="text-xs text-slate-700 dark:text-slate-300 mb-2">Personalization merge tags</div>
                <div className="flex flex-wrap gap-2">
                  {mergeTagOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertMergeTag(tag)}
                      className="rounded-lg border border-cyan-600/25 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100 dark:border-cyan-300/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Tags are resolved when sending. Example: "Hi {'{{firstName}}'}".
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/50">
                <div className="text-xs text-slate-700 dark:text-slate-300 mb-2">Saved templates</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => void applyTemplate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-white"
                    disabled={loadingTemplates}
                  >
                    <option value="">Select a template…</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedTemplate()}
                    disabled={!selectedTemplateId || deletingTemplate}
                    className="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-400/30 dark:text-rose-200 dark:hover:bg-rose-500/20"
                  >
                    {deletingTemplate ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Save current draft as…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void saveTemplate()}
                    disabled={savingTemplate}
                    className="px-3 py-2 rounded-xl border border-cyan-600/25 text-cyan-800 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-400/30 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
                  >
                    {savingTemplate ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => setFocusedField('subject')}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-white"
                  placeholder="Subject"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => setFocusedField('body')}
                  rows={10}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:placeholder-slate-500"
                  placeholder="Write your message…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={ccAgent}
                  onChange={(e) => setCcAgent(e.target.checked)}
                  className="rounded border-slate-300 bg-white dark:border-white/20 dark:bg-slate-800"
                />
                CC me on this email
              </label>

              {error && <div className="text-xs text-rose-600 dark:text-rose-300">{error}</div>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
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
            <div className="text-sm font-semibold text-slate-950 dark:text-white mb-3">Email timeline</div>
            {loadingHistory ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-500">No email activity yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-slate-900 dark:text-white">
                        {item.kind === 'sent' && 'Sent'}
                        {item.kind === 'failed' && 'Send failed'}
                        {item.kind === 'reply' && 'Reply received'}
                        {item.kind === 'event' && eventLabel(item.eventType)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{new Date(item.at).toLocaleString()}</div>
                    </div>
                    {item.subject && <div className="mt-1 text-xs text-slate-700 dark:text-slate-300">Subject: {item.subject}</div>}
                    {item.snippet && <div className="mt-1 text-xs text-slate-700 dark:text-slate-300/90">“{item.snippet}”</div>}
                    {item.error && <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">{item.error}</div>}
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
