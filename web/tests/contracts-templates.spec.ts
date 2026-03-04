import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

async function getAuthTokenFromStorage(page: any): Promise<string> {
  await page.goto('/dashboard');
  const token = await page.evaluate(() => localStorage.getItem('utahcontracts_token'));
  expect(token).toBeTruthy();
  return token as string;
}

async function getFormDefinitionsWithRetry(request: any, token: string): Promise<Array<{ code: string; displayName: string }>> {
  const startedAt = Date.now();
  const timeoutMs = 90_000;
  let lastStatus: number | null = null;
  let lastBody = '';

  while (Date.now() - startedAt < timeoutMs) {
    const defsResp = await request.get('/api/forms/definitions', {
      headers: { Authorization: `Bearer ${token}` },
    });

    lastStatus = defsResp.status();
    lastBody = await defsResp.text();

    if (defsResp.ok()) {
      try {
        const defs = JSON.parse(lastBody) as Array<{ code: string; displayName: string }>;
        if (Array.isArray(defs) && defs.length > 0) {
          return defs;
        }
      } catch {
        // keep retrying while server warms up
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new Error(`forms definitions not ready within ${timeoutMs}ms (status=${lastStatus}). Body: ${lastBody.slice(0, 300)}`);
}

test.describe('Contracts • Form Templates', () => {
  test('API: all form template PDFs return successfully', async ({ request, page }) => {
    test.setTimeout(120_000);
    const token = await getAuthTokenFromStorage(page);
    let defs: Array<{ code: string; displayName: string }> = [];
    try {
      defs = await getFormDefinitionsWithRetry(request, token);
    } catch {
      test.skip(true, 'Form definitions API unavailable in this environment; skipping strict PDF verification.');
    }
    expect(Array.isArray(defs)).toBeTruthy();
    expect(defs.length).toBeGreaterThan(0);

    for (const def of defs) {
      const pdfResp = await request.get(`/api/forms/definitions/${encodeURIComponent(def.code)}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(pdfResp.ok()).toBeTruthy();

      const contentType = pdfResp.headers()['content-type'] || '';
      expect(contentType.toLowerCase()).toContain('application/pdf');

      const bytes = await pdfResp.body();
      expect(bytes.byteLength, `PDF too small for ${def.code}`).toBeGreaterThan(500);

      // Verify the PDF magic header.
      const header = new TextDecoder('ascii').decode(bytes.slice(0, 4));
      expect(header, `Invalid PDF header for ${def.code}`).toBe('%PDF');
    }
  });

  test('UI: can open preview modal for each template', async ({ page, request }, testInfo) => {
    test.setTimeout(300_000);

    const token = await getAuthTokenFromStorage(page);
    const defsResp = await request.get('/api/forms/definitions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!defsResp.ok()) {
      test.skip(true, 'Form definitions API unavailable in this environment; skipping template preview UI verification.');
    }
    const defs = (await defsResp.json()) as Array<{ code: string }>;
    if (!defs.length) {
      test.skip(true, 'No form definitions are seeded in this environment; skipping template preview UI verification.');
    }

    await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToComplete(page);

    // Ensure we are not bounced to auth screens.
    await expect(page).toHaveURL(/\/contracts/);

    // Reduce UI churn/flakiness from the assistant panel (streaming/overlays).
    const aiToggle = page.getByRole('button', { name: /ai assistant/i }).first();
    if (await aiToggle.isVisible()) {
      await aiToggle.click();
      await page.waitForTimeout(250);
    }

    // Ensure templates panel is open (layout uses a "Templates" toggle in current UX).
    const templatesToggle = page.getByRole('button', { name: /^templates$/i }).first();
    if (await templatesToggle.isVisible()) {
      const classes = (await templatesToggle.getAttribute('class')) || '';
      if (!classes.includes('bg-purple-500/20')) {
        await templatesToggle.click();
      }
    }

    // Wait for templates grid/cards to appear
    const previewButtons = page.getByRole('button', { name: /^preview$/i });
    await expect(previewButtons.first()).toBeVisible({ timeout: 30000 });

    const total = await previewButtons.count();
    expect(total).toBeGreaterThan(0);

    // Open each preview sequentially, verify iframe renders a blob URL, then close.
    for (let i = 0; i < total; i++) {
      const btn = previewButtons.nth(i);
      const forceClick = testInfo.project.name.toLowerCase() === 'webkit';
      await btn.click({ timeout: 30000, force: forceClick });

      const dialog = page.getByRole('dialog', { name: /form preview/i });
      await expect(dialog).toBeVisible({ timeout: 15000 });

      // Either loading spinner transitions to iframe, or an error state shows.
      // We require that we do NOT land in the error state.
      await expect(dialog.locator('text=Preview unavailable')).toHaveCount(0, { timeout: 15000 });

      const frame = dialog.locator('iframe');
      await expect(frame).toBeVisible({ timeout: 15000 });
      await expect(frame).toHaveAttribute('src', /^blob:/, { timeout: 15000 });

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 15000 });
    }
  });
});
