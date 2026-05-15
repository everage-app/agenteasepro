export function toDisplayErrorMessage(value: unknown, fallback = 'Something went wrong'): string {
  const readMessage = (candidate: unknown, depth: number): string | null => {
    if (depth > 4 || candidate == null) return null;

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed || null;
    }

    if (candidate instanceof Error) {
      return readMessage(candidate.message, depth + 1);
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const message = readMessage(item, depth + 1);
        if (message) return message;
      }
      return null;
    }

    if (typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      for (const key of ['message', 'error', 'detail', 'details', 'reason', 'code']) {
        const message = readMessage(record[key], depth + 1);
        if (message) return message;
      }
    }

    return null;
  };

  return readMessage(value, 0) || fallback;
}