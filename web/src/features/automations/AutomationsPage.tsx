import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Home,
  Mail,
  Megaphone,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  Plus,
  Radar,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';
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

type PlaybookTone = 'emerald' | 'gold' | 'cyan' | 'violet' | 'rose';

interface Playbook {
  key: string;
  title: string;
  promise: string;
  agentWin: string;
  story: {
    trigger: string;
    creates: string[];
    agentSees: string;
    outcome: string;
  };
  eventTypes: string[];
  icon: LucideIcon;
  tone: PlaybookTone;
  isAI?: boolean;
  steps: string[];
}

const EVENT_TYPE_LABELS: Record<string, { label: string; icon: LucideIcon; detail: string }> = {
  LISTING_CREATED: {
    label: 'Listing Launch',
    icon: Home,
    detail: 'New listing added',
  },
  DEAL_CREATED: {
    label: 'Deal & Contract',
    icon: FileText,
    detail: 'Deal or REPC started',
  },
  MARKETING_BLAST_SENT: {
    label: 'Marketing Follow-Up',
    icon: Megaphone,
    detail: 'Campaign sent',
  },
  CLIENT_STAGE_CHANGED: {
    label: 'Client Nurture',
    icon: UserRound,
    detail: 'Client stage changed',
  },
};

const PLAYBOOKS: Playbook[] = [
  {
    key: 'listing-launch',
    title: 'Listing Launch Engine',
    promise: 'From listing input to market-ready checklist.',
    agentWin: 'Never forget photos, seller updates, launch posts, open house prep, or blast follow-up.',
    story: {
      trigger: 'You add a listing or publish a listing workspace.',
      creates: ['Launch checklist', 'Seller update reminder', 'Marketing prep tasks', 'Open house follow-up'],
      agentSees: 'A ready-made launch plan in Tasks with the next most important item surfaced first.',
      outcome: 'The listing hits the market cleanly, the seller feels informed, and follow-up does not depend on memory.',
    },
    eventTypes: ['LISTING_CREATED'],
    icon: Home,
    tone: 'emerald',
    steps: ['Launch checklist', 'Seller update task', 'Marketing prep', 'Open house follow-up'],
  },
  {
    key: 'deal-deadlines',
    title: 'Contract Deadline Guardian',
    promise: 'Every new deal gets a protection plan.',
    agentWin: 'Creates critical date reminders, client updates, and transaction tasks from the contract flow.',
    story: {
      trigger: 'You create a deal, start a REPC, or add key contract dates.',
      creates: ['Due diligence reminder', 'Financing deadline task', 'Appraisal checkpoint', 'Settlement prep'],
      agentSees: 'Contract-critical tasks land in the right order so the next deadline is obvious.',
      outcome: 'Fewer missed dates, fewer emergency texts, and a transaction that feels professionally controlled.',
    },
    eventTypes: ['DEAL_CREATED'],
    icon: ShieldCheck,
    tone: 'gold',
    steps: ['Due diligence', 'Financing', 'Appraisal', 'Settlement prep'],
  },
  {
    key: 'blast-followup',
    title: 'Campaign Follow-Up Sprint',
    promise: 'Turn marketing sends into conversations.',
    agentWin: 'Prompts you to call hot contacts, follow up with clicks, and log next actions after each blast.',
    story: {
      trigger: 'You send a listing, sphere, open-house, or market-update blast.',
      creates: ['Engaged contact follow-up', 'Sphere call reminders', 'Listing feedback prompt', 'Next campaign idea'],
      agentSees: 'A focused follow-up list instead of a sent campaign that quietly disappears.',
      outcome: 'Marketing turns into appointments, conversations, and proof that outreach is working.',
    },
    eventTypes: ['MARKETING_BLAST_SENT'],
    icon: Mail,
    tone: 'cyan',
    steps: ['Engaged leads', 'Sphere follow-up', 'Listing feedback', 'Next blast idea'],
  },
  {
    key: 'client-nurture',
    title: 'Past Client Referral Flow',
    promise: 'Stay remembered after closing.',
    agentWin: 'Queues thoughtful touchpoints so past clients keep sending referrals without you rebuilding the plan.',
    story: {
      trigger: 'A client moves into a past-client or referral nurture stage.',
      creates: ['Thank-you touch', 'Home anniversary reminder', 'Referral ask', 'Market check-in'],
      agentSees: 'Warm, timely follow-up prompts that feel personal instead of random.',
      outcome: 'Past clients hear from you at the right time and are more likely to send the next referral.',
    },
    eventTypes: ['CLIENT_STAGE_CHANGED'],
    icon: MessageSquareText,
    tone: 'rose',
    steps: ['Thank-you touch', 'Home anniversary', 'Referral ask', 'Market check-in'],
  },
  {
    key: 'ai-boost',
    title: 'AI Task Co-Pilot',
    promise: 'Context-aware tasks without blank-page planning.',
    agentWin: 'Uses AI-backed rules to suggest richer next steps for listings, deals, and follow-up moments.',
    story: {
      trigger: 'A listing, deal, or important workflow moment has enough context for smarter planning.',
      creates: ['AI task plan', 'Prioritized next action', 'Context-aware checklist', 'Follow-up suggestions'],
      agentSees: 'Useful next steps written around the actual deal, listing, or client moment.',
      outcome: 'Less planning from scratch and more confidence that the right work is being prompted.',
    },
    eventTypes: ['LISTING_CREATED', 'DEAL_CREATED'],
    icon: Sparkles,
    tone: 'violet',
    isAI: true,
    steps: ['Smart task plan', 'Listing context', 'Deal context', 'Prioritized next move'],
  },
];

const toneClasses: Record<PlaybookTone, string> = {
  emerald: 'automation-tone-emerald',
  gold: 'automation-tone-gold',
  cyan: 'automation-tone-cyan',
  violet: 'automation-tone-violet',
  rose: 'automation-tone-rose',
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
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [selectedSetupKeys, setSelectedSetupKeys] = useState<string[]>(PLAYBOOKS.map((playbook) => playbook.key));

  useEffect(() => {
    void loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const res = await api.get('/automations');
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load automation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultRules = async (): Promise<AutomationRule[] | null> => {
    try {
      setSeeding(true);
      const res = await api.post('/automations/seed');
      const nextRules = Array.isArray(res.data) ? res.data : [];
      setRules(nextRules);
      return nextRules;
    } catch (error) {
      console.error('Failed to seed automation rules:', error);
      return null;
    } finally {
      setSeeding(false);
    }
  };

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      const res = await api.patch(`/automations/${ruleId}/toggle`, {
        isEnabled: !currentEnabled,
      });
      setRules((prev) => prev.map((rule) => (rule.id === ruleId ? res.data : rule)));
    } catch (error) {
      console.error('Failed to toggle automation rule:', error);
    }
  };

  const setRulesEnabled = async (targetRules: AutomationRule[], enabled: boolean) => {
    const toUpdate = targetRules.filter((rule) => rule.isEnabled !== enabled);
    if (toUpdate.length === 0) return;
    try {
      setBulkUpdating(true);
      const updates = await Promise.all(
        toUpdate.map((rule) => api.patch(`/automations/${rule.id}/toggle`, { isEnabled: enabled })),
      );
      const updatedMap = new Map(updates.map((res: any) => [res.data.id, res.data]));
      setRules((prev) => prev.map((rule) => updatedMap.get(rule.id) || rule));
    } catch (error) {
      console.error('Failed to update automation rules:', error);
    } finally {
      setBulkUpdating(false);
    }
  };

  const summarizeAction = (action: any) => {
    if (!action) return 'Automation action';
    switch (action.action) {
      case 'CREATE_TASKS':
        return `Create tasks: ${action.template || 'template'}`;
      case 'CREATE_TASKS_FROM_AI':
        return 'AI task plan';
      case 'SCHEDULE_DEAL_TASKS':
        return action.useKeyDates ? 'Schedule contract key dates' : 'Schedule deal tasks';
      case 'CREATE_REFERRAL_TOUCH_SEQUENCE':
        return `Referral sequence: ${action.sequenceType || 'custom'}`;
      case 'INCREMENT_METRICS':
        return `Update metrics: ${action.kind || 'tracking'}`;
      default:
        return action.action || 'Automation action';
    }
  };

  const getPlaybookRulesFrom = (playbook: Playbook, sourceRules: AutomationRule[]) => {
    if (playbook.isAI) {
      return sourceRules.filter((rule) =>
        rule.config?.actions?.some((action: any) => action.useAI || action.action === 'CREATE_TASKS_FROM_AI'),
      );
    }
    return sourceRules.filter((rule) => playbook.eventTypes.includes(rule.eventType));
  };

  const getPlaybookRules = (playbook: Playbook) => {
    return getPlaybookRulesFrom(playbook, rules);
  };

  const stats = useMemo(() => {
    const total = rules.length;
    const enabled = rules.filter((rule) => rule.isEnabled).length;
    const aiPowered = rules.filter((rule) =>
      rule.config?.actions?.some((action: any) => action.useAI || action.action === 'CREATE_TASKS_FROM_AI'),
    ).length;
    const coverage = new Set(rules.map((rule) => rule.eventType)).size;
    const actions = rules.reduce((sum, rule) => sum + (rule.config?.actions?.length || 0), 0);
    return {
      total,
      enabled,
      aiPowered,
      coverage,
      actions,
      readiness: total ? Math.round((enabled / total) * 100) : 0,
    };
  }, [rules]);

  const playbookStats = useMemo(() => {
    return PLAYBOOKS.map((playbook) => {
      const playbookRules = getPlaybookRules(playbook);
      const enabled = playbookRules.filter((rule) => rule.isEnabled).length;
      return {
        ...playbook,
        rules: playbookRules,
        total: playbookRules.length,
        enabled,
        isActive: playbookRules.length > 0 && enabled === playbookRules.length,
        isPartial: enabled > 0 && enabled < playbookRules.length,
      };
    });
  }, [rules]);

  const filteredRules = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return rules.filter((rule) => {
      if (eventFilter !== 'ALL' && rule.eventType !== eventFilter) return false;
      if (showEnabledOnly && !rule.isEnabled) return false;
      if (!normalized) return true;
      const actionText = (rule.config?.actions || []).map((action: any) => summarizeAction(action)).join(' ');
      return `${rule.name} ${rule.eventType} ${actionText}`.toLowerCase().includes(normalized);
    });
  }, [eventFilter, rules, searchTerm, showEnabledOnly]);

  const groupedRules = useMemo(() => {
    return filteredRules.reduce((acc, rule) => {
      if (!acc[rule.eventType]) acc[rule.eventType] = [];
      acc[rule.eventType].push(rule);
      return acc;
    }, {} as Record<string, AutomationRule[]>);
  }, [filteredRules]);

  const nextBestActions = useMemo(() => {
    if (rules.length === 0) {
      return [
        { label: 'Create the default agent playbooks', action: () => setSetupModalOpen(true), icon: Plus, disabled: seeding },
        { label: 'Connect integrations', action: () => navigate('/settings/integrations'), icon: Settings },
        { label: 'Review task workspace', action: () => navigate('/tasks'), icon: CheckCircle2 },
      ];
    }
    const inactivePlaybook = playbookStats.find((playbook) => !playbook.isActive && playbook.total > 0);
    return [
      {
        label: inactivePlaybook ? `Activate ${inactivePlaybook.title}` : 'Review active task backlog',
        action: () =>
          inactivePlaybook
            ? setRulesEnabled(inactivePlaybook.rules, true)
            : navigate('/tasks'),
        icon: inactivePlaybook ? PlayCircle : CheckCircle2,
        disabled: bulkUpdating,
      },
      { label: 'Open marketing hub', action: () => navigate('/marketing'), icon: Megaphone },
      { label: 'Tune advanced settings', action: () => navigate('/settings/automations'), icon: Settings },
    ];
  }, [bulkUpdating, navigate, playbookStats, rules.length, seeding]);

  const activePlaybook = activePlaybookKey
    ? playbookStats.find((playbook) => playbook.key === activePlaybookKey)
    : null;

  const openSetupModal = (playbookKey?: string) => {
    if (playbookKey) {
      setSelectedSetupKeys([playbookKey]);
    } else {
      setSelectedSetupKeys(PLAYBOOKS.map((playbook) => playbook.key));
    }
    setSetupModalOpen(true);
  };

  const runSetup = async () => {
    const sourceRules = rules.length > 0 ? rules : await seedDefaultRules();
    if (!sourceRules) return;

    const selectedRules = PLAYBOOKS
      .filter((playbook) => selectedSetupKeys.includes(playbook.key))
      .flatMap((playbook) => getPlaybookRulesFrom(playbook, sourceRules));

    const uniqueRules = Array.from(new Map(selectedRules.map((rule) => [rule.id, rule])).values());
    await setRulesEnabled(uniqueRules, true);
    await loadRules();
    setSetupModalOpen(false);
  };

  if (loading) {
    return (
      <PageLayout title="Automations" subtitle="Loading agent playbooks..." maxWidth="workspace">
        <div className="automation-loading">
          <Zap className="h-5 w-5 animate-pulse text-[#f2d894]" />
          <span>Loading automation command center...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Automations"
      subtitle="Simple real estate playbooks that turn listings, deals, campaigns, and client changes into the next right action."
      maxWidth="workspace"
    >
      <div className="automation-page space-y-6">
        <section className="automation-hero">
          <div className="automation-hero-main">
            <div className="automation-eyebrow">
              <Radar className="h-4 w-4" />
              Agent autopilot
            </div>
            <h2>Run the busywork before it becomes busywork.</h2>
            <p>
              AgentEasePro watches the moments agents miss most: listing launch, REPC deadlines,
              blast follow-up, and past-client nurture. Turn on a playbook once, then let the
              workspace create the right task at the right time.
            </p>
            <div className="automation-hero-actions">
              <button className="automation-primary-btn" onClick={() => openSetupModal()} disabled={seeding || bulkUpdating}>
                <Zap className="h-4 w-4" />
                {seeding ? 'Building playbooks...' : rules.length ? 'Setup automation packs' : 'Create default playbooks'}
              </button>
              <button className="automation-secondary-btn" onClick={() => setRulesEnabled(rules, true)} disabled={bulkUpdating || rules.length === 0}>
                <PlayCircle className="h-4 w-4" />
                Enable all
              </button>
              <button className="automation-ghost-btn" onClick={() => setRulesEnabled(rules, false)} disabled={bulkUpdating || rules.length === 0}>
                <PauseCircle className="h-4 w-4" />
                Pause all
              </button>
            </div>
          </div>
          <div className="automation-hero-panel">
            <div className="automation-score-ring">
              <span>{stats.readiness}%</span>
              <small>Autopilot ready</small>
            </div>
            <div className="automation-mini-grid">
              <MiniStat label="Active" value={stats.enabled} detail={`${stats.total} total`} />
              <MiniStat label="Actions" value={stats.actions} detail="queued outcomes" />
              <MiniStat label="AI" value={stats.aiPowered} detail="smart rules" />
              <MiniStat label="Coverage" value={stats.coverage} detail="event types" />
            </div>
          </div>
        </section>

        <section className="automation-next-row">
          {nextBestActions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className="automation-next-action" onClick={item.action} disabled={item.disabled}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            );
          })}
        </section>

        <section className="automation-section">
          <div className="automation-section-head">
            <div>
              <div className="automation-kicker">Recommended automations</div>
              <h3>Pick the moments you want AgentEasePro to protect</h3>
            </div>
            <button className="automation-link-btn" onClick={() => navigate('/settings/automations')}>
              Advanced settings
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="automation-playbook-grid">
            {playbookStats.map((playbook) => {
              const Icon = playbook.icon;
              return (
                <article key={playbook.key} className={`automation-playbook-card ${toneClasses[playbook.tone]}`}>
                  <div className="automation-playbook-top">
                    <div className="automation-playbook-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <StatusBadge isActive={playbook.isActive} isPartial={playbook.isPartial} total={playbook.total} />
                  </div>
                  <h4>{playbook.title}</h4>
                  <p className="automation-playbook-promise">{playbook.promise}</p>
                  <p className="automation-playbook-win">{playbook.agentWin}</p>
                  <div className="automation-step-row">
                    {playbook.steps.slice(0, 4).map((step) => (
                      <span key={step}>{step}</span>
                    ))}
                  </div>
                  <div className="automation-playbook-footer">
                    <span>
                      {playbook.total === 0
                        ? 'Included in default playbooks'
                        : `${playbook.enabled} of ${playbook.total} rules on`}
                    </span>
                    <div className="automation-playbook-actions">
                      <button onClick={() => setActivePlaybookKey(playbook.key)}>
                        {playbook.total === 0 ? "What's included" : 'Review'}
                      </button>
                      <button
                        onClick={() => {
                          if (playbook.total === 0) {
                            openSetupModal(playbook.key);
                            return;
                          }
                          void setRulesEnabled(playbook.rules, !playbook.isActive);
                        }}
                        disabled={bulkUpdating || seeding}
                      >
                        {playbook.total === 0 ? 'Set up' : playbook.isActive ? 'Pause' : playbook.isPartial ? 'Finish' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="automation-focus-band">
          <div>
            <div className="automation-kicker">What agents get</div>
            <h3>{rules.length ? 'Your active automation coverage' : 'Simple wins after setup'}</h3>
          </div>
          {rules.length ? (
            <>
              <Outcome icon={CalendarClock} label="Deadline protection" value={stats.enabled ? 'On' : 'Ready'} />
              <Outcome icon={BellRing} label="Follow-up prompts" value={stats.actions.toString()} />
              <Outcome icon={Route} label="Workflows covered" value={stats.coverage.toString()} />
              <Outcome icon={Target} label="Rules active" value={`${stats.enabled}/${stats.total}`} />
            </>
          ) : (
            <>
              <Outcome icon={CalendarClock} label="Contract dates" value="Protected" />
              <Outcome icon={BellRing} label="Follow-up" value="Queued" />
              <Outcome icon={Megaphone} label="Marketing" value="Prompted" />
              <Outcome icon={UserRound} label="Referrals" value="Nurtured" />
            </>
          )}
        </section>

        <section className="automation-rule-shell">
          <div className="automation-section-head">
            <div>
              <div className="automation-kicker">Rule control</div>
              <h3>Fine tune each trigger</h3>
            </div>
            <div className="automation-filter-row">
              <div className="automation-search">
                <Search className="h-4 w-4" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search rules or actions"
                />
              </div>
              <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
                <option value="ALL">All moments</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <button
                className={showEnabledOnly ? 'is-active' : ''}
                onClick={() => setShowEnabledOnly((prev) => !prev)}
              >
                {showEnabledOnly ? 'Active only' : 'All rules'}
              </button>
            </div>
          </div>

          {rules.length === 0 ? (
            <EmptyAutomationState onSeed={() => openSetupModal()} seeding={seeding} />
          ) : filteredRules.length === 0 ? (
            <div className="automation-empty-inline">
              <Search className="h-5 w-5" />
              <span>No rules match your filters.</span>
            </div>
          ) : (
            <div className="automation-rule-groups">
              {Object.entries(groupedRules).map(([eventType, eventRules]) => (
                <RuleGroup
                  key={eventType}
                  eventType={eventType}
                  rules={eventRules}
                  summarizeAction={summarizeAction}
                  onToggle={toggleRule}
                  onSetRulesEnabled={setRulesEnabled}
                  bulkUpdating={bulkUpdating}
                />
              ))}
            </div>
          )}
        </section>

        <section className="automation-ai-note">
          <Bot className="h-5 w-5" />
          <div>
            <h3>AI playbooks stay practical.</h3>
            <p>
              AI-powered rules create context-aware task suggestions, but the agent stays in control.
              Use them for richer task plans, not noisy automation for automation's sake.
            </p>
          </div>
        </section>
      </div>

      {activePlaybook && (
        <PlaybookModal
          playbook={activePlaybook}
          summarizeAction={summarizeAction}
          onClose={() => setActivePlaybookKey(null)}
          onToggle={toggleRule}
          onSetRulesEnabled={setRulesEnabled}
          bulkUpdating={bulkUpdating}
          navigate={navigate}
        />
      )}

      {setupModalOpen && (
        <AutomationSetupModal
          selectedKeys={selectedSetupKeys}
          onSelectedKeysChange={setSelectedSetupKeys}
          onClose={() => setSetupModalOpen(false)}
          onRunSetup={runSetup}
          busy={seeding || bulkUpdating}
          hasExistingRules={rules.length > 0}
        />
      )}
    </PageLayout>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="automation-mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Outcome({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="automation-outcome">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ isActive, isPartial, total }: { isActive: boolean; isPartial: boolean; total: number }) {
  if (total === 0) return <span className="automation-status-badge is-empty">Recommended</span>;
  if (isActive) return <span className="automation-status-badge is-active">Active</span>;
  if (isPartial) return <span className="automation-status-badge is-partial">Partial</span>;
  return <span className="automation-status-badge">Paused</span>;
}

function RuleGroup({
  eventType,
  rules,
  summarizeAction,
  onToggle,
  onSetRulesEnabled,
  bulkUpdating,
}: {
  eventType: string;
  rules: AutomationRule[];
  summarizeAction: (action: any) => string;
  onToggle: (ruleId: string, currentEnabled: boolean) => void;
  onSetRulesEnabled: (rules: AutomationRule[], enabled: boolean) => void;
  bulkUpdating: boolean;
}) {
  const meta = EVENT_TYPE_LABELS[eventType] || { label: eventType, icon: Settings, detail: eventType };
  const Icon = meta.icon;
  const enabledCount = rules.filter((rule) => rule.isEnabled).length;

  return (
    <div className="automation-rule-group">
      <div className="automation-rule-group-head">
        <div className="automation-rule-group-title">
          <div className="automation-rule-group-icon">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4>{meta.label}</h4>
            <p>{meta.detail} - {enabledCount} of {rules.length} active</p>
          </div>
        </div>
        <div className="automation-rule-group-actions">
          <button onClick={() => onSetRulesEnabled(rules, true)} disabled={bulkUpdating}>Enable group</button>
          <button onClick={() => onSetRulesEnabled(rules, false)} disabled={bulkUpdating}>Pause group</button>
        </div>
      </div>

      <div className="automation-rule-list">
        {rules.map((rule) => (
          <article key={rule.id} className="automation-rule-card">
            <div className="automation-rule-copy">
              <div className="automation-rule-title-row">
                <h5>{rule.name}</h5>
                {rule.config?.actions?.some((action: any) => action.useAI || action.action === 'CREATE_TASKS_FROM_AI') && (
                  <span className="automation-ai-pill"><Sparkles className="h-3 w-3" />AI</span>
                )}
                <StatusBadge isActive={rule.isEnabled} isPartial={false} total={1} />
              </div>
              <p>{rule.config?.actions?.length || 0} configured action{(rule.config?.actions?.length || 0) === 1 ? '' : 's'}</p>
              <div className="automation-action-chip-row">
                {(rule.config?.actions || []).map((action: any, index: number) => (
                  <span key={`${rule.id}-${index}`}>{summarizeAction(action)}</span>
                ))}
              </div>
            </div>
            <ToggleSwitch enabled={rule.isEnabled} onClick={() => onToggle(rule.id, rule.isEnabled)} label={rule.name} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onClick, label }: { enabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`automation-toggle ${enabled ? 'is-on' : ''}`}
      onClick={onClick}
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Pause' : 'Enable'} ${label}`}
    >
      <span />
    </button>
  );
}

function EmptyAutomationState({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <div className="automation-empty-state">
      <Zap className="h-8 w-8" />
      <h3>No automations are configured yet</h3>
      <p>
        Start with the default real estate playbooks. You can pause anything that does not fit
        your workflow after they are created.
      </p>
      <button onClick={onSeed} disabled={seeding}>
        <Plus className="h-4 w-4" />
        {seeding ? 'Creating playbooks...' : 'Create default playbooks'}
      </button>
    </div>
  );
}

function AutomationSetupModal({
  selectedKeys,
  onSelectedKeysChange,
  onClose,
  onRunSetup,
  busy,
  hasExistingRules,
}: {
  selectedKeys: string[];
  onSelectedKeysChange: (keys: string[]) => void;
  onClose: () => void;
  onRunSetup: () => Promise<void>;
  busy: boolean;
  hasExistingRules: boolean;
}) {
  const allSelected = selectedKeys.length === PLAYBOOKS.length;
  const [focusedKey, setFocusedKey] = useState(selectedKeys[0] || PLAYBOOKS[0].key);
  const focusedPlaybook = PLAYBOOKS.find((playbook) => playbook.key === focusedKey) || PLAYBOOKS[0];

  const toggleKey = (key: string) => {
    setFocusedKey(key);
    onSelectedKeysChange(
      selectedKeys.includes(key)
        ? selectedKeys.filter((item) => item !== key)
        : [...selectedKeys, key],
    );
  };

  const selectedCount = selectedKeys.length;

  return (
    <div className="automation-modal automation-setup-modal">
      <div className="automation-modal-backdrop" onClick={busy ? undefined : onClose} />
      <div className="automation-modal-panel automation-setup-panel">
        <div className="automation-setup-head">
          <div>
            <div className="automation-eyebrow">
              <Sparkles className="h-4 w-4" />
              Setup autopilot
            </div>
            <h3>Choose what AgentEasePro should handle for you.</h3>
            <p>
              Start with proven real estate workflows. We will create the rules, turn on the selected packs,
              and keep everything editable after setup.
            </p>
          </div>
          <button className="automation-modal-close" onClick={onClose} disabled={busy} aria-label="Close setup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="automation-setup-body">
          <div className="automation-setup-summary">
            <div>
              <strong>{selectedCount} packs selected</strong>
              <span>{hasExistingRules ? 'Existing rules will stay intact.' : 'Default rules will be created first.'}</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectedKeysChange(allSelected ? [] : PLAYBOOKS.map((playbook) => playbook.key))}
              disabled={busy}
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>

          <div className="automation-setup-grid">
            {PLAYBOOKS.map((playbook) => {
              const Icon = playbook.icon;
              const checked = selectedKeys.includes(playbook.key);
              return (
                <button
                  key={playbook.key}
                  type="button"
                  className={`automation-setup-card ${toneClasses[playbook.tone]} ${checked ? 'is-selected' : ''}`}
                  onClick={() => toggleKey(playbook.key)}
                  disabled={busy}
                >
                  <div className="automation-setup-card-top">
                    <span className="automation-playbook-icon">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="automation-setup-check">
                      {checked ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </div>
                  <strong>{playbook.title}</strong>
                  <p>{playbook.promise}</p>
                  <div className="automation-step-row">
                    {playbook.steps.slice(0, 3).map((step) => (
                      <span key={step}>{step}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <AutomationStoryPanel playbook={focusedPlaybook} compact />

          <div className="automation-setup-wow">
            <div>
              <Zap className="h-5 w-5" />
              <span>After setup, agents can pause any rule, review every trigger, and tune advanced settings anytime.</span>
            </div>
          </div>

          <div className="automation-setup-actions">
            <button className="automation-ghost-btn" type="button" onClick={onClose} disabled={busy}>
              Not now
            </button>
            <button
              className="automation-primary-btn"
              type="button"
              onClick={onRunSetup}
              disabled={busy || selectedKeys.length === 0}
            >
              <Zap className="h-4 w-4" />
              {busy ? 'Setting up...' : `Turn on ${selectedCount} automation pack${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomationStoryPanel({ playbook, compact = false }: { playbook: Playbook; compact?: boolean }) {
  const Icon = playbook.icon;
  return (
    <div className={`automation-story-panel ${toneClasses[playbook.tone]} ${compact ? 'is-compact' : ''}`}>
      <div className="automation-story-title">
        <div className="automation-playbook-icon">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="automation-kicker">What it does</div>
          <h4>{playbook.title}</h4>
        </div>
      </div>
      <div className="automation-story-flow">
        <StoryStep label="Trigger" value={playbook.story.trigger} />
        <StoryStep label="Creates" value={playbook.story.creates.join(', ')} />
        <StoryStep label="Agent sees" value={playbook.story.agentSees} />
        <StoryStep label="Outcome" value={playbook.story.outcome} />
      </div>
    </div>
  );
}

function StoryStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="automation-story-step">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function PlaybookModal({
  playbook,
  summarizeAction,
  onClose,
  onToggle,
  onSetRulesEnabled,
  bulkUpdating,
  navigate,
}: {
  playbook: Playbook & {
    rules: AutomationRule[];
    total: number;
    enabled: number;
    isActive: boolean;
    isPartial: boolean;
  };
  summarizeAction: (action: any) => string;
  onClose: () => void;
  onToggle: (ruleId: string, currentEnabled: boolean) => void;
  onSetRulesEnabled: (rules: AutomationRule[], enabled: boolean) => void;
  bulkUpdating: boolean;
  navigate: (path: string) => void;
}) {
  const Icon = playbook.icon;
  const readiness = playbook.total ? Math.round((playbook.enabled / playbook.total) * 100) : 0;

  return (
    <div className="automation-modal">
      <div className="automation-modal-backdrop" onClick={onClose} />
      <div className="automation-modal-panel">
        <div className={`automation-modal-head ${toneClasses[playbook.tone]}`}>
          <div className="automation-playbook-icon">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="automation-kicker">Playbook review</div>
            <h3>{playbook.title}</h3>
            <p>{playbook.agentWin}</p>
          </div>
          <button className="automation-modal-close" onClick={onClose} aria-label="Close playbook">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="automation-modal-body">
          <div className="automation-modal-stats">
            <MiniStat label="Ready" value={`${readiness}%`} detail="playbook coverage" />
            <MiniStat label="Rules" value={playbook.total} detail={`${playbook.enabled} active`} />
            <MiniStat label="Steps" value={playbook.steps.length} detail="agent outcomes" />
          </div>

          <AutomationStoryPanel playbook={playbook} />

          <div className="automation-step-row is-modal">
            {playbook.steps.map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>

          <div className="automation-modal-actions">
            <button onClick={() => onSetRulesEnabled(playbook.rules, true)} disabled={bulkUpdating || playbook.total === 0}>
              <PlayCircle className="h-4 w-4" />
              Enable playbook
            </button>
            <button onClick={() => onSetRulesEnabled(playbook.rules, false)} disabled={bulkUpdating || playbook.total === 0}>
              <PauseCircle className="h-4 w-4" />
              Pause playbook
            </button>
            <button onClick={() => navigate('/settings/automations')}>
              <Settings className="h-4 w-4" />
              Advanced settings
            </button>
          </div>

          {playbook.rules.length === 0 ? (
            <div className="automation-empty-inline">
              <Zap className="h-5 w-5" />
              <span>Create default playbooks to populate these rules.</span>
            </div>
          ) : (
            <div className="automation-rule-list is-modal">
              {playbook.rules.map((rule) => (
                <article key={rule.id} className="automation-rule-card">
                  <div className="automation-rule-copy">
                    <div className="automation-rule-title-row">
                      <h5>{rule.name}</h5>
                      <StatusBadge isActive={rule.isEnabled} isPartial={false} total={1} />
                    </div>
                    <div className="automation-action-chip-row">
                      {(rule.config?.actions || []).map((action: any, index: number) => (
                        <span key={`${rule.id}-modal-${index}`}>{summarizeAction(action)}</span>
                      ))}
                    </div>
                  </div>
                  <ToggleSwitch enabled={rule.isEnabled} onClick={() => onToggle(rule.id, rule.isEnabled)} label={rule.name} />
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
