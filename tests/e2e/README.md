# Phase 4 · Layer 4 — Playwright UAT (Firebase Auth emulator)

End-to-end "real-human" flows over the seeded archetypes, exercising the full
stack (Next server + Postgres + the canonical engines behind the UI).

## How auth works now (emulator — supersedes the old storage-state approach)
There is **no real Firebase project, no stored credential, and no manual
login**. The CI job (`.github/workflows/tests.yml`):
1. Starts the **Firebase Auth emulator** (`firebase emulators:exec --only auth`,
   config in `firebase.json` → `127.0.0.1:9099`).
2. Seeds the Postgres archetypes (`seed:lighthouse`) into the job's
   `monitrax_e2e` DB.
3. Runs the emulator seed (`tests/e2e/seed-emulator.ts`): creates a synthetic
   Auth user per archetype email (`tests/e2e/users.ts`) in the emulator and
   links its UID to the seeded Postgres user via an `OAuthAccount` row — which
   is what `findOrSyncUser` (`lib/auth/context.ts`) resolves.
4. Runs Playwright; each spec signs in through the real `/signin` form via the
   `loginAs` fixture (`tests/e2e/auth.ts`). Firebase persists the session in
   IndexedDB, so a programmatic per-context UI login is used (Playwright
   `storageState` does not capture IndexedDB) — no secret required.

## Env gating (NEVER affects prod/preview)
Both the client emulator connect (`lib/firebase/config.ts`) and the server-side
decode-only verify path (`lib/auth/gcpTokenVerifier.ts`) are gated strictly on:
- `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` (client, inlined at build), and
- `FIREBASE_AUTH_EMULATOR_HOST` (server, read per request).

These are set **only** in the `playwright (UAT)` job. Prod and Vercel preview
never set them, so token verification there is byte-for-byte unchanged
(unit-tested in `tests/auth/gcpTokenVerifier.emulator.test.ts`).

## Flows (`uat.spec.ts`)
1. **Add property → dashboard net worth** reflects the new asset.
2. **Sell-property What-If** → per-entity CGT split — asserts `Estimated CGT (your share)` (D6).
3. **Entity-value widget** legal-title label (PR #1114 / L2-1 Option B).
4. **Delete a property** → its row + ownership rows are gone (L2-2).

The `family` archetype (David Mei) is used by default — couple + discretionary
trust + SMSF + company, so it exercises the multi-entity label and per-entity CGT.

## Run locally
```bash
export DATABASE_URL=postgresql://…           # local Postgres
export GCP_PROJECT_ID=monitrax-e2e
export NEXT_PUBLIC_GCP_PROJECT_ID=monitrax-e2e
export NEXT_PUBLIC_FIREBASE_API_KEY=fake-e2e-api-key
export NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
npx prisma migrate deploy && npm run seed:lighthouse && npm run build
npm i -D @playwright/test && npx playwright install chromium
firebase emulators:exec --project monitrax-e2e --only auth \
  "npx ts-node tests/e2e/seed-emulator.ts && npx playwright test"
```

## Status
NON-required until proven green in CI. Once green, add `playwright (UAT)` as a
required status check on the `main` ruleset (the exact check name).
