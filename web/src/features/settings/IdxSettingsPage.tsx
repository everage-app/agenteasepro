import { useState, useEffect } from 'react';
import { useAuthStore } from '../auth/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import api from '../../lib/api';

type ProviderType = 'UTAH_RESO_WEBAPI' | 'GENERIC_API';

interface IdxConnection {
  id?: string;
  providerType: ProviderType;
  vendorName: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  serverToken: string;
  browserToken: string;
  apiKey: string;
  mlsAgentIds: string;
}

interface TestResult {
  success: boolean;
  message: string;
  sampleListingCount?: number;
}

export function IdxSettingsPage() {
  const agent = useAuthStore((s) => s.agent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // Website Tracking State
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState('');
  const [savingWebsite, setSavingWebsite] = useState(false);

  const [providerType, setProviderType] = useState<ProviderType>('UTAH_RESO_WEBAPI');
  const [connection, setConnection] = useState<IdxConnection>({
    providerType: 'UTAH_RESO_WEBAPI',
    vendorName: '',
    baseUrl: '',
    clientId: '',
    clientSecret: '',
    serverToken: '',
    browserToken: '',
    apiKey: '',
    mlsAgentIds: '',
  });
  const [showSecrets, setShowSecrets] = useState({
    clientId: false,
    clientSecret: false,
    serverToken: false,
    browserToken: false,
    apiKey: false,
  });
  const [hasExistingConnection, setHasExistingConnection] = useState(false);

  useEffect(() => {
    loadConnection();
    loadWebsiteSettings();
  }, []);

  const loadWebsiteSettings = async () => {
    try {
      const res = await api.get('/settings/profile');
      if (res.data?.settings) {
        setWebsiteUrl(res.data.settings.websiteUrl || '');
        setGoogleAnalyticsId(res.data.settings.googleAnalyticsId || '');
      }
    } catch (error) {
      console.error('Failed to load website settings:', error);
    }
  };

  const loadConnection = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/idx');
      if (res.data) {
        setConnection(res.data);
        setProviderType(res.data.providerType);
        setHasExistingConnection(true);
      }
    } catch (error: any) {
      // 404 means no connection exists yet - this is fine
      if (error.response?.status !== 404) {
        console.error('Failed to load IDX connection:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebsite = async () => {
    setSavingWebsite(true);
    try {
      await api.put('/settings/branding', {
        websiteUrl,
        googleAnalyticsId,
      });
      alert('Website settings saved successfully!');
    } catch (error) {
      console.error('Failed to save website settings:', error);
      alert('Failed to save website settings.');
    } finally {
      setSavingWebsite(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const payload = {
        ...connection,
        providerType,
      };
      await api.post('/settings/idx', payload);
      alert('IDX connection saved successfully!');
      setHasExistingConnection(true);
      await loadConnection(); // Reload to get masked values
    } catch (error) {
      console.error('Failed to save IDX connection:', error);
      alert('Failed to save IDX connection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/idx/test');
      setTestResult({
        success: res.data.ok,
        message: res.data.ok 
          ? `Connection successful! ${res.data.sampleListingCount ? `Found ${res.data.sampleListingCount} sample listings.` : 'Connection verified.'}` 
          : 'Connection test passed but no data returned.',
        sampleListingCount: res.data.sampleListingCount,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || 'Connection failed. Please check your credentials.',
      });
    } finally {
      setTesting(false);
    }
  };

  const updateField = (field: keyof IdxConnection, value: string) => {
    setConnection({ ...connection, [field]: value });
  };

  const toggleSecretVisibility = (field: keyof typeof showSecrets) => {
    setShowSecrets({ ...showSecrets, [field]: !showSecrets[field] });
  };

  const isMasked = (value: string): boolean => Boolean(value && value.startsWith('••••'));

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400">Loading IDX settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-400/30 p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🌐</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-50 mb-1">IDX & Website</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Connect your MLS or IDX provider so we can show your listings on your website and inside AgentEasePro.
            </p>
          </div>
        </div>
      </Card>

      {/* Overview */}
      <Card className="p-6 bg-white/5 border-white/10">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <h3 className="text-base font-semibold text-slate-50 mb-2">What is IDX?</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              An IDX connection lets AgentEasePro pull listings from your MLS or IDX provider so you can display them 
              on your website and use them in your workflows.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              For Utah agents, this usually comes from <span className="font-semibold text-slate-300">UtahRealEstate.com</span> (Utah MLS). 
              You'll get the connection details after signing their data license agreement with us listed as your vendor.
            </p>
          </div>
        </div>
      </Card>

      {/* Provider type selector */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-slate-50 mb-4">Choose your IDX provider</h3>
        
        <div className="space-y-3">
          <label className={`block rounded-2xl border p-4 cursor-pointer transition-all ${
            providerType === 'UTAH_RESO_WEBAPI'
              ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="providerType"
                value="UTAH_RESO_WEBAPI"
                checked={providerType === 'UTAH_RESO_WEBAPI'}
                onChange={(e) => setProviderType(e.target.value as ProviderType)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-50 mb-1">UtahRealEstate.com (Utah MLS) – RESO Web API</div>
                <p className="text-sm text-slate-400">
                  Connect directly to the Utah MLS using RESO Web API standards. Requires Client ID, Client Secret, 
                  and tokens from UtahRealEstate.com.
                </p>
              </div>
            </div>
          </label>

          <label className={`block rounded-2xl border p-4 cursor-pointer transition-all ${
            providerType === 'GENERIC_API'
              ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="providerType"
                value="GENERIC_API"
                checked={providerType === 'GENERIC_API'}
                onChange={(e) => setProviderType(e.target.value as ProviderType)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-50 mb-1">Other IDX provider (API key)</div>
                <p className="text-sm text-slate-400">
                  Connect to any IDX vendor like SimplyRETS, ListHub, or others that provide an HTTP API.
                </p>
              </div>
            </div>
          </label>
        </div>
      </Card>

      {/* UtahRealEstate.com form */}
      {providerType === 'UTAH_RESO_WEBAPI' && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-slate-50 mb-4">UtahRealEstate.com connection</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Web API base URL <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={connection.baseUrl}
                onChange={(e) => updateField('baseUrl', e.target.value)}
                placeholder="https://api.utahrealestate.com/reso/odata"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                UtahRealEstate.com will provide the full RESO Web API URL as part of your IDX credentials.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Client ID <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.clientId ? 'text' : 'password'}
                  value={connection.clientId}
                  onChange={(e) => updateField('clientId', e.target.value)}
                  placeholder={isMasked(connection.clientId) ? connection.clientId : 'Enter client ID'}
                  disabled={!!connection.clientId && isMasked(connection.clientId) && !showSecrets.clientId}
                  className="w-full px-4 py-2.5 pr-24 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('clientId')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {showSecrets.clientId ? 'Hide' : isMasked(connection.clientId) ? 'Edit' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Client Secret <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.clientSecret ? 'text' : 'password'}
                  value={connection.clientSecret}
                  onChange={(e) => updateField('clientSecret', e.target.value)}
                  placeholder={isMasked(connection.clientSecret) ? connection.clientSecret : 'Enter client secret'}
                  disabled={!!connection.clientSecret && isMasked(connection.clientSecret) && !showSecrets.clientSecret}
                  className="w-full px-4 py-2.5 pr-24 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('clientSecret')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {showSecrets.clientSecret ? 'Hide' : isMasked(connection.clientSecret) ? 'Edit' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Server token <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.serverToken ? 'text' : 'password'}
                  value={connection.serverToken}
                  onChange={(e) => updateField('serverToken', e.target.value)}
                  placeholder={isMasked(connection.serverToken) ? connection.serverToken : 'Enter server token'}
                  disabled={!!connection.serverToken && isMasked(connection.serverToken) && !showSecrets.serverToken}
                  className="w-full px-4 py-2.5 pr-24 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('serverToken')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {showSecrets.serverToken ? 'Hide' : isMasked(connection.serverToken) ? 'Edit' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Browser token <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.browserToken ? 'text' : 'password'}
                  value={connection.browserToken}
                  onChange={(e) => updateField('browserToken', e.target.value)}
                  placeholder={isMasked(connection.browserToken) ? connection.browserToken : 'Enter browser token'}
                  disabled={!!connection.browserToken && isMasked(connection.browserToken) && !showSecrets.browserToken}
                  className="w-full px-4 py-2.5 pr-24 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('browserToken')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {showSecrets.browserToken ? 'Hide' : isMasked(connection.browserToken) ? 'Edit' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                MLS Agent ID(s)
              </label>
              <input
                type="text"
                value={connection.mlsAgentIds}
                onChange={(e) => updateField('mlsAgentIds', e.target.value)}
                placeholder="e.g., 12345, 67890"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Comma-separated. We use these to filter the feed to your own listings and any allowed office listings.
              </p>
            </div>

            <div className="pt-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-400">Note:</span> Exact field names may differ slightly 
                depending on UtahRealEstate.com's documentation. We'll adjust the mapping during vendor onboarding.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Generic API form */}
      {providerType === 'GENERIC_API' && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-slate-50 mb-4">Other IDX provider</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Provider name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={connection.vendorName}
                onChange={(e) => updateField('vendorName', e.target.value)}
                placeholder="e.g., SimplyRETS, ListHub"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Base API URL <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={connection.baseUrl}
                onChange={(e) => updateField('baseUrl', e.target.value)}
                placeholder="https://api.simplyrets.com/properties"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                API key / token <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecrets.apiKey ? 'text' : 'password'}
                  value={connection.apiKey}
                  onChange={(e) => updateField('apiKey', e.target.value)}
                  placeholder={isMasked(connection.apiKey) ? connection.apiKey : 'Enter API key'}
                  disabled={!!connection.apiKey && isMasked(connection.apiKey) && !showSecrets.apiKey}
                  className="w-full px-4 py-2.5 pr-24 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('apiKey')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {showSecrets.apiKey ? 'Hide' : isMasked(connection.apiKey) ? 'Edit' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                MLS / Board name <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={connection.vendorName}
                onChange={(e) => updateField('vendorName', e.target.value)}
                placeholder="e.g., WFRMLS, CRMLS"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Agent / Office ID(s) <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={connection.mlsAgentIds}
                onChange={(e) => updateField('mlsAgentIds', e.target.value)}
                placeholder="e.g., 12345, 67890"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div className="pt-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Use this if you have an IDX vendor that provides an HTTP API. We'll call their /listings or 
                equivalent endpoint using your credentials.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <Card className="p-6">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !connection.baseUrl || 
              (providerType === 'UTAH_RESO_WEBAPI' && (!connection.clientId || !connection.clientSecret)) ||
              (providerType === 'GENERIC_API' && !connection.apiKey)
            }
            className="bg-blue-600 hover:bg-blue-500"
          >
            {saving ? 'Saving...' : hasExistingConnection ? 'Update credentials' : 'Save credentials'}
          </Button>

          <Button
            onClick={handleTest}
            disabled={testing || !hasExistingConnection}
            variant="secondary"
            className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            {testing ? 'Testing...' : 'Test connection'}
          </Button>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-4 p-4 rounded-xl border ${
            testResult.success 
              ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200' 
              : 'bg-red-500/10 border-red-400/30 text-red-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className="text-xl">{testResult.success ? '✓' : '✗'}</div>
              <div>
                <p className="text-sm font-medium">{testResult.message}</p>
              </div>
            </div>
          </div>
        )}

        {!hasExistingConnection && (
          <p className="mt-4 text-xs text-slate-500">
            Save your credentials first, then you can test the connection.
          </p>
        )}
      </Card>

      {/* Website Tracking Section */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-white mb-4">Website Tracking & Analytics</h3>
        <p className="text-sm text-slate-400 mb-6">
          Track visitor activity on your personal website and integrate with Google Analytics.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Website URL
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://www.yourwebsite.com"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Google Analytics Measurement ID
            </label>
            <input
              type="text"
              value={googleAnalyticsId}
              onChange={(e) => setGoogleAnalyticsId(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <p className="mt-2 text-xs text-slate-500">
              Enter your GA4 Measurement ID to link your analytics.
            </p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h4 className="text-sm font-medium text-white mb-2">AgentEase Tracking Pixel</h4>
            <p className="text-xs text-slate-400 mb-4">
              Copy and paste this code into the &lt;head&gt; section of your website to track visitor activity and capture leads directly into AgentEase.
            </p>
            
            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 overflow-x-auto border border-white/10">
{`<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://api.agenteasepro.com/tracker.js?id=${agent?.id || 'YOUR_AGENT_ID'}';
  f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${agent?.id || 'YOUR_AGENT_ID'}');
</script>`}
              </pre>
              <Button
                variant="secondary"
                className="absolute top-2 right-2 text-xs py-1 px-2 h-auto"
                onClick={() => {
                  navigator.clipboard.writeText(`<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://api.agenteasepro.com/tracker.js?id=${agent?.id || 'YOUR_AGENT_ID'}';
  f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${agent?.id || 'YOUR_AGENT_ID'}');
</script>`);
                  alert('Copied to clipboard!');
                }}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveWebsite}
              disabled={savingWebsite}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {savingWebsite ? 'Saving...' : 'Save Website Settings'}
            </Button>
          </div>
        </div>
      </Card>

      {/* MLS disclaimer */}
      <Card className="bg-slate-900/60 border-white/10 p-4">
        <div className="flex items-start gap-3">
          <div className="text-lg">⚖️</div>
          <div>
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300">MLS data compliance:</span>{' '}
              MLS data is governed by your MLS's display rules and IDX agreement. Make sure your website and usage 
              comply with those rules. AgentEasePro does not take responsibility for violations of your MLS agreement.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
