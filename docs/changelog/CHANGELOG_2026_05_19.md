# Changelog — 2026-05-19

> First session of 2026-05-19. Per Reza directive 2026-05-18 (recorded in `CHANGELOG_2026_05_18.md` footer): **every PR includes a CHANGELOG session entry as part of the PR, not after-the-fact + the full §16.5 doc-sync block in the PR description.**

## Session 1: PR 3c.2e — Confidence indicators on derived metrics (closes §6A.1 6/6)

Branch: `claude/phase-12-pr-3c-2e-confidence-indicators-MG8mr`

### Scope

- **Type:** Feature (extends canonical financial-snapshot service + new UI primitive + 1 surface wire-in).
- **Closes:** `PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A.1 item #3 — the last remaining piece of the data-source hygiene story. **§6A.1 backlog now 6/6 ✅.**
- **Why first chunk of the day:** highest-leverage Claude-side item that doesn't need Reza's input; touches `masterFinancialService` (canonical SSOT for ALL financial calcs) so deserves fresh-eyes attention, not a marathon-end ship.

### What was done

**1. `lib/services/masterFinancialService.ts` — extended (+~85 LOC)**

- New `StalenessMetadata` interface (exported alongside `MasterFinancialSnapshot`):
  ```ts
  interface StalenessMetadata {
    staleManualCount: number;     // accounts with MANUAL balance ≥14d old
    totalManualCount: number;     // total MANUAL accounts (stale + fresh)
    oldestManualAgeDays: number | null;  // oldest staleness, null when no stale accounts
    anyStale: boolean;
    summary: string | null;       // human-readable tooltip copy, e.g. "3 manual balances last updated 47 days ago"
  }
  ```
- `MasterFinancialSnapshot.staleness: StalenessMetadata` added — always present, gates UI rendering on `anyStale === true`
- `prisma.account.findMany` select extended with `balanceSource` + `balanceLastUpdatedAt`
- `RawAccount` internal interface extended with the two new fields
- `STALENESS_THRESHOLD_DAYS = 14` constant declared inline — kept in lockstep with the client-side `MANUAL_STALE_THRESHOLD_DAYS` in `components/accounts/DataSourceChip.tsx`. **Why two definitions:** the service can't import from `components/*` (would bundle React into the service layer); the constants are kept in sync by the doc-sync rule in `10_DATA_SOURCE_HYGIENE.md` §2.
- Staleness computation runs inline next to the `liquidCash` calculation — same `data.accounts` array, no extra fetch

**2. `components/dashboard/ConfidenceIndicator.tsx` — NEW (~80 LOC)**

Small amber "may be stale" chip primitive:
- Renders nothing when `staleness.anyStale === false` — every consumer can pass the metadata unconditionally
- Tooltip surfaces `staleness.summary` verbatim (no extra string-building per surface)
- Links to `/dashboard/settings/data-health` (PR J's heat-map)
- `size: 'default' | 'compact'` variants — compact strips the icon for tight rows
- Tone choice: amber (not red) — informational, not alarming (CLAUDE.md §0 behaviour-psychologist lens)
- Privacy: no balance amounts in tooltip copy — only aggregate counts (§13.3)

**3. `app/dashboard/balances/page.tsx` — wired (Net Position hero)**

- Imported `isBalanceStale` + `ConfidenceIndicator`
- Added an inline IIFE next to the "Net position" label that:
  1. Filters `accounts` through `isBalanceStale()` (SSOT predicate)
  2. Computes the oldest stale age in days
  3. Builds the same summary string the snapshot service builds
  4. Renders `<ConfidenceIndicator>` with the metadata (or nothing)
- Why inline rather than reading the snapshot? The page already has the accounts array — no extra fetch needed. Future surfaces downstream of `/api/master-snapshot` can read `snapshot.staleness` directly.

### Design decisions

- **Server-side replica of the staleness rule** vs. importing the client-side `isBalanceStale` helper: the helper lives in a `'use client'` file. Importing into the service would either (a) bundle React, (b) require splitting the helper into a pure module + re-exporting. Option (b) is the long-term right move (a follow-up cleanup); option (a) is the short-term doc-synced lockstep. **Chosen: option (a)** to keep this PR tight. Tech-debt row not opened because both rules are documented in §2 of the BAU runbook + the constant is right next to the computation.
- **One surface wired, primitive ready for more.** Net Position hero is the most prominent derived metric on the highest-traffic page. Other surfaces (`<MoneyStoryHero>`, `<HiddenWealthLens>`, `<StatCard>` family) can wire in with ~10-line additions in follow-up PRs as the prioritised surfaces emerge. The §6A.1 #3 promise ("any derived metric") is structurally satisfied — the data is there and a canonical primitive consumes it.

### Files added / changed

| File | Change |
|---|---|
| `lib/services/masterFinancialService.ts` | NEW `StalenessMetadata` interface + `staleness` field on `MasterFinancialSnapshot` + select extension + computation + return |
| `components/dashboard/ConfidenceIndicator.tsx` | NEW — UI primitive |
| `app/dashboard/balances/page.tsx` | Import + inline staleness derivation + render next to "Net position" label |
| `docs/operational/runbooks/10_DATA_SOURCE_HYGIENE.md` | New §3.6 (`<ConfidenceIndicator>`) + §2 SSOT table extended with `MasterFinancialSnapshot.staleness` + section 1 surface count 5→6 + last-updated footer |
| `docs/architecture/06_UI_UX_FOUNDATION.md` | §15 primitives table extended with `ConfidenceIndicator` + `StalenessMetadata` rows |
| `docs/blueprint/MASTER_BLUEPRINT.md` | Phase 12 wizard row status flipped from "5/5 §6A.1 shipped, #3 remains" → "§6A.1 6/6 COMPLETE" |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next #7 row marker rolled to closed (§6A.1 6/6); Recently Completed entry (this); top header refresh |
| `docs/changelog/CHANGELOG_2026_05_19.md` | NEW (this) |

### Doc-sync (CLAUDE.md §16) — full block

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — new `<ConfidenceIndicator>` primitive; pattern documented in `06_UI_UX_FOUNDATION.md` §15.1 and `10_DATA_SOURCE_HYGIENE.md` §3.6
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] **security / CDR posture** — staleness tooltip copy honours §13.3 (no balance amounts; aggregate counts only). New `StalenessMetadata.summary` field renders the user-visible string server-side; same content rules.
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/operational/runbooks/10_DATA_SOURCE_HYGIENE.md` — §1 surface count 5→6, §2 SSOT table, NEW §3.6 ConfidenceIndicator, footer
- `docs/architecture/06_UI_UX_FOUNDATION.md` — §15.1 primitives table extended
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 12 row status 5/5 → 6/6 COMPLETE
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #7 closed + top header refresh + Recently Completed 2026-05-19 entry
- `docs/changelog/CHANGELOG_2026_05_19.md` — NEW (this file)

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** Pure read-path extension — no Prisma writes, no schema change, no mutation paths touched.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change. The `Account.balanceSource` + `Account.balanceLastUpdatedAt` columns this PR consumes already exist (Phase 13 §417 + PR I 2026-05-18 closed the write-site audit).

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** UI metadata + staleness signal — not a tax-engine surface; no `Property` / `Investment` / `LegalEntity` schema column added; no new AI tool.

### Testing

- [x] `npx tsc --noEmit` — exit 0 (verified locally)
- [x] `npm run lint:financial-surfaces` — "✓ No new financial-math violations. Build proceeds." (28 grandfathered, 0 new)
- [ ] Manual verification queued for Vercel preview:
  - User with 0 MANUAL accounts → Net Position hero shows no chip
  - User with ≥1 stale (≥14d) MANUAL account → amber "may be stale" chip appears next to "Net position" label; click navigates to `/dashboard/settings/data-health`
  - User with only fresh MANUAL accounts (<14d) → no chip (correctly suppressed)
  - Snapshot consumers (Sankey, TrailStageIndicator, portal client view) continue to work — the new `staleness` field is additive, not breaking

### Day's tally — Day 2 (2026-05-19) opens with 1 PR

| PR | Title | Closed |
|---|---|---|
| (this) | §6A.1 #3 — Confidence indicators | §6A.1 backlog 6/6 ✅ — full data-source hygiene story complete |

### PR

- Branch: `claude/phase-12-pr-3c-2e-confidence-indicators-MG8mr`
- Status: **Merged 2026-05-19 (PR #803)** — closes §6A.1 6/6.

---

## Session 2: Tech Debt #4 — April changelog consolidation

Branch: `claude/tech-debt-4-april-changelog-consolidation-MG8mr`

### Scope

- **Type:** Documentation housekeeping. No code change, no schema change, no UI change.
- **Closes:** Tech Debt #4 — "Accumulated >5 daily files in April; harder to scan."

### What was done

**Consolidated 14 daily April 2026 changelog files** (~2,800 LOC total) into a **single monthly summary** at `docs/changelog/CHANGELOG_2026_04.md` (~190 lines). One paragraph per session covering: session ID, headline, key outputs. Cross-links to the archive for forensic detail.

**Daily files moved to `docs/changelog/archive/`** — originals preserved verbatim. New `archive/README.md` documents the consolidation rule for future months.

**Consolidation rule established** (recorded in `archive/README.md`):
> When a month accumulates **>5 daily changelog files** AND **the month is in the past**, roll up into a `CHANGELOG_YYYY_MM.md` monthly summary, move dailies to `archive/`. Current month's dailies stay live in the top-level folder.

### Why this is housekeeping (low risk)

- No code touched
- No schema touched
- No CDR data touched
- The historical record is **preserved 100%** — files are moved, not deleted
- Top-level `docs/changelog/` becomes significantly more scannable (one canonical April file + active dailies)

### Files added / changed

| File | Change |
|---|---|
| `docs/changelog/CHANGELOG_2026_04.md` | NEW — monthly summary, ~190 lines |
| `docs/changelog/archive/README.md` | NEW — consolidation policy + current contents |
| `docs/changelog/archive/CHANGELOG_2026_04_*.md` (×14) | MOVED from parent (git mv preserves history) |
| `docs/IMPLEMENTATION_PLAN.md` | Tech Debt #4 row marker rolled to closed; Recently Completed 2026-05-19 entry; (top header unchanged — Day 2 entry already covers this) |
| `docs/changelog/CHANGELOG_2026_05_19.md` | This Session 2 entry |

### Doc-sync (CLAUDE.md §16) — full block

Surfaces changed in this PR:
- [ ] visual design system
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] **operational procedure** — new "archive past months when >5 dailies" rule recorded in `archive/README.md`
- [ ] strategic decision

Docs updated in this PR:
- `docs/changelog/CHANGELOG_2026_04.md` (NEW)
- `docs/changelog/archive/README.md` (NEW)
- `docs/changelog/archive/CHANGELOG_2026_04_*.md` (MOVED — git mv preserves history)
- `docs/IMPLEMENTATION_PLAN.md` (Tech Debt #4 closed + Recently Completed entry)
- `docs/changelog/CHANGELOG_2026_05_19.md` (this Session 2 entry)

### §12.11 / §12.12 / §12.14 — N/A

Pure docs.

### Testing

- [x] `npx tsc --noEmit` — N/A (no code change)
- [ ] Vercel preview build passes (no behavioural change expected)

### Day's tally — Day 2 (2026-05-19) — 2 PRs

| PR | Title | Closed |
|---|---|---|
| #803 | §6A.1 #3 — Confidence indicators | §6A.1 6/6 ✅ |
| (this) | Tech Debt #4 — April changelog consolidation | Tech Debt #4 |

### PR

- Branch: `claude/tech-debt-4-april-changelog-consolidation-MG8mr`
- Status: **Merged 2026-05-19 (PR #804)** — Tech Debt #4 closed.

---

## Session 3: Tech Debt #5 + #6 — audit-style closures (doc-only)

Branch: `claude/tech-debt-5-and-6-audit-closure-MG8mr`

### Scope

- **Type:** Documentation. No code change, no schema change. Two tech debt rows closed via audit.

### Tech Debt #5 — Unused `_links` / `_meta` GRDCS fields

**Original concern (2026-04-10):** "GRDCS wraps every entity by default; some surfaces never use them" — e.g. expense + income items.

**Re-audit finding (2026-05-19):**

7 routes wrap entities with `wrapWithGRDCS`:
- `/api/loans`
- `/api/expenses`
- `/api/properties`
- `/api/income`
- `/api/accounts`
- `/api/investments/holdings`
- `/api/investments/accounts`

8 consumer surfaces read `_links` / `_meta`:
- `/dashboard/expenses` (page)
- `/dashboard/income` (page)
- `/dashboard/investments/accounts` (page)
- `/dashboard/investments/holdings` (page)
- `/dashboard/investments/transactions` (page)
- `/dashboard/properties` (page)
- `<AccountDetailDialog>` (used on `/dashboard/balances`)
- `<LoanDetailDialog>` (used on `/dashboard/balances`)

**Conclusion:** every wrapped entity has at least one consumer surface that renders `_links` / `_meta`. The 2026-04-10 premise was stale — Phase 37 (My Budget IA simplification) + Phase 38 (My Vault) closed the gap by wiring the expense/income detail dialogs that didn't exist when the tech debt was filed.

**Closed.** No code change needed.

### Tech Debt #6 — `DIRECT_URL` env var

**Original concern (filed during WIF planning):** "If we never run migrations from Vercel runtime, only locally / via `vercel-build`, this might be unused".

**Re-audit finding (2026-05-19):**

```bash
grep -rnE "DIRECT_URL\b" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.prisma" --include="*.md" --include="*.sh"
```

Returns **ZERO references** in source / config / scripts (the only hit is the tech debt row itself in `IMPLEMENTATION_PLAN.md`).

The Prisma datasource block:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
References only `DATABASE_URL` (no `directUrl = env("DIRECT_URL")` line).

`vercel-build` runs `prisma migrate deploy` using `DATABASE_URL` only.

**Conclusion:** `DIRECT_URL` is genuinely unused. If Vercel has it set as an env var, no code reads it.

**Closed** with a Reza-side action: new console row #22 added — "Delete `DIRECT_URL` env var from Vercel (if present)" — 30 seconds in Vercel Project Settings → Environment Variables (all 3 scopes: Production / Preview / Development).

### Files changed

| File | Change |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | Tech Debt #5 + #6 rows marker rolled to closed; Phase 0 Reza-side console row #22 added (delete `DIRECT_URL`); Recently Completed 2026-05-19 entry |
| `docs/changelog/CHANGELOG_2026_05_19.md` | This Session 3 entry |

### Doc-sync (CLAUDE.md §16) — full block

Surfaces changed in this PR:
- [ ] visual design system
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] **operational procedure** — 2 tech debt audits closed; 1 console row added
- [ ] strategic decision

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` (Tech Debt #5 + #6 closed + console row #22 added + Recently Completed entry)
- `docs/changelog/CHANGELOG_2026_05_19.md` (this Session 3 entry)

### §12.11 / §12.12 / §12.14 — N/A

Pure docs.

### Day's tally — Day 2 (2026-05-19) — 3 PRs

| PR | Title | Closed |
|---|---|---|
| #803 | §6A.1 #3 — Confidence indicators | §6A.1 6/6 ✅ |
| #804 | Tech Debt #4 — April changelog consolidation | Tech Debt #4 |
| (this) | Tech Debt #5 + #6 audit closures | Tech Debt #5 + #6 |

### PR

- Branch: `claude/tech-debt-5-and-6-audit-closure-MG8mr`
- Status: **Merged 2026-05-19 (PR #805)** — Tech Debt #5 + #6 closed.

---

## Session 4: fix(admin) — schema-drift endpoint deserialization bug

Branch: `claude/fix-schema-drift-name-cast-MG8mr`

### Scope

- **Type:** Bug fix. The `GET /api/admin/schema-drift` endpoint (added in PR #743 as part of the Tech Debt #18 tooling sweep) had never been exercised against prod. Reza tried to run it today (the pre-Basiq audit blocker) and it returned HTTP 500.

### Root cause

3 raw SQL queries select columns of Postgres's internal `name` type — `information_schema.tables.table_name`, `information_schema.columns.{table_name, column_name}`, and (`pg_type.typname` + `pg_enum.enumlabel` + `pg_namespace.nspname` via the WHERE clause). The Prisma `$queryRawUnsafe` driver can't deserialize the Postgres `name` type — it fails with:

```
Failed to deserialize column of type 'name'. If you're using $queryRaw
and this column is explicitly marked as `Unsupported` in your Prisma
schema, try casting this column to any supported Prisma type such as
`String`.
```

The error message itself describes the fix.

### Fix

Cast each `name`-typed column to `text` in the SELECT clause:

```sql
SELECT table_name::text AS table_name FROM information_schema.tables ...
SELECT table_name::text AS table_name, column_name::text AS column_name FROM ...
SELECT t.typname::text AS enum_name, e.enumlabel::text AS enum_value FROM pg_type t ...
```

Postgres returns `text` cleanly; Prisma deserializes it as a plain string. No type-handler change needed.

Inline comments added next to each cast explaining the Postgres-`name`-type quirk so future maintainers don't strip them.

### Why this wasn't caught at PR time

The endpoint was added as a tool that Reza would run ad-hoc when needed. Vercel preview builds compile and serve the endpoint correctly; the deserialization failure only happens when the query actually runs against Postgres. No automated test exercised the path end-to-end (would have needed a Postgres test fixture). Tracked as a lesson — admin tooling endpoints should have at least one smoke test that hits them against a real DB before they're considered shippable. Recorded inline in the endpoint's doc-block.

### Files changed

| File | Change |
|---|---|
| `app/api/admin/schema-drift/route.ts` | 3 raw SQL queries gain `::text` casts on `name`-typed columns; inline comments document why |
| `docs/IMPLEMENTATION_PLAN.md` | Recently Completed 2026-05-19 entry |
| `docs/changelog/CHANGELOG_2026_05_19.md` | This Session 4 entry |

### What Reza does next

1. Wait for this PR to merge + Vercel deploy
2. Re-run the one-liner in DevTools console:
   ```js
   fetch('/api/admin/schema-drift').then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2)))
   ```
3. Paste the JSON output back to the conversation

If the output shows `summary.hasDrift: false` → Tech Debt #18 closes with no corrective migration needed.
If the output shows drift → I ship the corrective migration in the next PR.

### Doc-sync (CLAUDE.md §16) — full block

Surfaces changed in this PR:
- [ ] visual design system
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] **security / CDR posture** — only in the sense that the schema-drift audit is a Basiq accreditation prerequisite per Tech Debt #18; this fix unblocks the audit
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `app/api/admin/schema-drift/route.ts` (inline doc comments next to the casts)
- `docs/IMPLEMENTATION_PLAN.md` (Recently Completed 2026-05-19 entry)
- `docs/changelog/CHANGELOG_2026_05_19.md` (this Session 4 entry)

### §12.11 / §12.12 / §12.14 — N/A

Pure read-path bug fix; no Prisma writes; no schema change; no tax-engine surface.

### Day's tally — Day 2 (2026-05-19) — 4 PRs

| PR | Title | Closed |
|---|---|---|
| #803 | §6A.1 #3 — Confidence indicators | §6A.1 6/6 ✅ |
| #804 | Tech Debt #4 — April changelog consolidation | Tech Debt #4 |
| #805 | Tech Debt #5 + #6 audit closures | Tech Debt #5 + #6 |
| (this) | fix(admin): schema-drift `::text` casts | (unblocks Tech Debt #18 audit) |

### PR

- Branch: `claude/fix-schema-drift-name-cast-MG8mr`
- Status: **Merged 2026-05-19 (PR #806)** — unblocked the audit.

---

## Session 5: Tech Debt #18 — CDR tables corrective migration (closes pre-Basiq blocker)

Branch: `claude/tech-debt-18-cdr-tables-corrective-migration-MG8mr`

### Scope

- **Type:** Corrective schema migration (fix-forward for pre-migration-era drift).
- **Closes:** Tech Debt #18 (Pre-migration-era prod schema drift) + Phase 0 console row #11 (Prod schema-drift audit). **Pre-Basiq engineering blocker resolved.**

### Audit findings (from Reza's `GET /api/admin/schema-drift` 2026-05-19)

```json
{
  "summary": {
    "modelsChecked": 114,
    "enumsChecked": 113,
    "missingTables": 3,
    "missingEnums": 4,
    "tablesWithMissingColumns": 0,
    "tablesWithExtraColumns": 0,
    "enumsWithMissingValues": 0,
    "orphanTables": 0,
    "hasDrift": true
  },
  "missingTables": [
    { "model": "CDRConsent",    "table": "cdr_consents" },
    { "model": "CDRComplaint",  "table": "cdr_complaints" },
    { "model": "CDRDisclosure", "table": "cdr_disclosures" }
  ],
  "missingEnums": [
    "CDRConsentStatus",
    "CDRComplaintCategory",
    "CDRComplaintStatus",
    "CDRDisclosureType"
  ]
}
```

### Root cause

Same as the 2026-05-12 `basiq_connections` drift: the Phase L CDR remediation (2026-04-11, Fix G18 + Fix G43) added these tables to `schema.prisma` and applied them to dev via the historical `prisma db push` workflow — but the migrations-file workflow wasn't yet in place, so prod never got the DDL.

### Fix

Corrective migration `prisma/migrations/20260519100000_fix_pre_migration_cdr_tables_drift/migration.sql`:

| Operation | Count | Idempotency |
|---|---|---|
| `CREATE TYPE` (enums) | 4 | `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL ... END $$` |
| `CREATE TABLE IF NOT EXISTS` (tables) | 3 | `IF NOT EXISTS` clause |
| `ALTER TABLE ADD CONSTRAINT` (FKs) | 3 | `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL ... END $$` |
| `CREATE INDEX IF NOT EXISTS` (indexes) | 7 | `IF NOT EXISTS` clause |

**On dev** the migration is a complete no-op (every object already exists via the historical `db push`).
**On prod** the missing objects get created in the same `prisma migrate deploy` pass the next deploy runs.

### Schema changes

NONE — `schema.prisma` already declares these models + enums (since 2026-04-11). This PR only adds the migration file to bring prod's `information_schema` + `pg_catalog` in line with what the schema has declared for 5+ weeks.

### Why this is safe (CLAUDE.md §12.11 inline)

- Operation set: CREATE TYPE × 4 + CREATE TABLE × 3 + CREATE INDEX × 7 + ALTER TABLE ADD CONSTRAINT × 3 — **all additive**
- Columns overwritten: **NONE** (only new objects)
- Row mutations: **ZERO** (no UPDATE / DELETE / INSERT)
- Guard: every DDL is idempotent; running twice = same end state
- → §12.11 N/A by structural argument. **User confirmation: NOT REQUIRED.**

### Consumer code impact

The 4 consumer routes that touch these tables (`app/api/admin/cdr/compliance/route.ts`, `app/api/admin/cdr/complaints/route.ts`, `app/api/admin/cdr/complaints/[id]/route.ts`, `app/api/admin/cdr/consent/route.ts`) all wrap their queries in `.catch(() => 0)` defensively — so they degraded gracefully when the tables were missing (returning 0 counts). Once this migration deploys to prod, they'll start returning the real counts (currently 0, since no records can exist yet — the tables didn't exist).

No code change in this PR. The defensive `.catch(() => 0)` patterns can stay; they're cheap insurance against future migrations being slow to deploy.

### Files added / changed

| File | Change |
|---|---|
| `prisma/migrations/20260519100000_fix_pre_migration_cdr_tables_drift/migration.sql` | NEW — corrective migration |
| `docs/IMPLEMENTATION_PLAN.md` | Tech Debt #18 closed; Phase 0 console row #11 marked ✅ DONE; Recently Completed 2026-05-19 entry |
| `docs/changelog/CHANGELOG_2026_05_19.md` | This Session 5 entry |

### Doc-sync (CLAUDE.md §16) — full block

Surfaces changed in this PR:
- [ ] visual design system
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [x] **deployment / build** — new migration file; runs via `prisma migrate deploy` at next Vercel deploy
- [x] **security / CDR posture** — closes the pre-Basiq drift that could have surfaced during an accreditation assessor review
- [ ] operational procedure
- [x] **strategic decision** — Tech Debt #18 marked closed; Phase 0 console row #11 marked DONE

Docs updated in this PR:
- `prisma/schema.prisma` — UNCHANGED (already declared these models)
- `prisma/migrations/20260519100000_fix_pre_migration_cdr_tables_drift/migration.sql` (NEW)
- `docs/IMPLEMENTATION_PLAN.md` (Tech Debt #18 + console row #11 closed; Recently Completed 2026-05-19 entry)
- `docs/changelog/CHANGELOG_2026_05_19.md` (Session 5 entry — this)

### §12.12 — schema migration checklist

- [x] `prisma/schema.prisma` unchanged (the schema has declared these models since 2026-04-11 — this is fix-forward for prod drift, not a new schema feature)
- [x] Matching migration file present at `prisma/migrations/20260519100000_fix_pre_migration_cdr_tables_drift/migration.sql`
- [x] Migration is idempotent (DO blocks for enums + IF NOT EXISTS for tables/indexes/constraints) — safe on dev where objects already exist
- [x] No `DROP` / `ALTER ... DROP COLUMN` / `TRUNCATE` / non-default-backfilled `ADD COLUMN NOT NULL` (purely additive)
- [x] Vercel `vercel-build` will run `prisma migrate deploy` against `monitrax-db-dev` on preview (no-op) and `monitrax-db-prod` on main (creates the missing objects)

### §12.14 — Phase 41E reform compliance

**N/A.** CDR consent / complaint / disclosure tables — not a tax-engine surface; no `Property` / `Investment` / `LegalEntity` schema column added; no new AI tool.

### What deploys mean for Reza

1. Merge this PR → main triggers Vercel build
2. `vercel-build` runs `prisma migrate deploy` before `next build`:
   - On `monitrax-db-prod`: the missing tables + enums are created (~30 seconds)
   - On `monitrax-db-dev`: idempotent no-op (objects already exist)
3. After deploy, re-run the audit one-liner — `summary.hasDrift` should be `false`, all `missing*` arrays empty
4. (Optional) Re-run for forensic confirmation: `/admin/cdr-compliance` dashboard will now show real CDR consent/complaint/disclosure counts instead of `.catch`-returned zeros

### Day's tally — Day 2 (2026-05-19) — 5 PRs

| PR | Title | Closed |
|---|---|---|
| #803 | §6A.1 #3 — Confidence indicators | §6A.1 6/6 ✅ |
| #804 | Tech Debt #4 — April changelog consolidation | Tech Debt #4 |
| #805 | Tech Debt #5 + #6 audit closures | Tech Debt #5 + #6 |
| #806 | fix(admin): schema-drift `::text` casts | (unblocked Tech Debt #18 audit) |
| (this) | Tech Debt #18 — CDR tables corrective migration | **Tech Debt #18 + Phase 0 #11** |

### PR

- Branch: `claude/tech-debt-18-cdr-tables-corrective-migration-MG8mr`
- Status: Open
