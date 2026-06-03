import { Request } from 'express';
import { prisma } from '../lib/prisma';
import { buildPublicSiteUrl, getPublicAppBaseUrl } from './defaultAgentLandingPage';

type RequestLike = Pick<Request, 'protocol' | 'get'>;

type PublicLandingSeoData = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string | null;
  keywords: string[];
  jsonLd: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
}

function escapeHtml(value: unknown) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value: unknown, req?: RequestLike) {
  const raw = cleanText(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const base = getPublicAppBaseUrl(req);
  return `${base}/${raw.replace(/^\/+/, '')}`;
}

function extractPhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return typeof record.url === 'string'
          ? record.url
          : typeof record.href === 'string'
            ? record.href
            : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

export function isInternalLandingPageSlug(slug: string, title?: string | null) {
  const normalizedSlug = cleanText(slug).toLowerCase();
  const normalizedTitle = cleanText(title).toLowerCase();
  return /^pw-landing-/.test(normalizedSlug)
    || /^prod-audit-/.test(normalizedSlug)
    || /^demo-/.test(normalizedSlug)
    || /^(test|testme\d*|testingme|live-test)$/.test(normalizedSlug)
    || /\bdemo\b/.test(normalizedTitle)
    || /^playwright landing/.test(normalizedTitle)
    || /\b(test|testing|audit)\b/.test(normalizedTitle);
}

export async function getLandingPageSeoData(slug: string, req?: RequestLike): Promise<PublicLandingSeoData | null> {
  const landingPage = await prisma.landingPage.findUnique({
    where: { slug },
    include: {
      agent: {
        include: { profileSettings: true },
      },
      listing: {
        include: {
          mlsImports: {
            orderBy: { lastFetchedAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!landingPage || !landingPage.isActive) return null;

  const customContent = asRecord(landingPage.customContent);
  const seoSettings = asRecord(customContent.seoSettings);
  const agentSettings = landingPage.agent.profileSettings;
  const agentName = cleanText(customContent.agentDisplayName || landingPage.agent.name) || 'AgentEasePro Agent';
  const brokerageName = cleanText(customContent.brokerageDisplayName || agentSettings?.brokerageName || landingPage.agent.brokerageName);
  const headline = cleanText(customContent.headline || landingPage.listing?.headline || landingPage.title);
  const subheadline = cleanText(customContent.subheadline || landingPage.description || landingPage.listing?.description);
  const cityState = [landingPage.listing?.city, landingPage.listing?.state].map(cleanText).filter(Boolean).join(', ');
  const title = truncate(
    cleanText(seoSettings.metaTitle)
      || (landingPage.listing
        ? `${headline || landingPage.listing.addressLine1 || 'Utah Listing'} | ${agentName}`
        : `${headline || landingPage.title || 'Utah Real Estate'} | ${agentName}`),
    68,
  );
  const description = truncate(
    cleanText(seoSettings.metaDescription)
      || subheadline
      || (landingPage.listing
        ? `View ${landingPage.listing.addressLine1 || 'this Utah listing'}${cityState ? ` in ${cityState}` : ''}, request details, and connect with ${agentName}.`
        : `Connect with ${agentName} for local Utah real estate guidance, home value strategy, and next steps.`),
    158,
  );
  const galleryImages = extractPhotoUrls(customContent.galleryImages);
  const mlsPhotos = extractPhotoUrls(landingPage.listing?.mlsImports?.[0]?.photos);
  const imageUrl = absoluteUrl(
    landingPage.heroImage
      || galleryImages[0]
      || landingPage.listing?.heroImageUrl
      || landingPage.listing?.primaryImageUrl
      || mlsPhotos[0]
      || customContent.agentPhotoUrl
      || agentSettings?.photoUrl,
    req,
  );
  const canonicalUrl = buildPublicSiteUrl(landingPage.slug, req);
  const keywords = Array.isArray(seoSettings.keywords)
    ? seoSettings.keywords.map(cleanText).filter(Boolean).slice(0, 12)
    : [];

  const webPageId = `${canonicalUrl}#webpage`;
  const agentId = `${canonicalUrl}#agent`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': webPageId,
        url: canonicalUrl,
        name: title,
        description,
        image: imageUrl || undefined,
        about: landingPage.listing ? `${canonicalUrl}#property` : agentId,
        provider: agentId,
      },
      {
        '@type': 'RealEstateAgent',
        '@id': agentId,
        name: agentName,
        email: cleanText(customContent.agentEmail || landingPage.agent.email) || undefined,
        telephone: cleanText(customContent.agentPhone || agentSettings?.phone) || undefined,
        image: absoluteUrl(customContent.agentPhotoUrl || agentSettings?.photoUrl, req) || undefined,
        worksFor: brokerageName ? { '@type': 'RealEstateAgent', name: brokerageName } : undefined,
        url: canonicalUrl,
      },
      landingPage.listing ? {
        '@type': 'Residence',
        '@id': `${canonicalUrl}#property`,
        name: landingPage.listing.headline || landingPage.title || landingPage.listing.addressLine1 || 'Utah listing',
        description: landingPage.listing.description || description,
        image: imageUrl ? [imageUrl] : undefined,
        address: {
          '@type': 'PostalAddress',
          streetAddress: cleanText(landingPage.listing.addressLine1) || undefined,
          addressLocality: cleanText(landingPage.listing.city) || undefined,
          addressRegion: cleanText(landingPage.listing.state) || undefined,
          postalCode: cleanText(landingPage.listing.zipCode) || undefined,
        },
        numberOfBedrooms: landingPage.listing.beds || undefined,
        numberOfBathroomsTotal: landingPage.listing.baths || undefined,
        floorSize: landingPage.listing.sqft ? {
          '@type': 'QuantitativeValue',
          value: landingPage.listing.sqft,
          unitCode: 'FTK',
        } : undefined,
      } : undefined,
    ].filter(Boolean),
  };

  return { title, description, canonicalUrl, imageUrl, keywords, jsonLd };
}

export function renderLandingPageHtml(indexHtml: string, seo: PublicLandingSeoData) {
  const tags = [
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />`,
    seo.keywords.length ? `<meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />` : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />`,
    seo.imageUrl ? `<meta property="og:image" content="${escapeHtml(seo.imageUrl)}" />` : '',
    `<meta name="twitter:card" content="${seo.imageUrl ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
    seo.imageUrl ? `<meta name="twitter:image" content="${escapeHtml(seo.imageUrl)}" />` : '',
    `<script type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ');

  let html = indexHtml.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>\s*/i, '');
  return html.replace('</head>', `    ${tags}\n  </head>`);
}

export function buildRobotsTxt(req?: RequestLike) {
  const baseUrl = getPublicAppBaseUrl(req);
  return [
    'User-agent: *',
    'Allow: /sites/',
    'Allow: /q/',
    'Disallow: /api/',
    'Disallow: /settings/',
    'Disallow: /dashboard/',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export async function buildSitemapXml(req?: RequestLike) {
  const pages = await prisma.landingPage.findMany({
    where: { isActive: true },
    select: { slug: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const urls = pages
    .filter((page) => !isInternalLandingPageSlug(page.slug, page.title))
    .map((page) => {
      const loc = buildPublicSiteUrl(page.slug, req);
      const lastmod = page.updatedAt.toISOString().slice(0, 10);
      return `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}