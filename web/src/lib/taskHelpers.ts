import api from './api';

/**
 * Helper functions to auto-generate follow-up tasks from various workflows
 */

interface CreateTaskOptions {
  title: string;
  description?: string;
  bucket?: 'TODAY' | 'THIS_WEEK' | 'LATER';
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  dueAt?: string;
  dealId?: string;
  clientId?: string;
  listingId?: string;
  marketingBlastId?: string;
}

/**
 * Create a follow-up task for a marketing blast
 * Called after successfully sending a blast
 */
export async function createFollowupTaskForBlast(
  blastId: string,
  blastTitle: string
): Promise<void> {
  try {
    // Due 2 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    await api.post('/tasks', {
      title: `Follow up on "${blastTitle}" leads`,
      description: 'Review engagement metrics and reach out to interested contacts from this marketing blast.',
      bucket: 'THIS_WEEK',
      priority: 'NORMAL',
      dueAt: dueDate.toISOString(),
      marketingBlastId: blastId,
      createdFrom: 'SYSTEM',
    });
  } catch (error) {
    console.error('Failed to create follow-up task for blast:', error);
  }
}

/**
 * Create tasks for deal milestones
 * Called when REPC or key dates are set
 */
export async function createTasksForDealMilestone(
  dealId: string,
  dealTitle: string,
  clientId: string | undefined,
  milestone: {
    type: 'DUE_DILIGENCE' | 'APPRAISAL' | 'FINANCING' | 'SETTLEMENT' | 'POSSESSION';
    date: Date;
  }
): Promise<void> {
  try {
    const taskMap = {
      DUE_DILIGENCE: {
        title: `Due diligence docs due: ${dealTitle}`,
        description: 'Ensure all due diligence documents are collected and reviewed before the deadline.',
        bucket: 'THIS_WEEK' as const,
        priority: 'HIGH' as const,
      },
      APPRAISAL: {
        title: `Appraisal deadline: ${dealTitle}`,
        description: 'Coordinate appraisal appointment and follow up on results.',
        bucket: 'THIS_WEEK' as const,
        priority: 'HIGH' as const,
      },
      FINANCING: {
        title: `Financing approval deadline: ${dealTitle}`,
        description: 'Confirm buyer financing is on track and approved by the deadline.',
        bucket: 'THIS_WEEK' as const,
        priority: 'HIGH' as const,
      },
      SETTLEMENT: {
        title: `Settlement date: ${dealTitle}`,
        description: 'Prepare for settlement, confirm all documents are ready and coordinate with all parties.',
        bucket: 'TODAY' as const,
        priority: 'HIGH' as const,
      },
      POSSESSION: {
        title: `Possession handover: ${dealTitle}`,
        description: 'Coordinate keys handover and ensure smooth possession transition.',
        bucket: 'TODAY' as const,
        priority: 'NORMAL' as const,
      },
    };

    const taskConfig = taskMap[milestone.type];

    // Create task due 1 day before milestone
    const dueDate = new Date(milestone.date);
    dueDate.setDate(dueDate.getDate() - 1);

    await api.post('/tasks', {
      ...taskConfig,
      dueAt: dueDate.toISOString(),
      dealId,
      clientId,
      createdFrom: 'SYSTEM',
    });
  } catch (error) {
    console.error('Failed to create task for deal milestone:', error);
  }
}

/**
 * Create a task for listing activation
 * Called when a listing goes active
 */
export async function createTaskForListingActivation(
  listingId: string,
  listingHeadline: string
): Promise<void> {
  try {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 24);

    await api.post('/tasks', {
      title: `Monitor listing engagement: ${listingHeadline}`,
      description: 'Check views, shares, and inquiries for your newly active listing. Consider boosting if needed.',
      bucket: 'THIS_WEEK',
      priority: 'NORMAL',
      dueAt: dueDate.toISOString(),
      listingId,
      createdFrom: 'SYSTEM',
    });
  } catch (error) {
    console.error('Failed to create task for listing activation:', error);
  }
}

/**
 * Create a follow-up task for a new lead
 * Called when a new client is marked as NEW_LEAD
 */
export async function createTaskForNewLead(
  clientId: string,
  clientName: string
): Promise<void> {
  try {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 2); // Follow up within 2 hours

    await api.post('/tasks', {
      title: `Reach out to new lead: ${clientName}`,
      description: 'Make initial contact with this new lead while they\'re hot. Ask about their timeline and needs.',
      bucket: 'TODAY',
      priority: 'HIGH',
      dueAt: dueDate.toISOString(),
      clientId,
      createdFrom: 'SYSTEM',
    });
  } catch (error) {
    console.error('Failed to create task for new lead:', error);
  }
}

/**
 * Bulk create tasks for multiple entities
 */
export async function createBulkTasks(tasks: CreateTaskOptions[]): Promise<void> {
  try {
    await Promise.all(tasks.map((task) => api.post('/tasks', task)));
  } catch (error) {
    console.error('Failed to create bulk tasks:', error);
    throw error;
  }
}
