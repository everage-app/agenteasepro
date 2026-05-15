import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  Home,
  Hourglass,
  Lightbulb,
  MapPin,
  Megaphone,
  PauseCircle,
  Pencil,
  RefreshCw,
  Search,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';

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
  onOpenTask?: (task: TaskListItem) => void;
}

const priorityStyles: Record<string, { dot: string; text: string; bg: string }> = {
  LOW: { dot: 'bg-slate-500 dark:bg-slate-300', text: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-200/70 dark:bg-slate-500/20' },
  NORMAL: { dot: 'bg-blue-600 dark:bg-blue-300', text: 'text-blue-700 dark:text-blue-200', bg: 'bg-blue-200/70 dark:bg-blue-500/20' },
  HIGH: { dot: 'bg-rose-600 dark:bg-rose-300', text: 'text-rose-700 dark:text-rose-200', bg: 'bg-rose-200/70 dark:bg-rose-500/20' },
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

const dealStageStyles: Record<string, { color: string; icon: LucideIcon }> = {
  LEAD: { color: 'text-slate-400', icon: Lightbulb },
  ACTIVE: { color: 'text-blue-400', icon: Flame },
  OFFER_SENT: { color: 'text-purple-400', icon: Send },
  UNDER_CONTRACT: { color: 'text-orange-400', icon: FileText },
  DUE_DILIGENCE: { color: 'text-amber-400', icon: Search },
  FINANCING: { color: 'text-yellow-400', icon: BadgeDollarSign },
  SETTLEMENT_SCHEDULED: { color: 'text-cyan-400', icon: Clock3 },
  CLOSED: { color: 'text-emerald-400', icon: CheckCircle2 },
  FELL_THROUGH: { color: 'text-red-400', icon: XCircle },
};

const listingStatusStyles: Record<string, { color: string; bgColor: string; icon: LucideIcon }> = {
  DRAFT: { color: 'text-slate-300', bgColor: 'bg-slate-500/20', icon: Pencil },
  ACTIVE: { color: 'text-emerald-300', bgColor: 'bg-emerald-500/20', icon: CheckCircle2 },
  ACTIVE_NO_SHOW: { color: 'text-amber-300', bgColor: 'bg-amber-500/20', icon: Ban },
  PENDING: { color: 'text-yellow-300', bgColor: 'bg-yellow-500/20', icon: Clock3 },
  UNDER_CONTRACT: { color: 'text-blue-300', bgColor: 'bg-blue-500/20', icon: FileText },
  BACKUP: { color: 'text-purple-300', bgColor: 'bg-purple-500/20', icon: RefreshCw },
  SOLD: { color: 'text-rose-300', bgColor: 'bg-rose-500/20', icon: BadgeDollarSign },
  WITHDRAWN: { color: 'text-orange-300', bgColor: 'bg-orange-500/20', icon: PauseCircle },
  CANCELED: { color: 'text-red-300', bgColor: 'bg-red-500/20', icon: XCircle },
  EXPIRED: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: Hourglass },
  OFF_MARKET: { color: 'text-slate-400', bgColor: 'bg-slate-600/20', icon: Home },
};

const marketingStatusStyles: Record<string, { color: string; bgColor: string; icon: LucideIcon }> = {
  DRAFT: { color: 'text-slate-400', bgColor: 'bg-slate-500/20', icon: Pencil },
  SCHEDULED: { color: 'text-amber-300', bgColor: 'bg-amber-500/20', icon: Clock3 },
  SENT: { color: 'text-emerald-300', bgColor: 'bg-emerald-500/20', icon: CheckCircle2 },
};

const rankStyles: Record<string, { color: string; bgColor: string }> = {
  A: { color: 'text-amber-300', bgColor: 'bg-amber-500/30' },
  B: { color: 'text-blue-300', bgColor: 'bg-blue-500/30' },
  C: { color: 'text-slate-400', bgColor: 'bg-slate-500/30' },
};

function cleanDisplayText(value?: string | null) {
  const text = String(value ?? '')
    .trim()
    .replace(/^(null|undefined)\s*[-:]\s*/i, '')
    .replace(/\s*[-:]\s*(null|undefined)$/i, '')
    .trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
}

function getDealDisplayName(task: TaskListItem) {
  if (!task.deal) return 'Deal';
  return cleanDisplayText(task.deal.address) || cleanDisplayText(task.deal.title) || 'Deal';
}

export function TaskCard({ task, bucket, onMarkDone, onDragStart, onDragEnd, onOpenTask }: TaskCardProps) {
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

  const handleOpenTask = () => {
    onOpenTask?.(task);
  };

  const getRelationLabel = () => {
    if (task.deal) return { label: 'Deal', icon: Home };
    if (task.client) return { label: 'Client', icon: UserRound };
    if (task.listing) return { label: 'Listing', icon: MapPin };
    if (task.marketingBlast) return { label: 'Marketing', icon: Megaphone };
    return null;
  };

  const relationLabel = getRelationLabel();

  return (
    <div
      draggable={bucket !== 'DONE'}
      onDragStart={(e) => onDragStart?.(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={handleOpenTask}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenTask();
        }
      }}
      role="button"
      tabIndex={0}
      className="group rounded-xl md:rounded-2xl border border-slate-300/70 dark:border-white/12 bg-white/88 dark:bg-slate-950/80 px-2.5 md:px-3 py-2.5 md:py-3 text-[12px] shadow-[0_8px_26px_rgba(15,23,42,0.24)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.7)] transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-500/70 dark:hover:border-blue-400/70 hover:shadow-[0_14px_30px_rgba(6,182,212,0.28)] dark:hover:shadow-[0_18px_40px_rgba(37,99,235,0.75)] cursor-pointer touch-manipulation"
    >
      {/* Top row: Title & Priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 font-semibold text-slate-900 dark:text-white leading-tight text-sm md:text-base">
          {task.title}
        </div>
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider flex-shrink-0 ${priorityStyles[task.priority].bg} ${priorityStyles[task.priority].text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityStyles[task.priority].dot}`} />
          {task.priority}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed mb-2 line-clamp-2">
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
              className="flex items-center gap-2 text-[10px] hover:bg-slate-900/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {task.deal.stage && dealStageStyles[task.deal.stage] && (() => {
                  const DealStageIcon = dealStageStyles[task.deal.stage].icon;
                  return <DealStageIcon className={`h-3.5 w-3.5 ${dealStageStyles[task.deal.stage].color}`} strokeWidth={2.2} />;
                })()}
                <span className="text-emerald-400 font-medium">Deal:</span>
                <span className="text-slate-700 dark:text-slate-300 truncate">{getDealDisplayName(task)}</span>
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
              className="hover:bg-slate-900/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1 text-blue-400 font-medium">
                  <UserRound className="h-3.5 w-3.5" /> Client:
                </span>
                <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">{task.client.name}</span>
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
              className="flex items-center gap-2 text-[10px] hover:bg-slate-900/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 text-purple-400 font-medium">
                <MapPin className="h-3.5 w-3.5" /> Listing:
              </span>
              <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">{task.listing.address || task.listing.mlsId}</span>
              {task.listing.status && listingStatusStyles[task.listing.status] && (() => {
                const ListingStatusIcon = listingStatusStyles[task.listing.status].icon;
                return (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-1 ${
                  listingStatusStyles[task.listing.status].bgColor
                } ${listingStatusStyles[task.listing.status].color}`}>
                  <ListingStatusIcon className="h-3 w-3" strokeWidth={2.2} />
                  {task.listing.status.replace(/_/g, ' ')}
                </span>
                );
              })()}
            </div>
          )}

          {/* Marketing blast relation */}
          {!task.deal && !task.client && !task.listing && task.marketingBlast && (
            <div 
              onClick={handleRelationClick}
              className="hover:bg-slate-900/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1 text-pink-400 font-medium">
                  <Megaphone className="h-3.5 w-3.5" /> Marketing:
                </span>
                <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">{task.marketingBlast.title}</span>
                {task.marketingBlast.status && marketingStatusStyles[task.marketingBlast.status] && (() => {
                  const MarketingStatusIcon = marketingStatusStyles[task.marketingBlast.status].icon;
                  return <MarketingStatusIcon className={`h-3.5 w-3.5 ${marketingStatusStyles[task.marketingBlast.status].color}`} strokeWidth={2.2} />;
                })()}
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
      <div className="flex items-center justify-between pt-2 border-t border-slate-300/60 dark:border-white/8">
        {bucket !== 'DONE' ? (
          <button
            onClick={handleMarkDone}
            className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-semibold active:scale-95"
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
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTask();
            }}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-600/45 dark:border-cyan-400/35 bg-cyan-100/90 dark:bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold text-cyan-800 dark:text-cyan-100 hover:bg-cyan-200 dark:hover:bg-cyan-500/25 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1-1v2m-7 9a9 9 0 1118 0 9 9 0 01-18 0zm9-4h.01M12 12v4" />
            </svg>
            Edit
          </button>

          {(task.deal || task.client || task.listing || task.marketingBlast) && relationLabel && (
            <button
              onClick={handleRelationClick}
              className="inline-flex items-center gap-1 rounded-full border border-blue-600/45 dark:border-blue-400/35 bg-blue-100/90 dark:bg-blue-500/15 px-2.5 py-1 text-[10px] font-semibold text-blue-800 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors active:scale-95"
            >
              {(() => {
                const RelationIcon = relationLabel.icon;
                return <RelationIcon className="h-3 w-3" strokeWidth={2.2} />;
              })()}
              Open {relationLabel.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
