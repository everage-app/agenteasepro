import { DealEventType, EventCreatedFrom } from '@prisma/client';
import { getGoogleCalendarEventsForRange } from './googleCalendarService';
import { prisma } from '../lib/prisma';

// Unified calendar event types for Calendar v2
export enum UnifiedEventType {
  DEAL_EVENT = 'DEAL_EVENT',
  TASK = 'TASK',
  LISTING_EVENT = 'LISTING_EVENT',
  MARKETING_BLAST = 'MARKETING_BLAST',
  GOOGLE_CALENDAR = 'GOOGLE_CALENDAR',
}

interface AgendaDay {
  date: string;
  events: Array<{
    id: string;
    type: DealEventType;
    title: string;
    description: string | null;
    dealId: string;
    dealTitle: string;
    propertyAddress?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dealId: string | null;
    clientId: string | null;
    status: string;
  }>;
}

// Calendar v2 unified event structure
export interface UnifiedCalendarEvent {
  id: string;
  type: UnifiedEventType;
  title: string;
  description?: string;
  date: Date;
  status?: string;
  category?: string;
  priority?: string;
  
  // Related entities
  dealId?: string;
  dealTitle?: string;
  clientId?: string;
  clientName?: string;
  listingId?: string;
  listingAddress?: string;
  marketingBlastId?: string;
  
  // UI metadata
  color?: string;
  icon?: string;
}

/**
 * Syncs DealEvents from a REPC record.
 * Creates or updates events for all deadline dates in the REPC.
 */
export async function syncDealEventsFromRepc(dealId: string): Promise<void> {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { repc: true, property: true },
    });

    if (!deal || !deal.repc) {
      console.warn(`No REPC found for deal ${dealId}`);
      return;
    }

    const { repc, property, agentId } = deal;

    // Map of event types to their corresponding REPC date fields
    const eventMappings: Array<{
      type: DealEventType;
      date: Date | null;
      title: string;
      description: string;
    }> = [
      {
        type: DealEventType.SELLER_DISCLOSURE_DEADLINE,
        date: repc.sellerDisclosureDeadline,
        title: 'Seller Disclosure Deadline',
        description: `Seller must provide property disclosures by this date for ${property.street}`,
      },
      {
        type: DealEventType.DUE_DILIGENCE_DEADLINE,
        date: repc.dueDiligenceDeadline,
        title: 'Due Diligence Deadline',
        description: `Buyer's due diligence period ends for ${property.street}`,
      },
      {
        type: DealEventType.FINANCING_DEADLINE,
        date: repc.financingAppraisalDeadline,
        title: 'Financing & Appraisal Deadline',
        description: `Financing and appraisal contingency deadline for ${property.street}`,
      },
      {
        type: DealEventType.SETTLEMENT_DEADLINE,
        date: repc.settlementDeadline,
        title: 'Settlement Deadline',
        description: `Closing scheduled for ${property.street}, ${property.city}`,
      },
    ];

    // Upsert each event
    for (const mapping of eventMappings) {
      if (!mapping.date) continue;

      // Check if event already exists
      const existing = await prisma.dealEvent.findFirst({
        where: {
          dealId,
          type: mapping.type,
        },
      });

      if (existing) {
        // Update existing event
        await prisma.dealEvent.update({
          where: { id: existing.id },
          data: {
            date: mapping.date,
            title: mapping.title,
            description: mapping.description,
          },
        });
      } else {
        // Create new event
        await prisma.dealEvent.create({
          data: {
            agentId,
            dealId,
            type: mapping.type,
            title: mapping.title,
            description: mapping.description,
            date: mapping.date,
            createdFrom: EventCreatedFrom.REPC,
          },
        });
      }
    }

    console.log(`✓ Synced ${eventMappings.filter(m => m.date).length} events for deal ${dealId}`);
  } catch (error) {
    console.error(`Error syncing events for deal ${dealId}:`, error);
    // Don't throw - we don't want to block REPC saves
  }
}

/**
 * Gets an agent's agenda (events + tasks) for a date range.
 * LEGACY - use getUnifiedCalendarEvents for Calendar v2
 */
export async function getAgentAgenda(
  agentId: string,
  from: Date,
  to: Date
): Promise<AgendaDay[]> {
  // Fetch events in range
  const events = await prisma.dealEvent.findMany({
    where: {
      agentId,
      date: {
        gte: from,
        lte: to,
      },
    },
    include: {
      deal: {
        include: {
          property: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Fetch open tasks due in range
  const tasks = await prisma.task.findMany({
    where: {
      agentId,
      status: 'OPEN',
      dueAt: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { dueAt: 'asc' },
  });

  // Group by day
  const dayMap = new Map<string, AgendaDay>();

  for (const event of events) {
    const dateKey = event.date.toISOString().split('T')[0];
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { date: dateKey, events: [], tasks: [] });
    }
    dayMap.get(dateKey)!.events.push({
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      dealId: event.dealId,
      dealTitle: event.deal.title,
      propertyAddress: event.deal.property
        ? `${event.deal.property.street}, ${event.deal.property.city}`
        : undefined,
    });
  }

  for (const task of tasks) {
    if (!task.dueAt) continue;
    const dateKey = task.dueAt.toISOString().split('T')[0];
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { date: dateKey, events: [], tasks: [] });
    }
    dayMap.get(dateKey)!.tasks.push({
      id: task.id,
      title: task.title,
      description: task.description,
      dealId: task.dealId,
      clientId: task.clientId,
      status: task.status,
    });
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calendar v2: Unified event aggregation across all time-based items
 * This is the new recommended API for calendar views
 */
export async function getUnifiedCalendarEvents(
  agentId: string,
  from: Date,
  to: Date
): Promise<UnifiedCalendarEvent[]> {
  const events: UnifiedCalendarEvent[] = [];

  // 1. Deal Events (REPC deadlines, contract milestones)
  const dealEvents = await prisma.dealEvent.findMany({
    where: {
      agentId,
      date: { gte: from, lte: to },
    },
    include: {
      deal: {
        include: { property: true },
      },
    },
  });

  for (const evt of dealEvents) {
    events.push({
      id: `deal-event-${evt.id}`,
      type: UnifiedEventType.DEAL_EVENT,
      title: evt.title,
      description: evt.description || undefined,
      date: evt.date,
      status: evt.type,
      dealId: evt.dealId,
      dealTitle: evt.deal.title,
      listingAddress: evt.deal.property
        ? `${evt.deal.property.street}, ${evt.deal.property.city}`
        : undefined,
      color: 'violet',
      icon: 'contract',
    });
  }

  // 2. Tasks (all task categories)
  const tasks = await prisma.task.findMany({
    where: {
      agentId,
      dueAt: { gte: from, lte: to },
    },
    include: {
      client: true,
      deal: { include: { property: true } },
      listing: true,
    },
  });

  for (const task of tasks) {
    const clientName = task.client
      ? `${task.client.firstName} ${task.client.lastName}`
      : undefined;

    events.push({
      id: `task-${task.id}`,
      type: UnifiedEventType.TASK,
      title: task.title,
      description: task.description || undefined,
      date: task.dueAt!,
      status: task.status,
      category: task.category,
      priority: task.priority,
      dealId: task.dealId || undefined,
      dealTitle: task.deal?.title,
      clientId: task.clientId || undefined,
      clientName,
      listingId: task.listingId || undefined,
      listingAddress: task.listing?.addressLine1,
      marketingBlastId: task.marketingBlastId || undefined,
      color: task.category === 'CONTRACT' ? 'amber' :
             task.category === 'CALL' ? 'blue' :
             task.category === 'NOTE' ? 'purple' :
             task.category === 'POPBY' ? 'orange' : 'slate',
      icon: task.category === 'CALL' ? 'phone' :
            task.category === 'NOTE' ? 'mail' :
            task.category === 'POPBY' ? 'gift' : 'check',
    });
  }

  // 3. Listing Events (go-live dates, open houses)
  const listings = await prisma.listing.findMany({
    where: {
      agentId,
      OR: [
        { goLiveDate: { gte: from, lte: to } },
        { nextOpenHouseAt: { gte: from, lte: to } },
      ],
    },
  });

  for (const listing of listings) {
    if (listing.goLiveDate && listing.goLiveDate >= from && listing.goLiveDate <= to) {
      events.push({
        id: `listing-golive-${listing.id}`,
        type: UnifiedEventType.LISTING_EVENT,
        title: `🏡 Listing Goes Live`,
        description: listing.headline,
        date: listing.goLiveDate,
        listingId: listing.id,
        listingAddress: `${listing.addressLine1}, ${listing.city}`,
        color: 'emerald',
        icon: 'home',
      });
    }

    if (listing.nextOpenHouseAt && listing.nextOpenHouseAt >= from && listing.nextOpenHouseAt <= to) {
      events.push({
        id: `listing-openhouse-${listing.id}`,
        type: UnifiedEventType.LISTING_EVENT,
        title: `Open House`,
        description: `${listing.addressLine1}, ${listing.city}`,
        date: listing.nextOpenHouseAt,
        listingId: listing.id,
        listingAddress: `${listing.addressLine1}, ${listing.city}`,
        color: 'cyan',
        icon: 'calendar',
      });
    }
  }

  // 4. Marketing Blasts (scheduled sends)
  const blasts = await prisma.marketingBlast.findMany({
    where: {
      agentId,
      scheduledAt: { gte: from, lte: to },
    },
    include: {
      listing: true,
    },
  });

  for (const blast of blasts) {
    events.push({
      id: `blast-${blast.id}`,
      type: UnifiedEventType.MARKETING_BLAST,
      title: `📢 ${blast.title}`,
      description: `${blast.playbook} blast`,
      date: blast.scheduledAt!,
      status: blast.status,
      marketingBlastId: blast.id,
      listingId: blast.listingId || undefined,
      listingAddress: blast.listing?.addressLine1,
      color: 'pink',
      icon: 'megaphone',
    });
  }

  // 5. Google Calendar events (external appointments)
  try {
    const googleEvents = await getGoogleCalendarEventsForRange(agentId, from, to);
    for (const ge of googleEvents) {
      events.push({
        id: `google-${ge.id}`,
        type: UnifiedEventType.GOOGLE_CALENDAR,
        title: ge.allDay ? `📅 ${ge.title}` : `📅 ${ge.title}`,
        description: ge.location || ge.description,
        date: ge.start,
        status: 'GOOGLE',
        color: 'blue',
        icon: 'calendar',
      });
    }
  } catch (error) {
    // Never break the calendar experience if Google is misconfigured
    console.warn('Google Calendar events unavailable:', error);
  }

  // Sort all events by date
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
