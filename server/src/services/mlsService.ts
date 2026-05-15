import { type MlsListing } from '@prisma/client';
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { ALL_UTAH_CITIES } from '../lib/utahData';

export interface ParsedMlsListing {
  headline?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  taxId?: string;
  price?: number;
  beds?: number;
  baths?: number;
  squareFeet?: number;
  lotSize?: number;
  yearBuilt?: number;
  description?: string;
  photos?: string[];
  raw?: Record<string, unknown>;
  sourceUrl: string;
}

const MLS_BASE_URL = 'https://utahrealestate.com';
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours cache window
const CITY_BY_LENGTH = [...ALL_UTAH_CITIES].sort((a, b) => b.length - a.length);

export const normalizeMlsNumber = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) {
    throw new Error('MLS number must contain digits');
  }
  return digits;
};

export async function getCachedMlsListing(agentId: string, rawMlsNumber: string): Promise<MlsListing | null> {
  const mlsNumber = normalizeMlsNumber(rawMlsNumber);
  return prisma.mlsListing.findUnique({
    where: {
      agentId_mlsNumber: {
        agentId,
        mlsNumber,
      },
    },
  });
}

export async function importMlsListing(options: {
  agentId: string;
  rawMlsNumber: string;
  force?: boolean;
}): Promise<MlsListing> {
  const { agentId, rawMlsNumber, force } = options;
  const mlsNumber = normalizeMlsNumber(rawMlsNumber);

  const existing = await prisma.mlsListing.findUnique({
    where: {
      agentId_mlsNumber: {
        agentId,
        mlsNumber,
      },
    },
  });

  if (
    existing &&
    !force &&
    Date.now() - existing.lastFetchedAt.getTime() < REFRESH_INTERVAL_MS
  ) {
    return { ...existing, sourceUrl: existing.sourceUrl || buildListingUrl(mlsNumber) };
  }

  const parsed = await fetchAndParseListing(mlsNumber);

  const data = {
    headline: parsed.headline ?? undefined,
    addressLine1: parsed.addressLine1 ?? undefined,
    city: parsed.city ?? undefined,
    state: parsed.state ?? undefined,
    zip: parsed.zip ?? undefined,
    price: parsed.price ?? undefined,
    beds: parsed.beds ?? undefined,
    baths: parsed.baths ?? undefined,
    squareFeet: parsed.squareFeet ?? undefined,
    lotSize: parsed.lotSize ?? undefined,
    yearBuilt: parsed.yearBuilt ?? undefined,
    description: parsed.description ?? undefined,
    photos: parsed.photos && parsed.photos.length ? (parsed.photos as unknown as any) : undefined,
    raw: parsed.raw ? (parsed.raw as unknown as any) : undefined,
    sourceUrl: parsed.sourceUrl,
    lastFetchedAt: new Date(),
  };

  const record = await prisma.mlsListing.upsert({
    where: {
      agentId_mlsNumber: {
        agentId,
        mlsNumber,
      },
    },
    create: {
      agentId,
      ...data,
      mlsNumber,
    },
    update: data,
  });

  return { ...record, sourceUrl: record.sourceUrl || parsed.sourceUrl };
}

const buildListingUrl = (mlsNumber: string) => `${MLS_BASE_URL}/${mlsNumber}`;

async function fetchAndParseListing(mlsNumber: string): Promise<ParsedMlsListing> {
  const sourceUrl = buildListingUrl(mlsNumber);
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'AgentEaseProBot/1.0 (+https://agentease.pro)',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load MLS page (status ${response.status})`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const jsonLdPayloads = extractJsonLdPayloads($);
  const structured = findListingObject(jsonLdPayloads);
  const meta = scrapeMetaTags($);
  const pageText = $('body').text().replace(/\s+/g, ' ').trim();

  const headline = structured?.name || structured?.headline || extractHeadline($);
  const description = structured?.description || extractDescription($);

  const address = structured?.address || structured?.itemOffered?.address;
  const location = normalizeAddress(address) || scrapeAddress($) || extractAddressFromMeta(meta);
  const taxId = extractTaxId(html) || extractTaxId(pageText);

  const offers = structured?.offers;
  const offer = Array.isArray(offers) ? offers[0] : offers;

  const parsed: ParsedMlsListing = {
    headline,
    description,
    addressLine1: location?.line1,
    city: location?.city,
    state: location?.state,
    zip: location?.zip,
    taxId,
    price: normalizePrice(offer?.price || structured?.price || extractPrice($) || extractPriceFromMeta(meta)),
    beds: normalizeNumber(structured?.numberOfRooms || structured?.numberOfBedrooms || extractBeds($)),
    baths: normalizeNumber(structured?.numberOfBathroomsTotal || extractBaths($)),
    squareFeet: normalizeInt(structured?.floorSize?.value || extractSqft($)),
    lotSize: normalizeNumber(structured?.lotSize?.value || extractLotSize($)),
    yearBuilt: normalizeInt(structured?.yearBuilt || extractYearBuilt($)),
    photos: normalizePhotos(structured?.image || structured?.photo || extractPhotos($)),
    raw: {
      jsonLdPayloads,
      meta,
      taxId,
    },
    sourceUrl,
  };

  return parsed;
}

function extractJsonLdPayloads($: cheerio.CheerioAPI) {
  const payloads: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        payloads.push(...parsed);
      } else {
        payloads.push(parsed);
      }
    } catch (err) {
      // json-ld blocks can contain invalid JS for dynamic templates; ignore
    }
  });
  return payloads;
}

function findListingObject(payloads: unknown[]) {
  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object') continue;
    const candidate = payload as Record<string, any>;
    const type = candidate['@type'];
    if (typeof type === 'string' && isListingType(type)) {
      return candidate;
    }
    if (Array.isArray(type) && type.some(isListingType)) {
      return candidate;
    }
    if (candidate['itemOffered'] && typeof candidate['itemOffered'] === 'object') {
      return candidate['itemOffered'];
    }
  }
  return undefined;
}

const isListingType = (type: string) =>
  ['Product', 'Offer', 'House', 'SingleFamilyResidence', 'RealEstateListing'].includes(type);

function normalizeAddress(address: any) {
  if (!address) return undefined;
  return {
    line1: address.streetAddress || address.addressLine1 || undefined,
    city: address.addressLocality || address.city || undefined,
    state: address.addressRegion || address.state || undefined,
    zip: address.postalCode || address.zip || undefined,
  };
}

function scrapeAddress($: cheerio.CheerioAPI) {
  const text = $('[data-testid="listing-address"]').text() ||
    $('[itemprop="streetAddress"]').text() ||
    $('h2:contains("UT")').first().text();
  if (!text) return undefined;
  const [line1, cityStateZip] = text.split('\n').map((part) => part.trim()).filter(Boolean);
  if (!cityStateZip) {
    return { line1: line1?.trim() };
  }
  const matches = cityStateZip.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
  return {
    line1,
    city: matches?.[1]?.trim(),
    state: matches?.[2],
    zip: matches?.[3],
  };
}

function extractAddressFromMeta(meta: Record<string, string>) {
  const candidates = [
    meta['og:title'],
    meta['twitter:title'],
    meta.title,
    meta.description,
    meta['og:description'],
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const parsed = parseAddressFromText(candidate);
    if (parsed?.line1 && parsed?.city) {
      return parsed;
    }
  }

  return undefined;
}

function parseAddressFromText(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  const segments = normalized
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const candidates = segments.length > 1 ? [...segments.slice(1), ...segments] : segments;

  for (const candidate of candidates) {
    const stateZipOnlyMatch = candidate.match(/(.+?)\s+(UT)\s+(\d{5}(?:-\d{4})?)/i);
    if (stateZipOnlyMatch) {
      const preState = stateZipOnlyMatch[1]?.trim() || '';
      const state = stateZipOnlyMatch[2]?.toUpperCase();
      const zip = stateZipOnlyMatch[3]?.trim();
      const preStateLower = preState.toLowerCase();

      for (const city of CITY_BY_LENGTH) {
        const cityLower = city.toLowerCase();
        if (preStateLower === cityLower || preStateLower.endsWith(` ${cityLower}`)) {
          const street = preStateLower === cityLower
            ? ''
            : preState.slice(0, preState.length - city.length).trim();
          if (street) {
            return {
              line1: street,
              city,
              state,
              zip,
            };
          }
        }
      }
    }

    const commaMatch = candidate.match(/(.+?),\s*([^,]+),\s*(UT)\s*(\d{5}(?:-\d{4})?)/i);
    if (commaMatch) {
      return {
        line1: commaMatch[1]?.trim(),
        city: commaMatch[2]?.trim(),
        state: commaMatch[3]?.toUpperCase(),
        zip: commaMatch[4]?.trim(),
      };
    }

    const compactMatch = candidate.match(/(\d{1,6}\s+[A-Za-z0-9 .#'\/-]+?)\s+([A-Za-z][A-Za-z .'-]+?)\s+(UT)\s+(\d{5}(?:-\d{4})?)/i);
    if (compactMatch) {
      return {
        line1: compactMatch[1]?.trim(),
        city: compactMatch[2]?.trim(),
        state: compactMatch[3]?.toUpperCase(),
        zip: compactMatch[4]?.trim(),
      };
    }
  }

  return undefined;
}

function extractTaxId(html: string): string | undefined {
  const normalized = html.replace(/\s+/g, ' ');
  const match = normalized.match(/(?:Tax ID|TaxID|Parcel ID|Parcel\/Tax ID)\s*[:#-]?\s*([0-9A-Za-z-]{4,})/i);
  return match?.[1];
}

function extractPriceFromMeta(meta: Record<string, string>): string | undefined {
  const candidates = [
    meta['og:title'],
    meta['twitter:title'],
    meta.title,
    meta.description,
    meta['og:description'],
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const match = candidate.match(/\$\s?([0-9][0-9,]*(?:\.\d+)?)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function extractHeadline($: cheerio.CheerioAPI) {
  return $('h1').first().text().trim();
}

function extractDescription($: cheerio.CheerioAPI) {
  return $('[data-testid="listing-description"]').text().trim() ||
    $('[itemprop="description"]').text().trim();
}

function extractPrice($: cheerio.CheerioAPI) {
  const raw = $('[data-testid="listing-price"]').text() || $('.price').first().text();
  return raw?.replace(/[^0-9.]/g, '');
}

function extractBeds($: cheerio.CheerioAPI) {
  return extractFact($, /beds?/i);
}

function extractBaths($: cheerio.CheerioAPI) {
  return extractFact($, /baths?/i);
}

function extractSqft($: cheerio.CheerioAPI) {
  return extractFact($, /(sq\.? ?ft|square feet)/i);
}

function extractLotSize($: cheerio.CheerioAPI) {
  return extractFact($, /(acre|lot)/i);
}

function extractYearBuilt($: cheerio.CheerioAPI) {
  return extractFact($, /year built/i);
}

function extractPhotos($: cheerio.CheerioAPI) {
  const urls: string[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.includes('utahrealestate')) {
      urls.push(src);
    }
  });
  return Array.from(new Set(urls));
}

function normalizePrice(value: any) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeNumber(value: any) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeInt(value: any) {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizePhotos(value: any): string[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const urls = list
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && 'url' in entry) {
        return (entry as Record<string, any>).url;
      }
      return undefined;
    })
    .filter((v): v is string => Boolean(v));
  if (!urls.length) return undefined;
  return Array.from(new Set(urls));
}

function scrapeMetaTags($: cheerio.CheerioAPI) {
  const meta: Record<string, string> = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property');
    const content = $(el).attr('content');
    if (name && content) {
      meta[name] = content;
    }
  });
  return meta;
}

function extractFact($: cheerio.CheerioAPI, matcher: RegExp): string | undefined {
  const scopes = [
    $('[data-testid="listing-facts"]').text(),
    $('[class*="fact"], ul, dl, table').text(),
  ];
  for (const text of scopes) {
    if (!text) continue;
    const regex = new RegExp(`${matcher.source}[^0-9]*([0-9.,]+)`, 'i');
    const match = text.match(regex);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

