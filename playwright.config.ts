import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 4 · Layer 4 — Playwright UAT (Firebase Auth emulator mode).
 *
 * Auth is handled WITHOUT any real Firebase project, stored credential, or
 * manual login: CI runs the Firebase Auth emulator, seeds synthetic users
 * (tests/e2e/seed-emulator.ts), and each spec signs in through the real
 * /signin UI via the `loginAs` fixture (tests/e2e/auth.ts). No storage-state
 * secret is used — Firebase persists the session in IndexedDB, which a
 * programmatic per-context UI login populates reliably.
 *
 * The whole emulator wiring is gated behind FIREBASE_AUTH_EMULATOR_HOST /
 * NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST, which are set ONLY in the CI job —
 * never in prod/preview.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'uat', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
