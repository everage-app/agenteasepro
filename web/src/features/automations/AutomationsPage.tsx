import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../../components/ui/Card';
import api from '../../lib/api';

interface AutomationRule {
  id: string;
  name: string;
  eventType: string;
  isEnabled: boolean;
  config: any;
  createdAt: string;
  updatedAt: string;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  LISTING_CREATED: {
    label: 'Listing Created',
    color: 'from-emerald-500/20 to-green-500/10 border-emerald-400/30 text-emerald-200',
    icon: '🏠',
  },
  DEAL_CREATED: {
    label: 'Deal Created',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-400/30 text-blue-200',
    icon: '📋',
  },
  MARKETING_BLAST_SENT: {
    label: 'Marketing Blast Sent',
    color: 'from-violet-500/20 to-purple-500/10 border-violet-400/30 text-violet-200',
    icon: '📧',
  },
  CLIENT_STAGE_CHANGED: {
    label: 'Client Stage Changed',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-400/30 text-amber-200',
    icon: '👤',
  },
};

export function AutomationsPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<'ALL' | string>('ALL');
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [activePlaybookKey, setActivePlaybookKey] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const res = await api.get('/automations');
      setRules(res.data);
    } catch (error) {
      console.error('Failed to load automation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultRules = async () => {
    try {
      setSeeding(true);
      const res = await api.post('/automations/seed');
      setRules(res.data);
    } catch (error) {
      console.error('Failed to seed automation rules:', error);
    } finally {
      setSeeding(false);
    }
  };

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      const res = await api.patch(`/automations/${ruleId}/toggle`, {
        isEnabled: !currentEnabled,
      });
      setRules(rules.map(r => (r.id === ruleId ? res.data : r)));
    } catch (error) {
      console.error('Failed to toggle automation rule:', error);
    }
  };

  const setRulesEnabled = async (targetRules: AutomationRule[], enabled: boolean) => {
    const toUpdate = targetRules.filter((r) => r.isEnabled !== enabled);
    if (toUpdate.length === 0) return;
    try {
      setBulkUpdating(true);
      const updates = await Promise.all(
        toUpdate.map((r) => api.patch(`/automations/${r.id}/toggle`, { isEnabled: enabled })),
      );
      const updatedMap = new Map(updates.map((res: any) => [res.data.id, res.data]));
      setRules((prev) => prev.map((r) => updatedMap.get(r.id) || r));
    } catch (error) {
      console.error('Failed to update automation rules:', error);
    } finally {
      setBulkUpdating(false);
    }
  };

  const summarizeAction = (action: any) => {
    if (!action) return 'Action';
    switch (action.action) {
      case 'CREATE_TASKS':
        return `Create tasks (${action.template || 'template'})`;
      case 'CREATE_TASKS_FROM_AI':
        return 'AI-generated task plan';
      case 'SCHEDULE_DEAL_TASKS':
        return action.useKeyDates ? 'Schedule deal key dates' : 'Schedule deal tasks';
      case 'CREATE_REFERRAL_TOUCH_SEQUENCE':
        return `Referral touch sequence (${action.sequenceType || 'custom'})`;
      case 'INCREMENT_METRICS':
        return `Update metrics (${action.kind || 'tracking'})`;
      default:
        return action.action || 'Automation action';
    }
  };

  const rulesStats = useMemo(() => {
    const total = rules.length;
    const enabled = rules.filter((r) => r.isEnabled).length;
    const aiPowered = rules.filter((r) => r.config?.actions?.some((a: any) => a.useAI || a.action === 'CREATE_TASKS_FROM_AI')).length;
    const coverage = new Set(rules.map((r) => r.eventType)).size;
    return { total, enabled, aiPowered, coverage };
  }, [rules]);

  const filteredRules = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return rules.filter((rule) => {
      if (eventFilter !== 'ALL' && rule.eventType !== eventFilter) return false;
      if (showEnabledOnly && !rule.isEnabled) return false;
      if (!normalized) return true;
      const nameMatch = rule.name.toLowerCase().includes(normalized);
      const actionMatch = (rule.config?.actions || [])
        .map((a: any) => summarizeAction(a).toLowerCase())
        .some((txt: string) => txt.includes(normalized));
      return nameMatch || actionMatch;
    });
  }, [eventFilter, rules, searchTerm, showEnabledOnly]);

  const groupedRules = filteredRules.reduce((acc, rule) => {
    if (!acc[rule.eventType]) {
      acc[rule.eventType] = [];
    }
    acc[rule.eventType].push(rule);
    return acc;
  }, {} as Record<string, AutomationRule[]>);

  const playbooks = [
    {
      key: 'listing-launch',
      title: 'Listing Launch Engine',
      description: 'Auto-build a listing marketing checklist the moment you add a listing.',
      icon: '🏠',
      eventTypes: ['LISTING_CREATED'],
    },
    {
      key: 'deal-deadlines',
      title: 'Deal Deadline Guardian',
      description: 'Create key-date tasks instantly when a deal or REPC is created.',
      icon: '📋',
      eventTypes: ['DEAL_CREATED'],
    },
    {
      key: 'blast-followup',
      title: 'Blast Follow-Up Sprint',
      description: 'Trigger follow-up tasks after every marketing blast sends.',
      icon: '📧',
      eventTypes: ['MARKETING_BLAST_SENT'],
    },
    {
      key: 'client-nurture',
      title: 'Client Nurture Flow',
      description: 'Launch referral sequences when clients move to past client.',
      icon: '👤',
      eventTypes: ['CLIENT_STAGE_CHANGED'],
    },
    {
      key: 'ai-boost',
      title: 'AI Boost Pack',
      description: 'Enable AI-augmented automations for richer, smarter tasks.',
      icon: '✨',
      eventTypes: ['LISTING_CREATED', 'DEAL_CREATED'],
      isAI: true,
    },
  ];

  const getPlaybookRules = (playbook: typeof playbooks[number]) => {
    if (playbook.isAI) {
      return rules.filter((r) => r.config?.actions?.some((a: any) => a.useAI || a.action === 'CREATE_TASKS_FROM_AI'));
    }
    return rules.filter((r) => playbook.eventTypes.includes(r.eventType));
  };

  const playbookStats = useMemo(() => {
    return playbooks.map((playbook) => {
      const playbookRules = getPlaybookRules(playbook);
      const enabledCount = playbookRules.filter((r) => r.isEnabled).length;
      return {
        key: playbook.key,
        total: playbookRules.length,
        enabled: enabledCount,
        isActive: playbookRules.length > 0 && enabledCount === playbookRules.length,
        isPartial: enabledCount > 0 && enabledCount < playbookRules.length,
        rules: playbookRules,
      };
    });
  }, [playbooks, rules]);

  const nurtureStats = playbookStats.find((p) => p.key === 'client-nurture');
  const nurtureRules = nurtureStats?.rules || [];

  const openPlaybook = (key: string) => {
    setActivePlaybookKey(key);
  };

  const closePlaybook = () => {
    setActivePlaybookKey(null);
  };

  if (loading) {
    return (
      <PageLayout title="Automations & Workflows" subtitle="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-400">Loading automations...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Automations & Workflows"
      subtitle="Automate repetitive tasks when key events happen in your business"
    >
      <div className="space-y-6">
        <Card className="p-6 bg-white/90 dark:bg-gradient-to-br dark:from-slate-900/70 dark:via-slate-950/90 dark:to-slate-950 border border-slate-200/70 dark:border-white/10 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Automation Command Center</div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">Make every lead feel followed up — automatically</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                Turn key events into smart task workflows, marketing nudges, and client sequences. Flip on the playbooks
                below to keep deals moving without extra clicks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={seedDefaultRules}
                disabled={seeding || bulkUpdating}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {seeding ? 'Creating defaults…' : 'Create default automations'}
              </button>
              <button
                onClick={() => setRulesEnabled(rules, true)}
                disabled={bulkUpdating || rules.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-200 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                Enable all
              </button>
              <button
                onClick={() => setRulesEnabled(rules, false)}
                disabled={bulkUpdating || rules.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white transition-colors disabled:opacity-50"
              >
                Disable all
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Rules</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">{rulesStats.total}</div>
              <div className="text-xs text-slate-500 mt-1">Total workflows</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-500">Enabled</div>
              <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-200 mt-2">{rulesStats.enabled}</div>
              <div className="text-xs text-emerald-600/80 dark:text-emerald-200/70 mt-1">Active automations</div>
            </div>
            <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-purple-500">AI Boosts</div>
              <div className="text-2xl font-semibold text-purple-700 dark:text-purple-200 mt-2">{rulesStats.aiPowered}</div>
              <div className="text-xs text-purple-600/80 dark:text-purple-200/70 mt-1">AI-enhanced rules</div>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-500">Coverage</div>
              <div className="text-2xl font-semibold text-cyan-700 dark:text-cyan-200 mt-2">{rulesStats.coverage}</div>
              <div className="text-xs text-cyan-600/80 dark:text-cyan-200/70 mt-1">Event types automated</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-amber-500">Nurture sequences</div>
                <div className="text-sm text-amber-100">Keep past clients warm with automated touch plans.</div>
                <div className="text-[11px] text-amber-200/80 mt-1">
                  {nurtureStats?.enabled || 0} of {nurtureStats?.total || 0} nurture rules enabled
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRulesEnabled(nurtureRules, true)}
                  disabled={bulkUpdating || nurtureRules.length === 0}
                  className="rounded-full border border-amber-400/40 bg-amber-500/20 px-4 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                >
                  Enable nurture
                </button>
                <button
                  onClick={() => setRulesEnabled(nurtureRules, false)}
                  disabled={bulkUpdating || nurtureRules.length === 0}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/20 disabled:opacity-50"
                >
                  Pause nurture
                </button>
                <button
                  onClick={() => openPlaybook('client-nurture')}
                  className="rounded-full border border-amber-300/40 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20"
                >
                  Review playbook
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/tasks')}
              className="px-4 py-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 hover:bg-white"
            >
              View task backlog
            </button>
            <button
              onClick={() => navigate('/marketing')}
              className="px-4 py-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 hover:bg-white"
            >
              Open marketing blasts
            </button>
            <button
              onClick={() => navigate('/settings/integrations')}
              className="px-4 py-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 hover:bg-white"
            >
              Connect integrations
            </button>
            <button
              onClick={() => navigate('/calendar')}
              className="px-4 py-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 hover:bg-white"
            >
              Review calendar
            </button>
          </div>
        </Card>

        <Card className="p-6 bg-white/95 dark:bg-slate-950/60 border border-slate-200/70 dark:border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Automation playbooks</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Turn on curated workflows built from what you already use.</p>
            </div>
            <button
              onClick={() => setRulesEnabled(rules.filter((r) => r.config?.actions?.some((a: any) => a.useAI)), true)}
              disabled={bulkUpdating}
              className="px-4 py-2 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-700 dark:text-purple-200 text-xs hover:bg-purple-500/20"
            >
              Enable AI playbooks
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            {playbooks.map((playbook) => (
              <div key={playbook.key} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{playbook.icon}</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{playbook.title}</div>
                      {playbookStats.find((p) => p.key === playbook.key)?.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200">Active</span>
                      )}
                      {playbookStats.find((p) => p.key === playbook.key)?.isPartial && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-200">Partial</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{playbook.description}</div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      {playbookStats.find((p) => p.key === playbook.key)?.enabled || 0} of{' '}
                      {playbookStats.find((p) => p.key === playbook.key)?.total || 0} rules enabled
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => {
                        const stats = playbookStats.find((p) => p.key === playbook.key);
                        if (!stats) return;
                        setRulesEnabled(stats.rules, !stats.isActive);
                      }}
                      disabled={bulkUpdating || rules.length === 0}
                      className="px-3 py-1.5 rounded-full text-xs border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:bg-white"
                    >
                      {(() => {
                        const stats = playbookStats.find((p) => p.key === playbook.key);
                        if (!stats) return 'Activate';
                        if (stats.isActive) return 'Deactivate';
                        if (stats.isPartial) return 'Finish';
                        return 'Activate';
                      })()}
                    </button>
                    <button
                      onClick={() => openPlaybook(playbook.key)}
                      className="px-3 py-1.5 rounded-full text-xs border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-white"
                    >
                      Customize
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-white/95 dark:bg-slate-950/60 border border-slate-200/70 dark:border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Filter & focus</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Find the exact automation rule you need in seconds.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search rules or actions"
                className="w-full sm:w-64 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 px-4 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="rounded-full border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 px-4 py-2 text-sm text-slate-800 dark:text-white focus:outline-none"
              >
                <option value="ALL">All events</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowEnabledOnly((prev) => !prev)}
                className={`rounded-full px-4 py-2 text-sm border transition ${
                  showEnabledOnly
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                    : 'border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200'
                }`}
              >
                {showEnabledOnly ? 'Enabled only' : 'All rules'}
              </button>
            </div>
          </div>
        </Card>

        {/* Empty state - no rules */}
        {rules.length === 0 && (
          <Card className="text-center py-12">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold text-slate-50 mb-2">
              No automation rules configured
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Create default automation workflows to auto-create tasks when you add listings,
              close deals, send blasts, or change client stages.
            </p>
            <button
              onClick={seedDefaultRules}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {seeding ? (
                <>Creating default rules...</>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Create Default Automations
                </>
              )}
            </button>
          </Card>
        )}

        {/* Rules grouped by event type */}
        {rules.length > 0 && (
          <div className="space-y-6">
            {filteredRules.length === 0 && (
              <Card className="p-8 text-center border border-white/10 bg-slate-950/70">
                <div className="text-lg font-semibold text-white">No rules match your filters</div>
                <p className="text-sm text-slate-400 mt-2">Try clearing filters or search terms to see all automations.</p>
              </Card>
            )}
            {Object.entries(groupedRules).map(([eventType, eventRules]) => {
              const eventConfig = EVENT_TYPE_LABELS[eventType] || {
                label: eventType,
                color: 'from-slate-500/20 to-slate-500/10 border-slate-400/30 text-slate-200',
                icon: '⚙️',
              };

              return (
                <div key={eventType}>
                  {/* Event type header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${eventConfig.color} border text-2xl`}
                      >
                        {eventConfig.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-50">{eventConfig.label}</h2>
                        <p className="text-xs text-slate-400">
                          {eventRules.length} {eventRules.length === 1 ? 'rule' : 'rules'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRulesEnabled(eventRules, true)}
                        disabled={bulkUpdating}
                        className="px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-xs text-emerald-200"
                      >
                        Enable all
                      </button>
                      <button
                        onClick={() => setRulesEnabled(eventRules, false)}
                        disabled={bulkUpdating}
                        className="px-3 py-1.5 rounded-full border border-white/10 bg-slate-900/60 text-xs text-slate-200"
                      >
                        Disable all
                      </button>
                    </div>
                  </div>

                  {/* Rules for this event type */}
                  <div className="space-y-3">
                    {eventRules.map(rule => (
                      <Card key={rule.id} className="p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-base font-medium text-slate-50">{rule.name}</h3>
                              {rule.config?.actions?.some((a: any) => a.useAI || a.action === 'CREATE_TASKS_FROM_AI') && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-200 border border-purple-400/30">
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                  </svg>
                                  AI-Powered
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
                                  rule.isEnabled
                                    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                                    : 'bg-white/5 text-slate-400 border-white/10'
                                }`}
                              >
                                {rule.isEnabled ? 'Active' : 'Paused'}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                              {rule.config?.actions?.length || 0}{' '}
                              {rule.config?.actions?.length === 1 ? 'action' : 'actions'} configured
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(rule.config?.actions || []).map((action: any, index: number) => (
                                <span key={`${rule.id}-action-${index}`} className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-slate-900/60 text-slate-300">
                                  {summarizeAction(action)}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Toggle switch */}
                          <button
                            onClick={() => toggleRule(rule.id, rule.isEnabled)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                              rule.isEnabled ? 'bg-blue-600' : 'bg-slate-700'
                            }`}
                            role="switch"
                            aria-checked={rule.isEnabled}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                rule.isEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Info card about AI features */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-400/30 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-2xl">
                  🤖
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-purple-200">
                    AI-Powered Task Suggestions
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Rules marked with "AI-Powered" use OpenAI to generate smart, context-aware tasks
                    based on your listings and deals. To enable AI features, add your{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800/50 text-purple-300">
                      OPENAI_API_KEY
                    </code>{' '}
                    to your environment variables.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
      {activePlaybookKey && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={closePlaybook} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 text-slate-900 dark:text-white shadow-2xl overflow-hidden">
              {(() => {
                const playbook = playbooks.find((p) => p.key === activePlaybookKey);
                const stats = playbookStats.find((p) => p.key === activePlaybookKey);
                if (!playbook || !stats) return null;
                return (
                  <div>
                    <div className="px-6 pt-6 pb-4 border-b border-slate-200/60 dark:border-white/10 bg-gradient-to-br from-slate-50/70 via-white/90 to-slate-50/70 dark:from-slate-950/80 dark:via-slate-950/95 dark:to-slate-900/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-2xl">
                            {playbook.icon}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Playbook</div>
                            <div className="text-xl font-semibold mt-2 text-slate-900 dark:text-white">{playbook.title}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-300 mt-2">{playbook.description}</div>
                            <div className="text-xs text-slate-400 mt-2">
                              Tailor how and when the automation fires by toggling individual rules below.
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={closePlaybook}
                          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Rules</div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white mt-1">{stats.total}</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Active</div>
                          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-200 mt-1">{stats.enabled}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Coverage</div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white mt-1">{Math.round((stats.enabled / Math.max(stats.total, 1)) * 100)}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">Included rules</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Toggle individual steps to match your workflow.</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRulesEnabled(stats.rules, true)}
                            disabled={bulkUpdating}
                            className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-600 dark:text-emerald-200"
                          >
                            Enable all
                          </button>
                          <button
                            onClick={() => setRulesEnabled(stats.rules, false)}
                            disabled={bulkUpdating}
                            className="px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs text-slate-600 dark:text-slate-200"
                          >
                            Disable all
                          </button>
                        </div>
                      </div>

                      {stats.rules.length === 0 ? (
                        <Card className="p-4 border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5">
                          <div className="text-sm text-slate-600 dark:text-slate-300">No rules exist for this playbook yet.</div>
                          <div className="text-xs text-slate-400 mt-1">Create default automations to populate this playbook.</div>
                        </Card>
                      ) : (
                        <div className="grid gap-3">
                          {stats.rules.map((rule) => (
                            <Card key={rule.id} className="p-4 bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{rule.name}</div>
                                    {rule.config?.actions?.some((a: any) => a.useAI || a.action === 'CREATE_TASKS_FROM_AI') && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-400/30 bg-purple-500/10 text-purple-200">AI</span>
                                    )}
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                        rule.isEnabled
                                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200'
                                          : 'border-slate-200/60 bg-slate-100/70 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
                                      }`}
                                    >
                                      {rule.isEnabled ? 'Active' : 'Paused'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {rule.config?.actions?.length || 0} actions · Event {EVENT_TYPE_LABELS[rule.eventType]?.label || rule.eventType}
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {(rule.config?.actions || []).map((action: any, idx: number) => (
                                      <span key={`${rule.id}-pb-${idx}`} className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-950/70 text-slate-600 dark:text-slate-300">
                                        {summarizeAction(action)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => toggleRule(rule.id, rule.isEnabled)}
                                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-950 ${
                                    rule.isEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                  role="switch"
                                  aria-checked={rule.isEnabled}
                                >
                                  <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                      rule.isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => navigate('/settings/automations')}
                          className="px-4 py-2 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200"
                        >
                          Configure defaults
                        </button>
                        <button
                          onClick={() => setRulesEnabled(stats.rules, true)}
                          disabled={bulkUpdating}
                          className="px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-sm text-emerald-600 dark:text-emerald-200"
                        >
                          Enable all in playbook
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
