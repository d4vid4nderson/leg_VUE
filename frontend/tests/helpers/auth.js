/**
 * Authentication helpers for Playwright tests
 */

/**
 * Login with demo credentials by setting auth state directly
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDemo(page) {
  // Set authentication data directly in localStorage before navigating
  await page.addInitScript(() => {
    const authToken = 'demo-test-token-' + Date.now();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const userData = {
      username: 'demo@legislationvue.com',
      name: 'Test User',
      email: 'demo@legislationvue.com',
      role: 'analyst',
      authMethod: 'demo',
      expires_at: expiresAt
    };

    // Set auth token and user data
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));

    // Create a user ID for analytics
    localStorage.setItem('userId', 'test-user-' + Date.now());
    localStorage.setItem('sessionId', 'test-session-' + Date.now());
  });

  // Navigate to homepage (will use the auth data we just set)
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('domcontentloaded');

  // Give the app time to process auth state
  await page.waitForTimeout(500);

  return true;
}

/**
 * Logout current user by clearing auth state
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Clear storage by navigating with a script that clears before the page loads
  await page.goto('/', {
    waitUntil: 'domcontentloaded'
  });

  // Clear storage immediately after navigation
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Wait a moment for the app to detect the cleared auth state
  await page.waitForTimeout(500);

  // Reload to trigger logout UI
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Wait for network to settle
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  // Give time for login modal to appear
  await page.waitForTimeout(1500);

  return true;
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isLoggedIn(page) {
  return await page.evaluate(() => {
    return !!localStorage.getItem('auth_token') || !!localStorage.getItem('user');
  });
}

/**
 * Get current user data from localStorage
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser(page) {
  return await page.evaluate(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });
}

/**
 * Setup authenticated state for tests
 * Useful for beforeEach hooks
 * @param {import('@playwright/test').Page} page
 */
export async function setupAuthenticatedUser(page) {
  await page.goto('/');

  // Check if already logged in
  if (await isLoggedIn(page)) {
    return true;
  }

  // Login if not authenticated
  return await loginAsDemo(page);
}
