import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * This setup file runs before all tests and creates an authenticated session.
 * The auth state is saved and reused across all test files.
 * Uses the dev-login endpoint which doesn't require password for testing.
 */
setup('authenticate', async ({ page, request }) => {
  setup.setTimeout(90_000);
  const email = process.env.PW_TEST_EMAIL?.trim() || 'demo@agentease.com';
  const password = process.env.PW_TEST_PASSWORD?.trim() || '';

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
