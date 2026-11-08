import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testIgnore: 'pwa-offline.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:43123',
    viewport: { width: 393, height: 851 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:43123',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
