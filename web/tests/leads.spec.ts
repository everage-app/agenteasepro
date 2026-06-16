import { test, expect, Page } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

async function requestAuthToken(page: Page): Promise<string> {
  const email = process.env.PW_TEST_EMAIL?.trim() || 'demo@agentease.com';
  const password = process.env.PW_TEST_PASSWORD?.trim() || '';
  const appBaseUrl = process.env.PW_BASE_URL?.trim() || 'http://127.0.0.1:5174';
  const apiUrl = (path: string) => new URL(path, appBaseUrl).toString();

  if (password) {
    const loginResponse = await page.request.post(apiUrl('/api/auth/login'), {
      data: { email, password },
    });
    const loginText = await loginResponse.text();
    if (loginResponse.ok()) {
      try {
        const loginJson = JSON.parse(loginText) as { token?: string };
        if (loginJson?.token) return loginJson.token;
      } catch {
      }
    }
  }

  const devLoginResponse = await page.request.post(apiUrl('/api/auth/dev-login'), { data: { email } });
  const devLoginText = await devLoginResponse.text();
  if (devLoginResponse.ok()) {
    try {
      const devLoginJson = JSON.parse(devLoginText) as { token?: string };
      if (devLoginJson?.token) return devLoginJson.token;
    } catch {
    }
  }

  const demoLoginResponse = await page.request.post(apiUrl('/api/auth/demo-login'), { data: {} });
  const demoLoginText = await demoLoginResponse.text();
  if (demoLoginResponse.ok()) {
    try {
      const demoLoginJson = JSON.parse(demoLoginText) as { token?: string };
      if (demoLoginJson?.token) return demoLoginJson.token;
    } catch {
    }
  }

  throw new Error(
    `Unable to obtain auth token (dev-login: ${devLoginResponse.status()}, demo-login: ${demoLoginResponse.status()})`,
  );
}

async function ensureAuthenticated(page: Page) {
  await navigateTo(page, '/dashboard');
  await waitForLoadingToComplete(page);

  const onLoginRoute = /\/login/i.test(page.url());
  const hasSignInHeading = await page
    .getByRole('heading', { name: /sign in|login|welcome back/i })
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  if (!onLoginRoute && !hasSignInHeading) {
    return;
  }

  const token = await requestAuthToken(page);
  await navigateTo(page, '/');
  await page.evaluate((authToken) => {
    localStorage.setItem('utahcontracts_token', authToken);
  }, token);
  await navigateTo(page, '/dashboard');
  await waitForLoadingToComplete(page);
}

async function ensureAtLeastOneLead(page: Page) {
  await ensureAuthenticated(page);
  await navigateTo(page, '/leads');
  await waitForLoadingToComplete(page);

  const leadRows = page.locator('table tbody tr');
  if ((await leadRows.count()) > 0) return;

  const appBaseUrl = process.env.PW_BASE_URL?.trim() || 'http://127.0.0.1:5174';
  const token = (await page.evaluate(() => localStorage.getItem('utahcontracts_token') || '')).trim();
  if (!token) {
    throw new Error(`No auth token found while preparing leads test at URL: ${page.url()}`);
  }

  const unique = Date.now();
  const createLeadResponse = await page.request.post(new URL('/api/leads', appBaseUrl).toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      firstName: 'Playwright',
      lastName: 'Lead',
      email: `playwright.lead.${unique}@example.com`,
      source: 'WEBSITE',
      priority: 'WARM',
      notes: 'Auto-created by leads Playwright test',
    },
  });

  if (!createLeadResponse.ok()) {
    const responseText = await createLeadResponse.text();
    throw new Error(`Failed to seed lead (${createLeadResponse.status()}): ${responseText.slice(0, 300)}`);
  }

  await navigateTo(page, '/leads');
  await waitForLoadingToComplete(page);
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Leads Page', () => {
  test.setTimeout(90_000);

  test('row click opens the matching lead profile', async ({ page }) => {
    await ensureAtLeastOneLead(page);

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    const leadCell = firstRow.locator('td').nth(1);
    const leadName = ((await leadCell.locator('div').first().textContent()) || '').replace(/\s+/g, ' ').trim();

    await leadCell.click({ force: true });

    await expect(page).toHaveURL(/\/leads\/[a-z0-9-]+$/i, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Profile Details/i })).toBeVisible({ timeout: 10000 });
    if (leadName) {
      await expect(page.getByRole('heading', { name: leadName, exact: true })).toBeVisible({ timeout: 10000 });
    }
    await expect(page.getByRole('heading', { name: /^New Task$/i })).toHaveCount(0);
  });
});
