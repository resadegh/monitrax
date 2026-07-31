# Changelog - 2026-07-31

## Session: MON-131 T1-B — the income flip (PR #1545, draft)

### Changes Made
- **Type**: Fix (MON-128 / MON-137 / MON-138) + Feature (FACT-field intake)
- **Scope**: income architecture — every income surface onto the ONE banked producer
- **Root Cause**: five independent legacy re-derivations of "income" (stored-field trust, gross≡net degradation, double PAYG deduction with a third invented figure, one-off annualisation, stale stored withholding) — the §12.2.1 duplicate-source class, measured on real data in VR-042/VR-043.
- **Solution**: the T1-B flip. Consumers wired onto `lib/income/banked/*` (D17/D20, shipped T1-A); legacy producers DELETED citing contracts; §1.1 two-pass wedge credit on the canonical tax position; MON-138 floor-based band selection; intake for `actualNetPay` + `helpLoanDeclared` (tri-state, never defaulted).

### Files Modified (principal)
- `lib/calculations/cashflowOrchestrator.ts` — rewritten: `BankedIncomeTotals` input; internal income producer (MON-137 culprit) deleted; DR-4 collapse.
- `lib/services/masterFinancialService.ts` — flipped: tax position first, banked breakdown/cashflow/per-row entity attribution; `adjustPropertyRentalIncome` deleted.
- `lib/tax-engine/position/taxPositionCalculator.ts` + `userTaxPosition.ts` + `lib/income/banked/salaryBanked.ts` — §1.1 `derivedPaygWithheldAnnual` override (Float+Decimal) + `salaryWithholdingWedgeAnnual` + two-pass.
- `lib/tax-engine/position/repaymentIncome.ts` — `assembleRepaymentIncome` moved to its pure home (assembly.ts re-exports).
- `lib/health/buildHealthInput.ts` · `lib/services/moneyFlowService.ts` · `app/api/portfolio/snapshot/route.ts` · `lib/cashflow/buildCFEInput.ts` · `app/api/cashflow/{summary,intelligence}` · `app/api/ai/debt-analysis` · `lib/intelligence/portfolioEngine.ts` · `lib/testing/exporter.ts` · `app/dashboard/income/page.tsx` — consumers migrated; local income re-derivations deleted.
- DELETED: `lib/cashflow/incomeNormalizer.ts` · `lib/income/netIncomeCalculator.ts` · `lib/calc-audit/engines/decimal-cashflow.ts` (+ its test) · `aggregateIncome`+siblings (types survive).
- `app/api/income/route.ts` + `[id]/route.ts` + income form — FACT-field intake.
- `app/api/admin/matrix/golden-baseline/t1-income/route.ts` — §1.3 `rentalTaxableGrossDeclared` per-row attribution.
- `lib/matrix/goldenBaseline.ts` — §1.4 `VOLATILE_LEAF_PATTERNS`.
- calc-audit: `income.bankedAggregator` is the inventory home; `bankedIncomeAdapter` (user-audit §5.6 identities); `core.incomeAggregator` + income shadows retired with their engines.
- Neomatrix (same PR): 3 legacy nodes deleted, 7 consumer edges repointed, `getUserTaxPosition → number.taxPayable` (A3 restored), 12 anchors re-pinned, Layer-0 structural + manifest maintained; `neomatrix:check` OK end-to-end.
- Ratchets: producer census reseeded (all falls; two attributed exceptions vs pre-T1 recorded in the ledger); source-lock down 11 entries; financial-math baseline 3 line-shifts + 2 pruned (paid down).
- Registry: MON-128/137/138 → FIXING (sweeps + plain trios + PR refs); MON-139 raised (Home basis contradiction → T6); 3 issues' semanticKeys repointed to the successor node.

### §19.2 / §19.4 evidence
Declared moves computed on LIVE prod through the T1-A relay (VR-043 §3) and committed in `.audit/expected-moves-t1.json` BEFORE the first migration commit. Worked examples: wedge 347,162.61 − 304,158.61 = 43,004.00 exact; refund = 43,004 − netTax 37,786 ≈ +5,218; banked monthly 304,158.61 ÷ 12 = 25,346.55. Downstream sweep = the expectedMoves path list + the registry `downstreamConsumers` on MON-128/137. Propagation locks: golden-master snapshots (declared class), Ring-2 golden-household paths, §5.6 identity property tests, A3 convergence.

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (T1-B brief §1–§7 re-read; ledger §3; Neomatrix consulted+updated) · Requirements 10/10 · Logic 10/10` — coverage boundary: suites verify engines/identities/golden paths/ratchets; they do NOT verify real-data rendered values (post-merge Matrix re-capture + Ring-3 §5.5; §5 acceptance is revert-on-mismatch).

### Build Status
- [x] TypeScript compiles (`npx tsc --noEmit` clean at every commit)
- [x] vitest: 303 files / 4,387 tests green (69 skipped)
- [x] `lint:financial-surfaces` + `lint:source-lock` + `census:producers --check` + `neomatrix:check` + `issues:check` all green
- [ ] `npm run build` — Vercel preview CI is the record

### Commit History
| Hash | Message |
|------|---------|
| d59419ea | G3 — expectedMoves filled from VR-043 §3 |
| 34f45a3f | MON-138 floor bands, one-FY composer, §1.4 volatile leaves |
| 86f467f8 | core flip (orchestrator + master + routes) |
| 35dc5e46 | test migration to the banked path |
| 304da2e5 | §1.1 two-pass withheld credit |
| 8e8dc0e4 | consumer wiring (health/moneyFlow/snapshot/CFE/debt/exporter) |
| 5cdd79a3 | deletion sweep + ratchets |
| 147d8441 | intake UI + API + §1.3 attribution |
| 43fadd39 | neo-sync |
| (this) | registry FIXING + docs + baselines |

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1545 (draft)
- Status: Open — awaiting Reza's review of the before/after table; §5 acceptance post-merge is revert-on-mismatch.

---

## Session: g8kra5 — VR-045 Ring-3 handout (post-MON-140) + ledger correction

### Changes Made
- **Type**: Docs / operational procedure
- **Scope**: NeoAudit Ring 3 — the verification instrument for the T1 income tranche
- **Why**: VR-044 FAILED the T1-B flip (22 declared paths missed; two Income figures 3.1× apart live on Home). #1548 fixed the mechanism. §24.2 #7 requires a per-fix number verification before MON-128/137/140 can leave `FIXING`, and there was no handout for it.
- **Solution**: `RING3_VR045_T1_REPAIR.md` — the scoped overlay that pins every declared path next to its VR-044 failure value, so a non-repair is unmistakable rather than inferred. It does **not** replace the canonical §3.3 sweep; §0 sequences that first (playbook §3.2 rule 1).

### Files Modified
- `docs/verification/briefs/RING3_VR045_T1_REPAIR.md` — **new**. §0 run order + VR-044 §7 identity rules · §1 mechanism + repair · §2 the 22 declared paths · §2b MON-138 reachability capture · §3 Home one-income-story (`moneyFlowService` ≡ `masterFinancialService` at 304,158.61) · §4 `mustNotMove` cluster · §5 pre-declared non-findings · §6 verdict format · §7 gate.
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — Tranche-1 block: **corrected the "VR-044's rendered half is VOID" claim** (it is not — §7 records the *first attempt* as void and the filed run as the valid re-run with identity asserted); G7/G8 rows filled with their VR-044 FAIL state + the VR-045 instrument; MON-138 named as the tranche's fourth still-FIXING member.
- `docs/changelog/CHANGELOG_2026_07_31.md` — this entry.
- `docs/IMPLEMENTATION_PLAN.md` — `Last updated` bumped.

### Two corrections this session made to its own prior work
1. **MON-138 was missing from the handout.** The first version named only MON-128/137/140, so a clean §2/§3/§4 PASS would have read as "the T1 tranche is closed." `.audit/expected-moves-t1.json` `_meta.tranche` declares MON-128 + MON-137 + MON-138. Since MON-138 is `changesNumbers: true`, §23.2.3 forbids closing it on the Ring-0 fixture alone (`mon128T1WithholdingConfig.test.ts:121`) — but Ring 3 may have **no reachable surface** for it on Reza's account. §2b therefore asks for a capture with a pre-decided disposition, rather than sweeping it into a tranche PASS (the `FIX_PROTOCOL.md` §1 F3 failure).
2. **The ledger's VOID claim.** Left standing, a future session would have discarded VR-044's rendered evidence — which is precisely what proves the `mustNotMove` cluster held 13/13 and what caught the two live Home income figures.

### Build Status
- [x] Docs-only — no code, no engine, no schema, no registry lifecycle move
- [x] Every figure traced to source (`VR-044.md`, `.audit/expected-moves-t1.json`, `userTaxPosition.ts:286-288`, `goldenBaseline.ts:172`, `mon128T1WithholdingConfig.test.ts:121`) — none from memory

### Registry
No lifecycle moves. MON-128 · MON-137 · MON-138 · MON-140 all remain `FIXING` — nothing verifies them until VR-045 runs.

### PR
- PR #1550 — **MERGED** 2026-07-31 (main `3cdaa8c4`); §17.2 verified, prod `dpl_9sEh6tx8KRXmDfzLKr4ozYdEmz6G` READY
- Follow-up PR (this doc-sync) — the §11/§15/§16 record #1550 should have carried in the same PR

---

## Session: g8kra5 (cont.) — VR-045 processed + the MON-131 change record + its gate

### Changes Made
- **Type**: Docs / registry lifecycle / CI gate
- **Scope**: MON-131 programme record; Tranche 1 closure
- **Why**: Reza — *"I need you to document all changes for MON-131 and keep it updated."* Auditing to build that record found VR-045 had landed as a run doc with **no processing**: four issues still `FIXING`, two artefact defects it reported unfixed, and one finding unraised.

### VR-045 processed (the run itself was PR #1551)
- **Registry ×4 → `VERIFIED`** with `test` + resolving `semanticKeys` on each (gate: 128 issues valid): MON-128 (`tests/income/bankedIncome.test.ts`) · MON-137 (`tests/calculations/aggregatorEntityScoping.test.ts` — pins the culprit removal: the orchestrator no longer computes income) · MON-138 (`tests/tax/mon128T1WithholdingConfig.test.ts`) · MON-140 (`tests/income/bankedInputFeed.test.ts`).
- **`.audit/expected-moves-t1.json` corrected** — `cashflow.annualCashflow`/`.annualSurplus` `180,572.52 → 180,572.50`. Per VR-045 §2.1 the **declaration** was wrong, not the engine: it was derived as rounded-monthly `15,047.71 × 12`, propagating 2c the engine's annual-component derivation (`304,158.61 − 17,786.31 − 105,799.80`) does not. Recorded under a new `_meta.declaredCorrections`.
- **`RING3_VR045_T1_REPAIR.md` §3 corrected** — VR-045 §6 proved four "consequential figures must return to their pre-T1-B values" expectations **arithmetically wrong**; every one is income-derived and income legitimately fell, so a literal run would have produced **four false failures**. My error, caught by the Matrix.
- **`VERIFICATION_PLAYBOOK.md` §3.3 gains the standing lens** — a figure downstream of a declared move belongs in `expectedMoves` with its own arithmetic, never in a "must return" list.
- **MON-141 raised** (VR-045 §7) — `/dashboard/income` $22,579 vs Home $25,347; the whole $2,768 gap is the rental basis (declared $121,227/yr vs actuals $154,443/yr), which VR-043 §4 already established as legitimately distinct quantities. Raised as a naming/design question, `changesNumbers: false`, with the decision left to Reza.

### The deliverable
- **`MON-131_TRANCHE_LEDGER.md` §6 — the change record.** Every merged MON-131 PR with its SHA, what changed, and whether numbers moved, grouped Instrumentation/Phase A · Preconditions · Tranche 1 · Tranches 2–7. Placed in the ledger rather than a new file because §1 already declares this the state of record — a second history doc would be §12.2.1 at the documentation layer.
- **`MON-131_TRANCHE_LEDGER.md` §7 + `scripts/check-mon131-ledger.mjs` (`npm run mon131:check`)** — the keep-it-updated mechanism. A diff touching a MON-131 surface (banked engines, matrix relay, `expectedMoves`, census, the MON-131 doc set, verification runs/briefs, or a MON-131-family registry move) must touch the ledger too. Wired into `docs-hygiene` **`--strict`** — deliberately unlike the two soft-launch F-1 guards, and the workflow header now says so plus the honest caveat that this workflow is not yet a required check.
- **Tranche 1 gates G7–G11 closed** in §3 with VR-045 evidence; tranche status `IN BUILD → DONE`.

### Coverage — stated precisely
The gate verifies that the ledger **was touched**. It does **not** judge whether the row is truthful or even related — a machine cannot tell an evidence row from a placeholder; that stays §1's job and the reviewer's. It is also diff-scoped, so a MON-131 change with no file overlap is invisible to it.

### Build Status
- [x] `npm run issues:check` — 128 valid
- [x] `npm run mon131:check` — exercised in both directions (passes with the ledger, fails without)
- [x] Docs/registry/CI only — no engine, no schema, no number moved

### PR
- Follow-up to #1550 (handout) / #1551 (VR-045 run) / #1552 (doc-sync)

---

## Session: g8kra5 (cont. 2) — T2 pre-build research: §2.1 resolved, MON-142 raised

### Changes Made
- **Type**: Research / registry / CI gate fix
- **Scope**: MON-131 Tranche 2 (loan cost, MON-130) — **no migration, no number moved**
- **Why**: the T2 brief §2.1 required the 0.9370 factor explained *before* any loan number is declared, on the grounds that migrating onto a 6.3%-understated producer would ship a wrong number with more authority than the one it replaced.

### §2.1 — resolved, and it inverts the brief's risk
The averaging algorithm was **cleared by running it**, not by reading it: `calculateMonthlyAverage` uses `totalDays = daysSpan + avgInterval` (= N × interval), so `monthly = payment/interval × 30.4375`. A probe of 12 monthly payments at contractual interest returns **ratio 1.00000 exactly**, and is scale-free in N (Reza's ~2 months of data still averages correctly for what it covers). All four candidate causes in the brief — short window, partial period, day-count, missing payment — eliminated.

The factor is the **stored rate**: `1191×12/228,000 = 6.268%` and `2518×12/482,000 = 6.269%` — the same implied rate from two different balances. Reza confirmed rates changed and that he does not recall updating them in Monitrax. **T2 is UNBLOCKED**: the actuals path is trustworthy.

### MON-142 raised (`high`, `changesNumbers: true`)
Stored 6.690% vs bank-charged ~6.268% = **0.422pp = $2,993/yr** across the two IO loans. Exposure stated precisely: `propertyLoanInterest` is actuals-first and only falls back to `(principal − offset) × storedRate` when the Phase 51 ledger is empty — likely with 2 months of data, **not confirmed** without a relay capture. The loan-cost interest floor uses the same rate. 14 files read `interestRateAnnual`. Approach decision left to Reza (staleness signal / derive from charged interest / surface the divergence).

### Other findings recorded
- **§4 G5 facts settled from the schema**, nothing asked of Reza: fixed-rate **expressible**; **cross-collateralisation structurally INEXPRESSIBLE** (`Loan.propertyId` single FK); mixed-purpose FACT field exists.
- **§3.2 gets a FACT-first path** — `LoanTransaction.interestPortion` / `principalPortion` carry statement-sourced splits.
- **§3.1** — nine files already read the canonical producer; `masterFinancialService` is not one.
- **Drift D48** — VR-041 verified $12,779 against per-loan rows that reconcile *to each other*, never against contractual interest. Logged as a coverage gap per brief §7.

### Gate fix — my own, one hour old
`check-mon131-ledger.mjs` hard-coded the family id list 127…141 and **was already stale**: it did not fire on MON-142. Replaced with a range (`FAMILY_MIN = 127` + an explicit exclude set). A hand-maintained id list goes stale by construction — the same defect class the gate exists to catch.

### Build Status
- [x] `npm run issues:check` — 129 valid
- [x] No engine, schema, or migration change; no number moved

### PR
- Follows #1554 (change record + gate). T2's migration is a separate PR, after the relay compare and Reza's MON-142 call.

---

## Session: g8kra5 (cont.) — MON-142 v1: the effective-loan-rate engine

### Changes Made
- **Type**: Feature (new canonical engine) — **moves NO number**
- **Scope**: loan cost / deductible interest — the rate input itself
- **Root cause**: `Loan.interestRateAnnual` is typed and user-maintained with no staleness signal. Reza's two Bankwest IO loans store 6.690% while the repayments in the data imply ~6.268% (`1191×12/228,000` and `2518×12/482,000` — the same implied rate from two different balances). Reza confirmed rates moved and that he does not recall updating them here. The stale rate reaches money via `propertyLoanInterest.ts:85` (THEORETICAL fallback) and `propertyCashflow.ts:199` (interest floor).
- **Solution**: `lib/calculations/effectiveLoanRate.ts` — one producer, FACT hierarchy (charged ledger → IO repayment → stored), divergence surfaced never resolved, D21 offset-net divisor, P&I repayments excluded as evidence.

### Files Modified
- `lib/calculations/effectiveLoanRate.ts` — **new**. Float + Decimal twins.
- `tests/calculations/effectiveLoanRate.test.ts` — **new**. 16 fixtures on the real figures + parity.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — node + 4 input edges.
- `scripts/neomatrix/graphlib.mjs` — A6 island allowlist entry **with a named removal trigger**.
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — 2 entries (graphify is a local-only CLI, unavailable here).
- `docs/issues/ISSUES.{json,md}` — MON-142 → DIAGNOSED.
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — T2 section row.

### Coverage — stated precisely
Proves the resolution hierarchy, the D21 offset rule, the staleness threshold, the P&I guard, and Float ≡ Decimal parity, on the real originating figures. Does **NOT** prove any surface renders it (nothing consumes it yet), and does **NOT** adjudicate which of stored-vs-implied is factually right — it reports that they disagree and what the evidence says.

### Build Status
- [x] `npx tsc --noEmit` — clean
- [x] `vitest tests/calculations/effectiveLoanRate.test.ts` — 16/16
- [x] `vitest tests/neomatrix/` — 148/148
- [x] `npm run neomatrix:check` — anchors resolve, census 0 uncovered
- [x] `npm run issues:check` — 129 valid

---

## Session: g8kra5 (cont.) — MON-131 T2: the loan-cost compare relay (scaffold)

### Changes Made
- **Type**: Scaffold (admin measurement surface) — **moves NO number**
- **Scope**: MON-131 Tranche 2, gate G3
- **Why**: `expectedMoves` must be COMPUTED on live data, never predicted — previews bind to the dev DB. T1 proved the cost of declaring instead of measuring: a monthly-rounded ×12 produced a two-cent contract defect (VR-045 §2.1).

### Files Modified
- `app/api/admin/matrix/golden-baseline/t2-loan-cost/route.ts` — **new**. Runs the OLD loan-cost producers and the canonical `resolveLoanCostsForUser` against the same live data; returns per-path before/after with arithmetic, per-loan basis (ACTUALS / DECLARED / INTEREST_FLOOR), the MON-142 effective-rate divergence (surfaced, not applied), and the measured `moneyFlowService:382` interest-only skip.
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — #1556 SHA backfilled (`bcf458b9`) per the convention set last PR; T2 relay row; G3 note.
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — the route, with a reason.

### Gates caught the relay, correctly
`lint:source-lock` flagged 5 raw-`minRepayment` reads and `lint:financial-surfaces` 1 declared-cashflow reference. Both are inherent: **measuring the old producer means touching it.** Each is annotated with `@source-lock-allowed` / `@financial-math-allowed` and a specific reason — the lints were not widened. One of the two turned out to be a *path-string literal* naming the quantity in the contract, not a read of it; the annotation says so.

### Build Status
- [x] `npx tsc --noEmit` — clean
- [x] `npm run lint:source-lock` — 0 hits on the new file
- [x] `npm run lint:financial-surfaces` — 0 hits on the new file
- [x] `npm run neomatrix:check` — anchors resolve, census 0 uncovered

### What happens next
Deploy → open the route once → the returned numbers become T2's `expectedMoves` → the migration (loanCost 31 producer sites → ONE engine) follows with a Ring-3 run.

---

## Session: g8kra5 (cont.) — first T2 capture returned; relay repaired; MON-143 raised

### The capture
Measured on Reza's account at `2627dcdf`, identity asserted (`loanCount === 5`): loan cost **8,816.65 → 12,779.29**, Δ **+3,962.64/mo · +47,551.71/yr**.

Predictions from the handout §5 all landed except one, and the exception was the useful part: `moneyFlowSkip` returned **three** loans, not two. The skip is keyed on *no declared repayment*, not on interest-only — so **HECS is caught too** (`2,518.34 + 1,191.25 + 83.33 = 3,792.92`, exact). My reading of `moneyFlowService.ts:382` was right; my prediction was one loan short.

§2.1's stored-rate diagnosis is confirmed independently: `impliedRateAnnual 0.0626974 ÷ stored 0.0669 = 0.93718` — the same factor the brief flagged, with identical `divergencePp −0.42026` on both loans.

### The hole in my own instrument (D2)
`cashflow.annualCashflow` / `.annualSurplus` move by **$47,551.71** and were **not in the declared paths at all**. Under G7 an undeclared move stops the tranche — so the first capture could not have produced a valid contract. Added, derived from annual components per VR-045 §2.1.

Two paths my T2 brief listed as movers are correctly absent: `debtToIncomeRatio` and `keptAfterEssentials` carry no loan term. The brief was over-inclusive.

### MON-143 — raised from the capture, gates the migration
The relay surfaces `monthlyInterestFloor` per loan, which exposed that Guildford's floor is computed on the **full** balance: **$1,964.67** against **$384.45** net of its $303,889.96 offset — **5.1×**.

Verified four-way in source: `propertyLoanInterest.ts:87` nets · `debt-analysis/route.ts:465` nets · `portfolioEngine.ts:428` nets · **`resolveLoanMonthlyCost:199` — the canonical producer — does not.** Latent today (Guildford resolves via ACTUALS and never floors), but T2 migrates every loan-cost consumer onto that producer, so it must be fixed **before** the migration.

### D18/X3 — stated deferral, not an omission
`savingsRate` is currently a straight substitution treating the whole loan payment as spending. X3 separates principal out of spending and into saving, changing the numerator's *shape*. Recorded in the relay's `notes` so it is a decision on the record rather than a gap.

### Files Modified
- `app/api/admin/matrix/golden-baseline/t2-loan-cost/route.ts` — annual pair added; D3 deferral + MON-143 recorded in `notes`
- `docs/issues/ISSUES.{json,md}` — MON-143 raised → DIAGNOSED
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — capture outcome, #1558 SHA backfilled (`f897481c`)

### Build Status
- [x] `npx tsc --noEmit` — clean
- [x] `lint:financial-surfaces` · `lint:source-lock` · `census:producers:check` · `lint:ai-grounding` · `neomatrix:check` — all PASS
- [x] `npm run issues:check` — 130 valid

### Next
Re-capture on the repaired relay → declare `expectedMoves` → **fix MON-143** → then the migration.

---

## Session: g8kra5 (cont.) — second T2 capture; the list was the defect; the derivation sweep

### The re-capture (at `7be30bef`)
The repair landed: `paths` 8 → 10, and the annual pair reads exactly as derived — `cashflow.annualCashflow`/`.annualSurplus` **180,572.50 → 133,020.79** (`304,158.61 − 17,786.31 − 153,351.51`), the $47,551.71 move. The §5 skip prediction is now correct at three loans.

### It found two more — and reading the code found a fifth
- `cashflow.monthlySurplus` — the **monthly twin** of the pair whose annual half had just been added.
- `debt.metrics.monthlyRepayments` — **$3,962.64**, in the same object as a path that *was* declared.
- `quickMetrics.monthlyLoanRepayments` — surfaced while fixing the above; **no capture had reached it**.

### The method was the defect, not any entry
Three rounds, five misses. The Matrix named it precisely: *"it enumerates paths by name rather than by dependency… adding two names fixed two names; it did not fix the method."*

**The fix is theirs: the derivation sweep.** The relay now re-runs `calculateCashflow` and `calculateDebtMetrics` — the REAL engines, on master's REAL inputs (expenses under the same `isRecurring !== false` filter; banked income via the same assembly) — with the canonical per-loan cost substituted for the raw `minRepayment`, then diffs every numeric leaf. `quickMetrics` mirrors are carried by value-match.

Whatever moves, moves. No judgement, no list, nothing to forget. And the old input's `l.minRepayment && l.repaymentFrequency` filter — precisely why both interest-only loans vanish today — is gone by construction in the canonical legs.

### Coverage boundary — stated, not implied
Complete for `cashflow.*`, `debt.metrics.*` and the `quickMetrics` mirrors. It does **NOT** sweep `byEntity`, health, or anything outside those blocks; those need their own recompute, and G7 remains the backstop.

### Still open from the capture, unchanged
- Guildford's `monthlyInterestFloor` still reads 1,964.67 (full balance, not net of the $303,889.96 offset) — **MON-143**, gates the migration.
- `savingsRate` remains a straight substitution — the D18/X3 deferral, stated in the relay notes.

### Build Status
- [x] `npx tsc --noEmit` — clean
- [x] `lint:financial-surfaces` · `lint:source-lock` · `census:producers:check` · `lint:ai-grounding` · `neomatrix:check` — all PASS

---

## Session: g8kra5 (cont.) — MON-143: the canonical interest floor nets the offset

### What was wrong
`resolveLoanMonthlyCost` — the producer T2 is about to point *every* loan-cost surface at — charged its
interest floor on the **full** balance. Three other derivations in the app (`propertyLoanInterest.ts:87`,
`debt-analysis:465`, `portfolioEngine:428`) all net the offset off first. The canonical one was the only
one of four breaching **D21**. On Guildford: **$1,964.67** against **$384.45** — 5.1×.

Nothing caught it because `CashflowLoan` carried **no offset field at all**. The engine was structurally
incapable of netting, so no fixture could express the case. It surfaced only because the T2 relay prints
`monthlyInterestFloor` per loan and the Matrix read it against the balance.

### What changed
- `propertyCashflow.ts` — `interestBearing = max(0, principal − max(0, offsetBalance))`; `CashflowLoan`
  gained `offsetBalance`.
- `loanCosts.ts` — the service now **fetches the offsets itself** (the MON-140 input-feed shape) rather
  than trusting callers to pass them. Same-engine-different-inputs is the MON-028 failure class; a
  producer that can be starved by a forgetful caller is not fixed.
- Ratchet — `tests/calculations/loanInterestOffsetNetting.test.ts`: pins the corrected floor, pins the
  pre-fix **1,964.67 as WRONG**, and pins the **D21/D26 asymmetry both halves** (interest nets the
  offset, equity does not) so a later "tidy-up" has to argue with a test instead of a comment.

### What you'll see
**Nothing today — and that is the expected result, not a missing one.** Guildford has linked repayments,
so it resolves via ACTUALS and never reaches this fallback. The fix matters for what comes next: the T2
migration points every screen at this producer, and shipping it first would have propagated a known
5.1× overstatement to all of them at once.

### The Neomatrix gates — D49
Editing two anchored files trips ANCHORED DRIFT *and* the symbol-anchor gate, which resolve against a
Layer 0 frozen at `4ae03705`; the documented remedy (`neomatrix:graphify`) is a local-only CLI absent
here and in CI. I first called this a blocker for Reza and reverted a manifest rehash as "dishonest" —
**both wrong**: `d5c9434f` (MON-140) already established the targeted-patch precedent. Applied it, but
verified rather than fitted — all 10 moved Layer-0 nodes shifted by exact hunk offsets, then each
asserted to land on its label in current source. **17/17** nodes in both files land, including the 7 the
gates never inspect.

**Not fixed:** every T2 migration target is anchored, so the migration pays this tax per file. The
durable fix is a CI-runnable extractor, or resolving the symbol gate against **source** instead of a
frozen Layer 0. Recorded in the ledger §4 as D49, not assumed covered.

### Coverage — stated precisely
The test proves the floor's arithmetic and the asymmetry. It does **NOT** prove any surface renders it:
on live data no loan both floors *and* carries an offset today. No Ring-3 run applies, so MON-143 stays
**FIXING** — its Ring-3 evidence is the T2 migration run, not a separate one.

### Build Status
- [x] `npx tsc --noEmit` — clean
- [x] `lint:financial-surfaces` · `lint:source-lock` · `census:producers:check` · `neomatrix:check` · `issues:check` · `mon131:check` — all PASS
- [x] vitest — 148 passed across the neomatrix + registry + MON-143 suites

---

## Session: g8kra5 (cont.) — #1563 merged + verified; the record catches up with it

### #1563 — the ledger backfill

Merged `915704f0`. Production deploy `dpl_CKLMntXX4u8Fyefjoa8rdGhq7Nz8` went `BUILDING` 21:40:17 →
**`READY` 21:44:41** UTC (§17.2 — deploy STATE checked; no runtime logs pulled, because the change was
documentation and there is no behaviour to watch). Subscription dropped on merge.

Content: #1562's SHA into ledger §6, and the T2 section's *"MON-143 gates the migration"* note flipped to
RESOLVED with the original diagnosis kept beneath it. **MON-143 deliberately stays `FIXING`** — no
rendered number moves on live data, so no Ring-3 run applies; its verification is the T2 migration run
(§23.2.3: CI green is not verification).

### What this PR fixes — four record gaps, found by auditing rather than assuming

Reza asked whether everything had been documented as instructed. Checking rather than asserting found four:

| Gap | Why it happened |
|---|---|
| Ledger §6 had no row for #1563 | structural — a backfill PR cannot record its own merge SHA |
| No changelog session entry for #1563 | the day's log ended at the MON-143 session |
| The hub's `Last updated` summary was semantically stale | it still read *"BLOCKED before the migration on: a RE-CAPTURE … and MON-143"* — both done. `check-plan-freshness` compares **dates**, so it passed and never read the content |
| The third-capture handout existed only in chat | **§21.2.2 rule 4** — no session artefact may live outside the repo. The in-repo brief's §4b still described capture 2, so a Matrix opening the file instead of the paste would have run stale instructions |

The fourth is the one with operational teeth; the other three are bookkeeping.

### Files Modified
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — §6 rows for #1563 (`915704f0`) and this PR
- `docs/verification/briefs/MATRIX_T2_RELAY_CAPTURE.md` — §4b rewritten for the THIRD capture (build
  precondition `915704f0`+, why a third exists); new §5b (what the sweep must produce, the five
  previously-missed paths, "a sixth is the sweep working", the MON-143 no-change check); §8 records the
  amendment and the sweep's coverage boundary
- `docs/changelog/CHANGELOG_2026_07_31.md` — this entry
- `docs/IMPLEMENTATION_PLAN.md` — hub summary corrected to the real T2 state

### Where T2 stands
MON-143 ✅ resolved · relay + sweep ✅ shipped · **G3 (the third capture) is the last gate** · D49 open
and awaiting Reza (recommendation: resolve `check-binding-coverage`'s symbol anchor against source).

### Build Status
- [x] `mon131:check` · `check-plan-freshness` — PASS
- [x] No code changed; no build or test surface affected

### Coverage — stated precisely
Verifies that the repo record matches the merged state and that the in-repo capture brief matches the
capture about to be run. Verifies **nothing** about behaviour — this PR contains no code.
