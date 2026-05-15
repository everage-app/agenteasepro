import { Router } from 'express';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook
} from '../controllers/webhookController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getWebhooks);
router.post('/', createWebhook);
router.put('/:id', updateWebhook);
router.delete('/:id', deleteWebhook);

export default router;