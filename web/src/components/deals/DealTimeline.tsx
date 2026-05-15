import type { LucideIcon } from 'lucide-react';
import { BadgeDollarSign, CheckCircle2, Clock3, FileText, Search, Send, Target, XCircle } from 'lucide-react';

interface DealTimelineProps {
  status: string;
  createdAt?: string;
  closedAt?: string | null;
  repc?: {
    settlementDeadline?: string | null;
    dueDiligenceDeadline?: string | null;
    financingAppraisalDeadline?: string | null;
  } | null;
}

const milestones: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'LEAD', label: 'Lead', icon: Target },
  { key: 'ACTIVE', label: 'Active', icon: FileText },
  { key: 'OFFER_SENT', label: 'Offer', icon: Send },
  { key: 'UNDER_CONTRACT', label: 'Contract', icon: FileText },
  { key: 'DUE_DILIGENCE', label: 'Due Dil.', icon: Search },
  { key: 'FINANCING', label: 'Finance', icon: BadgeDollarSign },
  { key: 'SETTLEMENT_SCHEDULED', label: 'Settle', icon: Clock3 },
  { key: 'CLOSED', label: 'Closed', icon: CheckCircle2 },
];

const statusIndex: Record<string, number> = {};
milestones.forEach((m, i) => { statusIndex[m.key] = i; });

/**
 * Visual horizontal deal timeline showing progress through milestones.
 * Shows "you are here" indicator and upcoming deadline dates.
 */
export function DealTimeline({ status, createdAt, closedAt, repc }: DealTimelineProps) {
  const currentIdx = statusIndex[status] ?? 0;
  const isClosed = status === 'CLOSED';
  const isFellThrough = status === 'FELL_THROUGH';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-0">
        {milestones.map((m, idx) => {
          const MilestoneIcon = m.icon;
          const isComplete = idx < currentIdx || isClosed;
          const isCurrent = idx === currentIdx && !isClosed && !isFellThrough;
          const isPast = idx < currentIdx;
          const isFuture = idx > currentIdx && !isClosed;

          return (
            <div key={m.key} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${
                    isPast || isClosed ? 'bg-emerald-400/60' : 'bg-white/10'
                  }`}
                />
              )}

              {/* Milestone dot */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                  isCurrent
                    ? 'bg-cyan-500/30 border-cyan-400 shadow-lg shadow-cyan-500/30 animate-pulse'
                    : isComplete
                    ? 'bg-emerald-500/20 border-emerald-400/60'
                    : isFellThrough && idx >= currentIdx
                    ? 'bg-red-500/10 border-red-400/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {isComplete && !isCurrent ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.2} />
                ) : (
                  <MilestoneIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                )}
              </div>

              {/* Label */}
              <div
                className={`mt-1.5 text-[9px] font-semibold tracking-wide uppercase ${
                  isCurrent
                    ? 'text-cyan-300'
                    : isComplete
                    ? 'text-emerald-300/70'
                    : 'text-slate-600'
                }`}
              >
                {m.label}
              </div>

              {/* Date hint */}
              {isCurrent && (
                <div className="absolute -bottom-5 text-[8px] text-cyan-400/70 whitespace-nowrap">
                  YOU ARE HERE
                </div>
              )}
              {m.key === 'CLOSED' && closedAt && (
                <div className="text-[8px] text-emerald-400/70 mt-0.5">
                  {new Date(closedAt).toLocaleDateString()}
                </div>
              )}
              {m.key === 'DUE_DILIGENCE' && repc?.dueDiligenceDeadline && (
                <div className="text-[8px] text-amber-400/70 mt-0.5">
                  {new Date(repc.dueDiligenceDeadline).toLocaleDateString()}
                </div>
              )}
              {m.key === 'FINANCING' && repc?.financingAppraisalDeadline && (
                <div className="text-[8px] text-amber-400/70 mt-0.5">
                  {new Date(repc.financingAppraisalDeadline).toLocaleDateString()}
                </div>
              )}
              {m.key === 'SETTLEMENT_SCHEDULED' && repc?.settlementDeadline && (
                <div className="text-[8px] text-amber-400/70 mt-0.5">
                  {new Date(repc.settlementDeadline).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fell through indicator */}
      {isFellThrough && (
        <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/20">
          <XCircle className="h-3.5 w-3.5 text-red-300" />
          <span className="text-xs text-red-300 font-medium">Deal fell through</span>
        </div>
      )}
    </div>
  );
}

export default DealTimeline;
