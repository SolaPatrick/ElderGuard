import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('teresa.reyes');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
});

test('live monitoring opens a single camera from the sidebar', async ({ page }) => {
  await page
    .getByRole('link', { name: /Live Monitoring/i })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Live Monitoring' })).toBeVisible();
  await expect(page.getByText('11 cameras · 9 online')).toBeVisible();

  await page.getByRole('link', { name: 'CAM-01 · Room 101, live, alert active' }).click();
  await expect(page).toHaveURL(/\/monitoring\/CAM-01$/);
  await expect(page.getByRole('heading', { level: 1, name: 'CAM-01 · Room 101' })).toBeVisible();
  await expect(page.getByText('Live feed · CAM-01')).toBeVisible();
});
