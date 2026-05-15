import { Router } from 'express';
import {
  createESignAudit,
  getESignAudits
} from '../controllers/esignAuditController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createESignAudit);
router.get('/envelope/:envelopeId', getESignAudits);

export default router;