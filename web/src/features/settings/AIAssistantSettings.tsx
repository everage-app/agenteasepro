import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';

type AiLevel = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';

const OPTIONS: { value: AiLevel; label: string; description: string }[] = [
  { value: 'OFF', label: 'Off', description: 'Only respond when I explicitly click an AI button.' },
  { value: 'LOW', label: 'Low', description: 'Occasional gentle hints and suggestions.' },
  { value: 'MEDIUM', label: 'Medium', description: 'Smart prompts on key pages (recommended).' },
  { value: 'HIGH', label: 'High', description: 'More proactive help and auto-prepped content.' },
];

export function AIAssistantSettings() {
  const [level, setLevel] = useState<AiLevel>('MEDIUM');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ aiAssistanceLevel: AiLevel }>('/settings/ai');
        if (!cancelled && res.data?.aiAssistanceLevel) {
          setLevel(res.data.aiAssistanceLevel);
        }
      } catch {
        // ignore, use default
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.post('/settings/ai', { aiAssistanceLevel: level });
      setMessage('AI assistance preferences saved.');
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save preferences.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="AI & Assistant"
      subtitle="Control how proactive your AI copilot is across AgentEasePro."
      maxWidth="4xl"
    >
      {(message || error) && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl border backdrop-blur-xl ${
              message
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/30'
                : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-400/30'
            }`}
          >
            <span className="text-lg">{message ? '✅' : '⚠️'}</span>
            <span className="text-sm font-medium">{message || error}</span>
          </div>
        </div>
      )}
      <div className="space-y-6 text-sm text-slate-200">
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
          <h2 className="text-base font-semibold text-white">Assistance level</h2>
          <p className="mt-1 text-xs text-slate-400">
            Choose how much AgentEase should suggest next steps, draft copy, and surface reminders.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {OPTIONS.map((opt) => {
              const isActive = opt.value === level;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(opt.value)}
                  className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition-all ${
                    isActive
                      ? 'border-cyan-400/70 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                      : 'border-white/10 bg-white/5 hover:border-cyan-400/40 hover:bg-cyan-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        opt.value === 'OFF'
                          ? 'bg-slate-500'
                          : opt.value === 'LOW'
                          ? 'bg-emerald-500/70'
                          : opt.value === 'MEDIUM'
                          ? 'bg-cyan-400'
                          : 'bg-blue-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-white">{opt.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{opt.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/40 transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
            {loading && (
              <span className="text-xs text-slate-500">Loading current preferences…</span>
            )}
            {message && !error && null}
            {error && null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 text-xs text-slate-400">
          <h3 className="text-sm font-semibold text-slate-100 mb-1">How this works</h3>
          <p>
            Your selection controls how often AgentEase quietly suggests actions and drafts content across listings, tasks,
            clients, marketing, calendar, and the dashboard. We never send anything without your review, and you can
            change this setting at any time.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}
