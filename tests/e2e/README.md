# Phase 4 · Layer 4 — Playwright UAT

End-to-end "real-human" flows over the seeded archetypes, exercising the full
stack (Next server + Postgres + the canonical engines behind the UI).

## Flows (`uat.spec.ts`)
1. **Add property → dashboard net worth** reflects the new asset.
2. **Sell-property What-If** surfaces the per-entity CGT split — asserts the
   `Estimated CGT (your share)` label (D6, `lib/cfo/scenarios/sellProperty.ts`).
3. **Entity-value widget** carries the legal-title label (PR #1114 / L2-1
   Option B — `components/ownership/EntityBreakdownWidget.tsx`).
4. **Delete a property** → its row and its ownership rows are gone (L2-2,
   `assetOwnershipCleanup`).

## Prerequisite — AUTH (the one blocker)
Login is **GCP/Firebase only**; there is **no test-auth bypass** in the
codebase (`lib/middleware.ts`, `lib/auth.ts`), and `seed:lighthouse` users are
passwordless. So the specs **skip** unless an authenticated Playwright storage
state is provided:

- Capture a storage state once (against a dedicated Firebase **TEST** project,
  logged in as a seeded `seed:lighthouse` user — e.g. David Mei / Olivia Novak
  for the multi-entity flows), then expose it as the JSON string env/secret
  `E2E_STORAGE_STATE_JSON`.
- `auth.setup.ts` writes it to `tests/e2e/.auth/state.json`; the `uat` project
  loads it.

**Reza decision required:** either (a) provision the `E2E_STORAGE_STATE_JSON`
CI secret + a Firebase TEST project, or (b) approve a server-only test-auth
bypass (an app-surface security change — intentionally NOT made in this PR).
Until then the `playwright` CI job is **wired and green with the UAT specs
skipped** — it is not yet a real gate.

## Run locally
```bash
# 1. dev DB + migrate + seed
export DATABASE_URL=postgresql://…    # local Postgres
npx prisma migrate deploy && npm run seed:lighthouse
# 2. capture/inject auth
export E2E_STORAGE_STATE_JSON="$(cat my-authed-state.json)"
# 3. run (Playwright boots `npm run dev` via webServer)
npm i -D @playwright/test && npx playwright install chromium
npx playwright test
```
