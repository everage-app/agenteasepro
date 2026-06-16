import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');
const AUTH_STATE_MIN_REMAINING_MS = 45 * 60_000;

const isUsableJwt = (token: string | undefined) => {
  if (!token) return false;

  try {
    const [, payload] = token.split('.');
    if (!payload) return false;

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8')) as { exp?: number };

    return typeof decodedPayload.exp === 'number' && decodedPayload.exp * 1000 > Date.now() + AUTH_STATE_MIN_REMAINING_MS;
  } catch {
    return false;
  }
};

const hasReusableAuthState = (baseURL: string) => {
  if (!fs.existsSync(authFile)) return false;

  try {
    const raw = fs.readFileSync(authFile, 'utf8');
    const parsed = JSON.parse(raw) as {
      origins?: Array<{
        origin?: string;
        localStorage?: Array<{ name?: string; value?: string }>;
      }>;
    };

    const targetOrigin = new URL(baseURL).origin;
    return Boolean(
      parsed.origins?.some((originEntry) =>
        originEntry.origin === targetOrigin &&
        originEntry.localStorage?.some(
          (item) => item.name === 'utahcontracts_token' && isUsableJwt(item.value?.trim()),
        ),
      ),
    );
  } catch {
    return false;
  }
};

/**
 * This setup file runs before all tests and creates an authenticated session.
 * The auth state is saved and reused across all test files.
 * Uses the dev-login endpoint which doesn't require password for testing.
 */
setup('authenticate', async ({ page, request }) => {
  setup.setTimeout(90_000);
  const email = process.env.PW_TEST_EMAIL?.trim() || 'demo@agentease.com';
  const password = process.env.PW_TEST_PASSWORD?.trim() || '';
  const baseURL = process.env.PW_BASE_URL?.trim() || 'http://127.0.0.1:5174';

  if (hasReusableAuthState(baseURL)) {
    return;
  }

  // The web server can come up slightly before the API proxy target is ready.
  // Retry dev-login until we get a valid JSON response containing a token.
  const startedAt = Date.now();
  const timeoutMs = 30_000;
  let token: string | null = null;
  let lastStatus: number | null = null;
  let lastBody: string | null = null;
  let lastError: string | null = null;

  if (password) {
    try {
      const loginResponse = await request.post('/api/auth/login', {
        data: { email, password },
      });
      lastStatus = loginResponse.status();
      const loginText = await loginResponse.text();
      lastBody = loginText;
      try {
        const loginJson = JSON.parse(loginText) as { token?: string };
        if (loginResponse.ok() && loginJson?.token) {
          token = loginJson.token;
        }
      } catch {
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  while (!token && Date.now() - startedAt < timeoutMs) {
    let response;
    try {
      response = await request.post('/api/auth/dev-login', {
        data: { email },
      });
    } catch (err: any) {
      lastError = err?.message || String(err);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    lastStatus = response.status();
    const text = await response.text();
    lastBody = text;

    if (response.status() >= 500) {
      throw new Error(`auth bootstrap server error from dev-login (status=${response.status()}). Body: ${text.slice(0, 400)}`);
    }

    try {
      const json = JSON.parse(text) as { token?: string };
      if (response.ok() && json?.token) {
        token = json.token;
        break;
      }
    } catch {
      // Ignore parse errors; we'll retry.
    }

    // Fallback for environments where dev-login is disabled or unstable.
    if (!token && !response.ok()) {
      const demoResponse = await request.post('/api/auth/demo-login', { data: {} });
      lastStatus = demoResponse.status();
      const demoText = await demoResponse.text();
      lastBody = demoText;

      if (demoResponse.status() >= 500) {
        throw new Error(`auth bootstrap server error from demo-login (status=${demoResponse.status()}). Body: ${demoText.slice(0, 400)}`);
      }

      try {
        const demoJson = JSON.parse(demoText) as { token?: string };
        if (demoResponse.ok() && demoJson?.token) {
          token = demoJson.token;
          break;
        }
      } catch {
        // continue retry loop
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!token) {
    const snippet = (lastBody || '').slice(0, 400);
    const errMsg = lastError ? ` Last error: ${lastError}` : '';
    throw new Error(`auth bootstrap failed within ${timeoutMs}ms (status=${lastStatus}). Body: ${snippet}.${errMsg}`);
  }
  
  // Navigate to app and set the token in localStorage
  await page.goto('/');
  
  // Set the auth token in localStorage
  await page.evaluate((authToken) => {
    localStorage.setItem('utahcontracts_token', authToken);
  }, token);
  
  // Refresh to apply the auth state
  await page.goto('/dashboard');
  
  // Wait for dashboard to load with a longer timeout
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Verify we're logged in by checking for dashboard content
  await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });

  // Save authenticated state to file
  await page.context().storageState({ path: authFile });
});
