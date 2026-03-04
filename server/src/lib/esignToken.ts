import crypto from 'crypto';

interface ESignTokenPayload {
  envelopeId: string;
  signerId: string;
  exp: number;
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getSecret(): string {
  return process.env.ESIGN_TOKEN_SECRET || process.env.JWT_SECRET || 'agentease-esign-fallback-secret';
}

function allowLegacyToken(): boolean {
  return process.env.ALLOW_LEGACY_ESIGN_TOKENS === 'true';
}

export function createESignToken(envelopeId: string, signerId: string): string {
  const payload: ESignTokenPayload = {
    envelopeId,
    signerId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyESignToken(
  token: string,
  envelopeId: string,
  signerId: string,
): { valid: boolean; reason?: string } {
  try {
    const [payloadB64, providedSig] = token.split('.');
    if (!payloadB64 || !providedSig) {
      if (allowLegacyToken() && token === signerId) {
        return { valid: true, reason: 'legacy-token' };
      }
      return { valid: false, reason: 'malformed-token' };
    }

    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(payloadB64)
      .digest('base64url');

    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const providedBuf = Buffer.from(providedSig, 'utf8');
    if (expectedBuf.length !== providedBuf.length) {
      return { valid: false, reason: 'signature-length-mismatch' };
    }
    if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return { valid: false, reason: 'invalid-signature' };
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as ESignTokenPayload;
    if (!payload?.envelopeId || !payload?.signerId || !payload?.exp) {
      return { valid: false, reason: 'invalid-payload' };
    }
    if (payload.envelopeId !== envelopeId || payload.signerId !== signerId) {
      return { valid: false, reason: 'payload-mismatch' };
    }
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'token-parse-failed' };
  }
}
