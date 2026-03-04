import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../auth/authStore';
import { formatPhoneInput, normalizePhoneForStorage } from '../../lib/phone';

interface ProfileData {
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone: string;
  licenseNumber?: string;
  settings: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    licenseNumber: string | null;
    licenseSuffix: string | null;
    licenseState: string | null;
    licenseExpiry: string | null;
    narMemberId: string | null;
    photoUrl: string | null;
    brokerageName: string | null;
    brokerageLogoUrl: string | null;
    brokerageAddress: string | null;
    brokeragePhone: string | null;
    yearsExperience: number | null;
    specializations: string | null;
    bio: string | null;
  };
}

const PROFILE_CACHE_KEY_PREFIX = 'agent_profile_settings_cache:';

type ProfileCache = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseSuffix: string;
  licenseState: string;
  licenseExpiry: string;
  narMemberId: string;
  photoUrl: string | null;
  yearsExperience: string;
  specializations: string;
  bio: string;
};

const getProfileCacheKey = (agentKey: string) => `${PROFILE_CACHE_KEY_PREFIX}${agentKey}`;

const readProfileCache = (cacheKey: string): ProfileCache | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(cacheKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfileCache;
  } catch {
    return null;
  }
};

const writeProfileCache = (cacheKey: string, data: ProfileCache) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(cacheKey, JSON.stringify(data));
};

export function ProfileSettingsPage() {
  const agent = useAuthStore((s) => s.agent);
  const token = useAuthStore((s) => s.token);
  const authToken = token || localStorage.getItem('utahcontracts_token') || '';
  
  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseSuffix, setLicenseSuffix] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [narMemberId, setNarMemberId] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [yearsExperience, setYearsExperience] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [bio, setBio] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getPasswordChecks = (password: string) => {
    const checks = {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSymbol: /[^A-Za-z0-9]/.test(password),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { checks, passed };
  };

  const passwordStrength = (() => {
    if (!newPassword) {
      return { label: 'No password entered', color: 'bg-slate-600', width: '0%' };
    }
    const { passed } = getPasswordChecks(newPassword);
    if (passed <= 2) {
      return { label: 'Weak', color: 'bg-rose-500', width: '35%' };
    }
    if (passed <= 4) {
      return { label: 'Good', color: 'bg-amber-500', width: '70%' };
    }
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
  })();

  const applyProfileState = (values: Partial<ProfileCache>) => {
    setFirstName(values.firstName ?? '');
    setLastName(values.lastName ?? '');
    setEmail(values.email ?? '');
    setPhone(formatPhoneInput(values.phone ?? ''));
    setLicenseNumber(values.licenseNumber ?? '');
    setLicenseSuffix(values.licenseSuffix ?? '');
    setLicenseState(values.licenseState ?? '');
    setLicenseExpiry(values.licenseExpiry ?? '');
    setNarMemberId(values.narMemberId ?? '');
    setPhotoUrl(values.photoUrl ?? null);
    setYearsExperience(values.yearsExperience ?? '');
    setSpecializations(values.specializations ?? '');
    setBio(values.bio ?? '');
  };

  const buildProfileSnapshot = (data: ProfileData): ProfileCache => {
    const settings = data.settings || ({} as ProfileData['settings']);
    const savedFirstName = settings.firstName;
    const savedLastName = settings.lastName;
    const nameParts = data.name?.split(' ') || [];

    return {
      firstName: savedFirstName || nameParts[0] || '',
      lastName: savedLastName || nameParts.slice(1).join(' ') || '',
      email: data.email || '',
      phone: settings.phone || '',
      licenseNumber: settings.licenseNumber || '',
      licenseSuffix: settings.licenseSuffix || '',
      licenseState: settings.licenseState || 'UT',
      licenseExpiry: settings.licenseExpiry?.split('T')[0] || '',
      narMemberId: settings.narMemberId || '',
      photoUrl: settings.photoUrl || null,
      yearsExperience: settings.yearsExperience?.toString() || '',
      specializations: settings.specializations || '',
      bio: settings.bio || '',
    };
  };

  // Load profile data on mount
  useEffect(() => {
    const cacheAgentKey = agent?.id || agent?.email || 'anonymous';
    const profileCacheKey = getProfileCacheKey(cacheAgentKey);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('agent_profile_settings_cache');
    }

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/settings/profile', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        
        if (!response.ok) throw new Error('Failed to load profile');
        
        const data = (await response.json()) as ProfileData;
        const profileSnapshot = buildProfileSnapshot(data);

        applyProfileState(profileSnapshot);
        writeProfileCache(profileCacheKey, profileSnapshot);
      } catch (error) {
        console.error('Failed to load profile:', error);
        const cached = readProfileCache(profileCacheKey);
        if (cached) {
          applyProfileState(cached);
        } else {
          // Fallback to auth store data
          setFirstName(agent?.name?.split(' ')[0] || '');
          setLastName(agent?.name?.split(' ').slice(1).join(' ') || '');
          setEmail(agent?.email || '');
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token, agent]);

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage({ type: 'error', text: 'Logo file must be under 5MB' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setSaveMessage({ type: 'success', text: 'Uploading photo...' });
      
      const response = await fetch('/api/settings/profile/photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to upload photo');
      }

      const data = await response.json();
      setPhotoUrl(data.photoUrl);
      setSaveMessage({ type: 'success', text: 'Photo uploaded successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to upload photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload photo.';
      setSaveMessage({ type: 'error', text: message });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      const response = await fetch('/api/settings/profile/photo', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to remove photo');

      setPhotoUrl(null);
      setSaveMessage({ type: 'success', text: 'Photo removed successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to remove photo:', error);
      setSaveMessage({ type: 'error', text: 'Failed to remove photo. Please try again.' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const optimisticSnapshot: ProfileCache = {
        firstName,
        lastName,
        email,
        phone,
        licenseNumber,
        licenseSuffix,
        licenseState,
        licenseExpiry,
        narMemberId,
        photoUrl,
        yearsExperience,
        specializations,
        bio,
      };
      const cacheAgentKey = agent?.id || agent?.email || 'anonymous';
      const profileCacheKey = getProfileCacheKey(cacheAgentKey);
      writeProfileCache(profileCacheKey, optimisticSnapshot);

      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: normalizePhoneForStorage(phone) || '',
          licenseNumber,
          licenseSuffix,
          licenseState: licenseState || 'UT',
          licenseExpiry,
          narMemberId,
          yearsExperience,
          specializations,
          bio,
        }),
      });

      if (!response.ok) throw new Error('Failed to save profile');
      
      // Reload settings to confirm save and get updated data
      const reloadResponse = await fetch('/api/settings/profile', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (reloadResponse.ok) {
        const data = (await reloadResponse.json()) as ProfileData;
        const profileSnapshot = buildProfileSnapshot(data);

        applyProfileState(profileSnapshot);
        writeProfileCache(profileCacheKey, profileSnapshot);
      }
      
      setSaveMessage({ type: 'success', text: 'Profile saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Please complete all password fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordMessage({ type: 'error', text: 'New password must be different from your current password.' });
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password';
      setPasswordMessage({ type: 'error', text: message });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!email) return;
    setSendingResetLink(true);
    setPasswordMessage(null);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      setPasswordMessage({ type: 'success', text: 'Password reset link sent to your email.' });
    } catch {
      setPasswordMessage({ type: 'error', text: 'Unable to send reset link right now. Please try again.' });
    } finally {
      setSendingResetLink(false);
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

      {/* Profile Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Personal Information</h2>
        <p className="text-xs text-slate-400 mb-6">
          Basic information used across the platform
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                First name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Last name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email <span className="text-slate-500 text-xs">(read-only)</span>
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 opacity-60 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Mobile phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="(801) 555-0123"
            />
          </div>
        </div>
      </Card>

      {/* Profile Photo */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">Profile Photo</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
          This photo is shown in the app and on your landing pages
        </p>

        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-white/90 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
            {photoUrl ? (
              <img src={photoUrl} alt="Agent profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-slate-500 text-center px-2">No Photo</span>
            )}
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleProfilePhotoUpload}
              className="hidden"
              id="profile-photo-upload"
            />
            <div className="flex gap-2">
              <label
                htmlFor="profile-photo-upload"
                className="inline-flex items-center px-4 py-2 rounded-full border border-blue-200 dark:border-white/10 shadow-sm text-sm font-semibold text-blue-700 dark:text-slate-200 bg-blue-50/80 dark:bg-white/5 hover:bg-blue-100/80 dark:hover:bg-white/10 transition"
              >
                Upload Photo
              </label>
              {photoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-red-200 dark:border-red-500/30 shadow-sm text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-500/10 hover:bg-red-100/80 dark:hover:bg-red-500/20 transition"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              PNG, JPG, or SVG up to 5MB. Best with a square crop.
            </p>
          </div>
        </div>
      </Card>

      {/* License Information */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">License Information</h2>
        <p className="text-xs text-slate-400 mb-6">
          Your real estate license details for contracts and compliance
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              License #
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="flex-1 min-w-[220px] rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder=""
              />
              <span className="text-slate-400 text-sm">-</span>
              <input
                type="text"
                value={licenseSuffix}
                onChange={(e) => setLicenseSuffix(e.target.value.toUpperCase())}
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-50 uppercase tracking-wide outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="SA00"
                maxLength={6}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Utah licenses are formatted as number + suffix
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              NAR Member ID
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={narMemberId}
              onChange={(e) => setNarMemberId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder=""
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              License Expiry Date
            </label>
            <input
              type="date"
              value={licenseExpiry}
              onChange={(e) => setLicenseExpiry(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="5"
            />
          </div>
        </div>
      </Card>

      {/* Professional Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Professional Details</h2>
        <p className="text-xs text-slate-400 mb-6">
          Specializations and bio for your profile
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Specializations
            </label>
            <input
              type="text"
              value={specializations}
              onChange={(e) => setSpecializations(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="Residential, First-time Buyers, Luxury Homes"
            />
            <p className="text-xs text-slate-500 mt-1">Separate with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              placeholder="A brief professional bio about yourself..."
            />
            <p className="text-xs text-slate-500 mt-1">This will appear on your public profile and marketing materials</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-50 mb-1">Password & Security</h2>
            <p className="text-xs text-slate-400">Reset your password instantly from profile settings.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={sendingResetLink}
            onClick={handleSendResetLink}
            className="bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"
          >
            {sendingResetLink ? 'Sending reset link...' : 'Email me a reset link'}
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Current password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-24 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                {showCurrentPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">New password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-24 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-24 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Password strength</span>
              <span className="text-slate-400">{passwordStrength.label}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full ${passwordStrength.color} transition-all duration-300`} style={{ width: passwordStrength.width }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400">
              {(() => {
                const { checks } = getPasswordChecks(newPassword);
                const rows = [
                  { ok: checks.minLength, label: 'At least 8 characters' },
                  { ok: checks.hasUpper, label: 'One uppercase letter' },
                  { ok: checks.hasLower, label: 'One lowercase letter' },
                  { ok: checks.hasNumber, label: 'One number' },
                  { ok: checks.hasSymbol, label: 'One symbol' },
                  { ok: Boolean(newPassword && confirmPassword && newPassword === confirmPassword), label: 'Passwords match' },
                ];
                return rows.map((row) => (
                  <div key={row.label} className={`flex items-center gap-2 ${row.ok ? 'text-emerald-300' : 'text-slate-500'}`}>
                    <span>{row.ok ? '✓' : '•'}</span>
                    <span>{row.label}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          {passwordMessage && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                passwordMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30'
                  : 'bg-rose-500/10 text-rose-200 border-rose-400/30'
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              {changingPassword ? 'Updating password...' : 'Update password'}
            </Button>
          </div>
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
