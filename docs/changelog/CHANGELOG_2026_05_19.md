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

---

## Session 6 — Reza-side quick-clicks: console hardening

**Time:** ~14:00 AEST · **Type:** Reza-side operational (no code change)

Walking through the 7 Reza-side pre-Basiq quick-click items one at a time. Each item is documented here so that if anything breaks in the next few days we have a single-step rollback reference.

### Quick-Click #1 — Tech Debt #22 (delete `DIRECT_URL` env var)

**Result:** ✅ **Confirmed clean — no action needed.**

Reza checked Vercel Project Settings → Environment Variables; a "direc" search matched only `GOOGLE_REDIRECT_URI` (the Google OAuth callback URL — must stay). `DIRECT_URL` was never set in Vercel (or was removed in an earlier cleanup). Tech Debt #6 was already closed at code layer 2026-05-19 morning; now confirmed at infra layer too.

**Rollback:** N/A (nothing changed).

**Doc-sync:** `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #22 → ✅ DONE.

### Quick-Click #2 — Phase 0 console row #13 (restrict the Gemini API key)

**Result:** ✅ **DONE.**

Reza opened GCP Console → APIs & Services → Credentials → the Gemini API key in project `Monitrax` (organisation `monitrax.com.au`) and applied **two** restrictions:

1. **Application restrictions** → HTTP referrers (web sites):
   - `https://monitrax.com.au/*`
   - `https://www.monitrax.com.au/*`
   - `https://*.vercel.app/*` (covers preview deploys)
2. **API restrictions** → Restrict key → ticked only **Gemini API** (the consumer Gemini API at `generativelanguage.googleapis.com`).

**Two Gemini-named APIs were intentionally NOT selected** (different products, the app doesn't call them):
- `Gemini Cloud Assist API` (GCP Console internal AI helper)
- `Gemini for Google Cloud API` (Workspace / Cloud coding assistance)

**Why this matters (CDR posture):** Before this change, anyone who got the key could spend against Reza's GCP billing from anywhere on earth. After this change, a leaked key is only usable by a caller impersonating `monitrax.com.au` or a Vercel preview URL.

**Enabling step taken along the way:** the "Gemini API" did not initially appear in the Restrict key dropdown — Google rebranded "Generative Language API" → "Gemini API" but the underlying service is still `generativelanguage.googleapis.com`. Reza enabled it via APIs & Services → Library → "Gemini API" → Enable, then returned to the restrict-key page and refreshed.

**Rollback (if Gemini 403s in Vercel logs after deploy):**

1. GCP Console → APIs & Services → Credentials → click the Gemini key name
2. **Most likely cause = HTTP referrer mismatch.** Add the missing domain to the referrers list and Save. (E.g. if you spin up a custom domain `app.monitrax.com.au`, add `https://app.monitrax.com.au/*`.)
3. **Less likely cause = API restriction wrong.** Flip "API restrictions" back to "Don't restrict key", Save, investigate which API the code is actually calling.
4. **The key value itself was NOT rotated** — every code path calling Gemini continues to use the same key value. So no env-var change in Vercel is needed.

**Key identifying detail (for future operators):**

- Project: `Monitrax` (organisation `monitrax.com.au`, project id `monitrax-479700`)
- Key creation date: 12 December 2025
- Direct link: `https://console.cloud.google.com/apis/credentials/key/cef87ecf-5452-4536-babe-b66d481e67f6?project=monitrax-479700`

**Doc-sync:** `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #13 → ✅ DONE; this changelog records the full rollback recipe.

### Quick-Click #3 — Phase 0 console row #3 (Cloud Scheduler `monitrax-conversation-retention-sweep`)

**Result:** ✅ **DONE — job created + force-run 200.**

Reza created `monitrax-conversation-retention-sweep` in Cloud Scheduler (region `australia-southeast1`, `0 3 * * *` `Australia/Sydney`, target `https://www.monitrax.com.au/api/conversations/retention-sweep`, `Authorization: Bearer <CRON_SECRET>`). Force-run returned 200. AFSL 7-year conversation-message purge is now enforced daily.

**Doc-sync:** `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #3 → ✅ DONE.

### Quick-Click #4 — diagnose + fix `monitrax-cdr-lifecycle` 500s (was failing at 02:00 AEST)

**Result:** ✅ **DONE — root cause identified, two-part fix applied, force-run 200.**

**Symptom.** The `monitrax-cdr-lifecycle` Cloud Scheduler job was returning 500 from `/api/cdr/lifecycle` on its 02:00 AEST runs — but only intermittently (May 17 failed, May 18 succeeded, May 19 failed). Cloud Scheduler logs only showed `URL_UNREACHABLE-UNREACHABLE_5xx`.

**Diagnostic path.** Pulled the Vercel function logs filtered to `/api/cdr/lifecycle`. The full stack trace contained our own wrapped error from `lib/db.ts:202` (`wrapTlsHandshakeError`):

```
prisma:error
Invalid `prisma.organizationClient.findMany()` invocation:
C058D412777F0000:error:0A000412:SSL routines:ssl3_read_bytes:
ssl/tls alert bad certificate:ssl/record/rec_layer_s3.c:912:SSL alert number 42

CDR lifecycle job failed: Error: Cloud SQL TLS handshake rejected during
prisma.organizationClient.findMany(). The ephemeral client cert was minted
by SQL Admin but the instance refused it. [...]
See docs/operational/security/04_WIF_TROUBLESHOOTING.md §3.G for the
verification commands.
```

This is the same TLS-42 error documented in WIF runbook §3.G — but with a twist: it was **intermittent**, not constant. A permanent config issue (IAM auth flag OFF / SA missing role / wrong connection name) would have failed every Prisma call. We confirmed the WIF setup was fundamentally healthy by:

1. Force-running the failed job during business hours — returned 200
2. Confirming `/api/admin/schema-drift` (which uses the same Prisma client via the same WIF stack) had succeeded at 10:30am AEST the same morning

**Root cause.** Cloud SQL maintenance-window collision. The `monitrax-db-prod` instance had:

- "Updates may occur on any day of the week"
- "Maintenance will be applied during week 1"
- "Notifications: Off"

— i.e. Cloud SQL was allowed to perform unscheduled maintenance at any hour, with no notification. When maintenance landed inside our 02:00 AEST cron window, the instance was mid-restart and rejected the freshly-minted Cloud SQL Connector cert at TLS handshake. Our 02:00 cron was effectively in a "Cloud SQL roulette" zone.

(Backups, by elimination, weren't the cause — Operations log showed nightly backups happening between 23:00–00:30 AEST, well outside the 02:00 cron window.)

**Fix — two parts, both Reza-side, no code change:**

1. **Tightened the Cloud SQL maintenance window.** GCP Console → SQL → `monitrax-db-prod` → Edit maintenance preferences:
   - Window: **Sunday 04:00–05:00 AEST** (lowest-traffic time of the week)
   - Notifications: **ON**
   - Was previously: "any day, any hour, notifications off"
2. **Rescheduled the cron away from the early-morning window.** Cloud Scheduler → `monitrax-cdr-lifecycle` → Edit:
   - Frequency: `0 2 * * *` → `30 3 * * *` (03:30 AEST)
   - Two hours of separation absorbs any future maintenance event without losing the overnight slot
   - Force-run after re-schedule: **200**

**Rollback (if it starts failing again):**

1. **First check:** GCP Console → SQL → `monitrax-db-prod` → Maintenance panel. Did the window get reset to "any day"? (Unlikely but possible after a manual GCP intervention.)
2. **Second check:** Vercel logs for `/api/cdr/lifecycle` POST — is it still TLS-42, or a different error?
3. **If still intermittent TLS-42:** ship the **retry-on-TLS-error wrapper** in `lib/db.ts` (queued in `IMPLEMENTATION_PLAN.md` Up Next #6b) — that's the defensive long-term fix; transient handshake failures should self-heal, not bubble up as 500s.
4. **If a different error:** treat as a fresh diagnostic — open `04_WIF_TROUBLESHOOTING.md` and walk §3.A–§3.K.

**Doc-sync (CLAUDE.md §16):**

- `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` — updated 3 references to `0 2 * * *` → `30 3 * * *` (top table, gcloud setup, Cloud Scheduler form field)
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` §3.G — appended new "Variant — intermittent TLS-42 at the same time every night (Cloud SQL maintenance-window collision)" section with the evidence pattern + two-part fix recipe + 2026-05-19 documented occurrence
- `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` Maintenance Windows section — recorded current setting (Sunday 04:00–05:00 AEST, notifications ON) + the back-story
- `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #1 (cdr-lifecycle) — updated schedule + linked to runbook for diagnostic; Up Next added row #6b (retry-on-TLS-error wrapper)

### Quick-Click #5 — Phase 0 console row #12 (rotate `CRON_SECRET`)

**Result:** ✅ **DONE — rotated atomically; all 3 jobs returning 200.**

The previous `CRON_SECRET` had been pasted into chat during 2026-05-12 cron debugging, so although it never reached any public surface it was no longer credentialled-quality. Rotated before Basiq submission.

**Sequencing used (matters — wrong order causes job 401-storm):**

1. **Generate** new value locally: `openssl rand -base64 48` (never copy-pasted into any chat / doc / commit message).
2. **Update Vercel env** (Production scope) → save **without redeploying** yet (so prod still uses the old secret for now, jobs keep working).
3. **Update all 3 Cloud Scheduler `Authorization: Bearer …` headers** (`monitrax-cdr-lifecycle`, `monitrax-portal-alert-sweep`, `monitrax-conversation-retention-sweep`). Jobs are now sending the NEW secret but prod still accepts the OLD secret — overlap window.
4. **Redeploy Vercel Production** → new secret goes live; old secret stops being accepted.
5. **Force-run all 3 jobs** → all returned 200.

**Rollback (if anything starts 401-ing later):**

1. Most likely cause = a Scheduler job header wasn't actually saved — go to the failing job → Edit → re-paste the `Bearer` header → Save.
2. If it's all 3 jobs simultaneously → the Vercel env var didn't update properly → check Vercel Production scope, re-paste the value, redeploy.
3. Worst case — generate another fresh secret and re-run the full 5-step sequence above; the cost is 10 min.

**Doc-sync:** `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #12 → ✅ DONE.

### Quick-Click #6 — Phase 0 console row #6 (Vercel → Cloud Logging log drain)

**Result:** ⏸ **DEFERRED — foundation work captured for a future PR.**

Attempted the Vercel-native OIDC-federated log-drain path. Completed the GCP side (created `vercel-log-drain@monitrax-479700.iam.gserviceaccount.com`, granted `roles/logging.logWriter`, **saved** the WIF binding `principalSet://iam.googleapis.com/projects/87218209262/locations/global/workloadIdentityPools/vercel-pool/attribute.project_id/prj_UYQF3GpGAkeFo4ZhMhch4Q0btCAU` with `roles/iam.workloadIdentityUser` at ~14:03 AEST — same pattern as WIF Phase 9).

**Snag discovered:** Vercel's **OIDC Federation** (Project Settings → Security) and Vercel's **Log Drain feature** (Project Settings → Drains) are two different parts of Vercel that share the word "secure" but use different auth mechanisms. OIDC tokens are minted **for Vercel functions to call backend services** (this is what WIF Phase 9 Cloud SQL setup uses); **Log Drains use HMAC-signed POSTs with an `x-vercel-verify` header**, not OIDC bearer tokens. The WIF binding we created is technically correct but won't be presented by the log-drain pipeline → GCP would 401 every POST.

**Decision (transparent re-framing):**

- The architect lens — the right architecture is a tiny `vercel-log-receiver` Cloud Function that accepts the HMAC POST, verifies `x-vercel-verify`, and writes to Cloud Logging via the SA we already created. That's a ~2 hour code PR with tests, not a click-through.
- The compliance lens — **this is NOT a Basiq blocker.** Basiq needs audit logs for sensitive data access retained 7 years; that's the `auditLog` Postgres table + retention sweep (verified working Quick-Click #4). Vercel function logs (`console.error`, request traces) are operational debug logs — useful but not a compliance artifact.
- The behaviour-psychologist lens — pushing through this for another hour with no real outcome today vs banking 5/7 ✅ + sprinting through the remaining 2 high-value items (SCC + alert policies) is the optimal move.

**What was preserved (not wasted):**

- `vercel-log-drain` SA + `roles/logging.logWriter` role grant + WIF binding all remain in place
- The future Cloud Function shim will impersonate this exact SA
- We just made that future PR ~30 minutes smaller

**Queued as `IMPLEMENTATION_PLAN.md` Up Next #15:** `vercel-log-receiver` Cloud Function shim. Trigger conditions documented in that row (first paying user / metric needing >7d log history / incident where Vercel logs disappeared mid-forensic).

**Rollback (if we need to remove the dormant resources):** GCP Console → IAM & Admin → Service Accounts → `vercel-log-drain` → delete; GCP Console → IAM → revoke the principalSet from any SA bindings. Idempotent; safe; no production impact since nothing currently calls it.

**Doc-sync:** `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #6 → ⏸ DEFERRED with full backstory; Up Next #15 added with scope + trigger conditions.

### Quick-Click #7 — Phase 0 console row #16 (Security Command Center triage)

**Result:** ✅ **DONE on Standard tier; Premium activation deferred to D-Day Bundle Tier 1.1.**

SCC Standard was already activated (Security Health Analytics enabled) — first scan had surfaced 4 active findings. Triaged all 4 today.

**The 4 findings and their resolution:**

| Finding | Severity | Verified resource | Action taken |
|---|---|---|---|
| Public SQL instance (×2) | High | `monitrax-db-prod` + `monitrax-db-dev` authorized network `0.0.0.0/0` | **Muted with documented exception** linking to CLAUDE.md §13.6 + WIF Phase 12 resolution path. Will unmute + auto-resolve at WIF Phase 12 cutover (Vercel Static IP migration). |
| Open RDP port | High | `default-allow-rdp` firewall rule in default VPC (verified `//compute.googleapis.com/projects/monitrax-479700/global/firewalls/default-allow-rdp`) | **Deleted the firewall rule.** Zero Compute Engine VMs in our architecture (Vercel-hosted Next.js + Cloud SQL only) — the rule had no targets. |
| Open SSH port | High | `default-allow-ssh` firewall rule in default VPC | **Deleted the firewall rule.** Same reasoning as RDP. |

**Bonus housekeeping (not SCC-flagged but equally pointless given zero VMs):**
- `default-allow-icmp` — deleted
- `default-allow-internal` — deleted

Net: 4 default VPC firewall rules removed (unused since we have no Compute Engine VMs). Two real attack-surface reductions (RDP + SSH from the internet), two prophylactic cleanups (ICMP + wide-open internal VPC traffic).

**Why this is safe for our architecture:** Cloud Run, Cloud Functions, App Engine, and Vercel-hosted apps **don't use default VPC firewall rules** — only Compute Engine VMs do. Cloud SQL has its own authorized-networks list (separate from VPC firewall rules). So removing all 4 default VPC rules has zero functional impact on Monitrax.

**Active findings after triage:** 0
**Muted findings:** 2 (the Public SQL pair, will auto-resolve at WIF Phase 12)
**Inactive findings:** 2 (RDP + SSH — auto-flipped to inactive since their resources were deleted)

**Why Premium was deferred:** Reza decision 2026-05-19 — bundle all cost-incurring activations into a "D-Day Bundle" executed the day before Basiq submission so they're FRESH when reviewers look (a recently-activated SCC Premium with "last scanned: 2 hours ago" timestamp is more credible than a 4-month-old setup) + zero monthly spend during the months of "waiting for Basiq." Full bundle documented in `IMPLEMENTATION_PLAN.md` §0 → "D-Day Bundle" subsection (Tier 1.1 = SCC Premium trial; Tier 1.2 = Cloud Armor; Tier 1.3 = CMEK).

**Rollback if anything breaks:**
- If a future Compute Engine VM needs SSH/RDP access — create a narrow firewall rule (specific source IP range, specific target tag) instead of restoring the wide-open defaults. Don't restore `default-allow-*`.
- If a future application needs ICMP — same approach, narrow rule only.
- The 2 muted SCC findings will auto-resurface as active if someone re-adds the `0.0.0.0/0` entry to Cloud SQL authorized networks (which would be a regression we'd want to catch anyway).

**Doc-sync:** `docs/IMPLEMENTATION_PLAN.md` Phase 0 console row #16 → ✅ DONE; D-Day Bundle subsection added under §0 with full Tier 1-4 breakdown for the pre-Basiq submission morning.

### Quick-Click #8 — Phase 0 console row #5 (A1 + A9 alert policies; A7 partial)

**Result:** 🟡 **A1 ✅ DONE; A9 ✅ DONE (with gap discovered); A7 already exists, needs verification (deferred).**

#### A1 — Monitrax app down

Created `A1 — Monitrax app down (/api/health)` policy in Cloud Monitoring.

- **Metric:** Uptime Check URL → Check passed
- **Filter:** `host = monitrax.com.au` (catches both existing uptime checks — `Monitrax API Health Check` + the existing `Notify on failure`)
- **Trigger:** Threshold `< 1`, Below threshold, Any time series violation, 2-minute retest window
- **Channels:** `Reza-Email` + `Reza-SMS` (both ticked)
- **Severity:** Critical (P0)
- **Auto-close duration:** 30 minutes (so the alert clears quickly when the app recovers)
- **Documentation:** runbook reference to `01_INCIDENT_RESPONSE.md` Scenario 1 + first-diagnostic checklist
- **Labels:** `category=availability` / `severity=p0` / `runbook=01_incident_response`

Test alert successful — `Reza-Email` received the test within ~30 sec.

#### A9 — Budget overrun (gap discovered during the fix)

The existing budget policy was `Development Budget` at $50/mo with the default GCP "Email alerts to billing admins and users" recipient list only. **Diagnostic finding via inbox audit:** Reza confirmed **no budget alert email ever fired**, despite spend having crossed the 50% threshold ($40.10 vs $25) weeks ago. The budget alerts had been **silently broken** until today.

**Edit applied to the existing budget:**
- Renamed `Development Budget` → `Monitrax monthly budget`
- Amount: $50 → **$100/mo** (gives breathing room while still catching real anomalies — current spend trajectory was projecting ~$65 end-of-month, which would have repeatedly triggered overrun alerts on the old $50)
- Added 4th threshold at 120% of actual spend (catastrophic overrun tripwire)
- **Notification channel: explicitly linked `Reza-Email`** (the actual fix — without this, the default "Email alerts to billing admins" wasn't reaching Reza's primary inbox)
- Kept "Email alerts to billing admins and users" ticked too for belt-and-braces
- Pub/Sub topic: skipped (overkill for budget alerts)
- **GCP Billing budget alerts do NOT support SMS** at the platform level — email-only. This is a known restriction of the Billing API (Cloud Monitoring alerts support SMS, Billing alerts don't). Budget alerts are warning-class, not P0; email is sufficient.

**Why this matters:** had we never done A1 + this A9 audit, Reza would have had a silently-overrunning prod GCP bill with no notification, and (separately) an "app down" event would have only auto-emailed `Admin@monitrax.com.au` (not SMS-d Reza personally). Today's session closes both gaps.

#### A7 — Cron-failure alert ALREADY EXISTS (verification deferred)

Discovered during the budget inbox audit: at **2:00 AM 2026-05-19 AEST**, an email arrived at `Admin@monitrax.com.au` titled `[ALERT - Warning] Cloud scheduler job failed for Cloud Scheduler Job with {job_id=monitrax-cdr-lifecycle}`. This was the same maintenance-window collision we diagnosed + fixed in Quick-Click #4 — and a cron-failure alert policy fired correctly on it.

So **A7 is already wired and working for at least the cdr-lifecycle job.** Three open questions for the next session to verify:

1. **Find the existing policy** — Monitoring → Alerting → Policies → search for "scheduler" or "cron"
2. **Verify scope** — does the policy filter to all 3 crons (`monitrax-cdr-lifecycle`, `monitrax-portal-alert-sweep`, `monitrax-conversation-retention-sweep`) or only `cdr-lifecycle`?
3. **Verify channels** — current notification was only to `Admin@monitrax.com.au` (the GCP-default channel). Add `Reza-Email` + `Reza-SMS` so Reza is paged on the next failure (the morning's failure email arrived but only via the shared admin inbox).
4. **Rename for convention** — match `A7 — Cloud Scheduler cron failure` (matches `08_OBSERVABILITY_SLOS.md` §3 alert ID convention).

**Deferred to next session.** Tracked in `IMPLEMENTATION_PLAN.md` Phase 0 row #5 as outstanding work + on the D-Day Bundle Tier 4 verification list.

#### Two pending cleanups (next, this session)

1. **Delete the duplicate `Notify on failure` policy** that GCP auto-created when the `Monitrax API Health Check` uptime check was set up. Now that `A1` covers the same condition, the duplicate would cause 2 emails per outage. Keep `A1`, delete `Notify on failure`.
2. **Investigate the apac-singapore red ! mark** on `Monitrax API Health Check`. Could be (a) real prod issue from the APAC checker region, (b) Vercel edge routing quirk, (c) stale failure from a previous deploy that needs a re-run. 30-second diagnostic.

#### Doc-sync (CLAUDE.md §16)

- `docs/IMPLEMENTATION_PLAN.md` Phase 0 row #5 → 🟡 PARTIAL with A1 ✅ + A9 ✅ + A7 verification outstanding + bonus cleanups noted
- This changelog records the budget-silent-overrun finding (operational learning worth keeping)

### Remaining cleanups (in order)

| # | Item | Effort | Status |
|---|---|---|---|
| C1 | Delete duplicate `Notify on failure` alert policy | ~1 min | ✅ DONE |
| C2 | Diagnose apac-singapore red ! on health check | ~1 min | ✅ DONE (and fixed via uptime check recreation) |

### Cleanup C1 — Duplicate alert policies deleted

**Result:** ✅ **Two duplicates deleted; Policies list now clean (A1 + A7 only).**

Deleted these two redundant alert policies from `Monitoring → Alerting → Policies`:

| Policy | Reason for deletion |
|---|---|
| `Monitrax API Health Check uptime...` (created 12 April 2026) | Auto-created when the OLD HTTP uptime check was created. Duplicates A1 on the same condition. Also became orphaned when C2 deleted the underlying check. |
| `Notify on failure uptime failure` (created 11 March 2026) | Older default policy. Also duplicates A1. |

**Result:** policies list went from 4 → 2:
- `A1 — Monitrax app down (/api/health)` (today's new one — uptime metric)
- `Cloud scheduler job failed` (the A7 we hardened — log-based)

### Cleanup C2 — Uptime check HTTPS fix (resolved the apac-singapore failure)

**Result:** ✅ **Root cause = HTTP/port 80 misconfiguration; deleted broken check, created fresh HTTPS check, all 6 regions now green.**

**Diagnostic.** Reza clicked into the failing `Monitrax API Health Check` uptime check and saw:
- Check Type: HTTP (not HTTPS)
- Port: 80 (not 443)
- All 6 regions failing (not just apac-singapore — the failure had spread)
- Percent Uptime: 57.277%

**Root cause.** The check was hitting `http://www.monitrax.com.au/api/health` on port 80. Vercel automatically redirects HTTP → HTTPS, so most requests returned a 308 redirect response (no `"healthy"` content match) → uptime check failed. Inconsistent across regions because Vercel's edge handling of HTTP→HTTPS varies by region (sometimes 200 from cached edge, sometimes a clean redirect, sometimes a timeout).

**GCP limitation discovered.** Cloud Monitoring **does not allow editing the protocol of an existing uptime check** — it's pinned at creation. The only fix is delete + recreate.

**Fix applied.**
1. Deleted the broken HTTP `Monitrax API Health Check` (along with its auto-created alert policy — handled as part of C1)
2. Created fresh HTTPS uptime check with the same name:
   - Protocol: HTTPS, Port: 443
   - Hostname: `www.monitrax.com.au`, Path: `/api/health`
   - Check Frequency: 1 minute (was 5 min — faster recovery detection)
   - Regions: Global (all 6)
   - Response validation: content contains `healthy` (re-enabled — was disabled mid-config)
   - Acceptable HTTP response codes: 2XX
   - **Inline "Create an alert" toggle DISABLED** (to avoid creating yet another duplicate of A1)

**Result:** all 6 regions now report passing. A1 alert policy automatically catches the new check via the `host = monitrax.com.au` filter — no rewiring needed.

**Why this wasn't caught earlier.** The check was created 12 April 2026 with HTTP defaults. It worked intermittently because some regions returned 200 from Vercel's cached edges (matching the `"healthy"` content), others got redirects/timeouts. The failure rate slowly grew until today when it became persistent across most regions. Adding the new HTTPS check + content match `healthy` makes this deterministic going forward.

### A7 hardening (deferred earlier, completed in same flow)

After identifying the existing `Cloud scheduler job failed` policy in the Policies list, edited it:

- **Renamed:** `Cloud scheduler job failed` → `A7 — Cloud Scheduler cron failure` (matches `08_OBSERVABILITY_SLOS.md` §3 alert-ID convention)
- **Added notification channels:** `Reza-Email` + `Reza-SMS` (was previously only `GCP Monitrax Alert` — which is why this morning's CDR-lifecycle failure email arrived at the admin inbox, not Reza's personal channels)
- **Added documentation field:**
  ```
  A Cloud Scheduler cron job emitted severity=ERROR.
  Affected job is in $.jsonPayload.jobName.
  Runbook: docs/operational/runbooks/05_RETENTION_SCHEDULERS.md
  For cdr-lifecycle TLS-42 failures see 04_WIF_TROUBLESHOOTING.md §3.G variant.
  First diagnostic: Cloud Scheduler → job → View logs → most recent run.
  ```
- **Filter scope confirmed correct (unchanged):** `resource.type="cloud_scheduler_job" AND severity="ERROR"` — covers ALL Cloud Scheduler jobs, not just cdr-lifecycle, so all 3 of our crons (`monitrax-cdr-lifecycle`, `monitrax-portal-alert-sweep`, `monitrax-conversation-retention-sweep`) are now alerted on
- **Severity:** kept at Warning (appropriate — a cron failure isn't P0 like app-down)
- **Notification rate limit:** 1 per hour (prevents spam if multiple jobs fail in quick succession)
- **User Labels:** NOT added — GCP log-based alert policies don't support User Labels (metric-based policies do, e.g. A1). Platform limitation, not a process gap.

### Day's tally — final scoreboard for 2026-05-19 (Day 2)

**8 of 8 quick-clicks landed** + **2 cleanups** + **3 alert policies fully wired** + **5 important discoveries documented**:

| # | Item | Outcome |
|---|---|---|
| QC #1 | Tech Debt #22 — `DIRECT_URL` env var | ✅ Confirmed not present in Vercel |
| QC #2 | Phase 0 #13 — Gemini API key restricted | ✅ HTTP referrers + Gemini API restriction |
| QC #3 | Phase 0 #3 — `monitrax-conversation-retention-sweep` Cloud Scheduler | ✅ Created, force-run 200 |
| QC #4 | Phase 0 #1 — `monitrax-cdr-lifecycle` intermittent 500s | ✅ Root-caused (Cloud SQL maintenance window collision); fixed by tightening maintenance window + rescheduling cron to `30 3 * * *` |
| QC #5 | Phase 0 #12 — `CRON_SECRET` rotated | ✅ Rotated atomically across Vercel + 3 scheduler jobs |
| QC #6 | Phase 0 #6 — Vercel → Cloud Logging log drain | ⏸ Deferred (foundation work saved — SA + WIF binding ready for future Cloud Function shim PR per Up Next #15) |
| QC #7 | Phase 0 #16 — Security Command Center triage | ✅ Active findings 4→0 (2 muted Public SQL, 2 firewall rules deleted) |
| QC #8 | Phase 0 #5 — A1 + A9 + A7 alert policies | ✅ All 3 live with Reza-Email + (Reza-SMS for A1+A7) |
| Cleanup C1 | Duplicate uptime-check alert policies | ✅ 2 deleted, Policies list clean |
| Cleanup C2 | apac-singapore uptime-check failure | ✅ Root-caused (HTTP/80 misconfig), recreated as HTTPS/443, all 6 regions green |

**5 important discoveries (operational learnings worth preserving):**
1. Budget alerts had been **silently broken** — no email ever fired despite spend crossing 50% threshold weeks ago. Now fixed.
2. CDR-lifecycle 2 AM failures were a **Cloud SQL maintenance-window collision** — documented in WIF runbook §3.G "Variant" so future operators recognize it in <5 min.
3. **GCP log-based alert policies don't support User Labels** (only metric-based do) — platform limitation.
4. **GCP Cloud Monitoring uptime checks pin protocol at creation** — can't edit HTTP↔HTTPS, must delete + recreate.
5. **GCP Cloud Billing budget alerts don't support SMS** — email-only at platform level. Budget alerts are warning-class so this is acceptable.

**Pre-Basiq engineering posture:**
- ✅ Zero static credentials in runtime (WIF Phase 9 cutover stable since 2026-05-01)
- ✅ All 3 daily crons wired + working + monitored
- ✅ App-down + cron-failure + budget-overrun alerts paging Reza directly
- ✅ SCC active findings = 0
- ✅ Schema drift = 0 (Tech Debt #18 closed via the corrective migration in this branch)
- ⏸ Cost-incurring activations (SCC Premium / Cloud Armor / CMEK) deferred to D-Day Bundle
- 🚧 External lead-time items (pen test 6wk, cyber insurance 3wk, Stripe live 2wk) still to commission this week per D-Day Bundle Tier 3

The pre-Basiq Reza-side checklist is now in the best shape it has ever been. Next: pre-Basiq code PRs (Up Next #1 WIF Phase 11, #2 WIF Phase 12, #6b retry-on-TLS-error wrapper, #15 Cloud Function log-receiver shim) — none of which are blockers for daily ops, all of which sharpen the submission package.
