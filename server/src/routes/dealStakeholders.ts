import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getDealStakeholders,
  createDealStakeholder,
  getDealStakeholder,
  updateDealStakeholder,
  deleteDealStakeholder,
} from '../controllers/dealStakeholderController';

export const router = Router({ mergeParams: true });

router.use(authMiddleware);

// These routes assume they might be mounted under /deals/:dealId/stakeholders
// OR directly at /deal-stakeholders/
// We will mount them at /api/deals/:dealId/stakeholders in index.ts
router.get('/', getDealStakeholders);
router.post('/', createDealStakeholder);
router.get('/:id', getDealStakeholder);
router.put('/:id', updateDealStakeholder);
router.delete('/:id', deleteDealStakeholder);

export default router;