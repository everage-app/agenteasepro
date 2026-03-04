import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

type AgentLite = { id: string; name: string; email: string };

type InternalEventRow = {
  id: string;
  createdAt: string;
  kind: string;
  path: string | null;
  agent: AgentLite | null;
};

type InternalErrorRow = {
  id: string;
  createdAt: string;
  source: 'client' | 'server';
  message: string;
  path: string | null;
  agent: AgentLite | null;
};

type InternalSummary = {
  hours: number;
  events: number;
  errors: number;
  agentsActive: number;
  eventsChange?: { previous: number; delta: number; deltaPct: number };
  errorsChange?: { previous: number; delta: number; deltaPct: number };
  agentsActiveChange?: { previous: number; delta: number; deltaPct: number };
  totalAgents?: number;
  revenue30d?: { current: number; previous: number; delta: number; deltaPct: number };
  agentGrowth30d?: { current: number; previous: number; delta: number; deltaPct: number };
  topEventKinds: Array<{ kind: string; count: number }>;
  errorSources: Array<{ source: string; count: number }>;
};

type WebsiteTelemetry = {
  days: number;
  allTime: {
    views: number;
    uniqueVisitors: number;
    leads: number;
    conversionRate: number;
  };
  range: {
    views: number;
    uniqueVisitors: number;
    leads: number;
    conversionRate: number;
  };
  previousRange?: {
    views: number;
    uniqueVisitors: number;
    leads: number;
    conversionRate: number;
  };
  daily: Array<{ date: string; views: number; leads: number }>;
  topSources: Array<{ source: string; count: number }>;
  topCampaigns: Array<{ campaign: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  topLandingPages: Array<{ landingPageId: string; slug: string | null; title: string; views: number; leads: number }>;
};

type ActivityGraphPoint = {
  date: string;
  events: number;
  errors: number;
  webViews: number;
  webVisitors: number;
  activeAgents: number;
  revenue: number;
};

type ActivityGraphResponse = {
  days: number;
  points: ActivityGraphPoint[];
  totals: {
    events: number;
    errors: number;
    webViews: number;
    webVisitors: number;
    activeAgents: number;
    revenue: number;
  };
};

type GraphKey = 'events' | 'errors' | 'webViews' | 'webVisitors' | 'activeAgents' | 'revenue';

type InternalSystemHealth = {
  status?: 'healthy' | 'degraded';
  database?: { ok?: boolean; latencyMs?: number };
  meta?: { serverTime?: string };
};

type LiveHealthTile = {
  live: 'LIVE' | 'DEGRADED' | 'DOWN';
  db: 'HEALTHY' | 'OFFLINE' | 'UNKNOWN';
  latencyMs: number | null;
  updatedAt: string;
};

export function InternalActivityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const CHART_LEFT = 40;
  const CHART_RIGHT = 1060;
  const CHART_TOP = 14;
  const CHART_BOTTOM = 352;
  const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

  const [tab, setTab] = useState<'events' | 'errors'>('events');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<InternalEventRow[]>([]);
  const [errors, setErrors] = useState<InternalErrorRow[]>([]);
  const [summary, setSummary] = useState<InternalSummary | null>(null);
  const [website, setWebsite] = useState<WebsiteTelemetry | null>(null);
  const [activityGraph, setActivityGraph] = useState<ActivityGraphResponse | null>(null);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [kindFilter, setKindFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'client' | 'server' | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [graphDays, setGraphDays] = useState<30 | 60 | 90 | 365>(() => {
    if (typeof window === 'undefined') return 90;
    const raw = window.localStorage.getItem('internal.activity.graphDays');
    const parsed = Number(raw);
    return parsed === 30 || parsed === 60 || parsed === 90 || parsed === 365 ? (parsed as 30 | 60 | 90 | 365) : 90;
  });
  const [refreshSeconds, setRefreshSeconds] = useState<5 | 10 | 15 | 20 | 30>(() => {
    if (typeof window === 'undefined') return 10;
    const raw = window.localStorage.getItem('internal.activity.refreshSeconds');
    const parsed = Number(raw);
    return parsed === 5 || parsed === 10 || parsed === 15 || parsed === 20 || parsed === 30
      ? (parsed as 5 | 10 | 15 | 20 | 30)
      : 10;
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [liveHealth, setLiveHealth] = useState<LiveHealthTile | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<GraphKey, boolean>>({
    events: false,
    errors: true,
    webViews: false,
    webVisitors: true,
    activeAgents: true,
    revenue: true,
  });

  const seriesMeta: Array<{ key: GraphKey; label: string; color: string; total: number; currency?: boolean }> = [
    { key: 'events', label: 'Events', color: '#22d3ee', total: activityGraph?.totals.events ?? 0 },
    { key: 'errors', label: 'Errors', color: '#fb7185', total: activityGraph?.totals.errors ?? 0 },
    { key: 'webViews', label: 'Web views', color: '#a78bfa', total: activityGraph?.totals.webViews ?? 0 },
    { key: 'webVisitors', label: 'Visitors', color: '#34d399', total: activityGraph?.totals.webVisitors ?? 0 },
    { key: 'activeAgents', label: 'Active agents', color: '#f59e0b', total: activityGraph?.totals.activeAgents ?? 0 },
    { key: 'revenue', label: 'Revenue', color: '#10b981', total: activityGraph?.totals.revenue ?? 0, currency: true },
  ];

  const title = useMemo(() => 'Activity', []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('internal.activity.graphDays', String(graphDays));
  }, [graphDays]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('internal.activity.refreshSeconds', String(refreshSeconds));
  }, [refreshSeconds]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'events' || tabParam === 'errors') {
      setTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [tab, agentId, kindFilter, sourceFilter, search]);

  const maxDailyViews = useMemo(() => {
    if (!website?.daily?.length) return 1;
    return Math.max(1, ...website.daily.map((d) => d.views));
  }, [website]);

  const maxSourceCount = useMemo(() => {
    if (!website?.topSources?.length) return 1;
    return Math.max(1, ...website.topSources.map((s) => s.count));
  }, [website]);

  const trafficDeltaPct = useMemo(() => {
    if (!website?.previousRange) return 0;
    return computeDeltaPct(website.range.views, website.previousRange.views);
  }, [website]);

  const errorsTileDetail = useMemo(() => {
    const sourceSummary = summary?.errorSources.map((s) => `${s.source}:${s.count}`).join(' · ') || '—';
    if (!liveHealth) return sourceSummary;
    const latency = liveHealth.latencyMs != null ? ` · ${liveHealth.latencyMs}ms` : '';
    return `${liveHealth.live} · DB ${liveHealth.db}${latency} · ${sourceSummary}`;
  }, [summary, liveHealth]);

  const graphPoints = useMemo(() => activityGraph?.points ?? [], [activityGraph]);

  const xLabels = useMemo(() => {
    const points = graphPoints;
    if (points.length === 0) return { start: '—', mid: '—', end: '—' };
    return {
      start: points[0]?.date || '—',
      mid: points[Math.floor(points.length / 2)]?.date || '—',
      end: points[points.length - 1]?.date || '—',
    };
  }, [graphPoints]);

  const barPoints = useMemo(() => {
    const points = graphPoints;
    if (points.length === 0) return [] as Array<{ x: number; barHeight: number; combined: number; point: ActivityGraphPoint }>;

    const combinedValues = points.map((point) => point.events + point.webViews + point.webVisitors + point.activeAgents);
    const maxCombined = Math.max(1, ...combinedValues);

    return points.map((point, index) => {
      const combined = point.events + point.webViews + point.webVisitors + point.activeAgents;
      const barHeight = (combined / maxCombined) * CHART_HEIGHT;
      const x = CHART_LEFT + (index / Math.max(1, points.length - 1)) * CHART_WIDTH;
      return { x, barHeight, combined, point };
    });
  }, [graphPoints, CHART_HEIGHT, CHART_LEFT, CHART_WIDTH]);

  const yAxisTicks = useMemo(() => {
    const maxCombined = Math.max(1, ...barPoints.map((point) => point.combined), 1);
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
      y: CHART_TOP + (1 - ratio) * CHART_HEIGHT,
      label: Math.round(maxCombined * ratio).toLocaleString(),
    }));
  }, [barPoints, CHART_HEIGHT, CHART_TOP]);

  const linePaths = useMemo(() => {
    const points = graphPoints;
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const left = CHART_LEFT;
    const top = CHART_TOP;

    const buildPath = (key: GraphKey) => {
      const values = points.map((point) => point[key]);
      const max = Math.max(1, ...values);
      const coords = values.map((value, index) => {
        const x = left + (index / Math.max(1, values.length - 1)) * width;
        const y = top + height - (value / max) * height;
        return { x, y };
      });
      return buildSmoothPath(coords);
    };

    return {
      events: buildPath('events'),
      errors: buildPath('errors'),
      webViews: buildPath('webViews'),
      webVisitors: buildPath('webVisitors'),
      activeAgents: buildPath('activeAgents'),
      revenue: buildPath('revenue'),
    };
  }, [graphPoints, CHART_HEIGHT, CHART_LEFT, CHART_TOP, CHART_WIDTH]);

  const hoveredPoint = useMemo(() => {
    if (hoveredPointIndex == null) return null;
    return barPoints[hoveredPointIndex] || null;
  }, [barPoints, hoveredPointIndex]);

  const previousHoveredPoint = useMemo(() => {
    if (hoveredPointIndex == null || hoveredPointIndex <= 0) return null;
    return barPoints[hoveredPointIndex - 1] || null;
  }, [barPoints, hoveredPointIndex]);

  const peakVolume = useMemo(() => {
    if (barPoints.length === 0) return null;
    return barPoints.reduce((max, point) => (point.combined > max.combined ? point : max), barPoints[0]);
  }, [barPoints]);

  const volumeAreaPath = useMemo(() => {
    if (barPoints.length < 2) return '';
    const topPoints = barPoints.map((point) => ({ x: point.x, y: CHART_BOTTOM - point.barHeight }));
    const topPath = buildSmoothPath(topPoints);
    const last = topPoints[topPoints.length - 1];
    const first = topPoints[0];
    return `${topPath} L ${last.x} ${CHART_BOTTOM} L ${first.x} ${CHART_BOTTOM} Z`;
  }, [barPoints, CHART_BOTTOM]);

  const volumeLinePath = useMemo(() => {
    if (barPoints.length < 2) return '';
    return buildSmoothPath(barPoints.map((point) => ({ x: point.x, y: CHART_BOTTOM - point.barHeight })));
  }, [barPoints, CHART_BOTTOM]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const scopedAgent = agentId || undefined;
        const [summaryRes, websiteRes, graphRes, agentsRes] = await Promise.all([
          api.get('/internal/telemetry/summary', { params: { hours: 24, agentId: scopedAgent } }),
          api.get('/internal/telemetry/website', { params: { days: 30, agentId: scopedAgent } }),
          api.get('/internal/telemetry/activity-graph', { params: { days: graphDays, agentId: scopedAgent } }),
          api.get('/internal/agents', { params: { page: 1, pageSize: 100 } }),
        ]);
        if (!cancelled) {
          setSummary(summaryRes.data);
          setWebsite(websiteRes.data ?? null);
          setActivityGraph(graphRes.data ?? null);
          setAgents(agentsRes.data?.agents ?? []);
          setLastRefreshedAt(new Date().toISOString());
        }

        try {
          const systemRes = await api.get<InternalSystemHealth>('/internal/system');
          if (!cancelled) {
            const system = systemRes.data;
            setLiveHealth({
              live: system?.status === 'healthy' ? 'LIVE' : 'DEGRADED',
              db: system?.database?.ok === true ? 'HEALTHY' : system?.database?.ok === false ? 'OFFLINE' : 'UNKNOWN',
              latencyMs: typeof system?.database?.latencyMs === 'number' ? system.database.latencyMs : null,
              updatedAt: system?.meta?.serverTime || new Date().toISOString(),
            });
          }
        } catch {
          if (!cancelled) {
            setLiveHealth({
              live: 'DOWN',
              db: 'UNKNOWN',
              latencyMs: null,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        if (tab === 'events') {
          const res = await api.get('/internal/telemetry/events', {
            params: { page, pageSize, agentId: agentId || undefined, kind: kindFilter || undefined, search: search || undefined },
          });
          if (!cancelled) {
            setEvents(res.data?.events ?? []);
            setTotal(res.data?.total ?? 0);
          }
        } else {
          const res = await api.get('/internal/telemetry/errors', {
            params: { page, pageSize, agentId: agentId || undefined, source: sourceFilter || undefined, search: search || undefined },
          });
          if (!cancelled) {
            setErrors(res.data?.errors ?? []);
            setTotal(res.data?.total ?? 0);
          }
        }
      } catch (error) {
        console.error('Failed to load internal activity telemetry:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, refreshSeconds * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tab, agentId, kindFilter, sourceFilter, search, page, graphDays, refreshSeconds]);

  return (
    <PageLayout title={title} subtitle="Monitor internal actions, errors, and all-time website marketing performance." maxWidth="full">
      <div className="flex items-center justify-end gap-2 mb-3">
        <span className="text-[11px] text-slate-500 uppercase tracking-wide">Auto refresh</span>
        <select
          value={refreshSeconds}
          onChange={(e) => setRefreshSeconds(Number(e.target.value) as 5 | 10 | 15 | 20 | 30)}
          className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 text-slate-200 text-xs"
          style={{ colorScheme: 'dark' }}
        >
          <option value={5} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>5s</option>
          <option value={10} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>10s</option>
          <option value={15} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>15s</option>
          <option value={20} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>20s</option>
          <option value={30} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>30s</option>
        </select>
        <span className="text-[11px] text-slate-500">
          {lastRefreshedAt ? `Last: ${new Date(lastRefreshedAt).toLocaleTimeString()}` : 'Waiting for first refresh...'}
        </span>
      </div>
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
          <MetricCard
            label="Events (24h)"
            value={summary.events}
            detail={`Top: ${summary.topEventKinds[0]?.kind || '—'}`}
            deltaPct={summary.eventsChange?.deltaPct ?? 0}
            onClick={() => navigate('/internal/activity?tab=events')}
            ctaLabel="Open events"
          />
          <MetricCard
            label="Errors (24h)"
            value={summary.errors}
            detail={errorsTileDetail}
            tone="danger"
            deltaPct={summary.errorsChange?.deltaPct ?? 0}
            inverseDelta
            onClick={() => navigate('/internal/activity?tab=errors')}
            ctaLabel="Open errors"
          />
          <MetricCard
            label="Active agents"
            value={summary.agentsActive}
            detail="Last 24h activity"
            tone="info"
            deltaPct={summary.agentsActiveChange?.deltaPct ?? 0}
            onClick={() => navigate('/internal/usage')}
            ctaLabel="Open usage"
          />
          <MetricCard
            label="Website traffic (all-time)"
            value={website?.allTime.views ?? 0}
            detail={`${(website?.allTime.uniqueVisitors ?? 0).toLocaleString()} visitors · ${(website?.allTime.leads ?? 0).toLocaleString()} leads`}
            tone="success"
            deltaPct={trafficDeltaPct}
            onClick={() => navigate('/internal/usage')}
            ctaLabel="Traffic breakdown"
          />
          <MetricCard
            label="Total agents"
            value={summary.totalAgents ?? 0}
            detail={`${summary.agentGrowth30d?.current ?? 0} new in last 30d`}
            tone="success"
            deltaPct={summary.agentGrowth30d?.deltaPct ?? 0}
            onClick={() => navigate('/internal/agents')}
            ctaLabel="Open agents"
          />
          <MetricCard
            label="Revenue (30d)"
            value={summary.revenue30d?.current ?? 0}
            detail="Closed deal volume"
            tone="success"
            deltaPct={summary.revenue30d?.deltaPct ?? 0}
            formatAsCurrency
            onClick={() => navigate('/internal/billing')}
            ctaLabel="Open billing"
          />
        </div>
      )}

      {activityGraph && (
        <Card
          title="Activity pulse graph"
          description={`Internal + website trend for last ${graphDays === 365 ? '1 year' : `${graphDays} days`} with full hover detail.`}
          headerAction={
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-[11px] text-slate-500 uppercase tracking-wide">Timeframe</span>
              <select
                value={graphDays}
                onChange={(e) => setGraphDays(Number(e.target.value) as 30 | 60 | 90 | 365)}
                className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 text-slate-200 text-xs"
                style={{ colorScheme: 'dark' }}
              >
                <option value={30} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>30D</option>
                <option value={60} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>60D</option>
                <option value={90} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>90D</option>
                <option value={365} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>1Y</option>
              </select>
            </div>
          }
          hover={false}
          className="mb-4"
        >
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-cyan-950/20 p-2 md:p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex flex-wrap gap-2">
              {seriesMeta.map((metric) => {
                const active = visibleSeries[metric.key];
                return (
                  <button
                    key={metric.key}
                    onClick={() => setVisibleSeries((prev) => ({ ...prev, [metric.key]: !prev[metric.key] }))}
                    className={`px-3 py-1 rounded-md border text-[11px] transition-colors ${
                      active ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-slate-500'
                    }`}
                    title={`Toggle ${metric.label}`}
                  >
                    <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: metric.color }} />
                    {metric.label}
                    <span className="ml-1 text-slate-400">· {metric.currency ? formatCurrency(metric.total) : metric.total.toLocaleString()}</span>
                  </button>
                );
              })}
              </div>
              <div className="text-[11px] text-slate-500">
                Primary bars: <span className="text-slate-300 font-semibold">Total Activity Volume</span>
              </div>
            </div>

            <svg viewBox="0 0 1100 380" className="w-full h-[460px]">
              <defs>
                <linearGradient id="volumeBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(96,165,250,0.95)" />
                  <stop offset="100%" stopColor="rgba(37,99,235,0.45)" />
                </linearGradient>
                <linearGradient id="volumeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(56,189,248,0.28)" />
                  <stop offset="100%" stopColor="rgba(14,116,144,0.03)" />
                </linearGradient>
                <radialGradient id="chartGlow" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="rgba(56,189,248,0.12)" />
                  <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                </radialGradient>
                <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect x={CHART_LEFT} y={CHART_TOP} width={CHART_WIDTH} height={CHART_HEIGHT} fill="url(#chartGlow)" />

              {yAxisTicks.map((tick, index) => (
                <g key={index}>
                  <line x1={CHART_LEFT} y1={tick.y} x2={CHART_RIGHT} y2={tick.y} stroke="rgba(148,163,184,0.18)" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="35" y={tick.y + 4} textAnchor="end" fill="rgba(203,213,225,0.7)" fontSize="11">
                    {tick.label}
                  </text>
                </g>
              ))}

              {[0.25, 0.5, 0.75].map((r) => {
                const x = CHART_LEFT + CHART_WIDTH * r;
                return <line key={`v-${r}`} x1={x} y1={CHART_TOP} x2={x} y2={CHART_BOTTOM} stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" />;
              })}

              {volumeAreaPath && <path d={volumeAreaPath} fill="url(#volumeAreaGradient)" />}
              {volumeLinePath && <path d={volumeLinePath} fill="none" stroke="rgba(56,189,248,0.9)" strokeWidth="2" filter="url(#lineGlow)" />}

              {barPoints.map((point, index) => {
                const step = CHART_WIDTH / Math.max(1, barPoints.length - 1);
                const barWidth = Math.max(8, step * 0.75);
                const x = point.x - barWidth / 2;
                const y = CHART_BOTTOM - point.barHeight;
                const isHovered = hoveredPointIndex === index;
                return (
                  <rect
                    key={index}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={point.barHeight}
                    rx="6"
                    fill={isHovered ? 'rgba(125,211,252,0.98)' : 'url(#volumeBarGradient)'}
                  />
                );
              })}

              {seriesMeta
                .filter((metric) => visibleSeries[metric.key])
                .map((metric) => (
                  <g key={metric.key}>
                    <path
                      d={linePaths[metric.key] || ''}
                      fill="none"
                      stroke={metric.color}
                      strokeWidth={metric.key === 'webVisitors' ? 5.4 : 4.4}
                      opacity={0.18}
                      strokeLinecap="round"
                      filter="url(#lineGlow)"
                    />
                    <path
                      d={linePaths[metric.key] || ''}
                      fill="none"
                      stroke={metric.color}
                      strokeWidth={metric.key === 'webVisitors' ? 3.0 : 2.2}
                      opacity={metric.key === 'errors' ? 0.92 : 1}
                      strokeLinecap="round"
                    />
                  </g>
                ))}

              {barPoints.map((point, index) => {
                const step = CHART_WIDTH / Math.max(1, barPoints.length - 1);
                const hitWidth = Math.max(8, step);
                return (
                  <rect
                    key={`hit-${index}`}
                    x={point.x - hitWidth / 2}
                    y={CHART_TOP}
                    width={hitWidth}
                    height={CHART_HEIGHT}
                    fill="transparent"
                    onMouseEnter={() => setHoveredPointIndex(index)}
                  />
                );
              })}

              {hoveredPoint && (
                <g>
                  <line x1={hoveredPoint.x} y1={CHART_TOP} x2={hoveredPoint.x} y2={CHART_BOTTOM} stroke="rgba(110,231,183,0.9)" strokeWidth="1.5" strokeDasharray="5 4" />
                  <circle cx={hoveredPoint.x} cy={CHART_BOTTOM - hoveredPoint.barHeight} r="4" fill="#6ee7b7" />

                  {(() => {
                    const tooltipW = 244;
                    const tooltipH = 176;
                    const x = Math.min(CHART_RIGHT - tooltipW, Math.max(CHART_LEFT + 6, hoveredPoint.x + 14));
                    const y = CHART_TOP + 8;
                    const volumeDelta = previousHoveredPoint ? hoveredPoint.combined - previousHoveredPoint.combined : 0;
                    return (
                      <g>
                        <rect x={x} y={y} width={tooltipW} height={tooltipH} rx="14" fill="rgba(2,6,23,0.94)" stroke="rgba(148,163,184,0.35)" />
                        <text x={x + 14} y={y + 22} fill="white" fontSize="12" fontWeight="700">{hoveredPoint.point.date}</text>
                        <text x={x + 14} y={y + 42} fill="#93c5fd" fontSize="12">Volume: {hoveredPoint.combined.toLocaleString()}</text>
                        <text x={x + 138} y={y + 42} fill={volumeDelta >= 0 ? '#34d399' : '#fb7185'} fontSize="12" textAnchor="end">
                          {volumeDelta >= 0 ? '+' : ''}{volumeDelta.toLocaleString()}
                        </text>
                        <text x={x + 14} y={y + 64} fill="#67e8f9" fontSize="12">Events: {hoveredPoint.point.events.toLocaleString()}</text>
                        <text x={x + 14} y={y + 84} fill="#fb7185" fontSize="12">Errors: {hoveredPoint.point.errors.toLocaleString()}</text>
                        <text x={x + 14} y={y + 104} fill="#c4b5fd" fontSize="12">Web views: {hoveredPoint.point.webViews.toLocaleString()}</text>
                        <text x={x + 14} y={y + 124} fill="#34d399" fontSize="12">Visitors: {hoveredPoint.point.webVisitors.toLocaleString()}</text>
                        <text x={x + 14} y={y + 144} fill="#f59e0b" fontSize="12">Active agents: {hoveredPoint.point.activeAgents.toLocaleString()}</text>
                        <text x={x + 14} y={y + 164} fill="#10b981" fontSize="12">Revenue: {formatCurrency(hoveredPoint.point.revenue)}</text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </svg>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>{xLabels.start}</span>
              <span>{xLabels.mid}</span>
              <span>{xLabels.end}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Hover any bar to inspect that day’s internal + website numbers.</span>
            {peakVolume && <span>Peak volume: <span className="text-slate-300 font-semibold">{peakVolume.combined.toLocaleString()}</span> on {peakVolume.point.date}</span>}
          </div>
        </Card>
      )}

      {website && (
        <Card
          title="Marketing traffic intelligence"
          description={`Website performance over last ${website.days} days plus all-time visitor totals.`}
          hover={false}
          className="mb-5"
        >
          <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Conversion ({website.days}d)</div>
              <div className="text-lg font-semibold text-cyan-200">{website.range.conversionRate.toFixed(2)}%</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Views ({website.days}d)</div>
              <div className="text-lg font-semibold text-white">{website.range.views.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Visitors ({website.days}d)</div>
              <div className="text-lg font-semibold text-white">{website.range.uniqueVisitors.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Top source</div>
              <div className="text-lg font-semibold text-white truncate">{website.topSources[0]?.source || '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">Traffic trend ({website.days}d)</div>
              <div className="h-28 flex items-end gap-1">
                {website.daily.map((day) => {
                  const height = Math.round((day.views / maxDailyViews) * 100);
                  return (
                    <div key={day.date} className="flex-1 flex items-end">
                      <div
                        className="w-full rounded-sm bg-gradient-to-t from-cyan-500/50 to-cyan-300/80"
                        style={{ height: `${Math.max(3, height)}%` }}
                        title={`${day.date}: ${day.views.toLocaleString()} views`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{website.daily[0]?.date || '—'}</span>
                <span>{website.daily[website.daily.length - 1]?.date || '—'}</span>
              </div>
              <div className="mt-3 text-xs text-slate-300">
                <span className="font-semibold text-cyan-200">{website.range.views.toLocaleString()}</span> views ·{' '}
                <span className="font-semibold text-cyan-200">{website.range.uniqueVisitors.toLocaleString()}</span> visitors
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">Top traffic sources ({website.days}d)</div>
              <div className="space-y-2">
                {website.topSources.length === 0 ? (
                  <div className="text-sm text-slate-400">No UTM source data yet.</div>
                ) : (
                  website.topSources.map((source) => (
                    <div key={source.source}>
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                        <span className="truncate pr-2">{source.source}</span>
                        <span>{source.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-cyan-400/80"
                          style={{ width: `${Math.round((source.count / maxSourceCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">Campaigns + top pages ({website.days}d)</div>
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Campaigns</div>
                  {website.topCampaigns.length === 0 ? (
                    <div className="text-sm text-slate-400">No campaign tags yet.</div>
                  ) : (
                    website.topCampaigns.slice(0, 4).map((campaign) => (
                      <div key={campaign.campaign} className="flex items-center justify-between text-xs text-slate-300 py-0.5">
                        <span className="truncate pr-2">{campaign.campaign}</span>
                        <span>{campaign.count.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Top pages</div>
                  {website.topLandingPages.length === 0 ? (
                    <div className="text-sm text-slate-400">No landing-page traffic yet.</div>
                  ) : (
                    website.topLandingPages.slice(0, 4).map((page) => (
                      <div key={page.landingPageId} className="flex items-center justify-between text-xs text-slate-300 py-0.5 gap-2">
                        <span className="truncate">{page.title}</span>
                        <span className="text-slate-500 whitespace-nowrap">{page.views.toLocaleString()} views</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Devices</div>
                  {website.devices.length === 0 ? (
                    <div className="text-sm text-slate-400">No device metadata yet.</div>
                  ) : (
                    website.devices.slice(0, 4).map((device) => (
                      <div key={device.device} className="flex items-center justify-between text-xs text-slate-300 py-0.5 gap-2">
                        <span className="truncate capitalize">{device.device.toLowerCase()}</span>
                        <span className="text-slate-500 whitespace-nowrap">{device.count.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
          Activity
        </TabButton>
        <TabButton active={tab === 'errors'} onClick={() => setTab('errors')}>
          Errors
        </TabButton>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="ml-auto px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name || a.email}
            </option>
          ))}
        </select>
        {tab === 'events' ? (
          <input
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            placeholder="Filter kind"
            className="px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
          />
        ) : (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
          >
            <option value="">All sources</option>
            <option value="client">Client</option>
            <option value="server">Server</option>
          </select>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className="px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[260px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      ) : tab === 'events' ? (
        <Card title="Recent activity" description="Latest page views + important actions" hover={false}>
          {events.length === 0 ? (
            <div className="text-sm text-slate-300">No events yet.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {events.map((row) => (
                <div key={row.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {row.agent ? `${row.agent.name} (${row.agent.email})` : 'Unknown agent'}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {row.kind}
                      {row.path ? ` • ${row.path}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
            <span>
              Page {page} · {total} items
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
                disabled={page * pageSize >= total}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Recent errors" description="Client + server errors reported by agents" hover={false}>
          {errors.length === 0 ? (
            <div className="text-sm text-slate-300">No errors reported.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {errors.map((row) => (
                <div key={row.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={row.source === 'server' ? 'danger' : 'warning'}>{row.source.toUpperCase()}</Badge>
                      <div className="text-sm font-semibold text-white truncate">
                        {row.agent ? `${row.agent.name} (${row.agent.email})` : 'Unknown agent'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 mt-1 break-words">{row.message}</div>
                    {row.path && <div className="text-xs text-slate-500 mt-1 truncate">{row.path}</div>}
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
            <span>
              Page {page} · {total} items
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
                disabled={page * pageSize >= total}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}
    </PageLayout>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
        active
          ? 'bg-cyan-500/15 border-cyan-400/20 text-white'
          : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
  deltaPct = 0,
  inverseDelta = false,
  formatAsCurrency = false,
  onClick,
  ctaLabel,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'default' | 'info' | 'success' | 'danger';
  deltaPct?: number;
  inverseDelta?: boolean;
  formatAsCurrency?: boolean;
  onClick?: () => void;
  ctaLabel?: string;
}) {
  const toneMap: Record<'default' | 'info' | 'success' | 'danger', string> = {
    default: 'text-white',
    info: 'text-cyan-200',
    success: 'text-emerald-300',
    danger: 'text-rose-300',
  };

  return (
    <Card className="p-4" hover={Boolean(onClick)} onClick={onClick}>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneMap[tone]}`}>
        {formatAsCurrency ? formatCurrency(value) : value.toLocaleString()}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
      <div className={`mt-1 text-[11px] font-semibold ${deltaTone(deltaPct, inverseDelta)}`}>
        {deltaText(deltaPct, inverseDelta)}
      </div>
      {ctaLabel && <div className="mt-2 text-[11px] text-cyan-300/80">{ctaLabel} →</div>}
    </Card>
  );
}

function computeDeltaPct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function deltaTone(deltaPct: number, inverse: boolean) {
  if (deltaPct === 0) return 'text-slate-500';
  const positive = deltaPct > 0;
  if (inverse) {
    return positive ? 'text-rose-300' : 'text-emerald-300';
  }
  return positive ? 'text-emerald-300' : 'text-rose-300';
}

function deltaText(deltaPct: number, inverse: boolean) {
  if (deltaPct === 0) return 'No change vs previous period';
  const positive = deltaPct > 0;
  const arrow = positive ? '▲' : '▼';
  const descriptor = inverse ? (positive ? 'higher' : 'lower') : positive ? 'growth' : 'decline';
  return `${arrow} ${Math.abs(deltaPct).toFixed(1)}% ${descriptor} vs previous period`;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
