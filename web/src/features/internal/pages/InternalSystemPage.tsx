import { FormEvent, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

type SystemResponse = {
  app: {
    version: string;
    name: string;
    environment: string;
  };
  system: {
    platform: string;
    release: string;
    arch: string;
    cpus: number;
    totalMem: number;
    freeMem: number;
    uptime: number;
    loadAvg: number[];
  };
  process: {
    pid: number;
    nodeVersion: string;
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
  database: {
    ok: boolean;
    latencyMs: number;
    counts: {
      agents: number;
      clients: number;
      deals: number;
      listings: number;
      supportTickets: number;
    };
  };
  integrations: {
    databaseUrl: boolean;
    stripeSecret: boolean;
    stripePublic: boolean;
    idxApi: boolean;
    openaiKey: boolean;
    sendgridKey: boolean;
    jwtSecret: boolean;
  };
  errors: {
    last24h: number;
    recent: Array<{
      id: string;
      createdAt: string;
      message: string;
      path: string | null;
      source: string;
    }>;
  };
  meta: {
    responseTimeMs: number;
    serverTime: string;
  };
};

type InternalStaffRow = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'SUPPORT' | 'BILLING' | 'SALES' | 'PRODUCT' | 'ENGINEERING' | 'READ_ONLY';
  active: boolean;
  title?: string | null;
  lastAccessAt?: string | null;
  agent: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
};

type StaffRole = InternalStaffRow['role'];

type InternalAgentOption = {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
};

const STAFF_ROLE_OPTIONS: StaffRole[] = ['OWNER', 'ADMIN', 'SUPPORT', 'BILLING', 'SALES', 'PRODUCT', 'ENGINEERING', 'READ_ONLY'];

type InternalAuditRow = {
  id: string;
  action: string;
  targetType: string;
  summary: string;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
};

export function InternalSystemPage() {
  const [data, setData] = useState<SystemResponse | null>(null);
  const [staff, setStaff] = useState<InternalStaffRow[]>([]);
  const [agentOptions, setAgentOptions] = useState<InternalAgentOption[]>([]);
  const [audit, setAudit] = useState<InternalAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [staffForm, setStaffForm] = useState<{ agentId: string; role: StaffRole; title: string; notes: string }>({
    agentId: '',
    role: 'SUPPORT',
    title: '',
    notes: '',
  });
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    name: string;
    role: StaffRole;
    title: string;
    notes: string;
    sendEmail: boolean;
  }>({
    email: '',
    name: '',
    role: 'SUPPORT',
    title: '',
    notes: '',
    sendEmail: true,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [res, staffRes, auditRes, agentsRes] = await Promise.all([
        api.get('/internal/system'),
        api.get('/internal/ops/staff'),
        api.get('/internal/ops/audit-log', { params: { page: 1, pageSize: 8 } }),
        api.get('/internal/agents', { params: { page: 1, pageSize: 100, view: 'active' } }),
      ]);
      setData(res.data);
      setStaff((staffRes.data?.staff ?? []).filter((row: InternalStaffRow) => row.active));
      setAudit(auditRes.data?.logs ?? []);
      const options = agentsRes.data?.agents ?? [];
      setAgentOptions(options);
      setStaffForm((prev) => ({
        ...prev,
        agentId: prev.agentId || options[0]?.id || '',
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }

  async function addInternalUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setInviteLink('');

    if (!staffForm.agentId) {
      setMessage({ tone: 'error', text: 'Choose an existing account before adding internal access.' });
      return;
    }

    setStaffSaving(true);
    try {
      const res = await api.put('/internal/ops/staff', {
        agentId: staffForm.agentId,
        role: staffForm.role,
        active: true,
        title: staffForm.title || null,
        notes: staffForm.notes || null,
        reason: 'Added from internal system page',
      });
      const email = res.data?.staff?.agent?.email || 'User';
      setMessage({ tone: 'success', text: `${email} now has internal role ${staffForm.role}.` });
      await load();
    } catch (err: any) {
      const text = err?.response?.data?.error || err?.message || 'Unable to add internal access';
      setMessage({ tone: 'error', text });
    } finally {
      setStaffSaving(false);
    }
  }

  async function inviteInternalUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setInviteLink('');

    if (!inviteForm.email.trim()) {
      setMessage({ tone: 'error', text: 'Invite email is required.' });
      return;
    }

    setInviteSaving(true);
    try {
      const res = await api.post('/internal/ops/staff/invite', {
        email: inviteForm.email,
        name: inviteForm.name || undefined,
        role: inviteForm.role,
        title: inviteForm.title || null,
        notes: inviteForm.notes || null,
        sendEmail: inviteForm.sendEmail,
        reason: 'Invited from internal system page',
      });
      const invitation = res.data?.invitation;
      const email = invitation?.email || inviteForm.email;
      const sentText = invitation?.emailSent ? 'Invite email sent.' : 'Invite created. Share link manually.';
      setMessage({ tone: 'success', text: `${email} added as ${inviteForm.role}. ${sentText}` });
      setInviteLink(invitation?.resetUrl || '');
      setInviteForm((prev) => ({ ...prev, email: '', name: '', title: '', notes: '' }));
      await load();
    } catch (err: any) {
      const text = err?.response?.data?.error || err?.message || 'Unable to send invite';
      setMessage({ tone: 'error', text });
    } finally {
      setInviteSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage({ tone: 'success', text: 'Invite link copied to clipboard.' });
    } catch {
      setMessage({ tone: 'error', text: 'Clipboard copy failed. Copy the link manually.' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <PageLayout title="System Status" subtitle="Health monitoring and diagnostics" maxWidth="full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="System Status" subtitle="Health monitoring and diagnostics" maxWidth="full">
        <Card className="bg-red-500/10 border-red-500/50">
          <div className="text-red-400 font-medium">Error loading status: {error}</div>
          <button onClick={load} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">
            Retry
          </button>
        </Card>
      </PageLayout>
    );
  }

  if (!data) return null;

  return (
    <PageLayout 
      title="System Status" 
      subtitle={`v${data.app.version} • ${data.app.environment.toUpperCase()} • ${data.meta.serverTime}`}
      maxWidth="full"
      headerActions={
        <button 
          onClick={load}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-cyan-400"
          title="Refresh Health Check"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Top KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard 
            label="Database Response" 
            value={`${data.database.latencyMs}ms`}
            status={data.database.latencyMs < 100 ? 'good' : data.database.latencyMs < 500 ? 'warning' : 'danger'}
          />
          <KpiCard 
            label="Server Uptime" 
            value={formatUptime(data.process.uptime)}
            subValue={`Sys: ${formatUptime(data.system.uptime)}`}
            status="good"
          />
          <KpiCard 
            label="Memory (RSS)" 
            value={`${data.process.memory.rss} MB`}
            subValue={`${data.process.memory.heapUsed} / ${data.process.memory.heapTotal} heap`}
            status={data.process.memory.rss < 1024 ? 'good' : 'warning'}
          />
          <KpiCard 
            label="Error Rate (24h)" 
            value={data.errors.last24h.toString()}
            status={data.errors.last24h === 0 ? 'good' : data.errors.last24h < 10 ? 'warning' : 'danger'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Column 1: Infrastructure */}
          <div className="space-y-6">
            <Card title="Server & Runtime" description="Node.js process and host information">
              <div className="space-y-4">
                <MetricRow label="Host OS" value={`${data.system.platform} ${data.system.release} (${data.system.arch})`} />
                <MetricRow label="Node Version" value={data.process.nodeVersion} />
                <MetricRow label="Process ID" value={data.process.pid.toString()} />
                <MetricRow label="CPU Cores" value={data.system.cpus.toString()} />
                <MetricRow label="Load Avg" value={data.system.loadAvg.map(n => n.toFixed(2)).join(', ')} />
                <div className="border-t border-slate-700/50 my-2 pt-2">
                   <MetricRow label="Total Memory" value={`${data.system.totalMem} MB`} />
                   <MetricRow label="Free Memory" value={`${data.system.freeMem} MB`} />
                </div>
              </div>
            </Card>

            <Card title="Database Health" description="PostgreSQL connection statistics">
              <div className="space-y-4">
                <StatusRow label="Connection Status" ok={data.database.ok} />
                <MetricRow label="Health Check Latency" value={`${data.database.latencyMs} ms`} />
                <div className="border-t border-slate-700/50 my-2 pt-2">
                   <MetricRow label="Total Agents" value={data.database.counts.agents.toLocaleString()} />
                   <MetricRow label="Total Clients" value={data.database.counts.clients.toLocaleString()} />
                   <MetricRow label="Total Deals" value={data.database.counts.deals.toLocaleString()} />
                   <MetricRow label="Total Listings" value={data.database.counts.listings.toLocaleString()} />
                </div>
              </div>
            </Card>
          </div>

          {/* Column 2: Integrations & Config */}
          <div className="space-y-6">
            <Card title="Configuration Checks" description="Critical environment variables" className="h-full">
              <div className="space-y-3">
                 <StatusRow label="Database URL" ok={data.integrations.databaseUrl} />
                 <StatusRow label="JWT Secret" ok={data.integrations.jwtSecret} />
                 <div className="h-px bg-slate-700/50 my-2" />
                 <StatusRow label="Stripe Secret Key" ok={data.integrations.stripeSecret} />
                 <StatusRow label="Stripe Public Key (optional)" ok={data.integrations.stripePublic} />
                 <div className="h-px bg-slate-700/50 my-2" />
                 <StatusRow label="OpenAI API Key" ok={data.integrations.openaiKey} />
                 <StatusRow label="IDX/MLS API" ok={data.integrations.idxApi} />
                 <StatusRow label="SendGrid Key" ok={data.integrations.sendgridKey} />
              </div>
            </Card>

            <Card title="Internal access" description="Active staff who can enter the internal portal.">
              <div className="space-y-3">
                {staff.length === 0 ? (
                  <div className="text-sm text-slate-400">No internal staff records yet.</div>
                ) : (
                  staff.slice(0, 6).map((member) => (
                    <div key={member.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{member.agent.name || member.agent.email}</div>
                          <div className="text-[11px] text-slate-500 truncate">{member.agent.email}</div>
                        </div>
                        <Badge variant="info">{member.role}</Badge>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {member.title || 'No title'}
                        {member.lastAccessAt ? ` · Last access ${new Date(member.lastAccessAt).toLocaleString()}` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Add or invite internal users" description="Grant internal roles to existing users or send a secure setup invite.">
              <div className="space-y-4">
                {message ? (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      message.tone === 'success'
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                        : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                    }`}
                  >
                    {message.text}
                  </div>
                ) : null}

                <form onSubmit={addInternalUser} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Add existing account</div>
                  <select
                    value={staffForm.agentId}
                    onChange={(event) => setStaffForm((prev) => ({ ...prev, agentId: event.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">Select account</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.email} ({agent.email})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select
                      value={staffForm.role}
                      onChange={(event) => setStaffForm((prev) => ({ ...prev, role: event.target.value as StaffRole }))}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      {STAFF_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <input
                      value={staffForm.title}
                      onChange={(event) => setStaffForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Title (optional)"
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <textarea
                    value={staffForm.notes}
                    onChange={(event) => setStaffForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={staffSaving}
                    className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-xs font-semibold tracking-wide text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
                  >
                    {staffSaving ? 'Adding…' : 'Add internal access'}
                  </button>
                </form>

                <form onSubmit={inviteInternalUser} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Invite by email</div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="user@company.com"
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <input
                      value={inviteForm.name}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Name (optional)"
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select
                      value={inviteForm.role}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value as StaffRole }))}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      {STAFF_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <input
                      value={inviteForm.title}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Title (optional)"
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <textarea
                    value={inviteForm.notes}
                    onChange={(event) => setInviteForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={inviteForm.sendEmail}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, sendEmail: event.target.checked }))}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950/70"
                    />
                    Send invite email automatically
                  </label>
                  <button
                    type="submit"
                    disabled={inviteSaving}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold tracking-wide text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
                  >
                    {inviteSaving ? 'Inviting…' : 'Invite internal user'}
                  </button>

                  {inviteLink ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">Manual invite link</div>
                      <div className="mt-1 break-all text-xs text-amber-50">{inviteLink}</div>
                      <button
                        type="button"
                        onClick={copyInviteLink}
                        className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-50"
                      >
                        Copy link
                      </button>
                    </div>
                  ) : null}
                </form>
              </div>
            </Card>
          </div>

          {/* Column 3: Recent Activity / Logs */}
          <div className="space-y-6">
             <Card title="Recent Errors" description="Last 5 exceptions recorded">
               {data.errors.recent.length === 0 ? (
                 <div className="text-slate-400 text-sm py-4 text-center italic">No recent errors recorded. Clean sailing!</div>
               ) : (
                 <div className="space-y-4">
                   {data.errors.recent.map(err => (
                     <div key={err.id} className="p-3 bg-red-950/20 border border-red-900/30 rounded text-sm">
                       <div className="flex justify-between items-start mb-1">
                         <span className="font-semibold text-red-400">{err.source}</span>
                         <span className="text-xs text-slate-500">{new Date(err.createdAt).toLocaleTimeString()}</span>
                       </div>
                       <div className="text-slate-300 font-mono text-xs break-all line-clamp-2" title={err.message}>
                         {err.message}
                       </div>
                       {err.path && <div className="text-xs text-slate-500 mt-1">{err.path}</div>}
                     </div>
                   ))}
                 </div>
               )}
             </Card>

             <Card title="Support Stats" description="Current ticket backlog">
                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                   <div>
                      <div className="text-2xl font-bold text-white">{data.database.counts.supportTickets}</div>
                      <div className="text-xs text-slate-400">Open Tickets</div>
                   </div>
                   <div className="h-10 w-10 rounded-full bg-cyan-950 flex items-center justify-center text-cyan-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                   </div>
                </div>
             </Card>

             <Card title="Recent audit log" description="Sensitive internal actions captured with actor context.">
               {audit.length === 0 ? (
                 <div className="text-sm text-slate-400">No internal audit entries yet.</div>
               ) : (
                 <div className="space-y-3">
                   {audit.map((row) => (
                     <div key={row.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                       <div className="text-sm font-semibold text-white">{row.summary}</div>
                       <div className="mt-1 text-[11px] text-slate-400">
                         {row.actor?.name || row.actor?.email || 'System'} · {row.action} · {new Date(row.createdAt).toLocaleString()}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function KpiCard({ label, value, subValue, status = 'good' }: { label: string; value: string; subValue?: string; status?: 'good' | 'warning' | 'danger' }) {
  const colors = {
    good: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger: 'border-l-red-500'
  };

  return (
    <div className={`bg-gradient-to-br from-slate-900 to-slate-900 border border-slate-800 rounded-lg p-4 border-l-4 ${colors[status]} shadow-sm`}>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-mono text-slate-200">{value}</span>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <Badge variant={ok ? 'success' : 'danger'}>{ok ? 'OK' : 'MISSING'}</Badge>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
