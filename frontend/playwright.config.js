import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PoliticalVue
 *
 * Run tests with:
 *   npm test                 - Run all tests headless
 *   npm run test:headed      - Run with browser visible
 *   npm run test:ui          - Run with UI mode
 *   npm run test:debug       - Run in debug mode
 */
export default defineConfig({
  testDir: './tests',

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Test file pattern
  testMatch: '**/*.spec.js',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Number of workers - use half of available CPUs on CI, all on local
  workers: process.env.CI ? 2 : undefined,

  // Reporter to use
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html'], ['list']],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests (optional)
  // Comment out webServer if you want to start the dev server manually
  webServer: process.env.SKIP_WEBSERVER ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // Always reuse existing server if available
    timeout: 120 * 1000,
    stdout: 'pipe', // Show server output for debugging
    stderr: 'pipe',
  },
});
