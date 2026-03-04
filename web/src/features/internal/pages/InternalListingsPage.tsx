import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

type ListingRow = {
  id: string;
  headline: string;
  status: string;
  price: number;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  createdAt: string;
  agent: { id: string; name: string; email: string };
};

type ListingsResponse = {
  page: number;
  pageSize: number;
  total: number;
  listings: ListingRow[];
};

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const statusVariants: Record<string, any> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  UNDER_CONTRACT: 'warning',
  SOLD: 'default',
  OFF_MARKET: 'danger',
};

export function InternalListingsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const page = Number(params.get('page') || '1');

  const [data, setData] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/internal/listings', { params: { q: q || undefined, status: status || undefined, page, pageSize } });
        if (!cancelled) setData(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, status, page]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  return (
    <PageLayout
      title="Listings"
      subtitle="A cross-tenant view of listing inventory and status."
      maxWidth="full"
      actions={
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              const val = e.target.value;
              if (val) next.set('status', val);
              else next.delete('status');
              next.set('page', '1');
              setParams(next);
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_CONTRACT">Under contract</option>
            <option value="SOLD">Sold</option>
            <option value="OFF_MARKET">Off market</option>
          </select>
          <input
            value={q}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              const val = e.target.value;
              if (val) next.set('q', val);
              else next.delete('q');
              next.set('page', '1');
              setParams(next);
            }}
            placeholder="Search headline, address, city…"
            className="w-[260px] max-w-[60vw] rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
      }
    >
      <Card title={data ? `${data.total.toLocaleString()} listings` : 'Listings'} description="Owner-only read view" hover={false}>
        {loading ? (
          <div className="flex items-center justify-center min-h-[260px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
          </div>
        ) : !data ? (
          <div className="text-sm text-slate-300">No data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <th className="pb-3">Listing</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Agent</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.listings.map((l) => (
                  <tr key={l.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3">
                      <div className="text-sm font-semibold text-white">{l.headline}</div>
                      <div className="text-xs text-slate-400">
                        {money(l.price)} · {l.addressLine1}, {l.city} {l.state} {l.zipCode}
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge variant={statusVariants[l.status] || 'default'}>{l.status}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="text-sm text-slate-200">{l.agent?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{l.agent?.email || ''}</div>
                    </td>
                    <td className="py-3 text-sm text-slate-300">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between mt-5">
              <div className="text-xs text-slate-500">
                Page <span className="text-slate-200 font-semibold">{data.page}</span> of <span className="text-slate-200 font-semibold">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(Math.max(1, page - 1)));
                    setParams(next);
                  }}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(Math.min(totalPages, page + 1)));
                    setParams(next);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
