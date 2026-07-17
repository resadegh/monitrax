# Matrix Fix Discipline — cumulative, SSOT-preserving, holistic, no-regression (LAW)

> **Status:** binding Matrix law (amends CLAUDE.md §12.2.1 SSOT + FIX_PROTOCOL §20.6 pre-PR gate).
> **Origin:** Reza's directive 2026-07-17 — *"all fixes must not introduce further issues, must not break SSOT / single-calc-engine rules, must always cumulatively fix, and every issue must be audited holistically end-to-end (all relevant considerations) before fixing."*

## The rule (four clauses — all mandatory)
1. **Non-regressing** — a fix may not introduce a new defect or re-open a closed one. Net issue count and net financial-surface-lint count may only go **down**.
2. **SSOT-preserving** — it may not create a second producer of a value, and may not leave a sibling surface computing the same value a different way. Fix the **canonical producer**, not one surface.
3. **Cumulative** — each fix strictly adds correctness on top of the last; the system only ever gets more correct, never trades one bug for another.
4. **Holistic before fixing** — every issue is audited **end-to-end** before any code changes: enumerate *every* producer and *every* consumer/surface of the value, and evaluate all four lenses (financial-adviser correctness, designer, architect/SSOT, behaviour). The fix must address the whole blast radius, not the one symptom that was reported. No fix starts until this map exists.

## The failure mode this exists to stop — with live evidence (regression sweep VR-012, HEAD 64391ca8)
A fix that corrects **one surface** while leaving another surface that computes the same value untouched does not reveal drift — it **creates** it. Three confirmed cases from recent fixes:

| Fix | Value | Surface it fixed | Sibling(s) left divergent | Result |
|---|---|---|---|---|
| **MON-032** (#1359) | monthly loan cost (interest floor) | property detail/list/snapshot per-property (`properties/[id]/page.tsx:827-863`) | raw `minRepayment` still in `expenses/page.tsx:564-565`, `cashflow/summary:77-80`, `cashflow/intelligence:138-140`, `cfo/scenarios:76-83`, `portfolio/snapshot:684-686`, `ai/debt-analysis:193` | property shows floored interest, everything else shows **$0** — a divergence that didn't exist before (all were $0 together) |
| **MON-037** (#1395/#1427) | monthly expense run-rate | `propertyCashflow:174`, `masterFinancialService`, insights, tax | `/dashboard/expenses` totals (`:554,561,569`) + portfolio-level `portfolio/snapshot:682` still count one-offs ×12 | expenses/outgoings headline inflated vs property/tax; sum-of-tiles ≠ portfolio total |
| **Phase 59 / MON-080** (#1434/#1437) — **NEW, critical, live** | managed-rental agent fee | **tax path correct** (declared gross − derived expense, counted once) | **cashflow double-counts it**: `computePropertyCashflow` reads the NET disbursement as rent actuals (no gross-up, `propertyCashflow.ts:153-165`) **and** subtracts the derived `PROPERTY_MANAGEMENT` expense → fee subtracted twice on every cashflow surface | cashflow **understates** by the agent fee per managed property; tax and cashflow now disagree |

**Process lesson (owned):** the MON-080 Ring-3 (VR-011) verified the **tax** page only and reported "no double-count" — it did **not** check cashflow, where the double-count lives. A per-surface Ring-3 is how drift slips through. This is exactly why clauses 2 & 4 and gate 4 below are mandatory.

## Mandatory gates (a fix cannot merge without these)
1. **Single-producer edit.** A change to any money/cashflow/tax/loan/income/expense value MUST be made in the one canonical producer (`lib/calculations/*`, `lib/services/masterFinancialService.ts`, `lib/utils/frequencies.ts`, the tax engine). If a surface bypasses the producer, **migrate it in the same PR** — never branch a second copy.
2. **Source-lock lint (automated backstop).** CI fails if any `app/**/page.tsx` or route computes `frequency×amount`, reads raw `minRepayment`, or `.reduce`s over raw income/expense/loan arrays instead of a canonical producer. (Calc-SSOT-Wall Ring-1 — the teeth of this law.)
3. **Ratchet-down only.** Financial-surface lint exception count may not increase in any PR. New exceptions require explicit Reza sign-off + a follow-up issue.
4. **Cross-surface Ring-3.** For any number-changing fix, the Matrix verifies the SAME value reads identically on **every** surface it appears (income ↔ tax ↔ cashflow ↔ property ↔ expenses ↔ balances) — not just the surface edited. Tax-only or single-surface verification is a fail.
5. **Holistic pre-fix audit (clause 4).** Before coding, produce the end-to-end producer/consumer map for the value + a four-lens read; attach it to the issue. The fix scope = the whole map.
6. **No new duplicate record.** Reconcile/import fixes route through the canonical intake upsert-by-signature (Calc-SSOT-Wall Mechanism A).

## Pre-PR checklist (add to §20.6 self-score, must be 10/10)
- [ ] Holistic end-to-end map done first: every producer + every consumer of this value enumerated; four lenses read.
- [ ] I changed the canonical producer, not a single surface; any bypassing surface migrated here.
- [ ] `lint:financial-surfaces` + source-lock lint pass; exception count did not rise.
- [ ] Cross-surface Ring-3 done: the value reads identically on **every** surface (not just the one edited).
- [ ] No new producer, no new duplicate record, no closed issue re-opened.

## Immediate consequence
- **Raise now (critical, live):** Phase 59/MON-080 cashflow double-count of the agent fee. **Re-open MON-079/MON-080 verification** — they are VERIFIED for tax only; the cross-surface Ring-3 was not met.
- The MON-032 and MON-037 drift are folded into the Calc-SSOT Wall (`CALC_SSOT_WALL.md`) Mechanism-B fix list.

## Enforcement is the Calc-SSOT Wall
Part 1 of `docs/architecture/CALC_SSOT_WALL.md` ships the source-lock lint (gate 2), making clauses 1–3 mechanically checkable on every future PR. Until it lands, the Matrix enforces these gates by review on every fix it shepherds.

---
*Binding Matrix law. Prepared by The Matrix at Reza's direction, HEAD `64391ca8`. Evidence: regression sweep VR-012.*
