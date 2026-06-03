import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Circle, CircleDot, Clock3, FileText, Send } from 'lucide-react';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface FormDefinition {
  id: string;
  code: string;
  displayName: string;
  description?: string;
  category?: string;
  isRequired?: boolean;
}

interface FormInstance {
  id: string;
  formDefinitionId: string;
  status: 'DRAFT' | 'COMPLETED' | 'SENT' | 'SIGNED';
  data: Record<string, any>;
  definition?: FormDefinition;
}

interface DocumentChecklistProps {
  dealId: string;
  hasRepc?: boolean;
  repcStatus?: 'draft' | 'sent' | 'signed';
  onStartRepc?: () => void;
  onEditRepc?: () => void;
  onSendRepc?: () => void;
  defaultExpanded?: boolean;
}

// Utah transaction typical forms
const UTAH_TRANSACTION_FORMS = [
  { code: 'REPC', name: 'Real Estate Purchase Contract', required: true, category: 'Contract' },
  { code: 'ADDENDUM', name: 'Buyer/Seller Addendum', required: false, category: 'Addendum' },
  { code: 'COUNTER', name: 'Counter Offer', required: false, category: 'Negotiation' },
  { code: 'SPDS', name: 'Seller Property Disclosure', required: true, category: 'Disclosure' },
  { code: 'LEAD', name: 'Lead-Based Paint Disclosure', required: true, category: 'Disclosure' },
  { code: 'AGENCY', name: 'Agency Disclosure', required: true, category: 'Disclosure' },
  { code: 'WIRE', name: 'Wire Fraud Advisory', required: true, category: 'Advisory' },
  { code: 'HOMEWARRANTY', name: 'Home Warranty Agreement', required: false, category: 'Optional' },
];

export function DocumentChecklist({ 
  dealId, 
  hasRepc, 
  repcStatus,
  onStartRepc,
  onEditRepc,
  onSendRepc,
  defaultExpanded = false,
}: DocumentChecklistProps) {
  const navigate = useNavigate();
  const [formDefs, setFormDefs] = useState<FormDefinition[]>([]);
  const [instances, setInstances] = useState<FormInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    loadData();
  }, [dealId]);

  const loadData = async () => {
    try {
      const [defsRes, instancesRes] = await Promise.all([
        api.get('/forms/definitions'),
        api.get(`/forms/deals/${dealId}/forms`),
      ]);
      setFormDefs(defsRes.data);
      setInstances(instancesRes.data);
    } catch (err) {
      console.error('Failed to load form data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFormStatus = (code: string): { status: 'not_started' | 'draft' | 'completed' | 'sent' | 'signed'; instance?: FormInstance } => {
    // Special handling for REPC
    if (code === 'REPC') {
      if (!hasRepc) return { status: 'not_started' };
      if (repcStatus === 'signed') return { status: 'signed' };
      if (repcStatus === 'sent') return { status: 'sent' };
      return { status: 'draft' };
    }

    const instance = instances.find(i => i.definition?.code === code);
    if (!instance) return { status: 'not_started' };
    
    switch (instance.status) {
      case 'SIGNED': return { status: 'signed', instance };
      case 'SENT': return { status: 'sent', instance };
      case 'COMPLETED': return { status: 'completed', instance };
      default: return { status: 'draft', instance };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'signed':
        return { icon: CheckCircle2, label: 'Signed', bg: 'bg-emerald-500/20', text: 'text-emerald-300' };
      case 'sent':
        return { icon: Send, label: 'Sent', bg: 'bg-blue-500/20', text: 'text-blue-300' };
      case 'completed':
        return { icon: CircleDot, label: 'Complete', bg: 'bg-purple-500/20', text: 'text-purple-300' };
      case 'draft':
        return { icon: Clock3, label: 'In Progress', bg: 'bg-amber-500/20', text: 'text-amber-300' };
      default:
        return { icon: Circle, label: 'Not Started', bg: 'bg-slate-500/20', text: 'text-slate-300' };
    }
  };

  // Calculate progress
  const requiredForms = UTAH_TRANSACTION_FORMS.filter(f => f.required);
  const completedRequired = requiredForms.filter(f => {
    const { status } = getFormStatus(f.code);
    return ['completed', 'sent', 'signed'].includes(status);
  }).length;
  const progressPercent = Math.round((completedRequired / requiredForms.length) * 100);

  const handleFormAction = (code: string, status: string) => {
    if (code === 'REPC') {
      if (status === 'not_started' && onStartRepc) {
        onStartRepc();
      } else if (onEditRepc) {
        onEditRepc();
      } else {
        navigate(`/contracts/${dealId}`);
      }
      return;
    }
    // For other forms, navigate to form editor
    navigate(`/contracts/${dealId}/forms/${code}`);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm text-slate-400">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-600/10 via-slate-900/40 to-slate-950/60 backdrop-blur-xl">
      {/* Header */}
      <div 
        className="cursor-pointer p-3 transition-colors hover:bg-white/5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-white">Document Checklist</h3>
              <p className="text-xs text-cyan-200/70">{completedRequired} of {requiredForms.length} required complete</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Progress Ring */}
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-slate-700"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                  strokeDashoffset="0"
                  className="text-cyan-400 transition-all duration-500"
                  style={{ strokeDasharray: `${progressPercent * 1.005} 100` }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-cyan-300">
                {progressPercent}%
              </span>
            </div>
            {/* Expand Arrow */}
            <svg 
              className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Collapsed Quick View */}
        {!isExpanded && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {UTAH_TRANSACTION_FORMS.filter(f => f.required).map(form => {
              const { status } = getFormStatus(form.code);
              const config = getStatusConfig(status);
              const StatusIcon: LucideIcon = config.icon;
              return (
                <span
                  key={form.code}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}
                  title={`${form.name}: ${config.label}`}
                >
                  <StatusIcon className="h-3 w-3" strokeWidth={2.2} />
                  <span>{form.code}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/5">
          {/* Required Documents */}
          <div className="p-3">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-cyan-400">
              <span className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Required Documents</span>
            </h4>
            <div className="space-y-2">
              {UTAH_TRANSACTION_FORMS.filter(f => f.required).map(form => {
                const { status, instance } = getFormStatus(form.code);
                const config = getStatusConfig(status);
                const StatusIcon: LucideIcon = config.icon;
                
                return (
                  <div
                    key={form.code}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/40 p-2 transition-colors hover:bg-slate-800/60"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${config.text}`} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{form.name}</p>
                        <p className={`text-[10px] ${config.text}`}>{config.label}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFormAction(form.code, status)}
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                        status === 'not_started'
                          ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                          : status === 'signed'
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {status === 'not_started' ? 'Start' : 
                       status === 'signed' ? 'View' : 
                       status === 'sent' ? 'Track' : 'Edit'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Documents */}
          <div className="border-t border-white/5 p-3">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <span className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Optional Documents</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {UTAH_TRANSACTION_FORMS.filter(f => !f.required).map(form => {
                const { status } = getFormStatus(form.code);
                const config = getStatusConfig(status);
                const StatusIcon: LucideIcon = config.icon;
                
                return (
                  <button
                    key={form.code}
                    onClick={() => handleFormAction(form.code, status)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-800/30 p-2 text-left transition-colors hover:bg-slate-800/50"
                  >
                    <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${config.text}`} strokeWidth={2.2} />
                    <span className="truncate text-[10px] text-slate-300">{form.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          {hasRepc && repcStatus === 'draft' && onSendRepc && (
            <div className="border-t border-white/5 bg-gradient-to-r from-cyan-500/10 to-transparent p-3">
              <Button
                onClick={onSendRepc}
                variant="primary"
                size="sm"
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send REPC for e-Sign
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentChecklist;
