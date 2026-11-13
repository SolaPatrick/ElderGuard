import { expect, test } from '@playwright/test';

test('after logging in, the alert setup plays a test alarm and starts monitoring', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username or email/i }).fill('joel.ramos');
  await page.getByRole('textbox', { name: 'Password' }).fill('elderguard123');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByRole('heading', { name: 'Before you start monitoring' })).toBeVisible();
  await page.getByRole('button', { name: 'Play test alarm' }).click();
  await expect(page.getByText(/Didn't hear it/)).toBeVisible();
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
  await expect(page).toHaveURL(/\/$/);

  // The volume set on Alert preferences is kept after a reload.
  await page.goto('/profile/alerts');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
  const slider = page.getByRole('slider', { name: 'Volume on this computer' });
  await expect(slider).toHaveValue('80');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('60%')).toBeVisible();
  await page.reload();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close alert popup' }).click();
  await expect(page.getByRole('slider', { name: 'Volume on this computer' })).toHaveValue('60');
});
