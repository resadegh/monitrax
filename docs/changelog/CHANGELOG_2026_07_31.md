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
