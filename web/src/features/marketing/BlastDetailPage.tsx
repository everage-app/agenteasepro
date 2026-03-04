import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { MarketingBlast, BlastChannel, MarketingAudienceType, MarketingDeliveryLog } from './types';

const channelLabels: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  X: 'X / Twitter',
  EMAIL: 'Email',
  SMS: 'SMS',
  WEBSITE: 'Website spotlight',
};

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  SCHEDULED: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  SENT: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
};

function formatCurrency(value?: string | number | null): string {
  if (value === undefined || value === null) return '';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
}

export function BlastDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [blast, setBlast] = useState<MarketingBlast | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [audienceType, setAudienceType] = useState<MarketingAudienceType>('CLIENTS');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [deliveryLogs, setDeliveryLogs] = useState<MarketingDeliveryLog[]>([]);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [emailRollup, setEmailRollup] = useState<null | {
    windowDays: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    unsubscribes: number;
    spamReports: number;
  }>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/marketing/blasts/${id}`);
      setBlast(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadDelivery = async () => {
    if (!id) return;
    setLoadingDelivery(true);
    try {
      const res = await api.get(`/marketing/blasts/${id}/deliveries`);
      setDeliveryLogs(res.data);
    } catch {
      // Non-fatal
    } finally {
      setLoadingDelivery(false);
    }
  };

  const loadEmailAnalytics = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/marketing/blasts/${id}/email-analytics`);
      setEmailRollup(res.data);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    load();
    loadDelivery();
    loadEmailAnalytics();
  }, [id]);

  const updateChannel = (channelId: string, updates: Partial<BlastChannel>) => {
    setBlast((prev) =>
      prev
        ? {
            ...prev,
            channels: prev.channels.map((channel) =>
              channel.id === channelId ? { ...channel, ...updates } : channel,
            ),
          }
        : prev,
    );
  };

  const handleSave = async () => {
    if (!blast) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/marketing/blasts/${blast.id}`, {
        title: blast.title,
        channels: blast.channels.map((channel) => ({
          id: channel.id,
          previewText: channel.previewText,
          previewHtml: channel.previewHtml,
          enabled: channel.enabled,
        })),
      });
      await load();
    } catch (err) {
      setError('Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!blast) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/marketing/blasts/${blast.id}/generate`);
      setBlast(res.data);
    } catch (err) {
      setError('Unable to regenerate copy right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!blast) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const scheduledAt = scheduleEnabled && scheduledAtLocal
        ? new Date(scheduledAtLocal).toISOString()
        : undefined;
      const res = await api.post(`/marketing/blasts/${blast.id}/send`, {
        audienceType,
        limit: 100,
        ...(scheduledAt ? { scheduledAt } : {}),
      });
      setBlast(res.data);
      if (res.data?.scheduled) {
        const when = res.data?.scheduledAt ? new Date(res.data.scheduledAt).toLocaleString() : 'scheduled time';
        setNotice(`Blast scheduled for ${when}.`);
      } else {
        setNotice('Blast sent successfully.');
      }
      await loadDelivery();
      await loadEmailAnalytics();
    } catch (err) {
      setError('Sending failed. Make sure channels have copy.');
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (value?: string | null) => {
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => undefined);
  };

  if (loading || !blast) {
    return <div className="text-slate-400 text-sm">Loading blast…</div>;
  }

  const totalClicks = blast.channels.reduce((sum, c) => sum + c.clicks, 0);
  const enabledChannels = blast.channels.filter((c) => c.enabled).length;
  const emailEnabled = blast.channels.some((c) => c.enabled && c.channel === 'EMAIL');
  const formatWhen = (value: string) => new Date(value).toLocaleString();
  const statusPill = (status: string) =>
    status === 'SENT'
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
      : status === 'FAILED'
        ? 'bg-rose-500/15 text-rose-200 border-rose-400/30'
        : 'bg-slate-700/50 text-slate-200 border-slate-600/40';

  return (
    <div className="space-y-6 pb-12">
      <button className="text-sm text-slate-400 hover:text-white" onClick={() => navigate('/marketing')}>
        ← Back to blasts
      </button>

      <Card className="p-6 border-white/10 bg-slate-900/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={statusStyles[blast.status] || 'bg-slate-700/50 text-slate-200 border-slate-600/40'}>
                {blast.status}
              </Badge>
              <Badge className="bg-white/5 text-slate-200 border-white/10">{blast.playbook.replace('_', ' ')}</Badge>
            </div>
            <input
              className="bg-transparent text-2xl font-semibold text-white focus:outline-none border-b border-transparent focus:border-white/30"
              value={blast.title}
              onChange={(e) => setBlast({ ...blast, title: e.target.value })}
            />
            {blast.listing && (
              <div className="text-slate-400 text-sm">
                {blast.listing.headline} {blast.listing.price ? `• ${formatCurrency(blast.listing.price)}` : ''}
              </div>
            )}
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <div>
              <div className="text-2xl font-semibold text-white">{enabledChannels}</div>
              <div className="uppercase tracking-wide text-xs">Channels</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">{totalClicks}</div>
              <div className="uppercase tracking-wide text-xs">Clicks</div>
            </div>
          </div>
        </div>

        {emailEnabled && (
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Email audience</div>
              <div className="text-sm text-slate-200">Choose who receives the email channel(s) when you send.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'CLIENTS', label: 'Clients' },
                { value: 'LEADS', label: 'Leads' },
                { value: 'DEALS', label: 'Deals' },
              ] as const).map((opt) => {
                const active = audienceType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudienceType(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                      active
                        ? 'border-blue-400/40 bg-blue-500/15 text-blue-100'
                        : 'border-white/12 bg-slate-950/40 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {emailEnabled && emailRollup && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Delivered</div>
              <div className="text-xl font-semibold text-white">{emailRollup.delivered}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Opens</div>
              <div className="text-xl font-semibold text-white">{emailRollup.opens}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Clicks</div>
              <div className="text-xl font-semibold text-white">{emailRollup.clicks}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Bounces</div>
              <div className="text-xl font-semibold text-white">{emailRollup.bounces}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Unsubs</div>
              <div className="text-xl font-semibold text-white">{emailRollup.unsubscribes}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Spam</div>
              <div className="text-xl font-semibold text-white">{emailRollup.spamReports}</div>
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-6 text-[11px] text-slate-500">
              Email analytics window: last {emailRollup.windowDays} days (from SendGrid event webhook)
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">{error}</div>
      )}

      {notice && (
        <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">{notice}</div>
      )}

      {emailEnabled && (
        <Card className="p-4 border-white/10 bg-slate-900/60">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="rounded border-white/20 bg-slate-900"
            />
            Schedule this blast for later
          </label>
          {scheduleEnabled && (
            <div className="mt-3">
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                className="w-full max-w-sm rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400/50 dark:[color-scheme:dark]"
              />
              <div className="mt-1 text-xs text-slate-400">Uses your local timezone and sends automatically when due.</div>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {blast.channels.map((channel) => (
          <Card key={channel.id} className="p-4 border-white/10 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">{channelLabels[channel.channel] || channel.channel}</div>
                <div className="text-xs text-slate-400">{channel.enabled ? 'Enabled' : 'Disabled'}</div>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <span className="mr-2 text-xs text-slate-400">Off</span>
                <input
                  type="checkbox"
                  checked={channel.enabled}
                  onChange={(e) => updateChannel(channel.id, { enabled: e.target.checked })}
                  className="h-0 w-0 opacity-0"
                />
                <span
                  className={`w-12 h-6 rounded-full p-1 transition ${
                    channel.enabled ? 'bg-blue-500' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition ${channel.enabled ? 'translate-x-6' : ''}`}
                  />
                </span>
                <span className="ml-2 text-xs text-slate-400">On</span>
              </label>
            </div>

            {channel.channel === 'EMAIL' || channel.channel === 'WEBSITE' ? (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[120px] rounded-2xl bg-white/5 border border-white/10 text-sm text-white p-3 focus:outline-none focus:border-blue-400/50"
                  placeholder="HTML content"
                  value={channel.previewHtml ?? ''}
                  onChange={(e) => updateChannel(channel.id, { previewHtml: e.target.value })}
                />
                <div className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => copyToClipboard(channel.previewHtml)}>
                    Copy HTML
                  </Button>
                </div>
                {channel.previewHtml && (
                  <div className="rounded-2xl border border-white/5 bg-black/30 p-3 text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: channel.previewHtml }} />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[140px] rounded-2xl bg-white/5 border border-white/10 text-sm text-white p-3 focus:outline-none focus:border-blue-400/50"
                  placeholder="Channel copy"
                  value={channel.previewText ?? ''}
                  onChange={(e) => updateChannel(channel.id, { previewText: e.target.value })}
                />
                <div className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => copyToClipboard(channel.previewText)}>
                    Copy content
                  </Button>
                </div>
              </div>
            )}

            {channel.shortUrl && (
              <div className="space-y-2 text-sm">
                <div className="text-slate-400 text-xs uppercase tracking-wide">Short link</div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-full bg-white/5 border border-white/10 px-3 py-2 text-xs text-white"
                    value={channel.shortUrl}
                    readOnly
                  />
                  <Button size="sm" variant="secondary" onClick={() => copyToClipboard(channel.shortUrl)}>
                    Copy link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(channel.shortUrl || '#', '_blank')}>
                    Open
                  </Button>
                </div>
              </div>
            )}

            {blast.status === 'SENT' && (
              <div className="flex gap-4 text-xs text-slate-400">
                <div>
                  <div className="text-white text-lg font-semibold">{channel.clicks}</div>
                  <div>Clicks</div>
                </div>
                <div>
                  <div className="text-white text-lg font-semibold">{channel.uniqueClicks}</div>
                  <div>Unique</div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-5 border-white/10 bg-slate-900/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Delivery history</div>
            <div className="text-lg font-semibold text-white">What went out via SendGrid</div>
          </div>
          <Button variant="secondary" onClick={loadDelivery} disabled={loadingDelivery}>
            {loadingDelivery ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {deliveryLogs.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">No delivery logs yet. Send a blast to see SendGrid results here.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {deliveryLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusPill(log.status)}>{log.status}</Badge>
                      {log.audienceType && <Badge className="bg-white/5 text-slate-200 border-white/10">{log.audienceType}</Badge>}
                      <span className="text-xs text-slate-400">{formatWhen(log.createdAt)}</span>
                    </div>
                    <div className="text-sm font-semibold text-white">{log.subject}</div>
                    <div className="text-xs text-slate-400">
                      Recipients: <span className="text-slate-200 font-semibold">{log.recipientsCount}</span>
                      {log.recipientsSample?.length ? (
                        <span className="ml-2 opacity-80">(sample: {log.recipientsSample.join(', ')})</span>
                      ) : null}
                    </div>
                    {log.error && <div className="text-xs text-rose-200">{log.error}</div>}
                  </div>

                  <div className="flex items-center gap-2">
                    {log.messageId && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(log.messageId || '').catch(() => undefined)}
                        className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                      >
                        Copy SendGrid ID
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AnimatePresence>
        <motion.div
          className="flex flex-wrap gap-3 justify-end"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button variant="secondary" onClick={handleGenerate} disabled={saving || sending}>
            {saving ? 'Working…' : 'Generate AI copy'}
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving || sending}>
            Save draft
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            onClick={handleSend}
            disabled={blast.status === 'SENT' || sending || (scheduleEnabled && !scheduledAtLocal)}
          >
            {sending
              ? 'Sending…'
              : blast.status === 'SENT'
                ? 'Blast sent'
                : scheduleEnabled
                  ? 'Schedule blast'
                  : 'Send blast'}
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
