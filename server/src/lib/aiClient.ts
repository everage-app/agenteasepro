import OpenAI from 'openai';
import { createHash } from 'crypto';

type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AIResponseFormat = 'json_object' | 'text';

interface AICompletionParams {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: AIResponseFormat;
  cacheKey?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

let openaiClient: OpenAI | null = null;
let warnedMissingKey = false;

const responseCache = new Map<string, { expiresAt: number; content: string }>();

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDefaultModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function getDefaultTimeoutMs(): number {
  return getEnvNumber('OPENAI_TIMEOUT_MS', 12000);
}

function getDefaultRetries(): number {
  return Math.max(0, Math.floor(getEnvNumber('OPENAI_MAX_RETRIES', 1)));
}

function buildCacheKey(params: AICompletionParams): string {
  const body = {
    model: params.model || getDefaultModel(),
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    responseFormat: params.responseFormat,
    messages: params.messages,
  };
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return params.cacheKey ? `${params.cacheKey}:${hash}` : hash;
}

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn('OPENAI_API_KEY not configured. AI endpoints are running in fallback mode.');
      warnedMissingKey = true;
    }
    return null;
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

function isTransientError(error: any): boolean {
  const status = error?.status;
  if (typeof status === 'number' && [408, 409, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code.includes('timeout') ||
    code.includes('econnreset') ||
    message.includes('timeout') ||
    message.includes('rate limit') ||
    message.includes('temporarily') ||
    message.includes('network')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`AI request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export function isAIConfigured(): boolean {
  return Boolean(getOpenAIClient());
}

export async function createAIChatCompletion(params: AICompletionParams): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const cacheTtlMs = params.cacheTtlMs || 0;
  const cacheKey = cacheTtlMs > 0 ? buildCacheKey(params) : null;

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.content;
    }
    if (cached && cached.expiresAt <= Date.now()) {
      responseCache.delete(cacheKey);
    }
  }

  const payload: any = {
    model: params.model || getDefaultModel(),
    messages: params.messages,
    temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
    max_tokens: typeof params.maxTokens === 'number' ? params.maxTokens : 500,
  };

  if (params.responseFormat === 'json_object') {
    payload.response_format = { type: 'json_object' };
  }

  const timeoutMs = params.timeoutMs || getDefaultTimeoutMs();
  const maxRetries = getDefaultRetries();

  let attempt = 0;
  while (true) {
    try {
      const completion = await withTimeout(client.chat.completions.create(payload), timeoutMs);
      const content = completion.choices?.[0]?.message?.content || '';
      if (!content.trim()) {
        throw new Error('AI response content is empty');
      }

      if (cacheKey) {
        responseCache.set(cacheKey, {
          content,
          expiresAt: Date.now() + cacheTtlMs,
        });
      }

      return content;
    } catch (error: any) {
      if (attempt < maxRetries && isTransientError(error)) {
        const backoffMs = 350 * (attempt + 1);
        await delay(backoffMs);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}
