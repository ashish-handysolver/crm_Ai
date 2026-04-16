import { test, expect } from '@playwright/test';

test('homepage has expected title and root element', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/CRM/i);
  await expect(page.locator('#root')).toBeVisible();
});
