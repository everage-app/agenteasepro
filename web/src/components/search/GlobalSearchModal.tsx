/**
 * GlobalSearchModal — Cmd+K / Ctrl+K command-palette style search across deals, clients & leads.
 *
 * Results are grouped by entity type with keyboard navigation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface DealResult {
  id: string;
  title: string;
  status: string;
  property?: { street?: string; city?: string; state?: string };
  buyer?: { firstName?: string; lastName?: string };
  seller?: { firstName?: string; lastName?: string };
}

interface ClientResult {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface LeadResult {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  priority?: string;
}

interface SearchResults {
  deals: DealResult[];
  clients: ClientResult[];
  leads: LeadResult[];
}

type ResultItem =
  | { kind: 'deal'; data: DealResult }
  | { kind: 'client'; data: ClientResult }
  | { kind: 'lead'; data: LeadResult };

export function GlobalSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ deals: [], clients: [], leads: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Flatten results into a single navigable list
  const flatResults: ResultItem[] = [
    ...results.deals.map(d => ({ kind: 'deal' as const, data: d })),
    ...results.clients.map(c => ({ kind: 'client' as const, data: c })),
    ...results.leads.map(l => ({ kind: 'lead' as const, data: l })),
  ];

  /* ── Keyboard listener: Ctrl+K / Cmd+K to open ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  /* ── Auto-focus input when opening ── */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ deals: [], clients: [], leads: [] });
      setSelectedIdx(0);
    }
  }, [open]);

  /* ── Debounced search ── */
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({ deals: [], clients: [], leads: [] });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await api.get('/search', { params: { q }, signal: controller.signal });
      if (!controller.signal.aborted) {
        setResults(res.data);
        setSelectedIdx(0);
      }
    } catch {
      // Ignore abort errors
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  /* ── Navigate to result ── */
  const navigateTo = (item: ResultItem) => {
    setOpen(false);
    switch (item.kind) {
      case 'deal':
        navigate(`/deals/${item.data.id}/detail`);
        break;
      case 'client':
        navigate(`/clients/${item.data.id}`);
        break;
      case 'lead':
        navigate(`/leads/${item.data.id}`);
        break;
    }
  };

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIdx]) {
      e.preventDefault();
      navigateTo(flatResults[selectedIdx]);
    }
  };

  if (!open) return null;

  const totalResults = flatResults.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <div
          className="w-full max-w-xl bg-slate-900 border border-white/15 rounded-2xl shadow-[0_25px_65px_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search deals, clients, leads…"
              className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && (
              <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            )}
            <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-white/10 bg-white/5">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">
                Type at least 2 characters to search…
              </div>
            ) : totalResults === 0 && !loading ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">
                No results found for "<span className="text-slate-300">{query}</span>"
              </div>
            ) : (
              <div className="py-2">
                {/* Deals */}
                {results.deals.length > 0 && (
                  <ResultGroup label="Deals" icon="📋">
                    {results.deals.map((deal, i) => {
                      const globalIdx = i;
                      const address = [deal.property?.street, deal.property?.city].filter(Boolean).join(', ');
                      const parties = [
                        deal.buyer ? `${deal.buyer.firstName || ''} ${deal.buyer.lastName || ''}`.trim() : '',
                        deal.seller ? `${deal.seller.firstName || ''} ${deal.seller.lastName || ''}`.trim() : '',
                      ].filter(Boolean).join(' / ');
                      return (
                        <ResultRow
                          key={deal.id}
                          selected={selectedIdx === globalIdx}
                          onClick={() => navigateTo({ kind: 'deal', data: deal })}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          title={deal.title || address || 'Untitled Deal'}
                          subtitle={[statusLabel(deal.status), parties].filter(Boolean).join(' · ')}
                          badge={deal.status}
                        />
                      );
                    })}
                  </ResultGroup>
                )}

                {/* Clients */}
                {results.clients.length > 0 && (
                  <ResultGroup label="Clients" icon="👤">
                    {results.clients.map((client, i) => {
                      const globalIdx = results.deals.length + i;
                      return (
                        <ResultRow
                          key={client.id}
                          selected={selectedIdx === globalIdx}
                          onClick={() => navigateTo({ kind: 'client', data: client })}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          title={`${client.firstName} ${client.lastName}`.trim()}
                          subtitle={[client.email, client.phone, client.role].filter(Boolean).join(' · ')}
                        />
                      );
                    })}
                  </ResultGroup>
                )}

                {/* Leads */}
                {results.leads.length > 0 && (
                  <ResultGroup label="Leads" icon="🎯">
                    {results.leads.map((lead, i) => {
                      const globalIdx = results.deals.length + results.clients.length + i;
                      return (
                        <ResultRow
                          key={lead.id}
                          selected={selectedIdx === globalIdx}
                          onClick={() => navigateTo({ kind: 'lead', data: lead })}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          title={`${lead.firstName} ${lead.lastName}`.trim()}
                          subtitle={[lead.source, lead.email, lead.priority].filter(Boolean).join(' · ')}
                        />
                      );
                    })}
                  </ResultGroup>
                )}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/10 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[10px]">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[10px]">↓</kbd> navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[10px]">↵</kbd> open
              </span>
            </div>
            {totalResults > 0 && <span>{totalResults} result{totalResults !== 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function ResultGroup({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
        <span>{icon}</span> {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  selected,
  onClick,
  onMouseEnter,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center justify-between px-5 py-2.5 text-left transition-colors ${
        selected ? 'bg-cyan-500/10 text-cyan-200' : 'text-slate-200 hover:bg-white/5'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm truncate">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      {badge && (
        <span className="ml-3 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-slate-400">
          {statusLabel(badge)}
        </span>
      )}
    </button>
  );
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
