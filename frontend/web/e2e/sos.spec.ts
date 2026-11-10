import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('teresa.reyes');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
});

test('the Admin/Head cancels an SOS with a reason', async ({ page }) => {
  await page
    .getByRole('link', { name: /^Alerts/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'INC-2026-0141' }).click();
  await page.getByRole('button', { name: 'Cancel SOS' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel SOS?' });
  await dialog.getByRole('radio', { name: 'Situation handled' }).check();
  await dialog.getByRole('button', { name: 'Cancel SOS' }).click();
  await expect(page.getByText('SOS cancelled · Situation handled', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
});
