import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { PageBeam } from '../../components/layout/PageBeam';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ClientImportWizard } from './ClientImportWizard';
import { NewClientModal } from './NewClientModal';
import { EditClientModal } from './EditClientModal';
import { ClientActionsMenu } from './ClientActionsMenu';
import { NewTaskModal } from '../tasks/NewTaskModal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ContactEmailModal } from '../../components/communications/ContactEmailModal';

interface ClientListItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  stage: string;
  role: string;
  tags: string[];
  primaryProperty?: string;
  primaryDealStage?: string;
  nextDeadline?: string | null;
  openTasksCount: number;
  lastContactAt?: string | null;
  lastMarketingAt?: string | null;
  temperature?: 'HOT' | 'WARM' | 'COLD' | null;
}

interface ClientStats {
  totalClients: number;
  activeOrUnderContract: number;
  openTaskClients: number;
  upcomingDeadlineClients: number;
}

const stageStyles: Record<string, string> = {
  NEW_LEAD: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  NURTURE: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  ACTIVE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  UNDER_CONTRACT: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  CLOSED: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  PAST_CLIENT: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  DEAD: 'bg-red-500/10 text-red-300 border-red-500/20',
};

const temperatureStyles: Record<string, { badge: string; icon: string }> = {
  HOT: { badge: 'bg-orange-500/10 text-orange-300 border-orange-500/20', icon: '🔥' },
  WARM: { badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20', icon: '☀️' },
  COLD: { badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20', icon: '❄️' },
};

const normalizePhone = (value?: string) => (value || '').replace(/\D/g, '');

const getNameParts = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0]?.toLowerCase() || '',
    last: parts.slice(1).join(' ').toLowerCase() || '',
  };
};

const getMergeScore = (source: ClientListItem, target: ClientListItem) => {
  let score = 0;
  if (source.email && target.email && source.email.toLowerCase() === target.email.toLowerCase()) score += 6;
  if (source.phone && target.phone && normalizePhone(source.phone) === normalizePhone(target.phone)) score += 5;
  if (source.name && target.name && source.name.toLowerCase() === target.name.toLowerCase()) score += 5;

  const a = getNameParts(source.name || '');
  const b = getNameParts(target.name || '');
  if (a.last && a.last === b.last) score += 2;
  if (a.first && a.first === b.first) score += 1;
  return score;
};

export function ClientsListPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | 'NEEDS_ACTION' | 'DEADLINES' | 'NO_CONTACT'>('ALL');
  const [sortBy, setSortBy] = useState<'RECENT' | 'DEADLINE' | 'TASKS'>('RECENT');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientData, setEditClientData] = useState<any>(null);
  const [actionClient, setActionClient] = useState<ClientListItem | null>(null);
  const [showAddToDeal, setShowAddToDeal] = useState(false);
  const [showMergeClients, setShowMergeClients] = useState(false);
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [attachRole, setAttachRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [selectedMergeTargetId, setSelectedMergeTargetId] = useState('');
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [attachingClient, setAttachingClient] = useState(false);
  const [mergingClients, setMergingClients] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskDefaultClientId, setTaskDefaultClientId] = useState<string | undefined>(undefined);
  const [taskDefaultTitle, setTaskDefaultTitle] = useState('');
  const [quickNoteClient, setQuickNoteClient] = useState<ClientListItem | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [quickNoteError, setQuickNoteError] = useState<string | null>(null);
  const [emailClient, setEmailClient] = useState<ClientListItem | null>(null);
  const navigate = useNavigate();

  useEscapeKey(() => setQuickNoteClient(null), Boolean(quickNoteClient));

  useEffect(() => {
    fetchData();
  }, [stageFilter, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stageFilter) params.append('stage', stageFilter);
      if (searchQuery) params.append('search', searchQuery);

      const [clientsRes, statsRes] = await Promise.all([
        api.get(`/clients?${params.toString()}`),
        api.get('/clients/stats'),
      ]);

      setClients(clientsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching clients data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditClient = async (clientId: string) => {
    try {
      const res = await api.get(`/clients/${clientId}`);
      setEditClientData(res.data?.client);
      setShowEditClient(true);
    } catch (error) {
      console.error('Error fetching client for edit:', error);
    }
  };

  const moveClientStage = async (clientId: string, stage: string) => {
    await api.put(`/clients/${clientId}`, { stage });
    await fetchData();
  };

  const archiveClient = async (clientId: string) => {
    await api.put(`/clients/${clientId}`, { stage: 'PAST_CLIENT' });
    await fetchData();
  };

  const deleteClient = async (clientId: string) => {
    await api.delete(`/clients/${clientId}`);
    await fetchData();
  };

  const loadDeals = async () => {
    setLoadingDeals(true);
    try {
      const res = await api.get('/deals');
      setAllDeals(res.data || []);
    } catch (error) {
      console.error('Error loading deals:', error);
    } finally {
      setLoadingDeals(false);
    }
  };

  const openAddToDeal = async (client: ClientListItem) => {
    setActionClient(client);
    setSelectedDealId('');
    setAttachRole(client.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER');
    setShowAddToDeal(true);
    await loadDeals();
  };

  const openMergeClients = (client: ClientListItem) => {
    setActionClient(client);
    setSelectedMergeTargetId('');
    setMergeSearchQuery('');
    setShowMergeClients(true);
  };

  const mergeCandidates = useMemo(() => {
    if (!actionClient) return [] as Array<{ client: ClientListItem; score: number }>;
    return clients
      .filter((c) => c.id !== actionClient.id)
      .map((client) => ({ client, score: getMergeScore(actionClient, client) }))
      .sort((a, b) => b.score - a.score || a.client.name.localeCompare(b.client.name));
  }, [actionClient, clients]);
  const recommendedTarget = mergeCandidates.length > 0 && mergeCandidates[0].score > 0
    ? mergeCandidates[0]
    : null;
  const recommendedTargetId = recommendedTarget?.client.id || '';
  const recommendedScore = recommendedTarget?.score || 0;

  useEffect(() => {
    if (!showMergeClients || !actionClient) return;
    if (selectedMergeTargetId) return;
    if (recommendedTargetId && recommendedScore >= 6) {
      setSelectedMergeTargetId(recommendedTargetId);
    }
  }, [actionClient, recommendedScore, recommendedTargetId, selectedMergeTargetId, showMergeClients]);

  const attachClientToDeal = async () => {
    if (!actionClient || !selectedDealId) return;
    try {
      setAttachingClient(true);
      await api.patch(`/deals/${selectedDealId}/attach-client`, {
        clientId: actionClient.id,
        role: attachRole,
      });
      setShowAddToDeal(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to attach client to deal:', error);
      alert('Failed to add client to deal.');
    } finally {
      setAttachingClient(false);
    }
  };

  const mergeClients = async () => {
    if (!actionClient || !selectedMergeTargetId) return;
    if (!confirm('Merge this client into the selected client? All deals, tasks, and history will be transferred. This cannot be undone.')) {
      return;
    }
    try {
      setMergingClients(true);
      await api.post('/clients/merge', {
        sourceId: actionClient.id,
        targetId: selectedMergeTargetId,
      });
      setShowMergeClients(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to merge clients:', error);
      alert('Failed to merge clients.');
    } finally {
      setMergingClients(false);
    }
  };

  const openClientTask = (client: ClientListItem) => {
    setTaskDefaultClientId(client.id);
    setTaskDefaultTitle(`Follow up: ${client.name}`.trim());
    setShowNewTask(true);
  };

  const openClientEmail = (client: ClientListItem) => {
    if (!client.email) return;
    setEmailClient(client);
  };

  const openQuickNote = (client: ClientListItem) => {
    setQuickNoteClient(client);
    setQuickNoteText('');
    setQuickNoteError(null);
  };

  const saveQuickNote = async () => {
    if (!quickNoteClient) return;
    const text = quickNoteText.trim();
    if (!text) {
      setQuickNoteError('Please enter a note.');
      return;
    }
    try {
      setSavingQuickNote(true);
      await api.post(`/clients/${quickNoteClient.id}/notes`, { text });
      setQuickNoteClient(null);
      setQuickNoteText('');
      await fetchData();
    } catch (error) {
      console.error('Error creating client note:', error);
      setQuickNoteError('Failed to save note.');
    } finally {
      setSavingQuickNote(false);
    }
  };

  const segmentedCounts = useMemo(() => {
    const now = Date.now();
    const noContact = clients.filter((c) => !c.lastContactAt || now - new Date(c.lastContactAt).getTime() > 14 * 24 * 60 * 60 * 1000).length;
    const deadlines = clients.filter((c) => c.nextDeadline).length;
    const needsAction = clients.filter((c) => c.openTasksCount > 0).length;
    return { noContact, deadlines, needsAction };
  }, [clients]);

  const filteredClients = useMemo(() => {
    let list = [...clients];
    if (segmentFilter === 'NEEDS_ACTION') list = list.filter((c) => c.openTasksCount > 0);
    if (segmentFilter === 'DEADLINES') list = list.filter((c) => c.nextDeadline);
    if (segmentFilter === 'NO_CONTACT') {
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      list = list.filter((c) => !c.lastContactAt || new Date(c.lastContactAt).getTime() < cutoff);
    }

    if (sortBy === 'DEADLINE') {
      list.sort((a, b) => {
        const ad = a.nextDeadline ? new Date(a.nextDeadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.nextDeadline ? new Date(b.nextDeadline).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    } else if (sortBy === 'TASKS') {
      list.sort((a, b) => b.openTasksCount - a.openTasksCount);
    } else {
      list.sort((a, b) => {
        const ad = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
        const bd = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
        return bd - ad;
      });
    }
    return list;
  }, [clients, segmentFilter, sortBy]);

  const relationshipStats = useMemo(() => {
    const now = new Date();
    const overdueFollowUps = clients.filter((c) => {
      if (!c.lastContactAt) return true;
      const days = Math.floor((now.getTime() - new Date(c.lastContactAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 30;
    }).length;
    const noContactLogged = clients.filter((c) => !c.lastContactAt).length;
    const upcomingDeadlines = clients.filter((c) => {
      if (!c.nextDeadline) return false;
      const due = new Date(c.nextDeadline).getTime();
      const weekOut = now.getTime() + 7 * 24 * 60 * 60 * 1000;
      return due <= weekOut;
    }).length;
    return { overdueFollowUps, noContactLogged, upcomingDeadlines };
  }, [clients]);

  return (
    <PageLayout
      title="Clients"
      subtitle="Manage your client relationships and contact information"
    >
      <div className="relative ae-content">
      <PageBeam variant="teal" />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card tone="subtle" className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/16 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.5)] sm:hover:-translate-y-1 sm:hover:shadow-[0_30px_80px_rgba(56,189,248,0.5)] transition-all duration-300">
            <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total Clients</div>
            <div className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-white tabular-nums">{stats.totalClients}</div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1 hidden sm:block">All roles & stages</div>
          </Card>
          <Card tone="subtle" className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/16 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.5)] sm:hover:-translate-y-1 sm:hover:shadow-[0_30px_80px_rgba(56,189,248,0.5)] transition-all duration-300">
            <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active</div>
            <div className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-white tabular-nums">{stats.activeOrUnderContract}</div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1 hidden sm:block">Currently moving forward</div>
          </Card>
          <Card tone="subtle" className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/16 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.5)] sm:hover:-translate-y-1 sm:hover:shadow-[0_30px_80px_rgba(251,191,36,0.5)] transition-all duration-300">
            <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Need Action</div>
            <div className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">{stats.openTaskClients}</div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1 hidden sm:block">Needing attention</div>
          </Card>
          <Card tone="subtle" className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/16 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.5)] sm:hover:-translate-y-1 sm:hover:shadow-[0_30px_80px_rgba(129,140,248,0.5)] transition-all duration-300">
            <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Deadlines</div>
            <div className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-indigo-400 tabular-nums">{stats.upcomingDeadlineClients}</div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1 hidden sm:block">Next 30 days</div>
          </Card>
        </div>
      )}

      <Card tone="subtle" className="mt-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-white/16 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Relationship OS</div>
            <div className="text-sm sm:text-base font-semibold text-white">Keep every client warmed up automatically</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {relationshipStats.overdueFollowUps} overdue follow‑ups · {relationshipStats.noContactLogged} no contact logged · {relationshipStats.upcomingDeadlines} deadlines this week
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSegmentFilter('NO_CONTACT')}
              className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20"
            >
              Show no‑contact
            </button>
            <button
              onClick={() => setSegmentFilter('DEADLINES')}
              className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              Show deadlines
            </button>
            <button
              onClick={() => {
                setTaskDefaultClientId(undefined);
                setTaskDefaultTitle('Client follow-up');
                setShowNewTask(true);
              }}
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
            >
              Create follow‑up task
            </button>
            <button
              onClick={() => navigate('/tasks')}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
            >
              Open tasks
            </button>
          </div>
        </div>
      </Card>

      {/* Toolbar */}
      <Card tone="solid" className="p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xl border-white/10">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <input
              type="text"
              placeholder="Search clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 sm:py-2 bg-white/5 border border-white/10 rounded-xl sm:rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-4 py-2.5 sm:py-2 bg-white/5 border border-white/10 rounded-xl sm:rounded-full text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [&>option]:bg-slate-900"
            >
              <option value="">All stages</option>
              <option value="NEW_LEAD">New Lead</option>
              <option value="NURTURE">Nurture</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_CONTRACT">Under Contract</option>
              <option value="CLOSED">Closed</option>
              <option value="PAST_CLIENT">Past Client</option>
              <option value="DEAD">Dead</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 sm:py-2 bg-white/5 border border-white/10 rounded-xl sm:rounded-full text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [&>option]:bg-slate-900"
            >
              <option value="RECENT">Sort: Recent contact</option>
              <option value="DEADLINE">Sort: Deadline</option>
              <option value="TASKS">Sort: Open tasks</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSegmentFilter('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                segmentFilter === 'ALL' ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSegmentFilter('NEEDS_ACTION')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                segmentFilter === 'NEEDS_ACTION'
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              Needs action ({segmentedCounts.needsAction})
            </button>
            <button
              onClick={() => setSegmentFilter('DEADLINES')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                segmentFilter === 'DEADLINES'
                  ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              Deadlines ({segmentedCounts.deadlines})
            </button>
            <button
              onClick={() => setSegmentFilter('NO_CONTACT')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                segmentFilter === 'NO_CONTACT'
                  ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              No contact 14d ({segmentedCounts.noContact})
            </button>
          </div>
          {/* Action Buttons Row */}
          <div className="flex gap-2 sm:gap-3">
            <Button variant="secondary" onClick={() => setShowImportWizard(true)} className="flex-1 sm:flex-none bg-white/5 text-slate-300 hover:text-white active:bg-white/15 sm:hover:bg-white/10 border-white/5 text-sm">
              Import
            </Button>
            <Button onClick={() => setShowNewClientModal(true)} className="flex-1 sm:flex-none text-sm">
              + New Client
            </Button>
          </div>
        </div>
      </Card>

      {/* Client Grid */}
      {loading && !clients.length ? (
        <div className="text-center py-12 text-slate-500">Loading clients...</div>
      ) : clients.length === 0 ? (
        <Card tone="solid" className="bg-slate-900/40 backdrop-blur-xl border-white/10 border-dashed">
          <EmptyState
            icon={<span className="text-4xl">👥</span>}
            title="No clients yet"
            description="Get started by adding your first client or importing from another system."
            action={{
              label: 'Add First Client',
              onClick: () => setShowNewClientModal(true)
            }}
            secondaryAction={{
              label: 'Import CSV',
              onClick: () => navigate('/settings/data')
            }}
            tips={[
              'Add buyers and sellers as you start working with them',
              'Tag clients with labels for quick filtering',
              'Set temperature (Hot, Warm, Cold) to prioritize follow-ups',
            ]}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => (
            <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)}>
              <Card
                tone="solid"
                hover
                className="p-4 bg-slate-950/40 backdrop-blur-xl border-white/10 hover:bg-slate-900/60 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer group"
              >
              {/* Top Row */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">
                    {client.name}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="default" className={stageStyles[client.stage] || stageStyles.NEW_LEAD}>
                      {client.stage.replace('_', ' ')}
                    </Badge>
                    <Badge variant="default" className="bg-slate-800 text-slate-400 border-slate-700 shadow-none">
                      {client.role}
                    </Badge>
                    {client.temperature && temperatureStyles[client.temperature] && (
                      <Badge variant="default" className={temperatureStyles[client.temperature].badge + " px-1.5"}>
                        <span className="mr-1">{temperatureStyles[client.temperature].icon}</span>
                        {client.temperature}
                      </Badge>
                    )}
                  </div>
                </div>
                <ClientActionsMenu
                  clientName={client.name}
                  currentStage={client.stage}
                  onOpen={() => navigate(`/clients/${client.id}`)}
                  onStartDeal={() => navigate(`/deals/new?clientId=${client.id}&role=${client.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER'}`)}
                  onAddTask={() => openClientTask(client)}
                  onAddToDeal={() => openAddToDeal(client)}
                  onMerge={() => openMergeClients(client)}
                  onEdit={() => openEditClient(client.id)}
                  onMoveStage={(stage) => moveClientStage(client.id, stage)}
                  onArchive={() => archiveClient(client.id)}
                  onDelete={() => deleteClient(client.id)}
                />
              </div>

              {/* Contact Info */}
              <div className="flex gap-4 text-xs text-slate-400 mb-4">
                {client.email && (
                  <div className="flex items-center gap-1 truncate max-w-[120px]" title={client.email}>
                    ✉️ {client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-1 truncate" title={client.phone}>
                    📞 {client.phone}
                  </div>
                )}
              </div>

              {/* Quick actions */}
              {(client.phone || client.email) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 text-[10px] font-semibold hover:bg-emerald-500/20"
                    >
                      📞 Call
                    </a>
                  )}
                  {client.phone && (
                    <a
                      href={`sms:${client.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-200 text-[10px] font-semibold hover:bg-blue-500/20"
                    >
                      💬 Text
                    </a>
                  )}
                  {client.email && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openClientEmail(client);
                      }}
                      className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-200 text-[10px] font-semibold hover:bg-purple-500/20"
                    >
                      ✉️ Email
                    </button>
                  )}
                </div>
              )}

              {/* Active Deal / Status */}
              <div className="bg-white/5 rounded-lg p-3 mb-3 border border-white/5">
                {client.primaryProperty ? (
                  <div>
                    <div className="text-xs text-emerald-400 font-medium mb-0.5">
                      {client.primaryDealStage === 'UNDER_CONTRACT' ? 'Under Contract' : 'Active Deal'}
                    </div>
                    <div className="text-sm text-white truncate">{client.primaryProperty}</div>
                    {client.nextDeadline && (
                      <div className="text-xs text-indigo-300 mt-1">
                        Due: {new Date(client.nextDeadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No active deal · Nurture</div>
                )}
              </div>

              {/* Bottom Row */}
              <div className="flex justify-between items-center text-[10px] pt-2 border-t border-white/5">
                <div>
                  {(() => {
                    if (!client.lastContactAt) {
                      return <span className="text-rose-400 font-medium">⚠ Never contacted</span>;
                    }
                    const days = Math.floor((Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24));
                    if (days <= 7) {
                      return <span className="text-emerald-400">Last contact: {days === 0 ? 'today' : `${days}d ago`}</span>;
                    } else if (days <= 14) {
                      return <span className="text-amber-400">Last contact: {days}d ago</span>;
                    } else {
                      return <span className="text-rose-400 font-medium">Last contact: {days}d ago ⚠</span>;
                    }
                  })()}
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openQuickNote(client);
                    }}
                    className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-[10px] hover:bg-cyan-500/20 transition-colors"
                  >
                    Quick note
                  </button>
                  {client.openTasksCount > 0 && (
                    <span className="text-amber-400 font-medium">{client.openTasksCount} tasks</span>
                  )}
                  {!client.lastContactAt && (
                    <span className="text-rose-300 font-medium">Follow up</span>
                  )}
                  {/* Marketing placeholder */}
                  {/* <span className="text-slate-500">No campaigns</span> */}
                </div>
              </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {showAddToDeal && actionClient && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddToDeal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-6 bg-slate-950/95 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Add Client to Deal</h3>
                <button className="text-slate-400 hover:text-white" onClick={() => setShowAddToDeal(false)}>✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select Deal</label>
                  <select
                    value={selectedDealId}
                    onChange={(e) => setSelectedDealId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  >
                    <option value="">Choose a deal</option>
                    {allDeals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.title}
                      </option>
                    ))}
                  </select>
                  {loadingDeals && <div className="mt-2 text-xs text-slate-400">Loading deals…</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Role in this deal</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAttachRole('BUYER')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                        attachRole === 'BUYER'
                          ? 'bg-blue-500/20 border-blue-400/40 text-blue-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      Buyer
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachRole('SELLER')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                        attachRole === 'SELLER'
                          ? 'bg-orange-500/20 border-orange-400/40 text-orange-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      Seller
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" className="bg-white/5 text-slate-200" onClick={() => setShowAddToDeal(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                  disabled={!selectedDealId || attachingClient}
                  onClick={attachClientToDeal}
                >
                  {attachingClient ? 'Adding…' : 'Add to Deal'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {showMergeClients && actionClient && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMergeClients(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-6 bg-slate-950/95 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Merge Client</h3>
                <button className="text-slate-400 hover:text-white" onClick={() => setShowMergeClients(false)}>✕</button>
              </div>
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Source (will be merged)</div>
                <div className="text-sm font-semibold text-white">{actionClient.name}</div>
                <div className="text-xs text-slate-400">{actionClient.email || actionClient.phone || 'No contact info'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="default" className="bg-white/10 text-slate-200 border-white/10">
                    Stage: {actionClient.stage}
                  </Badge>
                  <Badge variant="default" className="bg-white/10 text-slate-200 border-white/10">
                    Open tasks: {actionClient.openTasksCount}
                  </Badge>
                  {actionClient.nextDeadline && (
                    <Badge variant="default" className="bg-amber-500/10 text-amber-200 border-amber-400/20">
                      Deadline: {new Date(actionClient.nextDeadline).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
              {recommendedTargetId && (
                <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                  <div className="text-xs uppercase tracking-wider text-emerald-300 mb-1">Recommended target</div>
                  <div className="text-sm font-semibold text-white">
                    {mergeCandidates[0]?.client.name}
                  </div>
                  <div className="text-xs text-emerald-200/80">
                    {mergeCandidates[0]?.client.email || mergeCandidates[0]?.client.phone || 'No contact info'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMergeTargetId(recommendedTargetId)}
                    className="mt-2 inline-flex items-center rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                  >
                    Use recommended
                  </button>
                </div>
              )}
              {selectedMergeTargetId && (
                <div className="mb-4 rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
                  <div className="text-xs uppercase tracking-wider text-purple-300 mb-1">Target (will keep)</div>
                  <div className="text-sm font-semibold text-white">
                    {clients.find((c) => c.id === selectedMergeTargetId)?.name || 'Selected target'}
                  </div>
                  <div className="text-xs text-purple-200/80">
                    {clients.find((c) => c.id === selectedMergeTargetId)?.email ||
                      clients.find((c) => c.id === selectedMergeTargetId)?.phone ||
                      'No contact info'}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Merge into</label>
                <div className="relative">
                  <input
                    value={mergeSearchQuery}
                    onChange={(e) => setMergeSearchQuery(e.target.value)}
                    placeholder="Search clients by name, email, or phone..."
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                  <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-slate-950/80">
                    {mergeCandidates
                      .filter(({ client }) => {
                        const q = mergeSearchQuery.toLowerCase();
                        if (!q) return true;
                        return (
                          client.name.toLowerCase().includes(q) ||
                          client.email?.toLowerCase().includes(q) ||
                          client.phone?.includes(mergeSearchQuery)
                        );
                      })
                      .map(({ client, score }) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setSelectedMergeTargetId(client.id)}
                          className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                            selectedMergeTargetId === client.id
                              ? 'bg-purple-500/15 text-white'
                              : 'hover:bg-white/5 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{client.name}</div>
                            {client.id === recommendedTargetId && score > 0 && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{client.email || client.phone || 'No contact info'}</div>
                        </button>
                      ))}
                    {mergeCandidates.length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-500">No other clients found.</div>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  This will move all deals, tasks, and history into the selected client.
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" className="bg-white/5 text-slate-200" onClick={() => setShowMergeClients(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                  disabled={!selectedMergeTargetId || mergingClients}
                  onClick={mergeClients}
                >
                  {mergingClients ? 'Merging…' : 'Merge Client'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {showNewTask && (
        <NewTaskModal
          defaultClientId={taskDefaultClientId}
          defaultTitle={taskDefaultTitle}
          defaultCategory="CALL"
          onClose={() => setShowNewTask(false)}
          onComplete={() => {
            setShowNewTask(false);
            fetchData();
          }}
        />
      )}

      {showImportWizard && (
        <ClientImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={() => {
            fetchData();
          }}
        />
      )}

      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onComplete={() => {
            fetchData();
          }}
        />
      )}

      {showEditClient && editClientData && (
        <EditClientModal
          client={editClientData}
          onClose={() => {
            setShowEditClient(false);
            setEditClientData(null);
          }}
          onComplete={() => {
            setShowEditClient(false);
            setEditClientData(null);
            fetchData();
          }}
        />
      )}

      {emailClient?.email && (
        <ContactEmailModal
          open={Boolean(emailClient)}
          contactType="client"
          contactId={emailClient.id}
          contactName={emailClient.name}
          contactEmail={emailClient.email}
          onClose={() => setEmailClient(null)}
          onSent={() => {
            fetchData();
          }}
        />
      )}

      {quickNoteClient && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setQuickNoteClient(null)} />
          <div className="absolute inset-x-4 sm:inset-x-auto sm:right-8 top-20 sm:top-24 sm:w-[420px] bg-slate-950/90 border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="text-sm font-semibold text-white mb-1">Quick note</div>
            <div className="text-xs text-slate-400 mb-3">
              {quickNoteClient.name} • Notes save to the Timeline automatically.
            </div>
            <textarea
              value={quickNoteText}
              onChange={(e) => setQuickNoteText(e.target.value)}
              rows={4}
              placeholder="Call summary, next steps, preferences…"
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/40"
            />
            {quickNoteError && <div className="mt-2 text-xs text-rose-300">{quickNoteError}</div>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setQuickNoteClient(null)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveQuickNote()}
                disabled={savingQuickNote || !quickNoteText.trim()}
                className="px-3 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-60"
              >
                {savingQuickNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}

