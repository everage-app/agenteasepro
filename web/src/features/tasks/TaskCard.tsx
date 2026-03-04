import { Badge } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type TaskBucket = 'TODAY' | 'THIS_WEEK' | 'LATER' | 'DONE';
export type TaskStatus = 'OPEN' | 'DONE' | 'COMPLETED';

export interface TaskListItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  bucket: TaskBucket;
  dueAt?: string | null;
  deal?: {
    id: string;
    title: string;
    address?: string;
    stage?: string;
  };
  client?: {
    id: string;
    name: string;
    stage?: string; // NEW_LEAD, NURTURE, ACTIVE, UNDER_CONTRACT, CLOSED, PAST_CLIENT, DEAD
    referralRank?: string; // A, B, C
  };
  listing?: {
    id: string;
    address?: string;
    mlsId?: string;
    status?: string; // ACTIVE, PENDING, UNDER_CONTRACT, SOLD, OFF_MARKET
  };
  marketingBlast?: {
    id: string;
    title: string;
    status?: string; // DRAFT, SCHEDULED, SENT
    clicks?: number;
  };
}

interface TaskCardProps {
  task: TaskListItem;
  bucket: TaskBucket;
  onMarkDone?: (taskId: string) => void;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const priorityStyles = {
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  NORMAL: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  HIGH: 'bg-red-500/10 text-red-300 border-red-500/20',
};

const clientStageStyles: Record<string, { color: string; bgColor: string; label: string }> = {
  NEW_LEAD: { color: 'text-purple-300', bgColor: 'bg-purple-500/20', label: 'New Lead' },
  NURTURE: { color: 'text-blue-300', bgColor: 'bg-blue-500/20', label: 'Nurturing' },
  ACTIVE: { color: 'text-emerald-300', bgColor: 'bg-emerald-500/20', label: 'Active' },
  UNDER_CONTRACT: { color: 'text-orange-300', bgColor: 'bg-orange-500/20', label: 'Under Contract' },
  CLOSED: { color: 'text-green-300', bgColor: 'bg-green-500/20', label: 'Closed' },
  PAST_CLIENT: { color: 'text-slate-300', bgColor: 'bg-slate-500/20', label: 'Past Client' },
  DEAD: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Inactive' },
};

const dealStageStyles: Record<string, { color: string; icon: string }> = {
  LEAD: { color: 'text-slate-400', icon: '💡' },
  ACTIVE: { color: 'text-blue-400', icon: '🔥' },
  OFFER_SENT: { color: 'text-purple-400', icon: '📨' },
  UNDER_CONTRACT: { color: 'text-orange-400', icon: '📝' },
  DUE_DILIGENCE: { color: 'text-amber-400', icon: '🔍' },
  FINANCING: { color: 'text-yellow-400', icon: '💰' },
  SETTLEMENT_SCHEDULED: { color: 'text-cyan-400', icon: '📅' },
  CLOSED: { color: 'text-emerald-400', icon: '✅' },
  FELL_THROUGH: { color: 'text-red-400', icon: '❌' },
};

const listingStatusStyles: Record<string, { color: string; bgColor: string; icon: string }> = {
  DRAFT: { color: 'text-slate-300', bgColor: 'bg-slate-500/20', icon: '✏️' },
  ACTIVE: { color: 'text-emerald-300', bgColor: 'bg-emerald-500/20', icon: '🟢' },
  ACTIVE_NO_SHOW: { color: 'text-amber-300', bgColor: 'bg-amber-500/20', icon: '🚫' },
  PENDING: { color: 'text-yellow-300', bgColor: 'bg-yellow-500/20', icon: '⏳' },
  UNDER_CONTRACT: { color: 'text-blue-300', bgColor: 'bg-blue-500/20', icon: '📝' },
  BACKUP: { color: 'text-purple-300', bgColor: 'bg-purple-500/20', icon: '🔄' },
  SOLD: { color: 'text-rose-300', bgColor: 'bg-rose-500/20', icon: '🎉' },
  WITHDRAWN: { color: 'text-orange-300', bgColor: 'bg-orange-500/20', icon: '⏸️' },
  CANCELED: { color: 'text-red-300', bgColor: 'bg-red-500/20', icon: '❌' },
  EXPIRED: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: '⌛' },
  OFF_MARKET: { color: 'text-slate-400', bgColor: 'bg-slate-600/20', icon: '🏠' },
};

const marketingStatusStyles: Record<string, { color: string; bgColor: string; icon: string }> = {
  DRAFT: { color: 'text-slate-400', bgColor: 'bg-slate-500/20', icon: '✏️' },
  SCHEDULED: { color: 'text-amber-300', bgColor: 'bg-amber-500/20', icon: '⏰' },
  SENT: { color: 'text-emerald-300', bgColor: 'bg-emerald-500/20', icon: '✅' },
};

const rankStyles: Record<string, { color: string; bgColor: string }> = {
  A: { color: 'text-amber-300', bgColor: 'bg-amber-500/30' },
  B: { color: 'text-blue-300', bgColor: 'bg-blue-500/30' },
  C: { color: 'text-slate-400', bgColor: 'bg-slate-500/30' },
};

export function TaskCard({ task, bucket, onMarkDone, onDragStart, onDragEnd }: TaskCardProps) {
  const navigate = useNavigate();
  
  const getDueDateStatus = () => {
    if (!task.dueAt) return null;
    
    const now = new Date();
    const due = new Date(task.dueAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    if (dueDate < today && task.status === 'OPEN') {
      return { label: 'Overdue', style: 'bg-red-500/20 text-red-300 border-red-500/30' };
    } else if (dueDate.getTime() === today.getTime()) {
      return { label: 'Due today', style: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    } else {
      return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), style: 'bg-slate-700/40 text-slate-400 border-slate-600/30' };
    }
  };

  const dueDateStatus = getDueDateStatus();

  const handleRelationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.deal) {
      navigate(`/deals`);
    } else if (task.client) {
      navigate(`/clients/${task.client.id}`);
    } else if (task.listing) {
      navigate(`/listings`);
    } else if (task.marketingBlast) {
      navigate(`/marketing`);
    }
  };

  const handleMarkDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkDone) {
      onMarkDone(task.id);
    }
  };

  const getRelationLabel = () => {
    if (task.deal) return { label: 'Deal', icon: '🏠' };
    if (task.client) return { label: 'Client', icon: '👤' };
    if (task.listing) return { label: 'Listing', icon: '📍' };
    if (task.marketingBlast) return { label: 'Marketing', icon: '📣' };
    return null;
  };

  const relationLabel = getRelationLabel();

  return (
    <div
      draggable={bucket !== 'DONE'}
      onDragStart={(e) => onDragStart?.(e, task.id)}
      onDragEnd={onDragEnd}
      className="group rounded-xl md:rounded-2xl border border-white/10 bg-slate-950/80 px-2.5 md:px-3 py-2.5 md:py-3 text-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.7)] transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-400/70 hover:shadow-[0_18px_40px_rgba(37,99,235,0.75)] cursor-pointer touch-manipulation"
    >
      {/* Top row: Title & Priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 font-semibold text-white leading-tight text-sm md:text-base">
          {task.title}
        </div>
        <Badge className={`text-[9px] px-1.5 py-0.5 flex-shrink-0 ${priorityStyles[task.priority]}`}>
          {task.priority}
        </Badge>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-slate-400 text-[11px] leading-relaxed mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Due date pill */}
      {dueDateStatus && (
        <div className="mb-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${dueDateStatus.style}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {dueDateStatus.label}
          </span>
        </div>
      )}

      {/* Related entity line with enhanced status badges */}
      {(task.deal || task.client || task.listing || task.marketingBlast) && (
        <div className="space-y-1.5 mb-3">
          {/* Deal relation */}
          {task.deal && (
            <div 
              onClick={handleRelationClick}
              className="flex items-center gap-2 text-[10px] hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {task.deal.stage && dealStageStyles[task.deal.stage] && (
                  <span className="text-sm">{dealStageStyles[task.deal.stage].icon}</span>
                )}
                <span className="text-emerald-400 font-medium">Deal:</span>
                <span className="text-slate-300 truncate">{task.client?.name || 'Client'}</span>
              </div>
              {task.deal.stage && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  dealStageStyles[task.deal.stage]?.color || 'text-slate-400'
                }`}>
                  {task.deal.stage.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          )}

          {/* Client relation (standalone) */}
          {!task.deal && task.client && (
            <div 
              onClick={handleRelationClick}
              className="hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-blue-400 font-medium">👤 Client:</span>
                <span className="text-slate-300 flex-1 truncate">{task.client.name}</span>
                {task.client.referralRank && rankStyles[task.client.referralRank] && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    rankStyles[task.client.referralRank].bgColor
                  } ${rankStyles[task.client.referralRank].color}`}>
                    {task.client.referralRank}
                  </span>
                )}
              </div>
              {task.client.stage && clientStageStyles[task.client.stage] && (
                <div className="mt-1 flex items-center gap-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    clientStageStyles[task.client.stage].bgColor
                  } ${clientStageStyles[task.client.stage].color}`}>
                    {clientStageStyles[task.client.stage].label}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Listing relation */}
          {!task.deal && !task.client && task.listing && (
            <div 
              onClick={handleRelationClick}
              className="flex items-center gap-2 text-[10px] hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="text-purple-400 font-medium">📍 Listing:</span>
              <span className="text-slate-300 flex-1 truncate">{task.listing.address || task.listing.mlsId}</span>
              {task.listing.status && listingStatusStyles[task.listing.status] && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-1 ${
                  listingStatusStyles[task.listing.status].bgColor
                } ${listingStatusStyles[task.listing.status].color}`}>
                  <span className="text-[8px]">{listingStatusStyles[task.listing.status].icon}</span>
                  {task.listing.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          )}

          {/* Marketing blast relation */}
          {!task.deal && !task.client && !task.listing && task.marketingBlast && (
            <div 
              onClick={handleRelationClick}
              className="hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-pink-400 font-medium">📣 Marketing:</span>
                <span className="text-slate-300 flex-1 truncate">{task.marketingBlast.title}</span>
                {task.marketingBlast.status && marketingStatusStyles[task.marketingBlast.status] && (
                  <span className="text-sm">{marketingStatusStyles[task.marketingBlast.status].icon}</span>
                )}
              </div>
              {task.marketingBlast.clicks !== undefined && task.marketingBlast.clicks > 0 && (
                <div className="mt-1 flex items-center gap-1 text-emerald-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <span className="text-[9px] font-medium">{task.marketingBlast.clicks} clicks</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom row: Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        {bucket !== 'DONE' ? (
          <button
            onClick={handleMarkDone}
            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-emerald-400 transition-colors font-medium active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mark done
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Completed
          </span>
        )}
        
        {(task.deal || task.client || task.listing || task.marketingBlast) && relationLabel && (
          <button
            onClick={handleRelationClick}
            className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors md:opacity-0 md:group-hover:opacity-100 active:scale-95"
          >
            <span>{relationLabel.icon}</span>
            Open {relationLabel.label}
          </button>
        )}
      </div>
    </div>
  );
}
