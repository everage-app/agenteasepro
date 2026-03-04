import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { leadsApi } from '../../lib/leadsApi';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { MarketingBlast } from './types';

type TargetType = 'lead' | 'client';

type ChannelOption = {
  key: string;
  label: string;
  description: string;
  icon: string;
};

type CadenceOption = {
  key: string;
  label: string;
  hint: string;
};

const channelOptions: ChannelOption[] = [
  { key: 'EMAIL', label: 'Email', description: 'Weekly nurture tips and updates', icon: '📧' },
  { key: 'SMS', label: 'Text', description: 'Quick nudges and check-ins', icon: '💬' },
  { key: 'SOCIAL', label: 'Social', description: 'Engage via social reminders', icon: '📣' },
  { key: 'WEBSITE', label: 'Website', description: 'Landing page touchpoints', icon: '🌐' },
];

const cadenceOptions: CadenceOption[] = [
  { key: 'TWICE_WEEKLY', label: '2x per week', hint: 'High touch' },
  { key: 'WEEKLY', label: 'Weekly', hint: 'Balanced' },
  { key: 'BIWEEKLY', label: 'Every 2 weeks', hint: 'Light nurture' },
  { key: 'MONTHLY', label: 'Monthly', hint: 'Long-term follow-up' },
];

export function MarketingCampaignModal({
  targetType,
  targetName,
  targetEmail,
  leadId,
  clientId,
  defaultBlastId,
  onClose,
  onComplete,
  onOpenMarketing,
}: {
  targetType: TargetType;
  targetName: string;
  targetEmail?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  defaultBlastId?: string;
  onClose: () => void;
  onComplete: () => void;
  onOpenMarketing?: () => void;
}) {
  const [campaignName, setCampaignName] = useState(`Nurture ${targetName}`.trim());
  const [channels, setChannels] = useState<string[]>(['EMAIL']);
  const [cadence, setCadence] = useState('WEEKLY');
  const [notes, setNotes] = useState('');
  const [blasts, setBlasts] = useState<MarketingBlast[]>([]);
  const [blastId, setBlastId] = useState(defaultBlastId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEscapeKey(handleClose, true);

  function handleClose() {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }

  useEffect(() => {
    const fetchBlasts = async () => {
      try {
        const res = await api.get('/marketing/blasts');
        setBlasts(res.data || []);
      } catch (err) {
        console.error('Failed to load marketing blasts:', err);
      }
    };
    fetchBlasts();
  }, []);

  const selectedBlast = useMemo(() => blasts.find((b) => b.id === blastId), [blasts, blastId]);
  const cadenceLabel = cadenceOptions.find((c) => c.key === cadence)?.label || cadence;
  const channelLabel = channels
    .map((c) => channelOptions.find((opt) => opt.key === c)?.label || c)
    .join(', ');

  const toggleChannel = (key: string) => {
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (!campaignName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const title = `Marketing: ${campaignName} • ${targetName}`.trim();
      const descriptionLines = [
        `Target: ${targetName}${targetEmail ? ` (${targetEmail})` : ''}`,
        `Cadence: ${cadenceLabel}`,
        `Channels: ${channelLabel || 'Not specified'}`,
        ...(selectedBlast ? [`Blast: ${selectedBlast.title}`] : []),
        ...(notes.trim() ? [`Notes: ${notes.trim()}`] : []),
      ];

      await api.post('/tasks', {
        title,
        description: descriptionLines.join('\n'),
        category: 'MARKETING',
        bucket: 'THIS_WEEK',
        priority: 'NORMAL',
        clientId: clientId || undefined,
        marketingBlastId: blastId || undefined,
      });

      if (targetType === 'lead' && leadId) {
        const activityLine = `Added to marketing campaign: ${campaignName}${selectedBlast ? ` (Blast: ${selectedBlast.title})` : ''}.`;
        await leadsApi.createActivity(leadId, {
          type: 'CUSTOM',
          description: [activityLine, ...descriptionLines].join('\n'),
        });
      }

      onComplete();
      setIsVisible(false);
      setTimeout(onClose, 200);
    } catch (err: any) {
      console.error('Failed to add to marketing campaign:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to add to marketing campaign. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className={`fixed inset-0 z-[9999] transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xl" onClick={handleClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className={`relative w-full max-w-2xl transform transition-all duration-300 ease-out my-8 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 rounded-[28px] blur-xl opacity-80" />
          <div className="relative rounded-[24px] border border-slate-200/80 dark:border-white/15 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-950/98 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl blur-lg opacity-40" />
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 border border-emerald-400/30">
                      <span className="text-lg">✨</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add to Marketing Campaign</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Nurture {targetType === 'lead' ? 'lead' : 'client'} with a simple, high-touch campaign
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-300 transition-all duration-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 dark:hover:border-red-500/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Campaign name</label>
                  <input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., First-time buyer nurture"
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Cadence</label>
                  <div className="space-y-2">
                    {cadenceOptions.map((option) => (
                      <button
                        type="button"
                        key={option.key}
                        onClick={() => setCadence(option.key)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                          cadence === option.key
                            ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                            : 'border-slate-200/80 bg-white text-slate-600 hover:border-emerald-400/40 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-900/70'
                        }`}
                      >
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Channels</label>
                  <div className="space-y-2">
                    {channelOptions.map((option) => {
                      const active = channels.includes(option.key);
                      return (
                        <button
                          type="button"
                          key={option.key}
                          onClick={() => toggleChannel(option.key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                            active
                              ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                              : 'border-slate-200/80 bg-white text-slate-600 hover:border-cyan-400/40 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-900/70'
                          }`}
                        >
                          <span className="text-lg">{option.icon}</span>
                          <div>
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{option.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Marketing blast (optional)</label>
                  <select
                    value={blastId}
                    onChange={(e) => setBlastId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:[&>option]:bg-slate-900"
                  >
                    <option value="">-- None --</option>
                    {blasts.map((blast) => (
                      <option key={blast.id} value={blast.id}>{blast.title}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => onOpenMarketing?.()}
                    disabled={!onOpenMarketing}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:border-white/20"
                  >
                    Create new blast
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Personalized hook, listing preferences, or next steps..."
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                />
              </div>
            </div>

            <div className="px-6 py-5 bg-slate-100/80 border-t border-slate-200/70 dark:bg-slate-950/60 dark:border-white/5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 font-medium text-sm dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !campaignName.trim()}
                  className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 group-hover:from-emerald-400 group-hover:to-cyan-400 transition-all" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span>🚀</span>
                    )}
                    {loading ? 'Adding…' : 'Add to campaign'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
