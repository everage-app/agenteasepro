import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Lightbulb, Zap } from 'lucide-react';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface RepcAIAssistantProps {
  formValues: any;
  dealId: string;
  onApply?: (field: string, value: any) => void;
}

interface RepcSuggestion {
  field: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

interface RepcAssistResponse {
  suggestions: RepcSuggestion[];
  missingFields: string[];
  nextSteps: string[];
}

export function RepcAIAssistant({ formValues, dealId, onApply }: RepcAIAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RepcAssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const getSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/ai/repc/assist', {
        formValues,
        context: {
          dealId,
          state: 'UT',
        },
      });
      setSuggestions(res.data);
      setIsExpanded(true);
    } catch (err: any) {
      console.error('Failed to get REPC suggestions:', err);
      setError(err.response?.data?.error || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  };

  if (!isExpanded && !loading && !suggestions) {
    return (
      <div className="ae-ai-panel relative overflow-hidden rounded-2xl border border-[#f2d894]/[0.22] bg-gradient-to-br from-[#141d2b]/[0.94] via-[#0b1220]/[0.90] to-[#07090d]/[0.94] backdrop-blur-xl p-4 shadow-[0_18px_40px_rgba(0,0,0,0.58)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,181,109,0.16),transparent_60%)]" />
        <div className="relative flex items-center gap-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f2d894] to-[#9f7933] text-[#171106] shadow-[0_8px_18px_rgba(214,181,109,0.24)]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">AgentEasePro AI</h3>
            <p className="text-[11px] text-[#f2d894]/[0.82]">Instant REPC review & missing-field checks</p>
          </div>
        </div>
        <p className="relative text-xs text-slate-200 mb-4">
          Get a quick quality check before you send. We highlight missing fields, key dates, and next steps.
        </p>
        <Button
          onClick={getSuggestions}
          variant="primary"
          size="sm"
          className="w-full rounded-full text-xs font-semibold shadow-[0_8px_18px_rgba(214,181,109,0.24)]"
        >
          <Zap className="mr-2 h-4 w-4" />
          Review my REPC
        </Button>
        <p className="relative text-[10px] text-[#f2d894]/[0.72] text-center mt-3">
          <Lightbulb className="mr-1 inline h-3 w-3" /> Utah-only guidance • always review against the official form
        </p>
      </div>
    );
  }

  return (
    <div className="ae-ai-panel rounded-2xl border border-[#f2d894]/[0.22] bg-gradient-to-br from-[#141d2b]/[0.94] via-[#0b1220]/[0.90] to-[#07090d]/[0.94] backdrop-blur-xl p-4 shadow-[0_18px_40px_rgba(0,0,0,0.58)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f2d894] to-[#9f7933] text-[#171106] shadow-md shadow-[#d6b56d]/[0.20]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">AgentEasePro AI</h3>
            <p className="text-[11px] text-slate-400">REPC review results</p>
          </div>
        </div>
        {suggestions && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f2d894] border-t-transparent" />
            Reviewing REPC...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200 mb-3">{error}</p>
          <Button
            onClick={getSuggestions}
            variant="secondary"
            size="sm"
            className="w-full rounded-full"
          >
            Try again
          </Button>
        </div>
      )}

      {suggestions && isExpanded && (
        <div className="space-y-4">
          {/* Suggestions */}
          {suggestions.suggestions && suggestions.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
                <Lightbulb className="mr-1 inline h-3.5 w-3.5" /> Suggestions
              </h4>
              {suggestions.suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#f2d894]/[0.12] bg-[#0d141f]/[0.70] p-4 hover:bg-[#141d2b]/[0.86] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-200">{sug.field}</span>
                        {sug.priority === 'high' && (
                          <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Important
                          </span>
                        )}
                        {sug.priority === 'medium' && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Review
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{sug.suggestion}</p>
                    </div>
                    {onApply && (
                      <button
                        onClick={() => onApply(sug.field, sug.suggestion)}
                        className="text-xs text-[#f2d894] hover:text-[#f7e7b0] font-medium whitespace-nowrap"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Missing Fields */}
          {suggestions.missingFields && suggestions.missingFields.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-200 mb-2">
                <FileText className="mr-1 inline h-3.5 w-3.5" /> Missing Fields
              </h4>
              <ul className="text-sm text-amber-100 space-y-1">
                {suggestions.missingFields.map((field, idx) => (
                  <li key={idx}>• {field}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {suggestions.nextSteps && suggestions.nextSteps.length > 0 && (
            <div className="rounded-2xl border border-[#f2d894]/[0.24] bg-[#d6b56d]/[0.10] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#f2d894] mb-2">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Next Steps
              </h4>
              <ul className="text-sm text-[#f7e7b0] space-y-1">
                {suggestions.nextSteps.map((step, idx) => (
                  <li key={idx}>• {step}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              onClick={getSuggestions}
              variant="secondary"
              size="sm"
              className="flex-1 rounded-full"
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                setSuggestions(null);
                setIsExpanded(false);
              }}
              variant="outline"
              size="sm"
              className="flex-1 rounded-full"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {suggestions && !isExpanded && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">
            Found {suggestions.suggestions.length} suggestions, {suggestions.missingFields.length} missing fields
          </p>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-[#f2d894] hover:text-[#f7e7b0] font-medium"
          >
            View details →
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          <Lightbulb className="mr-1 inline h-3 w-3" /> For general legal advice, consult your broker or attorney
        </p>
      </div>
    </div>
  );
}
