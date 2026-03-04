import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
}: DocumentChecklistProps) {
  const navigate = useNavigate();
  const [formDefs, setFormDefs] = useState<FormDefinition[]>([]);
  const [instances, setInstances] = useState<FormInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

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
        return { color: 'emerald', icon: '✓', label: 'Signed', bg: 'bg-emerald-500/20' };
      case 'sent':
        return { color: 'blue', icon: '→', label: 'Sent', bg: 'bg-blue-500/20' };
      case 'completed':
        return { color: 'purple', icon: '●', label: 'Complete', bg: 'bg-purple-500/20' };
      case 'draft':
        return { color: 'amber', icon: '◐', label: 'In Progress', bg: 'bg-amber-500/20' };
      default:
        return { color: 'slate', icon: '○', label: 'Not Started', bg: 'bg-slate-500/20' };
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
      }
      return;
    }
    // For other forms, navigate to form editor
    navigate(`/deals/${dealId}/forms/${code}`);
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
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-600/10 via-slate-900/40 to-slate-950/60 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Document Checklist</h3>
              <p className="text-xs text-cyan-200/70">{completedRequired} of {requiredForms.length} required complete</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress Ring */}
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 transform -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-slate-700"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                  strokeDashoffset="0"
                  className="text-cyan-400 transition-all duration-500"
                  style={{ strokeDasharray: `${progressPercent * 1.005} 100` }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                {progressPercent}%
              </span>
            </div>
            {/* Expand Arrow */}
            <svg 
              className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
              return (
                <span
                  key={form.code}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} text-${config.color}-300`}
                  title={`${form.name}: ${config.label}`}
                >
                  <span>{config.icon}</span>
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
          <div className="p-4">
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide mb-3">
              📋 Required Documents
            </h4>
            <div className="space-y-2">
              {UTAH_TRANSACTION_FORMS.filter(f => f.required).map(form => {
                const { status, instance } = getFormStatus(form.code);
                const config = getStatusConfig(status);
                
                return (
                  <div
                    key={form.code}
                    className="flex items-center justify-between rounded-xl bg-slate-800/40 p-3 hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                        <span className={`text-sm text-${config.color}-400`}>{config.icon}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{form.name}</p>
                        <p className={`text-[10px] text-${config.color}-300`}>{config.label}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFormAction(form.code, status)}
                      className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
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
          <div className="p-4 border-t border-white/5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">
              📄 Optional Documents
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {UTAH_TRANSACTION_FORMS.filter(f => !f.required).map(form => {
                const { status } = getFormStatus(form.code);
                const config = getStatusConfig(status);
                
                return (
                  <button
                    key={form.code}
                    onClick={() => handleFormAction(form.code, status)}
                    className="flex items-center gap-2 rounded-lg bg-slate-800/30 p-2 hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <span className={`text-xs text-${config.color}-400`}>{config.icon}</span>
                    <span className="text-[11px] text-slate-300 truncate">{form.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          {hasRepc && repcStatus === 'draft' && onSendRepc && (
            <div className="p-4 border-t border-white/5 bg-gradient-to-r from-cyan-500/10 to-transparent">
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
