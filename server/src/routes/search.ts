/**
 * Global Search route — cross-entity search across deals, clients, and leads.
 *
 * GET /api/search?q=term&limit=10
 */
import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

export const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });

  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.json({ deals: [], clients: [], leads: [] });
  }

  const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '8'), 10) || 8));
  const pattern = `%${q}%`;

  try {
    const [deals, clients, leads] = await Promise.all([
      // ── Deals: match title, property street/city, buyer/seller name ──
      prisma.deal.findMany({
        where: {
          agentId: req.agentId,
          archivedAt: null,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { property: { street: { contains: q, mode: 'insensitive' } } },
            { property: { city: { contains: q, mode: 'insensitive' } } },
            { property: { mlsId: { contains: q, mode: 'insensitive' } } },
            { buyer: { firstName: { contains: q, mode: 'insensitive' } } },
            { buyer: { lastName: { contains: q, mode: 'insensitive' } } },
            { seller: { firstName: { contains: q, mode: 'insensitive' } } },
            { seller: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          property: { select: { street: true, city: true, state: true } },
          buyer: { select: { firstName: true, lastName: true } },
          seller: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),

      // ── Clients: match name, email, phone ──
      prisma.client.findMany({
        where: {
          agentId: req.agentId,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),

      // ── Leads: match name, email, phone, source ──
      prisma.lead.findMany({
        where: {
          agentId: req.agentId,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          source: true,
          priority: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
    ]);

    res.json({ deals, clients, leads });
  } catch (error) {
    console.error('Global search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});
