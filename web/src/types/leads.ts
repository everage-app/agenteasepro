export interface Lead {
  id: string;
  agentId: string;
  clientId?: string;
  listingId?: string;
  landingPageId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source: LeadSource;
  priority: LeadPriority;
  averagePrice?: number;
  homesViewed: number;
  lastVisit?: string;
  visitCount: number;
  lastContact?: string;
  nextTask?: string;
  assignedTo?: string;
  notes?: string;
  tags: string[];
  converted: boolean;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    price: number;
  };
  landingPage?: {
    id: string;
    slug: string;
    title: string;
  };
  client?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export enum LeadSource {
  WEBSITE = 'WEBSITE',
  LANDING_PAGE = 'LANDING_PAGE',
  ZILLOW = 'ZILLOW',
  REALTOR_COM = 'REALTOR_COM',
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM',
  GOOGLE_ADS = 'GOOGLE_ADS',
  EMAIL = 'EMAIL',
  DIRECT = 'DIRECT',
  REFERRAL = 'REFERRAL',
  OTHER = 'OTHER',
}

export enum LeadPriority {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
  DEAD = 'DEAD',
}

export interface LandingPage {
  id: string;
  agentId: string;
  listingId?: string;
  slug: string;
  customDomain?: string;
  title: string;
  description?: string;
  heroImage?: string;
  isActive: boolean;
  totalViews: number;
  uniqueViews: number;
  leadsGenerated: number;
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    price: number;
  };
}

export interface PageView {
  id: string;
  landingPageId?: string;
  listingId?: string;
  visitorId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  country?: string;
  city?: string;
  region?: string;
  device?: string;
  browser?: string;
  duration?: number;
  createdAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  listingId?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface LeadAnalytics {
  summary: {
    totalLeads: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    convertedLeads: number;
    conversionRate: number;
  };
  sourceBreakdown: Array<{
    source: LeadSource;
    _count: number;
  }>;
  recentLeads: Lead[];
}

export interface LandingPageAnalytics {
  summary: {
    pageViews: number;
    uniqueVisitors: number;
    leads: number;
    conversionRate: number;
  };
  viewsByDay: Array<{
    date: string;
    views: number;
  }>;
  topSources: Array<{
    utmSource: string;
    _count: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    _count: number;
  }>;
  locationData: Array<{
    city: string;
    region: string;
    country: string;
    _count: number;
  }>;
}
