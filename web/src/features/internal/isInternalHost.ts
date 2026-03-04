export function isInternalHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower.startsWith('internal.')) return true;

  // Local convenience: treat localhost:3001 as internal-only portal.
  if (lower === 'localhost' || lower === '127.0.0.1') {
    const port = typeof window !== 'undefined' ? window.location.port : '';
    if (port === '3001') return true;
  }

  return false;
}
