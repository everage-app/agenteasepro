import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { Badge } from '../../components/ui/Badge';
import { DealHealthBadge } from '../../components/deals/DealHealthBadge';
import { DealTimeline } from '../../components/deals/DealTimeline';

/* ──────────────────────── Types ──────────────────────── */

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

interface DealDetail {
  id: string;
  title: string;
  status: DealStatus;
  offerReferenceDate?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  lastActivityAt?: string | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  archiveAfterDays?: number;
  property?: {
    id?: string;
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
  repc?: {
    id?: string;
    purchasePrice?: number;
    earnestMoney?: number;
    settlementDeadline?: string | null;
    sellerDisclosureDeadline?: string | null;
    dueDiligenceDeadline?: string | null;
    financingAppraisalDeadline?: string | null;
  } | null;
  forms?: Array<{
    id: string;
    status?: string | null;
    title?: string;
    updatedAt?: string;
    definition?: { code?: string; displayName?: string };
  }>;
  signatureEnvelopes?: Array<{
    id: string;
    type?: string;
    completedAt?: string | null;
    createdAt?: string;
    signers?: Array<{
      id: string;
      name?: string;
      email?: string;
      viewedAt?: string | null;
      signedAt?: string | null;
    }>;
  }>;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  at: string;
  meta?: Record<string, unknown>;
}

type Tab = 'overview' | 'documents' | 'activity' | 'notes';

/* ──────────────────────── Helpers ──────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  LEAD:                 { label: 'Lead',       dot: 'bg-slate-400',   bg: 'bg-slate-500/20 text-slate-200' },
  ACTIVE:               { label: 'Active',     dot: 'bg-blue-400',   bg: 'bg-blue-500/20 text-blue-200' },
  OFFER_SENT:           { label: 'Offer Sent', dot: 'bg-purple-400', bg: 'bg-purple-500/20 text-purple-200' },
  UNDER_CONTRACT:       { label: 'Under Contract', dot: 'bg-emerald-400', bg: 'bg-emerald-500/20 text-emerald-200' },
  DUE_DILIGENCE:        { label: 'Due Diligence',  dot: 'bg-teal-400',    bg: 'bg-teal-500/20 text-teal-200' },
  FINANCING:            { label: 'Financing',  dot: 'bg-cyan-400',   bg: 'bg-cyan-500/20 text-cyan-200' },
  SETTLEMENT_SCHEDULED: { label: 'Settlement', dot: 'bg-violet-400', bg: 'bg-violet-500/20 text-violet-200' },
  CLOSED:               { label: 'Closed',     dot: 'bg-green-400',  bg: 'bg-green-500/20 text-green-200' },
  FELL_THROUGH:         { label: 'Fell Through', dot: 'bg-red-400',  bg: 'bg-red-500/20 text-red-200' },
};

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (n?: number | null) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

const fullName = (p?: { firstName?: string; lastName?: string } | null) => {
  if (!p) return '—';
  return `${p.firstName || ''} ${p.lastName || ''}`.trim() || '—';
};

const daysUntil = (d?: string | null) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

const deadlineUrgency = (days: number | null): string => {
  if (days === null) return 'text-slate-400';
  if (days < 0) return 'text-red-400 font-semibold';
  if (days <= 3) return 'text-red-300';
  if (days <= 7) return 'text-amber-300';
  return 'text-slate-300';
};

/* ──────────────────────── Component ──────────────────────── */

export function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  // Activity tab state
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Notes tab state
  const [notes, setNotes] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  /* ── Fetch deal ── */
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/deals/${dealId}`);
        if (!cancelled) setDeal(res.data);
      } catch {
        if (!cancelled) setError('Failed to load deal.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [dealId]);

  /* ── Fetch activity when tab opens ── */
  useEffect(() => {
    if (tab !== 'activity' || !dealId) return;
    let cancelled = false;
    const load = async () => {
      setActivityLoading(true);
      try {
        const res = await api.get(`/deals/${dealId}/activity`);
        if (!cancelled) setActivity(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch {
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tab, dealId]);

  /* ── Document stats ── */
  const docStats = useMemo(() => {
    if (!deal) return { signed: 0, pending: 0, draft: 0, total: 0 };
    let signed = 0, pending = 0, draft = 0;
    (deal.forms || []).forEach(f => {
      const s = String(f.status || 'DRAFT').toUpperCase();
      if (s === 'SIGNED') signed++;
      else if (['PARTIALLY_SIGNED', 'VIEWED', 'SENT'].includes(s)) pending++;
      else draft++;
    });
    (deal.signatureEnvelopes || []).forEach(e => {
      const signers = e.signers || [];
      const allSigned = signers.length > 0 && signers.every(s => !!s.signedAt);
      if (e.completedAt || allSigned) signed++;
      else pending++;
    });
    return { signed, pending, draft, total: signed + pending + draft };
  }, [deal]);

  /* ── Deadline rows ── */
  const deadlines = useMemo(() => {
    if (!deal?.repc) return [];
    return [
      { label: 'Seller Disclosure', date: deal.repc.sellerDisclosureDeadline },
      { label: 'Due Diligence', date: deal.repc.dueDiligenceDeadline },
      { label: 'Financing & Appraisal', date: deal.repc.financingAppraisalDeadline },
      { label: 'Settlement', date: deal.repc.settlementDeadline },
    ].filter(d => d.date);
  }, [deal]);

  /* ── Render ── */

  if (loading) {
    return (
      <PageLayout title="Deal">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !deal) {
    return (
      <PageLayout title="Deal" breadcrumbs={[{ label: 'Deals', href: '/deals' }, { label: 'Not Found' }]}>
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg mb-4">{error || 'Deal not found.'}</p>
          <button onClick={() => navigate('/deals')} className="text-cyan-400 hover:text-cyan-300 underline">
            Back to Deals
          </button>
        </div>
      </PageLayout>
    );
  }

  const sc = statusConfig[deal.status] || statusConfig.ACTIVE;
  const address = [deal.property?.street, deal.property?.city, deal.property?.state, deal.property?.zip].filter(Boolean).join(', ') || deal.title;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents', count: docStats.total },
    { key: 'activity', label: 'Activity' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <PageLayout
      title={deal.title || address}
      subtitle={address !== deal.title ? address : undefined}
      breadcrumbs={[{ label: 'Deals', href: '/deals' }, { label: deal.title || 'Detail' }]}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to={`/deals/${deal.id}/cockpit`}
            className="px-4 py-2 text-sm rounded-xl border border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-100 transition-all"
          >
            Deal Cockpit
          </Link>
          <Link
            to={`/deals/${deal.id}/repc`}
            className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-cyan-500/40 bg-white/5 hover:bg-cyan-500/10 text-slate-200 transition-all"
          >
            REPC Wizard
          </Link>
          <button
            onClick={() => navigate(`/deals/${deal.id}`)}
            className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 transition-all"
          >
            Kanban View
          </button>
        </div>
      }
    >
      {/* ── Status bar + health ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${sc.bg}`}>
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          {sc.label}
        </span>
        <DealHealthBadge
          lastActivityAt={deal.lastActivityAt}
          status={deal.status}
          repc={deal.repc}
        />
        {deal.archivedAt && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
            Archived {deal.archivedReason ? `— ${deal.archivedReason}` : ''}
          </span>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="mb-8 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
        <DealTimeline
          status={deal.status}
          createdAt={deal.createdAt}
          closedAt={deal.closedAt}
          repc={deal.repc}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-white/10">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'overview' && <OverviewTab deal={deal} deadlines={deadlines} />}
      {tab === 'documents' && <DocumentsTab deal={deal} docStats={docStats} />}
      {tab === 'activity' && <ActivityTab items={activity} loading={activityLoading} />}
      {tab === 'notes' && (
        <NotesTab
          notes={notes}
          draft={noteDraft}
          saving={noteSaving}
          onDraftChange={setNoteDraft}
          onSave={async () => {
            if (!noteDraft.trim()) return;
            setNoteSaving(true);
            try {
              await api.post(`/deals/${dealId}/activity`, {
                type: 'NOTE',
                title: 'Note added',
                description: noteDraft.trim(),
              });
              setNotes(prev => prev ? `${noteDraft.trim()}\n\n${prev}` : noteDraft.trim());
              setNoteDraft('');
              // Refresh activity
              const res = await api.get(`/deals/${dealId}/activity`);
              setActivity(Array.isArray(res.data?.items) ? res.data.items : []);
            } catch {
              // silent
            } finally {
              setNoteSaving(false);
            }
          }}
        />
      )}
    </PageLayout>
  );
}

/* ══════════════════════════ Overview Tab ══════════════════════════ */

function OverviewTab({ deal, deadlines }: { deal: DealDetail; deadlines: { label: string; date?: string | null }[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left: Key Details ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Property */}
        <Card title="Property">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <KV label="Street" value={deal.property?.street} />
            <KV label="City" value={deal.property?.city} />
            <KV label="State" value={deal.property?.state} />
            <KV label="Zip" value={deal.property?.zip} />
            <KV label="County" value={deal.property?.county} />
            <KV label="Tax / Parcel ID" value={deal.property?.taxId} />
            <KV label="MLS ID" value={deal.property?.mlsId} />
          </div>
        </Card>

        {/* Financials */}
        {deal.repc && (
          <Card title="Financials">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <KV label="Purchase Price" value={formatCurrency(deal.repc.purchasePrice)} />
              <KV label="Earnest Money" value={formatCurrency(deal.repc.earnestMoney)} />
              <KV label="Offer Reference Date" value={formatDate(deal.offerReferenceDate)} />
            </div>
          </Card>
        )}

        {/* Deadlines */}
        {deadlines.length > 0 && (
          <Card title="Key Deadlines">
            <div className="space-y-3">
              {deadlines.map((dl, i) => {
                const days = daysUntil(dl.date);
                const urgency = deadlineUrgency(days);
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-slate-300 text-sm">{dl.label}</span>
                    <div className="text-right">
                      <span className={`text-sm ${urgency}`}>{formatDate(dl.date)}</span>
                      {days !== null && (
                        <span className={`ml-2 text-xs ${urgency}`}>
                          ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ── Right: Parties + Quick Info ── */}
      <div className="space-y-6">
        {/* Buyer */}
        <Card title="Buyer">
          {deal.buyer ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Avatar first={deal.buyer.firstName} last={deal.buyer.lastName} />
                <div>
                  <p className="text-slate-200 font-medium">{fullName(deal.buyer)}</p>
                  {deal.buyer.email && <p className="text-slate-400 text-xs">{deal.buyer.email}</p>}
                </div>
              </div>
              {deal.buyer.phone && <KV label="Phone" value={deal.buyer.phone} />}
              {deal.buyer.id && (
                <Link to={`/clients/${deal.buyer.id}`} className="text-xs text-cyan-400 hover:underline">
                  View client profile →
                </Link>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">No buyer assigned</p>
          )}
        </Card>

        {/* Seller */}
        <Card title="Seller">
          {deal.seller ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Avatar first={deal.seller.firstName} last={deal.seller.lastName} />
                <div>
                  <p className="text-slate-200 font-medium">{fullName(deal.seller)}</p>
                  {deal.seller.email && <p className="text-slate-400 text-xs">{deal.seller.email}</p>}
                </div>
              </div>
              {deal.seller.phone && <KV label="Phone" value={deal.seller.phone} />}
              {deal.seller.id && (
                <Link to={`/clients/${deal.seller.id}`} className="text-xs text-cyan-400 hover:underline">
                  View client profile →
                </Link>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">No seller assigned</p>
          )}
        </Card>

        {/* Quick Stats */}
        <Card title="Quick Info">
          <div className="space-y-2 text-sm">
            <KV label="Created" value={formatDate(deal.createdAt)} />
            <KV label="Last Activity" value={formatDate(deal.lastActivityAt)} />
            {deal.closedAt && <KV label="Closed" value={formatDate(deal.closedAt)} />}
            <KV label="Updated" value={formatDate(deal.updatedAt)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════ Documents Tab ══════════════════════════ */

function DocumentsTab({ deal, docStats }: { deal: DealDetail; docStats: { signed: number; pending: number; draft: number; total: number } }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={docStats.total} color="text-slate-200" />
        <StatCard label="Signed" value={docStats.signed} color="text-green-400" />
        <StatCard label="Pending" value={docStats.pending} color="text-amber-400" />
        <StatCard label="Draft" value={docStats.draft} color="text-slate-400" />
      </div>

      {/* Forms */}
      {(deal.forms || []).length > 0 && (
        <Card title="Forms">
          <div className="divide-y divide-white/5">
            {deal.forms!.map(form => {
              const statusLabel = String(form.status || 'DRAFT').toUpperCase();
              const statusClass =
                statusLabel === 'SIGNED' ? 'bg-green-500/20 text-green-300' :
                statusLabel === 'DRAFT' ? 'bg-slate-500/20 text-slate-300' :
                'bg-amber-500/20 text-amber-300';
              return (
                <div key={form.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-slate-200">{form.definition?.displayName || form.title || 'Untitled Form'}</p>
                    {form.definition?.code && <p className="text-xs text-slate-500">{form.definition.code}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClass}`}>{statusLabel}</span>
                    {form.definition?.code && (
                      <button
                        onClick={() => navigate(`/deals/${deal.id}/forms/${form.definition!.code}`)}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Signature Envelopes */}
      {(deal.signatureEnvelopes || []).length > 0 && (
        <Card title="E-Signatures">
          <div className="divide-y divide-white/5">
            {deal.signatureEnvelopes!.map(env => {
              const signers = env.signers || [];
              const signedCount = signers.filter(s => !!s.signedAt).length;
              const isComplete = !!env.completedAt || (signers.length > 0 && signedCount === signers.length);
              return (
                <div key={env.id} className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-200">{env.type || 'Envelope'}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isComplete ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {isComplete ? 'Complete' : `${signedCount}/${signers.length} signed`}
                    </span>
                  </div>
                  {signers.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {signers.map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.signedAt ? 'bg-green-400' : s.viewedAt ? 'bg-amber-400' : 'bg-slate-600'}`} />
                          <span>{s.name || s.email || 'Signer'}</span>
                          <span className="text-slate-600">
                            {s.signedAt ? `Signed ${formatDate(s.signedAt)}` : s.viewedAt ? `Viewed ${formatDate(s.viewedAt)}` : 'Not viewed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {docStats.total === 0 && (
        <div className="text-center text-slate-500 py-12">
          <p>No documents yet.</p>
          <p className="text-xs mt-1">Create forms or start an e-signature flow from the Contracts page.</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ Activity Tab ══════════════════════════ */

function ActivityTab({ items, loading }: { items: ActivityItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-slate-500 py-16">
        <p>No activity recorded yet.</p>
      </div>
    );
  }

  const iconFor = (type: string) => {
    switch (type) {
      case 'DEAL': return '📋';
      case 'EVENT': return '📅';
      case 'TASK': return '✅';
      case 'FORM': return '📄';
      case 'ADDENDUM': return '📎';
      case 'ESIGN': return '✍️';
      case 'NOTE': return '📝';
      default: return '•';
    }
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
      <div className="space-y-0">
        {items.map(item => (
          <div key={item.id} className="relative pl-10 py-3">
            {/* Dot */}
            <div className="absolute left-2.5 top-5 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-500 z-10" />
            <div className="flex items-start justify-between">
              <div>
                <span className="mr-2">{iconFor(item.type)}</span>
                <span className="text-sm text-slate-200">{item.title}</span>
                {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap ml-4">{formatDate(item.at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════ Notes Tab ══════════════════════════ */

function NotesTab({
  notes,
  draft,
  saving,
  onDraftChange,
  onSave,
}: {
  notes: string;
  draft: string;
  saving: boolean;
  onDraftChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card title="Add Note">
        <textarea
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          rows={4}
          placeholder="Write a note about this deal…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={onSave}
            disabled={saving || !draft.trim()}
            className="px-4 py-2 text-sm rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </Card>

      {notes && (
        <Card title="Previous Notes">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{notes}</pre>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════ Shared Sub-components ══════════════════════════ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-slate-200 mt-0.5">{value || '—'}</p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function Avatar({ first, last }: { first?: string; last?: string }) {
  const initials = `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '??';
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center text-xs font-medium text-cyan-200">
      {initials}
    </div>
  );
}
