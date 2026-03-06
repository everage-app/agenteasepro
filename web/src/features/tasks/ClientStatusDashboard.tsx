import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

type ClientStage = 'NEW_LEAD' | 'NURTURE' | 'ACTIVE' | 'UNDER_CONTRACT' | 'CLOSED' | 'PAST_CLIENT' | 'DEAD';
type ReferralRank = 'A' | 'B' | 'C';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  stage: ClientStage;
  referralRank: ReferralRank;
  lastContactAt?: string;
  email?: string;
  phone?: string;
  referralsGiven: number;
  referralsClosed: number;
}

interface ClientStats {
  stage: ClientStage;
  count: number;
  clients: Client[];
}

const stageConfig: Record<ClientStage, { label: string; color: string; bgColor: string; gradient: string; icon: string }> = {
  NEW_LEAD: {
    label: 'New Leads',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    gradient: 'from-purple-500 to-indigo-600',
    icon: '🌟'
  },
  NURTURE: {
    label: 'Nurturing',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    gradient: 'from-blue-500 to-cyan-600',
    icon: '🌱'
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-teal-600',
    icon: '🔥'
  },
  UNDER_CONTRACT: {
    label: 'Under Contract',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    gradient: 'from-orange-500 to-amber-600',
    icon: '📄'
  },
  CLOSED: {
    label: 'Closed',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    gradient: 'from-green-500 to-emerald-600',
    icon: '✅'
  },
  PAST_CLIENT: {
    label: 'Past Clients',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    gradient: 'from-slate-500 to-gray-600',
    icon: '👥'
  },
  DEAD: {
    label: 'Inactive',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    gradient: 'from-gray-400 to-slate-500',
    icon: '💤'
  },
};

const rankConfig: Record<ReferralRank, { label: string; color: string; bgColor: string }> = {
  A: { label: 'A-List', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  B: { label: 'B-List', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  C: { label: 'C-List', color: 'text-slate-700', bgColor: 'bg-slate-100' },
};

export default function ClientStatusDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ClientStats[]>([]);
  const [expandedStage, setExpandedStage] = useState<ClientStage | null>(null);

  useEffect(() => {
    fetchClientStats();
  }, []);

  const fetchClientStats = async () => {
    try {
      const response = await api.get('/clients');
      const data = response.data;
      const clients: Client[] = Array.isArray(data) ? data : [];

      // Group by stage
      const grouped = clients.reduce((acc, client) => {
        const stage = client.stage;
        if (!acc[stage]) {
          acc[stage] = { stage, count: 0, clients: [] };
        }
        acc[stage].count++;
        acc[stage].clients.push(client);
        return acc;
      }, {} as Record<ClientStage, ClientStats>);

      // Convert to array and sort by stage priority
      const stagePriority: ClientStage[] = ['NEW_LEAD', 'NURTURE', 'ACTIVE', 'UNDER_CONTRACT', 'CLOSED', 'PAST_CLIENT', 'DEAD'];
      const statsArray = stagePriority
        .map(stage => grouped[stage] || { stage, count: 0, clients: [] })
        .filter(stat => stat.count > 0);

      setStats(statsArray);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching client stats:', error);
      setLoading(false);
    }
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/clients/${clientId}`);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-slate-200 rounded w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 md:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">Client Pipeline</h2>
          <p className="text-xs text-slate-400">Track clients through your sales funnel</p>
        </div>
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium transition-all border border-emerald-400/30 hover:border-emerald-400/50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => {
          const config = stageConfig[stat.stage];
          const isExpanded = expandedStage === stat.stage;

          return (
            <div key={stat.stage} className="space-y-2">
              {/* Stage Card */}
              <div
                className={`relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer bg-slate-900/60 border border-white/10 backdrop-blur-sm hover:border-cyan-400/30 ${
                  isExpanded ? 'ring-2 ring-cyan-400' : ''
                }`}
                onClick={() => setExpandedStage(isExpanded ? null : stat.stage)}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-20`}></div>

                {/* Content */}
                <div className="relative p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{config.icon}</span>
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 ${config.color} transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* Count */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{stat.count}</span>
                    <span className="text-sm text-slate-400">
                      {stat.count === 1 ? 'client' : 'clients'}
                    </span>
                  </div>

                  {/* Mini Stats */}
                  <div className="flex gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <span>
                        {stat.clients.filter(c => c.referralRank === 'A').length} A-List
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Client List */}
              {isExpanded && stat.clients.length > 0 && (
                <div className="space-y-2 animate-slideDown">
                  {stat.clients.slice(0, 5).map(client => (
                    <div
                      key={client.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClientClick(client.id);
                      }}
                      className="bg-slate-900/60 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-white/10 hover:border-cyan-400/30 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-white truncate">
                              {client.firstName} {client.lastName}
                            </p>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                rankConfig[client.referralRank].bgColor
                              } ${rankConfig[client.referralRank].color}`}
                            >
                              {client.referralRank}
                            </span>
                          </div>
                          {client.email && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {client.email}
                            </p>
                          )}
                          {client.referralsGiven > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              <span>
                                {client.referralsGiven} referral{client.referralsGiven > 1 ? 's' : ''}
                                {client.referralsClosed > 0 && ` (${client.referralsClosed} closed)`}
                              </span>
                            </div>
                          )}
                          {client.lastContactAt && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>
                                Last contact:{' '}
                                {new Date(client.lastContactAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {stat.clients.length > 5 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/clients');
                      }}
                      className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2"
                    >
                      View all {stat.clients.length} clients →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-12 bg-slate-900/60 rounded-lg border-2 border-dashed border-white/10 backdrop-blur-sm">
          <svg className="w-12 h-12 text-slate-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-slate-300 font-medium">No clients yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Add your first client to start tracking your pipeline
          </p>
        </div>
      )}
    </div>
  );
}
