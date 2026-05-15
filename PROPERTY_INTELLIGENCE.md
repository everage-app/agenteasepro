# Property Intelligence Feature

## Overview

The Property Intelligence feature provides enriched property data to help agents impress clients while they wait for IDX integration. It aggregates **legally available public data** without any scraping.

## What It Does

When a user enters search criteria (address, city, ZIP, etc.), they can click "Show Property Intelligence" to see:

### 1. Overview Tab
- **Map Preview**: Static OpenStreetMap tile showing the approximate location
- **Neighborhood Stats**: Placeholder for Census Bureau data (median income, population, housing)
- **Walk Score**: Placeholder for walkability scores

### 2. Portals Tab
- Deep links to all major real estate portals:
  - UtahRealEstate.com (MLS)
  - Zillow
  - Realtor.com
  - Homes.com
  - Redfin
- Google Maps satellite view link

### 3. Records Tab
- **County Assessor Link**: Direct link to the appropriate Utah county assessor website
- **Utah State Resources**: GIS maps, property gateway, county records lookup
- **What You Can Find**: Tax values, ownership history, parcel maps, building permits

## Files Created

| File | Purpose |
|------|---------|
| `web/src/lib/propertyIntel.ts` | Utility functions for public data aggregation |
| `web/src/components/PropertyIntelPanel.tsx` | React component with 3-tab interface |
| `web/.env.example` | Documentation for optional API keys |

## Data Sources (All Legal & Public)

1. **OpenStreetMap Static Tiles** - Free, no API key needed
2. **Census Bureau API** - Free with API key
3. **Walk Score API** - Free tier (5,000 requests/day)
4. **Utah County Assessor Websites** - Public government data
5. **Utah State GIS** - Public government maps

## Utah Counties Mapped

The system automatically maps cities to their county assessors:

- Salt Lake County (SLC, Murray, Sandy, etc.)
- Utah County (Provo, Orem, Lehi, etc.)
- Davis County (Bountiful, Layton, etc.)
- Weber County (Ogden, Roy, etc.)
- Washington County (St. George, etc.)
- Cache County (Logan, etc.)
- Summit County (Park City, etc.)
- Iron County (Cedar City, etc.)
- Box Elder County (Brigham City, etc.)
- Tooele County

## Optional API Keys

Add these to `web/.env` for enhanced features:

```env
# Census Bureau (free)
VITE_CENSUS_API_KEY=your_key_here

# Walk Score (free tier)
VITE_WALK_SCORE_API_KEY=your_key_here
```

## Why NOT Scraping?

1. **Terms of Service Violations** - Sites like Zillow, Realtor.com explicitly prohibit scraping
2. **Legal Risk** - Can result in lawsuits and cease & desist letters
3. **IP Blocking** - Your server will get blocked
4. **Unreliable** - Site changes break scrapers constantly
5. **Ethical Concerns** - These sites have costs to maintain their data

## The Better Path: IDX Integration

Once you set up IDX (Internet Data Exchange), you'll have:
- Licensed MLS data feed
- Real-time listing updates
- Legal and reliable data
- Full property details

Until then, this Property Intelligence feature provides impressive value using only public, legal data sources!

## Usage

1. Go to `/search` in the app
2. Enter an address, city, or ZIP
3. Click "Show Property Intelligence"
4. Explore the tabs for maps, portals, and public records
