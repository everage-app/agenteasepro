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
  sampled: boolean;
};

const ranges = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

export function InternalUsagePage() {
  const [hours, setHours] = useState(168);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/internal/usage', { params: { hours } });
        if (!cancelled) setData(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hours]);

  const maxTrend = useMemo(() => {
    if (!data?.trend?.length) return 1;
    return Math.max(1, ...data.trend.map((item) => item.count));
  }, [data]);

  const maxFeature = useMemo(() => {
    if (!data?.featureUsage?.length) return 1;
    return Math.max(1, ...data.featureUsage.map((item) => item.count));
  }, [data]);

  const errorRate = useMemo(() => {
    if (!data?.pageViews) return 0;
    return (data.errors / data.pageViews) * 100;
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
        <div className="flex items-center gap-2">
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
            <StatCard label="Range" value={`${Math.ceil(data.hours / 24)}d`} detail="Reporting window" />
          </div>

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
