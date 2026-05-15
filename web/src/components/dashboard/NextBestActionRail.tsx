import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { contactEmailApi, RecentReplyItem } from '../../lib/contactEmailApi';

type ActionItem = {
  id: string;
  score: number;
  title: string;
  subtitle: string;
  at: string;
  kind: 'reply' | 'task-overdue' | 'task-due';
  path: string;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NextBestActionRail({ compact = false, maxItems = 6 }: { compact?: boolean; maxItems?: number }) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [repliesRes, tasksRes] = await Promise.all([
          contactEmailApi.recentReplies({ limit: 8 }).catch(() => ({ data: { items: [] as RecentReplyItem[] } })),
          api.get('/tasks').catch(() => ({ data: [] as any[] })),
        ]);

        if (cancelled) return;

        const now = Date.now();
        const replyActions: ActionItem[] = (repliesRes.data?.items || []).map((item) => ({
          id: `reply-${item.id}`,
          score: item.unseen ? 100 : 80,
          title: `Reply from ${item.contactName}`,
          subtitle: item.subject || item.snippet || 'Incoming contact reply',
          at: item.at,
          kind: 'reply',
          path:
            item.contactType === 'lead'
              ? `/leads/${encodeURIComponent(item.contactId)}`
              : `/clients/${encodeURIComponent(item.contactId)}?tab=timeline`,
        }));

        const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
        const taskActions: ActionItem[] = tasks
          .filter((task: any) => task && task.status !== 'DONE' && task.status !== 'COMPLETED')
          .map((task: any) => {
            const dueAt = task.dueAt || task.createdAt || new Date().toISOString();
            const dueTs = new Date(dueAt).getTime();
            const isOverdue = Number.isFinite(dueTs) && dueTs < now;
            const isDueSoon = Number.isFinite(dueTs) && dueTs >= now && dueTs <= now + 1000 * 60 * 60 * 24;
            if (!isOverdue && !isDueSoon) return null;

            return {
              id: `task-${task.id}`,
              score: isOverdue ? 95 : 70,
              title: isOverdue ? `Overdue: ${task.title}` : `Due soon: ${task.title}`,
              subtitle: task.client?.name || task.deal?.title || task.category || 'Task follow-up',
              at: dueAt,
              kind: isOverdue ? 'task-overdue' : 'task-due',
              path: '/tasks',
            } as ActionItem;
          })
          .filter((item: ActionItem | null): item is ActionItem => Boolean(item));

        const ranked = [...replyActions, ...taskActions]
          .sort((a, b) => b.score - a.score || new Date(b.at).getTime() - new Date(a.at).getTime())
          .slice(0, Math.max(1, Math.min(maxItems, 8)));

        setActions(ranked);
      } catch {
        setActions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const replies = actions.filter((action) => action.kind === 'reply').length;
    const urgent = actions.filter((action) => action.kind === 'task-overdue').length;
    return { replies, urgent };
  }, [actions]);

  if (loading) {
    return (
      compact ? (
        <div className="text-xs text-slate-400">Loading actions…</div>
      ) : (
        <div className="rounded-2xl sm:rounded-[28px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-5">
          <div className="text-sm text-slate-400">Loading next best actions…</div>
        </div>
      )
    );
  }

  const content = (
    <>
      <div className={`flex items-center justify-between gap-4 ${compact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Next best actions</div>
          <div className="text-xs text-slate-400 mt-1">
            {summary.urgent > 0 ? `${summary.urgent} urgent` : 'No urgent items'}
            {` • `}
            {summary.replies} reply
            {summary.replies === 1 ? '' : 'ies'}
          </div>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>You’re caught up. Great momentum.</div>
      ) : (
        <div className="space-y-1">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              className={`w-full text-left flex items-center justify-between gap-3 rounded-xl hover:bg-white/5 transition-colors ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}
            >
              <div className="min-w-0">
                <div className={`${compact ? 'text-xs' : 'text-sm'} text-slate-100 truncate`}>{action.title}</div>
                <div className="text-[11px] text-slate-400 truncate">{action.subtitle}</div>
              </div>
              <div className="text-[10px] text-slate-500 shrink-0">{timeAgo(action.at)}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (compact) {
    return <div>{content}</div>;
  }

  return (
    <div className="rounded-2xl sm:rounded-[28px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-5">
      {content}
    </div>
  );
}

export default NextBestActionRail;
