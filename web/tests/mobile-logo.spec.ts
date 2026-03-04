import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

test.describe('Mobile logo alignment', () => {
  test('house icon stays centered in mobile header for dark and light modes', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.toLowerCase().includes('mobile'), 'Runs only on mobile projects.');

    await navigateTo(page, '/dashboard');
    await waitForLoadingToComplete(page);

    const openMenuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(openMenuButton).toBeVisible();

    const mobileHeader = openMenuButton.locator('xpath=ancestor::div[contains(@class,"h-14")]').first();
    await expect(mobileHeader).toBeVisible();

    const logoHouseGroup = mobileHeader.locator('svg.ae-logo-icon g').first();
    await expect(logoHouseGroup).toBeVisible();

    await expect(logoHouseGroup).toHaveAttribute('transform', 'translate(7, 18)');

    const toggleThemeButton = page.getByRole('button', {
      name: /Switch to light mode|Switch to dark mode/i,
    });
    await expect(toggleThemeButton).toBeVisible();

    await toggleThemeButton.click();
    await page.waitForTimeout(250);

    await expect(logoHouseGroup).toHaveAttribute('transform', 'translate(7, 18)');
  });
});
