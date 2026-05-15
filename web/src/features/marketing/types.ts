export type BlastStatus = 'DRAFT' | 'SCHEDULED' | 'SENT';
export type BlastChannelType = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'EMAIL' | 'SMS' | 'WEBSITE';
export type BlastPlaybook =
  | 'NEW_LISTING'
  | 'PRICE_REDUCTION'
  | 'OPEN_HOUSE'
  | 'UNDER_CONTRACT'
  | 'JUST_SOLD'
  | 'CUSTOM';

export interface BlastChannel {
  id: string;
  channel: BlastChannelType;
  enabled: boolean;
  status: BlastStatus;
  previewText?: string | null;
  previewHtml?: string | null;
  shortCode?: string | null;
  shortUrl?: string | null;
  externalId?: string | null;
  clicks: number;
  uniqueClicks: number;
}

export type MarketingAudienceType = 'CLIENTS' | 'LEADS' | 'DEALS';

export interface MarketingDeliveryLog {
  id: string;
  agentId: string;
  blastId: string;
  channelId?: string | null;
  provider: string;
  status: string;
  messageId?: string | null;
  subject: string;
  recipientsCount: number;
  recipientsSample: string[];
  audienceType?: MarketingAudienceType | null;
  error?: string | null;
  createdAt: string;
}

export interface ListingSummary {
  id: string;
  headline: string;
  description?: string | null;
  price?: number | string | null;
  primaryImageUrl?: string | null;
  status: string;
}

export interface MarketingBlast {
  id: string;
  agentId: string;
  listingId?: string | null;
  title: string;
  playbook: BlastPlaybook;
  status: BlastStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  channels: BlastChannel[];
  listing?: ListingSummary | null;
}
