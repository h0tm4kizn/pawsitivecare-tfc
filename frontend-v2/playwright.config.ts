import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './tests',
  outputDir: path.join(os.tmpdir(), 'pawsitivecare-playwright-results'),
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
