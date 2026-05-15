/**
 * Utah Geographic Data
 * Comprehensive list of all Utah counties and cities for real estate applications.
 * This module provides authoritative data for address validation and auto-complete.
 */

// All 29 Utah Counties (alphabetical order)
export const UTAH_COUNTIES = [
  'Beaver', 'Box Elder', 'Cache', 'Carbon', 'Daggett', 'Davis', 'Duchesne', 'Emery',
  'Garfield', 'Grand', 'Iron', 'Juab', 'Kane', 'Millard', 'Morgan', 'Piute', 'Rich',
  'Salt Lake', 'San Juan', 'Sanpete', 'Sevier', 'Summit', 'Tooele', 'Uintah',
  'Utah', 'Wasatch', 'Washington', 'Wayne', 'Weber'
] as const;

// Utah Cities by County - comprehensive list including incorporated cities, towns, and common areas
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
    'St. George', 'St George', 'Washington', 'Hurricane', 'Ivins', 'Santa Clara', 'LaVerkin',
    'Leeds', 'Springdale', 'Virgin', 'Rockville', 'Hildale', 'Enterprise',
    'New Harmony', 'Pine Valley', 'Toquerville', 'Apple Valley'
  ],
  'Iron': [
    'Cedar City', 'Enoch', 'Parowan', 'Brian Head', 'Paragonah', 'Kanarraville'
  ],
  'Summit': [
    'Park City', 'Coalville', 'Kamas', 'Francis', 'Oakley', 'Henefer', 'Marion', 'Samak',
    'Snyderville', 'Jeremy Ranch', 'Summit Park', 'Pinebrook', 'Silver Summit'
  ],
  'Tooele': [
    'Tooele', 'Grantsville', 'Stansbury Park', 'Erda', 'Lake Point', 'Stockton', 'Wendover'
  ],
  'Box Elder': [
    'Brigham City', 'Tremonton', 'Garland', 'Perry', 'Willard', 'Bear River City',
    'Honeyville', 'Mantua', 'Corinne', 'Deweyville', 'Elwood', 'Fielding'
  ],
  'Wasatch': [
    'Heber City', 'Midway', 'Charleston', 'Daniel', 'Wallsburg', 'Hideout',
    'Deer Mountain', 'Jordanelle', 'Timber Lakes'
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

// Get all cities as a flat sorted array
export const ALL_UTAH_CITIES = Object.values(UTAH_CITIES).flat().sort();

// Create a lowercase city-to-county mapping for quick lookups
export const CITY_TO_COUNTY: Record<string, string> = {};
Object.entries(UTAH_CITIES).forEach(([county, cities]) => {
  cities.forEach(city => {
    CITY_TO_COUNTY[city.toLowerCase()] = county;
  });
});

// Common city aliases and abbreviations
export const CITY_ALIASES: Record<string, string> = {
  'slc': 'Salt Lake City',
  'sl': 'Salt Lake City',
  'wvc': 'West Valley City',
  'wj': 'West Jordan',
  'sj': 'South Jordan',
  'st george': 'St. George',
  'st. george': 'St. George',
  'saint george': 'St. George',
  'sugarhouse': 'Sugar House',
  'the avenues': 'The Avenues',
  'avenues': 'The Avenues',
  'pc': 'Park City',
  'af': 'American Fork',
  'pg': 'Pleasant Grove',
  'sf': 'Spanish Fork',
};

/**
 * Find a city from text input, handling aliases and partial matches
 */
export function findCityFromText(text: string): { city: string; county: string } | null {
  const lowerText = text.toLowerCase().trim();
  
  // Check aliases first
  if (CITY_ALIASES[lowerText]) {
    const city = CITY_ALIASES[lowerText];
    return { city, county: CITY_TO_COUNTY[city.toLowerCase()] || '' };
  }
  
  // Check for exact match (case-insensitive)
  const exactMatch = ALL_UTAH_CITIES.find(c => c.toLowerCase() === lowerText);
  if (exactMatch) {
    return { city: exactMatch, county: CITY_TO_COUNTY[exactMatch.toLowerCase()] || '' };
  }
  
  // Check for partial match within the text
  for (const city of ALL_UTAH_CITIES) {
    if (lowerText.includes(city.toLowerCase())) {
      return { city, county: CITY_TO_COUNTY[city.toLowerCase()] || '' };
    }
  }
  
  return null;
}

/**
 * Get county for a city (case-insensitive)
 */
export function getCountyForCity(city: string): string | null {
  return CITY_TO_COUNTY[city.toLowerCase()] || null;
}

/**
 * Validate if a string is a valid Utah city
 */
export function isValidUtahCity(city: string): boolean {
  return ALL_UTAH_CITIES.some(c => c.toLowerCase() === city.toLowerCase());
}

/**
 * Validate if a string is a valid Utah county
 */
export function isValidUtahCounty(county: string): boolean {
  return UTAH_COUNTIES.some(c => c.toLowerCase() === county.toLowerCase());
}
