import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

type OverviewResponse = {
  totals: {
    agents: number;
    clients: number;
    deals: number;
    listings: number;
    tasks: number;
    marketingBlasts: number;
    signatureEnvelopes: number;
  };
  recent: {
    agents: Array<{ id: string; email: string; name: string; brokerageName: string | null; createdAt: string }>;
    deals: Array<{ id: string; title: string; status: string; createdAt: string; agent?: { name: string; email: string } }>;
    listings: Array<{ id: string; headline: string; status: string; price: number; city: string; createdAt: string; agent?: { name: string; email: string } }>;
    tasks: Array<{ id: string; title: string; status: string; priority: string; createdAt: string; agent?: { name: string; email: string } }>;
  };
};

function formatCompact(n: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function getGlow(tone: string) {
  switch (tone) {
    case 'info': return 'from-cyan-500 to-blue-600';
    case 'success': return 'from-emerald-400 to-green-600';
    case 'warning': return 'from-amber-300 to-orange-500';
    default: return 'from-slate-400 to-slate-600';
  }
}

const ICONS = {
  agents: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  listings: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  deals: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  contracts: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  tasks: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  blasts: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
};

export function InternalOverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.get('/internal/overview');
        if (!cancelled) setData(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Agents', value: data.totals.agents, tone: 'info' as const, icon: ICONS.agents, color: 'text-cyan-400', bg: 'hover:shadow-cyan-500/20 hover:border-cyan-500/50', route: '/internal/agents' },
      { label: 'Listings', value: data.totals.listings, tone: 'default' as const, icon: ICONS.listings, color: 'text-indigo-400', bg: 'hover:shadow-indigo-500/20 hover:border-indigo-500/50', route: '/internal/listings' },
      { label: 'Deals', value: data.totals.deals, tone: 'success' as const, icon: ICONS.deals, color: 'text-emerald-400', bg: 'hover:shadow-emerald-500/20 hover:border-emerald-500/50', route: '/internal/activity' },
      { label: 'Contracts', value: data.totals.signatureEnvelopes, tone: 'warning' as const, icon: ICONS.contracts, color: 'text-amber-400', bg: 'hover:shadow-amber-500/20 hover:border-amber-500/50', route: '/internal/contracts' },
      { label: 'Tasks', value: data.totals.tasks, tone: 'default' as const, icon: ICONS.tasks, color: 'text-pink-400', bg: 'hover:shadow-pink-500/20 hover:border-pink-500/50', route: '/internal/activity' },
      { label: 'Blasts', value: data.totals.marketingBlasts, tone: 'info' as const, icon: ICONS.blasts, color: 'text-sky-400', bg: 'hover:shadow-sky-500/20 hover:border-sky-500/50', route: '/internal/activity' },
    ];
  }, [data]);

  return (
    <PageLayout
      title="Command Center"
      subtitle="System-wide administration and performance monitoring."
      maxWidth="full"
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[320px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      ) : !data ? (
        <Card>
          <div className="text-sm text-slate-300">Couldn’t load internal overview.</div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
            {kpis.map((kpi) => (
              <Card 
                key={kpi.label} 
                className={`p-0 relative overflow-hidden group border-white/5 bg-slate-900/40 backdrop-blur-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl cursor-pointer ${kpi.bg}`}
                tone="solid"
                hover={false}
                onClick={() => navigate(kpi.route)}
              >
                {/* Background Glow */}
                <div className={`absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br ${getGlow(kpi.tone)} opacity-0 group-hover:opacity-[0.07] blur-[100px] transition-opacity duration-700 pointer-events-none -mr-20 -mt-20`} />
                
                {/* Giant Icon Background */}
                <div className={`absolute -bottom-6 -right-6 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.15] transition-all duration-500 -rotate-12 group-hover:rotate-0 group-hover:scale-110 ${kpi.color}`}>
                  {kpi.icon}
                </div>

                <div className="p-6 relative z-10 flex flex-col items-start justify-between min-h-[160px]">
                  <div className="w-full flex items-center justify-between mb-4">
                     <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md group-hover:scale-110 transition-transform duration-500 ${kpi.color} shadow-lg shadow-black/20`}>
                        <div className="w-5 h-5">{kpi.icon}</div>
                     </div>
                     <div className={`h-2 w-2 rounded-full ring-2 ring-white/5 ${kpi.color.replace('text-', 'bg-')} shadow-[0_0_15px_currentColor] animate-pulse`} />
                  </div>
                  
                  <div className="mt-auto">
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 tracking-tighter drop-shadow-2xl filter group-hover:scale-105 transition-transform duration-300 origin-left">
                      {formatCompact(kpi.value)}
                    </div>
                    <div className={`mt-2 font-bold tracking-wider text-xs uppercase opacity-60 group-hover:opacity-100 transition-opacity ${kpi.color}`}>
                      {kpi.label}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Card 
              title="Recent signups" 
              description="Latest agent accounts created" 
              hover={false}
              headerAction={
                <button 
                  onClick={() => navigate('/internal/agents')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  View all →
                </button>
              }
            >
              <div className="space-y-3">
                {data.recent.agents.map((a) => (
                  <div 
                    key={a.id} 
                    className="flex items-center justify-between gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/internal/agents/${a.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{a.name}</div>
                      <div className="text-xs text-slate-400 truncate">{a.email}{a.brokerageName ? ` · ${a.brokerageName}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(a.email);
                        }}
                        className="inline-flex items-center rounded-full border border-slate-400/30 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
                      >
                        📋 Copy
                      </button>
                      <a
                        href={`mailto:${a.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
                      >
                        ✉️ Email
                      </a>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card 
              title="Latest listings" 
              description="New listings created across the platform" 
              hover={false}
              headerAction={
                <button 
                  onClick={() => navigate('/internal/listings')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  View all →
                </button>
              }
            >
              <div className="space-y-3">
                {data.recent.listings.map((l) => (
                  <div 
                    key={l.id} 
                    className="flex items-start justify-between gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate('/internal/listings')}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{l.headline}</div>
                      <div className="text-xs text-slate-400 truncate">{formatMoney(l.price)} · {l.city} · {l.status}</div>
                      <div className="text-[11px] text-slate-500 truncate">{l.agent?.name ? `${l.agent.name} (${l.agent.email})` : '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/internal/listings');
                        }}
                        className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20"
                      >
                        Open
                      </button>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card 
              title="Activity feed" 
              description="Latest tasks across agents" 
              hover={false}
              headerAction={
                <button 
                  onClick={() => navigate('/internal/activity')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  View all →
                </button>
              }
            >
              <div className="space-y-3">
                {data.recent.tasks.map((t) => (
                  <div 
                    key={t.id} 
                    className="flex items-start justify-between gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate('/internal/activity')}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{t.title}</div>
                      <div className="text-xs text-slate-400 truncate">{t.status} · {t.priority}</div>
                      <div className="text-[11px] text-slate-500 truncate">{t.agent?.name ? `${t.agent.name} (${t.agent.email})` : '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.agent?.email && (
                        <a
                          href={`mailto:${t.agent.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
                        >
                          ✉️ Email
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/internal/activity');
                        }}
                        className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20"
                      >
                        Open
                      </button>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
