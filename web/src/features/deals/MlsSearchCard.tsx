import { FormEvent, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useMlsStore } from '../mls/mlsStore';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function MlsSearchCard() {
  const [mlsInput, setMlsInput] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const { lastResult, lastQuery, loading, error, search } = useMlsStore((s) => s);

  const lastFetchTime = useMemo(() => {
    if (!lastResult) return null;
    try {
      const date = new Date(lastResult.lastFetchedAt);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [lastResult]);

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    setInfoMessage(null);
    try {
      await search(mlsInput || lastQuery || '');
      setInfoMessage('MLS data synced and ready to autofill forms.');
    } catch (err: any) {
      setInfoMessage(err?.message ?? 'Unable to sync MLS data.');
    }
  };

  const refreshDisabled = !lastQuery || loading;
  const headline = lastResult?.headline || (lastResult ? `MLS #${lastResult.mlsNumber}` : null);
  const address = useMemo(() => {
    if (!lastResult) return null;
    const parts = [lastResult.addressLine1, [lastResult.city, lastResult.state].filter(Boolean).join(', '), lastResult.zip].filter((v) => !!v && v !== ', ');
    return parts.join(' • ');
  }, [lastResult]);

  return (
    <Card className="relative overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-[#050b19]/95 via-[#061330]/90 to-[#020611]/95 text-white shadow-[0_30px_120px_rgba(2,6,23,0.8)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -right-6 w-56 h-56 bg-blue-500/30 blur-[120px]" />
        <div className="absolute -bottom-14 left-4 w-48 h-48 bg-emerald-400/20 blur-[110px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>

      <div className="relative space-y-4 p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/60">MLS Sync</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black tracking-tight">MLS# Autofill</h3>
            {lastResult ? (
              <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-400/40">
                Prefill ready
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-white/5 text-white/70 border border-white/10">
                On-demand only
              </span>
            )}
          </div>
          <p className="text-sm text-white/70 mt-2 max-w-sm">
            Pulls utahrealestate.com data only when you ask, scoped to this account. One search = one scrape, keeping everything compliant and private.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div className="relative">
            <input
              value={mlsInput}
              onChange={(e) => setMlsInput(e.target.value)}
              placeholder="Enter MLS # (ex. 1990456)"
              className="w-full rounded-[28px] border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            {lastFetchTime && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40">
                Live {lastFetchTime}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="relative flex items-center gap-3 rounded-full bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] px-6 py-2 text-sm font-semibold shadow-[0_10px_35px_rgba(37,99,235,0.45)] transition hover:translate-y-0.5 hover:shadow-[0_15px_45px_rgba(37,99,235,0.45)] disabled:opacity-60"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </span>
              {loading ? 'Syncing…' : 'Sync MLS'}
            </button>
            <Button
              type="button"
              variant="ghost"
              disabled={refreshDisabled}
              onClick={() => handleSearch()}
              className="rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-50"
            >
              Refresh
            </Button>
          </div>
        </form>

        {(infoMessage || error) && (
          <div
            className={`text-xs px-4 py-2 rounded-2xl border ${error ? 'bg-rose-500/10 border-rose-500/30 text-rose-100' : 'bg-blue-500/10 border-blue-500/20 text-blue-100'}`}
          >
            {error || infoMessage}
          </div>
        )}

        {lastResult && (
          <div className="space-y-4 border border-white/10 rounded-3xl p-4 bg-white/5">
            <div>
              <div className="text-sm font-semibold text-white leading-tight">{headline}</div>
              {address && <div className="text-xs text-slate-300/90 mt-1">{address}</div>}
              <div className="text-[11px] text-slate-500 mt-1">Synced for you • MLS #{lastResult.mlsNumber}</div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="List Price" value={lastResult.price ? currency.format(Number(lastResult.price)) : '—'} />
              <Metric label="Beds / Baths" value={formatPair(lastResult.beds, lastResult.baths)} />
              <Metric label="Square Feet" value={lastResult.squareFeet ? `${lastResult.squareFeet.toLocaleString()} ft²` : '—'} />
              <Metric label="Lot" value={lastResult.lotSize ? `${lastResult.lotSize} ac` : '—'} />
              <Metric label="Year Built" value={lastResult.yearBuilt || '—'} />
              <Metric label="Photos" value={lastResult.photos?.length ? `${lastResult.photos.length} assets` : '—'} />
            </dl>
            {lastResult.sourceUrl && (
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>MLS snapshot is cached for 6h.</span>
                <a
                  href={lastResult.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-300 hover:text-blue-100"
                >
                  View listing ↗
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-950/40 border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{label}</div>
      <div className="text-base font-semibold text-white mt-1">{value}</div>
    </div>
  );
}

function formatPair(beds: number | null, baths: number | null) {
  if (!beds && !baths) return '—';
  return `${beds ?? '—'} / ${baths ?? '—'}`;
}
