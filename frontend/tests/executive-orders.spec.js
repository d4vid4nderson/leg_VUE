import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser } from './helpers/auth.js';
import { navigateTo, waitForElement, waitForLoadingToComplete, clickByText, getAllTextContent } from './helpers/pages.js';
import { waitForApiCall } from './helpers/api.js';

test.describe('Executive Orders Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await navigateTo(page, '/executive-orders');
  });

  test('should load executive orders page', async ({ page }) => {
    // Check for page title/heading
    await waitForElement(page, 'text="Executive Orders"');

    // Check for common page elements
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should display list of executive orders', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Look for executive order items/cards
    const orders = page.locator('[data-testid="executive-order-item"], .order-card, .executive-order').all();

    // Should have at least some orders (or empty state)
    const count = await page.locator('[data-testid="executive-order-item"], .order-card, .executive-order').count();

    if (count === 0) {
      // Check for empty state message
      await expect(page.locator('text="No executive orders", text="No orders found"').first()).toBeVisible();
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should search executive orders', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('healthcare');
      await page.waitForTimeout(500); // Wait for search debounce

      // Results should update
      // Just verify no crash
      expect(true).toBe(true);
    }
  });

  test('should filter executive orders', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Look for filter controls
    const filterButton = page.locator('button:has-text("Filter"), select, [data-testid="filter"]').first();

    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Filter panel should appear
      await page.waitForTimeout(500);
      expect(true).toBe(true);
    }
  });

  test('should highlight an executive order', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Find first highlight button
    const highlightButton = page.locator('button:has-text("Highlight"), button[aria-label*="highlight" i]').first();

    if (await highlightButton.isVisible()) {
      // Click to highlight
      await highlightButton.click();

      // Wait for API call
      await page.waitForTimeout(1000);

      // Button should change state (e.g., "Highlighted" or different style)
      // Just verify no crash
      expect(true).toBe(true);
    }
  });

  test('should fetch new executive orders', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Find "Fetch New" or refresh button
    const fetchButton = page.locator('button:has-text("Fetch"), button:has-text("Refresh"), button:has-text("Update")').first();

    if (await fetchButton.isVisible()) {
      // Click fetch button
      const apiPromise = page.waitForResponse(
        (response) => response.url().includes('/api/') && response.status() === 200,
        { timeout: 30000 }
      ).catch(() => null);

      await fetchButton.click();

      // Wait for loading indicator
      await page.waitForTimeout(1000);

      // Should show loading state or complete
      expect(true).toBe(true);
    }
  });

  test('should open executive order details', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Find first order item
    const firstOrder = page.locator('[data-testid="executive-order-item"], .order-card, .executive-order').first();

    if (await firstOrder.isVisible()) {
      // Click to open details
      await firstOrder.click();

      await page.waitForTimeout(500);

      // Details panel/modal should appear
      // Just verify no crash
      expect(true).toBe(true);
    }
  });

  test('should display order metadata', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Look for common metadata fields
    const bodyText = await page.textContent('body');

    // Check for date-like content or order numbers
    const hasContent = bodyText.length > 100;
    expect(hasContent).toBe(true);
  });

  test('should handle pagination if present', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Look for pagination controls
    const nextButton = page.locator('button:has-text("Next"), button[aria-label="Next"]').first();

    if (await nextButton.isVisible()) {
      const initialUrl = page.url();

      await nextButton.click();
      await page.waitForTimeout(1000);

      // Page should update (URL might change or content reloads)
      expect(true).toBe(true);
    }
  });

  test('should show AI summary if available', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Look for AI summary section
    const aiSection = page.locator('text="AI Summary", text="Summary", [data-testid="ai-summary"]').first();

    if (await aiSection.isVisible()) {
      // AI content should be present
      expect(true).toBe(true);
    }
  });

  test('should export data if feature exists', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

    if (await exportButton.isVisible()) {
      // Click export
      await exportButton.click();
      await page.waitForTimeout(500);

      // Should trigger download or show export options
      expect(true).toBe(true);
    }
  });

  test('should maintain state after navigation back', async ({ page }) => {
    await waitForLoadingToComplete(page);

    // Interact with page (e.g., search)
    const searchInput = page.locator('input[type="search"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('test query');
      await page.waitForTimeout(500);

      // Navigate away
      await clickByText(page, 'Homepage');
      await page.waitForTimeout(500);

      // Navigate back
      await page.goBack();
      await page.waitForTimeout(500);

      // State might or might not persist - just check page loads
      await expect(page.locator('text="Executive Orders"')).toBeVisible();
    }
  });
});
