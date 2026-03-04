import { useState } from 'react';
import api from '../../lib/api';
import { Button } from '../ui/Button';

interface MarketingCopy {
  emailSubject: string;
  emailBody: string;
  socialCaption: string;
}

interface MarketingAICopyProps {
  blastType: 'new_listing' | 'open_house' | 'price_drop' | 'just_sold' | 'general';
  propertyData?: any;
  onApply: (copy: MarketingCopy) => void;
}

export function MarketingAICopy({ blastType, propertyData, onApply }: MarketingAICopyProps) {
  const [loading, setLoading] = useState(false);
  const [copy, setCopy] = useState<MarketingCopy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'email' | 'social'>('email');

  const generateCopy = async () => {
    setLoading(true);
    setError(null);
    try {
          const res = await api.post('/ai/marketing/generate-copy', {
        type: blastType,
        propertyData: propertyData || {},
      });
      setCopy(res.data);
    } catch (err: any) {
      console.error('Failed to generate marketing copy:', err);
      setError(err.response?.data?.error || 'Failed to generate copy');
    } finally {
      setLoading(false);
    }
  };

  const getBlastTypeLabel = () => {
    switch (blastType) {
      case 'new_listing':
        return 'New Listing';
      case 'open_house':
        return 'Open House';
      case 'price_drop':
        return 'Price Reduction';
      case 'just_sold':
        return 'Just Sold';
      case 'general':
        return 'General Update';
      default:
        return 'Marketing';
    }
  };

  if (!copy && !loading) {
    return (
      <div className="rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/8 via-rose-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-400 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">AI Marketing Copy</h3>
            <p className="text-[11px] text-slate-400">{getBlastTypeLabel()} campaign</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 mb-3">
          Generate professional email subject, body, and social media captions for your {getBlastTypeLabel().toLowerCase()} blast.
        </p>
        <Button
          onClick={generateCopy}
          variant="primary"
          size="sm"
          className="w-full rounded-full"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Draft marketing copy
        </Button>
        <p className="text-[10px] text-slate-500 text-center mt-3">
          💡 AI crafted for Utah real estate marketing
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/8 via-rose-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-400 text-white shadow-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50">AI Marketing Copy</h3>
            <p className="text-[11px] text-slate-400">{getBlastTypeLabel()} - Generated copy</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
            Crafting copy...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200 mb-3">{error}</p>
          <Button
            onClick={generateCopy}
            variant="secondary"
            size="sm"
            className="w-full rounded-full"
          >
            Try again
          </Button>
        </div>
      )}

      {copy && (
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex gap-2 p-1 rounded-2xl bg-slate-900/50 border border-white/10">
            <button
              onClick={() => setSelectedTab('email')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedTab === 'email'
                  ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📧 Email
            </button>
            <button
              onClick={() => setSelectedTab('social')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedTab === 'social'
                  ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📱 Social Media
            </button>
          </div>

          {/* Email Copy */}
          {selectedTab === 'email' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                  Subject Line
                </h4>
                <p className="text-sm text-slate-50 font-medium">{copy.emailSubject}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                  Email Body
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {copy.emailBody}
                </p>
              </div>
            </div>
          )}

          {/* Social Copy */}
          {selectedTab === 'social' && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                Social Caption
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {copy.socialCaption}
              </p>
              <div className="mt-3 text-xs text-slate-400">
                {copy.socialCaption.length} characters
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => onApply(copy)}
              variant="primary"
              size="sm"
              className="flex-1 rounded-full"
            >
              Use this copy
            </Button>
            <Button
              onClick={() => {
                const textToCopy = selectedTab === 'email' 
                  ? `Subject: ${copy.emailSubject}\n\n${copy.emailBody}`
                  : copy.socialCaption;
                navigator.clipboard.writeText(textToCopy);
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

          <div className="flex gap-2">
            <Button
              onClick={generateCopy}
              variant="secondary"
              size="sm"
              className="flex-1 rounded-full"
            >
              Regenerate
            </Button>
            <Button
              onClick={() => setCopy(null)}
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
          💡 Always review and personalize AI-generated content
        </p>
      </div>
    </div>
  );
}
