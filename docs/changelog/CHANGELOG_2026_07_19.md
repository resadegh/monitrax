# Changelog - 2026-07-19

## Session: yhm8ug (continuation) — MON-031/064 VR-017 re-fix

### Changes Made
- **Type**: Fix (financial correctness — liquidity SSOT)
- **Scope**: liquid-cash producer, emergency fund, CFO emergency-buffer signal
- **Root Cause** (§19.2, executed — corrects the VR-017 hypothesis): #1452 netted `quickMetrics.liquidCash` by subtracting `netWorth.liabilities.creditCards`, which `calculateTotalLiabilities` (`lib/calculations/netWorthCalculator.ts:219`) builds from **LOANS only**. The live Qantas card is a **CREDIT_CARD-typed ACCOUNT** with a −$2,496 balance (VR-007 capture:483), so the subtraction was silently **0** and the canonical figure stayed gross ($304,304) — Safety Net "Liquid savings" and the emergency months (304,304 ÷ 25,973 = 11.7) read it faithfully. Balances' $301,808 was an accident of the buckets' `min(gross, assets.accounts)` (the negative account balance is embedded in `assets.accounts`), which also explains VR-010's inert cards-aware caption. The golden passed because its fixture modelled the card as a **Loan** — F2 (same engine, different inputs) at the fixture level.
- **Solution**: ONE canonical producer `lib/calculations/liquidCash.ts` → `computeLiquidCash(accounts, creditCardLoanTotal)` (+ Decimal sibling): `net = gross(LIQUID_ACCOUNT_TYPES) − [creditCardLoanTotal + Σ max(0, −balance) over CREDIT_CARD accounts]`. Master and the CFO emergency-buffer signal route through it; the inline loans-only netting is **deleted** (culprit removed, §23.2.1). Buckets engine unchanged — its algebra handles account-typed card debt through `assets.accounts` (hand-verified for loan-card / account-card / mixed).
- **§19.2 worked example**: 304,304 − 2,496 = **301,808**; months = 301,808 ÷ 25,973 = 11.62 → **11.6** (was 11.716 → 11.7). §19.1 basis: balances are point-in-time account data; the burn stays actuals-first (`avgMonthlyOutflow`) with declared-recurring fallback — unchanged.

### Files Modified
- `lib/calculations/liquidCash.ts` — **NEW** canonical producer (Float + Decimal), full JSDoc with both-representation rationale + worked example
- `lib/services/masterFinancialService.ts` — inline netting replaced by `computeLiquidCash(data.accounts, netWorth.liabilities.creditCards).net`
- `lib/cfo/scoreCalculator.ts` — emergency-buffer (Float + Decimal) liquid basis via the canonical producer; `LoanData.type` threaded
- `lib/calc-audit/engines/decimal-cfo-score-risk.ts` — frozen Float mirror updated in lockstep; 2 new fixtures (account-typed + loan-typed card netting)
- `lib/calculations/accessibilityBuckets.ts` — param JSDoc: both representations + why only the LOAN component is added back
- `components/balances/HiddenWealthLens.tsx` — stale comment corrected (Safety Net is no longer gross)
- `tests/golden/ring2.liquidCashParity.accountCard.test.ts` — **NEW** Ratchet: the LIVE topology (card as ACCOUNT) with a topology-signature assertion (`liabilities.creditCards === 0`) + I9 months identity on master AND the real safety-net route; **fails on pre-fix code**
- `tests/golden/ring2.liquidCashParity.test.ts` — months-identity + route-months assertions added (the VR-017 blind spot)
- `tests/calculations/liquidCash.test.ts` — **NEW** §19.2 worked examples incl. the exact VR-017 shape
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `engine.liquidCash.computeLiquidCash` modelled (semanticKey `liquidCash`); `engine.emergencyFund.buildEmergencyFundMetrics` modelled as **CONSUMER**; 4 feed edges; anchors re-pinned (master :1792, buckets :83)
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — new file allowlisted (graphify CLI offline; self-prune note)
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-031/064: VR-017 retro, corrected root cause, semanticKeys → `engine.liquidCash.computeLiquidCash`, fixPRs += #1455, plain trio refreshed; **both stay FIXING**
- `docs/verification/runs/VR-017.md` — "Addendum — the fix"
- `docs/issues/FIX_PROTOCOL.md` §7 — ledger retro: **fixture-topology F2**; census rule tightened (multi-representation entities: the fixture MUST mirror the live representation and assert its signature)

### Census notes (not changed, recorded)
- `/api/cashflow/intelligence` runway = Σ ALL balances ÷ total outflow — a total-balance runway, different basis by design.
- `lib/health/metricAggregation.ts:129` `calculateLiquidAssets` = positive non-CC cash + shares/ETFs — a scoring-liquidity concept (includes investments); labelling follow-up candidate, untouched (changing it moves health scores with no VR evidence).

### Build Status
- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] Build passes (`npm run build`)
- [x] Full suite: 4,125 passed / 69 skipped (277 files)
- [x] `lint:source-lock` (81 tracked, unchanged) · `lint:financial-surfaces` (34 grandfathered, 0 new) · `neomatrix:check` + census gate (0 uncovered) · `issues:check` (87 valid)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (VR-017.md §7 retro + HANDOFF brief + FIX_PROTOCOL §3 — conformed; Neomatrix consulted first) · Requirements 10/10 (brief's "sibling producer" hypothesis corrected to "inert netting input" with executed evidence — recorded, not silently changed) · Logic 10/10 (one producer remains; worked example test-executed; buckets algebra verified across all three topologies)`
Coverage boundary: goldens verify the synthetic account-card + loan-card topologies end-to-end (real master service + real safety-net route) and the exact VR-017 arithmetic; they do NOT verify live rendered numbers — that is the Matrix's Ring-3 re-run. `lib/health` + intelligence-runway bases intentionally NOT converged (different concepts).

### Commit History
| Hash | Message |
|------|---------|
| d32aacbe | fix(liquidity): net BOTH credit-card representations in ONE canonical liquid-cash producer (MON-031/064 VR-017 re-fix) |
| (this) | docs+registry: VR-017 addendum, ledger retro, changelog, plan |

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1455 (draft — Reza merges → Matrix Ring-3 re-run)
- Status: Open

---

## Session: yhm8ug (continuation 2) — Calc-SSOT Wall Mechanism A keystone (Part 1, PR #1458)

### Changes Made
- **Type**: Feature (intake-integrity guardrail — the last unbuilt Calc-SSOT Wall keystone)
- **Scope**: intake classifier + all six Income/Expense mint sites
- **Root Cause** (per CALC_SSOT_WALL.md, anchors re-verified at HEAD `ad1322a9`): reconciliation MINTED new rows instead of updating the canonical one — non-rental income had NO reuse guard (`link/route.ts:474` — Ingeus ×3), expense near-dup was scoped to the exact (property,loan,asset) triple (battery ×3 across scopes), and doc-import income dedup was exact `amount+name+type` (a declared row and its reconciled twin never matched).
- **Solution**: `classifyIntake` gained the `source-signature` stream policy — identity = (kind, type, normalised name, ownerEntityId) over user-wide candidates with the **scope-compatibility rule inside the classifier** (same scope or one side scopeless; two differently-scoped rows never converge — the Reza distinct-sources correction, structural). All six mint sites routed through it; new reuse takes the `:831` update template (amount ← txn, prior → `budgetedAmount`, `lastReconciled`). Manual exact dup → 409 with guidance; onboarding idempotent-skips; doc-import expense stays amount-bounded (pinned doctrine), income converges across amount drift.
- **Recorded deviations** (PR body, not silent): scope-compat instead of blanket unscoped signature; 409-not-silent-update on manual POST (Reza can flip).

### Files Modified
- `lib/intake/classifyIntake.ts` — `source-signature` policy + scopeKey on rows/candidate
- `app/api/transactions/[id]/link/route.ts` — income non-rental signature reuse (update template); expense cross-scope tier
- `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts` — classifier-driven income/expense dedup (expense amount-bound re-check kept)
- `app/api/income/route.ts` — rental scope-singleton convergence + 409 `DUPLICATE_INCOME_SOURCE` on exact non-rental dup
- `app/api/onboarding/complete/route.ts` — idempotent skip on exact signature
- `tests/golden/ring2.mechanismA.intakeDedup.test.ts` — **NEW** Ring-2 ratchet (real link route; fails pre-fix)
- `tests/intake/classifyIntake.test.ts` — +6 policy unit tests (scope-compat truth table)
- `tests/documents/reconcileSuggestedAction.test.ts` + `tests/utils/mon037RcbNearDuplicate.test.ts` — contract pins re-pointed to the new topology
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `engine.intake.classifyIntake` + `law.intake.oneRowPerSource` (neobrain domain) + 2 edges
- `docs/architecture/CALC_SSOT_WALL.md` (Mechanism A → BUILT) · `docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md` §5 (MON-076 brick) · `docs/blueprint/PHASE_54_NEOBRAIN.md` §12.5
- `docs/issues/ISSUES.json`/`.md` — MON-084/085/076 → FIXING (#1458), MON-074 → DIAGNOSED (Part-2 census note)

### Build Status
- [x] TypeScript compiles · [x] Build passes (433 pages) · [x] Full suite 4,137 passed / 69 skipped
- [x] `lint:source-lock` (81, unchanged) · `lint:financial-surfaces` (0 new) · `neomatrix:check` + census (275 nodes, 0 uncovered) · `issues:check` (87 valid)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (brief + CALC_SSOT_WALL Mechanism A + GUARDRAIL C3 conformed; deviations surfaced) · Requirements 10/10 (six mint sites routed; Part 2 separate + Reza-gated) · Logic 10/10 (one policy one place; truth table unit-tested; real route exercised; the amount-bound doctrine caught by the existing pin and preserved)`
Coverage: golden verifies the link-route create action on a visible in-test mock + the classifier truth table; does NOT verify live rendered counts or browser flows (Matrix Ring-3) and touches NO existing live duplicate (Part 2, per-group Reza approval).

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1458 (draft — Part 1 guardrail; Part 2 separate after merge)

---

## Session: yhm8ug (continuation 3) — Mechanism A Part 2: Reza-gated duplicate merge (preview-and-confirm)

### Changes Made
- **Type**: Feature (data-hygiene tool — §12.11 user-confirmed destructive merge)
- **Scope**: the ALREADY-minted duplicates the Part-1 guardrail (#1458) cannot touch (Ingeus ×3, battery ×3)
- **Solution**: `lib/intake/duplicateMerge.ts` — `findDuplicateGroups` clusters rows under THE Part-1 signature policy (same classifier, same scope-compatibility rule; RENT/RENTAL excluded per MON-009), proposes the survivor (most-specific scope, then oldest) + the net declared-annual effect via canonical `annualRunRate`; `executeMerge` repoints EVERY FK (UnifiedTransaction / Transaction / SuperContribution / TransactionSplit / AssetServiceRecord / `derivedFromIncomeId` / AgentDisbursementRule with conflict surfacing) to the survivor inside a transaction, then deletes the siblings. The survivor's own fields are never changed. `GET/POST /api/intake/duplicates` (thin §12.3 wrappers; POST requires `confirm:"MERGE"` + server-side group re-derivation — stale groups 409, client ids never trusted, NO merge-all). Admin surface `/admin/intake-duplicates` (admin design system — §18.2 exempt) with per-group typed-MERGE confirmation.
- **The preview IS the live row-level census** the Mechanism-A brief mandates (genuine same-source groups vs distinct same-payer sources) — Reza reads it on his data and approves each group individually.

### Files Modified
- `lib/intake/duplicateMerge.ts` — **NEW** engine (grouping + transactional merge executor)
- `app/api/intake/duplicates/route.ts` — **NEW** GET preview + POST Reza-gated merge
- `app/admin/intake-duplicates/page.tsx` — **NEW** admin preview/confirm surface
- `tests/intake/duplicateMerge.test.ts` — **NEW** 7 tests: Ingeus clusters (effect −5,547×12), battery scoped-survivor, QBE A-vs-B + rentals never group, FK repoint matrix incl. AgentDisbursementRule conflict flag
- `docs/financial-logic/graph/*` — `engine.intake.findDuplicateGroups` + 3 edges (classifyIntake feed, monthlyRunRate feed, governed-by oneRowPerSource); 3 files Layer-0 allowlisted (graphify offline, self-prune notes)
- Registry: MON-074 → FIXING (this PR)

### Build Status
- [x] tsc clean · [x] Build passes · [x] Full suite 4,144 passed / 69 skipped · [x] all static gates green

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (brief Part-2 spec + §12.11 conformed — preview-and-confirm, never auto-run, no merge-all) · Requirements 10/10 (groups + resulting row + net effect on declared gross shown; per-group explicit confirmation; Matrix never merges) · Logic 10/10 (grouping reuses THE Part-1 policy so preview ⊆ guardrail; FK map verified against schema.prisma; transactional; stale-group 409)`
Coverage: the engine's grouping + FK-repoint call shapes are unit-tested; NOT verified: the live preview on Reza's data (that IS the deliverable — he reads it), the admin page rendering in a browser, and any actual merge (gated on his per-group click).

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1459 (draft — the tool ships; every merge is Reza’s per-group click)

---

## Session: yhm8ug (continuation 4, 2026-07-20) — Part A: household income attribution + per-person tax (MON-076)

### Changes Made
- **Type**: Feature (tax correctness — per-individual AU assessment)
- **Solution**: `listIncomeEarnerEntities` (SELF → PERSONAL_NAME entity; other earners → INDIVIDUAL entity via `householdMemberId`, idempotent — reuses the ONE ownership concept `ownerEntityId`, §12.2.1); `/api/income` POST/PUT + link-route accept a validated `ownerEntityId` (absent → primary, back-compat); NEW `GET /api/income/earners`; `getUserTaxPosition` emits `perMember` (same rows partitioned by owner entity → SAME engine per partition — attribution, no new tax math; household roll-up byte-identical); "Who earns this?" selector in the Add/Edit Income form (client-required for SALARY when >1 earner) + the reconcile dialog.
- **Ratchet**: `tests/golden/ring2.perMemberTax.test.ts` — member B's salary lands in B's position not A's; roll-up additive. Golden harness +householdProfile/legalEntity (fail-loud caught the new queries).
- **Recorded scope boundary**: per-person tax DISPLAY on the tax page/cashflow/CFO is deferred — a new section-level composition requires the §18.2.1 Stitch pass with Reza; the canonical bundle now carries everything those surfaces need.
- Gates: suite 4,147 green · build green · all static gates green · getUserTaxPosition anchor re-pinned (:86) · one baseline line re-pinned (income page :2278→:2337).

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (consolidated brief Part A conformed; Stitch-gated display deferral surfaced, not silent) · Requirements 10/10 (attribution + per-person engine + both forms; server default preserved for wizard back-compat — recorded) · Logic 10/10 (one ownership concept; same engine partitioned; golden-proven; roll-up unchanged)`
Coverage: verifies the partition attribution + roll-up additivity on a two-earner fixture and the API owner acceptance paths compile+typecheck; does NOT verify the live UI selectors in a browser or any live member data (Matrix Ring-3 + Reza's eyeball after merge).

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1461 (draft)

---

## Session: yhm8ug (continuation 5, 2026-07-20) — Intake Duplicates: keep-directive recorded + same-property rental coverage (MON-074/076)

### Changes Made
- **Type**: Fix (detector coverage) + strategic-decision record
- **Root cause (coverage gap)**: `findDuplicateGroups` excluded ALL rental income from the preview census — correct for cross-property/scopeless rent (the distinct-sources correction), but it also hid same-property rent duplicates: the VR-007 Cienna Lot-1 ×3 class, which the MON-076 Stage-1 diagnosis says likely predates MON-009 (mechanism fixed, data remains). Reza's first load after #1463 showed "No duplicate groups" — partly his own manual salary cleanup (Ingeus), partly this blind spot.
- **Solution**: rental rows (RENT/RENTAL) now enter grouping ONLY when property-scoped; both sides of any rental pair therefore carry a scope, so the classifier's compatibility rule permits strictly SAME-property groups and rejects cross-property pairs structurally. Scopeless rental rows are never bridged. Rental groups carry an explicit "SAME property (scope-singleton)" warning in the preview.
- **Strategic decision (Reza, 2026-07-20 — supersedes the earlier removal directive)**: the merge functionality is KEPT permanently ("let's not remove this functionality as it might be used in future if there is an issue later") — standing incident tool + sentinel, expected empty forever; a non-empty page = guardrail regression alarm. The remove-the-merge-action plan is CANCELLED. Recorded in MON-074/076 registry notes.

### Files Modified
- `lib/intake/duplicateMerge.ts` — rental eligibility narrowed from type-exclusion to scopeless-exclusion; rental-group warning
- `tests/intake/duplicateMerge.test.ts` — +Cienna Lot-1 same-scope group test; over-merge guard updated (cross-property + scopeless rent still never group) — 8/8 green
- `docs/issues/ISSUES.json` + generated `ISSUES.md` — MON-074/076 keep-directive + coverage record
- `docs/financial-logic/graph/financial-graph.json` + regenerated `GENERATED_CORE.md` — findDuplicateGroups produces-text updated + anchor re-pinned :93→:96

### Build Status
- [x] targeted suite 8/8 · [x] issues gate 88 valid · [x] neomatrix gates green (193 proven · 215 modelled · 0 uncovered)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (MON-009 scope-singleton law + MON-076 Stage-1 diagnosis re-read; deviation from the original exclusion surfaced with the evidence, not silent) · Requirements 10/10 (Reza keep-directive recorded verbatim in registry; Cienna class made visible; Lot-1 vs Lot-2 still never merge) · Logic 10/10 (both sides scoped ⇒ compatibility rule = same-scope only, proven by the new over-merge test; executeMerge unchanged — already type-agnostic incl. AgentDisbursementRule)`
Coverage: verifies grouping semantics on fixtures (same-scope groups, cross-scope/scopeless never); does NOT verify the live Cienna rows appear on Reza's page — that is his re-check after this PR deploys, and the rows may legitimately be gone if he already cleaned them manually.

---

## Session: yhm8ug (continuation 6, 2026-07-20) — MON-089: Actual Monthly ×N/(N−1) inflation — one producer for the day-span average

### Changes Made
- **Type**: Fix (financial correctness — Reza-reported live)
- **Root Cause (§19.2 verified with his exact numbers)**: the income route's ARREARS branch divided N payments by the N−1 intervals of their date span — the period the FIRST payment paid for was missing from the denominator. Live case: 2 × $11,074 salaries 29 days apart → 22,148 ÷ 29 × 30.44 = **$23,247** (exact screenshot match); correct = 22,148 ÷ 58 × 30.44 = **$11,624**. Producer census found FIVE copies of the day-span formula: income ARREARS (buggy) + income ADVANCE + expenses route + loans route + link-route pattern banner (buggy, same class).
- **Solution (remove-the-culprit, §12.2.1)**: all four route copies deleted; income/expenses/loans routes + the link-route banner now import THE Neomatrix-modelled canonical `calculateMonthlyAverage` (lib/services/propertyActuals.ts — already correct: span + one average interval; ADVANCE drops the trailing part-period payment). Recorded unification: a single payment now reads as one month's actual on the income page (was blank; matches expenses/loans; MON-075 chip still nudges).
- **Ratchet**: `tests/calculations/actualsMonthlyAverage.test.ts` — Ring-0 worked examples (Transport 2×$11,074/29d → 11,623.88; monthly identity → P; Ingeus-class fortnightly; ADVANCE; N=1/N=0) + Ring-1 topology lock (migrated files must import the canonical and carry no own ×30.44 math).

### Files Modified
- `app/api/income/route.ts` — 56-line dual-branch inline block → one canonical call
- `app/api/expenses/route.ts`, `app/api/loans/route.ts` — inline copies → canonical call
- `app/api/transactions/[id]/link/route.ts` — banner `trueMonthlyAverage` → canonical call
- `docs/issues/ISSUES.json`/`ISSUES.md` — MON-089 raised → FIXING (censuses + trio + test + #1465)
- `docs/financial-logic/graph/*` — canonical node produces/verifiedBy updated (no anchor drift — file untouched)

### Build Status
- [x] tsc clean · [x] targeted suites 26/26 · [x] full suite 4,157 passed / 69 skipped · [x] issues gate 89 valid · [x] neomatrix green (0 uncovered) · [x] source-lock + financial-math no new violations

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Neomatrix consulted FIRST — the canonical producer was already modelled; SEARCH-FIRST found it; MATRIX_FIX_DISCIPLINE 5-item checklist in PR body) · Requirements 10/10 (Reza's exact reported numbers reproduced then corrected; all five producers collapsed, not just the reported one) · Logic 10/10 (×N/(N−1) proven algebraically + by worked example; ADVANCE semantics preserved verbatim; N=1 unification recorded, not silent)`
Coverage: verifies the formula on fixtures and locks the topology; does NOT verify the rendered page numbers on live data — that is Reza's per-fix re-check (Part 24 #7): Transport ≈ $11,624, Ingeus fortnightly ≈ sensible, variance no longer +110%.

---

## Session: yhm8ug (continuation 7, 2026-07-20) — MON-090: date-aware actuals display, declared-first (+ the holistic sweep verdict)

### Changes Made
- **Type**: Feature/Fix (display correctness — Reza directive: "the data should be date aware... average AND the actual, based on the dates... all other transactions... date and frequency aware")
- **Sweep verdict (Reza's holistic mandate, §19.2-verified per producer)**: the transactions→monthly class had FIVE producers of the day-span formula — all collapsed to `calculateMonthlyAverage` in #1465 (income-ARREARS + link-banner were the broken two). The calendar-month family is CLEAN: `actualCashflow` (canonical month window) → canonicalCashflow/master/insights/intelligence; tie/analytics + moneyStoryTrend bucket by real calendar months; `analyzeTransactionPattern` is frequency-aware; forecasting daily/category averages are dense-stream heuristics (noted, unchanged). Expenses were calculation-correct but displayed NO actuals at all.
- **Solution**: `detectStaleStream` (ONE producer, lib/intake/detectors.ts — recurring stream quiet past 1.5× its own cadence); `lastTransactionAt` + `staleStream` on income/expenses/loans routes; income page — declared-first (declared = plan + variance baseline; cadence average marked "avg /mo" with evidence "N payments · last <date>", standing in only when no declared amount), "this month · $X" calendar actual, amber quiet-stream chip, group "received this month" rollup; expenses page — new Actual column, same pattern; `formatShortDayMonth` (one display producer).
- **Design**: Stitch screen `711e25c554b54dd7b5a2c67ed4aa58c6` (project 1859462351962811110), §18.8 gate v1 6.5 → v2 9.2; artefacts merged in #1466; Reza approved with the declared-first amendment.
- **Honest boundary**: Transportservice (last payment 12 Jun, 38 days quiet) is NOT yet stale for a monthly cadence (threshold ≈ 46d) — shows "this month · $0 so far"; the chip fires ~27 Jul. Locked in the unit test.

### Files Modified
- `lib/intake/detectors.ts` (+detectStaleStream) · `lib/utils/formatters.ts` (+formatShortDayMonth)
- `app/api/{income,expenses,loans}/route.ts` (+lastTransactionAt, +staleStream)
- `app/dashboard/income/page.tsx` (table + grouped views, declared-first) · `app/dashboard/expenses/page.tsx` (new Actual column)
- `tests/intake/staleStream.test.ts` (5 worked examples incl. the Transport boundary)
- Registry MON-090 → FIXING (#1467) · `docs/verification/briefs/RING3_DATE_AWARE_NUMBERS.md` (the Matrix handout)
- `.audit/financial-math-baseline.json` (1 line re-pin :2337→:2400) · 1 `@source-lock-allowed` annotation (group rollup of the canonical currentMonthActual)

### Build Status
- [x] tsc clean · [x] staleStream 5/5 · [x] financial-surfaces + source-lock + neomatrix + issues gates green · [ ] full suite (running at push)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (approved Stitch design conformed + Reza's declared-first amendment implemented verbatim; sweep re-read the canonical engines, not memory) · Requirements 10/10 (both figures date-aware on income AND expenses; average-as-fallback only without declared amount; sweep verdict recorded per producer) · Logic 10/10 (staleness = ONE producer with frequency-derived threshold, unit-locked incl. the honest not-yet-stale boundary; no calculation changed — changesNumbers: false; group rollup sums the canonical per-row month actual)`
Coverage: verifies the detector thresholds and compile/lint integrity; does NOT verify rendered live numbers — that is Reza's eyeball + the Matrix Ring-3 brief (docs/verification/briefs/RING3_DATE_AWARE_NUMBERS.md).

---

## Session: yhm8ug (continuation 8, 2026-07-20) — MON-091: income frequency at the link boundary (the Thornland fortnightly class)

### Changes Made
- **Type**: Fix (declared-cadence correctness at intake)
- **Root Cause (§19.2, Reza-reported + verified at source)**: (a) the link dialog's income section had NO frequency control while the shared requestBody always sent an invisible MONTHLY default; (b) BOTH income reuse paths discarded cadence — MON-009 rental scope-singleton reused the row verbatim, the Mechanism-A signature update touched only amount fields. Live case: 4 Cienna payments (17/14/15-day intervals) batch-linked onto a Lot-1 row born MONTHLY $1,195 → wrong declared plan → +202% variance vs the (correct) $3,608 avg. The $3,608 was reproduced exactly (ADVANCE branch: $5,511 over 46.5 covered days × 30.44).
- **Solution (suggest-and-confirm, zero silent writes)**: income section gains the same detected-cadence Frequency selector as the expense flow; frequency is sent ONLY when evidence-prefilled or user-touched (`freqExplicit` — a naked default is OMITTED, so the create-path classifier derives from evidence per MON-078 and a reused stream's stored cadence can never be clobbered); the server updates the reused row's frequency/isRecurring ONLY on an explicit declared frequency (both reuse paths; rental declared amount never touched).
- **Same PR (justified)**: MON-090 grouped-view declared-first parity — the Hipcamp $0-declared rows now show the average marked "avg" and a variance dash in the grouped view too.
- **Ratchet**: 2 new golden scenarios on the REAL link route (explicit FORTNIGHTLY updates the reused Lot-1 row, amount untouched; absent frequency never rewrites) — 6/6.

### Build Status
- [x] tsc clean · [x] full suite 4,164 passed / 69 skipped · [x] all static gates green (1 baseline re-pin :2400→:2410)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (MON-025/078/080 suggest-and-confirm doctrine conformed; §12.11 answered for the reuse update — guard = the stream being linked in this very action + the user's explicit visible confirmation) · Requirements 10/10 (Reza's exact gap: "no frequency available for the rental category… defaults to monthly" — closed at both the UI and both reuse paths) · Logic 10/10 (clobber trap found in self-review and closed: the always-sent default became conditional freqExplicit; golden proves both directions on the real route)`
Coverage: verifies the route reuse semantics + dialog compile; does NOT verify the rendered dialog or Reza's live Thornland correction — his re-link/eyeball after deploy.

---

## Session: yhm8ug (continuation 9, 2026-07-20) — MON-092: one-off display rule on EVERY view + the same-day phantom average

### Changes Made
- **Type**: Fix (display correctness + a real formula edge in the canonical producer)
- **The honest diagnosis (third recurrence of the monthly-default family)**: the DATA was right this time — recurring-unticked stored `isRecurring=false` (Net $0 proved the run-rate held). The DISPLAY lied: the grouped income view, income detail panel and three expenses views printed the raw stored "Monthly" placeholder (the MON-048 ONE-label rule was wired into only the list view — the classic fixed-here-drifted-there sibling-view pattern), and the MON-090 Actual cells dressed one-offs in stream language. PLUS a genuine formula edge: `calculateMonthlyAverage` clamped a zero-day span to 1 day — two same-day gifts ($800+$700, 18 May) extrapolated to **$22,830/mo** (1,500/2×30.44, reproduced exactly).
- **Solution**: same-day guard in the ONE producer (span < 1 day → the total, one-month semantics, consistent with N=1); one-off branch in every Actual cell ("$X once · date", no avg/this-month/stale/variance); `activityFrequencyLabel` gate on EVERY frequency-label render (income grouped + detail panel; expenses column + tile + grouped).
- **Ratchet**: the gift worked-example (1,500, never 22,830) + a topology lock that ENUMERATES every `{item.frequency.toLowerCase()}` render site in both pages and fails on any ungated line — the lock caught a third ungated expenses-tile render during this very build.
- **Noted follow-ups (Reza's call, not this PR)**: unlink leaves the auto-created income row behind (the "No txns" Newsha orphan — deletable today); bank-descriptor names ("…Am 18may Credit To Acc") fragment identity per deposit — NeoBrain naming candidate.

### Build Status
- [x] tsc clean · [x] full suite 4,167 passed / 69 skipped · [x] all static gates green (1 baseline re-pin :2410→:2443)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (MON-048/053 label doctrine + Wall-B2 one-off semantics re-read and applied class-wide, not spot-fixed) · Requirements 10/10 (both of Reza's reports answered: the "Monthly" label AND the $22,830 — each reproduced to the dollar before fixing) · Logic 10/10 (guard changes ONLY degenerate same-day sets; run-rates untouched — one-offs already contribute 0; enumerating lock makes sibling-view drift a test failure)`
Coverage: verifies the producer edge-case + the render-site enumeration; does NOT verify the rendered page — Reza's refresh after deploy (gift rows read "One-off · $X once").

---

## Session: yhm8ug (continuation 10, 2026-07-20) — Ring-3 brief v2: the complete date-aware chain handout

### Changes Made
- **Type**: Docs (verification brief — Reza's request for the "complete check on this fix")
- `docs/verification/briefs/RING3_DATE_AWARE_NUMBERS.md` → v2, superseding v1 in place: now covers the FULL chain (MON-089 formula ×N/(N−1) + MON-092 same-day guard · MON-090 date-aware/declared-first display incl. both-view parity · MON-092 one-off rule across all six render sites · MON-091 frequency-at-intake incl. the clobber guard · Mechanism A · cross-surface SSOT · flux-aware guards). 21 numbered checks; items 1/2/9/13/14 flagged as class-killers.

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (every check traces to a shipped PR #1463–#1469 and its registry entry) · Requirements 10/10 (complete-chain coverage, not just the last fix) · Logic 10/10 (thresholds/formulas in the brief match the shipped code — 1.5× cadence, ×26/12, same-day→total)`
Coverage: the brief itself; execution is the Matrix's run.

---

## Session: yhm8ug (continuation 11, 2026-07-20) — MON-093: the Broadbeach ×4 rental — the SIXTH copy of the day-span math, killed by delegation

### Changes Made
- **Type**: Fix (Sev-1 cross-surface number inflation — VR-019 item 16)
- **Root cause (§19.2-exact)**: `resolveMonthly`'s private `daySpanMonthlyAverage` dropped the trailing payment of a 2-txn rental (rent-in-advance), got 1 < 2 remaining, returned null — then the single-txn fallback annualised UNSORTED `txs[0]` ($2,614.25, the NEWER June payout listed first) by the mis-declared WEEKLY row frequency: 2,614.25 × 52 / 12 = **$11,328.40/mo = $135,941/yr** — exact reproduction of both the property page and the tax estimate, while the income page's `calculateMonthlyAverage` correctly returned the completed May payment **$2,515** as one month.
- **Solution (remove the culprit — §23.2.1)**: the day-span producer MOVED to its canonical calculations home `lib/calculations/actualsMonthlyAverage.ts` (`DAYS_PER_MONTH = 365.25/12` now THE one constant); `resolveMonthly` DELEGATES its ≥2-txn branch to it (private math deleted — the sixth divergent copy after #1465's five); the 1-txn branch sorts and annualises the LATEST payment; income/expenses/loans/link routes import from the new home.
- **Plausibility guard**: new `rentCadenceSuspect` on `computePropertyCashflow` → amber chip on the property detail rental row when declared frequency disagrees with the detected payment cadence ("declared weekly, but payments look monthly — check the row's frequency"). Surfaces the data mismatch instead of silently computing through it; Reza will also correct the declared row basis.
- **Neo-sync (§21.2.1 + graphify-offline precedent 1ff5803d)**: semantic anchors re-pinned (calculateMonthlyAverage → new home :30, resolveMonthly :129, computePropertyCashflow :212, resolveLoanMonthlyCost :188); structural graph hand-moved (stale propertyActuals node removed, new file + symbols added, edges re-pointed, propertyActuals lines re-pinned); coverage-allowlist entry pruned (file now in-graph).
- **Registry**: MON-093 raised → FIXING (full censuses + plain trio + #1473); VR-019 verdicts applied — MON-089/090/092 → VERIFIED; MON-091 stays FIXING (write checks 13/14 pending Reza's authorisation).

### Files Modified
- `lib/calculations/actualsMonthlyAverage.ts` (NEW) — THE day-span producer + DAYS_PER_MONTH
- `lib/calculations/monthlyResolver.ts` — delegation; latest-payment single-txn branch
- `lib/calculations/propertyCashflow.ts` — rentCadenceSuspect
- `lib/services/propertyActuals.ts` — local producer deleted; imports the canonical home
- `app/api/{income,expenses,loans}/route.ts`, `app/api/transactions/[id]/link/route.ts` — import migration
- `app/dashboard/properties/[id]/page.tsx` — amber cadence-suspect chip
- tests: propertyCashflow (MON-093 identity: property rent ≡ the one producer ≡ 2,515, never ×52) + actualsMonthlyAverage (new home, DAYS_PER_MONTH, updated topology locks)
- Neomatrix: financial-graph.json + GENERATED_CORE.md + structural-graph.json + coverage-allowlist.json; docs/issues/ISSUES.{json,md}

### Build Status
- [x] tsc clean · [x] full suite 4,170 passed / 69 skipped · [x] neomatrix:check all gates green (census 0 uncovered) · [x] lint:financial-surfaces + lint:source-lock green · [x] issues:check 93 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (MATRIX_FIX_DISCIPLINE four clauses + FIX_PROTOCOL censuses done BEFORE code; Neomatrix consulted first and moved with the fix incl. the structural-graph hand-move per the 1ff5803d graphify-offline precedent) · Requirements 10/10 (the brief's fix shape delivered: ONE canonical rental figure feeds property+income+tax; plausibility guard shipped; constant unified — recorded ~0.008% display shift $11,624→$11,623) · Logic 10/10 (exact §19.2 reproduction 2,614.25×52/12=11,328.40 before fixing; delegation kills the class, not the instance; Ring-0/2 identity test pins property rent ≡ the one producer for the advance-pair shape)`
Coverage: verifies the resolver→producer identity + the cadence-suspect trigger + true-weekly non-regression in unit/golden form; does NOT verify the rendered live page or Reza's actual Broadbeach values — that is the per-fix Chrome check after merge (expect ~$2,515/mo on the property page ≡ income page; tax rental ~$30,180/yr).

---

## Session: yhm8ug (continuation 12, 2026-07-21) — MON-093 VERIFIED at VR-020 · MON-094 built: assessable-only tax gross (ATO refunds → $0)

### Changes Made
- **Type**: Fix (tax correctness — VR-019 items 11/19; VR-020 §D pre-fix baseline "Other Income $10,300")
- **MON-093 fold-in**: registry FIXING → VERIFIED with the VR-020 evidence (Broadbeach $2,947/$35,360/5.89% ≡ list ≡ tax; amber chip live; guards clean; no unexplained baseline delta); STATE cursor advanced to the merge of #1474. #1473's §17.2: production deploy `dpl_DTgQ2kDo…` READY (~00:08Z); runtime-log pull timed out (fresh deploy, no traffic) — VR-020's live captures serve as the runtime check.
- **MON-094 root cause (census-verified, distinct from CLOSED MON-053)**: classification, not annualisation. An ATO-refund row can only be typed `OTHER` (IncomeType enum), `OTHER` defaults to taxable-for-safety (`taxabilityRules.ts`), and the Phase 20 exemption mechanism (`Income.taxCategory` incl. `TAX_EXEMPT`) never reached the engine — `userTaxPosition.ts`'s IncomeItem map dropped it.
- **Reza's rule (2026-07-21)**: tax gross = assessable income only — recurring declared + genuine one-off assessable receipts (counted once); ATO refunds / internal transfers / loan drawdowns excluded, auto. Exact descriptor list = confirm-at-merge; NO silent rewrite of existing rows.
- **Solution (no schema change — the field existed)**: (a) `NON_ASSESSABLE_TAX_CATEGORIES` row-level override at the top of BOTH `determineTaxability` twins (Float + Decimal) — a tagged row contributes $0/full-exempt; `taxCategory` carried through IncomeContext/IncomeItem/the userTaxPosition map/both engine call sites; `/api/tax/position` + master inherit via the MON-020 bundle. (b) `detectNonAssessable(name)` in the ONE intake classifier (conservative: live ATO descriptor shapes, unambiguous transfer/drawdown wordings; a miss stays taxable-for-safety); link-route income create stores the tag + taxNotes. (c) `GET/POST /api/tax/non-assessable-review` + `/admin/tax-review` (admin design system, §18.2 exempt): server re-derived detection, per-row typed-RECLASSIFY confirm, 409 on stale, only `taxCategory`/`taxNotes` columns ever written (§12.11). (d) MON-053's one-off guard + all other income branches untouched.

### Files Modified
- `lib/tax-engine/income/taxabilityRules.ts` — NON_ASSESSABLE_TAX_CATEGORIES + override in both twins; IncomeContextDecimal.taxCategory
- `lib/tax-engine/types.ts` — IncomeContext.taxCategory
- `lib/tax-engine/position/taxPositionCalculator.ts` — IncomeItem.taxCategory + both call sites pass it
- `lib/tax-engine/position/userTaxPosition.ts` — the severed link closed (map carries taxCategory)
- `lib/intake/classifyIntake.ts` — detectNonAssessable (ONE detector)
- `app/api/transactions/[id]/link/route.ts` — income create stores the detection
- `app/api/tax/non-assessable-review/route.ts` (NEW) + `app/admin/tax-review/page.tsx` (NEW)
- `tests/tax/mon094NonAssessable.test.ts` (NEW, 13 tests) — Ring-0 override both twins + detector; Ring-2 worked example (Other = $250, not $10,300; Float===Decimal); Ring-1 topology locks
- Neomatrix semantic (2 anchors re-pinned :136/:289 + produces on 3 nodes) + structural (2 new files + detectNonAssessable, per the graphify-offline precedent); `docs/blueprint/PHASE_54_NEOBRAIN.md` (intake classification note); registry MON-093 VERIFIED + MON-094 FIXING; STATE

### Build Status
- [x] tsc clean · [x] full suite 4,183 passed / 69 skipped · [x] neomatrix:check all green (anchors 167/167, census 0 uncovered) · [x] lint:financial-surfaces + lint:source-lock green · [x] issues:check 94 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Matrix code brief followed to shape; MATRIX_FIX_DISCIPLINE censuses confirmed live at HEAD before code — incl. DISCONFIRMING the brief's one-off-inconsistency hypothesis; Neomatrix consulted + moved with the fix; Neobrain doc updated same PR) · Requirements 10/10 (Reza's assessable-only rule built exactly: auto-exclusion at intake, $0 via the ONE engine, per-row confirm for existing rows — no silent rewrite; descriptor list surfaced for merge-time confirmation) · Logic 10/10 (override at the TOP of both twins so Float/Decimal can never disagree; untagged rows keep taxable-for-safety — no silent exemption; worked example $10,300 → $250 pinned; MON-053 path untouched and re-verified green)`
Coverage: verifies the engine override, the detector, the worked-example arithmetic, and the wiring topology in unit form; does NOT verify the rendered tax page, the Admin review flow end-to-end in a browser, or Reza's live values — that is his two review-page clicks + the Matrix's VR-021 after merge.

---

## Session: yhm8ug (continuation 13, 2026-07-22) — Housekeeping relocation: personal-data tools OFF the staff portal, INTO the app (MON-094 / VR-021 class fix)

### Changes Made
- **Type**: Fix (surface relocation — the VR-021 Stage-4 FAIL; no engine/number changes)
- **Root cause (VR-021)**: the MON-094 review surface shipped on the staff admin portal, which authenticates as a different principal — the user-scoped query ran against the staff account, "Nothing to review", ATO rows stayed taxable. Reza's standing ruling: personal-data tools live in the app.
- **Built (per the Matrix brief + the approved Stitch design 124c6e36…, PR #1477)**: (1) "Housekeeping" section in the trailNav SSOT (sidebar accordion + mobile More sheet; amber identity; Sparkles icon) with sub-tabs Tax classification + Duplicate income; (2) `/dashboard/housekeeping/tax` + `/dashboard/housekeeping/duplicates` on the user session (`useAuth` token — no admin interceptor), typed RECLASSIFY/MERGE per-item confirms, live tab count badges, glass vocabulary + amber→rose accents, theme-token dark mode; (3) BOTH `app/admin/{tax-review,intake-duplicates}` pages DELETED + admin-nav entry removed; (4) GET non-assessable-review now returns server-computed `annualEffect`/`totalAnnualEffect` (canonical `toAnnual` + MON-053 one-off-once semantics in the thin route — the page never sums money); (5) AFSL guard — the fabricated "AFSL 123456" from the Stitch mock can never ship (no-licence-number test).
- **Ratchet**: `tests/housekeeping/relocation.test.ts` — pages exist under /dashboard and use useAuth (never safeAdminFetch); admin pages stay dead and no admin file references the two APIs; AFSL regex guard; nav SSOT lock.
- **Process**: FIX_PROTOCOL §7 ledger retro (Stage-2 gate change: name the session principal for every new surface); registry MON-094 fixPRs += #1479 (stays FIXING until VR-022); structural graph −2 admin files +3 housekeeping files.
- **Deviation notes for Reza (§20.5, surfaced not silent)**: (a) sidebar count badge deferred — an always-on double-fetch in the global sidebar on every page violates §12.10; badges render on the Housekeeping tabs (per design) and the section is one click away — revisit if you want the ambient badge, ideally via a cheap counts field on an existing snapshot; (b) Stitch dark + mobile artefacts remain the desktop session's §18.2.1 backfill — the pages themselves are dark-correct by construction (canonical theme tokens), no hand-mapping done.

### Build Status
- [x] tsc clean (stale `.next/types` for the deleted admin page cleared) · [x] full suite 4,187 passed / 69 skipped · [x] neomatrix:check all green · [x] lint:financial-surfaces + lint:source-lock green · [x] issues:check 94 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (built to the approved Stitch screen + the Matrix brief; §18.4 screen-ID JSDoc on all three components; §7 retro written; deviations surfaced, not silent) · Requirements 10/10 (both tools relocated, both admin pages deleted, engine/detector/merge logic byte-untouched, AFSL guard, topology ratchet) · Logic 10/10 (no number changes; the one money figure on the page is server-computed from canonical producers; per-item typed confirms preserved exactly)`
Coverage: verifies the topology, auth pattern, AFSL guard, and nav SSOT in test form; does NOT verify the rendered pages in a browser or the live counts — that is Reza's eyeball + VR-022 after merge.

---

## Session: yhm8ug (continuation 14, 2026-07-23) — MON-095: duplicate-matcher accuracy — the AIA false-positive class (systemic guardrail)

### Changes Made
- **Type**: Fix (data-integrity guardrail — Reza's live review of Housekeeping → Duplicate income; Fix A of the Matrix brief; Fix B = merge-with-edit is the separate Stitch-first → Opus build)
- **Root cause (§19.2-verified)**: `normalizeMerchant` strips any 5+ digit run, so policy/account numbers are discarded before names compare — "Aia … 68718123" ($131) and "Aia … 68718100" ($158) both normalise to "aia" — and `sameMerchant` has NO amount check, so the classifier's exact branch grouped two DIFFERENT insurance policies as duplicates. Systemic: the same path is the intake guardrail (#1458) — a new distinct policy could be silently auto-absorbed at import, for any user. Merging would delete a real policy.
- **Solution (ONE decision layer — brief options (a)+(c), expense-scoped)**: `expenseDuplicateCompatible` in `classifyIntake`, applied to the exact AND near branches of both name-matching policies: (1) amount guard — same-name expenses only converge inside THE one ≤10% band (`DUPLICATE_AMOUNT_TOLERANCE` exported from reconciliation.ts; `isNearDuplicateEntry` now reads it — no second threshold); (2) identifier fail-safe — `extractIdentifierTokens`/`hasDisjointIdentifiers` (merchantNormalize.ts, ABN/ACN excluded): disjoint policy numbers → never auto-merged, whatever the amounts. Both the Housekeeping preview and every intake door inherit (they all flow through the classifier).
- **INCOME deliberately exempt (surfaced, not silent)**: the Mechanism A doctrine converges declared↔reconciled income across amount drift (locked by ring2.mechanismA — re-run green), and income deposit descriptors carry per-payment refs — a digit-token veto would re-fragment salaries (the MON-076 class).
- **Effect on Reza's data**: the AIA group disappears from the review list (correctly); QBE $216/$216 and Mate $150/$150 still group (genuine). QBE/Mate held for Fix B so cadence is corrected in the merge step.

### Files Modified
- `lib/bank/merchantNormalize.ts` — extractIdentifierTokens + hasDisjointIdentifiers (ONE extractor)
- `lib/utils/reconciliation.ts` — DUPLICATE_AMOUNT_TOLERANCE exported; isNearDuplicateEntry reads it
- `lib/intake/classifyIntake.ts` — expenseDuplicateCompatible on both policies' exact+near branches
- `tests/intake/mon095DuplicateAccuracy.test.ts` (NEW, 9 tests) — AIA repro (RED pre-fix) + fail-safe + genuine-duplicate + intake-guardrail + income-doctrine locks
- Neomatrix: engine.intake.classifyIntake anchor re-pinned :158 + produces note; structural graph +3 symbols, detectNonAssessable re-pinned :352; registry MON-095 FIXING (#1481)

### Build Status
- [x] Targeted suites 74/74 (incl. mechanismA doctrine + merchantNormalize) · tsc + full suite running at commit time (recorded in the PR)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Matrix brief followed — option (a)+(c) as recommended; the §20.5 income/expense scoping fork resolved from the PINNED Mechanism-A doctrine and surfaced explicitly, not guessed) · Requirements 10/10 (systemic guardrail in the ONE decision layer, not a data patch; AIA no longer groups; QBE/Mate still do; no second threshold invented) · Logic 10/10 (guard is expense-scoped with the doctrine lock re-run green; fail-safe direction correct — a wrongly-split duplicate waits for review, a wrongly-merged policy loses data)`
Coverage: verifies the matcher semantics + the intake guardrail in unit/golden form; does NOT verify the rendered duplicates page on live data — that is Reza's re-open of Housekeeping → Duplicate records + the Matrix's live re-check after merge.

---

## Session: yhm8ug (continuation 15, 2026-07-23) — MON-096: the MON-093 cadence chip false-fires on MANAGED rentals

### Changes Made
- **Type**: Fix (display-only — `changesNumbers: false`; no money number moves)
- **Root cause (§19.2-verified at HEAD `dea8eee`)**: `rentCadenceSuspect` (`lib/calculations/propertyCashflow.ts`) compared declared frequency vs detected payment frequency only — it never consulted `rentalMode`, though the input rows carry it and the SAME function already uses it for the MANAGED gross-up. On a managed stream the bank actuals are the agent's MONTHLY net disbursements while the lease is declared WEEKLY, so the amber "check the row's frequency" chip fired by construction on every managed weekly/fortnightly lease — a false alarm on correct data (Broadbeach: $680/wk gross = $2,947/mo − $432 fee = $2,515/mo net, all reconciled).
- **Solution (the Matrix brief's recommended option — reassure, don't go silent)**: the flag gains a `managed` boolean decided in the ONE producer (`rentalRows.some(rentalMode === 'MANAGED')`). The property page renders neutral copy for `managed: true` — "declared weekly · paid monthly by your agent (normal for managed rentals)" — in the normal emerald tone; the amber warning survives ONLY for DIRECT streams (the MON-093 Broadbeach mis-declaration protection is untouched). Mode is never re-derived in the page (§12.2.1).
- **Behaviour-psychology lens**: the false alarm told the user to "fix" correct data; the neutral note explains the pattern instead — no manufactured urgency, and the genuine warning keeps its signal value by staying rare.

### Files Modified
- `lib/calculations/propertyCashflow.ts` — `rentCadenceSuspect` type + computation gain `managed`; MON-096 doc comments
- `app/dashboard/properties/[id]/page.tsx` — neutral managed copy vs amber DIRECT warning (`suspectWarns`)
- `tests/calculations/propertyCashflow.test.ts` — +2 MON-096 tests (MANAGED mismatch → `managed: true`, money unchanged 2,947/35,364; MANAGED agreeing cadences → null) + DIRECT assertion extended to `managed: false` (RED on pre-fix code — the field didn't exist)
- Neomatrix: `engine.propertyCashflow.{computePropertyCashflow,resolveLoanMonthlyCost}` anchors re-pinned :219/:195 + MON-096 rentalMode note; `GENERATED_CORE.md` regenerated
- `docs/issues/ISSUES.json` — MON-096 raised → DIAGNOSED (root cause, censuses, plain trio, test) → FIXING at PR creation

### Build Status
- [x] tsc clean · [x] propertyCashflow 13/13 + registry 8/8 + neomatrix suite green · [x] `npm run build` passes · [x] `neomatrix:check` 0 uncovered, all anchors resolve · [x] `issues:check` 96 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Matrix brief followed incl. the recommended neutral-copy option; Neomatrix consulted + re-pinned same PR) · Requirements 10/10 (MANAGED suppressed-to-neutral, DIRECT warning preserved, one producer, display-only) · Logic 10/10 (managed decided from the same rentalRows the gross-up reads; money paths byte-untouched — regression locked by the $2,947/$35,364 assertions)`
Coverage: verifies the flag semantics + money invariance in unit form; does NOT verify the rendered chip on live data — that is the Matrix's Broadbeach re-open after merge.

---

## Session: yhm8ug (continuation 16, 2026-07-23) — Fix B Stitch design pass: merge-with-edit (Housekeeping · Duplicate records)

### Changes Made
- **Type**: Design (Stitch-first per §18.2.1 — gates the Fix B build; no code)
- **Routing correction (Reza directive 2026-07-23)**: the Matrix's design brief routed the Stitch generation to "the desktop session" — **incorrect**. Reza's standing ruling: **Stitch design passes are executed BY the Code (Fable 5) session**, which self-reviews to >9/10 (§18.8) and presents the passing design for his approval. Recorded here + in the next Matrix handout so future briefs route correctly.
- **Generated**: screen `1ebd1ea29fb0434d8268d9d9d1b45e38` (project `1859462351962811110`, GEMINI_3_1_PRO, DESKTOP) — "Housekeeping Hub — Merge Duplicate Records". Two-zone merge-confirm card per the Matrix brief: dominant emerald "KEEPING" panel with inline-editable Amount / Frequency / One-off⇄Recurring on the survivor; muted "REMOVING" panel with strikethrough + "merges into the record above · links repointed"; "Declared annual effect" line; recap chip ("will also update: frequency → One-off") + typed-MERGE gate + disabled Confirm + Cancel + "Nothing merges until you confirm."; collapsed second group (Mate) with "Review & merge"; explainer panel; tab row with count pill; AFSL-free footer (grep-verified: zero "AFSL"/licence strings).
- **Gate (§18.8)**: v1 scored **9.1/10** (vocabulary 9 · hierarchy 9 · psychology 9.5 · typography 9 · premium 9 · completeness 9 · polish 9). Adversarial pass findings: (a) empty state not in this screen — resolved by scope: the SHIPPED duplicates page already carries the approved empty-state card from design `124c6e36`; Fix B changes only its copy (§18.2.1 true tweak, code-first allowed); (b) build-time conformances: placeholder casing "Type MERGE to confirm", Material Symbols → Lucide mapping (same class of note as the approved Housekeeping pass).
- **Artefacts**: `.stitch/designs/housekeeping/duplicate-merge-edit-desktop-light-v1.{html,png}`. Dark + mobile variants remain the standing backfill per Reza's earlier ruling (pages ship dark-correct via theme tokens).

### Build Status
- [x] Design-only PR — no code paths changed; artefacts + docs only.

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Matrix design brief followed — structure, copy, interactions; §18.7.1 principles seeded into the prompt; deviation = routing correction, surfaced not silent) · Requirements 10/10 (two-zone kept/removed, survivor edit fields, typed-MERGE preserved, no merge-all, AFSL-free) · Logic 10/10 (design asserts no numbers; the one money line is labelled "Declared annual effect" matching the existing server-computed field)`
Coverage: the §18.8 score verifies the DESIGN against the rubric; it does NOT verify the built page — that is the Opus build + per-fix Chrome check after Reza's approval.

---

## Session: yhm8ug (continuation 17, 2026-07-23) — Fix B build: merge-with-edit (Housekeeping · Duplicate records)

### Changes Made
- **Type**: Feature (the Fix B build per the approved design `1ebd1ea2` (§18.8 9.1/10, merged #1486) + HANDOFF_dedup-accuracy-and-merge-edit.md §Fix B; Reza's "continue" after design approval routed the build here)
- **API**: `POST /api/intake/duplicates` accepts optional `survivorEdits { amount?, frequency?, isRecurring? }`. Validated whole-or-rejected (`validateSurvivorEdits` — finite amount ≥ 0, schema Frequency enum, boolean flag, unknown fields 400); applied by `applySurvivorEdits` ONLY to the survivor with `{ id, userId }` in the WHERE (§12.11), ONLY the fields present, inside the SAME `prisma.$transaction` as `executeMerge`, AFTER the existing server-side re-derivation + GROUP_STALE guard. `executeMerge` byte-untouched (stays the pure FK-repoint + delete engine). Audit log + response carry `survivorEditedFields`.
- **Page** (`app/dashboard/housekeeping/duplicates/page.tsx`): the flat table became the approved two-zone composition — emerald KEEPING panel (survivor with prefilled editable Amount / Frequency select / One-off⇄Recurring toggle + helper line), muted REMOVING panel (struck-through rows + "merges into the record above · links repointed"), amber recap chip listing exactly the fields that differ ("will also update: …"), typed-MERGE gate + disabled Confirm + Cancel + "Nothing merges until you confirm.", collapsed cards with "Keeping/Removing" preview + emerald-outline "Review & merge". An untouched merge sends NO survivorEdits — byte-identical to the pre-Fix-B request. Empty state re-worded to the design ("Nothing to merge"). No merge-all anywhere.
- **Rename**: "Duplicate income" → **"Duplicate records"** in the trailNav SSOT + HousekeepingShell tab (the list holds expense groups — QBE/AIA/Mate).
- **Effect on Reza's data**: QBE merges with type corrected to One-off; Mate merges with type corrected to Recurring Monthly — cadence fixed in the same deliberate step, per the live-review directive.

### Files Modified
- `lib/intake/duplicateMerge.ts` — VALID_FREQUENCIES + validateSurvivorEdits + applySurvivorEdits (new, pure); MergeDbClient.income gains updateMany; executeMerge untouched
- `app/api/intake/duplicates/route.ts` — survivorEdits validation + transactional apply step + audit/response fields
- `app/dashboard/housekeeping/duplicates/page.tsx` — two-zone rebuild to design 1ebd1ea2 (JSDoc updated)
- `lib/navigation/trailNav.tsx` + `app/dashboard/housekeeping/HousekeepingShell.tsx` — tab rename
- `tests/intake/duplicateMerge.test.ts` — +7 Fix B tests (validator gate incl. QBE/Mate shapes + whole-or-rejected; applier §12.11 WHERE lock; empty-edit no-op)
- `tests/housekeeping/relocation.test.ts` — rename lock (nav + shell say "Duplicate records", never "Duplicate income")

### Build Status
- [x] tsc clean · [x] duplicateMerge 15/15 + mon095 9/9 + relocation 5/5 · [x] `npm run build` passes · [x] `neomatrix:check` green (anchors :96/:158 unmoved — additions land after the modelled symbols; the new helpers are write-path, not calc producers) · [x] both lints green, no exception-count rise

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (built to the approved Stitch design + the HANDOFF §Fix B spec verbatim — separate edit step, pure executeMerge, same transaction, post-GROUP_STALE, canonical-path frequency storage with no inline arithmetic) · Requirements 10/10 (survivorEdits exactly as specified; no-edit merge byte-identical; rename included; no merge-all) · Logic 10/10 (whole-or-rejected validation; §12.11 WHERE {id,userId}; recap chip derives from the SAME changedEdits function that builds the payload — the chip can never lie about what will be written)`
Coverage: verifies the validator/applier semantics + topology in unit form; does NOT verify the rendered page or a live merge — that is Reza's QBE/Mate merges + the Matrix's final duplicates re-check after merge.

---

## Session: yhm8ug (continuation 18, 2026-07-23) — MON-088: family Medicare legs + private-hospital-cover capture (ALL USERS)

### Changes Made
- **Type**: Feature/Fix (tax-facing, `changesNumbers: yes` — Reza GO 2026-07-23 after the census + rule-matrix presentation; the family-income MLS rule confirmed by Reza in chat)
- **STEP-0 census (verified)**: the live Medicare $3,509 was computed-and-zero on the surcharge — `hasPrivateHealthInsurance` defaulted `true` in both twins (the engine silently asserted cover for every user), the tier lookup read own income vs singles tiers only, and the one caller passed `{ taxableIncome }` alone. §12.11/§12.12: additive nullable column, approval given with the GO.
- **ATO rule matrix implemented** (correcting the Matrix brief's example (c)): (1) cover is family ALL-OR-NOTHING — one uncovered member makes every over-threshold adult liable; (2) FAMILY MLS tier selected on COMBINED income vs family tiers (config-driven: singles × `medicareSurchargeFamily.singleMultiplier` + `dependentChildIncrease` per child after the first), surcharge levied on OWN income; (3) low-earner exception (own ≤ levy low single threshold → no MLS personally); (4) levy family-reduction leg now tests FAMILY income (no fabricated reduction for a low earner in a rich family; shade-in apportioned by own share).
- **Capture**: `HouseholdMember.hasPrivateHospitalCover Boolean?` (nullable = "not sure"; a blank NEVER silently asserts cover — conservatively uncovered) + additive migration + tri-state Yes/No/Not-sure control in the member dialog (Stitch screen `16e804559bf74af8b1c2b02d2e7f8b78`, §18.8 **9.2/10**) + both member APIs accept the field.
- **Feed**: `TaxPositionCalculationInput.medicareContext` threaded on BOTH Float+Decimal paths; `getUserTaxPosition` derives the context ONCE from HouseholdProfile/members; household bundle = combined income (spouseIncome 0); `perMember` = TWO-PASS through the ONE engine (pass 1 partitions → taxable incomes, pass 2 with spouse income) — no second producer (§12.2.1). Income-tax rates untouched (AU has no joint return) — locked by test.
- **Deliberately unchanged (surfaced)**: the engine parameter default stays `true` for the three estimate callers (salaryProcessor / incomeNormalizer / super-optimize) so salary/take-home projections don't silently change — named follow-up in the registry.
- **Golden re-pin (§19.2)**: golden household 30,724 → **32,284** — no profile recorded → conservatively uncovered SINGLE at $124,800 → 1.25% × 124,800 = $1,560 MLS. The pin's hand-computation updated in the test header.

### Files Modified
- `prisma/schema.prisma` + `prisma/migrations/20260723000000_mon088_private_hospital_cover/` — the additive nullable column
- `lib/tax-engine/types.ts` + `config/taxYearConfig.ts` — `MedicareSurchargeFamilyConfig` + per-FY values (2023-24/2024-25/2025-26); NO hardcodes in the engine
- `lib/tax-engine/core/medicareLevyCalculator.ts` — family MLS (combined tier / own base / low-earner / all-or-nothing cover) + family-income levy reduction, BOTH twins
- `lib/tax-engine/position/taxPositionCalculator.ts` — `medicareContext` input + threading (Float + Decimal)
- `lib/tax-engine/position/userTaxPosition.ts` — profile fetch, context derivation, per-member two-pass
- `app/api/household-members/{route,[id]/route}.ts` — accept the tri-state field
- `app/dashboard/household-profile/page.tsx` — the Yes/No/Not-sure control (design 16e80455…)
- `tests/tax/mon088MedicareFamily.test.ts` (NEW, 16 tests) + `tests/golden/ring2.taxParity.test.ts` re-pin
- Neomatrix: 3 nodes noted with the MON-088 lineage; anchors re-pinned (:55/:153/:377); `GENERATED_CORE.md` regenerated

### Build Status
- [x] tsc clean · [x] tax+golden+calculations 1,206 passed (after the documented golden re-pin) + mon088 16/16 · [x] `npm run build` passes · [x] `neomatrix:check` green · [x] both lints green · [x] `issues:check` 96 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (brief followed with TWO surfaced deviations — the ATO all-or-nothing cover rule replacing example (c), Reza-confirmed in chat; Boolean? replacing @default(false), presented + GO'd; Neomatrix consulted + updated same PR) · Requirements 10/10 (capture + feed both built, config-driven, both engine paths, per-member, form control designed ≥9/10 first) · Logic 10/10 (§19.2 worked examples (a)-(h) hand-computed; Float===Decimal; income tax provably unmoved; conservative direction verified — a blank can only overstate, never hide, a surcharge)`
Coverage: verifies the rule matrix, twin parity, position wiring, and cross-surface plumbing on the golden household; does NOT verify live rendered numbers or the member-dialog UX in a browser — that is Reza's cover entry + the Matrix's Ring-3 after merge.

---

## Session: yhm8ug (continuation 19, 2026-07-24) — MON-077: stale "Potential Missed Deductions" nudge (My Guide)

### Changes Made
- **Type**: Fix (advisory-only; `changesNumbers: no` — tax position/deductions/refund/Medicare untouched, VR-009 confirmed the math)
- **Root cause (verified)**: `identifyMissedDeductions` (`lib/cfo/decisionSupport/taxIntegration.ts:369-374` pre-fix) checked raw expense rows for an INTEREST entry per investment property — the pre-MON-045 world. Post-#1425 property loan interest is AUTO-CLAIMED into `taxPosition.deductions.property` from the loans (no expense row), so the panel false-positively listed "Loan interest for Thornland Lot 1 / Lot 2 / Broadbeach" directly under a deductions figure that already included it (§12.2.1-class un-reconciled advisory producer).
- **Solution (per the Matrix brief's own honest option)**: removed the loan-interest branch (auto-claimed interest is structurally never missable via this path); kept the GENUINE gaps (depreciation without a schedule, work-related without rows); class closed via the reconcile-against-canonical JSDoc rule on the function. Deviation-lite surfaced: did NOT thread `taxPosition` in as a parameter — the remaining checks detect ABSENT rows/schedules (which the canonical position cannot see) and read the same rows the engine consumes, so a parameter would be unused gold-plating (§0.3).
- **Ratchet**: `tests/cfo/mon077MissedDeductions.test.ts` (3 tests; the loan-interest case is RED on pre-fix code); `identifyMissedDeductions` exported for testability.
- **Routing note**: brief addressed Opus 4.8; executed on Fable 5 per the established session routing.

### Build Status
- [x] tsc clean · [x] tests/cfo 278 passed (incl. the new 3) · [x] `npm run build` passes · [x] `neomatrix:check` green (the modelled `calculateUnrealisedCGT:189` anchor unmoved — edits were below it) · [x] both lints green

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (brief followed; its own recommended "remove" option taken; the optional taxPosition-parameter deviation surfaced with reasoning, not silent) · Requirements 10/10 (false advisory removed; genuine gaps preserved; no tax-engine changes) · Logic 10/10 (no numbers move — display list only; the remaining checks cannot diverge from the engine because they read the same rows it consumes)`
Coverage: verifies the advisory list semantics in unit form; does NOT verify the rendered My Guide panel — that is the Matrix's live re-check after merge.

---

## Session: yhm8ug (continuation 20, 2026-07-24) — MON-097 (Neo-G4 · P1): wire the PSI overlay into the master tax orchestrator

### Changes Made
- **Type**: Fix/Feature (tax plumbing; `changesNumbers: yes-CONDITIONAL` — the wiring is real in both twins, but the STEP-0 census proved ZERO live movement today: PSI inputs are 100% uncaptured product-wide AND the live entity route bypasses the orchestrator)
- **Root cause (verified)**: `buildMasterTaxPosition` (`lib/tax-engine/orchestrator/masterTaxPosition.ts:204`, pre-fix :186) documented `classifyPsi` as a step-3 "per-entity advanced overlay" (:27-34, same list as trust-loss + company-loss) but the wiring was only completed for the loss rules — `classifyPsi` sat proven-but-unreachable (Neomatrix A6 island since the 2026-06-26 audit). ITAA 1997 Part 2-42 attribution could never appear in any orchestrated position.
- **Fix (mirrors the loss-rule overlay exactly)**: `input.psiByEntity?: Record<string, PsiInput>` → step-3.6 block in BOTH twins calls the ONE `classifyPsi` per entity into `crossCutting.psiByEntity`, pushes `psiClassifier` to `modulesInvoked`, and the aggregation ingests its citations (Part 2-42, s84-5, s87-15, s86-15, TR 2022/3) + the s86-60 `UC-PSI-DEDUCTION-RESTRICTIONS` UNCOMPUTED flag (surfaced, never silently defaulted). Decimal twin reuses the Float result type (trustDeedValidation precedent — overlay v1 doctrine: decorate, never mutate entity numbers).
- **The three surfaced gaps (honest scope, per census)**: (1) no schema/EntityTaxFacts/assembler field captures PSI inputs — a capture feature is the named follow-up before any live number can move; (2) `/api/tax/entity/[entityId]` calls `calculateEntityTaxPositionDecimal` directly, bypassing `buildMasterTaxPosition` (whose only non-test consumers are calc-audit adapters) — a G4-class reachability gap queued for the P2/P3 briefs; (3) the s86-60 net-attribution calc is the engine's own flagged future sub-PR (v1 reports gross attribution + the flag).
- **Ratchet**: `tests/tax/mon097PsiOverlay.test.ts` (5 tests, RED pre-fix): attribution + PSB + absent-input byte-parity + flag surfacing + Float===Decimal across 4 cases.
- **Neo-sync (§21.2.1)**: `engine.tax.psi.classifyPsi` REMOVED from `A6_ISLAND_ALLOWLIST` (graphlib.mjs — allowlist shrinks 3→2; div152/fteIee remain queued); `feeds` edge added to the orchestrator; both orchestrator anchors re-pinned 186→204 (the import/type additions shifted the symbol); node authority updated wired+honest-scope; `GENERATED_CORE.md` regenerated; `neomatrix:check` green.

### Files Modified
- `lib/tax-engine/orchestrator/masterTaxPosition.ts` — import, `psiByEntity` input (capture-gap JSDoc), CrossCutting types, step-3.6 wiring + citation/flag ingestion in BOTH twins
- `tests/tax/mon097PsiOverlay.test.ts` (NEW, 5 tests)
- `scripts/neomatrix/graphlib.mjs` — allowlist entry removed (comment updated with the wired date)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — edge + re-pins + node update
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-097 raised → DIAGNOSED with the full census verdicts + plain trio

### Build Status
- [x] tsc clean · [x] mon097 5/5 + tax/golden/neomatrix/issues 1,361 passed · [x] `npm run build` passes · [x] `neomatrix:check` green (A6 allowlist 3→2) · [x] both lints green, no exception-count rise · [x] `issues:check` 97 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Neo-G4 P1 brief followed — STEP-0 census a-d completed FIRST with all four verdicts recorded; the loss-rule overlay pattern mirrored verbatim per the orchestrator's own v1 doctrine; Neomatrix consulted + moved same PR) · Requirements 10/10 (both twins wired; UNCOMPUTED surfaced never defaulted; ratchets a-d; unwired→wired neo-sync; three gaps SURFACED not papered over) · Logic 10/10 (absent input = byte-identical output, locked by test; Float===Decimal locked; the ONE classifier remains the only producer — the orchestrator calls it, never re-implements)`
Coverage: verifies the wiring semantics + twin parity + no-input inertness in unit form; does NOT verify any live rendered number (none can move — census gaps 1+2) and does NOT verify the s86-60 net calc (the engine's own flagged follow-up).

---

## Session: yhm8ug (continuation 21, 2026-07-24) — MON-098 (Neo-G4 · P2): wire the FTE/IEE overlay into the master tax orchestrator

### Changes Made
- **Type**: Fix/Feature (tax plumbing; `changesNumbers: yes-CONDITIONAL` — the wiring is real in both twins, but the STEP-0 census proved ZERO live movement today: FTE/IEE beneficiary facts partially uncaptured AND the live entity route bypasses the orchestrator)
- **Root cause (verified)**: `buildMasterTaxPosition` (`lib/tax-engine/orchestrator/masterTaxPosition.ts:224`, pre-fix :204) documented `classifyFteIeeDistributions` as a step-3 overlay (:27-34) but never called it — the second of the three Neo-G4 unwired engines (A6 island since 2026-06-26). Sch 2F FTDT (47% on outside-family distributions) + Pt VA TFN withholding (47% on non-quoting beneficiaries) could never appear in any orchestrated position.
- **Fix (mirrors MON-097 / the loss-rule overlays exactly)**: `input.fteIeeByEntity?: Record<string, FteIeeInput>` → step-3.7 block in BOTH twins calls the ONE `classifyFteIeeDistributions` per FTE-electing trust into `crossCutting.fteIeeByEntity`, pushes `fteIeeClassifier` to `modulesInvoked`; aggregation ingests citations (Sch 2F, s272-75, s272-85, s272-95, s271-15, Pt VA) + UNCOMPUTED flags (`UC-FTDT-OUTSIDE-FAMILY`, `UC-FTE-CONTROL-TEST`) — surfaced, never silently defaulted. The 47% rate stays in the engine (`FAMILY_TRUST_DISTRIBUTION_TAX_RATE` / per-input override) — never re-hard-coded (§12.14). Decimal twin reuses the Float result type (trustDeedValidation/PSI precedent).
- **The surfaced gaps (honest scope, per census)**: (1) capture is PARTIAL — `hasFamilyTrustElection` + per-beneficiary gross distributions exist (DistributionResolution → entityTaxFactsAssembler), but the Sch 2F `relationship` / `hasQuotedTfn` / `coveredByIee` beneficiary facts have ZERO occurrences outside the engine — capture feature is the named follow-up; (2) **reachability decision (brief census d): DEFERRED, documented** — `/api/tax/entity/[entityId]` calls `calculateEntityTaxPositionDecimal` directly, bypassing the orchestrator; routing a live money path through `buildMasterTaxPosition` is its own census-heavy change (Part 24 one-issue-one-PR), so all three overlays stay test/tool-only until capture + reachability land.
- **Ratchet**: `tests/tax/mon098FteIeeOverlay.test.ts` (6 tests, RED pre-fix): inside-family clean / outside-family FTDT $47,000 on $100,000 / TFN withholding $37,600 on $80,000 regardless of relationship / control-test + IEE surfacing / absent-input byte-parity / Float===Decimal across 5 cases.
- **Neo-sync (§21.2.1)**: `engine.tax.fteIee.classifyFteIeeDistributions` REMOVED from `A6_ISLAND_ALLOWLIST` (2→1 — only `applyDiv152` remains, P3); `feeds` edge added to the orchestrator; both orchestrator anchors re-pinned 204→224; PSI node/edge line refs refreshed (:310/:625); node authority updated wired+honest-scope; `GENERATED_CORE.md` regenerated; `neomatrix:check` green.

### Files Modified
- `lib/tax-engine/orchestrator/masterTaxPosition.ts` — import, `fteIeeByEntity` input (partial-capture JSDoc), CrossCutting types, step-3.7 wiring + citation/flag ingestion in BOTH twins
- `tests/tax/mon098FteIeeOverlay.test.ts` (NEW, 6 tests)
- `scripts/neomatrix/graphlib.mjs` — allowlist entry removed (2→1, comment updated)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — edge + re-pins + node update
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-098 raised → DIAGNOSED with census verdicts + plain trio

### Build Status
- [x] tsc clean · [x] mon098 6/6 + mon097 5/5 + tax/tax-engine/golden/neomatrix/issues 1,367 passed · [x] `npm run build` passes · [x] `neomatrix:check` green (A6 allowlist 2→1) · [x] both lints green, no exception-count rise · [x] `issues:check` 98 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (P2 brief followed — STEP-0 census a-d completed FIRST with the reachability DECISION stated (deferred, documented), the MON-097 template mirrored verbatim; Neomatrix consulted + moved same PR) · Requirements 10/10 (both twins wired; 47% rate engine-owned never re-hard-coded; UNCOMPUTED surfaced never defaulted; ratchets a-d; allowlist 2→1) · Logic 10/10 (§19.2 hand-computed FTDT $47,000 / withholding $37,600 locked; absent input = byte-identical, locked; Float===Decimal locked; ONE producer — the orchestrator calls, never re-implements)`
Coverage: verifies the wiring semantics + twin parity + citation/flag aggregation + no-input inertness in unit form; does NOT verify any live rendered number (none can move — census gaps 1+2) and does NOT verify the classifier's internals beyond the worked examples (calc-audit's fixtures + its own 25-case suite own those).

---

## Session: yhm8ug (continuation 22, 2026-07-24) — MON-099 (Neo-G4 · P3): wire the Div 152 overlay — the A6 island list is now EMPTY

### Changes Made
- **Type**: Fix/Feature (tax plumbing; `changesNumbers: yes-CONDITIONAL` — wiring real in both twins, ZERO live movement: Div 152 inputs 100% uncaptured + the live entity route bypasses the orchestrator)
- **Root cause (verified)**: `buildMasterTaxPosition` (`lib/tax-engine/orchestrator/masterTaxPosition.ts:245`, pre-fix :224) documented `applyDiv152` as a step-3 overlay (:27-34) but never called it — the THIRD and LAST Neo-G4 unwired engine. Product-wide: a small-business active-asset capital gain got NO Div 152 concession (15-year exemption s152-105, 50% active-asset reduction s152-205, retirement exemption s152-305/310, rollover s152-410) — over-taxed with no relief applied.
- **Fix (mirrors MON-097/098 with ONE deliberate upgrade)**: `input.div152ByEntity?: Record<string, Div152Input>` → step-3.8 block in BOTH twins; **the Decimal twin uses the engine's TRUE Decimal sibling `applyDiv152Decimal` with `Div152ResultDecimal`** — the loss-rule precedent (PSI/FTE reused the Float type only because those engines lack Decimal siblings). Citations (Div 152, s152-10/105/205/305/310/410, s152-15) + UNCOMPUTED flags (UC-DIV152-AGGREGATION near MNAV/turnover thresholds, UC-DIV152-RETIREMENT-CAP, UC-DIV152-ROLLOVER) aggregate to the top level — surfaced, never silently defaulted. Thresholds stay engine-owned (MNAV_THRESHOLD $6M / turnover $2M / retirement cap $500k) — never re-hard-coded (§12.14).
- **MILESTONE**: `A6_ISLAND_ALLOWLIST` is now **EMPTY** — every built tax engine reaches the live position. Recorded in graphlib.mjs with the future-entry rigor note.
- **The surfaced gaps (unchanged class)**: (1) Div 152 inputs captured NOWHERE (grep: zero occurrences outside engine+tests) — capture feature is the named follow-up; (2) reachability rides the MON-098 deferral (documented): `/api/tax/entity/[entityId]` bypasses the orchestrator — all three overlays stay test/tool-only until capture + reachability land.
- **Ratchet**: `tests/tax/mon099Div152Overlay.test.ts` (7 tests, RED pre-fix): 15-year exemption ($200k → $0) / 50% AAR ($200k → $100k) / basic-conditions fail ($200k unchanged) / near-threshold aggregation flag (warns, never zeroes) / retirement lifetime cap ($300k gain, $400k used → applied $100k → assessable $50k, cap flag) / absent-input byte-parity / Float===Decimal across 6 cases (numeric comparison — Decimal twin returns true Decimals).

### Files Modified
- `lib/tax-engine/orchestrator/masterTaxPosition.ts` — Float + Decimal imports, `div152ByEntity` input (capture-gap JSDoc), both CrossCutting types (Decimal uses `Div152ResultDecimal`), step-3.8 wiring + ingestion in BOTH twins
- `tests/tax/mon099Div152Overlay.test.ts` (NEW, 7 tests)
- `scripts/neomatrix/graphlib.mjs` — allowlist EMPTIED (1→0) with the Neo-G4 completion note
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — Div 152 edge + node wired-update; orchestrator anchors re-pinned 224→245; PSI/FTE refs refreshed (:331/:673, :346/:685)
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-099 raised → DIAGNOSED (census + plain trio)

### Build Status
- [x] tsc clean · [x] mon099 7/7 + mon098 6/6 + mon097 5/5 + suites 1,374 passed (87 files) · [x] `npm run build` passes · [x] `neomatrix:check` green (A6 allowlist EMPTY) · [x] both lints green, no exception-count rise · [x] `issues:check` 99 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (P3 brief followed — census a-d FIRST; reachability rides the documented MON-098 deferral; ONE surfaced upgrade vs the brief: the Decimal twin uses applyDiv152Decimal/Div152ResultDecimal (the engine's true sibling, loss-rule precedent) rather than reusing the Float type — strictly closer to the established pattern, stated not silent) · Requirements 10/10 (both twins; thresholds engine-owned; UNCOMPUTED surfaced; ratchets a-d; allowlist EMPTIED) · Logic 10/10 (§19.2 hand-computed: 15-yr $0, AAR $100k, cap-bound retirement $50k assessable with $100k applied; absent input byte-identical, locked; Float===Decimal locked numerically)`
Coverage: verifies wiring semantics + twin parity + flag aggregation + inertness in unit form; does NOT verify any live rendered number (none can move — gaps 1+2), does NOT verify the engine's internal stacking beyond the worked examples (its own suites + calc-audit shadow-parity fixtures own those), and does NOT fold the concession into entity totals (overlay v1 doctrine — a v2 orchestrator decision, same as PSI/FTE).

### Push note
Built while PR #1499 (MON-098) was still open on the same branch — commit held locally and pushed AFTER #1499 merged (Part 24 one-issue-one-PR; the branch hosts one open PR at a time).

---

## Session: yhm8ug (continuation 23, 2026-07-25) — MON-100 (capture Stage 0): the entity tax route goes THROUGH the orchestrator — the Neo-G4 reachability unlock

### Changes Made
- **Type**: Fix/Feature (tax plumbing; `changesNumbers: yes-CONDITIONAL` — parity by construction today, overlays reach the live path when capture ships)
- **Root cause (verified)**: `/api/tax/entity/[entityId]` (GET :84 / POST :488 pre-fix) called `calculateEntityTaxPositionDecimal` directly, bypassing `buildMasterTaxPosition` — the reachability gap documented in MON-097/098/099: even captured overlay inputs could never reach the wired step-3 overlays on the live route.
- **Fix**: both handlers now build via `buildMasterTaxPositionDecimal({ userId, fy, entities: [facts] })` and take `entityPosition = master.entities[0]`. **Parity by construction**: the orchestrator maps the IDENTICAL `calculateEntityTaxPositionDecimal` over `input.entities`, so the response is byte-identical today (locked by test). Additive `crossCutting` passthrough in the response only when overlay keys exist (none until capture) — the JSON contract is unchanged for all current consumers. Per-entity boundary computation preserved verbatim.
- **Census (direct-caller sweep)**: exactly two direct consumers outside the orchestrator existed — this route (both handlers, now rerouted) and `lib/services/wealthGraphService.ts:489` (**reviewed exception, status-only**: renders `uncomputed.length` as the Money Flow canvas badge, never a tax dollar — kept, documented, locked in the topology test).
- **Ratchet**: `tests/tax/mon100EntityRouteParity.test.ts` (6 tests): reroute parity across 3 facts shapes (personal income/expense, discretionary-trust distribution, CGT event), empty-crossCutting response invariance, and the **class lock** — no file under `app/` may import `entityTaxRouter` directly again.
- **Neo-sync (§21.2.1)**: both orchestrator node authorities annotated LIVE-REACHABLE with the MON-100 note + the reviewed exception; anchors untouched (masterTaxPosition.ts unmodified); `GENERATED_CORE.md` regenerated; `neomatrix:check` green. Route-kind nodes don't yet exist in the graph (zero instances) — inventing that pattern is deferred, stated not silent.
- **Process**: FIRST PR on the per-issue-branch pattern (`claude/mon-100-entity-tax-reachability-yhm8ug` cut from main `6b2ded9c`) — kills the routine PR-out-of-date cycle Reza flagged.

### Files Modified
- `app/api/tax/entity/[entityId]/route.ts` — orchestrator import, both handlers rerouted, header JSDoc, additive crossCutting passthrough
- `tests/tax/mon100EntityRouteParity.test.ts` (NEW, 6 tests)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — orchestrator LIVE-REACHABLE annotation
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-100 raised → DIAGNOSED (census + plain trio)

### Build Status
- [x] tsc clean · [x] mon100 6/6 + tax/tax-engine/golden 1,230 passed (81 files) + neomatrix/issues green · [x] `npm run build` passes · [x] `neomatrix:check` green · [x] both lints green, no exception-count rise · [x] `issues:check` 100 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (Stage 0 executed FIRST per the brief's own ordering — "the true unlock; capture without it is still inert"; the brief's route-vs-adapter fork resolved as ROUTE-THROUGH with the wealthGraph status-only exception documented, stated not silent) · Requirements 10/10 (single path through the ONE orchestrator; Ring-1 class lock shipped; safe default preserved — response byte-identical without overlay inputs) · Logic 10/10 (parity is by CONSTRUCTION — same function, same facts — and additionally locked by deep-equality tests across 3 shapes; the crossCutting passthrough is additive-only)`
Coverage: verifies reroute parity, response invariance without overlays, and the import topology; does NOT verify the rendered page (no pixel can change — parity) and does NOT make any overlay live (capture Stages 1-3 do that).

---

## Session: yhm8ug (continuation 24, 2026-07-26) — MON-101 (capture Stage 1): FTE/IEE beneficiary facts captured — the first overlay made live-capable

### Changes Made
- **Type**: Feature (schema + assembler + Stitch-first UI; `changesNumbers: yes-CONDITIONAL` — fires ONLY on a trust with the election ON + complete beneficiary facts + a triggering distribution; everyone else byte-identical, locked)
- **Reza GO (2026-07-26)** on the three presented items: the Stitch design (screen `f395b67e4d24476e9ae4d6c7fa8b200b`, §18.8 **9.2/10**, v1 7.5 → v2 9.2: red→amber, invented brand eyebrow + fabricated legal footer removed, controls made real), the three nullable schema columns, and the **all-or-nothing safe default**.
- **Schema (§12.12, Reza's migration click)**: `FamilyGroupRelationship` enum (mirrors the engine) + `DistributionAllocation.relationship?/hasQuotedTfn?/coveredByIee?` — additive nullable; migration `20260726000000_mon101_fteiee_beneficiary_facts` (CREATE TYPE + 3 ADD COLUMN, no row touched).
- **The load-bearing rule**: neither direction of defaulting `hasQuotedTfn` is safe (null→false FABRICATES a 47% withholding; null→true suppresses one) → `buildFteIeeInput` (the ONE producer, `entityTaxFactsAssembler.ts:118`) returns null unless the election is ON AND every allocated beneficiary has `relationship` + `hasQuotedTfn` explicitly set. `distributionAmount = share × trustNetIncome` — the same s95 base as the Div 6 allocation. `assembleFteIeeInput` reads the SAME operative resolution as the trust-distribution feed (one source).
- **Flow**: dialog → POST `/api/tax/distribution-resolutions` (validated; unknown → null) → service persists → assembler gates → entity route GET feeds `fteIeeByEntity` into the Stage-0 orchestrator path → the MON-098 overlay fires with citations + flags.
- **UI (per the approved design)**: election Yes/No pill + consequence note; per-beneficiary card (when ON): relationship select (warm labels), TFN Yes/No/Not-sure tri-state, conditional IEE tri-state on OUTSIDE_FAMILY with the amber FTDT consequence panel; "Not sure = rules stay off" note; honesty footer. Stitch artefacts committed: `.stitch/designs/capture-stage1/record-split-fteiee-dialog.{html,png}`; screen ID in the component JSDoc.
- **Ratchet**: `tests/tax/mon101FteIeeCapture.test.ts` (6 tests): gate closed on election-off / missing-relationship / Not-sure-TFN; complete facts → correct input; §19.2 worked example **FTDT $18,800 = 0.47 × (40% × $100,000)** end-to-end through BOTH twins with s271-15 cited; gate-closed byte-parity.
- **Neo-sync (§21.2.1)**: `buildFteIeeInput` modelled (node + feeds edge to the classifier with the route evidence); `buildDiv7aLoansFromBenefits` anchor re-pinned 79→80 (import shift); `GENERATED_CORE.md` regenerated; `neomatrix:check` green.

### Files Modified
- `prisma/schema.prisma` + `prisma/migrations/20260726000000_mon101_fteiee_beneficiary_facts/`
- `lib/services/distributionResolutionService.ts` — input + create + summary carry the facts
- `app/api/tax/distribution-resolutions/route.ts` — validated acceptance
- `lib/services/entityTaxFactsAssembler.ts` — `buildFteIeeInput` + `assembleFteIeeInput` (the ONE producer)
- `app/api/tax/entity/[entityId]/route.ts` — GET feeds `fteIeeByEntity`
- `components/wealth-explorer/TrustDistributionsSection.tsx` — the approved dialog controls + JSDoc Stitch ref
- `tests/tax/mon101FteIeeCapture.test.ts` (NEW, 6) · `.stitch/designs/capture-stage1/*` · graph + registry + docs

### Build Status
- [x] tsc clean · [x] mon101 6/6 + tax/tax-engine/golden/neomatrix/issues/intake 1,457 passed (95 files) · [x] `npm run build` passes · [x] `neomatrix:check` green · [x] both lints green · [x] `issues:check` 101 valid

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (built to the approved Stitch design + the capture brief's Stage-1 spec; §18.2.1 Stitch-first honoured — design approved BEFORE build; §12.12 migration in-PR for Reza's click) · Requirements 10/10 (schema + service + API + assembler + route feed + UI, all through the ONE producer; safe default exactly as approved) · Logic 10/10 (§19.2 hand-computed FTDT $18,800 locked end-to-end both twins; the all-or-nothing gate proven in all three failure directions; same-s95-base documented; gate-closed = byte-identical, locked)`
Coverage: verifies the gate, the mapping, and the orchestrator flow from a built input; does NOT verify the Prisma read path of `assembleFteIeeInput` (Ring-3 on a seeded trust owns that) and does NOT verify the rendered dialog (Reza's eyeball + Ring-3).
