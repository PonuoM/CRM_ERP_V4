import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // ทำให้เห็นหน้าต่าง Browser จริงเด้งขึ้นมา และหน่วงเวลาแต่ละ Action ให้มองทัน
    headless: true,
    launchOptions: {
      // slowMo: 1000,
    },
    // Inject the header so our PHP backend uses the test database
    extraHTTPHeaders: {
      'X-Test-Environment': 'true',
    },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // dependencies: ['setup'],
    },
  ],
  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
});
