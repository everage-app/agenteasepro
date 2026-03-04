import { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

type AgentLite = { id: string; name: string; email: string; brokerageName?: string | null };

type SupportRequestRow = {
  id: string;
  category: 'GENERAL' | 'SUGGESTION' | 'BILLING' | 'BUG';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject: string;
  message: string;
  pagePath?: string | null;
  pageUrl?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  agent: AgentLite;
};

const statusStyles: Record<SupportRequestRow['status'], string> = {
  OPEN: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  RESOLVED: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  CLOSED: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
};

const categoryStyles: Record<SupportRequestRow['category'], string> = {
  GENERAL: 'bg-white/10 text-slate-200 border-white/10',
  SUGGESTION: 'bg-purple-500/15 text-purple-200 border-purple-400/30',
  BILLING: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
  BUG: 'bg-red-500/15 text-red-200 border-red-400/30',
};

const priorityStyles: Record<SupportRequestRow['priority'], string> = {
  LOW: 'bg-slate-500/10 text-slate-300 border-slate-400/30',
  MEDIUM: 'bg-cyan-500/10 text-cyan-200 border-cyan-400/30',
  HIGH: 'bg-amber-500/10 text-amber-200 border-amber-400/30',
  URGENT: 'bg-red-500/10 text-red-200 border-red-400/30',
};

export function InternalSupportPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<SupportRequestRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/internal/support', {
          params: {
            page,
            pageSize,
            status: statusFilter || undefined,
            category: categoryFilter || undefined,
            priority: priorityFilter || undefined,
            q: search || undefined,
          },
        });
        if (!cancelled) {
          setRequests(res.data?.requests ?? []);
          setCounts(res.data?.counts ?? {});
          setTotal(res.data?.total ?? 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [page, statusFilter, categoryFilter, priorityFilter, search]);

  const summary = useMemo(() => {
    return {
      open: counts.OPEN || 0,
      inProgress: counts.IN_PROGRESS || 0,
      resolved: counts.RESOLVED || 0,
      closed: counts.CLOSED || 0,
    };
  }, [counts]);

  const updateRequest = async (id: string, payload: Partial<SupportRequestRow>) => {
    const res = await api.patch(`/internal/support/${id}`, payload);
    const updated = res.data?.request as SupportRequestRow;
    setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const handleOpen = async (row: SupportRequestRow) => {
    setExpandedId((current) => (current === row.id ? null : row.id));
    if (row.status === 'OPEN') {
      await updateRequest(row.id, { status: 'IN_PROGRESS' });
    }
  };

  return (
    <PageLayout
      title="Support Inbox"
      subtitle="Track support, suggestions, and billing help requests in one place."
      maxWidth="full"
      actions={
        <button
          type="button"
          title="Open support notifications"
          aria-label="Support notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 01-6 0" />
          </svg>
          {summary.open > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg">
              {summary.open}
            </span>
          )}
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card className="p-4" title="Open">
          <div className="text-2xl font-bold text-white">{summary.open}</div>
        </Card>
        <Card className="p-4" title="In progress">
          <div className="text-2xl font-bold text-white">{summary.inProgress}</div>
        </Card>
        <Card className="p-4" title="Resolved">
          <div className="text-2xl font-bold text-white">{summary.resolved}</div>
        </Card>
        <Card className="p-4" title="Closed">
          <div className="text-2xl font-bold text-white">{summary.closed}</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
        >
          <option value="">All status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
        >
          <option value="">All categories</option>
          <option value="GENERAL">Support</option>
          <option value="SUGGESTION">Suggestion</option>
          <option value="BILLING">Billing</option>
          <option value="BUG">Bug</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
        >
          <option value="">All priority</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject, message, agent"
          className="ml-auto px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[260px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      ) : (
        <Card title="Requests" description={`${total} total`} hover={false}>
          {requests.length === 0 ? (
            <div className="text-sm text-slate-300">No support requests yet.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {requests.map((row) => {
                const isExpanded = expandedId === row.id;
                const draft = notesDraft[row.id] ?? row.internalNotes ?? '';
                return (
                  <div
                    key={row.id}
                    className="py-4 cursor-pointer"
                    onClick={() => handleOpen(row)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{row.subject}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {row.agent?.name || 'Agent'} · {row.agent?.email}
                          {row.agent?.brokerageName ? ` • ${row.agent.brokerageName}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={categoryStyles[row.category]}>{row.category}</Badge>
                        <Badge className={priorityStyles[row.priority]}>{row.priority}</Badge>
                        <Badge className={statusStyles[row.status]}>{row.status}</Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpen(row);
                          }}
                          className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-200 hover:bg-white/10"
                        >
                          {isExpanded ? 'Hide' : 'Open'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-3 text-xs text-slate-300">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Message</div>
                          <div className="mt-1 whitespace-pre-wrap text-slate-200">{row.message}</div>
                          {row.pagePath && (
                            <div className="mt-2 text-[11px] text-slate-400">Path: {row.pagePath}</div>
                          )}
                          {row.pageUrl && (
                            <div className="mt-1 text-[11px] text-slate-400">URL: {row.pageUrl}</div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                          <select
                            value={row.status}
                            onChange={(e) => updateRequest(row.id, { status: e.target.value as any })}
                            className="px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-200"
                          >
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                          <select
                            value={row.priority}
                            onChange={(e) => updateRequest(row.id, { priority: e.target.value as any })}
                            className="px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-200"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Normal</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                          {row.pageUrl && (
                            <a
                              href={row.pageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 rounded-xl text-xs bg-blue-500/10 border border-blue-400/30 text-blue-200 hover:bg-blue-500/20"
                            >
                              Open page
                            </a>
                          )}
                          {row.pageUrl && (
                            <button
                              onClick={() => navigator.clipboard.writeText(row.pageUrl || '')}
                              className="px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10"
                            >
                              Copy link
                            </button>
                          )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Internal notes</div>
                          <textarea
                            value={draft}
                            onChange={(e) => setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            rows={3}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200"
                          />
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateRequest(row.id, { internalNotes: draft });
                              }}
                              className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20"
                            >
                              Save notes
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
            <span>
              Page {page} · {total} items
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded-lg border border-white/10 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
                disabled={page * pageSize >= total}
                className="px-2 py-1 rounded-lg border border-white/10 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}
    </PageLayout>
  );
}
