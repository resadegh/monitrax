# CODE BRIEF (Opus 4.8) — MON-077: stale "Potential Missed Deductions" nudge (My Guide)

**Paste into a fresh Claude Code session on OPUS 4.8** (CFO advisory reconcile; **changesNumbers: no** — display/advice only, no tax number moves). Small, self-contained loose-end from the MON-045 fix. Reconcile the advisory against the canonical tax position; do NOT touch the tax engine.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD (`6abfb60`); cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT — advisory must reconcile against the ONE producer, §20.6 tri-axis, §21.2.2 neo-sync) → the MON-077 registry entry → `docs/verification/runs/VR-009.md` (the finding).

## Why (verified at HEAD `6abfb60`)
My Guide's "Potential Missed Deductions" panel still tells the user they're missing loan-interest deductions for the three investment properties (Thornland Lot 1, Thornland Lot 2, Broadbeach) — but since **MON-045** (VERIFIED) that interest is **auto-claimed** into `taxPosition.deductions.property` from the loans themselves. So the panel contradicts the deductions shown right above it. **Tax numbers are correct; only this advisory list is stale.**

## Root cause
`lib/cfo/decisionSupport/taxIntegration.ts:349` `identifyMissedDeductions(expenses, properties, depreciations)`:
```
const hasInterestDeduction = expenses.some(
  (e) => e.propertyId === prop.id && e.category === 'INTEREST'
);
if (!hasInterestDeduction && prop.loans?.length > 0) {
  missed.push(`Loan interest for ${prop.name}`);   // :369-372
}
```
The heuristic assumes property loan interest only enters the position via a **logged INTEREST expense row** — the pre-MON-045 world. Post-#1425 the interest is auto-derived (`lib/tax-engine/deductions/propertyLoanInterest.ts`) into `taxPosition.deductions.property` with **no expense row**, so the check is false-positive for every investment property with a loan. This is a §12.2.1-class **un-reconciled advisory producer**: it re-derives "is interest missing?" from raw rows instead of reading the canonical position (which the same file already imports — `getUserTaxPosition`, `:11`).

## The fix (reconcile against the ONE producer — advisory only)
1. **Drop the stale loan-interest heuristic.** Property loan interest is now auto-claimed whenever a property has an investment loan — so it is **never missable** via this path. Remove the `Loan interest for ${prop.name}` branch (`:366-373`). *(If a "genuinely un-deducted interest" signal is ever wanted, it must come from the canonical position — `taxPosition.deductions.property` vs the property's `annualLoanInterest` — not a raw-row heuristic; but post-MON-045 that gap is structurally zero for a loan-bearing investment property, so the honest fix is to remove the suggestion.)*
2. **Keep the genuine gaps.** Depreciation (`Depreciation for ${prop.name}` — genuinely NOT auto-claimed without a schedule; the tax page itself recommends it) and work-related expenses stay — those are real gaps the position lacks. Optionally reconcile depreciation against `taxPosition.deductions` too if a depreciation figure is present there.
3. **Reconcile-against-canonical pattern:** pass the already-available `taxPosition` into `identifyMissedDeductions` (or gate the panel's items against it) so the advisory is derived FROM the canonical deductions, never re-derived from raw rows — closes the §12.2.1 class, not just this instance.

## Guardrails
- **changesNumbers: no** — tax position, deductions, refund, Medicare all untouched (VR-009 confirmed the math is correct). This only removes a false advisory line.
- **Ratchet:** unit on `identifyMissedDeductions` — an investment property WITH a loan and NO logged INTEREST expense row does **NOT** produce "Loan interest for X" (fails on pre-fix code); depreciation-missing still surfaces; work-related still surfaces. 
- **Neo-sync (gate 8):** the advisory now reads `service.tax.getUserTaxPosition` (reconciled consumer, not a shadow re-derivation); Neobrain/NeoAudit updated; nothing sandbox-only.
- §20.6 10/10; **Reza merges** (advisory copy change; no numbers move).

## After merge → Matrix re-check (VR-0NN)
The Matrix opens My Guide live: "Potential Missed Deductions" no longer lists loan interest for Thornland Lot 1/Lot 2/Broadbeach (auto-claimed); depreciation suggestions remain where no schedule exists; the panel no longer contradicts the deductions shown above it. Tax numbers unchanged ($317,751 / $175,432 / $38,628 / $142,319 deductions). MON-077 → VERIFIED.

---
*Prepared by The Matrix from VR-009 + a source read. Advisory-only reconcile against the canonical tax position (MON-045 made property loan interest auto-claimed, so it is not missable). No tax-engine changes; changesNumbers: no.*
