import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, BarChart3, Bot, CalendarDays, Check, CheckCircle2, Circle, ClipboardList, FileText, Info, Lightbulb, Plus, RefreshCw, ShieldCheck, Sparkles, Target, Wrench, XCircle, Zap } from 'lucide-react';
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

const FIELD_OPTION_SETS: Record<string, Array<{ label: string; value: string | boolean }>> = {
  earnestMoneyForm: [
    { label: 'Wire Transfer', value: 'wire' },
    { label: "Cashier's Check", value: 'check' },
    { label: 'Personal Check', value: 'personal_check' },
    { label: 'Other', value: 'other' },
  ],
  possessionTiming: [
    { label: 'On Recording', value: 'ON_RECORDING' },
    { label: 'Hours After Recording', value: 'HOURS_AFTER_RECORDING' },
    { label: 'Days After Recording', value: 'DAYS_AFTER_RECORDING' },
  ],
  capitalImprovementsPayer: [
    { label: 'Seller', value: 'SELLER' },
    { label: 'Buyer', value: 'BUYER' },
    { label: 'Split', value: 'SPLIT' },
    { label: 'Other', value: 'OTHER' },
  ],
  changeOfOwnershipFeePayer: [
    { label: 'Seller', value: 'SELLER' },
    { label: 'Buyer', value: 'BUYER' },
    { label: 'Split', value: 'SPLIT' },
    { label: 'Other', value: 'OTHER' },
  ],
  homeWarrantyOrderedBy: [
    { label: 'Buyer', value: 'BUYER' },
    { label: 'Seller', value: 'SELLER' },
    { label: 'Unknown', value: 'UNKNOWN' },
  ],
  hasDueDiligenceCondition: [
    { label: 'Included', value: true },
    { label: 'Not Included', value: false },
  ],
  hasAppraisalCondition: [
    { label: 'Included', value: true },
    { label: 'Not Included', value: false },
  ],
  hasFinancingCondition: [
    { label: 'Included', value: true },
    { label: 'Not Included', value: false },
  ],
  hasHomeWarranty: [
    { label: 'Included', value: true },
    { label: 'Not Included', value: false },
  ],
};

function hasFieldValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getInlineFieldKind(fieldKey: string): 'date' | 'number' | 'select' | 'textarea' | 'text' {
  if (FIELD_OPTION_SETS[fieldKey]) return 'select';
  if (/date|deadline/i.test(fieldKey)) return 'date';
  if (/amount|price|cost|offset/i.test(fieldKey)) return 'number';
  if (/description|items|names|other/i.test(fieldKey)) return 'textarea';
  return 'text';
}

function buildInitialInlineValue(fieldKey: string, currentValue: unknown, suggestion?: string) {
  if (hasFieldValue(currentValue)) return String(currentValue);
  if (FIELD_OPTION_SETS[fieldKey]?.length) return String(FIELD_OPTION_SETS[fieldKey][0].value);
  if (/date|deadline/i.test(fieldKey)) return '';
  if (/amount|price|cost|offset/i.test(fieldKey)) return '';
  return suggestion && suggestion.length <= 80 ? suggestion : '';
}

function parseInlineValue(fieldKey: string, value: string) {
  const option = FIELD_OPTION_SETS[fieldKey]?.find((item) => String(item.value) === value);
  if (option) return option.value;
  if (/amount|price|cost|offset/i.test(fieldKey)) return Number(value.replace(/[^0-9.]/g, '')) || 0;
  return value.trim();
}

export function ContractAIPanel({ formValues, dealId, onFieldFocus, onAutoFill }: ContractAIPanelProps) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ContractReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fields' | 'dates' | 'tasks' | 'ai'>('overview');
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [tasksCreated, setTasksCreated] = useState(false);
  const [inlineFilledFields, setInlineFilledFields] = useState<Set<string>>(new Set());

  const runReview = async (includeAI = false) => {
    setLoading(true);
    setError(null);
    setInlineFilledFields(new Set());
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
        return { color: 'emerald', icon: CheckCircle2, label: 'Excellent', bg: 'from-emerald-600/20' };
      case 'ready_to_send':
        return { color: 'blue', icon: CheckCircle2, label: 'Ready to Send', bg: 'from-blue-600/20' };
      case 'needs_attention':
        return { color: 'amber', icon: AlertTriangle, label: 'Needs Attention', bg: 'from-amber-600/20' };
      case 'incomplete':
        return { color: 'red', icon: AlertTriangle, label: 'Incomplete', bg: 'from-red-600/20' };
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
      <div className="relative overflow-hidden rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-indigo-500/10 to-slate-950/60 p-3 shadow-[0_14px_32px_rgba(3,12,40,0.45)] backdrop-blur-xl md:p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_60%)]" />
        
        <div className="relative flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Header */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-white md:text-base">Contract AI Review</h3>
              <p className="text-xs text-purple-200/80">Comprehensive analysis & smart suggestions</p>
            </div>
          </div>

          {/* Features List */}
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap xl:justify-center">
            {[
              { icon: ClipboardList, label: 'Field Analysis' },
              { icon: CalendarDays, label: 'Date Validation' },
              { icon: AlertTriangle, label: 'Risk Assessment' },
              { icon: CheckCircle2, label: 'Auto-Tasks' },
            ].map((feature, i) => {
              const FeatureIcon = feature.icon;
              return (
              <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-purple-100/75">
                <FeatureIcon className="h-3.5 w-3.5" />
                <span>{feature.label}</span>
              </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
            <Button
              onClick={() => runReview(false)}
              variant="primary"
              size="sm"
              className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-sm font-semibold shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-indigo-600"
            >
              <Zap className="mr-2 h-4 w-4" />
              Quick Review
            </Button>
            <Button
              onClick={() => runReview(true)}
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs text-purple-200/80 hover:bg-white/10 hover:text-white"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              Deep AI
            </Button>
          </div>
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
  const StatusIcon = statusConfig.icon;
  const unresolvedMissingFields = review.missingRequired.filter((field) => (
    !inlineFilledFields.has(field.field) && !hasFieldValue(formValues[field.field])
  ));
  const missingCriticalCount = unresolvedMissingFields.filter(m => m.severity === 'critical').length;
  const markFieldFilled = (fieldKey: string) => {
    setInlineFilledFields((prev) => new Set([...prev, fieldKey]));
  };

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
                  <StatusIcon className="h-3 w-3" />
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {review.completedFields.length} fields complete • {unresolvedMissingFields.length} missing
              </p>
            </div>
          </div>
          <Button
            onClick={() => runReview(true)}
            variant="ghost"
            size="sm"
            className="text-xs text-purple-300 hover:text-white"
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/5 bg-slate-900/30">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'fields', label: 'Fields', icon: ClipboardList, badge: missingCriticalCount },
          { id: 'dates', label: 'Dates', icon: CalendarDays, badge: review.dateAnalysis.issues.length },
          { id: 'tasks', label: 'Tasks', icon: CheckCircle2, badge: review.suggestedTasks.length },
          ...(review.aiInsights ? [{ id: 'ai', label: 'AI', icon: Bot }] : []),
        ].map((tab: { id: string; label: string; icon: LucideIcon; badge?: number }) => {
          const TabIcon = tab.icon;
          return (
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
              <TabIcon className="h-3.5 w-3.5" />
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
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                <div className={`text-xl font-bold ${missingCriticalCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {missingCriticalCount}
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
                        {risk.level === 'low' ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
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
            {unresolvedMissingFields.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
                <p className="text-sm text-emerald-400 font-semibold mt-2">All Required Fields Complete</p>
                <p className="text-xs text-slate-400 mt-1">Great job! Your contract is well-documented.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-[11px] text-purple-100">
                  Fill missing items right here, or jump to the full contract field below.
                </div>
                {/* Critical */}
                {unresolvedMissingFields.filter(m => m.severity === 'critical').length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Critical (Required)
                    </h4>
                    {unresolvedMissingFields.filter(m => m.severity === 'critical').map((field) => (
                      <FieldItem key={field.field} field={field} currentValue={formValues[field.field]} onFocus={onFieldFocus} onAutoFill={onAutoFill} onFilled={markFieldFilled} />
                    ))}
                  </div>
                )}

                {/* Important */}
                {unresolvedMissingFields.filter(m => m.severity === 'important').length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Important
                    </h4>
                    {unresolvedMissingFields.filter(m => m.severity === 'important').map((field) => (
                      <FieldItem key={field.field} field={field} currentValue={formValues[field.field]} onFocus={onFieldFocus} onAutoFill={onAutoFill} onFilled={markFieldFilled} />
                    ))}
                  </div>
                )}

                {/* Recommended */}
                {unresolvedMissingFields.filter(m => m.severity === 'recommended').length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                      <FileText className="h-3.5 w-3.5" /> Recommended
                    </h4>
                    {unresolvedMissingFields.filter(m => m.severity === 'recommended').map((field) => (
                      <FieldItem key={field.field} field={field} currentValue={formValues[field.field]} onFocus={onFieldFocus} onAutoFill={onAutoFill} onFilled={markFieldFilled} />
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
                <h4 className="flex items-center gap-1 text-xs font-bold text-amber-400 uppercase tracking-wide"><AlertTriangle className="h-3.5 w-3.5" /> Date Issues</h4>
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
              <h4 className="flex items-center gap-1 text-xs font-bold text-slate-300 uppercase tracking-wide"><CalendarDays className="h-3.5 w-3.5" /> Timeline</h4>
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
                        {event.status === 'past' ? <XCircle className="h-3 w-3" /> : event.status === 'imminent' ? <AlertTriangle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
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
                <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
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
                            <Check className="h-3 w-3" strokeWidth={3} />
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
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Tasks Created!
                    </>
                  ) : creatingTasks ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
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
                  <Sparkles className="h-3.5 w-3.5" /> Strengths
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
                  <Wrench className="h-3.5 w-3.5" /> Improvements
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
                  <Target className="h-3.5 w-3.5" /> Next Steps
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
  currentValue,
  onFocus, 
  onAutoFill,
  onFilled,
}: { 
  field: ContractReviewResult['missingRequired'][0];
  currentValue?: unknown;
  onFocus?: (field: string) => void;
  onAutoFill?: (field: string, value: any) => void;
  onFilled?: (field: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => buildInitialInlineValue(field.field, currentValue, field.suggestion));
  const kind = getInlineFieldKind(field.field);
  const options = FIELD_OPTION_SETS[field.field];
  const canFillInline = Boolean(onAutoFill);
  const canApply = kind === 'select' || value.trim().length > 0;

  useEffect(() => {
    if (!editing) {
      setValue(buildInitialInlineValue(field.field, currentValue, field.suggestion));
    }
  }, [currentValue, editing, field.field, field.suggestion]);

  const applyInlineValue = () => {
    if (!onAutoFill || !canApply) return;
    onAutoFill(field.field, parseInlineValue(field.field, value));
    onFilled?.(field.field);
    setEditing(false);
  };

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-2 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{field.label}</p>
          {field.suggestion && (
            <p className="text-[11px] text-slate-400 mt-0.5">{field.suggestion}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {canFillInline && (
            <button
              onClick={() => setEditing((current) => !current)}
              className="text-[10px] text-emerald-200 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20"
            >
              {editing ? 'Close' : 'Fill here'}
            </button>
          )}
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

      {editing && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            {kind === 'select' && options ? (
              <select
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="min-h-[38px] flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {options.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : kind === 'textarea' ? (
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                rows={2}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="min-h-[72px] flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            ) : (
              <input
                type={kind === 'date' ? 'date' : 'text'}
                inputMode={kind === 'number' ? 'decimal' : undefined}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="min-h-[38px] flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            )}

            <Button size="xs" variant="success" onClick={applyInlineValue} disabled={!canApply} className="self-stretch rounded-lg">
              Apply
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span>Updates the contract draft immediately.</span>
            {onFocus && (
              <button
                type="button"
                onClick={() => onFocus(field.field)}
                className="text-purple-300 hover:text-purple-200"
              >
                Open full field
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContractAIPanel;
