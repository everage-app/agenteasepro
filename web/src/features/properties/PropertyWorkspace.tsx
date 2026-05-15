import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileSignature,
  FileText,
  Home,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Megaphone,
  Ruler,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';
import PropertyIntelPanel from '../../components/PropertyIntelPanel';
import {
  ListingQuery,
  buildAssessorLink,
  buildGoogleMapsLink,
  getAllPortalLinks,
} from '../../lib/listingLinks';
import { cn } from '../../lib/utils';

type SearchKind = 'mls' | 'address' | 'city' | 'zip' | 'url' | 'general';

interface PropertyResult {
  source: string;
  mlsId?: string;
  zpid?: string;
  propertyId?: string;
  taxId?: string;
  internalId?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    fullAddress: string;
    latitude?: number;
    longitude?: number;
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
  url: string;
  fetchedAt: string | Date;
  listingAgent?: {
    name?: string;
    phone?: string;
    brokerage?: string;
  };
}

interface MlsListingRecord {
  id: string;
  mlsNumber: string;
  headline: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: string | number | null;
  beds: number | null;
  baths: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  description: string | null;
  photos: string[] | null;
  raw: Record<string, unknown> | null;
  sourceUrl: string | null;
  lastFetchedAt: string;
}

interface WorkspaceDraft {
  source: string;
  mlsId: string;
  taxId: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  lotSize: string;
  yearBuilt: string;
  headline: string;
  description: string;
  photoUrl: string;
  sourceUrl: string;
  fetchedAt?: string;
}

const sourceLabels: Record<string, string> = {
  utahrealestate: 'Utah MLS',
  internal: 'AgentEase',
  rentcast: 'Rentcast',
  zillow: 'Zillow',
  realtor: 'Realtor',
  redfin: 'Redfin',
  public_records: 'Public records',
  sample_data: 'Demo data',
  manual: 'Manual',
  unknown: 'Other',
};

const sourceStyles: Record<string, string> = {
  utahrealestate: 'border-[#d6b56d]/60 bg-[#fff5d6] text-[#6f4d12] dark:border-[#f2d894]/35 dark:bg-[#d6b56d]/20 dark:text-[#f7e7b0]',
  internal: 'border-emerald-400/50 bg-emerald-50 text-emerald-800 dark:border-emerald-300/35 dark:bg-emerald-500/15 dark:text-emerald-100',
  rentcast: 'border-cyan-400/50 bg-cyan-50 text-cyan-800 dark:border-cyan-300/35 dark:bg-cyan-500/15 dark:text-cyan-100',
  zillow: 'border-sky-400/50 bg-sky-50 text-sky-800 dark:border-sky-300/35 dark:bg-sky-500/15 dark:text-sky-100',
  realtor: 'border-rose-400/50 bg-rose-50 text-rose-800 dark:border-rose-300/35 dark:bg-rose-500/15 dark:text-rose-100',
  redfin: 'border-orange-400/50 bg-orange-50 text-orange-800 dark:border-orange-300/35 dark:bg-orange-500/15 dark:text-orange-100',
  public_records: 'border-violet-400/50 bg-violet-50 text-violet-800 dark:border-violet-300/35 dark:bg-violet-500/15 dark:text-violet-100',
  sample_data: 'border-amber-400/50 bg-amber-50 text-amber-800 dark:border-amber-300/35 dark:bg-amber-500/15 dark:text-amber-100',
  manual: 'border-slate-300 bg-white text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-slate-100',
  unknown: 'border-slate-300 bg-white text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-slate-100',
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function parseSearchText(value: string): { kind: SearchKind; value: string; display: string } {
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'general', value: '', display: '' };

  try {
    const url = new URL(trimmed);
    const mlsMatch = url.pathname.match(/\/(\d{6,10})(?:\/)?$/) || trimmed.match(/(?:mls[#/:\s-]*)(\d{6,10})/i);
    if (mlsMatch?.[1]) {
      return { kind: 'mls', value: mlsMatch[1], display: `MLS #${mlsMatch[1]}` };
    }

    const pathText = decodeURIComponent(url.pathname)
      .replace(/[_-]+/g, ' ')
      .replace(/\b(homedetails|realestateandhomes detail|homes|property|rb|zpid)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { kind: 'url', value: pathText || trimmed, display: url.hostname.replace(/^www\./, '') };
  } catch {
    // Not a URL.
  }

  const normalizedMls = trimmed.replace(/[^0-9]/g, '');
  if (/^mls[#:\s]*\d+/i.test(trimmed) || /^\d{6,10}$/.test(normalizedMls)) {
    return { kind: 'mls', value: normalizedMls, display: `MLS #${normalizedMls}` };
  }

  if (/^\d{5}$/.test(trimmed)) {
    return { kind: 'zip', value: trimmed, display: `ZIP ${trimmed}` };
  }

  if (/^\d+\s+\S+/.test(trimmed)) {
    return { kind: 'address', value: trimmed, display: 'Address' };
  }

  if (/^[a-z .'-]+,?\s*(ut|utah)?$/i.test(trimmed)) {
    return { kind: 'city', value: trimmed.replace(/,?\s*(ut|utah)$/i, '').trim(), display: 'City' };
  }

  return { kind: 'general', value: trimmed, display: 'Search' };
}

function formatPrice(price?: number | string) {
  const parsed = typeof price === 'string' ? parseNumber(price) : price;
  if (!parsed || !Number.isFinite(parsed) || parsed <= 0) return 'Not listed';
  return currency.format(parsed);
}

function formatShortNumber(value?: number | string | null) {
  const parsed = parseNumber(value);
  if (!parsed || !Number.isFinite(parsed) || parsed <= 0) return '';
  return parsed.toLocaleString();
}

function formatMetric(value: unknown, suffix: string) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = typeof value === 'number' ? value : parseNumber(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return `${Number.isInteger(parsed) ? parsed.toLocaleString() : parsed.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suffix}`;
}

function formatBeds(value: unknown) {
  const parsed = typeof value === 'number' ? value : parseNumber(String(value || ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return `${Number.isInteger(parsed) ? parsed : `${Math.floor(parsed)}+`} bd`;
}

function formatBaths(value: unknown) {
  const parsed = typeof value === 'number' ? value : parseNumber(String(value || ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return `${Number.isInteger(parsed) ? parsed : parsed.toLocaleString(undefined, { maximumFractionDigits: 1 })} ba`;
}

function parseNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function mlsRecordToResult(record: MlsListingRecord): PropertyResult {
  const photos = Array.isArray(record.photos) ? record.photos.filter(Boolean) : [];
  const taxId = typeof record.raw?.taxId === 'string' ? record.raw.taxId : undefined;
  const fullAddress = [record.addressLine1, record.city, record.state || 'UT', record.zip]
    .filter(Boolean)
    .join(', ');

  return {
    source: 'utahrealestate',
    mlsId: record.mlsNumber,
    taxId,
    address: {
      street: record.addressLine1 || '',
      city: record.city || '',
      state: record.state || 'UT',
      zip: record.zip || '',
      fullAddress,
    },
    price: parseNumber(record.price),
    beds: record.beds || undefined,
    baths: record.baths || undefined,
    sqft: record.squareFeet || undefined,
    lotSize: record.lotSize || undefined,
    yearBuilt: record.yearBuilt || undefined,
    description: record.description || record.headline || undefined,
    photos,
    url: record.sourceUrl || `https://www.utahrealestate.com/${record.mlsNumber}`,
    fetchedAt: record.lastFetchedAt,
  };
}

function draftFromResult(result: PropertyResult): WorkspaceDraft {
  const street = result.address?.street || result.address?.fullAddress || '';
  const headline = street || result.mlsId ? `${street || 'Property'}${result.mlsId ? ` | MLS #${result.mlsId}` : ''}` : 'Imported property';
  const fetchedAt = result.fetchedAt ? new Date(result.fetchedAt).toISOString() : undefined;

  return {
    source: result.source || 'unknown',
    mlsId: result.mlsId || '',
    taxId: result.taxId || '',
    street,
    city: result.address?.city || '',
    state: result.address?.state || 'UT',
    zip: result.address?.zip || '',
    price: result.price ? String(Math.round(result.price)) : '',
    beds: result.beds ? String(result.beds) : '',
    baths: result.baths ? String(result.baths) : '',
    sqft: result.sqft ? String(result.sqft) : '',
    lotSize: result.lotSize ? String(result.lotSize) : '',
    yearBuilt: result.yearBuilt ? String(result.yearBuilt) : '',
    headline,
    description: result.description || '',
    photoUrl: result.photos?.[0] || '',
    sourceUrl: result.url || '',
    fetchedAt,
  };
}

function manualDraftFromQuery(query: string, kind: SearchKind): WorkspaceDraft {
  return {
    source: 'manual',
    mlsId: kind === 'mls' ? query.replace(/[^0-9]/g, '') : '',
    taxId: '',
    street: kind === 'address' ? query : '',
    city: kind === 'city' ? query : '',
    state: 'UT',
    zip: kind === 'zip' ? query : '',
    price: '',
    beds: '',
    baths: '',
    sqft: '',
    lotSize: '',
    yearBuilt: '',
    headline: kind === 'address' ? query : '',
    description: '',
    photoUrl: '',
    sourceUrl: '',
  };
}

function dedupeResults(results: PropertyResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = [result.source, result.mlsId, result.zpid, result.propertyId, result.address?.fullAddress]
      .filter(Boolean)
      .join('|')
      .toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSearchPayload(kind: SearchKind, value: string) {
  if (kind === 'mls') return { query: value, mlsNumber: value, limit: 12 };
  if (kind === 'zip') return { zipCode: value, limit: 12 };
  if (kind === 'city') return { city: value, state: 'UT', limit: 12 };
  if (kind === 'address') return { address: value, query: value, limit: 12 };
  return { query: value, limit: 12 };
}

function queryFromDraft(draft: WorkspaceDraft | null): ListingQuery {
  if (!draft) return {};
  return {
    mlsNumber: draft.mlsId || undefined,
    addressLine: draft.street || undefined,
    city: draft.city || undefined,
    state: draft.state || 'UT',
    zip: draft.zip || undefined,
  };
}

function evaluateDraft(draft: WorkspaceDraft | null) {
  if (!draft) {
    return { score: 0, label: 'No property', tone: 'muted' as const, missing: ['Import a property'] };
  }

  const missing: string[] = [];
  const fields: Array<[keyof WorkspaceDraft, string, number]> = [
    ['street', 'street', 18],
    ['city', 'city', 12],
    ['zip', 'ZIP', 10],
    ['price', 'price', 12],
    ['beds', 'beds', 6],
    ['baths', 'baths', 6],
    ['sqft', 'square feet', 6],
    ['mlsId', 'MLS number', 10],
    ['taxId', 'parcel/tax ID', 8],
    ['photoUrl', 'photo', 6],
    ['description', 'remarks', 6],
  ];

  let score = draft.source === 'utahrealestate' ? 18 : draft.source === 'internal' ? 16 : draft.source === 'manual' ? 4 : 10;
  for (const [key, label, weight] of fields) {
    if (String(draft[key] || '').trim()) score += weight;
    else missing.push(label);
  }

  score = Math.min(score, 100);
  if (draft.source === 'sample_data') return { score: Math.min(score, 45), label: 'Demo only', tone: 'warning' as const, missing };
  if (score >= 86) return { score, label: 'Ready', tone: 'strong' as const, missing };
  if (score >= 66) return { score, label: 'Strong', tone: 'good' as const, missing };
  if (score >= 40) return { score, label: 'Needs review', tone: 'warning' as const, missing };
  return { score, label: 'Manual review', tone: 'danger' as const, missing };
}

function fullAddress(draft: WorkspaceDraft | null) {
  if (!draft) return '';
  return [draft.street, draft.city, draft.state || 'UT', draft.zip].filter(isUsefulText).join(', ');
}

function isUsefulText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized && normalized !== 'null' && normalized !== 'undefined' && normalized !== ',');
}

function displayResultAddress(result: PropertyResult) {
  const meaningfulLocation = [result.address?.street, result.address?.city, result.address?.zip].some(isUsefulText);
  if (meaningfulLocation) {
    return [result.address?.street, result.address?.city, result.address?.state, result.address?.zip].filter(isUsefulText).join(', ');
  }
  if (
    isUsefulText(result.address?.fullAddress) &&
    !/^(ut|utah)$/i.test(result.address.fullAddress.trim()) &&
    !/\b(null|undefined)\b/i.test(result.address.fullAddress)
  ) return result.address.fullAddress;
  if (isUsefulText(result.mlsId)) return `MLS #${result.mlsId}`;
  return 'Property record';
}

function displayResultLocation(result: PropertyResult) {
  return [result.address?.city, result.address?.state, result.address?.zip].filter(isUsefulText).join(', ') || 'Location review needed';
}

function getResultImage(result: PropertyResult) {
  return Array.isArray(result.photos) ? result.photos.find(isUsefulText) : undefined;
}

function resultQuality(result: PropertyResult) {
  let count = 0;
  if (isUsefulText(result.address?.street)) count += 1;
  if (isUsefulText(result.address?.city)) count += 1;
  if (isUsefulText(result.address?.zip)) count += 1;
  if (result.price > 0) count += 1;
  if (result.mlsId) count += 1;
  if (result.taxId) count += 1;
  if (result.photos?.length) count += 1;
  return Math.round((count / 7) * 100);
}

export default function PropertyWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PropertyResult[]>([]);
  const [recent, setRecent] = useState<PropertyResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntel, setShowIntel] = useState(true);
  const [savingAction, setSavingAction] = useState<'listing' | 'marketing' | null>(null);
  const [copied, setCopied] = useState(false);
  const parsedQuery = useMemo(() => parseSearchText(query), [query]);
  const score = useMemo(() => evaluateDraft(draft), [draft]);
  const listingQuery = useMemo(() => queryFromDraft(draft), [draft]);
  const portalLinks = useMemo(() => getAllPortalLinks(listingQuery), [listingQuery]);
  const mapLink = useMemo(() => buildGoogleMapsLink(listingQuery), [listingQuery]);
  const assessorLink = useMemo(() => buildAssessorLink(listingQuery), [listingQuery]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/search/history?limit=8');
      setRecent(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch {
      setRecent([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selectResult = useCallback((result: PropertyResult, index = 0) => {
    setSelectedIndex(index);
    setDraft(draftFromResult(result));
    setShowIntel(true);
  }, []);

  const runSearch = useCallback(async (rawQuery?: string) => {
    const searchText = (rawQuery ?? query).trim();
    const parsed = parseSearchText(searchText);
    if (!searchText) {
      setError('Enter an MLS number, address, city, ZIP, or listing link.');
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const imported: PropertyResult[] = [];
      if (parsed.kind === 'mls') {
        try {
          const mlsRes = await api.post<MlsListingRecord>('/mls/import', { mlsNumber: parsed.value });
          if (mlsRes.data?.mlsNumber) imported.push(mlsRecordToResult(mlsRes.data));
        } catch {
          // Broader search will still run and report a useful result or empty state.
        }
      }

      const searchRes = await api.post('/search/properties', buildSearchPayload(parsed.kind, parsed.value || searchText));
      const searched = Array.isArray(searchRes.data?.results) ? searchRes.data.results : [];
      const nextResults = dedupeResults([...imported, ...searched]);

      setResults(nextResults);
      setSelectedIndex(0);

      if (nextResults[0]) {
        setDraft(draftFromResult(nextResults[0]));
        toast.success('Property imported', `${sourceLabels[nextResults[0].source] || 'Source'} data is ready to review.`);
      } else {
        setDraft(manualDraftFromQuery(parsed.value || searchText, parsed.kind));
        setError('No verified match found. Review the manual workspace and use portal or records links to confirm details.');
      }

      setShowIntel(true);
      loadHistory();
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Property import failed.';
      setError(message);
      setResults([]);
      setDraft(manualDraftFromQuery(parsed.value || searchText, parsed.kind));
      toast.error('Import failed', message);
    } finally {
      setLoading(false);
    }
  }, [loadHistory, query, toast]);

  useEffect(() => {
    const initial = searchParams.get('q') || searchParams.get('query') || searchParams.get('mls') || searchParams.get('property');
    if (!initial || query) return;
    setQuery(initial);
    runSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateDraft = <K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const normalizedDraft = useMemo(() => {
    if (!draft) return null;
    return {
      ...draft,
      street: draft.street.trim(),
      city: draft.city.trim(),
      state: (draft.state || 'UT').trim().toUpperCase(),
      zip: draft.zip.trim(),
      mlsId: draft.mlsId.trim(),
      taxId: draft.taxId.trim(),
      headline: draft.headline.trim() || draft.street.trim() || 'Imported property',
      description: draft.description.trim() || `Imported property record for ${fullAddress(draft) || draft.mlsId || 'review'}.`,
      priceNumber: Math.round(parseNumber(draft.price)),
      bedsNumber: parseNumber(draft.beds),
      bathsNumber: parseNumber(draft.baths),
      sqftNumber: Math.round(parseNumber(draft.sqft)),
    };
  }, [draft]);

  const canCreateListing = Boolean(normalizedDraft?.street && normalizedDraft?.city && normalizedDraft?.zip);

  const createDraftListing = async (mode: 'stay' | 'marketing') => {
    if (!normalizedDraft) return null;
    if (!canCreateListing) {
      toast.warning('Review required', 'Street, city, and ZIP are required before saving a listing.');
      return null;
    }

    setSavingAction(mode === 'marketing' ? 'marketing' : 'listing');
    try {
      const res = await api.post('/listings', {
        addressLine1: normalizedDraft.street,
        city: normalizedDraft.city,
        state: normalizedDraft.state || 'UT',
        zipCode: normalizedDraft.zip,
        mlsId: normalizedDraft.mlsId || undefined,
        headline: normalizedDraft.headline,
        description: normalizedDraft.description,
        price: normalizedDraft.priceNumber || 0,
        beds: normalizedDraft.bedsNumber || undefined,
        baths: normalizedDraft.bathsNumber || undefined,
        sqft: normalizedDraft.sqftNumber || undefined,
        status: 'DRAFT',
        primaryImageUrl: normalizedDraft.photoUrl || undefined,
        heroImageUrl: normalizedDraft.photoUrl || undefined,
        isFeatured: false,
      });

      const listingId = res.data?.id;
      toast.success('Draft listing created', normalizedDraft.street);
      if (mode === 'marketing' && listingId) {
        navigate(`/marketing?newBlastForListing=${listingId}`);
      } else {
        navigate('/listings');
      }
      return listingId;
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Could not create the draft listing.';
      toast.error('Listing not saved', message);
      return null;
    } finally {
      setSavingAction(null);
    }
  };

  const startDeal = (withRepc = false) => {
    if (!normalizedDraft) return;
    sessionStorage.setItem('agentease_property_workspace_draft', JSON.stringify(normalizedDraft));

    const params = new URLSearchParams();
    if (withRepc) params.set('template', 'REPC');
    if (normalizedDraft.mlsId) params.set('mls', normalizedDraft.mlsId);
    params.set('property', normalizedDraft.mlsId || fullAddress(draft) || normalizedDraft.street);
    if (normalizedDraft.street) params.set('street', normalizedDraft.street);
    if (normalizedDraft.city) params.set('city', normalizedDraft.city);
    if (normalizedDraft.state) params.set('state', normalizedDraft.state);
    if (normalizedDraft.zip) params.set('zip', normalizedDraft.zip);
    if (normalizedDraft.taxId) params.set('taxId', normalizedDraft.taxId);
    if (normalizedDraft.priceNumber) params.set('price', String(normalizedDraft.priceNumber));
    navigate(`/deals/new?${params.toString()}`);
  };

  const copySummary = async () => {
    if (!normalizedDraft) return;
    const summary = [
      normalizedDraft.headline,
      fullAddress(draft),
      normalizedDraft.mlsId ? `MLS #${normalizedDraft.mlsId}` : null,
      normalizedDraft.taxId ? `Parcel/Tax ID: ${normalizedDraft.taxId}` : null,
      normalizedDraft.priceNumber ? `Price: ${formatPrice(normalizedDraft.priceNumber)}` : null,
      [formatBeds(normalizedDraft.bedsNumber), formatBaths(normalizedDraft.bathsNumber), normalizedDraft.sqftNumber ? `${normalizedDraft.sqftNumber.toLocaleString()} sqft` : null]
        .filter(Boolean)
        .join(' | '),
      normalizedDraft.sourceUrl || null,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success('Property summary copied');
    } catch {
      toast.error('Copy failed', 'Clipboard access was not available.');
    }
  };

  return (
    <PageLayout
      title="Property Workspace"
      subtitle="Import, verify, and launch deal-ready property records."
      maxWidth="full"
      actions={
        <Button type="button" variant="secondary" size="sm" onClick={loadHistory} loading={historyLoading}>
          <RefreshCw className="h-4 w-4" />
          Refresh history
        </Button>
      }
    >
      <div className="mx-auto max-w-[1500px] space-y-5">
        <Card tone="elevated" accent="amber" className="overflow-hidden" noPadding>
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d6b56d]/55 bg-[#fff5d6] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#6f4d12] shadow-[0_8px_20px_-14px_rgba(159,121,51,0.55)] dark:border-[#f2d894]/25 dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Property command center
                  </div>
                  <h2 className="mt-3 max-w-4xl text-2xl font-bold tracking-normal text-slate-950 dark:text-white sm:text-3xl">
                    Import once, verify fast, launch the next move.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Turn an MLS number or address into a clean agent-ready record for deals, contracts, listings, and marketing.
                  </p>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 text-center text-xs sm:w-auto">
                  <WorkflowStep icon={<Search className="h-4 w-4" />} label="Capture" active />
                  <WorkflowStep icon={<ShieldCheck className="h-4 w-4" />} label="Verify" active={Boolean(draft)} />
                  <WorkflowStep icon={<ArrowRight className="h-4 w-4" />} label="Launch" active={score.score >= 40} />
                </div>
              </div>

              <form
                className="mt-5 flex flex-col gap-3 lg:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  runSearch();
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="MLS #, address, city, ZIP, or listing link"
                    className="h-14 w-full rounded-full border border-slate-300/95 bg-white px-12 py-3 text-base font-semibold text-slate-950 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.50),0_0_0_1px_rgba(214,181,109,0.10)_inset] outline-none transition placeholder:text-slate-400 focus:border-[#d6b56d] focus:ring-4 focus:ring-[#d6b56d]/25 dark:border-[#f2d894]/20 dark:bg-[#0d141f]/80 dark:text-white dark:placeholder:text-slate-500"
                  />
                  {query.trim() && (
                    <span className="absolute right-3 top-1/2 max-w-[42%] -translate-y-1/2 truncate rounded-full border border-[#d6b56d]/45 bg-[#fff5d6] px-3 py-1 text-[11px] font-bold text-[#6f4d12] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0]">
                      {parsedQuery.display}
                    </span>
                  )}
                </div>
                <Button type="submit" size="lg" loading={loading} className="lg:min-w-[180px]">
                  {loading ? null : <Target className="h-4 w-4" />}
                  Import property
                </Button>
              </form>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/80 bg-gradient-to-br from-white via-[#fffaf0] to-slate-50 px-5 py-5 dark:border-[#f2d894]/10 dark:from-[#101827]/95 dark:via-[#0b1220]/92 dark:to-[#07090d]/95 xl:border-l xl:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Workspace quality</div>
                  <div className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{score.score}%</div>
                </div>
                <QualityBadge score={score.score} label={score.label} tone={score.tone} />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    score.tone === 'strong' || score.tone === 'good'
                      ? 'bg-gradient-to-r from-emerald-500 to-[#d6b56d]'
                      : score.tone === 'warning'
                        ? 'bg-gradient-to-r from-amber-500 to-[#d6b56d]'
                        : 'bg-gradient-to-r from-rose-500 to-amber-400',
                  )}
                  style={{ width: `${score.score}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <Signal label="Source" value={draft ? sourceLabels[draft.source] || sourceLabels.unknown : 'Waiting'} />
                <Signal label="Links" value={`${portalLinks.length + (mapLink ? 1 : 0) + (assessorLink ? 1 : 0)} ready`} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5 min-w-0">
            {results.length > 0 && (
              <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {results.slice(0, 6).map((result, index) => (
                  <ResultTile
                    key={`${result.source}-${result.mlsId || result.zpid || result.propertyId || index}`}
                    result={result}
                    selected={selectedIndex === index}
                    onClick={() => selectResult(result, index)}
                  />
                ))}
              </section>
            )}

            <Card tone="solid" accent="amber" title="Verified property record" description="Edit the working record before sending it into deals, listings, contracts, or marketing.">
              {draft ? (
                <div className="space-y-5">
                  <RecordSummary draft={draft} score={score.score} />
                  <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="relative mx-auto aspect-[4/3] w-full max-w-[440px] overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.65)] dark:border-[#f2d894]/15 dark:bg-white/5 md:max-w-none">
                      {draft.photoUrl ? (
                        <img src={draft.photoUrl} alt={draft.street || 'Property'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-600">
                          <Home className="h-12 w-12" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4">
                        <div className="text-lg font-bold text-white drop-shadow">{formatPrice(draft.price)}</div>
                        <div className="mt-1 line-clamp-1 text-xs font-semibold text-white/85 drop-shadow">
                          {fullAddress(draft) || draft.headline || 'Property record'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <SourceBadge source={draft.source} />
                      {draft.fetchedAt && (
                        <div className="rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          Checked {new Date(draft.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-5 min-w-0">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="MLS #" value={draft.mlsId} onChange={(value) => updateDraft('mlsId', value)} />
                      <Field label="Parcel / Tax ID" value={draft.taxId} onChange={(value) => updateDraft('taxId', value)} />
                      <Field label="Price" value={draft.price} hint={formatPrice(draft.price)} onChange={(value) => updateDraft('price', value)} inputMode="numeric" />
                      <Field label="Year built" value={draft.yearBuilt} onChange={(value) => updateDraft('yearBuilt', value)} inputMode="numeric" />
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_1fr_90px_120px]">
                      <Field label="Street" value={draft.street} onChange={(value) => updateDraft('street', value)} />
                      <Field label="City" value={draft.city} onChange={(value) => updateDraft('city', value)} />
                      <Field label="State" value={draft.state} onChange={(value) => updateDraft('state', value)} />
                      <Field label="ZIP" value={draft.zip} onChange={(value) => updateDraft('zip', value)} inputMode="numeric" />
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Beds" value={draft.beds} hint={formatBeds(draft.beds)} onChange={(value) => updateDraft('beds', value)} inputMode="decimal" />
                      <Field label="Baths" value={draft.baths} hint={formatBaths(draft.baths)} onChange={(value) => updateDraft('baths', value)} inputMode="decimal" />
                      <Field label="Sqft" value={draft.sqft} hint={draft.sqft ? `${formatShortNumber(draft.sqft)} sqft` : undefined} onChange={(value) => updateDraft('sqft', value)} inputMode="numeric" />
                      <Field label="Lot" value={draft.lotSize} hint={draft.lotSize ? formatShortNumber(draft.lotSize) : undefined} onChange={(value) => updateDraft('lotSize', value)} inputMode="decimal" />
                    </div>

                    <Field label="Listing headline" value={draft.headline} onChange={(value) => updateDraft('headline', value)} />
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-700 dark:text-slate-200">Remarks / notes</label>
                      <textarea
                        value={draft.description}
                        onChange={(event) => updateDraft('description', event.target.value)}
                        rows={4}
                        className="w-full resize-y rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.44)] outline-none transition focus:border-[#d6b56d] focus:ring-2 focus:ring-[#d6b56d]/25 dark:border-[#f2d894]/15 dark:bg-[#0d141f]/70 dark:text-white"
                      />
                    </div>
                    <Field label="Primary photo URL" value={draft.photoUrl} onChange={(value) => updateDraft('photoUrl', value)} />
                  </div>
                  </div>
                </div>
              ) : (
                <EmptyRecord onStart={() => runSearch()} />
              )}
            </Card>

            {showIntel && draft && (
              <PropertyIntelPanel query={listingQuery} expanded onClose={() => setShowIntel(false)} />
            )}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <Card tone="glass" accent="amber" title="Launch actions" description="Move the verified record into the next workflow.">
              <div className="space-y-3">
                <ActionButton
                  icon={<Building2 className="h-4 w-4" />}
                  title="Create draft listing"
                  detail="Save to Listings Hub"
                  disabled={!draft || savingAction !== null}
                  loading={savingAction === 'listing'}
                  onClick={() => createDraftListing('stay')}
                />
                <ActionButton
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  title="Start deal"
                  detail="Prefill deal wizard"
                  disabled={!draft}
                  onClick={() => startDeal(false)}
                />
                <ActionButton
                  icon={<FileSignature className="h-4 w-4" />}
                  title="Start deal + REPC"
                  detail="Carry property into contract prep"
                  disabled={!draft}
                  onClick={() => startDeal(true)}
                />
                <ActionButton
                  icon={<Megaphone className="h-4 w-4" />}
                  title="Create listing + launch marketing"
                  detail="Open blast composer"
                  disabled={!draft || savingAction !== null}
                  loading={savingAction === 'marketing'}
                  onClick={() => createDraftListing('marketing')}
                />
                <ActionButton
                  icon={<Copy className="h-4 w-4" />}
                  title={copied ? 'Summary copied' : 'Copy property summary'}
                  detail="Use in notes or messages"
                  disabled={!draft}
                  onClick={copySummary}
                />
              </div>
            </Card>

            <Card tone="solid" title="External checks" description="Open trusted references in a new tab.">
              {draft ? (
                <div className="space-y-2">
                  {portalLinks.slice(0, 5).map(({ portal, url }) => (
                    <ExternalCheck key={portal.id} href={url} label={portal.name} icon={<ExternalLink className="h-4 w-4" />} />
                  ))}
                  {mapLink && <ExternalCheck href={mapLink} label="Google Maps" icon={<MapPin className="h-4 w-4" />} />}
                  {assessorLink && <ExternalCheck href={assessorLink} label="County records search" icon={<FileText className="h-4 w-4" />} />}
                  {draft.sourceUrl && <ExternalCheck href={draft.sourceUrl} label="Original source" icon={<LinkIcon className="h-4 w-4" />} />}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Import a property to build portal, map, and records links.
                </div>
              )}
            </Card>

            <Card tone="subtle" title="Recent imports" description="Return to properties already touched by this account.">
              <div className="space-y-2">
                {historyLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading recent records
                  </div>
                ) : recent.length ? (
                  recent.slice(0, 6).map((item, index) => (
                    <button
                      key={`${item.source}-${item.mlsId || item.address?.fullAddress || index}`}
                      type="button"
                      onClick={() => {
                        setResults((prev) => dedupeResults([item, ...prev]));
                        selectResult(item, 0);
                      }}
                      className="block w-full rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-left transition hover:border-[#d6b56d]/70 hover:bg-[#fff8e8] dark:border-white/10 dark:bg-white/5 dark:hover:bg-[#d6b56d]/10"
                    >
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{displayResultAddress(item)}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{formatPrice(item.price)}{item.mlsId ? ` | MLS #${item.mlsId}` : ''}</div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    No recent imports yet.
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </PageLayout>
  );
}

function ResultTile({ result, selected, onClick }: { result: PropertyResult; selected: boolean; onClick: () => void }) {
  const imageUrl = getResultImage(result);
  const address = displayResultAddress(result);
  const location = displayResultLocation(result);
  const quality = resultQuality(result);
  const stats = [
    formatBeds(result.beds),
    formatBaths(result.baths),
    result.sqft ? `${formatShortNumber(result.sqft)} sqft` : '',
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group overflow-hidden rounded-2xl border bg-white text-left shadow-[0_18px_44px_-26px_rgba(15,23,42,0.55),0_0_0_1px_rgba(214,181,109,0.08)_inset] transition hover:-translate-y-0.5 hover:border-[#d6b56d]/75 hover:shadow-[0_24px_54px_-28px_rgba(15,23,42,0.65),0_0_0_1px_rgba(214,181,109,0.18)_inset] dark:bg-[#101827]/80',
        selected
          ? 'border-[#d6b56d] ring-2 ring-[#d6b56d]/30 dark:border-[#f2d894]/55'
          : 'border-slate-300/90 dark:border-[#f2d894]/15',
      )}
    >
      <div className="relative aspect-[16/9] bg-slate-100 dark:bg-white/5">
        {imageUrl ? (
          <img src={imageUrl} alt={address} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-[#fff5d6] text-slate-400 dark:from-[#101827] dark:via-[#0b1220] dark:to-[#161f2d] dark:text-slate-600">
            <Home className="h-11 w-11" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <SourceBadge source={result.source} />
        </div>
        <div className="absolute bottom-3 right-3 rounded-full border border-white/70 bg-white/92 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.7)] backdrop-blur dark:border-[#f2d894]/20 dark:bg-[#080c14]/88 dark:text-[#f7e7b0]">
          {quality}% complete
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold tracking-normal text-slate-950 dark:text-white">
            {formatPrice(result.price)}
          </div>
          <div className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">
            {address}
          </div>
          <div className="mt-2 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9f7933] dark:text-[#f2d894]" />
            <span className="truncate">{location}</span>
          </div>
        </div>

        <div className="flex min-h-[2rem] flex-wrap gap-2">
          {stats.length ? stats.map((stat) => <MetricChip key={stat}>{stat}</MetricChip>) : <MetricChip>Review details</MetricChip>}
          {result.mlsId ? <MetricChip>MLS #{result.mlsId}</MetricChip> : null}
        </div>
      </div>
    </button>
  );
}

function RecordSummary({ draft, score }: { draft: WorkspaceDraft; score: number }) {
  const metrics = [
    { label: 'Price', value: formatPrice(draft.price), icon: <Target className="h-4 w-4" /> },
    { label: 'Beds / Baths', value: [formatBeds(draft.beds), formatBaths(draft.baths)].filter(Boolean).join(' / ') || 'Review', icon: <Home className="h-4 w-4" /> },
    { label: 'Size', value: draft.sqft ? `${formatShortNumber(draft.sqft)} sqft` : 'Review', icon: <Ruler className="h-4 w-4" /> },
    { label: 'Quality', value: `${score}%`, icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-2xl border border-slate-300/90 bg-gradient-to-br from-white via-[#fffaf0] to-slate-50 p-4 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.55),0_0_0_1px_rgba(214,181,109,0.12)_inset] dark:border-[#f2d894]/15 dark:from-[#101827]/95 dark:via-[#0b1220]/90 dark:to-[#07090d]/95">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={draft.source} />
            {draft.mlsId ? <MetricChip>MLS #{draft.mlsId}</MetricChip> : null}
            {draft.taxId ? <MetricChip>Parcel {draft.taxId}</MetricChip> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-xl font-bold tracking-normal text-slate-950 dark:text-white">
            {fullAddress(draft) || draft.headline || 'Property record'}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            {draft.headline || 'Ready for final review'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-300/80 bg-white px-3 py-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/10">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7a5a24] dark:text-[#f2d894]">
                {metric.icon}
                {metric.label}
              </div>
              <div className="mt-2 truncate text-sm font-bold text-slate-950 dark:text-white">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={cn(
      'min-w-[86px] rounded-xl border px-3 py-2.5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.55)]',
      active
        ? 'border-[#d6b56d]/55 bg-[#fff5d6] text-[#6f4d12] dark:border-[#f2d894]/25 dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0]'
        : 'border-slate-300 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
    )}>
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/85 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.8)] dark:bg-white/10">{icon}</div>
      <div className="mt-1.5 text-[11px] font-bold">{label}</div>
    </div>
  );
}

function QualityBadge({ score, label, tone }: { score: number; label: string; tone: ReturnType<typeof evaluateDraft>['tone'] }) {
  const icon = score >= 66 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
      tone === 'strong' || tone === 'good'
        ? 'border-emerald-400/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
        : tone === 'warning'
          ? 'border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
          : 'border-rose-400/40 bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
    )}>
      {icon}
      {label}
    </span>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-white/10">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-[0_8px_18px_-14px_rgba(15,23,42,0.60)]', sourceStyles[source] || sourceStyles.unknown)}>
      <BadgeCheck className="h-3.5 w-3.5" />
      {sourceLabels[source] || sourceLabels.unknown}
    </span>
  );
}

function MetricChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-slate-300/90 bg-slate-50 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
      {children}
    </span>
  );
}

function Field({ label, value, hint, onChange, inputMode }: { label: string; value: string; hint?: string; onChange: (value: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex min-h-5 items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 dark:text-slate-200">
        <span className="truncate">{label}</span>
        {hint ? <span className="truncate normal-case tracking-normal text-[#7a5a24] dark:text-[#f2d894]">{hint}</span> : null}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300/95 bg-white px-3 text-sm font-semibold text-slate-950 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.44)] outline-none transition placeholder:text-slate-400 focus:border-[#d6b56d] focus:ring-4 focus:ring-[#d6b56d]/20 dark:border-[#f2d894]/15 dark:bg-[#0d141f]/70 dark:text-white dark:shadow-[0_10px_24px_-20px_rgba(0,0,0,0.9)]"
      />
    </label>
  );
}

function ActionButton({ icon, title, detail, disabled, loading, onClick }: { icon: React.ReactNode; title: string; detail: string; disabled?: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-300/90 bg-white px-3.5 py-3.5 text-left shadow-[0_14px_34px_-26px_rgba(15,23,42,0.55),0_0_0_1px_rgba(214,181,109,0.08)_inset] transition hover:-translate-y-0.5 hover:border-[#d6b56d]/75 hover:bg-[#fff8e8] hover:shadow-[0_20px_44px_-28px_rgba(15,23,42,0.65),0_0_0_1px_rgba(214,181,109,0.18)_inset] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#f2d894]/15 dark:bg-white/10 dark:hover:bg-[#d6b56d]/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6b56d]/45 bg-[#fff5d6] text-[#6f4d12] shadow-[0_8px_18px_-14px_rgba(159,121,51,0.70)] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-950 dark:text-white">{title}</span>
        <span className="mt-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#9f7933]" />
    </button>
  );
}

function ExternalCheck({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)] transition hover:border-[#d6b56d]/70 hover:bg-[#fff8e8] dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-[#d6b56d]/10"
    >
      <span className="text-[#9f7933] dark:text-[#f2d894]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
    </a>
  );
}

function EmptyRecord({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-white via-slate-50 to-[#fff5d6] px-5 py-12 text-center shadow-[0_18px_44px_-30px_rgba(15,23,42,0.55)] dark:border-white/10 dark:from-[#101827]/80 dark:via-[#0b1220]/80 dark:to-[#161f2d]/80">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d6b56d]/35 bg-[#fff5d6] text-[#7a5a24] dark:bg-[#d6b56d]/15 dark:text-[#f2d894]">
        <Home className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">No active property record</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
        Import a property to unlock verification, public records, portal links, and workflow actions.
      </p>
      <Button type="button" size="sm" className="mt-4" onClick={onStart}>
        <Search className="h-4 w-4" />
        Import now
      </Button>
    </div>
  );
}