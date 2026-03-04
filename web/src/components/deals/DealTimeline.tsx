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

const milestones = [
  { key: 'LEAD', label: 'Lead', icon: '🎯' },
  { key: 'ACTIVE', label: 'Active', icon: '📋' },
  { key: 'OFFER_SENT', label: 'Offer', icon: '📤' },
  { key: 'UNDER_CONTRACT', label: 'Contract', icon: '📝' },
  { key: 'DUE_DILIGENCE', label: 'Due Dil.', icon: '🔍' },
  { key: 'FINANCING', label: 'Finance', icon: '🏦' },
  { key: 'SETTLEMENT_SCHEDULED', label: 'Settle', icon: '📅' },
  { key: 'CLOSED', label: 'Closed', icon: '🎉' },
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
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                ) : (
                  <span className="text-xs">{m.icon}</span>
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
          <span className="text-xs">❌</span>
          <span className="text-xs text-red-300 font-medium">Deal fell through</span>
        </div>
      )}
    </div>
  );
}

export default DealTimeline;
