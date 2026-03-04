import { useState, useEffect } from 'react';

interface RevenueGoalTrackerProps {
  closedVolume?: number;
  pendingVolume?: number;
  closedDeals?: number;
}

const STORAGE_KEY = 'ae-revenue-goal';

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

/**
 * Revenue/GCI goal tracker with editable annual target,
 * progress ring, and projected pace indicator.
 */
export function RevenueGoalTracker({ closedVolume = 0, pendingVolume = 0, closedDeals = 0 }: RevenueGoalTrackerProps) {
  const [goal, setGoal] = useState<number>(500000);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setGoal(parseInt(saved, 10) || 500000);
  }, []);

  const saveGoal = () => {
    const parsed = parseInt(inputVal.replace(/[^0-9]/g, ''), 10);
    if (parsed > 0) {
      setGoal(parsed);
      localStorage.setItem(STORAGE_KEY, String(parsed));
    }
    setEditing(false);
  };

  // Assume 3% commission on closed volume as GCI
  const gci = closedVolume * 0.03;
  const projected = gci + pendingVolume * 0.03;
  const progress = Math.min((gci / goal) * 100, 100);
  const projectedProgress = Math.min((projected / goal) * 100, 100);

  // SVG ring dimensions
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;
  const projDashOffset = circumference - (projectedProgress / 100) * circumference;

  // Monthly pace
  const now = new Date();
  const monthsElapsed = now.getMonth() + (now.getDate() / 30);
  const monthlyPace = monthsElapsed > 0 ? gci / monthsElapsed : 0;
  const annualProjected = monthlyPace * 12;
  const onTrack = annualProjected >= goal * 0.9;

  return (
    <div className="rounded-2xl sm:rounded-[32px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <span>💰</span> Revenue Goal
        </h3>
        <button
          onClick={() => { setInputVal(String(goal)); setEditing(true); }}
          className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors"
        >
          {editing ? '' : 'Edit goal'}
        </button>
      </div>

      <div className="flex items-center gap-6">
        {/* Progress Ring */}
        <div className="relative shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-white/5"
            />
            {/* Projected ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={projDashOffset}
              strokeLinecap="round"
              className="text-cyan-500/20 transition-all duration-1000"
            />
            {/* Actual ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#revenueGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{Math.round(progress)}%</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-wide">of goal</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          {editing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Annual GCI goal"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
              />
              <button onClick={saveGoal} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500">
                Save
              </button>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">GCI Earned</div>
                <div className="text-lg font-bold text-emerald-400">{formatCurrency(gci)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Goal</div>
                <div className="text-sm font-semibold text-white">{formatCurrency(goal)}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${onTrack ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <div className={`text-[10px] font-medium ${onTrack ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {onTrack ? 'On track' : 'Below pace'} · {formatCurrency(monthlyPace)}/mo
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Deals closed counter */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="text-[10px] text-slate-500">{closedDeals} deal{closedDeals !== 1 ? 's' : ''} closed</div>
        <div className="text-[10px] text-slate-500">Pending: {formatCurrency(pendingVolume * 0.03)} GCI</div>
      </div>
    </div>
  );
}

export default RevenueGoalTracker;
