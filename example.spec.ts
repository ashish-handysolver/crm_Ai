import { test, expect } from '@playwright/test';

test('homepage has expected title and root element', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Expect a title to contain "CRM". This is a placeholder, update it to your app's actual title.
    await expect(page).toHaveTitle(/CRM/i);

    // Expect the main root div to be present, which is common in React apps.
    await expect(page.locator('#root')).toBeVisible();
});