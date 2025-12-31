import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5176';

test.describe('Connect 4 Application', () => {

  test('Homepage loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/login/);

    // Login page should show sign-in options
    await expect(page.locator('text=Connect 4')).toBeVisible();
  });

  test('Login page displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Should have Google sign-in button
    const googleButton = page.locator('button:has-text("Google"), button:has-text("Sign in")');
    await expect(googleButton.first()).toBeVisible({ timeout: 10000 });

    // Should have guest/anonymous option
    const guestButton = page.locator('button:has-text("Guest"), button:has-text("Play as Guest"), button:has-text("Anonymous")');
    await expect(guestButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('Can sign in as guest and see homepage', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Click guest/anonymous button
    const guestButton = page.locator('button:has-text("Guest"), button:has-text("Play as Guest"), button:has-text("Anonymous")');
    await guestButton.first().click();

    // Wait for redirect to homepage
    await page.waitForURL('**/', { timeout: 15000 });

    // Homepage should show Play Now button or game options
    await expect(page.locator('text=Play Now, text=Play Online, button:has-text("Play")').first()).toBeVisible({ timeout: 10000 });
  });

  test('Play Now modal opens with game options', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Sign in as guest
    const guestButton = page.locator('button:has-text("Guest"), button:has-text("Play as Guest"), button:has-text("Anonymous")');
    await guestButton.first().click();
    await page.waitForURL('**/', { timeout: 15000 });

    // Click Play Now button
    const playButton = page.locator('button:has-text("Play Now"), button:has-text("Play")');
    await playButton.first().click();

    // Modal should appear with options
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    // Should have Play Online and Play with Friend options
    await expect(page.locator('text=Play Online, text=Online').first()).toBeVisible();
    await expect(page.locator('text=Play with Friend, text=Friend').first()).toBeVisible();
  });

  test('Can create a private game', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Sign in as guest
    const guestButton = page.locator('button:has-text("Guest"), button:has-text("Play as Guest"), button:has-text("Anonymous")');
    await guestButton.first().click();
    await page.waitForURL('**/', { timeout: 15000 });

    // Click Play Now
    const playButton = page.locator('button:has-text("Play Now"), button:has-text("Play")');
    await playButton.first().click();

    // Click Play with Friend
    const friendButton = page.locator('button:has-text("Play with Friend"), button:has-text("Friend"), text=Friend');
    await friendButton.first().click();

    // Click Create Game
    const createButton = page.locator('button:has-text("Create"), button:has-text("Create Game")');
    await createButton.first().click();

    // Should show game code or redirect to game page
    const gameCode = page.locator('[class*="code"], text=/[A-Z0-9]{6}/, input[readonly]');
    const gamePage = page.locator('[class*="board"], [class*="game"]');

    // Either we see a code or we're on the game page
    await expect(gameCode.first().or(gamePage.first())).toBeVisible({ timeout: 10000 });
  });

});
