import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface DailyAction {
  id: string;
  title: string;
  description: string;
  urgency: 'urgent' | 'today' | 'soon';
  relatedTo?: {
    type: 'deal' | 'task' | 'client' | 'listing' | 'calendar';
    id: string;
  };
}

interface DailyPlanData {
  summary: string;
  actions: DailyAction[];
}

export function AIDailyPlan() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<DailyPlanData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const buildFallbackPlan = (): DailyPlanData => ({
    summary: 'Here is a quick starter plan while AI is unavailable locally.',
    actions: [
      {
        id: 'fallback-1',
        title: 'Review top 3 active deals',
        description: 'Confirm deadlines and next steps for any time-sensitive items.',
        urgency: 'today',
      },
      {
        id: 'fallback-2',
        title: 'Follow up with priority clients',
        description: 'Send quick updates or schedule a short check-in call.',
        urgency: 'soon',
      },
      {
        id: 'fallback-3',
        title: 'Clear one overdue task',
        description: 'Close out a lingering task to keep your board clean.',
        urgency: 'urgent',
      },
    ],
  });

  const loadDailyPlan = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.post('/ai/calendar/daily-plan', { date: today });
      const data = res.data as any;

      // Backward-compatible normalization (older API returned { priority: [...] })
      const normalized: DailyPlanData = data?.actions
        ? data
        : {
            summary: data?.summary ?? 'Review your tasks and calendar to plan your day.',
            actions: Array.isArray(data?.priority)
              ? data.priority.map((p: any, idx: number) => ({
                  id: p?.id ?? `p-${idx}`,
                  title: p?.title ?? 'Action item',
                  description: p?.description ?? '',
                  urgency: p?.urgency ?? 'today',
                }))
              : [],
          };

      if (!normalized?.actions?.length) {
        setPlan(buildFallbackPlan());
        setNotice('AI returned no plan — showing a quick starter plan.');
      } else {
        setPlan(normalized);
      }
      setIsExpanded(true);
    } catch (err: any) {
      console.error('Failed to load daily plan:', err);
      setPlan(buildFallbackPlan());
      setNotice('AI is unavailable locally — showing a quick starter plan.');
      setIsExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'from-red-500 to-orange-500';
      case 'today':
        return 'from-blue-500 to-cyan-400';
      case 'soon':
        return 'from-violet-500 to-purple-500';
      default:
        return 'from-slate-500 to-slate-400';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-200">
            🚨 Urgent
          </span>
        );
      case 'today':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            📅 Today
          </span>
        );
      case 'soon':
        return (
          <span className="inline-flex items-center rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
            ⏰ Soon
          </span>
        );
    }
  };

  const handleActionClick = (action: DailyAction) => {
    if (!action.relatedTo) return;

    const { type, id } = action.relatedTo;
    switch (type) {
      case 'deal':
        navigate(`/deals/${id}`);
        break;
      case 'task':
        navigate('/tasks');
        break;
      case 'client':
        navigate(`/clients/${id}`);
        break;
      case 'listing':
        navigate(`/listings/${id}`);
        break;
      case 'calendar':
        navigate(`/calendar?date=${encodeURIComponent(id)}`);
        break;
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/8 via-blue-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">AI Daily Plan</h3>
            <p className="text-[11px] text-slate-400">Smart prioritization for today</p>
          </div>
        </div>
        {plan && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {!plan && !loading && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Let AgentEasePro analyze your deals, tasks, and appointments to build your perfect day.
          </p>
          <Button
            onClick={loadDailyPlan}
            variant="primary"
            size="sm"
            className="w-full rounded-full"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Build my plan
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            Analyzing your day...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200 mb-3">{error}</p>
          <Button
            onClick={loadDailyPlan}
            variant="secondary"
            size="sm"
            className="w-full rounded-full"
          >
            Try again
          </Button>
        </div>
      )}

      {notice && !error && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
          {notice}
        </div>
      )}

      {plan && isExpanded && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-200 leading-relaxed">{plan.summary}</p>
          </div>

          <div className="space-y-2">
            {plan.actions.slice(0, 8).map((action) => (
              <div
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={`rounded-2xl border border-white/10 bg-slate-900/50 p-4 transition-all cursor-pointer hover:bg-slate-900/70 hover:scale-[1.01] ${
                  action.relatedTo ? 'hover:border-cyan-500/50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getUrgencyColor(
                      action.urgency
                    )} text-white shadow-lg text-xs font-bold`}
                  >
                    {action.urgency === 'urgent' ? '!' : action.urgency === 'today' ? '•' : '○'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-50">{action.title}</h4>
                      {getUrgencyBadge(action.urgency)}
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{action.description}</p>
                  </div>
                  {action.relatedTo && (
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={loadDailyPlan}
              variant="secondary"
              size="sm"
              className="flex-1 rounded-full"
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                setPlan(null);
                setIsExpanded(false);
              }}
              variant="outline"
              size="sm"
              className="flex-1 rounded-full"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {plan && !isExpanded && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300 line-clamp-2">{plan.summary}</p>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-cyan-300 hover:text-cyan-200 font-medium"
          >
            View {plan.actions.length} actions →
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          💡 Powered by AI • Focused on Utah real estate
        </p>
      </div>
    </div>
  );
}
