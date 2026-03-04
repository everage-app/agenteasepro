import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import api from '../../lib/api';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  stage: string;
  role: string;
  tags: string[];
  dealCount: number;
  createdAt: string;
}

interface MergeState {
  sourceId: string | null;
  targetId: string | null;
}

export function ClientsSettingsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeState, setMergeState] = useState<MergeState>({ sourceId: null, targetId: null });
  const [merging, setMerging] = useState(false);
  const [duplicates, setDuplicates] = useState<{ group: Client[]; reason: string }[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await api.get('/clients');
      // Map to include deal counts
      const clientList = res.data.map((c: any) => ({
        id: c.id,
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email,
        phone: c.phone,
        stage: c.stage,
        role: c.role || 'BUYER',
        tags: c.tags || [],
        dealCount: (c.buyerDeals?.length || 0) + (c.sellerDeals?.length || 0),
        createdAt: c.createdAt,
      }));
      setClients(clientList);
      findDuplicates(clientList);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Find potential duplicate clients
  const findDuplicates = (clientList: Client[]) => {
    const groups: { group: Client[]; reason: string }[] = [];
    const emailMap = new Map<string, Client[]>();
    const phoneMap = new Map<string, Client[]>();
    const nameMap = new Map<string, Client[]>();

    for (const client of clientList) {
      // Group by email
      if (client.email) {
        const key = client.email.toLowerCase();
        emailMap.set(key, [...(emailMap.get(key) || []), client]);
      }
      // Group by phone
      if (client.phone) {
        const key = client.phone.replace(/\D/g, '');
        if (key.length >= 10) {
          phoneMap.set(key, [...(phoneMap.get(key) || []), client]);
        }
      }
      // Group by name
      const nameKey = `${client.firstName} ${client.lastName}`.toLowerCase().trim();
      if (nameKey.length > 2) {
        nameMap.set(nameKey, [...(nameMap.get(nameKey) || []), client]);
      }
    }

    // Find groups with more than one client
    const seenIds = new Set<string>();
    emailMap.forEach((group, email) => {
      if (group.length > 1) {
        const ids = group.map(c => c.id).sort().join(',');
        if (!seenIds.has(ids)) {
          groups.push({ group, reason: `Same email: ${email}` });
          seenIds.add(ids);
        }
      }
    });
    phoneMap.forEach((group, phone) => {
      if (group.length > 1) {
        const ids = group.map(c => c.id).sort().join(',');
        if (!seenIds.has(ids)) {
          groups.push({ group, reason: `Same phone: ${phone}` });
          seenIds.add(ids);
        }
      }
    });
    nameMap.forEach((group, name) => {
      if (group.length > 1) {
        const ids = group.map(c => c.id).sort().join(',');
        if (!seenIds.has(ids)) {
          groups.push({ group, reason: `Same name: ${name}` });
          seenIds.add(ids);
        }
      }
    });

    setDuplicates(groups);
  };

  const handleSelectForMerge = (clientId: string) => {
    if (!mergeState.sourceId) {
      setMergeState({ sourceId: clientId, targetId: null });
    } else if (mergeState.sourceId === clientId) {
      setMergeState({ sourceId: null, targetId: null });
    } else {
      setMergeState({ ...mergeState, targetId: clientId });
    }
  };

  const handleMerge = async () => {
    if (!mergeState.sourceId || !mergeState.targetId) return;
    
    if (!confirm(`This will merge the selected client into the target client. All deals, tasks, and history will be transferred. This cannot be undone. Continue?`)) {
      return;
    }

    setMerging(true);
    try {
      await api.post('/clients/merge', {
        sourceId: mergeState.sourceId,
        targetId: mergeState.targetId,
      });
      setMergeState({ sourceId: null, targetId: null });
      setMergeMode(false);
      loadClients();
    } catch (error) {
      console.error('Failed to merge clients:', error);
      alert('Failed to merge clients. Please try again.');
    } finally {
      setMerging(false);
    }
  };

  const handleQuickMerge = async (sourceId: string, targetId: string) => {
    if (!confirm(`Merge duplicate client into the primary client? All deals and history will be transferred.`)) {
      return;
    }
    
    try {
      await api.post('/clients/merge', { sourceId, targetId });
      loadClients();
    } catch (error) {
      console.error('Failed to merge:', error);
      alert('Failed to merge clients.');
    }
  };

  const filteredClients = clients.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(search)
    );
  });

  const sourceClient = mergeState.sourceId ? clients.find(c => c.id === mergeState.sourceId) : null;
  const targetClient = mergeState.targetId ? clients.find(c => c.id === mergeState.targetId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Client Management</h2>
            <p className="text-sm text-slate-400">
              Manage, merge duplicates, and organize your client database
            </p>
          </div>
          <div className="flex gap-2">
            {duplicates.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                <span className="mr-2">⚠️</span>
                {duplicates.length} Potential Duplicate{duplicates.length > 1 ? 's' : ''}
              </Button>
            )}
            <Button
              variant={mergeMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setMergeMode(!mergeMode);
                setMergeState({ sourceId: null, targetId: null });
              }}
            >
              {mergeMode ? 'Cancel Merge' : 'Merge Clients'}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, email, or phone..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        {/* Merge Mode Instructions */}
        {mergeMode && (
          <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔀</span>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-300 mb-1">Merge Mode Active</h4>
                <p className="text-sm text-slate-300">
                  {!mergeState.sourceId 
                    ? '1. Click on the client you want to merge (source - will be deleted)'
                    : !mergeState.targetId 
                      ? '2. Click on the client to merge INTO (target - will keep)'
                      : '3. Review and confirm the merge below'}
                </p>
                {sourceClient && (
                  <div className="mt-2 text-sm">
                    <span className="text-slate-400">Source:</span>{' '}
                    <span className="text-white font-medium">{sourceClient.firstName} {sourceClient.lastName}</span>
                    <span className="text-red-400 ml-2">(will be deleted)</span>
                  </div>
                )}
                {targetClient && (
                  <div className="text-sm">
                    <span className="text-slate-400">Target:</span>{' '}
                    <span className="text-white font-medium">{targetClient.firstName} {targetClient.lastName}</span>
                    <span className="text-green-400 ml-2">(will keep)</span>
                  </div>
                )}
              </div>
              {mergeState.sourceId && mergeState.targetId && (
                <Button
                  size="sm"
                  onClick={handleMerge}
                  disabled={merging}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {merging ? 'Merging...' : 'Confirm Merge'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Duplicates Panel */}
      {showDuplicates && duplicates.length > 0 && (
        <Card className="p-6 border-amber-500/30 bg-amber-500/5">
          <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <span>⚠️</span> Potential Duplicates Found
          </h3>
          <div className="space-y-4">
            {duplicates.map((dup, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-900/50 border border-white/10">
                <div className="text-xs text-amber-400 mb-2 uppercase tracking-wider">{dup.reason}</div>
                <div className="flex flex-wrap gap-3">
                  {dup.group.map((client, j) => (
                    <div key={client.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {client.dealCount} deal{client.dealCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {j > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleQuickMerge(client.id, dup.group[0].id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Merge into first
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Client List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">
            All Clients <span className="text-slate-500 font-normal">({filteredClients.length})</span>
          </h3>
        </div>

        {filteredClients.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {search ? 'No clients match your search.' : 'No clients found.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => {
              const isSource = mergeState.sourceId === client.id;
              const isTarget = mergeState.targetId === client.id;
              const isSelected = isSource || isTarget;

              return (
                <div
                  key={client.id}
                  onClick={() => mergeMode && handleSelectForMerge(client.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    mergeMode ? 'cursor-pointer hover:bg-white/5' : ''
                  } ${
                    isSource 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : isTarget 
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {client.firstName?.[0]}{client.lastName?.[0]}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {client.firstName} {client.lastName}
                        </span>
                        {isSource && <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Source</Badge>}
                        {isTarget && <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Target</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        {client.email && <span>{client.email}</span>}
                        {client.phone && <span>• {client.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-slate-300">{client.dealCount} deal{client.dealCount !== 1 ? 's' : ''}</div>
                      <div className="text-xs text-slate-500">{client.stage?.replace(/_/g, ' ')}</div>
                    </div>
                    <Badge variant="info" className="text-xs">
                      {client.role}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Stats */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-white mb-4">Database Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-bold text-white">{clients.length}</div>
            <div className="text-xs text-slate-400">Total Clients</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-bold text-white">
              {clients.filter(c => c.stage === 'ACTIVE' || c.stage === 'UNDER_CONTRACT').length}
            </div>
            <div className="text-xs text-slate-400">Active</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-bold text-amber-400">{duplicates.length}</div>
            <div className="text-xs text-slate-400">Potential Duplicates</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-bold text-white">
              {clients.filter(c => c.dealCount > 0).length}
            </div>
            <div className="text-xs text-slate-400">With Deals</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
