export enum ListingStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ACTIVE_NO_SHOW = 'ACTIVE_NO_SHOW',
  PENDING = 'PENDING',
  UNDER_CONTRACT = 'UNDER_CONTRACT',
  BACKUP = 'BACKUP',
  SOLD = 'SOLD',
  WITHDRAWN = 'WITHDRAWN',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  OFF_MARKET = 'OFF_MARKET',
}

export interface ListingSummary {
  id: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  mlsId?: string | null;
  headline: string;
  description: string;
  price: number;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  status: ListingStatus;
  heroImageUrl?: string | null;
  isFeatured: boolean;
  totalBlasts: number;
  totalClicks: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListingFormData {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  mlsId?: string;
  headline: string;
  description: string;
  price: number | string;
  beds?: number | string;
  baths?: number | string;
  sqft?: number | string;
  status: ListingStatus;
  heroImageUrl?: string;
  isFeatured: boolean;
}
