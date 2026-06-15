import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Auth bootstrap for the UAT project.
 *
 * The codebase has NO test-auth bypass (login is GCP/Firebase only — see
 * lib/middleware.ts / lib/auth.ts), so we cannot script a username/password
 * login. CI must inject an already-authenticated Playwright storage state as
 * JSON in `E2E_STORAGE_STATE_JSON` (e.g. captured once against a dedicated
 * Firebase TEST project for a seeded `seed:lighthouse` user). When it is
 * absent, this writes an EMPTY state and the UAT specs skip themselves.
 */
const STATE_PATH = process.env.E2E_STORAGE_STATE ?? 'tests/e2e/.auth/state.json';

setup('prepare authenticated storage state', async () => {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const injected = process.env.E2E_STORAGE_STATE_JSON;
  if (injected) {
    fs.writeFileSync(STATE_PATH, injected);
    const parsed = JSON.parse(injected);
    expect(Array.isArray(parsed.cookies) || Array.isArray(parsed.origins)).toBeTruthy();
  } else {
    // Empty but valid storage state → specs detect "not authenticated" and skip.
    fs.writeFileSync(STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
  }
});
