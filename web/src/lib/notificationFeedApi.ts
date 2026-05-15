import api from './api';

export interface LeadAlertItem {
  id: string;
  at: string;
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  sourceLabel: string | null;
  landingPageId: string | null;
  listingId: string | null;
  message: string | null;
}

const LAST_SEEN_LEAD_ALERT_KEY = 'ae:lead-alerts:last-seen-at';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const notificationFeedApi = {
  recentLeadCaptures: (params?: { limit?: number }) =>
    api.get<{ items: LeadAlertItem[] }>('/settings/notifications/feed', { params }),

  getLastSeenLeadCaptureAt: () => {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(LAST_SEEN_LEAD_ALERT_KEY);
  },

  markLeadCapturesSeen: (seenAt?: string | null) => {
    if (!canUseStorage()) return;
    window.localStorage.setItem(LAST_SEEN_LEAD_ALERT_KEY, seenAt || new Date().toISOString());
  },
};