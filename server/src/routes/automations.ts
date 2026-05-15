import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getAutomationRules,
  toggleAutomationRule,
  seedDefaultAutomationRules,
  updateAutomationRule,
} from '../automation/seed';

const router = Router();

// GET /automations - List all automation rules for the agent
router.get('/', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const rules = await getAutomationRules(agentId);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// POST /automations/seed - Create default rules for the agent
router.post('/seed', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    await seedDefaultAutomationRules(agentId);
    const rules = await getAutomationRules(agentId);
    res.json(rules);
  } catch (error) {
    console.error('Error seeding automation rules:', error);
    res.status(500).json({ error: 'Failed to seed automation rules' });
  }
});

// PATCH /automations/:id/toggle - Toggle a rule on/off
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const { id } = req.params;
    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({ error: 'isEnabled must be a boolean' });
    }

    const rule = await toggleAutomationRule(id, agentId, isEnabled);
    res.json(rule);
  } catch (error) {
    console.error('Error toggling automation rule:', error);
    res.status(500).json({ error: 'Failed to toggle automation rule' });
  }
});

// PATCH /automations/:id - Update rule name/config
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const agentId = (req as any).agentId;
    const { id } = req.params;
    const { name, config } = req.body as { name?: string; config?: any };

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'name must be a string' });
    }

    if (config !== undefined && (typeof config !== 'object' || Array.isArray(config))) {
      return res.status(400).json({ error: 'config must be an object' });
    }

    const rule = await updateAutomationRule(id, agentId, { name, config });
    res.json(rule);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(500).json({ error: 'Failed to update automation rule' });
  }
});

export default router;
