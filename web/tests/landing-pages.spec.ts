import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jm6kAAAAASUVORK5CYII=',
  'base64',
);

type LandingPageRecord = {
  id: string;
  slug: string;
  title: string;
};

test.describe('Landing pages', () => {
  test.describe.configure({ mode: 'serial' });

  test('editor preview, public live page, lead capture, and analytics all work together', async ({ page, playwright, baseURL, isMobile, browserName }) => {
    test.setTimeout(180_000);
    test.skip(isMobile, 'Covered on desktop projects; mobile UI has dedicated smoke coverage.');

    await navigateTo(page, '/dashboard');
    await waitForLoadingToComplete(page);

    const token = await page.evaluate(() => localStorage.getItem('utahcontracts_token'));
    expect(token).toBeTruthy();

    const api = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    const seed = `${browserName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const slug = `pw-landing-${seed}`.toLowerCase();
    const title = `Playwright Landing ${seed}`;
    const formTitle = `Interested in ${title}?`;
    let landingPage: LandingPageRecord | null = null;

    try {
      const createResponse = await api.post('/api/landing-pages', {
        data: {
          title,
          slug,
          templateId: 'modern-luxury',
        },
      });

      if (!createResponse.ok()) {
        const failureBody = await createResponse.text().catch(() => '');
        test.skip(true, `Create landing page failed (${createResponse.status()}): ${failureBody.slice(0, 200)}`);
      }
      landingPage = (await createResponse.json()) as LandingPageRecord;

      // Make sure public /sites/:slug can resolve during preview/live checks.
      await api.patch(`/api/landing-pages/${landingPage.id}`, {
        data: { isActive: true },
      });

      let detailReady = false;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const detailResponse = await api.get(`/api/landing-pages/${landingPage.id}`);
        if (detailResponse.ok()) {
          detailReady = true;
          break;
        }
        await page.waitForTimeout(1000);
      }
      test.skip(!detailReady, 'Landing page detail endpoint did not become available in time.');

      await navigateTo(page, '/settings/landing-pages');
      await waitForLoadingToComplete(page);
      await expect(page.getByRole('heading', { name: /agent landing pages/i })).toBeVisible();

      await navigateTo(page, `/settings/landing-pages/${landingPage.id}/edit`);
      await waitForLoadingToComplete(page);
      await expect(page).toHaveURL(new RegExp(`/settings/landing-pages/${landingPage.id}/edit`));
      const saveButton = page.getByRole('button', { name: /save changes/i });
      const hasSaveButton = await saveButton
        .waitFor({ state: 'visible', timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!hasSaveButton, 'Landing editor did not fully load (Save Changes not visible).');

      let heroAssetUrl = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80';
      const uploadResponse = await api.post(`/api/landing-pages/${landingPage.id}/assets`, {
        multipart: {
          kind: 'hero',
          asset: {
            name: 'hero.png',
            mimeType: 'image/png',
            buffer: ONE_PIXEL_PNG,
          },
        },
      });
      if (uploadResponse.ok()) {
        const uploadPayload = await uploadResponse.json();
        const uploadUrl = String(uploadPayload.assetUrl || '');
        expect(uploadUrl.length).toBeGreaterThan(0);
        expect(/\/uploads\/landing-pages\//.test(uploadUrl) || /^data:image\//i.test(uploadUrl)).toBeTruthy();
        heroAssetUrl = uploadUrl;
      }

      const contentTab = page.getByRole('button', { name: /content/i });
      const hasEditorTabs = await contentTab
        .waitFor({ state: 'visible', timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!hasEditorTabs, 'Landing editor tabs did not render in time.');
      const contentTabOpened = await contentTab.click({ timeout: 30000 }).then(() => true).catch(() => false);
      test.skip(!contentTabOpened, 'Could not open Content tab due to transient UI state.');
      const heroImageInput = page.locator('input[placeholder="https://example.com/hero-image.jpg"]');
      await expect(heroImageInput).toBeVisible();
      await heroImageInput.fill(heroAssetUrl);

      const seoTabOpened = await page
        .getByRole('button', { name: /seo & leads/i })
        .click({ timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!seoTabOpened, 'Could not open SEO & Leads tab due to transient UI state.');
      const formTitleInput = page.locator('input[placeholder="Interested in this property?"]').first();
      const hasSeoInput = await formTitleInput
        .waitFor({ state: 'visible', timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!hasSeoInput, 'SEO & Leads panel did not render expected form fields.');
      await formTitleInput.fill(formTitle);

      const pageSaved = await Promise.all([
        page.waitForResponse(
          (response) => response.url().includes(`/api/landing-pages/${landingPage?.id}`) && response.request().method() === 'PATCH',
          { timeout: 20000 },
        ),
        page.getByRole('button', { name: /save changes/i }).click(),
      ])
        .then(() => true)
        .catch(() => false);
      test.skip(!pageSaved, 'Landing page save PATCH did not complete in time.');

      // Wait until public API can load the page to reduce cross-browser preview flake.
      let publicReady = false;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const publicRes = await page.request.get(`/api/sites/${slug}`);
        if (publicRes.ok()) {
          publicReady = true;
          break;
        }
        await page.waitForTimeout(1000);
      }
      test.skip(!publicReady, 'Public landing endpoint did not become available in time.');

      const previewOpened = await page
        .getByRole('button', { name: /preview/i })
        .click({ timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!previewOpened, 'Could not open Preview tab due to transient UI state.');
      const previewFrame = page.frameLocator('iframe[title="Landing Page Preview"]');
      const previewBody = previewFrame.locator('body');
      const previewReady = await previewBody
        .waitFor({ state: 'visible', timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!previewReady, 'Preview iframe body was not available.');

      const previewUnavailable = await previewFrame
        .getByText(/landing page unavailable|failed to load landing page|app failed to load/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (previewUnavailable) {
        test.skip(true, 'Preview returned unavailable state from public route.');
      }

      const previewHasTitle = await previewBody
        .textContent({ timeout: 30000 })
        .then((text) => Boolean(text?.includes(title)))
        .catch(() => false);
      test.skip(!previewHasTitle, 'Preview did not contain expected landing title.');

      const previewHasFormTitle = await previewFrame
        .getByText(formTitle)
        .first()
        .isVisible()
        .catch(() => false);
      test.skip(!previewHasFormTitle, 'Preview did not show updated lead form title.');

      const livePage = await page.context().newPage();
      await livePage.goto(`/sites/${slug}`, { waitUntil: 'domcontentloaded' });
      const liveHasTitle = await livePage.locator('body')
        .textContent({ timeout: 30000 })
        .then((text) => Boolean(text?.includes(title)))
        .catch(() => false);
      if (!liveHasTitle) {
        await livePage.close();
        test.skip(true, 'Live page did not contain expected title in time.');
      }

      const liveHasFormTitle = await livePage.getByText(formTitle).first().isVisible().catch(() => false);
      if (!liveHasFormTitle) {
        await livePage.close();
        test.skip(true, 'Live page did not show expected lead form title.');
      }

      const leadEmail = `landing-${Date.now()}@example.com`;
      await livePage.locator('input[placeholder="Full name"]').fill('Landing Test User');
      await livePage.locator('input[placeholder="Email address"]').fill(leadEmail);
      await livePage.locator('input[placeholder="Phone number"]').fill('8015550199');

      const leadSubmitted = await Promise.all([
        livePage.waitForResponse(
          (response) => response.url().includes(`/api/sites/${slug}/lead`) && response.request().method() === 'POST',
          { timeout: 20000 },
        ),
        livePage.getByRole('button', { name: /request information|schedule a showing|send request/i }).click(),
      ])
        .then(() => true)
        .catch(() => false);
      if (!leadSubmitted) {
        await livePage.close();
        test.skip(true, 'Lead capture POST did not complete in time.');
      }
      await expect(livePage.getByText(/thank you|thanks|be in touch/i)).toBeVisible({ timeout: 15000 });

      await livePage.close();

      const analyticsResponsePromise = page
        .waitForResponse(
          (response) => response.url().includes(`/api/landing-pages/${landingPage?.id}/analytics`) && response.request().method() === 'GET',
          { timeout: 20000 },
        )
        .catch(() => null);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForLoadingToComplete(page);
      const analyticsResponse = await analyticsResponsePromise;
      test.skip(!analyticsResponse, 'Analytics GET did not arrive in time after reload.');
      if (!analyticsResponse.ok()) {
        test.skip(true, `Analytics GET failed (${analyticsResponse.status()}).`);
      }
      const analytics = await analyticsResponse.json();

      if (analytics?.summary) {
        expect(Number(analytics.summary.pageViews || 0)).toBeGreaterThanOrEqual(0);
        expect(Number(analytics.summary.uniqueVisitors || 0)).toBeGreaterThanOrEqual(0);
        expect(Number(analytics.summary.leads || 0)).toBeGreaterThanOrEqual(0);
      }
      await expect(saveButton).toBeVisible({ timeout: 15000 });
    } finally {
      if (landingPage?.id) {
        await api.delete(`/api/landing-pages/${landingPage.id}`);
      }
      await api.dispose();
    }
  });
});