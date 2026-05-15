/**
 * Property Intelligence Module
 * 
 * Aggregates LEGALLY AVAILABLE public data about properties.
 * NO scraping - uses official APIs and public records only.
 */

export interface PropertyIntelQuery {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

export interface GeocodedAddress {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string;
  county?: string;
  neighborhood?: string;
}

export interface WalkScoreData {
  walkScore: number;
  walkDescription: string;
  transitScore?: number;
  transitDescription?: string;
  bikeScore?: number;
  bikeDescription?: string;
}

export interface CensusData {
  population?: number;
  medianIncome?: number;
  medianHomeValue?: number;
  medianRent?: number;
  ownerOccupied?: number;
  renterOccupied?: number;
  medianAge?: number;
}

export interface CountyAssessorInfo {
  county: string;
  assessorUrl: string;
  parcelSearchUrl?: string;
}

export interface PropertyIntelResult {
  query: PropertyIntelQuery;
  geocoded?: GeocodedAddress;
  walkScore?: WalkScoreData;
  census?: CensusData;
  assessor?: CountyAssessorInfo;
  googleMapsUrl?: string;
  streetViewUrl?: string;
  satelliteViewUrl?: string;
  error?: string;
}

// Utah County Assessor URLs (public information)
const UTAH_COUNTY_ASSESSORS: Record<string, CountyAssessorInfo> = {
  'salt lake': {
    county: 'Salt Lake County',
    assessorUrl: 'https://slco.org/assessor/',
    parcelSearchUrl: 'https://slco.org/assessor/new/query.cfm',
  },
  'utah': {
    county: 'Utah County',
    assessorUrl: 'https://www.utahcounty.gov/Dept/Assess/',
    parcelSearchUrl: 'https://www.utahcounty.gov/LandRecords/PropertySearch.asp',
  },
  'davis': {
    county: 'Davis County',
    assessorUrl: 'https://www.daviscountyutah.gov/assessor',
    parcelSearchUrl: 'https://www.daviscountyutah.gov/recorder/property-search',
  },
  'weber': {
    county: 'Weber County',
    assessorUrl: 'https://www.webercountyutah.gov/assessor/',
    parcelSearchUrl: 'https://www3.co.weber.ut.us/assessor/',
  },
  'washington': {
    county: 'Washington County',
    assessorUrl: 'https://www.washco.utah.gov/assessor/',
    parcelSearchUrl: 'https://www.washco.utah.gov/assessor/parcel-search/',
  },
  'cache': {
    county: 'Cache County',
    assessorUrl: 'https://www.cachecounty.org/assessor/',
    parcelSearchUrl: 'https://www.cachecounty.org/gis/',
  },
  'summit': {
    county: 'Summit County',
    assessorUrl: 'https://www.summitcounty.org/162/Assessor',
    parcelSearchUrl: 'https://www.summitcounty.org/162/Assessor',
  },
  'iron': {
    county: 'Iron County',
    assessorUrl: 'https://www.ironcounty.net/departments/assessor/',
    parcelSearchUrl: 'https://www.ironcounty.net/departments/assessor/',
  },
  'box elder': {
    county: 'Box Elder County',
    assessorUrl: 'https://www.boxeldercounty.org/assessor.htm',
    parcelSearchUrl: 'https://eagleweb.boxeldercounty.org/assessor/web/',
  },
  'tooele': {
    county: 'Tooele County',
    assessorUrl: 'https://tooelecounty.org/assessor/',
    parcelSearchUrl: 'https://tooelecounty.org/assessor/',
  },
};

// City to County mapping for Utah (partial - common cities)
const UTAH_CITY_TO_COUNTY: Record<string, string> = {
  'salt lake city': 'salt lake',
  'sandy': 'salt lake',
  'west valley city': 'salt lake',
  'west jordan': 'salt lake',
  'south jordan': 'salt lake',
  'murray': 'salt lake',
  'taylorsville': 'salt lake',
  'midvale': 'salt lake',
  'cottonwood heights': 'salt lake',
  'holladay': 'salt lake',
  'draper': 'salt lake',
  'herriman': 'salt lake',
  'riverton': 'salt lake',
  'bluffdale': 'salt lake',
  'provo': 'utah',
  'orem': 'utah',
  'lehi': 'utah',
  'american fork': 'utah',
  'pleasant grove': 'utah',
  'spanish fork': 'utah',
  'springville': 'utah',
  'saratoga springs': 'utah',
  'eagle mountain': 'utah',
  'payson': 'utah',
  'lindon': 'utah',
  'highland': 'utah',
  'alpine': 'utah',
  'cedar hills': 'utah',
  'layton': 'davis',
  'bountiful': 'davis',
  'kaysville': 'davis',
  'clearfield': 'davis',
  'farmington': 'davis',
  'centerville': 'davis',
  'syracuse': 'davis',
  'clinton': 'davis',
  'ogden': 'weber',
  'roy': 'weber',
  'north ogden': 'weber',
  'south ogden': 'weber',
  'washington': 'washington',
  'st. george': 'washington',
  'st george': 'washington',
  'hurricane': 'washington',
  'ivins': 'washington',
  'santa clara': 'washington',
  'logan': 'cache',
  'north logan': 'cache',
  'hyde park': 'cache',
  'smithfield': 'cache',
  'park city': 'summit',
  'heber': 'wasatch',
  'heber city': 'wasatch',
  'cedar city': 'iron',
  'tooele': 'tooele',
  'grantsville': 'tooele',
  'brigham city': 'box elder',
};

/**
 * Get county assessor info based on city name
 */
export function getCountyAssessorInfo(city?: string): CountyAssessorInfo | null {
  if (!city) return null;
  
  const normalizedCity = city.toLowerCase().trim();
  const county = UTAH_CITY_TO_COUNTY[normalizedCity];
  
  if (county && UTAH_COUNTY_ASSESSORS[county]) {
    return UTAH_COUNTY_ASSESSORS[county];
  }
  
  return null;
}

/**
 * Build Google Maps URLs for a location
 */
export function buildGoogleMapsUrls(lat: number, lng: number, address?: string) {
  const query = address ? encodeURIComponent(address) : `${lat},${lng}`;
  
  return {
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${query}`,
    streetViewUrl: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
    satelliteViewUrl: `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e3`,
  };
}

/**
 * Build a static map image URL (no API key needed for basic usage)
 */
export function buildStaticMapUrl(lat: number, lng: number, zoom = 15, size = '400x300'): string {
  // OpenStreetMap static tiles (free, no API key)
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=${lat},${lng},red-pushpin`;
}

/**
 * Build embedded map iframe URL
 */
export function buildEmbedMapUrl(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

/**
 * Format address for display
 */
export function formatAddress(query: PropertyIntelQuery): string {
  const parts: string[] = [];
  if (query.address) parts.push(query.address);
  if (query.city) parts.push(query.city);
  if (query.state) parts.push(query.state);
  if (query.zip) parts.push(query.zip);
  return parts.join(', ');
}

/**
 * Estimate coordinates from ZIP code (rough center points for Utah ZIPs)
 * This is a fallback when we don't have geocoding API access
 */
const UTAH_ZIP_COORDS: Record<string, [number, number]> = {
  '84101': [40.7608, -111.8910], // SLC Downtown
  '84102': [40.7596, -111.8637],
  '84103': [40.7771, -111.8716],
  '84104': [40.7569, -111.9315],
  '84105': [40.7404, -111.8589],
  '84106': [40.7156, -111.8557],
  '84107': [40.6783, -111.8835],
  '84108': [40.7440, -111.8182],
  '84109': [40.7089, -111.8210],
  '84111': [40.7545, -111.8786],
  '84115': [40.7229, -111.8870],
  '84116': [40.7893, -111.9273],
  '84117': [40.6692, -111.8316],
  '84118': [40.6545, -111.9842],
  '84119': [40.6826, -111.9392],
  '84120': [40.6974, -111.9713],
  '84121': [40.6245, -111.8327],
  '84123': [40.6483, -111.9051],
  '84124': [40.6546, -111.8546],
  '84128': [40.7197, -112.0232],
  '84129': [40.6705, -111.9631],
  '84401': [41.2230, -111.9738], // Ogden
  '84601': [40.2338, -111.6585], // Provo
  '84604': [40.2610, -111.6509],
  '84606': [40.2139, -111.6371],
  '84043': [40.3916, -111.8507], // Lehi
  '84065': [40.5217, -111.9302], // Riverton
  '84770': [37.1041, -113.5841], // St. George
  '84532': [38.5733, -109.5498], // Moab
  '84098': [40.6461, -111.4980], // Park City
};

export function estimateCoordsFromZip(zip?: string): [number, number] | null {
  if (!zip) return null;
  const coords = UTAH_ZIP_COORDS[zip];
  return coords || null;
}

/**
 * Get all available property intelligence for a query
 * This aggregates all the free/public data we can legally access
 */
export async function getPropertyIntel(query: PropertyIntelQuery): Promise<PropertyIntelResult> {
  const result: PropertyIntelResult = { query };
  
  // Get county assessor info
  result.assessor = getCountyAssessorInfo(query.city) || undefined;
  
  // Try to get coordinates
  let lat = query.lat;
  let lng = query.lng;
  
  if (!lat || !lng) {
    const zipCoords = estimateCoordsFromZip(query.zip);
    if (zipCoords) {
      [lat, lng] = zipCoords;
    }
  }
  
  // If we have coordinates, build map URLs
  if (lat && lng) {
    const fullAddress = formatAddress(query);
    const mapUrls = buildGoogleMapsUrls(lat, lng, fullAddress);
    result.googleMapsUrl = mapUrls.googleMapsUrl;
    result.streetViewUrl = mapUrls.streetViewUrl;
    result.satelliteViewUrl = mapUrls.satelliteViewUrl;
    
    result.geocoded = {
      formattedAddress: fullAddress,
      lat,
      lng,
    };
  }
  
  return result;
}

/**
 * Census data fetcher (uses free Census Bureau API)
 * Note: This requires setting up with a Census API key for full access
 */
export async function fetchCensusData(zip: string): Promise<CensusData | null> {
  // @ts-ignore - Vite injects import.meta.env
  const CENSUS_API_KEY = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_CENSUS_API_KEY : undefined;
  
  if (!CENSUS_API_KEY) {
    console.log('Census API key not configured. Set VITE_CENSUS_API_KEY to enable demographic data.');
    return null;
  }
  
  try {
    // Census ACS 5-year estimates by ZIP Code Tabulation Area
    // Variables: B01003_001E (population), B19013_001E (median income),
    //            B25077_001E (median home value), B25064_001E (median rent)
    const url = `https://api.census.gov/data/2021/acs/acs5?get=B01003_001E,B19013_001E,B25077_001E,B25064_001E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data || data.length < 2) return null;
    
    const [headers, values] = data;
    
    return {
      population: parseInt(values[0]) || undefined,
      medianIncome: parseInt(values[1]) || undefined,
      medianHomeValue: parseInt(values[2]) || undefined,
      medianRent: parseInt(values[3]) || undefined,
    };
  } catch (err) {
    console.error('Census API error:', err);
    return null;
  }
}

/**
 * Walk Score API fetcher
 * Note: Requires a Walk Score API key (free tier available)
 */
export async function fetchWalkScore(lat: number, lng: number, address: string): Promise<WalkScoreData | null> {
  // @ts-ignore - Vite injects import.meta.env
  const WALK_SCORE_API_KEY = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_WALK_SCORE_API_KEY : undefined;
  
  if (!WALK_SCORE_API_KEY) {
    console.log('Walk Score API key not configured. Set VITE_WALK_SCORE_API_KEY to enable walkability scores.');
    return null;
  }
  
  try {
    const url = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lng}&transit=1&bike=1&wsapikey=${WALK_SCORE_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      walkScore: data.walkscore || 0,
      walkDescription: data.description || 'Unknown',
      transitScore: data.transit?.score,
      transitDescription: data.transit?.description,
      bikeScore: data.bike?.score,
      bikeDescription: data.bike?.description,
    };
  } catch (err) {
    console.error('Walk Score API error:', err);
    return null;
  }
}
