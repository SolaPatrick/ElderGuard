import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('teresa.reyes');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();
});

test('a new fall alert can be acknowledged from the popup', async ({ page }) => {
  const popup = page.getByRole('alertdialog', { name: /possible fall detected/i });
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Acknowledge' }).click();

  await expect(page).toHaveURL(/\/alerts\/INC-2026-0142$/);
  await expect(page.getByRole('button', { name: 'Classify' })).toBeVisible();
  await expect(page.getByText(/2 active alerts · oldest unresolved/)).toBeVisible();
});

test('the dashboard shows the mockup numbers', async ({ page }) => {
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('9 / 11')).toBeVisible();
  await expect(page.getByText('CAM-07 Hallway B')).toBeVisible();
});

test('night mode can be switched on from the profile menu', async ({ page }) => {
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
  await page.getByRole('button', { name: /Ma\. Teresa Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Night mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-eg-mode', 'dark');
});

test('a simulated fall shows up as a new alert (demo tool)', async ({ page }) => {
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
  await page.getByRole('button', { name: /Ma\. Teresa Reyes/ }).click();
  await page.getByRole('menuitem', { name: 'Simulate a fall (demo)' }).click();
  await expect(page.getByRole('alertdialog', { name: /possible fall detected/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/3 active alerts · oldest unresolved/)).toBeVisible();
});
