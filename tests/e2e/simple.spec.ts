import { test, expect } from '@playwright/test';

test('App loads and shows login page', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5176');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'test-results/login-page.png', fullPage: true });

  // Check for Connect 4 title
  const title = await page.title();
  expect(title).toContain('Connect');

  console.log('Page title:', title);
  console.log('URL:', page.url());
});

test('Can see guest login option', async ({ page }) => {
  await page.goto('http://localhost:5176/login');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: 'test-results/login-buttons.png', fullPage: true });

  // Get all button text
  const buttons = await page.locator('button').allTextContents();
  console.log('Available buttons:', buttons);

  // Should have at least one button
  expect(buttons.length).toBeGreaterThan(0);
});
