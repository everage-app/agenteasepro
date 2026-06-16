export function isTransientPrismaError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code || '');
  return code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017';
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientPrismaError(error) || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}

export async function runBestEffortPrisma(
  label: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await withPrismaRetry(operation);
  } catch (error) {
    const reason = isTransientPrismaError(error) ? 'transient database failure' : 'non-critical database failure';
    console.warn(`${label} skipped after ${reason}:`, error);
  }
}
