/**
 * Property Search Service
 * Aggregates property data from multiple sources:
 * - UtahRealEstate.com (MLS)
 * - Zillow
 * - Realtor.com
 * - Redfin
 */

import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';

export interface PropertySearchResult {
  source: 'utahrealestate' | 'zillow' | 'realtor' | 'redfin' | 'unknown';
  mlsId?: string;
  zpid?: string; // Zillow Property ID
  taxId?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    fullAddress: string;
  };
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  status?: string;
  daysOnMarket?: number;
  description?: string;
  photos: string[];
  features?: string[];
  url: string;
  fetchedAt: Date;
  raw?: Record<string, any>;
}

export interface SearchCriteria {
  query?: string; // Free-text search (address, MLS#, etc.)
  city?: string;
  zipCode?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  propertyTypes?: string[];
  status?: string[];
  sources?: ('utahrealestate' | 'zillow' | 'realtor' | 'redfin')[];
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Rate limiting to be respectful to external sites
const rateLimitDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main search function - searches across multiple sources
 */
export async function searchProperties(
  agentId: string,
  criteria: SearchCriteria
): Promise<PropertySearchResult[]> {
  const sources = criteria.sources || ['utahrealestate', 'zillow'];
  const results: PropertySearchResult[] = [];
  const errors: string[] = [];

  // Search each source in parallel with error handling
  const searchPromises = sources.map(async (source) => {
    try {
      switch (source) {
        case 'utahrealestate':
          const utahResults = await searchUtahRealEstate(criteria);
          results.push(...utahResults);
          break;
        case 'zillow':
          const zillowResults = await searchZillow(criteria);
          results.push(...zillowResults);
          break;
        case 'realtor':
          const realtorResults = await searchRealtorCom(criteria);
          results.push(...realtorResults);
          break;
        case 'redfin':
          const redfinResults = await searchRedfin(criteria);
          results.push(...redfinResults);
          break;
      }
    } catch (error: any) {
      console.error(`Error searching ${source}:`, error.message);
      errors.push(`${source}: ${error.message}`);
    }
  });

  await Promise.all(searchPromises);

  // De-duplicate results by address
  const uniqueResults = deduplicateResults(results);

  // Cache results for the agent
  await cacheSearchResults(agentId, uniqueResults);

  return uniqueResults;
}

/**
 * Search UtahRealEstate.com
 */
async function searchUtahRealEstate(criteria: SearchCriteria): Promise<PropertySearchResult[]> {
  const results: PropertySearchResult[] = [];
  
  // If searching by MLS number
  const mlsMatch = criteria.query?.match(/\b\d{6,8}\b/);
  if (mlsMatch) {
    const listing = await fetchUtahRealEstateListing(mlsMatch[0]);
    if (listing) results.push(listing);
    return results;
  }

  // Build search URL for Utah Real Estate
  // Their search uses different URL patterns
  let searchUrl = 'https://www.utahrealestate.com/search/map.search';
  const params = new URLSearchParams();
  
  // If we have a free-text address query, use it
  if (criteria.query) {
    // This appears to be an address search
    params.append('q', criteria.query);
    params.append('type', 'res'); // residential
  }
  
  if (criteria.city) {
    params.append('city', criteria.city);
  }
  if (criteria.zipCode) {
    params.append('zip', criteria.zipCode);
  }
  if (criteria.minPrice) {
    params.append('minprice', criteria.minPrice.toString());
  }
  if (criteria.maxPrice) {
    params.append('maxprice', criteria.maxPrice.toString());
  }
  if (criteria.minBeds) {
    params.append('minbeds', criteria.minBeds.toString());
  }
  if (criteria.minBaths) {
    params.append('minbaths', criteria.minBaths.toString());
  }

  // Add default params
  params.append('status', 'active');
  params.append('limit', '20');

  try {
    // First try the API endpoint that returns JSON
    const apiUrl = `https://www.utahrealestate.com/api/v1/search?${params.toString()}`;
    console.log('[UtahRE] Searching:', apiUrl);
    
    let response = await fetch(apiUrl, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      try {
        const data = await response.json();
        const listings = data?.results || data?.listings || data || [];
        
        if (Array.isArray(listings)) {
          for (const listing of listings.slice(0, 20)) {
            if (listing.listPrice || listing.price) {
              results.push({
                source: 'utahrealestate',
                mlsId: listing.mlsNumber || listing.listingId || listing.mls,
                address: {
                  street: listing.streetAddress || listing.address || '',
                  city: listing.city || '',
                  state: listing.state || 'UT',
                  zip: listing.zipCode || listing.zip || '',
                  fullAddress: listing.fullAddress || `${listing.streetAddress || listing.address}, ${listing.city}, ${listing.state || 'UT'} ${listing.zipCode || listing.zip}`,
                },
                price: listing.listPrice || listing.price || 0,
                beds: listing.bedrooms || listing.beds,
                baths: listing.bathrooms || listing.baths,
                sqft: listing.squareFeet || listing.sqft,
                yearBuilt: listing.yearBuilt,
                status: listing.status,
                daysOnMarket: listing.daysOnMarket,
                photos: listing.photos || listing.images || [],
                url: listing.detailUrl || `https://www.utahrealestate.com/${listing.mlsNumber || listing.listingId}`,
                fetchedAt: new Date(),
              });
            }
          }
        }
      } catch (e) {
        console.log('[UtahRE] JSON parse failed, trying HTML scrape');
      }
    }

    // If API didn't work or returned no results, try HTML scraping
    if (results.length === 0) {
      searchUrl = `https://www.utahrealestate.com/search/map.search?${params.toString()}`;
      console.log('[UtahRE] Scraping HTML:', searchUrl);
      
      response = await fetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Parse search results - try multiple possible selectors
        const listingSelectors = [
          '[data-listing-id]',
          '.listing-card',
          '.property-card', 
          '.search-result-item',
          '[data-mls]',
          '.listing-item',
        ];

        for (const selector of listingSelectors) {
          $(selector).each((_, element) => {
            try {
              const $el = $(element);
              const mlsId = $el.attr('data-listing-id') || 
                           $el.attr('data-mls') || 
                           $el.find('[data-mls]').attr('data-mls') ||
                           $el.find('[data-listing-id]').attr('data-listing-id');
              
              const priceText = $el.find('.price, [data-price], .listing-price, .list-price').text();
              const price = parsePrice(priceText);
              
              const addressEl = $el.find('.address, .street-address, .listing-address, [itemprop="streetAddress"]');
              const address = addressEl.text().trim();
              
              const cityStateZip = $el.find('.city-state, .location, .city-state-zip, .listing-location').text().trim();
              
              const beds = parseInt($el.find('.beds, [data-beds], .bedrooms').text()) || undefined;
              const baths = parseFloat($el.find('.baths, [data-baths], .bathrooms').text()) || undefined;
              const sqft = parseInt($el.find('.sqft, [data-sqft], .square-feet').text().replace(/[^0-9]/g, '')) || undefined;

              if (address && price > 0) {
                results.push({
                  source: 'utahrealestate',
                  mlsId,
                  address: parseAddress(address + (cityStateZip ? ', ' + cityStateZip : '')),
                  price,
                  beds,
                  baths,
                  sqft,
                  photos: [],
                  url: mlsId ? `https://www.utahrealestate.com/${mlsId}` : searchUrl,
                  fetchedAt: new Date(),
                });
              }
            } catch (e) {
              // Skip malformed listings
            }
          });
          
          if (results.length > 0) break; // Found listings with this selector
        }
      }
    }

    await rateLimitDelay(500);
  } catch (error) {
    console.error('Utah Real Estate search error:', error);
  }

  // If searching by address and we got no results, try resolving MLS from HTML
  if (results.length === 0 && criteria.query) {
    const resolved = await resolveUtahRealEstateByAddress(criteria.query);
    if (resolved) {
      results.push(resolved);
    } else {
      console.log('[UtahRE] No results from scraping, address may not be indexed yet');
    }
  }

  return results;
}

/**
 * Try to resolve a UtahRealEstate MLS# from an address query and fetch the full listing.
 */
async function resolveUtahRealEstateByAddress(query: string): Promise<PropertySearchResult | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const encoded = encodeURIComponent(normalizedQuery);
  const candidateUrls = [
    `https://www.utahrealestate.com/search/map.search?type=res&q=${encoded}`,
    `https://www.utahrealestate.com/search/map.search?q=${encoded}`,
    `https://www.utahrealestate.com/search?type=res&search=${encoded}`,
    `https://www.utahrealestate.com/search?search=${encoded}`,
  ];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) continue;
      const html = await response.text();

      const mlsIds = extractUtahMlsIds(html);
      if (mlsIds.length > 0) {
        const listing = await fetchUtahRealEstateListing(mlsIds[0]);
        if (listing) return listing;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}

function extractUtahMlsIds(html: string): string[] {
  const ids = new Set<string>();

  // Direct URL patterns
  const urlMatches = (html.match(/utahrealestate\.com\/(\d{6,8})/g) ?? []) as string[];
  urlMatches.forEach((m) => {
    const id = m.match(/(\d{6,8})/)?.[1];
    if (id) ids.add(id);
  });

  // JSON patterns
  const jsonIdMatches = (html.match(/"(?:mlsNumber|listingId|ListNo)"\s*:\s*"?(\d{6,8})"?/g) ?? []) as string[];
  jsonIdMatches.forEach((m) => {
    const id = m.match(/(\d{6,8})/)?.[1];
    if (id) ids.add(id);
  });

  return Array.from(ids);
}

/**
 * Fetch a single listing from UtahRealEstate.com by MLS#
 */
async function fetchUtahRealEstateListing(mlsNumber: string): Promise<PropertySearchResult | null> {
  const url = `https://www.utahrealestate.com/${mlsNumber}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract JSON-LD data if available
    const jsonLd = extractJsonLd($);
    
    // Parse structured data or fall back to scraping
    const price = jsonLd?.price || parsePrice($('[data-price], .listing-price, .price').first().text());
    const addressText = jsonLd?.address?.streetAddress || $('[itemprop="streetAddress"], .address').first().text().trim();
    const city = jsonLd?.address?.addressLocality || $('[itemprop="addressLocality"]').text().trim();
    const state = jsonLd?.address?.addressRegion || 'UT';
    const zip = jsonLd?.address?.postalCode || $('[itemprop="postalCode"]').text().trim();
    
    const beds = jsonLd?.numberOfBedrooms || parseInt($('[data-beds], .beds').text()) || undefined;
    const baths = jsonLd?.numberOfBathroomsTotal || parseFloat($('[data-baths], .baths').text()) || undefined;
    const sqft = jsonLd?.floorSize?.value || parseInt($('.sqft, [data-sqft]').text().replace(/[^0-9]/g, '')) || undefined;
    
    const description = jsonLd?.description || $('[itemprop="description"], .property-description').text().trim();
    
    // Extract photos
    const photos: string[] = [];
    $('img[src*="photo"], img[data-src*="photo"], .gallery img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !photos.includes(src)) photos.push(src);
    });

    if (!price) return null;

    return {
      source: 'utahrealestate',
      mlsId: mlsNumber,
      address: {
        street: addressText,
        city,
        state,
        zip,
        fullAddress: `${addressText}, ${city}, ${state} ${zip}`,
      },
      price,
      beds,
      baths,
      sqft,
      description,
      photos: photos.slice(0, 20),
      url,
      fetchedAt: new Date(),
      raw: jsonLd,
    };
  } catch (error) {
    console.error('Error fetching Utah listing:', error);
    return null;
  }
}

/**
 * Search Zillow
 */
async function searchZillow(criteria: SearchCriteria): Promise<PropertySearchResult[]> {
  const results: PropertySearchResult[] = [];
  
  // Build Zillow search URL
  let searchLocation = criteria.city || criteria.zipCode || 'Utah';
  if (criteria.city && criteria.zipCode) {
    searchLocation = `${criteria.city}-UT-${criteria.zipCode}`;
  }
  
  const searchUrl = `https://www.zillow.com/homes/${encodeURIComponent(searchLocation)}_rb/`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.log(`Zillow returned ${response.status} - may require authentication or different approach`);
      return results;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to find embedded JSON data (Zillow uses React/Next.js)
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || '';
      
      // Look for preloaded state with listing data
      if (content.includes('searchPageState') || content.includes('listResults')) {
        try {
          // Extract JSON from script content
          const jsonMatch = content.match(/{"queryState".*?"searchPageState".*?}(?=\s*<\/script>|$)/s);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const listings = data?.cat1?.searchResults?.listResults || 
                           data?.searchPageState?.cat1?.searchResults?.listResults || 
                           [];
            
            for (const listing of listings.slice(0, 20)) {
              if (listing.price && listing.address) {
                results.push({
                  source: 'zillow',
                  zpid: listing.zpid?.toString(),
                  address: {
                    street: listing.addressStreet || listing.address,
                    city: listing.addressCity || '',
                    state: listing.addressState || 'UT',
                    zip: listing.addressZipcode || '',
                    fullAddress: listing.address,
                  },
                  price: listing.unformattedPrice || parsePrice(listing.price),
                  beds: listing.beds,
                  baths: listing.baths,
                  sqft: listing.area,
                  status: listing.statusType,
                  daysOnMarket: listing.daysOnZillow,
                  photos: listing.carouselPhotos?.map((p: any) => p.url) || [],
                  url: listing.detailUrl ? `https://www.zillow.com${listing.detailUrl}` : searchUrl,
                  fetchedAt: new Date(),
                });
              }
            }
          }
        } catch (e) {
          // JSON parsing failed, continue
        }
      }
    }

    // Fallback: scrape visible listing cards
    if (results.length === 0) {
      $('[data-test="property-card"], .list-card, .property-card-link').each((_, element) => {
        try {
          const $el = $(element);
          const href = $el.attr('href') || $el.find('a').attr('href');
          const zpidMatch = href?.match(/\/(\d+)_zpid/);
          
          const priceText = $el.find('[data-test="property-card-price"]').text() || 
                           $el.find('.list-card-price').text();
          const price = parsePrice(priceText);
          
          const addressText = $el.find('[data-test="property-card-addr"]').text() ||
                             $el.find('.list-card-addr').text();
          
          const details = $el.find('[data-test="property-card-details"]').text() ||
                         $el.find('.list-card-details').text();
          
          const bedsMatch = details.match(/(\d+)\s*b[ed]/i);
          const bathsMatch = details.match(/(\d+(?:\.\d+)?)\s*ba/i);
          const sqftMatch = details.match(/([\d,]+)\s*sq/i);

          if (price && addressText) {
            results.push({
              source: 'zillow',
              zpid: zpidMatch?.[1],
              address: parseAddress(addressText),
              price,
              beds: bedsMatch ? parseInt(bedsMatch[1]) : undefined,
              baths: bathsMatch ? parseFloat(bathsMatch[1]) : undefined,
              sqft: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : undefined,
              photos: [],
              url: href?.startsWith('http') ? href : `https://www.zillow.com${href}`,
              fetchedAt: new Date(),
            });
          }
        } catch (e) {
          // Skip malformed cards
        }
      });
    }

    await rateLimitDelay(1000); // Be respectful to Zillow
  } catch (error) {
    console.error('Zillow search error:', error);
  }

  return applyFilters(results, criteria);
}

/**
 * Search Realtor.com
 */
async function searchRealtorCom(criteria: SearchCriteria): Promise<PropertySearchResult[]> {
  const results: PropertySearchResult[] = [];
  
  let searchLocation = criteria.city || criteria.zipCode || 'Utah';
  const searchUrl = `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(searchLocation.replace(/\s+/g, '-'))}_UT`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.log(`Realtor.com returned ${response.status}`);
      return results;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for embedded JSON data
    $('script[type="application/json"]').each((_, script) => {
      try {
        const content = $(script).html() || '';
        const data = JSON.parse(content);
        
        // Navigate to listing results
        const properties = data?.props?.pageProps?.properties || 
                          data?.searchResults?.properties ||
                          [];
        
        for (const prop of properties.slice(0, 20)) {
          if (prop.list_price && prop.location?.address) {
            results.push({
              source: 'realtor',
              address: {
                street: prop.location.address.line || '',
                city: prop.location.address.city || '',
                state: prop.location.address.state_code || 'UT',
                zip: prop.location.address.postal_code || '',
                fullAddress: `${prop.location.address.line}, ${prop.location.address.city}, ${prop.location.address.state_code} ${prop.location.address.postal_code}`,
              },
              price: prop.list_price,
              beds: prop.description?.beds,
              baths: prop.description?.baths_consolidated || prop.description?.baths,
              sqft: prop.description?.sqft,
              lotSize: prop.description?.lot_sqft,
              yearBuilt: prop.description?.year_built,
              propertyType: prop.description?.type,
              status: prop.status,
              daysOnMarket: prop.list_date ? Math.floor((Date.now() - new Date(prop.list_date).getTime()) / 86400000) : undefined,
              photos: prop.photos?.map((p: any) => p.href) || [],
              url: prop.permalink ? `https://www.realtor.com/realestateandhomes-detail/${prop.permalink}` : searchUrl,
              fetchedAt: new Date(),
            });
          }
        }
      } catch (e) {
        // JSON parsing failed
      }
    });

    await rateLimitDelay(800);
  } catch (error) {
    console.error('Realtor.com search error:', error);
  }

  return applyFilters(results, criteria);
}

/**
 * Search Redfin
 */
async function searchRedfin(criteria: SearchCriteria): Promise<PropertySearchResult[]> {
  const results: PropertySearchResult[] = [];
  
  // Redfin uses a different URL structure
  let searchLocation = criteria.city || 'Salt-Lake-City';
  const searchUrl = `https://www.redfin.com/city/17227/UT/${encodeURIComponent(searchLocation.replace(/\s+/g, '-'))}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.log(`Redfin returned ${response.status}`);
      return results;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Redfin embeds data in window.__reactServerState or similar
    $('script').each((_, script) => {
      const content = $(script).html() || '';
      if (content.includes('reactServerState') || content.includes('homeCards')) {
        try {
          // Extract listing data
          const dataMatch = content.match(/window\.__reactServerState\s*=\s*({.*?});/s) ||
                           content.match(/"homeCards"\s*:\s*(\[.*?\])/s);
          if (dataMatch) {
            const listings = JSON.parse(dataMatch[1])?.homeCards || [];
            
            for (const listing of listings.slice(0, 20)) {
              const home = listing.homeData || listing;
              if (home.priceInfo?.amount && home.addressInfo) {
                results.push({
                  source: 'redfin',
                  address: {
                    street: home.addressInfo.streetAddress || '',
                    city: home.addressInfo.city || '',
                    state: home.addressInfo.state || 'UT',
                    zip: home.addressInfo.zip || '',
                    fullAddress: home.addressInfo.formattedStreetLine || '',
                  },
                  price: home.priceInfo.amount,
                  beds: home.beds,
                  baths: home.baths,
                  sqft: home.sqFt?.value,
                  yearBuilt: home.yearBuilt,
                  status: home.listingType,
                  daysOnMarket: home.dom,
                  photos: home.photos?.map((p: any) => p.photoUrls?.fullScreenPhotoUrl) || [],
                  url: home.url ? `https://www.redfin.com${home.url}` : searchUrl,
                  fetchedAt: new Date(),
                });
              }
            }
          }
        } catch (e) {
          // Parsing failed
        }
      }
    });

    await rateLimitDelay(800);
  } catch (error) {
    console.error('Redfin search error:', error);
  }

  return applyFilters(results, criteria);
}

/**
 * Helper: Parse price from text
 */
function parsePrice(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.]/g, '');
  return parseInt(cleaned) || 0;
}

/**
 * Helper: Parse address string into components
 */
function parseAddress(text: string): PropertySearchResult['address'] {
  const parts = text.trim().split(/[,\n]+/).map(p => p.trim());
  
  let street = parts[0] || '';
  let city = '';
  let state = 'UT';
  let zip = '';
  
  if (parts.length >= 2) {
    // Try to parse city, state zip from remaining parts
    const lastPart = parts[parts.length - 1];
    const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/);
    
    if (stateZipMatch) {
      state = stateZipMatch[1];
      zip = stateZipMatch[2] || '';
      city = parts.length > 2 ? parts[1] : parts[1].replace(/[A-Z]{2}\s*\d{5}.*/, '').trim();
    } else {
      city = parts[1];
    }
  }
  
  return {
    street,
    city,
    state,
    zip,
    fullAddress: text.trim(),
  };
}

/**
 * Helper: Extract JSON-LD data
 */
function extractJsonLd($: cheerio.CheerioAPI): any {
  let result: any = null;
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'Product' || data['@type'] === 'RealEstateListing' || 
          data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'House') {
        result = data;
      }
    } catch (e) {
      // Invalid JSON
    }
  });
  
  return result;
}

/**
 * Helper: Apply search filters to results
 */
function applyFilters(results: PropertySearchResult[], criteria: SearchCriteria): PropertySearchResult[] {
  return results.filter(r => {
    if (criteria.minPrice && r.price < criteria.minPrice) return false;
    if (criteria.maxPrice && r.price > criteria.maxPrice) return false;
    if (criteria.minBeds && r.beds && r.beds < criteria.minBeds) return false;
    if (criteria.maxBeds && r.beds && r.beds > criteria.maxBeds) return false;
    if (criteria.minBaths && r.baths && r.baths < criteria.minBaths) return false;
    if (criteria.minSqft && r.sqft && r.sqft < criteria.minSqft) return false;
    if (criteria.maxSqft && r.sqft && r.sqft > criteria.maxSqft) return false;
    return true;
  });
}

/**
 * Helper: Remove duplicate listings by address similarity
 */
function deduplicateResults(results: PropertySearchResult[]): PropertySearchResult[] {
  const seen = new Map<string, PropertySearchResult>();
  
  for (const result of results) {
    // Create a normalized key from address
    const key = result.address.fullAddress
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30);
    
    // Keep the result with more data
    const existing = seen.get(key);
    if (!existing || countFields(result) > countFields(existing)) {
      seen.set(key, result);
    }
  }
  
  return Array.from(seen.values());
}

function countFields(result: PropertySearchResult): number {
  let count = 0;
  if (result.beds) count++;
  if (result.baths) count++;
  if (result.sqft) count++;
  if (result.yearBuilt) count++;
  if (result.description) count++;
  if (result.photos.length) count += result.photos.length;
  return count;
}

/**
 * Cache search results for an agent
 */
async function cacheSearchResults(agentId: string, results: PropertySearchResult[]): Promise<void> {
  // Store results in MlsListing table for future reference
  for (const result of results.slice(0, 50)) {
    try {
      const mlsNumber = result.mlsId || result.zpid || `ext_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      await prisma.mlsListing.upsert({
        where: {
          agentId_mlsNumber: {
            agentId,
            mlsNumber,
          },
        },
        create: {
          agentId,
          mlsNumber,
          headline: result.address.street,
          addressLine1: result.address.street,
          city: result.address.city,
          state: result.address.state,
          zip: result.address.zip,
          price: result.price,
          beds: result.beds,
          baths: result.baths,
          squareFeet: result.sqft,
          yearBuilt: result.yearBuilt,
          description: result.description,
          photos: result.photos as any,
          sourceUrl: result.url,
          raw: {
            source: result.source,
            zpid: result.zpid,
            daysOnMarket: result.daysOnMarket,
            status: result.status,
          } as any,
          lastFetchedAt: new Date(),
        },
        update: {
          price: result.price,
          lastFetchedAt: new Date(),
        },
      });
    } catch (e) {
      // Skip duplicates or errors
    }
  }
}

/**
 * Get a single property by ID (MLS# or ZPID)
 */
export async function getPropertyById(
  agentId: string,
  propertyId: string,
  source?: 'utahrealestate' | 'zillow'
): Promise<PropertySearchResult | null> {
  // Check cache first
  const cached = await prisma.mlsListing.findFirst({
    where: {
      agentId,
      OR: [
        { mlsNumber: propertyId },
        { raw: { path: ['zpid'], equals: propertyId } },
      ],
    },
  });

  if (cached && Date.now() - cached.lastFetchedAt.getTime() < 6 * 60 * 60 * 1000) {
    return {
      source: (cached.raw as any)?.source || 'utahrealestate',
      mlsId: cached.mlsNumber,
      address: {
        street: cached.addressLine1 || '',
        city: cached.city || '',
        state: cached.state || 'UT',
        zip: cached.zip || '',
        fullAddress: `${cached.addressLine1}, ${cached.city}, ${cached.state} ${cached.zip}`,
      },
      price: Number(cached.price) || 0,
      beds: cached.beds ? Number(cached.beds) : undefined,
      baths: cached.baths ? Number(cached.baths) : undefined,
      sqft: cached.squareFeet || undefined,
      yearBuilt: cached.yearBuilt || undefined,
      description: cached.description || undefined,
      photos: (cached.photos as string[]) || [],
      url: cached.sourceUrl || '',
      fetchedAt: cached.lastFetchedAt,
    };
  }

  // Fetch fresh data
  if (source === 'zillow' || propertyId.length > 10) {
    // Likely a Zillow property ID
    return fetchZillowProperty(propertyId);
  }
  
  // Default to Utah Real Estate
  return fetchUtahRealEstateListing(propertyId);
}

/**
 * Fetch a single property from Zillow by ZPID
 */
async function fetchZillowProperty(zpid: string): Promise<PropertySearchResult | null> {
  const url = `https://www.zillow.com/homedetails/${zpid}_zpid/`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract from meta tags or embedded JSON
    const price = parsePrice($('meta[property="product:price:amount"]').attr('content') || '');
    const address = $('meta[property="og:title"]').attr('content')?.split('|')[0].trim() || '';
    
    // Look for detailed data in scripts
    let details: any = {};
    $('script').each((_, script) => {
      const content = $(script).html() || '';
      if (content.includes('"zpid"') && content.includes(zpid)) {
        try {
          const match = content.match(/"hdpData"\s*:\s*({.*?})\s*,\s*"/s);
          if (match) details = JSON.parse(match[1]);
        } catch (e) {}
      }
    });

    if (!price && !details.price) return null;

    return {
      source: 'zillow',
      zpid,
      address: parseAddress(address || details.streetAddress || ''),
      price: price || details.price || 0,
      beds: details.bedrooms,
      baths: details.bathrooms,
      sqft: details.livingArea,
      yearBuilt: details.yearBuilt,
      description: details.description,
      photos: details.photos?.map((p: any) => p.url) || [],
      url,
      fetchedAt: new Date(),
    };
  } catch (error) {
    console.error('Error fetching Zillow property:', error);
    return null;
  }
}
