import { create } from 'zustand';
import api from '../../lib/api';

export interface MlsListingRecord {
  id: string;
  agentId: string;
  listingId: string | null;
  mlsNumber: string;
  headline: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: string | null;
  beds: number | null;
  baths: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  description: string | null;
  photos: string[] | null;
  raw: Record<string, unknown> | null;
  sourceUrl: string | null;
  lastFetchedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface MlsState {
  lastQuery: string | null;
  lastResult: MlsListingRecord | null;
  loading: boolean;
  error: string | null;
  search: (mlsNumber: string, options?: { force?: boolean }) => Promise<MlsListingRecord>;
  clear: () => void;
}

export const useMlsStore = create<MlsState>((set) => ({
  lastQuery: null,
  lastResult: null,
  loading: false,
  error: null,
  async search(rawMls: string, options) {
    const mlsNumber = rawMls.trim();
    if (!mlsNumber) {
      const message = 'Enter an MLS number first.';
      set({ error: message });
      throw new Error(message);
    }
    set({ loading: true, error: null });
    try {
      const res = await api.post<MlsListingRecord>(
        '/mls/import',
        { mlsNumber, force: Boolean(options?.force) },
      );
      const listing = res.data;
      set({ lastQuery: mlsNumber, lastResult: listing, loading: false });
      return listing;
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Could not sync MLS data.';
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },
  clear() {
    set({ lastQuery: null, lastResult: null, error: null });
  },
}));
