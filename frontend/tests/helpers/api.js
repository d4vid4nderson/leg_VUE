/**
 * API testing helpers
 */

/**
 * Wait for API call to complete
 * @param {import('@playwright/test').Page} page
 * @param {string} urlPattern - URL pattern to match (can be partial)
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
export async function waitForApiCall(page, urlPattern, timeout = 30000) {
  return await page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
}

/**
 * Mock an API endpoint
 * @param {import('@playwright/test').Page} page
 * @param {string} urlPattern
 * @param {object} responseData
 * @param {number} status
 */
export async function mockApiEndpoint(page, urlPattern, responseData, status = 200) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });
}

/**
 * Intercept and capture API requests
 * @param {import('@playwright/test').Page} page
 * @param {string} urlPattern
 * @returns {Promise<Array>} Array of captured requests
 */
export async function captureApiRequests(page, urlPattern) {
  const requests = [];

  await page.route(urlPattern, (route) => {
    requests.push({
      url: route.request().url(),
      method: route.request().method(),
      headers: route.request().headers(),
      postData: route.request().postData(),
    });
    route.continue();
  });

  return requests;
}

/**
 * Wait for analytics tracking call
 * @param {import('@playwright/test').Page} page
 * @param {string} eventType - 'track-page-view', 'track-login', 'track-event', etc.
 * @param {number} timeout
 */
export async function waitForAnalyticsEvent(page, eventType, timeout = 5000) {
  return await page.waitForResponse(
    (response) =>
      response.url().includes(`/api/analytics/${eventType}`) &&
      (response.status() === 200 || response.status() === 201),
    { timeout }
  );
}

/**
 * Get all network requests matching a pattern
 * @param {import('@playwright/test').Page} page
 * @param {string} urlPattern
 * @param {number} waitTime - Time to wait for requests in ms
 * @returns {Promise<Array>}
 */
export async function getNetworkRequests(page, urlPattern, waitTime = 2000) {
  const requests = [];

  const requestHandler = (request) => {
    if (request.url().includes(urlPattern)) {
      requests.push(request);
    }
  };

  page.on('request', requestHandler);

  await page.waitForTimeout(waitTime);

  page.off('request', requestHandler);

  return requests;
}

/**
 * Clear all API route mocks
 * @param {import('@playwright/test').Page} page
 */
export async function clearApiMocks(page) {
  await page.unrouteAll();
}
