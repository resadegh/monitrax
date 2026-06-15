import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 4 · Layer 4 — Playwright UAT.
 *
 * Real-human flows over the seeded archetypes (`npm run seed:lighthouse`).
 * The app needs a live Next server + Postgres + AUTH. There is no test-auth
 * bypass in the codebase (login is GCP/Firebase only), so the UAT specs are
 * gated: they run only when an authenticated storage-state is provided via
 * `E2E_STORAGE_STATE` (a path) — produced by `auth.setup.ts` from an injected
 * session — otherwise they SKIP with a clear annotation (so the job is wired
 * and green, and becomes a true gate once Reza wires the E2E auth secret).
 * See tests/e2e/README.md.
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
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'uat',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // storageState is written by auth.setup.ts when auth is configured.
        storageState: process.env.E2E_STORAGE_STATE ?? 'tests/e2e/.auth/state.json',
      },
    },
  ],
  // Only boot a server when no external target is supplied. CI builds first
  // (`npm run build`) then this starts it; locally, `npm run dev` is reused.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
