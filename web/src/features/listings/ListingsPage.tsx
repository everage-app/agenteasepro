import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CalendarDays, Clipboard, FileText, Home, Megaphone, MousePointerClick, Plus, Search, Target } from 'lucide-react';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { PageBeam } from '../../components/layout/PageBeam';
import { ListingCard } from './ListingCard';
import { ListingEditorModal } from './ListingEditorModal';
import { ListingSummary, ListingFormData, ListingStatus } from '../../types/listing';

const MARKETABLE_LISTING_STATUSES = new Set<ListingStatus>([
  ListingStatus.ACTIVE,
  ListingStatus.ACTIVE_NO_SHOW,
  ListingStatus.PENDING,
  ListingStatus.UNDER_CONTRACT,
  ListingStatus.BACKUP,
]);

function formatListingAddress(listing: ListingSummary) {
  return [listing.addressLine1, listing.city, listing.state, listing.zipCode].filter(Boolean).join(', ');
}

function getListingReadiness(listing: ListingSummary) {
  const missing: string[] = [];
  let score = 0;

  if (listing.addressLine1 && listing.city && listing.zipCode) score += 14;
  else missing.push('address');
  if (listing.mlsId) score += 10;
  else missing.push('MLS #');
  if (listing.price > 0) score += 12;
  else missing.push('price');
  if (listing.beds && listing.baths && listing.sqft) score += 12;
  else missing.push('beds/baths/sqft');
  if (listing.heroImageUrl || listing.primaryImageUrl || listing.photos?.length) score += 18;
  else missing.push('photo');
  if ((listing.description || '').trim().length >= 120) score += 14;
  else missing.push('remarks');
  if (MARKETABLE_LISTING_STATUSES.has(listing.status)) score += 10;
  else missing.push('market-ready status');
  if (listing.totalBlasts > 0) score += 10;
  else missing.push('launch blast');

  return { listing, score: Math.min(score, 100), missing };
}

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
  const readinessItems = listings.map(getListingReadiness);
  const sortedReadiness = [...readinessItems].sort((a, b) => a.score - b.score);
  const averageReadiness = readinessItems.length
    ? Math.round(readinessItems.reduce((sum, item) => sum + item.score, 0) / readinessItems.length)
    : 0;
  const needsMediaCount = readinessItems.filter((item) => item.missing.includes('photo')).length;
  const unlaunchedCount = readinessItems.filter((item) => item.missing.includes('launch blast')).length;
  const launchCandidate = sortedReadiness.find((item) => MARKETABLE_LISTING_STATUSES.has(item.listing.status)) || sortedReadiness[0] || null;

  const launchListing = launchCandidate?.listing || null;
  const launchAddress = launchListing ? formatListingAddress(launchListing) : '';
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
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[#f2d894] to-[#9f7933] px-4 py-2 text-xs font-semibold text-[#171106] shadow-lg shadow-[#d6b56d]/25 transition hover:brightness-105 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add listing
        </button>
      }
    >
      <div className="relative ae-content listings-page">
      <PageBeam variant="gold" />

      <section className="mb-4 sm:mb-6">
        <div className="ae-theme-card rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 text-xs text-slate-600 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:rounded-3xl sm:px-6 sm:py-5 dark:border-[#f2d894]/20 dark:bg-gradient-to-br dark:from-slate-950/72 dark:via-slate-950/62 dark:to-[#171106]/42 dark:text-slate-300 dark:shadow-[0_22px_60px_rgba(0,0,0,0.58)]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_0.9fr] xl:items-center">
            <div className="min-w-0">
              <div className="ae-tone-gold inline-flex items-center gap-2 rounded-full border border-[#d6b56d]/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] dark:border-[#f2d894]/25">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Listing command center
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-950 sm:text-base dark:text-white">
                {launchListing ? `Next best launch: ${launchListing.addressLine1}` : 'Add a listing to unlock launch tools'}
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">
                {launchListing
                  ? `${launchAddress} · ${launchCandidate?.score ?? 0}% ready${launchCandidate?.missing.length ? ` · Needs ${launchCandidate.missing.slice(0, 2).join(', ')}` : ''}`
                  : 'Import or create a listing, then launch ads, QR codes, open houses, and marketing from one place.'}
              </div>
              <div className="ae-theme-inset mt-3 h-2 max-w-xl overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-[#f2d894] to-[#9f7933]" style={{ width: `${launchCandidate?.score || 0}%` }} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!launchListing}
                onClick={() => launchListing && navigate(`/marketing?newBlastForListing=${launchListing.id}`)}
                className="ae-tone-emerald inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-[11px] font-semibold transition hover:brightness-105 disabled:opacity-50 dark:border-emerald-400/30"
              >
                <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                Launch blast
              </button>
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="ae-tone-gold inline-flex items-center justify-center gap-2 rounded-xl border border-[#d6b56d]/35 px-3 py-2 text-[11px] font-semibold transition hover:brightness-105 dark:border-[#f2d894]/20"
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Open house event
              </button>
              <button
                type="button"
                disabled={!launchAddress}
                onClick={handleCopyLaunchAddress}
                className="ae-tone-blue inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-[11px] font-semibold transition hover:brightness-105 disabled:opacity-50 dark:border-blue-400/30"
              >
                <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                Copy launch address
              </button>
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="ae-theme-button-muted inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold transition dark:border-white/10"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                Import property
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="ae-theme-inset rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Readiness</div>
              <div className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{averageReadiness}%</div>
            </div>
            <div className="ae-tone-amber rounded-xl border border-amber-200 px-3 py-2.5 dark:border-amber-400/25">
              <div className="text-[10px] uppercase tracking-[0.14em] text-amber-800/80 dark:text-amber-200/80">Need media</div>
              <div className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">{needsMediaCount}</div>
            </div>
            <div className="ae-tone-emerald rounded-xl border border-emerald-200 px-3 py-2.5 dark:border-emerald-400/25">
              <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-200/80">Unlaunched</div>
              <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-200">{unlaunchedCount}</div>
            </div>
            <div className="ae-tone-blue rounded-xl border border-blue-200 px-3 py-2.5 dark:border-blue-400/25">
              <div className="text-[10px] uppercase tracking-[0.14em] text-blue-700/80 dark:text-blue-200/80">Tracked clicks</div>
              <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-200">{totalClicks}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {[
            { label: 'Draft', value: draftCount, icon: <FileText className="h-4 w-4" aria-hidden="true" />, color: 'text-slate-400' },
            { label: 'Active', value: activeCount, icon: <BadgeCheck className="h-4 w-4" aria-hidden="true" />, color: 'text-emerald-400' },
            { label: 'Pending / UC', value: pendingCount, icon: <Home className="h-4 w-4" aria-hidden="true" />, color: 'text-blue-400' },
            { label: 'Sold', value: soldCount, icon: <Target className="h-4 w-4" aria-hidden="true" />, color: 'text-rose-400' },
            { label: 'Off Market', value: offMarketCount, icon: <FileText className="h-4 w-4" aria-hidden="true" />, color: 'text-orange-400' },
            { label: 'Clicks', value: totalClicks, icon: <MousePointerClick className="h-4 w-4" aria-hidden="true" />, color: 'text-cyan-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="ae-theme-card-strong rounded-2xl sm:rounded-3xl border border-white/16 px-3 sm:px-4 py-3 sm:py-4 text-xs text-slate-300 shadow-[0_22px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(244,184,96,0.5)] transition-all duration-300"
            >
              <div className="flex items-center gap-2">
                <span className="ae-theme-inset inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300">{stat.icon}</span>
                <div className={`text-xl sm:text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              </div>
              <div className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.18em] text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <section className="mt-3 sm:mt-4">
        <div className="ae-theme-card-strong flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 rounded-2xl sm:rounded-3xl border border-white/10 px-3 sm:px-4 py-3 text-xs text-slate-300 backdrop-blur-xl shadow-lg">
          <div className="flex flex-1 items-center gap-2">
            <span className="text-slate-500 hidden sm:inline">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Address, city, or MLS #"
              className="ae-theme-field flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:py-1.5 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 min-h-[40px] sm:min-h-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ListingStatus | 'ALL')}
              className="ae-theme-field flex-1 sm:flex-initial rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:py-1.5 text-xs text-slate-50 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 min-h-[40px] sm:min-h-0"
            >
              <option value="ALL">All statuses</option>
              <option value={ListingStatus.DRAFT}>Draft</option>
              <option value={ListingStatus.ACTIVE}>Active</option>
              <option value={ListingStatus.ACTIVE_NO_SHOW}>Active - No Show</option>
              <option value={ListingStatus.PENDING}>Pending</option>
              <option value={ListingStatus.UNDER_CONTRACT}>Under Contract</option>
              <option value={ListingStatus.BACKUP}>Backup</option>
              <option value={ListingStatus.SOLD}>Sold</option>
              <option value={ListingStatus.WITHDRAWN}>Withdrawn</option>
              <option value={ListingStatus.CANCELED}>Canceled</option>
              <option value={ListingStatus.EXPIRED}>Expired</option>
              <option value={ListingStatus.OFF_MARKET}>Off Market</option>
            </select>
          </div>
        </div>
      </section>

      {/* Listings grid */}
      <section>
        {isLoading ? (
          <div className="mt-4 sm:mt-6 text-center text-xs text-slate-400">Loading listings…</div>
        ) : filteredListings.length === 0 ? (
          <div className="ae-theme-card-strong mt-4 sm:mt-6 rounded-2xl sm:rounded-[32px] border border-dashed border-white/12 px-4 sm:px-6 py-8 sm:py-10 text-center text-xs text-slate-400 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
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

