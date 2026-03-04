import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

type AgentDetail = {
  agent: {
    id: string;
    email: string;
    name: string;
    brokerageName: string | null;
    licenseNumber: string | null;
    status: string;
    subscriptionStatus: string;
    billingAccessOverride: boolean;
    createdAt: string;
    updatedAt: string;
    profileSettings: any;
    notificationPrefs: any;
    aiSettings: any;
    idxConnection: any;
    googleCalendar: any;
    _count: {
      clients: number;
      deals: number;
      listings: number;
      tasks: number;
      marketingBlasts: number;
      landingPages: number;
      leads: number;
    };
  };
  latest: {
    deals: Array<{ id: string; title: string; status: string; createdAt: string }>;
    listings: Array<{ id: string; headline: string; status: string; price: number; city: string; createdAt: string }>;
    tasks: Array<{ id: string; title: string; status: string; priority: string; createdAt: string; dueAt: string | null }>;
    envelopes: Array<{ id: string; type: string; createdAt: string; dealId: string }>;
  };
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function InternalAgentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingSaving, setBillingSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/internal/agents/${id}`);
        if (!cancelled) setData(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const counts = useMemo(() => data?.agent._count, [data]);
  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'activity'>('overview');
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if(activeTab === 'activity' && id) {
        api.get(`/internal/agents/${id}/activity`).then(res => setActivities(res.data));
    }
  }, [activeTab, id]);

  return (
    <PageLayout
      title={data?.agent.name || 'Agent'}
      subtitle={data ? `${data.agent.email}${data.agent.brokerageName ? ` · ${data.agent.brokerageName}` : ''}` : 'Loading…'}
      breadcrumbs={[{ label: 'Internal', href: '/internal' }, { label: 'Agents', href: '/internal/agents' }, { label: 'Profile' }]}
      maxWidth="full"
      actions={
        <div className="flex items-center gap-2">
           <Link to="/internal/billing">
              <Button variant="secondary" size="sm">Billing</Button>
           </Link>
           {data?.agent.status === 'REVOKED' ? (
              <Button variant="primary" size="sm" onClick={async () => {
                  if(!confirm('Restore this archived agent to active?')) return;
                  await api.post(`/internal/agents/${data!.agent.id}/status`, { status: 'ACTIVE' });
                  window.location.reload();
              }}>Restore</Button>
           ) : (
              <>
                {data?.agent.status === 'ACTIVE' ? (
                  <Button variant="danger" size="sm" onClick={async () => {
                      if(!confirm('Suspend this agent?')) return;
                      await api.post(`/internal/agents/${data!.agent.id}/status`, { status: 'SUSPENDED' });
                      window.location.reload();
                  }}>Suspend</Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={async () => {
                      await api.post(`/internal/agents/${data!.agent.id}/status`, { status: 'ACTIVE' });
                      window.location.reload();
                  }}>Activate</Button>
                )}
                <Button variant="secondary" size="sm" onClick={async () => {
                    if(!confirm('Archive this agent? They will be excluded from Internal stats but retained for future reference.')) return;
                    await api.post(`/internal/agents/${data!.agent.id}/status`, { status: 'REVOKED' });
                    window.location.reload();
                }}>Archive</Button>
              </>
           )}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[320px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      ) : !data || !counts ? (
        <Card>
          <div className="text-sm text-slate-300">Agent not found.</div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Hero Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <Stat label="Clients" value={counts.clients} icon="👥" gradient="from-violet-600/40 to-purple-800/30" />
            <Stat label="Deals" value={counts.deals} icon="🤝" gradient="from-emerald-600/40 to-teal-800/30" />
            <Stat label="Listings" value={counts.listings} icon="🏠" gradient="from-blue-600/40 to-indigo-800/30" />
            <Stat label="Tasks" value={counts.tasks} icon="✅" gradient="from-amber-600/40 to-orange-800/30" />
            <Stat label="Blasts" value={counts.marketingBlasts} icon="📣" gradient="from-pink-600/40 to-rose-800/30" />
            <Stat label="Landing Pages" value={counts.landingPages} icon="🌐" gradient="from-cyan-600/40 to-sky-800/30" />
            <Stat label="Leads" value={counts.leads} icon="🎯" gradient="from-red-600/40 to-rose-800/30" />
          </div>

          {/* Enhanced Tabs */}
          <div className="border-b border-white/10">
            <nav className="flex gap-1">
                {[
                  { key: 'overview', label: 'Overview', icon: '📊' },
                  { key: 'billing', label: 'Billing', icon: '💳' },
                  { key: 'activity', label: 'Activity', icon: '📈' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-xl transition-all ${
                          activeTab === tab.key 
                            ? 'bg-gradient-to-b from-cyan-500/20 to-transparent border-b-2 border-cyan-400 text-white' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </nav>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Latest Deals Card */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-900/20 via-slate-900/50 to-slate-900/80 border border-emerald-500/20 backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <span className="text-xl">🤝</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Latest Deals</h3>
                    <p className="text-[11px] text-slate-400">Recent deal activity</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {data.latest.deals.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2 opacity-50">📭</div>
                      <div className="text-sm text-slate-400">No deals yet</div>
                    </div>
                  ) : (
                    data.latest.deals.map((d) => (
                      <div key={d.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{d.title}</div>
                          <div className="text-xs text-emerald-400/80 truncate mt-0.5">{d.status}</div>
                        </div>
                        <div className="text-[10px] text-slate-500 whitespace-nowrap bg-slate-800/50 px-2 py-1 rounded-full">{new Date(d.createdAt).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Latest Listings Card */}
              <div className="rounded-2xl bg-gradient-to-br from-blue-900/20 via-slate-900/50 to-slate-900/80 border border-blue-500/20 backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <span className="text-xl">🏠</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Latest Listings</h3>
                    <p className="text-[11px] text-slate-400">Recent listing activity</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {data.latest.listings.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2 opacity-50">🏡</div>
                      <div className="text-sm text-slate-400">No listings yet</div>
                    </div>
                  ) : (
                    data.latest.listings.map((l) => (
                      <div key={l.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{l.headline}</div>
                          <div className="text-xs text-blue-400/80 truncate mt-0.5">{formatMoney(l.price)} · {l.city}</div>
                        </div>
                        <div className="text-[10px] text-slate-500 whitespace-nowrap bg-slate-800/50 px-2 py-1 rounded-full">{new Date(l.createdAt).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Latest Tasks Card */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-900/20 via-slate-900/50 to-slate-900/80 border border-amber-500/20 backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Latest Tasks</h3>
                    <p className="text-[11px] text-slate-400">Task stream</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {data.latest.tasks.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2 opacity-50">📋</div>
                      <div className="text-sm text-slate-400">No tasks yet</div>
                    </div>
                  ) : (
                    data.latest.tasks.map((t) => (
                      <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{t.title}</div>
                          <div className="text-xs text-amber-400/80 truncate mt-0.5">
                            {t.status} · {t.priority}{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 whitespace-nowrap bg-slate-800/50 px-2 py-1 rounded-full">{new Date(t.createdAt).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Contracts Card */}
              <div className="rounded-2xl bg-gradient-to-br from-purple-900/20 via-slate-900/50 to-slate-900/80 border border-purple-500/20 backdrop-blur-xl overflow-hidden xl:col-span-3">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Recent Contracts</h3>
                    <p className="text-[11px] text-slate-400">Signature envelopes</p>
                  </div>
                </div>
                <div className="p-5">
                  {data.latest.envelopes.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2 opacity-50">✉️</div>
                      <div className="text-sm text-slate-400">No envelopes yet</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      {data.latest.envelopes.map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{e.type}</div>
                            <div className="text-xs text-purple-400/80 truncate">Deal {e.dealId.slice(0, 8)}...</div>
                          </div>
                          <Badge variant="info">{new Date(e.createdAt).toLocaleDateString()}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
              <div className="rounded-2xl bg-gradient-to-br from-cyan-900/20 via-slate-900/50 to-slate-900/80 border border-cyan-500/20 backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <span className="text-xl">💳</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Subscription & Billing</h3>
                    <p className="text-[11px] text-slate-400">Manage agent subscription status</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                      <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg">
                            💎
                          </div>
                          <div>
                              <div className="text-sm font-bold text-white">Current Plan</div>
                              <div className="text-xs text-slate-400">Agent Professional</div>
                          </div>
                      </div>
                      <Badge variant="success" className="px-3 py-1.5 text-xs">{data.agent.subscriptionStatus}</Badge>
                  </div>
                  <div className="mt-6">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Manage Subscription</div>
                        <div className="flex flex-wrap gap-2">
                            {[
                              { status: 'ACTIVE', color: 'from-emerald-500 to-green-600', icon: '✅' },
                              { status: 'TRIAL', color: 'from-amber-500 to-orange-600', icon: '⏳' },
                              { status: 'PAST_DUE', color: 'from-red-500 to-rose-600', icon: '⚠️' },
                              { status: 'CANCELED', color: 'from-slate-500 to-slate-600', icon: '❌' }
                            ].map(s => (
                                <button
                                    key={s.status}
                                    onClick={async () => {
                                        if(!confirm(`Set subscription to ${s.status}?`)) return;
                                        setBillingSaving(true);
                                        try {
                                          const res = await api.post(`/internal/agents/${data.agent.id}/subscription`, { status: s.status });
                                          setData(prev => prev ? {
                                            ...prev,
                                            agent: {
                                              ...prev.agent,
                                              subscriptionStatus: res.data.subscriptionStatus,
                                              billingAccessOverride: Boolean(res.data.billingAccessOverride),
                                            }
                                          } : prev);
                                        } finally {
                                          setBillingSaving(false);
                                        }
                                    }}
                                    disabled={billingSaving}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all hover:scale-105 ${
                                      data.agent.subscriptionStatus === s.status 
                                        ? `bg-gradient-to-r ${s.color} border-white/20 text-white shadow-lg` 
                                        : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <span>{s.icon}</span>
                                    {s.status}
                                </button>
                            ))}
                        </div>
                        <div className="mt-5 p-4 rounded-xl border border-white/10 bg-white/5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-white">Admin Access Override</div>
                              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                                Keep this user active in-app while you handle one-off billing adjustments. Billing status is still editable and visible.
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                const nextValue = !data.agent.billingAccessOverride;
                                const confirmText = nextValue
                                  ? 'Enable access override? User will stay active even if billing is past due or canceled.'
                                  : 'Disable access override and return to normal billing enforcement?';
                                if (!confirm(confirmText)) return;
                                setBillingSaving(true);
                                try {
                                  const res = await api.post(`/internal/agents/${data.agent.id}/subscription`, {
                                    billingAccessOverride: nextValue,
                                  });
                                  setData(prev => prev ? {
                                    ...prev,
                                    agent: {
                                      ...prev.agent,
                                      subscriptionStatus: res.data.subscriptionStatus,
                                      billingAccessOverride: Boolean(res.data.billingAccessOverride),
                                    }
                                  } : prev);
                                } finally {
                                  setBillingSaving(false);
                                }
                              }}
                              disabled={billingSaving}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                data.agent.billingAccessOverride
                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {data.agent.billingAccessOverride ? 'Override ON' : 'Override OFF'}
                            </button>
                          </div>
                        </div>
                  </div>
                </div>
              </div>
          )}

           {activeTab === 'activity' && (
              <div className="rounded-2xl bg-gradient-to-br from-indigo-900/20 via-slate-900/50 to-slate-900/80 border border-indigo-500/20 backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <span className="text-xl">📈</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Activity Log</h3>
                    <p className="text-[11px] text-slate-400">Recent daily activity entries</p>
                  </div>
                </div>
                <div className="p-5">
                  {activities.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3 opacity-50">📊</div>
                      <div className="text-sm text-slate-400">No activity recorded yet</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((act: any) => (
                        <div key={act.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                              {act.score}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">Activity Score</div>
                              <div className="text-xs text-slate-400">Daily engagement metric</div>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">{new Date(act.date).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}

function Stat({ label, value, icon, gradient }: { label: string; value: number; icon?: string; gradient?: string }) {
  const defaultGradient = 'from-slate-800/80 to-slate-900/60';
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient || defaultGradient} border border-white/10 backdrop-blur-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group`}>
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase">{label}</div>
          {icon && <span className="text-2xl opacity-80 group-hover:scale-110 transition-transform">{icon}</span>}
        </div>
        <div className="text-3xl font-black text-white tracking-tight">{value.toLocaleString()}</div>
        <div className="mt-2 text-[11px] text-slate-500 font-medium">All-time</div>
      </div>
      
      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient?.replace('from-', 'from-').replace('/80', '/60').replace('/60', '') || 'from-cyan-500 to-blue-500'} opacity-60`} />
    </div>
  );
}
