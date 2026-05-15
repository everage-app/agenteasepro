import { BarChart, Activity, Globe, MousePointerClick, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ListingAnalyticsWidget() {
  const navigate = useNavigate();

  return (
    <div className="w-full flex flex-col rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-slate-950/80 to-[#101525]/80 border border-white/10 backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <BarChart className="w-5 h-5 text-amber-500" />
          Listing & Web Analytics
        </h3>
        <button 
          onClick={() => navigate('/marketing')}
          className="text-xs sm:text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          View Full Report →
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <StatCard 
          icon={<Globe className="w-5 h-5 text-blue-400" />}
          label="Property Site Views"
          value="1,248"
          trend="+14% this week"
          trendColor="text-emerald-400"
        />
        <StatCard 
          icon={<MousePointerClick className="w-5 h-5 text-purple-400" />}
          label="IDX Searches Run"
          value="842"
          trend="+22% this week"
          trendColor="text-emerald-400"
        />
        <StatCard 
          icon={<Users className="w-5 h-5 text-amber-400" />}
          label="Warm Leads Captured"
          value="24"
          trend="+3 this week"
          trendColor="text-emerald-400"
        />
        <StatCard 
          icon={<Activity className="w-5 h-5 text-rose-400" />}
          label="Social Ad Clicks"
          value="512"
          trend="-2% this week"
          trendColor="text-slate-400"
        />
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white"><TrendingUp className="h-4 w-4 text-rose-300" /> Active Listing: 123 Main St is trending!</p>
          <p className="text-xs text-slate-400 mt-1">It received 142 views in the last 24 hours. Consider boosting the social ad.</p>
        </div>
        <button 
          onClick={() => navigate('/marketing')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-sm font-semibold text-white pointer-events-auto"
        >
          Boost Campaign
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, trendColor }: { icon: React.ReactNode, label: string, value: string, trend: string, trendColor: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/[0.05] hover:bg-white/[0.07] transition-colors relative group">
      <div className="flex items-center gap-2 mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
        {icon}
        <span className="text-xs font-medium text-slate-300">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">{value}</div>
      <div className={`text-[10px] sm:text-xs font-medium ${trendColor}`}>{trend}</div>
    </div>
  );
}