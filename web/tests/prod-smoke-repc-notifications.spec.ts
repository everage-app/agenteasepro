import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

const APRIL_TEST_DEAL_ID = '4d7439fb-41a5-429f-9add-908a6acc66f5';

test.describe('Production Smoke • REPC and Notifications', () => {
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

  test('dashboard bell opens in-app notification center', async ({ page }) => {
    test.setTimeout(120_000);

    await navigateTo(page, '/dashboard');
    await waitForLoadingToComplete(page);

    const bellButton = page.locator('button[aria-label*="Open notifications"]').first();
    await expect(bellButton).toBeVisible({ timeout: 30000 });
    await bellButton.click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Notification center/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Live preferences/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /full settings/i })).toBeVisible({ timeout: 15000 });
  });
});