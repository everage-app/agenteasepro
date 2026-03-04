import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { 
  ComboBox, 
  AddressAutocomplete, 
  ALL_UTAH_CITIES, 
  UTAH_COUNTIES, 
  CITY_TO_COUNTY 
} from '../../components/forms/AddressAutocomplete';

interface PartiesStep {
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerCoClientName: string;
  buyerCoClientEmail: string;
  sellerFirstName: string;
  sellerLastName: string;
  sellerEmail: string;
  sellerCoClientName: string;
  sellerCoClientEmail: string;
  street: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  parcelId: string; // Tax/Parcel ID
}

interface CrmContactOption {
  value: string;
  kind: 'CLIENT' | 'LEAD';
  id: string;
  clientId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  label: string;
}

interface PriceStep {
  purchasePrice: string; // Store as string for formatting
  earnestMoneyAmount: string;
}

interface ConditionsStep {
  hasDueDiligenceCondition: boolean;
  hasAppraisalCondition: boolean;
  hasFinancingCondition: boolean;
  dueDiligenceDeadline: string;
  financingAppraisalDeadline: string;
  settlementDeadline: string;
}

// Format number with commas
function formatCurrency(value: string): string {
  const num = value.replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('en-US');
}

// Parse formatted currency to number
function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9]/g, '')) || 0;
}

const CITY_BY_LENGTH = [...ALL_UTAH_CITIES].sort((a, b) => b.length - a.length);

function parseAddressLabel(label: string) {
  if (!label) return {} as { street?: string; city?: string; state?: string; zip?: string };
  const commaMatch = label.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
  if (commaMatch) {
    return {
      street: commaMatch[1]?.trim(),
      city: commaMatch[2]?.trim(),
      state: commaMatch[3]?.trim(),
      zip: commaMatch[4]?.trim(),
    };
  }

  const stateZipMatch = label.match(/\b([A-Z]{2})\s*(\d{5})$/i);
  const state = stateZipMatch?.[1]?.trim();
  const zip = stateZipMatch?.[2]?.trim();
  const streetCityPart = stateZipMatch ? label.slice(0, stateZipMatch.index).trim() : label.trim();
  const lower = streetCityPart.toLowerCase();
  let city = '';
  let street = streetCityPart;

  for (const c of CITY_BY_LENGTH) {
    if (lower.endsWith(c.toLowerCase())) {
      city = c;
      street = streetCityPart.slice(0, -c.length).trim();
      break;
    }
  }

  return { street: street || undefined, city: city || undefined, state, zip };
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function sanitizeZip(value?: string): string | undefined {
  if (!value) return undefined;
  const zipMatch = value.match(/\d{5}/);
  return zipMatch?.[0] || undefined;
}

function sanitizeCounty(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+county\s*$/i, '').trim();
  if (/^\d+$/.test(cleaned) || /^\d{6,}$/.test(cleaned)) return undefined;
  return cleaned || undefined;
}

function sanitizeCity(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  if (/^\d+$/.test(cleaned) || /^\d{6,}$/.test(cleaned)) return undefined;
  return cleaned;
}

function extractFirstStringByKey(
  input: unknown,
  keyPattern: RegExp,
  maxDepth = 4,
): string | undefined {
  const visited = new Set<unknown>();

  const walk = (node: unknown, depth: number): string | undefined => {
    if (!node || depth < 0 || visited.has(node)) return undefined;
    if (typeof node !== 'object') return undefined;

    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item, depth - 1);
        if (found) return found;
      }
      return undefined;
    }

    const record = node as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      if (keyPattern.test(key) && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    for (const value of Object.values(record)) {
      const found = walk(value, depth - 1);
      if (found) return found;
    }

    return undefined;
  };

  return walk(input, maxDepth);
}

// Format date for display
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Get quick date options
function getQuickDates() {
  const today = new Date();
  const dates = [];
  
  // 30 days
  const d30 = new Date(today);
  d30.setDate(d30.getDate() + 30);
  dates.push({ label: '30 days', date: d30, days: 30 });
  
  // 45 days
  const d45 = new Date(today);
  d45.setDate(d45.getDate() + 45);
  dates.push({ label: '45 days', date: d45, days: 45 });
  
  // 60 days
  const d60 = new Date(today);
  d60.setDate(d60.getDate() + 60);
  dates.push({ label: '60 days', date: d60, days: 60 });
  
  // 90 days
  const d90 = new Date(today);
  d90.setDate(d90.getDate() + 90);
  dates.push({ label: '90 days', date: d90, days: 90 });
  
  return dates;
}

// Currency Input Component
function CurrencyInput({ 
  label, 
  value, 
  onChange, 
  placeholder,
  suggestion 
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void;
  placeholder?: string;
  suggestion?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    onChange(formatted);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 font-semibold">$</span>
        <input
          type="text"
          inputMode="numeric"
          className="w-full rounded-xl bg-white border border-slate-200 pl-8 pr-4 py-3 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
          value={value}
          onChange={handleChange}
          placeholder={placeholder || '0'}
        />
      </div>
      {suggestion && !value && (
        <button
          type="button"
          onClick={() => onChange(suggestion)}
          className="mt-1.5 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Suggest: ${suggestion}
        </button>
      )}
    </div>
  );
}

// Date Picker with Quick Options
function DatePickerWithQuickOptions({ 
  value, 
  onChange,
  label 
}: { 
  value: string; 
  onChange: (val: string) => void;
  label: string;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const quickDates = getQuickDates();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toISODate = (date: Date) => date.toISOString().split('T')[0];

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      
      {/* Quick date buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickDates.map((qd) => (
          <button
            key={qd.days}
            type="button"
            onClick={() => onChange(toISODate(qd.date))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              value === toISODate(qd.date)
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:border-white/10'
            }`}
          >
            {qd.label}
          </button>
        ))}
      </div>

      {/* Date input */}
      <div className="relative">
        <input
          type="date"
          className="w-full rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all dark:bg-white/5 dark:border-white/10 dark:text-white dark:[color-scheme:dark]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>
      
      {value && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-green-600 dark:text-green-400 font-medium">{formatDateDisplay(value)}</span>
        </div>
      )}
    </div>
  );
}

function SimpleDateInput({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="date"
          className="w-full rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all dark:bg-white/5 dark:border-white/10 dark:text-white dark:[color-scheme:dark]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-green-600 dark:text-green-400 font-medium">{formatDateDisplay(value)}</span>
        </div>
      )}
      {helper && !value && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-500">{helper}</div>
      )}
    </div>
  );
}

export function DealCreateWizard() {
  const [step, setStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const [representation, setRepresentation] = useState<'BUYER' | 'SELLER' | null>(null);
  const [dealStage, setDealStage] = useState<'ACTIVE' | 'LEAD'>('ACTIVE');
  const [parties, setParties] = useState<PartiesStep>({
    buyerFirstName: '',
    buyerLastName: '',
    buyerEmail: '',
    buyerCoClientName: '',
    buyerCoClientEmail: '',
    sellerFirstName: '',
    sellerLastName: '',
    sellerEmail: '',
    sellerCoClientName: '',
    sellerCoClientEmail: '',
    street: '',
    city: '',
    county: '',
    state: 'UT',
    zip: '',
    parcelId: '',
  });
  const [price, setPrice] = useState<PriceStep>({ 
    purchasePrice: '', 
    earnestMoneyAmount: '' 
  });
  const [conditions, setConditions] = useState<ConditionsStep>({
    hasDueDiligenceCondition: true,
    hasAppraisalCondition: true,
    hasFinancingCondition: true,
    dueDiligenceDeadline: '',
    financingAppraisalDeadline: '',
    settlementDeadline: '',
  });
  const [mlsQuery, setMlsQuery] = useState('');
  const [mlsId, setMlsId] = useState('');
  const [mlsLoading, setMlsLoading] = useState(false);
  const [mlsError, setMlsError] = useState<string | null>(null);
  const [mlsResult, setMlsResult] = useState<any | null>(null);
  const [mlsAutofillSummary, setMlsAutofillSummary] = useState<string>('');
  const [contractParsing, setContractParsing] = useState(false);
  const [contractParseError, setContractParseError] = useState<string | null>(null);
  const [contractSummary, setContractSummary] = useState<string | null>(null);
  const [crmContacts, setCrmContacts] = useState<CrmContactOption[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [selectedBuyerPrimary, setSelectedBuyerPrimary] = useState('');
  const [selectedBuyerCo, setSelectedBuyerCo] = useState('');
  const [selectedSellerPrimary, setSelectedSellerPrimary] = useState('');
  const [selectedSellerCo, setSelectedSellerCo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateCode = searchParams.get('template');

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCrmContacts = async () => {
      setCrmLoading(true);
      try {
        const [clientsRes, leadsRes] = await Promise.all([
          api.get('/clients'),
          api.get('/leads', { params: { archived: 'false' } }),
        ]);

        if (cancelled) return;

        const clients = Array.isArray(clientsRes.data) ? clientsRes.data : [];
        const leads = Array.isArray(leadsRes.data) ? leadsRes.data : [];

        const clientOptions: CrmContactOption[] = clients.map((client: any) => {
          const firstName = (client.name || '').split(' ')[0] || '';
          const lastName = (client.name || '').split(' ').slice(1).join(' ') || '';
          const labelName = client.name || `${firstName} ${lastName}`.trim() || 'Unnamed Client';
          return {
            value: `CLIENT:${client.id}`,
            kind: 'CLIENT',
            id: client.id,
            firstName,
            lastName,
            email: client.email || '',
            label: `${labelName}${client.email ? ` • ${client.email}` : ''}`,
          };
        });

        const leadOptions: CrmContactOption[] = leads.map((lead: any) => {
          const firstName = lead.firstName || '';
          const lastName = lead.lastName || '';
          const labelName = `${firstName} ${lastName}`.trim() || 'Unnamed Lead';
          return {
            value: `LEAD:${lead.id}`,
            kind: 'LEAD',
            id: lead.id,
            clientId: lead.client?.id,
            firstName,
            lastName,
            email: lead.email || '',
            label: `${labelName}${lead.email ? ` • ${lead.email}` : ''}`,
          };
        });

        setCrmContacts([...clientOptions, ...leadOptions]);
      } catch (err) {
        console.error('Failed to load CRM contacts:', err);
        if (!cancelled) {
          setCrmContacts([]);
        }
      } finally {
        if (!cancelled) {
          setCrmLoading(false);
        }
      }
    };

    loadCrmContacts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (!clientId) return;

    let cancelled = false;

    const loadClient = async () => {
      try {
        const res = await api.get(`/clients/${clientId}`);
        const client = res.data?.client;
        if (!client || cancelled) return;

        const roleParam = (searchParams.get('role') || client.role || 'BUYER').toUpperCase();
        const isBuyer = roleParam === 'BUYER';

        setRepresentation((prev) => prev || (isBuyer ? 'BUYER' : 'SELLER'));
        if (isBuyer) {
          setSelectedBuyerPrimary(`CLIENT:${client.id}`);
        } else {
          setSelectedSellerPrimary(`CLIENT:${client.id}`);
        }
        setParties((prev) => ({
          ...prev,
          buyerFirstName: isBuyer && !prev.buyerFirstName ? client.firstName : prev.buyerFirstName,
          buyerLastName: isBuyer && !prev.buyerLastName ? client.lastName : prev.buyerLastName,
          buyerEmail: isBuyer && !prev.buyerEmail ? (client.email || '') : prev.buyerEmail,
          sellerFirstName: !isBuyer && !prev.sellerFirstName ? client.firstName : prev.sellerFirstName,
          sellerLastName: !isBuyer && !prev.sellerLastName ? client.lastName : prev.sellerLastName,
          sellerEmail: !isBuyer && !prev.sellerEmail ? (client.email || '') : prev.sellerEmail,
        }));
      } catch (err) {
        console.error('Failed to prefill client:', err);
      }
    };

    loadClient();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleClose = () => {
    setIsVisible(false);
    const clientId = searchParams.get('clientId');
    setTimeout(() => {
      if (clientId) {
        navigate(`/clients/${clientId}?tab=deals`);
      } else {
        navigate('/dashboard');
      }
    }, 200);
  };

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  // Validation
  const clientFirstName = representation === 'BUYER' ? parties.buyerFirstName : parties.sellerFirstName;
  const clientLastName = representation === 'BUYER' ? parties.buyerLastName : parties.sellerLastName;
  const isStep1Valid = representation && clientFirstName && clientLastName && parties.street && parties.city && parties.county && parties.zip;
  const isStep2Valid = parseCurrency(price.purchasePrice) > 0;
  const isStep3Valid = true; // All optional
  const canSubmit = isStep1Valid && isStep2Valid;

  const getContactByValue = (value: string) => crmContacts.find((contact) => contact.value === value);

  const applyContactToSide = (
    side: 'BUYER_PRIMARY' | 'BUYER_CO' | 'SELLER_PRIMARY' | 'SELLER_CO',
    contactValue: string,
  ) => {
    const contact = getContactByValue(contactValue);
    if (!contact) return;

    setParties((prev) => {
      if (side === 'BUYER_PRIMARY') {
        return {
          ...prev,
          buyerFirstName: contact.firstName || prev.buyerFirstName,
          buyerLastName: contact.lastName || prev.buyerLastName,
          buyerEmail: contact.email || prev.buyerEmail,
        };
      }
      if (side === 'BUYER_CO') {
        return {
          ...prev,
          buyerCoClientName: `${contact.firstName} ${contact.lastName}`.trim(),
          buyerCoClientEmail: contact.email || prev.buyerCoClientEmail,
        };
      }
      if (side === 'SELLER_PRIMARY') {
        return {
          ...prev,
          sellerFirstName: contact.firstName || prev.sellerFirstName,
          sellerLastName: contact.lastName || prev.sellerLastName,
          sellerEmail: contact.email || prev.sellerEmail,
        };
      }
      return {
        ...prev,
        sellerCoClientName: `${contact.firstName} ${contact.lastName}`.trim(),
        sellerCoClientEmail: contact.email || prev.sellerCoClientEmail,
      };
    });
  };

  const buildLegalNames = (primaryFirst: string, primaryLast: string, coName: string) => {
    const primary = `${primaryFirst} ${primaryLast}`.trim();
    const secondary = coName.trim();
    if (primary && secondary) return `${primary} and ${secondary}`;
    return primary || secondary;
  };

  // Calculate earnest money suggestion (1% of purchase price)
  const earnestSuggestion = price.purchasePrice 
    ? formatCurrency(String(Math.round(parseCurrency(price.purchasePrice) * 0.01)))
    : '';

  const handleMlsSearch = async () => {
    const query = mlsQuery.trim();
    if (!query) return;
    setMlsLoading(true);
    setMlsError(null);
    setMlsResult(null);
    setMlsAutofillSummary('');
    try {
      const normalizedMls = query.replace(/[^0-9]/g, '');
      const isMlsNumber = /^\d{6,10}$/.test(normalizedMls);
      let result = null as any;

      if (isMlsNumber) {
        try {
          const mlsRes = await api.post('/mls/import', { mlsNumber: normalizedMls });
          const listing = mlsRes.data;
          result = listing ? {
            mlsId: listing.mlsNumber || normalizedMls,
            price: Number(listing.price) || 0,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.squareFeet,
            taxId: listing.raw?.taxId,
            address: {
              street: listing.addressLine1 || '',
              city: listing.city || '',
              state: listing.state || 'UT',
              zip: listing.zip || '',
              fullAddress: [listing.addressLine1, listing.city, listing.state || 'UT', listing.zip]
                .filter(Boolean)
                .join(', '),
            },
          } : null;
        } catch {
          // Fall back to broader search if MLS import fails.
        }
      }

      if (!result) {
        const res = await api.post('/search/properties', { query, limit: 1 });
        result = res.data?.results?.[0] || null;
      }

      if (!result) {
        setMlsError('No listing found. Try a different MLS # or address.');
        return;
      }

      const parsedFromLabel = parseAddressLabel(result.address?.fullAddress || '');
      const nextStreet = firstNonEmptyString(
        result.address?.street,
        result.addressLine1,
        result.street,
        parsedFromLabel.street,
        extractFirstStringByKey(result, /street(address)?|addressline1|addr1/i),
      );
      const nextCity = firstNonEmptyString(
        result.address?.city,
        result.city,
        parsedFromLabel.city,
        extractFirstStringByKey(result, /city|municipality/i),
      );
      const normalizedCity = sanitizeCity(nextCity);
      const nextState = firstNonEmptyString(
        result.address?.state,
        result.state,
        parsedFromLabel.state,
        extractFirstStringByKey(result, /state|province/i),
        'UT',
      );
      const nextZip = sanitizeZip(firstNonEmptyString(
        result.address?.zip,
        result.zip,
        parsedFromLabel.zip,
        extractFirstStringByKey(result, /zip|postal/i),
      ));
      const nextCounty = sanitizeCounty(firstNonEmptyString(
        result.county,
        result.address?.county,
        extractFirstStringByKey(result, /county/i),
      )) || (normalizedCity ? CITY_TO_COUNTY[normalizedCity.toLowerCase()] : undefined);
      const nextTaxId = firstNonEmptyString(
        result.taxId,
        result.parcelId,
        result.address?.taxId,
        result.address?.parcelId,
        extractFirstStringByKey(result, /taxid|tax_id|parcel|apn/i),
      );
      const nextMlsId = firstNonEmptyString(
        result.mlsId,
        result.mlsNumber,
        result.listingId,
        result.propertyId,
      ) || (isMlsNumber ? normalizedMls : query);
      const nextPrice = Number(result.price || result.listPrice || result.listingPrice || 0);

      setMlsResult({
        ...result,
        mlsId: nextMlsId,
        taxId: nextTaxId,
        county: nextCounty,
        address: {
          ...result.address,
          street: nextStreet || result.address?.street || '',
          city: normalizedCity || result.address?.city || '',
          state: nextState || result.address?.state || 'UT',
          zip: nextZip || result.address?.zip || '',
          fullAddress: firstNonEmptyString(
            result.address?.fullAddress,
            [nextStreet, normalizedCity, nextState, nextZip].filter(Boolean).join(', '),
          ) || '',
        },
      });
      setMlsId(nextMlsId);

      const isValidStreet = !!(
        nextStreet &&
        !/^\$?[\d,]+$/.test(nextStreet.trim()) &&
        !nextStreet.toLowerCase().includes('price') &&
        nextStreet.length > 3
      );

      const autofilledFields: string[] = [];
      if (isValidStreet) autofilledFields.push('Street');
      if (normalizedCity) autofilledFields.push('City');
      if (nextCounty) autofilledFields.push('County');
      if (nextState) autofilledFields.push('State');
      if (nextZip) autofilledFields.push('ZIP');
      if (nextTaxId) autofilledFields.push('Parcel/Tax ID');
      if (nextMlsId) autofilledFields.push('MLS #');

      setParties((prev) => {
        return {
          ...prev,
          street: isValidStreet ? nextStreet || prev.street : prev.street,
          city: normalizedCity || prev.city,
          county: nextCounty || prev.county,
          state: nextState || prev.state || 'UT',
          zip: nextZip || prev.zip,
          parcelId: nextTaxId || prev.parcelId,
        };
      });

      if (nextPrice > 1000) {
        autofilledFields.push('Purchase Price');
      }

      if (nextPrice > 1000 && !price.purchasePrice) {
        setPrice((prev) => ({
          ...prev,
          purchasePrice: formatCurrency(String(nextPrice)),
        }));
      }

      setMlsAutofillSummary(
        autofilledFields.length
          ? `Auto-filled: ${autofilledFields.join(', ')}`
          : 'Listing found. Enter remaining details manually.',
      );
    } catch (err) {
      console.error('MLS lookup failed:', err);
      setMlsError('Could not fetch listing data. Please try again.');
    } finally {
      setMlsLoading(false);
    }
  };

  const handleContractUpload = async (file: File) => {
    setContractParsing(true);
    setContractParseError(null);
    setContractSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/contracts/parse-dates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const dates = res.data?.dates || {};

      setConditions((prev) => ({
        ...prev,
        hasDueDiligenceCondition: dates.dueDiligenceDeadline ? true : prev.hasDueDiligenceCondition,
        hasAppraisalCondition: dates.financingAppraisalDeadline ? true : prev.hasAppraisalCondition,
        hasFinancingCondition: dates.financingAppraisalDeadline ? true : prev.hasFinancingCondition,
        dueDiligenceDeadline: dates.dueDiligenceDeadline || prev.dueDiligenceDeadline,
        financingAppraisalDeadline: dates.financingAppraisalDeadline || prev.financingAppraisalDeadline,
        settlementDeadline: dates.settlementDeadline || prev.settlementDeadline,
      }));

      const summaryParts = [
        dates.dueDiligenceDeadline ? `Due diligence: ${dates.dueDiligenceDeadline}` : null,
        dates.financingAppraisalDeadline ? `Financing/Appraisal: ${dates.financingAppraisalDeadline}` : null,
        dates.settlementDeadline ? `Settlement: ${dates.settlementDeadline}` : null,
      ].filter(Boolean);

      setContractSummary(summaryParts.length ? summaryParts.join(' • ') : 'No dates were detected.');
    } catch (err) {
      console.error('Contract parsing failed:', err);
      setContractParseError('Could not extract dates from the contract. You can still enter them manually.');
    } finally {
      setContractParsing(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const buyerPrimaryContact = getContactByValue(selectedBuyerPrimary);
      const sellerPrimaryContact = getContactByValue(selectedSellerPrimary);
      const buyerLegalNames = buildLegalNames(parties.buyerFirstName, parties.buyerLastName, parties.buyerCoClientName);
      const sellerLegalNames = buildLegalNames(parties.sellerFirstName, parties.sellerLastName, parties.sellerCoClientName);
      const title = `${parties.street} - ${buyerLegalNames || sellerLegalNames || 'New Deal'}`;

      const buyerPayload = buyerLegalNames
        ? {
            role: 'BUYER',
            clientId: buyerPrimaryContact?.kind === 'CLIENT'
              ? buyerPrimaryContact.id
              : buyerPrimaryContact?.clientId || undefined,
            firstName: parties.buyerFirstName,
            lastName: parties.buyerLastName,
            email: parties.buyerEmail || undefined,
          }
        : undefined;

      const sellerPayload = sellerLegalNames
        ? {
            role: 'SELLER',
            clientId: sellerPrimaryContact?.kind === 'CLIENT'
              ? sellerPrimaryContact.id
              : sellerPrimaryContact?.clientId || undefined,
            firstName: parties.sellerFirstName,
            lastName: parties.sellerLastName || '',
            email: parties.sellerEmail || undefined,
          }
        : undefined;

      const res = await api.post('/deals', {
        title,
        offerReferenceDate: new Date().toISOString(),
        status: dealStage,
        purchasePrice: parseCurrency(price.purchasePrice) || undefined,
        property: {
          mlsId: mlsId || undefined,
          street: parties.street,
          city: parties.city,
          county: parties.county,
          state: parties.state || 'UT',
          zip: parties.zip,
          taxId: parties.parcelId || undefined,
        },
        buyer: buyerPayload,
        seller: sellerPayload,
      });
      const deal = res.data;
      if (templateCode && templateCode !== 'REPC') {
        try {
          await api.post(`/forms/deals/${deal.id}/forms`, { formCode: templateCode });
        } catch (err) {
          console.warn('Template form creation failed:', err);
        }
      }
      const repcPrefill = {
        // Parties
        buyerLegalNames,
        sellerLegalNames,
        // Property
        propertyCity: parties.city,
        propertyCounty: parties.county,
        propertyState: parties.state,
        propertyZip: parties.zip,
        propertyTaxId: parties.parcelId || '',
        // Money
        purchasePrice: parseCurrency(price.purchasePrice) || 0,
        earnestMoneyAmount: parseCurrency(price.earnestMoneyAmount) || 0,
        // Conditions
        hasDueDiligenceCondition: conditions.hasDueDiligenceCondition,
        hasAppraisalCondition: conditions.hasAppraisalCondition,
        hasFinancingCondition: conditions.hasFinancingCondition,
        dueDiligenceDeadline: conditions.dueDiligenceDeadline || undefined,
        financingAppraisalDeadline: conditions.financingAppraisalDeadline || undefined,
        settlementDeadline: conditions.settlementDeadline || undefined,
      };
      setIsVisible(false);
      setTimeout(
        () =>
          navigate(`/deals/${deal.id}/repc`, {
            state: {
              repcPrefill,
              templateStartCode: templateCode && templateCode !== 'REPC' ? templateCode : undefined,
            },
          }),
        200,
      );
    } catch (e: any) {
      console.error('Deal creation error:', e);
      const message = e.response?.data?.error || e.response?.data?.message || 'Could not create deal. Please check all fields.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/65 dark:bg-black/85 backdrop-blur-xl" onClick={handleClose} />

      {/* Glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Modal Container */}
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className={`relative w-full max-w-2xl transform transition-all duration-300 ease-out my-8 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Outer glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-emerald-500/20 to-blue-500/20 rounded-[28px] blur-xl opacity-75" />

          {/* Main Modal */}
          <div className="relative flex flex-col rounded-[24px] border border-slate-300 bg-white shadow-2xl overflow-hidden dark:border-white/20 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-300 dark:border-white/15 bg-slate-50/80 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-emerald-500 rounded-xl blur-lg opacity-40" />
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-600/20 border border-blue-400/30">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">New Deal</h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Quick setup → straight to REPC</p>
                    {templateCode && (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-200">
                        Template selected: {templateCode}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={`h-2 w-8 rounded-full transition-all duration-300 ${
                          s <= step
                            ? 'bg-gradient-to-r from-blue-500 to-emerald-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                            : 'bg-slate-200 dark:bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleClose}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-300 text-slate-700 hover:bg-red-500/15 hover:text-red-600 hover:border-red-500/30 transition-all duration-200 dark:bg-white/10 dark:border-white/20 dark:text-slate-200 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Step 1: Parties & Property */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs border border-blue-500/30">1</span>
                Parties & Property
              </h2>

              {/* Representation Selector */}
              <div className="rounded-xl p-4 border border-slate-200 bg-slate-50 dark:bg-white/5 dark:border-white/10">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-3">
                  Who are you representing? *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRepresentation('BUYER')}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      representation === 'BUYER'
                        ? 'bg-blue-500/15 border-blue-500/50 text-blue-700 shadow-lg shadow-blue-500/20 dark:bg-blue-500/20 dark:text-blue-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-500/60 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div className="text-left">
                      <div className="font-bold">Buyer's Agent</div>
                      <div className="text-xs opacity-90">Representing the buyer</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepresentation('SELLER')}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      representation === 'SELLER'
                        ? 'bg-orange-500/15 border-orange-500/50 text-orange-700 shadow-lg shadow-orange-500/20 dark:bg-orange-500/20 dark:text-orange-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-orange-500/60 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div className="text-left">
                      <div className="font-bold">Listing Agent</div>
                      <div className="text-xs opacity-90">Representing the seller</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Deal Stage */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 dark:bg-white/5 dark:border-white/10">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Deal stage
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDealStage('ACTIVE')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-semibold ${
                      dealStage === 'ACTIVE'
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-emerald-400/50 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Active Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealStage('LEAD')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-semibold ${
                      dealStage === 'LEAD'
                        ? 'bg-blue-500/15 border-blue-500/60 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-blue-400/50 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Lead (pre-offer)
                  </button>
                </div>
                <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-2">
                  Most agents start as Active Deal once a client is engaged.
                </div>
              </div>
              
              {/* Client Section - Your client (Buyer or Seller based on representation) */}
              {representation && (
                <div className={`rounded-xl p-4 border ${
                  representation === 'BUYER' 
                    ? 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/10 dark:border-blue-500/20' 
                    : 'bg-orange-500/10 border-orange-500/30 dark:bg-orange-500/10 dark:border-orange-500/20'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
                    representation === 'BUYER' ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Your Client ({representation === 'BUYER' ? 'Buyer' : 'Seller'})
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Add from existing client or lead</label>
                      <select
                        value={representation === 'BUYER' ? selectedBuyerPrimary : selectedSellerPrimary}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (representation === 'BUYER') {
                            setSelectedBuyerPrimary(value);
                            applyContactToSide('BUYER_PRIMARY', value);
                          } else {
                            setSelectedSellerPrimary(value);
                            applyContactToSide('SELLER_PRIMARY', value);
                          }
                        }}
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all dark:bg-slate-800/60 dark:border-white/15 dark:text-slate-100"
                      >
                        <option value="">{crmLoading ? 'Loading CRM contacts…' : 'Select client or lead'}</option>
                        {crmContacts.map((contact) => (
                          <option key={contact.value} value={contact.value}>
                            {contact.kind === 'CLIENT' ? 'Client' : 'Lead'} • {contact.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Co-client / spouse (optional)</label>
                      <select
                        value={representation === 'BUYER' ? selectedBuyerCo : selectedSellerCo}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (representation === 'BUYER') {
                            setSelectedBuyerCo(value);
                            applyContactToSide('BUYER_CO', value);
                          } else {
                            setSelectedSellerCo(value);
                            applyContactToSide('SELLER_CO', value);
                          }
                        }}
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all dark:bg-slate-800/60 dark:border-white/15 dark:text-slate-100"
                      >
                        <option value="">None</option>
                        {crmContacts.map((contact) => (
                          <option key={`${contact.value}-co`} value={contact.value}>
                            {contact.kind === 'CLIENT' ? 'Client' : 'Lead'} • {contact.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">First Name *</label>
                      <input
                        className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-500 dark:bg-slate-900/70 dark:border-white/20 dark:text-slate-100 dark:placeholder:text-slate-400"
                        value={representation === 'BUYER' ? parties.buyerFirstName : parties.sellerFirstName}
                        onChange={(e) => representation === 'BUYER' 
                          ? setParties({ ...parties, buyerFirstName: e.target.value })
                          : setParties({ ...parties, sellerFirstName: e.target.value })
                        }
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Last Name *</label>
                      <input
                        className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-500 dark:bg-slate-900/70 dark:border-white/20 dark:text-slate-100 dark:placeholder:text-slate-400"
                        value={representation === 'BUYER' ? parties.buyerLastName : parties.sellerLastName}
                        onChange={(e) => representation === 'BUYER'
                          ? setParties({ ...parties, buyerLastName: e.target.value })
                          : setParties({ ...parties, sellerLastName: e.target.value })
                        }
                        placeholder="Last name"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Email (optional)</label>
                      <input
                        type="email"
                        className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-500 dark:bg-slate-900/70 dark:border-white/20 dark:text-slate-100 dark:placeholder:text-slate-400"
                        value={representation === 'BUYER' ? parties.buyerEmail : parties.sellerEmail}
                        onChange={(e) => representation === 'BUYER'
                          ? setParties({ ...parties, buyerEmail: e.target.value })
                          : setParties({ ...parties, sellerEmail: e.target.value })
                        }
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Co-client / spouse name</label>
                      <input
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/60 dark:border-white/15 dark:text-slate-100 dark:placeholder:text-slate-500"
                        value={representation === 'BUYER' ? parties.buyerCoClientName : parties.sellerCoClientName}
                        onChange={(e) => representation === 'BUYER'
                          ? setParties({ ...parties, buyerCoClientName: e.target.value })
                          : setParties({ ...parties, sellerCoClientName: e.target.value })
                        }
                        placeholder="Spouse or co-client full name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Co-client email (optional)</label>
                      <input
                        type="email"
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/60 dark:border-white/15 dark:text-slate-100 dark:placeholder:text-slate-500"
                        value={representation === 'BUYER' ? parties.buyerCoClientEmail : parties.sellerCoClientEmail}
                        onChange={(e) => representation === 'BUYER'
                          ? setParties({ ...parties, buyerCoClientEmail: e.target.value })
                          : setParties({ ...parties, sellerCoClientEmail: e.target.value })
                        }
                        placeholder="spouse@example.com"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Other Party Section */}
              {representation && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 dark:bg-white/5 dark:border-white/5">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Other Party ({representation === 'BUYER' ? 'Seller' : 'Buyer'}) - Optional
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Add other party from client or lead</label>
                    <select
                      value={representation === 'BUYER' ? selectedSellerPrimary : selectedBuyerPrimary}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (representation === 'BUYER') {
                          setSelectedSellerPrimary(value);
                          applyContactToSide('SELLER_PRIMARY', value);
                        } else {
                          setSelectedBuyerPrimary(value);
                          applyContactToSide('BUYER_PRIMARY', value);
                        }
                      }}
                      className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all dark:bg-slate-800/60 dark:border-white/15 dark:text-slate-100"
                    >
                      <option value="">Select client or lead</option>
                      {crmContacts.map((contact) => (
                        <option key={`${contact.value}-other`} value={contact.value}>
                          {contact.kind === 'CLIENT' ? 'Client' : 'Lead'} • {contact.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">First Name</label>
                      <input
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                        value={representation === 'BUYER' ? parties.sellerFirstName : parties.buyerFirstName}
                        onChange={(e) => representation === 'BUYER'
                          ? setParties({ ...parties, sellerFirstName: e.target.value })
                          : setParties({ ...parties, buyerFirstName: e.target.value })
                        }
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">Last Name</label>
                      <input
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                        value={representation === 'BUYER' ? parties.sellerLastName : parties.buyerLastName}
                        onChange={(e) => representation === 'BUYER'
                          ? setParties({ ...parties, sellerLastName: e.target.value })
                          : setParties({ ...parties, buyerLastName: e.target.value })
                        }
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Property Section */}
              {representation && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 dark:bg-white/5 dark:border-white/5">
                  <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Property Address
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 dark:bg-slate-900/40 dark:border-white/10">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">MLS or Listing Import</div>
                      <div className="text-xs text-slate-600 dark:text-slate-500 mb-3">Paste an MLS # or listing address to auto-fill the property details.</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/60 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                          value={mlsQuery}
                          onChange={(e) => setMlsQuery(e.target.value)}
                          placeholder="MLS # or 123 Main St, City"
                        />
                        <button
                          type="button"
                          onClick={handleMlsSearch}
                          disabled={!mlsQuery.trim() || mlsLoading}
                          className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {mlsLoading ? 'Searching…' : 'Find Listing'}
                        </button>
                      </div>
                      {mlsError && (
                        <div className="mt-2 text-xs text-red-500 dark:text-red-400">{mlsError}</div>
                      )}
                      {mlsAutofillSummary && !mlsError && (
                        <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">{mlsAutofillSummary}</div>
                      )}
                      {mlsResult && (
                        <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-200">
                          <div className="font-semibold text-emerald-700 dark:text-emerald-100">Listing found</div>
                          {mlsResult.address?.fullAddress && (
                            <div className="mt-1 font-medium">{mlsResult.address.fullAddress}</div>
                          )}
                          {!mlsResult.address?.fullAddress && mlsResult.address?.street && (
                            <div className="mt-1 font-medium">
                              {mlsResult.address.street}, {mlsResult.address.city || ''} {mlsResult.address.state || 'UT'} {mlsResult.address.zip || ''}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                            {mlsResult.price && mlsResult.price > 1000 && (
                              <span className="bg-emerald-500/20 px-2 py-0.5 rounded">
                                ${Number(mlsResult.price).toLocaleString()}
                              </span>
                            )}
                            {mlsResult.beds && <span>🛏 {mlsResult.beds} beds</span>}
                            {mlsResult.baths && <span>🛁 {mlsResult.baths} baths</span>}
                            {mlsResult.sqft && <span>📐 {mlsResult.sqft.toLocaleString()} sqft</span>}
                          </div>
                          {mlsId && <div className="mt-1 text-emerald-700 dark:text-emerald-300">MLS #: {mlsId}</div>}
                        </div>
                      )}
                    </div>

                    <AddressAutocomplete
                      value={parties.street}
                      onChange={(street) => setParties({ ...parties, street })}
                      onAddressSelect={(addr) => {
                        setParties({
                          ...parties,
                          street: addr.street,
                          city: addr.city,
                          county: addr.county,
                          state: addr.state || 'UT',
                          zip: addr.zip || parties.zip
                        });
                      }}
                      placeholder="Start typing address..."
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <ComboBox
                        label="City *"
                        value={parties.city}
                        onChange={(city) => {
                          const county = CITY_TO_COUNTY[city.toLowerCase()] || parties.county;
                          setParties({ ...parties, city, county });
                        }}
                        options={ALL_UTAH_CITIES}
                        placeholder="Select or type city"
                      />
                      <ComboBox
                        label="County *"
                        value={parties.county}
                        onChange={(county) => setParties({ ...parties, county })}
                        options={UTAH_COUNTIES}
                        placeholder="Select county"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">State</label>
                        <input
                          className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-500 focus:outline-none transition-all cursor-not-allowed dark:bg-slate-800/50 dark:border-white/10 dark:text-slate-400"
                          value={parties.state}
                          disabled
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">ZIP *</label>
                        <input
                          className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                          value={parties.zip}
                          onChange={(e) => setParties({ ...parties, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                          placeholder="84101"
                          maxLength={5}
                        />
                      </div>
                    </div>
                    {/* Parcel/Tax ID */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">Parcel/Tax ID (optional)</label>
                      <input
                        className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-slate-800/50 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                        value={parties.parcelId}
                        onChange={(e) => setParties({ ...parties, parcelId: e.target.value })}
                        placeholder="12-34-567-890"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Usually found on tax records or county assessor</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Prompt to select representation */}
              {!representation && (
                <div className="text-center py-8 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <p className="text-sm">Select who you're representing to continue</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Purchase Basics */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs border border-blue-500/30">2</span>
                Purchase Price
              </h2>
              
              <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-5 dark:bg-white/5 dark:border-white/5">
                <CurrencyInput
                  label="Purchase Price *"
                  value={price.purchasePrice}
                  onChange={(val) => setPrice({ ...price, purchasePrice: val })}
                  placeholder="500,000"
                />

                <CurrencyInput
                  label="Earnest Money"
                  value={price.earnestMoneyAmount}
                  onChange={(val) => setPrice({ ...price, earnestMoneyAmount: val })}
                  placeholder="5,000"
                  suggestion={earnestSuggestion}
                />

                {/* Quick price buttons */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-2">Quick Set Price</label>
                  <div className="flex flex-wrap gap-2">
                    {['250,000', '350,000', '450,000', '550,000', '650,000', '750,000', '850,000', '1,000,000'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrice({ 
                          ...price, 
                          purchasePrice: p,
                          earnestMoneyAmount: price.earnestMoneyAmount || formatCurrency(String(Math.round(parseCurrency(p) * 0.01)))
                        })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          price.purchasePrice === p
                            ? 'bg-green-500/20 text-green-600 border border-green-500/30 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:border-white/10'
                        }`}
                      >
                        ${p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              {parseCurrency(price.purchasePrice) > 0 && (
                <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-xl p-4 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Purchase Price</span>
                    <span className="text-xl font-bold text-green-400">
                      ${formatCurrency(String(parseCurrency(price.purchasePrice)))}
                    </span>
                  </div>
                  {parseCurrency(price.earnestMoneyAmount) > 0 && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Earnest Money</span>
                      <span className="text-lg font-semibold text-blue-400">
                        ${formatCurrency(String(parseCurrency(price.earnestMoneyAmount)))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Conditions & Deadlines */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs border border-blue-500/30">3</span>
                Conditions & Timeline
              </h2>
              
              {/* Conditions with auto-date calculation */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Contract Conditions
                </label>
                {[
                  { key: 'hasDueDiligenceCondition', label: 'Due Diligence', desc: '14 days to inspect', days: 14, dateKey: 'dueDiligenceDeadline' },
                  { key: 'hasAppraisalCondition', label: 'Appraisal', desc: 'Must appraise at purchase price', days: 21, dateKey: 'financingAppraisalDeadline' },
                  { key: 'hasFinancingCondition', label: 'Financing', desc: 'Subject to loan approval', days: 21, dateKey: 'financingAppraisalDeadline' },
                ].map((cond) => (
                  <label 
                    key={cond.key}
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-blue-500/30 transition group dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10"
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={conditions[cond.key as keyof ConditionsStep] as boolean}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          const updates: Partial<ConditionsStep> = { [cond.key]: isChecked };
                          
                          // Auto-calculate date when condition is enabled
                          if (isChecked && cond.dateKey && !conditions[cond.dateKey as keyof ConditionsStep]) {
                            const targetDate = new Date();
                            targetDate.setDate(targetDate.getDate() + cond.days);
                            updates[cond.dateKey as keyof ConditionsStep] = targetDate.toISOString().split('T')[0] as any;
                          }
                          
                          setConditions({ ...conditions, ...updates });
                        }}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        conditions[cond.key as keyof ConditionsStep]
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-slate-600 group-hover:border-slate-500'
                      }`}>
                        {conditions[cond.key as keyof ConditionsStep] && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{cond.label}</div>
                      <div className="text-xs text-slate-500">{cond.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Settlement Date */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 dark:bg-white/5 dark:border-white/10">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Import From Contract</div>
                <div className="text-xs text-slate-500 mb-3">
                  Upload a signed or draft contract to auto-fill key dates (PDF).
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleContractUpload(file);
                      }
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-400 dark:file:bg-white/10 dark:file:text-slate-200 dark:hover:file:bg-white/20"
                  />
                  {contractParsing && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">Parsing contract…</div>
                  )}
                </div>
                {contractParseError && (
                  <div className="mt-2 text-xs text-red-400">{contractParseError}</div>
                )}
                {contractSummary && (
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">{contractSummary}</div>
                )}
              </div>

              {/* Deadline Date Pickers with Quick Set Buttons */}
              <div className="grid sm:grid-cols-2 gap-4">
                {conditions.hasDueDiligenceCondition && (
                  <div className="space-y-2">
                    <SimpleDateInput
                      label="Due Diligence Deadline"
                      value={conditions.dueDiligenceDeadline}
                      onChange={(val) => setConditions({ ...conditions, dueDiligenceDeadline: val })}
                      helper="Pick the inspection/earnest deadline"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[7, 10, 14, 21].map((days) => {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        const dateStr = d.toISOString().split('T')[0];
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setConditions({ ...conditions, dueDiligenceDeadline: dateStr })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              conditions.dueDiligenceDeadline === dateStr
                                ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30 dark:text-blue-400'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:border-white/10'
                            }`}
                          >
                            {days} days
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {(conditions.hasAppraisalCondition || conditions.hasFinancingCondition) && (
                  <div className="space-y-2">
                    <SimpleDateInput
                      label="Financing/Appraisal Deadline"
                      value={conditions.financingAppraisalDeadline}
                      onChange={(val) => setConditions({ ...conditions, financingAppraisalDeadline: val })}
                      helper="Use the loan approval or appraisal deadline"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[14, 21, 30, 45].map((days) => {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        const dateStr = d.toISOString().split('T')[0];
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setConditions({ ...conditions, financingAppraisalDeadline: dateStr })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              conditions.financingAppraisalDeadline === dateStr
                                ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30 dark:text-blue-400'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:border-white/10'
                            }`}
                          >
                            {days} days
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <DatePickerWithQuickOptions
                label="Target Settlement Date"
                value={conditions.settlementDeadline}
                onChange={(val) => setConditions({ ...conditions, settlementDeadline: val })}
              />
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs border border-green-500/30">✓</span>
                Review & Create
              </h2>

              {/* Representation Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                representation === 'BUYER'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {representation === 'BUYER' ? "Buyer's Agent" : "Listing Agent"}
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Your Client */}
                <div className={`border rounded-xl p-5 space-y-3 ${
                  representation === 'BUYER'
                    ? 'bg-blue-500/5 border-blue-500/20'
                    : 'bg-orange-500/5 border-orange-500/20'
                }`}>
                  <div className={`font-bold text-xs uppercase tracking-wider flex items-center gap-2 ${
                    representation === 'BUYER' ? 'text-blue-400' : 'text-orange-400'
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Your Client ({representation === 'BUYER' ? 'Buyer' : 'Seller'})
                  </div>
                  <div className="text-lg text-slate-900 dark:text-white font-semibold">
                    {representation === 'BUYER' 
                      ? `${parties.buyerFirstName} ${parties.buyerLastName}`
                      : `${parties.sellerFirstName} ${parties.sellerLastName}`
                    }
                  </div>
                  {((representation === 'BUYER' && parties.buyerCoClientName) || (representation === 'SELLER' && parties.sellerCoClientName)) && (
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      + {representation === 'BUYER' ? parties.buyerCoClientName : parties.sellerCoClientName}
                    </div>
                  )}
                  {((representation === 'BUYER' && parties.buyerEmail) || (representation === 'SELLER' && parties.sellerEmail)) && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {representation === 'BUYER' ? parties.buyerEmail : parties.sellerEmail}
                    </div>
                  )}
                </div>

                {/* Other Party */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 dark:bg-white/5 dark:border-white/5">
                  <div className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {representation === 'BUYER' ? 'Seller' : 'Buyer'}
                  </div>
                  <div className="text-sm text-slate-900 dark:text-white font-medium">
                    {representation === 'BUYER'
                      ? (parties.sellerFirstName ? `${parties.sellerFirstName} ${parties.sellerLastName}` : <span className="text-slate-500 italic">Not specified</span>)
                      : (parties.buyerFirstName ? `${parties.buyerFirstName} ${parties.buyerLastName}` : <span className="text-slate-500 italic">Not specified</span>)
                    }
                  </div>
                  {((representation === 'BUYER' && parties.sellerCoClientName) || (representation === 'SELLER' && parties.buyerCoClientName)) && (
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      + {representation === 'BUYER' ? parties.sellerCoClientName : parties.buyerCoClientName}
                    </div>
                  )}
                </div>

                {/* Property */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 dark:bg-white/5 dark:border-white/5">
                  <div className="font-bold text-green-400 text-xs uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Property
                  </div>
                  <div className="text-sm text-slate-900 dark:text-white font-medium">
                    <div>{parties.street}</div>
                    <div className="text-slate-600 dark:text-slate-400">{parties.city}, {parties.state} {parties.zip}</div>
                    <div className="text-xs text-slate-500 mt-1">{parties.county} County</div>
                  </div>
                </div>

                {/* Money */}
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-5 space-y-3">
                  <div className="font-bold text-green-400 text-xs uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Price
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    ${formatCurrency(String(parseCurrency(price.purchasePrice)))}
                  </div>
                  {parseCurrency(price.earnestMoneyAmount) > 0 && (
                    <div className="text-sm text-slate-400">
                      Earnest: ${formatCurrency(String(parseCurrency(price.earnestMoneyAmount)))}
                    </div>
                  )}
                </div>
              </div>

              {/* Conditions */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 dark:bg-white/5 dark:border-white/5">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Conditions
                </div>
                <div className="flex flex-wrap gap-2">
                  {conditions.hasDueDiligenceCondition && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg">Due Diligence</span>
                  )}
                  {conditions.hasAppraisalCondition && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg">Appraisal</span>
                  )}
                  {conditions.hasFinancingCondition && (
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-lg">Financing</span>
                  )}
                  {!conditions.hasDueDiligenceCondition && !conditions.hasAppraisalCondition && !conditions.hasFinancingCondition && (
                    <span className="text-slate-500 text-sm italic">No conditions</span>
                  )}
                </div>
                {conditions.settlementDeadline && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-white/5">
                    Settlement: {formatDateDisplay(conditions.settlementDeadline)}
                  </div>
                )}
                {conditions.dueDiligenceDeadline && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-white/5">
                    Due diligence: {formatDateDisplay(conditions.dueDiligenceDeadline)}
                  </div>
                )}
                {conditions.financingAppraisalDeadline && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-white/5">
                    Financing/Appraisal: {formatDateDisplay(conditions.financingAppraisalDeadline)}
                  </div>
                )}
              </div>

              {/* What's Next */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">What happens next?</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      After creating this deal, you'll be taken directly to the REPC form builder with your dates pre-filled.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-red-400">Could not create deal</div>
                <div className="text-xs text-red-400/80 mt-0.5">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation - Fixed Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-300 bg-white rounded-b-2xl dark:border-white/15 dark:bg-slate-900">
          <button
            type="button"
            onClick={prev}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 transition-colors dark:text-slate-200 dark:hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
              className="flex items-center gap-2 rounded-full bg-blue-600 text-white text-sm font-bold px-8 py-3 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
            >
              Continue
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !canSubmit}
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-bold px-8 py-3 hover:from-green-500 hover:to-emerald-500 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Deal
                </>
              )}
            </button>
          )}
        </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
