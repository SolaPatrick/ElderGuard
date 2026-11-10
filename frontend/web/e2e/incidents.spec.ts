import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('teresa.reyes');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
});

test('the incident history filters and exports what it shows', async ({ page }) => {
  await page.getByRole('link', { name: 'Incidents' }).first().click();
  await expect(page.getByText('Showing 1–8 of 8 incidents')).toBeVisible();
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'False alarm' }).click();
  await expect(page.getByText('Showing 1–2 of 2 incidents')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^incidents-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await file.createReadStream()).toArray();
  const lines = Buffer.concat(text).toString('utf8').trim().split('\r\n');
  expect(lines).toHaveLength(3);
  expect(lines[1]).toContain('"INC-2026-0139"');
});
