# Changelog - 2026-07-18

## Session: mon-087-select-empty-value (Code · Fable 5)

### Changes Made
- **Type**: Fix (Sev-1 UI crash — form-only, no calc/schema change)
- **Scope**: MON-087 (VR-014) — property-context Add Expense crashes on the Radix empty-value SelectItem invariant; the whole class removed repo-wide + MON-083 parity added to the canonical dialog.
- **Root Cause** (§19.2, verified): the property context pre-selects `sourceType: 'PROPERTY'`, so `components/ExpenseDialog.tsx`'s Linked-Property Select renders BEFORE the async `loadRelatedData()` fills `properties` → the `length === 0` branch rendered `<SelectItem value="" disabled>` → Radix throws at render ("A <Select.Item /> must have a value prop that is not an empty string"). The global expenses page never crashed because it uses its own inline form. Class sweep found the same pattern at 15 sites (ExpenseDialog ×4, expenses page ×4, income page ×3, TransactionLinkDialog ×5 latent + 4 functional empty-value filter/None options).
- **Solution**:
  - The 11 "No X available" placeholders → plain disabled `<div>` rows (not Select.Items).
  - The 4 functional options → non-empty sentinels (`'ALL'`/`'NONE'`) mapped back to `''`/`null` in `onValueChange` (audit-logs Action + Status filters; income + investments-transactions "None").
  - Root `Select value` props: `|| ''` → `?? undefined` (the supported placeholder pattern).
  - **MON-083 parity**: the canonical ExpenseDialog gains the "This is a recurring expense" checkbox + conditional Frequency ("One-off — counted once, on the date it happens"), `isRecurring` in form state/init/submit (API already accepts it, schema default true); `PropertyExpensesCard.toDialogExpense` threads `isRecurring` for edits.
  - **Ratchet**: `tests/ui/selectItemEmptyValue.test.ts` — static scan failing on ANY `<SelectItem value="">`/`value={''}` in `app/` + `components/`. Deviation from the brief's mounted-dialog smoke test surfaced honestly: the repo has no react-mount harness (no testing-library/jsdom), and the defect is fully static — the scan covers every entry point + every future instance; a mount test would cover one.

### Files Modified
- `components/ExpenseDialog.tsx` — crash fix (4 items + 4 root values) + isRecurring control + conditional Frequency
- `components/properties/PropertyExpensesCard.tsx` — threads isRecurring on edit
- `app/dashboard/expenses/page.tsx`, `app/dashboard/income/page.tsx`, `components/transactions/TransactionLinkDialog.tsx` — placeholder rows de-Item-ised
- `app/dashboard/admin/audit-logs/page.tsx`, `app/dashboard/investments/transactions/page.tsx` — sentinel mapping
- `tests/ui/selectItemEmptyValue.test.ts` (NEW ratchet)
- `docs/verification/runs/VR-014.md` (NEW), `docs/issues/ISSUES.json`/`.md` (MON-087 raised → FIXING; MON-083 note)
- `.audit/financial-math-baseline.json` — 1 line-shift re-pin (income 2277→2278)

### Coverage (precise — §22.2.4)
Verifies: zero empty-value SelectItems exist in source (the render-crash class, statically); all prior calc/lint suites unchanged. Does NOT verify: the dialog rendering in a browser (the Matrix's re-run does that on the property-context path — MON-087 stays FIXING until then), the sentinel filters' end-to-end behaviour on the admin audit page (manual check recommended), or any number (no calc touched — MON-081 numbers untouched by construction).

### Build Status
- [x] tsc clean · [x] lint:financial-surfaces green (34) · [x] lint:source-lock green (80, unchanged) · [x] neomatrix:check green · [x] issues:check green (87) · [x] targeted suites 103/103 + ratchet 1/1 · [ ] full suite + build (pre-push)

---

## Session: mon-020-060-tax-producer-collapse (Code · Fable 5)

### Changes Made
- **Type**: Fix (SSOT — duplicate tax assemblers collapsed; tax-facing)
- **Scope**: MON-020/MON-060 — ONE canonical user-level tax producer for every surface (the next Calc-SSOT Wall Mechanism-B migration).
- **Root Cause** (§19.2, verified from source): ONE engine (`calculateTaxPosition`) but FOUR assemblers feeding it different inputs (F2): (1) `getUserTaxPosition` (canonical, /cashflow + CFO); (2) `/api/tax/position`'s own fetch+assembly (a verbatim clone — agreement by luck, drift by design); (3) master's `buildTaxSummary` — `depreciations: []`, NO MON-045 loan interest, NO super, NO franking (→ the activity Sankey's divergent Tax figure, MON-060); (4) dead `/api/tax` with its own inline bracket math, zero consumers.
- **Solution**:
  - `getUserTaxPosition` now returns `engineInputs` (the exact assembled input) + accepts an optional FY override (preserving the route's `?financialYear=` contract, with FY-correct interest windows).
  - `/api/tax/position` consumes the bundle; Decimal twin computed from the SAME `engineInputs`; its duplicated assembly deleted. ZERO number change on the Tax page (assembly was verbatim-equal).
  - Master `buildTaxSummary` → `buildTaxSummaryFromPosition` adapter over the bundle. CHANGES master's tax numbers by design — the activity flow converges onto the canonical figure.
  - `/api/tax` DELETED (dead fourth assembler).
  - **Recorded finding (Reza's call, not silently changed):** master's old tax base also had rental dedup + isTaxable filter; folding those INTO the canonical assembler is the remaining semantic unification (MON-020 notes).
- **Ratchet**: `tests/golden/ring2.taxParity.test.ts` — route ≡ bundle ≡ master on the golden household, pinned §19.2: salary 93,600 + rent 31,200 → taxable **124,800**; tax 4,288 + 23,940 + Medicare 2,496 = **30,724** (exact). Three old topology string-locks re-pointed (mon037/depreciationRate/rentalTaxDedup); golden harness now serves `loanTransaction` + a faithful minimal `groupBy` (its fail-loud proxy caught the new query as designed).

### Coverage (precise — §22.2.4)
Verifies: the three surfaces produce ONE number on golden data (plumbing parity) + the hand-computed pin + Float↔Decimal agreement. Does NOT verify: live-data numbers (Matrix cross-surface Ring-3 after merge — Tax page ≡ /cashflow ≡ activity flow ≡ CFO ≡ reports), the MON-045 interest leg on golden (fixture has no ledger rows — own suite covers it), reports' per-ENTITY tax (different scope, `entityTaxRouter` — documented, not a user-position producer), `/api/tax/super/optimize` + `rentalReconciliation` marginal/delta uses of the bracket engine (documented as scenario tools, not position producers — census in the PR).

### Build Status
- [x] tsc clean · [x] lints green (source-lock 80 unchanged; financial-surfaces 34) · [x] neomatrix green (anchors re-pinned; /api/tax edge repointed) · [x] issues green (87; MON-060 → FIXING #1448, MON-020 notes+test) · [x] full suite 4,104 passed / 69 skipped · [x] build passes

---

## Session: mon031-064-liquid-cash-canonical (Code · Fable 5)

### Changes Made
- **Type**: Fix (financial correctness — Mechanism-B single-producer)
- **Scope**: MON-031/MON-064 — ONE canonical "liquid cash" (deployable basis).
- **Root Cause** (§19.2, verified): master `quickMetrics.liquidCash` = GROSS spendable-account cash (`masterFinancialService` Σ LIQUID_ACCOUNT_TYPES balances) while the MON-012 buckets netted credit cards inside (`accessibilityBuckets` liquidToday = cash − creditCards). Two variants of one concept under one label: Safety Net (+ emergency fund, insights freeToday, CFO chat) read gross $304,304; Balances/Home//cashflow read the netted $301,808. Gap = the Qantas card $2,496 exactly.
- **Solution** (canonical = NET/deployable per the brief's recommendation, Reza confirms at merge): the ONE producer now nets at source — `liquidCash = gross spendable − netWorth.liabilities.creditCards` (masterFinancialService). `computeAccessibilityBuckets` takes the canonical net figure and reconstructs the gross basis internally (net + creditCards), so `liquidToday === quickMetrics.liquidCash` BY CONSTRUCTION and the MON-012 net-worth tie-out is preserved (algebraically unchanged). Every consumer converges automatically: Safety Net, emergency-fund months (now on the deployable basis), insights, CFO chat, what-if, buckets.

### §19.2 evidence (executed — tests/golden/ring2.liquidCashParity.test.ts, 5/5)
Golden cash 50,000 + a $2,496 CREDIT_CARD loan → canonical liquid **47,504**; buckets.liquidToday === quickMetrics.liquidCash; tie-out to net worth (469,504 = 472,000 − 2,496) holds; the REAL safety-net route returns the same figure. Live expectation: Safety Net $304,304 → **$301,808**, identical to Balances/Home//cashflow.

### Files Modified
- `lib/services/masterFinancialService.ts` — liquidCash netted at the ONE producer
- `lib/calculations/accessibilityBuckets.ts` — parameter = canonical net; gross reconstructed internally
- `tests/calculations/accessibilityBuckets.test.ts` — one fixture updated to the new parameter contract
- `tests/golden/ring2.liquidCashParity.test.ts` (NEW ratchet)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — buckets anchor re-pinned + producer note

### Coverage (precise — §22.2.4)
Verifies: the net-at-source rule, buckets≡quickMetrics convergence, tie-out, and the real safety-net route on golden data. Does NOT verify: the rendered surfaces on live data (Matrix cross-surface Ring-3 after merge — Safety Net ≡ Balances ≡ Home ≡ /cashflow at $301,808), or consumers that merely display the figure (converge by construction).

### Build Status
- [x] tsc clean · [x] both lints green (source-lock 80 unchanged) · [x] neomatrix green · [x] golden+calculations+balances 394/394 + ratchet 5/5 · [ ] full suite + build (pre-push)
