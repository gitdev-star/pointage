// @ts-check
const { test, expect } = require('@playwright/test');

const E2E_USERNAME = process.env.E2E_USERNAME || 'e2e_test_user';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'E2ePlaywright2026!';

test.describe('Login flow', () => {
  test('shows the login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('.submit-btn')).toBeVisible();
  });

  test('rejects invalid credentials with an error message', async ({ page }) => {
    await page.goto('/');
    await page.fill('#username', 'not_a_real_user');
    await page.fill('#password', 'wrong_password');
    await page.click('.submit-btn');

    await expect(page.locator('.error')).toBeVisible();
    // Still on the login page, not redirected
    await expect(page.locator('#username')).toBeVisible();
  });

  test('logs in successfully with valid credentials and redirects', async ({ page }) => {
    await page.goto('/');
    await page.fill('#username', E2E_USERNAME);
    await page.fill('#password', E2E_PASSWORD);
    await page.click('.submit-btn');

    // Successful login navigates to "/" - wait for the login form to disappear
    await expect(page.locator('#username')).not.toBeVisible({ timeout: 10000 });
  });
});
