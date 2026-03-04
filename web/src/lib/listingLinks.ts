/**
 * External Portal Link Builder
 * 
 * Pure utility functions for building outbound links to real estate portals.
 * NO scraping, NO API calls - just URL construction for deep linking.
 */

export interface ListingQuery {
  mlsNumber?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// Base URLs - can be overridden via environment variables
// @ts-ignore - Vite provides import.meta.env
const UTAH_REALESTATE_BASE = import.meta.env.VITE_UTAHREALESTATE_SEARCH_BASE || 'https://www.utahrealestate.com';
// @ts-ignore - Vite provides import.meta.env
const ZILLOW_BASE = import.meta.env.VITE_ZILLOW_SEARCH_BASE || 'https://www.zillow.com';
// @ts-ignore - Vite provides import.meta.env
const HOMES_BASE = import.meta.env.VITE_HOMES_SEARCH_BASE || 'https://www.homes.com';
// @ts-ignore - Vite provides import.meta.env
const REALTOR_BASE = import.meta.env.VITE_REALTOR_SEARCH_BASE || 'https://www.realtor.com';
// @ts-ignore - Vite provides import.meta.env
const REDFIN_BASE = import.meta.env.VITE_REDFIN_SEARCH_BASE || 'https://www.redfin.com';

/**
 * Build a full address string from query parts
 */
function buildAddressString(query: ListingQuery): string | null {
  const parts: string[] = [];
  
  if (query.addressLine) parts.push(query.addressLine.trim());
  if (query.city) parts.push(query.city.trim());
  if (query.state) parts.push(query.state.trim());
  if (query.zip) parts.push(query.zip.trim());
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Build a URL-safe search query string
 */
function encodeSearchQuery(text: string): string {
  return encodeURIComponent(text.replace(/\s+/g, ' ').trim());
}

/**
 * Build UtahRealEstate.com link
 * - If MLS number is provided, links directly to listing page
 * - Otherwise, constructs a search URL
 */
export function buildUtahRealEstateLink(query: ListingQuery): string | null {
  // Direct MLS lookup (UtahRealEstate uses MLS# in URL path)
  if (query.mlsNumber) {
    const mlsClean = query.mlsNumber.replace(/[^0-9]/g, '');
    if (mlsClean) {
      return `${UTAH_REALESTATE_BASE}/${mlsClean}`;
    }
  }
  
  // Address-based search
  const address = buildAddressString(query);
  if (address) {
    return `${UTAH_REALESTATE_BASE}/search/map?q=${encodeSearchQuery(address)}`;
  }
  
  return null;
}

/**
 * Build Zillow link
 * - Constructs a homes search URL with address query
 */
export function buildZillowLink(query: ListingQuery): string | null {
  // Zillow search prefers full address or city/state
  const address = buildAddressString(query);
  
  if (address) {
    // Zillow's search endpoint
    return `${ZILLOW_BASE}/homes/${encodeSearchQuery(address).replace(/%20/g, '-').replace(/%2C/g, '')}_rb/`;
  }
  
  // City + State fallback
  if (query.city && query.state) {
    const citySlug = query.city.toLowerCase().replace(/\s+/g, '-');
    const stateSlug = query.state.toLowerCase();
    return `${ZILLOW_BASE}/${citySlug}-${stateSlug}/`;
  }
  
  // ZIP code search
  if (query.zip) {
    return `${ZILLOW_BASE}/homes/${query.zip}_rb/`;
  }
  
  return null;
}

/**
 * Build Homes.com link
 * - Constructs a property search URL
 */
export function buildHomesLink(query: ListingQuery): string | null {
  const address = buildAddressString(query);
  
  if (address) {
    return `${HOMES_BASE}/property-search/?q=${encodeSearchQuery(address)}`;
  }
  
  // City + State fallback
  if (query.city && query.state) {
    const citySlug = query.city.toLowerCase().replace(/\s+/g, '-');
    const stateSlug = query.state.toLowerCase();
    return `${HOMES_BASE}/${stateSlug}/${citySlug}/`;
  }
  
  // ZIP code search
  if (query.zip) {
    return `${HOMES_BASE}/property-search/?q=${query.zip}`;
  }
  
  return null;
}

/**
 * Build Realtor.com link
 * - Constructs a property search URL
 */
export function buildRealtorLink(query: ListingQuery): string | null {
  const address = buildAddressString(query);
  
  if (address) {
    return `${REALTOR_BASE}/realestateandhomes-search/${encodeSearchQuery(address).replace(/%20/g, '_').replace(/%2C/g, '')}`;
  }
  
  // City + State fallback
  if (query.city && query.state) {
    const citySlug = query.city.replace(/\s+/g, '-');
    const stateSlug = query.state.toUpperCase();
    return `${REALTOR_BASE}/realestateandhomes-search/${citySlug}_${stateSlug}`;
  }
  
  // ZIP code search
  if (query.zip) {
    return `${REALTOR_BASE}/realestateandhomes-search/${query.zip}`;
  }
  
  return null;
}

/**
 * Build Redfin link
 * - Constructs a search URL
 */
export function buildRedfinLink(query: ListingQuery): string | null {
  const address = buildAddressString(query);
  
  if (address) {
    return `${REDFIN_BASE}/search?search=${encodeSearchQuery(address)}`;
  }
  
  // City + State fallback
  if (query.city && query.state) {
    const citySlug = query.city.replace(/\s+/g, '-');
    const stateSlug = query.state.toUpperCase();
    return `${REDFIN_BASE}/city/${citySlug}-${stateSlug}`;
  }
  
  // ZIP code search
  if (query.zip) {
    return `${REDFIN_BASE}/zipcode/${query.zip}`;
  }
  
  return null;
}

/**
 * Build Google Maps link for property location
 */
export function buildGoogleMapsLink(query: ListingQuery): string | null {
  const address = buildAddressString(query);
  
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeSearchQuery(address)}`;
  }
  
  return null;
}

/**
 * Build County Assessor search link (via Google)
 */
export function buildAssessorLink(query: ListingQuery): string | null {
  const address = buildAddressString(query);
  
  if (address) {
    const county = query.city ? `${query.city} county` : 'county';
    return `https://www.google.com/search?q=${encodeSearchQuery(`${address} ${county} assessor property records`)}`;
  }
  
  return null;
}

/**
 * Portal metadata for UI rendering
 */
export interface PortalInfo {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  buildLink: (query: ListingQuery) => string | null;
}

export const PORTALS: PortalInfo[] = [
  {
    id: 'utahrealestate',
    name: 'UtahRealEstate.com',
    shortName: 'Utah MLS',
    icon: '🏔️',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    buildLink: buildUtahRealEstateLink,
  },
  {
    id: 'zillow',
    name: 'Zillow',
    shortName: 'Zillow',
    icon: '🏠',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-500/30',
    buildLink: buildZillowLink,
  },
  {
    id: 'homes',
    name: 'Homes.com',
    shortName: 'Homes',
    icon: '🏡',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
    buildLink: buildHomesLink,
  },
  {
    id: 'realtor',
    name: 'Realtor.com',
    shortName: 'Realtor',
    icon: '🔑',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    buildLink: buildRealtorLink,
  },
  {
    id: 'redfin',
    name: 'Redfin',
    shortName: 'Redfin',
    icon: '📍',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/30',
    buildLink: buildRedfinLink,
  },
];

/**
 * Get all available portal links for a property
 */
export function getAllPortalLinks(query: ListingQuery): Array<{ portal: PortalInfo; url: string }> {
  return PORTALS
    .map(portal => ({
      portal,
      url: portal.buildLink(query),
    }))
    .filter((item): item is { portal: PortalInfo; url: string } => item.url !== null);
}
