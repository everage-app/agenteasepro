import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

type UsageResponse = {
  hours: number;
  events: number;
  pageViews: number;
  errors: number;
  activeAgents: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  topAgents: Array<{
    agentId: string;
    views: number;
    agent: { id: string; name: string; email: string } | null;
  }>;
  topPages: Array<{ path: string; count: number }>;
  featureUsage: Array<{ feature: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
  hourlyHeatmap?: Array<{ day: number; hour: number; count: number }>;
  hourlyTotals?: Array<{ hour: number; count: number }>;
  weekdayTotals?: Array<{ day: number; count: number }>;
  topWindows?: Array<{ day: number; hour: number; count: number }>;
  funnelTransitions?: Array<{ from: string; to: string; count: number }>;
  dropOffFeatures?: Array<{ feature: string; exits: number }>;
  cohortRetention?: Array<{
    cohort: string;
    size: number;
    retention: Array<{ week: number; active: number; pct: number }>;
  }>;
  segments?: {
    billingMode: Array<{ segment: string; count: number }>;
    subscriptionStatus: Array<{ segment: string; count: number }>;
    teams: Array<{ segment: string; count: number }>;
  };
  signupFunnel?: {
    newAccounts: number;
    verifiedAccounts: number;
    activeNewAccounts: number;
    marketingSiteViews: number;
    marketingSignupClicks: number;
    marketingCtaClicks: number;
    agentLandingPageViews: number;
    agentLandingPageLeads: number;
    rates: {
      websiteViewToSignupClick: number;
      signupClickToAccount: number;
      websiteViewToAccount: number;
      emailVerification: number;
      newAccountActivation: number;
      agentLandingLeadConversion: number;
    };
    topMarketingSources: Array<{ label: string; count: number }>;
    topMarketingCampaigns: Array<{ label: string; count: number }>;
    topAgentLandingSources: Array<{ label: string; count: number }>;
    topAgentLandingCampaigns: Array<{ label: string; count: number }>;
    trend: Array<{ date: string; views: number; signupClicks: number; ctaClicks: number; signups: number }>;
    coverageWarnings: string[];
  };
  sampled: boolean;
};

type AgentLite = {
  id: string;
  name: string;
  email: string;
};

const ranges = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: 'All', hours: 87600 },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function InternalUsagePage() {
  const [hours, setHours] = useState(720);
  const [agentId, setAgentId] = useState('');
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [refreshSeconds, setRefreshSeconds] = useState<30 | 60 | 120 | 300>(() => {
    if (typeof window === 'undefined') return 60;
    const raw = Number(window.localStorage.getItem('internal.usage.refreshSeconds'));
    return raw === 30 || raw === 60 || raw === 120 || raw === 300 ? (raw as 30 | 60 | 120 | 300) : 60;
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { hours };
        if (agentId) params.agentId = agentId;
        const [usageRes, agentsRes] = await Promise.all([
          api.get('/internal/usage', { params }),
          api.get('/internal/agents', { params: { page: 1, pageSize: 100 } }),
        ]);
        if (!cancelled) {
          setData(usageRes.data);
          setAgents(agentsRes.data?.agents ?? []);
          setLastRefreshedAt(new Date().toISOString());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load();
      }
    }, refreshSeconds * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hours, agentId, refreshSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('internal.usage.refreshSeconds', String(refreshSeconds));
  }, [refreshSeconds]);

  const maxTrend = useMemo(() => {
    if (!data?.trend?.length) return 1;
    return Math.max(1, ...data.trend.map((item) => item.count));
  }, [data]);

  const maxFeature = useMemo(() => {
    if (!data?.featureUsage?.length) return 1;
    return Math.max(1, ...data.featureUsage.map((item) => item.count));
  }, [data]);

  const maxPage = useMemo(() => {
    if (!data?.topPages?.length) return 1;
    return Math.max(1, ...data.topPages.map((item) => item.count));
  }, [data]);

  const featureTotal = useMemo(() => {
    if (!data?.featureUsage?.length) return 0;
    return data.featureUsage.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  const pageTotal = useMemo(() => {
    if (!data?.topPages?.length) return 0;
    return data.topPages.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  const topFeature = data?.featureUsage?.[0] ?? null;
  const topPage = data?.topPages?.[0] ?? null;

  const topFeatureShare = featureTotal > 0 && topFeature ? Math.round((topFeature.count / featureTotal) * 100) : 0;
  const topPageShare = pageTotal > 0 && topPage ? Math.round((topPage.count / pageTotal) * 100) : 0;

  const heatmapFeatures = useMemo(() => {
    if (!data?.featureUsage?.length) return [] as Array<{ feature: string; count: number; intensity: number }>;
    return data.featureUsage.slice(0, 12).map((item) => ({
      feature: item.feature,
      count: item.count,
      intensity: item.count / maxFeature,
    }));
  }, [data, maxFeature]);

  const heatmapPages = useMemo(() => {
    if (!data?.topPages?.length) return [] as Array<{ path: string; count: number; intensity: number }>;
    return data.topPages.slice(0, 12).map((item) => ({
      path: item.path,
      count: item.count,
      intensity: item.count / maxPage,
    }));
  }, [data, maxPage]);

  const heatmapMatrix = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of data?.hourlyHeatmap ?? []) {
      map.set(`${cell.day}-${cell.hour}`, cell.count);
    }
    return Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 24 }, (_, hour) => ({
        day,
        hour,
        count: map.get(`${day}-${hour}`) || 0,
      })),
    );
  }, [data]);

  const maxHeat = useMemo(() => {
    const rows = data?.hourlyHeatmap ?? [];
    if (!rows.length) return 1;
    return Math.max(1, ...rows.map((cell) => cell.count));
  }, [data]);

  const peakHour = useMemo(() => {
    const rows = data?.hourlyTotals ?? [];
    if (!rows.length) return null;
    return rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  }, [data]);

  const peakDay = useMemo(() => {
    const rows = data?.weekdayTotals ?? [];
    if (!rows.length) return null;
    return rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  }, [data]);

  const errorRate = useMemo(() => {
    if (!data?.pageViews) return 0;
    return (data.errors / data.pageViews) * 100;
  }, [data]);

  const signupFunnel = data?.signupFunnel ?? null;

  const maxSignupTrend = useMemo(() => {
    const rows = data?.signupFunnel?.trend ?? [];
    if (!rows.length) return 1;
    return Math.max(1, ...rows.map((row) => Math.max(row.views, row.signupClicks, row.signups)));
  }, [data]);

  const maxSegmentCount = useMemo(() => {
    const rows = [
      ...(data?.segments?.billingMode ?? []),
      ...(data?.segments?.subscriptionStatus ?? []),
      ...(data?.segments?.teams ?? []),
    ];
    if (!rows.length) return 1;
    return Math.max(1, ...rows.map((row) => row.count));
  }, [data]);

  const maxCohortPct = useMemo(() => {
    const rows = data?.cohortRetention ?? [];
    if (!rows.length) return 1;
    return Math.max(1, ...rows.flatMap((row) => row.retention.map((item) => item.pct)));
  }, [data]);

  return (
    <PageLayout
      title="Usage & Activity"
      subtitle="Best-in-class visibility into engagement, feature adoption, and system health."
      maxWidth="full"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="text-sm text-slate-400">
          Watch usage patterns, verify adoption, and spot risk early.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ranges.map((range) => (
            <button
              key={range.hours}
              onClick={() => setHours(range.hours)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                hours === range.hours
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {range.label}
            </button>
          ))}
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white/5 border-white/10 text-slate-300"
          >
            <option value="">All users</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.email}
              </option>
            ))}
          </select>
          <select
            value={refreshSeconds}
            onChange={(e) => setRefreshSeconds(Number(e.target.value) as 30 | 60 | 120 | 300)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white/5 border-white/10 text-slate-300"
          >
            <option value={30}>30s refresh</option>
            <option value={60}>60s refresh</option>
            <option value={120}>2m refresh</option>
            <option value={300}>5m refresh</option>
          </select>
          <span className="text-[11px] text-slate-500">
            {lastRefreshedAt ? `Updated ${new Date(lastRefreshedAt).toLocaleTimeString()}` : 'Waiting...'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[280px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      ) : !data ? (
        <Card>
          <div className="text-sm text-slate-300">Couldn’t load usage data.</div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Page views" value={data.pageViews} detail={`${data.events.toLocaleString()} events`} />
            <StatCard label="Errors" value={data.errors} detail={`${errorRate.toFixed(2)}% error rate`} tone={errorRate > 2 ? 'danger' : 'default'} />
            <StatCard label="Active (24h)" value={data.activeAgents.last24h} detail="Distinct agents" tone="success" />
            <StatCard label="Active (7d)" value={data.activeAgents.last7d} detail="Distinct agents" tone="info" />
            <StatCard label="Active (30d)" value={data.activeAgents.last30d} detail="Distinct agents" tone="info" />
            <StatCard label="Range" value={data.hours >= 87600 ? 'All' : `${Math.ceil(data.hours / 24)}d`} detail="Reporting window" />
          </div>

          {signupFunnel && (
            <Card title="Signup & marketing funnel" description="Website traffic, signup intent, new accounts, and lead capture in one window" hover={false}>
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <FunnelMetric label="Website views" value={signupFunnel.marketingSiteViews} detail={`${signupFunnel.rates.websiteViewToSignupClick.toFixed(2)}% to signup click`} />
                  <FunnelMetric label="Signup clicks" value={signupFunnel.marketingSignupClicks} detail={`${signupFunnel.rates.signupClickToAccount.toFixed(2)}% to account`} />
                  <FunnelMetric label="New accounts" value={signupFunnel.newAccounts} detail={`${signupFunnel.rates.websiteViewToAccount.toFixed(2)}% from site view`} tone="success" />
                  <FunnelMetric label="Verified" value={signupFunnel.verifiedAccounts} detail={`${signupFunnel.rates.emailVerification.toFixed(2)}% verified`} />
                  <FunnelMetric label="Activated" value={signupFunnel.activeNewAccounts} detail={`${signupFunnel.rates.newAccountActivation.toFixed(2)}% used app`} />
                  <FunnelMetric label="Agent leads" value={signupFunnel.agentLandingPageLeads} detail={`${signupFunnel.rates.agentLandingLeadConversion.toFixed(2)}% landing conversion`} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                  <div className="xl:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Marketing trend</div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-300" />Views</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" />Clicks</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-300" />Accounts</span>
                      </div>
                    </div>
                    <div className="flex items-end gap-1 h-28">
                      {signupFunnel.trend.map((row) => {
                        const viewHeight = Math.max(2, Math.round((row.views / maxSignupTrend) * 100));
                        const clickHeight = Math.max(0, Math.round((row.signupClicks / maxSignupTrend) * 100));
                        const signupHeight = Math.max(0, Math.round((row.signups / maxSignupTrend) * 100));
                        return (
                          <div key={row.date} className="flex-1 h-full flex items-end gap-0.5" title={`${row.date}: ${row.views} views, ${row.signupClicks} signup clicks, ${row.signups} accounts`}>
                            <div className="flex-1 rounded-t bg-cyan-400/55" style={{ height: `${viewHeight}%` }} />
                            <div className="flex-1 rounded-t bg-amber-300/70" style={{ height: `${clickHeight}%` }} />
                            <div className="flex-1 rounded-t bg-emerald-300/75" style={{ height: `${signupHeight}%` }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <BucketList title="Website UTM sources" rows={signupFunnel.topMarketingSources} />
                  <BucketList title="Website campaigns" rows={signupFunnel.topMarketingCampaigns} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <BucketList title="Agent landing sources" rows={signupFunnel.topAgentLandingSources} />
                  <BucketList title="Agent landing campaigns" rows={signupFunnel.topAgentLandingCampaigns} />
                </div>

                {signupFunnel.coverageWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 space-y-1">
                    {signupFunnel.coverageWarnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="Usage heat map" description="Instantly see where users spend the most time" hover={false}>
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Weekday x hour intensity</div>
                {data.hourlyHeatmap && data.hourlyHeatmap.length > 0 ? (
                  <div className="space-y-1 overflow-x-auto pb-1">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[50px_repeat(24,minmax(0,1fr))] gap-1 mb-1">
                        <div className="text-[10px] text-slate-500" />
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div key={`h-label-${hour}`} className="text-center text-[10px] text-slate-500">
                            {hour}
                          </div>
                        ))}
                      </div>
                      {heatmapMatrix.map((dayRow, dayIndex) => (
                        <div key={`d-row-${dayIndex}`} className="grid grid-cols-[50px_repeat(24,minmax(0,1fr))] gap-1 mb-1">
                          <div className="text-[10px] text-slate-400 flex items-center">{DAY_LABELS[dayIndex]}</div>
                          {dayRow.map((cell) => (
                            <HeatCell
                              key={`${cell.day}-${cell.hour}`}
                              day={cell.day}
                              hour={cell.hour}
                              count={cell.count}
                              max={maxHeat}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Hourly heatmap is still gathering data.</div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span>Peak day: <span className="text-slate-200 font-semibold">{peakDay ? `${DAY_LABELS[peakDay.day]} (${peakDay.count.toLocaleString()})` : '—'}</span></span>
                  <span>Peak hour: <span className="text-slate-200 font-semibold">{peakHour ? `${String(peakHour.hour).padStart(2, '0')}:00 (${peakHour.count.toLocaleString()})` : '—'}</span></span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Feature intensity</div>
                  {heatmapFeatures.length === 0 ? (
                    <div className="text-sm text-slate-400">No feature activity yet.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {heatmapFeatures.map((item) => (
                        <HeatTile
                          key={item.feature}
                          label={item.feature}
                          value={item.count}
                          intensity={item.intensity}
                          title={`${item.feature}: ${item.count.toLocaleString()} views`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Route intensity</div>
                  {heatmapPages.length === 0 ? (
                    <div className="text-sm text-slate-400">No route activity yet.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {heatmapPages.map((item) => (
                        <HeatTile
                          key={item.path}
                          label={item.path}
                          value={item.count}
                          intensity={item.intensity}
                          title={`${item.path}: ${item.count.toLocaleString()} views`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>Low</span>
                <span className="h-2.5 w-8 rounded-full bg-cyan-900/30 border border-cyan-700/40" />
                <span className="h-2.5 w-8 rounded-full bg-cyan-700/40 border border-cyan-500/40" />
                <span className="h-2.5 w-8 rounded-full bg-cyan-500/50 border border-cyan-400/50" />
                <span className="h-2.5 w-8 rounded-full bg-cyan-300/70 border border-cyan-200/50" />
                <span>High</span>
              </div>

              {(data.topWindows?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Hottest windows</div>
                  <div className="flex flex-wrap gap-2">
                    {(data.topWindows ?? []).map((window) => (
                      <Badge key={`${window.day}-${window.hour}`} variant="info">
                        {DAY_LABELS[window.day]} {String(window.hour).padStart(2, '0')}:00 · {window.count.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card title="Feature funnel" description="Top flow paths between app areas" hover={false}>
              <div className="space-y-2">
                {(data.funnelTransitions?.length ?? 0) === 0 ? (
                  <div className="text-sm text-slate-400">Not enough page-flow data yet.</div>
                ) : (
                  (data.funnelTransitions ?? []).slice(0, 8).map((row) => (
                    <div key={`${row.from}-${row.to}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="font-semibold truncate pr-2">{row.from} → {row.to}</span>
                        <span>{row.count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-2 text-[11px] text-slate-500">Use these transitions for demo narrative and onboarding prioritization.</div>
              </div>
            </Card>

            <Card title="Drop-off hotspots" description="Where sessions tend to end" hover={false}>
              <div className="space-y-2">
                {(data.dropOffFeatures?.length ?? 0) === 0 ? (
                  <div className="text-sm text-slate-400">No drop-off data yet.</div>
                ) : (
                  (data.dropOffFeatures ?? []).slice(0, 8).map((row) => (
                    <div key={row.feature}>
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                        <span className="font-semibold">{row.feature}</span>
                        <span>{row.exits.toLocaleString()} exits</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-amber-400/80"
                          style={{ width: `${Math.round((row.exits / Math.max(1, (data.dropOffFeatures ?? [])[0]?.exits || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-2 text-[11px] text-slate-500">High exits can indicate completed tasks or friction. Validate by user interviews.</div>
              </div>
            </Card>

            <Card title="Segmentation" description="Who is driving usage" hover={false}>
              <div className="space-y-3">
                <SegmentBlock title="Billing mode" rows={data.segments?.billingMode ?? []} max={maxSegmentCount} />
                <SegmentBlock title="Subscription" rows={data.segments?.subscriptionStatus ?? []} max={maxSegmentCount} />
                <SegmentBlock title="Teams" rows={data.segments?.teams ?? []} max={maxSegmentCount} />
              </div>
            </Card>
          </div>

          <Card title="Cohort retention" description="How sticky usage is for newly active cohorts" hover={false}>
            {(data.cohortRetention?.length ?? 0) === 0 ? (
              <div className="text-sm text-slate-400">Cohort retention requires more multi-week activity history.</div>
            ) : (
              <div className="space-y-2 overflow-x-auto pb-1">
                <div className="min-w-[780px]">
                  <div className="grid grid-cols-[130px_70px_repeat(7,minmax(0,1fr))] gap-1 mb-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Cohort</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Size</div>
                    {Array.from({ length: 7 }, (_, week) => (
                      <div key={`w-h-${week}`} className="text-center text-[10px] text-slate-500">W{week}</div>
                    ))}
                  </div>
                  {(data.cohortRetention ?? []).map((cohort) => (
                    <div key={cohort.cohort} className="grid grid-cols-[130px_70px_repeat(7,minmax(0,1fr))] gap-1 mb-1">
                      <div className="text-[11px] text-slate-300">{cohort.cohort}</div>
                      <div className="text-[11px] text-slate-300">{cohort.size}</div>
                      {cohort.retention.map((cell) => (
                        <div
                          key={`${cohort.cohort}-${cell.week}`}
                          className="h-6 rounded-[6px] border border-cyan-900/50 flex items-center justify-center text-[10px]"
                          style={{ backgroundColor: `rgba(45,212,191,${Math.max(0.08, Math.min(0.9, (cell.pct / Math.max(1, maxCohortPct)) * 0.9))})` }}
                          title={`Week ${cell.week}: ${cell.pct.toFixed(1)}% (${cell.active}/${cohort.size})`}
                        >
                          {cell.pct.toFixed(0)}%
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card title="Engagement trend" description="Daily page views" hover={false}>
              <div className="mt-3">
                <div className="flex items-end gap-1 h-28">
                  {data.trend.map((item) => {
                    const height = Math.round((item.count / maxTrend) * 100);
                    return (
                      <div key={item.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-cyan-500/40 to-cyan-300/80"
                          style={{ height: `${height}%` }}
                          title={`${item.date}: ${item.count.toLocaleString()}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{data.trend[0]?.date}</span>
                  <span>{data.trend[data.trend.length - 1]?.date}</span>
                </div>
                {data.sampled && (
                  <div className="mt-3 text-[11px] text-amber-300/80">
                    Trend is sampled for performance.
                  </div>
                )}
              </div>
            </Card>

            <Card title="Feature adoption" description="Where agents spend time" hover={false}>
              <div className="mt-3 space-y-3">
                {data.featureUsage.length === 0 && (
                  <div className="text-sm text-slate-400">No page views captured yet.</div>
                )}
                {data.featureUsage.map((item) => {
                  const width = Math.round((item.count / maxFeature) * 100);
                  return (
                    <div key={item.feature}>
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                        <span className="font-semibold">{item.feature}</span>
                        <span>{item.count.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                        <div className="h-full bg-cyan-400/70" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Top agents" description="Most engaged in this window" hover={false}>
              <div className="mt-2 space-y-2">
                {data.topAgents.length === 0 && (
                  <div className="text-sm text-slate-400">No activity yet.</div>
                )}
                {data.topAgents.map((row) => (
                  <div key={row.agentId} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {row.agent ? (
                          <Link to={`/internal/agents/${row.agent.id}`} className="hover:text-cyan-200">
                            {row.agent.name || row.agent.email}
                          </Link>
                        ) : (
                          row.agentId
                        )}
                      </div>
                      {row.agent?.email && <div className="text-[11px] text-slate-500 truncate">{row.agent.email}</div>}
                    </div>
                    <Badge variant="info">{row.views.toLocaleString()} views</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Top pages" description="Most visited routes" hover={false}>
              <div className="mt-3 space-y-2">
                {data.topPages.length === 0 && (
                  <div className="text-sm text-slate-400">No page views yet.</div>
                )}
                {data.topPages.map((row) => (
                  <div key={row.path} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-xs text-slate-200 truncate">{row.path}</div>
                    <Badge variant="default">{row.count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Usage highlights" description="Quick interpretation" hover={false}>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2">
                  <span>Biggest selling factor</span>
                  <span className="font-semibold text-cyan-100">{topFeature ? `${topFeature.feature} (${topFeatureShare}%)` : 'Insufficient data'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Highest gravity page</span>
                  <span className="font-semibold">{topPage ? `${topPage.path} (${topPageShare}%)` : 'Insufficient data'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Engagement density</span>
                  <span className="font-semibold">{data.pageViews ? Math.round(data.pageViews / Math.max(1, data.activeAgents.last7d)) : 0} views/agent</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>System health</span>
                  <span className={`font-semibold ${errorRate > 2 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {errorRate > 2 ? 'Needs attention' : 'Healthy'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Feature spread</span>
                  <span className="font-semibold">{data.featureUsage.length} active areas</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Concentration risk</span>
                  <span className={`font-semibold ${topFeatureShare >= 45 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {topFeatureShare >= 45 ? 'High dependency' : 'Balanced usage'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Use Activity for raw event/error logs. Usage shows adoption and retention signals.
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: 'default' | 'info' | 'success' | 'danger';
}) {
  const toneMap: Record<string, string> = {
    default: 'text-white',
    info: 'text-cyan-200',
    success: 'text-emerald-300',
    danger: 'text-rose-300',
  };

  return (
    <Card className="p-4" hover={false}>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneMap[tone]}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
    </Card>
  );
}

function FunnelMetric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: 'default' | 'success';
}) {
  const valueClass = tone === 'success' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 min-h-[88px]">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${valueClass}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="mt-1 text-[11px] text-slate-500 leading-4">{detail}</div>
    </div>
  );
}

function BucketList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-400">No attributed traffic yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((row) => (
            <div key={`${title}-${row.label}`}>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span className="truncate pr-2">{row.label}</span>
                <span>{row.count.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyan-400/80" style={{ width: `${Math.round((row.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeatCell({
  day,
  hour,
  count,
  max,
}: {
  day: number;
  hour: number;
  count: number;
  max: number;
}) {
  const intensity = max > 0 ? count / max : 0;
  const alpha = Math.max(0.08, Math.min(0.92, intensity * 0.9 + 0.08));
  return (
    <div
      className="h-4 rounded-[4px] border border-cyan-900/50"
      style={{ backgroundColor: `rgba(34,211,238,${alpha})` }}
      title={`${DAY_LABELS[day]} ${String(hour).padStart(2, '0')}:00 - ${count.toLocaleString()} views`}
      aria-label={`${DAY_LABELS[day]} ${String(hour).padStart(2, '0')}:00 - ${count.toLocaleString()} views`}
    />
  );
}

function HeatTile({
  label,
  value,
  intensity,
  title,
}: {
  label: string;
  value: number;
  intensity: number;
  title: string;
}) {
  const clamped = Math.max(0, Math.min(1, intensity));

  let tone = 'bg-cyan-900/25 border-cyan-700/40 text-cyan-100/70';
  if (clamped >= 0.8) tone = 'bg-cyan-300/65 border-cyan-200/80 text-slate-900';
  else if (clamped >= 0.6) tone = 'bg-cyan-400/45 border-cyan-300/70 text-cyan-50';
  else if (clamped >= 0.4) tone = 'bg-cyan-500/35 border-cyan-400/60 text-cyan-50';
  else if (clamped >= 0.2) tone = 'bg-cyan-700/35 border-cyan-500/50 text-cyan-100';

  return (
    <div
      className={`rounded-xl border p-2.5 min-h-[72px] transition-colors ${tone}`}
      title={title}
      aria-label={title}
    >
      <div className="text-[11px] leading-4 line-clamp-2 break-all">{label}</div>
      <div className="mt-2 text-xs font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function SegmentBlock({
  title,
  rows,
  max,
}: {
  title: string;
  rows: Array<{ segment: string; count: number }>;
  max: number;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-400">No data</div>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, 5).map((row) => (
            <div key={`${title}-${row.segment}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-0.5">
                <span className="truncate pr-2">{row.segment}</span>
                <span>{row.count.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyan-400/80" style={{ width: `${Math.round((row.count / Math.max(1, max)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
