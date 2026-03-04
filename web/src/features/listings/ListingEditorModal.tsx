import React, { useState, useEffect } from 'react';
import { ListingSummary, ListingFormData, ListingStatus } from '../../types/listing';
import { useMlsStore } from '../mls/mlsStore';
import api from '../../lib/api';
import { ComboBox, ALL_UTAH_CITIES, CITY_TO_COUNTY } from '../../components/forms/AddressAutocomplete';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ListingFormData) => Promise<void>;
  listing?: ListingSummary | null;
};

const initialFormData: ListingFormData = {
  addressLine1: '',
  city: '',
  state: 'UT',
  zipCode: '',
  mlsId: '',
  headline: '',
  description: '',
  price: '',
  beds: '',
  baths: '',
  sqft: '',
  status: ListingStatus.ACTIVE,
  heroImageUrl: '',
  isFeatured: false,
};

export function ListingEditorModal({ isOpen, onClose, onSave, listing }: Props) {
  const [formData, setFormData] = useState<ListingFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [mlsLookupId, setMlsLookupId] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [isScanningAddress, setIsScanningAddress] = useState(false);
  const [approximateNotice, setApproximateNotice] = useState<string | null>(null);

  const mlsStore = useMlsStore();

  useEffect(() => {
    if (listing) {
      setFormData({
        addressLine1: listing.addressLine1,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        mlsId: listing.mlsId || '',
        headline: listing.headline,
        description: listing.description,
        price: listing.price,
        beds: listing.beds ?? '',
        baths: listing.baths ?? '',
        sqft: listing.sqft ?? '',
        status: listing.status,
        heroImageUrl: listing.heroImageUrl || '',
        isFeatured: listing.isFeatured,
      });
    } else {
      setFormData(initialFormData);
    }
  }, [listing, isOpen]);

  // Address suggestions as the agent types
  useEffect(() => {
    const q = formData.addressLine1.trim();
    if (!q) {
      setAddressSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const res = await api.get<string[]>('/properties/suggest', { params: { q } });
        setAddressSuggestions(res.data || []);
      } catch (err) {
        // keep silent – suggestions are a nice-to-have
        setAddressSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [formData.addressLine1]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save listing:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 text-xs text-slate-900 dark:text-slate-200 shadow-[0_32px_80px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {/* Header */}
        <div className="border-b border-slate-200/80 dark:border-white/10 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {listing ? 'Edit listing' : 'Add new listing'}
            </h2>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
              {listing
                ? 'Update listing details and marketing info'
                : 'Add a new property to your inventory'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-5">
            {/* MLS Lookup helper */}
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">MLS quick fill</div>
                  <p className="text-[11px] text-slate-500">Paste an old MLS number to auto-fill details.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mlsLookupId}
                  onChange={(e) => setMlsLookupId(e.target.value)}
                  placeholder="Enter MLS number"
                  className="flex-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  disabled={!mlsLookupId || isLookingUp}
                  className="whitespace-nowrap rounded-xl bg-cyan-600 px-3 py-2 text-[11px] font-semibold text-white shadow-lg shadow-cyan-500/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-cyan-500"
                  onClick={async () => {
                    if (!mlsLookupId) return;
                    try {
                      setIsLookingUp(true);
                      const mls = await mlsStore.search(mlsLookupId);
                      setFormData(prev => ({
                        ...prev,
                        addressLine1: mls.addressLine1 || prev.addressLine1,
                        city: mls.city || prev.city,
                        state: mls.state || prev.state,
                        zipCode: mls.zip || prev.zipCode,
                        mlsId: mls.mlsNumber || prev.mlsId,
                        headline: mls.headline || prev.headline,
                        description: mls.description || prev.description,
                        price: mls.price != null ? String(mls.price) : prev.price,
                        beds: mls.beds != null ? String(mls.beds) : prev.beds,
                        baths: mls.baths != null ? String(mls.baths) : prev.baths,
                        sqft: mls.squareFeet != null ? String(mls.squareFeet) : prev.sqft,
                        heroImageUrl: mls.photos && mls.photos.length ? mls.photos[0] : prev.heroImageUrl,
                      }));
                      setApproximateNotice('MLS data imported. Please review and correct anything that looks off.');
                    } finally {
                      setIsLookingUp(false);
                    }
                  }}
                >
                  {isLookingUp ? 'Looking up…' : 'Lookup MLS'}
                </button>
              </div>
              {mlsStore.error && (
                <p className="text-[11px] text-red-400">{mlsStore.error}</p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Street address *
              </label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="123 Main St"
                required
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
              {addressSuggestions.length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-200/80 bg-white text-[11px] dark:border-white/10 dark:bg-slate-900/90">
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, addressLine1: suggestion }));
                        setAddressSuggestions([]);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* City, State, Zip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="[&_label]:mb-1.5 [&_label]:block [&_label]:text-[11px] [&_label]:font-medium [&_label]:text-slate-400 [&_label]:normal-case [&_label]:tracking-normal">
                <ComboBox
                  label="City *"
                  value={formData.city}
                  onChange={(city) => setFormData({ ...formData, city })}
                  options={ALL_UTAH_CITIES}
                  placeholder="Select city"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  disabled
                  className="w-full rounded-xl border border-slate-200/80 bg-slate-100 px-3 py-2 text-xs text-slate-500 outline-none cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Zip *
                </label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  placeholder="84101"
                  maxLength={5}
                  required
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Address scan helper */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2 dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Or scan this address and let us pre-fill what we can. Always double-check the numbers.
              </p>
              <button
                type="button"
                className="whitespace-nowrap rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-emerald-500/40 transition-colors hover:bg-emerald-500 disabled:opacity-50"
                disabled={isScanningAddress}
                onClick={async () => {
                  if (!formData.addressLine1 || !formData.city) return;
                  try {
                    setIsScanningAddress(true);
                    const res = await api.post<{
                      approx: boolean;
                      message?: string;
                      price?: number | null;
                      beds?: number | null;
                      baths?: number | null;
                      sqft?: number | null;
                      heroImageUrl?: string | null;
                    }>('/properties/enrich', {
                      addressLine1: formData.addressLine1,
                      city: formData.city,
                      state: formData.state,
                      zipCode: formData.zipCode,
                    });

                    const payload = res.data;
                    if (payload.price != null) {
                      setFormData(prev => ({ ...prev, price: String(payload.price) }));
                    }
                    if (payload.beds != null) {
                      setFormData(prev => ({ ...prev, beds: String(payload.beds!) }));
                    }
                    if (payload.baths != null) {
                      setFormData(prev => ({ ...prev, baths: String(payload.baths!) }));
                    }
                    if (payload.sqft != null) {
                      setFormData(prev => ({ ...prev, sqft: String(payload.sqft!) }));
                    }
                    if (payload.heroImageUrl) {
                      setFormData(prev => ({ ...prev, heroImageUrl: payload.heroImageUrl || prev.heroImageUrl }));
                    }

                    if (payload.approx && payload.message) {
                      setApproximateNotice(payload.message);
                    } else if (!payload.approx) {
                      setApproximateNotice(payload.message || null);
                    }
                  } catch (err) {
                    setApproximateNotice('We could not find anything for this address. Please enter details manually.');
                  } finally {
                    setIsScanningAddress(false);
                  }
                }}
              >
                {isScanningAddress ? 'Scanning…' : 'Scan address'}
              </button>
            </div>

            {/* MLS ID */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                MLS ID (optional)
              </label>
              <input
                type="text"
                value={formData.mlsId}
                onChange={(e) => setFormData({ ...formData, mlsId: e.target.value })}
                placeholder="MLS123456"
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Headline */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Headline *
              </label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                placeholder="Beautiful 3-bed home in downtown SLC"
                required
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Stunning views, modern finishes, walk to everything..."
                required
                rows={3}
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Price, Beds, Baths, Sqft */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Price *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="500000"
                  required
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Beds
                </label>
                <input
                  type="number"
                  value={formData.beds}
                  onChange={(e) => setFormData({ ...formData, beds: e.target.value })}
                  placeholder="3"
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Baths
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.baths}
                  onChange={(e) => setFormData({ ...formData, baths: e.target.value })}
                  placeholder="2.5"
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Sqft
                </label>
                <input
                  type="number"
                  value={formData.sqft}
                  onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
                  placeholder="2000"
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as ListingStatus })
                }
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50"
              >
                <option value={ListingStatus.DRAFT}>✏️ Draft</option>
                <option value={ListingStatus.ACTIVE}>🟢 Active</option>
                <option value={ListingStatus.ACTIVE_NO_SHOW}>🚫 Active - No Show</option>
                <option value={ListingStatus.PENDING}>⏳ Pending</option>
                <option value={ListingStatus.UNDER_CONTRACT}>📝 Under Contract</option>
                <option value={ListingStatus.BACKUP}>🔄 Backup</option>
                <option value={ListingStatus.SOLD}>🎉 Sold</option>
                <option value={ListingStatus.WITHDRAWN}>⏸️ Withdrawn</option>
                <option value={ListingStatus.CANCELED}>❌ Canceled</option>
                <option value={ListingStatus.EXPIRED}>⌛ Expired</option>
                <option value={ListingStatus.OFF_MARKET}>🏠 Off Market</option>
              </select>
            </div>

            {/* Hero Image URL */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Hero image URL (optional)
              </label>
              <input
                type="url"
                value={formData.heroImageUrl}
                onChange={(e) => setFormData({ ...formData, heroImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Approximate data notice */}
            {approximateNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
                {approximateNotice}
              </div>
            )}

            {/* Featured toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isFeatured"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 bg-white text-cyan-500 focus:ring-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-cyan-400"
              />
              <label htmlFor="isFeatured" className="text-[11px] text-slate-600 dark:text-slate-300">
                Feature this listing (shows badge and priority sort)
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 transition-colors hover:border-cyan-400 hover:text-cyan-700 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:text-cyan-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/40 transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : listing ? 'Update listing' : 'Create listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
