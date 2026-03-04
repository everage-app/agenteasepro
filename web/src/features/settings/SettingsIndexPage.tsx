import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../auth/authStore';

interface SetupProgress {
  profile: boolean;
  branding: boolean;
  integrations: boolean;
  automations: boolean;
  import: boolean;
  notifications: boolean;
}

export function SettingsIndexPage() {
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const token = useAuthStore((s) => s.token);
  const authToken = token || localStorage.getItem('utahcontracts_token') || '';
  const [showHelp, setShowHelp] = useState(false);
  
  const [progress, setProgress] = useState<SetupProgress>({
    profile: false,
    branding: false,
    integrations: false,
    automations: false,
    import: false,
    notifications: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        // Check profile completion
        const profileRes = await fetch('/api/settings/profile', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const hasProfile = profileData?.firstName && profileData?.lastName && profileData?.phone;
        const hasLicense = profileData?.settings?.licenseNumber;

        // Check branding completion
        const brandingRes = await fetch('/api/settings/branding', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const brandingData = brandingRes.ok ? await brandingRes.json() : null;
        const hasBranding = brandingData?.logoUrl || brandingData?.primaryColor !== '#3B82F6';

        // Check notifications touched
        const notifRes = await fetch('/api/settings/notifications', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const notifData = notifRes.ok ? await notifRes.json() : null;
        // Assume notifications are "set up" if quiet hours are enabled or any defaults changed
        const hasNotifications = notifData?.quietHoursEnabled || notifData?.timezone !== 'America/Denver';

        // Check integrations (Google Calendar or any OAuth connected)
        let hasIntegrations = false;
        try {
          const calRes = await fetch('/api/calendar/status', {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const calData = calRes.ok ? await calRes.json() : null;
          hasIntegrations = calData?.connected === true;
        } catch {}
        if (!hasIntegrations) {
          try {
            const chanRes = await fetch('/api/channels', {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            const chanData = chanRes.ok ? await chanRes.json() : [];
            hasIntegrations = Array.isArray(chanData) && chanData.some((c: any) => c.config && Object.keys(c.config).length > 0);
          } catch {}
        }

        // Check automations enabled
        let hasAutomations = false;
        try {
          const autoRes = await fetch('/api/automations', {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const autoData = autoRes.ok ? await autoRes.json() : [];
          hasAutomations = Array.isArray(autoData) && autoData.some((r: any) => r.isEnabled);
        } catch {}

        // Check clients imported
        let hasImport = false;
        try {
          const clientRes = await fetch('/api/clients', {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const clientData = clientRes.ok ? await clientRes.json() : [];
          hasImport = Array.isArray(clientData) && clientData.length > 0;
        } catch {}

        setProgress({
          profile: hasProfile && hasLicense,
          branding: hasBranding,
          integrations: hasIntegrations,
          automations: hasAutomations,
          import: hasImport,
          notifications: hasNotifications,
        });
      } catch (error) {
        console.error('Failed to load settings progress:', error);
        // Fall back to basic checks
        const hasProfile = agent?.name && agent?.email;
        setProgress({
          profile: !!hasProfile,
          branding: false,
          integrations: false,
          automations: false,
          import: false,
          notifications: false,
        });
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [agent, token]);

  const completedSteps = Object.values(progress).filter(Boolean).length;
  const totalSteps = Object.keys(progress).length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const steps = [
    {
      key: 'profile',
      label: 'Profile',
      description: 'Add your name, phone, license, and photo',
      href: '/settings/profile',
      icon: '👤',
    },
    {
      key: 'branding',
      label: 'Branding',
      description: 'Upload logo and manage brokerage details',
      href: '/settings/branding',
      icon: '🎨',
    },
    {
      key: 'integrations',
      label: 'Integrations',
      description: 'Connect Google Calendar or social accounts',
      href: '/settings/integrations',
      icon: '⚡',
    },
    {
      key: 'automations',
      label: 'Automations',
      description: 'Enable default task workflows',
      href: '/settings/automations',
      icon: '🔄',
    },
    {
      key: 'import',
      label: 'Import clients',
      description: 'Bring in your existing client list',
      href: '/settings/data',
      icon: '📁',
    },
    {
      key: 'notifications',
      label: 'Notifications',
      description: 'Choose how we keep you updated',
      href: '/settings/notifications',
      icon: '🔔',
    },
  ];

  const quickActions = [
    {
      title: 'Profile & Settings',
      description: 'Update your personal information',
      href: '/settings/profile',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-400/30',
    },
    {
      title: 'Brokerage & Branding',
      description: 'Customize your brand colors and logo',
      href: '/settings/branding',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      color: 'from-purple-500/20 to-pink-500/10 border-purple-400/30',
    },
    {
      title: 'Integrations & Sync',
      description: 'Connect your calendar and email',
      href: '/settings/integrations',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-400/30',
    },
    {
      title: 'Automations & Workflows',
      description: 'Let AgentEasePro handle the busywork',
      href: '/settings/automations',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'from-amber-500/20 to-orange-500/10 border-amber-400/30',
    },
    {
      title: 'Landing Pages',
      description: 'Create and customize property pages',
      href: '/settings/landing-pages',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      color: 'from-rose-500/20 to-pink-500/10 border-rose-400/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Setup Progress Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/15 border-blue-400/40">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50 mb-1">Getting set up</h2>
            <p className="text-sm text-slate-400">
              {completedSteps === totalSteps
                ? "You're all set! 🎉"
                : `${completedSteps} of ${totalSteps} steps complete`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-cyan-400">{progressPercent}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="grid grid-cols-2 gap-3">
          {steps.map((step) => {
            const isComplete = progress[step.key as keyof SetupProgress];
            return (
              <button
                key={step.key}
                onClick={() => navigate(step.href)}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  isComplete
                    ? 'border-emerald-400/30 bg-emerald-500/10'
                    : 'border-white/20 bg-slate-950/60 hover:bg-slate-950/80 hover:border-cyan-400/30'
                }`}
              >
                <div className="text-xl">{step.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-slate-50">{step.label}</p>
                    {isComplete && (
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{step.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
          Quick actions
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.href}
              onClick={() => navigate(action.href)}
              className={`group p-6 rounded-2xl border bg-gradient-to-br ${action.color} backdrop-blur-xl hover:scale-[1.02] transition-all text-left`}
            >
              <div className="flex items-start gap-4">
                <div className="text-cyan-400 group-hover:text-cyan-300 transition-colors">
                  {action.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-slate-50 mb-1 group-hover:text-white transition-colors">
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                    {action.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Help section */}
      <Card className="p-6 bg-slate-900/60">
        <div className="flex items-start gap-4">
          <div className="text-3xl">💡</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-50 mb-2">Need help getting started?</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Check out our tutorials and guides to make the most of AgentEasePro. 
              Learn how to automate your workflows, create marketing blasts, and close deals faster.
            </p>
            <button
              onClick={() => setShowHelp(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline"
            >
              Browse help center →
            </button>
          </div>
        </div>
      </Card>

      {showHelp && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/70" onClick={() => setShowHelp(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white/95 dark:bg-slate-950/90 border-l border-slate-200/80 dark:border-white/10 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Help Center</h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Getting started</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Finish profile, branding, and integrations to unlock the full platform.</p>
                <button
                  onClick={() => navigate('/settings/profile')}
                  className="mt-3 text-xs text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  Complete profile →
                </button>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Lead capture</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Generate a capture link, embed form, and QR in Integrations.</p>
                <button
                  onClick={() => navigate('/settings/integrations')}
                  className="mt-3 text-xs text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  Go to integrations →
                </button>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Automations</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Enable automated follow‑ups and task flows for new leads.</p>
                <button
                  onClick={() => navigate('/settings/automations')}
                  className="mt-3 text-xs text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  Configure automations →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
