import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser } from './helpers/auth.js';
import { waitForAnalyticsEvent } from './helpers/api.js';
import { navigateTo, clickByText } from './helpers/pages.js';

test.describe('Analytics Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should track page view on navigation', async ({ page }) => {
    // Listen for page view tracking
    const trackingPromise = waitForAnalyticsEvent(page, 'track-page-view');

    await navigateTo(page, '/');

    // Wait for tracking call
    const response = await trackingPromise;
    expect(response.ok()).toBe(true);
  });

  test('should track page leave with duration', async ({ page }) => {
    await navigateTo(page, '/');

    // Wait a few seconds
    await page.waitForTimeout(3000);

    // Listen for page leave tracking
    const trackingPromise = waitForAnalyticsEvent(page, 'track-page-leave', 10000);

    // Navigate to different page (should trigger page leave)
    await clickByText(page, 'Executive Orders');

    // Wait for tracking call
    const response = await trackingPromise;
    expect(response.ok()).toBe(true);

    // Check request payload
    const requestData = await response.request().postDataJSON();
    expect(requestData).toHaveProperty('duration_seconds');
    expect(requestData.duration_seconds).toBeGreaterThan(0);
  });

  test('should create unique session ID', async ({ page }) => {
    await navigateTo(page, '/');

    const sessionId = await page.evaluate(() => {
      return sessionStorage.getItem('analyticsSessionId');
    });

    expect(sessionId).toBeTruthy();
    expect(sessionId).toMatch(/^session-/);
  });

  test('should track user ID', async ({ page }) => {
    await navigateTo(page, '/');

    const userId = await page.evaluate(() => {
      return localStorage.getItem('analyticsUserId');
    });

    expect(userId).toBeTruthy();
  });

  test('should send authorization header when authenticated', async ({ page }) => {
    await navigateTo(page, '/');

    // Capture next tracking request
    const requestPromise = page.waitForRequest((request) =>
      request.url().includes('/api/analytics/track-page-view') &&
      request.method() === 'POST'
    );

    // Navigate to trigger tracking
    await clickByText(page, 'Executive Orders');

    const request = await requestPromise;
    const headers = request.headers();

    // Should have Authorization header
    expect(headers).toHaveProperty('authorization');
  });

  test('should track multiple page views in one session', async ({ page }) => {
    const trackedPages = [];

    // Listen for all tracking requests
    page.on('request', (request) => {
      if (request.url().includes('/api/analytics/track-page-view')) {
        request.postDataJSON().then((data) => {
          trackedPages.push(data.page_name);
        }).catch(() => {});
      }
    });

    // Navigate to multiple pages
    await navigateTo(page, '/');
    await page.waitForTimeout(1000);

    await clickByText(page, 'Executive Orders');
    await page.waitForTimeout(1000);

    await clickByText(page, 'State Legislation');
    await page.waitForTimeout(1000);

    // Should have tracked at least 2 pages
    expect(trackedPages.length).toBeGreaterThanOrEqual(2);
  });

  test('should persist user ID across sessions', async ({ page }) => {
    await navigateTo(page, '/');

    const userId1 = await page.evaluate(() => {
      return localStorage.getItem('analyticsUserId');
    });

    // Reload page (new session)
    await page.reload();

    const userId2 = await page.evaluate(() => {
      return localStorage.getItem('analyticsUserId');
    });

    // User ID should persist
    expect(userId1).toBe(userId2);
  });

  test('should create new session ID after session storage clear', async ({ page }) => {
    await navigateTo(page, '/');

    const sessionId1 = await page.evaluate(() => {
      return sessionStorage.getItem('analyticsSessionId');
    });

    // Clear session storage
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    // Reload to create new session
    await page.reload();
    await page.waitForTimeout(1000);

    const sessionId2 = await page.evaluate(() => {
      return sessionStorage.getItem('analyticsSessionId');
    });

    // Should have new session ID
    expect(sessionId1).not.toBe(sessionId2);
    expect(sessionId2).toBeTruthy();
  });

  test('should include browser info in tracking data', async ({ page }) => {
    await navigateTo(page, '/');

    // Capture tracking request
    const requestPromise = page.waitForRequest((request) =>
      request.url().includes('/api/analytics/track-page-view') &&
      request.method() === 'POST'
    );

    await page.reload();

    const request = await requestPromise;
    const data = await request.postDataJSON();

    // Check for browser info
    expect(data).toHaveProperty('browser_info');
    expect(data.browser_info).toHaveProperty('browser');
    expect(data.browser_info).toHaveProperty('os');
    expect(data.browser_info).toHaveProperty('deviceType');
  });
});
