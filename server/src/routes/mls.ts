import { Router } from 'express';
import { importMlsListing, getCachedMlsListing } from '../services/mlsService';
import { AuthenticatedRequest } from '../middleware/auth';

export const router = Router();

router.post('/import', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { mlsNumber, force } = req.body;
    if (!mlsNumber) {
      return res.status(400).json({ error: 'MLS number required' });
    }

    const listing = await importMlsListing({
      agentId: req.agentId,
      rawMlsNumber: String(mlsNumber),
      force: Boolean(force),
    });

    return res.json(listing);
  } catch (err) {
    console.error('MLS import error', err);
    return res.status(500).json({ error: 'Unable to import MLS listing' });
  }
});

router.get('/:mlsNumber', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { mlsNumber } = req.params;
    const listing = await getCachedMlsListing(req.agentId, mlsNumber);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    return res.json(listing);
  } catch (err) {
    console.error('MLS fetch error', err);
    return res.status(500).json({ error: 'Unable to load MLS listing' });
  }
});
