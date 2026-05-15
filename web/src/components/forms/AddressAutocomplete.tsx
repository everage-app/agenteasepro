import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../lib/api';

// Utah Counties
export const UTAH_COUNTIES = [
  'Beaver', 'Box Elder', 'Cache', 'Carbon', 'Daggett', 'Davis', 'Duchesne', 'Emery',
  'Garfield', 'Grand', 'Iron', 'Juab', 'Kane', 'Millard', 'Morgan', 'Piute', 'Rich',
  'Salt Lake', 'San Juan', 'Sanpete', 'Sevier', 'Summit', 'Tooele', 'Uintah',
  'Utah', 'Wasatch', 'Washington', 'Wayne', 'Weber'
];

// Utah Cities by County (comprehensive list - includes all incorporated cities, towns, and common areas)
export const UTAH_CITIES: Record<string, string[]> = {
  'Salt Lake': [
    'Salt Lake City', 'West Valley City', 'West Jordan', 'Sandy', 'South Jordan',
    'Murray', 'Taylorsville', 'Midvale', 'Cottonwood Heights', 'Holladay',
    'Millcreek', 'Draper', 'Riverton', 'Herriman', 'South Salt Lake', 'Magna',
    'Kearns', 'Bluffdale', 'Alta', 'Brighton', 'Copperton', 'Emigration Canyon',
    'White City', 'Sugar House', 'Daybreak', 'The Avenues', 'Capitol Hill',
    'Rose Park', 'Glendale', 'Liberty Park', 'Federal Heights', 'University',
    'East Millcreek', 'Canyon Rim', 'Olympus Cove', 'Mount Olympus', 'Little Cottonwood',
    'Big Cottonwood', 'Brighton Estates', 'Granite', 'Hunter'
  ],
  'Utah': [
    'Provo', 'Orem', 'Lehi', 'Pleasant Grove', 'Spanish Fork', 'Springville',
    'American Fork', 'Eagle Mountain', 'Saratoga Springs', 'Payson', 'Lindon',
    'Highland', 'Cedar Hills', 'Mapleton', 'Santaquin', 'Salem', 'Alpine',
    'Vineyard', 'Elk Ridge', 'Woodland Hills', 'Goshen', 'Genola', 'Elberta',
    'Benjamin', 'Lake Shore', 'Palmyra', 'West Mountain', 'Lake Mountain',
    'Cedar Fort', 'Fairfield', 'Eagle Mountain Ranch', 'Thanksgiving Point'
  ],
  'Davis': [
    'Layton', 'Bountiful', 'Clearfield', 'Kaysville', 'Syracuse', 'Farmington',
    'Clinton', 'North Salt Lake', 'Woods Cross', 'Centerville', 'West Point',
    'Sunset', 'South Weber', 'Fruit Heights', 'West Bountiful'
  ],
  'Weber': [
    'Ogden', 'Roy', 'South Ogden', 'Washington Terrace', 'Riverdale', 'Pleasant View',
    'North Ogden', 'Harrisville', 'Farr West', 'Plain City', 'West Haven',
    'Huntsville', 'Eden', 'Hooper', 'Marriott-Slaterville', 'Uintah'
  ],
  'Cache': [
    'Logan', 'North Logan', 'Smithfield', 'Hyrum', 'Providence', 'Hyde Park',
    'Nibley', 'River Heights', 'Millville', 'Wellsville', 'Richmond', 'Lewiston',
    'Mendon', 'Paradise', 'Trenton', 'Cornish', 'Newton', 'Clarkston'
  ],
  'Washington': [
    'St. George', 'Washington', 'Hurricane', 'Ivins', 'Santa Clara', 'LaVerkin',
    'Leeds', 'Springdale', 'Virgin', 'Rockville', 'Hildale', 'Enterprise',
    'New Harmony', 'Pine Valley', 'Toquerville', 'Apple Valley'
  ],
  'Iron': [
    'Cedar City', 'Enoch', 'Parowan', 'Brian Head', 'Paragonah', 'Kanarraville'
  ],
  'Summit': [
    'Park City', 'Coalville', 'Kamas', 'Francis', 'Oakley', 'Henefer', 'Marion', 'Samak'
  ],
  'Tooele': [
    'Tooele', 'Grantsville', 'Stansbury Park', 'Erda', 'Lake Point', 'Stockton', 'Wendover'
  ],
  'Box Elder': [
    'Brigham City', 'Tremonton', 'Garland', 'Perry', 'Willard', 'Bear River City',
    'Honeyville', 'Mantua', 'Corinne', 'Deweyville', 'Elwood', 'Fielding'
  ],
  'Wasatch': [
    'Heber City', 'Midway', 'Charleston', 'Daniel', 'Wallsburg', 'Hideout'
  ],
  'Sanpete': [
    'Ephraim', 'Manti', 'Mount Pleasant', 'Moroni', 'Gunnison', 'Fairview',
    'Spring City', 'Fountain Green', 'Mayfield', 'Sterling', 'Wales', 'Fayette'
  ],
  'Sevier': [
    'Richfield', 'Salina', 'Monroe', 'Redmond', 'Aurora', 'Sigurd', 'Elsinore',
    'Annabella', 'Central Valley', 'Joseph', 'Koosharem'
  ],
  'Carbon': [
    'Price', 'Helper', 'Wellington', 'East Carbon', 'Sunnyside', 'Spring Glen'
  ],
  'Emery': [
    'Castle Dale', 'Huntington', 'Ferron', 'Orangeville', 'Cleveland', 'Elmo', 'Green River'
  ],
  'Grand': [
    'Moab', 'Castle Valley'
  ],
  'Uintah': [
    'Vernal', 'Naples', 'Ballard', 'Jensen', 'Maeser', 'Lapoint', 'Fort Duchesne'
  ],
  'Duchesne': [
    'Roosevelt', 'Duchesne', 'Myton', 'Tabiona', 'Altamont', 'Neola'
  ],
  'Juab': [
    'Nephi', 'Levan', 'Mona', 'Mills', 'Eureka'
  ],
  'Millard': [
    'Delta', 'Fillmore', 'Hinckley', 'Holden', 'Kanosh', 'Meadow', 'Oak City', 'Scipio'
  ],
  'Beaver': [
    'Beaver', 'Milford', 'Minersville'
  ],
  'Garfield': [
    'Panguitch', 'Boulder', 'Escalante', 'Tropic', 'Cannonville', 'Henrieville'
  ],
  'Kane': [
    'Kanab', 'Orderville', 'Big Water', 'Glendale', 'Alton'
  ],
  'Morgan': [
    'Morgan', 'Mountain Green', 'Peterson', 'Porterville'
  ],
  'Rich': [
    'Garden City', 'Randolph', 'Laketown', 'Woodruff'
  ],
  'San Juan': [
    'Blanding', 'Monticello', 'Bluff', 'Mexican Hat', 'Monument Valley', 'La Sal'
  ],
  'Daggett': [
    'Manila', 'Dutch John'
  ],
  'Piute': [
    'Junction', 'Circleville', 'Marysvale', 'Kingston'
  ],
  'Wayne': [
    'Bicknell', 'Loa', 'Lyman', 'Torrey', 'Hanksville', 'Teasdale', 'Fremont'
  ]
};

// Get all cities as flat array
export const ALL_UTAH_CITIES = Object.values(UTAH_CITIES).flat().sort();

// City to County mapping
export const CITY_TO_COUNTY: Record<string, string> = {};
Object.entries(UTAH_CITIES).forEach(([county, cities]) => {
  cities.forEach(city => {
    CITY_TO_COUNTY[city.toLowerCase()] = county;
  });
});

interface AddressSuggestion {
  street: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  fullAddress: string;
}

interface ComboBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

// Reusable ComboBox with search/filter
export function ComboBox({ label, value, onChange, options, placeholder, className }: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch(value); // Reset to selected value
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setSearch(opt);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full rounded-xl bg-white border border-slate-200 px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            if (!e.target.value) onChange('');
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 transition dark:text-slate-400 dark:hover:text-white"
        >
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto dark:bg-slate-900 dark:border-white/10">
          {filteredOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt === value
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
}

// Address autocomplete with Google Places-like suggestions
export function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder, className }: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Try to get suggestions from our property search API
      const res = await api.get('/search/suggestions', {
        params: { q: query, limit: 5 }
      });

      const candidates = [
        ...(res.data?.properties || []),
        ...(res.data?.listings || []),
      ];

      const parseAddress = (label: string) => {
        const match = label.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
        if (match) {
          return {
            street: match[1]?.trim(),
            city: match[2]?.trim(),
            state: match[3]?.trim(),
            zip: match[4]?.trim() || '',
          };
        }
        return { street: label, city: '', state: 'UT', zip: '' };
      };

      if (candidates.length > 0) {
        setSuggestions(candidates.slice(0, 5).map((s: any) => {
          const label = s.address || s.label || '';
          const parsed = parseAddress(label || query);
          return {
            street: parsed.street || query,
            city: parsed.city || '',
            county: CITY_TO_COUNTY[(parsed.city || '').toLowerCase()] || '',
            state: parsed.state || 'UT',
            zip: parsed.zip || '',
            fullAddress: label || `${parsed.street || query}, ${parsed.city || ''}, ${parsed.state || 'UT'} ${parsed.zip || ''}`,
          };
        }));
      } else {
        // Fallback: generate suggestions from city data
        const matchingCities = ALL_UTAH_CITIES.filter(c => 
          c.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);
        
        setSuggestions(matchingCities.map(city => {
          const county = CITY_TO_COUNTY[city.toLowerCase()] || '';
          return {
            street: query,
            city,
            county,
            state: 'UT',
            zip: '',
            fullAddress: `${query}, ${city}, UT`
          };
        }));
      }
    } catch (err) {
      // Fallback to local suggestions on error
      const matchingCities = ALL_UTAH_CITIES.filter(c => 
        query.toLowerCase().includes(c.toLowerCase()) ||
        c.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3);
      
      setSuggestions(matchingCities.map(city => {
        const county = CITY_TO_COUNTY[city.toLowerCase()] || '';
        return {
          street: query,
          city,
          county,
          state: 'UT',
          zip: '',
          fullAddress: `${query}, ${city}, UT`
        };
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);

    // Debounce API calls
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.street);
    if (onAddressSelect) {
      onAddressSelect(suggestion);
    }
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        Street Address
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-xl bg-white border border-slate-200 px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all placeholder:text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 3 && setIsOpen(true)}
          placeholder={placeholder || "Start typing an address..."}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden dark:bg-slate-900 dark:border-white/10">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-white/10">
            <span className="text-xs text-slate-500">Suggestions</span>
          </div>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-0 dark:hover:bg-white/5 dark:border-white/5"
            >
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <div className="text-sm text-slate-900 dark:text-white font-medium">{suggestion.street}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {suggestion.city}{suggestion.county ? `, ${suggestion.county} County` : ''}, UT {suggestion.zip}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
