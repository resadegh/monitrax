/**
 * Programmatic login fixture for the UAT specs.
 *
 * `loginAs(key)` drives the real /signin form with a synthetic emulator user
 * (no secret, no human). Works with Firebase's IndexedDB-backed session
 * because the sign-in happens in the page's own Firebase SDK (emulator-
 * connected via NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST).
 *
 * On failure it prints the post-submit URL, page text, and any client console /
 * page errors to stdout (visible in the CI log) so a login that doesn't reach
 * /dashboard is diagnosable without the trace artifact.
 */
import { test as base, expect } from '@playwright/test';
import { E2E_USERS, type E2eUser } from './users';

type Fixtures = { loginAs: (key: E2eUser['key']) => Promise<void> };

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }, use) => {
    const clientErrors: string[] = [];
    page.on('pageerror', (e) => clientErrors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') clientErrors.push(`console.error: ${m.text()}`);
    });

    await use(async (key) => {
      const u = E2E_USERS[key];
      await page.goto('/signin');
      await page.locator('input[type="email"]').first().fill(u.email);
      await page.locator('input[type="password"]').first().fill(u.password);
      await page.getByRole('button', { name: /sign ?in|log ?in|continue/i }).first().click();
      try {
        await page.waitForURL('**/dashboard**', { timeout: 25_000 });
      } catch {
        const url = page.url();
        const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 1000);
        console.log(`\n[loginAs] DID NOT reach /dashboard — final url: ${url}`);
        console.log(`[loginAs] page text (first 1000 chars):\n${body}`);
        console.log(`[loginAs] client errors:\n${clientErrors.join('\n') || '(none)'}\n`);
        throw new Error(`loginAs(${key}) failed: landed on ${url}`);
      }
    });
  },
});

export { expect };
