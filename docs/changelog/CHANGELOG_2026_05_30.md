# Changelog — 2026-05-30

## Session: stitch-dashboard-redesign-LIlK9 (R-Charts-2)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R-Charts-2)
- **Scope**: Honest Net Worth Trend on the live dashboard — replaces the
  legacy `NetWorthTrend` component that backfilled history with `Math.random`
- **Description**: Builds the persisted monthly snapshot store, the canonical
  history reader, the snapshot recorder (fire-and-forget on every dashboard
  load), the editorial line-chart primitive, and wires the new chart onto
  `/dashboard`. The chart shows a quiet empty state until ≥2 months of recorded
  snapshots accrue — matching the Money Story v2 "ribbon unlocks after 2 months"
  pattern. Legacy component fully deleted.

### Files Created
- `prisma/migrations/20260530030000_phase_r_charts_2_net_worth_snapshots/migration.sql`
  — additive CREATE TABLE `net_worth_snapshots` (id / userId / snapshotDate /
  totalAssets / totalLiabilities / netWorth) + unique (userId, snapshotDate) +
  userId index + FK to users with CASCADE.
- `lib/calculations/netWorthHistory.ts` — canonical reader `getNetWorthHistory`.
  Returns empty when <2 months of data (never invents). Single SSOT reader of
  `NetWorthSnapshot`.
- `lib/services/netWorthSnapshotRecorder.ts` — `recordNetWorthSnapshot()`
  upsert keyed on (userId, current-month anchor UTC). Owned exclusively by
  this code path; §12.11 checklist passes.
- `components/editorial/charts/EditorialLineChart.tsx` — Recharts `AreaChart`
  with bezier line + emerald area fill + thin month X axis + styled tooltip.
  Theme-aware; empty-state placeholder for <2 points.

### Files Modified
- `prisma/schema.prisma` — new `NetWorthSnapshot` model + `User.netWorthSnapshots`
  back-relation.
- `app/api/dashboard/charts/route.ts` — extended response with `netWorthTrend`
  (points + deltaAbsolute + deltaPct + currentNetWorth); calls
  `recordNetWorthSnapshot()` fire-and-forget; reads `getNetWorthHistory()` in
  the existing `Promise.all`.
- `app/dashboard/page.tsx` — swapped `NetWorthTrend` consumer (~5 lines) for
  `EditorialChartCard` + `EditorialLineChart`; extended local
  `DashboardCharts` type; updated charts barrel imports.
- `components/editorial/charts/index.ts` — exports `EditorialLineChart` +
  `NetWorthLinePoint`.
- `.audit/financial-math-baseline.json` — line numbers shifted for 7
  pre-existing entries (pure drift from upstream edits; no new suppressions).

### Files Deleted
- `components/dashboard/NetWorthTrend.tsx` (~270 lines including the
  `generateNetWorthTrendData` Math.random backfill, `CompactNetWorthTrend`
  variant, and a local `Sparkline` SVG). Zero remaining consumers; grep-verified.

### Architecture decisions
- **Monthly granularity, not daily.** One row per (userId, month-anchor). The
  trend chart is a 12-point monthly view; daily granularity would have meant
  ~365 rows/user for one user-visible chart. Simpler, smaller, sufficient.
- **First-of-month anchor (UTC).** Snapshot for the current month gets refreshed
  every visit; when the calendar rolls over, the previous month freezes.
  Captures "as the user last saw it" — good enough for a trend; a Cloud
  Scheduler job is the R-Charts-2.1 hardening.
- **Empty state, not extrapolation.** Honesty contract — the chart shows
  "Trend unlocks after 2 months of activity" until enough data accrues, instead
  of fabricating history. Financial-adviser lens: never quote numbers we can't
  trace.
- **Recorder fires from the route handler, not the calc engine.** §6.4 — calc
  engines must not mutate state. The route is the natural side-effect site;
  the recorder is `.catch(() => {})` so a write hiccup never blocks the
  dashboard.

### Build Status
- [x] `npm run lint:financial-surfaces` — 27 grandfathered (baseline line
      drift updated), 0 new
- [x] `npm run build` — see verification below

### Destructive write checklist (CLAUDE.md §12.11)
Operations in this PR that touch existing rows:
- `lib/services/netWorthSnapshotRecorder.ts` — `prisma.netWorthSnapshot.upsert(...)`

1. **`where` clause matches:** only the row at
   `(authed userId, current-month anchor UTC)`. The table is brand-new and
   written ONLY by this recorder; no other code path touches a row here.
2. **Columns overwritten:** `totalAssets`, `totalLiabilities`, `netWorth` —
   all derived aggregates owned exclusively by this recorder. No user-entered
   field is overwritten.
3. **Guard:** synthetic key (month-anchor computed in this code path) +
   exclusive-writer table.

User confirmation: NOT REQUIRED — additive table + writes confined to
this-code-path-owned aggregates, scoped to the authed user; no existing data at
risk.

### Schema change protocol (CLAUDE.md §12.12)
- [x] Matching `prisma/migrations/20260530030000_phase_r_charts_2_net_worth_snapshots/migration.sql`
      ships in the same PR.
- [x] Migration is purely additive (CREATE TABLE + indexes + FK only). No
      `DROP` / `ALTER ... DROP` / `TRUNCATE`.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (new EditorialLineChart primitive)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md` — chart primitives section adds `EditorialLineChart`
- `docs/IMPLEMENTATION_PLAN.md` — R-Charts-2 ticked; R-Charts-3 remains queued
- `docs/changelog/CHANGELOG_2026_05_30.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — display aggregate of existing values; no `lib/tax-engine/*`, no
reform-affected calculation, no AI tool, no per-asset tax UI. The new
`NetWorthSnapshot` column doesn't interact with the reform's grandfathering
logic (it's a derived total, regime-neutral).

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)

---

## Session: stitch-dashboard-redesign-LIlK9 (R4 — Net Worth paired-hero)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R4 completion)
- **Scope**: Live dashboard `/dashboard` — Net Worth tile elevation
- **Description**: Migrated the Net Worth tile from a legacy `StatCard` inside
  the 6-tile metrics row to a full-width editorial `PairedMetricCard` (Copilot
  Assets / Debts pattern) above the now-5-tile KPI strip. Net result is a
  cleaner IA: Money Story hero (forward-looking) → Net Worth hero (current
  position, Assets / Debts split) → KPI strip (drill-down metrics). The
  click-through detail modal is preserved.

### Files Modified
- `app/dashboard/page.tsx`:
  - Removed the Net Worth `StatCard` + `CalculationTooltip` wrapper from the
    metrics row (~25 lines).
  - Inserted `PairedMetricCard` between the utility row and the metrics row:
    `left = Assets (total + items breakdown)`, `right = Debts (total + loan
    count + portfolio LVR)`, click-wrapped to open the existing Net Worth
    detail modal.
  - Tile grid `xl:grid-cols-6` → `xl:grid-cols-5` (5 KPI tiles now).
  - Dead imports cleaned: `StatCard` (orphaned), `CalculationTooltip`
    (was only used by the Net Worth tile).
- `.audit/financial-math-baseline.json` — 7 entries shifted +4 lines from
  the PairedMetricCard insertion (pure drift; no new violations).

### Architecture / lens decisions
- **Hero pair, not single tile.** Net Worth in a 1/6 grid cell read as a
  peer of the flow KPIs, but it's a *stock* metric (current position) not a
  *flow* metric — different mental model. Elevating to a paired hero gives
  the user both gross numbers (Copilot Assets / Debts pattern), which the
  financial-adviser lens prefers: "you can't manage leverage you can't see."
- **Net Worth value implicit, not headline.** The PairedMetricCard surfaces
  Assets and Debts prominently; the net is derivable at a glance from the
  two numbers and is shown explicitly in the click-through detail modal.
  Designer lens: restraint — let the user do the trivial subtraction; don't
  triple-show the same number.
- **CalculationTooltip dropped.** Consistent with the editorial KPI tiles
  (which dropped their tooltips too); the detail modal is the canonical
  surface for the breakdown formula.

### Build Status
- [x] `npm run lint:financial-surfaces` — 27 grandfathered (baseline line
      drift updated), 0 new
- [x] `npm run build` — see verification below

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (Net Worth elevated to PairedMetricCard hero)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — R4 (final tile migration) ticked
- `docs/changelog/CHANGELOG_2026_05_30.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — UI consumer swap; no `lib/tax-engine/*`, no financial calculation
(all reading existing canonical snapshot fields), no schema change.

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)
