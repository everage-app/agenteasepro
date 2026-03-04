import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../auth/authStore';
import { formatPhoneInput, normalizePhoneForStorage } from '../../lib/phone';

interface BrandingData {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  emailSignature: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
}

interface BrokerageProfileData {
  brokerageName: string | null;
  settings: {
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    brokerageName: string | null;
    brokerageLogoUrl: string | null;
    brokerageAddress: string | null;
    brokeragePhone: string | null;
  };
}

const BRANDING_CACHE_KEY_PREFIX = 'agent_branding_settings_cache:';

type BrandingCache = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  emailSignature: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
};

const getBrandingCacheKey = (agentKey: string) => `${BRANDING_CACHE_KEY_PREFIX}${agentKey}`;

const readBrandingCache = (cacheKey: string): BrandingCache | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(cacheKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BrandingCache;
  } catch {
    return null;
  }
};

const writeBrandingCache = (cacheKey: string, data: BrandingCache) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(cacheKey, JSON.stringify(data));
};

export function BrandingSettingsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const agent = useAuthStore((s) => s.agent);
  const getAuthToken = () => token || localStorage.getItem('utahcontracts_token') || '';
  
  // State
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#06B6D4');
  const [emailSignature, setEmailSignature] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [brokerageName, setBrokerageName] = useState('');
  const [brokerageLogoUrl, setBrokerageLogoUrl] = useState<string | null>(null);
  const [brokerageAddress, setBrokerageAddress] = useState('');
  const [brokeragePhone, setBrokeragePhone] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const applyBrandingState = (values: Partial<BrandingCache>) => {
    setLogoUrl(values.logoUrl ?? null);
    setPrimaryColor(values.primaryColor ?? '#3B82F6');
    setSecondaryColor(values.secondaryColor ?? '#06B6D4');
    setEmailSignature(values.emailSignature ?? '');
    setWebsiteUrl(values.websiteUrl ?? '');
    setFacebookUrl(values.facebookUrl ?? '');
    setInstagramUrl(values.instagramUrl ?? '');
    setLinkedinUrl(values.linkedinUrl ?? '');
  };

  const applyBrokerageState = (values: Partial<BrokerageProfileData['settings']>) => {
    setProfilePhotoUrl(values.photoUrl ?? null);
    setProfileFirstName(values.firstName ?? '');
    setProfileLastName(values.lastName ?? '');
    setBrokerageName(values.brokerageName ?? '');
    setBrokerageLogoUrl(values.brokerageLogoUrl ?? null);
    setBrokerageAddress(values.brokerageAddress ?? '');
    setBrokeragePhone(formatPhoneInput(values.brokeragePhone ?? ''));
  };

  const buildBrandingSnapshot = (data: BrandingData): BrandingCache => {
    return {
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor || '#3B82F6',
      secondaryColor: data.secondaryColor || '#06B6D4',
      emailSignature: data.emailSignature || '',
      websiteUrl: data.websiteUrl || '',
      facebookUrl: data.facebookUrl || '',
      instagramUrl: data.instagramUrl || '',
      linkedinUrl: data.linkedinUrl || '',
    };
  };

  // Load branding data on mount
  useEffect(() => {
    const cacheAgentKey = agent?.id || agent?.email || 'anonymous';
    const brandingCacheKey = getBrandingCacheKey(cacheAgentKey);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('agent_branding_settings_cache');
    }

    const loadBranding = async () => {
      try {
        const response = await fetch('/api/settings/branding', {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        
        if (!response.ok) throw new Error('Failed to load branding');
        
        const data: BrandingData = await response.json();
        const brandingSnapshot = buildBrandingSnapshot(data);

        applyBrandingState(brandingSnapshot);
        writeBrandingCache(brandingCacheKey, brandingSnapshot);
      } catch (error) {
        console.error('Failed to load branding:', error);
        const cached = readBrandingCache(brandingCacheKey);
        if (cached) {
          applyBrandingState(cached);
        }
      }
    };

    const loadBrokerage = async () => {
      try {
        const response = await fetch('/api/settings/profile', {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (!response.ok) throw new Error('Failed to load brokerage');
        const data: BrokerageProfileData = await response.json();
        const settings = data.settings || ({} as BrokerageProfileData['settings']);
        applyBrokerageState({
          firstName: settings.firstName || agent?.name?.split(' ')[0] || '',
          lastName: settings.lastName || agent?.name?.split(' ').slice(1).join(' ') || '',
          photoUrl: settings.photoUrl || null,
          brokerageName: settings.brokerageName || data.brokerageName || '',
          brokerageLogoUrl: settings.brokerageLogoUrl || null,
          brokerageAddress: settings.brokerageAddress || '',
          brokeragePhone: settings.brokeragePhone || '',
        });
      } catch (error) {
        console.error('Failed to load brokerage:', error);
      }
    };

    const loadAll = async () => {
      setLoading(true);
      await Promise.allSettled([loadBranding(), loadBrokerage()]);
      setLoading(false);
    };

    loadAll();
  }, [token, agent]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const cacheAgentKey = agent?.id || agent?.email || 'anonymous';
      const brandingCacheKey = getBrandingCacheKey(cacheAgentKey);

      const optimisticSnapshot: BrandingCache = {
        logoUrl,
        primaryColor,
        secondaryColor,
        emailSignature,
        websiteUrl,
        facebookUrl,
        instagramUrl,
        linkedinUrl,
      };
      writeBrandingCache(brandingCacheKey, optimisticSnapshot);

      const response = await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          primaryColor,
          secondaryColor,
          emailSignature,
          websiteUrl,
          facebookUrl,
          instagramUrl,
          linkedinUrl,
        }),
      });

      if (!response.ok) throw new Error('Failed to save branding');

      const brokerageResponse = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          brokerageName,
          brokerageAddress,
          brokeragePhone: normalizePhoneForStorage(brokeragePhone) || brokeragePhone,
        }),
      });

      if (!brokerageResponse.ok) throw new Error('Failed to save brokerage details');
      
      // Reload to confirm save
      const reloadResponse = await fetch('/api/settings/branding', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (reloadResponse.ok) {
        const data: BrandingData = await reloadResponse.json();
        const brandingSnapshot = buildBrandingSnapshot(data);

        applyBrandingState(brandingSnapshot);
        writeBrandingCache(brandingCacheKey, brandingSnapshot);
      }

      const reloadProfileResponse = await fetch('/api/settings/profile', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (reloadProfileResponse.ok) {
        const data: BrokerageProfileData = await reloadProfileResponse.json();
        const settings = data.settings || ({} as BrokerageProfileData['settings']);
        applyBrokerageState({
          firstName: settings.firstName || agent?.name?.split(' ')[0] || '',
          lastName: settings.lastName || agent?.name?.split(' ').slice(1).join(' ') || '',
          photoUrl: settings.photoUrl || null,
          brokerageName: settings.brokerageName || data.brokerageName || '',
          brokerageLogoUrl: settings.brokerageLogoUrl || null,
          brokerageAddress: settings.brokerageAddress || '',
          brokeragePhone: settings.brokeragePhone || '',
        });
      }
      
      setSaveMessage({ type: 'success', text: 'Branding saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save branding:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save branding. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const profileDisplayName = [profileFirstName, profileLastName].filter(Boolean).join(' ') || agent?.name || 'Your profile';

  const handleBrokerageLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch('/api/settings/profile/brokerage-logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to upload brokerage logo');
      }

      const data = await response.json();
      setBrokerageLogoUrl(data.brokerageLogoUrl);
      setSaveMessage({ type: 'success', text: 'Brokerage logo uploaded successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to upload brokerage logo:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload brokerage logo.';
      setSaveMessage({ type: 'error', text: message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBrokerageLogo = async () => {
    try {
      const response = await fetch('/api/settings/profile/brokerage-logo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      if (!response.ok) throw new Error('Failed to remove brokerage logo');

      setBrokerageLogoUrl(null);
      setSaveMessage({ type: 'success', text: 'Brokerage logo removed successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to remove brokerage logo:', error);
      setSaveMessage({ type: 'error', text: 'Failed to remove brokerage logo. Please try again.' });
    }
  };

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

      {/* Logo & Colors */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Logo & Colors</h2>
        <p className="text-xs text-slate-400 mb-6">
          Your brand identity for marketing materials and emails
        </p>

        <div className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Profile Photo
            </label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-medium text-slate-400">No photo</span>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-200">{profileDisplayName}</p>
                <p className="text-xs text-slate-500">This image is synced from your Profile settings.</p>
                <button
                  type="button"
                  onClick={() => navigate('/settings/profile')}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Update profile photo
                </button>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Primary color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 rounded-lg border border-white/10 bg-white/5 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none font-mono focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Secondary color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-16 rounded-lg border border-white/10 bg-white/5 cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none font-mono focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <p className="text-xs text-slate-400 mb-3">Preview</p>
            <div className="rounded-lg border border-white/10 p-4" style={{ backgroundColor: primaryColor + '15', borderColor: primaryColor + '40' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: primaryColor }}>
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="Profile" className="h-10 w-10 object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">AE</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-50">Your Brand</div>
                  <div className="text-xs" style={{ color: secondaryColor }}>Real Estate Professional</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Brokerage Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Brokerage Details</h2>
        <p className="text-xs text-slate-400 mb-6">
          Brokerage information used across contracts and marketing
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Brokerage Logo
            </label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {brokerageLogoUrl ? (
                  <img src={brokerageLogoUrl} alt="Brokerage Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-500 text-center px-1">No Logo</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBrokerageLogoUpload}
                  className="hidden"
                  id="brokerage-logo-upload"
                />
                <div className="flex gap-2">
                  <label
                    htmlFor="brokerage-logo-upload"
                    className="inline-flex items-center px-3 py-2 border border-white/10 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 cursor-pointer"
                  >
                    Upload Logo
                  </label>
                  {brokerageLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveBrokerageLogo}
                      className="inline-flex items-center px-3 py-2 border border-red-500/30 rounded-md shadow-sm text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPG, or SVG up to 5MB. Required for marketing compliance.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Brokerage Name
            </label>
            <input
              type="text"
              value={brokerageName}
              onChange={(e) => setBrokerageName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="Premier Real Estate Group"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Brokerage Address
            </label>
            <input
              type="text"
              value={brokerageAddress}
              onChange={(e) => setBrokerageAddress(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="123 Main Street, Salt Lake City, UT 84101"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Brokerage Phone
            </label>
            <input
              type="tel"
              value={brokeragePhone}
              onChange={(e) => setBrokeragePhone(formatPhoneInput(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="(801) 555-0100"
            />
          </div>
        </div>
      </Card>

      {/* Website & Social */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Website & Social Links</h2>
        <p className="text-xs text-slate-400 mb-6">
          Your online presence for marketing emails and materials
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="https://yourwebsite.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Facebook
              </label>
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="https://facebook.com/yourpage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Instagram
              </label>
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="https://instagram.com/yourprofile"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              LinkedIn
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="https://linkedin.com/in/yourprofile"
            />
          </div>
        </div>
      </Card>

      {/* Email Signature */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Email Signature</h2>
        <p className="text-xs text-slate-400 mb-6">
          Default signature for marketing emails
        </p>

        <div>
          <textarea
            value={emailSignature}
            onChange={(e) => setEmailSignature(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            placeholder="Your Name&#10;Licensed Real Estate Agent&#10;Phone: (801) 555-0123&#10;Email: you@example.com"
          />
          <p className="text-xs text-slate-500 mt-1">
            This signature will be added to all marketing emails
          </p>
        </div>
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
