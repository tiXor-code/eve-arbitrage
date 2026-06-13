import { defineConfig } from '@playwright/test';

// E2E runs against a production build. The scan UI calls live Fuzzwork/ESI by
// default; tests pin a small fixed type subset or mock the API to stay fast.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
