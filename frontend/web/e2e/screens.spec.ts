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

test('a resident profile opens from the residents list', async ({ page }) => {
  await page.getByRole('link', { name: 'Residents' }).first().click();
  await expect(page.getByText('8 residents in the facility')).toBeVisible();
  await page.getByRole('link', { name: 'Remedios Santos' }).click();
  await expect(page).toHaveURL(/\/residents\/res-remedios$/);
  await expect(page.getByText('84 · Female · Room 101 · East Wing')).toBeVisible();
});

test('the Admin/Head creates a staff account and gets its temporary password', async ({ page }) => {
  await page.getByRole('link', { name: 'Users & Access' }).click();
  await expect(page.getByText('5 accounts · 4 active')).toBeVisible();
  await page.getByRole('link', { name: 'Create user' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('Rosa Villanueva');
  await page.getByRole('textbox', { name: 'Username' }).fill('rosa.villanueva');
  await page.getByRole('checkbox', { name: 'Lobby' }).check();
  await page.getByRole('button', { name: 'Create user' }).last().click();

  const dialog = page.getByRole('dialog', { name: 'User created' });
  await expect(dialog.getByLabel('Temporary password', { exact: true })).toHaveText(/^[A-Za-z0-9]{12}$/);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rosa Villanueva' })).toBeVisible();
  await expect(page.getByLabel('Assigned rooms').getByText('Lobby')).toBeVisible();
});
