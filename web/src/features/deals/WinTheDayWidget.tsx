import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';

interface DailyActivity {
  id: string;
  date: string;
  callsGoal: number;
  callsMade: number;
  notesGoal: number;
  notesSent: number;
  popbysGoal: number;
  popbysDone: number;
  referralsAskedGoal: number;
  referralsAsked: number;
}

export function WinTheDayWidget() {
  const [activity, setActivity] = useState<DailyActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoalSettings, setShowGoalSettings] = useState(false);

  useEffect(() => {
    loadTodayActivity();
  }, []);

  const loadTodayActivity = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/daily-activity?date=${today}`);
      
      if (res.data) {
        setActivity(res.data);
      } else {
        // Create default activity for today if doesn't exist
        const defaultActivity: DailyActivity = {
          id: 'temp',
          date: today,
          callsGoal: 10,
          callsMade: 0,
          notesGoal: 5,
          notesSent: 0,
          popbysGoal: 2,
          popbysDone: 0,
          referralsAskedGoal: 3,
          referralsAsked: 0,
        };
        setActivity(defaultActivity);
      }
    } catch (error) {
      console.error('Failed to load daily activity:', error);
      // Set defaults on error
      const today = new Date().toISOString().split('T')[0];
      setActivity({
        id: 'temp',
        date: today,
        callsGoal: 10,
        callsMade: 0,
        notesGoal: 5,
        notesSent: 0,
        popbysGoal: 2,
        popbysDone: 0,
        referralsAskedGoal: 3,
        referralsAsked: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async (field: keyof DailyActivity, value: number) => {
    if (!activity) return;
    
    try {
      const updated = { ...activity, [field]: value };
      setActivity(updated);
      
      // Save to backend
      if (activity.id === 'temp') {
        const res = await api.post('/daily-activity', updated);
        setActivity(res.data);
      } else {
        await api.patch(`/daily-activity/${activity.id}`, { [field]: value });
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  };

  const updateGoals = async (goals: {
    callsGoal: number;
    notesGoal: number;
    popbysGoal: number;
    referralsAskedGoal: number;
  }) => {
    if (!activity) return;
    
    try {
      const updated = { ...activity, ...goals };
      setActivity(updated);
      
      // Save to backend
      if (activity.id === 'temp') {
        const res = await api.post('/daily-activity', updated);
        setActivity(res.data);
      } else {
        await api.patch(`/daily-activity/${activity.id}`, goals);
      }
      
      setShowGoalSettings(false);
    } catch (error) {
      console.error('Failed to update goals:', error);
    }
  };

  const getProgressPercentage = (current: number, goal: number) => {
    if (goal === 0) return 0;
    return Math.min((current / goal) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'from-emerald-500 to-green-400';
    if (percentage >= 75) return 'from-blue-500 to-cyan-400';
    if (percentage >= 50) return 'from-yellow-500 to-amber-400';
    return 'from-slate-500 to-slate-400';
  };

  const getTotalProgress = () => {
    if (!activity) return 0;
    const items = [
      { current: activity.callsMade, goal: activity.callsGoal },
      { current: activity.notesSent, goal: activity.notesGoal },
      { current: activity.popbysDone, goal: activity.popbysGoal },
      { current: activity.referralsAsked, goal: activity.referralsAskedGoal },
    ];
    
    const totalProgress = items.reduce((sum, item) => {
      return sum + getProgressPercentage(item.current, item.goal);
    }, 0);
    
    return Math.round(totalProgress / items.length);
  };

  if (loading || !activity) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-6">
        <div className="text-xs text-slate-400">Loading today's goals...</div>
      </div>
    );
  }

  const totalProgress = getTotalProgress();
  const isDayWon = totalProgress >= 100;

  return (
    <div className="rounded-[32px] border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.60)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-50">Win the Day</h3>
              <button
                onClick={() => setShowGoalSettings(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-200 border border-white/5"
                title="Adjust goals"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Track your daily referral & touchpoint goals</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${isDayWon ? 'text-emerald-300' : 'text-slate-300'}`}>
              {totalProgress}%
            </div>
            {isDayWon && (
              <div className="text-xs text-emerald-400 font-medium">🏆 Day Won!</div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="p-6 space-y-5">
        {/* Calls */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-sm font-medium text-slate-200">Calls</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {activity.callsMade} / {activity.callsGoal}
              </span>
              <button
                onClick={() => updateActivity('callsMade', activity.callsMade + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-800/50 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(getProgressPercentage(activity.callsMade, activity.callsGoal))} transition-all duration-300`}
              style={{ width: `${getProgressPercentage(activity.callsMade, activity.callsGoal)}%` }}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-slate-200">Notes</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {activity.notesSent} / {activity.notesGoal}
              </span>
              <button
                onClick={() => updateActivity('notesSent', activity.notesSent + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-800/50 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(getProgressPercentage(activity.notesSent, activity.notesGoal))} transition-all duration-300`}
              style={{ width: `${getProgressPercentage(activity.notesSent, activity.notesGoal)}%` }}
            />
          </div>
        </div>

        {/* Pop-bys */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              <span className="text-sm font-medium text-slate-200">Pop-bys</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {activity.popbysDone} / {activity.popbysGoal}
              </span>
              <button
                onClick={() => updateActivity('popbysDone', activity.popbysDone + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-800/50 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(getProgressPercentage(activity.popbysDone, activity.popbysGoal))} transition-all duration-300`}
              style={{ width: `${getProgressPercentage(activity.popbysDone, activity.popbysGoal)}%` }}
            />
          </div>
        </div>

        {/* Referrals Asked */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-slate-200">Referrals Asked</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {activity.referralsAsked} / {activity.referralsAskedGoal}
              </span>
              <button
                onClick={() => updateActivity('referralsAsked', activity.referralsAsked + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-800/50 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(getProgressPercentage(activity.referralsAsked, activity.referralsAskedGoal))} transition-all duration-300`}
              style={{ width: `${getProgressPercentage(activity.referralsAsked, activity.referralsAskedGoal)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Goal Settings Modal */}
      {showGoalSettings && (
        <GoalSettingsModal
          currentGoals={{
            callsGoal: activity.callsGoal,
            notesGoal: activity.notesGoal,
            popbysGoal: activity.popbysGoal,
            referralsAskedGoal: activity.referralsAskedGoal,
          }}
          onSave={updateGoals}
          onClose={() => setShowGoalSettings(false)}
        />
      )}
    </div>
  );
}

interface GoalSettingsModalProps {
  currentGoals: {
    callsGoal: number;
    notesGoal: number;
    popbysGoal: number;
    referralsAskedGoal: number;
  };
  onSave: (goals: {
    callsGoal: number;
    notesGoal: number;
    popbysGoal: number;
    referralsAskedGoal: number;
  }) => void;
  onClose: () => void;
}

function GoalSettingsModal({ currentGoals, onSave, onClose }: GoalSettingsModalProps) {
  const [goals, setGoals] = useState(currentGoals);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const handleSave = () => {
    if (goals.callsGoal < 1 || goals.notesGoal < 1 || goals.popbysGoal < 1 || goals.referralsAskedGoal < 1) {
      alert('Goals must be at least 1');
      return;
    }
    setIsVisible(false);
    setTimeout(() => onSave(goals), 200);
  };

  const goalItems = [
    {
      key: 'callsGoal',
      label: 'Daily Calls',
      description: 'Phone calls to clients & leads',
      value: goals.callsGoal,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-cyan-400',
      bgGlow: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-400',
    },
    {
      key: 'notesGoal',
      label: 'Handwritten Notes',
      description: 'Personal notes to your sphere',
      value: goals.notesGoal,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-purple-500 to-pink-400',
      bgGlow: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-400',
    },
    {
      key: 'popbysGoal',
      label: 'Pop-by Visits',
      description: 'In-person client visits',
      value: goals.popbysGoal,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
      gradient: 'from-amber-500 to-orange-400',
      bgGlow: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
    },
    {
      key: 'referralsAskedGoal',
      label: 'Referrals Asked',
      description: 'Ask for referrals proactively',
      value: goals.referralsAskedGoal,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-emerald-500 to-teal-400',
      bgGlow: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
    },
  ];

  const modalContent = (
    <div 
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Floating particles/glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Modal Container - True center */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div 
          className={`relative w-full max-w-md transform transition-all duration-300 ease-out ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Outer glow ring */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-[28px] blur-xl opacity-75" />
          
          {/* Main Modal */}
          <div className="relative rounded-[24px] border border-slate-200/80 dark:border-white/20 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-900/98 dark:via-slate-900/95 dark:to-slate-950/98 shadow-2xl overflow-hidden">
            
            {/* Decorative top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl blur-lg opacity-40" />
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/30">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Daily Goals</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Customize your targets</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-300 transition-all duration-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 dark:hover:border-red-500/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Goal Items */}
            <div className="px-6 pb-4 space-y-3">
              {goalItems.map((item, index) => (
                <div 
                  key={item.key}
                  className="group relative"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`absolute inset-0 ${item.bgGlow} rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300`} />
                  <div className={`relative rounded-2xl bg-white/[0.03] border ${item.borderColor} border-opacity-30 p-4 hover:bg-white/[0.06] hover:border-opacity-50 transition-all duration-200`}>
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg`}>
                        <div className="text-white">
                          {item.icon}
                        </div>
                      </div>
                      
                      {/* Label & Description */}
                      <div className="flex-1 min-w-0">
                        <label className={`block text-sm font-semibold ${item.textColor}`}>
                          {item.label}
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {item.description}
                        </p>
                      </div>
                      
                      {/* Input */}
                      <div className="flex-shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={item.value}
                          onChange={(e) => setGoals({ ...goals, [item.key]: parseInt(e.target.value) || 1 })}
                          className={`w-20 h-12 rounded-xl border ${item.borderColor} bg-slate-950/80 px-3 text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-cyan-500/40 transition-all`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="relative px-6 py-5 bg-slate-950/60 border-t border-white/5">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white transition-all duration-200"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:from-cyan-400 group-hover:to-blue-400 transition-all" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.3),transparent_70%)]" />
                  </div>
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Goals
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  return createPortal(modalContent, document.body);
}
