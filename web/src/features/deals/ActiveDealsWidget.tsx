import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface Deal {
  id: string;
  title: string;
  clientName?: string;
  price?: number;
  status: string;
  closingDate?: string;
  address?: string;
}

export function ActiveDealsWidget() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      const res = await api.get('/deals');
      const active = res.data
        .filter((d: any) => d.status !== 'CLOSED' && d.status !== 'ARCHIVED' && d.status !== 'FELL_THROUGH')
        .map((d: any) => {
          // Derive address from property or title
          const address = d.property?.street || d.title || 'Untitled Deal';

          // Derive clientName from buyer or seller
          let clientName = '';
          if (d.buyer) {
            clientName = `${d.buyer.firstName || ''} ${d.buyer.lastName || ''}`.trim();
          }
          if (!clientName && d.seller) {
            clientName = `${d.seller.firstName || ''} ${d.seller.lastName || ''}`.trim();
          }

          return {
            id: d.id,
            title: address,
            address,
            clientName: clientName || undefined,
            price: d.repc?.purchasePrice ? Number(d.repc.purchasePrice) : undefined,
            status: d.status,
            closingDate: d.repc?.settlementDeadline || undefined,
          };
        });
      setDeals(active);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    LEAD:                 { color: 'from-slate-500 to-slate-600',    label: 'Lead' },
    ACTIVE:               { color: 'from-emerald-500 to-teal-500',   label: 'Active' },
    OFFER_SENT:           { color: 'from-amber-500 to-orange-500',   label: 'Offer Sent' },
    UNDER_CONTRACT:       { color: 'from-blue-500 to-indigo-500',    label: 'Under Contract' },
    DUE_DILIGENCE:        { color: 'from-violet-500 to-purple-500',  label: 'Due Diligence' },
    FINANCING:            { color: 'from-cyan-500 to-blue-500',      label: 'Financing' },
    SETTLEMENT_SCHEDULED: { color: 'from-purple-500 to-pink-500',    label: 'Settlement' },
    CLOSED:               { color: 'from-green-600 to-emerald-600',  label: 'Closed' },
    FELL_THROUGH:         { color: 'from-red-500 to-rose-500',       label: 'Fell Through' },
  };

  const getStatusColor = (status: string) =>
    statusConfig[status]?.color || 'from-slate-500 to-slate-600';

  const getStatusLabel = (status: string) =>
    statusConfig[status]?.label || status.replace(/_/g, ' ');

  if (loading) {
    return (
      <div className="h-64 rounded-[32px] border border-white/10 bg-slate-950/40 backdrop-blur-xl flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading your deals...</div>
      </div>
    );
  }

  const totalVolume = deals.reduce((sum, deal) => sum + (deal.price || 0), 0);

  return (
    <div className="rounded-[32px] border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.60)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🏠</span> Active Deals
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {deals.length} active files • <span className="text-emerald-400 font-medium">{formatPrice(totalVolume)}</span> volume
          </p>
        </div>
        <button 
          onClick={() => navigate('/deals')}
          className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-slate-300 hover:text-white transition-all"
        >
          View Pipeline →
        </button>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-5 pb-4 min-w-min">
          {deals.length === 0 ? (
            <div className="w-full text-center py-10 text-slate-500">
              No active deals found. Start a new one!
            </div>
          ) : (
            deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => navigate(`/deals/${deal.id}`)}
                className="group relative flex-shrink-0 w-[300px] h-[180px] rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer overflow-hidden"
              >
                {/* Status Stripe */}
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${getStatusColor(deal.status)}`} />
                
                <div className="p-5 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-white/5 text-slate-300 border border-white/5`}>
                        {getStatusLabel(deal.status)}
                      </span>
                      {deal.closingDate && (
                        <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                          🗓️ {new Date(deal.closingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-lg font-bold text-white leading-tight line-clamp-2 group-hover:text-blue-300 transition-colors">
                      {deal.title}
                    </h4>
                    <p className="text-sm text-slate-400 mt-1 truncate">
                      {deal.clientName || 'No client assigned'}
                    </p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div className="text-xl font-bold text-emerald-400">
                      {formatPrice(deal.price)}
                    </div>
                    <div className="flex items-center gap-2">
                      {deal.title && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deal.title)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
                        >
                          🗺️ Map
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/deals/${deal.id}`);
                        }}
                        className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* "New Deal" Card at the end */}
          <button
            onClick={() => navigate('/deals/new')}
            className="flex-shrink-0 w-[100px] h-[180px] rounded-3xl border-2 border-dashed border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 flex flex-col items-center justify-center gap-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center transition-all text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-400 group-hover:text-blue-400">New Deal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
