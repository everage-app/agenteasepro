import { prisma } from '../lib/prisma';
import crypto from 'crypto';

// Get encryption key - fallback only allowed in development/test mode
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (key) return key;
  const env = (process.env.NODE_ENV || '').toLowerCase();
  if (env === 'development' || env === 'test') {
    return 'dev-only-32-character-secret!!'; // 32 chars for aes-256
  }
  throw new Error('ENCRYPTION_KEY environment variable is required in production');
}
const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function tryDecrypt(text: string): string {
  if (!text) return '';
  // If it's not in iv:payload form, assume plaintext.
  if (!text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = parts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text;
  }
}

function getEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google token refresh failed (${resp.status}): ${text.slice(0, 500)}`);
  }

  const json = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Google token refresh returned no access_token');

  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  return { accessToken: json.access_token, expiresAt };
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  location?: string;
  htmlLink?: string;
  allDay?: boolean;
}

export async function getGoogleCalendarEventsForRange(agentId: string, from: Date, to: Date): Promise<GoogleCalendarEvent[]> {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { agentId } });
  if (!connection || !connection.syncEnabled) return [];

  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');

  let accessToken = tryDecrypt(connection.accessToken);
  const refreshToken = tryDecrypt(connection.refreshToken);

  // Refresh if expired (or nearly expired)
  const refreshThresholdMs = 60_000;
  if (connection.tokenExpiry.getTime() - Date.now() < refreshThresholdMs) {
    if (!clientId || !clientSecret) {
      console.warn('Google Calendar connected but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set; skipping Google events.');
      return [];
    }

    try {
      const refreshed = await refreshAccessToken({ clientId, clientSecret, refreshToken });
      accessToken = refreshed.accessToken;

      await prisma.googleCalendarConnection.update({
        where: { agentId },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          tokenExpiry: refreshed.expiresAt,
        },
      });
    } catch (err) {
      console.error('Failed to refresh Google Calendar access token:', err);
      return [];
    }
  }

  const calendarId = connection.calendarId || 'primary';
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('timeMin', from.toISOString());
  url.searchParams.set('timeMax', to.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '50');

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.warn(`Google Calendar events fetch failed (${resp.status}): ${text.slice(0, 500)}`);
    return [];
  }

  const json = (await resp.json()) as any;
  const items = Array.isArray(json?.items) ? json.items : [];

  const events: GoogleCalendarEvent[] = [];
  for (const item of items) {
    const startRaw = item?.start?.dateTime || item?.start?.date;
    const endRaw = item?.end?.dateTime || item?.end?.date;
    if (!startRaw) continue;

    const start = new Date(startRaw);
    const end = endRaw ? new Date(endRaw) : undefined;

    events.push({
      id: String(item.id || crypto.randomUUID()),
      title: String(item.summary || 'Calendar event'),
      description: item.description ? String(item.description) : undefined,
      location: item.location ? String(item.location) : undefined,
      htmlLink: item.htmlLink ? String(item.htmlLink) : undefined,
      start,
      end,
      allDay: Boolean(item?.start?.date && !item?.start?.dateTime),
    });
  }

  return events;
}
