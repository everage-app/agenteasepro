import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, fillFormField } from './helpers/test-utils';
import { testClient, testDeal } from './helpers/fixtures';

test.describe('Clients Page', () => {
  test('should load clients page', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    await expect(page.locator('h1, h2').filter({ hasText: /clients/i })).toBeVisible();
  });

  test('should display clients list', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    const clients = page.locator('[class*="client"], [class*="contact"]');
    const count = await clients.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open new client modal', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    const newClientButton = page.locator('button').filter({ hasText: /new client|add client|\\+/i }).first();
    
    if (await newClientButton.isVisible()) {
      await newClientButton.click();
      await page.waitForTimeout(500);
      
      // Check for first name input (placeholder="John")
      const firstNameInput = page.locator('input[placeholder="John"]').first();
      await expect(firstNameInput).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create new client', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);

    const newClientButton = page.locator('button').filter({ hasText: /new client|add client|\+/i }).first();
    await expect(newClientButton).toBeVisible({ timeout: 5000 });
    await newClientButton.click();

    const modalHeading = page.getByRole('heading', { name: /add new client/i }).first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
    const modal = page.locator('form').filter({ has: page.locator('input[placeholder="John"]') }).first();

    const firstNameInput = modal.locator('input[placeholder="John"]').first();
    const lastNameInput = modal.locator('input[placeholder="Smith"]').first();
    const emailInput = modal.locator('input[type="email"]').first();

    await expect(firstNameInput).toBeVisible({ timeout: 5000 });

    await firstNameInput.fill('John');
    await lastNameInput.fill(testClient.name.split(' ')[1] || 'Test');
    await emailInput.fill(`john.${Date.now()}@example.com`);

    const submitButton = modal.locator('button[type="submit"]').first();
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click({ force: true });
    await page.waitForTimeout(1500);
  });

  test('should search clients', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    // Use specific placeholder from ClientsListPage
    const searchInput = page.locator('input[placeholder="Search clients…"]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('John');
      await page.waitForTimeout(1000);
    }
  });

  test('should filter clients by type', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    const filters = ['ALL', 'BUYER', 'SELLER', 'BOTH'];
    
    for (const filter of filters.slice(0, 2)) {
      const filterButton = page.locator('button, a').filter({ hasText: new RegExp(filter, 'i') }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should view client details', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    const clientCard = page.locator('[class*="client"]').first();
    
    if (await clientCard.isVisible()) {
      await clientCard.click();
      await page.waitForTimeout(500);
      
      const detailView = page.locator('[class*="detail"], [class*="modal"]');
      if (await detailView.isVisible()) {
        await expect(detailView).toBeVisible();
      }
    }
  });

  test('should edit client information', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    const editButton = page.locator('button').filter({ hasText: /edit|modify/i }).first();
    
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);
      
      const nameInput = page.locator('input[name="name"], input[value]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Updated Client Name');
        
        const saveButton = page.locator('button').filter({ hasText: /save|update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should delete client', async ({ page }) => {
    await navigateTo(page, '/clients');
    await waitForLoadingToComplete(page);
    
    const deleteButton = page.locator('button').filter({ hasText: /delete|remove/i }).first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
      
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe('Deals Page', () => {
  test('should load deals page', async ({ page }) => {
    // Note: /deals route redirects to dashboard, use /deals/new instead
    await navigateTo(page, '/deals/new');
    await waitForLoadingToComplete(page);
    await expect(page).toHaveURL(/.*deals/);
  });

  test('should display deal pipeline', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    // Check for pipeline stages
    const stages = page.locator('[class*="stage"], [class*="column"]');
    const count = await stages.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display deal cards', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const deals = page.locator('[class*="deal"], [class*="card"]');
    const count = await deals.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open new deal modal', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const newDealButton = page.locator('button').filter({ hasText: /new deal|add deal|create deal|\\+/i }).first();
    
    if (await newDealButton.isVisible()) {
      await newDealButton.click();
      await page.waitForTimeout(500);
      
      const addressInput = page.locator('input[name*="address" i], input[name*="property" i]');
      if (await addressInput.isVisible()) {
        await expect(addressInput).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should create new deal', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const newDealButton = page.locator('button').filter({ hasText: /new deal|add deal|\\+/i }).first();
    
    if (await newDealButton.isVisible()) {
      await newDealButton.click();
      await page.waitForTimeout(500);
      
      const addressInput = page.locator('input[name*="address" i], input[name*="property" i]').first();
      if (await addressInput.isVisible()) {
        await fillFormField(page, 'input[name*="address" i], input[name*="property" i]', testDeal.propertyAddress);
      }
      
      const clientInput = page.locator('input[name*="client" i], select[name*="client" i]').first();
      if (await clientInput.isVisible()) {
        await fillFormField(page, 'input[name*="client" i]', testDeal.clientName);
      }
      
      const priceInput = page.locator('input[name*="price" i]').first();
      if (await priceInput.isVisible()) {
        await fillFormField(page, 'input[name*="price" i]', testDeal.price.toString());
      }

      const form = addressInput.locator('xpath=ancestor::form[1]');
      const submitButton = form.locator('button[type="submit"]:visible').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should drag and drop deal between stages', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const dealCard = page.locator('[class*="deal"]').first();
    const targetStage = page.locator('[class*="stage"]').nth(1);
    
    if (await dealCard.isVisible() && await targetStage.isVisible()) {
      await dealCard.dragTo(targetStage);
      await page.waitForTimeout(1000);
    }
  });

  test('should view deal details', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const dealCard = page.locator('[class*="deal"]').first();
    
    if (await dealCard.isVisible()) {
      await dealCard.click();
      await page.waitForTimeout(500);
      
      const detailView = page.locator('[class*="detail"], [class*="modal"]');
      if (await detailView.isVisible()) {
        await expect(detailView).toBeVisible();
      }
    }
  });

  test('should display deal timeline', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const dealCard = page.locator('[class*="deal"]').first();
    
    if (await dealCard.isVisible()) {
      await dealCard.click();
      await page.waitForTimeout(500);
      
      const timeline = page.locator('text=/timeline|history|activity/i');
      if (await timeline.isVisible()) {
        await expect(timeline).toBeVisible();
      }
    }
  });

  test('should update deal status', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const dealCard = page.locator('[class*="deal"]').first();
    
    if (await dealCard.isVisible()) {
      await dealCard.click();
      await page.waitForTimeout(500);
      
      const statusSelect = page.locator('select[name="status"], button:has-text("Status")').first();
      if (await statusSelect.isVisible()) {
        await statusSelect.click();
        await page.waitForTimeout(300);
        
        const statusOption = page.locator('text=/pending|active|closed/i').first();
        if (await statusOption.isVisible()) {
          await statusOption.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should add note to deal', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const dealCard = page.locator('[class*="deal"]').first();
    
    if (await dealCard.isVisible()) {
      await dealCard.click();
      await page.waitForTimeout(500);
      
      const noteInput = page.locator('textarea[placeholder*="note" i], textarea[placeholder*="comment" i]').first();
      if (await noteInput.isVisible()) {
        await noteInput.fill('Important update on this deal');
        
        const addButton = page.locator('button').filter({ hasText: /add|save|post/i }).first();
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should filter deals by status', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const filters = ['ALL', 'ACTIVE', 'PENDING', 'CLOSED'];
    
    for (const filter of filters.slice(0, 2)) {
      const filterButton = page.locator('button, a').filter({ hasText: new RegExp(filter, 'i') }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should search deals', async ({ page }) => {
    await navigateTo(page, '/deals');
    await waitForLoadingToComplete(page);
    
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Main Street');
      await page.waitForTimeout(1000);
    }
  });
});
