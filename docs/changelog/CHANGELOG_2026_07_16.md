# Changelog - 2026-07-16

## Session: phase-59-managed-rental-yhm8ug (Code · Fable 5)

### Changes Made
- **Type**: Feature (Phase 59 — Managed Rental Income & Agent-Cost Reconciliation)
- **Scope**: schema + calc engine + tax read-path + reconciliation UX + Neobrain parser + NeoAudit detectors/fixtures
- **Issue**: MON-079 (`changesNumbers: true`, tracker `phase-59`)
- **Spec of record**: `docs/blueprint/PHASE_59_MANAGED_RENTAL_INCOME.md` (PR #1433) — this session operationalises its §9 build plan, Parts 0–5 (Part 6 R3 Chrome is the Matrix's after merge + deploy)

### The design in one paragraph
An agent-managed rental never hits the bank as gross rent. `Income.rentalMode MANAGED` keeps the declared **gross** as the assessable income; the ONE engine `reconcileManagedRental()` computes the cadence-normalised gap (`650/wk × 52 ÷ 26 = 1,300/ft − 1,100 net = $200/ft → $5,200/yr`); the user confirms via the suggest-and-confirm card; the confirmed gap persists as a **derived deductible `PROPERTY_MANAGEMENT` expense** which flows into `calculateTaxPosition().deductions.property` through the EXISTING deductible-expense loop — the derived row IS the tax wiring, no second producer (§12.2.1). Learn-once `AgentDisbursementRule` silences future in-tolerance disbursements; anomalies (a repair) re-confirm in amber and record a one-off excess counted once (MON-037 semantics).

### §19.2 worked-example evidence (recorded in tests)
- Input contract: `Income.amount` = per-period declared gross (AUD, 650/WEEKLY); `UnifiedTransaction.amount` = net bank credit (1,100); cadence via the ONE canonical `detectFrequency` (never a second path).
- Law: ITAA 1997 s6-5 (gross rent assessable) + s8-1 (agent costs deductible); immediate-vs-capital deliberately NOT ruled (spec §10).
- Expected: gross/ft 1,300 · gap 200 · annual 5,200 · taxable 33,800 − 5,200 = 28,600 = the net actually received, annualised.
- Verified: `tests/calculations/rentalReconciliation.test.ts` + `tests/golden/ring2.managedRental.test.ts` — Float === Decimal on every figure.

### Files Created
- `prisma/migrations/20260716000000_phase59_managed_rental/migration.sql` — additive only
- `lib/calculations/rentalReconciliation.ts` — the ONE producer (Float + Decimal + derived-row builders)
- `lib/calc-audit/engines/rental-reconciliation.ts` — R0 fixtures (`property.managedRentalGap`)
- `lib/services/managedRentalService.ts` — fire-vs-silent suggestion decision
- `app/api/rental-reconciliation/route.ts` — the single locked producer of derived rows (confirm + confirm-anomaly)
- `components/transactions/ManagedRentalReconcileCard.tsx` — the spec §8 card (Stitch tokens verbatim)
- `lib/neobrain/rentalStatement.ts` — grounded statement parser (refuse-never-estimate)
- `tests/tax/rentalReconciliationSourceLock.test.ts` (R1) · `tests/calculations/rentalReconciliation.test.ts` (R0) · `tests/neobrain/rentalStatement.test.ts` · `tests/golden/ring2.managedRental.test.ts` (R2)

### Files Modified
- `prisma/schema.prisma` — Income.rentalMode/managingAgentName; Expense.derived/derivedSource/itemised/derivedFromIncomeId; enums RentalMode/ExpenseDerivationSource/PROPERTY_MANAGEMENT/RENTAL_STATEMENT; AgentDisbursementRule model
- `app/api/income/route.ts` + `app/api/income/[id]/route.ts` — rentalMode/managingAgentName accepted (guarded to rental types); D4 surfaced on GET
- `app/api/transactions/[id]/link/route.ts` — link + create income paths return the `managedRental` card payload
- `components/transactions/TransactionLinkDialog.tsx` — holds open on a suggestion; one calm question
- `app/dashboard/income/page.tsx` — "How the rent arrives" (DIRECT|MANAGED + agent name) on rental streams; D4 emerald nudge chip
- `lib/intake/detectors.ts` — D4 `detectRentGap` (median deposit, ≥2 deposits, engine-derived gap)
- `lib/documents/intelligence/{types,classifiers/documentClassifier,analyzers/aiDocumentAnalyzer}.ts` — RENTAL_STATEMENT type/classifier/prompt
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — Model step (§21.2): engine + 2 inputs + 2 numbers + 6 verified edges; classifyDocument/analyzeDocumentWithAI anchors re-pinned (222/140) after insertions (§21.2.1 zero-drift)
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — 5 new files allowlisted for Layer-0 (graphify offline this session; self-prunes on next run)
- `tests/intake/intakeSourceLock.test.ts` — new locked producer registered
- Docs: `00_INDEX`, `02_UP_NEXT`, `MASTER_BLUEPRINT §8`, `IMPLEMENTATION_PLAN` hub, `03_DATA_MODEL`, `ISSUES.json` (MON-079)

### Build Status
- [x] TypeScript compilation passes (`tsc --noEmit` clean at every part)
- [x] `prisma validate` + `format` + `generate` pass (Prisma 5.22)
- [x] `neomatrix:check` GREEN (schema/invariants/anchors/markdown/Layer-0/binding/census 0 uncovered)
- [x] `issues:check` GREEN (79 issues valid)
- [x] Targeted suites green (engine 13 · source-locks · intake · neobrain 11 · golden managed-rental + wall)
- [ ] Full `vitest run` — recorded in the PR (running at changelog write)
- [ ] `npm run build` — exercised by the Vercel preview (CI) — local env has no DB for `migrate deploy`

### §20.6 gate (per part, honest)
Recorded in the PR body — Document / Requirements / Logic 10/10 each part, with the coverage boundary stated as "verifies X, does NOT verify Y" (Ring-3 real-data verification is deliberately NOT claimed — it is the Matrix's Part 6).

### Commit History
| Hash | Message |
|------|---------|
| d2bdefa | docs(phase-59): Part 0 — raise MON-079 + canonical cross-refs |
| 40137a3 | feat(phase-59): Part 1 — managed-rental data model + additive migration |
| de59655 | feat(phase-59): Part 2 — reconcileManagedRental engine + Neomatrix Model step + R0/R1 ratchets |
| 998eb23 | feat(phase-59): Part 3 — suggest-and-confirm card + learn-once rule + anomaly re-confirm |
| 075ea4a | feat(phase-59): Part 4 — Neobrain rental-statement parser (grounded) + RENTAL_STATEMENT |
| fe29d0b | test(phase-59): Part 5 — D4 rent-gap detector + Golden managed-rental fixture (R2) |

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1434 (draft)
- Status: DRAFT for Reza's review (schema migration approval §12.11/§12.12 + money-touching merge gate). After merge + deploy READY → hand back to the Matrix for Ring-3 (Part 6).
