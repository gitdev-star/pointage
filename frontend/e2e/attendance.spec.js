// @ts-check
const { test, expect } = require('@playwright/test');

const E2E_USERNAME = process.env.E2E_USERNAME || 'e2e_test_user';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'E2ePlaywright2026!';

async function login(page) {
  await page.goto('/');
  await page.fill('#username', E2E_USERNAME);
  await page.fill('#password', E2E_PASSWORD);
  await page.click('.submit-btn');
  await expect(page.locator('#username')).not.toBeVisible({ timeout: 10000 });
}

test.describe('Attendance page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('loads the attendance list without errors', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page.locator('h1')).toContainText('Liste des presences', { timeout: 10000 });
  });

  test('shows the advanced filters section', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page.locator('h2', { hasText: 'Filtres avancés' })).toBeVisible({ timeout: 10000 });
  });
});
