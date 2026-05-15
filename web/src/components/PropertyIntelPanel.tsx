/**
 * Property Intelligence Panel
 * 
 * Displays enriched property data from PUBLIC sources only.
 * No scraping - uses official APIs and public records.
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, ClipboardList, Globe2, GraduationCap, Home as HomeIcon, Info, KeyRound, Landmark, Link2, Mountain, ScrollText, Search, TrendingUp } from 'lucide-react';
import {
  PropertyIntelResult,
  getPropertyIntel,
  getCountyAssessorInfo,
  buildEmbedMapUrl,
  buildStaticMapUrl,
  formatAddress,
  fetchCensusData,
  CensusData,
} from '../lib/propertyIntel';
import { getAllPortalLinks, ListingQuery, PORTALS } from '../lib/listingLinks';

interface PropertyIntelPanelProps {
  query: ListingQuery;
  expanded?: boolean;
  onClose?: () => void;
}

// Icons
const Icons = {
  Map: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" x2="9" y1="3" y2="18"/>
      <line x1="15" x2="15" y1="6" y2="21"/>
    </svg>
  ),
  Building: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01"/>
      <path d="M16 6h.01"/>
      <path d="M12 6h.01"/>
      <path d="M12 10h.01"/>
      <path d="M12 14h.01"/>
      <path d="M16 10h.01"/>
      <path d="M16 14h.01"/>
      <path d="M8 10h.01"/>
      <path d="M8 14h.01"/>
    </svg>
  ),
  Users: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  DollarSign: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  FileText: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  ),
  Globe: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" x2="22" y1="12" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  StreetView: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3"/>
      <path d="M12 8v8"/>
      <path d="M8 21l4-4 4 4"/>
      <path d="M8 17l4 4"/>
      <path d="M16 17l-4 4"/>
    </svg>
  ),
  Loader: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  Home: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Walking: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/>
      <path d="m9 20 3-6 3 6"/>
      <path d="M6 15l3-3"/>
      <path d="m18 15-3-3"/>
      <path d="M12 11v3"/>
    </svg>
  ),
};

// Format currency
const formatCurrency = (value?: number) => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

// Format number
const formatNumber = (value?: number) => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
};

const buildGoogleSearchUrl = (text: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(text)}`;

const buildGoogleMapsSearchUrl = (text: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;

const formatLocationLabel = (query: ListingQuery) => {
  if (query.zip) return `ZIP ${query.zip}`;
  if (query.city && query.state) return `${query.city}, ${query.state}`;
  return 'local area';
};

export default function PropertyIntelPanel({ query, expanded = true, onClose }: PropertyIntelPanelProps) {
  const [intel, setIntel] = useState<PropertyIntelResult | null>(null);
  const [census, setCensus] = useState<CensusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'portals' | 'records'>('overview');

  const fullAddress = formatAddress({
    address: query.addressLine || '',
    city: query.city,
    state: query.state,
    zip: query.zip,
  });

  const getPortalIcon = (portalId: string) => {
    switch (portalId) {
      case 'utahrealestate':
        return Mountain;
      case 'zillow':
      case 'realtor':
        return HomeIcon;
      case 'redfin':
        return KeyRound;
      default:
        return Globe2;
    }
  };

  useEffect(() => {
    const loadIntel = async () => {
      setLoading(true);
      
      try {
        const result = await getPropertyIntel({
          address: query.addressLine || '',
          city: query.city,
          state: query.state,
          zip: query.zip,
        });
        setIntel(result);
        
        // Try to load census data if we have a ZIP
        if (query.zip) {
          const censusData = await fetchCensusData(query.zip);
          setCensus(censusData);
        }
      } catch (err) {
        console.error('Error loading property intel:', err);
      } finally {
        setLoading(false);
      }
    };

    if (query.addressLine || query.city || query.zip) {
      loadIntel();
    }
  }, [query]);

  // Get assessor info
  const assessor = getCountyAssessorInfo(query.city);
  
  // Get portal links
  const portalLinks = getAllPortalLinks(query);
  const locationLabel = formatLocationLabel(query);
  const mapAddress = fullAddress || [query.city, query.state, query.zip].filter(Boolean).join(', ');
  const neighborhoodLinks = [
    query.city || query.zip ? {
      label: 'Schools',
      href: buildGoogleSearchUrl(`${query.city || query.zip} Utah school boundaries ratings`),
      detail: 'Districts and nearby schools',
    } : null,
    mapAddress ? {
      label: 'Amenities',
      href: buildGoogleMapsSearchUrl(`${mapAddress} restaurants parks grocery`),
      detail: 'Nearby services and parks',
    } : null,
    mapAddress ? {
      label: 'Commute',
      href: buildGoogleMapsSearchUrl(mapAddress),
      detail: 'Open area map',
    } : null,
    query.city || query.zip ? {
      label: 'Market context',
      href: buildGoogleSearchUrl(`${query.city || query.zip} Utah real estate market trends`),
      detail: 'Public market research',
    } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; detail: string }>;

  if (!expanded) return null;

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-gradient-to-br from-white via-[#fffaf0] to-slate-50 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-[#f2d894]/15 dark:from-[#101827]/90 dark:via-[#0b1220]/90 dark:to-[#07090d]/95 dark:shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
      {/* Header */}
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-[#d6b56d]/10 via-white/60 to-slate-50 px-6 py-4 dark:border-[#f2d894]/10 dark:from-[#d6b56d]/10 dark:via-white/[0.03] dark:to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-[#f2d894] to-[#9f7933] p-2 text-[#171106] shadow-lg shadow-[#d6b56d]/20">
              <Icons.Building />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Property Intelligence</h3>
              <p className="max-w-[300px] truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                {fullAddress || 'Enter an address to see details'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <Icons.X />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['overview', 'portals', 'records'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0]'
                  : 'text-slate-600 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-white/5'
              }`}
            >
              {tab === 'overview' && <><BarChart3 className="mr-1.5 inline h-4 w-4" /> Overview</>}
              {tab === 'portals' && <><Link2 className="mr-1.5 inline h-4 w-4" /> Portals</>}
              {tab === 'records' && <><ClipboardList className="mr-1.5 inline h-4 w-4" /> Records</>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <Icons.Loader />
            <span className="ml-3">Loading property intelligence...</span>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Map Section */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Map Preview */}
                  <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-slate-100 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.55)] dark:border-[#f2d894]/15 dark:bg-white/5">
                    {mapAddress ? (
                      <div className="relative h-[220px]">
                        <iframe
                          title="Property location map"
                          src={buildEmbedMapUrl(mapAddress)}
                          className="h-full w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
                          <a
                            href={buildGoogleMapsSearchUrl(mapAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-lg transition-transform hover:scale-[1.02] dark:bg-black/75 dark:text-white"
                          >
                            <Icons.Map />
                            Open Map
                          </a>
                          <a
                            href={buildGoogleSearchUrl(`${mapAddress} property photos street view`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-lg transition-transform hover:scale-[1.02] dark:bg-black/75 dark:text-white"
                          >
                            <Icons.StreetView />
                            Street Check
                          </a>
                        </div>
                      </div>
                    ) : intel?.geocoded ? (
                      <div className="relative">
                        <img
                          src={buildStaticMapUrl(intel.geocoded.lat, intel.geocoded.lng, 16, '400x250')}
                          alt="Property location"
                          className="w-full h-[200px] object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                          <a
                            href={intel.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/95 dark:bg-black/70 text-slate-700 dark:text-white shadow-lg hover:scale-105 transition-transform"
                          >
                            <Icons.Map />
                            Google Maps
                          </a>
                          <a
                            href={intel.streetViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/95 dark:bg-black/70 text-slate-700 dark:text-white shadow-lg hover:scale-105 transition-transform"
                          >
                            <Icons.StreetView />
                            Street View
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-[220px] items-center justify-center text-slate-500 dark:text-slate-400">
                        <div className="text-center">
                          <Icons.Map />
                          <p className="mt-2 text-sm font-medium">Import a property to build map links.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <Icons.Users />
                      Neighborhood Snapshot
                      <span className="text-xs font-medium text-slate-400">({locationLabel})</span>
                    </h4>
                    
                    {census ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Population</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(census.population)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Median Income</p>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(census.medianIncome)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Median Home Value</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(census.medianHomeValue)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Median Rent</p>
                          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatCurrency(census.medianRent)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {neighborhoodLinks.map((link) => (
                          <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-3 text-left shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)] transition hover:border-[#d6b56d]/70 hover:bg-[#fff8e8] dark:border-[#f2d894]/15 dark:bg-white/5 dark:hover:bg-[#d6b56d]/10"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-slate-900 dark:text-white">{link.label}</span>
                              <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{link.detail}</span>
                            </span>
                            <Icons.ExternalLink />
                          </a>
                        ))}
                        {neighborhoodLinks.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            Add a city, ZIP, or address to build neighborhood links.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* County Info */}
                {assessor && (
                  <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.50)] dark:border-[#f2d894]/15 dark:bg-white/5">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <Icons.FileText />
                      {assessor.county} Records
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={assessor.assessorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                      >
                        Assessor's Office
                        <Icons.ExternalLink />
                      </a>
                      {assessor.parcelSearchUrl && (
                        <a
                          href={assessor.parcelSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d6b56d]/40 bg-[#fff5d6] px-3 py-2 text-sm font-bold text-[#6f4d12] transition-colors hover:bg-[#f8e7b8] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0] dark:hover:bg-[#d6b56d]/25"
                        >
                          Parcel Search
                          <Icons.ExternalLink />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Portals Tab */}
            {activeTab === 'portals' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Search this property on major real estate portals:
                </p>
                
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PORTALS.map((portal) => {
                    const link = portal.buildLink(query);
                    if (!link) return null;
                    const PortalIcon = getPortalIcon(portal.id);
                    
                    return (
                      <a
                        key={portal.id}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-lg ${portal.bgColor} ${portal.borderColor}`}
                      >
                        <PortalIcon className={`h-5 w-5 ${portal.color}`} />
                        <div className="flex-1">
                          <p className={`font-semibold ${portal.color}`}>{portal.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Search listings</p>
                        </div>
                        <Icons.ExternalLink />
                      </a>
                    );
                  })}
                </div>

                {/* Google Search */}
                <div className="pt-4 border-t border-slate-200/60 dark:border-white/10">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Additional Resources</h4>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(fullAddress + ' property')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-colors"
                    >
                      <Search className="h-4 w-4" /> Google Property Search
                    </a>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(fullAddress + ' sold price history')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-colors"
                    >
                      <TrendingUp className="h-4 w-4" /> Price History Search
                    </a>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(query.city + ' UT schools ratings')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-colors"
                    >
                      <GraduationCap className="h-4 w-4" /> School Ratings
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Records Tab */}
            {activeTab === 'records' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Access public property records and official documents:
                </p>

                {assessor ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <a
                      href={assessor.assessorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/30 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        <Icons.Building />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{assessor.county} Assessor</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Property values, tax info</p>
                      </div>
                      <Icons.ExternalLink />
                    </a>

                    {assessor.parcelSearchUrl && (
                      <a
                        href={assessor.parcelSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                          <Icons.Map />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">Parcel Search</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lot info, boundaries</p>
                        </div>
                        <Icons.ExternalLink />
                      </a>
                    )}

                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(fullAddress + ' county recorder')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Icons.FileText />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">Recorder's Office</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Deeds, liens, mortgages</p>
                      </div>
                      <Icons.ExternalLink />
                    </a>

                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(query.city + ' UT building permits')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-500/30 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <Icons.Home />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">Building Permits</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Renovation history</p>
                      </div>
                      <Icons.ExternalLink />
                    </a>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Enter a Utah city to see county-specific record links.
                    </p>
                  </div>
                )}

                {/* Utah State Resources */}
                <div className="pt-4 border-t border-slate-200/60 dark:border-white/10">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Utah State Resources</h4>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://secure.utah.gov/bes/index.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-colors"
                    >
                      <Landmark className="h-4 w-4" /> UT Business Search
                    </a>
                    <a
                      href="https://le.utah.gov/asp/bylaws/hblookup.asp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-colors"
                    >
                      <ScrollText className="h-4 w-4" /> HOA Lookup
                    </a>
                    <a
                      href="https://dopl.utah.gov/verify/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-colors"
                    >
                      <KeyRound className="h-4 w-4" /> License Verification
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200/60 bg-slate-50/50 px-6 py-3 dark:border-white/5 dark:bg-white/5">
        <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          Built from public records, official resources, portal links, and configured APIs.
        </p>
      </div>
    </div>
  );
}
