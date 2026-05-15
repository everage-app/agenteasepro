import { Calendar, Clock, AlertCircle } from 'lucide-react';
import React from 'react';

interface DealCountdownProps {
  eventName: string;
  targetDate: Date;
  theme?: 'danger' | 'warning' | 'success' | 'info';
}

export function DealCountdown({ eventName, targetDate, theme = 'info' }: DealCountdownProps) {
  // A simple static calculation for visual representation
  const now = new Date();
  const diffTime = Math.max(targetDate.getTime() - now.getTime(), 0);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime / (1000 * 60 * 60)) % 24);

  const colors = {
    danger: 'text-red-400 border-red-500/30 bg-red-500/10',
    warning: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    success: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    info: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl transition-all hover:bg-white/10 group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"></div>
      
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className={`h-4 w-4 ${colors[theme].split(' ')[0]}`} />
            <h3 className="text-sm font-medium tracking-wider text-gray-400 uppercase">Upcoming Deadline</h3>
          </div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
            {eventName}
          </h2>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {targetDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className={`flex items-center gap-4 px-5 py-3 rounded-xl backdrop-blur-md border ${colors[theme]}`}>
          <div className="text-center">
            <span className="block text-3xl font-bold">{diffDays}</span>
            <span className="text-xs uppercase tracking-widest opacity-80">Days</span>
          </div>
          <div className="w-px h-10 bg-current opacity-20"></div>
          <div className="text-center">
            <span className="block text-3xl font-bold">{diffHours}</span>
            <span className="text-xs uppercase tracking-widest opacity-80">Hrs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
