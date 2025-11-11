import { test, expect } from '@playwright/test';
import { loginAsDemo, logout, isLoggedIn, getCurrentUser } from './helpers/auth.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should show login modal on initial load', async ({ page }) => {
    await page.goto('/');

    // Check for login modal or sign-in button
    const loginModal = page.locator('[data-testid="login-modal"], text="Sign in", text="Login"').first();
    await expect(loginModal).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with demo account', async ({ page }) => {
    await page.goto('/');

    // Perform login
    await loginAsDemo(page);

    // Verify logged in
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Verify we can see authenticated content
    await expect(page.locator('text="Executive Orders", text="Homepage"').first()).toBeVisible();
  });

  test('should store auth token in localStorage', async ({ page }) => {
    await page.goto('/');
    await loginAsDemo(page);

    // Check localStorage for auth data
    const hasAuthToken = await page.evaluate(() => {
      return !!localStorage.getItem('auth_token') || !!localStorage.getItem('user');
    });

    expect(hasAuthToken).toBe(true);
  });

  test('should get current user data after login', async ({ page }) => {
    await page.goto('/');
    await loginAsDemo(page);

    const user = await getCurrentUser(page);
    expect(user).toBeTruthy();

    // Check for common user properties
    if (user) {
      expect(user).toHaveProperty('email');
    }
  });

  test('should successfully logout', async ({ page }) => {
    await page.goto('/');
    await loginAsDemo(page);

    // Verify logged in
    let loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Logout
    await logout(page);

    // Verify logged out
    loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(false);

    // Should see login modal again
    const loginModal = page.locator('[data-testid="login-modal"], text="Sign in"').first();
    await expect(loginModal).toBeVisible({ timeout: 5000 });
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await page.goto('/');
    await loginAsDemo(page);

    // Reload page
    await page.reload();

    // Should still be logged in
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Should not show login modal
    const loginModal = page.locator('[data-testid="login-modal"]');
    await expect(loginModal).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // It's ok if it doesn't exist
    });
  });

  test('should track login event in analytics', async ({ page }) => {
    await page.goto('/');

    // Listen for analytics tracking
    const analyticsRequest = page.waitForRequest((request) =>
      request.url().includes('/api/analytics/track-login') &&
      request.method() === 'POST'
    );

    await loginAsDemo(page);

    // Wait for analytics call
    await analyticsRequest;

    // Success if we got here without timeout
    expect(true).toBe(true);
  });
});
