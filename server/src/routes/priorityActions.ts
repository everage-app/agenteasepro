import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getTodayPriorityActions, completePriorityAction, PriorityActionType } from '../services/priorityActionService';

export const router = Router();

/**
 * GET /api/priority-actions/today
 * Priority Action Center v2: Get aggregated daily actions
 */
router.get('/today', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const actions = await getTodayPriorityActions(req.agentId);
    res.json({ actions });
  } catch (error) {
    console.error('Error fetching priority actions:', error);
    res.status(500).json({ error: 'Failed to fetch priority actions' });
  }
});

/**
 * POST /api/priority-actions/:actionId/complete
 * Mark a priority action as complete
 */
router.post('/:actionId/complete', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { actionId } = req.params;
    const { actionType, completionValue } = req.body;

    await completePriorityAction(
      req.agentId,
      actionId,
      actionType as PriorityActionType,
      completionValue
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing priority action:', error);
    res.status(500).json({ error: 'Failed to complete action' });
  }
});
