# Playwright End-to-End Tests

This directory contains Playwright end-to-end tests for the PoliticalVue application.

## Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Install Playwright Browsers

```bash
npx playwright install
```

## Running Tests

### Run All Tests (Headless)
```bash
npm test
```

### Run Tests with Browser Visible
```bash
npm run test:headed
```

### Run Tests in UI Mode (Interactive)
```bash
npm run test:ui
```

### Run Tests in Debug Mode
```bash
npm run test:debug
```

### Run Specific Test File
```bash
npx playwright test auth.spec.js
```

### Run Tests in Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

```
tests/
├── helpers/           # Test utility functions
│   ├── auth.js       # Authentication helpers
│   ├── api.js        # API interaction helpers
│   └── pages.js      # Page interaction helpers
├── auth.spec.js      # Authentication tests
├── navigation.spec.js # Navigation and routing tests
├── analytics.spec.js  # Analytics tracking tests
├── executive-orders.spec.js # Executive Orders page tests
└── README.md         # This file
```

## Test Coverage

### Authentication (`auth.spec.js`)
- Login functionality
- Logout functionality
- Session persistence
- Auth token storage
- Analytics tracking on login

### Navigation (`navigation.spec.js`)
- Page navigation
- Browser back/forward
- Responsive menu
- Error-free page loads

### Analytics (`analytics.spec.js`)
- Page view tracking
- Page duration tracking
- Session ID creation
- User ID persistence
- Browser info collection

### Executive Orders (`executive-orders.spec.js`)
- Page load
- List display
- Search/filter functionality
- Highlighting items
- Fetching new orders
- Details view

## Writing New Tests

### Basic Test Structure

```javascript
import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser } from './helpers/auth.js';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('should do something', async ({ page }) => {
    // Your test code here
    await page.goto('/your-page');
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### Using Helpers

```javascript
import { loginAsDemo, logout } from './helpers/auth.js';
import { navigateTo, clickByText } from './helpers/pages.js';
import { waitForApiCall } from './helpers/api.js';

test('example with helpers', async ({ page }) => {
  await loginAsDemo(page);
  await navigateTo(page, '/page');
  await clickByText(page, 'Button Text');
  await waitForApiCall(page, '/api/endpoint');
});
```

## Configuration

Tests are configured in `playwright.config.js`:

- **Base URL**: `http://localhost:5173` (dev server)
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Pixel 5, iPhone 12
- **Timeout**: 30 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry

## CI/CD Integration

Tests can be run in CI/CD pipelines:

```yaml
# Example Azure Pipelines
- script: |
    cd frontend
    npm install
    npx playwright install --with-deps
    npm test
  displayName: 'Run E2E Tests'
```

## Debugging

### Debug Mode
```bash
npm run test:debug
```

This opens Playwright Inspector where you can:
- Step through tests
- Pause and inspect page
- See console logs
- View network requests

### Codegen (Generate Tests)
```bash
npm run test:codegen http://localhost:5173
```

This opens a browser and records your interactions as test code.

### View Test Report
```bash
npx playwright show-report
```

## Best Practices

1. **Use Data Attributes**: Add `data-testid` attributes to important elements
2. **Avoid Hard Waits**: Use `waitForSelector` instead of `waitForTimeout`
3. **Clean State**: Clear storage/cookies in `beforeEach`
4. **Descriptive Names**: Use clear test names that describe expected behavior
5. **Helpers**: Use helper functions for repeated actions
6. **Assertions**: Always include meaningful assertions
7. **Screenshots**: Taken automatically on failure
8. **Parallel**: Tests run in parallel by default

## Troubleshooting

### Tests Timing Out
- Increase timeout in `playwright.config.js`
- Check if dev server is running
- Verify API endpoints are accessible

### Flaky Tests
- Add explicit waits for dynamic content
- Use `waitForLoadState('networkidle')`
- Check for race conditions

### Element Not Found
- Use browser inspector to verify selector
- Wait for element to appear with `waitForSelector`
- Check if element is in iframe

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
