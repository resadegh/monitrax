/**
 * Programmatic login fixture for the UAT specs.
 *
 * `loginAs(key)` drives the real /signin form with a synthetic emulator user
 * (no secret, no human). Works with Firebase's IndexedDB-backed session
 * because the sign-in happens in the page's own Firebase SDK (emulator-
 * connected via NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST).
 */
import { test as base, expect } from '@playwright/test';
import { E2E_USERS, type E2eUser } from './users';

type Fixtures = { loginAs: (key: E2eUser['key']) => Promise<void> };

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }, use) => {
    await use(async (key) => {
      const u = E2E_USERS[key];
      await page.goto('/signin');
      await page.locator('input[type="email"]').first().fill(u.email);
      await page.locator('input[type="password"]').first().fill(u.password);
      await Promise.all([
        page.waitForURL('**/dashboard**', { timeout: 30_000 }),
        page.getByRole('button', { name: /sign ?in|log ?in|continue/i }).first().click(),
      ]);
    });
  },
});

export { expect };
