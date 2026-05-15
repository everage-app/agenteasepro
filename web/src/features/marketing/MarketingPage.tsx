import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { MarketingBlast, BlastPlaybook, ListingSummary } from './types';
import { ChannelSettingsDrawer } from './components/ChannelSettingsDrawer';

type ChannelConnectionType = 'EMAIL' | 'SMS' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'WEBSITE';

type ChannelConnection = {
  type: ChannelConnectionType;
  status: 'connected' | 'missing';
  displayName?: string;
  config?: any;
};

type ClientStage =
  | 'NEW_LEAD'
  | 'NURTURE'
  | 'ACTIVE'
  | 'UNDER_CONTRACT'
  | 'CLOSED'
  | 'PAST_CLIENT'
  | 'DEAD';

type ClientTemperature = 'HOT' | 'WARM' | 'COLD';

type DirectMailRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  stage: ClientStage;
  temperature: ClientTemperature;
  tags: string[];
  mailingAddress: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  lastMarketingAt: string | null;
};

type DirectMailFilters = {
  stage?: ClientStage[];
  temperature?: ClientTemperature[];
  tagsAny?: string[];
  search?: string;
  requireAddress: boolean;
  limit: number;
  markLastMarketingAt: boolean;
};

type MassEmailAudience = 'CLIENTS' | 'LEADS' | 'CLIENTS_AND_LEADS';
type MassEmailAudienceMode = 'ALL' | 'ENGAGED' | 'NON_OPENERS' | 'AI_RECOMMENDED';

type MassEmailPrefillState = {
  audienceType?: MassEmailAudience;
  audienceMode?: MassEmailAudienceMode;
  recipientEmails?: string[];
  subject?: string;
  message?: string;
  limit?: number;
  sourceLabel?: string;
  sourceBlastId?: string;
};

type SenderHealth = {
  status: 'ready' | 'attention' | 'needs_setup';
  identity: {
    sendingFromEmail: string;
    replyTo?: string | null;
    usingVerifiedFallback: boolean;
  };
  checks: Array<{ key: string; label: string; status: string }>;
  deliverability: {
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    unsubscribes: number;
    spamReports: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
};

type AudienceRecommendation = {
  id: string;
  contactType: 'client' | 'lead';
  name: string;
  email: string;
  score: number;
  reasons: string[];
};

type AudienceRecommendationResponse = {
  count: number;
  recipientEmails: string[];
  strategy: string;
  aiConfigured: boolean;
  recommendations: AudienceRecommendation[];
};

type MarketingRoiSummary = {
  windowDays: number;
  totals: {
    campaignsSent: number;
    recipients: number;
    delivered: number;
    opens: number;
    clicks: number;
    replies: number;
    bounces: number;
    uniqueEngaged: number;
    followUpTasks: number;
    activeDeals: number;
    estimatedPipelineValue: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
  topCampaigns: Array<{
    blastId: string;
    title: string;
    uniqueEngaged: number;
    clicks: number;
    replies: number;
    engagementRate: number;
  }>;
};

type EmailBlastTemplate = {
  id: string;
  name: string;
  subject: string;
  message: string;
  badge: string;
};

const playbookLabels: Record<BlastPlaybook, string> = {
  NEW_LISTING: 'New listing',
  PRICE_REDUCTION: 'Price reduction',
  OPEN_HOUSE: 'Open house',
  UNDER_CONTRACT: 'Under contract',
  JUST_SOLD: 'Just sold',
  CUSTOM: 'Custom',
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  SCHEDULED: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  SENT: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
};

const playbooksInOrder: BlastPlaybook[] = [
  'NEW_LISTING',
  'PRICE_REDUCTION',
  'OPEN_HOUSE',
  'UNDER_CONTRACT',
  'JUST_SOLD',
  'CUSTOM',
];

const emailBlastTemplates: EmailBlastTemplate[] = [
  {
    id: 'MARKET_UPDATE',
    name: 'Market Update',
    badge: 'Weekly',
    subject: 'Quick market update from your local real estate advisor',
    message:
      'Hi there,\n\nI wanted to share a quick market update in your area. Inventory and pricing trends are shifting, and there may be opportunities for you right now.\n\nIf you want a custom snapshot for your neighborhood, reply and I’ll send one over today.\n\nThanks!',
  },
  {
    id: 'NEW_LISTING',
    name: 'New Listing Alert',
    badge: 'Listing',
    subject: 'New listing alert: homes you may want to see this week',
    message:
      'Hi there,\n\nI just pulled new listings that match what many clients are asking for right now.\n\nIf you want the list, reply with your ideal price range and area and I’ll send options that fit your goals.\n\nTalk soon!',
  },
  {
    id: 'OPEN_HOUSE',
    name: 'Open House Invite',
    badge: 'Event',
    subject: 'You’re invited: upcoming open houses this weekend',
    message:
      'Hi there,\n\nI’m hosting and tracking several strong open house opportunities this weekend.\n\nReply if you want the addresses and times, and I can also flag the ones most likely to move quickly.\n\nSee you soon!',
  },
  {
    id: 'PAST_CLIENT',
    name: 'Past Client Touch',
    badge: 'Relationship',
    subject: 'Checking in + home value update offer',
    message:
      'Hi there,\n\nJust checking in and hoping all is going well with your home. If you’d like, I can send you a fresh home value range and neighborhood activity summary.\n\nNo pressure at all—just reply and I’ll put it together.\n\nAlways here if you need anything.',
  },
];

function formatCurrency(value?: string | number | null): string {
  if (value === undefined || value === null) return '';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return '';
  return `$${num.toLocaleString()}`;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Draft';
  return new Date(value).toLocaleString();
}

function getChannelIcon(type: ChannelConnectionType) {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case 'EMAIL':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'SMS':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    case 'FACEBOOK':
    case 'INSTAGRAM':
    case 'LINKEDIN':
    case 'X':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
        </svg>
      );
    case 'WEBSITE':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      );
  }
}

function getChannelLabel(type: ChannelConnectionType) {
  const labels: Record<ChannelConnectionType, string> = {
    EMAIL: 'Email',
    SMS: 'Text',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    LINKEDIN: 'LinkedIn',
    X: 'X',
    WEBSITE: 'Website',
  };
  return labels[type];
}

export function MarketingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [blasts, setBlasts] = useState<MarketingBlast[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelConnectionType | null>(null);

  const [directMailOpen, setDirectMailOpen] = useState(false);
  const [massEmailOpen, setMassEmailOpen] = useState(false);
  const [runtimeMassEmailPrefill, setRuntimeMassEmailPrefill] = useState<MassEmailPrefillState | null>(null);
  const [senderHealth, setSenderHealth] = useState<SenderHealth | null>(null);
  const [roiSummary, setRoiSummary] = useState<MarketingRoiSummary | null>(null);
  const [audienceRecommendations, setAudienceRecommendations] = useState<AudienceRecommendationResponse | null>(null);
  const [smartActionLoading, setSmartActionLoading] = useState<string | null>(null);
  const [smartActionError, setSmartActionError] = useState<string | null>(null);
  const [smartActionSuccess, setSmartActionSuccess] = useState<string | null>(null);

  const prefillFromState = useMemo<MassEmailPrefillState | null>(() => {
    const candidate = (location.state as any)?.massEmailPrefill as MassEmailPrefillState | undefined;
    if (!candidate) return null;
    return {
      audienceType: candidate.audienceType,
      recipientEmails: Array.isArray(candidate.recipientEmails) ? candidate.recipientEmails : [],
      subject: candidate.subject,
      message: candidate.message,
      limit: candidate.limit,
      sourceLabel: candidate.sourceLabel,
      audienceMode: candidate.audienceMode,
      sourceBlastId: candidate.sourceBlastId,
    };
  }, [location.state]);

  const [emailAnalytics, setEmailAnalytics] = useState<null | {
    windowDays30: {
      sent: number;
      delivered: number;
      opens: number;
      clicks: number;
      bounces: number;
      unsubscribes: number;
      spamReports: number;
    };
    windowDays7: {
      delivered: number;
      opens: number;
      clicks: number;
      bounces: number;
      unsubscribes: number;
      spamReports: number;
    };
  }>(null);

  // Check for prefill from Listings page
  const prefillListingId = searchParams.get('newBlastForListing');

  const loadBlasts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketing/blasts');
      setBlasts(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      const res = await api.get('/channels');
      setChannels(res.data);
    } catch (err) {
      console.error('Failed to load channels', err);
    }
  };

  const loadEmailAnalytics = async () => {
    await api
      .get('/marketing/analytics/summary')
      .then((res) => setEmailAnalytics(res.data))
      .catch(() => undefined);
  };

  const loadMarketingIntelligence = async () => {
    await Promise.allSettled([
      api.get('/marketing/email/sender-health').then((res) => setSenderHealth(res.data)),
      api.get('/marketing/roi/summary').then((res) => setRoiSummary(res.data)),
    ]);
  };

  useEffect(() => {
    loadBlasts();
    loadChannels();
    loadEmailAnalytics();
    loadMarketingIntelligence();
  }, []);

  // Auto-open drawer if prefill listing ID is present
  useEffect(() => {
    if (prefillListingId && !drawerOpen) {
      setDrawerOpen(true);
    }
  }, [prefillListingId]);

  useEffect(() => {
    if (!prefillFromState) return;
    setMassEmailOpen(true);
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [prefillFromState, navigate, location.pathname, location.search]);

  const closeDrawerAndClearParams = () => {
    setDrawerOpen(false);
    // Clear the query param
    if (prefillListingId) {
      setSearchParams({});
    }
  };

  const aggregateMetrics = useMemo(() => {
    const totalClicks = blasts.reduce((sum, blast) => sum + blast.channels.reduce((cSum, c) => cSum + c.clicks, 0), 0);
    const sent = blasts.filter((b) => b.status === 'SENT').length;
    return { totalClicks, sent };
  }, [blasts]);

  const latestSentBlast = useMemo(() => {
    return [...blasts]
      .filter((blast) => blast.status === 'SENT')
      .sort((a, b) => new Date(b.sentAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.updatedAt || a.createdAt || 0).getTime())[0];
  }, [blasts]);

  const activeMassEmailPrefill = runtimeMassEmailPrefill || prefillFromState || null;

  const openChannelSettings = (type: ChannelConnectionType) => {
    setSelectedChannel(type);
    setSettingsDrawerOpen(true);
  };

  const openMassEmailWithPrefill = (prefill: MassEmailPrefillState) => {
    setRuntimeMassEmailPrefill(prefill);
    setSmartActionError(null);
    setSmartActionSuccess(null);
    setMassEmailOpen(true);
  };

  const copyBlastLink = async (blastId: string) => {
    const url = `${window.location.origin}/marketing/blasts/${blastId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error('Failed to copy blast link', err);
    }
  };

  const loadAudienceRecommendations = async () => {
    setSmartActionLoading('recommendations');
    setSmartActionError(null);
    setSmartActionSuccess(null);
    try {
      const res = await api.post('/marketing/email/audience-recommendations', {
        audienceType: 'CLIENTS_AND_LEADS',
        limit: 50,
      });
      setAudienceRecommendations(res.data);
      setSmartActionSuccess(`Found ${res.data?.count || 0} high-ROI contacts.`);
    } catch (err: any) {
      setSmartActionError(err?.response?.data?.error || 'Could not build smart audience.');
    } finally {
      setSmartActionLoading(null);
    }
  };

  const startRecommendedAudienceCampaign = () => {
    if (!audienceRecommendations?.recipientEmails?.length) {
      void loadAudienceRecommendations();
      return;
    }
    openMassEmailWithPrefill({
      audienceType: 'CLIENTS_AND_LEADS',
      audienceMode: 'AI_RECOMMENDED',
      recipientEmails: audienceRecommendations.recipientEmails,
      subject: 'Quick real estate update I thought you would want',
      message: 'Hi there,\n\nI pulled together a timely real estate update based on what is happening right now. If you want the short version for your neighborhood or goals, reply here and I will send it over.\n\nTalk soon!',
      limit: audienceRecommendations.recipientEmails.length,
      sourceLabel: 'AI audience recommendations',
    });
  };

  const startEngagedAudienceCampaign = () => {
    openMassEmailWithPrefill({
      audienceType: 'CLIENTS_AND_LEADS',
      audienceMode: 'ENGAGED',
      subject: 'Following up on what caught your eye',
      message: 'Hi there,\n\nI noticed there has been some interest in recent real estate updates, so I wanted to follow up with something useful. Reply with your area or goal and I will send a focused snapshot today.\n\nThanks!',
      limit: 100,
      sourceLabel: 'recently engaged contacts',
    });
  };

  const startNonOpenerCampaign = async (blast: MarketingBlast) => {
    setSmartActionLoading(`non-openers:${blast.id}`);
    setSmartActionError(null);
    setSmartActionSuccess(null);
    try {
      const res = await api.get(`/marketing/blasts/${blast.id}/non-openers`);
      const recipientEmails = res.data?.recipientEmails || [];
      if (!recipientEmails.length) {
        setSmartActionError('No sendable non-openers found for that blast yet.');
        return;
      }
      openMassEmailWithPrefill({
        audienceType: 'CLIENTS_AND_LEADS',
        audienceMode: 'NON_OPENERS',
        recipientEmails,
        subject: res.data?.subject || `Following up: ${blast.title}`,
        message: res.data?.message || `Hi, I wanted to resend this in case it is helpful.\n\n${blast.title}`,
        limit: recipientEmails.length,
        sourceLabel: `non-openers from ${blast.title}`,
        sourceBlastId: blast.id,
      });
    } catch (err: any) {
      setSmartActionError(err?.response?.data?.error || 'Could not load non-openers.');
    } finally {
      setSmartActionLoading(null);
    }
  };

  const createHotTasksForBlast = async (blast: MarketingBlast) => {
    setSmartActionLoading(`tasks:${blast.id}`);
    setSmartActionError(null);
    setSmartActionSuccess(null);
    try {
      const res = await api.post(`/marketing/blasts/${blast.id}/engagement-tasks`, { limit: 25 });
      setSmartActionSuccess(`${res.data?.created || 0} follow-up tasks created from hot campaign activity.`);
      await loadMarketingIntelligence();
    } catch (err: any) {
      setSmartActionError(err?.response?.data?.error || 'Could not create follow-up tasks.');
    } finally {
      setSmartActionLoading(null);
    }
  };

  return (
    <PageLayout
      title="Marketing"
      subtitle="Launch and track marketing campaigns for your listings"
      actions={
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setMassEmailOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
          >
            Mass email
          </Button>
          <Button
            onClick={() => setDirectMailOpen(true)}
            className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500"
          >
            Direct mail
          </Button>
          <Button onClick={() => setDrawerOpen(true)} className="bg-blue-600 hover:bg-blue-500">
            + Listing blast
          </Button>
        </div>
      }
    >
      {/* Campaign guidance */}
      <section className="mb-4 sm:mb-6">
        <Card className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Campaign guidance</div>
              <div className="mt-1 text-base sm:text-lg font-semibold text-white">Simple send flow</div>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                1) Pick channel, 2) confirm audience, 3) preview message, 4) send now or schedule.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setMassEmailOpen(true)}>
                Start email blast
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(true)}>
                Start listing blast
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-4 sm:mb-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/14 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Sender health</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {senderHealth?.status === 'ready' ? 'Ready' : senderHealth?.status === 'needs_setup' ? 'Needs setup' : 'Attention'}
                </div>
              </div>
              <Badge className={senderHealth?.status === 'ready' ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/15 text-amber-200 border-amber-400/30'}>
                {senderHealth?.identity?.usingVerifiedFallback ? 'Verified sender' : 'Custom sender'}
              </Badge>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">From</span>
                <span className="truncate text-right text-white">{senderHealth?.identity?.sendingFromEmail || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Reply-to</span>
                <span className="truncate text-right text-white">{senderHealth?.identity?.replyTo || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                  <div className="text-base font-semibold text-white">{senderHealth?.deliverability?.openRate ?? 0}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Open</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                  <div className="text-base font-semibold text-white">{senderHealth?.deliverability?.clickRate ?? 0}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Click</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                  <div className="text-base font-semibold text-white">{senderHealth?.deliverability?.bounceRate ?? 0}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Bounce</div>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={loadMarketingIntelligence}
              className="mt-4 w-full"
            >
              Refresh health
            </Button>
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/14 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Campaign ROI</div>
            <div className="mt-1 text-lg font-semibold text-white">Last {roiSummary?.windowDays ?? 90} days</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xl font-semibold text-white">{roiSummary?.totals.uniqueEngaged ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Engaged</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xl font-semibold text-white">{roiSummary?.totals.followUpTasks ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Tasks</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xl font-semibold text-white">{roiSummary?.rates.clickRate ?? 0}%</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Click rate</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xl font-semibold text-white">{formatCurrency(roiSummary?.totals.estimatedPipelineValue || 0)}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Pipeline</div>
              </div>
            </div>
            {roiSummary?.topCampaigns?.[0] && (
              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                Top: {roiSummary.topCampaigns[0].title} · {roiSummary.topCampaigns[0].uniqueEngaged} engaged
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/14 backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-violet-300">Smart audiences</div>
            <div className="mt-1 text-lg font-semibold text-white">High-ROI follow-up</div>
            <div className="mt-4 grid gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={startRecommendedAudienceCampaign}
                disabled={smartActionLoading === 'recommendations'}
              >
                {smartActionLoading === 'recommendations' ? 'Scoring audience…' : audienceRecommendations?.count ? 'Use AI audience' : 'Score AI audience'}
              </Button>
              <Button size="sm" variant="secondary" onClick={startEngagedAudienceCampaign}>
                Send to engaged only
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => latestSentBlast && startNonOpenerCampaign(latestSentBlast)}
                disabled={!latestSentBlast || smartActionLoading?.startsWith('non-openers')}
              >
                Resend non-openers
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => latestSentBlast && createHotTasksForBlast(latestSentBlast)}
                disabled={!latestSentBlast || smartActionLoading?.startsWith('tasks')}
              >
                Create hot tasks
              </Button>
            </div>
            {audienceRecommendations?.strategy && (
              <div className="mt-3 text-xs text-slate-300">{audienceRecommendations.strategy}</div>
            )}
            {audienceRecommendations?.recommendations?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {audienceRecommendations.recommendations.slice(0, 3).map((item) => (
                  <span key={item.id} className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-100">
                    {item.name} · {item.score}
                  </span>
                ))}
              </div>
            ) : null}
            {smartActionSuccess && <div className="mt-3 text-xs text-emerald-300">{smartActionSuccess}</div>}
            {smartActionError && <div className="mt-3 text-xs text-rose-300">{smartActionError}</div>}
          </Card>
        </div>
      </section>

      {/* Outreach Hub */}
      <section className="mb-4 sm:mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-950/70 via-slate-950/55 to-slate-950/70 border border-white/14 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)]">
            <div className="flex flex-col h-full gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/15 text-blue-200 border-blue-400/30 uppercase tracking-wide">Email blast</Badge>
                  <Badge className="bg-white/5 text-slate-200 border-white/10">Leads + Clients</Badge>
                  <Badge className="bg-amber-500/15 text-amber-200 border-amber-400/30">200 / month</Badge>
                </div>
                <div className="text-xl font-semibold text-white">Email campaigns that feel like Mailchimp, but simpler</div>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Choose a template, tailor your subject and message, preview recipients, then send in-app.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5">Templates</span>
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5">Audience preview</span>
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5">Quota guardrail</span>
                </div>
              </div>
              <div className="mt-auto">
                <Button
                  onClick={() => setMassEmailOpen(true)}
                  className="min-h-[44px] bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                >
                  Build email blast
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-950/70 via-slate-950/55 to-slate-950/70 border border-white/14 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)]">
            <div className="flex flex-col h-full gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30 uppercase tracking-wide">Direct mail</Badge>
                  <Badge className="bg-white/5 text-slate-200 border-white/10">Clients</Badge>
                </div>
                <div className="text-xl font-semibold text-white">Direct Mail: postcards, pop-bys, and referrals</div>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Segment by temperature and stage, export a clean CSV for labels/postcards, and optionally mark recipients as marketed.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5">Filter: HOT/WARM/COLD</span>
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5">Filter: stage + tags</span>
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5">Export: CSV</span>
                </div>
              </div>
              <div className="mt-auto">
                <Button
                  onClick={() => setDirectMailOpen(true)}
                  className="min-h-[44px] bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500"
                >
                  Build mailing list
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Channel Connections Bar */}
      <div className="mt-2 sm:mt-3 mb-3 sm:mb-4 flex flex-wrap gap-2 rounded-2xl sm:rounded-3xl bg-slate-950/50 px-3 sm:px-4 py-2.5 sm:py-3 backdrop-blur-xl border border-white/10">
        <div className="w-full sm:w-auto flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 mb-2 sm:mb-0 sm:mr-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Channels
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {channels.map((channel) => {
            const isConnected = channel.status === 'connected';
            return (
              <button
                key={channel.type}
                onClick={() => openChannelSettings(channel.type)}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 py-1.5 text-xs cursor-pointer border transition min-h-[36px] active:scale-95 ${
                  isConnected
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15 active:bg-emerald-400/20'
                    : 'border-white/12 bg-white/5 text-slate-200 hover:bg-white/10 active:bg-white/15'
                }`}
              >
                {getChannelIcon(channel.type)}
                <span className="font-medium">{getChannelLabel(channel.type)}</span>
                {isConnected && channel.displayName && (
                  <span className="hidden sm:inline text-[10px] opacity-70">• {channel.displayName}</span>
                )}
                {!isConnected && (
                  <span className="hidden xs:inline text-[10px] opacity-60">Not connected</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/14 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
          <div className="text-center sm:text-left">
            <div className="text-slate-400 uppercase text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em]">Blasts</div>
            <div className="text-xl sm:text-2xl font-semibold text-white">{blasts.length}</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-slate-400 uppercase text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em]">Sent</div>
            <div className="text-xl sm:text-2xl font-semibold text-white">{aggregateMetrics.sent}</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-slate-400 uppercase text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em]">Clicks</div>
            <div className="text-xl sm:text-2xl font-semibold text-white">{aggregateMetrics.totalClicks}</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-slate-400 uppercase text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em]">Delivered</div>
            <div className="text-xl sm:text-2xl font-semibold text-white">{emailAnalytics?.windowDays30.delivered ?? '—'}</div>
            <div className="text-[10px] text-slate-500">last 30d</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-slate-400 uppercase text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em]">Opens</div>
            <div className="text-xl sm:text-2xl font-semibold text-white">{emailAnalytics?.windowDays30.opens ?? '—'}</div>
            <div className="text-[10px] text-slate-500">last 30d</div>
          </div>
        </div>
      </Card>

      <div className="mt-4 sm:mt-6 space-y-5 sm:space-y-6">
        {loading && <div className="text-slate-500 text-sm">Loading blasts…</div>}
        {!loading && blasts.length === 0 && (
          <Card className="p-6 sm:p-10 text-center space-y-3 sm:space-y-4 rounded-2xl sm:rounded-3xl bg-slate-950/80 border border-white/14 backdrop-blur-2xl shadow-[0_22px_60px_rgba(0,0,0,0.85)]">
            <h3 className="text-lg sm:text-xl font-semibold text-white">Ready to broadcast a listing?</h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
              Create your first Marketing Blast to push a listing across Facebook, Instagram, LinkedIn, email, SMS, and your
              website—complete with AI-generated copy you can tweak before publishing.
            </p>
            <Button onClick={() => setDrawerOpen(true)} className="bg-blue-600 hover:bg-blue-500 w-full sm:w-auto min-h-[44px]">
              Launch listing blast
            </Button>
          </Card>
        )}

        {blasts.map((blast) => {
          const totalClicks = blast.channels.reduce((sum, c) => sum + c.clicks, 0);
          const enabledChannels = blast.channels.filter((c) => c.enabled).length;
          return (
            <Card
              key={blast.id}
              className="p-5 rounded-3xl border border-white/14 bg-slate-950/60 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)] hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(56,189,248,0.5)] transition-all duration-300 cursor-pointer"
              onClick={() => navigate(`/marketing/blasts/${blast.id}`)}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge className={`uppercase tracking-wide ${statusClasses[blast.status] || 'bg-slate-700/50 text-slate-200 border-slate-600/40'}`}>
                      {blast.status}
                    </Badge>
                    <Badge className="bg-white/5 text-slate-200 border-white/10">{playbookLabels[blast.playbook]}</Badge>
                  </div>
                  <div className="text-lg font-semibold text-white">{blast.title}</div>
                  {blast.listing && (
                    <div className="text-sm text-slate-400">
                      {blast.listing.headline} {blast.listing.price ? `• ${formatCurrency(blast.listing.price)}` : ''}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3 text-sm text-slate-300">
                  <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">{enabledChannels}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Channels</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">{totalClicks}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Clicks</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">{formatDate(blast.sentAt)}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Last action</div>
                  </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/marketing/blasts/${blast.id}`);
                      }}
                      className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyBlastLink(blast.id);
                      }}
                      className="rounded-full border border-slate-400/30 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
                    >
                      Copy link
                    </button>
                    {blast.status === 'SENT' && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void startNonOpenerCampaign(blast);
                          }}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                        >
                          Non-openers
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void createHotTasksForBlast(blast);
                          }}
                          className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200 hover:bg-violet-500/20"
                        >
                          Hot tasks
                        </button>
                      </>
                    )}
                    {(blast.listingId || blast.listing?.id) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/listings');
                        }}
                        className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Listing
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {drawerOpen && (
        <NewBlastPanel
          channels={channels}
          prefillListingId={prefillListingId}
          onClose={closeDrawerAndClearParams}
          onCreated={(blastId) => {
            closeDrawerAndClearParams();
            navigate(`/marketing/blasts/${blastId}`);
          }}
        />
      )}

      {directMailOpen && <DirectMailPanel onClose={() => setDirectMailOpen(false)} />}
      {massEmailOpen && (
        <MassEmailPanel
          initialAudienceType={activeMassEmailPrefill?.audienceType}
          initialAudienceMode={activeMassEmailPrefill?.audienceMode}
          initialRecipientEmails={activeMassEmailPrefill?.recipientEmails}
          initialSubject={activeMassEmailPrefill?.subject}
          initialMessage={activeMassEmailPrefill?.message}
          initialLimit={activeMassEmailPrefill?.limit}
          sourceLabel={activeMassEmailPrefill?.sourceLabel}
          sourceBlastId={activeMassEmailPrefill?.sourceBlastId}
          onClose={() => {
            setMassEmailOpen(false);
            setRuntimeMassEmailPrefill(null);
          }}
          onSent={async () => {
            await loadBlasts();
            await loadEmailAnalytics();
            await loadMarketingIntelligence();
          }}
        />
      )}

      <ChannelSettingsDrawer
        open={settingsDrawerOpen}
        type={selectedChannel}
        initialConfig={channels.find(c => c.type === selectedChannel)?.config}
        onClose={() => setSettingsDrawerOpen(false)}
        onSaved={loadChannels}
      />
    </PageLayout>
  );
}

function MassEmailPanel({
  onClose,
  onSent,
  initialAudienceType,
  initialAudienceMode,
  initialRecipientEmails,
  initialSubject,
  initialMessage,
  initialLimit,
  sourceLabel,
  sourceBlastId,
}: {
  onClose: () => void;
  onSent: () => Promise<void> | void;
  initialAudienceType?: MassEmailAudience;
  initialAudienceMode?: MassEmailAudienceMode;
  initialRecipientEmails?: string[];
  initialSubject?: string;
  initialMessage?: string;
  initialLimit?: number;
  sourceLabel?: string;
  sourceBlastId?: string;
}) {
  const [audienceType, setAudienceType] = useState<MassEmailAudience>(initialAudienceType || 'CLIENTS_AND_LEADS');
  const [audienceMode, setAudienceMode] = useState<MassEmailAudienceMode>(initialAudienceMode || 'ALL');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(emailBlastTemplates[0].id);
  const [subject, setSubject] = useState(initialSubject || emailBlastTemplates[0].subject);
  const [message, setMessage] = useState(initialMessage || emailBlastTemplates[0].message);
  const [limit, setLimit] = useState<number>(Math.max(1, Math.min(initialLimit || 200, 200)));
  const [recipientEmails, setRecipientEmails] = useState<string[]>(
    Array.from(new Set((initialRecipientEmails || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))),
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [quota, setQuota] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const [preview, setPreview] = useState<{ recipientsCount: number; suppressedRecipientsCount: number; matchedRecipientsCount?: number; sample: string[] } | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadQuota = async () => {
    setLoadingQuota(true);
    try {
      const res = await api.get('/marketing/email/quota');
      setQuota(res.data);
      if (typeof res.data?.remaining === 'number') {
        setLimit((prev) => Math.max(1, Math.min(prev, res.data.remaining || 1)));
      }
    } catch {
      setQuota(null);
    } finally {
      setLoadingQuota(false);
    }
  };

  useEffect(() => {
    loadQuota();
  }, []);

  const applyTemplate = (template: EmailBlastTemplate) => {
    setSelectedTemplateId(template.id);
    setSubject(template.subject);
    setMessage(template.message);
    setSuccess(null);
    setError(null);
  };

  const runPreview = async () => {
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: any = { audienceType, audienceMode, limit };
      if (recipientEmails.length > 0) payload.recipientEmails = recipientEmails;
      if (sourceBlastId) payload.sourceBlastId = sourceBlastId;
      const res = await api.post('/marketing/email/preview', payload);
      setPreview({
        recipientsCount: res.data.recipientsCount || 0,
        suppressedRecipientsCount: res.data.suppressedRecipientsCount || 0,
        matchedRecipientsCount: res.data.matchedRecipientsCount || 0,
        sample: res.data.sample || [],
      });
      setQuota({ limit: res.data.limit, used: res.data.used, remaining: res.data.remaining });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not preview recipients.');
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const scheduledAtIso = scheduleEnabled && scheduledAtLocal
        ? new Date(scheduledAtLocal).toISOString()
        : undefined;

      const res = await api.post('/marketing/email/send', {
        audienceType,
        audienceMode,
        subject,
        message,
        limit,
        ...(recipientEmails.length > 0 ? { recipientEmails } : {}),
        ...(sourceBlastId ? { sourceBlastId } : {}),
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });
      if (res.data?.scheduled) {
        const when = res.data?.scheduledAt ? new Date(res.data.scheduledAt).toLocaleString() : 'scheduled time';
        setSuccess(`Scheduled for ${when} (${res.data.recipientsCount} planned recipients).`);
      } else {
        const skipped = res.data?.suppressedRecipientsCount ? ` ${res.data.suppressedRecipientsCount} skipped from prior unsubscribes or bounces.` : '';
        setSuccess(`Sent to ${res.data.recipientsCount} recipients.${skipped}`);
      }
      setQuota({ limit: res.data.limit, used: res.data.used, remaining: res.data.remaining });
      setPreview({
        recipientsCount: res.data.recipientsCount || 0,
        suppressedRecipientsCount: res.data.suppressedRecipientsCount || 0,
        matchedRecipientsCount: res.data.matchedRecipientsCount || 0,
        sample: [],
      });
      await onSent();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Mass email failed to send.');
    } finally {
      setSending(false);
    }
  };

  const canSend = subject.trim().length >= 3
    && message.trim().length >= 5
    && (quota?.remaining ?? 0) > 0
    && (!scheduleEnabled || !!scheduledAtLocal)
    && (!scheduleEnabled || recipientEmails.length === 0)
    && (!scheduleEnabled || audienceMode === 'ALL');

  return (
    <div className="fixed inset-0 z-50" data-testid="mass-email-drawer">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/50" onClick={onClose} role="presentation" />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-200/80 dark:border-white/10 p-7 sm:p-8 overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Email blast</div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Build and send a polished campaign</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Pick a template, tailor copy, preview recipients, send.</p>
          </div>
          <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Templates</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {emailBlastTemplates.map((template) => {
                const active = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={`text-left rounded-xl border p-3 transition ${
                      active
                        ? 'border-blue-400/40 bg-blue-500/12'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/40 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{template.name}</div>
                      <span className="text-[10px] uppercase rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-slate-500 dark:text-slate-300">
                        {template.badge}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 line-clamp-2">{template.subject}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Monthly quota</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {loadingQuota ? 'Loading…' : `${quota?.used ?? 0} / ${quota?.limit ?? 200}`}
                </div>
                <div className="text-xs text-slate-500">Remaining: {quota?.remaining ?? '—'} emails</div>
              </div>
              <Button
                onClick={loadQuota}
                className="bg-white hover:bg-slate-50 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
              >
                Refresh
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Audience</div>
            {recipientEmails.length > 0 && (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
                <div className="text-xs text-cyan-100 font-semibold">
                  Target override: {recipientEmails.length} selected recipients{sourceLabel ? ` from ${sourceLabel}` : ''}
                </div>
                <div className="text-[11px] text-cyan-200/80 mt-1">This campaign will send to the selected list instead of the general audience filter.</div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setRecipientEmails([])}
                    className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/25"
                  >
                    Use general audience instead
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'CLIENTS', label: 'Clients only' },
                { value: 'LEADS', label: 'Leads only' },
                { value: 'CLIENTS_AND_LEADS', label: 'Clients + Leads' },
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
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Send mode</div>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'ALL', label: 'All sendable' },
                  { value: 'ENGAGED', label: 'Engaged only' },
                  { value: 'NON_OPENERS', label: 'Non-openers' },
                  { value: 'AI_RECOMMENDED', label: 'AI recommended' },
                ] as const).map((opt) => {
                  const active = audienceMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setAudienceMode(opt.value);
                        if (opt.value !== 'ALL') setScheduleEnabled(false);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        active
                          ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={180}
                placeholder="Subject line"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                maxLength={25000}
                placeholder="Write your email here..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Quick snippets</div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Reply to book a quick 10-minute call.',
                  'Want active listings in your exact price range? Reply and I will send them today.',
                  'If now is not the right time, I can still send a custom market snapshot for planning.',
                ].map((snippet) => (
                  <button
                    key={snippet}
                    type="button"
                    onClick={() => setMessage((prev) => `${prev.trim()}\n\n${snippet}`)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    + Snippet
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">Send count cap</label>
              <input
                type="number"
                min={1}
                max={Math.max(1, quota?.remaining ?? 200)}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(Number(e.target.value) || 1, Math.max(1, quota?.remaining ?? 200))))}
                className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  disabled={recipientEmails.length > 0 || audienceMode !== 'ALL'}
                  className="rounded border-slate-300 bg-white dark:border-white/20 dark:bg-slate-950/40"
                />
                Schedule for later
              </label>
              {recipientEmails.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">Scheduling is disabled for custom selected-recipient sends.</div>
              )}
              {audienceMode !== 'ALL' && (
                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">Scheduling is disabled for smart send modes.</div>
              )}
              {scheduleEnabled && (
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    value={scheduledAtLocal}
                    onChange={(e) => setScheduledAtLocal(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100 dark:[color-scheme:dark]"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">Uses your local timezone. Scheduled emails are processed automatically.</div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Recipient preview</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{preview?.recipientsCount ?? 0}</div>
                {(preview?.suppressedRecipientsCount ?? 0) > 0 && (
                  <div className="text-xs text-amber-600 dark:text-amber-300">
                    {preview?.suppressedRecipientsCount} skipped from prior unsubscribes or bounces
                  </div>
                )}
                {audienceMode !== 'ALL' && preview?.matchedRecipientsCount !== undefined && (
                  <div className="text-xs text-cyan-700 dark:text-cyan-300">
                    {preview.matchedRecipientsCount} matched this send mode
                  </div>
                )}
              </div>
              <Button
                onClick={runPreview}
                disabled={previewing || (quota?.remaining ?? 0) <= 0}
                className="bg-white hover:bg-slate-50 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
              >
                {previewing ? 'Previewing…' : 'Preview recipients'}
              </Button>
            </div>
            {preview?.sample?.length ? (
              <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 break-all">
                Sample: {preview.sample.slice(0, 6).join(', ')}
              </div>
            ) : null}
          </section>

          {error && <div className="text-sm text-rose-600 dark:text-rose-300">{error}</div>}
          {success && <div className="text-sm text-emerald-600 dark:text-emerald-300">{success}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              onClick={onClose}
              className="bg-white hover:bg-slate-50 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
            >
              Close
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !canSend}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              {sending ? 'Sending…' : 'Send email blast'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeTagsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function formatRecipientAddress(r: DirectMailRecipient) {
  const parts = [r.mailingAddress, [r.mailingCity, r.mailingState].filter(Boolean).join(', '), r.mailingZip]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.join(' ');
}

function DirectMailPanel({ onClose }: { onClose: () => void }) {
  const [filters, setFilters] = useState<DirectMailFilters>({
    requireAddress: true,
    limit: 5000,
    markLastMarketingAt: false,
  });
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; recipients: DirectMailRecipient[] } | null>(null);

  const stageOptions: Array<{ value: ClientStage; label: string }> = [
    { value: 'NEW_LEAD', label: 'New lead' },
    { value: 'NURTURE', label: 'Nurture' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'UNDER_CONTRACT', label: 'Under contract' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'PAST_CLIENT', label: 'Past client' },
    { value: 'DEAD', label: 'Dead' },
  ];

  const tempOptions: Array<{ value: ClientTemperature; label: string; cls: string }> = [
    { value: 'HOT', label: 'Hot', cls: 'border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15' },
    { value: 'WARM', label: 'Warm', cls: 'border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15' },
    { value: 'COLD', label: 'Cold', cls: 'border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15' },
  ];

  const toggle = <T,>(arr: T[] | undefined, value: T) => {
    const current = arr || [];
    return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  };

  const buildPayload = (forCsv: boolean) => {
    const tagsAny = normalizeTagsInput(tagsInput);
    const base: any = {
      requireAddress: filters.requireAddress,
      limit: filters.limit,
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.stage?.length ? { stage: filters.stage } : {}),
      ...(filters.temperature?.length ? { temperature: filters.temperature } : {}),
      ...(tagsAny.length ? { tagsAny } : {}),
    };
    if (forCsv) {
      base.markLastMarketingAt = !!filters.markLastMarketingAt;
    }
    return base;
  };

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/marketing/direct-mail/recipients', buildPayload(false));
      setPreview(res.data);
    } catch (e) {
      setError('Unable to load recipients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await api.post('/marketing/direct-mail/recipients.csv', buildPayload(true), {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `direct-mail-recipients-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('CSV export failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const createFollowUpTask = async () => {
    if (!preview || preview.count === 0) return;
    setCreatingTask(true);
    setError(null);
    try {
      const tagsAny = normalizeTagsInput(tagsInput);
      const lines: string[] = [];
      if (filters.temperature?.length) lines.push(`Temperature: ${filters.temperature.join(', ')}`);
      if (filters.stage?.length) lines.push(`Stage: ${filters.stage.join(', ')}`);
      if (tagsAny.length) lines.push(`Tags (any): ${tagsAny.join(', ')}`);
      if (filters.search?.trim()) lines.push(`Search: ${filters.search.trim()}`);
      lines.push(`Require complete address: ${filters.requireAddress ? 'Yes' : 'No'}`);
      lines.push(`Mark lastMarketingAt on export: ${filters.markLastMarketingAt ? 'Yes' : 'No'}`);

      await api.post('/tasks', {
        title: `Direct Mail: send to ${preview.count} recipients`,
        description:
          `Direct mail campaign follow-up.\n\nFilters:\n- ${lines.join('\n- ')}\n\nNext steps:\n1) Marketing → Direct mail → Download CSV\n2) Send postcards/labels\n3) Mark touches and schedule follow-ups`,
        bucket: 'THIS_WEEK',
        priority: 'HIGH',
      });
    } catch (e) {
      setError('Task creation failed. Please try again.');
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" data-testid="direct-mail-drawer">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/50" onClick={onClose} role="presentation" />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-200/80 dark:border-white/10 p-7 sm:p-8 overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Direct mail</div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Build a mailing blast list</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Export a CSV for postcards/labels. Powered by your clients’ mailing addresses.
            </p>
          </div>
          <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Filters</p>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 space-y-4 dark:border-white/10 dark:bg-white/5">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Temperature</div>
                <div className="flex flex-wrap gap-2">
                  {tempOptions.map((t) => {
                    const isSelected = (filters.temperature || []).includes(t.value);
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            temperature: toggle(f.temperature, t.value),
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                          isSelected
                            ? `${t.cls} shadow-[0_0_0_1px_rgba(255,255,255,0.05)]`
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">Leave blank for all temperatures.</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Stage</div>
                <div className="flex flex-wrap gap-2">
                  {stageOptions.map((s) => {
                    const isSelected = (filters.stage || []).includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            stage: toggle(f.stage, s.value),
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
                          isSelected
                            ? 'border-indigo-400/40 bg-indigo-500/12 text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">Leave blank for all stages.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Tags (any)</div>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. investor, referral, upsell"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">Comma-separated.</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Search</div>
                  <input
                    value={filters.search || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    placeholder="Name, city, zip…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">Matches address too.</div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={filters.requireAddress}
                    onChange={(e) => setFilters((f) => ({ ...f, requireAddress: e.target.checked }))}
                    className="rounded border-slate-300 bg-white dark:border-white/20 dark:bg-slate-950/40"
                  />
                  Only include complete mailing address
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={filters.markLastMarketingAt}
                    onChange={(e) => setFilters((f) => ({ ...f, markLastMarketingAt: e.target.checked }))}
                    className="rounded border-slate-300 bg-white dark:border-white/20 dark:bg-slate-950/40"
                  />
                  Mark as marketed on export
                </label>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Preview</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setFilters({ requireAddress: true, limit: 5000, markLastMarketingAt: false });
                    setTagsInput('');
                    setPreview(null);
                    setError(null);
                  }}
                  className="bg-white hover:bg-slate-50 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
                >
                  Reset
                </Button>
                <Button
                  onClick={runPreview}
                  disabled={loading}
                  className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500"
                >
                  {loading ? 'Loading…' : 'Preview recipients'}
                </Button>
              </div>
            </div>

            {error && <div className="mt-3 text-sm text-rose-600 dark:text-rose-200">{error}</div>}

            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              {!preview && <div className="text-sm text-slate-600 dark:text-slate-400">Run a preview to see recipient count and a sample list.</div>}
              {preview && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Recipients</div>
                      <div className="text-2xl font-semibold text-slate-900 dark:text-white">{preview.count}</div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Button
                        onClick={createFollowUpTask}
                        disabled={creatingTask || preview.count === 0}
                        className="min-h-[44px] bg-white hover:bg-slate-50 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
                      >
                        {creatingTask ? 'Creating…' : 'Create follow-up task'}
                      </Button>
                      <Button
                        onClick={downloadCsv}
                        disabled={downloading || preview.count === 0}
                        className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500"
                      >
                        {downloading ? 'Exporting…' : 'Download CSV'}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Sample (first {Math.min(8, preview.recipients.length)}):
                  </div>
                  <div className="mt-2 space-y-2">
                    {preview.recipients.slice(0, 8).map((r) => (
                      <div key={r.id} className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {r.firstName} {r.lastName}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-slate-600 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:text-slate-300 dark:border-white/12 dark:bg-white/5">
                              {r.stage}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-600 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:text-slate-300 dark:border-white/12 dark:bg-white/5">
                              {r.temperature}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatRecipientAddress(r) || '—'}</div>
                        {r.tags?.length > 0 && <div className="mt-1 text-[11px] text-slate-500">Tags: {r.tags.slice(0, 4).join(', ')}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NewBlastPanel({ 
  channels, 
  prefillListingId, 
  onClose, 
  onCreated 
}: { 
  channels: ChannelConnection[]; 
  prefillListingId?: string | null;
  onClose: () => void; 
  onCreated: (blastId: string) => void 
}) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [selectedListing, setSelectedListing] = useState<string>('');
  const [playbook, setPlaybook] = useState<BlastPlaybook>('NEW_LISTING');
  const [selectedChannels, setSelectedChannels] = useState<ChannelConnectionType[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedChannels = useMemo(() => channels.filter(c => c.status === 'connected'), [channels]);

  const toggleChannel = (type: ChannelConnectionType) => {
    setSelectedChannels(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  useEffect(() => {
    const loadListings = async () => {
      setLoadingListings(true);
      try {
        const res = await api.get('/listings');
        setListings(res.data);
        
        // Auto-select prefilled listing if provided
        if (prefillListingId && res.data.some((l: ListingSummary) => l.id === prefillListingId)) {
          setSelectedListing(prefillListingId);
          setPlaybook('NEW_LISTING'); // Default to "Just listed" template
        }
      } finally {
        setLoadingListings(false);
      }
    };
    loadListings();
  }, [prefillListingId]);

  const handleSubmit = async () => {
    if (!selectedListing) {
      setError('Select a listing to continue');
      return;
    }
    if (selectedChannels.length === 0) {
      setError('Select at least one channel');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await api.post('/marketing/blasts', { 
        listingId: selectedListing, 
        playbook,
        channels: selectedChannels 
      });
      await api.post(`/marketing/blasts/${created.data.id}/generate`);
      onCreated(created.data.id);
    } catch (err) {
      setError('Unable to create blast. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" data-testid="new-blast-drawer">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/50" onClick={onClose} role="presentation" />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-l border-slate-200/80 dark:border-white/10 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Listing blast</div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Launch a multi-channel listing push</h3>
          </div>
          <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Step 1</p>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Choose a listing</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {loadingListings && <div className="text-slate-500 text-sm">Loading listings…</div>}
              {!loadingListings && listings.length === 0 && (
                <div className="text-slate-500 text-sm">No listings yet. Create one from the Listings tab.</div>
              )}
              {listings.map((listing) => (
                <label
                  key={listing.id}
                  className={`block rounded-2xl border p-3 cursor-pointer transition ${
                    selectedListing === listing.id
                      ? 'border-blue-400 bg-blue-50 text-slate-900 dark:bg-blue-500/10 dark:text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="listing"
                    className="hidden"
                    value={listing.id}
                    onChange={() => setSelectedListing(listing.id)}
                  />
                  <div className="font-semibold">{listing.headline}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(listing.price)}</div>
                </label>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Step 2</p>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Select a playbook</h4>
            <div className="flex flex-wrap gap-2">
              {playbooksInOrder.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition ${
                    playbook === option
                      ? 'bg-blue-600/80 border-blue-400 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30'
                  }`}
                  onClick={() => setPlaybook(option)}
                >
                  {playbookLabels[option]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Step 3</p>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Select channels</h4>
            {connectedChannels.length === 0 ? (
              <div className="text-slate-600 dark:text-slate-400 text-sm p-3 border border-slate-200 dark:border-white/10 rounded-lg">
                No channels connected yet. Connect channels from the bar above to enable multi-channel blasts.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {connectedChannels.map((channel) => {
                  const isSelected = selectedChannels.includes(channel.type);
                  return (
                    <button
                      key={channel.type}
                      type="button"
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition ${
                        isSelected
                          ? 'bg-green-600/80 border-green-400 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30'
                      }`}
                      onClick={() => toggleChannel(channel.type)}
                    >
                      <span>{getChannelIcon(channel.type)}</span>
                      <span>{getChannelLabel(channel.type)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Step 4</p>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Create blast</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              We will set up all selected channels and auto-draft copy using the existing AI helper. You can tweak everything before sending.
            </p>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/30">{error}</div>}
            <Button
              disabled={!selectedListing || creating}
              onClick={handleSubmit}
              className="w-full bg-blue-600 hover:bg-blue-500"
            >
              {creating ? 'Creating…' : 'Create listing blast'}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
