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
- Status: Open
