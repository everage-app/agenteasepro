import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { ActiveDealsWidget } from './ActiveDealsWidget';
import { useAuthStore } from '../auth/authStore';
import { TodayAgenda } from '../../components/calendar/TodayAgenda';
import { PriorityActionCenter } from './PriorityActionCenter';
import { WinTheDayWidget } from './WinTheDayWidget';
import { PageLayout } from '../../components/layout/PageLayout';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import { ActivityFeed } from '../../components/dashboard/ActivityFeed';
import { RevenueGoalTracker } from '../../components/dashboard/RevenueGoalTracker';
import { RecentRepliesWidget } from '../../components/dashboard/RecentRepliesWidget';
import { NextBestActionRail } from '../../components/dashboard/NextBestActionRail';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMotivation(): string {
  const phrases = [
    'Your pipeline is waiting — let\u2019s close some deals!',
    'Every follow-up today is a commission tomorrow.',
    'Top producers check in daily. You\u2019re already here.',
    'Today\u2019s hustle is tomorrow\u2019s closing table.',
    'Consistency wins. Let\u2019s make today count.',
    'Your clients are counting on you — let\u2019s go!',
    'Great agents don\u2019t wait for leads, they create them.',
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return phrases[dayOfYear % phrases.length];
}

function getLoginStreak(): number {
  const key = 'ae-login-streak';
  const lastKey = 'ae-last-login-date';
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(lastKey);
  let streak = parseInt(localStorage.getItem(key) || '0', 10);

  if (lastDate === today) return streak; // Already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastDate === yesterday) {
    streak += 1;
  } else {
    streak = 1; // Reset
  }

  localStorage.setItem(key, String(streak));
  localStorage.setItem(lastKey, today);
  return streak;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const firstName = agent?.name?.split(' ')[0] || 'Agent';
  const [stats, setStats] = useState<any | null>(null);
  const streak = getLoginStreak();
  const greeting = getGreeting();
  const motivation = getMotivation();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.get('/reporting/overview', { params: { timeRange: 'month' } });
        setStats(res.data);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      }
    };
    loadStats();
  }, []);

  return (
    <PageLayout
      title={`${greeting}, ${firstName}`}
      subtitle={motivation}
      maxWidth="full"
    >
      <div className="space-y-4 sm:space-y-6 pb-10">

        <div className="rounded-2xl sm:rounded-[28px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-3 sm:p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-3 sm:gap-4 items-start">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Daily guidance</div>
                {streak > 1 && (
                  <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-amber-400/30">
                    <span className="text-xs">&#128293;</span>
                    <span className="text-[11px] font-bold text-amber-300">{streak} day streak</span>
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-slate-300">
                Start with today&apos;s schedule, clear priority actions, then launch your top follow-up.
              </div>
            </div>

            <div className="min-w-0 border-t border-white/10 pt-3 lg:pt-0 lg:border-t-0 lg:border-l lg:border-white/10 lg:pl-4">
              <NextBestActionRail compact maxItems={3} />
            </div>
          </div>
        </div>

        {/* ROW 1: Active Deals — the hero section */}
        <div className="w-full">
          <ActiveDealsWidget />
        </div>

        {/* ROW 2: Pipeline Pulse + Quick Actions side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* Pipeline Pulse — 2/3 width */}
          <div className="lg:col-span-2 rounded-2xl sm:rounded-[32px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span> Pipeline Pulse
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <PulseStat
                label="Active Deals"
                value={stats?.deals?.activeDeals ?? '—'}
                icon="🏠"
                color="text-emerald-400"
              />
              <PulseStat
                label="Under Contract"
                value={stats?.deals?.underContract ?? '—'}
                icon="📝"
                color="text-blue-400"
              />
              <PulseStat
                label="Closed This Month"
                value={stats?.deals?.closedThisMonth ?? '—'}
                icon="🎉"
                color="text-purple-400"
              />
              <PulseStat
                label="Appointments"
                value={stats?.appointments?.upcoming ?? '—'}
                icon="📅"
                color="text-amber-400"
              />
            </div>
          </div>

          {/* Quick Actions — 1/3 width */}
          <div className="lg:col-span-1 grid grid-cols-2 gap-2 sm:gap-3">
             <QuickActionButton 
               icon={<PlusIcon />} 
               label="New Deal" 
               color="bg-blue-600" 
               onClick={() => navigate('/deals/new')} 
             />
             <QuickActionButton 
               icon={<HomeIcon />} 
               label="Listing" 
               color="bg-emerald-600/20 text-emerald-400 border-emerald-500/30" 
               onClick={() => navigate('/listings')} 
             />
             <QuickActionButton 
               icon={<UserIcon />} 
               label="Client" 
               color="bg-purple-600/20 text-purple-400 border-purple-500/30" 
               onClick={() => navigate('/clients')} 
             />
             <QuickActionButton 
               icon={<MegaphoneIcon />} 
               label="Blast" 
               color="bg-amber-600/20 text-amber-400 border-amber-500/30" 
               onClick={() => navigate('/marketing')} 
             />
          </div>

        </div>

        {/* ROW 3: Schedule + Priority Actions + Win The Day */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* Schedule */}
          <div className="rounded-2xl sm:rounded-[32px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📅</span> Schedule
              </h3>
              <button onClick={() => navigate('/calendar')} className="text-xs text-blue-400 hover:text-blue-300 active:text-blue-200 font-medium py-1 px-2 -mr-2">View Calendar</button>
            </div>
            <div className="flex-1">
              <TodayAgenda />
            </div>
          </div>

          {/* Priority Actions */}
          <div className="rounded-2xl sm:rounded-[32px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-1 flex flex-col">
             <PriorityActionCenter />
          </div>

          {/* Win The Day */}
          <WinTheDayWidget />

        </div>

        {/* ROW 4: Recent Replies + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Replies */}
          <div className="rounded-2xl sm:rounded-[32px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>📬</span> Recent Replies
            </h3>
            <RecentRepliesWidget />
          </div>

          {/* Recent Activity Feed */}
          <div className="rounded-2xl sm:rounded-[32px] bg-slate-950/40 border border-white/10 backdrop-blur-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>📋</span> Recent Activity
            </h3>
            <ActivityFeed />
          </div>

        </div>

        {/* ROW 5: Revenue Goal */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <RevenueGoalTracker
            closedVolume={stats?.financials?.ytdGCI ? stats.financials.ytdGCI / 0.03 : stats?.deals?.totalVolume || 0}
            pendingVolume={stats?.deals?.pendingVolume || 0}
            closedDeals={stats?.deals?.closedThisMonth || 0}
          />
        </div>

      </div>
    </PageLayout>
  );
}

// Helper Components for cleaner code
function QuickActionButton({ icon, label, color, onClick }: any) {
  const isSolid = color.includes('bg-blue-600');
  return (
    <button
      onClick={onClick}
      className={`h-20 sm:h-24 rounded-xl sm:rounded-[24px] flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 sm:hover:scale-[1.02] ${
        isSolid 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
          : `border border-white/5 backdrop-blur-md ${color} sm:hover:bg-white/10 active:bg-white/10`
      }`}
    >
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${isSolid ? 'bg-white/20' : 'bg-white/5'}`}>
        {icon}
      </div>
      <span className="text-[10px] sm:text-xs font-bold">{label}</span>
    </button>
  );
}

function PulseStat({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue) && isFinite(numericValue);
  const prefix = typeof value === 'string' && value.startsWith('$') ? '$' : '';
  return (
    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center text-center gap-1.5">
      <span className="text-lg">{icon}</span>
      {isNumeric ? (
        <AnimatedCounter value={numericValue} className={`text-2xl sm:text-3xl font-bold ${color}`} prefix={prefix} />
      ) : (
        <div className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</div>
      )}
      <div className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wide leading-tight">{label}</div>
    </div>
  );
}

// Icons
const PlusIcon = () => <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const HomeIcon = () => <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const UserIcon = () => <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const MegaphoneIcon = () => <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
