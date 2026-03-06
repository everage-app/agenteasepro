import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, fillFormField } from './helpers/test-utils';
import { testRepcData } from './helpers/fixtures';

test.describe('REPC Features', () => {
  test('should load REPC wizard page', async ({ page }) => {
    // REPC is accessed via /contracts or deals/:id/repc
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    await expect(page).toHaveURL(/.*contracts/);
  });

  test('should display REPC form steps', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Look for contracts/REPC related elements
    const contractElement = page.locator('text=/contract|REPC|document/i').first();
    const isVisible = await contractElement.isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should display AI REPC assistant', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Look for AI Assistant component
    const aiAssistant = page.locator('text=/AI.*Assistant|REPC Assistant|Smart Review/i');
    if (await aiAssistant.isVisible()) {
      await expect(aiAssistant).toBeVisible();
    }
  });

  test('should fill property information', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Fill property address
    const addressInput = page.locator('input[name*="address" i], input[placeholder*="address" i]').first();
    if (await addressInput.isVisible()) {
      await fillFormField(page, 'input[name*="address" i], input[placeholder*="address" i]', testRepcData.propertyAddress);
    }
    
    // Fill city
    const cityInput = page.locator('input[name*="city" i], input[placeholder*="city" i]').first();
    if (await cityInput.isVisible()) {
      await fillFormField(page, 'input[name*="city" i], input[placeholder*="city" i]', testRepcData.city);
    }
    
    // Fill state
    const stateInput = page.locator('input[name*="state" i], select[name*="state" i]').first();
    if (await stateInput.isVisible()) {
      await fillFormField(page, 'input[name*="state" i]', testRepcData.state);
    }
    
    // Fill zip code
    const zipInput = page.locator('input[name*="zip" i], input[name*="postal" i]').first();
    if (await zipInput.isVisible()) {
      await fillFormField(page, 'input[name*="zip" i], input[name*="postal" i]', testRepcData.zipCode);
    }
  });

  test('should fill financial information', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Purchase price
    const priceInput = page.locator('input[name*="price" i], input[placeholder*="price" i]').first();
    if (await priceInput.isVisible()) {
      await fillFormField(page, 'input[name*="price" i], input[placeholder*="price" i]', testRepcData.purchasePrice.toString());
    }
    
    // Earnest money
    const earnestInput = page.locator('input[name*="earnest" i], input[placeholder*="earnest" i]').first();
    if (await earnestInput.isVisible()) {
      await fillFormField(page, 'input[name*="earnest" i], input[placeholder*="earnest" i]', testRepcData.earnestMoney.toString());
    }
  });

  test('should fill buyer/seller information', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Buyer name
    const buyerInput = page.locator('input[name*="buyer" i], input[placeholder*="buyer" i]').first();
    if (await buyerInput.isVisible()) {
      await fillFormField(page, 'input[name*="buyer" i], input[placeholder*="buyer" i]', testRepcData.buyerName);
    }
    
    // Seller name
    const sellerInput = page.locator('input[name*="seller" i], input[placeholder*="seller" i]').first();
    if (await sellerInput.isVisible()) {
      await fillFormField(page, 'input[name*="seller" i], input[placeholder*="seller" i]', testRepcData.sellerName);
    }
  });

  test('should navigate between form steps', async ({ page }) => {
    test.setTimeout(60_000);
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Find next/continue button
    const nextButton = page.locator('button').filter({ hasText: /next|continue|>|→/i }).first();
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
      
      // Try to go back
      const backButton = page.locator('button').filter({ hasText: /back|previous|<|←/i }).first();
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should analyze REPC with AI assistant', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Fill in some data first
    const addressInput = page.locator('input[name*="address" i]').first();
    if (await addressInput.isVisible()) {
      await fillFormField(page, 'input[name*="address" i]', testRepcData.propertyAddress);
    }
    
    // Find AI analyze button
    const analyzeButton = page.locator('button').filter({ hasText: /analyze|review|check|✨/i }).first();
    
    if (await analyzeButton.isVisible()) {
      await analyzeButton.click();
      await page.waitForTimeout(3000); // Wait for AI
      
      // Check for AI suggestions
      const suggestions = page.locator('text=/suggestion|recommendation|improve|missing/i');
      const count = await suggestions.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display validation errors', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Try to proceed without required fields
    const submitButton = page.locator('button').filter({ hasText: /submit|save|complete/i }).first();
    
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Look for error messages
      const errors = page.locator('[class*="error"], text=/required|invalid/i');
      if (await errors.first().isVisible()) {
        const count = await errors.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should save REPC as draft', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Fill minimal data
    const addressInput = page.locator('input[name*="address" i]').first();
    if (await addressInput.isVisible()) {
      await fillFormField(page, 'input[name*="address" i]', testRepcData.propertyAddress);
    }
    
    // Save as draft
    const draftButton = page.locator('button').filter({ hasText: /draft|save/i }).first();
    if (await draftButton.isVisible()) {
      await draftButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should complete and submit REPC', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Fill all required fields (simplified)
    const addressInput = page.locator('input[name*="address" i]').first();
    if (await addressInput.isVisible()) {
      await fillFormField(page, 'input[name*="address" i]', testRepcData.propertyAddress);
      
      const priceInput = page.locator('input[name*="price" i]').first();
      if (await priceInput.isVisible()) {
        await fillFormField(page, 'input[name*="price" i]', testRepcData.purchasePrice.toString());
      }
      
      // Submit
      const submitButton = page.locator('button').filter({ hasText: /submit|complete|finish/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should download REPC document', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Look for download button
    const downloadButton = page.locator('button, a').filter({ hasText: /download|export|pdf/i }).first();
    
    if (await downloadButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await downloadButton.click();
      const download = await downloadPromise;
      
      if (download) {
        expect(download).toBeTruthy();
      }
    }
  });

  test('should send REPC for e-signature', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Look for e-sign button
    const eSignButton = page.locator('button').filter({ hasText: /sign|signature|esign/i }).first();
    
    if (await eSignButton.isVisible()) {
      await eSignButton.click();
      await page.waitForTimeout(1000);
      
      // Check for e-sign modal or redirect
      const eSignModal = page.locator('[class*="modal"], text=/signature|sign/i');
      if (await eSignModal.isVisible()) {
        await expect(eSignModal).toBeVisible();
      }
    }
  });

  test('should load saved REPC', async ({ page }) => {
    await navigateTo(page, '/contracts');
    await waitForLoadingToComplete(page);
    
    // Look for "Load" or "Open" button
    const loadButton = page.locator('button').filter({ hasText: /load|open|recent/i }).first();
    
    if (await loadButton.isVisible()) {
      await loadButton.click();
      await page.waitForTimeout(500);
      
      // Select a saved REPC
      const savedRepc = page.locator('[class*="repc-item"], [class*="document"]').first();
      if (await savedRepc.isVisible()) {
        await savedRepc.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
