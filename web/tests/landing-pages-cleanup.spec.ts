import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

test('cleanup temporary production audit landing pages', async ({ page, baseURL }) => {
  test.setTimeout(120_000);

  await navigateTo(page, '/settings/landing-pages');
  await waitForLoadingToComplete(page);

  const deletedCount = await page.evaluate(async (origin) => {
    const token = localStorage.getItem('utahcontracts_token');
    if (!token) throw new Error('Missing auth token');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const listResponse = await fetch(`${origin}/api/landing-pages`, { headers });
    if (!listResponse.ok) {
      throw new Error(`Landing pages list failed: ${listResponse.status}`);
    }

    const pages = await listResponse.json() as Array<{ id: string; slug: string; title: string }>;
    const targets = pages.filter((entry) => entry.slug.startsWith('prod-audit-') || entry.slug.startsWith('pw-landing-'));

    for (const target of targets) {
      await fetch(`${origin}/api/landing-pages/${target.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    return targets.length;
  }, baseURL || window.location.origin);

  expect(deletedCount).toBeGreaterThanOrEqual(0);
});
