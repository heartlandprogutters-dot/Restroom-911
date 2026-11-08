import { expect, test, type Browser } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function openPage(browser: Browser, options?: { geolocation?: boolean; accuracy?: number; plan?: 'free' | 'paid-simulated' }) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    permissions: options?.geolocation ? ['geolocation'] : [],
    geolocation: options?.geolocation
      ? { latitude: 36.7417, longitude: -88.6367, accuracy: options.accuracy ?? 20 }
      : undefined,
  });
  const page = await context.newPage();
  await page.addInitScript((plan) => {
    if (plan) localStorage.setItem('rr911.plan', plan);
    if (plan === 'free') {
      let calls = 0;
      navigator.geolocation.getCurrentPosition = () => {
        calls += 1;
        (window as unknown as { __geoCalls: number }).__geoCalls = calls;
      };
    }
  }, options?.plan ?? 'paid-simulated');
  await page.goto('/');
  return { context, page };
}

test('urgent flow with location, details, and directions', async ({ browser }) => {
  await mkdir('docs/screenshots', { recursive: true });
  const { context, page } = await openPage(browser, { geolocation: true, accuracy: 20 });
  await expect(page.getByTestId('restroom-now')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/home.png', fullPage: true });
  const box = await page.getByTestId('restroom-now').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(280);
  expect(box?.height ?? 0).toBeGreaterThan(56);
  await expect(page.getByTestId('sponsor-demo')).toHaveCount(0);

  await page.getByTestId('restroom-now').click();
  await expect(page.getByTestId('results-best')).toContainText('Welcome Kiosk');
  await expect(page.getByText(/approximate distance/i).first()).toBeVisible();
  await expect(page.getByText(/travel time is not shown/i).first()).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/results.png', fullPage: true });

  await page.getByTestId('results-best').getByRole('link', { name: 'Details' }).click();
  await expect(page.getByRole('heading', { name: 'Mayfield Welcome Kiosk Restroom' })).toBeVisible();
  await expect(page.getByText('Unknown').first()).toBeVisible();
  await expect(page.getByText(/not a promise that the restroom is free/i)).toBeVisible();
  await expect(page.getByText(/Pending review. Not applied/i)).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/details.png', fullPage: true });

  await page.getByRole('link', { name: 'Directions' }).click();
  await expect(page.getByTestId('sponsor-demo')).toHaveCount(0);
  await expect(page.getByTestId('entrance-directions')).toContainText('information desk');
  await page.getByTestId('get-directions').click();
  await expect(page.getByTestId('maps-geo')).toHaveAttribute('href', /^geo:36\.742800,-88\.635800/);
  await expect(page.getByTestId('maps-google')).toHaveAttribute('href', /google\.com\/maps\/dir/);
  await expect(page.getByTestId('maps-apple')).toHaveAttribute('href', /maps\.apple\.com/);
  await page.getByTestId('finished-visit').click();
  await expect(page.getByTestId('sponsor-demo')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByTestId('sponsor-demo')).toHaveCount(0);
  await context.close();
});

test('denied location falls back to a pilot city', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await page.getByTestId('use-location').click();
  await expect(page.getByTestId('geo-error')).toContainText(/denied/i);
  await page.getByTestId('city-paducah').click();
  await expect(page.getByTestId('results-best')).toContainText('Transit Station');
  await context.close();
});

test('manual city text searches that pilot city', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await page.getByTestId('manual-query').fill('downtown Murray');
  await page.getByTestId('manual-search').click();
  await expect(page.getByTestId('results-best')).toContainText('Campus Commons');
  await expect(page.getByText(/Not your GPS/)).toBeVisible();
  await context.close();
});

test('low accuracy shows the reading and still allows a search', async ({ browser }) => {
  const { context, page } = await openPage(browser, { geolocation: true, accuracy: 1800 });
  await page.getByTestId('use-location').click();
  await expect(page.getByTestId('low-accuracy')).toContainText(/1,800 meters/);
  await page.getByTestId('search-anyway').click();
  await expect(page.getByTestId('results-best')).toBeVisible();
  await expect(page.getByText(/1,800 meters/)).toBeVisible();
  await context.close();
});

test('free plan does not request location until paid access is simulated', async ({ browser }) => {
  const { context, page } = await openPage(browser, { plan: 'free', geolocation: true });
  await page.getByTestId('use-location').click();
  await expect(page.getByTestId('plan-gate')).toContainText(/\$5/);
  const calls = await page.evaluate(() => (window as unknown as { __geoCalls?: number }).__geoCalls ?? 0);
  expect(calls).toBe(0);
  await page.goto('/q/mayfield-kiosk-main');
  await expect(page.getByTestId('entrance-directions')).toContainText('information desk');
  await expect(page.getByText(/not indoor GPS/i)).toBeVisible();
  await context.close();
});

test('required accessibility with no match is explained', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await page.getByTestId('pref-genderNeutral-required').click();
  await page.getByTestId('city-benton').click();
  await expect(page.getByTestId('results-empty')).toContainText(/gender-neutral/i);
  await expect(page.getByTestId('results-empty')).toContainText(/substituted/i);
  await context.close();
});

test('highest rated changes the Paducah pick', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await page.getByTestId('city-paducah').click();
  await expect(page.getByTestId('results-best')).toContainText('Transit Station');
  await page.getByTestId('mode-highest').click();
  await expect(page.getByTestId('results-best')).toContainText('Lakeside Gallery');
  await context.close();
});

test('a report stays pending until demo admin approves it', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await page.getByTestId('city-mayfield').click();
  await expect(page.getByTestId('results-best')).toContainText('Welcome Kiosk');
  await page.getByTestId('results-best').getByRole('link', { name: 'Details' }).click();
  await page.getByTestId('report-problem').click();
  await page.getByTestId('report-kind-locked-door').check();
  await page.getByTestId('report-note').fill('E2E locked door');
  await page.getByTestId('report-submit').click();
  await expect(page.getByTestId('report-status')).toContainText(/not sent to a server/i);
  await page.getByRole('link', { name: 'Back to details' }).click();
  await expect(page.getByText(/E2E locked door/)).toContainText(/Not applied to facts or ranking/);
  await page.goto('/results');
  await expect(page.getByTestId('results-best')).toContainText('Welcome Kiosk');

  await page.goto('/admin');
  await page.getByTestId('admin-toggle').click();
  const card = page.locator('article', { hasText: 'E2E locked door' });
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Verified fields were not overwritten/)).toBeVisible();
  await page.goto('/results');
  await expect(page.getByTestId('results-best')).not.toContainText('Welcome Kiosk');
  await expect(page.getByTestId('excluded-list')).toContainText(/Welcome Kiosk/);
  await expect(page.getByTestId('excluded-list')).toContainText(/approved report/i);
  await context.close();
});

test('offline banner appears without claiming a live update', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toContainText(/not a live update/i);
  await context.close();
});

test('unknown street address is not geocoded', async ({ browser }) => {
  const { context, page } = await openPage(browser);
  await page.getByTestId('manual-query').fill('123 Main Street');
  await page.getByTestId('manual-search').click();
  await expect(page.getByText(/does not look up street addresses/i)).toBeVisible();
  await context.close();
});
