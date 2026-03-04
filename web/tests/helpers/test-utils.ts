import { Page, expect } from '@playwright/test';

/**
 * Test utilities for common actions across tests
 */

/**
 * Wait for API request to complete
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  method: string = 'GET'
) {
  return await page.waitForResponse(
    (response) =>
      response.url().match(urlPattern) !== null &&
      response.request().method() === method,
    { timeout: 20000 }
  );
}

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000
) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Navigate to a specific page and wait for it to load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Some pages keep background requests open; DOM-ready state is sufficient for UI tests.
  }
}

/**
 * Fill form field and wait for debounce
 */
export async function fillFormField(
  page: Page,
  selector: string,
  value: string,
  waitMs: number = 300
) {
  await page.fill(selector, value);
  await page.waitForTimeout(waitMs);
}

/**
 * Click button and wait for action to complete
 */
export async function clickAndWait(
  page: Page,
  selector: string,
  waitForSelector?: string
) {
  await page.click(selector);
  if (waitForSelector) {
    await waitForElement(page, waitForSelector);
  } else {
    await page.waitForTimeout(500);
  }
}

/**
 * Check if element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for loading state to disappear
 */
export async function waitForLoadingToComplete(page: Page) {
  const indicators = ['text=Loading...', '.animate-spin'];
  for (const selector of indicators) {
    try {
      await page.waitForSelector(selector, { state: 'hidden', timeout: 3000 });
    } catch {
      // Indicator may be absent or persistent in non-critical regions.
    }
  }

  await page.waitForTimeout(250);

  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Ignore persistent network activity (analytics/streaming) once loading indicators are gone.
  }
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true });
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  responseData: any,
  status: number = 200
) {
  await page.route(urlPattern, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    })
  );
}

/**
 * Get text content from element
 */
export async function getTextContent(page: Page, selector: string): Promise<string> {
  const element = await page.locator(selector);
  return (await element.textContent()) || '';
}

/**
 * Check if API call was made
 */
export async function expectApiCall(
  page: Page,
  urlPattern: string | RegExp,
  method: string = 'GET'
) {
  let apiCalled = false;
  
  page.on('request', (request) => {
    if (request.url().match(urlPattern) && request.method() === method) {
      apiCalled = true;
    }
  });

  await page.waitForTimeout(1000);
  expect(apiCalled).toBeTruthy();
}
