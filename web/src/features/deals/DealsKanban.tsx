import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { DealHealthBadge } from '../../components/deals/DealHealthBadge';
import { DealTimeline } from '../../components/deals/DealTimeline';
import { useConfetti } from '../../hooks/useConfetti';

type DealStatus =
  | 'LEAD'
  | 'ACTIVE'
  | 'OFFER_SENT'
  | 'UNDER_CONTRACT'
  | 'DUE_DILIGENCE'
  | 'FINANCING'
  | 'SETTLEMENT_SCHEDULED'
  | 'CLOSED'
  | 'FELL_THROUGH';

interface DealCard {
  id: string;
  title: string;
  status: DealStatus;
  offerReferenceDate?: string;
  archivedAt?: string | null;
  archivedReason?: string | null;
  archiveAfterDays?: number;
  closedAt?: string | null;
  lastActivityAt?: string | null;
  property?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    taxId?: string;
    mlsId?: string;
  };
  buyer?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  seller?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  stage?: string | null;
  repc?: {
    purchasePrice?: string | number | null;
    sellerCompensationContributionPercent?: string | number | null;
    sellerCompensationContributionFlat?: string | number | null;
    settlementDeadline: string | null;
    sellerDisclosureDeadline: string | null;
    dueDiligenceDeadline: string | null;
    financingAppraisalDeadline: string | null;
  } | null;
  forms?: Array<{
    id: string;
    status?: string | null;
    title?: string;
    definition?: {
      code?: string;
      displayName?: string;
    };
  }>;
  signatureEnvelopes?: Array<{
    id: string;
    type?: string;
    completedAt?: string | null;
    signers?: Array<{
      id: string;
      viewedAt?: string | null;
      signedAt?: string | null;
    }>;
  }>;
}

interface DealActivityItem {
  id: string;
  type: 'DEAL' | 'EVENT' | 'TASK' | 'FORM' | 'ADDENDUM' | 'ESIGN';
  title: string;
  description?: string;
  at: string;
  meta?: Record<string, any>;
}

const microFlow = [
  { key: 'lead', label: 'Lead' },
  { key: 'prep', label: 'Prep' },
  { key: 'offer', label: 'Offer' },
  { key: 'contract', label: 'Contract' },
  { key: 'due', label: 'Due Dil.' },
  { key: 'finance', label: 'Finance' },
  { key: 'settle', label: 'Settle' },
];

const DEFAULT_COMMISSION_RATE = 2.5;

type CommissionMode = 'DEFAULT' | 'PERCENT' | 'FLAT';

const statusProgressIndex: Record<DealStatus, number> = {
  LEAD: 0,
  ACTIVE: 1,
  OFFER_SENT: 2,
  UNDER_CONTRACT: 3,
  DUE_DILIGENCE: 4,
  FINANCING: 5,
  SETTLEMENT_SCHEDULED: 6,
  CLOSED: 6,
  FELL_THROUGH: 2,
};

const columns: { key: DealStatus; label: string; color: string }[] = [
  { key: 'LEAD', label: 'Lead', color: 'slate' },
  { key: 'ACTIVE', label: 'Active', color: 'blue' },
  { key: 'OFFER_SENT', label: 'Offer Sent', color: 'purple' },
  { key: 'UNDER_CONTRACT', label: 'Under Contract', color: 'emerald' },
  { key: 'DUE_DILIGENCE', label: 'Due Diligence', color: 'teal' },
  { key: 'FINANCING', label: 'Financing', color: 'cyan' },
  { key: 'SETTLEMENT_SCHEDULED', label: 'Settlement', color: 'violet' },
  { key: 'CLOSED', label: 'Closed', color: 'green' },
  { key: 'FELL_THROUGH', label: 'Fell Through', color: 'red' },
];

const colorClasses: Record<string, { bg: string; badge: string; badgeText: string; accent: string; border: string; glow: string }> = {
  slate: {
    bg: 'bg-gradient-to-b from-[#090f1f] to-[#050913]',
    badge: 'bg-white/10 text-slate-200',
    badgeText: 'text-slate-200',
    accent: 'bg-slate-200',
    border: 'border-white/15',
    glow: 'from-slate-500/30',
  },
  blue: {
    bg: 'bg-gradient-to-b from-[#0c1533] via-[#101f42] to-[#070d1f]',
    badge: 'bg-blue-500/20 text-blue-100',
    badgeText: 'text-blue-100',
    accent: 'bg-blue-300',
    border: 'border-blue-400/30',
    glow: 'from-blue-500/35',
  },
  purple: {
    bg: 'bg-gradient-to-b from-[#120a22] via-[#190f31] to-[#080413]',
    badge: 'bg-indigo-500/20 text-indigo-100',
    badgeText: 'text-indigo-100',
    accent: 'bg-indigo-300',
    border: 'border-indigo-400/30',
    glow: 'from-indigo-500/35',
  },
  emerald: {
    bg: 'bg-gradient-to-b from-[#051a16] via-[#0a2922] to-[#030d0b]',
    badge: 'bg-emerald-500/20 text-emerald-100',
    badgeText: 'text-emerald-100',
    accent: 'bg-emerald-300',
    border: 'border-emerald-400/30',
    glow: 'from-emerald-500/35',
  },
  teal: {
    bg: 'bg-gradient-to-b from-[#041d1f] via-[#082f33] to-[#01090a]',
    badge: 'bg-teal-500/20 text-teal-100',
    badgeText: 'text-teal-100',
    accent: 'bg-teal-300',
    border: 'border-teal-400/30',
    glow: 'from-teal-500/35',
  },
  cyan: {
    bg: 'bg-gradient-to-b from-[#031a28] via-[#082c41] to-[#02070d]',
    badge: 'bg-cyan-500/20 text-cyan-100',
    badgeText: 'text-cyan-100',
    accent: 'bg-cyan-300',
    border: 'border-cyan-400/30',
    glow: 'from-cyan-500/35',
  },
  violet: {
    bg: 'bg-gradient-to-b from-[#1a0c2c] via-[#240f3f] to-[#090412]',
    badge: 'bg-violet-500/20 text-violet-100',
    badgeText: 'text-violet-100',
    accent: 'bg-violet-300',
    border: 'border-violet-400/30',
    glow: 'from-violet-500/35',
  },
  green: {
    bg: 'bg-gradient-to-b from-[#041707] via-[#08240d] to-[#030b04]',
    badge: 'bg-green-500/20 text-green-100',
    badgeText: 'text-green-100',
    accent: 'bg-green-300',
    border: 'border-green-400/30',
    glow: 'from-green-500/35',
  },
  red: {
    bg: 'bg-gradient-to-b from-[#2a0d12] via-[#3d0f17] to-[#0c0304]',
    badge: 'bg-rose-500/20 text-rose-100',
    badgeText: 'text-rose-100',
    accent: 'bg-rose-300',
    border: 'border-rose-400/30',
    glow: 'from-rose-500/35',
  },
};

const getInitials = (first?: string, last?: string) => {
  if (!first && !last) {
    return '??';
  }
  const firstInitial = first?.charAt(0)?.toUpperCase() ?? '';
  const lastInitial = last?.charAt(0)?.toUpperCase() ?? '';
  return `${firstInitial}${lastInitial}` || firstInitial || lastInitial || '??';
};

const getNextDeadline = (deal: DealCard): { date: Date; label: string; type: string } | null => {
  if (!deal.repc) return null;
  const deadlines = [
    { date: deal.repc.sellerDisclosureDeadline, label: 'Seller Disclosure', type: 'disclosure' },
    { date: deal.repc.dueDiligenceDeadline, label: 'Due Diligence', type: 'diligence' },
    { date: deal.repc.financingAppraisalDeadline, label: 'Financing & Appraisal', type: 'financing' },
    { date: deal.repc.settlementDeadline, label: 'Settlement', type: 'settlement' },
  ]
    .filter((d) => d.date)
    .map((d) => ({ ...d, date: new Date(d.date!) }))
    .filter((d) => d.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return deadlines[0] || null;
};

const getUrgencyLevel = (deadline: Date | null): 'critical' | 'warning' | 'normal' => {
  if (!deadline) return 'normal';
  const now = new Date();
  const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 2) return 'critical';
  if (daysUntil <= 7) return 'warning';
  return 'normal';
};

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getDealPrice(deal: DealCard): number {
  return Number(deal.repc?.purchasePrice || 0) || 0;
}

function getDealCommissionMode(deal: DealCard): CommissionMode {
  const flat = Number(deal.repc?.sellerCompensationContributionFlat || 0);
  if (flat > 0) return 'FLAT';
  const percent = Number(deal.repc?.sellerCompensationContributionPercent || 0);
  if (percent > 0) return 'PERCENT';
  return 'DEFAULT';
}

function getDealCommissionRate(deal: DealCard): number {
  const percent = Number(deal.repc?.sellerCompensationContributionPercent || 0);
  return percent > 0 ? percent : DEFAULT_COMMISSION_RATE;
}

function getDealCommission(deal: DealCard): number {
  const flat = Number(deal.repc?.sellerCompensationContributionFlat || 0);
  if (flat > 0) return flat;
  const price = getDealPrice(deal);
  if (price <= 0) return 0;
  return price * (getDealCommissionRate(deal) / 100);
}

function getCommissionModeLabel(deal: DealCard): string {
  const mode = getDealCommissionMode(deal);
  if (mode === 'FLAT') return 'Flat fee';
  const rate = getDealCommissionRate(deal);
  return mode === 'DEFAULT' ? `${rate}% default` : `${rate}% rate`;
}

function getCommissionFormState(deal: DealCard): { mode: CommissionMode; value: string } {
  const mode = getDealCommissionMode(deal);
  if (mode === 'FLAT') {
    return {
      mode,
      value: String(Number(deal.repc?.sellerCompensationContributionFlat || 0) || ''),
    };
  }
  if (mode === 'PERCENT') {
    return {
      mode,
      value: String(Number(deal.repc?.sellerCompensationContributionPercent || 0) || ''),
    };
  }
  return { mode: 'DEFAULT', value: '' };
}

function getDealDocsSummary(deal: DealCard) {
  let signed = 0;
  let pending = 0;
  let draft = 0;

  (deal.forms || []).forEach((form) => {
    const status = String(form.status || 'DRAFT').toUpperCase();
    if (status === 'SIGNED') {
      signed += 1;
      return;
    }
    if (status === 'PARTIALLY_SIGNED' || status === 'VIEWED' || status === 'SENT') {
      pending += 1;
      return;
    }
    draft += 1;
  });

  (deal.signatureEnvelopes || []).forEach((envelope) => {
    const signers = envelope.signers || [];
    const totalSigners = signers.length;
    const signedCount = signers.filter((signer) => !!signer.signedAt).length;
    const isEnvelopeSigned =
      !!envelope.completedAt || (totalSigners > 0 && signedCount === totalSigners);
    if (isEnvelopeSigned) {
      signed += 1;
    } else {
      pending += 1;
    }
  });

  return {
    signed,
    pending,
    draft,
    total: signed + pending + draft,
  };
}

const urgencyStyles = {
  critical: {
    glow: 'shadow-[0_0_35px_rgba(239,68,68,0.5),0_18px_40px_rgba(37,99,235,0.65)]',
    border: 'border-red-400/70',
    badge: 'bg-red-500/20 border-red-400/50 text-red-100 animate-pulse',
  },
  warning: {
    glow: 'shadow-[0_0_25px_rgba(251,191,36,0.4),0_18px_40px_rgba(37,99,235,0.65)]',
    border: 'border-amber-400/60',
    badge: 'bg-amber-500/20 border-amber-400/50 text-amber-100',
  },
  normal: {
    glow: 'shadow-[0_12px_26px_rgba(0,0,0,0.6)]',
    border: 'border-white/10',
    badge: 'bg-white/10 border-white/20 text-slate-100',
  },
};

export function DealsKanban() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dealId } = useParams();
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<DealStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealCard | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageNotice, setManageNotice] = useState<string | null>(null);
  const [activityDeal, setActivityDeal] = useState<DealCard | null>(null);
  const [activityItems, setActivityItems] = useState<DealActivityItem[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [pipelineLayout, setPipelineLayout] = useState<'compact' | 'board'>('compact');
  const { fire: fireConfetti } = useConfetti();

  const [editForm, setEditForm] = useState({
    title: '',
    status: 'ACTIVE' as DealStatus,
    offerReferenceDate: '',
    archiveAfterDays: 180,
    archiveReason: '',
    purchasePrice: '',
    commissionMode: 'DEFAULT' as CommissionMode,
    commissionValue: '',
    propertyStreet: '',
    propertyCity: '',
    propertyState: '',
    propertyZip: '',
    propertyCounty: '',
    propertyTaxId: '',
    propertyMlsId: '',
    buyerFirstName: '',
    buyerLastName: '',
    buyerEmail: '',
    buyerPhone: '',
    sellerFirstName: '',
    sellerLastName: '',
    sellerEmail: '',
    sellerPhone: '',
  });

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/deals', { params: { includeArchived: 1 } });
      setDeals(res.data);
    } catch (err) {
      console.error('Failed to load deals:', err);
      setError('Unable to load deals right now. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const requestedId = dealId || searchParams.get('manage') || undefined;
    if (!requestedId) return;
    if (isManageOpen && editingDeal?.id === requestedId) return;

    let cancelled = false;

    const openById = async () => {
      let target = deals.find((deal) => deal.id === requestedId);
      if (!target) {
        try {
          const res = await api.get(`/deals/${requestedId}`);
          target = res.data;
        } catch (err) {
          console.error('Failed to load deal for modal open:', err);
        }
      }

      if (!cancelled && target) {
        openManageDeal(target);
      }
    };

    openById();
    return () => {
      cancelled = true;
    };
  }, [dealId, deals, isManageOpen, editingDeal?.id, location.search]);

  const moveStatus = async (dealId: string, status: DealStatus) => {
    await api.patch(`/deals/${dealId}/status`, { status });
    if (status === 'CLOSED') fireConfetti();
    await fetchDeals();
  };

  const openManageDeal = (deal: DealCard) => {
    const commissionState = getCommissionFormState(deal);
    setEditingDeal(deal);
    setManageError(null);
    setManageNotice(null);
    setEditForm({
      title: deal.title || '',
      status: deal.status,
      offerReferenceDate: deal.offerReferenceDate ? String(deal.offerReferenceDate).slice(0, 10) : '',
      archiveAfterDays: typeof deal.archiveAfterDays === 'number' ? deal.archiveAfterDays : 180,
      archiveReason: '',
      purchasePrice: deal.repc?.purchasePrice ? String(Number(deal.repc.purchasePrice)) : '',
      commissionMode: commissionState.mode,
      commissionValue: commissionState.value,
      propertyStreet: deal.property?.street || '',
      propertyCity: deal.property?.city || '',
      propertyState: deal.property?.state || '',
      propertyZip: deal.property?.zip || '',
      propertyCounty: deal.property?.county || '',
      propertyTaxId: deal.property?.taxId || '',
      propertyMlsId: deal.property?.mlsId || '',
      buyerFirstName: deal.buyer?.firstName || '',
      buyerLastName: deal.buyer?.lastName || '',
      buyerEmail: deal.buyer?.email || '',
      buyerPhone: deal.buyer?.phone || '',
      sellerFirstName: deal.seller?.firstName || '',
      sellerLastName: deal.seller?.lastName || '',
      sellerEmail: deal.seller?.email || '',
      sellerPhone: deal.seller?.phone || '',
    });
    setIsManageOpen(true);
    if (dealId !== deal.id) {
      navigate(`/deals/${deal.id}`, { replace: true });
    }
  };

  const closeManageDeal = () => {
    setIsManageOpen(false);
    setEditingDeal(null);
    setManageError(null);
    setManageNotice(null);
    if (dealId || location.search.includes('manage=')) {
      navigate('/deals', { replace: true });
    }
  };

  const saveDealChanges = async () => {
    if (!editingDeal) return;
    setIsSaving(true);
    setManageError(null);
    setManageNotice(null);
    try {
      await api.patch(`/deals/${editingDeal.id}`, {
        title: editForm.title,
        status: editForm.status,
        offerReferenceDate: editForm.offerReferenceDate || undefined,
        archiveAfterDays: editForm.archiveAfterDays,
        property: {
          street: editForm.propertyStreet,
          city: editForm.propertyCity,
          state: editForm.propertyState,
          zip: editForm.propertyZip,
          county: editForm.propertyCounty,
          taxId: editForm.propertyTaxId,
          mlsId: editForm.propertyMlsId,
        },
        buyer: {
          firstName: editForm.buyerFirstName,
          lastName: editForm.buyerLastName,
          email: editForm.buyerEmail,
          phone: editForm.buyerPhone,
        },
        seller: {
          firstName: editForm.sellerFirstName,
          lastName: editForm.sellerLastName,
          email: editForm.sellerEmail,
          phone: editForm.sellerPhone,
        },
        ...(editingDeal.repc
          ? {
              repc: {
                ...(editForm.purchasePrice.trim()
                  ? { purchasePrice: Number(editForm.purchasePrice) }
                  : {}),
                sellerCompensationContributionPercent:
                  editForm.commissionMode === 'PERCENT' && editForm.commissionValue.trim()
                    ? Number(editForm.commissionValue)
                    : null,
                sellerCompensationContributionFlat:
                  editForm.commissionMode === 'FLAT' && editForm.commissionValue.trim()
                    ? Number(editForm.commissionValue)
                    : null,
              },
            }
          : {}),
      });
      closeManageDeal();
      await fetchDeals();
    } catch (err) {
      console.error('Failed to save deal changes:', err);
      const message = (err as any)?.response?.data?.error || 'Unable to save deal changes.';
      setManageError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const archiveDeal = async (deal: DealCard, reason?: string) => {
    setManageError(null);
    setManageNotice(null);
    await api.patch(`/deals/${deal.id}/archive`, { reason: reason || 'Archived from deals board' });
    setManageNotice('Deal archived.');
    await fetchDeals();
  };

  const unarchiveDeal = async (deal: DealCard) => {
    setManageError(null);
    setManageNotice(null);
    await api.patch(`/deals/${deal.id}/unarchive`);
    setManageNotice('Deal restored from archive.');
    await fetchDeals();
  };

  const openActivity = async (deal: DealCard) => {
    setActivityDeal(deal);
    setIsActivityLoading(true);
    setActivityItems([]);
    try {
      const res = await api.get(`/deals/${deal.id}/activity`);
      setActivityItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      console.error('Failed to load deal activity:', err);
      setActivityItems([]);
    } finally {
      setIsActivityLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDeal(dealId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: DealStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnStatus);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: DealStatus) => {
    e.preventDefault();
    if (draggedDeal) {
      await moveStatus(draggedDeal, targetStatus);
    }
    setDraggedDeal(null);
    setDragOverColumn(null);
  };

  const activeDeals = deals.filter(
    (d) => !d.archivedAt && d.status !== 'CLOSED' && d.status !== 'FELL_THROUGH'
  );
  const closedDeals = deals.filter(
    (d) => !d.archivedAt && (d.status === 'CLOSED' || d.status === 'FELL_THROUGH')
  );
  const archivedDeals = deals.filter((d) => Boolean(d.archivedAt));
  const dealHealth = activeDeals.reduce(
    (acc, deal) => {
      const nextDeadline = getNextDeadline(deal);
      const urgency = getUrgencyLevel(nextDeadline?.date || null);
      if (urgency === 'critical') acc.critical += 1;
      else if (urgency === 'warning') acc.warning += 1;
      else acc.normal += 1;
      return acc;
    },
    { critical: 0, warning: 0, normal: 0 }
  );
  const docsSummary = activeDeals.reduce(
    (acc, deal) => {
      const summary = getDealDocsSummary(deal);
      acc.signed += summary.signed;
      acc.pending += summary.pending;
      acc.draft += summary.draft;
      return acc;
    },
    { signed: 0, pending: 0, draft: 0 }
  );
  const activeVolume = activeDeals.reduce((sum, deal) => sum + getDealPrice(deal), 0);
  const activeCommission = activeDeals.reduce((sum, deal) => sum + getDealCommission(deal), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading deals...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="text-sm text-slate-300">{error}</div>
        <button
          type="button"
          onClick={fetchDeals}
          className="rounded-full border border-blue-400/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 relative">
      <canvas className="pointer-events-none fixed inset-0 z-[9999]" />
      <div className="rounded-[24px] border border-white/10 bg-slate-950/70 px-5 py-5 md:px-6 md:py-6 shadow-[0_18px_45px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Deal Health Radar</div>
            <div className="text-sm text-slate-200">Key dates at a glance</div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-red-200">
              {dealHealth.critical} critical
            </span>
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              {dealHealth.warning} upcoming
            </span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
              {dealHealth.normal} stable
            </span>
            <button
              onClick={() => navigate('/contracts')}
              className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20"
            >
              Review deadlines
            </button>
            <div className="ml-1 hidden sm:flex items-center rounded-full border border-white/10 bg-white/5 p-0.5">
              <button
                type="button"
                onClick={() => setPipelineLayout('compact')}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  pipelineLayout === 'compact'
                    ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-400/40'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Compact View
              </button>
              <button
                type="button"
                onClick={() => setPipelineLayout('board')}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  pipelineLayout === 'board'
                    ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-400/40'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Board View
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-950/65 px-5 py-5 md:px-6 md:py-6 shadow-[0_14px_38px_rgba(0,0,0,0.45)]">
        <div className="text-sm font-semibold text-white">Deal Overview</div>
        <div className="text-xs text-slate-400 mt-1">Unified snapshot for pipeline, risks, and paperwork.</div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-3.5">
            <div className="text-slate-500">Active deals</div>
            <div className="mt-1 text-lg font-semibold text-white">{activeDeals.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-3.5">
            <div className="text-slate-500">Pipeline volume</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{formatCurrency(activeVolume)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-3.5">
            <div className="text-slate-500">Projected commission</div>
            <div className="mt-1 text-lg font-semibold text-amber-300">{formatCurrency(activeCommission)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-3.5">
            <div className="text-slate-500">Critical deadlines</div>
            <div className="mt-1 text-lg font-semibold text-red-300">{dealHealth.critical}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-3.5">
            <div className="text-slate-500">Pending docs</div>
            <div className="mt-1 text-lg font-semibold text-amber-300">{docsSummary.pending}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3.5 py-3.5">
            <div className="text-slate-500">Signed docs</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{docsSummary.signed}</div>
          </div>
        </div>
      </div>

      <div
        className={
          pipelineLayout === 'compact'
            ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
            : 'flex gap-4 overflow-x-auto pb-3'
        }
      >
        {columns.map((col) => {
        const colorSet = colorClasses[col.color];
        const colDeals = activeDeals.filter((d) => d.status === col.key);
        const colVolume = colDeals.reduce((sum, deal) => sum + getDealPrice(deal), 0);
        const colCommission = colDeals.reduce((sum, deal) => sum + getDealCommission(deal), 0);
        return (
          <section
            key={col.key}
            className={`flex ${pipelineLayout === 'compact' ? 'w-full min-h-[280px]' : 'w-[320px] flex-shrink-0'} flex-col rounded-[28px] border ${
              dragOverColumn === col.key ? 'border-blue-400/70 bg-blue-500/10' : 'border-white/10'
            } bg-slate-900/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.55)] relative overflow-hidden transition-all duration-200`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className={`absolute inset-0 pointer-events-none bg-gradient-to-b ${colorSet.glow} via-transparent to-transparent opacity-30`} />
            <header className="flex items-center justify-between px-4 pt-3.5 pb-2.5 relative z-10">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Pipeline</p>
                <h3 className="text-sm font-semibold text-slate-50">{col.label}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-300">
                  <span>{colDeals.length} deal{colDeals.length === 1 ? '' : 's'}</span>
                  <span className="text-emerald-300">{formatCurrency(colVolume)}</span>
                  <span className="text-amber-300">{formatCurrency(colCommission)} est. comm</span>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-50">
                {colDeals.length} Active
              </span>
            </header>
            <div className="flex-1 space-y-3 px-3 pb-3 pt-1 overflow-y-auto relative z-10">
              {colDeals.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-slate-500 text-sm">No deals yet</div>
                  <div className="text-slate-600 text-xs mt-1">Drag deals here</div>
                </div>
              ) : (
                colDeals.map((deal) => {
                  const nextDeadline = getNextDeadline(deal);
                  const urgency = getUrgencyLevel(nextDeadline?.date || null);
                  const urgencyStyle = urgencyStyles[urgency];
                  const docsSummary = getDealDocsSummary(deal);
                  const purchasePrice = getDealPrice(deal);
                  const estimatedCommission = getDealCommission(deal);
                  const mapQuery = deal.property?.street
                    ? `${deal.property.street}, ${deal.property.city || ''}`.trim()
                    : deal.title;
                  return (
                  <article
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    onDragEnd={handleDragEnd}
                    className={`group rounded-2xl border ${urgencyStyle.border} bg-slate-950/80 px-3 py-3.5 ${urgencyStyle.glow} transition-transform duration-150 hover:-translate-y-0.5 hover:border-blue-400/60 cursor-move relative ${
                      draggedDeal === deal.id ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    <div className="absolute top-2 right-2 z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(menuOpen === deal.id ? null : deal.id);
                        }}
                        className="rounded-full p-1 hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {menuOpen === deal.id && (
                        <div className="absolute right-0 mt-1 w-48 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] py-1 z-30">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(null);
                              openManageDeal(deal);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-cyan-200 hover:bg-white/10 transition-colors"
                          >
                            Manage Deal
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setMenuOpen(null);
                              await openActivity(deal);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-violet-200 hover:bg-white/10 transition-colors"
                          >
                            View Activity
                          </button>
                          <div className="border-t border-white/10 my-1" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(null);
                              navigate(`/deals/${deal.id}/repc`);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors"
                          >
                            Open REPC
                          </button>
                          <div className="border-t border-white/10 my-1" />
                          {columns.filter(c => c.key !== deal.status && c.key !== 'CLOSED' && c.key !== 'FELL_THROUGH').map((targetCol) => (
                            <button
                              key={targetCol.key}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await moveStatus(deal.id, targetCol.key);
                                setMenuOpen(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors"
                            >
                              Move to {targetCol.label}
                            </button>
                          ))}
                          <div className="border-t border-white/10 my-1" />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await moveStatus(deal.id, 'CLOSED');
                              setMenuOpen(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-green-300 hover:bg-white/10 transition-colors"
                          >
                            Mark as Closed
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await archiveDeal(deal, editForm.archiveReason);
                              setMenuOpen(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-amber-300 hover:bg-white/10 transition-colors"
                          >
                            Archive Deal
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div>
                        <p className="line-clamp-2 text-[13px] font-semibold text-slate-50 group-hover:text-blue-300 transition-colors">
                          {deal.title}
                        </p>
                        {deal.property?.street && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                            {deal.property.street}, {deal.property.city}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100">
                        {col.label}
                      </span>
                    </div>

                    {(deal.buyer || deal.seller) && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {deal.buyer && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            {deal.buyer.firstName} {deal.buyer.lastName}
                          </span>
                        )}
                        {deal.seller && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {deal.seller.firstName} {deal.seller.lastName}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mb-2">
                      <DealHealthBadge
                        lastActivityAt={deal.lastActivityAt}
                        status={deal.status}
                        repc={deal.repc}
                      />
                    </div>

                    <div className="mb-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        <span>Contracts & Forms</span>
                        <span>{docsSummary.total} total</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Signed {docsSummary.signed}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          Pending {docsSummary.pending}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                          Draft {docsSummary.draft}
                        </span>
                      </div>
                    </div>

                    <div className="mb-2 rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Deal value</div>
                          <div className="text-sm font-semibold text-emerald-300">{formatCurrency(purchasePrice)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Potential commission</div>
                          <div className="text-sm font-semibold text-amber-300">{formatCurrency(estimatedCommission)}</div>
                          <div className="text-[10px] text-slate-500">{getCommissionModeLabel(deal)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-0.5 flex justify-between text-[10px] text-slate-500">
                          <span>{microFlow[Math.min(statusProgressIndex[deal.status] ?? 0, microFlow.length - 1)].label}</span>
                          <span>{microFlow[Math.min((statusProgressIndex[deal.status] ?? 0) + 1, microFlow.length - 1)].label}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-500"
                            style={{ width: `${Math.round(((statusProgressIndex[deal.status] ?? 0) / (microFlow.length - 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      {nextDeadline && (
                        <div className="ml-1 flex flex-col items-end">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${urgencyStyle.badge}`}>
                            {urgency === 'critical' && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                            {nextDeadline.label}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-50 mt-0.5">
                            {nextDeadline.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/deals/${deal.id}/repc`);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-100 hover:bg-white/10"
                        >
                          REPC
                        </button>
                        {mapQuery && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                          >
                            🗺️ Map
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openManageDeal(deal);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-200 hover:bg-blue-500/20"
                      >
                        Manage
                      </button>
                    </div>
                  </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
      
      {closedDeals.length > 0 && (
        <section className="flex w-[320px] flex-shrink-0 flex-col rounded-[28px] border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.55)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-slate-500/20 via-transparent to-transparent opacity-30" />
          <header className="flex items-center justify-between px-4 pt-3.5 pb-2.5 relative z-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Completed</p>
              <h3 className="text-sm font-semibold text-slate-50">Closed Deals</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-300">
                <span>{closedDeals.length} deal{closedDeals.length === 1 ? '' : 's'}</span>
                <span className="text-emerald-300">{formatCurrency(closedDeals.reduce((sum, deal) => sum + getDealPrice(deal), 0))}</span>
                <span className="text-amber-300">{formatCurrency(closedDeals.reduce((sum, deal) => sum + getDealCommission(deal), 0))} comm</span>
              </div>
            </div>
            <button
              onClick={() => setShowClosed(!showClosed)}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-50 hover:bg-white/15 transition-colors"
            >
              {showClosed ? 'Hide' : 'Show'} {closedDeals.length}
            </button>
          </header>
          {showClosed && (
            <div className="flex-1 space-y-3 px-3 pb-3 pt-1 overflow-y-auto max-h-[400px] relative z-10">
              {closedDeals.map((deal) => (
                (() => {
                  const docsSummary = getDealDocsSummary(deal);
                  return (
                <article
                  key={deal.id}
                  className="group rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3.5 shadow-[0_8px_18px_rgba(0,0,0,0.4)] transition-opacity duration-150 hover:opacity-80 cursor-pointer"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="line-clamp-2 text-[13px] font-semibold text-slate-50">
                        {deal.title}
                      </p>
                      {deal.property?.street && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                          {deal.property.street}, {deal.property.city}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      deal.status === 'CLOSED' ? 'bg-green-500/20 text-green-100' : 'bg-slate-500/20 text-slate-300'
                    }`}>
                      {deal.status === 'CLOSED' ? 'Closed' : 'Lost'}
                    </span>
                  </div>
                  {(deal.buyer || deal.seller) && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {deal.buyer && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/5 px-2.5 py-1 text-[11px] font-medium text-blue-200/70">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400/50" />
                          {deal.buyer.firstName} {deal.buyer.lastName}
                        </span>
                      )}
                      {deal.seller && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-200/70">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
                          {deal.seller.firstName} {deal.seller.lastName}
                        </span>
                      )}
                    </div>
                  )}
                  {deal.repc?.settlementDeadline && (
                    <div className="text-[11px] text-slate-400">
                      Settled: {new Date(deal.repc.settlementDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200/90">Signed {docsSummary.signed}</span>
                    <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-amber-200/90">Pending {docsSummary.pending}</span>
                    <span className="inline-flex items-center rounded-full border border-slate-400/25 bg-slate-500/10 px-2 py-0.5 text-slate-200/90">Draft {docsSummary.draft}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openManageDeal(deal);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-200 hover:bg-blue-500/20"
                    >
                      Manage
                    </button>
                    {(deal.property?.street || deal.title) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deal.property?.street ? `${deal.property.street}, ${deal.property.city || ''}`.trim() : deal.title)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                      >
                        🗺️ Map
                      </a>
                    )}
                  </div>
                </article>
                  );
                })()
              ))}
            </div>
          )}
        </section>
      )}

      {archivedDeals.length > 0 && (
        <section className="flex w-[340px] flex-shrink-0 flex-col rounded-[28px] border border-amber-400/20 bg-slate-900/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.55)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-amber-500/20 via-transparent to-transparent opacity-40" />
          <header className="flex items-center justify-between px-4 pt-3.5 pb-2.5 relative z-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/80">Long-Term Archive</p>
              <h3 className="text-sm font-semibold text-slate-50">Archived Deals</h3>
            </div>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-50 hover:bg-white/15 transition-colors"
            >
              {showArchived ? 'Hide' : 'Show'} {archivedDeals.length}
            </button>
          </header>
          {showArchived && (
            <div className="flex-1 space-y-3 px-3 pb-3 pt-1 overflow-y-auto max-h-[420px] relative z-10">
              {archivedDeals.map((deal) => (
                <article
                  key={deal.id}
                  className="rounded-2xl border border-amber-400/20 bg-slate-950/70 px-3 py-3.5 shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="line-clamp-2 text-[13px] font-semibold text-slate-50">{deal.title}</p>
                      {deal.property?.street && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                          {deal.property.street}, {deal.property.city}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                      Archived
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <div>
                      Archived: {deal.archivedAt ? new Date(deal.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </div>
                    <div>Retention: {typeof deal.archiveAfterDays === 'number' ? `${deal.archiveAfterDays} days` : 'Default'}</div>
                    {deal.archivedReason && <div className="line-clamp-2">Reason: {deal.archivedReason}</div>}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openManageDeal(deal);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                    >
                      Manage
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await unarchiveDeal(deal);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await openActivity(deal);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20"
                    >
                      Activity
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>

    {isManageOpen && editingDeal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => !isSaving && closeManageDeal()}>
        <div
          className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.8)] max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Deal Control Center</div>
              <h3 className="text-lg font-semibold text-white mt-1">Manage Deal</h3>
            </div>
            <button
              onClick={closeManageDeal}
              className="rounded-full px-2 py-1 text-slate-400 hover:text-white hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-100">
            <div className="font-semibold">Agent quick controls</div>
            <div className="mt-1 text-cyan-100/80">Update status, clients, and property in one place. Changes save directly to this deal record.</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/deals/${editingDeal.id}/repc`)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/10"
              >
                Open REPC
              </button>
              <button
                type="button"
                onClick={() => openActivity(editingDeal)}
                className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20"
              >
                View Timeline
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editForm.propertyStreet || editForm.title || editingDeal.title)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                Open Map
              </a>
            </div>
          </div>

          {/* Deal Timeline Visualization */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <DealTimeline
              status={editingDeal.status}
              repc={editingDeal.repc}
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(manageError || manageNotice) && (
              <div className="lg:col-span-2">
                {manageError && (
                  <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    {manageError}
                  </div>
                )}
                {manageNotice && (
                  <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    {manageNotice}
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] text-slate-400">Deal Title</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as DealStatus }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              >
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Offer Reference Date</label>
              <input
                type="date"
                value={editForm.offerReferenceDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, offerReferenceDate: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Auto-Archive After (days)</label>
              <input
                type="number"
                min={0}
                max={3650}
                value={editForm.archiveAfterDays}
                onChange={(e) => setEditForm((prev) => ({ ...prev, archiveAfterDays: Number(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
              <div className="mt-1 text-[10px] text-slate-500">Set to 0 to disable auto-archive.</div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Commission Tracking</div>
                  <div className="mt-1 text-xs text-amber-100/80">
                    Save deal value and projected commission from this board. Reporting will use the same numbers.
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
                  Est. {formatCurrency(editingDeal.repc ? (() => {
                    const draftPrice = Number(editForm.purchasePrice || 0) || 0;
                    if (editForm.commissionMode === 'FLAT') return Number(editForm.commissionValue || 0) || 0;
                    const rate = editForm.commissionMode === 'PERCENT'
                      ? Number(editForm.commissionValue || 0) || 0
                      : DEFAULT_COMMISSION_RATE;
                    return draftPrice * (rate / 100);
                  })() : 0)}
                </div>
              </div>
              {editingDeal.repc ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Deal Value</label>
                    <input
                      type="number"
                      min={0}
                      step="1000"
                      value={editForm.purchasePrice}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
                      placeholder="450000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Commission Type</label>
                    <select
                      value={editForm.commissionMode}
                      onChange={(e) => setEditForm((prev) => ({
                        ...prev,
                        commissionMode: e.target.value as CommissionMode,
                        commissionValue: e.target.value === 'DEFAULT' ? '' : prev.commissionValue,
                      }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
                    >
                      <option value="DEFAULT">Default {DEFAULT_COMMISSION_RATE}%</option>
                      <option value="PERCENT">Percent of price</option>
                      <option value="FLAT">Flat amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      {editForm.commissionMode === 'FLAT' ? 'Flat Commission' : 'Commission %'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={editForm.commissionMode === 'FLAT' ? '100' : '0.1'}
                      disabled={editForm.commissionMode === 'DEFAULT'}
                      value={editForm.commissionValue}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, commissionValue: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder={editForm.commissionMode === 'FLAT' ? '12000' : '2.5'}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                  This deal does not have a REPC record yet. Open the REPC first, then you can track purchase price and commission here.
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Archive Reason (optional)</label>
              <input
                value={editForm.archiveReason}
                onChange={(e) => setEditForm((prev) => ({ ...prev, archiveReason: e.target.value }))}
                placeholder="Why archive this deal?"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="lg:col-span-2 mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Property</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-[11px] text-slate-400">Street</label>
                  <input
                    value={editForm.propertyStreet}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyStreet: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">City</label>
                  <input
                    value={editForm.propertyCity}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyCity: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">State</label>
                  <input
                    value={editForm.propertyState}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyState: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">ZIP</label>
                  <input
                    value={editForm.propertyZip}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyZip: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">County</label>
                  <input
                    value={editForm.propertyCounty}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyCounty: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Tax ID</label>
                  <input
                    value={editForm.propertyTaxId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyTaxId: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">MLS ID</label>
                  <input
                    value={editForm.propertyMlsId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, propertyMlsId: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200">Buyer</div>
                {editingDeal.buyer?.id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${editingDeal.buyer?.id}`)}
                    className="rounded-full border border-blue-300/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-100 hover:bg-blue-500/20"
                  >
                    Open Client
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="First name"
                  value={editForm.buyerFirstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, buyerFirstName: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Last name"
                  value={editForm.buyerLastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, buyerLastName: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Email"
                  value={editForm.buyerEmail}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, buyerEmail: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Phone"
                  value={editForm.buyerPhone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, buyerPhone: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Seller</div>
                {editingDeal.seller?.id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${editingDeal.seller?.id}`)}
                    className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Open Client
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="First name"
                  value={editForm.sellerFirstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sellerFirstName: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Last name"
                  value={editForm.sellerLastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sellerLastName: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Email"
                  value={editForm.sellerEmail}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sellerEmail: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <input
                  placeholder="Phone"
                  value={editForm.sellerPhone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sellerPhone: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={saveDealChanges}
              disabled={isSaving || !editForm.title.trim()}
              className="rounded-full bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {editingDeal.archivedAt ? (
              <button
                onClick={async () => {
                  await unarchiveDeal(editingDeal);
                  closeManageDeal();
                }}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                Restore from Archive
              </button>
            ) : (
              <button
                onClick={async () => {
                  await archiveDeal(editingDeal, editForm.archiveReason);
                  closeManageDeal();
                }}
                className="rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                Archive Deal
              </button>
            )}
            <button
              onClick={closeManageDeal}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {activityDeal && (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setActivityDeal(null)}>
        <div
          className="h-full w-full max-w-xl border-l border-white/10 bg-slate-950/95 shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-violet-300">Deal Timeline</div>
              <h3 className="text-base font-semibold text-white mt-1 line-clamp-1">{activityDeal.title}</h3>
            </div>
            <button
              onClick={() => setActivityDeal(null)}
              className="rounded-full px-2 py-1 text-slate-400 hover:text-white hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="h-[calc(100%-82px)] overflow-y-auto px-5 py-4">
            {isActivityLoading ? (
              <div className="text-sm text-slate-400">Loading activity…</div>
            ) : activityItems.length === 0 ? (
              <div className="text-sm text-slate-400">No activity yet for this deal.</div>
            ) : (
              <div className="space-y-2">
                {activityItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                      <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {item.type}
                      </span>
                    </div>
                    {item.description && (
                      <div className="mt-1 text-xs text-slate-400">{item.description}</div>
                    )}
                    <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {new Date(item.at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
