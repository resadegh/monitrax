# Changelog — 2026-04-29

## Session: claude/sync-user-preferences-columns-2hNSa — fix UserPreference schema/prod drift

### Symptom

After PR #548 surfaced server `details` to the wizard footer, clicking
Launch dashboard showed:

> Couldn't finish setup. Failed to save onboarding data: Invalid
> `prisma.userPreference.upsert()` invocation: The column `taxYear`
> does not exist in the current database.

So the bug was identified within minutes of #548 merging — the client
banner did exactly what we needed.

### Root cause

Schema drift between `prisma/schema.prisma` and the production
database. Per CLAUDE.md §12.12 (R12 incident note), the prod DB was
originally created outside the Prisma migration workflow. The
`0_init` migration is a `SELECT 1;` no-op baseline, so any column
added to `model UserPreference` after the baseline never reached prod.

`taxYear` (added some time after baseline as `String?` on
`UserPreference`) is the first one to crash because `bulk-create`
writes it as part of the onboarding upsert. Other columns the
schema declares but prod might be missing would crash next — see
the migration body for the full set we sync defensively.

### Solution

New Prisma migration:
`prisma/migrations/20260429140700_sync_user_preferences_columns/migration.sql`

The migration uses `ADD COLUMN IF NOT EXISTS` for **every column the
current `UserPreference` schema declares**, so it is fully idempotent:

- On `monitrax-db-dev` (where the columns probably exist already
  from historical `prisma db push`), every statement is a no-op.
- On `monitrax-db-prod` (where most/all columns are missing), each
  statement adds the column with the same default the schema
  declares.

Every NOT NULL column has a sensible default (`false`, `'AUD'`,
`'AU'`, etc.) so existing rows are filled in without manual backfill.
Nullable columns (`tourSkippedAt`, `taxYear`, `onboardingDraft`)
add no constraint.

### CLAUDE.md compliance

- **§12.11 (Destructive write checklist):** NOT required. Every
  statement is `ADD COLUMN IF NOT EXISTS ... DEFAULT ...` or
  nullable. No `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`,
  no NOT NULL backfill. Existing rows are unaffected beyond
  taking the column default.
- **§12.12 (Schema change deploy protocol):** ✓
  - Schema-and-migration ship together in this PR.
  - Migration was *not* generated via `prisma migrate dev` because
    no dev DB connection is available in this session — it was
    written by hand to mirror the schema. The `IF NOT EXISTS`
    pattern makes hand-written safe: dev sees no-ops, prod sees
    the additions, no manual diffing required.
  - `prisma migrate deploy` runs in `vercel-build` (per
    `package.json`), so this migration applies automatically to
    `monitrax-db-dev` on the preview build and to
    `monitrax-db-prod` on the production deploy. Either failure
    aborts the deploy and the previous build keeps serving.
  - First migrate-deploy run on each DB will create
    `_prisma_migrations` (which doesn't exist yet per R12) and
    apply this folder. Subsequent runs no-op.

### Files Modified

- `prisma/migrations/20260429140700_sync_user_preferences_columns/migration.sql`
  — new migration. Adds 18 columns idempotently.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).

### Outstanding

- Other tables likely have the same drift (R12 covered the entire
  schema). When the *next* user-blocking column-missing error
  surfaces (now visible thanks to PR #548), we can extend this
  pattern to the affected table.
- Long-term: a one-shot full-sync migration would be cleaner than
  fixing tables piecemeal, but that requires a dev DB session to
  generate properly via `prisma migrate diff`. Tracked as a
  follow-up in the next maintenance window.

## Session: claude/balances-loan-detail-navigation-2hNSa — fix loan-detail 404 + balances partial-data rendering

### Symptom (user report)

User landed on `/dashboard/balances` after completing onboarding and
reported three issues:

1. Duplicate accounts in the Cash section (2× NAB Everyday $900,
   plus two Guildford Offset accounts with different balances).
2. Clicking any loan in the Debt section produced a 404 at
   `/dashboard/loans/<id>`.
3. The Cash and Debt sections "randomly" appeared together or
   one-at-a-time across page loads.

### Root cause

**Issue 2 (404 on loan detail).** `app/dashboard/balances/page.tsx`
links each loan row to `/dashboard/loans/${loan.id}`. The loans
folder structure was:
```
app/dashboard/loans/
  page.tsx              <- index (renders the detail dialog)
  [id]/
    strategy/
      page.tsx          <- AI strategy sub-route
```
i.e. `[id]/strategy` exists but `[id]/page.tsx` does not — so
Next.js 404'd at the deep-link URL even though the loan existed.
Activity page (`activity/page.tsx:429`) had the same broken link.

**Issue 3 (intermittent section visibility).** The balances page
used `Promise.all` with this pattern:

```ts
fetch('/api/accounts').then((r) => r.ok ? r.json() : { data: [] }),
fetch('/api/loans').then((r) => r.ok ? r.json() : { data: [] }),
```

- A 5xx on either endpoint silently fell back to `{ data: [] }`,
  which after the destructure became the empty array — making a
  transient API failure indistinguishable from "no data".
- Sections render conditionally on `array.length > 0`, so when one
  endpoint hiccupped its section just disappeared without any UX
  signal. That explains the "sometimes only Cash, sometimes only
  Debt" behaviour the user reported.
- A network-level rejection on either fetch would also crash
  `Promise.all` (no `.catch`) and leave the page in an
  inconsistent half-loaded state.

**Issue 1 (duplicate accounts).** Not a code bug — a data artifact
from the user's earlier failed Launch dashboard attempts (before
PR #549 fixed the schema drift). Although bulk-create wraps every
write in a Prisma `$transaction(...)`, several attempts were tried
across different fix iterations; some likely committed before the
transaction-time userPreference upsert errored, or the wizard data
carried duplicate account rows from re-clicking "Add another
account" between retries. The duplicates exist in the DB and need
manual deletion via the My Accounts UI. Long-term the right fix is
bulk-create idempotency keyed on a wizard-submission ID, tracked
as follow-up work.

### Solution

#### Issue 2 — `/dashboard/loans/[id]/page.tsx` redirect stub

Added a thin client-side redirect page at the missing route that
sends `/dashboard/loans/<id>` → `/dashboard/loans?focus=<id>`.

The loans index (`/dashboard/loans/page.tsx`) now reads the `focus`
query param after data loads, finds the matching loan, and
auto-opens the existing detail dialog. The param is then stripped
from the URL via `router.replace` so a refresh doesn't reopen the
dialog. A `useRef` guards against re-firing the effect when the
dialog itself triggers a state update.

This preserves deep-linkable URLs (the user can share
`/dashboard/loans/<id>` and it works) without duplicating the
loan-detail UI that already lives in the index dialog. A standalone
detail page is tracked as follow-up.

#### Issue 3 — `Promise.allSettled` + per-section error hints

Switched the balances page from `Promise.all` to `Promise.allSettled`
so one fetch's failure doesn't cascade into the others. Added two
new state slots (`accountsError`, `loansError`) populated when the
respective endpoint rejects. The Cash and Debt sections now render
whenever they have data **or** when their endpoint failed (so the
user never just "loses" the section). When an error is present the
section header shows an amber hint ("Couldn't load latest balances.
Showing cached data.") so the inconsistency is explicit instead of
silent.

A `cancelled` flag in the effect cleanup also guards against
setState after unmount (e.g. fast back-button) which previously
could surface as a stale-state warning in dev.

### Files Modified

- `app/dashboard/loans/[id]/page.tsx` — **new file**. Client-side
  redirect to `/dashboard/loans?focus=<id>`.
- `app/dashboard/loans/page.tsx` — read `?focus=<id>` query param
  on data load and auto-open the detail dialog. Strip the param
  from the URL afterward. `useRef` guard against re-fire.
- `app/dashboard/balances/page.tsx` — switch to
  `Promise.allSettled`, track per-endpoint error state, render
  error hints in section headers, render sections when their
  endpoint errored even if the cached array is empty.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).

### Destructive write checklist (CLAUDE.md §12.11)

No Prisma writes added or modified in this PR — pure UI / routing
changes. Checklist not required.

### Outstanding

- **Issue 1 (duplicate accounts):** user can delete the duplicates
  via the My Accounts UI. Long-term fix is bulk-create idempotency
  keyed on a wizard-submission ID — tracked separately.
- **Standalone loan detail page:** the redirect-and-dialog pattern
  is the minimum viable fix. A real `/dashboard/loans/[id]` page
  with the Overview / Linked / Insights / Actions tab structure
  required by CLAUDE.md §6.7 is follow-up work.
- **Other balances-page error UX:** Basiq connections fetch still
  swallows errors silently (intentional — it's secondary metadata).
  If the same intermittent rendering ever surfaces for connections
  we'll extend the `errorHint` pattern.
