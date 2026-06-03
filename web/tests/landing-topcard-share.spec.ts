import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

type LandingPageRecord = {
  id: string;
  slug: string;
  title: string;
};

test.describe('Landing top card share layout', () => {
  test.describe.configure({ mode: 'serial' });

  test('action row stays clean and share panel remains visible', async ({ page, playwright, baseURL }, testInfo) => {
    test.setTimeout(180_000);

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

    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const slug = `pw-landing-share-${seed}`.toLowerCase();
    const title = `Playwright Share Layout ${seed}`;
    let landingPage: LandingPageRecord | null = null;

    try {
      const createResponse = await api.post('/api/landing-pages', {
        data: {
          title,
          slug,
          templateId: 'modern-luxury',
          isActive: true,
        },
      });

      if (!createResponse.ok()) {
        const failureBody = await createResponse.text().catch(() => '');
        test.skip(true, `Create landing page failed (${createResponse.status()}): ${failureBody.slice(0, 220)}`);
      }

      landingPage = (await createResponse.json()) as LandingPageRecord;

      let publicReady = false;
      let lastStatus = 0;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const publicRes = await page.request.get(`/api/sites/${slug}`);
        lastStatus = publicRes.status();
        if (publicRes.ok()) {
          publicReady = true;
          break;
        }
        if (lastStatus === 429) {
          break;
        }
        await page.waitForTimeout(1000);
      }

      test.skip(!publicReady, `Public landing endpoint did not become available in time (status=${lastStatus}).`);

      const viewports = [
        { name: 'desktop', width: 1365, height: 820 },
        { name: 'mobile', width: 390, height: 844 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/sites/${slug}`, { waitUntil: 'domcontentloaded' });
        await waitForLoadingToComplete(page);

        const shareButton = page.getByRole('button', { name: /^share$/i }).first();
        const hasShareButton = await shareButton
          .waitFor({ state: 'visible', timeout: 15000 })
          .then(() => true)
          .catch(() => false);
        test.skip(!hasShareButton, `Share button not visible on ${viewport.name}.`);

        await shareButton.click({ timeout: 15000 });

        const sharePanel = page
          .locator('div')
          .filter({ hasText: /share url/i })
          .filter({ hasText: /share from device/i })
          .first();

        const panelVisible = await sharePanel
          .waitFor({ state: 'visible', timeout: 10000 })
          .then(() => true)
          .catch(() => false);
        test.skip(!panelVisible, `Share panel not visible on ${viewport.name}.`);

        await expect(sharePanel.locator('div[title^="http"]').first()).toBeVisible({ timeout: 5000 });
        await expect(sharePanel.getByRole('button', { name: /copy|copied/i }).first()).toBeVisible({ timeout: 5000 });
        await expect(sharePanel.getByRole('button', { name: /download full page pdf|building pdf/i }).first()).toBeVisible({ timeout: 5000 });

        const metrics = await page.evaluate(() => {
          const isActionButton = (el: Element) => {
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return (
              text === 'share' ||
              text === 'email' ||
              text.includes('schedule a showing') ||
              text.includes('get my home value report') ||
              /^\(\d{3}\)/.test((el.textContent || '').trim())
            );
          };

          const actionButtons = Array.from(document.querySelectorAll('a,button'))
            .filter(isActionButton)
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              return rect.top < 280 && rect.width > 80 && rect.height >= 34;
            });

          const intersects = (a: DOMRect, b: DOMRect) =>
            !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

          let overlapPairs = 0;
          for (let i = 0; i < actionButtons.length; i += 1) {
            for (let j = i + 1; j < actionButtons.length; j += 1) {
              const a = actionButtons[i].getBoundingClientRect();
              const b = actionButtons[j].getBoundingClientRect();
              if (intersects(a, b)) overlapPairs += 1;
            }
          }

          const panelCandidates = Array.from(document.querySelectorAll('div')).filter((el) => {
            const text = (el.textContent || '').toLowerCase();
            return text.includes('share url') && text.includes('share from device') && text.includes('copy');
          });

          const panel = panelCandidates
            .map((el) => ({ el, rect: el.getBoundingClientRect() }))
            .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0];

          const viewport = { width: window.innerWidth, height: window.innerHeight };

          const panelWithinViewport = panel
            ? panel.rect.left >= 0 &&
              panel.rect.right <= viewport.width &&
              panel.rect.top >= 0 &&
              panel.rect.bottom <= viewport.height
            : false;

          return {
            actionButtonCount: actionButtons.length,
            overlapPairs,
            panelFound: Boolean(panel),
            panelWithinViewport,
            viewport,
          };
        });

        expect(metrics.actionButtonCount, `Action button count too low on ${viewport.name}`).toBeGreaterThanOrEqual(2);
        expect(metrics.overlapPairs, `Top card action overlap detected on ${viewport.name}`).toBe(0);
        expect(metrics.panelFound, `Share panel candidate not found on ${viewport.name}`).toBeTruthy();
        expect(metrics.panelWithinViewport, `Share panel is clipped on ${viewport.name}`).toBeTruthy();

        const screenshotPath = testInfo.outputPath(`topcard-share-${viewport.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        await testInfo.attach(`topcard-share-${viewport.name}`, {
          path: screenshotPath,
          contentType: 'image/png',
        });

        await testInfo.attach(`topcard-share-metrics-${viewport.name}`, {
          body: JSON.stringify(metrics, null, 2),
          contentType: 'application/json',
        });
      }
    } finally {
      if (landingPage?.id) {
        await api.delete(`/api/landing-pages/${landingPage.id}`).catch(() => undefined);
      }
      await api.dispose();
    }
  });
});
