import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import api from '../../lib/api';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  eventType: string;
  config: any;
}

export function AutomationsSettingsPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [draftRule, setDraftRule] = useState<AutomationRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);

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

  const openRuleModal = (rule: AutomationRule) => {
    const normalizedActions = (rule.config?.actions || []).map((action: any) => ({
      enabled: action.enabled ?? true,
      ...action,
    }));
    const normalized = {
      ...rule,
      config: {
        ...(rule.config || {}),
        actions: normalizedActions,
      },
    } as AutomationRule;
    setSelectedRule(rule);
    setDraftRule(normalized);
  };

  const updateAction = (index: number, next: Partial<any>) => {
    if (!draftRule) return;
    const actions = [...(draftRule.config?.actions || [])];
    actions[index] = { ...actions[index], ...next };
    setDraftRule({
      ...draftRule,
      config: { ...(draftRule.config || {}), actions },
    });
  };

  const saveRule = async () => {
    if (!draftRule) return;
    try {
      setSavingRule(true);
      const res = await api.patch(`/automations/${draftRule.id}`, {
        name: draftRule.name,
        config: draftRule.config,
      });
      setRules((prev) => prev.map((r) => (r.id === draftRule.id ? res.data : r)));
      setSelectedRule(null);
      setDraftRule(null);
    } catch (error) {
      console.error('Failed to update automation rule:', error);
    } finally {
      setSavingRule(false);
    }
  };

  const automationSections = [
    {
      title: 'REPC & Deal Tasks',
      description: 'Automatically create deadline tasks when you add deals',
      icon: '📋',
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-400/30',
      rules: rules.filter(r => r.eventType === 'DEAL_CREATED'),
    },
    {
      title: 'Listing Marketing Tasks',
      description: 'Create marketing checklists for new listings',
      icon: '🏠',
      color: 'from-emerald-500/20 to-green-500/10 border-emerald-400/30',
      rules: rules.filter(r => r.eventType === 'LISTING_CREATED'),
    },
    {
      title: 'Client Relationship Tasks',
      description: 'Follow up with clients based on stage changes',
      icon: '👤',
      color: 'from-amber-500/20 to-yellow-500/10 border-amber-400/30',
      rules: rules.filter(r => r.eventType === 'CLIENT_STAGE_CHANGED'),
    },
  ];

  const summarizeAction = (action: any) => {
    if (!action) return 'Automation action';
    switch (action.action) {
      case 'CREATE_TASKS':
        return `Create tasks (${action.template || 'template'})`;
      case 'CREATE_TASKS_FROM_AI':
        return 'AI-generated task plan';
      case 'SCHEDULE_DEAL_TASKS':
        return action.useKeyDates ? 'Schedule key-date tasks' : 'Schedule deal tasks';
      case 'CREATE_REFERRAL_TOUCH_SEQUENCE':
        return `Referral touch sequence (${action.sequenceType || 'custom'})`;
      case 'INCREMENT_METRICS':
        return `Update metrics (${action.kind || 'tracking'})`;
      default:
        return action.action || 'Automation action';
    }
  };

  const describeTiming = (action: any) => {
    if (!action) return 'Runs immediately when the event happens.';
    if (action.action === 'SCHEDULE_DEAL_TASKS') {
      return action.useKeyDates
        ? 'Uses key dates from the contract to set due dates.'
        : 'Schedules deal tasks using default due windows.';
    }
    if (action.action === 'CREATE_TASKS_FROM_AI') {
      return 'AI recommends due dates based on activity context.';
    }
    return 'Runs immediately when the event is detected.';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400">Loading automations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/95 dark:bg-gradient-to-br dark:from-purple-500/10 dark:to-blue-500/10 border-slate-200/70 dark:border-purple-400/30 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚡</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
              Let AgentEasePro handle the busywork
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Enable automations to create tasks, send reminders, and keep your deals moving 
              without manual tracking.
            </p>
          </div>
        </div>
      </Card>

      {/* Automation sections */}
      {automationSections.map((section) => (
        <Card key={section.title} className="p-6 bg-white/95 dark:bg-slate-950/60 border border-slate-200/70 dark:border-white/10">
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${section.color} border text-2xl`}>
              {section.icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">{section.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{section.description}</p>
            </div>
          </div>

          {section.rules.length === 0 ? (
            <div className="text-center py-8 border-t border-slate-200/70 dark:border-white/10 mt-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">No automations configured for this category</p>
            </div>
          ) : (
            <div className="space-y-3 border-t border-slate-200/70 dark:border-white/10 pt-4">
              {section.rules.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between p-4 rounded-lg border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-white/5">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-50">{rule.name}</h4>
                      {rule.config?.actions?.[0]?.useAI && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-200 border border-purple-400/30">
                          ✨ AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      {rule.config?.description || 'Automated task creation'}
                    </p>
                    <button
                      onClick={() => openRuleModal(rule)}
                      className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 underline"
                    >
                      What this does →
                    </button>
                    <button
                      onClick={() => openRuleModal(rule)}
                      className="ml-3 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline"
                    >
                      Customize
                    </button>
                  </div>
                  <button
                    onClick={() => toggleRule(rule.id, rule.isEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
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
              ))}
            </div>
          )}
        </Card>
      ))}

      {rules.length === 0 && (
        <Card className="text-center py-12 bg-white/95 dark:bg-slate-950/60 border border-slate-200/70 dark:border-white/10">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
            No automations configured
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Go to the Automations page to create default automation workflows.
          </p>
        </Card>
      )}

      {selectedRule && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md" onClick={() => setSelectedRule(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 text-slate-900 dark:text-white shadow-2xl overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-slate-200/60 dark:border-white/10 bg-gradient-to-br from-white via-slate-50/80 to-white dark:from-slate-950/80 dark:via-slate-950/95 dark:to-slate-900/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Automation</div>
                    <input
                      value={draftRule?.name || ''}
                      onChange={(e) => draftRule && setDraftRule({ ...draftRule, name: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-4 py-2 text-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <textarea
                      value={draftRule?.config?.description || ''}
                      onChange={(e) => draftRule && setDraftRule({
                        ...draftRule,
                        config: { ...(draftRule.config || {}), description: e.target.value },
                      })}
                      placeholder="Describe what this automation should do..."
                      rows={2}
                      className="mt-3 w-full rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <div className="text-xs text-slate-400 mt-2">
                      Event: {selectedRule.eventType.replace(/_/g, ' ').toLowerCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRule(null)}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Actions</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                      {draftRule?.config?.actions?.length || selectedRule.config?.actions?.length || 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Status</div>
                    <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-200 mt-1">
                      {(draftRule?.isEnabled ?? selectedRule.isEnabled) ? 'Active' : 'Paused'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">AI</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                      {draftRule?.config?.actions?.some((a: any) => a.useAI || a.action === 'CREATE_TASKS_FROM_AI') ? 'Enabled' : 'Off'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-5 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">What happens</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">These steps run whenever the event fires.</div>
                </div>

                <div className="grid gap-3">
                  {(draftRule?.config?.actions || []).map((action: any, idx: number) => (
                    <Card key={`${selectedRule.id}-detail-${idx}`} className="p-4 bg-white/90 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/10">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{summarizeAction(action)}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{describeTiming(action)}</div>
                          </div>
                          <button
                            onClick={() => updateAction(idx, { enabled: !action.enabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              action.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            role="switch"
                            aria-checked={Boolean(action.enabled)}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                action.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {(action.useAI !== undefined || action.action === 'CREATE_TASKS_FROM_AI') && (
                          <button
                            onClick={() => updateAction(idx, { useAI: !action.useAI })}
                            className={`px-3 py-1.5 rounded-full text-xs border ${
                              action.useAI
                                ? 'border-purple-400/40 bg-purple-500/15 text-purple-600 dark:text-purple-200'
                                : 'border-slate-200/60 bg-slate-100/70 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                            }`}
                          >
                            {action.useAI ? 'AI on' : 'AI off'}
                          </button>
                        )}

                        {action.action === 'SCHEDULE_DEAL_TASKS' && (
                          <button
                            onClick={() => updateAction(idx, { useKeyDates: !action.useKeyDates })}
                            className={`px-3 py-1.5 rounded-full text-xs border ${
                              action.useKeyDates
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-200'
                                : 'border-slate-200/60 bg-slate-100/70 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                            }`}
                          >
                            {action.useKeyDates ? 'Use key dates' : 'Default dates'}
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => draftRule && toggleRule(draftRule.id, draftRule.isEnabled)}
                    className={`px-4 py-2 rounded-full text-sm border ${
                      draftRule?.isEnabled
                        ? 'border-amber-400/40 bg-amber-500/15 text-amber-600 dark:text-amber-200'
                        : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-200'
                    }`}
                  >
                    {draftRule?.isEnabled ? 'Pause automation' : 'Activate automation'}
                  </button>
                  <button
                    onClick={() => navigate('/automations')}
                    className="px-4 py-2 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200"
                  >
                    Open Automations
                  </button>
                  <button
                    onClick={() => navigate('/settings/integrations')}
                    className="px-4 py-2 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200"
                  >
                    Connect integrations
                  </button>
                  <button
                    onClick={saveRule}
                    disabled={savingRule || !draftRule}
                    className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm shadow-lg shadow-blue-500/30 disabled:opacity-60"
                  >
                    {savingRule ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
