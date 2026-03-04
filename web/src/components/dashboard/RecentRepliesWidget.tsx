import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { contactEmailApi, RecentReplyItem } from '../../lib/contactEmailApi';

function timeAgo(dateStr: string): string {
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

export function RecentRepliesWidget() {
  const [items, setItems] = useState<RecentReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingSeen, setMarkingSeen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [packWorkingId, setPackWorkingId] = useState<string | null>(null);
  const [packStatus, setPackStatus] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await contactEmailApi.recentReplies({ limit: 8 });
        if (!cancelled) {
          setItems(Array.isArray(res.data?.items) ? res.data.items : []);
          setUnseenCount(Number(res.data?.unseenCount || 0));
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setUnseenCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = async () => {
    if (markingSeen || unseenCount <= 0) return;
    try {
      setMarkingSeen(true);
      await contactEmailApi.markRecentRepliesSeen();
      setItems((prev) => prev.map((item) => ({ ...item, unseen: false })));
      setUnseenCount(0);
    } catch {
    } finally {
      setMarkingSeen(false);
    }
  };

  const createFollowUpPack = async (item: RecentReplyItem) => {
    if (packWorkingId) return;
    try {
      setPackWorkingId(item.id);
      setPackStatus('');

      const callAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const recapAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const clientId = item.contactType === 'client' ? item.contactId : undefined;
      const context = [item.subject, item.snippet].filter(Boolean).join(' · ');

      await Promise.all([
        api.post('/tasks', {
          title: `Call back ${item.contactName}`,
          description: context || `Follow-up call for ${item.contactType} ${item.contactName}`,
          category: 'CALL',
          priority: 'HIGH',
          status: 'OPEN',
          bucket: 'TODAY',
          dueAt: callAt,
          clientId,
        }),
        api.post('/tasks', {
          title: `Calendar hold: follow-up with ${item.contactName}`,
          description: `Create space for follow-up from recent reply`,
          category: 'EVENT',
          priority: 'MEDIUM',
          status: 'OPEN',
          bucket: 'TODAY',
          dueAt: callAt,
          clientId,
        }),
        api.post('/tasks', {
          title: `Send recap to ${item.contactName}`,
          description: `Send summary and next step confirmation`,
          category: 'GENERAL',
          priority: 'MEDIUM',
          status: 'OPEN',
          bucket: 'THIS_WEEK',
          dueAt: recapAt,
          clientId,
        }),
      ]);

      setPackStatus(`Follow-up pack ready for ${item.contactName}`);
    } catch {
      setPackStatus('Could not create follow-up pack');
    } finally {
      setPackWorkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-white/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/10 rounded w-2/3" />
              <div className="h-2.5 bg-white/5 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-2xl mb-2">📬</div>
        <div className="text-sm text-slate-400">No replies yet</div>
        <div className="text-xs text-slate-500 mt-1">Incoming lead/client replies will appear here</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1">
        <div className="text-xs text-slate-400">
          {unseenCount > 0 ? `${unseenCount} unread` : 'All caught up'}
        </div>
        <button
          type="button"
          onClick={() => void markSeen()}
          disabled={unseenCount <= 0 || markingSeen}
          className="text-xs px-2 py-1 rounded-lg border border-white/15 text-slate-300 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent"
        >
          {markingSeen ? 'Saving…' : 'Mark seen'}
        </button>
      </div>
      {packStatus && <div className="text-[11px] text-cyan-300">{packStatus}</div>}

      <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors group">
          <button
            onClick={() =>
              navigate(
                item.contactType === 'lead'
                  ? `/leads?focusId=${encodeURIComponent(item.contactId)}`
                  : `/clients/${encodeURIComponent(item.contactId)}?tab=timeline`,
              )
            }
            className="flex-1 min-w-0 text-left flex items-start gap-3 px-1"
          >
            <div className="mt-0.5 shrink-0 text-base">{item.unseen ? '🟢' : '📩'}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-100 truncate group-hover:text-white">
                {item.contactName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {item.subject || 'Reply received'}
              </div>
              {item.snippet && (
                <div className="text-[11px] text-slate-500 truncate">{item.snippet}</div>
              )}
            </div>
            <div className="shrink-0 text-[10px] text-slate-600 whitespace-nowrap mt-0.5">
              {timeAgo(item.at)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => void createFollowUpPack(item)}
            disabled={Boolean(packWorkingId)}
            className="shrink-0 text-[10px] px-2 py-1 rounded-lg border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {packWorkingId === item.id ? 'Working…' : 'Pack'}
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}

export default RecentRepliesWidget;
