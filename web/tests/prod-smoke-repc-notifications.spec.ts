import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

const APRIL_TEST_DEAL_ID = '4d7439fb-41a5-429f-9add-908a6acc66f5';

test.describe('Production Smoke - REPC and Notifications', () => {
  test.describe.configure({ mode: 'serial' });

  test('April Test REPC route loads without crashing', async ({ page }) => {
    test.setTimeout(120_000);

    await navigateTo(page, `/deals/${APRIL_TEST_DEAL_ID}/repc`);
    await waitForLoadingToComplete(page);

    await expect(page.locator('text=Something went wrong')).toHaveCount(0);
    await expect(page.locator('text=Try Again')).toHaveCount(0);

    const repcHeading = page.getByText(/Utah REPC|REPC Readiness|REPC guidance/i).first();
    await expect(repcHeading).toBeVisible({ timeout: 30000 });
  });

  test('dashboard top bar renders without crash fallback', async ({ page }) => {
    test.setTimeout(120_000);

    await navigateTo(page, '/dashboard');
    await waitForLoadingToComplete(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Something went wrong')).toHaveCount(0);
    await expect(page.locator('text=Try Again')).toHaveCount(0);

    // Current dashboard top-bar entrypoint is Support (notification bell was removed).
    const supportButton = page.getByRole('button', { name: /support/i }).first();
    await expect(supportButton).toBeVisible({ timeout: 30000 });

    const commandBar = page.getByPlaceholder('Search properties, create tasks, find clients...').first();
    await expect(commandBar).toBeVisible({ timeout: 30000 });
  });
});
