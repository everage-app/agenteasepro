import api from './api';
import {
  Lead,
  LeadAnalytics,
  LandingPage,
  LandingPageAnalytics,
  PageView,
} from '../types/leads';

export const leadsApi = {
  // Leads
  getLeads: (filters?: {
    listingId?: string;
    priority?: string;
    source?: string;
    converted?: boolean;
    search?: string;
    archived?: 'true' | 'false' | 'all';
  }) => api.get<Lead[]>('/leads', { params: filters }),

  getLead: (id: string) =>
    api.get<Lead & {
      pageViews: PageView[];
      activities: any[];
      forms?: Array<{
        id: string;
        kind: 'ESIGN_ENVELOPE' | 'FORM_INSTANCE';
        title: string;
        status: string;
        sentAt: string | null;
        signedAt: string | null;
        updatedAt: string;
        dealId: string;
        dealTitle: string;
        propertyAddress: string | null;
        formCode: string | null;
        signerSummary?: {
          total: number;
          signed: number;
          viewed: number;
        };
        downloadUrl?: string | null;
      }>;
    }>(`/leads/${id}`),

  createLead: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    listingId?: string;
    landingPageId?: string;
    source?: string;
    priority?: string;
    notes?: string;
    visitorId?: string;
    utmData?: Record<string, any>;
  }) => api.post<Lead>('/leads', data),

  updateLead: (
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string | null;
      source?: string;
      priority?: string;
      assignedTo?: string;
      nextTask?: string;
      notes?: string;
      tags?: string[];
      converted?: boolean;
    }
  ) => api.patch<Lead>(`/leads/${id}`, data),

  archiveLead: (id: string) => api.post<Lead>(`/leads/${id}/archive`),
  unarchiveLead: (id: string) => api.post<Lead>(`/leads/${id}/unarchive`),

  convertLead: (id: string) =>
    api.post<{ lead: Lead; client: { id: string; firstName: string; lastName: string } }>(`/leads/${id}/convert`),

  bulkImport: (payload: {
    records: Array<{
      firstName?: string;
      lastName?: string;
      name?: string;
      email: string;
      phone?: string;
      source?: string;
      priority?: string;
      notes?: string;
      tags?: string[];
    }>;
    skipDuplicates?: boolean;
    defaults?: { source?: string; priority?: string };
  }) =>
    api.post<{ created: number; updated: number; skipped: number; errors: string[] }>(
      '/leads/bulk-import',
      payload,
    ),

  createActivity: (id: string, data: { type: 'NOTE' | 'CALL' | 'EMAIL' | 'SMS' | 'CUSTOM'; description: string }) =>
    api.post(`/leads/${id}/activities`, data),

  deleteLead: (id: string) => api.delete(`/leads/${id}`),

  mergeLead: (sourceId: string, targetId: string) =>
    api.post('/leads/merge', { sourceId, targetId }),

  getAnalytics: (filters?: {
    startDate?: string;
    endDate?: string;
    listingId?: string;
    archived?: 'true' | 'false' | 'all';
  }) => api.get<LeadAnalytics>('/leads/analytics/summary', { params: filters }),

  trackView: (data: {
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
    duration?: number;
    location?: {
      country?: string;
      city?: string;
      region?: string;
      device?: string;
      browser?: string;
    };
  }) => api.post<PageView>('/leads/track/view', data),

  // Landing Pages
  getLandingPages: () => api.get<LandingPage[]>('/landing-pages'),

  getLandingPage: (idOrSlug: string) => api.get<LandingPage>(`/landing-pages/${idOrSlug}`),

  createLandingPage: (data: {
    listingId?: string;
    slug: string;
    customDomain?: string;
    title: string;
    description?: string;
    heroImage?: string;
  }) => api.post<LandingPage>('/landing-pages', data),

  updateLandingPage: (
    id: string,
    data: {
      slug?: string;
      customDomain?: string;
      title?: string;
      description?: string;
      heroImage?: string;
      isActive?: boolean;
    }
  ) => api.patch<LandingPage>(`/landing-pages/${id}`, data),

  deleteLandingPage: (id: string) => api.delete(`/landing-pages/${id}`),

  getLandingPageAnalytics: (id: string, days = 30) =>
    api.get<LandingPageAnalytics>(`/landing-pages/${id}/analytics`, {
      params: { days },
    }),
};
