import {
  TaskBucket,
  TaskCategory,
  TaskCreatedFrom,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';

const ESIGN_TASK_MARKER_PREFIX = '[ESIGN_ENVELOPE]';

function getTaskBucket(dueAt: Date): TaskBucket {
  const hoursAhead = (dueAt.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursAhead <= 24) return TaskBucket.TODAY;
  if (hoursAhead <= 72) return TaskBucket.THIS_WEEK;
  return TaskBucket.LATER;
}

function buildEnvelopeTaskMarker(envelopeId: string) {
  return `${ESIGN_TASK_MARKER_PREFIX}:${envelopeId}`;
}

function buildFollowUpTitle(propertyLabel: string) {
  const cleaned = (propertyLabel || '').trim() || 'Contract packet';
  return `E-sign follow-up: ${cleaned}`;
}

export async function logESignDealEvent(params: {
  agentId: string;
  dealId: string;
  title: string;
  description?: string;
  date?: Date;
}) {
  try {
    await prisma.dealEvent.create({
      data: {
        agentId: params.agentId,
        dealId: params.dealId,
        type: 'OTHER',
        title: params.title,
        description: params.description,
        date: params.date || new Date(),
        createdFrom: 'MANUAL',
      },
    });
  } catch (error) {
    console.warn('Failed to log e-sign deal event:', error);
  }
}

export async function upsertESignFollowUpTask(params: {
  agentId: string;
  dealId: string;
  envelopeId: string;
  propertyLabel: string;
  dueAt: Date;
  note: string;
  priority?: TaskPriority;
}) {
  const marker = buildEnvelopeTaskMarker(params.envelopeId);
  const description = `${params.note}\n\n${marker}`;
  const title = buildFollowUpTitle(params.propertyLabel);
  const priority = params.priority || TaskPriority.NORMAL;
  const bucket = getTaskBucket(params.dueAt);

  const existing = await prisma.task.findFirst({
    where: {
      agentId: params.agentId,
      dealId: params.dealId,
      status: TaskStatus.OPEN,
      category: TaskCategory.CONTRACT,
      description: {
        contains: marker,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (existing?.id) {
    await prisma.task.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        dueAt: params.dueAt,
        bucket,
        priority,
        createdFrom: TaskCreatedFrom.AUTOMATION,
      },
    });
    return existing.id;
  }

  const created = await prisma.task.create({
    data: {
      agentId: params.agentId,
      dealId: params.dealId,
      title,
      description,
      category: TaskCategory.CONTRACT,
      status: TaskStatus.OPEN,
      priority,
      bucket,
      dueAt: params.dueAt,
      createdFrom: TaskCreatedFrom.AUTOMATION,
    },
    select: { id: true },
  });

  return created.id;
}

export async function completeESignFollowUpTasks(params: {
  agentId: string;
  dealId: string;
  envelopeId: string;
  completionNote?: string;
}) {
  const marker = buildEnvelopeTaskMarker(params.envelopeId);
  const openTasks = await prisma.task.findMany({
    where: {
      agentId: params.agentId,
      dealId: params.dealId,
      status: TaskStatus.OPEN,
      description: {
        contains: marker,
      },
    },
    select: {
      id: true,
      description: true,
    },
  });

  if (openTasks.length === 0) return;

  const completionNote = params.completionNote ? `\n\n${params.completionNote}` : '';

  await prisma.$transaction(
    openTasks.map((task) =>
      prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.COMPLETED,
          bucket: TaskBucket.DONE,
          description: `${task.description || ''}${completionNote}`.trim(),
        },
      }),
    ),
  );
}
