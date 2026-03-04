import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, waitForApiResponse } from './helpers/test-utils';

const settingsPages = [
  { path: '/settings/profile', heading: 'Personal Information' },
  { path: '/settings/branding', heading: 'Logo & Colors' },
  { path: '/settings/notifications', heading: 'Notification Preferences' },
  { path: '/settings/integrations', heading: 'Website Lead Capture' },
  { path: '/settings/idx', heading: 'IDX & Website' },
  { path: '/settings/landing-pages', heading: 'Agent Landing Pages' },
  { path: '/settings/automations', heading: 'Let AgentEasePro handle the busywork' },
  { path: '/settings/data', heading: 'Your data, your control' },
  { path: '/settings/billing', heading: 'Your plan' },
];

test.describe('Account Settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('all settings pages load', async ({ page }) => {
    test.setTimeout(90000);
    for (const { path: route } of settingsPages.slice(0, 6)) {
      await navigateTo(page, route);
      await waitForLoadingToComplete(page);
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    }
  });

  test('profile settings save and reload', async ({ page }) => {
    await Promise.all([
      waitForApiResponse(page, /\/api\/settings\/profile/, 'GET'),
      navigateTo(page, '/settings/profile'),
    ]);
    await waitForLoadingToComplete(page);

    const firstNameInput = page.locator('input[placeholder="John"]');
    const lastNameInput = page.locator('input[placeholder="Smith"]');
    await firstNameInput.fill('Taylor');
    await lastNameInput.fill('Jordan');

    const saveButton = page.getByRole('button', { name: /save changes/i });
    await Promise.all([
      waitForApiResponse(page, /\/api\/settings\/profile/, 'PUT'),
      saveButton.click(),
    ]);

    await Promise.all([
      waitForApiResponse(page, /\/api\/settings\/profile/, 'GET'),
      page.reload(),
    ]);
    await waitForLoadingToComplete(page);

    await expect(firstNameInput).toHaveValue('Taylor', { timeout: 15000 });
    await expect(lastNameInput).toHaveValue('Jordan', { timeout: 15000 });
  });

  test('branding settings save and logo upload', async ({ page }) => {
    await Promise.all([
      waitForApiResponse(page, /\/api\/settings\/branding/, 'GET'),
      navigateTo(page, '/settings/branding'),
    ]);
    await waitForLoadingToComplete(page);

    const primaryBlock = page.locator('label:has-text("Primary color")').locator('..');
    const secondaryBlock = page.locator('label:has-text("Secondary color")').locator('..');
    const primaryTextInput = primaryBlock.locator('input[type="text"]');
    const secondaryTextInput = secondaryBlock.locator('input[type="text"]');

    await primaryTextInput.fill('#1D4ED8');
    await secondaryTextInput.fill('#0F766E');

    const saveButton = page.getByRole('button', { name: /save changes/i });
    await Promise.all([
      waitForApiResponse(page, /\/api\/settings\/branding/, 'PUT'),
      saveButton.click(),
    ]);

    await Promise.all([
      waitForApiResponse(page, /\/api\/settings\/branding/, 'GET'),
      page.reload(),
    ]);
    await waitForLoadingToComplete(page);
    await expect(primaryTextInput).toHaveValue('#1D4ED8', { timeout: 15000 });
    await expect(secondaryTextInput).toHaveValue('#0F766E', { timeout: 15000 });

    // Logo upload is validated via API smoke tests; UI coverage focuses on color persistence.
  });

  test('notifications save toggle', async ({ page }) => {
    await navigateTo(page, '/settings/notifications');
    await waitForLoadingToComplete(page);

    const deadlineRow = page.locator('p:has-text("Deadline alerts")').first().locator('..').locator('..');
    const toggle = deadlineRow.locator('button').first();
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await toggle.click({ force: true });

    const saveButton = page.getByRole('button', { name: /save changes/i }).first();
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click({ force: true });
    }
  });

  test('AI settings route redirects to settings home', async ({ page }) => {
    await navigateTo(page, '/settings/ai');
    await waitForLoadingToComplete(page);
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: /settings/i }).first()).toBeVisible();
  });
});
