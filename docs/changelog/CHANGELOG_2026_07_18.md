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
