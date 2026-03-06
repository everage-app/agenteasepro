import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout';
import api from '../../lib/api';

const REPORTING_MANUAL_OVERRIDES_KEY = 'aep.reporting.manual-overrides.v1';

interface LeadSource {
  source: string;
  leads: number;
  closed: number;
  conversionRate: number;
  volume?: number;
}

interface TeamMember {
  name: string;
  deals: number;
  volume: number;
  avatar: string | null;
  gci?: number;
}

interface ClosedDealRecord {
  title: string;
  closedDate: string;
  purchasePrice: number;
  commission: number;
  type: 'buyer' | 'seller' | 'dual';
}

interface WeeklyTrend {
  week: string;
  leads: number;
  deals: number;
  calls: number;
}

interface ReportingStats {
  agentActivity: {
    totalLeads: number;
    newLeadsThisWeek: number;
    activeClients: number;
    closedDealsThisMonth: number;
    totalClientsAllTime?: number;
    avgLeadsPerWeek?: number;
  };
  calls: {
    totalCalls: number;
    missedCalls: number;
    avgCallDuration: string;
    callsByDay: Array<{ day: string; count: number }>;
    connectRate?: number;
    callsToday?: number;
    callGoalToday?: number;
    totalNotes?: number;
    totalPopbys?: number;
    totalReferralsAsked?: number;
  };
  texts: {
    totalTexts: number;
    responseRate: number;
    avgResponseTime: string;
    sentToday?: number;
    receivedToday?: number;
  };
  appointments: {
    totalAppointments: number;
    upcoming: number;
    completed: number;
    noShows: number;
    showingsThisWeek?: number;
    listingApptThisWeek?: number;
  };
  deals: {
    activeDeals: number;
    underContract: number;
    closedThisMonth: number;
    avgDealValue: number;
    conversionRate: number;
    totalVolume?: number;
    pendingVolume?: number;
    avgDaysToClose?: number;
    buyerDeals?: number;
    sellerDeals?: number;
  };
  leadSources: {
    topSources: LeadSource[];
  };
  marketing: {
    totalCampaigns: number;
    sent: number;
    totalClicks: number;
    clickRate: number;
    openRate?: number;
    unsubscribeRate?: number;
    topCampaign?: string;
  };
  properties: {
    activeListings: number;
    soldThisMonth: number;
    avgDaysOnMarket: number;
    totalViews: number;
    pendingListings?: number;
    avgListPrice?: number;
    avgSalePrice?: number;
    listToSaleRatio?: number;
  };
  team?: {
    memberCount: number;
    activeAgents: number;
    totalClients: number;
    closedDeals: number;
    avgResponseRate: number;
    topAgent?: string;
    teamVolume?: number;
    leaderboard?: TeamMember[];
  };
  goals?: {
    monthlyDealGoal: number;
    monthlyDeals: number;
    monthlyVolumeGoal: number;
    monthlyVolume: number;
    weeklyCallGoal: number;
    weeklyCalls: number;
    weeklyLeadGoal: number;
    weeklyLeads: number;
  };
  trends?: {
    weeklyTrend: WeeklyTrend[];
    dealsChange: number;
    leadsChange: number;
    volumeChange: number;
    conversionChange: number;
  };
  clientHealth?: {
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    needsFollowUp: number;
    overdueFollowUps: number;
    avgDaysSinceContact: number;
  };
  financials?: {
    ytdGCI: number;
    projectedGCI: number;
    avgCommission: number;
    pendingCommission: number;
    commissionRate?: number;
    quarterlyGCI?: { q1: number; q2: number; q3: number; q4: number };
    monthlyGCI?: number[];
    totalDealsYTD?: number;
    avgDealPrice?: number;
    totalVolumeYTD?: number;
    estimatedSETax?: number;
    estimatedQuarterlyTax?: number;
    closedDealsList?: ClosedDealRecord[];
  };
}

interface ManualReportingOverrides {
  agentActivity?: Partial<ReportingStats['agentActivity']>;
  calls?: Partial<ReportingStats['calls']>;
  texts?: Partial<ReportingStats['texts']>;
  appointments?: Partial<ReportingStats['appointments']>;
  deals?: Partial<ReportingStats['deals']>;
  properties?: Partial<ReportingStats['properties']>;
  goals?: Partial<ReportingStats['goals']>;
  financials?: Partial<Omit<NonNullable<ReportingStats['financials']>, 'quarterlyGCI'>> & {
    quarterlyGCI?: { q1?: number; q2?: number; q3?: number; q4?: number };
  };
}

function loadManualOverrides(): ManualReportingOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(REPORTING_MANUAL_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ManualReportingOverrides;
  } catch {
    return {};
  }
}

function saveManualOverrides(overrides: ManualReportingOverrides) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REPORTING_MANUAL_OVERRIDES_KEY, JSON.stringify(overrides));
}

function clearManualOverrides() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REPORTING_MANUAL_OVERRIDES_KEY);
}

function applyManualOverrides(stats: ReportingStats, overrides: ManualReportingOverrides): ReportingStats {
  const nextFinancials = stats.financials
    ? {
        ...stats.financials,
        ...(overrides.financials || {}),
        quarterlyGCI: {
          ...(stats.financials.quarterlyGCI || { q1: 0, q2: 0, q3: 0, q4: 0 }),
          ...(overrides.financials?.quarterlyGCI || {}),
        },
      }
    : stats.financials;

  return {
    ...stats,
    agentActivity: { ...stats.agentActivity, ...(overrides.agentActivity || {}) },
    calls: { ...stats.calls, ...(overrides.calls || {}) },
    texts: { ...stats.texts, ...(overrides.texts || {}) },
    appointments: { ...stats.appointments, ...(overrides.appointments || {}) },
    deals: { ...stats.deals, ...(overrides.deals || {}) },
    properties: { ...stats.properties, ...(overrides.properties || {}) },
    goals: { ...(stats.goals || {}), ...(overrides.goals || {}) } as ReportingStats['goals'],
    financials: nextFinancials,
  };
}

export function ReportingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportingStats | null>(null);
  const [manualOverrides, setManualOverrides] = useState<ManualReportingOverrides>({});
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [editorDraft, setEditorDraft] = useState<ManualReportingOverrides>({});
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [scope, setScope] = useState<'agent' | 'team'>('agent');
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'activity' | 'marketing' | 'financials' | 'team'>('overview');

  useEffect(() => {
    fetchReportingData();
  }, [timeRange]);

  const fetchReportingData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reporting/overview', {
        params: { timeRange },
      });
      const persistedOverrides = loadManualOverrides();
      setManualOverrides(persistedOverrides);
      setStats(applyManualOverrides(response.data as ReportingStats, persistedOverrides));
    } catch (error) {
      console.error('Error fetching reporting data:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const exportReport = () => {
    if (!stats) return;
    const rows = [
      ['AgentEase Pro Report', new Date().toLocaleDateString()],
      [''],
      ['AGENT ACTIVITY'],
      ['Total Leads', stats.agentActivity.totalLeads],
      ['New Leads (week)', stats.agentActivity.newLeadsThisWeek],
      ['Active Clients', stats.agentActivity.activeClients],
      ['Closed Deals (month)', stats.agentActivity.closedDealsThisMonth],
      [''],
      ['COMMUNICATIONS'],
      ['Total Calls', stats.calls.totalCalls],
      ['Missed Calls', stats.calls.missedCalls],
      ['Avg Call Duration', stats.calls.avgCallDuration],
      ['Total Texts', stats.texts.totalTexts],
      ['Text Response Rate', `${stats.texts.responseRate}%`],
      [''],
      ['DEALS'],
      ['Active Deals', stats.deals.activeDeals],
      ['Under Contract', stats.deals.underContract],
      ['Closed This Month', stats.deals.closedThisMonth],
      ['Avg Deal Value', formatCurrency(stats.deals.avgDealValue)],
      ['Total Volume', formatCurrency(stats.deals.totalVolume || 0)],
      ['Conversion Rate', `${stats.deals.conversionRate}%`],
      [''],
      ['PROPERTIES'],
      ['Active Listings', stats.properties.activeListings],
      ['Sold This Month', stats.properties.soldThisMonth],
      ['Avg Days on Market', stats.properties.avgDaysOnMarket],
      [''],
      ['FINANCIALS / TAX DATA'],
      ['YTD Gross Commission Income', stats.financials?.ytdGCI || 0],
      ['Projected Annual GCI', stats.financials?.projectedGCI || 0],
      ['Avg Commission per Deal', stats.financials?.avgCommission || 0],
      ['Pending Commission', stats.financials?.pendingCommission || 0],
      ['Commission Rate', `${stats.financials?.commissionRate || 2.5}%`],
      ['Total Volume YTD', stats.financials?.totalVolumeYTD || 0],
      ['Deals Closed YTD', stats.financials?.totalDealsYTD || 0],
      ['Est. Self-Employment Tax', stats.financials?.estimatedSETax || 0],
      ['Est. Quarterly Tax Payment', stats.financials?.estimatedQuarterlyTax || 0],
      ['Q1 GCI', stats.financials?.quarterlyGCI?.q1 || 0],
      ['Q2 GCI', stats.financials?.quarterlyGCI?.q2 || 0],
      ['Q3 GCI', stats.financials?.quarterlyGCI?.q3 || 0],
      ['Q4 GCI', stats.financials?.quarterlyGCI?.q4 || 0],
    ];
    // Append per-deal details
    if (stats.financials?.closedDealsList?.length) {
      rows.push([''], ['CLOSED DEALS DETAIL']);
      rows.push(['Property', 'Closed Date', 'Type', 'Sale Price', 'Commission']);
      for (const d of stats.financials.closedDealsList) {
        rows.push([d.title, d.closedDate, d.type, d.purchasePrice, d.commission] as any);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agentease-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const insights = useMemo(() => {
    if (!stats) return [];
    const lines: { text: string; type: 'success' | 'warning' | 'info' }[] = [];
    
    if (stats.deals.conversionRate >= 20) {
      lines.push({ text: '🏆 Outstanding conversion rate! You\'re closing deals above industry average.', type: 'success' });
    } else if (stats.deals.conversionRate < 15) {
      lines.push({ text: '📞 Your conversion rate could improve. Focus on follow-up within 5 minutes of lead contact.', type: 'warning' });
    }
    
    if (stats.texts.responseRate >= 85) {
      lines.push({ text: '⚡ Excellent response rate! Clients appreciate your quick communication.', type: 'success' });
    } else if (stats.texts.responseRate < 70) {
      lines.push({ text: '💬 Response rate is below target. Try setting up automated first-touch messages.', type: 'warning' });
    }
    
    if (stats.goals && stats.goals.monthlyDeals >= stats.goals.monthlyDealGoal * 0.8) {
      lines.push({ text: `🎯 You're at ${Math.round((stats.goals.monthlyDeals / stats.goals.monthlyDealGoal) * 100)}% of your monthly deal goal!`, type: 'success' });
    }
    
    if (stats.appointments.noShows > 2) {
      lines.push({ text: '📅 Multiple no-shows detected. Send confirmation texts 2 hours before appointments.', type: 'warning' });
    }
    
    if (stats.properties.avgDaysOnMarket < 30) {
      lines.push({ text: '🏠 Your listings sell faster than market average. Great pricing strategy!', type: 'success' });
    }
    
    if (stats.clientHealth && stats.clientHealth.overdueFollowUps > 0) {
      lines.push({ text: `⏰ ${stats.clientHealth.overdueFollowUps} clients need immediate follow-up.`, type: 'warning' });
    }
    
    if (lines.length === 0) {
      lines.push({ text: '📊 Keep up the momentum! Your metrics are solid across the board.', type: 'info' });
    }
    
    return lines;
  }, [stats]);

  const hasManualOverrides = useMemo(() => {
    const values = Object.values(manualOverrides || {});
    if (values.length === 0) return false;
    return values.some((section) => section && Object.keys(section as Record<string, unknown>).length > 0);
  }, [manualOverrides]);

  const openManualEditor = () => {
    const persistedOverrides = loadManualOverrides();
    setEditorDraft(persistedOverrides);
    setShowManualEditor(true);
  };

  const updateDraftNumber = (section: keyof ManualReportingOverrides, key: string, value: number) => {
    setEditorDraft((prev) => ({
      ...prev,
      [section]: {
        ...((prev[section] as Record<string, unknown>) || {}),
        [key]: value,
      },
    }));
  };

  const updateDraftQuarterly = (quarter: 'q1' | 'q2' | 'q3' | 'q4', value: number) => {
    setEditorDraft((prev) => ({
      ...prev,
      financials: {
        ...(prev.financials || {}),
        quarterlyGCI: {
          ...(prev.financials?.quarterlyGCI || {}),
          [quarter]: value,
        },
      },
    }));
  };

  const saveManualEdits = () => {
    saveManualOverrides(editorDraft);
    setManualOverrides(editorDraft);
    setStats((prev) => (prev ? applyManualOverrides(prev, editorDraft) : prev));
    setShowManualEditor(false);
  };

  const resetManualEdits = () => {
    clearManualOverrides();
    setManualOverrides({});
    setShowManualEditor(false);
    fetchReportingData();
  };

  if (loading) {
    return (
      <PageLayout title="Reporting & Analytics" subtitle="Loading your insights...">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="mt-4 text-slate-400">Crunching your numbers...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!stats) {
    return (
      <PageLayout title="Reporting & Analytics" subtitle="No data available">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Unable to load reporting data</h3>
            <p className="text-slate-400 mb-6">There was an issue fetching your analytics. Please try again.</p>
            <button
              onClick={fetchReportingData}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/25"
            >
              Retry
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const hasTeam = stats.team && stats.team.memberCount > 1;

  // Calculate health scores
  const performanceScore = Math.min(100, Math.round(
    (stats.deals.conversionRate * 2) + 
    (stats.texts.responseRate * 0.3) + 
    (Math.min(100, (stats.deals.closedThisMonth / 10) * 100) * 0.3)
  ));

  const pipelineHealth = Math.min(100, Math.round(
    ((stats.deals.underContract / Math.max(1, stats.deals.activeDeals + stats.deals.underContract)) * 100 * 0.5) +
    (stats.deals.conversionRate * 2 * 0.5)
  ));

  return (
    <PageLayout
      title="Reporting & Analytics"
      subtitle="Real-time insights to grow your business"
      maxWidth="full"
    >
      {/* Hero Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <HeroStat
          label="Total Volume"
          value={formatCurrency(stats.deals.totalVolume || stats.deals.avgDealValue * stats.deals.closedThisMonth)}
          trend={stats.trends?.volumeChange}
          icon="💰"
          color="emerald"
        />
        <HeroStat
          label="Deals Closed"
          value={stats.deals.closedThisMonth.toString()}
          subValue={`of ${stats.goals?.monthlyDealGoal || 10} goal`}
          trend={stats.trends?.dealsChange}
          icon="🏆"
          color="blue"
        />
        <HeroStat
          label="Active Pipeline"
          value={(stats.deals.activeDeals + stats.deals.underContract).toString()}
          subValue={`${stats.deals.underContract} under contract`}
          icon="📊"
          color="purple"
        />
        <HeroStat
          label="Conversion Rate"
          value={`${stats.deals.conversionRate}%`}
          trend={stats.trends?.conversionChange}
          icon="🎯"
          color="amber"
        />
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: '📈' },
            { id: 'pipeline', label: 'Pipeline', icon: '💼' },
            { id: 'activity', label: 'Activity', icon: '📞' },
            { id: 'marketing', label: 'Marketing', icon: '📣' },
            { id: 'financials', label: 'Financials', icon: '💰' },
            { id: 'team', label: 'Team', icon: '👥' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-700/60'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Time & Scope Controls */}
        <div className="flex items-center gap-3">
          {hasTeam && (
            <div className="inline-flex rounded-xl bg-slate-800/80 border border-slate-700/60 p-1">
              <button
                onClick={() => setScope('agent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  scope === 'agent' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                My Stats
              </button>
              <button
                onClick={() => setScope('team')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  scope === 'team' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                Team
              </button>
            </div>
          )}
          
          <div className="inline-flex rounded-xl bg-slate-800/80 border border-slate-700/60 p-1">
            {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  timeRange === range ? 'bg-slate-700 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={openManualEditor}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              hasManualOverrides
                ? 'bg-purple-600/30 border-purple-500/60 text-purple-200 hover:bg-purple-600/40'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:text-white hover:border-slate-600'
            }`}
            title="Add or edit reporting fields manually"
          >
            ✍️ Manual Edit
          </button>

          {hasManualOverrides && (
            <button
              onClick={resetManualEdits}
              className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
              title="Clear manual edits"
            >
              Reset Edits
            </button>
          )}

          <button
            onClick={exportReport}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-600 transition-all"
            title="Export Report"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {showManualEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80" onClick={() => setShowManualEditor(false)} />
          <div className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-white">Manual Reporting Editor</h3>
                <p className="text-xs text-slate-400">Clean, simple override controls for your reporting fields.</p>
              </div>
              <button
                onClick={() => setShowManualEditor(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-cyan-200">Agent Activity</div>
                  <ManualNumberField label="Total Leads" value={editorDraft.agentActivity?.totalLeads} onChange={(v) => updateDraftNumber('agentActivity', 'totalLeads', v)} />
                  <ManualNumberField label="New Leads (Week)" value={editorDraft.agentActivity?.newLeadsThisWeek} onChange={(v) => updateDraftNumber('agentActivity', 'newLeadsThisWeek', v)} />
                  <ManualNumberField label="Active Clients" value={editorDraft.agentActivity?.activeClients} onChange={(v) => updateDraftNumber('agentActivity', 'activeClients', v)} />
                  <ManualNumberField label="Closed Deals (Month)" value={editorDraft.agentActivity?.closedDealsThisMonth} onChange={(v) => updateDraftNumber('agentActivity', 'closedDealsThisMonth', v)} />
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-blue-200">Deals & Pipeline</div>
                  <ManualNumberField label="Active Deals" value={editorDraft.deals?.activeDeals} onChange={(v) => updateDraftNumber('deals', 'activeDeals', v)} />
                  <ManualNumberField label="Under Contract" value={editorDraft.deals?.underContract} onChange={(v) => updateDraftNumber('deals', 'underContract', v)} />
                  <ManualNumberField label="Closed This Month" value={editorDraft.deals?.closedThisMonth} onChange={(v) => updateDraftNumber('deals', 'closedThisMonth', v)} />
                  <ManualNumberField label="Conversion Rate %" value={editorDraft.deals?.conversionRate} onChange={(v) => updateDraftNumber('deals', 'conversionRate', v)} />
                  <ManualNumberField label="Avg Deal Value" value={editorDraft.deals?.avgDealValue} onChange={(v) => updateDraftNumber('deals', 'avgDealValue', v)} />
                  <ManualNumberField label="Total Volume" value={editorDraft.deals?.totalVolume} onChange={(v) => updateDraftNumber('deals', 'totalVolume', v)} />
                  <ManualNumberField label="Pending Volume" value={editorDraft.deals?.pendingVolume} onChange={(v) => updateDraftNumber('deals', 'pendingVolume', v)} />
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-emerald-200">Comms & Appointments</div>
                  <ManualNumberField label="Total Calls" value={editorDraft.calls?.totalCalls} onChange={(v) => updateDraftNumber('calls', 'totalCalls', v)} />
                  <ManualNumberField label="Calls Today" value={editorDraft.calls?.callsToday} onChange={(v) => updateDraftNumber('calls', 'callsToday', v)} />
                  <ManualNumberField label="Call Goal Today" value={editorDraft.calls?.callGoalToday} onChange={(v) => updateDraftNumber('calls', 'callGoalToday', v)} />
                  <ManualNumberField label="Total Texts" value={editorDraft.texts?.totalTexts} onChange={(v) => updateDraftNumber('texts', 'totalTexts', v)} />
                  <ManualNumberField label="Text Response %" value={editorDraft.texts?.responseRate} onChange={(v) => updateDraftNumber('texts', 'responseRate', v)} />
                  <ManualNumberField label="Appointments Total" value={editorDraft.appointments?.totalAppointments} onChange={(v) => updateDraftNumber('appointments', 'totalAppointments', v)} />
                  <ManualNumberField label="Upcoming" value={editorDraft.appointments?.upcoming} onChange={(v) => updateDraftNumber('appointments', 'upcoming', v)} />
                  <ManualNumberField label="Completed" value={editorDraft.appointments?.completed} onChange={(v) => updateDraftNumber('appointments', 'completed', v)} />
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-amber-200">Properties</div>
                  <ManualNumberField label="Active Listings" value={editorDraft.properties?.activeListings} onChange={(v) => updateDraftNumber('properties', 'activeListings', v)} />
                  <ManualNumberField label="Sold This Month" value={editorDraft.properties?.soldThisMonth} onChange={(v) => updateDraftNumber('properties', 'soldThisMonth', v)} />
                  <ManualNumberField label="Total Views" value={editorDraft.properties?.totalViews} onChange={(v) => updateDraftNumber('properties', 'totalViews', v)} />
                  <ManualNumberField label="Avg DOM" value={editorDraft.properties?.avgDaysOnMarket} onChange={(v) => updateDraftNumber('properties', 'avgDaysOnMarket', v)} />
                  <ManualNumberField label="Avg List Price" value={editorDraft.properties?.avgListPrice} onChange={(v) => updateDraftNumber('properties', 'avgListPrice', v)} />
                  <ManualNumberField label="Avg Sale Price" value={editorDraft.properties?.avgSalePrice} onChange={(v) => updateDraftNumber('properties', 'avgSalePrice', v)} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-purple-200">Goals</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ManualNumberField label="Monthly Deal Goal" value={editorDraft.goals?.monthlyDealGoal} onChange={(v) => updateDraftNumber('goals', 'monthlyDealGoal', v)} />
                    <ManualNumberField label="Monthly Deals" value={editorDraft.goals?.monthlyDeals} onChange={(v) => updateDraftNumber('goals', 'monthlyDeals', v)} />
                    <ManualNumberField label="Monthly Volume Goal" value={editorDraft.goals?.monthlyVolumeGoal} onChange={(v) => updateDraftNumber('goals', 'monthlyVolumeGoal', v)} />
                    <ManualNumberField label="Monthly Volume" value={editorDraft.goals?.monthlyVolume} onChange={(v) => updateDraftNumber('goals', 'monthlyVolume', v)} />
                    <ManualNumberField label="Weekly Call Goal" value={editorDraft.goals?.weeklyCallGoal} onChange={(v) => updateDraftNumber('goals', 'weeklyCallGoal', v)} />
                    <ManualNumberField label="Weekly Calls" value={editorDraft.goals?.weeklyCalls} onChange={(v) => updateDraftNumber('goals', 'weeklyCalls', v)} />
                    <ManualNumberField label="Weekly Lead Goal" value={editorDraft.goals?.weeklyLeadGoal} onChange={(v) => updateDraftNumber('goals', 'weeklyLeadGoal', v)} />
                    <ManualNumberField label="Weekly Leads" value={editorDraft.goals?.weeklyLeads} onChange={(v) => updateDraftNumber('goals', 'weeklyLeads', v)} />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-emerald-200">Financials</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ManualNumberField label="YTD GCI" value={editorDraft.financials?.ytdGCI} onChange={(v) => updateDraftNumber('financials', 'ytdGCI', v)} />
                    <ManualNumberField label="Projected GCI" value={editorDraft.financials?.projectedGCI} onChange={(v) => updateDraftNumber('financials', 'projectedGCI', v)} />
                    <ManualNumberField label="Avg Commission" value={editorDraft.financials?.avgCommission} onChange={(v) => updateDraftNumber('financials', 'avgCommission', v)} />
                    <ManualNumberField label="Pending Commission" value={editorDraft.financials?.pendingCommission} onChange={(v) => updateDraftNumber('financials', 'pendingCommission', v)} />
                    <ManualNumberField label="Commission Rate %" value={editorDraft.financials?.commissionRate} onChange={(v) => updateDraftNumber('financials', 'commissionRate', v)} />
                    <ManualNumberField label="Deals YTD" value={editorDraft.financials?.totalDealsYTD} onChange={(v) => updateDraftNumber('financials', 'totalDealsYTD', v)} />
                    <ManualNumberField label="Volume YTD" value={editorDraft.financials?.totalVolumeYTD} onChange={(v) => updateDraftNumber('financials', 'totalVolumeYTD', v)} />
                    <ManualNumberField label="Est. SE Tax" value={editorDraft.financials?.estimatedSETax} onChange={(v) => updateDraftNumber('financials', 'estimatedSETax', v)} />
                    <ManualNumberField label="Est. Quarterly Tax" value={editorDraft.financials?.estimatedQuarterlyTax} onChange={(v) => updateDraftNumber('financials', 'estimatedQuarterlyTax', v)} />
                    <ManualNumberField label="Q1 GCI" value={editorDraft.financials?.quarterlyGCI?.q1} onChange={(v) => updateDraftQuarterly('q1', v)} />
                    <ManualNumberField label="Q2 GCI" value={editorDraft.financials?.quarterlyGCI?.q2} onChange={(v) => updateDraftQuarterly('q2', v)} />
                    <ManualNumberField label="Q3 GCI" value={editorDraft.financials?.quarterlyGCI?.q3} onChange={(v) => updateDraftQuarterly('q3', v)} />
                    <ManualNumberField label="Q4 GCI" value={editorDraft.financials?.quarterlyGCI?.q4} onChange={(v) => updateDraftQuarterly('q4', v)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/10 bg-slate-950/70">
              <div className="text-xs text-slate-400">Edits apply instantly after save and stay on this account/browser.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetManualEdits}
                  className="px-3 py-2 rounded-xl border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:text-white"
                >
                  Reset All
                </button>
                <button
                  onClick={saveManualEdits}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-600 hover:to-blue-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Banner */}
      {insights.length > 0 && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 border border-purple-500/40 shadow-lg shadow-purple-500/10">
          <div className="flex flex-wrap items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-2">AI Insights</h3>
              <div className="space-y-2">
                {insights.slice(0, 3).map((insight, idx) => (
                  <p key={idx} className={`text-sm ${
                    insight.type === 'success' ? 'text-emerald-300' :
                    insight.type === 'warning' ? 'text-amber-300' : 'text-slate-300'
                  }`}>
                    {insight.text}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                Set goals
              </button>
              <button
                onClick={() => navigate('/automations')}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                Open playbook
              </button>
              <button
                onClick={() => navigate('/leads')}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
              >
                View leads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Performance & Goals Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance Score Card */}
            <div className="lg:col-span-1 p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Performance Score</h3>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                    <circle 
                      cx="80" cy="80" r="70" fill="none" stroke="url(#scoreGradient)" strokeWidth="8"
                      strokeDasharray={`${performanceScore * 4.4} 440`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white">{performanceScore}</span>
                    <span className="text-xs text-slate-400">of 100</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-2xl font-bold text-cyan-300">{pipelineHealth}%</div>
                  <div className="text-xs text-slate-300">Pipeline Health</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-2xl font-bold text-emerald-300">{stats.texts.responseRate}%</div>
                  <div className="text-xs text-slate-300">Response Rate</div>
                </div>
              </div>
            </div>

            {/* Goals Progress */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Monthly Goals</h3>
              <div className="space-y-6">
                <GoalProgress
                  label="Deals Closed"
                  current={stats.goals?.monthlyDeals || stats.deals.closedThisMonth}
                  goal={stats.goals?.monthlyDealGoal || 10}
                  color="cyan"
                  icon="🏠"
                />
                <GoalProgress
                  label="Volume"
                  current={stats.goals?.monthlyVolume || stats.deals.totalVolume || 0}
                  goal={stats.goals?.monthlyVolumeGoal || 5000000}
                  format="currency"
                  color="emerald"
                  icon="💰"
                />
                <GoalProgress
                  label="Weekly Calls"
                  current={stats.goals?.weeklyCalls || stats.calls.totalCalls}
                  goal={stats.goals?.weeklyCallGoal || 75}
                  color="purple"
                  icon="📞"
                />
                <GoalProgress
                  label="New Leads"
                  current={stats.goals?.weeklyLeads || stats.agentActivity.newLeadsThisWeek}
                  goal={stats.goals?.weeklyLeadGoal || 20}
                  color="amber"
                  icon="👥"
                />
              </div>
            </div>
          </div>

          {/* Financials Summary */}
          {stats.financials && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-cyan-600/25 to-blue-600/30 border border-emerald-500/40 shadow-xl shadow-emerald-500/10">
              <h3 className="text-lg font-semibold text-white mb-4">💵 Financial Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-xs text-slate-300 mb-1">YTD GCI</div>
                  <div className="text-2xl font-bold text-emerald-300">{formatCurrency(stats.financials.ytdGCI)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-xs text-slate-300 mb-1">Projected Annual</div>
                  <div className="text-2xl font-bold text-cyan-300">{formatCurrency(stats.financials.projectedGCI)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-xs text-slate-300 mb-1">Avg Commission</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(stats.financials.avgCommission)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-xs text-slate-300 mb-1">Pending Commission</div>
                  <div className="text-2xl font-bold text-amber-300">{formatCurrency(stats.financials.pendingCommission)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Lead Sources Chart */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6">🎯 Lead Source Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.leadSources.topSources.map((source, idx) => (
                <div key={source.source} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/70 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📌'}
                      </span>
                      <span className="font-semibold text-white">{source.source}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      source.conversionRate >= 25 ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' :
                      source.conversionRate >= 15 ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' :
                      'bg-slate-600/50 text-slate-300 border border-slate-500/40'
                    }`}>
                      {source.conversionRate.toFixed(1)}% conv.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-white">{source.leads}</div>
                      <div className="text-[10px] text-slate-400">Leads</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-cyan-300">{source.closed}</div>
                      <div className="text-[10px] text-slate-400">Closed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-300">{source.volume ? formatCurrency(source.volume) : '—'}</div>
                      <div className="text-[10px] text-slate-400">Volume</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="space-y-8">
          {/* Pipeline Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Deal Pipeline</h3>
              <div className="space-y-4">
                <FunnelStage label="Total Leads" value={stats.agentActivity.totalLeads} color="slate" width={100} />
                <FunnelStage label="Active Clients" value={stats.agentActivity.activeClients} color="blue" width={70} />
                <FunnelStage label="Active Deals" value={stats.deals.activeDeals} color="purple" width={50} />
                <FunnelStage label="Under Contract" value={stats.deals.underContract} color="amber" width={35} />
                <FunnelStage label="Closed" value={stats.deals.closedThisMonth} color="emerald" width={25} />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Deal Breakdown</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Buyer Deals" value={stats.deals.buyerDeals || 0} icon="🏡" color="cyan" />
                <StatCard label="Seller Deals" value={stats.deals.sellerDeals || 0} icon="🔑" color="purple" />
                <StatCard label="Avg Days to Close" value={stats.deals.avgDaysToClose || '—'} icon="⏱️" color="amber" />
                <StatCard label="Pending Volume" value={formatCurrency(stats.deals.pendingVolume || 0)} icon="💵" color="emerald" />
              </div>
            </div>
          </div>

          {/* Client Health */}
          {stats.clientHealth && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Client Health</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Hot Leads 🔥" value={stats.clientHealth.hotLeads} color="red" small />
                <StatCard label="Warm Leads" value={stats.clientHealth.warmLeads} color="amber" small />
                <StatCard label="Cold Leads" value={stats.clientHealth.coldLeads} color="blue" small />
                <StatCard label="Needs Follow-up" value={stats.clientHealth.needsFollowUp} color="purple" small />
                <StatCard label="Overdue ⚠️" value={stats.clientHealth.overdueFollowUps} color="red" small alert={stats.clientHealth.overdueFollowUps > 0} />
                <StatCard label="Avg Days Since Contact" value={stats.clientHealth.avgDaysSinceContact} color="slate" small />
              </div>
            </div>
          )}

          {/* Properties */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6">Listings Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Active Listings" value={stats.properties.activeListings} icon="🏠" color="cyan" />
              <StatCard label="Pending" value={stats.properties.pendingListings || 0} icon="⏳" color="amber" />
              <StatCard label="Sold This Month" value={stats.properties.soldThisMonth} icon="✅" color="emerald" />
              <StatCard label="Total Views" value={formatNumber(stats.properties.totalViews)} icon="👁️" color="purple" />
              <StatCard label="Avg List Price" value={formatCurrency(stats.properties.avgListPrice || 0)} icon="💲" color="blue" />
              <StatCard label="Avg Sale Price" value={formatCurrency(stats.properties.avgSalePrice || 0)} icon="💰" color="emerald" />
              <StatCard label="Avg DOM" value={`${stats.properties.avgDaysOnMarket} days`} icon="📅" color="slate" />
              <StatCard label="List/Sale Ratio" value={`${stats.properties.listToSaleRatio || 98}%`} icon="📊" color="cyan" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-8">
          {/* Call Activity Chart */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">📞 Call Activity</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                  <span className="text-slate-400">{stats.calls.totalCalls} total calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-400">{stats.calls.connectRate || 72}% connect rate</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-end justify-between gap-3 h-48 mb-4">
              {stats.calls.callsByDay.map((day, index) => {
                const maxCalls = Math.max(...stats.calls.callsByDay.map(d => d.count), 1);
                const height = (day.count / maxCalls) * 100;
                const isToday = index === stats.calls.callsByDay.length - 1;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.count}
                    </div>
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          isToday 
                            ? 'bg-gradient-to-t from-cyan-500 to-blue-400 shadow-lg shadow-cyan-500/30' 
                            : 'bg-gradient-to-t from-slate-600 to-slate-500 group-hover:from-cyan-500/50 group-hover:to-blue-400/50'
                        }`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                    <div className={`text-xs font-medium ${isToday ? 'text-cyan-400' : 'text-slate-500'}`}>{day.day}</div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.calls.totalCalls}</div>
                <div className="text-xs text-slate-400">Total Calls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{stats.calls.missedCalls}</div>
                <div className="text-xs text-slate-400">Missed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{stats.calls.avgCallDuration}</div>
                <div className="text-xs text-slate-400">Avg Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{stats.calls.connectRate || 72}%</div>
                <div className="text-xs text-slate-400">Connect Rate</div>
              </div>
            </div>
          </div>

          {/* Communication Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">💬 Text Messages</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Messages" value={stats.texts.totalTexts} color="purple" />
                <StatCard label="Response Rate" value={`${stats.texts.responseRate}%`} color="emerald" highlight />
                <StatCard label="Sent Today" value={stats.texts.sentToday || 0} color="cyan" />
                <StatCard label="Received Today" value={stats.texts.receivedToday || 0} color="blue" />
                <StatCard label="Avg Response" value={stats.texts.avgResponseTime} color="amber" />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">📅 Appointments</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total" value={stats.appointments.totalAppointments} color="blue" />
                <StatCard label="Upcoming" value={stats.appointments.upcoming} color="cyan" highlight />
                <StatCard label="Completed" value={stats.appointments.completed} color="emerald" />
                <StatCard label="No-Shows" value={stats.appointments.noShows} color="red" alert={stats.appointments.noShows > 2} />
                <StatCard label="Showings This Week" value={stats.appointments.showingsThisWeek || 0} color="purple" />
                <StatCard label="Listing Appts" value={stats.appointments.listingApptThisWeek || 0} color="amber" />
              </div>
            </div>
          </div>

          {/* Daily Activity Tracking */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6">📋 Daily Activity Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Notes Sent" value={stats.calls.totalNotes || 0} icon="✉️" color="purple" />
              <StatCard label="Pop-bys Done" value={stats.calls.totalPopbys || 0} icon="🏃" color="emerald" />
              <StatCard label="Referrals Asked" value={stats.calls.totalReferralsAsked || 0} icon="🤝" color="cyan" />
              <StatCard label="Calls Made" value={stats.calls.totalCalls} icon="📞" color="blue" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'marketing' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">📧 Email Campaigns</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Campaigns" value={stats.marketing.totalCampaigns} color="purple" />
                <StatCard label="Sent" value={stats.marketing.sent} color="cyan" />
                <StatCard label="Open Rate" value={stats.marketing.openRate ? `${stats.marketing.openRate}%` : '—'} color="emerald" highlight />
                <StatCard label="Click Rate" value={`${stats.marketing.clickRate}%`} color="blue" />
                <StatCard label="Total Clicks" value={stats.marketing.totalClicks} color="amber" />
                <StatCard label="Unsubscribe Rate" value={stats.marketing.unsubscribeRate != null ? `${stats.marketing.unsubscribeRate}%` : '—'} color="slate" />
              </div>
              {stats.marketing.topCampaign && (
                <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-400 mb-1">Top Performing Campaign</div>
                  <div className="text-sm font-medium text-white truncate">{stats.marketing.topCampaign}</div>
                </div>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">🏠 Listing Marketing</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Active Listings" value={stats.properties.activeListings} color="cyan" />
                <StatCard label="Total Views" value={formatNumber(stats.properties.totalViews)} color="purple" highlight />
                <StatCard label="Avg Views/Listing" value={Math.round(stats.properties.totalViews / Math.max(1, stats.properties.activeListings))} color="blue" />
                <StatCard label="Leads Generated" value={(stats.properties as any).leadsGenerated ?? stats.agentActivity?.totalLeads ?? '—'} color="emerald" />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => navigate('/marketing')} className="p-4 rounded-xl bg-gradient-to-br from-purple-600/40 to-pink-600/40 border border-purple-500/50 hover:border-purple-400/70 transition-all group shadow-lg shadow-purple-500/20">
              <div className="text-2xl mb-2">📧</div>
              <div className="text-sm font-semibold text-white">Create Campaign</div>
              <div className="text-xs text-slate-300">Email blast</div>
            </button>
            <button onClick={() => navigate('/listings')} className="p-4 rounded-xl bg-gradient-to-br from-cyan-600/40 to-blue-600/40 border border-cyan-500/50 hover:border-cyan-400/70 transition-all group shadow-lg shadow-cyan-500/20">
              <div className="text-2xl mb-2">🏠</div>
              <div className="text-sm font-semibold text-white">New Listing</div>
              <div className="text-xs text-slate-300">Add property</div>
            </button>
            <button onClick={() => navigate('/clients')} className="p-4 rounded-xl bg-gradient-to-br from-emerald-600/40 to-teal-600/40 border border-emerald-500/50 hover:border-emerald-400/70 transition-all group shadow-lg shadow-emerald-500/20">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-sm font-semibold text-white">Import Leads</div>
              <div className="text-xs text-slate-300">Add contacts</div>
            </button>
            <button onClick={() => navigate('/settings')} className="p-4 rounded-xl bg-gradient-to-br from-amber-600/40 to-orange-600/40 border border-amber-500/50 hover:border-amber-400/70 transition-all group shadow-lg shadow-amber-500/20">
              <div className="text-2xl mb-2">⚡</div>
              <div className="text-sm font-semibold text-white">Automations</div>
              <div className="text-xs text-slate-300">Set up drips</div>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'financials' && stats.financials && (
        <div className="space-y-8">
          {/* GCI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600/40 to-emerald-900/60 border border-emerald-500/50 shadow-lg shadow-emerald-500/20">
              <div className="text-xs text-slate-300 font-medium mb-1">YTD Gross Commission</div>
              <div className="text-2xl md:text-3xl font-bold text-emerald-300">{formatCurrency(stats.financials.ytdGCI)}</div>
              <div className="text-xs text-slate-400 mt-1">{stats.financials.totalDealsYTD || 0} deals closed</div>
            </div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-600/40 to-cyan-900/60 border border-cyan-500/50 shadow-lg shadow-cyan-500/20">
              <div className="text-xs text-slate-300 font-medium mb-1">Projected Annual GCI</div>
              <div className="text-2xl md:text-3xl font-bold text-cyan-300">{formatCurrency(stats.financials.projectedGCI)}</div>
              <div className="text-xs text-slate-400 mt-1">Based on YTD pace</div>
            </div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-600/40 to-amber-900/60 border border-amber-500/50 shadow-lg shadow-amber-500/20">
              <div className="text-xs text-slate-300 font-medium mb-1">Pending Commission</div>
              <div className="text-2xl md:text-3xl font-bold text-amber-300">{formatCurrency(stats.financials.pendingCommission)}</div>
              <div className="text-xs text-slate-400 mt-1">{stats.deals.underContract} deals under contract</div>
            </div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-600/40 to-purple-900/60 border border-purple-500/50 shadow-lg shadow-purple-500/20">
              <div className="text-xs text-slate-300 font-medium mb-1">Avg Commission / Deal</div>
              <div className="text-2xl md:text-3xl font-bold text-purple-300">{formatCurrency(stats.financials.avgCommission)}</div>
              <div className="text-xs text-slate-400 mt-1">at {stats.financials.commissionRate || 2.5}% avg rate</div>
            </div>
          </div>

          {/* Tax Planning Section */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-red-600/25 via-orange-600/25 to-amber-600/25 border border-orange-500/40 shadow-xl shadow-orange-500/10">
            <h3 className="text-lg font-semibold text-white mb-2">🧾 Tax Planning Estimates</h3>
            <p className="text-xs text-slate-400 mb-4">Self-employed agent estimates — consult your CPA for personalized advice</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="text-xs text-slate-300 mb-1">1099 Reportable Income (YTD)</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(stats.financials.ytdGCI)}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="text-xs text-slate-300 mb-1">Estimated SE Tax (15.3%)</div>
                <div className="text-2xl font-bold text-red-400">{formatCurrency(stats.financials.estimatedSETax || 0)}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="text-xs text-slate-300 mb-1">Est. Quarterly Payment</div>
                <div className="text-2xl font-bold text-amber-300">{formatCurrency(stats.financials.estimatedQuarterlyTax || 0)}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="text-xs text-slate-300 mb-1">Total Volume (YTD)</div>
                <div className="text-2xl font-bold text-cyan-300">{formatCurrency(stats.financials.totalVolumeYTD || 0)}</div>
              </div>
            </div>
          </div>

          {/* Quarterly GCI Breakdown */}
          {stats.financials.quarterlyGCI && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">📊 Quarterly GCI Breakdown</h3>
              <div className="grid grid-cols-4 gap-4">
                {(['q1', 'q2', 'q3', 'q4'] as const).map((q, idx) => {
                  const val = stats.financials!.quarterlyGCI![q];
                  const max = Math.max(
                    stats.financials!.quarterlyGCI!.q1,
                    stats.financials!.quarterlyGCI!.q2,
                    stats.financials!.quarterlyGCI!.q3,
                    stats.financials!.quarterlyGCI!.q4,
                    1
                  );
                  const pct = Math.round((val / max) * 100);
                  const isCurrentQ = Math.floor(new Date().getMonth() / 3) === idx;
                  return (
                    <div key={q} className="text-center">
                      <div className="text-xs text-slate-400 mb-2">{q.toUpperCase()}</div>
                      <div className="h-32 flex items-end justify-center mb-2">
                        <div
                          className={`w-12 rounded-t-lg transition-all ${
                            isCurrentQ
                              ? 'bg-gradient-to-t from-cyan-500 to-blue-400 shadow-lg shadow-cyan-500/30'
                              : 'bg-gradient-to-t from-slate-600 to-slate-500'
                          }`}
                          style={{ height: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                      <div className={`text-sm font-bold ${isCurrentQ ? 'text-cyan-300' : 'text-white'}`}>
                        {formatCurrency(val)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly GCI Chart */}
          {stats.financials.monthlyGCI && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">📅 Monthly GCI</h3>
              <div className="flex items-end justify-between gap-2 h-40">
                {stats.financials.monthlyGCI.map((val, idx) => {
                  const max = Math.max(...(stats.financials!.monthlyGCI || [1]), 1);
                  const pct = Math.round((val / max) * 100);
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const isCurrent = idx === new Date().getMonth();
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatCurrency(val)}
                      </div>
                      <div className="flex-1 w-full flex items-end">
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            isCurrent
                              ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30'
                              : val > 0
                                ? 'bg-gradient-to-t from-slate-600 to-slate-500 group-hover:from-emerald-500/50 group-hover:to-teal-400/50'
                                : 'bg-slate-800'
                          }`}
                          style={{ height: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                      <div className={`text-[10px] ${isCurrent ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                        {months[idx]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closed Deals Table */}
          {stats.financials.closedDealsList && stats.financials.closedDealsList.length > 0 && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">📋 YTD Closed Deals — Commission Log</h3>
                <button
                  onClick={exportReport}
                  className="px-3 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-xs text-slate-300 hover:text-white transition-all"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Property</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Closed</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Type</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Sale Price</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.financials.closedDealsList.map((deal, idx) => (
                      <tr key={idx} className="border-b border-slate-800/40 hover:bg-white/5">
                        <td className="py-3 px-4 text-white font-medium">{deal.title}</td>
                        <td className="py-3 px-4 text-slate-300">{deal.closedDate}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            deal.type === 'buyer' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                            deal.type === 'seller' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {deal.type === 'dual' ? 'Dual' : deal.type === 'buyer' ? 'Buyer' : 'Seller'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-white">{formatCurrency(deal.purchasePrice)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">{formatCurrency(deal.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-600/60">
                      <td colSpan={3} className="py-3 px-4 text-white font-bold">Total</td>
                      <td className="py-3 px-4 text-right text-white font-bold">
                        {formatCurrency(stats.financials.closedDealsList.reduce((s, d) => s + d.purchasePrice, 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {formatCurrency(stats.financials.closedDealsList.reduce((s, d) => s + d.commission, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Financial Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Avg Deal Price" value={formatCurrency(stats.financials.avgDealPrice || stats.deals.avgDealValue)} icon="🏠" color="blue" />
            <StatCard label="Commission Rate" value={`${stats.financials.commissionRate || 2.5}%`} icon="📊" color="purple" />
            <StatCard label="Deals YTD" value={stats.financials.totalDealsYTD || 0} icon="🤝" color="cyan" />
            <StatCard label="YTD Volume" value={formatCurrency(stats.financials.totalVolumeYTD || 0)} icon="💰" color="emerald" />
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-8">
          {hasTeam && stats.team ? (
            <>
              {/* Team Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Team Members" value={stats.team.memberCount} icon="👥" color="purple" />
                <StatCard label="Active Agents" value={stats.team.activeAgents} icon="✅" color="emerald" />
                <StatCard label="Total Clients" value={stats.team.totalClients} icon="🤝" color="blue" />
                <StatCard label="Team Volume" value={formatCurrency(stats.team.teamVolume || 0)} icon="💰" color="cyan" />
              </div>

              {/* Leaderboard */}
              {stats.team.leaderboard && stats.team.leaderboard.length > 0 && (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
                  <h3 className="text-lg font-semibold text-white mb-6">🏆 Leaderboard</h3>
                  <div className="space-y-3">
                    {stats.team.leaderboard.map((member, idx) => (
                      <div key={member.name} className={`flex items-center gap-4 p-4 rounded-xl ${
                        idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30' :
                        idx === 1 ? 'bg-gradient-to-r from-slate-500/20 to-gray-500/10 border border-slate-500/30' :
                        idx === 2 ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 border border-orange-500/30' :
                        'bg-white/5 border border-white/10'
                      }`}>
                        <div className="text-2xl">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white">{member.name}</div>
                          <div className="text-xs text-slate-400">{member.deals} deals closed</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">{formatCurrency(member.volume)}</div>
                          <div className="text-xs text-slate-400">volume</div>
                          {member.gci != null && member.gci > 0 && (
                            <div className="text-xs text-cyan-300 mt-0.5">GCI: {formatCurrency(member.gci)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
                  <h3 className="text-lg font-semibold text-white mb-4">Team Performance</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Closed Deals" value={stats.team.closedDeals} color="emerald" />
                    <StatCard label="Avg Response Rate" value={`${stats.team.avgResponseRate}%`} color="cyan" />
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
                  <h3 className="text-lg font-semibold text-white mb-4">Top Performer</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-2xl">
                      🏆
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">{stats.team.topAgent}</div>
                      <div className="text-sm text-slate-400">Leading the team this month</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl text-center">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Team Yet</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Build your real estate team to unlock team analytics, leaderboards, and collaborative features.
              </p>
              <button
                onClick={() => navigate('/settings')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25"
              >
                Add Team Members
              </button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}

// Components

function HeroStat({ label, value, subValue, trend, icon, color }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  icon: string;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}) {
  const colorClasses = {
    emerald: 'from-emerald-600/40 to-emerald-900/60 border-emerald-500/50 shadow-emerald-500/20',
    blue: 'from-blue-600/40 to-blue-900/60 border-blue-500/50 shadow-blue-500/20',
    purple: 'from-purple-600/40 to-purple-900/60 border-purple-500/50 shadow-purple-500/20',
    amber: 'from-amber-600/40 to-amber-900/60 border-amber-500/50 shadow-amber-500/20',
  };
  const textColors = {
    emerald: 'text-emerald-300',
    blue: 'text-blue-300',
    purple: 'text-purple-300',
    amber: 'text-amber-300',
  };

  return (
    <div className={`p-5 rounded-2xl bg-gradient-to-br ${colorClasses[color]} border shadow-lg backdrop-blur-md`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-300 font-medium mb-1">{label}</div>
          <div className={`text-2xl md:text-3xl font-bold ${textColors[color]}`}>{value}</div>
          {subValue && <div className="text-xs text-slate-400 mt-1">{subValue}</div>}
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}

function GoalProgress({ label, current, goal, format, color, icon }: {
  label: string;
  current: number;
  goal: number;
  format?: 'currency';
  color: 'cyan' | 'emerald' | 'purple' | 'amber';
  icon: string;
}) {
  const percentage = Math.min(100, Math.round((current / goal) * 100));
  const colorClasses = {
    cyan: 'from-cyan-500 to-blue-500',
    emerald: 'from-emerald-500 to-teal-500',
    purple: 'from-purple-500 to-pink-500',
    amber: 'from-amber-500 to-orange-500',
  };

  const formatValue = (v: number) => {
    if (format === 'currency') {
      if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
      return `$${v}`;
    }
    return v.toString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm text-slate-300">{label}</span>
        </div>
        <div className="text-sm">
          <span className="font-bold text-white">{formatValue(current)}</span>
          <span className="text-slate-500"> / {formatValue(goal)}</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-700/80 overflow-hidden">
        <div 
          className={`h-full rounded-full bg-gradient-to-r ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-400 text-right">{percentage}%</div>
    </div>
  );
}

function FunnelStage({ label, value, color, width }: {
  label: string;
  value: number;
  color: 'slate' | 'blue' | 'purple' | 'amber' | 'emerald';
  width: number;
}) {
  const colorClasses = {
    slate: 'bg-slate-600',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 text-sm text-slate-400">{label}</div>
      <div className="flex-1">
        <div 
          className={`h-8 ${colorClasses[color]} rounded-lg flex items-center justify-end pr-3 transition-all`}
          style={{ width: `${width}%` }}
        >
          <span className="text-sm font-bold text-white">{value}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, highlight, alert, small }: {
  label: string;
  value: string | number;
  icon?: string;
  color: 'cyan' | 'emerald' | 'purple' | 'amber' | 'blue' | 'red' | 'slate';
  highlight?: boolean;
  alert?: boolean;
  small?: boolean;
}) {
  const textColors = {
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    purple: 'text-purple-300',
    amber: 'text-amber-300',
    blue: 'text-blue-300',
    red: 'text-red-400',
    slate: 'text-slate-200',
  };

  return (
    <div className={`p-4 rounded-xl bg-slate-800/70 border ${alert ? 'border-red-500/60 bg-red-900/30' : highlight ? 'border-cyan-500/50 bg-cyan-900/20' : 'border-slate-700/60'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-300 mb-1">{label}</div>
          <div className={`${small ? 'text-xl' : 'text-2xl'} font-bold ${highlight ? textColors[color] : alert ? 'text-red-400' : 'text-white'}`}>
            {value}
          </div>
        </div>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
    </div>
  );
}

function ManualNumberField({ label, value, onChange }: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-slate-400 mb-1">{label}</div>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
      />
    </label>
  );
}
