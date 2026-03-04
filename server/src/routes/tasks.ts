import { Router } from 'express';
import { TaskStatus, TaskPriority, TaskBucket, TaskCreatedFrom, TaskCategory } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const router = Router();

/**
 * GET /api/tasks
 * Get all tasks for the authenticated agent with enriched relationship data
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { status, dealId, clientId, bucket } = req.query;

    const tasks = await prisma.task.findMany({
      where: {
        agentId: req.agentId,
        ...(status && status !== 'ALL' && { status: status as TaskStatus }),
        ...(dealId && { dealId: dealId as string }),
        ...(clientId && { clientId: clientId as string }),
        ...(bucket && { bucket: bucket as TaskBucket }),
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            status: true,
            property: {
              select: {
                street: true,
                city: true,
                state: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        listing: {
          select: {
            id: true,
            headline: true,
            mlsId: true,
          },
        },
        marketingBlast: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [
        { bucket: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Transform for frontend
    const enrichedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      bucket: task.bucket,
      dueAt: task.dueAt,
      deal: task.deal ? {
        id: task.deal.id,
        title: task.deal.title,
        stage: task.deal.status,
        address: task.deal.property ? `${task.deal.property.street}, ${task.deal.property.city}` : undefined,
      } : undefined,
      client: task.client ? {
        id: task.client.id,
        name: `${task.client.firstName} ${task.client.lastName}`,
      } : undefined,
      listing: task.listing ? {
        id: task.listing.id,
        address: task.listing.headline,
        mlsId: task.listing.mlsId,
      } : undefined,
      marketingBlast: task.marketingBlast ? {
        id: task.marketingBlast.id,
        title: task.marketingBlast.title,
      } : undefined,
    }));

    res.json(enrichedTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const {
      title,
      description,
      category,
      dealId,
      clientId,
      listingId,
      marketingBlastId,
      dueAt,
      priority,
      bucket,
      createdFrom,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const task = await prisma.task.create({
      data: {
        agentId: req.agentId,
        title,
        description,
        category: category || TaskCategory.GENERAL,
        dealId,
        clientId,
        listingId,
        marketingBlastId,
        dueAt: dueAt ? new Date(dueAt) : null,
        priority: priority || TaskPriority.NORMAL,
        bucket: bucket || TaskBucket.TODAY,
        createdFrom: createdFrom || TaskCreatedFrom.MANUAL,
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            status: true,
            property: {
              select: {
                street: true,
                city: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        listing: {
          select: {
            id: true,
            headline: true,
            mlsId: true,
          },
        },
        marketingBlast: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task (for drag/drop bucket changes, status updates, etc.)
 */
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { id } = req.params;
    const {
      title,
      description,
      dueAt,
      status,
      priority,
      bucket,
      dealId,
      clientId,
      listingId,
      marketingBlastId,
    } = req.body;

    // Verify task belongs to agent
    const existing = await prisma.task.findFirst({
      where: { id, agentId: req.agentId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
        ...(status !== undefined && { status: status as TaskStatus }),
        ...(priority !== undefined && { priority: priority as TaskPriority }),
        ...(bucket !== undefined && { bucket: bucket as TaskBucket }),
        ...(dealId !== undefined && { dealId }),
        ...(clientId !== undefined && { clientId }),
        ...(listingId !== undefined && { listingId }),
        ...(marketingBlastId !== undefined && { marketingBlastId }),
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            status: true,
            property: {
              select: {
                street: true,
                city: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        listing: {
          select: {
            id: true,
            headline: true,
            mlsId: true,
          },
        },
        marketingBlast: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task (legacy endpoint for backward compatibility)
 */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { id } = req.params;
    const { title, description, dueAt, status } = req.body;

    // Verify task belongs to agent
    const existing = await prisma.task.findFirst({
      where: { id, agentId: req.agentId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
        ...(status !== undefined && { 
          status: status as TaskStatus,
          // Auto-set bucket to DONE when status is COMPLETED or DONE
          ...(status === 'COMPLETED' || status === 'DONE' ? { bucket: TaskBucket.DONE } : {})
        }),
      },
      include: {
        deal: true,
        client: true,
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { id } = req.params;

    // Verify task belongs to agent
    const existing = await prisma.task.findFirst({
      where: { id, agentId: req.agentId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
