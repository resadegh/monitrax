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

---

## Session: stitch-dashboard-redesign-LIlK9 (R5 PR1 — InsightWidgets restyle)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R5 PR1)
- **Scope**: Full restyle of `components/dashboard/InsightWidgets.tsx` (6 widgets)
- **Description**: Restyles 6 of the 8 R5 dashboard widgets from legacy
  `Card` + hard-coded blue/green/red/orange/purple to the editorial vocabulary
  (`EditorialCard` + `Eyebrow` + `DataValue` + editorial-* tokens). Public
  interfaces preserved — `app/dashboard/page.tsx` is untouched. Covers 3 of
  the 4 R5 paired-diagnostic rows. Remaining: Debt + Entity Cashflow row
  (DebtQualityWidget + EntityCashflowSummary, larger files — own PR).

### Widgets restyled (all in InsightWidgets.tsx)
1. **FinancialHealthScore** — score arc in editorial-emerald (or amber when
   weak); editorial chip for grade letter (no red — F downgrades to amber).
2. **EmergencyFundTracker** — emerald/amber tone tied to status; editorial
   progress bar + tint track; gap message in amber/10 band.
3. **MoneyBleedingCard** — `Flame` icon removed (alarmist, anti-editorial);
   heavy items render in amber, routine in slate/60; no red.
4. **SpendingByCategory** — TRAIL spectrum dots (sky / emerald / indigo /
   violet / amber / slate) replace the rainbow blue/green/purple/orange/pink/cyan
   palette.
5. **ActionableInsights** — danger maps to amber (per "never red"); success →
   emerald-edge wrap; info → calm warm bg; action link in emerald.
6. **MonthlyBudgetSummary** — TRAIL spectrum segments (sky/indigo/violet/emerald)
   replace blue/purple/orange/green; income & remaining bands in emerald/10.

### Bonus cleanup
- **3 grandfathered `0.15` HARDCODED_FINANCIAL_CONSTANT violations eliminated.**
  Refactored MonthlyBudgetSummary's "is this segment wide enough to show its
  label?" check from `(amount / income) > 0.15` to `widthPct > 15` (presentation
  threshold extracted as `SEGMENT_LABEL_MIN_PCT`). Baseline count `27 → 24`.
- Unused lucide imports dropped (Flame, Droplets, Target, Wallet, TrendingDown).

### Files Modified
- `components/dashboard/InsightWidgets.tsx` — full rewrite (~633 → ~470 lines).
- `.audit/financial-math-baseline.json` — removed 3 InsightWidgets entries
  (count 27 → 24); pure cleanup.

### Build Status
- [x] `npm run lint:financial-surfaces` — 24 grandfathered (3 violations
      eliminated by the refactor), 0 new
- [x] `npm run build` — see verification below

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (6 widgets migrated to editorial vocabulary)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — R5 PR1 ticked; R5 PR2 (Debt + Entity Cashflow) queued
- `docs/changelog/CHANGELOG_2026_05_30.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — UI restyle; no `lib/tax-engine/*`, no financial calculation, no schema
change. Same data inputs and props as before; pure presentational rewrite.

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)

---

## Session: stitch-dashboard-redesign-LIlK9 (R5 PR2 — DebtQualityWidget restyle)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R5 PR2)
- **Scope**: Restyle `components/dashboard/DebtQualityWidget.tsx`
- **Description**: Restyles the Debt Quality widget — the left half of the
  Debt + Entity Cashflow paired row — from legacy Card + hard-coded green/blue/
  red/orange/yellow to editorial vocabulary. Public API preserved
  (`DebtQualityWidget`, `calculateDebtQuality`, `DebtCategory`, `DebtBreakdown`,
  `DebtQualityData`); the `calculateDebtQuality` helper at the bottom is
  untouched. EntityCashflowSummary (the right half) stays in its legacy
  styling for R5 PR3 — visual mismatch in this paired row is intentional
  trade-off for shipping discipline (824-line file deserves its own PR).

### Widget changes
- Card wrapper → `EditorialCard` + `Eyebrow`.
- Score arc: single editorial accent — emerald (≥65), slate (40-65), amber
  (<40). No multi-color rainbow.
- Category cards:
  - Good Debt → editorial-emerald tone + soft bg + "Tax deductible" mini-chip
  - Neutral Debt → editorial-sky (TRAIL Track) tone
  - **Bad Debt → editorial-amber, NOT red.** Calm fact-surfacing, not alarm.
    Editorial rule: red is destructive-action-only.
- Score interpretation rewritten in warm, action-oriented language: "Watch /
  Act now" instead of "Poor / Critical".
- Stacked composition bar uses single-color tones (emerald / sky / amber).
- Action link in `text-editorial-emerald`.
- Empty-state ("Debt free"): single emerald accent, no celebration emoji.
- Dead code removed: legacy `getCategoryConfig` + `getScoreInterpretation`
  multi-color helpers; unused `getLoanTypeIcon` + 5 lucide imports (Building2,
  Car, CreditCard, GraduationCap, Briefcase).

### Files Modified
- `components/dashboard/DebtQualityWidget.tsx` — full JSX rewrite (462 → ~340
  lines); `calculateDebtQuality` helper untouched.
- `.audit/financial-math-baseline.json` — line 442 → 404 for the `goodDebt.total
  + neutralDebt.total` entry (pure drift; same expression in unchanged helper).

### Build Status
- [x] `npm run lint:financial-surfaces` — 24 grandfathered (line drift on the
      one DebtQualityWidget entry), 0 new
- [x] `npm run build` — see verification below

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (DebtQualityWidget restyle)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — R5 PR2 ticked; PR3 (EntityCashflowSummary) queued
- `docs/changelog/CHANGELOG_2026_05_30.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — UI restyle; no `lib/tax-engine/*`, no financial calculation, no schema
change. Same data inputs and props.

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)

---

## Session: stitch-dashboard-redesign-LIlK9 (R5 PR3 — EntityCashflowSummary restyle)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R5 PR3)
- **Scope**: Restyle `components/dashboard/EntityCashflowSummary.tsx` — the
  right half of the Debt + Entity Cashflow paired row. Completes R5 and brings
  the Debt + Entity Cashflow paired row to fully-editorial styling.
- **Description**: Surgical color migration + targeted Card → EditorialCard
  wrapper rewrite. The widget's structure (6 tabs, EntityRow expand/collapse,
  per-tab content templates, summary footer) is preserved intact — this PR is
  a vocabulary swap, not a feature rewrite. The `calculateEntityCashflow`
  helper (line ~597+) is untouched. Approach chosen to keep the diff focused
  + reviewable on an 824-line file.

### Migration mapping
- `text-green-600 / dark:text-green-400` → `text-editorial-emerald` (auto-flips)
- `text-red-600 / dark:text-red-400` → `text-editorial-amber` (NEVER red)
- `bg-green-50/50 / bg-green-100 / dark:bg-green-950/20 / dark:bg-green-900/50` → `bg-editorial-emerald/5` and `/10`
- `bg-red-50/50 / bg-red-100 / dark:bg-red-950/20 / dark:bg-red-900/50` → `bg-editorial-amber/5` and `/10`
- `border-green-100 / dark:border-green-900` → `border-editorial-emerald/30`
- `border-red-100 / dark:border-red-900` → `border-editorial-amber/30`
- `text-muted-foreground` → `text-editorial-slate`
- `bg-muted/50` → `bg-editorial-warm`
- `hover:bg-muted` → `hover:bg-editorial-warm`
- `Card` + `CardHeader` + `CardTitle` + `CardContent` → `EditorialCard` +
  `Eyebrow` (header) — both the empty-state and the main widget.
- Summary chip (was `<Badge variant="outline">`) → inline editorial chip in
  emerald/10 (positive net) or amber/10 (negative net).

### Editorial rules honoured
- **"Never red."** All `text-red-*`, `bg-red-*`, `border-red-*` migrated to
  the editorial-amber family. The widget shows expenses + negative cashflow
  in amber — calm fact-surfacing, not alarm. Red is destructive-action-only.
- **Theme-aware via CSS variables.** All editorial-* tokens auto-flip between
  warm-ivory (light) and deep-navy (dark) — dropped the `dark:` prefixes
  redundantly written for the legacy Tailwind classes.
- **Same data, same props, same tabs.** Consumers in `app/dashboard/page.tsx`
  see no API change.

### Cleanup (same touch)
- Removed unused lucide imports: `TrendingUp`, `TrendingDown`, `ArrowRight`,
  `Wallet`, `DollarSign` (no longer referenced after the Card → EditorialCard
  swap removed their use sites).
- Removed unused `Button` import (was implicit from the legacy Card header
  patterns).

### What's NOT in scope of this PR
- The legacy `@/components/ui/tabs` base component still renders with its own
  `bg-muted` / `text-muted-foreground` ground. The `Tabs` / `TabsList` /
  `TabsTrigger` editorial restyle is a separate piece (queued as part of
  future R-port hygiene — not blocking the R5 close).
- The `Badge variant="outline"` used at one spot for "Recurring" remains as-is
  (single occurrence; not worth a separate primitive).

### Files Modified
- `components/dashboard/EntityCashflowSummary.tsx` — color migration + Card
  swap. Public exports (`PropertyCashflow`, `InvestmentCashflow`,
  `LoanCashflow`, `AssetCashflow`, `IncomeCashflow`, `ExpenseCashflow`,
  `EntityCashflowData`, `EntityCashflowSummary`, `calculateEntityCashflow`)
  all preserved.

### Build Status
- [x] `npm run lint:financial-surfaces` — 24 grandfathered, 0 new
- [x] `npm run build` — see verification below

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (EntityCashflowSummary restyle)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — R5 PR3 ticked; R5 row marked complete
  (paired diagnostic rows fully editorial)
- `docs/changelog/CHANGELOG_2026_05_30.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — UI restyle; no `lib/tax-engine/*`, no financial calculation, no schema
change. Same data inputs and props as before.

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)
