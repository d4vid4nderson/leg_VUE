/**
 * Page interaction helpers
 */

/**
 * Navigate and wait for page to load
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 */
export async function navigateTo(page, path) {
  await page.goto(path);
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for element to be visible and stable
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {number} timeout
 */
export async function waitForElement(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
  // Wait for element to be stable (no animations)
  await page.locator(selector).first().waitFor({ state: 'visible' });
}

/**
 * Scroll element into view
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
export async function scrollIntoView(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
}

/**
 * Fill form field and wait for it to be updated
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {string} value
 */
export async function fillAndWait(page, selector, value) {
  await page.fill(selector, value);
  await page.waitForTimeout(100); // Small delay for UI updates
}

/**
 * Click and wait for navigation
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
export async function clickAndWaitForNavigation(page, selector) {
  await Promise.all([
    page.waitForNavigation(),
    page.click(selector),
  ]);
}

/**
 * Get text content of element
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<string>}
 */
export async function getTextContent(page, selector) {
  return await page.locator(selector).first().textContent();
}

/**
 * Check if element exists
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function elementExists(page, selector) {
  return (await page.locator(selector).count()) > 0;
}

/**
 * Wait for loading spinner to disappear
 * @param {import('@playwright/test').Page} page
 */
export async function waitForLoadingToComplete(page) {
  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '[data-testid="loading"]',
    '.loading',
    '.spinner',
    'text="Loading..."',
  ];

  for (const selector of loadingSelectors) {
    const loadingElement = page.locator(selector).first();
    if (await loadingElement.isVisible().catch(() => false)) {
      await loadingElement.waitFor({ state: 'hidden', timeout: 30000 });
    }
  }
}

/**
 * Take screenshot with a meaningful name
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function takeScreenshot(page, name) {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Wait for specific time (use sparingly)
 * @param {number} ms
 */
export async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get all text from elements matching selector
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<string[]>}
 */
export async function getAllTextContent(page, selector) {
  const elements = await page.locator(selector).all();
  return await Promise.all(elements.map(el => el.textContent()));
}

/**
 * Click element by text content
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
export async function clickByText(page, text) {
  await page.click(`text="${text}"`);
}

/**
 * Wait for URL to match pattern
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} urlPattern
 * @param {number} timeout
 */
export async function waitForUrl(page, urlPattern, timeout = 10000) {
  await page.waitForURL(urlPattern, { timeout });
}
