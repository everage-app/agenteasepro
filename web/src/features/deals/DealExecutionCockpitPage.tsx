import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DealHealthBadge } from '../../components/deals/DealHealthBadge';
import { DealTimeline } from '../../components/deals/DealTimeline';
import { AIDailyPlan } from '../../components/ai/AIDailyPlan';
import { NextBestActionRail } from '../../components/dashboard/NextBestActionRail';
import { NewTaskModal } from '../tasks/NewTaskModal';
import { ContactEmailModal } from '../../components/communications/ContactEmailModal';

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
  property?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
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
}

interface DealTask {
  id: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'COMPLETED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  bucket?: 'TODAY' | 'THIS_WEEK' | 'LATER' | 'DONE';
  dueAt?: string | null;
}

const statusConfig: Record<string, { label: string; tone: string }> = {
  LEAD: { label: 'Lead', tone: 'bg-slate-500/20 text-slate-200' },
  ACTIVE: { label: 'Active', tone: 'bg-blue-500/20 text-blue-200' },
  OFFER_SENT: { label: 'Offer Sent', tone: 'bg-purple-500/20 text-purple-200' },
  UNDER_CONTRACT: { label: 'Under Contract', tone: 'bg-emerald-500/20 text-emerald-200' },
  DUE_DILIGENCE: { label: 'Due Diligence', tone: 'bg-teal-500/20 text-teal-200' },
  FINANCING: { label: 'Financing', tone: 'bg-cyan-500/20 text-cyan-200' },
  SETTLEMENT_SCHEDULED: { label: 'Settlement Scheduled', tone: 'bg-violet-500/20 text-violet-200' },
  CLOSED: { label: 'Closed', tone: 'bg-green-500/20 text-green-200' },
  FELL_THROUGH: { label: 'Fell Through', tone: 'bg-red-500/20 text-red-200' },
};

function formatDate(value?: string | null) {
  if (!value) return 'None';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return 'None';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value?: number | null) {
  if (value == null) return 'None';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function fullName(person?: { firstName?: string; lastName?: string } | null) {
  if (!person) return 'Unknown';
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown';
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function dueLabel(value?: string | null) {
  const remaining = daysUntil(value);
  if (remaining == null) return 'No date';
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`;
  if (remaining === 0) return 'Due today';
  return `${remaining}d out`;
}

function priorityTone(priority?: string) {
  if (priority === 'HIGH') return 'border-red-400/20 bg-red-500/10 text-red-200';
  if (priority === 'LOW') return 'border-slate-400/20 bg-slate-500/10 text-slate-300';
  return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200';
}

export function DealExecutionCockpitPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<{
    id: string;
    type: 'client';
    name: string;
    email: string;
  } | null>(null);

  const loadCockpit = async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);

    try {
      const [dealRes, tasksRes, activityRes] = await Promise.all([
        api.get(`/deals/${dealId}`),
        api.get('/tasks', { params: { dealId, status: 'OPEN' } }),
        api.get(`/deals/${dealId}/activity`),
      ]);

      setDeal(dealRes.data);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setActivity(Array.isArray(activityRes.data?.items) ? activityRes.data.items : []);
    } catch {
      setError('Failed to load the deal cockpit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCockpit();
  }, [dealId]);

  const deadlineRows = useMemo(() => {
    if (!deal?.repc) return [];
    return [
      { label: 'Seller Disclosure', date: deal.repc.sellerDisclosureDeadline },
      { label: 'Due Diligence', date: deal.repc.dueDiligenceDeadline },
      { label: 'Financing and Appraisal', date: deal.repc.financingAppraisalDeadline },
      { label: 'Settlement', date: deal.repc.settlementDeadline },
    ].filter((item) => item.date);
  }, [deal]);

  const docStats = useMemo(() => {
    if (!deal) return { total: 0, pending: 0, signed: 0 };
    let pending = 0;
    let signed = 0;
    const forms = deal.forms || [];
    for (const form of forms) {
      const status = String(form.status || 'DRAFT').toUpperCase();
      if (status === 'SIGNED') signed += 1;
      else pending += 1;
    }
    for (const envelope of deal.signatureEnvelopes || []) {
      const signers = envelope.signers || [];
      const finished = Boolean(envelope.completedAt) || (signers.length > 0 && signers.every((signer) => signer.signedAt));
      if (finished) signed += 1;
      else pending += 1;
    }
    return { total: pending + signed, pending, signed };
  }, [deal]);

  const topTask = tasks[0] || null;
  const latestForm = (deal?.forms || []).find((form) => form.definition?.code);
  const address = [deal?.property?.street, deal?.property?.city, deal?.property?.state, deal?.property?.zip]
    .filter(Boolean)
    .join(', ');
  const status = statusConfig[deal?.status || 'ACTIVE'] || statusConfig.ACTIVE;

  const markTaskDone = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'COMPLETED', bucket: 'DONE' });
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch {
      await loadCockpit();
    }
  };

  if (loading) {
    return (
      <PageLayout title="Deal cockpit">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      </PageLayout>
    );
  }

  if (error || !deal) {
    return (
      <PageLayout title="Deal cockpit" breadcrumbs={[{ label: 'Deals', href: '/deals' }, { label: 'Cockpit' }]}>
        <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error || 'Deal not found.'}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Deal cockpit"
      subtitle={deal.title}
      breadcrumbs={[{ label: 'Deals', href: '/deals' }, { label: deal.title || 'Deal' }, { label: 'Cockpit' }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/deals/${deal.id}/detail`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-white/20 hover:bg-white/10"
          >
            Deal detail
          </Link>
          <Link
            to={`/deals/${deal.id}/repc`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
          >
            REPC wizard
          </Link>
          <Button size="sm" variant="primary" onClick={() => setShowTaskModal(true)}>
            Add deal task
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="rounded-[32px] border border-cyan-400/20 bg-slate-950/50 p-6 shadow-[0_24px_70px_rgba(1,8,20,0.55)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${status.tone}`}>
                  {status.label}
                </span>
                <DealHealthBadge lastActivityAt={deal.lastActivityAt} status={deal.status} repc={deal.repc} />
                <span className="text-xs uppercase tracking-[0.18em] text-cyan-300">Execution cockpit</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{address || deal.title}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Run the transaction from one place: priority tasks, contract milestones, signer status, and client communication.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Open tasks" value={String(tasks.length)} accent="text-cyan-200" />
                <Metric label="Pending docs" value={String(docStats.pending)} accent="text-amber-200" />
                <Metric label="Settlement" value={dueLabel(deal.repc?.settlementDeadline)} accent="text-violet-200" />
                <Metric label="Purchase price" value={formatCurrency(deal.repc?.purchasePrice)} accent="text-emerald-200" />
              </div>
            </div>

            <div className="grid min-w-full gap-3 sm:grid-cols-3 xl:min-w-[360px] xl:max-w-[420px]">
              <QuickLink
                title="Open latest form"
                description={latestForm?.definition?.displayName || 'Jump back into the current deal form.'}
                href={latestForm?.definition?.code ? `/deals/${deal.id}/forms/${latestForm.definition.code}` : `/deals/${deal.id}/detail`}
              />
              <QuickLink
                title="Contracts hub"
                description="Review envelopes, uploads, and template progress."
                href="/contracts"
              />
              <QuickLink
                title="Kanban lane"
                description="Return to the broader deals board when you need context."
                href={`/deals/${deal.id}`}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr,0.95fr]">
          <div className="space-y-6">
            <Card title="Deal timeline" description="Track the contract through every milestone.">
              <DealTimeline status={deal.status} createdAt={deal.createdAt} closedAt={deal.closedAt} repc={deal.repc} />
            </Card>

            <Card
              title="Tasks in motion"
              description="Everything still open for this deal."
              headerAction={
                <Button size="sm" variant="secondary" onClick={() => setShowTaskModal(true)}>
                  New task
                </Button>
              }
            >
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  No open deal tasks right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.slice(0, 6).map((task) => (
                    <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{task.title}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priorityTone(task.priority)}`}>
                              {task.priority || 'NORMAL'}
                            </span>
                            {task.bucket && (
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{task.bucket.replace('_', ' ')}</span>
                            )}
                          </div>
                          {task.description && <p className="mt-1 text-sm text-slate-400">{task.description}</p>}
                          <p className="mt-2 text-xs text-slate-500">Due: {formatDateTime(task.dueAt)}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => void markTaskDone(task.id)}>
                          Mark done
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {topTask && (
                <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                  Top task: {topTask.title}
                </div>
              )}
            </Card>

            <Card title="Document pulse" description="Form progress, signatures, and contract readiness.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Tracked docs" value={String(docStats.total)} accent="text-white" subtle />
                <Metric label="Awaiting action" value={String(docStats.pending)} accent="text-amber-200" subtle />
                <Metric label="Completed" value={String(docStats.signed)} accent="text-emerald-200" subtle />
              </div>
              <div className="mt-4 space-y-3">
                {(deal.forms || []).slice(0, 4).map((form) => (
                  <div key={form.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{form.definition?.displayName || form.title || 'Untitled form'}</p>
                      <p className="text-xs text-slate-400">{String(form.status || 'DRAFT').toUpperCase()} · Updated {formatDate(form.updatedAt)}</p>
                    </div>
                    {form.definition?.code && (
                      <Link
                        to={`/deals/${deal.id}/forms/${form.definition.code}`}
                        className="text-sm text-cyan-300 transition-colors hover:text-cyan-200"
                      >
                        Open form
                      </Link>
                    )}
                  </div>
                ))}
                {(deal.signatureEnvelopes || []).slice(0, 3).map((envelope) => {
                  const pendingSigners = (envelope.signers || []).filter((signer) => !signer.signedAt);
                  return (
                    <div key={envelope.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{envelope.type || 'Signature envelope'}</p>
                          <p className="text-xs text-slate-400">Created {formatDate(envelope.createdAt)}</p>
                        </div>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                          {pendingSigners.length === 0 ? 'Complete' : `${pendingSigners.length} pending`}
                        </span>
                      </div>
                      {pendingSigners.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {pendingSigners.map((signer) => (
                            <span key={signer.id} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                              {signer.name || signer.email || 'Pending signer'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Critical dates" description="The next contract checkpoints that can move or stall the deal.">
              {deadlineRows.length === 0 ? (
                <p className="text-sm text-slate-400">No contract deadlines are available yet.</p>
              ) : (
                <div className="space-y-3">
                  {deadlineRows.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
                      </div>
                      <span className="text-xs font-semibold text-cyan-200">{dueLabel(item.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="People and communication" description="Reach buyers and sellers without leaving the transaction.">
              <div className="space-y-3">
                <PartyCard
                  label="Buyer"
                  name={fullName(deal.buyer)}
                  email={deal.buyer?.email}
                  phone={deal.buyer?.phone}
                  href={deal.buyer?.id ? `/clients/${deal.buyer.id}` : undefined}
                  onEmail={
                    deal.buyer?.id && deal.buyer.email
                      ? () => setEmailTarget({ id: deal.buyer!.id!, type: 'client', name: fullName(deal.buyer), email: deal.buyer!.email! })
                      : undefined
                  }
                />
                <PartyCard
                  label="Seller"
                  name={fullName(deal.seller)}
                  email={deal.seller?.email}
                  phone={deal.seller?.phone}
                  href={deal.seller?.id ? `/clients/${deal.seller.id}` : undefined}
                  onEmail={
                    deal.seller?.id && deal.seller.email
                      ? () => setEmailTarget({ id: deal.seller!.id!, type: 'client', name: fullName(deal.seller), email: deal.seller!.email! })
                      : undefined
                  }
                />
              </div>
            </Card>

            <Card title="Recent activity" description="The latest touchpoints and deal events.">
              {activity.length === 0 ? (
                <p className="text-sm text-slate-400">No activity has been recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {activity.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          {item.description && <p className="mt-1 text-sm text-slate-400">{item.description}</p>}
                        </div>
                        <span className="text-[11px] text-slate-500">{formatDateTime(item.at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <AIDailyPlan />

            <Card title="Next best actions" description="Cross-check the rest of the pipeline while you work this deal.">
              <NextBestActionRail compact maxItems={4} />
            </Card>
          </div>
        </div>
      </div>

      {showTaskModal && (
        <NewTaskModal
          defaultDealId={deal.id}
          defaultClientId={deal.buyer?.id || deal.seller?.id}
          defaultCategory="CONTRACT"
          defaultTitle={`Follow up on ${deal.title}`}
          onClose={() => setShowTaskModal(false)}
          onComplete={() => {
            setShowTaskModal(false);
            void loadCockpit();
          }}
        />
      )}

      {emailTarget && (
        <ContactEmailModal
          open
          contactType={emailTarget.type}
          contactId={emailTarget.id}
          contactName={emailTarget.name}
          contactEmail={emailTarget.email}
          onClose={() => setEmailTarget(null)}
          onSent={() => void loadCockpit()}
        />
      )}
    </PageLayout>
  );
}

function Metric({ label, value, accent, subtle = false }: { label: string; value: string; accent: string; subtle?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${subtle ? 'border-white/10 bg-slate-950/40' : 'border-white/10 bg-white/5'}`}>
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
    </div>
  );
}

function QuickLink({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link to={href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-cyan-400/30 hover:bg-cyan-500/10">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-xs leading-5 text-slate-400">{description}</div>
    </Link>
  );
}

function PartyCard({
  label,
  name,
  email,
  phone,
  href,
  onEmail,
}: {
  label: string;
  name: string;
  email?: string;
  phone?: string;
  href?: string;
  onEmail?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-1 text-sm font-semibold text-white">{name}</div>
          {email && <div className="mt-1 text-xs text-slate-400">{email}</div>}
          {phone && <div className="mt-1 text-xs text-slate-500">{phone}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {href && (
            <Link to={href} className="text-xs text-cyan-300 transition-colors hover:text-cyan-200">
              Open client
            </Link>
          )}
          {onEmail && (
            <button type="button" onClick={onEmail} className="text-xs text-slate-300 transition-colors hover:text-white">
              Email now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DealExecutionCockpitPage;