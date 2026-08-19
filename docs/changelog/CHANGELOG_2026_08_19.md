# Changelog - 2026-08-19

## Session: simp-p2r-r0 (Code, Fable 5) — BRIEF_SIMP_P2R_R0 execution, PR 1 of 2 (the P2 gate)

### Changes Made
- **Type**: Feature (exposure control) + Fix (MON-160) + docs/process. `changesNumbers: NO` by contract.
- **Scope**: PROD Simplification P2 remainder + Preview pipeline (`docs/strategy/PROD_SIMPLIFICATION_PLAN.md` §5 P2, §7)
- **Description**:
  - **MON-160 fix** — module gates were baked at BUILD time: Next.js statically pre-rendered
    gated layouts, freezing the guard's 404/pass verdict into the deployment, so an admin flag
    flip could not unhide a module without a redeploy (found by the Matrix on Preview 2026-08-11,
    #1587 comment). Fix: `moduleRouteGuard()` awaits `connection()` BEFORE the flag read — the
    ONE chokepoint all ~20 gated layouts share (SSOT); locked by an order-asserting test.
    Registered as MON-160 (FIXING; VERIFIED = Reza confirms a live PROD flip propagates ≤30s).
  - **P2.3** — reports page narrowed via the registry: tiles carry `moduleKey`s
    (financial-overview→MODULE_HOME · income-expense→MODULE_HOUSEHOLD · loan-debt→MODULE_DEBT_PLANNER ·
    investment→MODULE_INVESTMENTS; property-portfolio + tax-time unkeyed = the kept v1 pack),
    filtered by the SAME `filterNavByModules` the nav uses; the help section renders from the
    same array — the hardcoded second list is deleted (§12.2.1). Side effect: producer census
    `deductions` 105→104 (a phantom prose match in the deleted list — reseeded with an honest note).
  - **P2.4 (D-6)** — `OwnershipPicker` renders nothing while MODULE_ENTITIES is off; all six
    call sites verified to initialise + reset `{mode:'sole'}`, so new capture resolves to the
    auto-personal entity at the canonical writer. `CorrectOwnershipDialog`'s write path is
    replaced by a notice while off (a hidden picker there could otherwise overwrite existing
    joint/shared attribution with `sole`). ZERO writes to existing attribution; no migration.
  - **P2.6** — 02_UP_NEXT.md row 66 refreshed: target story = the plan §1 v1 line (property
    scoreboard); trigger re-anchored to "before public v1 traffic". Registration only.
  - **Preview pipeline (B-1/B-3/B-4)** — NEW `scripts/dev/set-module-flags.mjs` (keys parsed
    from `moduleRegistry.ts` with a two-way cross-check — never a hardcoded list; REFUSES any
    PROD-looking DATABASE_URL/Cloud SQL identifier per D-9; `--dry-run`; missing rows reported,
    never created). CLAUDE.md §13.6 exception widened to the FULL-INSTANCE copy per Reza's
    2026-08-09 ruling (attested non-real/pre-launch dataset) with the hard trigger (first genuine
    customer account or CDR data ⇒ full-instance copying prohibited); plan §7 mirrored; §7.3
    runbook gains the mandatory post-refresh flag re-apply + the 2026-08-11 refresh-log row.
  - **P2 ticks** — P2.1 (core pass; crumbs noted), P2.2 CLEAN, P2.2b CLEAN, P2.5 executed —
    each citing its #1587 verdict comment; cursor + session log advanced.

### Files Modified
- `lib/featureFlags/moduleRouteGuard.ts` — MON-160 fix (`await connection()` first)
- `tests/featureFlags/moduleGuards.test.ts` — MON-160 order-asserting lock (12 tests green)
- `app/dashboard/reports/page.tsx` — P2.3 registry-keyed tiles + derived help section
- `components/ownership/OwnershipPicker.tsx`, `CorrectOwnershipDialog.tsx` — P2.4 gates
- `tests/featureFlags/p2Narrowing.test.ts` — NEW source-scan locks for P2.3/P2.4
- `scripts/dev/set-module-flags.mjs` — NEW (dry-run + PROD-guard + bad-key proofs in the PR body)
- `CLAUDE.md` §13.6 · `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` (§5 P2, §7, cursor, §9) ·
  `docs/implementation/02_UP_NEXT.md` row 66 · `docs/issues/ISSUES.json`+`.md` (MON-160) ·
  `.audit/producer-census.json` (reseed, noted) · Layer-0 allowlist (+1 test file)

### Build Status
- [x] `npx tsc --noEmit` clean · featureFlags suite 44/44 green
- [x] `neomatrix:check` · `lint:financial-surfaces` · `lint:source-lock` · `census:producers:check`
      (reseeded, honest note) · `issues:check` (147 valid) · `mon131:check` (empty diff) — all green
- [x] Full vitest suite: run before push (result in the PR body)

### Coverage boundary
Verifies the wiring in source + the guard's dynamic opt-out ordering. Does NOT verify: the
rendered narrowing on a deployed build (P2.1 crumbs), the live flip-propagation on PROD
(MON-160's VERIFIED condition — Reza's check after deploy), or the server writer's
sole→personal resolution (pre-existing, unchanged).

---

## Session: simp-p2r-r0 (continued) — PR 2 of 2 (R0 override wiring)

### Changes Made
- **Type**: Feature (verification mechanism). `changesNumbers: NO`. **No schema change** — the
  `FeatureFlagOverride` table pre-dates R0; it finally gains its evaluation reader.
- **Scope**: R0 (plan §5 R-stages precondition; BRIEF_SIMP_P2R_R0 §C)
- **Description**: per-user overrides so a hidden module can go live IN PROD for one user (Reza)
  for Ring-3 verification. `isModuleEnabledForUser` (global ∥ active USER override, not expired;
  keyed cache; fail-closed) + `moduleHasActiveOverride`; `invalidateFlagCache(key)` now clears
  derived per-user entries. All 35 gated API handlers with an authenticated user pass
  `auth.userId` into `moduleApiGuard` (3 public/webhook handlers stay global-only, listed).
  `/api/feature-flags/modules` returns the session user's EFFECTIVE map when a Bearer token is
  sent (client context + nav now user-aware). Admin CRUD at
  `/api/admin/feature-flags/[key]/overrides[/id]` (audit-logged; upsert scoped to the flag+user
  pair — §12.11 answered in the PR body) + a minimal working Overrides affordance on the Modules
  panel. **Deviation surfaced:** server layouts have NO user identity (verified: zero `cookies()`
  repo-wide, Bearer-only auth), so the brief's "layout guards already run with an authenticated
  user" is false for layouts — layouts route through `ModuleGateBoundary`: hard server 404 when
  fully hidden (the standing state); during an override window the shell renders and the
  per-user verdict is enforced client-side (`ModuleOverrideGate` → not-found / Home fallback
  redirect) AND at every gated API server-side.

### Files Modified
- `lib/featureFlags/moduleGate.ts` — user-aware reader + any-override check + prefix invalidation
- `lib/featureFlags/moduleRouteGuard.ts` — `resolveModuleRouting` (3 modes; MON-160 opt-out kept
  first) + `moduleApiGuard(key, userId?)`; the P1 `moduleRouteGuard` is superseded (no dead code)
- `components/featureFlags/ModuleGateBoundary.tsx`, `ModuleOverrideGate.tsx` — NEW
- 21 gated layouts + `app/dashboard/page.tsx` — route through the boundary (Home keeps its
  never-404 redirect in all modes)
- 35 × gated API route files — `auth.userId` passed to the guard
- `app/api/feature-flags/modules/route.ts` — optional-auth effective map
- `lib/featureFlags/ModuleGateContext.tsx` — sends the token; refetches on auth change
- `app/api/admin/feature-flags/[key]/overrides/{route.ts,[overrideId]/route.ts}` — NEW CRUD
- `app/admin/feature-flags/page.tsx` — Overrides affordance on the Modules panel
- `tests/featureFlags/moduleGuards.test.ts` (rewritten for the three modes; MON-160 lock kept
  under the same test name) + `tests/featureFlags/r0Overrides.test.ts` — NEW (58 suite tests green)

### Build Status
- [x] `npx tsc --noEmit` clean · featureFlags suite 58/58
- [x] Full suite + all repo gates run before push (results in the PR body)

### Coverage boundary
Verifies precedence/expiry/cache/invalidation semantics and the wiring by source-scan. Does NOT
verify the live override window end-to-end — that is the R0 ACCEPTANCE (post-merge, on PROD:
MODULE_TAX globally OFF + override for Reza ⇒ he sees /dashboard/tax; a second account gets
not-found; both captured on the PR).

---

## Session: M2 PR-1 (Code, Fable 5) — §D dead links + guard · §A tracker pointers · §C no-store · §B-5

**Milestone:** M2 (kept-surface correctness + depth — THE LAUNCH GATE), per `BRIEF_M2_CORRECTNESS.md` v2
(carried into main in this PR — the Matrix's plan-v2/brief-v2 commits existed only on the merged #1593 branch).
Kickoff order honoured: **§D first** (MON-163 is live in PROD), then §A, §C, §B-5. `changesNumbers: NO`.

### §D — MON-163: kept pages linked into hidden modules (live PROD 404s)
- **Root cause:** the P2.1 sweep verified hidden routes hide; nothing verified kept routes stopped
  POINTING at them. The Matrix's static scan found 2 files; the new repo-wide guard found **8
  kept-reachable files / 14 link sites**.
- **Fix pattern (SSOT):** each link gated on its TARGET module's flag via `useModuleEnabled(key)` —
  affordance absent when off, reappears by itself at the R-stage return. No second route list anywhere;
  everything derives from `MODULE_REGISTRY`.
- **Files:** `app/dashboard/properties/[id]/page.tsx` (what-if icon · Growth-scenarios card · Tax-position
  CTA+sentence · linked-income row hrefs), `components/properties/PropertyTile.tsx` (sell-what-if icon),
  `components/properties/PropertyExpensesCard.tsx` ("View all in Spending"),
  `components/loans/LoanDetailDialog.tsx` (What-If panel), `components/LinkedDataPanel.tsx` (Add Income /
  Add Holding CTAs), `components/shell/TrailStagePill.tsx` (pill stays as an informative badge, link only
  when MODULE_CFO on), `components/help/HelpDrawer.tsx` + `app/help/layout.tsx` (portal links; the server
  layout reads the flag with `connection()` first — MON-160 doctrine, never bake the verdict),
  `app/(dashboard)/recurring/page.tsx` (View-Expense action), `components/strategy/EntityStrategyTab.tsx`
  (self-gated: returns null unless MODULE_STRATEGY — belt-and-braces for every render site).
- **The permanent guard:** `tests/featureFlags/deadLinkGuard.test.ts` — walks the import graph from every
  non-gated route file (kept-reachable set; traversal stops at server gate wrappers), extracts link targets
  (href attrs/fields, router.push/replace, redirect, fallbackHref — incl. template-literal prefixes), and
  fails CI when a kept-reachable file links into a hidden module's `routePrefixes` without mentioning that
  module key. Hidden-only files are exempt via reachability and JOIN the guard automatically when their
  module's registry entry is dropped at its R-stage return.

### §C — MON-161: cacheable gated-route 404s
- Fix at the ONE chokepoint that can stamp headers for a route tree: `middleware.ts` sets
  `Cache-Control: no-store, must-revalidate` for every path matching a `MODULE_REGISTRY` routePrefix
  (registry-derived; Edge-safe pure-data import; MODULE_HOME matches `/dashboard` exactly so kept
  `/dashboard/*` routes keep their normal caching). Locked by `tests/featureFlags/mon161NoStoreCache.test.ts`.
- **Live re-check after deploy (Matrix):** re-run the M1.5 flip on the BARE url — flip ON → renders ≤~30s
  with no cache-busting query; flip OFF → 404 again on the bare url.

### §A — M1.3 carry-over tracker pointers (all six, verbatim brief texts)
STATE.md master-plan block · `01_ACTIVE_WORKSTREAMS.md` 0·SIMP → pointer · old plan superseded-banner +
frozen cursor + §1 story pointer (D-10) · CLAUDE.md programme-boot line (D-18/D-20 named) · hub
`Last updated` bump · MON-162 registered (OPEN, fix deferred per Reza P-3/P-5).

### §B-5 + registry
MON-160 → VERIFIED (M1.5 live flip evidence, #1591 comment). MON-161 + MON-163 raised → DIAGNOSED with
full trios/root causes; flipped to FIXING with the PR number immediately after the draft PR opened
(the registry gate requires fixPRs at FIXING).

### Coverage boundary
The guard verifies STATIC link topology (string-literal hrefs + template prefixes on the kept-reachable
graph); it does NOT verify runtime-assembled hrefs, nor that the CDN honours no-store on a deployment —
the latter is the MON-161 bare-URL flip re-check on PROD. The plan/§5/§9/cursor updated in this PR.

---

## Session: M2 PR-2 (#1595) — §B correctness slice (`changesNumbers: YES`)

**Diagnosis first (Opus subagent, B-1):** census re-run + 12-row kept-surface scope table (now in the
plan under M2.1) with two corrections — `moneyFlowService` is NOT a kept consumer (type-only imports;
the Activity Sankey fetches `/api/master-snapshot`), and `contextBuilder`'s fetchers ARE the kept
pack's producer and its biggest defect. Four findings REGISTERED before any fix code (§24.2 rule 2).

### Fixes (each with its worked example in the registry + PR)
- **MON-164** — the pack's income/expense rows are canonical: `annualContribution` (exported rule
  carrier) = one-off ONCE (salaryBanked/MON-094 convention) · recurring actuals-first
  (`calculateMonthlyAverage` over the same `unifiedTransaction` join the routes use, ×12) · declared
  `toAnnual` fallback. Kills MON-001-R1 (rent −54% in the pack) and MON-129's #1/#2 kept producers
  (+$136,620 deductions from one $11,385 one-off).
- **MON-165** — depreciation converged on `calculateDepreciationAnnual`: first-year-only formula
  deleted from the depreciation page and BOTH pack fetchers (one variant also dropped the DIV43
  guard); remaining years/value now read the engine. $10k DV DIV40 @10%, 3 yrs: $1,024/yr not $2,000.
- **MON-129 kept slice** — one-off gates: `entityBreakdown` expenses via `monthlyRunRate`;
  `propertyCashflow` declared-rent fallback via `monthlyRunRate` (+ `isRecurring` on `CashflowIncome`).
  Out (named, not fixed — D-20): orchestrator/master budget-variance legs (caller-gated), portfolio
  engine's local frequency duplicates, all hidden/dead sites.
- **MON-166** — dep rate ×100 render fixed on the properties dialog (2.5% no longer "250.00%").
- **MON-145** — diagnosed SCHEMA-BOUND (no honest no-schema fix; rate-from-repayments points the
  wrong way per VR-046). M2 slice: the detail tax card states "Interest is a contractual estimate
  (balance × today's rate)". Dated-rate model = Reza decision (M3/R2). The "feeds the pack's per-loan
  interest" claim in the plan/brief was FALSE at HEAD — the kept pack loads no loan data (M3.1 build).
- **MON-167** — dead-link guard now sees `to:` link fields; the editorial hero's drill links carry
  their gating moduleKey and render unlinked when the target module is off.
- **MON-146** — HELD (hidden-only surface; every kept `interestRateAnnual` render verified correct).
- M2.4 (earlier commit) — both dialog re-derivation blocks dead; dialog ≡ tile ≡ detail page.
- §12.1: dead `calculateAnnualInterest` helper deleted from the list page.

### Instruments
Census reseed #2 (5 quantities fell; zero rose) + ledger §6 row · source-lock exceptions −4
(ratchet-down) · scoreboard regenerated · Neo-sync: 3 anchors re-pinned, 7 manifests rehashed,
5 pack lineage edges modelled (P2–P4 blind spots closed), GENERATED_CORE regenerated · ratchet suite
`tests/reports/mon164PackCanonicalRows.test.ts` (7 tests).

### Verification
Full suite **4,539 passed / 0 failed** · tsc clean · all gates green. Coverage boundary: CI locks the
row rule + canonical values + source topology; the RENDERED pack on live data is the Matrix's Ring-3
(M2.2) per `docs/verification/briefs/RING3_M2_PACK_CANONICAL.md` — that verdict, not CI, closes the
correctness half of the launch gate.

---

## Session: M2 PR-3 — the §E depth sweep + no-number fixes (`changesNumbers: NO`)

49 findings (Opus sweep at `be6ad808`) → `docs/strategy/M2_DEPTH_SWEEP_CATALOGUE.md`. Dispositions:
11 fixed here · 12 registered (MON-168…179, incl. the three critical pack defects) · census correction
(the D-12 pack was outside M2.1's scope — Ring-3 handout amended; **M2.5 blocked** until the pack fix
PR + its Ring-3) · the rest = the M3.6 depth backlog + 10 LIVE-CHECK items.

### Fixed in this PR (no number moves — every number defect went to the registry instead)
- Onboarding steps carry `moduleKey` and filter fail-closed — a v1 user is no longer walked through
  six hidden-module steps (household, entities×2, investments, super, income-expenses).
- `LoadFailedState` (shared) on properties / assets / documents / depreciation: fetch failure renders
  an error state with Retry, never "you have no data yet".
- Property detail: Edit deep-links to the list's edit dialog (`?edit=` now honoured); Delete is a real
  two-step confirm + DELETE with error surfacing (both were dead Links).
- Receipt confirm: a property-attributed expense also links the document to the PROPERTY (the
  documented upload→property chain — `resolveAutoLinks` is dead code with zero callers); repeat
  confirms are idempotent.
- Activity: fresh-account vs filtered empty states, Import CTA wired to the existing handler.
- Reports: empty state when no properties exist; error-body parse guarded; (tile-narrowing question
  sent to Reza — D-4 says "Reports→one pack").
- Depreciation breadcrumb → the detail page; pack SIGNED/abs comment corrected.
- Sweep finding #38 corrected during review: the documents API family deliberately uses the
  `report.*` permission tier (no `document.*` permission exists) — not a defect.

### Also this window (separate PR #1597, Reza-authorized workflows exception)
CI playwright hang root-caused: the apt half of `playwright install --with-deps` stalls runner-side
(39s on the last green run → 40-min hangs, twice). #1597: job timeout 30m, per-attempt 240s kill +
3 retries with dpkg-lock recovery, apt transfer timeouts, browser download split from OS deps + cached.

### Verification
tsc clean · all lints/census/neomatrix green (anchors re-pinned: detail :332, list :494; 12 manifests
rehashed; LoadFailedState + catalogue allowlisted) · targeted suites green. Coverage: static fixes
verified by type/lint/test gates; the RENDERED behaviour of each fix is on the Matrix LIVE-CHECK list.


## Session: m3-pr1-pack-fix (Code, Fable 5)

### Changes Made
- **Type**: Fix (changesNumbers: YES — D-21 conditions honoured, expected movements written first)
- **Scope**: the D-12 accountant pack (MON-168 / MON-169 / MON-170) — M3 PR-1 per `BRIEF_M3_PACK_AND_SCOREBOARD.md` §A
- **Root Cause**: (1) 17 link-write sites set `incomeId/expenseId/loanId` on UnifiedTransaction and none stamped `propertyId` — the pack's per-property P&L keys solely on it (`summary.ts:151`); (2) `isTransfer` never consulted in `buildTaxPackSummary`; (3) label-path `continue`s dropped 97.9% of rows with no counter (Ring-3 verdict on #1595).
- **Solution**: ONE resolver `lib/bookkeeping/propertyLink.ts` used by every write path + clears on unlink/transfer/investment + PATCH derive; admin backfill (dry-run default, §12.11, idempotent); summary rewritten property-scoped with counted exclusion buckets and the HARD-ASSERTED identity `included + Σexcluded = total`, printed in XLSX/PDF; mapping N+1 removed; uncategorised rows point at Housekeeping.

### Files Modified
- `lib/bookkeeping/propertyLink.ts` — NEW: the ONE link→property attribution rule (+ batch variant)
- `app/api/transactions/[id]/link/route.ts` — 12 stamps + 5 clears
- `lib/bookkeeping/loanLedger/matchRepayments.ts`, `lib/bookkeeping/receiptMatcher.ts`, `app/api/bank/import/route.ts`, `app/api/documents/analyze/confirm/route.ts` — stamps
- `lib/intake/duplicateMerge.ts` + `app/api/intake/duplicates/route.ts` — the 17th site (caught by the new guard test): survivor repoint re-stamps
- `app/api/unified-transactions/[id]/route.ts` — PATCH derives when a link id is set without an explicit propertyId
- `app/api/admin/maintenance/backfill-transaction-property/route.ts` — NEW: dry-run-default backfill
- `lib/bookkeeping/taxPack/summary.ts` — property-scoped classification + reconciliation + identity asserts (bucket helper deliberately inlined; `labelCoverage` renamed `atoLabelling` — census phantom, see ledger)
- `lib/bookkeeping/taxPack/xlsxExporter.ts` / `pdfExporter.ts` — reconciliation rendered, identity line printed
- `tests/bookkeeping/mon168PropertyStampGuard.test.ts` (Ring-1 guard) + `tests/bookkeeping/mon169170PackReconciliation.test.ts` (Ring-0 worked example, 5 tests)
- `docs/verification/briefs/RING3_M3_PACK_FIX.md` — NEW handout (P0–P7 + mustNotMove), written BEFORE fix code
- Registry (168/169/170 → DIAGNOSED → FIXING), Neomatrix (6 new nodes/edges — the D-12 pack modelled), ledger §6 row, master plan cursor/§5/§9

### Build Status
- [x] TypeScript clean · [x] bookkeeping suite 323 green (incl. the two new files) · [x] `lint:source-lock` ✓ · [x] `lint:financial-surfaces` ✓ · [x] `census:producers:check` ✓ (phantom fixed by inlining, never reseeded) · [x] `neomatrix:check` ✓ (0 uncovered) · [x] `issues:check` ✓ (166 valid)
