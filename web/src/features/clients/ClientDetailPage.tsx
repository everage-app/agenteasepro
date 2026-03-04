import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { NewTaskModal } from '../tasks/NewTaskModal';
import { EditClientModal } from './EditClientModal';
import { formatPhoneDisplay, phoneToSmsHref, phoneToTelHref } from '../../lib/phone';
import { ClientActionsMenu } from './ClientActionsMenu';
import { MarketingCampaignModal } from '../marketing/MarketingCampaignModal';
import { ContactEmailModal } from '../../components/communications/ContactEmailModal';

interface ClientDetail {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    role: string;
    stage: string;
    temperature?: 'HOT' | 'WARM' | 'COLD' | null;
    mailingAddress?: string | null;
    mailingCity?: string | null;
    mailingState?: string | null;
    mailingZip?: string | null;
    leadSource: string | null;
    tags: string[];
    referralRank?: 'A' | 'B' | 'C';
    notes?: string | null;
    birthday?: string | null;
  };
  deals: Array<{
    id: string;
    title: string;
    address?: string;
    stage: string;
    nextDeadline: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    status: string;
  }>;
  marketing: {
    blasts: any[];
    lastContactAt: string | null;
  };
  forms: Array<{
    id: string;
    kind: 'ESIGN_ENVELOPE' | 'FORM_INSTANCE';
    title: string;
    status: string;
    sentAt: string | null;
    signedAt: string | null;
    updatedAt: string;
    dealId: string;
    dealTitle: string;
    propertyAddress: string | null;
    formCode: string | null;
    signerSummary?: {
      total: number;
      signed: number;
      viewed: number;
    };
    downloadUrl?: string | null;
  }>;
  timeline: Array<{
    id: string;
    type: string;
    at: string;
    label: string;
    meta?: any;
  }>;
}

const stageColors: Record<string, string> = {
  NEW_LEAD: 'blue',
  NURTURE: 'indigo',
  ACTIVE: 'emerald',
  UNDER_CONTRACT: 'violet',
  CLOSED: 'slate',
  PAST_CLIENT: 'slate',
  DEAD: 'red',
};

const temperatureStyles: Record<string, { badge: string; icon: string }> = {
  HOT: { badge: 'bg-orange-500/10 text-orange-300 border-orange-500/20', icon: '🔥' },
  WARM: { badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20', icon: '☀️' },
  COLD: { badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20', icon: '❄️' },
};

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'deals' | 'forms' | 'marketing' | 'tasks'>('timeline');
  const [showEditClient, setShowEditClient] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskDefaultTitle, setTaskDefaultTitle] = useState('');
  const [showMarketingCampaign, setShowMarketingCampaign] = useState(false);
  const [showContactEmail, setShowContactEmail] = useState(false);
  const [copied, setCopied] = useState<null | 'phone' | 'email' | 'address'>(null);
  const [newNote, setNewNote] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);
  const [showAddToDeal, setShowAddToDeal] = useState(false);
  const [showMergeClients, setShowMergeClients] = useState(false);
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [attachRole, setAttachRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [selectedDealId, setSelectedDealId] = useState('');
  const [selectedMergeTargetId, setSelectedMergeTargetId] = useState('');
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [mergingClients, setMergingClients] = useState(false);
  const [attachingClient, setAttachingClient] = useState(false);

  // Set initial tab from URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['timeline', 'deals', 'forms', 'marketing', 'tasks'].includes(tabParam)) {
      setActiveTab(tabParam as 'timeline' | 'deals' | 'forms' | 'marketing' | 'tasks');
    }
  }, [searchParams]);

  useEffect(() => {
    if (id) fetchClient();
  }, [id]);

  const fetchClient = async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      setData(res.data);
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading client details...</div>;
  if (!data) return <div className="p-8 text-slate-400">Client not found.</div>;

  const { client, deals, tasks, marketing, forms, timeline } = data;
  const openTasksCount = tasks.filter(t => t.status !== 'DONE').length;
  const now = new Date();
  const overdueTasks = tasks.filter(task => task.dueAt && new Date(task.dueAt) < now && task.status !== 'DONE').length;
  const dueSoonTasks = tasks.filter(task => {
    if (!task.dueAt || task.status === 'DONE') return false;
    const due = new Date(task.dueAt).getTime();
    const soon = now.getTime() + 3 * 24 * 60 * 60 * 1000;
    return due >= now.getTime() && due <= soon;
  }).length;
  const completedTasks = tasks.filter(task => task.status === 'DONE').length;
  const signedFormsCount = forms.filter((form) => form.status === 'SIGNED').length;
  const pendingFormsCount = forms.filter((form) => ['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(form.status)).length;
  const draftFormsCount = forms.filter((form) => form.status === 'DRAFT').length;
  const lastContactLabel = marketing.lastContactAt
    ? new Date(marketing.lastContactAt).toLocaleDateString()
    : 'No contact logged';

  const conversationBrief = useMemo(() => {
    const sortedTimeline = timeline.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const latest = sortedTimeline[0];
    const recentReply = sortedTimeline.find((item) => (item.label || '').toLowerCase().includes('reply'));
    const daysSinceContact = marketing.lastContactAt
      ? Math.max(0, Math.floor((Date.now() - new Date(marketing.lastContactAt).getTime()) / 86400000))
      : null;

    let nextStep = 'Advance one concrete next step and assign an owner today.';
    if (recentReply) nextStep = 'Respond now and secure a committed call time.';
    else if (overdueTasks > 0) nextStep = `Clear ${overdueTasks} overdue task${overdueTasks === 1 ? '' : 's'} before new outreach.`;
    else if ((daysSinceContact ?? 0) >= 7) nextStep = 'Send a re-engagement message and propose two appointment slots.';

    return {
      latestLabel: latest?.label || 'No recent timeline activity',
      latestAt: latest?.at || null,
      daysSinceContact,
      hasRecentReply: Boolean(recentReply),
      nextStep,
    };
  }, [marketing.lastContactAt, overdueTasks, timeline]);

  const getFormStatusClass = (status: string) => {
    if (status === 'SIGNED') return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
    if (status === 'PARTIALLY_SIGNED') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
    if (status === 'VIEWED') return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40';
    if (status === 'SENT') return 'bg-blue-500/20 text-blue-300 border-blue-400/40';
    if (status === 'DRAFT') return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    return 'bg-purple-500/20 text-purple-300 border-purple-400/40';
  };

  const formatFormStatus = (status: string) =>
    status
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const copyToClipboard = async (text: string, kind: 'phone' | 'email' | 'address') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // Fallback
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(kind);
        window.setTimeout(() => setCopied(null), 1200);
      } catch {
        // ignore
      }
    }
  };

  const moveClientStage = async (stage: string) => {
    await api.put(`/clients/${client.id}`, { stage });
    await fetchClient();
  };

  const archiveClient = async () => {
    await api.put(`/clients/${client.id}`, { stage: 'PAST_CLIENT' });
    await fetchClient();
  };

  const deleteClient = async () => {
    await api.delete(`/clients/${client.id}`);
    navigate('/clients');
  };

  const openClientTask = () => {
    setTaskDefaultTitle(`Follow up: ${client.firstName} ${client.lastName}`.trim());
    setShowNewTask(true);
  };

  const openMarketingCampaign = () => {
    setShowMarketingCampaign(true);
  };

  const openContactEmail = () => {
    if (!client.email) return;
    setShowContactEmail(true);
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

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const res = await api.get('/clients');
      const list = (res.data || []).filter((c: any) => c.id !== client.id);
      setAllClients(list);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const openAddToDeal = async () => {
    setAttachRole(client.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER');
    setSelectedDealId('');
    setShowAddToDeal(true);
    await loadDeals();
  };

  const openMergeClients = async () => {
    setSelectedMergeTargetId('');
    setShowMergeClients(true);
    await loadClients();
  };

  const attachClientToDeal = async () => {
    if (!selectedDealId) return;
    try {
      setAttachingClient(true);
      await api.patch(`/deals/${selectedDealId}/attach-client`, {
        clientId: client.id,
        role: attachRole,
      });
      setShowAddToDeal(false);
      await fetchClient();
    } catch (error) {
      console.error('Failed to attach client to deal:', error);
      alert('Failed to add client to deal.');
    } finally {
      setAttachingClient(false);
    }
  };

  const mergeClients = async () => {
    if (!selectedMergeTargetId) return;
    if (!confirm('Merge this client into the selected client? All deals, tasks, and history will be transferred. This cannot be undone.')) {
      return;
    }
    try {
      setMergingClients(true);
      await api.post('/clients/merge', {
        sourceId: client.id,
        targetId: selectedMergeTargetId,
      });
      navigate(`/clients/${selectedMergeTargetId}`);
    } catch (error) {
      console.error('Failed to merge clients:', error);
      alert('Failed to merge clients.');
    } finally {
      setMergingClients(false);
    }
  };

  const createNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    try {
      setCreatingNote(true);
      await api.post(`/clients/${client.id}/notes`, { text });
      setNewNote('');
      await fetchClient();
      setActiveTab('timeline');
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to create note.');
    } finally {
      setCreatingNote(false);
    }
  };

  const scrollToId = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToTab = (tab: 'timeline' | 'deals' | 'forms' | 'marketing' | 'tasks') => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => scrollToId('client-tabs'));
  };

  const jumpToTimelineFeed = () => {
    setActiveTab('timeline');
    window.requestAnimationFrame(() => scrollToId('client-timeline-feed'));
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl px-6 py-5 md:px-8 md:py-6 shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
        {/* Accent gradients */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/40 blur-3xl rounded-full" />
          <div className="absolute -bottom-32 left-32 w-80 h-80 bg-emerald-500/30 blur-3xl rounded-full" />
          <div className="absolute -top-32 right-0 w-72 h-72 bg-blue-500/30 blur-3xl rounded-full" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/80 via-emerald-400/80 to-blue-500/80 shadow-lg shadow-cyan-500/40 text-xl font-semibold text-white capitalize">
                {client.firstName?.charAt(0)}{client.lastName?.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                  {client.firstName} {client.lastName}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="default" className={`bg-${stageColors[client.stage] || 'slate'}-500/10 text-${stageColors[client.stage] || 'slate'}-300 border-${stageColors[client.stage] || 'slate'}-500/30` }>
                    {client.stage.replace('_', ' ')}
                  </Badge>
                  <Badge variant="default" className="text-slate-300 border-slate-600/60 bg-white/5 shadow-none">
                    {client.role}
                  </Badge>
                  {client.temperature && temperatureStyles[client.temperature] && (
                    <Badge variant="default" className={temperatureStyles[client.temperature].badge + " px-2"}>
                      <span className="mr-1.5">{temperatureStyles[client.temperature].icon}</span>
                      {client.temperature}
                    </Badge>
                  )}
                  {client.leadSource && (
                    <Badge variant="default" className="text-cyan-200 border-cyan-400/40 bg-cyan-500/10 shadow-none">
                      Source: {client.leadSource}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-300/90 mt-1">
              {client.email && (
                <button type="button" onClick={openContactEmail} className="hover:text-white transition-colors flex items-center gap-1">
                  ✉️ {client.email}
                </button>
              )}
              {client.phone && (
                <a
                  href={phoneToTelHref(client.phone) || undefined}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  📞 {formatPhoneDisplay(client.phone)}
                </a>
              )}
            </div>

            {/* Quick actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {client.phone && (
                <a
                  href={phoneToTelHref(client.phone) || undefined}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors text-xs font-medium text-slate-200"
                >
                  <span>📞</span>
                  <span>Call</span>
                </a>
              )}
              {client.phone && (
                <a
                  href={phoneToSmsHref(client.phone) || undefined}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors text-xs font-medium text-slate-200"
                >
                  <span>💬</span>
                  <span>Text</span>
                </a>
              )}
              {client.email && (
                <button
                  type="button"
                  onClick={openContactEmail}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors text-xs font-medium text-slate-200"
                >
                  <span>✉️</span>
                  <span>Email</span>
                </button>
              )}
              {client.phone && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(formatPhoneDisplay(client.phone), 'phone')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors text-xs font-medium text-slate-200"
                >
                  <span>📋</span>
                  <span>{copied === 'phone' ? 'Copied' : 'Copy phone'}</span>
                </button>
              )}
              {client.email && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(client.email!, 'email')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-white/10 transition-colors text-xs font-medium text-slate-200"
                >
                  <span>📋</span>
                  <span>{copied === 'email' ? 'Copied' : 'Copy email'}</span>
                </button>
              )}
            </div>

            {/* Mailing Address Card */}
            {client.mailingAddress && (
              <div className="mt-5 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-400/30 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-md">
                    <span className="text-xl">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wide mb-1.5">
                      Mailing Address
                    </div>
                    <div className="text-sm font-medium text-white leading-relaxed">
                      {client.mailingAddress}
                      {(client.mailingCity || client.mailingState || client.mailingZip) && (
                        <>
                          <br />
                          <span className="text-slate-300">
                            {[client.mailingCity, client.mailingState, client.mailingZip]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fullAddress = [
                        client.mailingAddress,
                        client.mailingCity,
                        client.mailingState,
                        client.mailingZip
                      ].filter(Boolean).join(', ');
                      copyToClipboard(fullAddress, 'address');
                    }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 hover:border-cyan-400/50 transition-all text-xs font-medium text-slate-200"
                  >
                    {copied === 'address' ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              </div>
            )}

          {client.referralRank && (
            <div className="mt-3">
              <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Referral Rank</span>
              <Badge
                variant="default"
                className={
                  client.referralRank === 'A'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40'
                    : client.referralRank === 'B'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-400/40'
                    : 'bg-slate-500/10 text-slate-300 border-slate-400/40'
                }
              >
                {client.referralRank}-List
              </Badge>
            </div>
          )}
          {client.tags.length > 0 && (
            <div className="flex gap-2 mt-3">
              {client.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-slate-400 border border-white/5">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Birthday */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">🎂 Birthday:</span>
            {client.birthday ? (
              <span className="text-xs text-slate-200">
                {new Date(client.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                {(() => {
                  const bday = new Date(client.birthday);
                  const today = new Date();
                  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                  const diff = Math.floor((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  if (diff === 0) return <span className="ml-1 text-amber-300 font-semibold">🎉 Today!</span>;
                  if (diff > 0 && diff <= 7) return <span className="ml-1 text-cyan-300 text-[10px]">(in {diff}d)</span>;
                  if (diff < 0) {
                    const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
                    const daysUntil = Math.floor((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntil <= 30) return <span className="ml-1 text-cyan-300 text-[10px]">(in {daysUntil}d)</span>;
                  }
                  return null;
                })()}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowEditClient(true)}
                className="text-[11px] text-slate-500 hover:text-cyan-300 transition-colors"
              >
                + Add birthday
              </button>
            )}
          </div>

          <div className="mt-4 max-w-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Profile notes</div>
              <button
                type="button"
                onClick={() => setShowEditClient(true)}
                className="text-[11px] text-cyan-300 hover:text-cyan-200"
              >
                Edit notes
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-200 whitespace-pre-line bg-slate-900/60 border border-white/10 rounded-xl p-3">
              {client.notes || 'No profile notes yet. Add important context, preferences, and key details here.'}
            </p>
            <div className="mt-2 text-[11px] text-slate-500">
              Quick notes belong in the Timeline tab so they show up in the client history.
            </div>
          </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch md:items-start">
            <Button
              variant="secondary"
              onClick={() => setShowEditClient(true)}
            >
              Edit Client
            </Button>
            <Button
              variant="secondary"
              className="bg-white/5 border-white/20 hover:bg-white/10 hover:border-cyan-400/40 text-slate-100"
              onClick={() => navigate(`/deals/new?clientId=${client.id}&role=${client.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER'}`)}
            >
              Start Deal
            </Button>
            <Button
              variant="secondary"
              className="bg-white/5 border-white/20 hover:bg-white/10 hover:border-cyan-400/40 text-slate-100"
              onClick={openAddToDeal}
            >
              Add to Deal
            </Button>
            <Button
              variant="secondary"
              className="bg-white/5 border-white/20 hover:bg-white/10 hover:border-purple-400/40 text-slate-100"
              onClick={openMergeClients}
            >
              Merge Client
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/40"
              onClick={openClientTask}
            >
              + Add Task
            </Button>
            <div className="self-stretch flex items-center justify-end">
              <ClientActionsMenu
                clientName={`${client.firstName} ${client.lastName}`}
                currentStage={client.stage}
                onOpen={() => navigate(`/clients/${client.id}`)}
                onStartDeal={() => navigate(`/deals/new?clientId=${client.id}&role=${client.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER'}`)}
                onAddToDeal={openAddToDeal}
                onMerge={openMergeClients}
                onAddTask={openClientTask}
                onAddToMarketing={openMarketingCampaign}
                onEdit={() => setShowEditClient(true)}
                onMoveStage={(stage) => moveClientStage(stage)}
                onArchive={() => archiveClient()}
                onDelete={() => deleteClient()}
              />
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-slate-950/60 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm font-semibold text-white">Conversation Brief</div>
          {conversationBrief.hasRecentReply && (
            <span className="text-[10px] px-2 py-1 rounded-md border border-emerald-400/30 text-emerald-300">
              Recent reply
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-2.5">
            <div className="text-slate-500">Last contact</div>
            <div className="text-slate-200 mt-1">
              {conversationBrief.daysSinceContact === null
                ? lastContactLabel
                : conversationBrief.daysSinceContact === 0
                  ? 'Today'
                  : `${conversationBrief.daysSinceContact}d ago`}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-2.5">
            <div className="text-slate-500">Latest timeline</div>
            <div className="text-slate-200 mt-1 truncate">{conversationBrief.latestLabel}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-2.5">
            <div className="text-slate-500">When</div>
            <div className="text-slate-200 mt-1">
              {conversationBrief.latestAt ? new Date(conversationBrief.latestAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-cyan-200">Next best step: {conversationBrief.nextStep}</div>
      </Card>

      {showEditClient && (
        <EditClientModal
          client={{
            ...client,
            temperature: client.temperature || undefined
          }}
          onClose={() => setShowEditClient(false)}
          onComplete={() => {
            fetchClient();
          }}
        />
      )}

      {showNewTask && (
        <NewTaskModal
          defaultClientId={client.id}
          defaultTitle={taskDefaultTitle}
          defaultCategory="CALL"
          onClose={() => setShowNewTask(false)}
          onComplete={() => {
            fetchClient();
            setActiveTab('tasks');
          }}
        />
      )}

      {showMarketingCampaign && (
        <MarketingCampaignModal
          targetType="client"
          targetName={`${client.firstName} ${client.lastName}`.trim()}
          targetEmail={client.email}
          clientId={client.id}
          onClose={() => setShowMarketingCampaign(false)}
          onOpenMarketing={() => {
            setShowMarketingCampaign(false);
            navigate('/marketing');
          }}
          onComplete={() => {
            setShowMarketingCampaign(false);
            fetchClient();
            setActiveTab('marketing');
          }}
        />
      )}

      {showContactEmail && client.email && (
        <ContactEmailModal
          open={showContactEmail}
          contactType="client"
          contactId={client.id}
          contactName={`${client.firstName} ${client.lastName}`.trim()}
          contactEmail={client.email}
          onClose={() => setShowContactEmail(false)}
          onSent={() => {
            fetchClient();
          }}
        />
      )}

      {/* Tabs */}
      <div id="client-tabs" className="border-b border-white/10 scroll-mt-24">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'timeline', label: 'Timeline', count: timeline.length },
            { key: 'deals', label: 'Deals', count: deals.length },
            { key: 'marketing', label: 'Marketing', count: marketing.blasts.length },
            { key: 'tasks', label: 'Tasks', count: tasks.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border backdrop-blur-xl ${
                activeTab === tab.key
                  ? 'text-white bg-gradient-to-r from-cyan-500/20 via-white/10 to-blue-500/20 border-cyan-300/35 shadow-[0_0_24px_rgba(34,211,238,0.20)]'
                  : 'text-slate-100 bg-slate-900/30 border-white/15 hover:border-white/30 hover:bg-slate-900/45'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
                  activeTab === tab.key
                    ? 'bg-white/15 text-white border-cyan-200/30'
                    : 'bg-white/10 text-slate-100 border-white/20'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {showAddToDeal && (
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

      {showMergeClients && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMergeClients(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-6 bg-slate-950/95 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Merge Client</h3>
                <button className="text-slate-400 hover:text-white" onClick={() => setShowMergeClients(false)}>✕</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Merge into</label>
                <select
                  value={selectedMergeTargetId}
                  onChange={(e) => setSelectedMergeTargetId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  <option value="">Choose a client</option>
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
                {loadingClients && <div className="mt-2 text-xs text-slate-400">Loading clients…</div>}
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

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'timeline' && (
          <div className="max-w-4xl space-y-4">
            {/* Timeline Stats */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                type="button"
                onClick={jumpToTimelineFeed}
                aria-label="Jump to client timeline"
                className="group w-full sm:w-[210px] md:w-[216px] flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900/35 px-3 py-2.5 backdrop-blur-xl transition-all shadow-[0_10px_28px_rgba(2,6,23,0.45)] hover:shadow-[0_14px_34px_rgba(34,211,238,0.18)] hover:bg-slate-900/50 hover:border-cyan-300/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/35"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-300/25 flex items-center justify-center shadow-sm group-hover:bg-cyan-500/30 transition-colors">
                    <span className="text-[15px]">📊</span>
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-300 truncate">Events</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-lg font-semibold text-white tabular-nums">{timeline.length}</div>
                  <div className="text-slate-400 group-hover:text-cyan-200 transition-colors">›</div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                type="button"
                onClick={() => jumpToTab('deals')}
                aria-label="Jump to client deals"
                className="group w-full sm:w-[210px] md:w-[216px] flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900/35 px-3 py-2.5 backdrop-blur-xl transition-all shadow-[0_10px_28px_rgba(2,6,23,0.45)] hover:shadow-[0_14px_34px_rgba(52,211,153,0.18)] hover:bg-slate-900/50 hover:border-emerald-300/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-300/25 flex items-center justify-center shadow-sm group-hover:bg-emerald-500/30 transition-colors">
                    <span className="text-[15px]">📄</span>
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-300 truncate">Deals</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-lg font-semibold text-white tabular-nums">{deals.length}</div>
                  <div className="text-slate-400 group-hover:text-emerald-200 transition-colors">›</div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                type="button"
                onClick={() => jumpToTab('tasks')}
                aria-label="Jump to client tasks"
                className="group w-full sm:w-[210px] md:w-[216px] flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900/35 px-3 py-2.5 backdrop-blur-xl transition-all shadow-[0_10px_28px_rgba(2,6,23,0.45)] hover:shadow-[0_14px_34px_rgba(251,191,36,0.18)] hover:bg-slate-900/50 hover:border-amber-300/35 focus:outline-none focus:ring-2 focus:ring-amber-400/35"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-300/25 flex items-center justify-center shadow-sm group-hover:bg-amber-500/30 transition-colors">
                    <span className="text-[15px]">✅</span>
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-300 truncate">Tasks</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-lg font-semibold text-white tabular-nums">{tasks.length}</div>
                  <div className="text-slate-400 group-hover:text-amber-200 transition-colors">›</div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                type="button"
                onClick={() => jumpToTab('forms')}
                aria-label="Jump to client forms"
                className="group w-full sm:w-[210px] md:w-[216px] flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900/35 px-3 py-2.5 backdrop-blur-xl transition-all shadow-[0_10px_28px_rgba(2,6,23,0.45)] hover:shadow-[0_14px_34px_rgba(59,130,246,0.18)] hover:bg-slate-900/50 hover:border-blue-300/35 focus:outline-none focus:ring-2 focus:ring-blue-400/35"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-300/25 flex items-center justify-center shadow-sm group-hover:bg-blue-500/30 transition-colors">
                    <span className="text-[15px]">📝</span>
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-300 truncate">Forms</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-lg font-semibold text-white tabular-nums">{forms.length}</div>
                  <div className="text-slate-400 group-hover:text-blue-200 transition-colors">›</div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                type="button"
                onClick={() => jumpToTab('marketing')}
                aria-label="Jump to client marketing"
                className="group w-full sm:w-[210px] md:w-[216px] flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900/35 px-3 py-2.5 backdrop-blur-xl transition-all shadow-[0_10px_28px_rgba(2,6,23,0.45)] hover:shadow-[0_14px_34px_rgba(168,85,247,0.18)] hover:bg-slate-900/50 hover:border-purple-300/35 focus:outline-none focus:ring-2 focus:ring-purple-400/35"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-300/25 flex items-center justify-center shadow-sm group-hover:bg-purple-500/30 transition-colors">
                    <span className="text-[15px]">📣</span>
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-300 truncate">Marketing</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-lg font-semibold text-white tabular-nums">{marketing.blasts.length}</div>
                  <div className="text-slate-400 group-hover:text-purple-200 transition-colors">›</div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-400/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>

            <Card tone="solid" className="p-5 bg-slate-900/60 border border-white/10">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <div className="text-sm font-semibold text-white">Create Note</div>
                  <div className="text-xs text-slate-400">Capture important details so you (and your team) never lose context.</div>
                </div>
                <Button
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                  onClick={() => createNote()}
                  disabled={creatingNote || !newNote.trim()}
                >
                  {creatingNote ? 'Saving…' : 'Create Note'}
                </Button>
              </div>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
                placeholder="Add a note about this client…"
                className="w-full bg-slate-950/40 border border-white/10 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/40"
              />
            </Card>

            <div id="client-timeline-feed" className="scroll-mt-24">
            {timeline.length === 0 ? (
              <Card tone="solid" className="p-8 bg-gradient-to-br from-slate-900/60 to-slate-800/40 border border-dashed border-white/20">
                <div className="text-center max-w-2xl mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-cyan-500/30">
                    <span className="text-3xl">📊</span>
                  </div>
                  <div className="text-lg font-semibold text-white mb-2">No activity yet for this client</div>
                  <p className="text-sm text-slate-400 mb-6">
                    As you create deals, send marketing, and complete tasks, their history will appear here so you always know the story at a glance.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('tasks')}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-500/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="text-xl">✅</span>
                      </div>
                      <span className="text-sm font-medium text-amber-200">Complete a task</span>
                      {openTasksCount > 0 && (
                        <span className="text-xs text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          {openTasksCount} open
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/deals/new?clientId=${client.id}&role=${client.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER'}`)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/30 hover:border-emerald-400/60 hover:bg-emerald-500/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="text-xl">📄</span>
                      </div>
                      <span className="text-sm font-medium text-emerald-200">Start a new deal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMarketingCampaign(true)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-cyan-500/10 border border-cyan-400/30 hover:border-cyan-400/60 hover:bg-cyan-500/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="text-xl">📣</span>
                      </div>
                      <span className="text-sm font-medium text-cyan-200">Send marketing</span>
                    </button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="relative pl-4 sm:pl-6">
                <div className="absolute left-1 sm:left-2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/60 via-slate-600/40 to-transparent" />
                <div className="space-y-4">
                  {timeline.map((item, index) => {
                    const isDeal = item.type === 'deal';
                    const isTask = item.type === 'task';
                    const isNote = item.type === 'note';
                    const isMarketing = item.type === 'marketing';
                    
                    const getEventIcon = () => {
                      if (isDeal) return '📄';
                      if (isTask) return '✅';
                      if (isNote) return '📝';
                      if (isMarketing) return '📣';
                      return '📌';
                    };
                    
                    const getEventColor = () => {
                      if (isDeal) return 'from-emerald-400 to-green-500';
                      if (isTask) return 'from-amber-400 to-orange-500';
                      if (isNote) return 'from-purple-400 to-pink-500';
                      if (isMarketing) return 'from-cyan-400 to-blue-500';
                      return 'from-slate-400 to-slate-500';
                    };
                    
                    const getBorderColor = () => {
                      if (isDeal) return 'border-emerald-400/40';
                      if (isTask) return 'border-amber-400/40';
                      if (isNote) return 'border-purple-400/40';
                      if (isMarketing) return 'border-cyan-400/40';
                      return 'border-slate-400/40';
                    };
                    
                    const getRelativeTime = (dateStr: string) => {
                      const date = new Date(dateStr);
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMs / 3600000);
                      const diffDays = Math.floor(diffMs / 86400000);
                      
                      if (diffMins < 60) return `${diffMins}m ago`;
                      if (diffHours < 24) return `${diffHours}h ago`;
                      if (diffDays < 7) return `${diffDays}d ago`;
                      return date.toLocaleDateString();
                    };
                    
                    return (
                      <div key={item.id} className="relative flex gap-4 sm:gap-6">
                        <div className="flex flex-col items-center">
                          <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${getEventColor()} shadow-lg`}>
                            <span className="text-lg">{getEventIcon()}</span>
                          </div>
                        </div>
                        <Card
                          tone="solid"
                          className={`flex-1 p-4 bg-slate-900/70 ${getBorderColor()} hover:border-cyan-400/60 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.55)] hover:shadow-[0_15px_40px_rgba(6,182,212,0.15)]`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className={`text-[11px] uppercase font-semibold ${
                                isDeal ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' :
                                isTask ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' :
                                isNote ? 'bg-purple-500/20 text-purple-300 border-purple-400/40' :
                                isMarketing ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' :
                                'bg-slate-500/20 text-slate-300 border-slate-400/40'
                              }`}>
                                {isDeal ? 'Deal' : isTask ? 'Task' : isNote ? 'Note' : isMarketing ? 'Marketing' : 'Activity'}
                              </Badge>
                              <span className="text-xs text-slate-400">{getRelativeTime(item.at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-mono">#{timeline.length - index}</span>
                            </div>
                          </div>
                          <div className="text-sm font-medium text-white mb-2 leading-relaxed">
                            {item.label}
                          </div>
                          {item.meta && (
                            <div className="text-xs text-slate-400 bg-slate-950/40 rounded-lg px-3 py-2 border border-white/5">
                              {item.meta.dealTitle && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-emerald-400">📄</span>
                                  <span className="font-medium text-slate-300">Deal:</span> 
                                  <span className="text-white">{item.meta.dealTitle}</span>
                                </div>
                              )}
                              {!item.meta.dealTitle && typeof item.meta === 'object' && (
                                <div className="space-y-1">
                                  {Object.entries(item.meta)
                                    .slice(0, 3)
                                    .map(([k, v]) => (
                                      <div key={k} className="flex items-start gap-2">
                                        <span className="text-slate-500 font-medium capitalize">{k}:</span>
                                        <span className="text-slate-300 flex-1">{String(v)}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {activeTab === 'deals' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Deals</h3>
              <Button
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                onClick={() => navigate('/deals/new')}
              >
                Start Deal
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.length === 0 ? (
              <div className="col-span-full text-slate-500 italic">No deals found.</div>
            ) : (
              deals.map(deal => (
                <Card key={deal.id} tone="solid" className="p-4 bg-slate-900/40 border-white/10">
                  <div className="font-bold text-white mb-1">{deal.title}</div>
                  <div className="text-sm text-slate-400 mb-3">{deal.address}</div>
                  <div className="flex justify-between items-center">
                    <Badge variant="default" className="text-xs bg-transparent border-slate-600 shadow-none">{deal.stage}</Badge>
                    {deal.nextDeadline && (
                      <span className="text-xs text-indigo-400">Due: {new Date(deal.nextDeadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </Card>
              ))
            )}
            </div>
          </div>
        )}

        {activeTab === 'forms' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <div>
                <h3 className="text-lg font-medium text-white">Forms</h3>
                <div className="text-xs text-slate-400">All forms and signature packets linked to this client</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Signed</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-300">{signedFormsCount}</div>
                <div className="text-xs text-slate-400">Completed packets</div>
              </Card>
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">In progress</div>
                <div className="mt-2 text-2xl font-semibold text-amber-300">{pendingFormsCount}</div>
                <div className="text-xs text-slate-400">Sent or partially signed</div>
              </Card>
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Drafts</div>
                <div className="mt-2 text-2xl font-semibold text-slate-200">{draftFormsCount}</div>
                <div className="text-xs text-slate-400">Not sent yet</div>
              </Card>
            </div>

            {forms.length === 0 ? (
              <Card tone="solid" className="p-6 bg-slate-900/40 border border-dashed border-white/10">
                <div className="text-sm font-semibold text-white mb-1">No forms linked yet</div>
                <div className="text-sm text-slate-400 max-w-2xl">
                  As deals and e-sign packets are created, this client’s sent/signed form history will appear here.
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {forms.map((form) => (
                  <Card key={`${form.kind}-${form.id}`} tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <div className="text-sm font-semibold text-white truncate">{form.title}</div>
                          <Badge variant="default" className={`text-[11px] border ${getFormStatusClass(form.status)}`}>
                            {formatFormStatus(form.status)}
                          </Badge>
                          <Badge variant="default" className="text-[11px] bg-white/10 border-white/15 text-slate-200">
                            {form.kind === 'ESIGN_ENVELOPE' ? 'E-sign' : 'Form'}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400">
                          {form.dealTitle}
                          {form.propertyAddress ? ` · ${form.propertyAddress}` : ''}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                          {form.sentAt && <span>Sent: {new Date(form.sentAt).toLocaleDateString()}</span>}
                          {form.signedAt && <span>Signed: {new Date(form.signedAt).toLocaleDateString()}</span>}
                          {!form.sentAt && <span>Updated: {new Date(form.updatedAt).toLocaleDateString()}</span>}
                          {form.signerSummary && (
                            <span>
                              Signers: {form.signerSummary.signed}/{form.signerSummary.total}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {form.kind === 'ESIGN_ENVELOPE' && form.downloadUrl && (
                          <a
                            href={`/api${form.downloadUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-medium hover:bg-blue-500/30"
                          >
                            Open PDF
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/deals/${form.dealId}`)}
                        >
                          Open Deal
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'marketing' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-medium text-white">Marketing Blasts</h3>
                <div className="text-xs text-slate-400">Last contact: {lastContactLabel}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={openMarketingCampaign}>
                  Create Campaign
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/marketing')}>
                  Open Marketing Hub
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Total blasts</div>
                <div className="mt-2 text-2xl font-semibold text-white">{marketing.blasts.length}</div>
                <div className="text-xs text-slate-400">Campaigns sent to this client</div>
              </Card>
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Engagement goal</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-300">Keep warm</div>
                <div className="text-xs text-slate-400">Suggested cadence every 14 days</div>
              </Card>
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Next best action</div>
                <div className="mt-2 text-sm font-semibold text-white">Send a touch-point</div>
                <div className="text-xs text-slate-400">Neighborhood update or market snapshot</div>
              </Card>
            </div>

            {marketing.blasts.length === 0 ? (
              <Card tone="solid" className="p-6 md:p-8 bg-slate-900/40 border border-dashed border-white/10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">No campaigns yet</div>
                    <div className="text-sm text-slate-400 max-w-xl">
                      Build momentum with a personalized touch. Launch a “New listing alert,” “Market update,” or “Just checking in” email.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={openMarketingCampaign}>
                      Send first campaign
                    </Button>
                    <Button size="sm" variant="secondary" className="bg-white/5 border-white/10 text-slate-200" onClick={() => navigate('/marketing')}>
                      Browse templates
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {marketing.blasts.map((blast: any) => (
                  <Card key={blast.id} tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-white">{blast.title || 'Campaign'}</div>
                      <Badge variant="default" className="bg-white/10 border-white/10 text-slate-200">
                        {blast.status || 'Sent'}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400">Sent: {blast.sentAt ? new Date(blast.sentAt).toLocaleDateString() : '—'}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-medium text-white">Tasks</h3>
                <div className="text-xs text-slate-400">Open: {openTasksCount} · Overdue: {overdueTasks} · Due soon: {dueSoonTasks}</div>
              </div>
              <Button
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                onClick={() => setShowNewTask(true)}
              >
                + Add Task
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Open tasks</div>
                <div className="mt-2 text-2xl font-semibold text-white">{openTasksCount}</div>
                <div className="text-xs text-slate-400">Items needing attention</div>
              </Card>
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Due soon</div>
                <div className="mt-2 text-2xl font-semibold text-amber-300">{dueSoonTasks}</div>
                <div className="text-xs text-slate-400">Next 72 hours</div>
              </Card>
              <Card tone="solid" className="p-4 bg-slate-900/60 border border-white/10">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Completed</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-300">{completedTasks}</div>
                <div className="text-xs text-slate-400">Done with this client</div>
              </Card>
            </div>

            {tasks.length === 0 ? (
              <Card tone="solid" className="p-6 bg-slate-900/40 border border-dashed border-white/10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">No tasks yet</div>
                    <div className="text-sm text-slate-400 max-w-xl">
                      Stay on top of the relationship with follow-ups, paperwork, and milestone check-ins.
                    </div>
                  </div>
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={() => setShowNewTask(true)}>
                    Create first task
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => {
                  const isDone = task.status === 'DONE';
                  const isOverdue = task.dueAt && new Date(task.dueAt) < now && !isDone;
                  return (
                    <Card key={task.id} tone="solid" className="p-3 flex items-center justify-between bg-slate-900/60 border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border ${isDone ? 'bg-emerald-500 border-emerald-500' : isOverdue ? 'bg-rose-500/20 border-rose-400/60' : 'border-slate-500'}`} />
                        <div>
                          <div className={isDone ? 'line-through text-slate-500' : 'text-white'}>{task.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {task.status === 'DONE' ? 'Completed' : 'Open'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {task.dueAt ? (
                          <div className={`text-xs ${isOverdue ? 'text-rose-300' : 'text-slate-400'}`}>
                            Due {new Date(task.dueAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">No due date</div>
                        )}
                        {isOverdue && <div className="text-[10px] text-rose-400">Overdue</div>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
