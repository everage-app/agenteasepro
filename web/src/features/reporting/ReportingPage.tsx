import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BadgeDollarSign,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Crown,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  Flame,
  Handshake,
  Home,
  Hourglass,
  KeyRound,
  Lightbulb,
  Mail,
  Medal,
  Megaphone,
  MessageSquare,
  PenLine,
  Phone,
  PhoneCall,
  Pin,
  ReceiptText,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
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

type ReportingDrilldownMetric = {
  label: string;
  value: string;
  detail?: string;
};

type ReportingDrilldownAction = {
  label: string;
  onClick: () => void;
};

type ReportingDrilldown = {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  tone: 'gold' | 'cyan' | 'emerald' | 'purple' | 'rose' | 'slate';
  summary: string;
  metrics: ReportingDrilldownMetric[];
  bullets: string[];
  primaryAction: ReportingDrilldownAction;
  secondaryAction?: ReportingDrilldownAction;
};

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
  const [drilldown, setDrilldown] = useState<ReportingDrilldown | null>(null);
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
      lines.push({ text: 'Outstanding conversion rate. You\'re closing deals above industry average.', type: 'success' });
    } else if (stats.deals.conversionRate < 15) {
      lines.push({ text: 'Your conversion rate could improve. Focus on follow-up within 5 minutes of lead contact.', type: 'warning' });
    }
    
    if (stats.texts.responseRate >= 85) {
      lines.push({ text: 'Excellent response rate. Clients appreciate your quick communication.', type: 'success' });
    } else if (stats.texts.responseRate < 70) {
      lines.push({ text: 'Response rate is below target. Try setting up automated first-touch messages.', type: 'warning' });
    }
    
    if (stats.goals && stats.goals.monthlyDeals >= stats.goals.monthlyDealGoal * 0.8) {
      lines.push({ text: `You're at ${Math.round((stats.goals.monthlyDeals / stats.goals.monthlyDealGoal) * 100)}% of your monthly deal goal.`, type: 'success' });
    }
    
    if (stats.appointments.noShows > 2) {
      lines.push({ text: 'Multiple no-shows detected. Send confirmation texts 2 hours before appointments.', type: 'warning' });
    }
    
    if (stats.properties.avgDaysOnMarket < 30) {
      lines.push({ text: 'Your listings sell faster than market average. Great pricing strategy.', type: 'success' });
    }
    
    if (stats.clientHealth && stats.clientHealth.overdueFollowUps > 0) {
      lines.push({ text: `${stats.clientHealth.overdueFollowUps} clients need immediate follow-up.`, type: 'warning' });
    }
    
    if (lines.length === 0) {
      lines.push({ text: 'Keep up the momentum. Your metrics are solid across the board.', type: 'info' });
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

  const totalVolume = stats.deals.totalVolume || stats.deals.avgDealValue * stats.deals.closedThisMonth;
  const activePipeline = stats.deals.activeDeals + stats.deals.underContract;
  const projectedGCI = stats.financials?.projectedGCI || stats.financials?.ytdGCI || totalVolume * ((stats.financials?.commissionRate || 2.5) / 100);
  const overdueFollowUps = stats.clientHealth?.overdueFollowUps || 0;
  const teamContext = hasTeam && scope === 'team' && stats.team
    ? `${stats.team.activeAgents} active agents, ${stats.team.totalClients} clients`
    : `${stats.agentActivity.activeClients} active clients, ${stats.agentActivity.newLeadsThisWeek} new leads`;
  const topLeadSource = stats.leadSources.topSources[0] || {
    source: 'All sources',
    leads: stats.agentActivity.totalLeads,
    closed: stats.deals.closedThisMonth,
    conversionRate: stats.deals.conversionRate,
    volume: totalVolume,
  };
  const topLeadSourceValue = topLeadSource.volume || 0;
  const monthlyDealGoal = stats.goals?.monthlyDealGoal || 10;
  const monthlyVolumeGoal = stats.goals?.monthlyVolumeGoal || 5000000;
  const monthlyVolume = stats.goals?.monthlyVolume || stats.deals.totalVolume || 0;
  const dealGap = Math.max(0, monthlyDealGoal - (stats.goals?.monthlyDeals || stats.deals.closedThisMonth));
  const volumeGap = Math.max(0, monthlyVolumeGoal - monthlyVolume);
  const listingViewsPerListing = Math.round(stats.properties.totalViews / Math.max(1, stats.properties.activeListings));
  const leadPace = Math.round(((stats.goals?.weeklyLeads || stats.agentActivity.newLeadsThisWeek) / Math.max(1, stats.goals?.weeklyLeadGoal || 20)) * 100);
  const callPace = Math.round(((stats.goals?.weeklyCalls || stats.calls.totalCalls) / Math.max(1, stats.goals?.weeklyCallGoal || 75)) * 100);
  const callGoalToday = stats.calls.callGoalToday || Math.ceil((stats.goals?.weeklyCallGoal || 75) / 5);
  const callsToday = stats.calls.callsToday ?? stats.calls.callsByDay.at(-1)?.count ?? 0;
  const todayCallPace = Math.min(100, Math.round((callsToday / Math.max(1, callGoalToday)) * 100));
  const avgDailyCalls = Math.round(stats.calls.totalCalls / Math.max(1, stats.calls.callsByDay.length));
  const bestCallDay = stats.calls.callsByDay.reduce(
    (best, day) => (day.count > best.count ? day : best),
    stats.calls.callsByDay[0] || { day: 'Today', count: 0 }
  );
  const callRecoveryCount = stats.calls.missedCalls + (stats.clientHealth?.needsFollowUp || 0);
  const nextBestActions = [
    overdueFollowUps > 0
      ? { label: `${overdueFollowUps} follow-ups need attention`, detail: 'Protect the clients most likely to drift.', icon: Clock3, tone: 'warning' }
      : { label: 'Follow-up rhythm is healthy', detail: 'Keep today focused on live opportunities.', icon: CheckCircle2, tone: 'success' },
    stats.appointments.noShows > 0
      ? { label: 'Tighten appointment confirmations', detail: `${stats.appointments.noShows} no-shows can be reduced with reminders.`, icon: CalendarDays, tone: 'warning' }
      : { label: 'Appointments are staying clean', detail: `${stats.appointments.upcoming} upcoming meetings on deck.`, icon: CalendarDays, tone: 'info' },
    stats.deals.conversionRate < 18
      ? { label: 'Review lead-to-client conversion', detail: 'Spot the stage where warm leads are leaking.', icon: Target, tone: 'warning' }
      : { label: 'Conversion is marketable', detail: `${stats.deals.conversionRate}% conversion is a strong story.`, icon: Trophy, tone: 'success' },
  ];
  const openManualSection = () => {
    openManualEditor();
  };

  const openReportDrilldown = (next: ReportingDrilldown) => setDrilldown(next);

  const metricAction = (path: string) => {
    setDrilldown(null);
    navigate(path);
  };

  const openPerformanceDrilldown = () => openReportDrilldown({
    title: 'Performance score',
    eyebrow: scope === 'team' && hasTeam ? 'Team operating health' : 'Agent operating health',
    icon: Trophy,
    tone: 'cyan',
    summary: 'This score blends conversion, response rate, and closed-deal momentum into one fast read on whether the business is moving cleanly.',
    metrics: [
      { label: 'Score', value: `${performanceScore}/100`, detail: performanceScore >= 75 ? 'Strong operating rhythm' : performanceScore >= 45 ? 'Some pressure points' : 'Needs attention' },
      { label: 'Pipeline health', value: `${pipelineHealth}%`, detail: `${activePipeline} active opportunities` },
      { label: 'Response rate', value: `${stats.texts.responseRate}%`, detail: stats.texts.avgResponseTime ? `Avg response ${stats.texts.avgResponseTime}` : 'Measured from client replies' },
      { label: 'Closed this month', value: String(stats.deals.closedThisMonth), detail: `${stats.goals?.monthlyDealGoal || 10} monthly goal` },
    ],
    bullets: [
      stats.deals.conversionRate < 18 ? 'Conversion is the biggest lever. Review lead source quality and follow-up timing.' : 'Conversion is healthy enough to feature in client and listing conversations.',
      overdueFollowUps > 0 ? 'Overdue follow-ups are dragging the score. Clear those first before chasing new work.' : 'No urgent follow-up backlog is visible in this snapshot.',
      stats.texts.responseRate < 70 ? 'Response rate is below target. A reply automation or daily inbox block would help.' : 'Communication response is supporting the business instead of fighting it.',
    ],
    primaryAction: { label: 'Open dashboard', onClick: () => metricAction('/dashboard') },
    secondaryAction: { label: 'View tasks', onClick: () => metricAction('/tasks') },
  });

  const openGoalsDrilldown = () => openReportDrilldown({
    title: 'Monthly goals',
    eyebrow: 'Goal pace and gaps',
    icon: Target,
    tone: 'gold',
    summary: 'Use this to see which goals are ahead, which are behind, and where to put the next working block.',
    metrics: [
      { label: 'Deals closed', value: `${stats.goals?.monthlyDeals || stats.deals.closedThisMonth} / ${stats.goals?.monthlyDealGoal || 10}`, detail: 'Monthly close target' },
      { label: 'Volume', value: `${formatCurrency(stats.goals?.monthlyVolume || stats.deals.totalVolume || 0)} / ${formatCurrency(stats.goals?.monthlyVolumeGoal || 5000000)}`, detail: 'Monthly production target' },
      { label: 'Weekly calls', value: `${stats.goals?.weeklyCalls || stats.calls.totalCalls} / ${stats.goals?.weeklyCallGoal || 75}`, detail: 'Lead generation rhythm' },
      { label: 'New leads', value: `${stats.goals?.weeklyLeads || stats.agentActivity.newLeadsThisWeek} / ${stats.goals?.weeklyLeadGoal || 20}`, detail: 'Fresh pipeline target' },
    ],
    bullets: [
      'Click Manual Edit to tune targets for the account or current business plan.',
      stats.goals && stats.goals.monthlyDeals >= stats.goals.monthlyDealGoal ? 'Deal goal is complete. Shift energy to margin, reviews, and referrals.' : 'The fastest path is usually calls plus fast lead response, then contract follow-up.',
      'Targets are most useful when they send the agent directly to the workflow that can move them.',
    ],
    primaryAction: { label: 'Edit goals', onClick: () => { setDrilldown(null); openManualSection(); } },
    secondaryAction: { label: 'Open calendar', onClick: () => metricAction('/calendar') },
  });

  const openFinancialDrilldown = (focus = 'summary') => openReportDrilldown({
    title: focus === 'pending' ? 'Pending commission' : focus === 'projected' ? 'Projected annual GCI' : 'Financial summary',
    eyebrow: 'GCI, volume, and tax planning',
    icon: BadgeDollarSign,
    tone: focus === 'pending' ? 'gold' : 'emerald',
    summary: 'Financial reporting connects closed production, under-contract work, projected annual pace, and tax planning so agents can make decisions with real numbers.',
    metrics: [
      { label: 'YTD GCI', value: formatCurrency(stats.financials?.ytdGCI || 0), detail: `${stats.financials?.totalDealsYTD || 0} deals closed YTD` },
      { label: 'Projected GCI', value: formatCurrency(stats.financials?.projectedGCI || projectedGCI), detail: 'Based on current pace' },
      { label: 'Pending commission', value: formatCurrency(stats.financials?.pendingCommission || 0), detail: `${stats.deals.underContract} deals under contract` },
      { label: 'YTD volume', value: formatCurrency(stats.financials?.totalVolumeYTD || totalVolume), detail: `${stats.financials?.commissionRate || 2.5}% avg commission rate` },
    ],
    bullets: [
      stats.financials?.closedDealsList?.length ? 'Closed deal details are available in the Financials tab and export.' : 'Closed deal detail will appear here as transactions close.',
      'Pending commission should be reviewed against contract milestones and closing dates.',
      'Tax estimates are directional and should be reviewed with a CPA before payment decisions.',
    ],
    primaryAction: { label: 'Open financials', onClick: () => { setDrilldown(null); setActiveTab('financials'); } },
    secondaryAction: { label: 'Export CSV', onClick: () => { setDrilldown(null); exportReport(); } },
  });

  const openPipelineDrilldown = () => openReportDrilldown({
    title: 'Pipeline health',
    eyebrow: 'Opportunity movement',
    icon: BriefcaseBusiness,
    tone: 'purple',
    summary: 'Pipeline health shows whether leads are converting into active clients, active deals, contracts, and closings.',
    metrics: [
      { label: 'Active pipeline', value: String(activePipeline), detail: `${stats.deals.underContract} under contract` },
      { label: 'Active deals', value: String(stats.deals.activeDeals), detail: `${stats.deals.pendingVolume ? formatCurrency(stats.deals.pendingVolume) : 'Pending volume unavailable'}` },
      { label: 'Conversion', value: `${stats.deals.conversionRate}%`, detail: `${stats.agentActivity.totalLeads} total leads` },
      { label: 'Avg days to close', value: String(stats.deals.avgDaysToClose || 'Not enough data'), detail: 'Closed deal velocity' },
    ],
    bullets: [
      stats.deals.underContract > 0 ? 'Under-contract work should be protected with deadline and document follow-through.' : 'No under-contract deals are visible. Prioritize lead-to-client conversion.',
      stats.clientHealth?.needsFollowUp ? `${stats.clientHealth.needsFollowUp} leads or clients need follow-up before they cool off.` : 'No follow-up backlog is visible in this reporting set.',
      'Use the Deals page for deal-by-deal triage and contract execution.',
    ],
    primaryAction: { label: 'Open deals', onClick: () => metricAction('/deals') },
    secondaryAction: { label: 'View clients', onClick: () => metricAction('/clients') },
  });

  const openClientHealthDrilldown = () => openReportDrilldown({
    title: 'Client health',
    eyebrow: 'Follow-up risk',
    icon: UsersRound,
    tone: overdueFollowUps > 0 ? 'rose' : 'emerald',
    summary: 'Client health turns follow-up urgency into a simple operational view, so the agent knows who needs attention before the relationship goes cold.',
    metrics: [
      { label: 'Overdue', value: String(overdueFollowUps), detail: 'Needs immediate attention' },
      { label: 'Needs follow-up', value: String(stats.clientHealth?.needsFollowUp || 0), detail: 'Open relationship work' },
      { label: 'Hot leads', value: String(stats.clientHealth?.hotLeads || 0), detail: 'Highest priority lead segment' },
      { label: 'Avg days since contact', value: String(stats.clientHealth?.avgDaysSinceContact || 0), detail: 'Relationship freshness' },
    ],
    bullets: [
      overdueFollowUps > 0 ? 'Start with overdue clients before new prospecting.' : 'The visible client follow-up queue is clean.',
      'Hot and warm leads should have same-day communication blocks.',
      'Clients and leads are the best destination for this metric because the next action is person-specific.',
    ],
    primaryAction: { label: 'Open clients', onClick: () => metricAction('/clients') },
    secondaryAction: { label: 'Open leads', onClick: () => metricAction('/leads') },
  });

  const openLeadSourceDrilldown = (source: LeadSource) => openReportDrilldown({
    title: `${source.source} performance`,
    eyebrow: 'Lead source detail',
    icon: Target,
    tone: source.conversionRate >= 15 ? 'emerald' : 'gold',
    summary: `${source.source} has generated ${source.leads} lead${source.leads === 1 ? '' : 's'} with ${source.closed} closed and ${source.conversionRate.toFixed(1)}% conversion.`,
    metrics: [
      { label: 'Leads', value: String(source.leads), detail: 'Total attributed leads' },
      { label: 'Closed', value: String(source.closed), detail: 'Closed from this source' },
      { label: 'Conversion', value: `${source.conversionRate.toFixed(1)}%`, detail: source.conversionRate >= 15 ? 'Productive channel' : 'Needs nurturing or better routing' },
      { label: 'Volume', value: source.volume ? formatCurrency(source.volume) : 'No volume yet', detail: 'Closed production' },
    ],
    bullets: [
      source.conversionRate >= 15 ? 'This source is producing. Consider doubling down with more landing pages or campaigns.' : 'This source needs follow-up discipline or message refinement.',
      'Lead source reporting should connect directly to lead triage, campaign work, and listing pages.',
      source.leads > 0 ? 'Open leads to inspect the people behind the number.' : 'Once leads arrive, this drill-down will become person-level action.',
    ],
    primaryAction: { label: 'Open leads', onClick: () => metricAction('/leads') },
    secondaryAction: { label: 'Open marketing', onClick: () => metricAction('/marketing') },
  });

  const openActivityDrilldown = () => openReportDrilldown({
    title: 'Activity and appointments',
    eyebrow: 'Communication engine',
    icon: PhoneCall,
    tone: 'cyan',
    summary: 'Activity reporting shows whether calls, texts, appointments, and daily relationship actions are creating enough motion for the pipeline.',
    metrics: [
      { label: 'Total calls', value: String(stats.calls.totalCalls), detail: `${stats.calls.connectRate || 72}% connect rate` },
      { label: 'Texts', value: String(stats.texts.totalTexts), detail: `${stats.texts.responseRate}% response rate` },
      { label: 'Upcoming appointments', value: String(stats.appointments.upcoming), detail: `${stats.appointments.completed} completed` },
      { label: 'No-shows', value: String(stats.appointments.noShows), detail: stats.appointments.noShows > 2 ? 'Needs reminder workflow' : 'Within normal range' },
    ],
    bullets: [
      stats.appointments.noShows > 2 ? 'Appointment no-shows are high. Use confirmation reminders and calendar follow-up.' : 'Appointment reliability looks controlled.',
      stats.texts.responseRate < 70 ? 'Text response rate is a priority improvement area.' : 'Text responsiveness is supporting the relationship engine.',
      'Calendar is the best place to convert insight into scheduled follow-up.',
    ],
    primaryAction: { label: 'Open calendar', onClick: () => metricAction('/calendar') },
    secondaryAction: { label: 'Open tasks', onClick: () => metricAction('/tasks') },
  });

  const openMarketingDrilldown = () => openReportDrilldown({
    title: 'Marketing performance',
    eyebrow: 'Campaigns and listing demand',
    icon: Megaphone,
    tone: 'purple',
    summary: 'Marketing reporting connects campaigns, listing views, clicks, and generated leads so the agent can see which activity is creating demand.',
    metrics: [
      { label: 'Campaigns', value: String(stats.marketing.totalCampaigns), detail: `${stats.marketing.sent} sent` },
      { label: 'Open rate', value: stats.marketing.openRate ? `${stats.marketing.openRate}%` : 'Not available', detail: 'Email engagement' },
      { label: 'Click rate', value: `${stats.marketing.clickRate}%`, detail: `${stats.marketing.totalClicks} total clicks` },
      { label: 'Listing views', value: formatNumber(stats.properties.totalViews), detail: `${stats.properties.activeListings} active listings` },
    ],
    bullets: [
      stats.marketing.topCampaign ? `${stats.marketing.topCampaign} is currently the top campaign.` : 'Campaign performance will sharpen as more email activity runs.',
      'Listing views should feed back into landing pages, lead capture, and seller reporting.',
      'Marketing is strongest when the next step is a campaign, listing page, or lead follow-up.',
    ],
    primaryAction: { label: 'Open marketing', onClick: () => metricAction('/marketing') },
    secondaryAction: { label: 'Open listings', onClick: () => metricAction('/listings') },
  });

  const openSpeedToLeadReport = () => openReportDrilldown({
    title: 'Speed-to-lead report',
    eyebrow: 'First response discipline',
    icon: PhoneCall,
    tone: stats.texts.responseRate >= 70 ? 'emerald' : 'gold',
    summary: 'A simple view of how fast the business is responding and whether lead sources are getting the attention needed to win the first conversation.',
    metrics: [
      { label: 'Response rate', value: `${stats.texts.responseRate}%`, detail: stats.texts.avgResponseTime ? `Avg text response ${stats.texts.avgResponseTime}` : 'Based on available message activity' },
      { label: 'Calls', value: String(stats.calls.totalCalls), detail: `${stats.calls.connectRate || 72}% connect rate` },
      { label: 'New leads', value: String(stats.agentActivity.newLeadsThisWeek), detail: `${leadPace}% of weekly lead goal` },
      { label: 'Top source', value: topLeadSource.source, detail: `${topLeadSource.leads} leads in this view` },
    ],
    bullets: [
      stats.texts.responseRate < 70 ? 'Response rate is the first improvement target. Fast replies protect paid leads and referral trust.' : 'Response rate is healthy enough to feature as an operating strength.',
      stats.calls.missedCalls > 0 ? `${stats.calls.missedCalls} missed calls should be reviewed for same-day recovery.` : 'No missed-call pressure is visible in this snapshot.',
      'The next product step is person-level speed tracking as each lead timestamp becomes available.',
    ],
    primaryAction: { label: 'Open leads', onClick: () => metricAction('/leads') },
    secondaryAction: { label: 'Open activity', onClick: () => { setDrilldown(null); setActiveTab('activity'); } },
  });

  const openLeadSourceRoiReport = () => openReportDrilldown({
    title: 'Lead source ROI scorecard',
    eyebrow: 'Where to double down',
    icon: Target,
    tone: topLeadSource.conversionRate >= 15 ? 'emerald' : 'gold',
    summary: 'This report compares source quality by leads, closings, conversion, and attributed volume so agents can stop guessing where business is coming from.',
    metrics: [
      { label: 'Best source', value: topLeadSource.source, detail: `${topLeadSource.conversionRate.toFixed(1)}% conversion` },
      { label: 'Closed', value: String(topLeadSource.closed), detail: 'Closed from top source' },
      { label: 'Volume', value: topLeadSource.volume ? formatCurrency(topLeadSource.volume) : 'No volume yet', detail: 'Attributed closed production' },
      { label: 'All leads', value: String(stats.agentActivity.totalLeads), detail: `${stats.leadSources.topSources.length} tracked sources` },
    ],
    bullets: [
      topLeadSource.conversionRate >= 15 ? `${topLeadSource.source} deserves more budget, more nurture, or more landing page attention.` : `${topLeadSource.source} needs cleaner follow-up before adding more spend.`,
      'Cost-per-lead can be added when ad spend is connected or entered manually.',
      'The best version of this report ties every source to contacts, appointments, contracts, and GCI.',
    ],
    primaryAction: { label: 'Open source detail', onClick: () => openLeadSourceDrilldown(topLeadSource) },
    secondaryAction: { label: 'Open marketing', onClick: () => metricAction('/marketing') },
  });

  const openCracksReport = () => openReportDrilldown({
    title: 'Slipping through the cracks',
    eyebrow: 'Recovery queue',
    icon: AlertTriangle,
    tone: overdueFollowUps > 0 || stats.appointments.noShows > 0 ? 'rose' : 'emerald',
    summary: 'The fastest report for saving deals: leads, clients, appointments, and conversations that need attention before they cool off.',
    metrics: [
      { label: 'Overdue', value: String(overdueFollowUps), detail: 'Past follow-up target' },
      { label: 'Needs follow-up', value: String(stats.clientHealth?.needsFollowUp || 0), detail: 'Open relationship work' },
      { label: 'No-shows', value: String(stats.appointments.noShows), detail: 'Appointment recovery' },
      { label: 'Missed calls', value: String(stats.calls.missedCalls), detail: 'Call-back opportunity' },
    ],
    bullets: [
      overdueFollowUps > 0 ? 'Start with overdue follow-ups. That is the cleanest save-the-deal queue.' : 'Follow-up backlog looks controlled right now.',
      stats.appointments.noShows > 0 ? 'No-shows should get a same-day reschedule attempt and a reminder workflow.' : 'Appointment reliability is not currently the main risk.',
      'This should stay near the top of Reporting because it turns analytics into rescued opportunities.',
    ],
    primaryAction: { label: 'Open tasks', onClick: () => metricAction('/tasks') },
    secondaryAction: { label: 'Open clients', onClick: () => metricAction('/clients') },
  });

  const openListingProofReport = () => openReportDrilldown({
    title: 'Listing presentation proof',
    eyebrow: 'Seller-ready report',
    icon: Home,
    tone: 'cyan',
    summary: 'A clean set of proof points agents can use with sellers: audience demand, marketing reach, listing performance, and sale outcomes.',
    metrics: [
      { label: 'Listing views', value: formatNumber(stats.properties.totalViews), detail: `${listingViewsPerListing} avg views per active listing` },
      { label: 'Active listings', value: String(stats.properties.activeListings), detail: `${stats.properties.pendingListings || 0} pending` },
      { label: 'List/sale ratio', value: `${stats.properties.listToSaleRatio || 98}%`, detail: `${stats.properties.avgDaysOnMarket || 0} avg DOM` },
      { label: 'Campaign clicks', value: String(stats.marketing.totalClicks), detail: stats.marketing.topCampaign || 'Marketing engagement' },
    ],
    bullets: [
      'This is the seller-facing story: demand, marketing activity, and pricing performance in one place.',
      stats.properties.activeListings > 0 ? 'Agents can use active buyer and engagement numbers to defend marketing value.' : 'Listing proof will become stronger as active listings and campaigns accumulate.',
      'A future polished PDF/export would make this an excellent listing appointment leave-behind.',
    ],
    primaryAction: { label: 'Open listings', onClick: () => metricAction('/listings') },
    secondaryAction: { label: 'Open marketing', onClick: () => metricAction('/marketing') },
  });

  const openWeeklyBriefReport = () => openReportDrilldown({
    title: 'Agent weekly brief',
    eyebrow: 'Monday morning plan',
    icon: CalendarDays,
    tone: 'gold',
    summary: 'A weekly operating brief that shows what changed, where the agent is pacing, and what must happen next to hit the month.',
    metrics: [
      { label: 'Lead pace', value: `${leadPace}%`, detail: `${stats.agentActivity.newLeadsThisWeek} new leads this week` },
      { label: 'Call pace', value: `${callPace}%`, detail: `${stats.calls.totalCalls} calls logged` },
      { label: 'Deal gap', value: String(dealGap), detail: `${monthlyDealGoal} monthly deal goal` },
      { label: 'Volume gap', value: formatCurrency(volumeGap), detail: `${formatCurrency(monthlyVolumeGoal)} monthly goal` },
    ],
    bullets: [
      dealGap > 0 ? `${dealGap} more closed deal${dealGap === 1 ? '' : 's'} needed to hit the monthly deal goal.` : 'Deal goal is complete. Protect closings and ask for reviews/referrals.',
      volumeGap > 0 ? `${formatCurrency(volumeGap)} remains against the monthly volume target.` : 'Monthly volume goal is at or above target.',
      'This report should be the weekly planning view agents can trust without opening a spreadsheet.',
    ],
    primaryAction: { label: 'Open calendar', onClick: () => metricAction('/calendar') },
    secondaryAction: { label: 'Edit goals', onClick: () => { setDrilldown(null); openManualSection(); } },
  });

  const openTeamCoachingReport = () => openReportDrilldown({
    title: hasTeam ? 'Team coaching dashboard' : 'Agent coaching dashboard',
    eyebrow: 'Accountability without noise',
    icon: UsersRound,
    tone: hasTeam ? 'purple' : 'cyan',
    summary: hasTeam
      ? 'A simple team lead view of production, response, client load, and coaching opportunities.'
      : 'A solo-agent coaching view that highlights the habits most likely to move pipeline and GCI.',
    metrics: [
      { label: 'Active agents', value: String(stats.team?.activeAgents || 1), detail: `${stats.team?.memberCount || 1} team member${(stats.team?.memberCount || 1) === 1 ? '' : 's'}` },
      { label: 'Response', value: `${stats.team?.avgResponseRate || stats.texts.responseRate}%`, detail: 'Team or agent response rate' },
      { label: 'Closed deals', value: String(stats.team?.closedDeals || stats.deals.closedThisMonth), detail: 'Current reporting period' },
      { label: 'Top performer', value: stats.team?.topAgent || 'Not ranked yet', detail: 'Based on team reporting data' },
    ],
    bullets: [
      hasTeam ? 'Coach agents on response speed, appointment setting, and stale follow-up before the pipeline number drops.' : 'The same coaching logic works for solo agents: speed, follow-up, appointments, and deal movement.',
      overdueFollowUps > 0 ? 'Follow-up discipline is the top coaching theme in this snapshot.' : 'Follow-up discipline is currently in a healthy range.',
      'This report should stay simple enough to use in a five-minute team huddle.',
    ],
    primaryAction: { label: hasTeam ? 'Open team' : 'Open activity', onClick: () => { setDrilldown(null); setActiveTab(hasTeam ? 'team' : 'activity'); } },
    secondaryAction: { label: 'Open settings', onClick: () => metricAction('/settings') },
  });

  const openPipelineRiskReport = () => openReportDrilldown({
    title: 'Pipeline risk report',
    eyebrow: 'Deals likely to stall',
    icon: BriefcaseBusiness,
    tone: activePipeline > 0 && overdueFollowUps === 0 ? 'emerald' : 'gold',
    summary: 'A risk-first view of the pipeline, focused on active deals, under-contract work, stalled follow-up, and closing confidence.',
    metrics: [
      { label: 'Active deals', value: String(stats.deals.activeDeals), detail: `${stats.deals.underContract} under contract` },
      { label: 'Pending volume', value: formatCurrency(stats.deals.pendingVolume || 0), detail: 'Production not closed yet' },
      { label: 'Avg days to close', value: String(stats.deals.avgDaysToClose || 'Not enough data'), detail: 'Velocity signal' },
      { label: 'Follow-up risk', value: String(overdueFollowUps), detail: 'Can affect active opportunities' },
    ],
    bullets: [
      stats.deals.underContract > 0 ? 'Under-contract deals should have deadline, document, and client communication checks.' : 'No under-contract deals are visible. Focus on moving active clients into contracts.',
      overdueFollowUps > 0 ? 'Relationship risk is present. Review overdue follow-ups before relying on forecast numbers.' : 'No urgent follow-up risk is visible against the pipeline.',
      'A future version can flag specific deal records when milestone dates or tasks are missing.',
    ],
    primaryAction: { label: 'Open deals', onClick: () => metricAction('/deals') },
    secondaryAction: { label: 'Open tasks', onClick: () => metricAction('/tasks') },
  });

  const openNurtureHealthReport = () => openReportDrilldown({
    title: 'Client nurture health',
    eyebrow: 'Sphere and past-client engine',
    icon: Handshake,
    tone: overdueFollowUps > 0 ? 'gold' : 'emerald',
    summary: 'A relationship report for the business most CRMs under-serve: sphere, past clients, referrals, and warm leads that need consistent touches.',
    metrics: [
      { label: 'Active clients', value: String(stats.agentActivity.activeClients), detail: `${stats.agentActivity.totalClientsAllTime || stats.agentActivity.activeClients} all-time clients tracked` },
      { label: 'Hot leads', value: String(stats.clientHealth?.hotLeads || 0), detail: `${stats.clientHealth?.warmLeads || 0} warm leads` },
      { label: 'Avg days since contact', value: String(stats.clientHealth?.avgDaysSinceContact || 0), detail: 'Freshness of relationships' },
      { label: 'Referrals asked', value: String(stats.calls.totalReferralsAsked || 0), detail: 'Relationship development activity' },
    ],
    bullets: [
      'The most valuable long-term report is often who should hear from the agent this week.',
      stats.calls.totalReferralsAsked ? 'Referral asks are being tracked, which helps connect relationship work to future pipeline.' : 'Referral ask tracking can become a simple habit metric for repeat and referral business.',
      'This should eventually include birthdays, home anniversaries, review requests, and annual property reviews.',
    ],
    primaryAction: { label: 'Open clients', onClick: () => metricAction('/clients') },
    secondaryAction: { label: 'Open leads', onClick: () => metricAction('/leads') },
  });

  const openForecastConfidenceReport = () => openReportDrilldown({
    title: 'Forecast confidence',
    eyebrow: 'Real money vs hopeful money',
    icon: BadgeDollarSign,
    tone: stats.financials?.pendingCommission ? 'emerald' : 'gold',
    summary: 'A clearer forecast that separates closed production, under-contract commission, active pipeline, and projected annual pace.',
    metrics: [
      { label: 'Closed YTD GCI', value: formatCurrency(stats.financials?.ytdGCI || 0), detail: 'Most certain revenue' },
      { label: 'Pending commission', value: formatCurrency(stats.financials?.pendingCommission || 0), detail: `${stats.deals.underContract} deals under contract` },
      { label: 'Projected annual', value: formatCurrency(stats.financials?.projectedGCI || projectedGCI), detail: 'Pace-based forecast' },
      { label: 'Active pipeline', value: String(activePipeline), detail: 'Opportunity count before close' },
    ],
    bullets: [
      'Closed GCI, pending commission, and active pipeline should be visually separated so agents know what is real.',
      stats.deals.underContract > 0 ? 'Pending commission is meaningful enough to review closing deadlines and risk.' : 'There is no under-contract commission visible, so the forecast leans more on active pipeline and pace.',
      'This report makes goal conversations more honest and more useful.',
    ],
    primaryAction: { label: 'Open financials', onClick: () => { setDrilldown(null); setActiveTab('financials'); } },
    secondaryAction: { label: 'Open deals', onClick: () => metricAction('/deals') },
  });

  const openContactListsReport = () => openReportDrilldown({
    title: 'People behind the numbers',
    eyebrow: 'One-click contact lists',
    icon: Eye,
    tone: 'slate',
    summary: 'Every metric is more useful when it leads to the actual leads, clients, deals, listings, or campaigns behind the number.',
    metrics: [
      { label: 'Leads', value: String(stats.agentActivity.totalLeads), detail: 'Open the lead list behind source and conversion metrics' },
      { label: 'Clients', value: String(stats.agentActivity.activeClients), detail: 'Open active client relationships' },
      { label: 'Deals', value: String(activePipeline), detail: 'Open active and under-contract work' },
      { label: 'Listings', value: String(stats.properties.activeListings), detail: 'Open property performance' },
    ],
    bullets: [
      'This is the interaction model competitors emphasize: click a number, see the people behind it, take action.',
      'The page now points most key metrics toward Leads, Clients, Deals, Listings, Marketing, Calendar, and Tasks.',
      'A future enhancement can add filtered in-page contact drawers for each metric.',
    ],
    primaryAction: { label: 'Open leads', onClick: () => metricAction('/leads') },
    secondaryAction: { label: 'Open clients', onClick: () => metricAction('/clients') },
  });

  const reportingBriefCards = [
    {
      label: 'Highest leverage',
      title: topLeadSource.source,
      detail: `${topLeadSource.conversionRate.toFixed(1)}% conversion with ${topLeadSource.leads} lead${topLeadSource.leads === 1 ? '' : 's'}`,
      value: topLeadSourceValue ? formatCurrency(topLeadSourceValue) : `${topLeadSource.closed} closed`,
      icon: Target,
      tone: 'gold',
      onClick: () => openLeadSourceDrilldown(topLeadSource),
    },
    {
      label: 'Money on deck',
      title: 'Pending commission',
      detail: `${stats.deals.underContract} under contract and ${formatCurrency(stats.deals.pendingVolume || 0)} pending volume`,
      value: formatCurrency(stats.financials?.pendingCommission || 0),
      icon: BadgeDollarSign,
      tone: 'emerald',
      onClick: () => openFinancialDrilldown('pending'),
    },
    {
      label: 'Risk to protect',
      title: overdueFollowUps > 0 ? 'Follow-up backlog' : 'Client queue clean',
      detail: overdueFollowUps > 0 ? 'Start here before chasing fresh leads' : `${stats.clientHealth?.hotLeads || 0} hot leads still deserve speed`,
      value: overdueFollowUps > 0 ? `${overdueFollowUps} overdue` : 'Ready',
      icon: Clock3,
      tone: overdueFollowUps > 0 ? 'rose' : 'cyan',
      onClick: openClientHealthDrilldown,
    },
  ];
  const sellerProofPoints = [
    {
      label: 'Listing demand',
      value: formatNumber(stats.properties.totalViews),
      detail: `${stats.properties.activeListings} active listings, ${listingViewsPerListing} avg views`,
      onClick: openMarketingDrilldown,
    },
    {
      label: 'List to sale',
      value: `${stats.properties.listToSaleRatio || 98}%`,
      detail: `${stats.properties.avgDaysOnMarket || 0} avg days on market`,
      onClick: () => metricAction('/listings'),
    },
    {
      label: 'Campaign pull',
      value: stats.marketing.openRate ? `${stats.marketing.openRate}%` : `${stats.marketing.totalClicks} clicks`,
      detail: stats.marketing.topCampaign || `${stats.marketing.totalCampaigns} active campaigns`,
      onClick: openMarketingDrilldown,
    },
  ];
  const agentReportCards = [
    { label: 'Speed-to-lead', value: `${stats.texts.responseRate}%`, detail: stats.texts.avgResponseTime ? `Avg reply ${stats.texts.avgResponseTime}` : 'First response discipline', icon: PhoneCall, tone: 'cyan', onClick: openSpeedToLeadReport },
    { label: 'Lead source ROI', value: topLeadSource.source, detail: `${topLeadSource.conversionRate.toFixed(1)}% conversion`, icon: Target, tone: 'gold', onClick: openLeadSourceRoiReport },
    { label: 'Cracks report', value: overdueFollowUps > 0 ? `${overdueFollowUps} overdue` : 'Clean', detail: `${stats.clientHealth?.needsFollowUp || 0} need follow-up`, icon: AlertTriangle, tone: overdueFollowUps > 0 ? 'rose' : 'emerald', onClick: openCracksReport },
    { label: 'Listing proof', value: formatNumber(stats.properties.totalViews), detail: `${listingViewsPerListing} avg listing views`, icon: Home, tone: 'cyan', onClick: openListingProofReport },
    { label: 'Weekly brief', value: `${leadPace}% lead pace`, detail: `${dealGap} deals to goal`, icon: CalendarDays, tone: 'gold', onClick: openWeeklyBriefReport },
    { label: 'Team coaching', value: hasTeam ? `${stats.team?.activeAgents || 0} active` : 'Solo view', detail: `${stats.team?.avgResponseRate || stats.texts.responseRate}% response`, icon: UsersRound, tone: 'purple', onClick: openTeamCoachingReport },
    { label: 'Pipeline risk', value: `${activePipeline} opps`, detail: `${stats.deals.underContract} under contract`, icon: BriefcaseBusiness, tone: activePipeline > 0 ? 'emerald' : 'gold', onClick: openPipelineRiskReport },
    { label: 'Nurture health', value: `${stats.agentActivity.activeClients} clients`, detail: `${stats.clientHealth?.avgDaysSinceContact || 0} avg days since contact`, icon: Handshake, tone: 'emerald', onClick: openNurtureHealthReport },
    { label: 'Forecast confidence', value: formatCurrency(stats.financials?.pendingCommission || 0), detail: 'Pending commission', icon: BadgeDollarSign, tone: 'emerald', onClick: openForecastConfidenceReport },
    { label: 'Contact lists', value: `${stats.agentActivity.totalLeads} leads`, detail: 'People behind every number', icon: Eye, tone: 'slate', onClick: openContactListsReport },
  ];

  return (
    <PageLayout
      title="Reporting & Analytics"
      subtitle="Real-time insights to grow your business"
      maxWidth="workspace"
    >
      <div className="reporting-page space-y-6">
      <section className="reporting-command-center">
        <div className="reporting-command-copy">
          <div className="reporting-eyebrow"><BarChart3 className="h-4 w-4" /> Agent command center</div>
          <h2>Know what is working, what needs attention, and what to do next.</h2>
          <p>
            A clean business snapshot for real estate agents: pipeline, communication, appointments,
            commissions, client health, and team performance when a team is connected.
          </p>
          <div className="reporting-quick-actions">
            <button onClick={() => setActiveTab('pipeline')}><BriefcaseBusiness className="h-4 w-4" /> Pipeline</button>
            <button onClick={() => setActiveTab('financials')}><BadgeDollarSign className="h-4 w-4" /> GCI</button>
            <button onClick={() => setActiveTab(hasTeam ? 'team' : 'activity')}><UsersRound className="h-4 w-4" /> {hasTeam ? 'Team' : 'Activity'}</button>
          </div>
        </div>

        <button type="button" onClick={openPerformanceDrilldown} className="reporting-command-score text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
          <div
            className="reporting-score-ring"
            style={{ '--reporting-score': `${performanceScore}%` } as CSSProperties}
          >
            <span>{performanceScore}</span>
            <small>score</small>
          </div>
          <div>
            <h3>{scope === 'team' && hasTeam ? 'Team performance' : 'Agent performance'}</h3>
            <p>{teamContext}</p>
          </div>
        </button>

        <div className="reporting-command-grid">
          <button type="button" onClick={openPipelineDrilldown} className="reporting-command-card text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
            <span>Pipeline health</span>
            <strong>{pipelineHealth}%</strong>
            <small>{activePipeline} active opportunities</small>
          </button>
          <button type="button" onClick={() => openFinancialDrilldown('projected')} className="reporting-command-card text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
            <span>Projected GCI</span>
            <strong>{formatCurrency(projectedGCI)}</strong>
            <small>{formatCurrency(stats.financials?.pendingCommission || 0)} pending</small>
          </button>
          <button type="button" onClick={openClientHealthDrilldown} className={`reporting-command-card text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50 ${overdueFollowUps > 0 ? 'is-warning' : 'is-good'}`}>
            <span>Client health</span>
            <strong>{overdueFollowUps > 0 ? overdueFollowUps : 'Ready'}</strong>
            <small>{overdueFollowUps > 0 ? 'overdue follow-ups' : 'no urgent follow-up risk'}</small>
          </button>
        </div>
      </section>

      <section className="reporting-next-panel">
        <div>
          <div className="reporting-eyebrow"><Lightbulb className="h-4 w-4" /> What to do next</div>
          <h3>This report should lead the agent to action.</h3>
        </div>
        <div className="reporting-next-grid">
          {nextBestActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                type="button"
                key={action.label}
                onClick={action.label.toLowerCase().includes('follow') ? openClientHealthDrilldown : action.label.toLowerCase().includes('appointment') ? openActivityDrilldown : openPipelineDrilldown}
                className={`reporting-next-card is-${action.tone} text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50`}
              >
                <ActionIcon className="h-4 w-4" />
                <div>
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="reporting-brief-panel">
        <div className="reporting-brief-main">
          <div className="reporting-eyebrow"><BookOpenCheck className="h-4 w-4" /> Business brief</div>
          <div className="reporting-brief-header">
            <div>
              <h3>{scope === 'team' && hasTeam ? 'Team production story' : 'Agent production story'}</h3>
              <p>
                A fast, clickable readout of where the business is winning, where money is waiting,
                and which relationship risk should be handled first.
              </p>
            </div>
            <button type="button" onClick={exportReport} className="reporting-brief-export">
              <FileSpreadsheet className="h-4 w-4" />
              Export
            </button>
          </div>

          <div className="reporting-brief-grid">
            {reportingBriefCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  type="button"
                  key={card.label}
                  onClick={card.onClick}
                  className={`reporting-brief-card is-${card.tone}`}
                >
                  <span className="reporting-brief-icon"><CardIcon className="h-4 w-4" /></span>
                  <span className="reporting-brief-label">{card.label}</span>
                  <strong>{card.value}</strong>
                  <em>{card.title}</em>
                  <small>{card.detail}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="reporting-proof-panel">
          <div className="reporting-eyebrow"><Pin className="h-4 w-4" /> Seller-ready proof</div>
          <h3>Talking points an agent can use today.</h3>
          <div className="reporting-proof-list">
            {sellerProofPoints.map((proof) => (
              <button type="button" key={proof.label} onClick={proof.onClick} className="reporting-proof-item">
                <span>{proof.label}</span>
                <strong>{proof.value}</strong>
                <small>{proof.detail}</small>
              </button>
            ))}
          </div>
          <div className="reporting-proof-footer">
            <button type="button" onClick={() => setActiveTab('marketing')}>
              <Megaphone className="h-4 w-4" />
              Marketing view
            </button>
            <button type="button" onClick={() => setActiveTab('financials')}>
              <ReceiptText className="h-4 w-4" />
              GCI view
            </button>
          </div>
        </div>
      </section>

      <section className="reporting-report-library">
        <div className="reporting-report-library-head">
          <div>
            <div className="reporting-eyebrow"><Award className="h-4 w-4" /> Agent-ready reports</div>
            <h3>Simple reports agents and team leads can actually use.</h3>
          </div>
          <p>
            Ten focused views for response speed, ROI, recovery, seller proof, coaching,
            pipeline risk, nurture, forecast confidence, and the people behind the numbers.
          </p>
        </div>
        <div className="reporting-report-grid">
          {agentReportCards.map((report) => {
            const ReportIcon = report.icon;
            return (
              <button
                type="button"
                key={report.label}
                onClick={report.onClick}
                className={`reporting-report-card is-${report.tone}`}
              >
                <span className="reporting-report-icon"><ReportIcon className="h-4 w-4" /></span>
                <span>{report.label}</span>
                <strong>{report.value}</strong>
                <small>{report.detail}</small>
              </button>
            );
          })}
        </div>
      </section>

      {/* Hero Stats Bar */}
      <div className="reporting-hero-stats grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeroStat
          label="Total Volume"
          value={formatCurrency(stats.deals.totalVolume || stats.deals.avgDealValue * stats.deals.closedThisMonth)}
          trend={stats.trends?.volumeChange}
          icon={BadgeDollarSign}
          color="emerald"
          onClick={() => openFinancialDrilldown('volume')}
        />
        <HeroStat
          label="Deals Closed"
          value={stats.deals.closedThisMonth.toString()}
          subValue={`of ${stats.goals?.monthlyDealGoal || 10} goal`}
          trend={stats.trends?.dealsChange}
          icon={Trophy}
          color="blue"
          onClick={openPipelineDrilldown}
        />
        <HeroStat
          label="Active Pipeline"
          value={(stats.deals.activeDeals + stats.deals.underContract).toString()}
          subValue={`${stats.deals.underContract} under contract`}
          icon={BarChart3}
          color="purple"
          onClick={openPipelineDrilldown}
        />
        <HeroStat
          label="Conversion Rate"
          value={`${stats.deals.conversionRate}%`}
          trend={stats.trends?.conversionChange}
          icon={Target}
          color="amber"
          onClick={openLeadSourceDrilldown.bind(null, stats.leadSources.topSources[0] || { source: 'All sources', leads: stats.agentActivity.totalLeads, closed: stats.deals.closedThisMonth, conversionRate: stats.deals.conversionRate, volume: totalVolume })}
        />
      </div>

      {/* Controls Row */}
      <div className="reporting-controls-row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'pipeline', label: 'Pipeline', icon: BriefcaseBusiness },
            { id: 'activity', label: 'Activity', icon: Phone },
            { id: 'marketing', label: 'Marketing', icon: Megaphone },
            { id: 'financials', label: 'Financials', icon: BadgeDollarSign },
            { id: 'team', label: 'Team', icon: UsersRound },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`reporting-tab px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-700/60'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
            );
          })}
        </div>

        {/* Time & Scope Controls */}
        <div className="flex items-center gap-3">
          {hasTeam && (
            <div className="reporting-segment inline-flex rounded-xl bg-slate-800/80 border border-slate-700/60 p-1">
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
          
          <div className="reporting-segment inline-flex rounded-xl bg-slate-800/80 border border-slate-700/60 p-1">
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
            className={`reporting-tool-btn px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              hasManualOverrides
                ? 'bg-purple-600/30 border-purple-500/60 text-purple-200 hover:bg-purple-600/40'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:text-white hover:border-slate-600'
            }`}
            title="Add or edit reporting fields manually"
          >
            <span className="inline-flex items-center gap-2"><PenLine className="h-3.5 w-3.5" /> Manual Edit</span>
          </button>

          {hasManualOverrides && (
            <button
              onClick={resetManualEdits}
              className="reporting-tool-btn px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
              title="Clear manual edits"
            >
              Reset Edits
            </button>
          )}

          <button
            onClick={exportReport}
            className="reporting-tool-btn p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-600 transition-all"
            title="Export Report"
          >
            <Download className="h-5 w-5" />
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
                <span className="inline-flex items-center gap-2"><X className="h-3.5 w-3.5" /> Close</span>
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

      {drilldown && (
        <ReportingDrilldownModal drilldown={drilldown} onClose={() => setDrilldown(null)} />
      )}

      {/* AI Insights Banner */}
      {insights.length > 0 && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 border border-purple-500/40 shadow-lg shadow-purple-500/10">
          <div className="flex flex-wrap items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <Lightbulb className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-2">AI Insights</h3>
              <div className="space-y-2">
                {insights.slice(0, 3).map((insight, idx) => {
                  const InsightIcon = insight.type === 'success' ? CheckCircle2 : insight.type === 'warning' ? AlertTriangle : BarChart3;
                  return (
                    <p key={idx} className={`flex items-start gap-2 text-sm ${
                      insight.type === 'success' ? 'text-emerald-300' :
                      insight.type === 'warning' ? 'text-amber-300' : 'text-slate-300'
                    }`}>
                      <InsightIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{insight.text}</span>
                    </p>
                  );
                })}
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
            <button type="button" onClick={openPerformanceDrilldown} className="lg:col-span-1 p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl text-left transition hover:-translate-y-0.5 hover:border-cyan-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
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
            </button>

            {/* Goals Progress */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Monthly Goals</h3>
              <div className="space-y-6">
                <GoalProgress
                  label="Deals Closed"
                  current={stats.goals?.monthlyDeals || stats.deals.closedThisMonth}
                  goal={stats.goals?.monthlyDealGoal || 10}
                  color="cyan"
                  icon={Home}
                  onClick={openGoalsDrilldown}
                />
                <GoalProgress
                  label="Volume"
                  current={stats.goals?.monthlyVolume || stats.deals.totalVolume || 0}
                  goal={stats.goals?.monthlyVolumeGoal || 5000000}
                  format="currency"
                  color="emerald"
                  icon={BadgeDollarSign}
                  onClick={openGoalsDrilldown}
                />
                <GoalProgress
                  label="Weekly Calls"
                  current={stats.goals?.weeklyCalls || stats.calls.totalCalls}
                  goal={stats.goals?.weeklyCallGoal || 75}
                  color="purple"
                  icon={PhoneCall}
                  onClick={openGoalsDrilldown}
                />
                <GoalProgress
                  label="New Leads"
                  current={stats.goals?.weeklyLeads || stats.agentActivity.newLeadsThisWeek}
                  goal={stats.goals?.weeklyLeadGoal || 20}
                  color="amber"
                  icon={UsersRound}
                  onClick={openGoalsDrilldown}
                />
              </div>
            </div>
          </div>

          {/* Financials Summary */}
          {stats.financials && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-cyan-600/25 to-blue-600/30 border border-emerald-500/40 shadow-xl shadow-emerald-500/10">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><BadgeDollarSign className="h-5 w-5 text-emerald-300" /> Financial Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button type="button" onClick={() => openFinancialDrilldown('ytd')} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
                  <div className="text-xs text-slate-300 mb-1">YTD GCI</div>
                  <div className="text-2xl font-bold text-emerald-300">{formatCurrency(stats.financials.ytdGCI)}</div>
                </button>
                <button type="button" onClick={() => openFinancialDrilldown('projected')} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
                  <div className="text-xs text-slate-300 mb-1">Projected Annual</div>
                  <div className="text-2xl font-bold text-cyan-300">{formatCurrency(stats.financials.projectedGCI)}</div>
                </button>
                <button type="button" onClick={() => openFinancialDrilldown('average')} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-left transition hover:-translate-y-0.5 hover:border-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
                  <div className="text-xs text-slate-300 mb-1">Avg Commission</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(stats.financials.avgCommission)}</div>
                </button>
                <button type="button" onClick={() => openFinancialDrilldown('pending')} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-left transition hover:-translate-y-0.5 hover:border-amber-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
                  <div className="text-xs text-slate-300 mb-1">Pending Commission</div>
                  <div className="text-2xl font-bold text-amber-300">{formatCurrency(stats.financials.pendingCommission)}</div>
                </button>
              </div>
            </div>
          )}

          {/* Lead Sources Chart */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><Target className="h-5 w-5 text-amber-300" /> Lead Source Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.leadSources.topSources.map((source, idx) => (
                <button key={source.source} type="button" onClick={() => openLeadSourceDrilldown(source)} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/70 transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RankBadge rank={idx} />
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
                </button>
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
                <FunnelStage label="Total Leads" value={stats.agentActivity.totalLeads} color="slate" width={100} onClick={() => metricAction('/leads')} />
                <FunnelStage label="Active Clients" value={stats.agentActivity.activeClients} color="blue" width={70} onClick={() => metricAction('/clients')} />
                <FunnelStage label="Active Deals" value={stats.deals.activeDeals} color="purple" width={50} onClick={() => metricAction('/deals')} />
                <FunnelStage label="Under Contract" value={stats.deals.underContract} color="amber" width={35} onClick={() => metricAction('/deals')} />
                <FunnelStage label="Closed" value={stats.deals.closedThisMonth} color="emerald" width={25} onClick={() => openFinancialDrilldown('closed')} />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Deal Breakdown</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Buyer Deals" value={stats.deals.buyerDeals || 0} icon={Home} color="cyan" onClick={() => metricAction('/deals')} />
                <StatCard label="Seller Deals" value={stats.deals.sellerDeals || 0} icon={KeyRound} color="purple" onClick={() => metricAction('/deals')} />
                <StatCard label="Avg Days to Close" value={stats.deals.avgDaysToClose || '—'} icon={Clock3} color="amber" onClick={openPipelineDrilldown} />
                <StatCard label="Pending Volume" value={formatCurrency(stats.deals.pendingVolume || 0)} icon={BadgeDollarSign} color="emerald" onClick={() => openFinancialDrilldown('pending')} />
              </div>
            </div>
          </div>

          {/* Client Health */}
          {stats.clientHealth && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6">Client Health</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Hot Leads" value={stats.clientHealth.hotLeads} icon={Flame} color="red" small onClick={() => metricAction('/leads')} />
                <StatCard label="Warm Leads" value={stats.clientHealth.warmLeads} color="amber" small onClick={() => metricAction('/leads')} />
                <StatCard label="Cold Leads" value={stats.clientHealth.coldLeads} color="blue" small onClick={() => metricAction('/leads')} />
                <StatCard label="Needs Follow-up" value={stats.clientHealth.needsFollowUp} color="purple" small onClick={() => metricAction('/tasks')} />
                <StatCard label="Overdue" value={stats.clientHealth.overdueFollowUps} icon={AlertTriangle} color="red" small alert={stats.clientHealth.overdueFollowUps > 0} onClick={openClientHealthDrilldown} />
                <StatCard label="Avg Days Since Contact" value={stats.clientHealth.avgDaysSinceContact} color="slate" small onClick={() => metricAction('/clients')} />
              </div>
            </div>
          )}

          {/* Properties */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6">Listings Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Active Listings" value={stats.properties.activeListings} icon={Home} color="cyan" onClick={() => metricAction('/listings')} />
              <StatCard label="Pending" value={stats.properties.pendingListings || 0} icon={Hourglass} color="amber" onClick={() => metricAction('/listings')} />
              <StatCard label="Sold This Month" value={stats.properties.soldThisMonth} icon={CheckCircle2} color="emerald" onClick={() => metricAction('/listings')} />
              <StatCard label="Total Views" value={formatNumber(stats.properties.totalViews)} icon={Eye} color="purple" onClick={openMarketingDrilldown} />
              <StatCard label="Avg List Price" value={formatCurrency(stats.properties.avgListPrice || 0)} icon={DollarSign} color="blue" onClick={() => metricAction('/listings')} />
              <StatCard label="Avg Sale Price" value={formatCurrency(stats.properties.avgSalePrice || 0)} icon={BadgeDollarSign} color="emerald" onClick={() => metricAction('/listings')} />
              <StatCard label="Avg DOM" value={`${stats.properties.avgDaysOnMarket} days`} icon={CalendarDays} color="slate" onClick={() => metricAction('/listings')} />
              <StatCard label="List/Sale Ratio" value={`${stats.properties.listToSaleRatio || 98}%`} icon={BarChart3} color="cyan" onClick={() => metricAction('/listings')} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-8">
          {/* Call Activity */}
          <div className="reporting-call-panel">
            <div className="reporting-call-summary">
              <div>
                <div className="reporting-eyebrow"><PhoneCall className="h-4 w-4" /> Call activity</div>
                <h3>Call rhythm, recovery, and lead-gen pace in one view.</h3>
                <p>
                  Calls are only useful when they create conversations. This view keeps the chart compact
                  and puts the coaching signals where agents can act on them.
                </p>
              </div>
              <div className="reporting-call-score" style={{ '--call-score': `${todayCallPace}%` } as CSSProperties}>
                <span>{todayCallPace}%</span>
                <small>today pace</small>
              </div>
            </div>

            <div className="reporting-call-body">
              <div className="reporting-call-chart">
                <div className="reporting-call-chart-head">
                  <div>
                    <strong>{stats.calls.totalCalls}</strong>
                    <span>total calls</span>
                  </div>
                  <div>
                    <strong>{avgDailyCalls}</strong>
                    <span>avg/day</span>
                  </div>
                </div>
                <div className="reporting-call-bars">
                  {stats.calls.callsByDay.map((day, index) => {
                    const maxCalls = Math.max(...stats.calls.callsByDay.map(d => d.count), 1);
                    const height = (day.count / maxCalls) * 100;
                    const isToday = index === stats.calls.callsByDay.length - 1;
                    const isBestDay = day.day === bestCallDay.day && day.count === bestCallDay.count;
                    return (
                      <button key={`${day.day}-${index}`} type="button" onClick={openActivityDrilldown} className={`reporting-call-bar ${isToday ? 'is-today' : ''} ${isBestDay ? 'is-best' : ''}`}>
                        <span>{day.count}</span>
                        <i style={{ height: `${Math.max(height, 8)}%` }} />
                        <small>{day.day}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="reporting-call-insights">
                <button type="button" onClick={openSpeedToLeadReport} className="reporting-call-insight is-cyan">
                  <span>Today vs goal</span>
                  <strong>{callsToday} / {callGoalToday}</strong>
                  <small>{todayCallPace >= 100 ? 'Daily call goal is complete' : `${Math.max(0, callGoalToday - callsToday)} more calls to goal`}</small>
                </button>
                <button type="button" onClick={openActivityDrilldown} className="reporting-call-insight is-emerald">
                  <span>Connect quality</span>
                  <strong>{stats.calls.connectRate || 72}%</strong>
                  <small>{stats.calls.avgCallDuration} average duration</small>
                </button>
                <button type="button" onClick={openCracksReport} className={`reporting-call-insight ${callRecoveryCount > 0 ? 'is-rose' : 'is-slate'}`}>
                  <span>Recovery queue</span>
                  <strong>{callRecoveryCount}</strong>
                  <small>{stats.calls.missedCalls} missed calls, {stats.clientHealth?.needsFollowUp || 0} follow-ups</small>
                </button>
                <button type="button" onClick={openWeeklyBriefReport} className="reporting-call-insight is-gold">
                  <span>Best call day</span>
                  <strong>{bestCallDay.day}</strong>
                  <small>{bestCallDay.count} calls logged</small>
                </button>
              </div>
            </div>

            <div className="reporting-call-actions">
              <button type="button" onClick={() => metricAction('/leads')}><UsersRound className="h-4 w-4" /> Call leads</button>
              <button type="button" onClick={() => metricAction('/tasks')}><Clock3 className="h-4 w-4" /> Clear follow-ups</button>
              <button type="button" onClick={() => metricAction('/calendar')}><CalendarDays className="h-4 w-4" /> Book appointments</button>
            </div>
          </div>

          {/* Communication Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><MessageSquare className="h-5 w-5 text-purple-300" /> Text Messages</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Messages" value={stats.texts.totalTexts} color="purple" onClick={openActivityDrilldown} />
                <StatCard label="Response Rate" value={`${stats.texts.responseRate}%`} color="emerald" highlight onClick={openActivityDrilldown} />
                <StatCard label="Sent Today" value={stats.texts.sentToday || 0} color="cyan" onClick={openActivityDrilldown} />
                <StatCard label="Received Today" value={stats.texts.receivedToday || 0} color="blue" onClick={openActivityDrilldown} />
                <StatCard label="Avg Response" value={stats.texts.avgResponseTime} color="amber" onClick={openActivityDrilldown} />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><CalendarDays className="h-5 w-5 text-blue-300" /> Appointments</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total" value={stats.appointments.totalAppointments} color="blue" onClick={() => metricAction('/calendar')} />
                <StatCard label="Upcoming" value={stats.appointments.upcoming} color="cyan" highlight onClick={() => metricAction('/calendar')} />
                <StatCard label="Completed" value={stats.appointments.completed} color="emerald" onClick={openActivityDrilldown} />
                <StatCard label="No-Shows" value={stats.appointments.noShows} color="red" alert={stats.appointments.noShows > 2} onClick={openActivityDrilldown} />
                <StatCard label="Showings This Week" value={stats.appointments.showingsThisWeek || 0} color="purple" onClick={() => metricAction('/calendar')} />
                <StatCard label="Listing Appts" value={stats.appointments.listingApptThisWeek || 0} color="amber" onClick={() => metricAction('/calendar')} />
              </div>
            </div>
          </div>

          {/* Daily Activity Tracking */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><ClipboardList className="h-5 w-5 text-amber-300" /> Daily Activity Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Notes Sent" value={stats.calls.totalNotes || 0} icon={Mail} color="purple" onClick={() => metricAction('/tasks')} />
              <StatCard label="Pop-bys Done" value={stats.calls.totalPopbys || 0} icon={UserPlus} color="emerald" onClick={() => metricAction('/clients')} />
              <StatCard label="Referrals Asked" value={stats.calls.totalReferralsAsked || 0} icon={Handshake} color="cyan" onClick={() => metricAction('/clients')} />
              <StatCard label="Calls Made" value={stats.calls.totalCalls} icon={PhoneCall} color="blue" onClick={openActivityDrilldown} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'marketing' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><Mail className="h-5 w-5 text-purple-300" /> Email Campaigns</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Campaigns" value={stats.marketing.totalCampaigns} color="purple" onClick={() => metricAction('/marketing')} />
                <StatCard label="Sent" value={stats.marketing.sent} color="cyan" onClick={() => metricAction('/marketing')} />
                <StatCard label="Open Rate" value={stats.marketing.openRate ? `${stats.marketing.openRate}%` : '—'} color="emerald" highlight onClick={openMarketingDrilldown} />
                <StatCard label="Click Rate" value={`${stats.marketing.clickRate}%`} color="blue" onClick={openMarketingDrilldown} />
                <StatCard label="Total Clicks" value={stats.marketing.totalClicks} color="amber" onClick={openMarketingDrilldown} />
                <StatCard label="Unsubscribe Rate" value={stats.marketing.unsubscribeRate != null ? `${stats.marketing.unsubscribeRate}%` : '—'} color="slate" onClick={openMarketingDrilldown} />
              </div>
              {stats.marketing.topCampaign && (
                <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-400 mb-1">Top Performing Campaign</div>
                  <div className="text-sm font-medium text-white truncate">{stats.marketing.topCampaign}</div>
                </div>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><Home className="h-5 w-5 text-cyan-300" /> Listing Marketing</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Active Listings" value={stats.properties.activeListings} color="cyan" onClick={() => metricAction('/listings')} />
                <StatCard label="Total Views" value={formatNumber(stats.properties.totalViews)} color="purple" highlight onClick={openMarketingDrilldown} />
                <StatCard label="Avg Views/Listing" value={Math.round(stats.properties.totalViews / Math.max(1, stats.properties.activeListings))} color="blue" onClick={openMarketingDrilldown} />
                <StatCard label="Leads Generated" value={(stats.properties as any).leadsGenerated ?? stats.agentActivity?.totalLeads ?? '—'} color="emerald" onClick={() => metricAction('/leads')} />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => navigate('/marketing')} className="p-4 rounded-xl bg-gradient-to-br from-purple-600/40 to-pink-600/40 border border-purple-500/50 hover:border-purple-400/70 transition-all group shadow-lg shadow-purple-500/20">
              <Mail className="mb-2 h-6 w-6 text-purple-200" />
              <div className="text-sm font-semibold text-white">Create Campaign</div>
              <div className="text-xs text-slate-300">Email blast</div>
            </button>
            <button onClick={() => navigate('/listings')} className="p-4 rounded-xl bg-gradient-to-br from-cyan-600/40 to-blue-600/40 border border-cyan-500/50 hover:border-cyan-400/70 transition-all group shadow-lg shadow-cyan-500/20">
              <Home className="mb-2 h-6 w-6 text-cyan-200" />
              <div className="text-sm font-semibold text-white">New Listing</div>
              <div className="text-xs text-slate-300">Add property</div>
            </button>
            <button onClick={() => navigate('/clients')} className="p-4 rounded-xl bg-gradient-to-br from-emerald-600/40 to-teal-600/40 border border-emerald-500/50 hover:border-emerald-400/70 transition-all group shadow-lg shadow-emerald-500/20">
              <UsersRound className="mb-2 h-6 w-6 text-emerald-200" />
              <div className="text-sm font-semibold text-white">Import Leads</div>
              <div className="text-xs text-slate-300">Add contacts</div>
            </button>
            <button onClick={() => navigate('/settings')} className="p-4 rounded-xl bg-gradient-to-br from-amber-600/40 to-orange-600/40 border border-amber-500/50 hover:border-amber-400/70 transition-all group shadow-lg shadow-amber-500/20">
              <Lightbulb className="mb-2 h-6 w-6 text-amber-200" />
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
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white"><ReceiptText className="h-5 w-5 text-amber-300" /> Tax Planning Estimates</h3>
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
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><BarChart3 className="h-5 w-5 text-cyan-300" /> Quarterly GCI Breakdown</h3>
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
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><CalendarDays className="h-5 w-5 text-emerald-300" /> Monthly GCI</h3>
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
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white"><ClipboardList className="h-5 w-5 text-emerald-300" /> YTD Closed Deals - Commission Log</h3>
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
            <StatCard label="Avg Deal Price" value={formatCurrency(stats.financials.avgDealPrice || stats.deals.avgDealValue)} icon={Home} color="blue" onClick={() => openFinancialDrilldown('average')} />
            <StatCard label="Commission Rate" value={`${stats.financials.commissionRate || 2.5}%`} icon={BarChart3} color="purple" onClick={() => openFinancialDrilldown('rate')} />
            <StatCard label="Deals YTD" value={stats.financials.totalDealsYTD || 0} icon={Handshake} color="cyan" onClick={() => metricAction('/deals')} />
            <StatCard label="YTD Volume" value={formatCurrency(stats.financials.totalVolumeYTD || 0)} icon={BadgeDollarSign} color="emerald" onClick={() => openFinancialDrilldown('volume')} />
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-8">
          {hasTeam && stats.team ? (
            <>
              <div className="reporting-team-intel">
                <div>
                  <div className="reporting-eyebrow"><Crown className="h-4 w-4" /> Team intelligence</div>
                  <h3>See the people, production, and client load behind the team number.</h3>
                  <p>
                    Built for brokers, team leads, and growing agents who need a simple way to spot
                    production leaders, support needs, and revenue momentum without digging through spreadsheets.
                  </p>
                </div>
                <div className="reporting-team-focus-grid">
                  <button type="button" onClick={() => metricAction('/settings')}>
                    <span>Best performer</span>
                    <strong>{stats.team.topAgent || 'Not ranked yet'}</strong>
                  </button>
                  <button type="button" onClick={openActivityDrilldown}>
                    <span>Avg response</span>
                    <strong>{stats.team.avgResponseRate}%</strong>
                  </button>
                  <button type="button" onClick={() => openFinancialDrilldown('team')}>
                    <span>Team volume</span>
                    <strong>{formatCurrency(stats.team.teamVolume || 0)}</strong>
                  </button>
                </div>
              </div>

              {/* Team Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Team Members" value={stats.team.memberCount} icon={UsersRound} color="purple" onClick={() => metricAction('/settings')} />
                <StatCard label="Active Agents" value={stats.team.activeAgents} icon={CheckCircle2} color="emerald" onClick={() => metricAction('/settings')} />
                <StatCard label="Total Clients" value={stats.team.totalClients} icon={Handshake} color="blue" onClick={() => metricAction('/clients')} />
                <StatCard label="Team Volume" value={formatCurrency(stats.team.teamVolume || 0)} icon={BadgeDollarSign} color="cyan" onClick={() => openFinancialDrilldown('team')} />
              </div>

              {/* Leaderboard */}
              {stats.team.leaderboard && stats.team.leaderboard.length > 0 && (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
                  <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white"><Trophy className="h-5 w-5 text-amber-300" /> Leaderboard</h3>
                  <div className="space-y-3">
                    {stats.team.leaderboard.map((member, idx) => (
                      <div key={member.name} className={`flex items-center gap-4 p-4 rounded-xl ${
                        idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30' :
                        idx === 1 ? 'bg-gradient-to-r from-slate-500/20 to-gray-500/10 border border-slate-500/30' :
                        idx === 2 ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 border border-orange-500/30' :
                        'bg-white/5 border border-white/10'
                      }`}>
                        <RankBadge rank={idx} />
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
                    <StatCard label="Closed Deals" value={stats.team.closedDeals} color="emerald" onClick={() => metricAction('/deals')} />
                    <StatCard label="Avg Response Rate" value={`${stats.team.avgResponseRate}%`} color="cyan" onClick={openActivityDrilldown} />
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl">
                  <h3 className="text-lg font-semibold text-white mb-4">Top Performer</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25">
                      <Trophy className="h-7 w-7" />
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
            <div className="reporting-no-team p-12 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-700/50 shadow-xl text-center">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Team Yet</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Solo agents still get full production reporting. When you add teammates, this page unlocks
                production leaderboards, team response visibility, client load, and team GCI reporting.
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
      </div>
    </PageLayout>
  );
}

// Components

function ReportingDrilldownModal({ drilldown, onClose }: { drilldown: ReportingDrilldown; onClose: () => void }) {
  const Icon = drilldown.icon;
  const toneClass = {
    gold: 'border-[#d6b56d]/45 bg-[#d6b56d]/12 text-[#f2d894]',
    cyan: 'border-cyan-400/35 bg-cyan-500/12 text-cyan-200',
    emerald: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
    purple: 'border-purple-400/35 bg-purple-500/12 text-purple-200',
    rose: 'border-rose-400/35 bg-rose-500/12 text-rose-200',
    slate: 'border-slate-400/35 bg-slate-500/12 text-slate-200',
  }[drilldown.tone];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <section className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="border-b border-white/10 bg-slate-900/80 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{drilldown.eyebrow}</div>
                <h3 className="mt-1 text-xl font-bold text-white">{drilldown.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{drilldown.summary}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close report detail">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {drilldown.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{metric.label}</div>
                <div className="mt-2 text-2xl font-bold text-white">{metric.value}</div>
                {metric.detail && <div className="mt-1 text-xs leading-5 text-slate-400">{metric.detail}</div>}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 text-sm font-bold text-white">Recommended read</div>
            <div className="grid gap-3">
              {drilldown.bullets.map((bullet) => (
                <div key={bullet} className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-sm leading-6 text-slate-300">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#f2d894]" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 bg-slate-950/90 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {drilldown.secondaryAction && (
            <button type="button" onClick={drilldown.secondaryAction.onClick} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
              {drilldown.secondaryAction.label}
            </button>
          )}
          <button type="button" onClick={drilldown.primaryAction.onClick} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#d6b56d]/45 bg-[#f2d894] px-4 py-2 text-sm font-bold text-[#171106] hover:brightness-105">
            {drilldown.primaryAction.label}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

function HeroStat({ label, value, subValue, trend, icon, color, onClick }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  icon: LucideIcon;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
  onClick?: () => void;
}) {
  const Icon = icon;
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

  const Component = onClick ? 'button' : 'div';

  return (
    <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`p-5 rounded-2xl bg-gradient-to-br ${colorClasses[color]} border shadow-lg backdrop-blur-md text-left transition ${onClick ? 'hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-300 font-medium mb-1">{label}</div>
          <div className={`text-2xl md:text-3xl font-bold ${textColors[color]}`}>{value}</div>
          {subValue && <div className="text-xs text-slate-400 mt-1">{subValue}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 ${textColors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </div>
      )}
    </Component>
  );
}

function GoalProgress({ label, current, goal, format, color, icon, onClick }: {
  label: string;
  current: number;
  goal: number;
  format?: 'currency';
  color: 'cyan' | 'emerald' | 'purple' | 'amber';
  icon: LucideIcon;
  onClick?: () => void;
}) {
  const Icon = icon;
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

  const Component = onClick ? 'button' : 'div';

  return (
    <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`block w-full text-left ${onClick ? '-m-2 rounded-xl p-2 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
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
    </Component>
  );
}

function FunnelStage({ label, value, color, width, onClick }: {
  label: string;
  value: number;
  color: 'slate' | 'blue' | 'purple' | 'amber' | 'emerald';
  width: number;
  onClick?: () => void;
}) {
  const colorClasses = {
    slate: 'bg-slate-600',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  };
  const Component = onClick ? 'button' : 'div';

  return (
    <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`flex w-full items-center gap-4 rounded-xl text-left ${onClick ? 'transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50' : ''}`}>
      <div className="w-28 text-sm text-slate-400">{label}</div>
      <div className="flex-1">
        <div 
          className={`h-8 ${colorClasses[color]} rounded-lg flex items-center justify-end pr-3 transition-all`}
          style={{ width: `${width}%` }}
        >
          <span className="text-sm font-bold text-white">{value}</span>
        </div>
      </div>
    </Component>
  );
}

function StatCard({ label, value, icon, color, highlight, alert, small, onClick }: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color: 'cyan' | 'emerald' | 'purple' | 'amber' | 'blue' | 'red' | 'slate';
  highlight?: boolean;
  alert?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  const Icon = icon;
  const textColors = {
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    purple: 'text-purple-300',
    amber: 'text-amber-300',
    blue: 'text-blue-300',
    red: 'text-red-400',
    slate: 'text-slate-200',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`p-4 rounded-xl bg-slate-800/70 border text-left transition ${onClick ? 'hover:-translate-y-0.5 hover:border-[#d6b56d]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b56d]/50' : ''} ${alert ? 'border-red-500/60 bg-red-900/30' : highlight ? 'border-cyan-500/50 bg-cyan-900/20' : 'border-slate-700/60'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-300 mb-1">{label}</div>
          <div className={`${small ? 'text-xl' : 'text-2xl'} font-bold ${highlight ? textColors[color] : alert ? 'text-red-400' : 'text-white'}`}>
            {value}
          </div>
        </div>
        {Icon && <Icon className={`h-5 w-5 ${textColors[color]}`} />}
      </div>
    </Component>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const rankMeta = [
    { label: '1', icon: Trophy, className: 'border-amber-400/45 bg-amber-500/20 text-amber-200' },
    { label: '2', icon: Medal, className: 'border-slate-400/45 bg-slate-500/20 text-slate-200' },
    { label: '3', icon: Award, className: 'border-orange-400/45 bg-orange-500/20 text-orange-200' },
  ][rank];

  if (!rankMeta) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-slate-800/70 text-xs font-bold text-slate-300">
        #{rank + 1}
      </span>
    );
  }

  const RankIcon = rankMeta.icon;
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${rankMeta.className}`} title={`Rank ${rankMeta.label}`}>
      <RankIcon className="h-4 w-4" />
    </span>
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
