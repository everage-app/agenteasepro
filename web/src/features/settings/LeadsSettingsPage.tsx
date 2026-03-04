import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { leadsApi } from '../../lib/leadsApi';
import { Lead } from '../../types/leads';

const ARCHIVED_TAG = 'ARCHIVED';

interface MergeState {
  sourceId: string | null;
  targetId: string | null;
}

type LeadItem = Lead;

const normalizeLeadPhone = (value?: string) => (value || '').replace(/\D/g, '');

const getLeadMergeScore = (source: LeadItem, target: LeadItem) => {
  let score = 0;
  if (source.email && target.email && source.email.toLowerCase() === target.email.toLowerCase()) score += 6;
  if (source.phone && target.phone && normalizeLeadPhone(source.phone) === normalizeLeadPhone(target.phone)) score += 5;
  if (source.firstName && target.firstName && source.firstName.toLowerCase() === target.firstName.toLowerCase()) score += 1;
  if (source.lastName && target.lastName && source.lastName.toLowerCase() === target.lastName.toLowerCase()) score += 2;
  return score;
};

const getLeadMatchReasons = (source: LeadItem, target: LeadItem) => {
  const reasons: string[] = [];
  if (source.email && target.email && source.email.toLowerCase() === target.email.toLowerCase()) {
    reasons.push('Same email');
  }
  if (source.phone && target.phone && normalizeLeadPhone(source.phone) === normalizeLeadPhone(target.phone)) {
    reasons.push('Same phone');
  }
  if (source.firstName && target.firstName && source.firstName.toLowerCase() === target.firstName.toLowerCase()) {
    reasons.push('Same first name');
  }
  if (source.lastName && target.lastName && source.lastName.toLowerCase() === target.lastName.toLowerCase()) {
    reasons.push('Same last name');
  }
  return reasons;
};

export function LeadsSettingsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeState, setMergeState] = useState<MergeState>({ sourceId: null, targetId: null });
  const [merging, setMerging] = useState(false);
  const [mergeSourceQuery, setMergeSourceQuery] = useState('');
  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [duplicates, setDuplicates] = useState<{ group: LeadItem[]; reason: string }[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const res = await leadsApi.getLeads({ archived: 'all' });
      const list = res.data || [];
      setLeads(list);
      findDuplicates(list);
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const findDuplicates = (leadList: LeadItem[]) => {
    const groups: { group: LeadItem[]; reason: string }[] = [];
    const emailMap = new Map<string, LeadItem[]>();
    const phoneMap = new Map<string, LeadItem[]>();
    const nameMap = new Map<string, LeadItem[]>();

    for (const lead of leadList) {
      if (lead.email) {
        const key = lead.email.toLowerCase();
        emailMap.set(key, [...(emailMap.get(key) || []), lead]);
      }
      if (lead.phone) {
        const key = lead.phone.replace(/\D/g, '');
        if (key) phoneMap.set(key, [...(phoneMap.get(key) || []), lead]);
      }
      const nameKey = `${lead.firstName} ${lead.lastName}`.trim().toLowerCase();
      if (nameKey) {
        nameMap.set(nameKey, [...(nameMap.get(nameKey) || []), lead]);
      }
    }

    const pushGroups = (map: Map<string, LeadItem[]>, reason: string) => {
      for (const [key, list] of map.entries()) {
        if (list.length > 1) {
          groups.push({ group: list, reason: `${reason}: ${key}` });
        }
      }
    };

    pushGroups(emailMap, 'Same email');
    pushGroups(phoneMap, 'Same phone');
    pushGroups(nameMap, 'Same name');

    setDuplicates(groups);
  };

  const handleSelectForMerge = (leadId: string) => {
    if (!mergeState.sourceId) {
      setMergeState({ sourceId: leadId, targetId: null });
    } else if (mergeState.sourceId === leadId) {
      setMergeState({ sourceId: null, targetId: null });
    } else {
      setMergeState({ ...mergeState, targetId: leadId });
    }
  };

  const handleMerge = async () => {
    if (!mergeState.sourceId || !mergeState.targetId) return;

    if (!confirm('This will merge the selected lead into the target lead. All activity, saved listings, and history will be transferred. This cannot be undone. Continue?')) {
      return;
    }

    setMerging(true);
    try {
      await leadsApi.mergeLead(mergeState.sourceId, mergeState.targetId);
      setMergeState({ sourceId: null, targetId: null });
      setMergeMode(false);
      await loadLeads();
    } catch (error) {
      console.error('Failed to merge leads:', error);
      alert('Failed to merge leads. Please try again.');
    } finally {
      setMerging(false);
    }
  };

  const handleQuickMerge = async (sourceId: string, targetId: string) => {
    if (!confirm('Merge duplicate lead into the primary lead? All activity and history will be transferred.')) {
      return;
    }

    try {
      await leadsApi.mergeLead(sourceId, targetId);
      await loadLeads();
    } catch (error) {
      console.error('Failed to merge leads:', error);
      alert('Failed to merge leads.');
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const searchLower = search.toLowerCase();
    return (
      `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.phone?.includes(search)
    );
  });

  const sourceLead = mergeState.sourceId ? leads.find((l) => l.id === mergeState.sourceId) : null;
  const targetLead = mergeState.targetId ? leads.find((l) => l.id === mergeState.targetId) : null;
  const recommendedTarget = sourceLead
    ? leads
        .filter((l) => l.id !== sourceLead.id)
        .map((lead) => ({ lead, score: getLeadMergeScore(sourceLead, lead) }))
        .sort((a, b) => b.score - a.score)
        .find((item) => item.score > 0)?.lead
    : null;
  const recommendedReasons = sourceLead && recommendedTarget
    ? getLeadMatchReasons(sourceLead, recommendedTarget)
    : [];

  useEffect(() => {
    if (!mergeMode || !sourceLead || mergeState.targetId) return;
    if (recommendedTarget && getLeadMergeScore(sourceLead, recommendedTarget) >= 6) {
      setMergeState({ sourceId: sourceLead.id, targetId: recommendedTarget.id });
    }
  }, [mergeMode, mergeState.targetId, recommendedTarget, sourceLead]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Lead Merge Tools</h2>
            <p className="text-sm text-slate-400">
              Merge duplicate leads before converting them to clients.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDuplicates((v) => !v)}
              className="bg-white/5 text-slate-200 hover:text-white"
            >
              {showDuplicates ? 'Hide duplicates' : `Show duplicates (${duplicates.length})`}
            </Button>
            <Button
              onClick={() => setMergeMode((v) => !v)}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {mergeMode ? 'Exit merge mode' : 'Merge mode'}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name, email, or phone..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50"
          />
        </div>

        {mergeMode && (
          <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔀</span>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-300 mb-1">Merge Mode Active</h4>
                <p className="text-sm text-slate-300">
                  {!mergeState.sourceId
                    ? '1. Click the lead you want to merge (source - will be deleted)'
                    : !mergeState.targetId
                      ? '2. Click the lead to merge INTO (target - will keep)'
                      : '3. Review and confirm the merge below'}
                </p>
                {sourceLead && (
                  <div className="mt-2 text-sm">
                    <span className="text-slate-400">Source:</span>{' '}
                    <span className="text-white font-medium">{sourceLead.firstName} {sourceLead.lastName}</span>
                    <span className="text-red-400 ml-2">(will be deleted)</span>
                  </div>
                )}
                {targetLead && (
                  <div className="text-sm">
                    <span className="text-slate-400">Target:</span>{' '}
                    <span className="text-white font-medium">{targetLead.firstName} {targetLead.lastName}</span>
                    <span className="text-green-400 ml-2">(will keep)</span>
                  </div>
                )}
                {recommendedTarget && !mergeState.targetId && (
                  <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-xs text-emerald-200 flex items-center justify-between">
                    <span>
                      Recommended: {recommendedTarget.firstName} {recommendedTarget.lastName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMergeState({ sourceId: mergeState.sourceId, targetId: recommendedTarget.id })}
                      className="rounded-md bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      Use
                    </button>
                  </div>
                )}
                {sourceLead && targetLead && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Merge preview</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-slate-400">Source</div>
                        <div className="text-sm text-white font-medium">{sourceLead.firstName} {sourceLead.lastName}</div>
                        <div className="text-xs text-slate-400">{sourceLead.email || sourceLead.phone || 'No contact info'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Target</div>
                        <div className="text-sm text-white font-medium">{targetLead.firstName} {targetLead.lastName}</div>
                        <div className="text-xs text-slate-400">{targetLead.email || targetLead.phone || 'No contact info'}</div>
                      </div>
                    </div>
                    {recommendedTarget && recommendedReasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recommendedReasons.map((reason) => (
                          <span key={reason} className="text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Source lead</div>
                    <input
                      value={mergeSourceQuery}
                      onChange={(e) => setMergeSourceQuery(e.target.value)}
                      placeholder="Search source lead..."
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    />
                    <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-slate-950/70">
                      {filteredLeads
                        .filter((lead) => {
                          const q = mergeSourceQuery.toLowerCase();
                          if (!q) return true;
                          return (
                            `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(q) ||
                            lead.email?.toLowerCase().includes(q) ||
                            lead.phone?.includes(mergeSourceQuery)
                          );
                        })
                        .map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => setMergeState({ sourceId: lead.id, targetId: mergeState.targetId })}
                            className={`w-full text-left px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${
                              mergeState.sourceId === lead.id
                                ? 'bg-rose-500/15 text-white'
                                : 'hover:bg-white/5 text-slate-200'
                            }`}
                          >
                            <div className="text-sm font-medium">{lead.firstName} {lead.lastName}</div>
                            <div className="text-xs text-slate-400">{lead.email || lead.phone || 'No contact info'}</div>
                          </button>
                        ))}
                      {filteredLeads.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">No leads found.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Target lead</div>
                    <input
                      value={mergeTargetQuery}
                      onChange={(e) => setMergeTargetQuery(e.target.value)}
                      placeholder="Search target lead..."
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    />
                    <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-slate-950/70">
                      {filteredLeads
                        .filter((lead) => lead.id !== mergeState.sourceId)
                        .filter((lead) => {
                          const q = mergeTargetQuery.toLowerCase();
                          if (!q) return true;
                          return (
                            `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(q) ||
                            lead.email?.toLowerCase().includes(q) ||
                            lead.phone?.includes(mergeTargetQuery)
                          );
                        })
                        .map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => setMergeState({ sourceId: mergeState.sourceId, targetId: lead.id })}
                            className={`w-full text-left px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${
                              mergeState.targetId === lead.id
                                ? 'bg-emerald-500/15 text-white'
                                : 'hover:bg-white/5 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">{lead.firstName} {lead.lastName}</div>
                              {recommendedTarget?.id === lead.id && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{lead.email || lead.phone || 'No contact info'}</div>
                          </button>
                        ))}
                      {filteredLeads.filter((lead) => lead.id !== mergeState.sourceId).length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">No eligible targets.</div>
                      )}
                    </div>
                  </div>
                </div>
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

      {showDuplicates && duplicates.length > 0 && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-white mb-4">Duplicate Leads</h3>
          <div className="space-y-4">
            {duplicates.map((dup, i) => (
              <div key={`${dup.reason}-${i}`} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs text-slate-400 mb-3">{dup.reason}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dup.group.map((lead, j) => (
                    <div key={lead.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-xs text-slate-400">{lead.email}</div>
                      </div>
                      {j > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleQuickMerge(lead.id, dup.group[0].id)}
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

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">All Leads</h3>
          <Badge variant="default" className="bg-white/10 text-slate-200 border-white/10">
            {filteredLeads.length}
          </Badge>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No leads found.</div>
        ) : (
          <div className="space-y-2">
            {filteredLeads.map((lead) => {
              const isSource = mergeState.sourceId === lead.id;
              const isTarget = mergeState.targetId === lead.id;
              const isSelected = isSource || isTarget;

              return (
                <div
                  key={lead.id}
                  onClick={() => mergeMode && handleSelectForMerge(lead.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-cyan-400/60 bg-cyan-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  } ${mergeMode ? 'cursor-pointer' : ''}`}
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {lead.firstName} {lead.lastName}
                    </div>
                    <div className="text-xs text-slate-400">{lead.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!mergeMode && (lead.phone || lead.email) && (
                      <div className="flex items-center gap-2">
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 text-[10px] font-semibold hover:bg-emerald-500/20"
                          >
                            📞 Call
                          </a>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-200 text-[10px] font-semibold hover:bg-purple-500/20"
                          >
                            ✉️ Email
                          </a>
                        )}
                      </div>
                    )}
                    <Badge variant="default" className="bg-slate-800 text-slate-300 border-slate-700 shadow-none">
                      {lead.priority}
                    </Badge>
                    {(lead.tags || []).includes(ARCHIVED_TAG) && (
                      <Badge variant="default" className="bg-rose-500/10 text-rose-300 border-rose-400/30 shadow-none">
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
