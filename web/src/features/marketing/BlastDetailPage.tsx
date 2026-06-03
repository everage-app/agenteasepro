import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  MarketingBlast,
  BlastChannel,
  BlastChannelType,
  MarketingAudienceType,
  MarketingDeliveryLog,
} from './types';

const channelLabels: Record<BlastChannelType, string> = {
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

const channelPurpose: Record<BlastChannelType, string> = {
  FACEBOOK: 'Short listing post for your page or groups',
  INSTAGRAM: 'Caption-ready copy for reels, posts, or stories',
  LINKEDIN: 'Professional network update',
  X: 'Fast short-form post',
  EMAIL: 'Tracked email to selected contacts',
  SMS: 'Quick follow-up text',
  WEBSITE: 'Listing spotlight copy and landing page intro',
};

const idealLengths: Record<BlastChannelType, string> = {
  FACEBOOK: '80-180 words',
  INSTAGRAM: '120-2,000 chars',
  LINKEDIN: '70-160 words',
  X: 'Under 280 chars',
  EMAIL: 'Clear subject + scannable body',
  SMS: 'Under 320 chars',
  WEBSITE: '2-4 short paragraphs',
};

const audienceOptions: Array<{ value: MarketingAudienceType; label: string; helper: string }> = [
  { value: 'CLIENTS', label: 'Clients', helper: 'Warm sphere, past clients, and active buyers/sellers.' },
  { value: 'LEADS', label: 'Leads', helper: 'Fresh lead follow-up and nurture contacts.' },
  { value: 'DEALS', label: 'Deals', helper: 'Open deal parties only.' },
];

const quickSnippets: Array<{ key: string; label: string; text: string; socialOnly?: boolean }> = [
  {
    key: 'showing',
    label: 'Add showing CTA',
    text: 'Message me to schedule a private showing or get the digital brochure.',
  },
  {
    key: 'referral',
    label: 'Add referral CTA',
    text: 'Know someone this could fit? Send it their way or reply and I will help them get details.',
  },
  {
    key: 'compliance',
    label: 'Add fair housing note',
    text: 'Equal Housing Opportunity.',
  },
  {
    key: 'hashtags',
    label: 'Add hashtags',
    text: '#UtahRealEstate #NewListing #HomeSearch',
    socialOnly: true,
  },
];

type ChannelViewMode = 'PREVIEW' | 'EDIT';
type HtmlEditMode = 'PLAIN' | 'HTML';

const noApiShareChannels = new Set<BlastChannelType>(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'SMS']);

function formatCurrency(value?: string | number | null): string {
  if (value === undefined || value === null) return '';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
}

function stripHtml(value?: string | null): string {
  return (value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function textLengthForChannel(channel: BlastChannel): number {
  if (channel.channel === 'EMAIL' || channel.channel === 'WEBSITE') {
    return stripHtml(channel.previewHtml).length;
  }
  return (channel.previewText || '').trim().length;
}

function isChannelCopyReady(channel: BlastChannel): boolean {
  if (!channel.enabled) return true;
  if (channel.channel === 'EMAIL') {
    return Boolean((channel.previewText || '').trim()) && Boolean(stripHtml(channel.previewHtml).trim());
  }
  if (channel.channel === 'WEBSITE') {
    return Boolean(stripHtml(channel.previewHtml).trim());
  }
  return Boolean((channel.previewText || '').trim());
}

function channelCopyValue(channel: BlastChannel): string {
  if (channel.channel === 'EMAIL' || channel.channel === 'WEBSITE') {
    return stripHtml(channel.previewHtml) || channel.previewHtml || '';
  }
  return channel.previewText || '';
}

function appendHtmlSnippet(current: string | null | undefined, snippet: string): string {
  const trimmed = (current || '').trim();
  const paragraph = `<p>${snippet}</p>`;
  return trimmed ? `${trimmed}\n${paragraph}` : paragraph;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function plainTextToHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function getListingImage(blast: MarketingBlast): string | null {
  return blast.listing?.heroImageUrl || blast.listing?.primaryImageUrl || blast.listing?.photos?.[0] || null;
}

function getShareUrl(channel: BlastChannel, blast: MarketingBlast): string {
  if (channel.shortUrl) return channel.shortUrl;
  if (blast.listingId) return `${window.location.origin}/listings/${blast.listingId}`;
  return `${window.location.origin}/marketing/blasts/${blast.id}`;
}

function buildPostKit(channel: BlastChannel, blast: MarketingBlast): string {
  const price = formatCurrency(blast.listing?.price);
  const url = getShareUrl(channel, blast);
  const parts = [
    `${channelLabels[channel.channel]} post`,
    blast.listing?.headline || blast.title,
    price ? `Price: ${price}` : '',
    '',
    channelCopyValue(channel),
    '',
    url ? `Link: ${url}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function MarketingPreviewCard({ channel, blast }: { channel: BlastChannel; blast: MarketingBlast }) {
  const imageUrl = getListingImage(blast);
  const price = formatCurrency(blast.listing?.price);
  const headline = blast.listing?.headline || blast.title;
  const body = channelCopyValue(channel);
  const shareUrl = getShareUrl(channel, blast);

  if (channel.channel === 'EMAIL') {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-950">
        <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Email preview</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{channel.previewText || blast.title}</div>
          <div className="mt-1 text-xs text-slate-500">To: {headline} audience</div>
        </div>
        <div className="p-4">
          {imageUrl && <img src={imageUrl} alt="" className="mb-4 h-36 w-full rounded-xl object-cover" />}
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: channel.previewHtml || '<p>No email body yet.</p>' }} />
          <div className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white">View Details</div>
        </div>
      </div>
    );
  }

  if (channel.channel === 'WEBSITE') {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="relative min-h-[180px] bg-slate-800">
          {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-xl font-semibold text-white">{headline}</div>
            {price && <div className="mt-1 text-sm text-white/80">{price}</div>}
          </div>
        </div>
        <div className="p-4 text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: channel.previewHtml || '<p>No website spotlight yet.</p>' }} />
      </div>
    );
  }

  if (channel.channel === 'SMS') {
    return (
      <div className="mx-auto max-w-sm rounded-[2rem] border border-white/10 bg-slate-950 p-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-white/20" />
        <div className="rounded-3xl bg-blue-600 px-4 py-3 text-sm leading-relaxed text-white">
          {body || 'No text message yet.'}
          {shareUrl && <div className="mt-2 text-blue-100">{shareUrl}</div>}
        </div>
      </div>
    );
  }

  const platformTone: Record<string, string> = {
    FACEBOOK: 'Facebook page post',
    INSTAGRAM: 'Instagram caption',
    LINKEDIN: 'LinkedIn update',
    X: 'X post',
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
          {channelLabels[channel.channel].slice(0, 1)}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Your real estate page</div>
          <div className="text-xs text-slate-500">{platformTone[channel.channel] || 'Post preview'}</div>
        </div>
      </div>
      {imageUrl && <img src={imageUrl} alt="" className="h-56 w-full object-cover" />}
      <div className="space-y-3 p-4">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{body || 'No post copy yet.'}</div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{window.location.host}</div>
          <div className="mt-1 text-sm font-semibold text-white">{headline}</div>
          {price && <div className="mt-1 text-xs text-slate-400">{price}</div>}
        </div>
      </div>
    </div>
  );
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
  const [copiedChannelId, setCopiedChannelId] = useState<string | null>(null);
  const [channelViewModes, setChannelViewModes] = useState<Record<string, ChannelViewMode>>({});
  const [htmlEditModes, setHtmlEditModes] = useState<Record<string, HtmlEditMode>>({});
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
      // Delivery logs are helpful, not required for the draft editor.
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
      // Non-fatal.
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
      setNotice('Draft saved.');
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
    setNotice(null);
    try {
      const res = await api.post(`/marketing/blasts/${blast.id}/generate`);
      setBlast(res.data);
      setNotice('Fresh AI copy generated. Review each channel before sending.');
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Sending failed. Make sure channels have copy and recipients.');
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (value?: string | null, channelId?: string) => {
    if (!value) return;
    if (channelId) {
      setCopiedChannelId(channelId);
      window.setTimeout(() => setCopiedChannelId((current) => (current === channelId ? null : current)), 1800);
    }
    navigator.clipboard
      .writeText(value)
      .catch(() => undefined);
  };

  const appendSnippetToChannel = (channel: BlastChannel, snippet: string) => {
    if (channel.channel === 'EMAIL' || channel.channel === 'WEBSITE') {
      updateChannel(channel.id, { previewHtml: appendHtmlSnippet(channel.previewHtml, snippet) });
      return;
    }
    const current = (channel.previewText || '').trim();
    updateChannel(channel.id, { previewText: current ? `${current}\n\n${snippet}` : snippet });
  };

  const copyPostKit = (channel: BlastChannel) => {
    if (!blast) return;
    copyToClipboard(buildPostKit(channel, blast), channel.id);
    setNotice(`${channelLabels[channel.channel]} post kit copied.`);
  };

  const downloadAllPostKits = () => {
    if (!blast) return;
    const content = blast.channels
      .filter((channel) => channel.enabled)
      .map((channel) => buildPostKit(channel, blast))
      .join('\n\n---\n\n');
    const safeTitle = (blast.listing?.headline || blast.title || 'listing-blast')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    downloadTextFile(`${safeTitle || 'listing'}-post-kit.txt`, content);
  };

  const openPostHelper = async (channel: BlastChannel) => {
    if (!blast) return;
    const copy = channelCopyValue(channel);
    const url = getShareUrl(channel, blast);
    const kit = buildPostKit(channel, blast);
    copyToClipboard(kit, channel.id);

    if (channel.channel === 'SMS') {
      window.location.href = `sms:?&body=${encodeURIComponent(`${copy}\n${url}`.trim())}`;
      setNotice('Text message opened. Caption is also copied.');
      return;
    }

    if (channel.channel === 'X') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(copy)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      setNotice('X composer opened. Caption is also copied.');
      return;
    }

    if (channel.channel === 'FACEBOOK') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      setNotice('Facebook share window opened. Paste the copied caption before posting.');
      return;
    }

    if (channel.channel === 'LINKEDIN') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      setNotice('LinkedIn share window opened. Paste the copied caption before posting.');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: blast.listing?.headline || blast.title, text: copy, url });
        setNotice('Share sheet opened. Caption is also copied.');
        return;
      } catch {
        // Fall through to a simple copied-kit notice.
      }
    }

    if (channel.channel === 'INSTAGRAM') {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      setNotice('Instagram opened. Caption and link are copied for paste-and-post.');
      return;
    }

    setNotice(`${channelLabels[channel.channel]} post kit copied.`);
  };

  const enabledChannelList = useMemo(() => blast?.channels.filter((channel) => channel.enabled) ?? [], [blast]);
  const readyEnabledChannels = useMemo(
    () => enabledChannelList.filter((channel) => isChannelCopyReady(channel)),
    [enabledChannelList],
  );
  const missingEnabledChannels = useMemo(
    () => enabledChannelList.filter((channel) => !isChannelCopyReady(channel)),
    [enabledChannelList],
  );
  const emailEnabled = useMemo(
    () => Boolean(blast?.channels.some((channel) => channel.enabled && channel.channel === 'EMAIL')),
    [blast],
  );
  const totalClicks = useMemo(() => blast?.channels.reduce((sum, channel) => sum + channel.clicks, 0) ?? 0, [blast]);
  const completionScore = enabledChannelList.length
    ? Math.round((readyEnabledChannels.length / enabledChannelList.length) * 100)
    : 0;
  const readinessIssues = [
    ...(enabledChannelList.length === 0 ? ['Turn on at least one channel.'] : []),
    ...missingEnabledChannels.map((channel) => `${channelLabels[channel.channel]} needs copy.`),
    ...(scheduleEnabled && !emailEnabled ? ['Scheduling needs the email channel turned on.'] : []),
    ...(scheduleEnabled && !scheduledAtLocal ? ['Pick a scheduled send time.'] : []),
  ];
  const selectedAudience = audienceOptions.find((option) => option.value === audienceType) || audienceOptions[0];
  const canLaunch = Boolean(blast && blast.status !== 'SENT' && !sending && readinessIssues.length === 0);

  const formatWhen = (value: string) => new Date(value).toLocaleString();
  const statusPill = (status: string) =>
    status === 'SENT'
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
      : status === 'FAILED'
        ? 'bg-rose-500/15 text-rose-200 border-rose-400/30'
        : 'bg-slate-700/50 text-slate-200 border-slate-600/40';

  if (loading || !blast) {
    return <div className="text-sm text-slate-400">Loading blast...</div>;
  }

  return (
    <div className="space-y-5 pb-28">
      <button className="text-sm text-slate-400 hover:text-white" onClick={() => navigate('/marketing')}>
        Back to blasts
      </button>

      <Card className="overflow-hidden border-white/10 bg-slate-950/70 p-0">
        <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusStyles[blast.status] || 'bg-slate-700/50 text-slate-200 border-slate-600/40'}>
                  {blast.status}
                </Badge>
                <Badge className="bg-white/5 text-slate-200 border-white/10">{blast.playbook.replace('_', ' ')}</Badge>
                <Badge className={completionScore === 100 ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/15 text-amber-200 border-amber-400/30'}>
                  {completionScore}% ready
                </Badge>
              </div>

              <input
                className="w-full bg-transparent text-2xl font-semibold text-white outline-none border-b border-transparent pb-1 focus:border-blue-400/50 sm:text-3xl"
                value={blast.title}
                onChange={(e) => setBlast({ ...blast, title: e.target.value })}
                aria-label="Campaign title"
              />

              {blast.listing && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  <span className="font-semibold text-white">{blast.listing.headline}</span>
                  {blast.listing.price ? <span>{formatCurrency(blast.listing.price)}</span> : null}
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                    {blast.listing.status}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="text-xl font-semibold text-white">{enabledChannelList.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Channels</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="text-xl font-semibold text-white">{readyEnabledChannels.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Ready</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="text-xl font-semibold text-white">{totalClicks}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Clicks</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleGenerate} disabled={saving || sending}>
              {saving ? 'Working...' : 'Regenerate AI copy'}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving || sending}>
              Save draft
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              onClick={handleSend}
              disabled={!canLaunch || (scheduleEnabled && !scheduledAtLocal)}
            >
              {sending
                ? 'Sending...'
                : blast.status === 'SENT'
                  ? 'Blast sent'
                  : scheduleEnabled
                    ? 'Schedule blast'
                    : 'Send blast'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: '1. Review copy',
              value: `${readyEnabledChannels.length}/${enabledChannelList.length || 0}`,
              helper: 'Every enabled channel needs usable copy.',
            },
            {
              label: '2. Pick audience',
              value: selectedAudience.label,
              helper: selectedAudience.helper,
            },
            {
              label: '3. Choose timing',
              value: scheduleEnabled ? 'Scheduled' : 'Send now',
              helper: scheduleEnabled && scheduledAtLocal ? new Date(scheduledAtLocal).toLocaleString() : 'Send immediately when ready.',
            },
            {
              label: '4. Launch',
              value: readinessIssues.length ? 'Needs review' : 'Ready',
              helper: readinessIssues[0] || 'Save, send, and track results here.',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
              <div className="mt-1 text-xs text-slate-400">{item.helper}</div>
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="border-white/10 bg-slate-950/65 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Send setup</div>
                <h2 className="mt-1 text-lg font-semibold text-white">Audience and timing</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Keep the choices simple: who gets the email channel, then whether this goes now or later.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {audienceOptions.map((option) => {
                  const active = audienceType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAudienceType(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        active
                          ? 'border-blue-400/40 bg-blue-500/15 text-blue-100'
                          : 'border-white/12 bg-slate-950/40 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">{selectedAudience.label}</div>
                <div className="mt-1 text-sm text-slate-400">{selectedAudience.helper}</div>
                {!emailEnabled && (
                  <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                    Email is off. Social and website copy can still be saved, copied, and marked sent.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    disabled={!emailEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900"
                  />
                  Schedule email send
                </label>
                {scheduleEnabled ? (
                  <div className="mt-3">
                    <input
                      type="datetime-local"
                      value={scheduledAtLocal}
                      onChange={(e) => setScheduledAtLocal(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400/50 dark:[color-scheme:dark]"
                    />
                    <div className="mt-1 text-xs text-slate-400">Uses your local timezone.</div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-400">Send now stays fastest for listing pushes.</div>
                )}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {blast.channels.map((channel) => {
              const ready = isChannelCopyReady(channel);
              const isEmail = channel.channel === 'EMAIL';
              const isHtmlChannel = isEmail || channel.channel === 'WEBSITE';
              const textLength = textLengthForChannel(channel);
              const copyValue = channelCopyValue(channel);
              const socialChannel = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'].includes(channel.channel);
              const viewMode = channelViewModes[channel.id] || 'PREVIEW';
              const htmlMode = htmlEditModes[channel.id] || 'PLAIN';

              return (
                <Card
                  key={channel.id}
                  className={`border-white/10 bg-slate-950/65 p-4 sm:p-5 ${channel.enabled ? '' : 'opacity-70'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-white">{channelLabels[channel.channel]}</div>
                        <Badge className={channel.enabled ? 'bg-blue-500/15 text-blue-100 border-blue-400/30' : 'bg-slate-700/50 text-slate-300 border-slate-600/40'}>
                          {channel.enabled ? 'On' : 'Off'}
                        </Badge>
                        <Badge className={ready ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/15 text-amber-200 border-amber-400/30'}>
                          {ready ? 'Ready' : 'Needs copy'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{channelPurpose[channel.channel]}</div>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                      <span>Off</span>
                      <input
                        type="checkbox"
                        checked={channel.enabled}
                        onChange={(e) => {
                          updateChannel(channel.id, { enabled: e.target.checked });
                          if (channel.channel === 'EMAIL' && !e.target.checked) {
                            setScheduleEnabled(false);
                          }
                        }}
                        className="h-0 w-0 opacity-0"
                      />
                      <span className={`h-6 w-12 rounded-full p-1 transition ${channel.enabled ? 'bg-blue-500' : 'bg-white/10'}`}>
                        <span className={`block h-4 w-4 rounded-full bg-white transition ${channel.enabled ? 'translate-x-6' : ''}`} />
                      </span>
                      <span>On</span>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                      {(['PREVIEW', 'EDIT'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setChannelViewModes((prev) => ({ ...prev, [channel.id]: mode }))}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {mode === 'PREVIEW' ? 'Preview' : 'Edit'}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400">{textLength.toLocaleString()} chars - ideal {idealLengths[channel.channel]}</div>
                  </div>

                  {viewMode === 'PREVIEW' ? (
                    <div className="mt-3">
                      <MarketingPreviewCard channel={channel} blast={blast} />
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-xs font-semibold text-slate-200">Posting kit</div>
                        <div className="mt-1 text-xs text-slate-400">
                          Caption, link, and preview-ready content.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => copyPostKit(channel)} disabled={!copyValue}>
                            {copiedChannelId === channel.id ? 'Copied kit' : 'Copy post kit'}
                          </Button>
                          {noApiShareChannels.has(channel.channel) && (
                            <Button size="sm" variant="outline" onClick={() => void openPostHelper(channel)} disabled={!copyValue}>
                              Open/share
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setChannelViewModes((prev) => ({ ...prev, [channel.id]: 'EDIT' }))}
                          >
                            Edit copy
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      {isEmail && (
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-200">Email subject</label>
                          <input
                            value={channel.previewText ?? ''}
                            onChange={(e) => updateChannel(channel.id, { previewText: e.target.value })}
                            placeholder="Subject line"
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400/50"
                          />
                        </div>
                      )}

                      {isHtmlChannel && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-slate-400">Editor mode</div>
                          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                            {(['PLAIN', 'HTML'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setHtmlEditModes((prev) => ({ ...prev, [channel.id]: mode }))}
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                  htmlMode === mode ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                {mode === 'PLAIN' ? 'Plain text' : 'HTML'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-semibold text-slate-200">
                          {isHtmlChannel ? (isEmail ? 'Email body' : 'Website spotlight') : 'Post copy'}
                        </label>
                        <textarea
                          className="w-full min-h-[170px] rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400/50"
                          placeholder={isHtmlChannel && htmlMode === 'HTML' ? 'HTML content' : 'Write the copy agents will paste or send'}
                          value={isHtmlChannel && htmlMode === 'PLAIN' ? stripHtml(channel.previewHtml) : isHtmlChannel ? channel.previewHtml ?? '' : channel.previewText ?? ''}
                          onChange={(e) =>
                            updateChannel(
                              channel.id,
                              isHtmlChannel
                                ? { previewHtml: htmlMode === 'PLAIN' ? plainTextToHtml(e.target.value) : e.target.value }
                                : { previewText: e.target.value },
                            )
                          }
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {quickSnippets
                          .filter((snippet) => !snippet.socialOnly || socialChannel)
                          .map((snippet) => (
                            <button
                              key={snippet.key}
                              type="button"
                              onClick={() => appendSnippetToChannel(channel, snippet.text)}
                              className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                            >
                              {snippet.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {channel.shortUrl && (
                    <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
                      <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-cyan-200">Tracking link</div>
                      <div className="flex gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white"
                          value={channel.shortUrl}
                          readOnly
                        />
                        <Button size="sm" variant="secondary" onClick={() => copyToClipboard(channel.shortUrl, channel.id)}>
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => copyToClipboard(copyValue, channel.id)} disabled={!copyValue}>
                      {copiedChannelId === channel.id ? 'Copied' : isHtmlChannel ? 'Copy text' : 'Copy content'}
                    </Button>
                    {channel.shortUrl && (
                      <Button size="sm" variant="outline" onClick={() => window.open(channel.shortUrl || '#', '_blank')}>
                        Open link
                      </Button>
                    )}
                  </div>

                  {blast.status === 'SENT' && (
                    <div className="mt-4 flex gap-4 border-t border-white/10 pt-3 text-xs text-slate-400">
                      <div>
                        <div className="text-lg font-semibold text-white">{channel.clicks}</div>
                        <div>Clicks</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">{channel.uniqueClicks}</div>
                        <div>Unique</div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="border-cyan-400/20 bg-cyan-500/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Launch guardrails</div>
            <div className="mt-2 text-lg font-semibold text-white">{readinessIssues.length ? 'Needs review' : 'Ready to launch'}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${completionScore}%` }} />
            </div>
            <div className="mt-3 space-y-2">
              {readinessIssues.length ? (
                readinessIssues.slice(0, 5).map((issue) => (
                  <div key={issue} className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    {issue}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Copy, audience, and timing are ready.
                </div>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-950/65 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Campaign kit</div>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Listing</span>
                <span className="text-right font-semibold text-white">{blast.listing?.headline || 'No listing attached'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Price</span>
                <span className="text-white">{formatCurrency(blast.listing?.price) || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Audience</span>
                <span className="text-white">{selectedAudience.label}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Timing</span>
                <span className="text-right text-white">
                  {scheduleEnabled && scheduledAtLocal ? new Date(scheduledAtLocal).toLocaleString() : 'Send now'}
                </span>
              </div>
            </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {blast.channels.map((channel) => (
                <span
                  key={channel.id}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    channel.enabled
                      ? 'border-blue-400/30 bg-blue-500/10 text-blue-100'
                      : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  {channelLabels[channel.channel]}
                </span>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <div className="text-xs font-semibold text-cyan-100">Manual posting kit</div>
              <div className="mt-1 text-xs text-cyan-100/75">
                Captions, share links, and downloadable notes.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={downloadAllPostKits}>
                  Download kit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const firstShareChannel = blast.channels.find((channel) => channel.enabled && noApiShareChannels.has(channel.channel));
                    if (firstShareChannel) void openPostHelper(firstShareChannel);
                  }}
                  disabled={!blast.channels.some((channel) => channel.enabled && noApiShareChannels.has(channel.channel))}
                >
                  Copy first post
                </Button>
              </div>
            </div>
          </Card>

          {emailEnabled && emailRollup && (
            <Card className="border-white/10 bg-slate-950/65 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Email performance</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Delivered', emailRollup.delivered],
                  ['Opens', emailRollup.opens],
                  ['Clicks', emailRollup.clicks],
                  ['Bounces', emailRollup.bounces],
                  ['Unsubs', emailRollup.unsubscribes],
                  ['Spam', emailRollup.spamReports],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-lg font-semibold text-white">{value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Window: last {emailRollup.windowDays} days</div>
            </Card>
          )}
        </aside>
      </div>

      <Card className="border-white/10 bg-slate-950/65 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Delivery history</div>
            <div className="text-lg font-semibold text-white">What went out via SendGrid</div>
          </div>
          <Button variant="secondary" onClick={loadDelivery} disabled={loadingDelivery}>
            {loadingDelivery ? 'Refreshing...' : 'Refresh'}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusPill(log.status)}>{log.status}</Badge>
                      {log.audienceType && <Badge className="bg-white/5 text-slate-200 border-white/10">{log.audienceType}</Badge>}
                      <span className="text-xs text-slate-400">{formatWhen(log.createdAt)}</span>
                    </div>
                    <div className="text-sm font-semibold text-white">{log.subject}</div>
                    <div className="text-xs text-slate-400">
                      Recipients: <span className="font-semibold text-slate-200">{log.recipientsCount}</span>
                      {log.recipientsSample?.length ? (
                        <span className="ml-2 opacity-80">(sample: {log.recipientsSample.join(', ')})</span>
                      ) : null}
                    </div>
                    {log.error && <div className="text-xs text-rose-200">{log.error}</div>}
                  </div>

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
            ))}
          </div>
        )}
      </Card>

      <AnimatePresence>
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl md:left-[185px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                {readinessIssues.length ? readinessIssues[0] : 'Ready to launch this marketing blast.'}
              </div>
              <div className="text-xs text-slate-400">
                {readyEnabledChannels.length}/{enabledChannelList.length || 0} enabled channels ready
                {emailEnabled ? ` - ${selectedAudience.label} selected` : ' - email is off'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleGenerate} disabled={saving || sending}>
                {saving ? 'Working...' : 'Regenerate'}
              </Button>
              <Button variant="outline" onClick={handleSave} disabled={saving || sending}>
                Save
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-500"
                onClick={handleSend}
                disabled={!canLaunch || (scheduleEnabled && !scheduledAtLocal)}
              >
                {sending
                  ? 'Sending...'
                  : blast.status === 'SENT'
                    ? 'Blast sent'
                    : scheduleEnabled
                      ? 'Schedule'
                      : 'Send now'}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
