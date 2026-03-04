import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

type AgentRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

type AgentsResponse = {
  page: number;
  pageSize: number;
  total: number;
  agents: AgentRow[];
};

type Subscription = {
  status: string;
  billing?: {
    mode: 'FREE' | 'STANDARD' | 'CUSTOM';
    customPriceCents: number | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
  plan: { name: string; price: number; interval: string };
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  legalAcceptance?: {
    termsAcceptedAt: string | null;
    privacyAcceptedAt: string | null;
    termsVersionAccepted: string | null;
    privacyVersionAccepted: string | null;
    termsUrlAccepted: string | null;
    privacyUrlAccepted: string | null;
    legalAcceptedIp: string | null;
    legalAcceptedUserAgent: string | null;
  } | null;
};

type LegalPolicies = {
  terms: { url: string; version: string };
  privacy: { url: string; version: string };
};

type PaymentMethod = {
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
};

type Invoice = {
  id: string;
  date: string;
  amount: number;
  status: string;
  pdfUrl: string | null;
};

type BillingOverview = {
  totals: {
    totalAgents: number;
    activeSubscribers: number;
    pastDueSubscribers: number;
    trialSubscribers: number;
    billableSubscribers: number;
    freePlanAgents: number;
    standardPlanAgents: number;
    customPlanAgents: number;
    overrideEnabledAgents: number;
  };
  pricing: {
    estimatedMrr: number;
    estimatedArr: number;
    avgMrrPerAgent: number;
    defaultMonthlyPrice: number;
  };
  revenue: {
    closedDeals30d: number;
    closedVolume30d: number;
    closedVolumePrev30d: number;
    closedVolume90d: number;
    closedVolumeAllTime: number;
    closedVolumeDeltaPct: number;
  };
  trend30d: Array<{ date: string; closedDeals: number; closedVolume: number }>;
  topAgents30d: Array<{ agentId: string; name: string; email: string; closedDeals: number; closedVolume: number }>;
};

export function InternalBillingPage() {
  const [agents, setAgents] = useState<AgentsResponse | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [sub, setSub] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [legalPolicies, setLegalPolicies] = useState<LegalPolicies | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [billingMode, setBillingMode] = useState<'FREE' | 'STANDARD' | 'CUSTOM'>('STANDARD');
  const [customMonthly, setCustomMonthly] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [termsUrlDraft, setTermsUrlDraft] = useState('');
  const [termsVersionDraft, setTermsVersionDraft] = useState('');
  const [privacyUrlDraft, setPrivacyUrlDraft] = useState('');
  const [privacyVersionDraft, setPrivacyVersionDraft] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [agentsRes, overviewRes, legalRes] = await Promise.all([
          api.get('/internal/agents', { params: { page: 1, pageSize: 50 } }),
          api.get('/internal/billing/overview'),
          api.get('/internal/legal/policies'),
        ]);
        if (!cancelled) {
          setAgents(agentsRes.data);
          setOverview(overviewRes.data ?? null);
          setLegalPolicies(legalRes.data ?? null);
          setTermsUrlDraft(legalRes.data?.terms?.url || '');
          setTermsVersionDraft(legalRes.data?.terms?.version || '');
          setPrivacyUrlDraft(legalRes.data?.privacy?.url || '');
          setPrivacyVersionDraft(legalRes.data?.privacy?.version || '');
          const first = agentsRes.data?.agents?.[0]?.id;
          if (first) setSelectedAgentId(first);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSub() {
      if (!selectedAgentId) return;
      setSubLoading(true);
      try {
        const [subRes, paymentRes, invoicesRes] = await Promise.all([
          api.get(`/internal/billing/agent/${selectedAgentId}/subscription`),
          api.get(`/internal/billing/agent/${selectedAgentId}/payment-method`),
          api.get(`/internal/billing/agent/${selectedAgentId}/invoices`),
        ]);
        if (!cancelled) {
          setSub(subRes.data);
          setPaymentMethod(paymentRes.data || null);
          setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
          const mode = subRes.data?.billing?.mode as ('FREE' | 'STANDARD' | 'CUSTOM') | undefined;
          if (mode) setBillingMode(mode);
          const cents = subRes.data?.billing?.customPriceCents;
          setCustomMonthly(typeof cents === 'number' && cents > 0 ? (cents / 100).toFixed(2) : '');
        }
      } finally {
        if (!cancelled) setSubLoading(false);
      }
    }

    loadSub();
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  async function saveBillingSettings() {
    if (!selectedAgentId) return;
    setSaving(true);
    try {
      const cents = billingMode === 'CUSTOM' ? Math.round(Number(customMonthly) * 100) : null;
      await api.post(`/internal/billing/agent/${selectedAgentId}/settings`, {
        billingMode,
        billingCustomPriceCents: billingMode === 'CUSTOM' ? cents : null,
      });
      const res = await api.get(`/internal/billing/agent/${selectedAgentId}/subscription`);
      setSub(res.data);
    } finally {
      setSaving(false);
    }
  }

  async function saveLegalPolicies() {
    setSavingPolicies(true);
    try {
      const res = await api.put('/internal/legal/policies', {
        terms: {
          url: termsUrlDraft.trim(),
          version: termsVersionDraft.trim(),
        },
        privacy: {
          url: privacyUrlDraft.trim(),
          version: privacyVersionDraft.trim(),
        },
      });
      setLegalPolicies(res.data);
      setTermsUrlDraft(res.data?.terms?.url || '');
      setTermsVersionDraft(res.data?.terms?.version || '');
      setPrivacyUrlDraft(res.data?.privacy?.url || '');
      setPrivacyVersionDraft(res.data?.privacy?.version || '');
    } finally {
      setSavingPolicies(false);
    }
  }

  const selectedAgent = agents?.agents.find((a) => a.id === selectedAgentId) || null;
  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value || 0);
  const filteredAgents = useMemo(() => {
    if (!agents?.agents) return [] as AgentRow[];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return agents.agents;
    return agents.agents.filter((a) =>
      a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [agents?.agents, searchTerm]);

  const maxTrendVolume = useMemo(() => {
    if (!overview?.trend30d?.length) return 1;
    return Math.max(1, ...overview.trend30d.map((d) => d.closedVolume));
  }, [overview]);

  return (
    <PageLayout
      title="Billing"
      subtitle="Manage agent billing quickly with a clean workflow and live subscription details."
      maxWidth="full"
      actions={
        <Link to="/settings/billing">
          <Button variant="secondary" size="sm">View agent-facing billing page</Button>
        </Link>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[260px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      ) : (
        <div className="space-y-5">
          {overview && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <Card hover={false} className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Estimated MRR</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(overview.pricing.estimatedMrr)}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Billable subscriptions (excludes trials/free)</div>
                </Card>
                <Card hover={false} className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Estimated ARR</div>
                  <div className="mt-2 text-2xl font-semibold text-cyan-200">{formatCurrency(overview.pricing.estimatedArr)}</div>
                  <div className="mt-1 text-[11px] text-slate-500">12-month run rate</div>
                </Card>
                <Card hover={false} className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Revenue (30d)</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(overview.revenue.closedVolume30d)}</div>
                  <div className={`mt-1 text-[11px] font-semibold ${overview.revenue.closedVolumeDeltaPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {overview.revenue.closedVolumeDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(overview.revenue.closedVolumeDeltaPct).toFixed(1)}% vs previous 30d
                  </div>
                </Card>
                <Card hover={false} className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Closed deals (30d)</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{overview.revenue.closedDeals30d.toLocaleString()}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Total closed transactions</div>
                </Card>
                <Card hover={false} className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Subscribers</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{overview.totals.activeSubscribers.toLocaleString()}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Past due: {overview.totals.pastDueSubscribers} · Trials: {overview.totals.trialSubscribers}</div>
                </Card>
                <Card hover={false} className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">All-time volume</div>
                  <div className="mt-2 text-2xl font-semibold text-cyan-200">{formatCurrency(overview.revenue.closedVolumeAllTime)}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Across all closed REPCs</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7">
                  <Card title="Revenue trend (30d)" description="Daily closed transaction volume" hover={false}>
                    <div className="h-36 flex items-end gap-1">
                      {overview.trend30d.map((day) => {
                        const h = Math.max(4, Math.round((day.closedVolume / maxTrendVolume) * 100));
                        return (
                          <div key={day.date} className="flex-1 flex items-end">
                            <div
                              className="w-full rounded-sm bg-gradient-to-t from-emerald-500/40 to-cyan-300/80"
                              style={{ height: `${h}%` }}
                              title={`${day.date} · ${formatCurrency(day.closedVolume)} · ${day.closedDeals} deals`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{overview.trend30d[0]?.date || '—'}</span>
                      <span>{overview.trend30d[overview.trend30d.length - 1]?.date || '—'}</span>
                    </div>
                  </Card>
                </div>

                <div className="xl:col-span-5">
                  <Card title="Top agents by revenue (30d)" description="Who is driving closed volume" hover={false}>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {overview.topAgents30d.length === 0 ? (
                        <div className="text-sm text-slate-400">No closed revenue in the last 30 days.</div>
                      ) : (
                        overview.topAgents30d.map((agent) => (
                          <div key={agent.agentId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{agent.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">{agent.email}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-emerald-300">{formatCurrency(agent.closedVolume)}</div>
                              <div className="text-[11px] text-slate-500">{agent.closedDeals} deals</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-4 space-y-4">
            <Card title="Agents" description="Select an account" hover={false}>
              {!agents ? (
                <div className="text-sm text-slate-300">No agents loaded.</div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search name or email..."
                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                    {filteredAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition-all ${
                          selectedAgentId === agent.id
                            ? 'border-cyan-400/40 bg-cyan-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                            {agent.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{agent.name}</div>
                            <div className="text-xs text-slate-400 truncate">{agent.email}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredAgents.length === 0 && (
                      <div className="py-6 text-center text-xs text-slate-500">No agents match that search.</div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="xl:col-span-8 space-y-4">
            <Card title="Billing workspace" description="Review live subscription details" hover={false}>
              {subLoading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400" />
                  <div className="text-sm text-slate-300">Loading subscription…</div>
                </div>
              ) : !sub ? (
                <div className="text-sm text-slate-300">No subscription data.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Plan</div>
                    <div className="text-lg font-semibold text-white mt-2">{sub.plan.name}</div>
                    <div className="text-sm text-slate-400">${sub.plan.price}/{sub.plan.interval}</div>
                    <div className="mt-3">
                      <Badge variant="success">{sub.status}</Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Billing cycle</div>
                    <div className="text-sm text-slate-200 mt-2">Start: {new Date(sub.currentPeriodStart).toLocaleDateString()}</div>
                    <div className="text-sm text-slate-200">End: {new Date(sub.currentPeriodEnd).toLocaleDateString()}</div>
                    {sub.trialEnd && (
                      <div className="mt-2 text-xs text-amber-300">Trial ends {new Date(sub.trialEnd).toLocaleDateString()}</div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</div>
                    <div className="text-sm text-slate-200 mt-2 truncate">{selectedAgent?.name}</div>
                    <div className="text-xs text-slate-400 truncate">{selectedAgent?.email}</div>
                    <div className="mt-3 text-[11px] text-slate-500">Stripe portal disabled without keys.</div>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Billing controls" description="Update plan overrides for this agent" hover={false}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-xs text-slate-400">
                  Billing mode
                  <select
                    value={billingMode}
                    onChange={(e) => setBillingMode(e.target.value as any)}
                    className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="FREE">FREE</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </label>

                {billingMode === 'CUSTOM' ? (
                  <label className="text-xs text-slate-400">
                    Custom monthly price (USD)
                    <input
                      value={customMonthly}
                      onChange={(e) => setCustomMonthly(e.target.value)}
                      placeholder="49.99"
                      inputMode="decimal"
                      className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                    />
                  </label>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400">
                    Use STANDARD to apply default pricing or FREE to bypass Stripe for this agent.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={saveBillingSettings} disabled={saving || subLoading || !selectedAgentId}>
                  {saving ? 'Saving…' : 'Save billing'}
                </Button>
                {sub?.billing?.stripeCustomerId && (
                  <span className="text-xs text-slate-500">Stripe customer linked</span>
                )}
                <Link to="/internal/support" className="text-xs text-cyan-200 hover:text-cyan-100">
                  Open support inbox
                </Link>
              </div>
            </Card>

            <Card title="Legal agreements" description="Manage legal links and review selected agent acceptance" hover={false}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-xs text-slate-400">
                  Terms URL
                  <input
                    value={termsUrlDraft}
                    onChange={(e) => setTermsUrlDraft(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Terms version
                  <input
                    value={termsVersionDraft}
                    onChange={(e) => setTermsVersionDraft(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Privacy URL
                  <input
                    value={privacyUrlDraft}
                    onChange={(e) => setPrivacyUrlDraft(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Privacy version
                  <input
                    value={privacyVersionDraft}
                    onChange={(e) => setPrivacyVersionDraft(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={saveLegalPolicies} disabled={savingPolicies}>
                  {savingPolicies ? 'Saving policies…' : 'Save legal policies'}
                </Button>
                {legalPolicies?.terms?.url ? (
                  <a href={legalPolicies.terms.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-200 hover:text-cyan-100">
                    Open terms
                  </a>
                ) : null}
                {legalPolicies?.privacy?.url ? (
                  <a href={legalPolicies.privacy.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-200 hover:text-cyan-100">
                    Open privacy
                  </a>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Selected Agent Acceptance</div>
                {sub?.legalAcceptance?.termsAcceptedAt || sub?.legalAcceptance?.privacyAcceptedAt ? (
                  <div className="space-y-1.5">
                    <div>
                      Terms accepted: {sub.legalAcceptance?.termsAcceptedAt ? new Date(sub.legalAcceptance.termsAcceptedAt).toLocaleString() : '—'} · v{sub.legalAcceptance?.termsVersionAccepted || '—'}
                    </div>
                    <div>
                      Privacy accepted: {sub.legalAcceptance?.privacyAcceptedAt ? new Date(sub.legalAcceptance.privacyAcceptedAt).toLocaleString() : '—'} · v{sub.legalAcceptance?.privacyVersionAccepted || '—'}
                    </div>
                    <div>IP: {sub.legalAcceptance?.legalAcceptedIp || '—'}</div>
                  </div>
                ) : (
                  <div className="text-slate-400">No acceptance record available yet for this account.</div>
                )}
              </div>
            </Card>

            <Card title="Stripe details" description="Identifiers used for portal access" hover={false}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Customer ID</div>
                  <div className="mt-2 text-sm text-white break-all">{sub?.billing?.stripeCustomerId || '—'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Subscription ID</div>
                  <div className="mt-2 text-sm text-white break-all">{sub?.billing?.stripeSubscriptionId || '—'}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Payment Method</div>
                  {paymentMethod?.card ? (
                    <div className="mt-2 text-sm text-white">
                      <div className="capitalize">{paymentMethod.card.brand} •••• {paymentMethod.card.last4}</div>
                      <div className="text-xs text-slate-400 mt-1">Exp {paymentMethod.card.expMonth}/{paymentMethod.card.expYear}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-400">No card on file.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Recent Invoices</div>
                  {invoices.length > 0 ? (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                      {invoices.slice(0, 6).map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="text-slate-200">{new Date(invoice.date).toLocaleDateString()}</div>
                            <div className="text-slate-500">{invoice.status}</div>
                          </div>
                          <div className="text-slate-100 font-medium">{formatAmount(invoice.amount)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-400">No invoices yet.</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
