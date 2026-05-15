import crypto from 'crypto';

type ContactType = 'lead' | 'client';

interface ReplyTokenPayload {
  a: string;
  t: ContactType;
  c: string;
  iat: number;
}

const MAX_TOKEN_AGE_MS = 1000 * 60 * 60 * 24 * 60;

function getReplySecret(): string {
  return (process.env.SENDGRID_REPLY_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
}

function getReplyDomain(): string {
  return (process.env.SENDGRID_INBOUND_REPLY_DOMAIN || process.env.SENDGRID_REPLY_INBOUND_DOMAIN || '').trim();
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayload(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export function buildContactReplyToAddress(params: {
  agentId: string;
  contactType: ContactType;
  contactId: string;
  replyToken?: string;
}): string | null {
  const domain = getReplyDomain();
  if (!domain) return null;

  if (params.replyToken) {
    return `reply+${params.replyToken}@${domain}`;
  }

  const secret = getReplySecret();
  if (!secret) return null;

  const payload: ReplyTokenPayload = {
    a: params.agentId,
    t: params.contactType,
    c: params.contactId,
    iat: Date.now(),
  };

  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = signPayload(payloadB64, secret);
  const token = `${payloadB64}.${sig}`;

  return `reply+${token}@${domain}`;
}

export function generateContactReplyToken(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export function verifyContactReplyToken(token: string): {
  agentId: string;
  contactType: ContactType;
  contactId: string;
} | null {
  const secret = getReplySecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = signPayload(payloadB64, secret);
  const actualSigBuf = Buffer.from(sig, 'utf8');
  const expectedSigBuf = Buffer.from(expectedSig, 'utf8');
  if (actualSigBuf.length !== expectedSigBuf.length) return null;
  if (!crypto.timingSafeEqual(actualSigBuf, expectedSigBuf)) return null;

  let decoded: ReplyTokenPayload;
  try {
    decoded = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return null;
  }

  if (!decoded || typeof decoded !== 'object') return null;
  if (!decoded.a || !decoded.c || (decoded.t !== 'lead' && decoded.t !== 'client')) return null;
  if (!Number.isFinite(decoded.iat)) return null;
  if (Date.now() - decoded.iat > MAX_TOKEN_AGE_MS) return null;

  return {
    agentId: decoded.a,
    contactType: decoded.t,
    contactId: decoded.c,
  };
}

export function extractReplyTokenFromAddressList(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  const regex = /reply\+([A-Za-z0-9._-]+)@/g;
  const match = regex.exec(value);
  if (!match || !match[1]) return null;
  return match[1];
}

export function extractEmailAddress(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  const angled = value.match(/<([^>]+)>/);
  const candidate = (angled?.[1] || value).trim();
  const emailMatch = candidate.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!emailMatch) return null;
  return emailMatch[0].toLowerCase();
}
