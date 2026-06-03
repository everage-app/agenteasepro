import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Hourglass } from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { contactEmailApi, RecentReplyItem } from '../../lib/contactEmailApi';
import { notificationFeedApi, LeadAlertItem } from '../../lib/notificationFeedApi';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  streak?: number;
  anchor?: {
    top: number;
    right: number;
    width: number;
  } | null;
}

interface PriorityAction {
  id: string;
  type: 'CONTRACT_DEADLINE' | 'SIGNATURE_NEEDED' | 'CLIENT_FOLLOWUP' | 'REFERRAL_TOUCH' | 'MARKETING_BLAST' | 'DAILY_GOAL';
  title: string;
  description?: string;
  clientName?: string;
  dealOrListing?: string;
  dueDate?: string;
  priority: 'HIGH' | 'NORMAL';
  relatedId?: string;
  relatedType?: 'task' | 'deal' | 'client' | 'listing' | 'blast';
  canComplete?: boolean;
  completionValue?: unknown;
}

interface NotificationPrefs {
  deadlineEmails?: boolean;
  dailyPlanEnabled?: boolean;
  dailyPlanTime?: string;
  inAppBanners?: boolean;
  signatureAlerts?: boolean;
  documentComplete?: boolean;
  marketingSummaries?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  [key: string]: unknown;
}

interface TaskItem {
  id: string;
  title: string;
  category?: string;
  dueAt?: string | null;
  status?: string;
  client?: { id?: string; name?: string };
  deal?: { id?: string; title?: string };
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return 'No date';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function dueLabel(dateStr?: string | null): string {
  if (!dateStr) return 'No due date';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dateStr);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays}d`;
  return due.toLocaleDateString();
}

function toggleClass(enabled: boolean): string {
  return enabled ? 'bg-cyan-500' : 'bg-slate-600';
}

export function NotificationCenter({ isOpen, onClose, isMobile, streak = 0, anchor }: NotificationCenterProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<RecentReplyItem[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [leadAlerts, setLeadAlerts] = useState<LeadAlertItem[]>([]);
  const [leadAlertsSeenAt, setLeadAlertsSeenAt] = useState<string | null>(() => notificationFeedApi.getLastSeenLeadCaptureAt());
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [settingsSavingKey, setSettingsSavingKey] = useState<string | null>(null);
  const [replyActionBusyId, setReplyActionBusyId] = useState<string | null>(null);
  const [replyStatus, setReplyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [replyRes, leadRes, taskRes, priorityRes, prefsRes] = await Promise.all([
          contactEmailApi.recentReplies({ limit: 8 }).catch(() => ({ data: { items: [] as RecentReplyItem[], unseenCount: 0 } })),
          notificationFeedApi.recentLeadCaptures({ limit: 8 }).catch(() => ({ data: { items: [] as LeadAlertItem[] } })),
          api.get('/tasks').catch(() => ({ data: [] as TaskItem[] })),
          api.get('/priority-actions/today').catch(() => ({ data: { actions: [] as PriorityAction[] } })),
          api.get('/settings/notifications').catch(() => ({ data: {} as NotificationPrefs })),
        ]);

        if (cancelled) return;

        setReplies(Array.isArray(replyRes.data?.items) ? replyRes.data.items : []);
        setUnseenCount(Number(replyRes.data?.unseenCount || 0));
        setLeadAlerts(Array.isArray(leadRes.data?.items) ? leadRes.data.items : []);
        setTasks(Array.isArray(taskRes.data) ? taskRes.data : []);
        setPriorityActions(Array.isArray(priorityRes.data?.actions) ? priorityRes.data.actions : []);
        setPrefs((prefsRes.data || {}) as NotificationPrefs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const taskAlerts = useMemo(() => {
    const now = Date.now();
    const soon = now + 86400000;
    return tasks
      .filter((task) => task.status !== 'DONE' && task.status !== 'COMPLETED')
      .map((task) => {
        const dueTs = task.dueAt ? new Date(task.dueAt).getTime() : Number.NaN;
        const overdue = Number.isFinite(dueTs) && dueTs < now;
        const upcoming = Number.isFinite(dueTs) && dueTs >= now && dueTs <= soon;
        return { task, overdue, upcoming };
      })
      .filter((entry) => entry.overdue || entry.upcoming)
      .sort((left, right) => {
        if (left.overdue && !right.overdue) return -1;
        if (!left.overdue && right.overdue) return 1;
        return new Date(left.task.dueAt || 0).getTime() - new Date(right.task.dueAt || 0).getTime();
      })
      .slice(0, 6);
  }, [tasks]);

  const unreadLeadAlerts = useMemo(() => {
    const lastSeen = leadAlertsSeenAt ? new Date(leadAlertsSeenAt).getTime() : 0;
    return leadAlerts.filter((item) => new Date(item.at).getTime() > lastSeen);
  }, [leadAlerts, leadAlertsSeenAt]);

  const urgentCount = priorityActions.filter((item) => item.priority === 'HIGH').length + taskAlerts.filter((item) => item.overdue).length + unreadLeadAlerts.length;

  const markLeadAlertsSeen = () => {
    const seenAt = leadAlerts[0]?.at || new Date().toISOString();
    notificationFeedApi.markLeadCapturesSeen(seenAt);
    setLeadAlertsSeenAt(seenAt);
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handlePriorityNavigate = (action: PriorityAction) => {
    if (action.relatedType === 'client' && action.relatedId) {
      handleNavigate(`/clients/${encodeURIComponent(action.relatedId)}`);
      return;
    }
    if (action.relatedType === 'deal' && action.relatedId) {
      handleNavigate(`/contracts/${encodeURIComponent(action.relatedId)}`);
      return;
    }
    if (action.relatedType === 'listing') {
      handleNavigate('/listings');
      return;
    }
    if (action.relatedType === 'blast') {
      handleNavigate('/marketing');
      return;
    }
    handleNavigate('/tasks');
  };

  const handleReplyOpen = async (item: RecentReplyItem) => {
    try {
      if (item.unseen) {
        await contactEmailApi.markRecentRepliesSeen();
        setReplies((current) => current.map((reply) => ({ ...reply, unseen: false })));
        setUnseenCount(0);
      }
    } catch {
      // no-op
    }

    handleNavigate(
      item.contactType === 'lead'
        ? `/leads/${encodeURIComponent(item.contactId)}`
        : `/clients/${encodeURIComponent(item.contactId)}?tab=timeline`,
    );
  };

  const handleCreateFollowUpPack = async (item: RecentReplyItem) => {
    if (replyActionBusyId) return;
    try {
      setReplyActionBusyId(item.id);
      setReplyStatus(null);

      const callAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const recapAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const clientId = item.contactType === 'client' ? item.contactId : undefined;
      const context = [item.subject, item.snippet].filter(Boolean).join(' · ');

      await Promise.all([
        api.post('/tasks', {
          title: `Call back ${item.contactName}`,
          description: context || `Follow-up call for ${item.contactName}`,
          category: 'CALL',
          priority: 'HIGH',
          status: 'OPEN',
          bucket: 'TODAY',
          dueAt: callAt,
          clientId,
        }),
        api.post('/tasks', {
          title: `Calendar hold: follow-up with ${item.contactName}`,
          description: 'Reserve time to follow up on the new reply',
          category: 'EVENT',
          priority: 'MEDIUM',
          status: 'OPEN',
          bucket: 'TODAY',
          dueAt: callAt,
          clientId,
        }),
        api.post('/tasks', {
          title: `Send recap to ${item.contactName}`,
          description: 'Send summary and confirm next steps',
          category: 'GENERAL',
          priority: 'MEDIUM',
          status: 'OPEN',
          bucket: 'THIS_WEEK',
          dueAt: recapAt,
          clientId,
        }),
      ]);

      setReplyStatus(`Follow-up pack ready for ${item.contactName}`);
    } catch {
      setReplyStatus('Could not create follow-up pack');
    } finally {
      setReplyActionBusyId(null);
    }
  };

  const handleTogglePref = async (key: keyof NotificationPrefs) => {
    const nextPrefs = {
      ...prefs,
      [key]: !(prefs[key] === true),
    };

    setPrefs(nextPrefs);
    setSettingsSavingKey(String(key));

    try {
      await api.put('/settings/notifications', nextPrefs);
    } catch {
      setPrefs(prefs);
    } finally {
      setSettingsSavingKey(null);
    }
  };

  if (!isOpen) return null;

  const panelStyle = !isMobile
    ? {
        top: anchor ? Math.max(anchor.top + 14, 88) : 88,
        right: anchor ? Math.max(window.innerWidth - anchor.right, 24) : 24,
        width: Math.min(440, Math.max(anchor?.width ? anchor.width + 170 : 420, 380)),
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[120]" aria-hidden={!isOpen}>
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Close notifications" />

      <div
        className={cn(
          'absolute overflow-hidden border border-cyan-400/20 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_rgba(2,6,23,0.98)_38%,_rgba(2,6,23,1)_100%)] shadow-[0_35px_90px_rgba(2,6,23,0.72)]',
          isMobile
            ? 'inset-x-0 bottom-0 rounded-t-[32px] border-b-0'
            : 'rounded-[28px] backdrop-blur-2xl',
        )}
        style={panelStyle}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_26%,transparent_70%,rgba(34,211,238,0.08))] pointer-events-none" />

        <div className={cn('relative flex flex-col', isMobile ? 'max-h-[88vh]' : 'max-h-[78vh]')}>
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300/90">Notification center</div>
                <div className="mt-2 text-lg font-semibold text-white">Stay on top of every deal pulse</div>
                <div className="mt-1 text-xs text-slate-300">
                  {urgentCount > 0 ? `${urgentCount} items need attention` : 'Everything important is already surfaced here'}
                  {streak > 1 ? ` • ${streak} day streak` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-red-500/15 hover:text-white"
                aria-label="Close notifications"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <SummaryPill label="Unread" value={unseenCount + unreadLeadAlerts.length} tone="cyan" />
              <SummaryPill label="Urgent" value={urgentCount} tone="amber" />
              <SummaryPill label="Pipeline" value={priorityActions.length + taskAlerts.length} tone="emerald" />
            </div>
          </div>

          <div className="relative overflow-y-auto px-5 py-4 space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="h-3 w-24 rounded bg-white/10" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <section className="rounded-[28px] border border-emerald-400/18 bg-emerald-500/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200">Lead alerts</div>
                      <div className="mt-1 text-sm font-semibold text-white">Fresh inquiries that need quick follow-up</div>
                    </div>
                    {unreadLeadAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={markLeadAlertsSeen}
                        className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
                      >
                        Mark seen
                      </button>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {leadAlerts.slice(0, 5).map((item) => {
                      const unseen = unreadLeadAlerts.some((alert) => alert.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            notificationFeedApi.markLeadCapturesSeen(item.at);
                            setLeadAlertsSeenAt(item.at);
                            handleNavigate(`/leads/${encodeURIComponent(item.leadId)}`);
                          }}
                          className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 text-left hover:border-emerald-400/20 hover:bg-white/5"
                        >
                          <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold', unseen ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-200')}>
                            {unseen ? '+' : '•'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold text-white">{item.leadName}</div>
                              {unseen && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">New</span>}
                            </div>
                            <div className="mt-1 text-xs text-slate-300">{item.sourceLabel || 'Landing page'} • {timeAgo(item.at)}</div>
                            {(item.leadEmail || item.leadPhone) && (
                              <div className="mt-1 text-[11px] text-emerald-100/90">{[item.leadEmail, item.leadPhone].filter(Boolean).join(' • ')}</div>
                            )}
                            {item.message && <div className="mt-1 line-clamp-2 text-[11px] text-slate-300">{item.message}</div>}
                          </div>
                        </button>
                      );
                    })}

                    {leadAlerts.length === 0 && (
                      <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-4 text-sm text-slate-300">
                        No new lead captures yet.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-amber-400/20 bg-amber-500/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Action queue</div>
                      <div className="mt-1 text-sm font-semibold text-white">Contracts, tasks, and follow-up pressure points</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('/tasks')}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/10"
                    >
                      Open tasks
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {priorityActions.slice(0, 3).map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handlePriorityNavigate(action)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 text-left hover:border-cyan-400/20 hover:bg-white/5"
                      >
                        <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold', action.priority === 'HIGH' ? 'border-red-400/30 bg-red-500/15 text-red-100' : 'border-cyan-400/25 bg-cyan-500/12 text-cyan-100')}>
                          {action.priority === 'HIGH' ? '!' : '→'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold text-white">{action.title}</div>
                            {action.priority === 'HIGH' && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200">Urgent</span>}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">{action.description || action.clientName || action.dealOrListing || 'Open to take action.'}</div>
                          {action.dueDate && <div className="mt-1 text-[11px] text-amber-200">Due {new Date(action.dueDate).toLocaleDateString()}</div>}
                        </div>
                      </button>
                    ))}

                    {taskAlerts.map(({ task, overdue }) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleNavigate('/tasks')}
                        className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 text-left hover:border-cyan-400/20 hover:bg-white/5"
                      >
                        <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold', overdue ? 'border-red-400/30 bg-red-500/15 text-red-100' : 'border-blue-400/25 bg-blue-500/12 text-blue-100')}>
                          {overdue ? <Hourglass className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{task.title}</div>
                          <div className="mt-1 text-xs text-slate-300">{task.client?.name || task.deal?.title || task.category || 'Task follow-up'}</div>
                        </div>
                        <div className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold', overdue ? 'bg-red-500/20 text-red-100' : 'bg-blue-500/20 text-blue-100')}>
                          {dueLabel(task.dueAt)}
                        </div>
                      </button>
                    ))}

                    {priorityActions.length === 0 && taskAlerts.length === 0 && (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                        You are clear on urgent work. Keep the streak alive.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-cyan-400/18 bg-cyan-500/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200">Reply inbox</div>
                      <div className="mt-1 text-sm font-semibold text-white">Respond fast while the lead is warm</div>
                    </div>
                    {unseenCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await contactEmailApi.markRecentRepliesSeen();
                            setReplies((current) => current.map((reply) => ({ ...reply, unseen: false })));
                            setUnseenCount(0);
                          } catch {
                            // no-op
                          }
                        }}
                        className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/20"
                      >
                        Mark inbox seen
                      </button>
                    )}
                  </div>

                  {replyStatus && <div className="mt-3 text-[11px] text-cyan-100">{replyStatus}</div>}

                  <div className="mt-3 space-y-2">
                    {replies.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/8 bg-slate-950/45 p-3">
                        <div className="flex items-start gap-3">
                          <button type="button" onClick={() => void handleReplyOpen(item)} className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', item.unseen ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]' : 'bg-slate-500')} />
                              <span className="truncate text-sm font-semibold text-white">{item.contactName}</span>
                              <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(item.at)}</span>
                            </div>
                            <div className="mt-1 truncate text-xs text-cyan-100/90">{item.subject || 'Reply received'}</div>
                            {item.snippet && <div className="mt-1 line-clamp-2 text-[11px] text-slate-300">{item.snippet}</div>}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCreateFollowUpPack(item)}
                            disabled={Boolean(replyActionBusyId)}
                            className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                          >
                            {replyActionBusyId === item.id ? 'Working…' : 'Pack'}
                          </button>
                        </div>
                      </div>
                    ))}

                    {replies.length === 0 && (
                      <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-4 text-sm text-slate-300">
                        No incoming replies right now.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Live preferences</div>
                      <div className="mt-1 text-sm font-semibold text-white">Keep users in flow without losing control</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('/settings/notifications')}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/10"
                    >
                      Full settings
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <PreferenceRow
                      label="Header banners"
                      description="Show live alerts in the app shell"
                      enabled={prefs.inAppBanners !== false}
                      saving={settingsSavingKey === 'inAppBanners'}
                      onToggle={() => void handleTogglePref('inAppBanners')}
                    />
                    <PreferenceRow
                      label="E-signature alerts"
                      description="Push contract signing requests to the front"
                      enabled={prefs.signatureAlerts !== false}
                      saving={settingsSavingKey === 'signatureAlerts'}
                      onToggle={() => void handleTogglePref('signatureAlerts')}
                    />
                    <PreferenceRow
                      label="Completion alerts"
                      description="Let agents know when documents finish"
                      enabled={prefs.documentComplete !== false}
                      saving={settingsSavingKey === 'documentComplete'}
                      onToggle={() => void handleTogglePref('documentComplete')}
                    />
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'amber' | 'emerald' }) {
  const toneClasses = {
    cyan: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
    emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  };

  return (
    <div className={cn('rounded-2xl border px-3 py-2', toneClasses[tone])}>
      <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  enabled,
  saving,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="mt-1 text-[11px] text-slate-300">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        className={cn('relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-60', toggleClass(enabled))}
        aria-pressed={enabled}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white transition-transform', enabled ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

export default NotificationCenter;
