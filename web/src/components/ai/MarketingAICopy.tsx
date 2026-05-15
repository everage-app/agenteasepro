import { useState } from 'react';
import { Copy, Lightbulb, Mail, Megaphone, Smartphone, Zap } from 'lucide-react';
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
            <Megaphone className="h-5 w-5" />
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
          <Zap className="mr-2 h-4 w-4" />
          Draft marketing copy
        </Button>
        <p className="text-[10px] text-slate-500 text-center mt-3">
          <Lightbulb className="mr-1 inline h-3 w-3" /> AI crafted for Utah real estate marketing
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/8 via-rose-500/5 to-transparent backdrop-blur-xl p-4 shadow-[0_16px_35px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-400 text-white shadow-md">
            <Megaphone className="h-5 w-5" />
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
              <Mail className="mr-1.5 inline h-4 w-4" /> Email
            </button>
            <button
              onClick={() => setSelectedTab('social')}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedTab === 'social'
                  ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="mr-1.5 inline h-4 w-4" /> Social Media
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
              <Copy className="mr-1 h-4 w-4" />
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
          <Lightbulb className="mr-1 inline h-3 w-3" /> Always review and personalize AI-generated content
        </p>
      </div>
    </div>
  );
}
