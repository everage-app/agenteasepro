export const SETTINGS_ASSETS_UPDATED_EVENT = 'ae:settings-assets:updated';
const LEGACY_PROFILE_PHOTO_UPDATED_EVENT = 'ae:profile-photo:updated';

export type SettingsAssetsUpdatedDetail = {
  profilePhotoUrl?: string | null;
  brokerageLogoUrl?: string | null;
  brokerageName?: string | null;
  brokerageLogoWidth?: number | null;
  brokerageLogoBackground?: string | null;
  version?: number;
};

const isAlreadyAbsolute = (value: string) => /^(data:|blob:|https?:\/\/)/i.test(value);

export const normalizeAssetUrl = (raw: string | null | undefined): string | null => {
  if (!raw) return null;

  const value = raw.trim();
  if (!value || value === 'null' || value === 'undefined') return null;

  if (isAlreadyAbsolute(value) || value.startsWith('/')) {
    return value;
  }

  return `/${value.replace(/^\/+/, '')}`;
};

export const withAssetCacheBust = (
  raw: string | null | undefined,
  version = Date.now(),
): string | null => {
  const normalized = normalizeAssetUrl(raw);
  if (!normalized) return null;

  if (/^(data:|blob:)/i.test(normalized)) {
    return normalized;
  }

  const [urlWithoutHash, hashFragment] = normalized.split('#', 2);
  const [path, queryString] = urlWithoutHash.split('?', 2);
  const params = new URLSearchParams(queryString || '');
  params.set('v', String(version));

  const rebuilt = `${path}?${params.toString()}`;
  return hashFragment ? `${rebuilt}#${hashFragment}` : rebuilt;
};

export const toCacheSafeAssetUrl = (raw: string | null | undefined): string | null => {
  const normalized = normalizeAssetUrl(raw);
  if (!normalized) return null;

  // Prevent oversized localStorage writes when server returns inline data URLs.
  if (normalized.startsWith('data:') || normalized.length > 2048) {
    return null;
  }

  return normalized;
};

export const readSettingsAssetsUpdatedDetail = (event: Event): SettingsAssetsUpdatedDetail => {
  const custom = event as CustomEvent<SettingsAssetsUpdatedDetail>;
  return custom.detail || {};
};

export const dispatchSettingsAssetsUpdated = (detail: SettingsAssetsUpdatedDetail) => {
  if (typeof window === 'undefined') return;

  const payload: SettingsAssetsUpdatedDetail = {
    ...detail,
    version: detail.version ?? Date.now(),
  };

  window.dispatchEvent(new CustomEvent<SettingsAssetsUpdatedDetail>(SETTINGS_ASSETS_UPDATED_EVENT, { detail: payload }));

  // Keep legacy listeners alive while new event wiring rolls out.
  if (Object.prototype.hasOwnProperty.call(payload, 'profilePhotoUrl')) {
    window.dispatchEvent(new CustomEvent(LEGACY_PROFILE_PHOTO_UPDATED_EVENT, {
      detail: { photoUrl: payload.profilePhotoUrl ?? null },
    }));
  }
};
