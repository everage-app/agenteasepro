import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /daily-activity?date=YYYY-MM-DD
router.get('/', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const date = req.query.date as string || new Date().toISOString().split('T')[0];

    const activity = await prisma.dailyActivity.findFirst({
      where: {
        agentId,
        date: new Date(date),
      },
    });

    res.json(activity);
  } catch (error) {
    console.error('Error fetching daily activity:', error);
    res.status(500).json({ error: 'Failed to fetch daily activity' });
  }
});

// GET /daily-activity/week?from=YYYY-MM-DD
router.get('/week', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const fromDate = req.query.from as string || new Date().toISOString().split('T')[0];
    
    const startDate = new Date(fromDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const activities = await prisma.dailyActivity.findMany({
      where: {
        agentId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    res.json(activities);
  } catch (error) {
    console.error('Error fetching weekly activities:', error);
    res.status(500).json({ error: 'Failed to fetch weekly activities' });
  }
});

// POST /daily-activity - Create or update today's activity
router.post('/', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const {
      date,
      callsGoal,
      callsMade,
      notesGoal,
      notesSent,
      popbysGoal,
      popbysDone,
      referralsAskedGoal,
      referralsAsked,
    } = req.body;

    const activityDate = date ? new Date(date) : new Date();
    activityDate.setHours(0, 0, 0, 0);

    // Check if activity already exists
    const existing = await prisma.dailyActivity.findFirst({
      where: {
        agentId,
        date: activityDate,
      },
    });

    if (existing) {
      const updated = await prisma.dailyActivity.update({
        where: { id: existing.id },
        data: {
          callsGoal: callsGoal ?? existing.callsGoal,
          callsMade: callsMade ?? existing.callsMade,
          notesGoal: notesGoal ?? existing.notesGoal,
          notesSent: notesSent ?? existing.notesSent,
          popbysGoal: popbysGoal ?? existing.popbysGoal,
          popbysDone: popbysDone ?? existing.popbysDone,
          referralsAskedGoal: referralsAskedGoal ?? existing.referralsAskedGoal,
          referralsAsked: referralsAsked ?? existing.referralsAsked,
        },
      });
      return res.json(updated);
    }

    // Create new activity
    const activity = await prisma.dailyActivity.create({
      data: {
        agentId,
        date: activityDate,
        callsGoal: callsGoal ?? 10,
        callsMade: callsMade ?? 0,
        notesGoal: notesGoal ?? 5,
        notesSent: notesSent ?? 0,
        popbysGoal: popbysGoal ?? 2,
        popbysDone: popbysDone ?? 0,
        referralsAskedGoal: referralsAskedGoal ?? 3,
        referralsAsked: referralsAsked ?? 0,
      },
    });

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating daily activity:', error);
    res.status(500).json({ error: 'Failed to create daily activity' });
  }
});

// PATCH /daily-activity/:id - Update specific activity
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const { id } = req.params;

    // Verify ownership
    const activity = await prisma.dailyActivity.findFirst({
      where: { id, agentId },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Daily activity not found' });
    }

    const updated = await prisma.dailyActivity.update({
      where: { id },
      data: req.body,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating daily activity:', error);
    res.status(500).json({ error: 'Failed to update daily activity' });
  }
});

// DELETE /daily-activity/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const { id } = req.params;

    // Verify ownership
    const activity = await prisma.dailyActivity.findFirst({
      where: { id, agentId },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Daily activity not found' });
    }

    await prisma.dailyActivity.delete({
      where: { id },
    });

    res.json({ message: 'Daily activity deleted' });
  } catch (error) {
    console.error('Error deleting daily activity:', error);
    res.status(500).json({ error: 'Failed to delete daily activity' });
  }
});

export default router;
