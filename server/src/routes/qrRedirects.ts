import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { buildPublicSiteUrl } from '../services/defaultAgentLandingPage';

export const router = Router();

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

router.get('/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(token)) {
    return res.status(404).send('QR link not found');
  }

  const landingPages = await prisma.landingPage.findMany({
    where: { isActive: true },
    select: { slug: true, customContent: true },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  });

  const landingPage = landingPages.find((page) => String(asRecord(page.customContent).qrListingToken || '').trim() === token);
  if (!landingPage) {
    return res.status(404).send('QR link not found');
  }

  const target = new URL(buildPublicSiteUrl(landingPage.slug, req));
  target.searchParams.set('lpqr', token);
  target.searchParams.set('utm_content', token);
  target.searchParams.set('utm_source', 'qr');
  target.searchParams.set('utm_medium', 'print');
  target.searchParams.set('utm_campaign', landingPage.slug);

  return res.redirect(302, target.toString());
});