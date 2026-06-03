/**
 * Global Search route — cross-entity search across core workspace records.
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
  try {
    const [deals, clients, leads, tasks, listings, landingPages, marketingBlasts] = await Promise.all([
      // ── Deals: match title, property street/city, buyer/seller name ──
      prisma.deal.findMany({
        where: {
          agentId: req.agentId,
          archivedAt: null,
          deletedAt: null,
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
          updatedAt: true,
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
          deletedAt: null,
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
          stage: true,
          temperature: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),

      // ── Leads: match name, email, phone, source ──
      prisma.lead.findMany({
        where: {
          agentId: req.agentId,
          deletedAt: null,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
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
          tags: true,
          updatedAt: true,
          landingPage: { select: { title: true, slug: true } },
          listing: { select: { addressLine1: true, city: true, state: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),

      // ── Tasks: match title/description and attached records ──
      prisma.task.findMany({
        where: {
          agentId: req.agentId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { deal: { is: { title: { contains: q, mode: 'insensitive' } } } },
            { client: { is: { firstName: { contains: q, mode: 'insensitive' } } } },
            { client: { is: { lastName: { contains: q, mode: 'insensitive' } } } },
            { listing: { is: { addressLine1: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          bucket: true,
          dueAt: true,
          updatedAt: true,
          deal: { select: { id: true, title: true } },
          client: { select: { id: true, firstName: true, lastName: true } },
          listing: { select: { id: true, addressLine1: true, city: true, state: true } },
        },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: limit,
      }),

      // ── Listings: match address, city, MLS, headline, description ──
      prisma.listing.findMany({
        where: {
          agentId: req.agentId,
          OR: [
            { addressLine1: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { zipCode: { contains: q, mode: 'insensitive' } },
            { mlsId: { contains: q, mode: 'insensitive' } },
            { headline: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          addressLine1: true,
          city: true,
          state: true,
          zipCode: true,
          headline: true,
          status: true,
          price: true,
          mlsId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),

      // ── Landing pages: match title, description, slug, attached listing ──
      prisma.landingPage.findMany({
        where: {
          agentId: req.agentId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { listing: { is: { addressLine1: { contains: q, mode: 'insensitive' } } } },
            { listing: { is: { city: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          isActive: true,
          totalViews: true,
          leadsGenerated: true,
          updatedAt: true,
          listing: { select: { addressLine1: true, city: true, state: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),

      // ── Marketing: match campaign title and attached listing ──
      prisma.marketingBlast.findMany({
        where: {
          agentId: req.agentId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { listing: { is: { addressLine1: { contains: q, mode: 'insensitive' } } } },
            { listing: { is: { city: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        select: {
          id: true,
          title: true,
          playbook: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          updatedAt: true,
          listing: { select: { addressLine1: true, city: true, state: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
    ]);

    res.json({ deals, clients, leads, tasks, listings, landingPages, marketingBlasts });
  } catch (error) {
    console.error('Global search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});
