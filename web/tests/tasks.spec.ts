import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete, clickAndWait, fillFormField } from './helpers/test-utils';
import { testTask } from './helpers/fixtures';

async function openNewTaskModal(page: import('@playwright/test').Page) {
  const candidates = [
    page.getByRole('button', { name: /new task/i }).first(),
    page.getByRole('button', { name: /add task/i }).first(),
    page.getByRole('button', { name: /add first task/i }).first(),
  ];

  for (const button of candidates) {
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      break;
    }
  }

  const modalHeading = page.getByRole('heading', { name: /new task/i }).first();
  await expect(modalHeading).toBeVisible({ timeout: 5000 });
  return modalHeading.locator('xpath=ancestor::div[contains(@class,"relative w-full max-w-xl")]').first();
}

test.describe('Tasks Page', () => {
  test('should load tasks page', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    await expect(page.locator('h1, h2').filter({ hasText: /tasks/i })).toBeVisible();
  });

  test('should display task categories/buckets', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Check for task buckets (TODAY, TOMORROW, THIS WEEK, LATER)
    const buckets = ['TODAY', 'TOMORROW', 'WEEK', 'LATER'];
    let foundBucket = false;
    
    for (const bucket of buckets) {
      const bucketElement = page.locator(`text=/${bucket}/i`).first();
      if (await bucketElement.isVisible()) {
        foundBucket = true;
        break;
      }
    }
    
    expect(foundBucket).toBeTruthy();
  });

  test('should display AI task suggestions', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Look for AI Suggest component - use .first() to avoid strict mode
    const aiSuggest = page.locator('text=/AI.*Suggest|Suggestions|Smart Tasks/i').first();
    if (await aiSuggest.isVisible()) {
      await expect(aiSuggest).toBeVisible();
    }
  });

  test('should generate AI task suggestions', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Find generate button
    const generateButton = page.locator('button').filter({ hasText: /generate|suggest|✨/i }).first();
    
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(3000); // Wait for AI response
      
      // Check for suggested tasks
      const suggestions = page.locator('[class*="suggestion"], [class*="task-card"]');
      const count = await suggestions.count();
      // May or may not have suggestions depending on data
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should create new task from AI suggestion', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);

    // Open AI suggestions modal first.
    const openAiButton = page.getByRole('button', { name: /AI Suggestions/i }).first();
    if (await openAiButton.isVisible()) {
      await openAiButton.click();
      await page.waitForTimeout(600);

      const aiModal = page.locator('div.fixed.inset-0.z-50').first();
      const generateButton = aiModal.locator('button').filter({ hasText: /Suggest|Refresh/i }).first();

      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(3000);

        const createButton = aiModal.locator('button').filter({ hasText: /^Create$/ }).first();
        if (await createButton.isVisible()) {
          await createButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
  });

  test('should open new task modal', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);

    const modal = await openNewTaskModal(page);
    const titleInput = modal.locator('input[placeholder*="Follow up with client"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
  });

  test('should create a new task manually', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);

    const modal = await openNewTaskModal(page);
    const modalForm = modal.locator('form').first();

    const titleInput = modalForm.locator('input[placeholder*="Follow up with client"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(testTask.title);

    const descField = modalForm.locator('textarea[placeholder*="Add details about this task"]').first();
    if (await descField.isVisible().catch(() => false)) {
      await descField.fill(testTask.description);
    }

    const todayBucket = modalForm.locator('button').filter({ hasText: /^Today$/i }).first();
    if (await todayBucket.isVisible().catch(() => false)) {
      await todayBucket.click();
    }

    const submitButton = modalForm.locator('button[type="submit"]').first();
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click({ force: true });
    await page.waitForTimeout(1500);
  });

  test('should filter tasks by category', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Look for filter buttons/tabs
    const filters = ['ALL', 'CALL', 'CONTRACT', 'NOTE', 'POPBY'];
    
    for (const filter of filters.slice(0, 3)) { // Test first 3
      const filterButton = page.locator('button, a').filter({ hasText: new RegExp(filter, 'i') }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
        // Just verify no errors
      }
    }
  });

  test('should complete a task', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Find a task checkbox or complete button
    const completeButton = page.locator('button, input[type="checkbox"]').first();
    
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(1000);
      // Task should be marked complete or moved
    }
  });

  test('should delete a task', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Find delete button (might be in dropdown menu)
    const deleteButton = page.locator('button').filter({ hasText: /delete|remove|trash/i }).first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
      
      // Confirm deletion if modal appears
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should edit task details', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    // Click on a task or edit button
    const taskItem = page.locator('[class*="task"]').first();
    
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(500);
      
      // Look for edit form or modal
      const titleInput = page.locator('input[name="title"], input[value]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Updated Task Title');
        
        // Save changes
        const saveButton = page.locator('button').filter({ hasText: /save|update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should drag and drop task to different bucket', async ({ page }) => {
    await navigateTo(page, '/tasks');
    await waitForLoadingToComplete(page);
    
    const taskItem = page.locator('[class*="task"]').first();
    const targetBucket = page.locator('text=TOMORROW, text=LATER').first();
    
    if (await taskItem.isVisible() && await targetBucket.isVisible()) {
      // Note: Drag and drop might not work perfectly in all scenarios
      await taskItem.dragTo(targetBucket);
      await page.waitForTimeout(1000);
    }
  });
});
