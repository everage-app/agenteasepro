import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAiLevel } from '../../features/settings/useAiLevel';
import { ALL_UTAH_CITIES } from '../forms/AddressAutocomplete';
import { useVoiceInput } from '../../hooks/useVoiceInput';

interface PropertyResult {
  source: string;
  mlsId?: string;
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
  photos: string[];
  url: string;
}

interface CommandAction {
  type: string;
  description: string;
  parameters?: Record<string, any>;
  data?: any;
}

interface CommandResponse {
  intent: string;
  confidence: number;
  actions: CommandAction[];
  messages: string[];
  requiresConfirmation: boolean;
  data?: {
    properties?: PropertyResult[];
    clients?: any[];
    tasks?: any[];
    listings?: any[];
    stats?: any;
  };
}

interface Suggestion {
  type: 'command' | 'address' | 'client' | 'listing' | 'city' | 'recent';
  icon: string;
  text: string;
  subtext?: string;
  value: string;
}

const formatPrice = (price: number) => {
  if (!Number.isFinite(price) || price <= 0) return 'Not listed';
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}k`;
  return `$${price}`;
};

const buildMapUrl = (fullAddress: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

const buildAssessorUrl = (fullAddress: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${fullAddress} county assessor`)}`;

const sourceColors: Record<string, string> = {
  utahrealestate: 'bg-blue-500/20 text-blue-300',
  zillow: 'bg-sky-500/20 text-sky-300',
  realtor: 'bg-red-500/20 text-red-300',
  redfin: 'bg-orange-500/20 text-orange-300',
};

// Use comprehensive Utah cities list from AddressAutocomplete
const utahCities = ALL_UTAH_CITIES;

// Command templates
const commandTemplates: Suggestion[] = [
  { type: 'command', icon: '🔍', text: 'Search homes in...', subtext: 'Find properties by location', value: 'Search homes in ' },
  { type: 'command', icon: '🏠', text: 'MLS# lookup', subtext: 'Search by MLS number', value: 'MLS# ' },
  { type: 'command', icon: '✅', text: 'Create task...', subtext: 'Add a new task', value: 'Task: ' },
  { type: 'command', icon: '📝', text: 'New deal for...', subtext: 'Start a new deal', value: 'New deal for ' },
  { type: 'command', icon: '👥', text: 'Find client...', subtext: 'Search your clients', value: 'Find client ' },
  { type: 'command', icon: '📊', text: 'My summary', subtext: 'Get your daily overview', value: 'What\'s happening this week' },
  { type: 'command', icon: '📅', text: 'Show calendar', subtext: 'View your schedule', value: 'Show my calendar' },
  { type: 'command', icon: '📣', text: 'Marketing', subtext: 'Create marketing content', value: 'Create marketing blast' },
];

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function CommandBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const aiLevel = useAiLevel();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<CommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [cachedListings, setCachedListings] = useState<PropertyResult[]>([]);
  const [searchResults, setSearchResults] = useState<PropertyResult[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  
  const debouncedText = useDebounce(text, 150);

  // Voice input
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput({
    onResult: (transcript) => {
      setText(transcript);
      inputRef.current?.focus();
    },
  });

  // Direct property search function
  const searchPropertiesDirect = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    setSearchResults([]);
    
    try {
      // Determine search type and build payload
      const isMls = /^(?:mls[#:\s]*)?\d{5,10}$/i.test(query.trim());
      const isZip = /^\d{5}$/.test(query.trim());
      const isAddress = /^\d+\s+\w/.test(query.trim());
      
      const payload: Record<string, any> = {};
      
      if (isMls) {
        payload.mlsNumber = query.replace(/[^0-9]/g, '');
        payload.query = payload.mlsNumber;
      } else if (isZip) {
        payload.zipCode = query.trim();
      } else if (isAddress) {
        payload.address = query.trim();
        payload.query = query.trim();
      } else {
        // Could be city name or general search
        payload.query = query.trim();
        payload.city = query.trim().replace(/,?\s*(ut|utah)$/i, '').trim();
      }

      const res = await api.post('/search/properties', payload);
      
      if (res.data?.results?.length > 0) {
        setSearchResults(res.data.results);
        setCachedListings(prev => {
          const newListings = [...res.data.results, ...prev];
          const seen = new Set();
          return newListings.filter((l: PropertyResult) => {
            const key = l.address?.fullAddress || l.mlsId;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 50);
        });
      } else {
        setError('No properties found. Try a different search.');
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('agentease_recent_searches');
    if (saved) {
      try { setRecentSearches(JSON.parse(saved).slice(0, 5)); } catch {}
    }
    
    // Try to load cached listings from search history
    api.get('/search/history?limit=20').then(res => {
      if (res.data?.results) {
        setCachedListings(res.data.results);
      }
    }).catch(() => {});
  }, []);

  // Fetch live suggestions from API
  const fetchLiveSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) return;
    try {
      const res = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}&limit=5`);
      const data = res.data;
      
      const liveSuggestions: Suggestion[] = [];
      
      // Add property suggestions
      data.properties?.forEach((p: any) => {
        liveSuggestions.push({
          type: 'listing',
          icon: '🏠',
          text: p.address.split(',')[0],
          subtext: `${formatPrice(p.price)} • MLS# ${p.mlsNumber}`,
          value: `MLS# ${p.mlsNumber}`,
        });
      });
      
      // Add client suggestions  
      data.clients?.forEach((c: any) => {
        liveSuggestions.push({
          type: 'client',
          icon: '👤',
          text: c.name,
          subtext: c.email || c.phone || c.clientType,
          value: `Find client ${c.name}`,
        });
      });
      
      // Add listing suggestions
      data.listings?.forEach((l: any) => {
        if (!liveSuggestions.find(s => s.value.includes(l.mlsNumber))) {
          liveSuggestions.push({
            type: 'listing',
            icon: '📋',
            text: l.address.split(',')[0],
            subtext: `${l.status} • ${formatPrice(l.price)}`,
            value: `MLS# ${l.mlsNumber}`,
          });
        }
      });
      
      return liveSuggestions;
    } catch (e) {
      console.log('Suggestions API not available, using local cache');
      return [];
    }
  }, []);

  // Generate suggestions based on input
  useEffect(() => {
    const query = debouncedText.toLowerCase().trim();
    
    if (!query) {
      // Show default suggestions
      const defaults: Suggestion[] = [
        ...recentSearches.slice(0, 3).map(s => ({
          type: 'recent' as const,
          icon: '🕐',
          text: s,
          subtext: 'Recent search',
          value: s,
        })),
        ...commandTemplates.slice(0, 5),
      ];
      setSuggestions(defaults);
      setSelectedIndex(0);
      return;
    }

    const buildSuggestions = async () => {
      const newSuggestions: Suggestion[] = [];

      // Fetch live suggestions from API
      const liveSuggestions = await fetchLiveSuggestions(query);
      if (liveSuggestions?.length) {
        newSuggestions.push(...liveSuggestions);
      }

      // Match cities (only if not already covered by API results)
      if (query.length >= 2 && newSuggestions.length < 3) {
        const matchingCities = utahCities.filter(c => 
          c.toLowerCase().includes(query)
        ).slice(0, 3);
        
        matchingCities.forEach(city => {
          if (!newSuggestions.find(s => s.text.includes(city))) {
            newSuggestions.push({
              type: 'city',
              icon: '📍',
              text: `Homes in ${city}`,
              subtext: 'Search properties',
              value: `Search homes in ${city}`,
            });
          }
        });
      }

      // Match cached listings by address (fallback)
      if (newSuggestions.length < 4) {
        const matchingListings = cachedListings.filter(l =>
          l.address.fullAddress.toLowerCase().includes(query) ||
          l.address.street.toLowerCase().includes(query) ||
          l.mlsId?.includes(query)
        ).slice(0, 3);

        matchingListings.forEach(listing => {
          if (!newSuggestions.find(s => s.value.includes(listing.mlsId || ''))) {
            newSuggestions.push({
              type: 'listing',
              icon: '🏠',
              text: listing.address.street,
              subtext: `${formatPrice(listing.price)} • ${listing.address.city}`,
              value: listing.mlsId ? `MLS# ${listing.mlsId}` : listing.address.fullAddress,
            });
          }
        });
      }

      // Match command templates
      const matchingCommands = commandTemplates.filter(c =>
        c.text.toLowerCase().includes(query) || 
        c.value.toLowerCase().includes(query)
      ).slice(0, 3);
      newSuggestions.push(...matchingCommands);

      // If typing a number, suggest MLS lookup (prioritize this)
      if (/^\\d+$/.test(query) && query.length >= 4) {
        // Remove any existing MLS suggestions to avoid duplicates
        const filtered = newSuggestions.filter(s => !s.value.includes(`MLS# ${query}`));
        filtered.unshift({
          type: 'command',
          icon: '🔍',
          text: `Look up MLS# ${query}`,
          subtext: 'Search Utah Real Estate',
          value: `MLS# ${query}`,
        });
        setSuggestions(filtered.slice(0, 6));
        setSelectedIndex(0);
        return;
      }

      // If typing an address pattern (starts with number followed by text)
      if (/^\\d+\\s+\\w/.test(text)) {
        newSuggestions.unshift({
          type: 'address',
          icon: '📍',
          text: `Search "${text}"`,
          subtext: 'Find this address',
          value: `Search ${text}`,
        });
      }

      // If typing a zip code
      if (/^\\d{5}$/.test(query)) {
        newSuggestions.unshift({
          type: 'city',
          icon: '📮',
          text: `Homes in ${query}`,
          subtext: 'Search by ZIP code',
          value: `Search homes in ${query}`,
        });
      }

      setSuggestions(newSuggestions.slice(0, 6));
      setSelectedIndex(0);
    };

    buildSuggestions();
  }, [debouncedText, recentSearches, cachedListings, text, fetchLiveSuggestions]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === 'Escape') {
        if (resp) {
          setResp(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resp]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const saveRecentSearch = useCallback((searchText: string) => {
    setRecentSearches(prev => {
      const updated = [searchText, ...prev.filter(s => s !== searchText)].slice(0, 5);
      localStorage.setItem('agentease_recent_searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const run = useCallback(async (searchText?: string) => {
    const query = searchText || text;
    if (!query.trim()) return;
    
    saveRecentSearch(query);
    
    // Detect if this is a property search
    const trimmedQuery = query.trim().toLowerCase();
    const isMlsSearch = /^(?:mls[#:\s]*)?\d{5,10}$/i.test(query.trim());
    const isAddressSearch = /^\d+\s+\w/.test(query.trim());
    const isZipSearch = /^\d{5}$/.test(query.trim());
    const isCitySearch = trimmedQuery.startsWith('search homes in') || 
                         trimmedQuery.startsWith('homes in') ||
                         /^(salt lake|park city|provo|orem|ogden|sandy|draper|lehi|herriman)/i.test(trimmedQuery);
    
    // If it's a property search, use direct search
    if (isMlsSearch || isAddressSearch || isZipSearch || isCitySearch) {
      const searchQuery = isCitySearch 
        ? query.replace(/^(search homes in|homes in)\s*/i, '').trim()
        : query;
      await searchPropertiesDirect(searchQuery);
      return;
    }
    
    // Otherwise use AI command processing
    setLoading(true);
    setError(null);
    setResp(null);
    setSearchResults([]);
    
    try {
      const res = await api.post('/ai/command', { text: query });
      setResp(res.data);
      
      // Cache any property results
      if (res.data?.data?.properties?.length) {
        setCachedListings(prev => {
          const newListings = [...res.data.data.properties, ...prev];
          // Dedupe by address
          const seen = new Set();
          return newListings.filter((l: PropertyResult) => {
            const key = l.address?.fullAddress;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 50);
        });
      }
      
      // Handle navigation actions
      const navAction = res.data.actions?.find((a: CommandAction) => a.type === 'NAVIGATE');
      if (navAction?.parameters?.route) {
        setTimeout(() => {
          navigate(navAction.parameters.route);
          setOpen(false);
        }, 1500);
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.message || 'Failed to run command';
      setError(errMsg);
      console.error('Command error:', e);
    } finally {
      setLoading(false);
    }
  }, [text, navigate, saveRecentSearch, searchPropertiesDirect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (suggestions.length > 0 && !resp) {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          setText(selected.value);
          run(selected.value);
        } else {
          run();
        }
      } else {
        run();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      if (selected) {
        setText(selected.value);
      }
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    setText(suggestion.value);
    run(suggestion.value);
  };

  if (aiLevel === 'OFF') return null;

  return (
    <div ref={containerRef} className="relative z-[120] animate-slide-up">
      {/* Main command bar */}
      <div className="relative group">
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 ${compact ? 'rounded-xl' : 'rounded-2xl'} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300`} />
        <div
          className={`relative flex items-center gap-3 shadow-lg border border-white/10 group-hover:border-blue-500/50 transition-all backdrop-blur-xl ae-surface ${
            compact ? 'rounded-xl px-3 py-2' : 'rounded-2xl px-4 py-3'
          }`}
        >
          {/* AI Icon */}
          <div className={`flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/30 ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}>
            {loading ? (
              <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white animate-spin`} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            )}
          </div>
          
          {/* Input */}
          <input
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder="Search properties, create tasks, find clients..."
            className={`flex-1 bg-transparent outline-none font-medium placeholder:text-slate-400 ${compact ? 'text-[13px]' : 'text-sm'} ae-text`}
            autoComplete="off"
          />
          
          {/* Clear button */}
          {text && (
            <button
              onClick={() => { setText(''); setResp(null); setError(null); inputRef.current?.focus(); }}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <svg className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Voice input button */}
          {voiceSupported && (
            <button
              onClick={toggleListening}
              title={isListening ? 'Stop listening' : 'Voice input'}
              className={`p-1 transition-colors ${isListening ? 'text-red-400 animate-pulse' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          
          {/* Keyboard hint */}
          <kbd className={`hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg text-slate-400 font-mono ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}>
            <span className="text-[10px]">⌘</span>K
          </kbd>
          
          {/* Run button */}
          <button 
            onClick={() => run()}
            disabled={loading || !text.trim()}
            className={`flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-900/30 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
              compact ? 'px-3 py-1.5 rounded-lg text-xs' : 'px-4 py-2 rounded-xl text-sm'
            }`}
          >
            <svg className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className={compact ? 'hidden sm:inline' : ''}>Run</span>
          </button>
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[130] animate-scale-in">
          <div className="rounded-2xl shadow-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl overflow-hidden max-h-[70vh] overflow-y-auto">
            
            {/* Dropdown Header with Close Button */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
              <span className="text-xs font-medium text-slate-400">Quick Search & Commands</span>
              <button
                onClick={() => { setOpen(false); setSearchResults([]); setResp(null); }}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Close (Esc)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-500/10 border-b border-red-500/20">
                <div className="flex items-center gap-2 text-sm text-red-300">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                  <button 
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Direct Property Search Results */}
            {searchResults.length > 0 && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {searchResults.length} Properties Found
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { navigate('/search'); setOpen(false); }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View all →
                    </button>
                    <button
                      onClick={() => { setSearchResults([]); setText(''); inputRef.current?.focus(); }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {searchResults.slice(0, 5).map((prop, i) => (
                    (() => {
                      const fullAddress = prop.address?.fullAddress || prop.address?.street || '';
                      const notListed = !prop.mlsId && (!Number.isFinite(prop.price) || prop.price <= 0);

                      const content = (
                        <>
                          <div className="w-16 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                            {prop.photos?.[0] ? (
                              <img src={prop.photos[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">
                                {formatPrice(prop.price)}
                              </span>
                              {prop.mlsId && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                                  MLS# {prop.mlsId}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{fullAddress}</p>
                            <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                              {prop.beds && <span>{prop.beds} bd</span>}
                              {prop.baths && <span>{prop.baths} ba</span>}
                              {prop.sqft && <span>{prop.sqft.toLocaleString()} sqft</span>}
                            </div>
                            {notListed && fullAddress && (
                              <div className="flex gap-3 mt-2 text-xs">
                                <a
                                  href={buildMapUrl(fullAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpen(false);
                                  }}
                                >
                                  Map
                                </a>
                                <a
                                  href={buildAssessorUrl(fullAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpen(false);
                                  }}
                                >
                                  County assessor
                                </a>
                              </div>
                            )}
                          </div>
                        </>
                      );

                      if (notListed) {
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all"
                          >
                            {content}
                          </div>
                        );
                      }

                      return (
                        <a
                          key={i}
                          href={prop.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all group"
                        >
                          {content}
                          <svg className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      );
                    })()
                  ))}
                </div>
                {searchResults.length > 5 && (
                  <button
                    onClick={() => { navigate('/search'); setOpen(false); }}
                    className="w-full py-2 text-center text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-colors"
                  >
                    View all {searchResults.length} results →
                  </button>
                )}
              </div>
            )}

            {/* Response section */}
            {resp && (
              <div className="p-4 space-y-4">
                {/* Intent badge */}
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    resp.confidence > 0.8 ? 'bg-emerald-500/20 text-emerald-300' :
                    resp.confidence > 0.5 ? 'bg-amber-500/20 text-amber-300' :
                    'bg-slate-500/20 text-slate-300'
                  }`}>
                    {resp.intent.replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Messages */}
                {resp.messages.length > 0 && (
                  <div className="space-y-2">
                    {resp.messages.map((m, i) => (
                      <p key={i} className="text-sm text-slate-200" dangerouslySetInnerHTML={{ 
                        __html: m.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                      }} />
                    ))}
                  </div>
                )}

                {/* Property search results */}
                {resp.data?.properties && resp.data.properties.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">
                        {resp.data.properties.length} Properties Found
                      </h4>
                      <button
                        onClick={() => { navigate('/search'); setOpen(false); }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid gap-2">
                      {resp.data.properties.slice(0, 4).map((prop, i) => (
                        (() => {
                          const fullAddress = prop.address?.fullAddress || prop.address?.street || '';
                          const notListed = !prop.mlsId && (!Number.isFinite(prop.price) || prop.price <= 0);

                          const content = (
                            <>
                              <div className="w-16 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                                {prop.photos?.[0] ? (
                                  <img src={prop.photos[0]} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white truncate">
                                    {formatPrice(prop.price)}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sourceColors[prop.source] || 'bg-slate-500/20 text-slate-300'}`}>
                                    {prop.source === 'utahrealestate' ? 'MLS' : prop.source}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 truncate">{fullAddress}</p>
                                <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                                  {prop.beds && <span>{prop.beds} bd</span>}
                                  {prop.baths && <span>{prop.baths} ba</span>}
                                  {prop.sqft && <span>{prop.sqft.toLocaleString()} sqft</span>}
                                </div>
                                {notListed && fullAddress && (
                                  <div className="flex gap-3 mt-2 text-xs">
                                    <a
                                      href={buildMapUrl(fullAddress)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Map
                                    </a>
                                    <a
                                      href={buildAssessorUrl(fullAddress)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      County assessor
                                    </a>
                                  </div>
                                )}
                              </div>
                            </>
                          );

                          if (notListed) {
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all"
                              >
                                {content}
                              </div>
                            );
                          }

                          return (
                            <a
                              key={i}
                              href={prop.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all group"
                            >
                              {content}
                              <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          );
                        })()
                      ))}
                    </div>
                  </div>
                )}

                {/* Client results */}
                {resp.data?.clients && resp.data.clients.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-white">Clients Found</h4>
                    {resp.data.clients.map((client: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => { navigate(`/clients/${client.id}`); setOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                          {client.firstName?.[0]}{client.lastName?.[0]}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{client.firstName} {client.lastName}</p>
                          <p className="text-xs text-slate-400">{client.email || 'No email'}</p>
                        </div>
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">{client.stage}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => { setResp(null); setText(''); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    New search
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Suggestions (when no response and no search results) */}
            {!resp && !loading && searchResults.length === 0 && suggestions.length > 0 && (
              <div className="py-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      selectSuggestion(suggestion);
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIndex 
                        ? 'bg-blue-500/20 text-white' 
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-lg w-6 text-center">{suggestion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{suggestion.text}</p>
                      {suggestion.subtext && (
                        <p className="text-xs text-slate-500 truncate">{suggestion.subtext}</p>
                      )}
                    </div>
                    {i === selectedIndex && (
                      <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-slate-400">↵</kbd>
                    )}
                  </button>
                ))}
                
                {/* Keyboard hints */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-[10px] text-slate-500">
                  <div className="flex gap-3">
                    <span><kbd className="px-1 bg-white/5 rounded">↑↓</kbd> Navigate</span>
                    <span><kbd className="px-1 bg-white/5 rounded">Tab</kbd> Complete</span>
                    <span><kbd className="px-1 bg-white/5 rounded">↵</kbd> Run</span>
                  </div>
                  <span><kbd className="px-1 bg-white/5 rounded">Esc</kbd> Close</span>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
                <p className="text-sm text-slate-400">Searching...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/30 -z-10"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
