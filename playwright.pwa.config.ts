import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'pwa-offline.spec.ts',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:43130',
    viewport: { width: 393, height: 851 },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:43130',
    timeout: 120_000,
  },
});
