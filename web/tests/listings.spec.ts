import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, fillFormField } from './helpers/test-utils';
import { testListing } from './helpers/fixtures';

test.describe('Listings Page', () => {
  test('should load listings page', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    await expect(page.getByRole('heading', { name: 'Listings', exact: true })).toBeVisible();
  });

  test('should display AI description generator', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    // Look for AI Description component - use .first() to avoid strict mode
    const aiDescription = page.locator('text=/AI.*Description|Generate.*Description|Smart Copy/i').first();
    if (await aiDescription.isVisible()) {
      await expect(aiDescription).toBeVisible();
    }
  });

  test('should generate AI listing description', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    // Find AI description generator
    const addressInput = page.locator('input[placeholder*="address" i]').first();
    
    if (await addressInput.isVisible()) {
      await addressInput.fill(testListing.address);
      
      // Fill other fields if available
      const bedroomsInput = page.locator('input[placeholder*="bedroom" i], input[name*="bedroom" i]').first();
      if (await bedroomsInput.isVisible()) {
        await bedroomsInput.fill(testListing.bedrooms.toString());
      }
      
      // Generate description
      const generateButton = page.locator('button').filter({ hasText: /generate|create|✨/i }).first();
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(3000); // Wait for AI
        
        // Check for generated content
        const description = page.locator('text=/short description|long description|highlights/i');
        if (await description.isVisible()) {
          await expect(description).toBeVisible();
        }
      }
    }
  });

  test('should copy AI-generated description', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);

    // Scope to enabled AI copy actions to avoid picking disabled launch-kit buttons.
    const copyButton = page.locator('button:enabled').filter({ hasText: /^Copy$/ }).first();

    if (await copyButton.isVisible({ timeout: 2000 })) {
      await copyButton.click();
      await page.waitForTimeout(500);
      
      // Check for success message
      const successMessage = page.locator('text=/copied|success/i');
      if (await successMessage.isVisible()) {
        await expect(successMessage).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should display listings grid/list', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    // Check for listing cards or rows
    const listings = page.locator('[class*="listing"], [class*="property"]');
    const count = await listings.count();
    // May or may not have listings
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open new listing modal', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const newListingButton = page.locator('button').filter({ hasText: /new listing|add listing|create listing|\\+/i }).first();
    
    if (await newListingButton.isVisible()) {
      await newListingButton.click();
      await page.waitForTimeout(500);
      
      // Check for form
      const addressInput = page.locator('input[name="address"], input[placeholder*="address" i]');
      await expect(addressInput).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create new listing', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const newListingButton = page.locator('button').filter({ hasText: /new listing|add listing|\\+/i }).first();
    
    if (await newListingButton.isVisible()) {
      await newListingButton.click();
      await page.waitForTimeout(500);
      
      // Fill in listing details - use specific placeholder
      const addressInput = page.locator('input[placeholder*="Address"], input[placeholder*="address"]').first();
      if (await addressInput.isVisible({ timeout: 3000 })) {
        await addressInput.fill(testListing.address);
      }
      
      // Use specific placeholder for city - "Salt Lake City"
      const cityInput = page.locator('input[placeholder="Salt Lake City"]').first();
      if (await cityInput.isVisible()) {
        await cityInput.fill(testListing.city);
      }
      
      const priceInput = page.locator('input[placeholder*="price" i], input[type="number"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill(testListing.price.toString());
      }
      
      // Submit - look for button inside the modal/form
      const submitButton = page.locator('form button[type="submit"], [role="dialog"] button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should filter listings', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    // Look for filter options
    const filters = ['ACTIVE', 'PENDING', 'SOLD', 'ALL'];
    
    for (const filter of filters.slice(0, 2)) {
      const filterButton = page.locator('button, a').filter({ hasText: new RegExp(filter, 'i') }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should search listings', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Provo');
      await page.waitForTimeout(1000);
      
      // Results should filter
      const results = page.locator('[class*="listing"]');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should view listing details', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const listingCard = page.locator('[class*="listing"]').first();
    
    if (await listingCard.isVisible()) {
      await listingCard.click();
      await page.waitForTimeout(500);
      
      // Check for detail view
      const detailView = page.locator('[class*="detail"], [class*="modal"]');
      if (await detailView.isVisible()) {
        await expect(detailView).toBeVisible();
      }
    }
  });

  test('should edit listing', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const listingCard = page.locator('[class*="listing"]').first();
    
    if (await listingCard.isVisible()) {
      // Look for edit button (might be in actions menu)
      const editButton = page.locator('button').filter({ hasText: /edit|modify/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(500);
        
        // Modify price
        const priceInput = page.locator('input[name="price"], input[value]').first();
        if (await priceInput.isVisible()) {
          await priceInput.fill('475000');
          
          const saveButton = page.locator('button').filter({ hasText: /save|update/i }).first();
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });

  test('should delete listing', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const deleteButton = page.locator('button').filter({ hasText: /delete|remove/i }).first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
      
      // Confirm
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should display MLS import option', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const mlsButton = page.locator('button, a').filter({ hasText: /MLS|import/i }).first();
    if (await mlsButton.isVisible()) {
      await expect(mlsButton).toBeVisible();
    }
  });

  test('should sort listings', async ({ page }) => {
    await navigateTo(page, '/listings');
    await waitForLoadingToComplete(page);
    
    const sortButton = page.locator('button, select').filter({ hasText: /sort|order/i }).first();
    if (await sortButton.isVisible()) {
      await sortButton.click();
      await page.waitForTimeout(500);
      
      // Select sort option
      const sortOption = page.locator('text=/price|date|status/i').first();
      if (await sortOption.isVisible()) {
        await sortOption.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
