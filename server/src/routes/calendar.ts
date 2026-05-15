import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getAgentAgenda, getUnifiedCalendarEvents } from '../services/calendarService';
import { prisma } from '../lib/prisma';

export const router = Router();

/**
 * GET /api/calendar/agenda
 * Get agent's calendar events and tasks for a date range (LEGACY)
 */
router.get('/agenda', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { from, to } = req.query as { from?: string; to?: string };

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required (YYYY-MM-DD)' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const agenda = await getAgentAgenda(req.agentId, fromDate, toDate);

    res.json({ days: agenda });
  } catch (error) {
    console.error('Error fetching agenda:', error);
    res.status(500).json({ error: 'Failed to fetch agenda' });
  }
});

/**
 * GET /api/calendar/events
 * Calendar v2: Unified event feed across all time-based items
 * Returns tasks, deal events, listing events, marketing blasts
 */
router.get('/events', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { from, to } = req.query as { from?: string; to?: string };

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required (YYYY-MM-DD)' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const events = await getUnifiedCalendarEvents(req.agentId, fromDate, toDate);

    res.json({ events });
  } catch (error) {
    console.error('Error fetching unified calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

/**
 * GET /api/calendar/status
 * Connection status for external calendar sync
 */
router.get('/status', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const connection = await prisma.googleCalendarConnection.findUnique({
      where: { agentId: req.agentId },
      select: { syncEnabled: true, lastSyncAt: true },
    });

    if (!connection) {
      return res.json({ connected: false, syncEnabled: false, lastSyncAt: null });
    }

    res.json({
      connected: true,
      syncEnabled: Boolean(connection.syncEnabled),
      lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
    });
  } catch (error) {
    console.error('Error fetching calendar status:', error);
    res.status(500).json({ error: 'Failed to fetch calendar status' });
  }
});
