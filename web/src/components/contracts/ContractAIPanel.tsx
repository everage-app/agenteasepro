import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface ContractReviewResult {
  score: number;
  status: 'incomplete' | 'needs_attention' | 'ready_to_send' | 'excellent';
  completedFields: string[];
  missingRequired: Array<{
    field: string;
    label: string;
    severity: 'critical' | 'important' | 'recommended';
    suggestion?: string;
  }>;
  dateAnalysis: {
    isValid: boolean;
    issues: Array<{
      type: 'conflict' | 'past_date' | 'tight_timeline' | 'warning';
      message: string;
      fields: string[];
    }>;
    timeline: Array<{
      date: string;
      event: string;
      daysFromNow: number;
      status: 'past' | 'imminent' | 'upcoming' | 'future';
    }>;
  };
  calculations: {
    isValid: boolean;
    items: Array<{
      label: string;
      expected: number;
      actual: number;
      status: 'correct' | 'mismatch' | 'missing';
    }>;
  };
  risks: Array<{
    level: 'high' | 'medium' | 'low';
    category: string;
    description: string;
    recommendation: string;
  }>;
  suggestedTasks: Array<{
    title: string;
    dueDate?: string;
    linkedToField?: string;
    priority: 'high' | 'medium' | 'low';
    category: 'deadline' | 'document' | 'followup' | 'compliance';
  }>;
  aiInsights?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
  };
}

interface ContractAIPanelProps {
  formValues: Record<string, any>;
  dealId?: string;
  onFieldFocus?: (field: string) => void;
  onAutoFill?: (field: string, value: any) => void;
}

export function ContractAIPanel({ formValues, dealId, onFieldFocus, onAutoFill }: ContractAIPanelProps) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ContractReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fields' | 'dates' | 'tasks' | 'ai'>('overview');
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [tasksCreated, setTasksCreated] = useState(false);

  const runReview = async (includeAI = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/ai/contract/review', {
        formValues,
        options: { includeAI },
      });
      setReview(res.data);
      // Auto-select high priority tasks
      const highPriorityIndices = res.data.suggestedTasks
        .map((t: any, i: number) => t.priority === 'high' ? i : -1)
        .filter((i: number) => i >= 0);
      setSelectedTasks(new Set(highPriorityIndices));
    } catch (err: any) {
      console.error('Contract review error:', err);
      setError(err.response?.data?.error || 'Failed to review contract');
    } finally {
      setLoading(false);
    }
  };

  const createSelectedTasks = async () => {
    if (!review || selectedTasks.size === 0) return;
    setCreatingTasks(true);
    try {
      const tasksToCreate = review.suggestedTasks.filter((_, i) => selectedTasks.has(i));
      await api.post('/ai/contract/create-tasks', {
        tasks: tasksToCreate,
        dealId,
      });
      setTasksCreated(true);
      setTimeout(() => setTasksCreated(false), 3000);
    } catch (err) {
      console.error('Failed to create tasks:', err);
    } finally {
      setCreatingTasks(false);
    }
  };

  const toggleTask = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  const getStatusConfig = (status: ContractReviewResult['status']) => {
    switch (status) {
      case 'excellent':
        return { color: 'emerald', icon: '✓', label: 'Excellent', bg: 'from-emerald-600/20' };
      case 'ready_to_send':
        return { color: 'blue', icon: '→', label: 'Ready to Send', bg: 'from-blue-600/20' };
      case 'needs_attention':
        return { color: 'amber', icon: '!', label: 'Needs Attention', bg: 'from-amber-600/20' };
      case 'incomplete':
        return { color: 'red', icon: '✗', label: 'Incomplete', bg: 'from-red-600/20' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  // Initial collapsed view
  if (!review && !loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-indigo-500/10 to-slate-950/60 backdrop-blur-xl p-5 shadow-[0_18px_40px_rgba(3,12,40,0.6)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_60%)]" />
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Contract AI Review</h3>
              <p className="text-xs text-purple-200/80">Comprehensive analysis & smart suggestions</p>
            </div>
          </div>

          {/* Features List */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { icon: '📋', label: 'Field Analysis' },
              { icon: '📅', label: 'Date Validation' },
              { icon: '⚠️', label: 'Risk Assessment' },
              { icon: '✅', label: 'Auto-Tasks' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-purple-100/70 bg-white/5 rounded-lg px-3 py-2">
                <span>{feature.icon}</span>
                <span>{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={() => runReview(false)}
              variant="primary"
              className="w-full rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/25"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Review
            </Button>
            <Button
              onClick={() => runReview(true)}
              variant="ghost"
              className="w-full rounded-xl text-xs text-purple-200/80 hover:text-white hover:bg-white/10"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Deep Analysis with AI Insights
            </Button>
          </div>

          <p className="text-[10px] text-purple-200/50 text-center mt-4">
            Analyzes fields, dates, calculations, risks & suggests tasks
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-slate-900/40 to-slate-950/60 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-purple-500/30 animate-pulse"></div>
            <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-t-purple-400 animate-spin"></div>
          </div>
          <p className="mt-4 text-sm text-purple-200">Analyzing contract...</p>
          <p className="text-xs text-slate-400 mt-1">Checking fields, dates, calculations & risks</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-sm text-red-200 mb-3">{error}</p>
        <Button onClick={() => runReview(false)} variant="secondary" size="sm" className="w-full rounded-xl">
          Try Again
        </Button>
      </div>
    );
  }

  if (!review) return null;

  const statusConfig = getStatusConfig(review.status);

  return (
    <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600/10 via-slate-900/40 to-slate-950/60 backdrop-blur-xl overflow-hidden">
      {/* Header with Score */}
      <div className={`p-4 bg-gradient-to-r ${statusConfig.bg} to-transparent border-b border-white/5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${statusConfig.color}-500/20 border border-${statusConfig.color}-500/30`}>
              <span className={`text-2xl font-bold ${getScoreColor(review.score)}`}>{review.score}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold text-${statusConfig.color}-400`}>{statusConfig.label}</span>
                <span className={`inline-flex items-center rounded-full bg-${statusConfig.color}-500/20 px-2 py-0.5 text-[10px] font-semibold text-${statusConfig.color}-200`}>
                  {statusConfig.icon}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {review.completedFields.length} fields complete • {review.missingRequired.length} missing
              </p>
            </div>
          </div>
          <Button
            onClick={() => runReview(true)}
            variant="ghost"
            size="sm"
            className="text-xs text-purple-300 hover:text-white"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/5 bg-slate-900/30">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'fields', label: 'Fields', icon: '📋', badge: review.missingRequired.filter(m => m.severity === 'critical').length },
          { id: 'dates', label: 'Dates', icon: '📅', badge: review.dateAnalysis.issues.length },
          { id: 'tasks', label: 'Tasks', icon: '✅', badge: review.suggestedTasks.length },
          ...(review.aiInsights ? [{ id: 'ai', label: 'AI', icon: '🤖' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all relative ${
              activeTab === tab.id
                ? 'text-purple-300 bg-purple-500/10'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500/80 text-[10px] text-white font-bold">
                  {tab.badge}
                </span>
              )}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400"></div>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <div className={`text-xl font-bold ${review.missingRequired.filter(m => m.severity === 'critical').length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {review.missingRequired.filter(m => m.severity === 'critical').length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Critical Missing</div>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <div className={`text-xl font-bold ${review.dateAnalysis.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {review.dateAnalysis.timeline.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Key Dates</div>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <div className={`text-xl font-bold ${review.risks.filter(r => r.level === 'high').length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {review.risks.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Risk Items</div>
              </div>
            </div>

            {/* Risks */}
            {review.risks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Risk Assessment</h4>
                {review.risks.map((risk, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 border ${
                      risk.level === 'high'
                        ? 'bg-red-500/10 border-red-500/30'
                        : risk.level === 'medium'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-500/10 border-slate-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-sm ${
                        risk.level === 'high' ? 'text-red-400' : risk.level === 'medium' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {risk.level === 'high' ? '🚨' : risk.level === 'medium' ? '⚠️' : 'ℹ️'}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-white">{risk.description}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{risk.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline Preview */}
            {review.dateAnalysis.timeline.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Upcoming Deadlines</h4>
                <div className="space-y-1">
                  {review.dateAnalysis.timeline.slice(0, 4).map((event, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        event.status === 'past'
                          ? 'bg-red-500/10 text-red-300'
                          : event.status === 'imminent'
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-medium">{event.event}</span>
                      <span className="text-[11px]">
                        {event.status === 'past'
                          ? `${Math.abs(event.daysFromNow)} days ago`
                          : event.daysFromNow === 0
                          ? 'TODAY'
                          : `${event.daysFromNow} days`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fields Tab */}
        {activeTab === 'fields' && (
          <div className="space-y-3">
            {review.missingRequired.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">✅</span>
                <p className="text-sm text-emerald-400 font-semibold mt-2">All Required Fields Complete</p>
                <p className="text-xs text-slate-400 mt-1">Great job! Your contract is well-documented.</p>
              </div>
            ) : (
              <>
                {/* Critical */}
                {review.missingRequired.filter(m => m.severity === 'critical').length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>🚨</span> Critical (Required)
                    </h4>
                    {review.missingRequired.filter(m => m.severity === 'critical').map((field, i) => (
                      <FieldItem key={i} field={field} onFocus={onFieldFocus} onAutoFill={onAutoFill} />
                    ))}
                  </div>
                )}

                {/* Important */}
                {review.missingRequired.filter(m => m.severity === 'important').length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span>⚠️</span> Important
                    </h4>
                    {review.missingRequired.filter(m => m.severity === 'important').map((field, i) => (
                      <FieldItem key={i} field={field} onFocus={onFieldFocus} onAutoFill={onAutoFill} />
                    ))}
                  </div>
                )}

                {/* Recommended */}
                {review.missingRequired.filter(m => m.severity === 'recommended').length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                      📝 Recommended
                    </h4>
                    {review.missingRequired.filter(m => m.severity === 'recommended').map((field, i) => (
                      <FieldItem key={i} field={field} onFocus={onFieldFocus} onAutoFill={onAutoFill} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Dates Tab */}
        {activeTab === 'dates' && (
          <div className="space-y-4">
            {/* Date Issues */}
            {review.dateAnalysis.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide">⚠️ Date Issues</h4>
                {review.dateAnalysis.issues.map((issue, i) => (
                  <div key={i} className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
                    <p className="text-xs text-amber-200">{issue.message}</p>
                    {onFieldFocus && issue.fields.length > 0 && (
                      <button
                        onClick={() => onFieldFocus(issue.fields[0])}
                        className="text-[10px] text-amber-300 hover:text-amber-200 mt-1 underline"
                      >
                        Go to field →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">📅 Timeline</h4>
              {review.dateAnalysis.timeline.length === 0 ? (
                <p className="text-xs text-slate-400">No dates set yet</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-slate-700"></div>
                  {review.dateAnalysis.timeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-3 mb-3 relative">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                        event.status === 'past'
                          ? 'bg-red-500/30 text-red-400'
                          : event.status === 'imminent'
                          ? 'bg-amber-500/30 text-amber-400'
                          : event.status === 'upcoming'
                          ? 'bg-blue-500/30 text-blue-400'
                          : 'bg-slate-600/50 text-slate-400'
                      }`}>
                        <span className="text-[10px]">
                          {event.status === 'past' ? '✗' : event.status === 'imminent' ? '!' : '○'}
                        </span>
                      </div>
                      <div className="flex-1 -mt-0.5">
                        <p className="text-xs font-semibold text-white">{event.event}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(event.date).toLocaleDateString('en-US', { 
                            weekday: 'short', month: 'short', day: 'numeric' 
                          })}
                          {' • '}
                          <span className={
                            event.status === 'past' ? 'text-red-400' :
                            event.status === 'imminent' ? 'text-amber-400' : ''
                          }>
                            {event.status === 'past'
                              ? `${Math.abs(event.daysFromNow)} days ago`
                              : event.daysFromNow === 0
                              ? 'TODAY'
                              : `in ${event.daysFromNow} days`}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {review.suggestedTasks.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-3xl">📋</span>
                <p className="text-sm text-slate-300 mt-2">No tasks suggested</p>
                <p className="text-xs text-slate-500">Complete more fields to generate task suggestions</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">
                    {selectedTasks.size} of {review.suggestedTasks.length} selected
                  </p>
                  <button
                    onClick={() => {
                      if (selectedTasks.size === review.suggestedTasks.length) {
                        setSelectedTasks(new Set());
                      } else {
                        setSelectedTasks(new Set(review.suggestedTasks.map((_, i) => i)));
                      }
                    }}
                    className="text-[10px] text-purple-300 hover:text-purple-200"
                  >
                    {selectedTasks.size === review.suggestedTasks.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="space-y-2">
                  {review.suggestedTasks.map((task, i) => (
                    <div
                      key={i}
                      onClick={() => toggleTask(i)}
                      className={`rounded-xl p-3 border cursor-pointer transition-all ${
                        selectedTasks.has(i)
                          ? 'bg-purple-500/20 border-purple-500/40'
                          : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedTasks.has(i)
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-slate-500'
                        }`}>
                          {selectedTasks.has(i) && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              task.priority === 'high'
                                ? 'bg-red-500/20 text-red-300'
                                : task.priority === 'medium'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}>
                              {task.priority}
                            </span>
                            <span className="text-[10px] text-slate-500">{task.category}</span>
                            {task.dueDate && (
                              <span className="text-[10px] text-slate-400">
                                Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create Tasks Button */}
                <Button
                  onClick={createSelectedTasks}
                  disabled={selectedTasks.size === 0 || creatingTasks || tasksCreated}
                  variant="primary"
                  className="w-full rounded-xl mt-4"
                >
                  {tasksCreated ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Tasks Created!
                    </>
                  ) : creatingTasks ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* AI Insights Tab */}
        {activeTab === 'ai' && review.aiInsights && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 p-4">
              <p className="text-sm text-white">{review.aiInsights.summary}</p>
            </div>

            {/* Strengths */}
            {review.aiInsights.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span>💪</span> Strengths
                </h4>
                <ul className="space-y-1">
                  {review.aiInsights.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            {review.aiInsights.improvements.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span>🔧</span> Improvements
                </h4>
                <ul className="space-y-1">
                  {review.aiInsights.improvements.map((s, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {review.aiInsights.nextSteps.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span>🎯</span> Next Steps
                </h4>
                <ol className="space-y-1">
                  {review.aiInsights.nextSteps.map((s, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-blue-400 font-bold">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Field Item Component
function FieldItem({ 
  field, 
  onFocus, 
  onAutoFill 
}: { 
  field: ContractReviewResult['missingRequired'][0];
  onFocus?: (field: string) => void;
  onAutoFill?: (field: string, value: any) => void;
}) {
  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-2 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{field.label}</p>
          {field.suggestion && (
            <p className="text-[11px] text-slate-400 mt-0.5">{field.suggestion}</p>
          )}
        </div>
        <div className="flex gap-1">
          {onFocus && (
            <button
              onClick={() => onFocus(field.field)}
              className="text-[10px] text-purple-300 hover:text-purple-200 px-2 py-1 rounded-lg hover:bg-purple-500/20"
            >
              Go to field
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContractAIPanel;
