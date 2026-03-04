import { useState } from 'react';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface ListingDescription {
  short: string;
  long: string;
  highlights: string[];
}

interface ListingAIDescriptionProps {
  listingId?: string | null;
  hasAnyListings?: boolean;
  onApply: (description: string, type: 'short' | 'long') => void;
}

export function ListingAIDescription({ listingId, hasAnyListings = true, onApply }: ListingAIDescriptionProps) {
  const [loading, setLoading] = useState(false);
  const [descriptions, setDescriptions] = useState<ListingDescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'short' | 'long'>('short');

  const generateDescriptions = async () => {
    if (!listingId) {
      setError('You need to create or select a listing before generating copy.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/ai/listings/generate-description', {
        listingId,
      });
      setDescriptions(res.data);
    } catch (err: any) {
      console.error('Failed to generate listing description:', err);
      setError(err.response?.data?.error || 'Failed to generate description');
    } finally {
      setLoading(false);
    }
  };

  if (!descriptions && !loading) {
    if (!hasAnyListings) {
      return (
        <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/80 backdrop-blur-xl p-4 text-xs text-slate-200 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
          <h3 className="text-sm font-semibold text-slate-50 mb-2">AI Description Writer</h3>
          <p className="text-xs text-slate-300 mb-3">
            You’ll need at least one listing created before we can generate description copy.
          </p>
          <p className="text-[11px] text-slate-500">
            Start by adding a new listing above. Once it exists, we’ll use its address, price, beds/baths, and notes to draft professional marketing descriptions.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">AI Description Writer</h3>
            <p className="text-[11px] text-slate-400">Generate compelling listing copy</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 mb-3">
          Generate professional listing descriptions in short and long formats, plus highlight bullets.
        </p>
        <Button
          onClick={generateDescriptions}
          variant="primary"
          size="sm"
          className="w-full rounded-full"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate description
        </Button>
        <p className="text-[10px] text-slate-500 text-center mt-3">
          💡 AI crafted for Utah real estate listings
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">AI Description Writer</h3>
            <p className="text-[11px] text-slate-400">Generated listing copy</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Writing description...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200 mb-3">{error}</p>
          <Button
            onClick={generateDescriptions}
            variant="secondary"
            size="sm"
            className="w-full rounded-full"
          >
            Try again
          </Button>
        </div>
      )}

      {descriptions && (
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex gap-2 p-1 rounded-2xl bg-slate-900/50 border border-white/10">
            <button
              onClick={() => setSelectedTab('short')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedTab === 'short'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Short (50-75 words)
            </button>
            <button
              onClick={() => setSelectedTab('long')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedTab === 'long'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Long (150-200 words)
            </button>
          </div>

          {/* Description Display */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {selectedTab === 'short' ? descriptions.short : descriptions.long}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => onApply(selectedTab === 'short' ? descriptions.short : descriptions.long, selectedTab)}
                variant="primary"
                size="sm"
                className="rounded-full"
              >
                Use this description
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(selectedTab === 'short' ? descriptions.short : descriptions.long);
                }}
                variant="secondary"
                size="sm"
                className="rounded-full"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </Button>
            </div>
          </div>

          {/* Highlights */}
          {descriptions.highlights && descriptions.highlights.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
                ✨ Key Highlights
              </h4>
              <ul className="text-sm text-slate-200 space-y-2">
                {descriptions.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={generateDescriptions}
              variant="secondary"
              size="sm"
              className="flex-1 rounded-full"
            >
              Regenerate
            </Button>
            <Button
              onClick={() => setDescriptions(null)}
              variant="outline"
              size="sm"
              className="flex-1 rounded-full"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-[10px] text-slate-500 text-center">
          💡 Always review and edit AI-generated content before publishing
        </p>
      </div>
    </div>
  );
}
