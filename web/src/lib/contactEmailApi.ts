import api from './api';

export type ContactEmailType = 'lead' | 'client';

export interface ContactEmailHistoryItem {
  id: string;
  kind: 'sent' | 'failed' | 'event' | 'reply';
  at: string;
  subject: string | null;
  body: string | null;
  toEmail: string | null;
  fromEmail: string | null;
  snippet: string | null;
  ccAgent: boolean;
  messageId: string | null;
  eventType: string | null;
  error: string | null;
  source: 'internal' | 'sendgrid';
}

export interface RecentReplyItem {
  id: string;
  at: string;
  contactType: ContactEmailType;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
  unseen: boolean;
}

export interface ContactEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const contactEmailApi = {
  send: (payload: {
    contactType: ContactEmailType;
    contactId: string;
    subject: string;
    body: string;
    ccAgent: boolean;
  }) => api.post<{ ok: boolean; messageId: string | null; sentAt: string }>('/contact-email/send', payload),

  history: (params: { contactType: ContactEmailType; contactId: string }) =>
    api.get<{ items: ContactEmailHistoryItem[] }>('/contact-email/history', { params }),

  recentReplies: (params?: { limit?: number }) =>
    api.get<{ items: RecentReplyItem[]; unseenCount: number; lastSeenAt: string | null }>('/contact-email/recent-replies', { params }),

  markRecentRepliesSeen: () => api.post<{ ok: boolean; seenAt: string }>('/contact-email/recent-replies/mark-seen'),

  templates: () => api.get<{ items: ContactEmailTemplate[] }>('/contact-email/templates'),

  createTemplate: (payload: { name: string; subject: string; body: string }) =>
    api.post<{ item: ContactEmailTemplate }>('/contact-email/templates', payload),

  updateTemplate: (id: string, payload: Partial<{ name: string; subject: string; body: string }>) =>
    api.patch<{ item: ContactEmailTemplate }>(`/contact-email/templates/${encodeURIComponent(id)}`, payload),

  markTemplateUsed: (id: string) =>
    api.post<{ item: ContactEmailTemplate }>(`/contact-email/templates/${encodeURIComponent(id)}/used`),

  deleteTemplate: (id: string) => api.delete(`/contact-email/templates/${encodeURIComponent(id)}`),
};
