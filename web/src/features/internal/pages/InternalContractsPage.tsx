import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

type ContractRow = {
  id: string;
  type: string;
  createdAt: string;
  dealId: string;
  dealTitle: string;
  dealStatus: string;
  agent: { name: string; email: string } | null;
  signerStats: { total: number; signed: number };
};

type ContractsResponse = {
  page: number;
  pageSize: number;
  total: number;
  contracts: ContractRow[];
};

export function InternalContractsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || '1');
  const [data, setData] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/internal/contracts', { params: { page, pageSize } });
        if (!cancelled) setData(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  return (
    <PageLayout
      title="Contracts"
      subtitle="Signature envelopes (REPC + addenda) across all agents."
      maxWidth="full"
    >
      <Card title={data ? `${data.total.toLocaleString()} envelopes` : 'Contracts'} description="Owner-only read view" hover={false}>
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
                  <th className="pb-3">Envelope</th>
                  <th className="pb-3">Deal</th>
                  <th className="pb-3">Agent</th>
                  <th className="pb-3">Signers</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{c.type}</Badge>
                        <div className="text-xs text-slate-500">{c.id.slice(0, 8)}…</div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="text-sm font-semibold text-white">{c.dealTitle}</div>
                      <div className="text-xs text-slate-400">{c.dealStatus} · {c.dealId.slice(0, 8)}…</div>
                    </td>
                    <td className="py-3">
                      <div className="text-sm text-slate-200">{c.agent?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{c.agent?.email || ''}</div>
                    </td>
                    <td className="py-3">
                      <Badge variant={c.signerStats.signed === c.signerStats.total ? 'success' : 'warning'}>
                        {c.signerStats.signed}/{c.signerStats.total}
                      </Badge>
                    </td>
                    <td className="py-3 text-sm text-slate-300">{new Date(c.createdAt).toLocaleDateString()}</td>
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
