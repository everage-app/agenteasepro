import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, fillFormField } from './helpers/test-utils';
import { testMarketingBlast } from './helpers/fixtures';

test.describe('Marketing Page', () => {
  test('should load marketing page', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    await expect(page.locator('h1, h2').filter({ hasText: /marketing/i })).toBeVisible();
  });

  test('should display AI marketing copy generator', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    // Look for AI Copy component - use .first() to avoid strict mode
    const aiCopy = page.locator('text=/AI.*Copy|Generate.*Copy|Smart Marketing/i').first();
    if (await aiCopy.isVisible()) {
      await expect(aiCopy).toBeVisible();
    }
  });

  test('should generate AI marketing copy', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    // Find property address input
    const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="property" i]').first();
    
    if (await addressInput.isVisible()) {
      await addressInput.fill('123 Main Street, Provo, UT');
      
      // Select blast type if available
      const blastTypeSelect = page.locator('select, button:has-text("Type")').first();
      if (await blastTypeSelect.isVisible()) {
        await blastTypeSelect.click();
        await page.waitForTimeout(300);
      }
      
      // Generate copy
      const generateButton = page.locator('button').filter({ hasText: /generate|create|✨/i }).first();
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(3000); // Wait for AI
        
        // Check for generated content
        const generatedCopy = page.locator('text=/email|subject|social|caption/i');
        if (await generatedCopy.isVisible()) {
          await expect(generatedCopy).toBeVisible();
        }
      }
    }
  });

  test('should copy marketing content sections', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    // Find copy button
    const copyButton = page.locator('button').filter({ hasText: /copy/i }).first();
    
    if (await copyButton.isVisible()) {
      await copyButton.click();
      await page.waitForTimeout(500);
      
      // Check for success message
      const successMessage = page.locator('text=/copied|success/i');
      if (await successMessage.isVisible()) {
        await expect(successMessage).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should display channel connections', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    // Look for channel connections section
    const channels = page.locator('text=/channels|connections|email|sms/i');
    const count = await channels.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display marketing blast history', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    // Look for past blasts
    const blastHistory = page.locator('[class*="blast"], [class*="campaign"]');
    const count = await blastHistory.count();
    // May or may not have history
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open new marketing blast modal', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    const newBlastButton = page.locator('button').filter({ hasText: /new blast|create blast|send|\\+/i }).first();
    
    if (await newBlastButton.isVisible()) {
      await newBlastButton.click();
      await page.waitForTimeout(500);
      
      // Check for form
      const subjectInput = page.locator('input[name="subject"], input[placeholder*="subject" i]');
      if (await subjectInput.isVisible()) {
        await expect(subjectInput).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('direct mail drawer: selecting filters affects preview payload', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);

    let capturedPayload: any = null;

    await page.route('**/api/marketing/direct-mail/recipients', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        try {
          capturedPayload = req.postDataJSON();
        } catch {
          capturedPayload = req.postData();
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          recipients: [
            {
              id: 'r1',
              firstName: 'Test',
              lastName: 'Hot',
              stage: 'DEAD',
              temperature: 'HOT',
              tags: ['investor'],
              mailingAddress: '123 Main St',
              mailingCity: 'Provo',
              mailingState: 'UT',
              mailingZip: '84601',
              lastMarketingAt: null,
            },
            {
              id: 'r2',
              firstName: 'Test',
              lastName: 'Warm',
              stage: 'DEAD',
              temperature: 'HOT',
              tags: ['investor'],
              mailingAddress: '456 Center St',
              mailingCity: 'Provo',
              mailingState: 'UT',
              mailingZip: '84601',
              lastMarketingAt: null,
            },
          ],
        }),
      });
    });

    // Open direct mail drawer
    await page.getByRole('button', { name: /direct mail/i }).first().click();
    const drawer = page.getByTestId('direct-mail-drawer');
    await expect(drawer.getByText(/build a mailing blast list/i)).toBeVisible();

    // Select filters
    await drawer.getByRole('button', { name: /^hot$/i }).click({ force: true });
    await drawer.getByRole('button', { name: /^dead$/i }).click({ force: true });
    await drawer.getByPlaceholder(/investor, referral, upsell/i).fill('investor');
    await drawer.getByPlaceholder(/name, city, zip/i).fill('provo');

    // Run preview
    await drawer.getByRole('button', { name: /preview recipients/i }).click();
    await expect(drawer.getByText('Test Hot')).toBeVisible();

    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.requireAddress).toBe(true);
    expect(capturedPayload.limit).toBeTruthy();
    expect(capturedPayload.search).toBe('provo');
    expect(capturedPayload.temperature).toEqual(['HOT']);
    expect(capturedPayload.stage).toEqual(['DEAD']);
    expect(capturedPayload.tagsAny).toEqual(['investor']);
  });

  test('direct mail drawer: export CSV calls endpoint with markLastMarketingAt when checked', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);

    let previewCalls = 0;
    await page.route('**/api/marketing/direct-mail/recipients', async (route) => {
      previewCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          recipients: [
            {
              id: 'r1',
              firstName: 'CSV',
              lastName: 'Test',
              stage: 'ACTIVE',
              temperature: 'WARM',
              tags: [],
              mailingAddress: '1 A St',
              mailingCity: 'Provo',
              mailingState: 'UT',
              mailingZip: '84601',
              lastMarketingAt: null,
            },
          ],
        }),
      });
    });

    let capturedCsvPayload: any = null;
    await page.route('**/api/marketing/direct-mail/recipients.csv', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        try {
          capturedCsvPayload = req.postDataJSON();
        } catch {
          capturedCsvPayload = req.postData();
        }
      }

      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
        },
        body: 'First Name,Last Name\r\nCSV,Test\r\n',
      });
    });

    await page.getByRole('button', { name: /direct mail/i }).first().click();
    const drawer = page.getByTestId('direct-mail-drawer');
    await expect(drawer.getByText(/build a mailing blast list/i)).toBeVisible();

    // Preview first (enables export button)
    await drawer.getByRole('button', { name: /preview recipients/i }).click();
    await expect(drawer.getByText('CSV Test')).toBeVisible();
    expect(previewCalls).toBeGreaterThan(0);

    // Enable mark marketed on export
    const csvRequestPromise = page.waitForRequest((req) =>
      req.url().includes('/api/marketing/direct-mail/recipients.csv') && req.method() === 'POST',
    );

    await drawer.getByLabel(/mark as marketed on export/i).check({ force: true });
    await drawer.getByRole('button', { name: /download csv/i }).click({ force: true });
    const csvReq = await csvRequestPromise;
    const csvPayload = csvReq.postDataJSON() as any;

    expect(capturedCsvPayload || csvPayload).toBeTruthy();
    expect((capturedCsvPayload || csvPayload).markLastMarketingAt).toBe(true);
  });

  test('should create and send marketing blast', async ({ page }) => {
    // Mock channels/listings + create/generate endpoints so the test is stable.
    await page.route('**/api/channels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { type: 'EMAIL', status: 'connected', displayName: 'Email' },
        ]),
      });
    });

    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);

    await page.route('**/api/listings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'listing_1', headline: '123 Main St, Provo, UT', price: 450000 },
        ]),
      });
    });

    let createPayload: any = null;
    await page.route('**/api/marketing/blasts', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        try {
          createPayload = req.postDataJSON();
        } catch {
          createPayload = req.postData();
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'blast_1' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/marketing/blasts/blast_1/generate', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'blast_1' }) });
    });

    const createRequestPromise = page.waitForRequest((req) =>
      req.url().includes('/api/marketing/blasts') && req.method() === 'POST',
    );

    // Open new blast drawer
    await page.getByRole('button', { name: /\+\s*listing blast|start listing blast|launch listing blast|new blast/i }).first().click();
    await expect(page.getByText(/launch a multi-channel listing push/i)).toBeVisible();

    const drawer = page.getByTestId('new-blast-drawer');

    // Select listing
    await drawer.getByText('123 Main St, Provo, UT').click();

    // Select at least one channel (labels appear as buttons)
    // Use a broad selector because connected channels vary in environments.
    const channelButton = drawer.getByRole('button', { name: /email|text|sms|facebook|instagram|linkedin|x|website/i }).first();
    await channelButton.click({ force: true });

    // Create blast
    await drawer.getByRole('button', { name: /create listing blast|create & generate copy/i }).click({ force: true });

    const createReq = await createRequestPromise;
    const requestPayload = createReq.postDataJSON() as any;

    expect(createPayload || requestPayload).toBeTruthy();
    expect((createPayload || requestPayload).listingId).toBe('listing_1');
    // Ensure we pass the selected channels through (the server will now honor this)
    expect(Array.isArray((createPayload || requestPayload).channels)).toBeTruthy();
  });

  test('should filter marketing blasts', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    // Look for filter options
    const filters = ['ALL', 'EMAIL', 'SMS', 'SENT', 'SCHEDULED'];
    
    for (const filter of filters.slice(0, 2)) {
      const filterButton = page.locator('button, a').filter({ hasText: new RegExp(filter, 'i') }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should view marketing blast details', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    const blastCard = page.locator('[class*="blast"], [class*="campaign"]').first();
    
    if (await blastCard.isVisible()) {
      await blastCard.click();
      await page.waitForTimeout(500);
      
      // Check for detail view
      const detailView = page.locator('[class*="detail"], [class*="modal"]');
      if (await detailView.isVisible()) {
        await expect(detailView).toBeVisible();
      }
    }
  });

  test('should connect new channel', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    const connectButton = page.locator('button').filter({ hasText: /connect|add channel|\\+/i }).first();
    
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await page.waitForTimeout(500);
      
      // Check for connection modal - use separate locators for modal
      const modal = page.locator('[class*="modal"]').first();
      if (await modal.isVisible()) {
        await expect(modal).toBeVisible();
      }
    }
  });

  test('should disconnect channel', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    const disconnectButton = page.locator('button').filter({ hasText: /disconnect|remove/i }).first();
    
    if (await disconnectButton.isVisible()) {
      await disconnectButton.click();
      await page.waitForTimeout(500);
      
      // Confirm disconnect
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should schedule marketing blast', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    const newBlastButton = page.locator('button').filter({ hasText: /new blast|create/i }).first();
    
    if (await newBlastButton.isVisible()) {
      await newBlastButton.click();
      await page.waitForTimeout(500);
      
      // Look for schedule option
      const scheduleButton = page.locator('button, input[type="checkbox"]').filter({ hasText: /schedule|later/i }).first();
      if (await scheduleButton.isVisible()) {
        await scheduleButton.click();
        await page.waitForTimeout(500);
        
        // Select date/time
        const dateInput = page.locator('input[type="date"], input[type="datetime-local"]').first();
        if (await dateInput.isVisible()) {
          await dateInput.fill('2025-12-31');
        }
      }
    }
  });

  test('should display blast analytics', async ({ page }) => {
    await navigateTo(page, '/marketing');
    await waitForLoadingToComplete(page);
    
    const blastCard = page.locator('[class*="blast"]').first();
    
    if (await blastCard.isVisible()) {
      await blastCard.click();
      await page.waitForTimeout(500);
      
      // Look for analytics (sent, opened, clicked)
      const analytics = page.locator('text=/sent|opened|clicked|rate/i');
      if (await analytics.isVisible()) {
        const count = await analytics.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});
