import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clipboard, Mail } from 'lucide-react';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

type AgentRow = {
  id: string;
  email: string;
  name: string;
  brokerageName: string | null;
  licenseNumber: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  health: {
    healthScore: number;
    setupScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    healthStatus: 'healthy' | 'watch' | 'at_risk' | 'critical';
    mailing: { readinessPct: number };
    support: { open: number; overdue: number };
    reasons: string[];
    nextBestAction: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type AgentsResponse = {
  page: number;
  pageSize: number;
  total: number;
  includeArchived?: boolean;
  view?: 'active' | 'archived' | 'all';
  agents: AgentRow[];
};

type AgentView = 'active' | 'archived' | 'all';
type RiskFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

function riskBadgeClass(level: RiskFilter) {
  switch (level) {
    case 'critical':
      return 'bg-rose-500/15 text-rose-200 border-rose-400/30';
    case 'high':
      return 'bg-amber-500/15 text-amber-200 border-amber-400/30';
    case 'medium':
      return 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30';
    case 'low':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';
    default:
      return 'bg-white/10 text-slate-200 border-white/10';
  }
}

function healthToneClass(status: AgentRow['health'] extends infer T ? T extends { healthStatus: infer U } ? U : never : never) {
  switch (status) {
    case 'healthy':
      return 'text-emerald-200';
    case 'watch':
      return 'text-cyan-200';
    case 'at_risk':
      return 'text-amber-200';
    case 'critical':
      return 'text-rose-200';
    default:
      return 'text-slate-300';
  }
}

export function InternalAgentsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') || '';
  const page = Number(params.get('page') || '1');
  const view = (params.get('view') || 'active') as AgentView;
  const risk = (params.get('risk') || 'all') as RiskFilter;

  const [data, setData] = useState<AgentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/internal/agents', { params: { q: q || undefined, page, pageSize, view } });
        if (!cancelled) {
          setData(res.data);
          setSelectedIds(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, page, view]);

  const visibleAgents = useMemo(() => {
    if (!data) return [] as AgentRow[];
    if (risk === 'all') return data.agents;
    return data.agents.filter((agent) => agent.health?.riskLevel === risk);
  }, [data, risk]);

  const selectedRows = useMemo(() => {
    if (!data) return [] as AgentRow[];
    return visibleAgents.filter((agent) => selectedIds.has(agent.id));
  }, [data, selectedIds, visibleAgents]);

  const allVisibleSelected = useMemo(() => {
    if (visibleAgents.length === 0) return false;
    return visibleAgents.every((agent) => selectedIds.has(agent.id));
  }, [selectedIds, visibleAgents]);

  const canArchiveSelected = selectedRows.some((row) => row.status !== 'REVOKED');
  const canRestoreSelected = selectedRows.some((row) => row.status === 'REVOKED');

  async function runBulkStatus(status: 'ACTIVE' | 'REVOKED') {
    if (!selectedRows.length) return;
    const actionLabel = status === 'REVOKED' ? 'archive' : 'restore';
    if (!confirm(`${actionLabel === 'archive' ? 'Archive' : 'Restore'} ${selectedRows.length} selected agent(s)?`)) return;

    setBulkSaving(true);
    try {
      await api.post('/internal/agents/bulk-status', {
        agentIds: selectedRows.map((row) => row.id),
        status,
      });

      const res = await api.get('/internal/agents', { params: { q: q || undefined, page, pageSize, view } });
      setData(res.data);
      setSelectedIds(new Set());
    } finally {
      setBulkSaving(false);
    }
  }

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  return (
    <PageLayout
      title="Agents"
      subtitle="Search, inspect, and manage visibility into accounts."
      maxWidth="full"
      actions={
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {[
              { key: 'active', label: 'Active' },
              { key: 'archived', label: 'Archived' },
              { key: 'all', label: 'All' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('view', tab.key);
                  next.set('page', '1');
                  setParams(next);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === tab.key ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {[
              { key: 'all', label: 'All risk' },
              { key: 'critical', label: 'Critical' },
              { key: 'high', label: 'High' },
              { key: 'medium', label: 'Medium' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (option.key === 'all') next.delete('risk');
                  else next.set('risk', option.key);
                  next.set('page', '1');
                  setParams(next);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  risk === option.key ? 'bg-amber-500/20 text-amber-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                const val = e.target.value;
                if (val) next.set('q', val);
                else next.delete('q');
                next.set('page', '1');
                setParams(next);
              }}
              placeholder="Search name, email, brokerage…"
              className="w-[260px] max-w-[60vw] rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <Button variant="secondary" size="sm" disabled={bulkSaving || !canArchiveSelected} onClick={() => runBulkStatus('REVOKED')}>
            Archive selected
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkSaving || !canRestoreSelected} onClick={() => runBulkStatus('ACTIVE')}>
            Restore selected
          </Button>
        </div>
      }
    >
      <Card
        title={
          data
            ? `${data.total.toLocaleString()} ${view === 'archived' ? 'archived agents' : view === 'all' ? 'agents' : 'active agents'}`
            : 'Agents'
        }
        description={
          view === 'archived'
            ? 'Owner-only archive view (excluded from internal stats)'
            : view === 'all'
              ? 'Owner-only view including active and archived accounts'
              : 'Owner-only active accounts (archived excluded)'
        }
        hover={false}
      >
        {loading ? (
          <div className="flex items-center justify-center min-h-[260px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
          </div>
        ) : !data ? (
          <div className="text-sm text-slate-300">No data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <th className="pb-3 px-4 w-[44px]">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => {
                        if (!data) return;
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            data.agents.forEach((agent) => next.add(agent.id));
                          } else {
                            data.agents.forEach((agent) => next.delete(agent.id));
                          }
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900/80 text-cyan-500 focus:ring-cyan-500/40"
                    />
                  </th>
                  <th className="pb-3 px-4">Agent</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Health</th>
                  <th className="pb-3 px-4">Next action</th>
                  <th className="pb-3 px-4">Brokerage</th>
                  <th className="pb-3 px-4">Joined</th>
                  <th className="pb-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleAgents.map((a) => (
                  <tr key={a.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(a.id);
                            else next.delete(a.id);
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-white/20 bg-slate-900/80 text-cyan-500 focus:ring-cyan-500/40"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-semibold text-white">{a.name}</div>
                      <div className="text-xs text-slate-400">{a.email}</div>
                    </td>
                    <td className="py-3 px-4">
                        <div className="flex gap-2">
                             <Badge variant={a.status === 'ACTIVE' ? 'success' : 'danger'}>{a.status}</Badge>
                             <div className="inline-flex items-center rounded-md border text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2 py-0.5">{a.subscriptionStatus}</div>
                        </div>
                    </td>
                    <td className="py-3 px-4">
                      {a.health ? (
                        <div>
                          <div className={`text-sm font-semibold ${healthToneClass(a.health.healthStatus)}`}>Health {a.health.healthScore}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge className={riskBadgeClass(a.health.riskLevel)}>{a.health.riskLevel}</Badge>
                            <span className="text-[11px] text-slate-500">Setup {a.health.setupScore}</span>
                            <span className="text-[11px] text-slate-500">Mail {a.health.mailing.readinessPct}%</span>
                            {a.health.support.overdue > 0 && <span className="text-[11px] text-rose-300">{a.health.support.overdue} overdue ticket(s)</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No health profile</div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="text-sm text-slate-200 line-clamp-2">{a.health?.nextBestAction || 'Open the profile to assess next action.'}</div>
                      {a.health?.reasons?.[0] && <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">{a.health.reasons[0]}</div>}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">
                      <div>{a.brokerageName || '—'}</div>
                      <div className="mt-1 text-[11px] text-slate-500">License {a.licenseNumber || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`mailto:${a.email}`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
                        >
                          <Mail className="h-3 w-3" /> Email
                        </a>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(a.email)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
                        >
                          <Clipboard className="h-3 w-3" /> Copy
                        </button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/internal/agents/${a.id}`)}
                        >
                          Manage
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleAgents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                      No agents match the current search and risk filters on this page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between mt-5">
              <div className="text-xs text-slate-500">
                Showing <span className="text-slate-200 font-semibold">{visibleAgents.length}</span> of this page’s <span className="text-slate-200 font-semibold">{data.agents.length}</span> results.
                {' '}
                Page <span className="text-slate-200 font-semibold">{data.page}</span> of <span className="text-slate-200 font-semibold">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(Math.max(1, page - 1)));
                    setParams(next);
                  }}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(Math.min(totalPages, page + 1)));
                    setParams(next);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
