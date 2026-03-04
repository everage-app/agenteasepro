type TelemetryEvent = {
  kind: string;
  path?: string;
  meta?: Record<string, unknown>;
};

type TelemetryError = {
  source?: 'client' | 'server';
  message: string;
  stack?: string;
  path?: string;
  meta?: Record<string, unknown>;
};

const recentClientErrorFingerprints = new Map<string, number>();
const CLIENT_ERROR_DEDUPE_WINDOW_MS = 60 * 1000;

function cleanupClientErrorFingerprints(now = Date.now()) {
  for (const [key, timestamp] of recentClientErrorFingerprints.entries()) {
    if (now - timestamp > CLIENT_ERROR_DEDUPE_WINDOW_MS) {
      recentClientErrorFingerprints.delete(key);
    }
  }
}

function normalizeString(input: unknown, maxLength: number): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function readStoredToken(): string | null {
  const token = localStorage.getItem('utahcontracts_token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

async function postJson(path: string, body: unknown) {
  const token = readStoredToken();
  if (!token) return;

  // Use fetch (not axios) to avoid interceptor loops.
  await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

export async function trackEvent(event: TelemetryEvent) {
  try {
    await postJson('/telemetry/event', event);
  } catch {
    // Intentionally ignore telemetry failures.
  }
}

export async function reportClientError(err: TelemetryError) {
  try {
    const source = err.source ?? 'client';
    const message = normalizeString(err.message, 2000);
    if (!message) return;
    const stack = normalizeString(err.stack, 12000);
    const path = normalizeString(err.path, 300);

    cleanupClientErrorFingerprints();
    const fingerprint = [source, message, path || ''].join('|');
    const now = Date.now();
    const existing = recentClientErrorFingerprints.get(fingerprint);
    if (existing && now - existing <= CLIENT_ERROR_DEDUPE_WINDOW_MS) {
      return;
    }

    await postJson('/telemetry/error', {
      source,
      message,
      stack,
      path,
      meta: err.meta,
    });

    recentClientErrorFingerprints.set(fingerprint, now);
  } catch {
    // Intentionally ignore telemetry failures.
  }
}
