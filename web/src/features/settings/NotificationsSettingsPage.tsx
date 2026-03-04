import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../auth/authStore';

interface NotificationPrefs {
  deadlineEmails: boolean;
  dailyPlanEnabled: boolean;
  dailyPlanTime: string;
  inAppBanners: boolean;
  signatureAlerts: boolean;
  documentComplete: boolean;
  marketingSummaries: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export function NotificationsSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const getAuthToken = () => token || localStorage.getItem('utahcontracts_token') || '';
  
  // Notification preferences (matching database schema)
  const [deadlineEmails, setDeadlineEmails] = useState(true);
  const [dailyPlanEnabled, setDailyPlanEnabled] = useState(true);
  const [dailyPlanTime, setDailyPlanTime] = useState('07:00');
  const [inAppBanners, setInAppBanners] = useState(true);
  const [signatureAlerts, setSignatureAlerts] = useState(true);
  const [documentComplete, setDocumentComplete] = useState(true);
  const [marketingSummaries, setMarketingSummaries] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load notification preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const response = await fetch('/api/settings/notifications', {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        
        if (!response.ok) throw new Error('Failed to load preferences');
        
        const data: NotificationPrefs = await response.json();
        
        setDeadlineEmails(data.deadlineEmails ?? true);
        setDailyPlanEnabled(data.dailyPlanEnabled ?? true);
        setDailyPlanTime(data.dailyPlanTime || '07:00');
        setInAppBanners(data.inAppBanners ?? true);
        setSignatureAlerts(data.signatureAlerts ?? true);
        setDocumentComplete(data.documentComplete ?? true);
        setMarketingSummaries(data.marketingSummaries ?? true);
        setQuietHoursStart(data.quietHoursStart || '22:00');
        setQuietHoursEnd(data.quietHoursEnd || '07:00');
        // If quiet hours differ from defaults, assume enabled
        setQuietHoursEnabled(data.quietHoursStart !== '22:00' || data.quietHoursEnd !== '07:00');
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPrefs();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          deadlineEmails,
          dailyPlanEnabled,
          dailyPlanTime,
          inAppBanners,
          signatureAlerts,
          documentComplete,
          marketingSummaries,
          quietHoursStart: quietHoursEnabled ? quietHoursStart : '22:00',
          quietHoursEnd: quietHoursEnabled ? quietHoursEnd : '07:00',
        }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');
      
      setSaveMessage({ type: 'success', text: 'Notification preferences saved!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Toggle switch component
  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {saveMessage && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl border backdrop-blur-xl ${
              saveMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/30'
                : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-400/30'
            }`}
          >
            <span className="text-lg">{saveMessage.type === 'success' ? '✅' : '⚠️'}</span>
            <span className="text-sm font-medium">{saveMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Card className="bg-white/95 dark:bg-gradient-to-br dark:from-blue-500/10 dark:to-cyan-500/10 border-slate-200/70 dark:border-blue-400/30 p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🔔</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">
              Notification Preferences
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Control when and how AgentEase Pro notifies you about deals, tasks, documents, and marketing activity.
            </p>
          </div>
        </div>
      </Card>

      {/* Email Notifications */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">Email Notifications</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose what we email you about</p>
        
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-300 mb-1">Deadline alerts</p>
              <p className="text-xs text-slate-500">Get email alerts for upcoming contract and task deadlines</p>
            </div>
            <Toggle enabled={deadlineEmails} onChange={setDeadlineEmails} />
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-300 mb-1">Marketing summaries</p>
              <p className="text-xs text-slate-500">Weekly campaign performance reports and analytics</p>
            </div>
            <Toggle enabled={marketingSummaries} onChange={setMarketingSummaries} />
          </div>
        </div>
      </Card>

      {/* Daily Plan */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">Daily Plan Email</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Start your day with a summary of your tasks, appointments, and deadlines
            </p>
          </div>
          <Toggle enabled={dailyPlanEnabled} onChange={setDailyPlanEnabled} />
        </div>
        
        {dailyPlanEnabled && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Send at</label>
            <input
              type="time"
              value={dailyPlanTime}
              onChange={(e) => setDailyPlanTime(e.target.value)}
              className="rounded-lg border border-slate-200/70 dark:border-white/10 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-white/5 dark:text-slate-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
        )}
      </Card>

      {/* In-App Notifications */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">In-App Notifications</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Real-time alerts while using AgentEase Pro</p>
        
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-300 mb-1">Banner notifications</p>
              <p className="text-xs text-slate-500">Show notification banners in the app header</p>
            </div>
            <Toggle enabled={inAppBanners} onChange={setInAppBanners} />
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-300 mb-1">E-signature alerts</p>
              <p className="text-xs text-slate-500">Notify when documents are signed or require action</p>
            </div>
            <Toggle enabled={signatureAlerts} onChange={setSignatureAlerts} />
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-300 mb-1">Document completion</p>
              <p className="text-xs text-slate-500">Alert when all parties have signed a document</p>
            </div>
            <Toggle enabled={documentComplete} onChange={setDocumentComplete} />
          </div>
        </div>
      </Card>

      {/* Quiet Hours */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">Quiet Hours</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Non-critical notifications will be suppressed during these hours
            </p>
          </div>
          <Toggle enabled={quietHoursEnabled} onChange={setQuietHoursEnabled} />
        </div>
        
        {quietHoursEnabled && (
          <div className="flex items-center gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Start</label>
              <input
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
                className="rounded-lg border border-slate-200/70 dark:border-white/10 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-white/5 dark:text-slate-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>
            <div className="text-slate-400 dark:text-slate-500 mt-6">→</div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">End</label>
              <input
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
                className="rounded-lg border border-slate-200/70 dark:border-white/10 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-white/5 dark:text-slate-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
