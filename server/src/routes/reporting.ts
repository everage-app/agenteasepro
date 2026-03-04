import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const timeRangeSchema = z.enum(['week', 'month', 'quarter', 'year']);

/* ------------------------------------------------------------------ */
/*  Safe-query helper: wraps a Prisma call so one failure won't crash */
/* ------------------------------------------------------------------ */
async function sq<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[reporting] query failed:', (err as Error).message);
    return fallback;
  }
}

const DEFAULT_COMM_RATE = 2.5;

function calcCommission(repc: { purchasePrice: any; sellerCompensationContributionPercent: any; sellerCompensationContributionFlat: any } | null): number {
  if (!repc) return 0;
  const price = Number(repc.purchasePrice) || 0;
  if (repc.sellerCompensationContributionFlat && Number(repc.sellerCompensationContributionFlat) > 0) {
    return Number(repc.sellerCompensationContributionFlat);
  }
  const pct = Number(repc.sellerCompensationContributionPercent) || DEFAULT_COMM_RATE;
  return price * (pct / 100);
}

function dealPrice(repc: { purchasePrice: any } | null): number {
  return repc ? Number(repc.purchasePrice) || 0 : 0;
}

const buildEmptyStats = () => ({
  agentActivity: {
    totalLeads: 0,
    newLeadsThisWeek: 0,
    activeClients: 0,
    closedDealsThisMonth: 0,
    totalClientsAllTime: 0,
    avgLeadsPerWeek: 0,
  },
  calls: {
    totalCalls: 0,
    missedCalls: 0,
    avgCallDuration: '0:00',
    callsByDay: [],
    connectRate: 0,
    callsToday: 0,
    callGoalToday: 15,
  },
  texts: {
    totalTexts: 0,
    responseRate: 0,
    avgResponseTime: '0m',
    sentToday: 0,
    receivedToday: 0,
  },
  appointments: {
    totalAppointments: 0,
    upcoming: 0,
    completed: 0,
    noShows: 0,
    showingsThisWeek: 0,
    listingApptThisWeek: 0,
  },
  deals: {
    activeDeals: 0,
    underContract: 0,
    closedThisMonth: 0,
    avgDealValue: 0,
    conversionRate: 0,
    totalVolume: 0,
    pendingVolume: 0,
    avgDaysToClose: 0,
    buyerDeals: 0,
    sellerDeals: 0,
  },
  leadSources: {
    topSources: [],
  },
  marketing: {
    totalCampaigns: 0,
    sent: 0,
    totalClicks: 0,
    clickRate: 0,
    openRate: 0,
    unsubscribeRate: 0,
    topCampaign: 'No campaigns yet',
  },
  properties: {
    activeListings: 0,
    soldThisMonth: 0,
    avgDaysOnMarket: 0,
    totalViews: 0,
    pendingListings: 0,
    avgListPrice: 0,
    avgSalePrice: 0,
    listToSaleRatio: 0,
  },
  team: {
    memberCount: 1,
    activeAgents: 1,
    totalClients: 0,
    closedDeals: 0,
    avgResponseRate: 0,
    topAgent: 'You',
    teamVolume: 0,
    leaderboard: [],
  },
  goals: {
    monthlyDealGoal: 10,
    monthlyDeals: 0,
    monthlyVolumeGoal: 5000000,
    monthlyVolume: 0,
    weeklyCallGoal: 75,
    weeklyCalls: 0,
    weeklyLeadGoal: 20,
    weeklyLeads: 0,
  },
  trends: {
    weeklyTrend: [
      { week: 'Week 1', leads: 0, deals: 0, calls: 0 },
      { week: 'Week 2', leads: 0, deals: 0, calls: 0 },
      { week: 'Week 3', leads: 0, deals: 0, calls: 0 },
      { week: 'Week 4', leads: 0, deals: 0, calls: 0 },
    ],
    dealsChange: 0,
    leadsChange: 0,
    volumeChange: 0,
    conversionChange: 0,
  },
  clientHealth: {
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    needsFollowUp: 0,
    overdueFollowUps: 0,
    avgDaysSinceContact: 0,
  },
  financials: {
    ytdGCI: 0,
    projectedGCI: 0,
    avgCommission: 0,
    pendingCommission: 0,
    commissionRate: 2.5,
    quarterlyGCI: { q1: 0, q2: 0, q3: 0, q4: 0 },
    monthlyGCI: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    totalDealsYTD: 0,
    avgDealPrice: 0,
    totalVolumeYTD: 0,
    estimatedSETax: 0,
    estimatedQuarterlyTax: 0,
    closedDealsList: [] as { title: string; closedDate: string; purchasePrice: number; commission: number; type: 'buyer' | 'seller' | 'dual' }[],
  },
});

// Generate realistic demo stats when agent has no data
const buildDemoStats = (timeRange: string) => {
  const multiplier = timeRange === 'week' ? 1 : timeRange === 'month' ? 4 : timeRange === 'quarter' ? 12 : 52;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const callsByDay = days.map((day, idx) => ({
    day,
    count: [8, 12, 15, 11, 14, 6, 3][idx],
  }));

  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const weeklyTrend = weeks.map((week, idx) => ({
    week,
    leads: [12, 15, 11, 18][idx],
    deals: [1, 2, 1, 3][idx],
    calls: [45, 52, 48, 61][idx],
  }));

  return {
    agentActivity: {
      totalLeads: 156,
      newLeadsThisWeek: 18,
      activeClients: 34,
      closedDealsThisMonth: 7,
      totalClientsAllTime: 423,
      avgLeadsPerWeek: 14,
    },
    calls: {
      totalCalls: Math.round(68 * (multiplier / 4)),
      missedCalls: 4,
      avgCallDuration: '4:32',
      callsByDay,
      connectRate: 72,
      callsToday: 8,
      callGoalToday: 15,
    },
    texts: {
      totalTexts: Math.round(245 * (multiplier / 4)),
      responseRate: 87,
      avgResponseTime: '8m',
      sentToday: 23,
      receivedToday: 18,
    },
    appointments: {
      totalAppointments: Math.round(28 * (multiplier / 4)),
      upcoming: 8,
      completed: 18,
      noShows: 2,
      showingsThisWeek: 12,
      listingApptThisWeek: 3,
    },
    deals: {
      activeDeals: 12,
      underContract: 5,
      closedThisMonth: 7,
      avgDealValue: 485000,
      conversionRate: 22.4,
      totalVolume: 3395000,
      pendingVolume: 2425000,
      avgDaysToClose: 38,
      buyerDeals: 8,
      sellerDeals: 4,
    },
    leadSources: {
      topSources: [
        { source: 'Referral', leads: 42, closed: 14, conversionRate: 33.3, volume: 1250000 },
        { source: 'Zillow', leads: 38, closed: 6, conversionRate: 15.8, volume: 720000 },
        { source: 'Realtor.com', leads: 28, closed: 4, conversionRate: 14.3, volume: 580000 },
        { source: 'Open House', leads: 24, closed: 5, conversionRate: 20.8, volume: 485000 },
        { source: 'Sphere', leads: 18, closed: 6, conversionRate: 33.3, volume: 360000 },
        { source: 'Social Media', leads: 6, closed: 1, conversionRate: 16.7, volume: 0 },
      ],
    },
    marketing: {
      totalCampaigns: 12,
      sent: 9,
      totalClicks: 284,
      clickRate: 12.4,
      openRate: 38.2,
      unsubscribeRate: 0.8,
      topCampaign: 'New Listing Alert - 123 Main St',
    },
    properties: {
      activeListings: 8,
      soldThisMonth: 4,
      avgDaysOnMarket: 21,
      totalViews: 3420,
      pendingListings: 3,
      avgListPrice: 525000,
      avgSalePrice: 512000,
      listToSaleRatio: 97.5,
    },
    team: {
      memberCount: 4,
      activeAgents: 3,
      totalClients: 89,
      closedDeals: 18,
      avgResponseRate: 84,
      topAgent: 'Sarah Johnson',
      teamVolume: 8750000,
      leaderboard: [
        { name: 'Sarah Johnson', deals: 8, volume: 3950000, avatar: null, gci: 98750 },
        { name: 'Mike Chen', deals: 6, volume: 2800000, avatar: null, gci: 70000 },
        { name: 'Lisa Park', deals: 4, volume: 2000000, avatar: null, gci: 50000 },
      ],
    },
    goals: {
      monthlyDealGoal: 10,
      monthlyDeals: 7,
      monthlyVolumeGoal: 5000000,
      monthlyVolume: 3395000,
      weeklyCallGoal: 75,
      weeklyCalls: 68,
      weeklyLeadGoal: 20,
      weeklyLeads: 18,
    },
    trends: {
      weeklyTrend,
      dealsChange: 16.7,
      leadsChange: 12.5,
      volumeChange: 24.3,
      conversionChange: 2.1,
    },
    clientHealth: {
      hotLeads: 8,
      warmLeads: 14,
      coldLeads: 12,
      needsFollowUp: 6,
      overdueFollowUps: 2,
      avgDaysSinceContact: 4,
    },
    financials: {
      ytdGCI: 187500,
      projectedGCI: 312000,
      avgCommission: 12500,
      pendingCommission: 72500,
      commissionRate: 2.5,
      quarterlyGCI: { q1: 62500, q2: 75000, q3: 50000, q4: 0 },
      monthlyGCI: [18750, 21250, 22500, 25000, 28000, 22000, 25000, 12500, 12500, 0, 0, 0],
      totalDealsYTD: 15,
      avgDealPrice: 485000,
      totalVolumeYTD: 7275000,
      estimatedSETax: 28688,
      estimatedQuarterlyTax: 18750,
      closedDealsList: [
        { title: '456 Elm St — Davis', closedDate: '2026-02-12', purchasePrice: 475000, commission: 11875, type: 'buyer' as const },
        { title: '789 Oak Ave — Summit', closedDate: '2026-01-28', purchasePrice: 520000, commission: 13000, type: 'seller' as const },
        { title: '321 Pine Rd — Utah', closedDate: '2026-01-15', purchasePrice: 390000, commission: 9750, type: 'buyer' as const },
      ],
    },
  };
};

// Get comprehensive reporting overview
router.get('/overview', async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    if (!agentId) return res.json(buildEmptyStats());

    const timeRange = timeRangeSchema.parse(req.query.timeRange || 'month');

    // ---- Date ranges ----
    const now = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case 'week':    startDate.setDate(now.getDate() - 7); break;
      case 'month':   startDate.setMonth(now.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'year':    startDate.setFullYear(now.getFullYear() - 1); break;
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const monthsElapsed = now.getMonth() + 1;

    // ================================================================
    //  AGENT ACTIVITY
    // ================================================================
    const totalLeads = await sq(() => prisma.client.count({ where: { agentId } }), 0);

    const newLeadsThisWeek = await sq(() => prisma.client.count({
      where: { agentId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    }), 0);

    const activeClients = await sq(() => prisma.client.count({
      where: { agentId, stage: { in: ['ACTIVE', 'UNDER_CONTRACT'] } },
    }), 0);

    const closedDealsThisMonth = await sq(() => prisma.deal.count({
      where: { agentId, status: 'CLOSED', closedAt: { gte: monthStart } },
    }), 0);

    // ================================================================
    //  CALL & ACTIVITY STATS (DailyActivity)
    // ================================================================
    const callActivities = await sq(() => prisma.dailyActivity.findMany({
      where: { agentId, date: { gte: startDate } },
      select: { date: true, callsMade: true, callsGoal: true, notesSent: true, popbysDone: true, referralsAsked: true },
      orderBy: { date: 'asc' },
    }), []);

    const totalCalls = callActivities.reduce((s, a) => s + (a.callsMade || 0), 0);
    const totalNotes = callActivities.reduce((s, a) => s + (a.notesSent || 0), 0);
    const totalPopbys = callActivities.reduce((s, a) => s + (a.popbysDone || 0), 0);
    const totalReferralsAsked = callActivities.reduce((s, a) => s + (a.referralsAsked || 0), 0);
    const callsByDay = callActivities.slice(-7).map(a => ({
      day: a.date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: a.callsMade || 0,
    }));

    // ================================================================
    //  APPOINTMENT STATS (Task-based proxy)
    // ================================================================
    const allTasks = await sq(() => prisma.task.findMany({
      where: { agentId, dueAt: { gte: startDate } },
      select: { title: true, category: true, status: true, dueAt: true },
    }), []);

    const showingTasks  = allTasks.filter(t => /show|tour|view/i.test(t.title) || t.category === 'EVENT');
    const listingAppts  = allTasks.filter(t => /listing\s*(appointment|appt|presentation)/i.test(t.title));
    const totalAppointments = showingTasks.length + listingAppts.length;
    const upcoming     = [...showingTasks, ...listingAppts].filter(t => t.dueAt && t.dueAt >= now).length;
    const completed    = [...showingTasks, ...listingAppts].filter(t => t.status === 'DONE').length;
    const noShows      = Math.max(0, totalAppointments - completed - upcoming);

    // ================================================================
    //  DEALS — Real data from Deal + Repc
    // ================================================================
    const repcSelect = {
      purchasePrice: true as const,
      sellerCompensationContributionPercent: true as const,
      sellerCompensationContributionFlat: true as const,
    };

    const activeDeals = await sq(() => prisma.deal.count({
      where: { agentId, status: 'ACTIVE', archivedAt: null },
    }), 0);

    const underContract = await sq(() => prisma.deal.count({
      where: { agentId, status: { in: ['UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING', 'SETTLEMENT_SCHEDULED'] }, archivedAt: null },
    }), 0);

    const closedDeals = await sq(() => prisma.deal.findMany({
      where: { agentId, status: 'CLOSED', closedAt: { gte: startDate } },
      include: {
        repc: { select: repcSelect },
        property: { select: { street: true, city: true, county: true } },
      },
      orderBy: { closedAt: 'desc' },
    }), []);

    const ytdClosedDeals = await sq(() => prisma.deal.findMany({
      where: { agentId, status: 'CLOSED', closedAt: { gte: yearStart } },
      include: {
        repc: { select: repcSelect },
        property: { select: { street: true, city: true, county: true } },
      },
      orderBy: { closedAt: 'desc' },
    }), []);

    const pendingDeals = await sq(() => prisma.deal.findMany({
      where: {
        agentId,
        status: { in: ['UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING', 'SETTLEMENT_SCHEDULED'] },
        archivedAt: null,
      },
      include: { repc: { select: repcSelect } },
    }), []);

    const buyerDealCount = await sq(() => prisma.deal.count({
      where: { agentId, buyerId: { not: null }, status: { notIn: ['FELL_THROUGH'] }, archivedAt: null },
    }), 0);
    const sellerDealCount = await sq(() => prisma.deal.count({
      where: { agentId, sellerId: { not: null }, status: { notIn: ['FELL_THROUGH'] }, archivedAt: null },
    }), 0);

    // ---- Compute deal value averages ----
    const closedPrices = closedDeals.map(d => dealPrice(d.repc)).filter(p => p > 0);
    const avgDealValue = closedPrices.length > 0
      ? Math.round(closedPrices.reduce((s, p) => s + p, 0) / closedPrices.length) : 0;

    const daysToCloseArr = closedDeals
      .filter(d => d.closedAt && d.createdAt)
      .map(d => Math.floor((d.closedAt!.getTime() - d.createdAt.getTime()) / 86400000));
    const avgDaysToClose = daysToCloseArr.length > 0
      ? Math.round(daysToCloseArr.reduce((s, d) => s + d, 0) / daysToCloseArr.length) : 0;

    const totalVolume   = closedDeals.reduce((s, d) => s + dealPrice(d.repc), 0);
    const pendingVolume = pendingDeals.reduce((s, d) => s + dealPrice(d.repc), 0);
    const conversionRate = totalLeads > 0 ? Math.round((closedDeals.length / totalLeads) * 1000) / 10 : 0;

    // ================================================================
    //  LEAD SOURCES
    // ================================================================
    const allClients = await sq(() => prisma.client.findMany({
      where: { agentId },
      select: { leadSource: true, id: true },
    }), []);

    const clientsBySource: Record<string, string[]> = {};
    for (const c of allClients) {
      const src = c.leadSource || 'Unknown';
      (clientsBySource[src] ||= []).push(c.id);
    }

    const closedClientIds = new Set<string>();
    for (const d of closedDeals) {
      if ((d as any).buyerId) closedClientIds.add((d as any).buyerId);
      if ((d as any).sellerId) closedClientIds.add((d as any).sellerId);
    }

    const topSources = Object.entries(clientsBySource)
      .map(([source, ids]) => {
        const closed = ids.filter(id => closedClientIds.has(id)).length;
        return {
          source, leads: ids.length, closed,
          conversionRate: ids.length > 0 ? Math.round((closed / ids.length) * 1000) / 10 : 0,
          volume: closed * (avgDealValue || 0),
        };
      })
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 6);

    // ================================================================
    //  MARKETING STATS — real data from email events
    // ================================================================
    const marketingBlasts = await sq(() => prisma.marketingBlast.findMany({
      where: { agentId, createdAt: { gte: startDate } },
      include: { channels: true },
    }), []);

    const totalCampaigns = marketingBlasts.length;
    const sentCampaigns  = marketingBlasts.filter(b => b.status === 'SENT').length;
    const totalClicks    = marketingBlasts.reduce((s, b) =>
      s + b.channels.reduce((cs, c) => cs + (c.clicks || 0), 0), 0);

    const emailEvents = await sq(() => prisma.marketingEmailEvent.findMany({
      where: { agentId, occurredAt: { gte: startDate } },
      select: { eventType: true },
    }), []);

    const totalDelivered = emailEvents.filter(e => e.eventType === 'delivered').length;
    const totalOpened    = emailEvents.filter(e => e.eventType === 'open').length;
    const totalClickedEv = emailEvents.filter(e => e.eventType === 'click').length;
    const totalUnsubs    = emailEvents.filter(e => e.eventType === 'unsubscribe').length;

    const openRate   = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 1000) / 10 : 0;
    const clickRate  = totalDelivered > 0 ? Math.round((totalClickedEv / totalDelivered) * 1000) / 10 : 0;
    const unsubRate  = totalDelivered > 0 ? Math.round((totalUnsubs / totalDelivered) * 1000) / 10 : 0;

    // ================================================================
    //  PROPERTY / LISTING STATS
    // ================================================================
    const activeListings = await sq(() => prisma.listing.count({
      where: { agentId, status: 'ACTIVE' },
    }), 0);

    const pendingListingsCount = await sq(() => prisma.listing.count({
      where: { agentId, status: { in: ['PENDING', 'UNDER_CONTRACT'] } },
    }), 0);

    const soldThisMonth = await sq(() => prisma.listing.count({
      where: { agentId, status: 'SOLD', updatedAt: { gte: monthStart } },
    }), 0);

    const soldListings = await sq(() => prisma.listing.findMany({
      where: { agentId, status: 'SOLD' },
      select: { createdAt: true, updatedAt: true, price: true },
    }), []);

    const avgDaysOnMarket = soldListings.length > 0
      ? Math.round(soldListings.reduce((s, l) =>
          s + Math.floor((l.updatedAt.getTime() - l.createdAt.getTime()) / 86400000), 0) / soldListings.length)
      : 0;

    const activeListingPrices = await sq(() => prisma.listing.findMany({
      where: { agentId, status: { in: ['ACTIVE', 'PENDING', 'UNDER_CONTRACT'] } },
      select: { price: true },
    }), []);
    const avgListPrice = activeListingPrices.length > 0
      ? Math.round(activeListingPrices.reduce((s, l) => s + l.price, 0) / activeListingPrices.length) : 0;
    const avgSalePrice = soldListings.length > 0
      ? Math.round(soldListings.reduce((s, l) => s + l.price, 0) / soldListings.length) : 0;
    const listToSaleRatio = avgListPrice > 0 && avgSalePrice > 0
      ? Math.round((avgSalePrice / avgListPrice) * 1000) / 10 : 0;

    const totalViews = await sq(async () => {
      const r = await prisma.listing.aggregate({
        where: { agentId },
        _sum: { totalClicks: true },
      });
      return r._sum.totalClicks || 0;
    }, 0);

    // ================================================================
    //  TEAM TRACKING — agents with the same brokerage
    // ================================================================
    const agent = await sq(() => prisma.agent.findUnique({
      where: { id: agentId },
      select: { email: true, name: true, brokerageName: true },
    }), null);

    let teamMembers: { id: string; name: string; email: string }[] = [];
    if (agent?.brokerageName) {
      teamMembers = await sq(() => prisma.agent.findMany({
        where: { brokerageName: agent!.brokerageName!, status: 'ACTIVE' },
        select: { id: true, name: true, email: true },
      }), []);
    }
    if (teamMembers.length === 0 && agent) {
      teamMembers = [{ id: agentId, name: agent.name, email: agent.email }];
    }

    const leaderboard: { name: string; deals: number; volume: number; avatar: null; gci: number }[] = [];
    let teamTotalClients = 0;
    let teamClosedDeals  = 0;
    let teamVolume       = 0;

    for (const member of teamMembers) {
      const memberClosed = await sq(() => prisma.deal.findMany({
        where: { agentId: member.id, status: 'CLOSED', closedAt: { gte: startDate } },
        include: { repc: { select: repcSelect } },
      }), []);
      const memberClients = await sq(() => prisma.client.count({ where: { agentId: member.id } }), 0);

      const vol = memberClosed.reduce((s, d) => s + dealPrice(d.repc), 0);
      const gci = memberClosed.reduce((s, d) => s + calcCommission(d.repc), 0);

      teamTotalClients += memberClients;
      teamClosedDeals  += memberClosed.length;
      teamVolume       += vol;

      leaderboard.push({ name: member.name, deals: memberClosed.length, volume: Math.round(vol), avatar: null, gci: Math.round(gci) });
    }
    leaderboard.sort((a, b) => b.volume - a.volume);
    const topAgentName = leaderboard.length > 0 ? leaderboard[0].name : (agent?.name || 'You');

    // ================================================================
    //  CLIENT HEALTH
    // ================================================================
    const clientTemps = await sq(() => prisma.client.groupBy({
      by: ['temperature'],
      where: { agentId, stage: { in: ['NEW_LEAD', 'NURTURE', 'ACTIVE'] } },
      _count: true,
    }), []);

    const hotLeads  = clientTemps.find(c => c.temperature === 'HOT')?._count  || 0;
    const warmLeads = clientTemps.find(c => c.temperature === 'WARM')?._count || 0;
    const coldLeads = clientTemps.find(c => c.temperature === 'COLD')?._count || 0;

    const sevenDaysAgo    = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const needsFollowUp = await sq(() => prisma.client.count({
      where: {
        agentId, stage: { in: ['NEW_LEAD', 'NURTURE', 'ACTIVE'] },
        OR: [{ lastContactAt: { lt: sevenDaysAgo } }, { lastContactAt: null }],
      },
    }), 0);

    const overdueFollowUps = await sq(() => prisma.client.count({
      where: {
        agentId, stage: { in: ['NEW_LEAD', 'NURTURE', 'ACTIVE'] },
        OR: [{ lastContactAt: { lt: fourteenDaysAgo } }, { lastContactAt: null, createdAt: { lt: sevenDaysAgo } }],
      },
    }), 0);

    const clientContacts = await sq(() => prisma.client.findMany({
      where: { agentId, stage: { in: ['NEW_LEAD', 'NURTURE', 'ACTIVE'] }, lastContactAt: { not: null } },
      select: { lastContactAt: true },
    }), []);
    const avgDaysSinceContact = clientContacts.length > 0
      ? Math.round(clientContacts.reduce((s, c) =>
          s + Math.floor((now.getTime() - c.lastContactAt!.getTime()) / 86400000), 0) / clientContacts.length)
      : 0;

    // ================================================================
    //  FINANCIALS & TAX DATA
    // ================================================================
    const ytdGCI = ytdClosedDeals.reduce((s, d) => s + calcCommission(d.repc), 0);
    const ytdVolume = ytdClosedDeals.reduce((s, d) => s + dealPrice(d.repc), 0);
    const ytdAvgComm = ytdClosedDeals.length > 0 ? Math.round(ytdGCI / ytdClosedDeals.length) : 0;

    const commRates = ytdClosedDeals.filter(d => d.repc).map(d => Number(d.repc!.sellerCompensationContributionPercent) || DEFAULT_COMM_RATE);
    const avgCommRate = commRates.length > 0
      ? Math.round((commRates.reduce((s, r) => s + r, 0) / commRates.length) * 10) / 10
      : DEFAULT_COMM_RATE;

    const pendingCommission = pendingDeals.reduce((s, d) => s + calcCommission(d.repc), 0);
    const projectedGCI = monthsElapsed > 0 ? Math.round((ytdGCI / monthsElapsed) * 12) : 0;

    const quarterlyGCI = { q1: 0, q2: 0, q3: 0, q4: 0 };
    const monthlyGCI = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const deal of ytdClosedDeals) {
      if (!deal.closedAt) continue;
      const m = deal.closedAt.getMonth();
      const comm = calcCommission(deal.repc);
      monthlyGCI[m] += comm;
      if (m < 3) quarterlyGCI.q1 += comm;
      else if (m < 6) quarterlyGCI.q2 += comm;
      else if (m < 9) quarterlyGCI.q3 += comm;
      else quarterlyGCI.q4 += comm;
    }
    for (const k of ['q1', 'q2', 'q3', 'q4'] as const) quarterlyGCI[k] = Math.round(quarterlyGCI[k]);
    for (let i = 0; i < 12; i++) monthlyGCI[i] = Math.round(monthlyGCI[i]);

    const seBase = ytdGCI * 0.9235;
    const estimatedSETax = Math.round(seBase * 0.153);
    const estimatedQuarterlyTax = Math.round((projectedGCI * 0.25) / 4);

    const closedDealsList = ytdClosedDeals.slice(0, 50).map(d => ({
      title: d.property ? `${d.property.street} — ${d.property.county || d.property.city}` : d.title,
      closedDate: d.closedAt ? d.closedAt.toISOString().split('T')[0] : '',
      purchasePrice: dealPrice(d.repc),
      commission: Math.round(calcCommission(d.repc)),
      type: ((d as any).buyerId && (d as any).sellerId ? 'dual' : (d as any).sellerId ? 'seller' : 'buyer') as 'buyer' | 'seller' | 'dual',
    }));

    // ================================================================
    //  TRENDS
    // ================================================================
    const rangeDays = Math.floor((now.getTime() - startDate.getTime()) / 86400000);
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - rangeDays);

    const prevClosedCount = await sq(() => prisma.deal.count({
      where: { agentId, status: 'CLOSED', closedAt: { gte: prevStart, lt: startDate } },
    }), 0);
    const prevLeadCount = await sq(() => prisma.client.count({
      where: { agentId, createdAt: { gte: prevStart, lt: startDate } },
    }), 0);
    const currentLeadCount = await sq(() => prisma.client.count({
      where: { agentId, createdAt: { gte: startDate } },
    }), 0);
    const prevClosedForVol = await sq(() => prisma.deal.findMany({
      where: { agentId, status: 'CLOSED', closedAt: { gte: prevStart, lt: startDate } },
      include: { repc: { select: { purchasePrice: true } } },
    }), []);
    const prevVolume = prevClosedForVol.reduce((s, d) => s + dealPrice(d.repc), 0);

    const dealsChange  = prevClosedCount > 0 ? Math.round(((closedDeals.length - prevClosedCount) / prevClosedCount) * 1000) / 10 : 0;
    const leadsChange  = prevLeadCount > 0 ? Math.round(((currentLeadCount - prevLeadCount) / prevLeadCount) * 1000) / 10 : 0;
    const volumeChange = prevVolume > 0 ? Math.round(((totalVolume - prevVolume) / prevVolume) * 1000) / 10 : 0;

    const weeklyTrend = [1, 2, 3, 4].map(w => {
      const wEnd   = new Date(now.getTime() - (4 - w) * 7 * 86400000);
      const wStart = new Date(wEnd.getTime() - 7 * 86400000);
      return {
        week: `Week ${w}`,
        leads: Math.max(0, Math.round(currentLeadCount / 4)),
        deals: Math.max(0, Math.round(closedDeals.length / 4)),
        calls: callActivities.filter(a => a.date >= wStart && a.date < wEnd).reduce((s, a) => s + (a.callsMade || 0), 0),
      };
    });

    // ================================================================
    //  CHECK FOR DATA
    // ================================================================
    const hasAnyData = totalLeads > 0 || activeDeals > 0 || callActivities.length > 0
      || marketingBlasts.length > 0 || activeListings > 0 || allTasks.length > 0;

    const demoEmail = String(process.env.DEMO_LOGIN_EMAIL || 'demo@agentease.com').toLowerCase();
    const isDemoAccount = (agent?.email || '').toLowerCase() === demoEmail;

    if (!hasAnyData) {
      return res.json(isDemoAccount ? buildDemoStats(timeRange) : buildEmptyStats());
    }

    // ================================================================
    //  BUILD RESPONSE
    // ================================================================
    const stats = {
      agentActivity: {
        totalLeads,
        newLeadsThisWeek,
        activeClients,
        closedDealsThisMonth,
        totalClientsAllTime: totalLeads,
        avgLeadsPerWeek: Math.round(totalLeads / Math.max(1, monthsElapsed * 4)),
      },
      calls: {
        totalCalls,
        missedCalls: 0,
        avgCallDuration: '—',
        callsByDay,
        connectRate: 0,
        callsToday: callsByDay.length > 0 ? callsByDay[callsByDay.length - 1]?.count || 0 : 0,
        callGoalToday: callActivities.length > 0 ? callActivities[callActivities.length - 1]?.callsGoal || 15 : 15,
        totalNotes,
        totalPopbys,
        totalReferralsAsked,
      },
      texts: {
        totalTexts: 0,
        responseRate: 0,
        avgResponseTime: '—',
        sentToday: 0,
        receivedToday: 0,
      },
      appointments: {
        totalAppointments,
        upcoming,
        completed,
        noShows,
        showingsThisWeek: showingTasks.filter(t => t.dueAt && t.dueAt >= new Date(Date.now() - 7 * 86400000)).length,
        listingApptThisWeek: listingAppts.filter(t => t.dueAt && t.dueAt >= new Date(Date.now() - 7 * 86400000)).length,
      },
      deals: {
        activeDeals,
        underContract,
        closedThisMonth: closedDeals.length,
        avgDealValue,
        conversionRate,
        totalVolume: Math.round(totalVolume),
        pendingVolume: Math.round(pendingVolume),
        avgDaysToClose,
        buyerDeals: buyerDealCount,
        sellerDeals: sellerDealCount,
      },
      leadSources: { topSources },
      marketing: {
        totalCampaigns,
        sent: sentCampaigns,
        totalClicks,
        clickRate,
        openRate,
        unsubscribeRate: unsubRate,
        topCampaign: marketingBlasts[0]?.title || 'No campaigns yet',
      },
      properties: {
        activeListings,
        soldThisMonth,
        avgDaysOnMarket,
        totalViews,
        pendingListings: pendingListingsCount,
        avgListPrice,
        avgSalePrice,
        listToSaleRatio,
      },
      team: {
        memberCount: teamMembers.length,
        activeAgents: teamMembers.length,
        totalClients: teamTotalClients,
        closedDeals: teamClosedDeals,
        avgResponseRate: 0,
        topAgent: topAgentName,
        teamVolume: Math.round(teamVolume),
        leaderboard,
      },
      goals: {
        monthlyDealGoal: 10,
        monthlyDeals: closedDeals.length,
        monthlyVolumeGoal: 5000000,
        monthlyVolume: Math.round(totalVolume),
        weeklyCallGoal: callActivities.length > 0 ? (callActivities[0]?.callsGoal || 5) * 7 : 75,
        weeklyCalls: totalCalls,
        weeklyLeadGoal: 20,
        weeklyLeads: newLeadsThisWeek,
      },
      trends: {
        weeklyTrend,
        dealsChange,
        leadsChange,
        volumeChange,
        conversionChange: 0,
      },
      clientHealth: {
        hotLeads,
        warmLeads,
        coldLeads,
        needsFollowUp,
        overdueFollowUps,
        avgDaysSinceContact,
      },
      financials: {
        ytdGCI: Math.round(ytdGCI),
        projectedGCI,
        avgCommission: ytdAvgComm,
        pendingCommission: Math.round(pendingCommission),
        commissionRate: avgCommRate,
        quarterlyGCI,
        monthlyGCI,
        totalDealsYTD: ytdClosedDeals.length,
        avgDealPrice: avgDealValue,
        totalVolumeYTD: Math.round(ytdVolume),
        estimatedSETax,
        estimatedQuarterlyTax,
        closedDealsList,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching reporting data:', error);
    res.json(buildEmptyStats());
  }
});

export default router;
