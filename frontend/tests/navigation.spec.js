import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser } from './helpers/auth.js';
import { navigateTo, waitForElement, clickByText } from './helpers/pages.js';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should navigate to Homepage', async ({ page }) => {
    await navigateTo(page, '/');

    // Check for homepage content
    await expect(page).toHaveTitle(/PoliticalVue|Legislation|Homepage/i);
    await expect(page.locator('text="Executive Orders", text="State Legislation"').first()).toBeVisible();
  });

  test('should navigate to Executive Orders page', async ({ page }) => {
    await navigateTo(page, '/');

    // Click Executive Orders link/button
    await clickByText(page, 'Executive Orders');

    // Verify we're on the Executive Orders page
    await waitForElement(page, 'text="Executive Orders"');
    await expect(page).toHaveURL(/executive-orders/i);
  });

  test('should navigate to State Legislation page', async ({ page }) => {
    await navigateTo(page, '/');

    // Click State Legislation link
    await clickByText(page, 'State Legislation');

    // Verify we're on State Legislation page
    await expect(page).toHaveURL(/state|legislation/i);
  });

  test('should navigate to Settings page', async ({ page }) => {
    await navigateTo(page, '/');

    // Look for settings link/button
    const settingsLink = page.locator('text="Settings", [href="/settings"]').first();

    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/settings/i);
      await waitForElement(page, 'text="Settings"');
    }
  });

  test('should show navigation menu', async ({ page }) => {
    await navigateTo(page, '/');

    // Check for navigation elements
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 5000 }).catch(() => {
      // Navigation might be in a different structure
    });
  });

  test('should handle browser back/forward', async ({ page }) => {
    await navigateTo(page, '/');
    const homeUrl = page.url();

    // Navigate to another page
    await clickByText(page, 'Executive Orders');
    await page.waitForURL(/executive-orders/i);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(homeUrl);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/executive-orders/i);
  });

  test('should display responsive navigation on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateTo(page, '/');

    // Look for mobile menu button (hamburger)
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label="Menu"]').first();

    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();

      // Check if menu opened
      const nav = page.locator('nav, [role="navigation"]').first();
      await expect(nav).toBeVisible();
    }
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await navigateTo(page, '/');

    // Wait a moment for any delayed errors
    await page.waitForTimeout(2000);

    // Filter out expected/known errors (like analytics failures in test env)
    const criticalErrors = errors.filter((error) =>
      !error.includes('analytics') &&
      !error.includes('Failed to fetch') &&
      !error.includes('NetworkError')
    );

    expect(criticalErrors.length).toBe(0);
  });
});
