import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import type { SearchCriteria, PropertySearchResult } from '../services/propertySearchService';
import {
  searchProperties as searchPropertiesNew,
  getPropertyById as getPropertyByIdNew,
  SearchParams,
  PropertyResult,
} from '../services/realEstateApiService';
import { prisma } from '../lib/prisma';
export const router = Router();

// Helper to detect MLS number
const isMlsNumber = (text: string): boolean => {
  if (!text) return false;
  const cleaned = text.replace(/[^0-9]/g, '');
  return /^\d{6,10}$/.test(cleaned);
};

// Helper to extract MLS number from various formats
const extractMlsNumber = (text: string): string | null => {
  if (!text) return null;
  // Handle "MLS# 1234567" or "MLS:1234567" or just "1234567"
  const match = text.match(/(?:mls[#:\s]*)?(\d{6,10})/i);
  return match ? match[1] : null;
};

/**
 * POST /api/search/properties
 * Search for properties across multiple sources
 */
router.post('/properties', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const criteria = req.body;
    
    // Validate at least one search parameter
    if (!criteria.query && !criteria.city && !criteria.zipCode && !criteria.address && !criteria.mlsNumber) {
      return res.status(400).json({ 
        error: 'Please provide a search query, city, or zip code' 
      });
    }

    // Extract MLS number if present in query
    let mlsNumber = criteria.mlsNumber || extractMlsNumber(criteria.query);
    
    console.log(`[Search] Agent ${req.agentId} searching:`, JSON.stringify(criteria));
    if (mlsNumber) {
      console.log(`[Search] Detected MLS#: ${mlsNumber}`);
    }

    let results: any[] = [];
    
    // PRIORITY 1: Always try Utah Real Estate first for MLS numbers
    if (mlsNumber) {
      console.log(`[Search] Prioritizing Utah Real Estate lookup for MLS# ${mlsNumber}`);
      
      // Check local cache first
      const localListing = await prisma.mlsListing.findFirst({
        where: {
          agentId: req.agentId,
          OR: [
            { mlsNumber: mlsNumber },
            { mlsNumber: { contains: mlsNumber } },
          ],
        },
      });
      
      if (localListing) {
        console.log(`[Search] ✓ Found cached MLS listing: ${localListing.mlsNumber}`);
        results.push({
          source: 'utahrealestate',
          mlsId: localListing.mlsNumber,
          taxId: (localListing.raw as any)?.taxId || undefined,
          address: {
            street: localListing.addressLine1 || '',
            city: localListing.city || '',
            state: localListing.state || 'UT',
            zip: localListing.zip || '',
            fullAddress: `${localListing.addressLine1 || ''}, ${localListing.city || ''}, ${localListing.state || 'UT'} ${localListing.zip || ''}`,
          },
          price: Number(localListing.price) || 0,
          beds: localListing.beds,
          baths: localListing.baths,
          sqft: localListing.squareFeet,
          lotSize: localListing.lotSize,
          yearBuilt: localListing.yearBuilt,
          propertyType: 'Residential', // Default - would need to add to schema
          status: 'Active', // Default - would need to add to schema
          description: localListing.description || localListing.headline,
          photos: Array.isArray(localListing.photos) ? localListing.photos : [],
          url: localListing.sourceUrl || `https://www.utahrealestate.com/${localListing.mlsNumber}`,
          fetchedAt: localListing.lastFetchedAt,
          daysOnMarket: undefined, // Would need to add to schema
          listingAgent: undefined, // Would need to add to schema
        });
      } else {
        // Not in cache - try to fetch from Utah Real Estate directly
        console.log(`[Search] Fetching fresh data from UtahRealEstate.com for MLS# ${mlsNumber}`);
        try {
          const freshProperty = await getPropertyByIdNew(req.agentId, mlsNumber);
          if (freshProperty) {
            console.log(`[Search] ✓ Successfully fetched MLS# ${mlsNumber} from UtahRealEstate.com`);
            results.push(freshProperty);
          }
        } catch (err) {
          console.log(`[Search] ✗ Utah Real Estate lookup failed for MLS# ${mlsNumber}:`, err);
        }
      }
    }

    // Next, search local MLS cache for address/city/zip queries before external providers
    if (results.length === 0 && (criteria.query || criteria.city || criteria.zipCode || criteria.address)) {
      const localOr: any[] = [];
      const q = (criteria.query || '').trim();
      const address = (criteria.address || '').trim();
      const city = (criteria.city || '').trim();
      const zip = (criteria.zipCode || '').trim();

      if (q) {
        localOr.push(
          { addressLine1: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { zip: { contains: q, mode: 'insensitive' } },
          { headline: { contains: q, mode: 'insensitive' } },
        );
      }
      if (address) {
        localOr.push({ addressLine1: { contains: address, mode: 'insensitive' } });
      }
      if (city) {
        localOr.push({ city: { contains: city, mode: 'insensitive' } });
      }
      if (zip) {
        localOr.push({ zip: { contains: zip, mode: 'insensitive' } });
      }

      if (localOr.length > 0) {
        const localMatches = await prisma.mlsListing.findMany({
          where: {
            agentId: req.agentId,
            OR: localOr,
          },
          orderBy: { lastFetchedAt: 'desc' },
          take: Math.min(criteria.limit || 50, 50),
        });

        for (const localListing of localMatches) {
          if (results.find(r => r.mlsId === localListing.mlsNumber)) continue;
          results.push({
            source: 'utahrealestate',
            mlsId: localListing.mlsNumber,
            taxId: (localListing.raw as any)?.taxId || undefined,
            address: {
              street: localListing.addressLine1 || '',
              city: localListing.city || '',
              state: localListing.state || 'UT',
              zip: localListing.zip || '',
              fullAddress: `${localListing.addressLine1 || ''}, ${localListing.city || ''}, ${localListing.state || 'UT'} ${localListing.zip || ''}`,
            },
            price: Number(localListing.price) || 0,
            beds: localListing.beds,
            baths: localListing.baths,
            sqft: localListing.squareFeet,
            lotSize: localListing.lotSize,
            yearBuilt: localListing.yearBuilt,
            propertyType: 'Residential', // Default - would need to add to schema
            status: 'Active', // Default - would need to add to schema
            description: localListing.description || localListing.headline,
            photos: Array.isArray(localListing.photos) ? localListing.photos : [],
            url: localListing.sourceUrl || `https://www.utahrealestate.com/${localListing.mlsNumber}`,
            fetchedAt: localListing.lastFetchedAt,
            daysOnMarket: undefined, // Would need to add to schema
            listingAgent: undefined, // Would need to add to schema
          });
        }
      }
    }
    
    // Also check agent's listings
    if (mlsNumber || criteria.address) {
      const agentListings = await prisma.listing.findMany({
        where: {
          agentId: req.agentId,
          OR: mlsNumber 
            ? [
                { mlsId: mlsNumber },
                { mlsId: { contains: mlsNumber } },
              ]
            : [
                { addressLine1: { contains: criteria.address, mode: 'insensitive' } },
              ],
        },
        take: 5,
      });
      
      for (const listing of agentListings) {
        if (!results.find(r => r.mlsId === listing.mlsId)) {
          results.push({
            source: 'utahrealestate',
            mlsId: listing.mlsId,
            address: {
              street: listing.addressLine1,
              city: listing.city,
              state: listing.state,
              zip: listing.zipCode,
              fullAddress: `${listing.addressLine1}, ${listing.city}, ${listing.state} ${listing.zipCode}`,
            },
            price: Number(listing.price),
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            yearBuilt: undefined, // Not in Listing model
            propertyType: 'Residential', // Default - not in Listing model
            status: listing.status,
            description: listing.description,
            photos: listing.primaryImageUrl ? [listing.primaryImageUrl] : [],
            url: `https://www.utahrealestate.com/${listing.mlsId}`,
            fetchedAt: listing.updatedAt,
          });
        }
      }
    }
    
    // If we don't have local results, search external APIs
    if (results.length === 0) {
      console.log('[Search] No local results, searching external sources...');
      
      // Always use the new comprehensive API service which includes fallbacks
      const params: SearchParams = {
        query: mlsNumber || criteria.query,
        address: criteria.address,
        city: criteria.city,
        state: criteria.state || 'UT',
        zipCode: criteria.zipCode,
        minPrice: criteria.minPrice,
        maxPrice: criteria.maxPrice,
        minBeds: criteria.minBeds,
        maxBeds: criteria.maxBeds,
        minBaths: criteria.minBaths,
        maxBaths: criteria.maxBaths,
        minSqft: criteria.minSqft,
        maxSqft: criteria.maxSqft,
        propertyType: criteria.propertyType,
        status: criteria.status,
        limit: criteria.limit || 50,
      };
      
      results = await searchPropertiesNew(req.agentId, params);
      console.log(`[Search] External search returned ${results.length} results`);
    }
    
    const requestedSources = Array.isArray(criteria.sources) ? criteria.sources : null;
    const filteredResults = requestedSources?.length
      ? results.filter(r => requestedSources.includes(r.source))
      : results;

    return res.json({
      count: filteredResults.length,
      criteria,
      mlsNumber,
      results: filteredResults,
    });
  } catch (error: any) {
    console.error('Property search error:', error);
    return res.status(500).json({ error: 'Search failed: ' + error.message });
  }
});

/**
 * GET /api/search/property/:id
 * Get a single property by MLS# or property ID
 */
router.get('/property/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Always use the new service (cache + UtahRE + optional APIs). This avoids flaky legacy scraping.
    const property = await getPropertyByIdNew(req.agentId, id);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    return res.json(property);
  } catch (error: any) {
    console.error('Property fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch property' });
  }
});

/**
 * GET /api/search/suggestions
 * Fast autocomplete suggestions for command bar
 */
router.get('/suggestions', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const query = (req.query.q as string || '').toLowerCase().trim();
    const limit = parseInt(req.query.limit as string) || 10;

    // Get property suggestions from MLS listings
    const properties = query.length >= 2 ? await prisma.mlsListing.findMany({
      where: {
        agentId: req.agentId,
        OR: [
          { addressLine1: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { zip: { contains: query, mode: 'insensitive' } },
          { mlsNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { lastFetchedAt: 'desc' },
      select: {
        id: true,
        mlsNumber: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
        price: true,
      },
    }) : [];

    // Get client suggestions
    const clients = query.length >= 2 ? await prisma.client.findMany({
      where: {
        agentId: req.agentId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    }) : [];

    // Get listing suggestions from agent's listings
    const listings = query.length >= 2 ? await prisma.listing.findMany({
      where: {
        agentId: req.agentId,
        OR: [
          { addressLine1: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { zipCode: { contains: query, mode: 'insensitive' } },
          { mlsId: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        addressLine1: true,
        city: true,
        state: true,
        zipCode: true,
        price: true,
        status: true,
        mlsId: true,
      },
    }) : [];

    return res.json({
      properties: properties.map(p => ({
        type: 'property' as const,
        id: p.id,
        mlsNumber: p.mlsNumber,
        address: `${p.addressLine1}, ${p.city}, ${p.state} ${p.zip}`,
        price: Number(p.price),
      })),
      clients: clients.map(c => ({
        type: 'client' as const,
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone,
        clientType: c.role,
      })),
      listings: listings.map(l => ({
        type: 'listing' as const,
        id: l.id,
        mlsNumber: l.mlsId,
        address: `${l.addressLine1}, ${l.city}, ${l.state} ${l.zipCode}`,
        price: Number(l.price),
        status: l.status,
      })),
    });
  } catch (error: any) {
    console.error('Suggestions error:', error);
    return res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

/**
 * GET /api/search/history
 * Get recent search results cached for this agent
 */
router.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    
    const cached = await prisma.mlsListing.findMany({
      where: { agentId: req.agentId },
      orderBy: { lastFetchedAt: 'desc' },
      take: limit,
    });

    const results: PropertySearchResult[] = cached.map(c => ({
      source: ((c.raw as any)?.source as any) || 'utahrealestate',
      mlsId: c.mlsNumber,
      zpid: (c.raw as any)?.zpid,
      taxId: (c.raw as any)?.taxId,
      address: {
        street: c.addressLine1 || '',
        city: c.city || '',
        state: c.state || 'UT',
        zip: c.zip || '',
        fullAddress: `${c.addressLine1}, ${c.city}, ${c.state} ${c.zip}`,
      },
      price: Number(c.price) || 0,
      beds: c.beds ? Number(c.beds) : undefined,
      baths: c.baths ? Number(c.baths) : undefined,
      sqft: c.squareFeet || undefined,
      yearBuilt: c.yearBuilt || undefined,
      description: c.description || undefined,
      photos: (c.photos as string[]) || [],
      url: c.sourceUrl || '',
      fetchedAt: c.lastFetchedAt,
    }));

    return res.json({ count: results.length, results });
  } catch (error: any) {
    console.error('Search history error:', error);
    return res.status(500).json({ error: 'Failed to load search history' });
  }
});

/**
 * POST /api/search/save-search
 * Save search criteria for alerts
 */
router.post('/save-search', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { clientId, leadId, criteria } = req.body as {
      clientId?: string;
      leadId?: string;
      criteria: SearchCriteria;
    };

    if (!clientId && !leadId) {
      return res.status(400).json({ error: 'Either clientId or leadId is required' });
    }

    const savedSearch = await prisma.searchCriteria.create({
      data: {
        clientId: clientId || null,
        leadId: leadId || null,
        minPrice: criteria.minPrice,
        maxPrice: criteria.maxPrice,
        minBeds: criteria.minBeds,
        minBaths: criteria.minBaths,
        cities: criteria.city ? [criteria.city] : [],
        zipCodes: criteria.zipCode ? [criteria.zipCode] : [],
        propertyTypes: criteria.propertyTypes || [],
      },
    });

    return res.json(savedSearch);
  } catch (error: any) {
    console.error('Save search error:', error);
    return res.status(500).json({ error: 'Failed to save search' });
  }
});

export default router;
