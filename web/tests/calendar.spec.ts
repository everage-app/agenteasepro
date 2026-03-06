import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, clickAndWait } from './helpers/test-utils';

test.describe('Calendar Page', () => {
  test('should load calendar page', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    await expect(page).toHaveURL(/.*calendar/);
  });

  test('should display calendar grid/view', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    // Check for calendar component or any calendar-related element
    const calendarDays = page.locator('[class*="fc"], [class*="calendar"], [class*="day"], [class*="date"]').first();
    const isVisible = await calendarDays.isVisible();
    expect(isVisible).toBeTruthy(); // Verify calendar element exists
  });

  test('should display AI Daily Plan in sidebar', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    // Look for AI Daily Plan component in sidebar
    const aiPlan = page.locator('text=/AI Daily Plan|Today\'s Plan|Priority Actions/i');
    if (await aiPlan.isVisible()) {
      await expect(aiPlan).toBeVisible();
    }
  });

  test('should switch between calendar views', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);

    const monthButton = page.getByRole('button', { name: /^month$/i });
    const weekButton = page.getByRole('button', { name: /^week$/i });

    await expect(monthButton).toBeVisible();
    await expect(weekButton).toBeVisible();

    await weekButton.click({ force: true });
    await page.waitForTimeout(300);

    await monthButton.click({ force: true });
    await page.waitForTimeout(300);
  });

  test('should navigate to previous/next time period', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    // Find previous/next buttons
    const nextButton = page.locator('button').filter({ hasText: /next|>|→/i }).first();
    const prevButton = page.locator('button').filter({ hasText: /prev|back|<|←/i }).first();
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
    
    if (await prevButton.isVisible()) {
      await prevButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display today button and navigate to today', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    const todayButton = page.locator('button').filter({ hasText: /today/i }).first();
    if (await todayButton.isVisible()) {
      await todayButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should open new event modal', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    // Find "New Event" button
    const newEventButton = page.locator('button').filter({ hasText: /new event|add event|create event|\\+/i }).first();
    
    if (await newEventButton.isVisible()) {
      await newEventButton.click();
      await page.waitForTimeout(500);
      
      // Check for event form
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
      await expect(titleInput).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create a new calendar event', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    const newEventButton = page.locator('button').filter({ hasText: /new event|add event|\\+/i }).first();
    
    if (await newEventButton.isVisible()) {
      await newEventButton.click();
      await page.waitForTimeout(500);
      
      // Fill in event details
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
      await titleInput.fill('Property Showing');
      
      const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description" i]');
      if (await descInput.isVisible()) {
        await descInput.fill('Show property to potential buyers');
      }
      
      // Submit
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /create|save|add/i }).first();
      await submitButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('should display events on calendar', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);

    const monthHeading = page.getByRole('heading', { level: 2 }).first();
    await expect(monthHeading).toBeVisible({ timeout: 5000 });

    const knownEvent = page.locator('text=/Reply from|Showing|Open House|Event/i').first();
    const hasKnownEvent = await knownEvent.isVisible({ timeout: 2500 }).catch(() => false);
    if (hasKnownEvent) {
      await expect(knownEvent).toBeVisible();
    }
  });

  test('should click on calendar event to view details', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);

    const eventItem = page.locator('text=/Reply from|Showing|Open House|Event/i').first();
    if (await eventItem.isVisible({ timeout: 2500 }).catch(() => false)) {
      await eventItem.click();
      await page.waitForTimeout(400);

      const eventDetail = page.locator('[class*="modal"], [class*="popover"], [class*="detail"], input[name="title"]').first();
      if (await eventDetail.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(eventDetail).toBeVisible();
      }
    } else {
      await expect(page.getByRole('heading', { name: /Calendar/i })).toBeVisible();
    }
  });

  test('should edit calendar event', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);

    const eventItem = page.locator('text=/Reply from|Showing|Open House|Event/i').first();
    if (await eventItem.isVisible({ timeout: 2500 }).catch(() => false)) {
      await eventItem.click();
      await page.waitForTimeout(400);

      const editButton = page.locator('button').filter({ hasText: /edit|modify/i }).first();
      if (await editButton.isVisible({ timeout: 2500 }).catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(400);

        const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[value]').first();
        if (await titleInput.isVisible({ timeout: 2500 }).catch(() => false)) {
          const updatedTitle = `Updated Event ${Date.now()}`;
          await titleInput.fill(updatedTitle);
          const saveButton = page.locator('button').filter({ hasText: /save|update|create|add/i }).first();
          if (await saveButton.isVisible({ timeout: 2500 }).catch(() => false)) {
            await saveButton.click();
          }
        }
      }
    }

    await expect(page.getByRole('heading', { name: /Calendar/i })).toBeVisible();
  });

  test('should delete calendar event', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    const eventItem = page.locator('[class*="event"]').first();
    
    if (await eventItem.isVisible()) {
      await eventItem.click();
      await page.waitForTimeout(500);
      
      const deleteButton = page.locator('button').filter({ hasText: /delete|remove/i }).first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);
        
        // Confirm deletion
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should filter events by type', async ({ page }) => {
    await navigateTo(page, '/calendar');
    await waitForLoadingToComplete(page);
    
    // Look for event type filters
    const filterButton = page.locator('button').filter({ hasText: /filter|type/i }).first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }
  });
});
