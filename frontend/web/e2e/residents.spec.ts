import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('teresa.reyes');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
});

test('the Admin/Head adds a resident with a real date picker field', async ({ page }) => {
  await page.getByRole('link', { name: 'Residents' }).first().click();
  await page.getByRole('link', { name: 'Add resident' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('Benjamin Cruz');
  await page.getByRole('combobox', { name: 'Sex' }).click();
  await page.getByRole('option', { name: 'Male', exact: true }).click();
  await page.getByLabel(/^Birth date/).fill('1946-02-14');
  await page.getByRole('combobox', { name: 'Room' }).click();
  await page.getByRole('option', { name: 'Room 104 · West Wing' }).click();
  await page.getByRole('button', { name: 'Save resident' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Benjamin Cruz' })).toBeVisible();
  await expect(page).toHaveURL(/\/residents\/res-\d+$/);
});
