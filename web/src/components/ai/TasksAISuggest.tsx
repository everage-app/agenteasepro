import { useState } from 'react';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface TaskSuggestion {
  title: string;
  description: string;
  category: 'contract' | 'marketing' | 'client_followup';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueInDays?: number;
  dealId?: string;
  clientId?: string;
}

interface TasksAISuggestProps {
  onCreateTask: (task: TaskSuggestion) => void;
}

export function TasksAISuggest({ onCreateTask }: TasksAISuggestProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const buildFallbackSuggestions = (): TaskSuggestion[] => [
    {
      title: 'Review upcoming deadlines for active deals',
      description: 'Scan key contract dates and confirm next actions with your clients.',
      category: 'contract',
      priority: 'HIGH',
      dueInDays: 1,
    },
    {
      title: 'Send client follow-ups from last week',
      description: 'Touch base with active buyers/sellers that have not been contacted recently.',
      category: 'client_followup',
      priority: 'MEDIUM',
      dueInDays: 2,
    },
    {
      title: 'Post one listing update on social media',
      description: 'Share a quick update to keep your listings and brand top of mind.',
      category: 'marketing',
      priority: 'LOW',
      dueInDays: 3,
    },
  ];

  const getSuggestions = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post('/ai/tasks/suggest', {
        eventType: 'daily_review',
        payload: {},
      });
      const incoming = res.data?.suggestions || [];
      if (incoming.length === 0) {
        setSuggestions(buildFallbackSuggestions());
        setNotice('AI returned no suggestions — showing quick templates.');
      } else {
        setSuggestions(incoming);
      }
      setIsExpanded(true);
    } catch (err: any) {
      console.error('Failed to get task suggestions:', err);
      setSuggestions(buildFallbackSuggestions());
      setNotice('AI is unavailable locally — showing quick templates.');
      setIsExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'contract':
        return 'bg-violet-500/20 text-violet-200';
      case 'marketing':
        return 'bg-pink-500/20 text-pink-200';
      case 'client_followup':
        return 'bg-blue-500/20 text-blue-200';
      default:
        return 'bg-slate-500/20 text-slate-200';
    }
  };

  if (!isExpanded && !loading && suggestions.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-pink-500/10 to-slate-950/60 backdrop-blur-xl p-3 shadow-[0_16px_32px_rgba(26,10,40,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_60%)]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-[0_8px_18px_rgba(168,85,247,0.35)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">AI Task Suggestions</h3>
              <p className="text-[11px] text-pink-100/80 truncate">Follow-ups, deadlines, next steps</p>
            </div>
          </div>
          <Button
            onClick={getSuggestions}
            variant="primary"
            size="sm"
            className="shrink-0 rounded-full px-3 text-[11px] font-semibold shadow-[0_8px_18px_rgba(147,51,234,0.3)]"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Suggest
          </Button>
        </div>
        <p className="relative text-[10px] text-slate-500 mt-2">
          💡 AI focuses on Utah real estate workflows
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-pink-500/10 to-slate-950/60 backdrop-blur-xl p-3 shadow-[0_16px_32px_rgba(26,10,40,0.55)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-50">AI Task Suggestions</h3>
            <p className="text-[10px] text-slate-400">{suggestions.length} smart recommendations</p>
          </div>
        </div>
        {suggestions.length > 0 && (
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

      {loading && (
        <div className="text-center py-5">
          <div className="inline-flex items-center gap-2 text-[11px] text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            Generating suggestions...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200 mb-3">{error}</p>
          <Button
            onClick={getSuggestions}
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

      {suggestions.length > 0 && isExpanded && (
        <div className="space-y-2">
          {suggestions.map((task, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/10 bg-slate-900/50 p-3 hover:bg-slate-900/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-slate-50 mb-1">{task.title}</h4>
                  <p className="text-[11px] text-slate-300 mb-2">{task.description}</p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${getCategoryColor(task.category)}`}>
                      {task.category.replace('_', ' ')}
                    </span>
                    {task.dueInDays && (
                      <span className="text-slate-400">Due in {task.dueInDays} days</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onCreateTask(task)}
                  className="text-[11px] text-purple-300 hover:text-purple-200 font-medium whitespace-nowrap px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-3">
            <Button
              onClick={getSuggestions}
              variant="secondary"
              size="sm"
              className="flex-1 rounded-full"
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                setSuggestions([]);
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

      {suggestions.length > 0 && !isExpanded && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-300">
            {suggestions.length} task{suggestions.length !== 1 ? 's' : ''} suggested for today
          </p>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-purple-300 hover:text-purple-200 font-medium"
          >
            View all →
          </button>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          💡 AI suggestions based on your active deals and appointments
        </p>
      </div>
    </div>
  );
}
