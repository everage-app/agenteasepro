import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

// Priority Action Center v2 - matches server types
interface PriorityAction {
  id: string;
  type: 'CONTRACT_DEADLINE' | 'SIGNATURE_NEEDED' | 'CLIENT_FOLLOWUP' | 'REFERRAL_TOUCH' | 'MARKETING_BLAST' | 'DAILY_GOAL';
  title: string;
  description?: string;
  clientName?: string;
  dealOrListing?: string;
  dueDate?: string;
  priority: 'HIGH' | 'NORMAL';
  status?: string;
  
  // Navigation
  relatedId?: string;
  relatedType?: 'task' | 'deal' | 'client' | 'listing' | 'blast';
  
  // Quick actions
  actionLabel?: string;
  canComplete?: boolean;
  completionValue?: any;
}

export function PriorityActionCenter() {
  const [actions, setActions] = useState<PriorityAction[]>([]);
  const [smartFollowUps, setSmartFollowUps] = useState<PriorityAction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPriorityActions();
    loadSmartFollowUps();
  }, []);

  const loadSmartFollowUps = async () => {
    try {
      const res = await api.get('/clients');
      const clients = res.data || [];
      const now = Date.now();
      const suggestions: PriorityAction[] = [];

      clients.forEach((c: any) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
        const lastContact = c.lastContactAt ? new Date(c.lastContactAt).getTime() : 0;
        const daysSince = lastContact ? Math.floor((now - lastContact) / (1000 * 60 * 60 * 24)) : 999;

        // Birthday coming up within 7 days
        if (c.birthday) {
          const bday = new Date(c.birthday);
          const today = new Date();
          const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
          let daysUntil = Math.floor((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil < 0) {
            const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
            daysUntil = Math.floor((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }
          if (daysUntil <= 7) {
            suggestions.push({
              id: `smart-bday-${c.id}`,
              type: 'CLIENT_FOLLOWUP',
              title: daysUntil === 0 ? `🎉 ${name}'s birthday is TODAY!` : `🎂 ${name}'s birthday in ${daysUntil}d`,
              description: daysUntil === 0 ? 'Send a personal birthday message' : 'Plan a birthday greeting',
              clientName: name,
              priority: daysUntil === 0 ? 'HIGH' : 'NORMAL',
              relatedId: c.id,
              relatedType: 'client',
              actionLabel: 'Send wishes',
              canComplete: false,
            });
          }
        }

        // Hot leads not contacted in 3+ days
        if (c.temperature === 'HOT' && daysSince >= 3) {
          suggestions.push({
            id: `smart-hot-${c.id}`,
            type: 'CLIENT_FOLLOWUP',
            title: `Follow up with ${name}`,
            description: `Hot lead — ${daysSince}d since last contact`,
            clientName: name,
            priority: 'HIGH',
            relatedId: c.id,
            relatedType: 'client',
            actionLabel: 'Contact',
            canComplete: false,
          });
        }
        // Active clients not contacted in 7+ days
        else if (c.stage === 'ACTIVE_BUYER' || c.stage === 'ACTIVE_SELLER') {
          if (daysSince >= 7) {
            suggestions.push({
              id: `smart-active-${c.id}`,
              type: 'CLIENT_FOLLOWUP',
              title: `Check in with ${name}`,
              description: `Active client — ${daysSince}d since last contact`,
              clientName: name,
              priority: daysSince >= 14 ? 'HIGH' : 'NORMAL',
              relatedId: c.id,
              relatedType: 'client',
              actionLabel: 'Contact',
              canComplete: false,
            });
          }
        }
        // Referral partners — 30+ day touch
        else if (c.stage === 'REFERRAL' && daysSince >= 30) {
          suggestions.push({
            id: `smart-ref-${c.id}`,
            type: 'REFERRAL_TOUCH',
            title: `Referral touch: ${name}`,
            description: `${daysSince}d since last touch — stay top of mind`,
            clientName: name,
            priority: 'NORMAL',
            relatedId: c.id,
            relatedType: 'client',
            actionLabel: 'Reach out',
            canComplete: false,
          });
        }
      });

      // Sort by priority then by staleness
      suggestions.sort((a, b) => {
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1;
        return 0;
      });

      setSmartFollowUps(suggestions.slice(0, 5));
    } catch {
      // Silently fail — these are bonus suggestions
    }
  };

  const loadPriorityActions = async () => {
    try {
      // Priority Action Center v2 API
      const res = await api.get('/priority-actions/today');
      setActions(res.data.actions || []);
    } catch (error) {
      console.error('Failed to load priority actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: PriorityAction) => {
    if (action.relatedType === 'task') {
      navigate('/tasks');
    } else if (action.relatedType === 'deal') {
      navigate('/deals'); // Or navigate to specific deal detail page
    } else if (action.relatedType === 'client') {
      navigate('/clients');
    } else if (action.relatedType === 'listing') {
      navigate('/listings');
    } else if (action.relatedType === 'blast') {
      navigate('/marketing');
    }
  };

  const handleMarkDone = async (action: PriorityAction, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!action.canComplete) {
      handleActionClick(action);
      return;
    }

    try {
      await api.post(`/priority-actions/${action.id}/complete`, {
        actionType: action.type,
        completionValue: action.completionValue,
      });
      
      // Remove from list
      setActions(actions.filter(a => a.id !== action.id));
    } catch (error) {
      console.error('Failed to complete action:', error);
    }
  };

  const getTypeIcon = (type: PriorityAction['type']) => {
    switch (type) {
      case 'CONTRACT_DEADLINE':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'SIGNATURE_NEEDED':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        );
      case 'CLIENT_FOLLOWUP':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'REFERRAL_TOUCH':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case 'MARKETING_BLAST':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        );
      case 'DAILY_GOAL':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: PriorityAction['type']) => {
    switch (type) {
      case 'CONTRACT_DEADLINE':
        return 'from-violet-500/20 to-purple-500/10 border-violet-400/30 text-violet-200';
      case 'SIGNATURE_NEEDED':
        return 'from-amber-500/20 to-yellow-500/10 border-amber-400/30 text-amber-200';
      case 'CLIENT_FOLLOWUP':
        return 'from-blue-500/20 to-cyan-500/10 border-blue-400/30 text-blue-200';
      case 'REFERRAL_TOUCH':
        return 'from-emerald-500/20 to-green-500/10 border-emerald-400/30 text-emerald-200';
      case 'MARKETING_BLAST':
        return 'from-pink-500/20 to-rose-500/10 border-pink-400/30 text-pink-200';
      case 'DAILY_GOAL':
        return 'from-cyan-500/20 to-blue-500/10 border-cyan-400/30 text-cyan-200';
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-6">
        <div className="text-xs text-slate-400">Loading priority actions...</div>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.60)] overflow-hidden h-full">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Priority Action Center</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Do this next — contracts, calls, referral touches, and daily goals
            </p>
          </div>
          {actions.length > 0 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-200">
              {actions.length}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {actions.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm text-slate-400">No urgent actions right now</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          actions.slice(0, 10).map((action) => (
            <div
              key={action.id}
              onClick={() => handleActionClick(action)}
              className="group flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getTypeColor(action.type)} border`}>
                {getTypeIcon(action.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-50 truncate group-hover:text-cyan-300 transition-colors">
                    {action.title}
                  </p>
                  {action.priority === 'HIGH' && (
                    <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-200 border border-red-400/30">
                      URGENT
                    </span>
                  )}
                  {action.status && action.status !== 'OPEN' && (
                    <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-400/30">
                      {action.status}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  {action.clientName && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {action.clientName}
                    </span>
                  )}
                  {action.dealOrListing && (
                    <span className="truncate max-w-[200px]">• {action.dealOrListing}</span>
                  )}
                  {action.dueDate && (
                    <span className="text-indigo-300">
                      Due {new Date(action.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {action.description && (
                    <span className="truncate max-w-[300px]">• {action.description}</span>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => handleMarkDone(action, e)}
                className="flex-shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors"
              >
                {action.actionLabel || (action.canComplete ? 'Mark done' : 'View')}
              </button>
            </div>
          ))
        )}
      </div>

      {actions.length > 10 && (
        <div className="border-t border-white/10 px-6 py-3">
          <p className="text-xs text-slate-400 text-center">
            Showing top 10 of {actions.length} priority actions
          </p>
        </div>
      )}

      {actions.length > 0 && actions.length <= 10 && (
        <div className="border-t border-white/10 px-6 py-3">
          <button
            onClick={() => navigate('/tasks')}
            className="text-xs text-slate-400 hover:text-cyan-300 transition-colors"
          >
            View all tasks →
          </button>
        </div>
      )}

      {/* Smart Follow-Up Suggestions */}
      {smartFollowUps.length > 0 && (
        <>
          <div className="border-t border-white/10 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-400 font-semibold">🧠 Smart Follow-ups</span>
              <span className="text-[10px] text-slate-500">AI-suggested</span>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {smartFollowUps.map((action) => (
              <div
                key={action.id}
                onClick={() => navigate(`/clients`)}
                className="group flex items-center gap-4 px-6 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getTypeColor(action.type)} border`}>
                  {getTypeIcon(action.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                    {action.title}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{action.description}</p>
                </div>
                {action.priority === 'HIGH' && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-semibold text-red-200 border border-red-400/30">
                    URGENT
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
