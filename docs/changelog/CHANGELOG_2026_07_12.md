# Changelog — 2026-07-12

## Session: chat-audit-findings-issues-m9518i

### Change: NeoAudit "Audit account" picker — run Ring-3 self-audit on any user

- **Type**: Feature
- **Scope**: NeoAudit R3-self (admin panel + endpoints)
- **Why**: The self-audit panel (`/admin/neoaudit`) was hard-wired to
  `getMasterFinancialSnapshot(auth.userId)` — it could only ever audit the
  logged-in admin account, which holds empty test data ($3.9M net worth, $0
  liabilities, 3 properties with $0 mortgages). Reza couldn't point Ring-3 at a
  real account. The advisories (shipped 2026-07-12) correctly flagged the admin
  account as test data — this change lets him select a real one.
- **Solution**:
  - Extracted the invariant + advisory computation into ONE shared
    `lib/verification/selfAuditInvariants.ts` (`computeSelfAuditReport`), so the
    self endpoint and the new admin endpoint run identical logic (§12.2.1/§12.3
    — no second producer).
  - New admin endpoint `GET /api/admin/neoaudit?userId=…`, gated exactly like
    the existing user-detail endpoint (`isAdminPortalAccessible` +
    `verifyAdminGCPAuth` + `hasPermission(role, 'users:read')`), audit-logged
    via `adminAuditLog` (action `NEOAUDIT_RUN`; metadata carries only the
    PASS/FAIL shape — no dollar figure, §13.2/§13.3).
  - Panel gains an "Audit account" picker (fed by `/api/admin/users`): default
    "My account (self)" → the self endpoint; a selected user → the admin
    endpoint. "Auditing account:" shows the selected email.
- **CDR (§13)**: no posture expansion — reuses the same admin-data-access path
  already used to view a user's financials in the portal; returns aggregates +
  accounting identities only (net worth, totals, per-property equity), never raw
  transactions/BSBs; every run audit-logged.

### Files Modified / Added
- `lib/verification/selfAuditInvariants.ts` — **new**; the ONE shared invariant + advisory computation.
- `app/api/verify/invariants/route.ts` — refactored to a thin wrapper on the shared function.
- `app/api/admin/neoaudit/route.ts` — **new**; admin-gated, audit-logged, targeted audit.
- `components/admin/neoaudit/NeoAuditPanel.tsx` — "Audit account" picker; self vs admin endpoint routing.
- `tests/verification/selfAuditInvariants.test.ts` — source locks updated for the split; adds admin-endpoint gating + audit-log locks.
- `docs/blueprint/NEOAUDIT.md` — R3-self node + build-plan step 2 document the admin variant.
- `docs/financial-logic/graph/structural/structural-graph.json` — Layer-0 census registers the two new files.
- `.audit/financial-math-exceptions.json` — regenerated (the 4 annotated identity assertions moved route→lib).

### Build Status
- [x] `npm run neomatrix:check` — census gate 0 uncovered, invariants hold, markdown fresh
- [x] `npm run lint:financial-surfaces` — 0 new violations (4 annotated exceptions carried across the move)
- [x] Source-lock literals pre-verified against the actual files
- [ ] TypeScript / vitest — CI (local tsc/vitest unavailable; verified by CI + Vercel build)

### Verification note (§19.4/§23)
No financial number changed — this is a new READ surface over the existing
canonical snapshot. The invariant maths is unchanged (moved verbatim into the
shared lib); the same computation now runs against a selectable user. Ring-3
real-data confirmation is Reza selecting his real account in the panel.

---

## Session: chat-audit-findings-issues-m9518i (continued) — Ring 2 service-tier

### Change: NeoAudit Ring 2 — Golden Household end-to-end through the REAL master service

- **Type**: Test infrastructure (Ring 2 of the Part-23 four-ring defense)
- **Scope**: `tests/golden/` — no production code changed
- **Why**: Rings 0/1 verify engines and wiring; nothing verified the full
  fetch → map → engine → snapshot ASSEMBLY on known data. The MON-028 class
  (a select silently dropping a field, a mapping feeding an engine partial
  inputs) lives exactly there.
- **Solution**:
  - `tests/golden/goldenHousehold.ts` — the Golden Household "Avalon": fixture
    rows shaped exactly like `fetchAllUserData`'s Prisma selects, every headline
    number hand-computed (§19.2) with derivations documented in the header.
    Deliberate constraints: NET salary (GROSS would route through the full
    PAYG tables — Ring 0's job), no transactions (declared basis), amounts
    chosen for exact conversions (600/wk = 2,600/mo).
  - `tests/golden/ring2.masterSnapshot.test.ts` — mocks `@/lib/db` with a Proxy
    that THROWS on any model the golden DB doesn't serve (a new query in the
    service fails loudly), runs the REAL `getMasterFinancialSnapshot`, and
    asserts the manifest: net-worth assembly (SMSF + SOLD exclusions), declared
    cashflow + savings rate 50.96, MON-009 rental dedup, emergency fund,
    per-property equity/LVR/yield/cashflow, quickMetrics mirrors, the
    MON-028-class INPUT-PARITY check (engine run directly on golden inputs ==
    snapshot), and the Ring-3 tie (computeSelfAuditReport ALL PASS).
  - Two NEGATIVE CONTROLS prove the harness can fail: dropping the loan from
    the engine inputs breaks parity; zeroing liabilities fails the report (I1).

### Verified locally (vitest now runs in-container)
- `tests/golden/ring2.masterSnapshot.test.ts` — **16/16 pass**
- Full `tests/golden` + `tests/verification` — **74/74 pass**
- `npm run neomatrix:check` + `lint:financial-surfaces` — green (tests/ not census-scoped)

### Observation (flagged, not fixed here)
- Running the tax engine logs "Tax config not found for 2026-27, using latest
  available (2025-26)" — FY 2026-27 began 1 Jul 2026; the engine falls back to
  2025-26 rates (per the Phase 41E commencement gating this is by design until
  rates are verified, but worth Reza's awareness that FY26-27 config is absent).

### Addendum: Ring 2 route-tier (same PR)
- `tests/golden/ring2.propertyRoute.test.ts` — invokes the ACTUAL
  `GET /api/properties/[id]` handler (the MON-028 type specimen) in-process on
  the golden household. Real: handler body, `verifyOwnership`,
  `enrichPropertiesWithActuals` (prisma reads served by the golden DB),
  NextResponse serialization. Mocked (honest scope): `withPermission` injects
  the golden user (token verification is Ring-1/unit territory); `@/lib/db`
  `findUnique` honours `where.id` so the 404/ownership path stays live.
  Asserts: `linkedTransactions` PRESENT in the serialized JSON (the exact
  MON-028 dropped-field regression), relations survive serialization with the
  fields the page's engine needs, page-level parity (serialized payload →
  `computePropertyCashflow` reproduces the manifest numbers), unknown id → 404.
- Local run: 4/4; full golden+verification suites 78/78.

### Addendum 2: safety-net route + shared golden-DB helper (same PR)
- `tests/golden/goldenHousehold.ts` — exported `createGoldenDb()` (the ONE
  Proxy mock both service- and route-tier tests use; throws on un-served
  models; `findUnique` honours `where.id`); added `recurringPayment: []`
  (zero tracked bills) + the hand-computed `EXPECTED.safetyNet` block:
  EF 40 + bills 0 + noNewDebt 15 + cashflow 15 = **70 BUILDING**.
- `tests/golden/ring2.safetyNetRoute.test.ts` — the ACTUAL `GET /api/safety-net`
  (the MON-017 surface) invoked in-process: runs the real
  getMasterFinancialSnapshot → emergencyFund block → getCanonicalMonthlyCashflow
  → computeSafetyScore chain and asserts the serialized JSON: EF figures,
  monthsCovered 29.4, gap 0, monthlySurplus 5,300, and safety score exactly
  70/BUILDING (zero tracked bills scores 0, not full marks).
- `ring2.masterSnapshot.test.ts` refactored onto the shared helper (§12.8).
- Local run: full golden + verification suites **80/80**.

---

## Session: chat-audit-findings-issues-m9518i (continued) — MON-031 liquid-savings relabel

### Change: Balances "Liquid today" now declares it is net of credit cards (MON-031, Reza decision option a)

- **Type**: Fix (copy/UX — no number changes)
- **Scope**: `components/balances/HiddenWealthLens.tsx`
- **Decision**: Reza chose option (a) 2026-07-12 — the two figures stay as the
  distinct measures they are (My Safety Net "Liquid savings" = GROSS cash /
  emergency buffer; Balances "Liquid today" = cash NET of credit cards), and we
  make that legible rather than forcing one number.
- **Root cause (verified, not a math bug)**: Safety Net renders
  `quickMetrics.liquidCash` (gross, $304,304); Balances renders
  `accessibilityBuckets.liquidToday = liquidBasis − creditCards` ($301,808). The
  $2,496 gap IS the credit-card balance — both figures are correct for their
  purpose; only the near-identical framing caused confusion.
- **Fix**: the "Liquid today" bucket's micro-copy is now cards-aware — when a
  card balance is netted, it reads "Reachable today, after your credit cards."
  (`breakdown.creditCards` is already threaded to the component). No number
  moves; `changesNumbers: false`.

### Files Modified
- `components/balances/HiddenWealthLens.tsx` — cards-aware liquid micro-copy.
- `tests/balances/hiddenWealthLensCopy.test.ts` — **new**; source-lock so a
  future edit can't silently drop the clarification.

### Build Status
- [x] `tests/balances/hiddenWealthLensCopy.test.ts` — 2/2 pass locally
- [x] No financial number changed (copy only) — §19.4 propagation test N/A

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit P-A: Release Scorecard

### Change: NeoAudit Release Scorecard in the admin panel (NEOAUDIT.md §6, publish gate)

- **Type**: Feature (NeoAudit platform — phase P-A of the completion workstream)
- **Why**: The panel showed only "invariants ALL PASS" — necessary but not the
  publish verdict. The Scorecard aggregates the publish-readiness signals the
  app can self-verify and honestly names the ones it can't.
- **Solution**:
  - `lib/verification/scorecard.ts` (new) — pure `summarizeScorecard(issues)`:
    counts number-changing issues NOT yet VERIFIED/CLOSED (each = an unverified
    user number = a publish blocker, §19.5), plus total-open context, plus the
    named external checks (Rings 0–2 on CI, Stryker) it does NOT claim in-app
    (§22.2.4 — gate output, never a bare "safe to publish").
  - `app/api/admin/neoaudit/scorecard/route.ts` (new) — admin-gated (`audit:read`,
    same posture as the Neomatrix graph route); imports `ISSUES.json` (bundled at
    build, resolves on serverless — same pattern as `/api/admin/neomatrix/graph`);
    returns the summary.
  - `NeoAuditPanel.tsx` — a "Release scorecard — publish gate" band: this
    account's invariants (PASS/FAIL) + open number-issues (ZERO / N, listed),
    green only when BOTH in-app signals are clean, with the "also verify on CI"
    footnote. Never a bare "safe to publish".

### Files
- `lib/verification/scorecard.ts`, `tests/verification/scorecard.test.ts` (4/4 local)
- `app/api/admin/neoaudit/scorecard/route.ts`
- `components/admin/neoaudit/NeoAuditPanel.tsx`
- `docs/financial-logic/graph/structural/structural-graph.json` — 2 new files registered

### Build Status
- [x] `tests/verification/scorecard.test.ts` 4/4 · full golden+verification 84/84 local
- [x] `neomatrix:check` census 0 uncovered · `lint:financial-surfaces` 0 new · plan-freshness + issues gates green
- [x] No financial number changed (a new READ/aggregation surface)

---

## Session: chat-audit-findings-issues-m9518i (continued) — CLAUDE.md §20.6 pre-PR gate

### Change: §20.6 — the mandatory 10/10 pre-PR gate (Document + Requirements + Logic) + skill enforcement

- **Type**: Governance (CLAUDE.md rule + skill enforcement)
- **Why**: Reza directives 2026-07-12 — "review every change against design documents
  yourself, 10/10 for document/requirements/logic, no PR without the 10/10 check" +
  "always consult neomatrix, claude.md, strict SSOT" + "I can't keep repeating these —
  tell me where to add so you ALWAYS follow." Honest trigger: this session drifted from
  the documented NEOAUDIT §8 build order and over-claimed coverage — the rules were
  ALREADY in CLAUDE.md; the failure was not CHECKING them before shipping.
- **Solution**:
  - `CLAUDE.md §20.6` (new) — the ONE consolidated pre-PR gate: self-score /10 on
    DOCUMENT (re-read the design doc, conform to plan+sequence, Neomatrix consulted),
    REQUIREMENTS (exactly asked, verified to source), LOGIC (correct + strict SSOT +
    §19.2/§19.4). All three must be an honest 10/10 or STOP. Coverage stated as
    "verifies X, does NOT verify Y" — never "tested/complete". Recorded verbatim in
    every PR body.
  - `.claude/skills/pr-prep-checklist/SKILL.md` — Step 8.5 (HARD BLOCK) + a stop
    condition + trivial-PR shortcut carve-out, so the skill (which auto-fires on every
    PR cue) refuses to open a PR without the recorded §20.6 gate. Points at CLAUDE.md,
    does not duplicate the rule.
  - `CLAUDE.md` Part 9 post-change checklist line + version footer → 3.5.

### Files Modified
- `CLAUDE.md` — §20.6 + Part 9 checklist line + footer 3.5.
- `.claude/skills/pr-prep-checklist/SKILL.md` — Step 8.5 hard block + stop condition + shortcut note.

### Gate (§20.6) — dogfooded on its own introduction
- Document 10/10 (CLAUDE.md Part 20 self-review family + the pr-prep-checklist skill — §20.6 extends §20.4/§20.5 without contradiction; skill references, never duplicates).
- Requirements 10/10 (adds the tri-axis 10/10 gate + consolidates Neomatrix/SSOT/doc-conformance + names CLAUDE.md as the single canonical home + wires the skill for the "always" enforcement Reza asked for).
- Logic 10/10 (internally consistent, no SSOT violation — one canonical home; binds even under the §20.5 autonomy grant). Coverage boundary: verified by re-reading that the rule integrates without contradiction; NOT verified by any automated test (governance prose has none) — its real proof is future PRs carrying the §20.6 line.

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit §8 step-3: portfolio-snapshot Ring-2 route + harness include support

### Change: golden-harness `include` support + `GET /api/portfolio/snapshot` Ring-2 route test (MON-013/014 convergence lock)

- **Type**: Test infrastructure (NeoAudit Ring 2, §8 step-3 backlog) — no production code changed
- **Why (§8, a-order)**: the step-3 backlog's portfolio-snapshot route uses deep
  nested Prisma `include` queries; the golden harness was built for the master
  service's flat `select` shape, so the route 500'd at `route.ts:782`
  (`property.depreciationSchedules.length` on undefined). The harness FAILED
  LOUDLY (as designed) rather than fake a green — surfacing that it needed
  include support.
- **Solution**:
  - `tests/golden/goldenHousehold.ts` — `createGoldenDb` now resolves `include`
    via an explicit `INCLUDE_KINDS` map: each relation served EMPTY (`[]`/`null`)
    per its declared kind, THROWS on any unmapped relation (same fail-loud
    discipline as the model-level Proxy). Deliberately NO FK-resolver — a mock
    mini-ORM could itself be buggy and produce a FALSE green, the worst outcome
    for an audit tool. Added `investmentTransaction: []` to the golden book.
  - `tests/golden/ring2.portfolioSnapshotRoute.test.ts` (new) — the ACTUAL
    portfolio-snapshot route on the golden household, asserting netWorth 472,000
    / totalAssets 992,000 / totalLiabilities 520,000 == the master manifest
    (locks the MON-013/014 cross-surface convergence onto `calculateNetWorth`).

### Verified locally
- `ring2.portfolioSnapshotRoute.test.ts` — 3/3 pass
- Full `tests/golden` + `tests/verification` — **87/87 pass** (12 files; the
  `findMany` signature change is backward-compatible — no `include` arg → row
  unchanged, so no existing Ring-2 test regressed).

### Gate (§20.6)
- Document 10/10 (NEOAUDIT §8 step-3 backlog — enabling harness infra + the named route test; no plan deviation).
- Requirements 10/10 (locks MON-013/014 convergence; minimal include-support, empty-relations chosen over a risky FK-resolver, rationale documented).
- Logic 10/10 (empty-relations + fail-loud, no FK magic; netWorth computed from top-level arrays so the assertion is correct; 87/87 regression-clean).
- **Coverage boundary (honest):** verifies the route's HEADLINE net-worth/assets/liabilities agree with master; does NOT verify the SnapshotV2 GRDCS `_links`/`_meta` layer (nested includes served empty). Local tsc via CI + Vercel build.

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit §8 step-3: cashflow Ring-2 route

### Change: `GET /api/cashflow` Ring-2 route test (lite exact + full-mode invariants)

- **Type**: Test infrastructure (NeoAudit Ring 2, §8 step-3 backlog) — no production code changed
- **Why (§8, a-order)**: completes the step-3 route backlog (after portfolio-snapshot).
  The /cashflow page is the MON-020/021/027/029 surface.
- **Solution**:
  - `tests/golden/ring2.cashflowRoute.test.ts` (new) — the ACTUAL route at two
    honest rigor levels: LITE mode summary asserted EXACTLY (hand-computed);
    FULL mode runs the real CFE→COE pipeline end-to-end and asserts it EXECUTES
    on golden data (crash/plumbing class) + the net = income − expenses identity
    + all-finite (no NaN projection leak). Does NOT assert exact projection
    values — the day-by-day forecast is not hand-computable (§19.2).
  - `tests/golden/goldenHousehold.ts` — added `spendingProfile: []` (full-mode
    COE reads it via findUnique → null → declared branch) + `EXPECTED.cashflowLite`
    with the derivations.

### Verified locally
- `ring2.cashflowRoute.test.ts` — 4/4 pass
- Full `tests/golden` + `tests/verification` — **91/91 pass** (13 files; no regression).

### Gate (§20.6)
- Document 10/10 (NEOAUDIT §8 step-3, on-plan, no deviation).
- Requirements 10/10 (completes step-3 route backlog; lite exact + full invariants, no gold-plating).
- Logic 10/10 (lite values hand-computed exact; full mode asserts execute+identity+finite; 91/91 regression-clean).
- **Coverage boundary (honest):** LITE summary verified EXACTLY; FULL mode verified as executes end-to-end + accounting identity + all-finite, NOT exact day-by-day projection values. Local tsc via CI + Vercel build.

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit §8 step-4: parity-matrix generator

### Change: the §5 parity matrix — generated-from-graph R2 value-parity + coverage ratchet

- **Type**: Test infrastructure (NeoAudit Ring 2, §8 step-4) — no production code changed
- **Why (§8, a-order)**: step-4 on the documented plan; the parity matrix is the
  generated cross-surface value check the §5 spec calls for.
- **Solution**:
  - `tests/golden/parityMatrix.ts` (new) — generator + resolver registry. Reads
    `financial-graph.json` `rendered-at` edges, groups surfaces by semanticKey,
    exposes `SURFACE_RESOLVERS` (faithful golden extractors) + `KNOWN_UNRESOLVED`
    (tracked growth deferrals, each with a reason + plan item).
  - `tests/golden/parityMatrix.test.ts` (new) — (1) COVERAGE RATCHET: every
    `rendered-at` surface must be resolved OR tracked, else FAIL (the growth
    mechanism); (2) VALUE PARITY: same-key surfaces with resolvers must produce
    the same value on golden data (load-bearing group `propertyCashflow`: route
    path vs master path independently = −$400, the MON-028 class); (3) MANIFEST
    TIE: resolved values equal the §19.2 hand-computed truth; + negative controls
    (orphan surface caught, value drift detected).
- **Distinct from R1 (non-overlap §1.2)**: `neomatrix:check` A3b owns *structural*
  convergence (same-key → same engine); the parity matrix owns *value* parity
  (same number, equal value end-to-end on golden data). No duplication.

### Coverage-growth gaps discovered + added to the plan (Reza directive 2026-07-12)
- `netWorthTrend` surfaces need historical-snapshot golden fixtures (golden book
  is single-point-in-time).
- `ui.safetyNet.safetyScore` + `ui.balances.hiddenWealth` are engine-fed and
  carry NO semanticKey → can't join key-based parity groups until number nodes
  (with semanticKeys) are modelled (§21.2 Neomatrix backfill).
- Both recorded in NEOAUDIT.md §8 step-4 "coverage-growth queue".

### Verified locally
- `parityMatrix.test.ts` — 11/11 pass; coverage readout printed:
  `surfaces 8/18 resolved · 10 tracked-pending · 1 multi-surface parity group asserted: propertyCashflow`
- Full `tests/golden` + `tests/verification` — **102/102 pass** (14 files; no regression).
- `npm run neomatrix:check` — passes (graph unchanged).

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §8 step-4 + §5 spec; on-plan, no sequence deviation; A3b non-overlap confirmed; Neomatrix consulted for topology).
- Requirements 10/10 (generated-from-graph parity + coverage ratchet exactly as §5 asks; no gold-plating).
- Logic 10/10 (strict SSOT — reads the ONE graph; faithful independent paths for the load-bearing group; negative controls prove the harness fails; 102/102 regression-clean).
- **Coverage boundary (honest — §22.2.4):** verifies value-parity + manifest-tie for the 8 RESOLVED surfaces (1 real multi-surface group); does NOT verify the 10 KNOWN_UNRESOLVED surfaces (each a printed, tracked growth item), the rendered PAGE pixels (R2-vis, deferred), or real user data (R3). Local tsc via CI + Vercel build.

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit §8 step-5 (slice 1): CFO EF decision table

### Change: emergency-fund recommendation decision table (§3 given→then)

- **Type**: Test infrastructure (NeoAudit §3 decision tables, §8 step-5 slice 1) — no production code changed
- **Why (§8, a-order)**: step-5 opens with the CFO decision-table layer; the EF
  recommendation rule had no given→then fixtures.
- **Solution**:
  - `tests/cfo/actionEngineDecisionTable.test.ts` (new) — locks the EF rule of
    `generateActions` (verified in source §19.2): buffer <30 → present/high/do_now/FIRST;
    30–49 → present/medium/upcoming; 50–59 → NO rec (rule gates at <50 though
    findWeakAreas flags <60 — the honest edge); ≥60 → none; + monotonic-urgency
    guard. Driven through the real engine with an EMPTY db (isolates the rule).
- **Non-overlap (§1.2 / §12.2.1 discovery)**: the REFINANCE decision rule is
  ALREADY fixtured in `loanDecisionSupportGuards.test.ts` (MON-019) — NOT
  re-tested. Re-fixturing it would be the duplication §1.2 forbids.

### Discoveries added to the plan (Reza directive — keep NeoAudit growing)
- "negative cashflow ⇒ no positive-cashflow credit" (§3 example) not yet located
  in source → decision-table queue item (verify §19.2 before fixturing; MON if a
  real gap). NOT fabricated as a test.
- "EF FIRST" as a hard universal guarantee isn't enforced by the engine (only when
  EF is the pressing weakness) → prioritisation-change + MON if §3 wants it hard.
- Report reconciliation needs the report generators inspected (no expense/loan
  line structure on the master service) → next step-5 slice.
- MON-030 (score dedup, changesNumbers) → its own carefully-verified step-5 PR.
- All recorded in NEOAUDIT.md §8 step-5 decision-table queue.

### Verified locally
- `actionEngineDecisionTable.test.ts` — 5/5 pass.
- `tests/cfo` + `tests/golden` + `tests/verification` — **382/382 pass** (25 files; no regression).

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §8 step-5 + §3; on-plan; §1.2 non-overlap confirmed by reading the existing refinance guards; the rule read in source not memory).
- Requirements 10/10 (fixtures the unfixtured EF rule as given→then; reuses refinance rather than duplicating; no gold-plating).
- Logic 10/10 (each row hand-verified against actionEngine.ts source §19.2; empty-db isolates the rule; monotonic guard; 382/382 clean).
- **Coverage boundary (honest — §22.2.4):** verifies the EF rule's presence/severity/priority/first-ness AS THE ENGINE COMPUTES them on controlled score inputs with an empty db; does NOT verify the score components themselves (MON-030), the rendered CFO page (R2-vis), real data (R3), or the not-yet-located negative-cashflow rule. Local tsc via CI + Vercel build.

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit §8 step-5 (slice 2): report reconciliation locks → caught & fixed MON-034

### Change: report reconciliation locks + FIX for MON-034 (ANNUAL frequency 12× over-count)

- **Type**: FINANCIAL FIX (number-changing) + test infrastructure (NeoAudit §3, §8 step-5 slice 2)
- **What was wrong (plain English)**: In reports, anything entered at a YEARLY
  frequency (e.g. a $2,400/yr insurance premium) was counted as if it were
  $2,400 per MONTH → shown as $28,800/yr. On the golden household this inflated
  total annual expenses from $20,400 to $46,800; on the Tax report it would
  over-state deductions (and understate taxable income) for any yearly deductible
  expense.
- **What changed (plain English)**: The report builder had its OWN copy of the
  frequency→annual conversion with no `ANNUAL` case (only `ANNUALLY`/`YEARLY`), so
  the real Prisma enum value `ANNUAL` fell to `default: ×12`. Replaced it with the
  app's single canonical converter (`toAnnual`) and DELETED the buggy copy
  (§12.2.1 remove-the-culprit — not a patch on top).
- **What you'll see (plain English)**: Income & Expense report and Tax report — a
  yearly expense now shows its real yearly amount ($2,400, not $28,800), total
  annual expenses tie to your dashboard, Tax deductions reflect the true figure.

### How it was found
- The NeoAudit §3 report-reconciliation lock (`tests/golden/ring2.reportReconciliation.test.ts`),
  on its FIRST run, failed the cross-source assertion (report 46,800 ≠ canonical
  master 20,400). Root-caused (§19.2) to the missing `ANNUAL` enum case, not
  guessed. This is the reconciliation layer working as designed.

### §19 evidence
- **Input/units**: `Expense.frequency` = Prisma enum (WEEKLY/FORTNIGHTLY/MONTHLY/QUARTERLY/ANNUAL/HALF_YEARLY); `amount` = per-period dollars.
- **Law**: annual = per-period × periods/yr; ANNUAL → ×1. Canonical `toAnnual` (lib/utils/frequencies.ts).
- **Worked example**: insurance $2,400 ANNUAL → $2,400/yr (was $28,800 = 2,400×12). Golden total expenses 20,400 (was 46,800).
- **Downstream sweep (§19.4)**: only 2 callers (`fetchIncomeData`/`fetchExpenseData`); consumers = `incomeExpense.ts` + `taxTime.ts` (deductibleExpenses→totalDeductions→netTaxableIncome). One-source fix corrects both. Locked by the reconciliation test (income-expense end-to-end) + a focused tax-time deduction test w/ negative control.

### Files
- `lib/reports/contextBuilder.ts` — use canonical `toAnnual`; deleted buggy `calculateAnnualAmount` (dead code, §12.1).
- `tests/golden/ring2.reportReconciliation.test.ts` (new) — internal + cross-source locks + MON-034 root-cause lock + tax-time downstream lock.
- `tests/golden/goldenHousehold.ts` — harness grew: `.count()` support + `depreciationSchedule: []`.
- `docs/issues/ISSUES.json` / `ISSUES.md` — **MON-034** (FIXING, changesNumbers, downstream sweep, plain trio, holistic test linked).
- `docs/financial-logic/graph/*` — anchor `buildReportContext` 32→34 (§21.2.1 zero-drift after the contextBuilder edit) + regenerated GENERATED_CORE.md.

### Verified locally
- `ring2.reportReconciliation.test.ts` — 8/8 pass.
- `tests/reports + golden + issues + verification + cfo` — **406/406 pass** (28 files; no regression).
- `npm run issues:check` — 34 issues valid (MON-034 valid at FIXING).
- `npm run neomatrix:check` — passes (anchor fixed). `lint:financial-surfaces` — passes.

### Gate (§20.6) — FINANCIAL build, recorded 10/10 (§20.4)
- Document 10/10 (doc: NEOAUDIT §8 step-5 + §3; on-plan; §12.2.1 SSOT; §21.2.1 anchor fixed same-PR; §19.5 registry).
- Requirements 10/10 (report reconciliation as §3 asks; the fix removes the culprit per Part 23, not a patch; no gold-plating).
- Logic 10/10 (root cause verified in source §19.2; canonical toAnnual only changes ANNUAL — no regression on other frequencies; downstream sweep locked; 406/406 clean).
- **Coverage boundary (honest — §22.2.4):** verifies the income/expense report's line totals reconcile internally AND tie to canonical master annual figures on golden data (declared basis), and the tax-time report's deduction inherits the fix (focused test + negative control). Does NOT verify the OTHER report generators (property/loan/investment — each a future lock), the rendered/exported PDF/XLSX (R2-vis), or real data (R3). **MON-034 stays FIXING — Reza verifies on live data.** semanticKeys empty: report annual figures aren't modelled in the Neomatrix yet (§21.5/§21.2 backfill gap noted in MON-034).

---

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit §8 step-5 (MON-030 stage 1): canonical buildHealthInput

### Change: extract the ONE canonical `buildHealthInput` (§12.2.1 dedup) — PURE REFACTOR, no number change

- **Type**: Refactor (SSOT dedup) — MON-030 stage 1 (prep for the number-changing stage 2)
- **Why**: `buildHealthInput` was duplicated VERBATIM in `app/api/financial-health/route.ts:50`
  AND `app/api/dashboard/insights/route.ts:699` — two copies of the health-engine
  input builder feeding two surfaces (Home health tile + financial-health API).
  §12.2.1: one datum/assembler = ONE source.
- **Verification it's a pure refactor (§19.2, read both copies line-by-line)**: identical
  output. The ONLY difference — financial-health's `totalEntities` also added
  `investmentAccounts.length` (insights didn't) — feeds ONLY `consistencyScore`'s
  `totalEntities > 0` gate, which is identical in every case (any user with holdings →
  gate true; fully-empty → both yield 100). No divergence on any valuation, include,
  reduction, or field mapping. `getNetMonthlyIncome` helper was also byte-identical.
- **Solution**: new `lib/health/buildHealthInput.ts` (exported via the `@/lib/health`
  barrel); both routes import it and their local copies (+ the duplicated
  `getNetMonthlyIncome`) deleted. Dropped now-unused imports (`calculateTakeHomePay`,
  the health type imports, a pre-existing unused `scoreToRiskBand` in insights).

### Files
- `lib/health/buildHealthInput.ts` (new) — canonical builder + `getNetMonthlyIncome`.
- `lib/health/index.ts` — export the new module.
- `app/api/financial-health/route.ts` — import canonical; delete local copy (−~211 lines).
- `app/api/dashboard/insights/route.ts` — import canonical; delete local copy (−~156 lines).
- `tests/golden/ring2.healthInput.test.ts` (new) — the dedup lock + regression baseline.
- `docs/financial-logic/graph/*` — anchor `orchestrator.dashboardInsights.GET` 188→187 (§21.2.1 zero-drift after the route edit); `structural/coverage-allowlist.json` += buildHealthInput.ts (offline graphify unavailable in-session — self-prunes on next graphify run); regenerated GENERATED_CORE.md.

### Discovered (future MON — NOT this scope)
- `buildHealthInput` values investments at COST (units×averagePrice = 4,000 on golden)
  not MARKET (7,000), and its net-worth scope EXCLUDES super + personal assets — a
  SECOND net-worth basis distinct from canonical `calculateNetWorth`. Flagged in the
  file header + NEOAUDIT §8 step-5 for a follow-up; deliberately preserved verbatim so
  this extraction changes nothing.

### Verified locally
- `ring2.healthInput.test.ts` — 4/4 (builder assembles golden input: 854,000 assets /
  334,000 net worth / 520,000 liabilities; `generateHealthReport`==`quickHealthCheck`
  score **72**, locked as the pre-stage-2 baseline).
- `tests/golden + verification + cfo + issues + reports` — **410/410 pass** (no regression).
- `npm run neomatrix:check` — passes (anchor fixed, file allowlisted). `issues:check` — 34 valid. `lint:financial-surfaces` — passes.

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §8 step-5; on-plan; §12.2.1 SSOT; §21.2.1 anchor fixed same-PR; Neomatrix consulted via the mapping of both copies).
- Requirements 10/10 (extracts the ONE canonical builder as MON-030 stage 1; no gold-plating; no behaviour change).
- Logic 10/10 (both copies verified line-by-line equivalent in SOURCE §19.2 before consolidation; the sole totalEntities difference proven inert; 410/410 clean).
- **Coverage boundary (honest — §22.2.4):** verifies the ONE builder assembles the golden input and both engine entry points agree on the score, on golden data. Does NOT hand-derive the health score (engine category-test territory — the 72 is a locked regression baseline, not a §19.2 worked example), does NOT verify the rendered pages (R2-vis), and does NOT change any user-facing number (that is MON-030 stage 2). MON-030 stays DIAGNOSED — stage 2 is the number-changing fix.

---

## Session: chat-audit-findings-issues-m9518i (continued) — §8 step-5: negative-cashflow decision-table item VERIFIED (no new engine)

### Change: verified the "negative cashflow ⇒ no positive-cashflow credit" rule + closed its boundary micro-gap

- **Type**: Test completion + verification (NeoAudit §3 decision-table queue) — no production code changed
- **Finding (§19.2, read-only verification)**: the §3 example rule EXISTS in
  `lib/calculations/safetyScore.ts:75` (MON-017): `cf > 0 ? 15 : cf > -200 ? 8 : 0`.
  It is a SCORING sanity ("no full marks on the positive-cashflow dimension for a
  real deficit"), NOT a recommendation guard — matching VR-001's phrasing.
- **§12.2.1 (same pattern as refinance)**: the rule is ALREADY FULLY FIXTURED —
  all three tiers (0/8/15) in `tests/calculations/safetyScore.test.ts` + the
  extremes in `tests/verification/vr001Ratchet.test.ts`. NOT re-tested (duplicating
  an existing rule's table is the §1.2 violation this forbids).
- **The one micro-gap closed**: the exact tier BOUNDARIES (cf=0 → 8 [break-even is
  NOT positive]; cf=−200 → 0 [band edge]) weren't pinned. Added a 4-assertion
  boundary row to the existing test (extending, not a parallel file). Correct-by-
  design — no bug, no MON.

### Files
- `tests/calculations/safetyScore.test.ts` — +1 boundary `it` (10/10 pass).
- `docs/blueprint/NEOAUDIT.md:§8 step-5` — negative-cashflow queue item marked resolved.

### Verified locally
- `tests/calculations/safetyScore.test.ts` — 10/10 pass.

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §8 step-5; on-plan; §12.2.1 non-overlap confirmed by reading the existing fixtures).
- Requirements 10/10 (verified the rule exists per §19.2; closed ONLY the untested boundaries — did NOT duplicate the covered tiers or fabricate a rule; no gold-plating beyond the boundary completion).
- Logic 10/10 (boundaries verified by running the engine: cf=0→8, cf=−200→0; 10/10 clean).
- **Coverage boundary (honest — §22.2.4):** completes the tier-boundary coverage of the safety-score positive-cashflow dimension; the tiers themselves were already covered. Does NOT add a new rule or engine. This resolves the queued §3 item — the rule was correct + covered, only its boundaries were unpinned.
