import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import api from '../../../lib/api';

type ChannelConnectionType = 'EMAIL' | 'SMS' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'WEBSITE';

type Props = {
  type: ChannelConnectionType | null;
  initialConfig?: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function ChannelSettingsDrawer({ type, initialConfig, open, onClose, onSaved }: Props) {
  const [config, setConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && type) {
      setConfig(initialConfig || {});
    }
  }, [open, type, initialConfig]);

  if (!open || !type) return null;

  const handleSave = async () => {
    if (!type) return;
    setSaving(true);
    try {
      await api.put(`/channels/${type}`, { config });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save channel', err);
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => {
    switch (type) {
      case 'EMAIL':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                From Name
              </label>
              <input
                type="text"
                className="ae-input rounded-full"
                value={config.fromName || ''}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                placeholder="Your Team Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                From Email
              </label>
              <input
                type="email"
                className="ae-input rounded-full"
                value={config.fromEmail || ''}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                placeholder="agent@brokerage.com"
              />
              <p className="text-xs text-slate-400 mt-2">We'll use this on your listing blasts.</p>
            </div>
          </div>
        );
      case 'SMS':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                From Label
              </label>
              <input
                type="text"
                className="ae-input rounded-full"
                value={config.fromLabel || ''}
                onChange={(e) => setConfig({ ...config, fromLabel: e.target.value })}
                placeholder="Smith Team"
              />
              <p className="text-xs text-slate-400 mt-2">Shows at top of text messages.</p>
            </div>
          </div>
        );
      case 'FACEBOOK':
      case 'INSTAGRAM':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                Page Name
              </label>
              <input
                type="text"
                className="ae-input rounded-full"
                value={config.pageName || ''}
                onChange={(e) => setConfig({ ...config, pageName: e.target.value })}
                placeholder="Your Business Page"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                Page URL
              </label>
              <input
                type="url"
                className="ae-input rounded-full"
                value={config.pageUrl || ''}
                onChange={(e) => setConfig({ ...config, pageUrl: e.target.value })}
                placeholder="https://facebook.com/yourpage"
              />
              <p className="text-xs text-slate-400 mt-2">We'll use these for quick links and (later) direct posting.</p>
            </div>
          </div>
        );
      case 'LINKEDIN':
      case 'X':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                className="ae-input rounded-full"
                value={config.displayName || ''}
                onChange={(e) => setConfig({ ...config, displayName: e.target.value })}
                placeholder="@yourusername"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                Profile URL
              </label>
              <input
                type="url"
                className="ae-input rounded-full"
                value={config.profileUrl || ''}
                onChange={(e) => setConfig({ ...config, profileUrl: e.target.value })}
                placeholder={type === 'X' ? 'https://x.com/yourhandle' : 'https://linkedin.com/in/yourprofile'}
              />
            </div>
          </div>
        );
      case 'WEBSITE':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                Primary Website URL
              </label>
              <input
                type="url"
                className="ae-input rounded-full"
                value={config.primaryUrl || ''}
                onChange={(e) => setConfig({ ...config, primaryUrl: e.target.value })}
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider mb-2">
                Listing Spotlight Base URL (Optional)
              </label>
              <input
                type="url"
                className="ae-input rounded-full"
                value={config.listingBaseUrl || ''}
                onChange={(e) => setConfig({ ...config, listingBaseUrl: e.target.value })}
                placeholder="https://yourwebsite.com/listings"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    const titles: Record<ChannelConnectionType, string> = {
      EMAIL: 'Email Settings',
      SMS: 'Text Message Settings',
      FACEBOOK: 'Facebook Settings',
      INSTAGRAM: 'Instagram Settings',
      LINKEDIN: 'LinkedIn Settings',
      X: 'X (Twitter) Settings',
      WEBSITE: 'Website Settings',
    };
    return titles[type];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-md bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gradient-to-b from-white to-slate-50/95 dark:from-slate-950 dark:to-slate-950/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{getTitle()}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Configure your channel connection</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900 dark:hover:bg-white/10 dark:text-slate-400 dark:hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {renderForm()}

          <div className="flex gap-3 pt-6 border-t border-white/10">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-500"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
