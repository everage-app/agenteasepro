import { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

type InternalOverview = {
  totals: {
    agents: number;
    clients: number;
    deals: number;
    listings: number;
    tasks: number;
    marketingBlasts: number;
    signatureEnvelopes: number;
  };
};

type InternalUsage = {
  hours: number;
  events: number;
  pageViews: number;
  errors: number;
  activeAgents: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
};

type InternalSystem = {
  database: {
    counts: {
      agents: number;
      clients: number;
      deals: number;
      listings: number;
      supportTickets: number;
    };
    latencyMs: number;
  };
  process: {
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
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
    closedVolume30d: number;
    closedVolumePrev30d: number;
    closedDeals30d: number;
  };
};

type ModelInputs = {
  projectedUsers: number;
  monthlyGrowthPct: number;
  freePct: number;
  discountPct: number;
  standardPrice: number;
  discountedPrice: number;
  eventsPerUserPerDay: number;
  dataGbPerUser: number;
  peakTrafficPct: number;
  usersPerDyno: number;
  dynoRpsCapacity: number;
  dynoMonthlyCost: number;
  minDynos: number;
  dbBaseCost: number;
  dbCostPerGb: number;
  fixedAddonCost: number;
  eventCostPerMillion: number;
};

type Scenario = {
  users: number;
  billableUsers: number;
  freeUsers: number;
  discountedUsers: number;
  mrr: number;
  arr: number;
  eventsPerDay: number;
  peakRps: number;
  dynoCount: number;
  appCost: number;
  dbCost: number;
  addonsCost: number;
  totalCost: number;
  netProfit: number;
  marginPct: number;
  breakEvenUsers: number;
};

type PricingPresetKey = 'starter' | 'growth' | 'scale';

type HerokuPricingSnapshot = {
  scannedAt: string;
  source: string;
  dynos: Array<{ name: string; monthly: number }>;
  postgres: Array<{ name: string; monthly: number }>;
};

const HEROKU_PRICE_REF_FALLBACK: HerokuPricingSnapshot = {
  scannedAt: '2026-02-25T00:00:00.000Z',
  source: 'https://www.heroku.com/pricing',
  dynos: [
    { name: 'Eco', monthly: 5 },
    { name: 'Basic', monthly: 7 },
    { name: 'Standard-1X', monthly: 25 },
    { name: 'Standard-2X', monthly: 50 },
    { name: 'Performance-M', monthly: 250 },
    { name: 'Performance-L', monthly: 500 },
  ],
  postgres: [
    { name: 'Essential-0', monthly: 5 },
    { name: 'Standard-0', monthly: 50 },
  ],
};

const PRICING_PRESETS: Record<PricingPresetKey, { label: string; dynoMonthlyCost: number; dbBaseCost: number; fixedAddonCost: number; minDynos: number }> = {
  starter: {
    label: 'Starter (Eco/Basic + Essential DB)',
    dynoMonthlyCost: 7,
    dbBaseCost: 5,
    fixedAddonCost: 20,
    minDynos: 1,
  },
  growth: {
    label: 'Growth (Standard-1X + Standard-0 DB)',
    dynoMonthlyCost: 25,
    dbBaseCost: 50,
    fixedAddonCost: 35,
    minDynos: 2,
  },
  scale: {
    label: 'Scale (Performance-M + Standard-0 DB)',
    dynoMonthlyCost: 250,
    dbBaseCost: 50,
    fixedAddonCost: 80,
    minDynos: 2,
  },
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNum(value: string, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

function calculateScenario(inputs: ModelInputs, users: number): Scenario {
  const projectedUsers = Math.max(0, users);
  const freeUsers = projectedUsers * (inputs.freePct / 100);
  const billableUsers = Math.max(0, projectedUsers - freeUsers);
  const discountedUsers = billableUsers * (inputs.discountPct / 100);
  const standardUsers = Math.max(0, billableUsers - discountedUsers);

  const mrr = standardUsers * inputs.standardPrice + discountedUsers * inputs.discountedPrice;
  const arr = mrr * 12;

  const eventsPerDay = projectedUsers * inputs.eventsPerUserPerDay;
  const peakRps = (eventsPerDay * (inputs.peakTrafficPct / 100)) / 86400;

  const dynosByUsers = Math.ceil(projectedUsers / Math.max(1, inputs.usersPerDyno));
  const dynosByRps = Math.ceil(peakRps / Math.max(0.1, inputs.dynoRpsCapacity));
  const dynoCount = Math.max(inputs.minDynos, dynosByUsers, dynosByRps);

  const appCost = dynoCount * inputs.dynoMonthlyCost;
  const dbStorageGb = projectedUsers * inputs.dataGbPerUser;
  const dbCost = inputs.dbBaseCost + dbStorageGb * inputs.dbCostPerGb;
  const addonsCost = inputs.fixedAddonCost + (eventsPerDay / 1_000_000) * inputs.eventCostPerMillion * 30;
  const totalCost = appCost + dbCost + addonsCost;

  const netProfit = mrr - totalCost;
  const marginPct = mrr > 0 ? (netProfit / mrr) * 100 : 0;

  let breakEvenUsers = 0;
  for (let i = 1; i <= 150000; i += 1) {
    const test = calculateScenarioCore(inputs, i);
    if (test.netProfit >= 0) {
      breakEvenUsers = i;
      break;
    }
  }

  return {
    users: projectedUsers,
    billableUsers,
    freeUsers,
    discountedUsers,
    mrr,
    arr,
    eventsPerDay,
    peakRps,
    dynoCount,
    appCost,
    dbCost,
    addonsCost,
    totalCost,
    netProfit,
    marginPct,
    breakEvenUsers,
  };
}

function calculateScenarioCore(inputs: ModelInputs, users: number) {
  const projectedUsers = Math.max(0, users);
  const freeUsers = projectedUsers * (inputs.freePct / 100);
  const billableUsers = Math.max(0, projectedUsers - freeUsers);
  const discountedUsers = billableUsers * (inputs.discountPct / 100);
  const standardUsers = Math.max(0, billableUsers - discountedUsers);
  const mrr = standardUsers * inputs.standardPrice + discountedUsers * inputs.discountedPrice;
  const eventsPerDay = projectedUsers * inputs.eventsPerUserPerDay;
  const peakRps = (eventsPerDay * (inputs.peakTrafficPct / 100)) / 86400;
  const dynosByUsers = Math.ceil(projectedUsers / Math.max(1, inputs.usersPerDyno));
  const dynosByRps = Math.ceil(peakRps / Math.max(0.1, inputs.dynoRpsCapacity));
  const dynoCount = Math.max(inputs.minDynos, dynosByUsers, dynosByRps);
  const appCost = dynoCount * inputs.dynoMonthlyCost;
  const dbStorageGb = projectedUsers * inputs.dataGbPerUser;
  const dbCost = inputs.dbBaseCost + dbStorageGb * inputs.dbCostPerGb;
  const addonsCost = inputs.fixedAddonCost + (eventsPerDay / 1_000_000) * inputs.eventCostPerMillion * 30;
  const totalCost = appCost + dbCost + addonsCost;
  const netProfit = mrr - totalCost;
  return { netProfit };
}

export function InternalCalculationsPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<InternalOverview | null>(null);
  const [usage, setUsage] = useState<InternalUsage | null>(null);
  const [system, setSystem] = useState<InternalSystem | null>(null);
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [pricingPreset, setPricingPreset] = useState<PricingPresetKey>('growth');
  const [herokuPricing, setHerokuPricing] = useState<HerokuPricingSnapshot>(HEROKU_PRICE_REF_FALLBACK);
  const [pricingRefreshLoading, setPricingRefreshLoading] = useState(false);

  const [inputs, setInputs] = useState<ModelInputs>({
    projectedUsers: 500,
    monthlyGrowthPct: 12,
    freePct: 8,
    discountPct: 12,
    standardPrice: 49.99,
    discountedPrice: 34.99,
    eventsPerUserPerDay: 220,
    dataGbPerUser: 0.04,
    peakTrafficPct: 22,
    usersPerDyno: 280,
    dynoRpsCapacity: 22,
    dynoMonthlyCost: 25,
    minDynos: 2,
    dbBaseCost: 50,
    dbCostPerGb: 0.1,
    fixedAddonCost: 35,
    eventCostPerMillion: 4,
  });

  const applyPricingPreset = (preset: PricingPresetKey) => {
    const config = PRICING_PRESETS[preset];
    setPricingPreset(preset);
    setInputs((prev) => ({
      ...prev,
      dynoMonthlyCost: config.dynoMonthlyCost,
      dbBaseCost: config.dbBaseCost,
      fixedAddonCost: config.fixedAddonCost,
      minDynos: config.minDynos,
    }));
  };

  const refreshHerokuPricing = async () => {
    setPricingRefreshLoading(true);
    try {
      const res = await api.get('/internal/calculations/heroku-pricing');
      const snapshot = res.data as HerokuPricingSnapshot;
      if (snapshot?.dynos?.length || snapshot?.postgres?.length) {
        setHerokuPricing(snapshot);
      }
    } catch {
    } finally {
      setPricingRefreshLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [overviewRes, usageRes, systemRes, billingRes] = await Promise.all([
          api.get('/internal/overview'),
          api.get('/internal/usage', { params: { hours: 720 } }),
          api.get('/internal/system'),
          api.get('/internal/billing/overview'),
        ]);

        if (cancelled) return;

        setOverview(overviewRes.data ?? null);
        setUsage(usageRes.data ?? null);
        setSystem(systemRes.data ?? null);
        setBilling(billingRes.data ?? null);

        try {
          const pricingRes = await api.get('/internal/calculations/heroku-pricing');
          if (!cancelled && pricingRes.data) {
            setHerokuPricing(pricingRes.data);
          }
        } catch {
        }

        const activeUsers = Math.max(1, usageRes.data?.activeAgents?.last30d || billingRes.data?.totals?.totalAgents || 100);
        const baselineEvents = Math.max(1, usageRes.data?.events || activeUsers * 1000);
        const eventsPerUserPerDay = clamp(baselineEvents / 30 / activeUsers, 20, 2000);
        const avgPrice = billingRes.data?.pricing?.defaultMonthlyPrice || 49.99;

        setInputs((prev) => ({
          ...prev,
          projectedUsers: Math.max(prev.projectedUsers, Math.ceil((billingRes.data?.totals?.totalAgents || activeUsers) * 1.5)),
          standardPrice: avgPrice,
          discountedPrice: Number((avgPrice * 0.72).toFixed(2)),
          eventsPerUserPerDay: Number(eventsPerUserPerDay.toFixed(1)),
          usersPerDyno: clamp(Math.round((usageRes.data?.activeAgents?.last30d || 250) * 1.25), 100, 1200),
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scenario = useMemo(() => calculateScenario(inputs, inputs.projectedUsers), [inputs]);

  const months = useMemo(() => {
    const rows: Array<{ month: string; users: number; revenue: number; cost: number; profit: number; isActual: boolean }> = [];
    const now = new Date();
    const currentUsers = Math.max(1, billing?.totals?.totalAgents || usage?.activeAgents?.last30d || inputs.projectedUsers);

    for (let i = 0; i < 12; i += 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const isActual = i === 0;
      const factor = Math.pow(1 + inputs.monthlyGrowthPct / 100, Math.max(0, i - 1));
      const users = isActual
        ? Math.max(1, Math.round(currentUsers))
        : Math.max(1, Math.round(inputs.projectedUsers * factor));
      const row = calculateScenario(inputs, users);
      rows.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        users,
        revenue: row.mrr,
        cost: row.totalCost,
        profit: row.netProfit,
        isActual,
      });
    }

    return rows;
  }, [inputs, billing?.totals?.totalAgents, usage?.activeAgents?.last30d]);

  const maxChartValue = useMemo(() => {
    const max = Math.max(
      1,
      ...months.map((m) => Math.max(m.revenue, m.cost, Math.abs(m.profit))),
    );
    return max;
  }, [months]);

  const projectedAnnualRevenue = months.reduce((sum, row) => sum + row.revenue, 0);
  const projectedAnnualCost = months.reduce((sum, row) => sum + row.cost, 0);
  const projectedAnnualProfit = projectedAnnualRevenue - projectedAnnualCost;

  const pricingScore = useMemo(() => {
    if (scenario.marginPct >= 55) return { label: 'Excellent fit', tone: 'success' as const };
    if (scenario.marginPct >= 35) return { label: 'Healthy fit', tone: 'info' as const };
    if (scenario.marginPct >= 20) return { label: 'Watch closely', tone: 'warning' as const };
    return { label: 'Needs repricing', tone: 'danger' as const };
  }, [scenario.marginPct]);

  if (loading) {
    return (
      <PageLayout title="Calculations" subtitle="Capacity, pricing, and revenue projections" maxWidth="full">
        <div className="flex items-center justify-center min-h-[340px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Calculations"
      subtitle="Model users, load, cost, and pricing confidence with live internal baselines."
      maxWidth="full"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <MetricCard label="Current agents" value={(billing?.totals?.totalAgents || overview?.totals?.agents || 0).toLocaleString()} tone="info" />
          <MetricCard label="Billable now" value={(billing?.totals?.billableSubscribers || 0).toLocaleString()} tone="success" />
          <MetricCard label="30d events" value={(usage?.events || 0).toLocaleString()} tone="default" />
          <MetricCard label="DB latency" value={`${system?.database?.latencyMs || 0}ms`} tone="default" />
          <MetricCard label="Current MRR" value={usd.format(billing?.pricing?.estimatedMrr || 0)} tone="success" />
          <MetricCard label="Closed volume (30d)" value={usd.format(billing?.revenue?.closedVolume30d || 0)} tone="info" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-4">
            <Card title="Model Inputs" description="Tune assumptions for growth, load, and Heroku cost" hover={false}>
              <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                <div className="text-[11px] uppercase tracking-wider text-cyan-300">Heroku Pricing Profile</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(PRICING_PRESETS) as PricingPresetKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => applyPricingPreset(key)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        pricingPreset === key
                          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                          : 'border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {PRICING_PRESETS[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <NumberField label="Projected users" value={inputs.projectedUsers} onChange={(v) => setInputs((p) => ({ ...p, projectedUsers: Math.max(1, Math.round(v)) }))} />
                <NumberField label="Monthly growth %" value={inputs.monthlyGrowthPct} onChange={(v) => setInputs((p) => ({ ...p, monthlyGrowthPct: clamp(v, 0, 200) }))} />
                <NumberField label="Free users %" value={inputs.freePct} onChange={(v) => setInputs((p) => ({ ...p, freePct: clamp(v, 0, 100) }))} />
                <NumberField label="Discounted users %" value={inputs.discountPct} onChange={(v) => setInputs((p) => ({ ...p, discountPct: clamp(v, 0, 100) }))} />
                <NumberField label="Standard price ($/mo)" value={inputs.standardPrice} onChange={(v) => setInputs((p) => ({ ...p, standardPrice: clamp(v, 1, 1000) }))} />
                <NumberField label="Discounted price ($/mo)" value={inputs.discountedPrice} onChange={(v) => setInputs((p) => ({ ...p, discountedPrice: clamp(v, 0, 1000) }))} />
                <NumberField label="Events per user/day" value={inputs.eventsPerUserPerDay} onChange={(v) => setInputs((p) => ({ ...p, eventsPerUserPerDay: clamp(v, 1, 10000) }))} />
                <NumberField label="Data per user (GB)" value={inputs.dataGbPerUser} onChange={(v) => setInputs((p) => ({ ...p, dataGbPerUser: clamp(v, 0.001, 20) }))} />
                <NumberField label="Peak traffic % of daily" value={inputs.peakTrafficPct} onChange={(v) => setInputs((p) => ({ ...p, peakTrafficPct: clamp(v, 1, 100) }))} />
                <NumberField label="Users per dyno" value={inputs.usersPerDyno} onChange={(v) => setInputs((p) => ({ ...p, usersPerDyno: clamp(Math.round(v), 10, 50000) }))} />
                <NumberField label="Dyno RPS capacity" value={inputs.dynoRpsCapacity} onChange={(v) => setInputs((p) => ({ ...p, dynoRpsCapacity: clamp(v, 0.1, 1000) }))} />
                <NumberField label="Dyno monthly cost ($)" value={inputs.dynoMonthlyCost} onChange={(v) => setInputs((p) => ({ ...p, dynoMonthlyCost: clamp(v, 1, 5000) }))} />
                <NumberField label="Minimum dynos" value={inputs.minDynos} onChange={(v) => setInputs((p) => ({ ...p, minDynos: clamp(Math.round(v), 1, 200) }))} />
                <NumberField label="DB base cost ($/mo)" value={inputs.dbBaseCost} onChange={(v) => setInputs((p) => ({ ...p, dbBaseCost: clamp(v, 0, 5000) }))} />
                <NumberField label="DB $ per GB" value={inputs.dbCostPerGb} onChange={(v) => setInputs((p) => ({ ...p, dbCostPerGb: clamp(v, 0, 200) }))} />
                <NumberField label="Fixed add-ons ($/mo)" value={inputs.fixedAddonCost} onChange={(v) => setInputs((p) => ({ ...p, fixedAddonCost: clamp(v, 0, 5000) }))} />
                <NumberField label="$ per 1M events" value={inputs.eventCostPerMillion} onChange={(v) => setInputs((p) => ({ ...p, eventCostPerMillion: clamp(v, 0, 500) }))} />
              </div>
            </Card>
          </div>

          <div className="xl:col-span-8 space-y-4">
            <Card title="Projection Summary" description="Revenue, cost, capacity, and pricing confidence" hover={false}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Projected MRR" value={usd.format(scenario.mrr)} tone="success" />
                <MetricCard label="Projected ARR" value={usd.format(scenario.arr)} tone="success" />
                <MetricCard label="Monthly cost" value={usd.format(scenario.totalCost)} tone="default" />
                <MetricCard label="Monthly net" value={usd.format(scenario.netProfit)} tone={scenario.netProfit >= 0 ? 'success' : 'danger'} />
                <MetricCard label="Gross margin" value={`${scenario.marginPct.toFixed(1)}%`} tone={scenario.marginPct >= 35 ? 'success' : scenario.marginPct >= 20 ? 'warning' : 'danger'} />
                <MetricCard label="Peak RPS" value={scenario.peakRps.toFixed(2)} tone="info" />
                <MetricCard label="Dynos needed" value={scenario.dynoCount.toString()} tone="info" />
                <MetricCard label="Break-even users" value={scenario.breakEvenUsers > 0 ? scenario.breakEvenUsers.toLocaleString() : 'N/A'} tone={scenario.breakEvenUsers > 0 ? 'info' : 'warning'} />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-3">
                <Badge variant={pricingScore.tone}>{pricingScore.label}</Badge>
                <span className="text-xs text-slate-300">
                  Billable users: {Math.round(scenario.billableUsers).toLocaleString()} · Free users: {Math.round(scenario.freeUsers).toLocaleString()} · Discounted: {Math.round(scenario.discountedUsers).toLocaleString()}
                </span>
              </div>
            </Card>

            <Card title="12-Month Revenue vs Cost" description="Forward projection with your current assumptions" hover={false}>
              <LineCompareChart data={months} maxValue={maxChartValue} />
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                  <div className="text-slate-400">Annual revenue</div>
                  <div className="text-emerald-300 font-semibold mt-1">{usd.format(projectedAnnualRevenue)}</div>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                  <div className="text-slate-400">Annual cost</div>
                  <div className="text-amber-300 font-semibold mt-1">{usd.format(projectedAnnualCost)}</div>
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
                  <div className="text-slate-400">Annual net</div>
                  <div className={`font-semibold mt-1 ${projectedAnnualProfit >= 0 ? 'text-cyan-200' : 'text-rose-300'}`}>{usd.format(projectedAnnualProfit)}</div>
                </div>
              </div>
            </Card>

            <Card title="Pricing & Capacity Analysis" description="How your pricing holds against load and infra costs" hover={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Revenue quality</div>
                  <div className="mt-2 text-slate-200">
                    Realized ARPU is <span className="font-semibold text-white">{usd.format(scenario.billableUsers > 0 ? scenario.mrr / scenario.billableUsers : 0)}</span> with free/discount mix applied.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Infra pressure</div>
                  <div className="mt-2 text-slate-200">
                    Estimated daily load is <span className="font-semibold text-white">{Math.round(scenario.eventsPerDay).toLocaleString()} events</span> and requires <span className="font-semibold text-white">{scenario.dynoCount} dynos</span> at peak safety limits.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Database trajectory</div>
                  <div className="mt-2 text-slate-200">
                    Storage-driven DB estimate contributes <span className="font-semibold text-white">{usd.format(scenario.dbCost)}</span>/mo under current growth assumptions.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Pricing viability</div>
                  <div className="mt-2 text-slate-200">
                    Current mix yields <span className="font-semibold text-white">{scenario.marginPct.toFixed(1)}%</span> gross margin. {scenario.marginPct >= 35 ? 'Pricing appears resilient for scale.' : 'Consider raising standard pricing, reducing discount share, or improving dyno efficiency.'}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Heroku Pricing Reference" description="Fetched snapshot used for calculator alignment" hover={false}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-xs text-slate-400">Last scanned: {new Date(herokuPricing.scannedAt).toLocaleString()}</div>
                <button
                  onClick={refreshHerokuPricing}
                  disabled={pricingRefreshLoading}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  {pricingRefreshLoading ? 'Refreshing…' : 'Refresh pricing snapshot'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Dynos (monthly)</div>
                  <div className="space-y-1.5">
                    {herokuPricing.dynos.map((plan) => (
                      <div key={plan.name} className="flex items-center justify-between text-slate-200">
                        <span>{plan.name}</span>
                        <span className="font-semibold">{usd.format(plan.monthly)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Postgres (monthly)</div>
                  <div className="space-y-1.5">
                    {herokuPricing.postgres.map((plan) => (
                      <div key={plan.name} className="flex items-center justify-between text-slate-200">
                        <span>{plan.name}</span>
                        <span className="font-semibold">{usd.format(plan.monthly)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] text-slate-500">
                    Source: {herokuPricing.source}. Verify before financial commitments.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const parsed = Number(next);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
        onBlur={() => {
          const trimmed = draft.trim();
          const parsed = Number(trimmed);
          if (!trimmed || !Number.isFinite(parsed)) {
            setDraft(String(value));
            return;
          }
          onChange(parsed);
          setDraft(String(parsed));
        }}
        inputMode="decimal"
        className="mt-1 w-full rounded-lg bg-slate-900/80 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
      />
    </label>
  );
}

function MetricCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'info' | 'success' | 'warning' | 'danger' }) {
  const toneClass: Record<string, string> = {
    default: 'text-white',
    info: 'text-cyan-200',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-rose-300',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass[tone]}`}>{value}</div>
    </div>
  );
}

function LineCompareChart({
  data,
  maxValue,
}: {
  data: Array<{ month: string; users: number; revenue: number; cost: number; profit: number; isActual: boolean }>;
  maxValue: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 900;
  const height = 230;
  const left = 30;
  const right = width - 20;
  const top = 16;
  const bottom = height - 26;

  const step = data.length > 1 ? (right - left) / (data.length - 1) : 0;

  const y = (value: number) => {
    const normalized = clamp(value / maxValue, 0, 1);
    return bottom - normalized * (bottom - top);
  };

  const line = (selector: (row: { revenue: number; cost: number; profit: number; isActual: boolean }) => number) =>
    data
      .map((row, index) => `${left + index * step},${y(selector(row))}`)
      .join(' ');

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? left + hoverIndex * step : null;

  return (
    <div className="w-full relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <defs>
          <pattern id="costProjectionDots" patternUnits="userSpaceOnUse" width="6" height="6">
            <circle cx="1.5" cy="1.5" r="1" fill="rgba(245,158,11,0.9)" />
          </pattern>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const yy = bottom - tick * (bottom - top);
          const label = usd.format(maxValue * tick);
          return (
            <g key={tick}>
              <line x1={left} y1={yy} x2={right} y2={yy} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
              <text x={left - 4} y={yy - 2} textAnchor="end" fontSize="10" fill="rgba(148,163,184,0.8)">
                {label}
              </text>
            </g>
          );
        })}

        {data.map((row, index) => {
          const barCenter = left + index * step;
          const barWidth = Math.max(10, step * 0.55);
          const barLeft = barCenter - barWidth / 2;
          const barTop = y(row.cost);
          const minVisibleHeight = 3;
          const barHeight = Math.max(minVisibleHeight, bottom - barTop);
          const isLast = index === data.length - 1;

          return (
            <g key={`cost-bar-${row.month}`}>
              <rect
                x={barLeft}
                y={bottom - barHeight}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={isLast ? 'url(#costProjectionDots)' : 'rgba(245,158,11,0.75)'}
                stroke={isLast ? 'rgba(245,158,11,0.95)' : 'rgba(245,158,11,0.2)'}
                strokeDasharray={isLast ? '4 3' : undefined}
              />
            </g>
          );
        })}

        <polyline points={line((row) => row.revenue)} fill="none" stroke="rgba(16,185,129,0.9)" strokeWidth="3" />
        <polyline points={line((row) => Math.max(0, row.profit))} fill="none" stroke="rgba(56,189,248,0.9)" strokeWidth="3" strokeDasharray="5 4" />

        {hovered && hoverX !== null && (
          <g pointerEvents="none">
            <line x1={hoverX} y1={top} x2={hoverX} y2={bottom} stroke="rgba(148,163,184,0.55)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hoverX} cy={y(hovered.revenue)} r="4" fill="rgba(16,185,129,1)" />
            <circle cx={hoverX} cy={y(hovered.cost)} r="4" fill="rgba(245,158,11,1)" />
            <circle cx={hoverX} cy={y(Math.max(0, hovered.profit))} r="4" fill="rgba(56,189,248,1)" />
          </g>
        )}

        {data.map((_, index) => {
          const center = left + index * step;
          const prev = index === 0 ? left : left + (index - 0.5) * step;
          const next = index === data.length - 1 ? right : left + (index + 0.5) * step;
          const widthHit = Math.max(12, next - prev);
          return (
            <rect
              key={`hover-zone-${index}`}
              x={center - widthHit / 2}
              y={top}
              width={widthHit}
              height={bottom - top}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
              onMouseMove={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
            />
          );
        })}

        {data.map((row, index) => {
          const x = left + index * step;
          return (
            <text key={row.month} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="rgba(148,163,184,0.9)">
              {row.month}
            </text>
          );
        })}
      </svg>

      {hovered && hoverX !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-white/15 bg-slate-950/95 px-3 py-2 text-[11px] shadow-[0_10px_26px_rgba(0,0,0,0.55)]"
          style={{
            left: `${Math.min(92, Math.max(8, (hoverX / width) * 100))}%`,
            top: 8,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-slate-200 font-semibold">{hovered.month} {hovered.isActual ? '(Actual)' : '(Projected)'}</div>
          <div className="mt-1 text-slate-300">Users: <span className="text-white font-semibold">{hovered.users.toLocaleString()}</span></div>
          <div className="text-emerald-300">Revenue: {usd.format(hovered.revenue)}</div>
          <div className="text-amber-300">Cost: {usd.format(hovered.cost)}</div>
          <div className={`${hovered.profit >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>Net: {usd.format(hovered.profit)}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Revenue</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" /> Cost (bars)</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-amber-400 bg-transparent" /> Final month cost (dotted projection)</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Profit (non-negative)</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> First month uses current actual user baseline</span>
      </div>
    </div>
  );
}
