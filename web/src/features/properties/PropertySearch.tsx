import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { ALL_UTAH_CITIES } from '../../components/forms/AddressAutocomplete';
import { 
  ListingQuery, 
  PORTALS, 
  getAllPortalLinks,
  buildGoogleMapsLink,
  buildAssessorLink 
} from '../../lib/listingLinks';
import PropertyIntelPanel from '../../components/PropertyIntelPanel';

interface PropertyResult {
  source: 'utahrealestate' | 'zillow' | 'realtor' | 'redfin' | 'sample_data' | 'public_records' | 'internal' | 'unknown';
  mlsId?: string;
  zpid?: string;
  internalId?: string;
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
  yearBuilt?: number;
  description?: string;
  photos: string[];
  url: string;
  fetchedAt: Date;
}

interface SearchFilters {
  city?: string;
  zipCode?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  sources?: string[];
}

// Icons as SVG components
const Icons = {
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  Home: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  MapPin: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Bed: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16"/>
      <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
      <path d="M2 17h20"/>
      <path d="M6 8v9"/>
    </svg>
  ),
  Bath: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
      <line x1="10" x2="8" y1="5" y2="7"/>
      <line x1="2" x2="22" y1="12" y2="12"/>
      <line x1="7" x2="7" y1="19" y2="21"/>
      <line x1="17" x2="17" y1="19" y2="21"/>
    </svg>
  ),
  Expand: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/>
      <polyline points="9 21 3 21 3 15"/>
      <line x1="21" x2="14" y1="3" y2="10"/>
      <line x1="3" x2="10" y1="21" y2="14"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  ),
  Filter: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  Loader: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
};

const formatPrice = (price: number) => {
  if (!Number.isFinite(price) || price <= 0) return 'Not listed';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
};

const sourceColors: Record<string, { bg: string; text: string; border: string }> = {
  utahrealestate: { bg: 'bg-blue-500/20 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  zillow: { bg: 'bg-sky-500/20 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/30' },
  realtor: { bg: 'bg-red-500/20 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  redfin: { bg: 'bg-orange-500/20 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30' },
  sample_data: { bg: 'bg-emerald-500/20 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  public_records: { bg: 'bg-purple-500/20 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  internal: { bg: 'bg-indigo-500/20 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  unknown: { bg: 'bg-gray-500/20 dark:bg-gray-500/20', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-500/30' },
};

const sourceNames: Record<string, string> = {
  utahrealestate: 'Utah MLS',
  zillow: 'Zillow',
  realtor: 'Realtor',
  redfin: 'Redfin',
  sample_data: 'Sample',
  public_records: 'Public',
  internal: 'Your Listing',
  unknown: 'Other',
};

// Build ListingQuery from PropertyResult for portal links
function buildQueryFromResult(property: PropertyResult): ListingQuery {
  return {
    mlsNumber: property.mlsId,
    addressLine: property.address.street,
    city: property.address.city,
    state: property.address.state,
    zip: property.address.zip,
  };
}

// Build ListingQuery from raw search input
function buildQueryFromInput(query: string, filters: SearchFilters): ListingQuery {
  const parsed = parseQuery(query);
  return {
    mlsNumber: parsed.type === 'mls' ? parsed.value : undefined,
    addressLine: parsed.type === 'address' ? parsed.value : undefined,
    city: filters.city || (parsed.type === 'city' ? parsed.value : undefined),
    state: 'UT',
    zip: filters.zipCode || (parsed.type === 'zip' ? parsed.value : undefined),
  };
}

// Portal Links Component
function PortalLinks({ query, compact = false }: { query: ListingQuery; compact?: boolean }) {
  const links = getAllPortalLinks(query);
  const mapLink = buildGoogleMapsLink(query);
  const assessorLink = buildAssessorLink(query);
  
  if (links.length === 0 && !mapLink) return null;
  
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {links.slice(0, 3).map(({ portal, url }) => (
          <a
            key={portal.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all hover:scale-105 ${portal.bgColor} ${portal.color} ${portal.borderColor}`}
            title={`Open on ${portal.name}`}
          >
            <span>{portal.icon}</span>
            <span>{portal.shortName}</span>
          </a>
        ))}
        {mapLink && (
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all hover:scale-105 bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30"
            title="View on Google Maps"
          >
            📍 Map
          </a>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        🌐 Search on portals
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map(({ portal, url }) => (
          <a
            key={portal.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-105 hover:shadow-md ${portal.bgColor} ${portal.color} ${portal.borderColor}`}
          >
            <span className="text-sm">{portal.icon}</span>
            <span>{portal.name}</span>
            <Icons.ExternalLink />
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {mapLink && (
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-105 bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30"
          >
            📍 Google Maps
            <Icons.ExternalLink />
          </a>
        )}
        {assessorLink && (
          <a
            href={assessorLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-105 bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30"
          >
            📋 County Records
            <Icons.ExternalLink />
          </a>
        )}
      </div>
    </div>
  );
}

// Helper to detect MLS number patterns
const isMlsNumber = (text: string): boolean => {
  const cleaned = text.replace(/[^0-9]/g, '');
  return /^\d{6,10}$/.test(cleaned);
};

// Helper to detect address patterns
const isAddressPattern = (text: string): boolean => {
  return /^\d+\s+\w/.test(text.trim());
};

// Parse search query to extract structured data
const parseQuery = (text: string): { type: 'mls' | 'address' | 'city' | 'zip' | 'general'; value: string } => {
  const trimmed = text.trim();
  
  // Check for MLS# prefix or pure number
  if (/^mls[#:\s]*\d+/i.test(trimmed) || isMlsNumber(trimmed)) {
    const mlsNum = trimmed.replace(/[^0-9]/g, '');
    return { type: 'mls', value: mlsNum };
  }
  
  // Check for zip code (5 digits)
  if (/^\d{5}$/.test(trimmed)) {
    return { type: 'zip', value: trimmed };
  }
  
  // Check for address pattern
  if (isAddressPattern(trimmed)) {
    return { type: 'address', value: trimmed };
  }
  
  // Check if it's a known Utah city (using comprehensive list)
  if (ALL_UTAH_CITIES.some(city => trimmed.toLowerCase().includes(city.toLowerCase()))) {
    return { type: 'city', value: trimmed };
  }
  
  return { type: 'general', value: trimmed };
};

export default function PropertySearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sources: ['utahrealestate', 'zillow'],
  });
  const [results, setResults] = useState<PropertyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [queryType, setQueryType] = useState<string | null>(null);
  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const [showIntelPanel, setShowIntelPanel] = useState(false);

  // Check for URL search params on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || params.get('query') || params.get('mls');
    if (q && !initialSearchDone) {
      setQuery(q);
      setInitialSearchDone(true);
    }
  }, [initialSearchDone]);

  // Auto-search when query is set from URL params
  const handleSearchRef = React.useRef<(() => Promise<void>) | null>(null);
  
  React.useEffect(() => {
    if (query && initialSearchDone && handleSearchRef.current && !searched) {
      handleSearchRef.current();
    }
  }, [query, initialSearchDone, searched]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !filters.city && !filters.zipCode) {
      setError('Please enter a search query, city, or zip code');
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(false);
    setSearched(true);

    // Parse the query to determine type
    const parsed = parseQuery(query);
    setQueryType(parsed.type);

    try {
      const rawToken = localStorage.getItem('utahcontracts_token');
      if (!rawToken || rawToken === 'null' || rawToken === 'undefined') {
        setAuthError(true);
        setError('Please log in to search properties');
        return;
      }

      // Build optimized search payload based on query type
      let searchPayload: Record<string, any> = { ...filters };
      
      switch (parsed.type) {
        case 'mls':
          searchPayload.query = parsed.value;
          searchPayload.mlsNumber = parsed.value;
          break;
        case 'zip':
          searchPayload.zipCode = parsed.value;
          break;
        case 'city':
          searchPayload.city = parsed.value.replace(/,?\s*(ut|utah)$/i, '').trim();
          searchPayload.state = 'UT';
          break;
        case 'address':
          searchPayload.address = parsed.value;
          searchPayload.query = parsed.value;
          break;
        default:
          searchPayload.query = query.trim();
      }

      const res = await api.post('/search/properties', searchPayload);
      setResults(res.data?.results || []);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverError = err?.response?.data?.error;
      if (status === 401) {
        setAuthError(true);
        setError('Your session has expired. Please sign in again.');
        return;
      }
      setError(serverError || err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, filters]);

  // Assign handleSearch to ref for auto-search from URL params
  handleSearchRef.current = handleSearch;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({ sources: ['utahrealestate', 'zillow'] });
  };

  const currentSearchQuery = buildQueryFromInput(query, filters);
  const hasSearchInput = query.trim() || filters.city || filters.zipCode;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[28px] border border-indigo-200/50 dark:border-white/10 bg-gradient-to-br from-white via-slate-50/90 to-indigo-50/50 dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-cyan-500/10" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 text-white">
              <Icons.Home />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent">
                Property Search
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Search properties across your AgentEase data and jump directly to MLS and major portals
              </p>
            </div>
          </div>
        
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // Show hint for what type of search
                  const parsed = parseQuery(e.target.value);
                  setQueryType(parsed.type !== 'general' ? parsed.type : null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search by MLS#, address, city, or zip code..."
              className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3.5 pl-12 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-sm"
            />
            {queryType && query.trim() && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  queryType === 'mls' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                  queryType === 'address' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' :
                  queryType === 'zip' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                  queryType === 'city' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                  'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300'
                }`}>
                  {queryType === 'mls' ? 'MLS#' : 
                   queryType === 'address' ? 'Address' :
                   queryType === 'zip' ? 'ZIP' :
                   queryType === 'city' ? 'City' : ''}
                </span>
              </div>
            )}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.Search />
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3.5 rounded-xl border transition-all flex items-center justify-center gap-2 font-medium ${
              showFilters
                ? 'bg-blue-50 dark:bg-purple-500/20 border-blue-200 dark:border-purple-500/30 text-blue-700 dark:text-purple-300'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10'
            }`}
          >
            <Icons.Filter />
            <span className="hidden sm:inline">Filters</span>
          </button>
          
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3.5 bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 rounded-xl text-white font-semibold hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            {loading ? <Icons.Loader /> : <Icons.Search />}
            Search
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-5 pt-5 border-t border-slate-200/60 dark:border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">City</label>
                <input
                  type="text"
                  value={filters.city || ''}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
                  placeholder="Salt Lake City"
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Zip Code</label>
                <input
                  type="text"
                  value={filters.zipCode || ''}
                  onChange={(e) => setFilters({ ...filters, zipCode: e.target.value || undefined })}
                  placeholder="84101"
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Min Price</label>
                <input
                  type="number"
                  value={filters.minPrice || ''}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="200000"
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Max Price</label>
                <input
                  type="number"
                  value={filters.maxPrice || ''}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="500000"
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Min Beds</label>
                <select
                  value={filters.minBeds || ''}
                  onChange={(e) => setFilters({ ...filters, minBeds: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}+</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1.5">Min Baths</label>
                <select
                  value={filters.minBaths || ''}
                  onChange={(e) => setFilters({ ...filters, minBaths: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Any</option>
                  {[1, 1.5, 2, 2.5, 3, 4].map(n => (
                    <option key={n} value={n}>{n}+</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-1"
              >
                <Icons.X />
                Clear Filters
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Property Intelligence Panel Toggle */}
      {hasSearchInput && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowIntelPanel(!showIntelPanel)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              showIntelPanel
                ? 'bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10'
            }`}
          >
            <span>🔍</span>
            {showIntelPanel ? 'Hide Property Intelligence' : 'Show Property Intelligence'}
          </button>
          {!showIntelPanel && (
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              Get neighborhood data, maps, and public records
            </p>
          )}
        </div>
      )}

      {hasSearchInput && !showIntelPanel && (
        <div className="rounded-[24px] border border-indigo-200/40 dark:border-white/10 bg-gradient-to-br from-white via-indigo-50/70 to-white dark:from-[#050b1a]/70 dark:via-[#081329]/50 dark:to-[#03070f]/70 backdrop-blur-xl p-5 shadow-[0_14px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_60px_rgba(2,6,23,0.6)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-500">Market intel playbooks</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">Turn this search into a client-ready plan</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Run instant intel, draft a CMA, or prep a listing strategy.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowIntelPanel(true)}
                className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
              >
                Open intelligence
              </button>
              <button
                onClick={() => navigate('/reporting')}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                CMA snapshot
              </button>
              <button
                onClick={() => navigate('/listings')}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
              >
                Create listing plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Intelligence Panel */}
      {showIntelPanel && hasSearchInput && (
        <PropertyIntelPanel 
          query={currentSearchQuery} 
          expanded={showIntelPanel}
          onClose={() => setShowIntelPanel(false)}
        />
      )}

      {/* Quick Portal Search - Before searching, let users jump to portals */}
      {!searched && hasSearchInput && !showIntelPanel && (
        <div className="rounded-[24px] border border-slate-200/60 dark:border-white/10 bg-gradient-to-br from-white via-slate-50/80 to-white dark:from-[#030b1a]/50 dark:via-[#041128]/40 dark:to-[#010712]/50 backdrop-blur-xl p-6 shadow-[0_14px_36px_rgba(15,23,42,0.10)] dark:shadow-[0_15px_50px_rgba(2,6,23,0.45)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✨</span>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Quick search on portals</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Jump directly to search this on external sites:
          </p>
          <PortalLinks query={currentSearchQuery} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={`rounded-[20px] border ${authError ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'} p-5`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 ${authError ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'} flex-shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className={`${authError ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'} font-semibold`}>
                {authError ? 'Session Expired' : 'Search Notice'}
              </p>
              <p className={`${authError ? 'text-red-700 dark:text-red-300/80' : 'text-amber-700 dark:text-amber-300/80'} text-sm mt-1`}>{error}</p>
              {authError && (
                <button
                  onClick={() => {
                    localStorage.removeItem('utahcontracts_token');
                    window.location.href = '/login';
                  }}
                  className="mt-3 px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Log Out & Sign In Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="rounded-[28px] border border-slate-200/60 dark:border-white/10 bg-gradient-to-br from-white via-slate-50/90 to-white dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
          <div className="px-6 py-5 border-b border-slate-200/60 dark:border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {loading ? 'Searching...' : `${results.length} Properties Found`}
              </h3>
              {results.length > 0 && results[0]?.source === 'sample_data' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Showing sample listings for demo
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Icons.Loader />
                <span className="ml-3 text-slate-500 dark:text-gray-400">Searching multiple sources...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="py-16">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 mb-4 text-slate-400">
                    <Icons.Search />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No properties found</h4>
                  <p className="text-slate-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                    We couldn't find any matching properties in your AgentEase data. Try adjusting your search criteria or search directly on the portals below.
                  </p>
                </div>
                
                {/* Empty State - Portal Links */}
                <div className="max-w-xl mx-auto bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300">
                    <span>🌐</span>
                    <span className="font-semibold">Try searching on these portals</span>
                  </div>
                  <PortalLinks query={currentSearchQuery} />
                </div>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {results.map((property, index) => {
                  const propertyQuery = buildQueryFromResult(property);
                  const sourceStyle = sourceColors[property.source] || sourceColors.unknown;
                  
                  return (
                    <div
                      key={`${property.source}-${property.mlsId || property.zpid || index}`}
                      className="group rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden hover:border-blue-300 dark:hover:border-purple-500/30 transition-all hover:shadow-lg dark:hover:shadow-purple-500/10 hover:-translate-y-0.5"
                    >
                      {/* Property Image */}
                      <div className="aspect-[16/10] bg-slate-100 dark:bg-gray-800 relative overflow-hidden">
                        {property.photos[0] ? (
                          <img
                            src={property.photos[0]}
                            alt={property.address.street}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-gray-600">
                            <Icons.Home />
                          </div>
                        )}
                        
                        {/* Source Badge */}
                        <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm ${sourceStyle.bg} ${sourceStyle.text} ${sourceStyle.border}`}>
                          {sourceNames[property.source]}
                        </span>
                        
                        {/* Price */}
                        <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-lg">
                          <span className="text-slate-900 dark:text-white font-bold">{formatPrice(property.price)}</span>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="p-4">
                        <h4 className="text-slate-900 dark:text-white font-semibold truncate">{property.address.street}</h4>
                        <p className="text-slate-500 dark:text-gray-400 text-sm flex items-center gap-1 mt-1">
                          <Icons.MapPin />
                          {property.address.city}, {property.address.state} {property.address.zip}
                        </p>

                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-600 dark:text-gray-300">
                          {property.beds && (
                            <span className="flex items-center gap-1">
                              <Icons.Bed /> {property.beds} bd
                            </span>
                          )}
                          {property.baths && (
                            <span className="flex items-center gap-1">
                              <Icons.Bath /> {property.baths} ba
                            </span>
                          )}
                          {property.sqft && (
                            <span className="flex items-center gap-1">
                              <Icons.Expand /> {property.sqft.toLocaleString()} sqft
                            </span>
                          )}
                        </div>

                        {property.mlsId && (
                          <p className="text-xs text-slate-400 dark:text-gray-500 mt-2 font-medium">MLS# {property.mlsId}</p>
                        )}

                        {/* Portal Deep Links */}
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                          <PortalLinks query={propertyQuery} compact />
                        </div>

                        {/* Internal Actions */}
                        {property.internalId && (
                          <button
                            onClick={() => navigate(`/listings?id=${property.internalId}`)}
                            className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-white transition-colors"
                          >
                            View in AgentEase
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
