export function stripPhone(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

function formatTenDigits(digits10: string): string {
  return `(${digits10.slice(0, 3)}) ${digits10.slice(3, 6)}-${digits10.slice(6)}`;
}

/**
 * Formats a phone value for use in an input while the user types.
 * Assumes US-style 10-digit numbers (Utah). Keeps partial formatting.
 */
export function formatPhoneInput(raw: string): string {
  const digits = stripPhone(raw).slice(0, 11);
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const len = normalized.length;

  if (len === 0) return '';
  if (len < 4) return `(${normalized}`;
  if (len < 7) return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  if (len <= 10) return formatTenDigits(normalized.padEnd(10, '_').replace(/_+$/, ''));
  return raw;
}

/**
 * Normalizes a phone for storage/transmission.
 * Prefers digits-only so `tel:` links and searching are predictable.
 */
export function normalizePhoneForStorage(raw: string): string | null {
  const digits = stripPhone(raw);
  if (!digits) return null;
  // Keep up to 15 digits to be safe for international numbers.
  return digits.slice(0, 15);
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = stripPhone(raw);
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (normalized.length === 10) return formatTenDigits(normalized);
  return raw;
}

export function phoneToTelHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = stripPhone(raw);
  if (!digits) return null;

  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return `tel:${digits}`;
}

export function phoneToSmsHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = stripPhone(raw);
  if (!digits) return null;

  if (digits.length === 10) return `sms:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `sms:+${digits}`;
  return `sms:${digits}`;
}
