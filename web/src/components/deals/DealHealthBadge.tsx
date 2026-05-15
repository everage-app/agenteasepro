interface DealHealthBadgeProps {
  lastActivityAt?: string | null;
  status: string;
  repc?: {
    settlementDeadline?: string | null;
    dueDiligenceDeadline?: string | null;
    financingAppraisalDeadline?: string | null;
  } | null;
  openTasks?: number;
}

/**
 * Auto-calculated deal health score badge.
 * Factors: days since activity, upcoming deadlines, missing docs, open tasks.
 */
export function DealHealthBadge({ lastActivityAt, status, repc, openTasks = 0 }: DealHealthBadgeProps) {
  // Don't show for closed or fell-through deals
  if (status === 'CLOSED' || status === 'FELL_THROUGH') return null;

  let score = 100;
  const now = Date.now();

  // Factor 1: Days since last activity (max -40 points)
  if (lastActivityAt) {
    const daysSince = Math.floor((now - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14) score -= 40;
    else if (daysSince > 7) score -= 25;
    else if (daysSince > 3) score -= 10;
  } else {
    score -= 20; // No activity tracked
  }

  // Factor 2: Upcoming deadlines within 3 days (max -30 points)
  const deadlines = [
    repc?.settlementDeadline,
    repc?.dueDiligenceDeadline,
    repc?.financingAppraisalDeadline,
  ].filter(Boolean);

  deadlines.forEach((d) => {
    if (!d) return;
    const daysUntil = Math.floor((new Date(d).getTime() - now) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) score -= 15; // Past deadline!
    else if (daysUntil <= 3) score -= 10;
    else if (daysUntil <= 7) score -= 5;
  });

  // Factor 3: Open tasks (max -15 points)
  if (openTasks > 5) score -= 15;
  else if (openTasks > 3) score -= 10;
  else if (openTasks > 0) score -= 5;

  // Factor 4: No REPC for deals past OFFER_SENT (-15 points)
  const advancedStatuses = ['UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING', 'SETTLEMENT_SCHEDULED'];
  if (advancedStatuses.includes(status) && !repc) {
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  // Color and label
  let color: string;
  let bgColor: string;
  let label: string;

  if (score >= 80) {
    color = 'text-emerald-400';
    bgColor = 'bg-emerald-500/15 border-emerald-400/30';
    label = 'Healthy';
  } else if (score >= 50) {
    color = 'text-amber-400';
    bgColor = 'bg-amber-500/15 border-amber-400/30';
    label = 'Needs attention';
  } else {
    color = 'text-red-400';
    bgColor = 'bg-red-500/15 border-red-400/30';
    label = 'At risk';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${bgColor} ${color}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        score >= 80 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'
      }`} />
      {score}% {label}
    </div>
  );
}

export default DealHealthBadge;
