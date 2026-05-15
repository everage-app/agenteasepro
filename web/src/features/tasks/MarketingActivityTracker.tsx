import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BadgeDollarSign, CalendarDays, CheckCircle2, ChevronRight, DoorOpen, FileText, Home, MapPin, Megaphone, MousePointerClick, Plus, Send, Sparkles } from 'lucide-react';

type BlastStatus = 'DRAFT' | 'SCHEDULED' | 'SENT';
type BlastPlaybook = 'NEW_LISTING' | 'PRICE_REDUCTION' | 'OPEN_HOUSE' | 'UNDER_CONTRACT' | 'JUST_SOLD' | 'CUSTOM';

interface MarketingBlast {
  id: string;
  title: string;
  playbook: BlastPlaybook;
  status: BlastStatus;
  scheduledAt?: string;
  sentAt?: string;
  listingId?: string;
  listing?: {
    headline: string;
    addressLine1: string;
    city: string;
  };
  channels?: {
    id: string;
    channel: string;
    clicks: number;
    uniqueClicks: number;
  }[];
}

interface ActivityStats {
  totalBlasts: number;
  draftBlasts: number;
  scheduledBlasts: number;
  sentBlasts: number;
  totalClicks: number;
}

const statusConfig: Record<BlastStatus, { label: string; color: string; bgColor: string; gradient: string }> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    gradient: 'from-slate-400 to-gray-500',
  },
  SCHEDULED: {
    label: 'Scheduled',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    gradient: 'from-amber-500 to-orange-600',
  },
  SENT: {
    label: 'Sent',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    gradient: 'from-emerald-500 to-teal-600',
  },
};

const playbookConfig: Record<BlastPlaybook, { icon: LucideIcon; color: string }> = {
  NEW_LISTING: { icon: Home, color: 'text-blue-400' },
  PRICE_REDUCTION: { icon: BadgeDollarSign, color: 'text-green-400' },
  OPEN_HOUSE: { icon: DoorOpen, color: 'text-purple-400' },
  UNDER_CONTRACT: { icon: FileText, color: 'text-orange-400' },
  JUST_SOLD: { icon: CheckCircle2, color: 'text-emerald-400' },
  CUSTOM: { icon: Sparkles, color: 'text-indigo-400' },
};

export default function MarketingActivityTracker() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [blasts, setBlasts] = useState<MarketingBlast[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    totalBlasts: 0,
    draftBlasts: 0,
    scheduledBlasts: 0,
    sentBlasts: 0,
    totalClicks: 0,
  });
  const [selectedStatus, setSelectedStatus] = useState<BlastStatus | 'ALL'>('ALL');

  useEffect(() => {
    fetchMarketingBlasts();
  }, []);

  const fetchMarketingBlasts = async () => {
    try {
      const response = await fetch('/api/marketing');
      const rawData = await response.json();
      const data: MarketingBlast[] = Array.isArray(rawData) ? rawData : [];

      // Calculate stats
      const statsData: ActivityStats = {
        totalBlasts: data.length,
        draftBlasts: data.filter(b => b.status === 'DRAFT').length,
        scheduledBlasts: data.filter(b => b.status === 'SCHEDULED').length,
        sentBlasts: data.filter(b => b.status === 'SENT').length,
        totalClicks: data.reduce((sum, b) => {
          return sum + (b.channels?.reduce((channelSum, c) => channelSum + c.clicks, 0) || 0);
        }, 0),
      };

      setBlasts(data);
      setStats(statsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching marketing blasts:', error);
      setLoading(false);
    }
  };

  const handleBlastClick = (blastId: string) => {
    navigate(`/marketing/${blastId}`);
  };

  const filteredBlasts = selectedStatus === 'ALL'
    ? blasts
    : blasts.filter(b => b.status === selectedStatus);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-slate-200 rounded w-48"></div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 md:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">Marketing Activity</h2>
          <p className="text-xs text-slate-400">Track your marketing campaigns and engagement</p>
        </div>
        <button
          onClick={() => navigate('/marketing')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium transition-all border border-blue-400/30 hover:border-blue-400/50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Campaign
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-5 border border-cyan-400/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/10"></div>
          <div className="relative">
            <div className="text-2xl font-bold text-cyan-400">{stats.totalBlasts}</div>
            <div className="text-xs text-cyan-300 font-medium mt-1">Total Campaigns</div>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-5 border border-amber-400/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/10"></div>
          <div className="relative">
            <div className="text-2xl font-bold text-amber-400">{stats.scheduledBlasts}</div>
            <div className="text-xs text-amber-300 font-medium mt-1">Scheduled</div>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-5 border border-emerald-400/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/10"></div>
          <div className="relative">
            <div className="text-2xl font-bold text-emerald-400">{stats.sentBlasts}</div>
            <div className="text-xs text-emerald-300 font-medium mt-1">Sent</div>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-5 border border-violet-400/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/10"></div>
          <div className="relative">
            <div className="text-2xl font-bold text-violet-400">{stats.totalClicks}</div>
            <div className="text-xs text-violet-300 font-medium mt-1">Total Clicks</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedStatus('ALL')}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            selectedStatus === 'ALL'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10 hover:border-cyan-400/30'
          }`}
        >
          All ({blasts.length})
        </button>
        {(['DRAFT', 'SCHEDULED', 'SENT'] as BlastStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              selectedStatus === status
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10 hover:border-cyan-400/30'
            }`}
          >
            {statusConfig[status].label} ({blasts.filter(b => b.status === status).length})
          </button>
        ))}
      </div>

      {/* Blasts List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredBlasts.length > 0 ? (
          filteredBlasts.map(blast => {
            const config = statusConfig[blast.status];
            const playbook = playbookConfig[blast.playbook];
            const PlaybookIcon = playbook.icon;
            const totalClicks = blast.channels?.reduce((sum, c) => sum + c.clicks, 0) || 0;

            return (
              <div
                key={blast.id}
                onClick={() => handleBlastClick(blast.id)}
                className="bg-slate-900/60 backdrop-blur-sm rounded-lg p-5 shadow-sm hover:shadow-md transition-all cursor-pointer border border-white/10 hover:border-cyan-400/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <PlaybookIcon className={`h-5 w-5 ${playbook.color}`} />
                      <h3 className="font-semibold text-sm text-white truncate">
                        {blast.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </div>

                    {blast.listing && (
                      <p className="text-xs text-slate-400 truncate mb-2">
                        <MapPin className="mr-1 inline h-3 w-3" /> {blast.listing.addressLine1}, {blast.listing.city}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {blast.status === 'SCHEDULED' && blast.scheduledAt && (
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          <span>
                            {new Date(blast.scheduledAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {blast.status === 'SENT' && blast.sentAt && (
                        <div className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          <span>
                            Sent {new Date(blast.sentAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {blast.channels && blast.channels.length > 0 && (
                        <div className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3" />
                          <span>
                            {blast.channels.length} channel{blast.channels.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {totalClicks > 0 && (
                        <div className="flex items-center gap-1 text-emerald-600 font-medium">
                          <MousePointerClick className="h-3 w-3" />
                          <span>{totalClicks} clicks</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-slate-900/60 backdrop-blur-sm rounded-lg border-2 border-dashed border-white/10">
            <Megaphone className="mx-auto mb-3 h-12 w-12 text-slate-500" />
            <p className="text-slate-300 font-medium">
              {selectedStatus === 'ALL' ? 'No marketing campaigns yet' : `No ${statusConfig[selectedStatus as BlastStatus].label.toLowerCase()} campaigns`}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Create your first marketing blast to reach your audience
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
