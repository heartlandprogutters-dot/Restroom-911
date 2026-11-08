import { expect, test } from '@playwright/test';

test('production service worker controls the app and offline mode stays usable', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker?.getRegistration())?.active));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/);
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toContainText(/not a live update/i);
  await page.getByTestId('city-mayfield').click();
  await expect(page.getByTestId('results-best')).toContainText('Welcome Kiosk');
});
