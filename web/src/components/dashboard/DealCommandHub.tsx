import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { AIDailyPlan } from '../ai/AIDailyPlan';
import { contactEmailApi, RecentReplyItem } from '../../lib/contactEmailApi';
import { NextBestActionRail } from './NextBestActionRail';
import { RecentRepliesWidget } from './RecentRepliesWidget';

type DashboardDeal = {
  id: string;
  title?: string;
  status: string;
  lastActivityAt?: string | null;
  updatedAt?: string;
  property?: {
    street?: string;
  } | null;
  buyer?: {
    firstName?: string;
    lastName?: string;
  } | null;
  seller?: {
    firstName?: string;
    lastName?: string;
  } | null;
  repc?: {
    purchasePrice?: number | null;
    sellerDisclosureDeadline?: string | null;
    dueDiligenceDeadline?: string | null;
    financingAppraisalDeadline?: string | null;
    settlementDeadline?: string | null;
  } | null;
};

type DashboardTask = {
  id: string;
  title: string;
  status?: string;
  dueAt?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
};

type DealMilestone = {
  id: string;
  dealId: string;
  dealTitle: string;
  clientName: string;
  label: string;
  date: string;
  daysRemaining: number;
  price?: number | null;
  status: string;
};

function isActiveDeal(status?: string) {
  return !['CLOSED', 'ARCHIVED', 'FELL_THROUGH'].includes(String(status || '').toUpperCase());
}

function getDealTitle(deal: DashboardDeal) {
  return deal.property?.street || deal.title || 'Untitled deal';
}

function getClientName(deal: DashboardDeal) {
  const buyerName = [deal.buyer?.firstName, deal.buyer?.lastName].filter(Boolean).join(' ').trim();
  const sellerName = [deal.seller?.firstName, deal.seller?.lastName].filter(Boolean).join(' ').trim();
  return buyerName || sellerName || 'Client not assigned';
}

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return 'Volume pending';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatShortDate(value?: string | null) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDaysRemaining(daysRemaining: number) {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining === 1) return 'Due tomorrow';
  return `${daysRemaining}d out`;
}

function milestoneTone(daysRemaining: number) {
  if (daysRemaining < 0) return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  if (daysRemaining <= 2) return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
}

function getStatusLabel(status?: string) {
  return String(status || 'ACTIVE').replace(/_/g, ' ');
}

function extractMilestones(deals: DashboardDeal[]) {
  const milestones: DealMilestone[] = [];

  deals.filter((deal) => isActiveDeal(deal.status)).forEach((deal) => {
    const nextItems = [
      { label: 'Seller disclosure', date: deal.repc?.sellerDisclosureDeadline },
      { label: 'Due diligence', date: deal.repc?.dueDiligenceDeadline },
      { label: 'Financing/appraisal', date: deal.repc?.financingAppraisalDeadline },
      { label: 'Settlement', date: deal.repc?.settlementDeadline },
    ];

    nextItems.forEach((item, index) => {
      if (!item.date) return;
      const dueDate = new Date(item.date);
      if (Number.isNaN(dueDate.getTime())) return;
      const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      milestones.push({
        id: `${deal.id}-${index}`,
        dealId: deal.id,
        dealTitle: getDealTitle(deal),
        clientName: getClientName(deal),
        label: item.label,
        date: item.date,
        daysRemaining,
        price: deal.repc?.purchasePrice,
        status: deal.status,
      });
    });
  });

  return milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildSummary(activeDeals: number, urgentTasks: number, unreadReplies: number, dueSoon: number) {
  if (urgentTasks > 0 || unreadReplies > 0) {
    return `You have ${urgentTasks} urgent task${urgentTasks === 1 ? '' : 's'} and ${unreadReplies} unread repl${unreadReplies === 1 ? 'y' : 'ies'} to clear.`;
  }
  if (dueSoon > 0) {
    return `${dueSoon} transaction milestone${dueSoon === 1 ? '' : 's'} land in the next two weeks across ${activeDeals} active deal${activeDeals === 1 ? '' : 's'}.`;
  }
  return `Everything looks steady across ${activeDeals} active deal${activeDeals === 1 ? '' : 's'}. Use this hub to keep momentum high.`;
}

export function DealCommandHub() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<DashboardDeal[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [replySummary, setReplySummary] = useState<{ items: RecentReplyItem[]; unseenCount: number }>({ items: [], unseenCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [dealsRes, tasksRes, repliesRes] = await Promise.all([
          api.get('/deals').catch(() => ({ data: [] as DashboardDeal[] })),
          api.get('/tasks').catch(() => ({ data: [] as DashboardTask[] })),
          contactEmailApi.recentReplies({ limit: 5 }).catch(() => ({ data: { items: [] as RecentReplyItem[], unseenCount: 0 } })),
        ]);

        if (cancelled) return;

        setDeals(Array.isArray(dealsRes.data) ? dealsRes.data : []);
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
        setReplySummary({
          items: Array.isArray(repliesRes.data?.items) ? repliesRes.data.items : [],
          unseenCount: Number(repliesRes.data?.unseenCount || 0),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeDeals = useMemo(() => deals.filter((deal) => isActiveDeal(deal.status)), [deals]);

  const openTasks = useMemo(
    () => tasks.filter((task) => !['DONE', 'COMPLETED'].includes(String(task.status || '').toUpperCase())),
    [tasks],
  );

  const urgentTasks = useMemo(() => {
    const now = Date.now();
    const tomorrow = now + 24 * 60 * 60 * 1000;
    return openTasks.filter((task) => {
      if (!task.dueAt) return task.priority === 'HIGH';
      const dueTs = new Date(task.dueAt).getTime();
      return Number.isFinite(dueTs) && dueTs <= tomorrow;
    });
  }, [openTasks]);

  const milestones = useMemo(() => extractMilestones(activeDeals), [activeDeals]);
  const dueSoonCount = milestones.filter((item) => item.daysRemaining <= 14).length;
  const spotlight = milestones[0] || null;
  const spotlightDeal = spotlight ? activeDeals.find((deal) => deal.id === spotlight.dealId) || null : activeDeals[0] || null;
  const underContractCount = activeDeals.filter((deal) => ['UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING', 'SETTLEMENT_SCHEDULED'].includes(String(deal.status || '').toUpperCase())).length;
  const summaryText = buildSummary(activeDeals.length, urgentTasks.length, replySummary.unseenCount, dueSoonCount);

  if (loading) {
    return (
      <section className="rounded-2xl sm:rounded-[30px] border border-cyan-300/20 bg-gradient-to-br from-slate-950/70 via-slate-950/45 to-cyan-950/20 backdrop-blur-xl p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-white/10" />
          <div className="h-9 w-3/4 rounded bg-white/10" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 rounded-2xl border border-white/10 bg-white/5" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="h-60 rounded-2xl border border-white/10 bg-white/5" />
            <div className="h-60 rounded-2xl border border-white/10 bg-white/5" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-[30px] border border-cyan-300/20 bg-gradient-to-br from-slate-950/75 via-slate-950/50 to-cyan-950/20 backdrop-blur-xl p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.10),transparent_35%)]" />

      <div className="relative space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Deal command hub</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-white">One workspace for deadlines, actions, replies, and your next move</h2>
            <p className="mt-2 text-sm text-slate-300">{summaryText}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/deals')}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Open Deals Board
            </button>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
            >
              Clear My Tasks
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <MetricCard
            label="Active deals"
            value={String(activeDeals.length)}
            detail={underContractCount > 0 ? `${underContractCount} under contract flow` : 'Pipeline in motion'}
            accent="text-emerald-300"
          />
          <MetricCard
            label="Urgent tasks"
            value={String(urgentTasks.length)}
            detail={urgentTasks.length > 0 ? 'Due today or overdue' : 'No critical backlog'}
            accent="text-amber-200"
          />
          <MetricCard
            label="Unread replies"
            value={String(replySummary.unseenCount)}
            detail={replySummary.items[0]?.contactName ? `Latest from ${replySummary.items[0].contactName}` : 'Inbox is quiet'}
            accent="text-cyan-200"
          />
          <MetricCard
            label="Upcoming milestones"
            value={String(dueSoonCount)}
            detail={spotlight ? `${spotlight.label} ${formatDaysRemaining(spotlight.daysRemaining).toLowerCase()}` : 'No REPc dates set yet'}
            accent="text-violet-200"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="space-y-4">
            <SurfaceCard title="Most time-sensitive file" subtitle="The deal that needs agent attention first.">
              {spotlightDeal ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {getStatusLabel(spotlightDeal.status)}
                        </span>
                        {spotlight && (
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${milestoneTone(spotlight.daysRemaining)}`}>
                            {spotlight.label}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">{getDealTitle(spotlightDeal)}</h3>
                      <p className="mt-1 text-sm text-slate-300">{getClientName(spotlightDeal)}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {spotlight
                          ? `${spotlight.label} is ${formatDaysRemaining(spotlight.daysRemaining).toLowerCase()} on ${formatShortDate(spotlight.date)}.`
                          : 'Open the deal cockpit to drive the next contract step, communication, and task handoff.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
                      <MiniMetric label="Value" value={formatCurrency(spotlightDeal.repc?.purchasePrice)} />
                      <MiniMetric
                        label="Last touch"
                        value={formatShortDate(spotlightDeal.lastActivityAt || spotlightDeal.updatedAt || null)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/deals/${spotlightDeal.id}/cockpit`)}
                      className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
                    >
                      Open deal cockpit
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/deals/${spotlightDeal.id}`)}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      Open deal detail
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/contracts/${spotlightDeal.id}`)}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      Review contracts
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No active deal files yet"
                  description="Start one transaction and this hub will begin tracking deadlines, replies, and next steps automatically."
                  ctaLabel="Create new deal"
                  onClick={() => navigate('/deals/new')}
                />
              )}
            </SurfaceCard>

            <SurfaceCard title="Upcoming contract milestones" subtitle="The next REPc deadlines across your active pipeline.">
              {milestones.length === 0 ? (
                <div className="text-sm text-slate-400">Add REPc dates to your active deals and this list will become your at-a-glance contract clock.</div>
              ) : (
                <div className="space-y-2">
                  {milestones.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/deals/${item.dealId}/cockpit`)}
                      className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${milestoneTone(item.daysRemaining)}`}>
                            {formatDaysRemaining(item.daysRemaining)}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{getStatusLabel(item.status)}</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white truncate">{item.label} • {item.dealTitle}</div>
                        <div className="mt-1 text-[11px] text-slate-400 truncate">{item.clientName} • {formatShortDate(item.date)} • {formatCurrency(item.price)}</div>
                      </div>
                      <span className="shrink-0 text-xs text-cyan-300">Open</span>
                    </button>
                  ))}
                </div>
              )}
            </SurfaceCard>
          </div>

          <div className="space-y-4">
            <SurfaceCard title="Next best actions" subtitle="Calls, replies, and task pressure ranked for right now.">
              <NextBestActionRail compact maxItems={4} />
            </SurfaceCard>

            <SurfaceCard title="Recent client replies" subtitle="Stay on top of inbox momentum without leaving the dashboard.">
              <RecentRepliesWidget />
            </SurfaceCard>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <AIDailyPlan />

          <SurfaceCard title="Operator shortcuts" subtitle="Jump into the most common agent workflows.">
            <div className="grid grid-cols-2 gap-2">
              <ShortcutButton label="New deal" hint="Start a file" onClick={() => navigate('/deals/new')} />
              <ShortcutButton label="Calendar" hint="See today" onClick={() => navigate('/calendar')} />
              <ShortcutButton label="Tasks" hint="Work queue" onClick={() => navigate('/tasks')} />
              <ShortcutButton label="Clients" hint="Follow-ups" onClick={() => navigate('/clients')} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">Agent brief</div>
              <div className="mt-2 text-sm text-slate-200">{replySummary.unseenCount > 0 ? 'Start with unread conversations, then clear contract deadlines, then work your today bucket.' : 'Start with contract deadlines, then knock out urgent tasks, then create the next outbound follow-up.'}</div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </section>
  );
}

function SurfaceCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
      <div className="mb-3">
        <div className="text-xs uppercase tracking-[0.14em] text-cyan-200">{title}</div>
        <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function ShortcutButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3 text-left transition-colors hover:bg-white/10"
    >
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-[11px] text-slate-400">{hint}</div>
    </button>
  );
}

function EmptyState({ title, description, ctaLabel, onClick }: { title: string; description: string; ctaLabel: string; onClick: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-center">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{description}</div>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default DealCommandHub;
