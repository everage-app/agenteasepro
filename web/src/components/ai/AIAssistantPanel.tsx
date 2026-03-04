import { useState } from 'react';
import { Button } from '../ui/Button';

interface AIAssistantPanelProps {
  title: string;
  description?: string;
  context: 'repc' | 'tasks' | 'calendar' | 'listing' | 'marketing';
  onSuggest: () => Promise<any>;
  onApply?: (suggestion: any) => void;
  placeholder?: string;
}

export function AIAssistantPanel({
  title,
  description,
  context,
  onSuggest,
  onApply,
  placeholder,
}: AIAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGetSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onSuggest();
      setSuggestions(result);
    } catch (err: any) {
      setError(err.message || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  };

  const getContextIcon = () => {
    switch (context) {
      case 'repc':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'tasks':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'calendar':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'listing':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'marketing':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/8 via-cyan-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-md">
            {getContextIcon()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
            {description && (
              <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {!suggestions && !loading && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-300 mb-3">
              {placeholder || 'Get AI-powered suggestions focused on your Utah real estate business.'}
            </p>
            <Button
              onClick={handleGetSuggestions}
              variant="primary"
              size="sm"
              className="w-full rounded-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Get smart suggestions
            </Button>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-slate-300">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              Analyzing...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-xs text-red-200">{error}</p>
            <Button
              onClick={handleGetSuggestions}
              variant="secondary"
              size="sm"
              className="mt-3 w-full rounded-full"
            >
              Try again
            </Button>
          </div>
        )}

        {suggestions && (
          <div className="space-y-3">
            {/* Render suggestions based on context */}
            {context === 'repc' && suggestions.suggestions && (
              <>
                {suggestions.suggestions.map((sug: any, idx: number) => (
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
                              Important
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300">{sug.suggestion}</p>
                      </div>
                      {onApply && (
                        <button
                          onClick={() => onApply(sug)}
                          className="text-xs text-cyan-300 hover:text-cyan-200 font-medium"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {suggestions.missingFields && suggestions.missingFields.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-xs font-semibold text-amber-200 mb-2">Missing Fields:</p>
                    <ul className="text-sm text-amber-100 space-y-1">
                      {suggestions.missingFields.map((field: string, idx: number) => (
                        <li key={idx}>• {field}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {suggestions.nextSteps && suggestions.nextSteps.length > 0 && (
                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <p className="text-xs font-semibold text-blue-200 mb-2">Next Steps:</p>
                    <ul className="text-sm text-blue-100 space-y-1">
                      {suggestions.nextSteps.map((step: string, idx: number) => (
                        <li key={idx}>• {step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {context === 'tasks' && Array.isArray(suggestions) && (
              <>
                {suggestions.map((task: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 hover:bg-slate-900/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-slate-50 mb-1">{task.title}</h4>
                        <p className="text-xs text-slate-300 mb-2">{task.description}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                            task.category === 'contract' ? 'bg-violet-500/20 text-violet-200' :
                            task.category === 'marketing' ? 'bg-pink-500/20 text-pink-200' :
                            'bg-blue-500/20 text-blue-200'
                          }`}>
                            {task.category.replace('_', ' ')}
                          </span>
                          {task.dueInDays && (
                            <span className="text-slate-400">Due in {task.dueInDays} days</span>
                          )}
                        </div>
                      </div>
                      {onApply && (
                        <button
                          onClick={() => onApply(task)}
                          className="text-xs text-cyan-300 hover:text-cyan-200 font-medium whitespace-nowrap"
                        >
                          Create task
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleGetSuggestions}
                variant="secondary"
                size="sm"
                className="flex-1 rounded-full"
              >
                Refresh
              </Button>
              <Button
                onClick={() => setSuggestions(null)}
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          💡 AgentEasePro AI focuses on Utah real estate workflows and your app features only
        </p>
      </div>
    </div>
  );
}
