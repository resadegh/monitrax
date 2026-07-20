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
