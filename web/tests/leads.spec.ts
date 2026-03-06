import { test, expect, Page } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

async function ensureAtLeastOneLead(page: Page) {
  await navigateTo(page, '/leads');
  await waitForLoadingToComplete(page);

  const leadRows = page.locator('table tbody tr');
  if ((await leadRows.count()) > 0) return;

  await page.getByRole('button', { name: /^New Lead$/i }).click();
  await expect(page.getByRole('heading', { name: /Create Lead/i })).toBeVisible({ timeout: 5000 });

  const unique = Date.now();
  await page
    .locator('label:has-text("First name")')
    .locator('xpath=following-sibling::*[1]//input')
    .first()
    .fill('Playwright');
  await page
    .locator('label:has-text("Last name")')
    .locator('xpath=following-sibling::*[1]//input')
    .first()
    .fill('Lead');
  await page
    .locator('label:has-text("Email")')
    .locator('xpath=following-sibling::*[1]//input')
    .first()
    .fill(`playwright.lead.${unique}@example.com`);

  await page.getByRole('button', { name: /^Create Lead$/i }).click();

  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Leads Page', () => {
  test('row click opens the matching lead profile', async ({ page }) => {
    await ensureAtLeastOneLead(page);

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    const leadCell = firstRow.locator('td').first();
    const leadName = ((await leadCell.locator('div').first().textContent()) || '').trim();
    const leadEmail = ((await leadCell.locator('div').nth(1).textContent()) || '').trim();

    await firstRow.click();

    await expect(page).toHaveURL(/\/leads\/[a-z0-9-]+$/i, { timeout: 10000 });
    await expect(page.getByText(/Lead Profile/i).first()).toBeVisible({ timeout: 10000 });
    if (leadName) {
      await expect(page.getByRole('heading', { name: leadName, exact: true })).toBeVisible({ timeout: 10000 });
    }
    await expect(page.getByRole('heading', { name: /^New Task$/i })).toHaveCount(0);
  });
});
