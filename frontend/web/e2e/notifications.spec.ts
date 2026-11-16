import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('teresa.reyes');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
});

test('notifications and help open from the user menu and the sidebar', async ({ page }) => {
  await page.getByRole('button', { name: /Ma\. Teresa Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'CAM-07 Hallway B is offline' })).toBeVisible();
  await page.getByRole('link', { name: /Help & About/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Help & About' })).toBeVisible();
});
