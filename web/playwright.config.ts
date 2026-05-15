import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const webRoot = __dirname;
const authStatePath = path.join(webRoot, 'tests', '.auth', 'user.json');
const configuredBaseUrl = process.env.PW_BASE_URL || '';
const isRemoteBaseUrl = Boolean(configuredBaseUrl) && !/localhost|127\.0\.0\.1/i.test(configuredBaseUrl);
const forcedColorScheme = process.env.PW_FORCE_COLOR_SCHEME;
const resolvedColorScheme = forcedColorScheme === 'light' || forcedColorScheme === 'dark'
  ? forcedColorScheme
  : undefined;
const apiTestPattern = /api-integration\.spec\.ts/;
const productionAuditTestPatterns = [
  /prod-smoke.*\.spec\.ts/,
  /landing-pages-(audit|cleanup)\.spec\.ts/,
];
const uiTestIgnore = process.env.PW_INCLUDE_PROD_AUDITS === 'true'
  ? apiTestPattern
  : [apiTestPattern, ...productionAuditTestPatterns];

export default defineConfig({
  testDir: path.join(webRoot, 'tests'),
  /* Run tests in files in parallel */
  fullyParallel: isRemoteBaseUrl ? false : true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : isRemoteBaseUrl ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : isRemoteBaseUrl ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html', { open: 'never' }]],
  /* Global timeout per test (30 s default) */
  timeout: 30_000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PW_BASE_URL || 'http://127.0.0.1:5174',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure */
    video: 'retain-on-failure',
    /* Navigation timeout */
    navigationTimeout: 15_000,
    /* Action timeout */
    actionTimeout: 10_000,
    ...(resolvedColorScheme ? { colorScheme: resolvedColorScheme } : {}),
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'api',
      testMatch: apiTestPattern,
    },
    // Setup project for auth
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: uiTestIgnore,
      use: { 
        ...devices['Desktop Chrome'],
        // Use prepared auth state.
        storageState: authStatePath,
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      testIgnore: uiTestIgnore,
      use: { 
        ...devices['Desktop Firefox'],
        storageState: authStatePath,
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      testIgnore: uiTestIgnore,
      use: { 
        ...devices['Desktop Safari'],
        storageState: authStatePath,
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      testIgnore: uiTestIgnore,
      use: { 
        ...devices['Pixel 5'],
        storageState: authStatePath,
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      testIgnore: uiTestIgnore,
      use: { 
        ...devices['iPhone 12'],
        storageState: authStatePath,
      },
      dependencies: ['setup'],
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.PW_USE_EXISTING_SERVER === 'true' || Boolean(process.env.PW_BASE_URL)
    ? undefined
    : {
        // Start both the API server and the web app (the repo root script runs both).
        command: 'npm run dev --prefix ..',
        cwd: webRoot,
        // Wait for the Vite proxy + backend to be ready, not just the web server.
        url: 'http://127.0.0.1:5174/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        env: {
          ...process.env,
          ALLOW_DEV_LOGIN: process.env.ALLOW_DEV_LOGIN || 'true',
          NODE_ENV: process.env.NODE_ENV || 'test',
          PORT: process.env.PORT || '3001',
        },
      },
});
