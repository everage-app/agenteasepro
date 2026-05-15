import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, CheckCircle2, FileText, Home, Megaphone, Paperclip, PenLine, Pin, Target, UserRound } from 'lucide-react';
import api from '../../lib/api';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  at: string;
  meta?: Record<string, any>;
}

const typeConfig: Record<string, { icon: LucideIcon; color: string }> = {
  DEAL: { icon: Home, color: 'text-blue-400' },
  EVENT: { icon: CalendarDays, color: 'text-purple-400' },
  TASK: { icon: CheckCircle2, color: 'text-emerald-400' },
  FORM: { icon: FileText, color: 'text-cyan-400' },
  ADDENDUM: { icon: Paperclip, color: 'text-amber-400' },
  ESIGN: { icon: PenLine, color: 'text-pink-400' },
  CLIENT: { icon: UserRound, color: 'text-indigo-400' },
  LISTING: { icon: Home, color: 'text-teal-400' },
  MARKETING: { icon: Megaphone, color: 'text-orange-400' },
  LEAD: { icon: Target, color: 'text-violet-400' },
};

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

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        // Gather recent activity from multiple sources
        const [dealsRes, tasksRes, clientsRes] = await Promise.all([
          api.get('/deals').catch(() => ({ data: [] })),
          api.get('/tasks', { params: { limit: 20 } }).catch(() => ({ data: [] })),
          api.get('/clients').catch(() => ({ data: [] })),
        ]);

        const items: ActivityItem[] = [];

        // Recent deals
        const deals = Array.isArray(dealsRes.data) ? dealsRes.data : [];
        deals.slice(0, 5).forEach((d: any) => {
          items.push({
            id: `deal-${d.id}`,
            type: 'DEAL',
            title: d.status === 'CLOSED' ? `Deal closed: ${d.title}` : `Deal: ${d.title}`,
            description: d.status?.replace(/_/g, ' '),
            at: d.lastActivityAt || d.updatedAt || d.createdAt,
          });
        });

        // Recent tasks
        const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
        tasks
          .filter((t: any) => t.status === 'DONE')
          .slice(0, 5)
          .forEach((t: any) => {
            items.push({
              id: `task-${t.id}`,
              type: 'TASK',
              title: `Completed: ${t.title}`,
              description: t.category,
              at: t.updatedAt || t.createdAt,
            });
          });

        // Recent clients
        const clients = Array.isArray(clientsRes.data) ? clientsRes.data : [];
        clients.slice(0, 3).forEach((c: any) => {
          if (c.lastContactAt) {
            items.push({
              id: `client-${c.id}`,
              type: 'CLIENT',
              title: `Contact with ${c.name || c.firstName + ' ' + c.lastName}`,
              description: c.stage?.replace(/_/g, ' '),
              at: c.lastContactAt,
            });
          }
        });

        // Sort by date, most recent first
        items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setActivities(items.slice(0, 10));
      } catch (err) {
        console.error('Activity feed error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-white/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/10 rounded w-3/4" />
              <div className="h-2.5 bg-white/5 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        <div className="text-sm text-slate-400">No recent activity yet</div>
        <div className="text-xs text-slate-500 mt-1">Activity will appear as you use AgentEase Pro</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((item, idx) => {
        const config = typeConfig[item.type] || { icon: Pin, color: 'text-slate-400' };
        const ActivityIcon = config.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.type === 'DEAL') navigate('/deals');
              else if (item.type === 'TASK') navigate('/tasks');
              else if (item.type === 'CLIENT') navigate('/clients');
              else if (item.type === 'LISTING') navigate('/listings');
              else if (item.type === 'MARKETING') navigate('/marketing');
            }}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
          >
            <ActivityIcon className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`} strokeWidth={2.2} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                {item.title}
              </div>
              {item.description && (
                <div className="text-[10px] text-slate-500 capitalize">{item.description}</div>
              )}
            </div>
            <div className="shrink-0 text-[10px] text-slate-600 whitespace-nowrap mt-0.5">
              {timeAgo(item.at)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
