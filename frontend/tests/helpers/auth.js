/**
 * Authentication helpers for Playwright tests
 */

/**
 * Login with demo credentials
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDemo(page) {
  // Navigate to homepage
  await page.goto('/');

  // Wait for login modal to appear
  await page.waitForSelector('[data-testid="login-modal"], text="Sign in"', { timeout: 5000 });

  // Click demo login if available, otherwise fill credentials
  const demoButton = page.locator('button:has-text("Demo Account")');
  if (await demoButton.isVisible()) {
    await demoButton.click();
  } else {
    // Fill in demo credentials
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button:has-text("Sign in"), button:has-text("Login")');
  }

  // Wait for login to complete (check for user profile or homepage content)
  await page.waitForSelector('[data-testid="user-menu"], .homepage-content, text="Executive Orders"', { timeout: 10000 });

  // Verify we're logged in
  const isLoggedIn = await page.evaluate(() => {
    return !!localStorage.getItem('auth_token') || !!localStorage.getItem('user');
  });

  if (!isLoggedIn) {
    throw new Error('Login failed - no auth token found');
  }

  return true;
}

/**
 * Logout current user
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Click user menu/profile
  const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Logout")').first();

  if (await userMenu.isVisible()) {
    await userMenu.click();

    // Click logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
  }

  // Clear storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Wait for login modal to appear again
  await page.waitForSelector('[data-testid="login-modal"], text="Sign in"', { timeout: 5000 });

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
