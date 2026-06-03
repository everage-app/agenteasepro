export function buildLandingPageQrToken() {
  const entropy =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

  return `lp${entropy}`.slice(0, 18);
}

export function buildTrackedLandingQrUrl(baseUrl: string, slug: string, token?: string) {
  const trimmedToken = token?.trim();

  try {
    const url = new URL(baseUrl);
    if (trimmedToken) {
      return `${url.origin}/q/${encodeURIComponent(trimmedToken)}`;
    }
    url.searchParams.set('utm_source', 'qr');
    url.searchParams.set('utm_medium', 'print');
    url.searchParams.set('utm_campaign', slug);
    return url.toString();
  } catch {
    return baseUrl;
  }
}