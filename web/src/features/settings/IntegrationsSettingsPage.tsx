import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from '../../components/ui/Card';
import api from '../../lib/api';

interface ChannelConnection {
  id: string;
  type: string;
  status: 'connected' | 'disconnected';
  displayName?: string;
  email?: string;
}

interface LandingPageOption {
  id: string;
  title: string;
  slug: string;
}

type QRCodeType = 'lead-capture' | 'landing-page' | 'custom';

export function IntegrationsSettingsPage() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [defaultSourceLabel, setDefaultSourceLabel] = useState('');
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [followUpMinutes, setFollowUpMinutes] = useState(15);
  const [assignToLabel, setAssignToLabel] = useState('');
  const [aiScoringEnabled, setAiScoringEnabled] = useState(true);
  const [autoPriorityEnabled, setAutoPriorityEnabled] = useState(true);
  const [spamShieldEnabled, setSpamShieldEnabled] = useState(true);
  const [spamThreshold, setSpamThreshold] = useState(6);
  const [hcaptchaSiteKey, setHcaptchaSiteKey] = useState('');
  const [hcaptchaSecret, setHcaptchaSecret] = useState('');
  const [sequenceCallMinutes, setSequenceCallMinutes] = useState(5);
  const [sequenceSmsMinutes, setSequenceSmsMinutes] = useState(30);
  const [sequenceEmailMinutes, setSequenceEmailMinutes] = useState(120);
  const [campaignLabel, setCampaignLabel] = useState('');
  const [campaignPriority, setCampaignPriority] = useState('WARM');
  const [savingWebsite, setSavingWebsite] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<{
    days: number;
    sourceLabels: Array<{ label: string; count: number }>;
    leadSources: Array<{ source: string; count: number }>;
  } | null>(null);
  // QR Code Generator state
  const [qrCodeType, setQrCodeType] = useState<QRCodeType>('lead-capture');
  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [selectedLandingPage, setSelectedLandingPage] = useState<string>('');
  const [customQrUrl, setCustomQrUrl] = useState('');
  // OAuth status state
  const [oauthStatus, setOauthStatus] = useState<Record<string, { connected: boolean; displayName?: string }>>({});
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadChannels();
    loadLandingPages();
    loadOAuthStatus();

    // Handle OAuth callback results from URL params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected) {
      setOauthMessage({ type: 'success', text: `Successfully connected ${connected}!` });
      // Clear the URL params
      setSearchParams({});
      // Reload status
      loadOAuthStatus();
      loadChannels();
    } else if (error) {
      setOauthMessage({ type: 'error', text: `Connection failed: ${error.replace(/_/g, ' ')}` });
      setSearchParams({});
    }
  }, []);

  // Auto-hide oauth message after 5 seconds
  useEffect(() => {
    if (oauthMessage) {
      const timer = setTimeout(() => setOauthMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [oauthMessage]);

  const loadOAuthStatus = async () => {
    try {
      const res = await api.get('/oauth/status');
      setOauthStatus(res.data || {});
    } catch (error) {
      console.error('Failed to load OAuth status:', error);
    }
  };

  const loadLandingPages = async () => {
    try {
      const res = await api.get('/landing-pages');
      setLandingPages(res.data || []);
      if (res.data?.length > 0) {
        setSelectedLandingPage(res.data[0].slug);
      }
    } catch (error) {
      console.error('Failed to load landing pages:', error);
    }
  };

  const loadChannels = async () => {
    try {
      const res = await api.get('/channels');
      setChannels(res.data);
      const websiteChannel = (res.data as ChannelConnection[]).find((c) => c.type === 'WEBSITE');
      const config = (websiteChannel as any)?.config || {};
      setWebsiteUrl(config.primaryUrl || '');
      setWebhookToken(config.webhookToken || '');
      setDefaultSourceLabel(config.defaultSourceLabel || 'Website');
      setFollowUpEnabled(Boolean(config.followUpEnabled ?? true));
      setFollowUpMinutes(Number(config.followUpMinutes || 15));
      setAssignToLabel(config.assignToLabel || '');
      setAiScoringEnabled(Boolean(config.aiScoringEnabled ?? true));
      setAutoPriorityEnabled(Boolean(config.autoPriorityEnabled ?? true));
      setSpamShieldEnabled(Boolean(config.spamShieldEnabled ?? true));
      setSpamThreshold(Number(config.spamThreshold || 6));
      setHcaptchaSiteKey(config.hcaptchaSiteKey || '');
      setHcaptchaSecret(config.hcaptchaSecret || '');
      const seq = Array.isArray(config.followUpSequence) ? config.followUpSequence : [];
      setSequenceCallMinutes(Number(seq.find((s: any) => s.type === 'CALL')?.minutes || 5));
      setSequenceSmsMinutes(Number(seq.find((s: any) => s.type === 'SMS')?.minutes || 30));
      setSequenceEmailMinutes(Number(seq.find((s: any) => s.type === 'EMAIL')?.minutes || 120));
      await loadSourceStats();
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSourceStats = async () => {
    try {
      const res = await api.get('/leads/analytics/integration-sources', { params: { days: 30 } });
      setSourceStats(res.data);
    } catch (error) {
      console.error('Failed to load source stats:', error);
    }
  };

  const handleConnect = async (type: string) => {
    try {
      // Map integration type to OAuth provider
      const providerMap: Record<string, string> = {
        GOOGLE: 'google',
        FACEBOOK: 'facebook',
        INSTAGRAM: 'instagram',
        LINKEDIN: 'linkedin',
      };

      const provider = providerMap[type];
      if (!provider) {
        alert(`${type} integration is not yet available.`);
        return;
      }

      // Call OAuth connect endpoint to get authorization URL
      const res = await api.get(`/oauth/${provider}/connect`);
      
      if (res.data?.url) {
        // Redirect to OAuth provider
        window.location.href = res.data.url;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Failed to initiate OAuth:', error);
      const message = error.response?.data?.error || error.message || 'Failed to connect. Please try again.';
      alert(message);
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    
    try {
      const providerMap: Record<string, string> = {
        GOOGLE: 'google',
        FACEBOOK: 'facebook',
        INSTAGRAM: 'instagram',
        LINKEDIN: 'linkedin',
      };

      const provider = providerMap[type];
      if (provider) {
        await api.delete(`/oauth/${provider}/disconnect`);
      }
      
      alert('Disconnected successfully!');
      loadChannels();
      loadOAuthStatus();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect. Please try again.');
    }
  };

  const getChannel = (type: string) => channels.find(c => c.type === type);
  
  // Check if an integration is connected via OAuth or channel
  const isIntegrationConnected = (type: string): boolean => {
    // Check OAuth status first
    const oauthMap: Record<string, string> = {
      GOOGLE: 'google',
      FACEBOOK: 'facebook',
      INSTAGRAM: 'instagram',
      LINKEDIN: 'linkedin',
    };
    const oauthProvider = oauthMap[type];
    if (oauthProvider && oauthStatus[oauthProvider]?.connected) {
      return true;
    }
    // Fall back to channel status
    const channel = getChannel(type);
    return channel?.status === 'connected';
  };

  const getIntegrationDisplayName = (type: string): string | undefined => {
    const oauthMap: Record<string, string> = {
      GOOGLE: 'google',
      FACEBOOK: 'facebook',
      INSTAGRAM: 'instagram',
      LINKEDIN: 'linkedin',
    };
    const oauthProvider = oauthMap[type];
    if (oauthProvider && oauthStatus[oauthProvider]?.displayName) {
      return oauthStatus[oauthProvider].displayName;
    }
    const channel = getChannel(type);
    return channel?.displayName;
  };

  const generateToken = () => {
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setWebhookToken(token);
  };

  const saveWebsiteIntegration = async () => {
    if (!webhookToken) {
      setTestError('Generate a webhook token first.');
      return;
    }
    try {
      setSavingWebsite(true);
      setTestError(null);
      setTestStatus(null);
      await api.put('/channels/WEBSITE', {
        config: {
          primaryUrl: websiteUrl.trim() || undefined,
          webhookToken,
          leadCaptureEnabled: true,
          defaultSourceLabel: defaultSourceLabel.trim() || 'Website',
          followUpEnabled,
          followUpMinutes: followUpMinutes || 15,
          assignToLabel: assignToLabel.trim() || undefined,
          aiScoringEnabled,
          autoPriorityEnabled,
          spamShieldEnabled,
          spamThreshold,
          hcaptchaSiteKey: hcaptchaSiteKey.trim() || undefined,
          hcaptchaSecret: hcaptchaSecret.trim() || undefined,
          followUpSequence: [
            { type: 'CALL', minutes: sequenceCallMinutes },
            { type: 'SMS', minutes: sequenceSmsMinutes },
            { type: 'EMAIL', minutes: sequenceEmailMinutes },
          ],
        },
      });
      await loadChannels();
      setTestStatus('Website integration saved.');
    } catch (error) {
      console.error('Failed to save website integration:', error);
      setTestError('Failed to save website integration.');
    } finally {
      setSavingWebsite(false);
    }
  };

  const sendTestLead = async () => {
    if (!webhookToken) {
      setTestError('Generate and save a webhook token first.');
      return;
    }
    try {
      setTestError(null);
      setTestStatus(null);
      const email = `test+${Date.now()}@agentease.dev`;
      await api.post(
        '/integrations/website-leads',
        {
          name: 'Website Test Lead',
          email,
          source: 'WEBSITE',
          priority: 'WARM',
          notes: 'Test lead created from Integrations settings.',
          websiteUrl: websiteUrl.trim() || undefined,
        },
        {
          headers: { 'x-agentease-token': webhookToken },
        },
      );
      setTestStatus('Test lead sent. Check your Leads list.');
    } catch (error) {
      console.error('Failed to send test lead:', error);
      setTestError('Failed to send test lead.');
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`${label} copied.`);
      setTimeout(() => setCopyNotice(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyNotice('Copy failed.');
      setTimeout(() => setCopyNotice(null), 2000);
    }
  };

  const leadCaptureUrl = `${window.location.origin}/api/integrations/lead-capture?token=${
    webhookToken || 'YOUR_TOKEN'
  }${defaultSourceLabel ? `&label=${encodeURIComponent(defaultSourceLabel.trim())}` : ''}`;

  const campaignParams = new URLSearchParams();
  campaignParams.set('token', webhookToken || 'YOUR_TOKEN');
  if (campaignLabel) campaignParams.set('label', campaignLabel.trim());
  if (campaignPriority) campaignParams.set('priority', campaignPriority);
  const campaignUrl = `${window.location.origin}/api/integrations/lead-capture?${campaignParams.toString()}`;

  const integrations = [
    {
      name: 'Google',
      type: 'GOOGLE',
      icon: '🔵',
      color: 'from-blue-500/20 to-blue-400/10 border-blue-400/30',
      description: 'Sync your Google Calendar and send emails through Gmail',
      features: [
        'Two-way calendar sync',
        'Send emails from your Gmail address',
        'Import contacts',
      ],
    },
    {
      name: 'Microsoft 365',
      type: 'MICROSOFT',
      icon: '🔷',
      color: 'from-blue-600/20 to-cyan-500/10 border-cyan-400/30',
      description: 'Connect Outlook calendar and email',
      features: [
        'Calendar integration',
        'Send emails from Outlook',
        'SharePoint document storage',
      ],
      comingSoon: true,
    },
    {
      name: 'Facebook',
      type: 'FACEBOOK',
      icon: '📘',
      color: 'from-blue-700/20 to-blue-600/10 border-blue-500/30',
      description: 'Post listings to your Facebook page',
      features: [
        'Auto-post new listings',
        'Schedule posts',
        'Track engagement',
      ],
    },
    {
      name: 'Instagram',
      type: 'INSTAGRAM',
      icon: '📸',
      color: 'from-pink-500/20 to-purple-500/10 border-pink-400/30',
      description: 'Share listings on Instagram',
      features: [
        'Post to feed',
        'Stories integration',
        'Track clicks',
      ],
    },
    {
      name: 'LinkedIn',
      type: 'LINKEDIN',
      icon: '💼',
      color: 'from-blue-600/20 to-blue-700/10 border-blue-500/30',
      description: 'Professional network posting',
      features: [
        'Post to your profile',
        'Company page integration',
        'Lead generation',
      ],
    },
  ];

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-cyan-400/20 bg-slate-950/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-400/30 text-2xl">
              🌐
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-base font-semibold text-slate-50">Website Lead Capture</h3>
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 border border-emerald-400/30">
                  Live webhook
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Capture every lead, signup, view, and registration from your personal website and route it directly into Leads.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Primary website URL</label>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Webhook token</label>
            <div className="flex gap-2">
              <input
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder="Generate a token"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
              <button
                onClick={generateToken}
                className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Generate
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Default source label</label>
            <input
              value={defaultSourceLabel}
              onChange={(e) => setDefaultSourceLabel(e.target.value)}
              placeholder="Website"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
            <p className="mt-2 text-xs text-slate-500">Used to tag inbound leads (ex: Open House, Sign Rider).</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Auto follow-up task</p>
                <p className="text-xs text-slate-500">Create a task when a new lead arrives.</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  followUpEnabled ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={followUpEnabled}
                onClick={() => setFollowUpEnabled((v) => !v)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    followUpEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">Due in</span>
              <input
                type="number"
                min={5}
                max={240}
                value={followUpMinutes}
                onChange={(e) => setFollowUpMinutes(Number(e.target.value || 15))}
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
              />
              <span className="text-xs text-slate-500">minutes</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="text-sm font-semibold text-slate-200 mb-2">Campaign link builder</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Campaign label</label>
              <input
                value={campaignLabel}
                onChange={(e) => setCampaignLabel(e.target.value)}
                placeholder="Open House - Elm St"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Priority</label>
              <select
                value={campaignPriority}
                onChange={(e) => setCampaignPriority(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              >
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => copyText(campaignUrl.replace('YOUR_TOKEN', webhookToken), 'Campaign link')}
                className="w-full rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
                disabled={!webhookToken}
              >
                Copy campaign link
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs font-mono break-all text-slate-300">{campaignUrl}</div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">Follow‑up sequence</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Call in (minutes)</label>
              <input
                type="number"
                min={5}
                max={240}
                value={sequenceCallMinutes}
                onChange={(e) => setSequenceCallMinutes(Number(e.target.value || 5))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">SMS in (minutes)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={sequenceSmsMinutes}
                onChange={(e) => setSequenceSmsMinutes(Number(e.target.value || 30))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Email in (minutes)</label>
              <input
                type="number"
                min={5}
                max={1440}
                value={sequenceEmailMinutes}
                onChange={(e) => setSequenceEmailMinutes(Number(e.target.value || 120))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Creates call/SMS/email tasks automatically for each new lead.</p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">AI scoring & assignment</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Assign to (label)</label>
              <input
                value={assignToLabel}
                onChange={(e) => setAssignToLabel(e.target.value)}
                placeholder="Team Lead"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <div>
                <p className="text-xs text-slate-400">AI scoring</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  aiScoringEnabled ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={aiScoringEnabled}
                onClick={() => setAiScoringEnabled((v) => !v)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    aiScoringEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <div>
                <p className="text-xs text-slate-400">Auto‑priority</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoPriorityEnabled ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={autoPriorityEnabled}
                onClick={() => setAutoPriorityEnabled((v) => !v)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoPriorityEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">Lead protection</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <div>
                <p className="text-xs text-slate-400">Spam shield</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  spamShieldEnabled ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={spamShieldEnabled}
                onClick={() => setSpamShieldEnabled((v) => !v)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    spamShieldEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Spam threshold</label>
              <input
                type="number"
                min={1}
                max={10}
                value={spamThreshold}
                onChange={(e) => setSpamThreshold(Number(e.target.value || 6))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">hCaptcha site key</label>
              <input
                value={hcaptchaSiteKey}
                onChange={(e) => setHcaptchaSiteKey(e.target.value)}
                placeholder="Site key"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
              <label className="block text-xs text-slate-400 mt-3 mb-2">hCaptcha secret</label>
              <input
                value={hcaptchaSecret}
                onChange={(e) => setHcaptchaSecret(e.target.value)}
                placeholder="Secret key"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-50"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
          <div className="text-slate-400">Webhook URL</div>
          <div className="mt-1 font-mono break-all">{`${window.location.origin}/api/integrations/website-leads`}</div>
          <div className="mt-3 text-slate-500">
            Send leads via POST with header <span className="text-slate-300 font-semibold">x-agentease-token</span>.
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">Instant lead capture link</div>
            <div className="mt-2 text-xs font-mono break-all text-slate-200">
              {leadCaptureUrl}
            </div>
            <button
              onClick={() =>
                copyText(leadCaptureUrl.replace('YOUR_TOKEN', webhookToken), 'Link')
              }
              className="mt-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
              disabled={!webhookToken}
            >
              Copy link
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">Embed form (iframe)</div>
            <div className="mt-2 text-xs font-mono break-all text-slate-200">
              {`<iframe src=\"${leadCaptureUrl}\" style=\"width:100%;min-height:520px;border:0;border-radius:16px;\"></iframe>`}
            </div>
            <button
              onClick={() =>
                copyText(
                  `<iframe src=\"${leadCaptureUrl.replace('YOUR_TOKEN', webhookToken)}\" style=\"width:100%;min-height:520px;border:0;border-radius:16px;\"></iframe>`,
                  'Embed snippet',
                )
              }
              className="mt-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
              disabled={!webhookToken}
            >
              Copy embed
            </button>
          </div>
        </div>

        {/* Enhanced QR Code Generator */}
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-slate-200">📱 QR Code Generator</div>
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setQrCodeType('lead-capture')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  qrCodeType === 'lead-capture'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lead Capture
              </button>
              <button
                onClick={() => setQrCodeType('landing-page')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  qrCodeType === 'landing-page'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Landing Page
              </button>
              <button
                onClick={() => setQrCodeType('custom')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  qrCodeType === 'custom'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom URL
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-6">
            {/* QR Code Preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-32 w-32 rounded-lg border border-white/10 bg-white p-2 flex items-center justify-center">
                <QRCodeSVG
                  value={
                    qrCodeType === 'lead-capture'
                      ? webhookToken ? leadCaptureUrl.replace('YOUR_TOKEN', webhookToken) : leadCaptureUrl
                      : qrCodeType === 'landing-page'
                      ? `${window.location.origin}/sites/${selectedLandingPage}`
                      : customQrUrl || window.location.origin
                  }
                  size={112}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <button
                onClick={() => {
                  const url = qrCodeType === 'lead-capture'
                    ? webhookToken ? leadCaptureUrl.replace('YOUR_TOKEN', webhookToken) : leadCaptureUrl
                    : qrCodeType === 'landing-page'
                    ? `${window.location.origin}/sites/${selectedLandingPage}`
                    : customQrUrl || window.location.origin;
                  copyText(url, 'QR URL');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Copy URL
              </button>
            </div>

            {/* Options based on type */}
            <div className="flex-1 min-w-[200px] space-y-3">
              {qrCodeType === 'lead-capture' && (
                <div className="text-xs text-slate-400">
                  <p className="mb-2">This QR code links to your <span className="text-cyan-400">lead capture form</span>.</p>
                  <p>When scanned, visitors will see a contact form that submits leads directly to your dashboard.</p>
                  <p className="mt-2 text-slate-500">Perfect for: Signs, flyers, business cards, open house materials</p>
                </div>
              )}
              
              {qrCodeType === 'landing-page' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400 mb-2">
                    Select one of your <span className="text-cyan-400">landing pages</span> to generate a QR code.
                  </div>
                  {landingPages.length > 0 ? (
                    <select
                      value={selectedLandingPage}
                      onChange={(e) => setSelectedLandingPage(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {landingPages.map((page) => (
                        <option key={page.id} value={page.slug}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-slate-500">
                      No landing pages yet.{' '}
                      <a href="/settings/landing-pages" className="text-cyan-400 hover:underline">
                        Create one →
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Perfect for: Property-specific marketing, agent profile pages</p>
                </div>
              )}
              
              {qrCodeType === 'custom' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-400 mb-2">
                    Enter any <span className="text-cyan-400">custom URL</span> to generate a QR code.
                  </div>
                  <input
                    type="url"
                    value={customQrUrl}
                    onChange={(e) => setCustomQrUrl(e.target.value)}
                    placeholder="https://your-website.com"
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-xs text-slate-500">Perfect for: Social media, external websites, virtual tours</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-500">
            💡 Tip: Print QR codes on signs, flyers, business cards, or share digitally to drive traffic to your pages.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={saveWebsiteIntegration}
            disabled={savingWebsite}
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {savingWebsite ? 'Saving…' : 'Save Website Integration'}
          </button>
          <button
            onClick={sendTestLead}
            className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-slate-200"
          >
            Send Test Lead
          </button>
        </div>

        {sourceStats && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-xs text-slate-400 mb-3">Top source labels (last {sourceStats.days} days)</div>
              {sourceStats.sourceLabels.length === 0 ? (
                <div className="text-xs text-slate-500">No labeled sources yet.</div>
              ) : (
                <div className="space-y-2">
                  {sourceStats.sourceLabels.slice(0, 6).map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-xs text-slate-200">
                      <span>{item.label.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="text-xs text-slate-400 mb-3">Lead sources (last {sourceStats.days} days)</div>
              {sourceStats.leadSources.length === 0 ? (
                <div className="text-xs text-slate-500">No leads yet.</div>
              ) : (
                <div className="space-y-2">
                  {sourceStats.leadSources.slice(0, 6).map((item) => (
                    <div key={item.source} className="flex items-center justify-between text-xs text-slate-200">
                      <span>{item.source.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </Card>

      {/* OAuth Message Toast */}
      {oauthMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-top-2 duration-300 ${
          oauthMessage.type === 'success' 
            ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
            : 'bg-red-500/20 border-red-400/30 text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <span>{oauthMessage.type === 'success' ? '✓' : '✕'}</span>
            <span className="text-sm font-medium">{oauthMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header info */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-400/30 p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚡</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-50 mb-1">Connect your tools</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Integrate AgentEasePro with your calendar, email, and social media accounts. 
              We only use these connections to sync data and send messages you approve.
            </p>
          </div>
        </div>
      </Card>

      {/* Integration cards */}
      {integrations.map((integration) => {
        const isConnected = isIntegrationConnected(integration.type);
        const displayName = getIntegrationDisplayName(integration.type);

        return (
          <Card key={integration.type} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${integration.color} border text-2xl`}>
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-slate-50">{integration.name}</h3>
                    {integration.comingSoon ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-200 border border-amber-400/30">
                        Coming soon
                      </span>
                    ) : isConnected ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 border border-emerald-400/30">
                        ✓ Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-400/30">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{integration.description}</p>
                  {isConnected && displayName && (
                    <p className="text-xs text-slate-500">
                      Connected as: <span className="text-slate-400">{displayName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Features list */}
            <ul className="space-y-1.5 mb-4">
              {integration.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {/* Action buttons */}
            <div className="flex gap-2">
              {!integration.comingSoon && !isConnected && (
                <button
                  onClick={() => handleConnect(integration.type)}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Connect {integration.name}
                </button>
              )}
              {isConnected && (
                <>
                  <button
                    onClick={() => handleDisconnect(integration.type)}
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    Disconnect
                  </button>
                  <button
                    onClick={() => handleConnect(integration.type)}
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    Reconnect
                  </button>
                </>
              )}
            </div>

            {/* Settings toggles (only show if connected and not coming soon) */}
            {isConnected && !integration.comingSoon && integration.type === 'GOOGLE' && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Sync Google Calendar</p>
                    <p className="text-xs text-slate-500">Two-way sync with your calendar</p>
                  </div>
                  <button
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors"
                    role="switch"
                    aria-checked="true"
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Use Gmail for emails</p>
                    <p className="text-xs text-slate-500">Send from your Gmail address</p>
                  </div>
                  <button
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700 transition-colors"
                    role="switch"
                    aria-checked="false"
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {(testStatus || testError || copyNotice) && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
          {(testStatus || testError) && (
            <div
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl border backdrop-blur-xl ${
                testError
                  ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-400/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/30'
              }`}
            >
              <span className="text-lg">{testError ? '⚠️' : '✅'}</span>
              <span className="text-sm font-medium">{testError || testStatus}</span>
            </div>
          )}
          {copyNotice && (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl border backdrop-blur-xl bg-slate-900/10 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-white/10">
              <span className="text-lg">📋</span>
              <span className="text-sm font-medium">{copyNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* Privacy notice */}
      <Card className="bg-slate-900/60 border-white/10 p-4">
        <div className="flex items-start gap-3">
          <div className="text-lg">🔒</div>
          <div>
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300">Your data is safe.</span>{' '}
              We use OAuth for secure authentication and never store your passwords. 
              You can disconnect any integration at any time, and we'll immediately stop accessing that account.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
