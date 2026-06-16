import { prisma } from '../lib/prisma';
import { sendNotificationEmail } from './emailService';

type LeadContact = {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type LeadCaptureWorkflowOptions = {
  agentId: string;
  lead: LeadContact;
  sourceLabel?: string;
  message?: string | null;
  contextPath: string;
  taskDescription?: string;
  listingId?: string | null;
  landingPageId?: string | null;
  createTask?: boolean;
  followUpMinutes?: number;
};

function getLeadDisplayName(lead: LeadContact) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
  return fullName || lead.email || lead.phone || 'New lead';
}

function getTaskBucket(dueAt: Date) {
  const hoursAhead = (dueAt.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursAhead <= 24) return 'TODAY' as const;
  if (hoursAhead <= 72) return 'THIS_WEEK' as const;
  return 'LATER' as const;
}

export async function runLeadCaptureWorkflow(options: LeadCaptureWorkflowOptions) {
  const [agent, prefs] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: options.agentId },
      select: { id: true, email: true, name: true },
    }),
    prisma.agentNotificationPrefs.findUnique({
      where: { agentId: options.agentId },
      select: { deadlineEmails: true, inAppBanners: true },
    }),
  ]);

  if (!agent) {
    return { taskId: null };
  }

  const leadName = getLeadDisplayName(options.lead);
  const sourceLabel = options.sourceLabel || 'landing page';
  const leadUrlBase = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://app.agenteasepro.com';
  const leadUrl = `${leadUrlBase.replace(/\/$/, '')}/leads/${encodeURIComponent(options.lead.id)}`;

  let taskId: string | null = null;
  if (options.createTask !== false) {
    const minutes = Math.max(5, Number(options.followUpMinutes || 15));
    const dueAt = new Date(Date.now() + minutes * 60 * 1000);
    const task = await prisma.task.create({
      data: {
        agentId: options.agentId,
        listingId: options.listingId || undefined,
        title: `Follow up: ${leadName}`,
        description:
          options.taskDescription ||
          `New lead from ${sourceLabel}. Reach out while interest is fresh.`,
        category: 'CALL',
        priority: 'NORMAL',
        bucket: getTaskBucket(dueAt),
        dueAt,
        createdFrom: 'SYSTEM',
      },
      select: { id: true },
    });
    taskId = task.id;
  }

  await prisma.internalEvent.create({
    data: {
      agentId: options.agentId,
      kind: 'lead_captured',
      path: options.contextPath,
      meta: {
        leadId: options.lead.id,
        leadName,
        leadEmail: options.lead.email || null,
        leadPhone: options.lead.phone || null,
        sourceLabel,
        landingPageId: options.landingPageId || null,
        listingId: options.listingId || null,
        taskId,
        bannerEligible: prefs?.inAppBanners !== false,
        message: options.message || null,
      },
    },
  });

  if (agent.email && prefs?.deadlineEmails !== false) {
    const contactBits = [options.lead.email, options.lead.phone].filter(Boolean).join(' • ');
    const body = [
      `${leadName} just submitted a new ${sourceLabel} inquiry.`,
      contactBits ? `Contact: ${contactBits}.` : null,
      options.message ? `Message: ${options.message}` : null,
      taskId ? 'A follow-up task was created in your workspace.' : null,
    ]
      .filter(Boolean)
      .join(' ');

    try {
      await sendNotificationEmail({
        agentId: options.agentId,
        to: agent.email,
        subject: `New lead captured: ${leadName}`,
        title: 'New lead captured',
        message: body,
        actionUrl: leadUrl,
        actionText: 'Open lead',
        replyTo: options.lead.email || undefined,
      });
    } catch (error) {
      console.error('Failed to send lead notification email:', error);
    }
  }

  return { taskId };
}
