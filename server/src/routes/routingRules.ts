import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getRoutingRules,
  createRoutingRule,
  getRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
} from '../controllers/routingRuleController';

export const router = Router();

router.use(authMiddleware);

router.get('/', getRoutingRules);
router.post('/', createRoutingRule);
router.get('/:id', getRoutingRule);
router.put('/:id', updateRoutingRule);
router.delete('/:id', deleteRoutingRule);

export default router;