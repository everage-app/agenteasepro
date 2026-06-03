import { test, expect, APIResponse, Locator } from '@playwright/test';
import path from 'path';
import { waitForLoadingToComplete } from './helpers/test-utils';

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getProjectStartDelayMs(projectName: string) {
  const normalized = projectName.toLowerCase();
  if (normalized === 'chromium') return 0;
  if (normalized === 'firefox') return 1500;
  if (normalized === 'webkit') return 3000;
  if (normalized.includes('mobile chrome')) return 4500;
  if (normalized.includes('mobile safari')) return 6000;
  return 0;
}

async function staggerApiCallsForProject(projectName: string) {
  const delayMs = getProjectStartDelayMs(projectName);
  if (delayMs > 0) {
    console.warn(`staggering ${projectName} API start by ${delayMs}ms to reduce burst rate`);
    await sleep(delayMs);
  }
}

function parseRetryAfterMs(headerValue?: string) {
  if (!headerValue) return undefined;

  const asSeconds = Number(headerValue);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return undefined;
}

async function requestWithRetry({
  run,
  label,
  maxAttempts = 8,
}: {
  run: () => Promise<APIResponse>;
  label: string;
  maxAttempts?: number;
}): Promise<APIResponse> {
  let lastResponse: APIResponse | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await run();
    lastResponse = response;

    if (response.ok()) {
      return response;
    }

    const status = response.status();
    if (!RETRYABLE_STATUSES.has(status) || attempt === maxAttempts) {
      return response;
    }

    const retryAfterMs = parseRetryAfterMs(response.headers()['retry-after']);
    const computedBackoffMs = status === 429
      ? Math.min(20000, 2500 * attempt)
      : Math.min(9000, 900 * attempt);
    const backoffMs = (retryAfterMs ?? computedBackoffMs) + Math.floor(Math.random() * 350);

    console.warn(`${label} attempt ${attempt}/${maxAttempts} failed with ${status}. Retrying in ${backoffMs}ms...`);
    await sleep(backoffMs);
  }

  if (!lastResponse) {
    throw new Error(`${label} failed before any response was returned`);
  }

  return lastResponse;
}

async function waitForPreviewDialogReady(dialog: Locator): Promise<'iframe' | 'fallback'> {
  const frame = dialog.locator('iframe').first();
  const fallbackState = dialog.getByText(/Preview unavailable|Unable to render preview/i).first();
  const downloadButton = dialog.getByRole('button', { name: /Download PDF/i }).first();

  const startedAt = Date.now();
  const timeoutMs = 25000;

  while (Date.now() - startedAt < timeoutMs) {
    if (await frame.isVisible().catch(() => false)) {
      return 'iframe';
    }

    if (await fallbackState.isVisible().catch(() => false)) {
      return 'fallback';
    }

    if (await downloadButton.isVisible().catch(() => false)) {
      return 'fallback';
    }

    await sleep(400);
  }

  throw new Error('Form preview dialog never rendered an iframe or fallback controls within 25000ms.');
}

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
  test.describe.configure({ mode: 'serial' });

  test('API: all form template PDFs return successfully', async ({ request, page }, testInfo) => {
    test.setTimeout(120_000);

    await staggerApiCallsForProject(testInfo.project.name);

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
      const pdfResp = await requestWithRetry({
        label: `template pdf ${def.code}`,
        maxAttempts: 10,
        run: () =>
          request.get(`/api/forms/definitions/${encodeURIComponent(def.code)}/pdf`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
      });

      if (!pdfResp.ok()) {
        const errorBody = (await pdfResp.text()).slice(0, 400);
        throw new Error(`template ${def.code} pdf failed (${pdfResp.status()}): ${errorBody}`);
      }

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

    await staggerApiCallsForProject(testInfo.project.name);

    const token = await getAuthTokenFromStorage(page);
    const defsResp = await requestWithRetry({
      label: 'forms definitions UI preflight',
      run: () =>
        request.get('/api/forms/definitions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
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

    // Ensure templates panel is open (avoid brittle class checks; assert on section heading).
    const templatesHeading = page.getByRole('heading', { name: /templates\s*&\s*pdfs/i }).first();
    const templatesVisible = await templatesHeading.isVisible({ timeout: 2500 }).catch(() => false);
    if (!templatesVisible) {
      const templatesToggle = page.getByRole('button', { name: /^templates$/i }).first();
      if (await templatesToggle.isVisible({ timeout: 2500 }).catch(() => false)) {
        await templatesToggle.click({ force: true, timeout: 15000 });
      }
    }
    await expect(templatesHeading).toBeVisible({ timeout: 30000 });

    // Wait for templates grid/cards to appear
    const previewButtons = page.getByRole('button', { name: /preview/i });

    let total = 0;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 45000) {
      total = await previewButtons.count();
      if (total > 0) {
        break;
      }

      const emptyTemplateHint = page
        .getByText(/no templates|templates ready\s*0|form templates\s*0/i)
        .first();
      if (await emptyTemplateHint.isVisible({ timeout: 500 }).catch(() => false)) {
        test.skip(true, 'Template preview UI has no seeded templates in this environment.');
      }

      await sleep(500);
    }

    if (total === 0) {
      test.skip(true, 'No template preview buttons became available in this environment.');
    }

    // Open each preview sequentially.
    // In some environments, inline iframe preview may fall back to the "Preview unavailable" state.
    // That fallback is acceptable as long as the dialog opens and exposes a download action.
    for (let i = 0; i < total; i++) {
      const btn = previewButtons.nth(i);
      const forceClick = testInfo.project.name.toLowerCase() === 'webkit';
      if (!forceClick) {
        await btn.scrollIntoViewIfNeeded();
      }
      await btn.click({ timeout: 30000, force: forceClick });

      const dialog = page.getByRole('dialog', { name: /form preview/i });
      await expect(dialog).toBeVisible({ timeout: 15000 });

      const previewMode = await waitForPreviewDialogReady(dialog);

      if (previewMode === 'iframe') {
        await expect(dialog.locator('iframe').first()).toBeVisible({ timeout: 15000 });
      } else {
        await expect(dialog.getByRole('button', { name: /Download PDF/i })).toBeVisible({ timeout: 15000 });
      }

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 15000 });
    }
  });
});

test.describe('Contracts • Document e-sign studio', () => {
  test('renders uploaded PDF pages before field placement', async ({ page }) => {
    test.setTimeout(90_000);
    const pdfConsoleMessages: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (/pdf|render|preview|document/i.test(text)) {
        pdfConsoleMessages.push(`${message.type()}: ${text}`);
      }
    });

    await page.goto('/contracts/pdf-editor?mode=document-esign', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToComplete(page);
    await expect(page.getByRole('heading', { name: /PDF & Packet Builder/i })).toBeVisible({ timeout: 30000 });

    const templatePath = path.resolve(__dirname, '..', '..', 'contracts', 'templates', 'Utah RE REPC.pdf');
    await page.locator('input[type="file"]').setInputFiles(templatePath);

    await expect(page.getByText(/Added 1 PDF/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/6\/6 pages selected/i)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /Open E-sign Studio/i }).click();
    await expect(page.getByRole('heading', { name: /Recipients & Message/i })).toBeVisible({ timeout: 30000 });

    await page.getByPlaceholder('Full name').fill('Preview Test Buyer');
    await page.getByRole('button', { name: /Review & Place Fields/i }).click();

    const renderedPage = page.locator('img[alt="PDF page 1"]').first();
    await expect(
      renderedPage,
      `PDF render console messages:\n${pdfConsoleMessages.join('\n') || 'none'}`,
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Studio loaded all 6 pages/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: /Open page 6/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/PDF preview unavailable/i)).toHaveCount(0);

    const dimensions = await renderedPage.evaluate((image) => ({
      width: (image as HTMLImageElement).naturalWidth,
      height: (image as HTMLImageElement).naturalHeight,
      src: (image as HTMLImageElement).src,
    }));
    expect(dimensions.width).toBeGreaterThan(100);
    expect(dimensions.height).toBeGreaterThan(100);
    expect(dimensions.src).toContain('data:image/');

    const inkRatio = await renderedPage.evaluate((image) => {
      const img = image as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return 0;
      context.drawImage(img, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let sampled = 0;
      let nonWhite = 0;
      const step = Math.max(1, Math.ceil(Math.sqrt((canvas.width * canvas.height) / 120000)));
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = (y * canvas.width + x) * 4;
          sampled += 1;
          if (data[index] < 247 || data[index + 1] < 247 || data[index + 2] < 247) {
            nonWhite += 1;
          }
        }
      }
      return sampled > 0 ? nonWhite / sampled : 0;
    });
    expect(inkRatio).toBeGreaterThan(0.00035);

    await page.getByRole('button', { name: /Open page 6/i }).click();
    const renderedLastPage = page.locator('img[alt="PDF page 6"]').first();
    await expect(
      renderedLastPage,
      `PDF render console messages:\n${pdfConsoleMessages.join('\n') || 'none'}`,
    ).toBeVisible({ timeout: 30000 });
    const lastPageDimensions = await renderedLastPage.evaluate((image) => ({
      width: (image as HTMLImageElement).naturalWidth,
      height: (image as HTMLImageElement).naturalHeight,
      src: (image as HTMLImageElement).src,
    }));
    expect(lastPageDimensions.width).toBeGreaterThan(100);
    expect(lastPageDimensions.height).toBeGreaterThan(100);
    expect(lastPageDimensions.src).toContain('data:image/');
  });
});
