import { useState } from 'react';
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
      <div className="relative overflow-hidden rounded-2xl border border-blue-400/30 bg-gradient-to-br from-blue-600/15 via-cyan-500/10 to-slate-950/60 backdrop-blur-xl p-4 shadow-[0_18px_40px_rgba(3,12,40,0.6)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_60%)]" />
        <div className="relative flex items-center gap-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-[0_8px_18px_rgba(59,130,246,0.35)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">AgentEasePro AI</h3>
            <p className="text-[11px] text-cyan-200/80">Instant REPC review & missing-field checks</p>
          </div>
        </div>
        <p className="relative text-xs text-slate-200 mb-4">
          Get a quick quality check before you send. We highlight missing fields, key dates, and next steps.
        </p>
        <Button
          onClick={getSuggestions}
          variant="primary"
          size="sm"
          className="w-full rounded-full text-xs font-semibold shadow-[0_8px_18px_rgba(37,99,235,0.3)]"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Review my REPC
        </Button>
        <p className="relative text-[10px] text-cyan-200/70 text-center mt-3">
          💡 Utah-only guidance • always review against the official form
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-400/30 bg-gradient-to-br from-blue-600/15 via-cyan-500/10 to-slate-950/60 backdrop-blur-xl p-4 shadow-[0_18px_40px_rgba(3,12,40,0.6)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
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
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
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
                💡 Suggestions
              </h4>
              {suggestions.suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 hover:bg-slate-900/70 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-200">{sug.field}</span>
                        {sug.priority === 'high' && (
                          <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                            🚨 Important
                          </span>
                        )}
                        {sug.priority === 'medium' && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                            ⚠️ Review
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{sug.suggestion}</p>
                    </div>
                    {onApply && (
                      <button
                        onClick={() => onApply(sug.field, sug.suggestion)}
                        className="text-xs text-cyan-300 hover:text-cyan-200 font-medium whitespace-nowrap"
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
                📋 Missing Fields
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
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-200 mb-2">
                ✅ Next Steps
              </h4>
              <ul className="text-sm text-blue-100 space-y-1">
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
            className="text-xs text-cyan-300 hover:text-cyan-200 font-medium"
          >
            View details →
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          💡 For general legal advice, consult your broker or attorney
        </p>
      </div>
    </div>
  );
}
