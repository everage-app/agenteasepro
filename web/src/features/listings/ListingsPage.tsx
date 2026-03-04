import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { PageBeam } from '../../components/layout/PageBeam';
import { ListingCard } from './ListingCard';
import { ListingEditorModal } from './ListingEditorModal';
import { ListingSummary, ListingFormData, ListingStatus } from '../../types/listing';

export function ListingsPage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [filteredListings, setFilteredListings] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'ALL'>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<ListingSummary | null>(null);

  // Load listings
  const loadListings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/listings');
      setListings(res.data);
    } catch (error) {
      console.error('Failed to load listings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  // Filter listings
  useEffect(() => {
    let filtered = [...listings];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.addressLine1.toLowerCase().includes(searchLower) ||
          l.city.toLowerCase().includes(searchLower) ||
          l.mlsId?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredListings(filtered);
  }, [listings, search, statusFilter]);

  // Compute stats
  const draftCount = listings.filter((l) => l.status === ListingStatus.DRAFT).length;
  const activeCount = listings.filter(
    (l) => l.status === ListingStatus.ACTIVE || l.status === ListingStatus.ACTIVE_NO_SHOW
  ).length;
  const pendingCount = listings.filter(
    (l) =>
      l.status === ListingStatus.PENDING ||
      l.status === ListingStatus.UNDER_CONTRACT ||
      l.status === ListingStatus.BACKUP
  ).length;
  const soldCount = listings.filter((l) => l.status === ListingStatus.SOLD).length;
  const offMarketCount = listings.filter(
    (l) =>
      l.status === ListingStatus.WITHDRAWN ||
      l.status === ListingStatus.CANCELED ||
      l.status === ListingStatus.EXPIRED ||
      l.status === ListingStatus.OFF_MARKET
  ).length;
  const totalClicks = listings.reduce((sum, l) => sum + l.totalClicks, 0);

  const launchListing = listings[0] || null;
  const launchAddress = launchListing
    ? [launchListing.addressLine1, launchListing.city, launchListing.state, launchListing.zipCode].filter(Boolean).join(', ')
    : '';
  const handleCopyLaunchAddress = () => {
    if (!launchAddress) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(launchAddress);
    }
  };

  // Modal handlers
  const openNewListingModal = () => {
    setEditingListing(null);
    setIsModalOpen(true);
  };

  const openEditListingModal = (listing: ListingSummary) => {
    setEditingListing(listing);
    setIsModalOpen(true);
  };

  const handleSaveListing = async (data: ListingFormData) => {
    if (editingListing) {
      // Update existing
      await api.patch(`/listings/${editingListing.id}`, data);
    } else {
      // Create new
      await api.post('/listings', data);
    }
    await loadListings();
  };

  const handleLaunchBlast = (listing: ListingSummary) => {
    // Navigate to Marketing page with query param to prefill blast
    navigate(`/marketing?newBlastForListing=${listing.id}`);
  };

  return (
    <PageLayout
      title="Listings"
      subtitle="Active and pending listings across your Utah markets — ready to edit, share, and market."
      actions={
        <button
          type="button"
          onClick={openNewListingModal}
          className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/40 transition-colors hover:bg-blue-500 active:bg-blue-700 min-h-[44px]"
        >
          + Add listing
        </button>
      }
    >
      <div className="relative ae-content">
      <PageBeam variant="gold" />

      {/* Listing guidance */}
      <section className="mb-4 sm:mb-6">
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/60 px-4 sm:px-6 py-4 sm:py-5 text-xs text-slate-300 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-cyan-300">Listing guidance</div>
              <div className="text-sm sm:text-base font-semibold text-white">Quality checklist before publishing</div>
              <div className="text-[11px] text-slate-400 mt-1">Verify photos, remarks, pricing, showing instructions, and marketing links.</div>
            </div>
            <button
              type="button"
              onClick={openNewListingModal}
              className="rounded-full bg-cyan-500/20 border border-cyan-400/30 px-3 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/30"
            >
              Add listing
            </button>
          </div>
        </div>
      </section>

      {/* Listing Launch Kit */}
      <section className="mb-4 sm:mb-6">
        <div className="rounded-2xl sm:rounded-3xl border border-emerald-400/20 bg-slate-950/60 px-4 sm:px-6 py-4 sm:py-5 text-xs text-slate-300 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-emerald-300">Listing Launch Kit</div>
              <div className="text-sm sm:text-base font-semibold text-white">One‑click launch for your next listing</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {launchListing ? launchAddress : 'Add a listing to unlock instant launch tools.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!launchListing}
                onClick={() => launchListing && navigate(`/marketing?newBlastForListing=${launchListing.id}`)}
                className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                Launch blast
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/calendar')}
                className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
              >
                Open house event
              </button>
              <button
                type="button"
                disabled={!launchAddress}
                onClick={handleCopyLaunchAddress}
                className="rounded-full bg-blue-500/10 border border-blue-400/30 px-3 py-1.5 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
              >
                Copy launch address
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {[
            { label: 'Draft', value: draftCount, icon: '✏️', color: 'text-slate-400' },
            { label: 'Active', value: activeCount, icon: '🟢', color: 'text-emerald-400' },
            { label: 'Pending / UC', value: pendingCount, icon: '📝', color: 'text-blue-400' },
            { label: 'Sold', value: soldCount, icon: '🎉', color: 'text-rose-400' },
            { label: 'Off Market', value: offMarketCount, icon: '⏸️', color: 'text-orange-400' },
            { label: 'Clicks', value: totalClicks, icon: '👆', color: 'text-cyan-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl sm:rounded-3xl border border-white/16 bg-slate-950/60 px-3 sm:px-4 py-3 sm:py-4 text-xs text-slate-300 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(244,184,96,0.5)] transition-all duration-300"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{stat.icon}</span>
                <div className={`text-xl sm:text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.18em] text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <section className="mt-3 sm:mt-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/50 px-3 sm:px-4 py-3 text-xs text-slate-300 backdrop-blur-xl shadow-lg">
          <div className="flex flex-1 items-center gap-2">
            <span className="text-slate-500 hidden sm:inline">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Address, city, or MLS #"
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:py-1.5 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 min-h-[40px] sm:min-h-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ListingStatus | 'ALL')}
              className="flex-1 sm:flex-initial rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:py-1.5 text-xs text-slate-50 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 min-h-[40px] sm:min-h-0"
            >
              <option value="ALL">All statuses</option>
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
        </div>
      </section>

      {/* Listings grid */}
      <section>
        {isLoading ? (
          <div className="mt-4 sm:mt-6 text-center text-xs text-slate-400">Loading listings…</div>
        ) : filteredListings.length === 0 ? (
          <div className="mt-4 sm:mt-6 rounded-2xl sm:rounded-[32px] border border-dashed border-white/12 bg-slate-950/70 px-4 sm:px-6 py-8 sm:py-10 text-center text-xs text-slate-400 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <h2 className="text-sm sm:text-base font-semibold text-slate-50">
              {search || statusFilter !== 'ALL' ? 'No matching listings' : 'No listings yet'}
            </h2>
            <p className="mt-2">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'Add your first listing to start tracking status, REPC progress, and launch marketing blasts in one place.'}
            </p>
            {!search && statusFilter === 'ALL' && (
              <div className="mt-4 sm:mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={openNewListingModal}
                  className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/40 transition-colors hover:bg-blue-500 active:bg-blue-700 min-h-[44px]"
                >
                  Add first listing
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onEdit={() => openEditListingModal(listing)}
                onLaunchBlast={() => handleLaunchBlast(listing)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      <ListingEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveListing}
        listing={editingListing}
      />
      </div>
    </PageLayout>
  );
}

