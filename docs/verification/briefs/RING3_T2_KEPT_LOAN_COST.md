# RING-3 HANDOUT — T2-KEPT: the loan-cost path the KEPT surfaces actually use

**For:** 🟩 Matrix HQ (account-first, Chrome relay) · **Raised:** 2026-08-25 by Matrix HQ under **Reza's GO on M2.7 proposal P-6**.
**Why this exists:** T2's original Ring-3 (VR-047 + VR-047B, 2026-08-03/04) PASSED — but it verified the `masterFinancialService → resolveLoanCostsForUser` leg, read on **Home's budget tile** and **`/dashboard/expenses`**, and both surfaces are unreachable in v1 today (MODULE_HOUSEHOLD hidden; `HomeClient` has zero importers). The **kept** property surfaces use a different producer. That evidence stands for the leg it covered; this run covers the leg the v1 user actually sees.

**Producer under test:** `resolveLoanMonthlyCost` (`lib/calculations/propertyCashflow.ts:236`) via `computePropertyCashflow` (`:365`).
**Gate:** this run decides whether the M2 launch gate's "Ring-3 PASS across kept quantities" claim holds for loan cost. It also confirms or CLEARS gate-review finding **B1**.

---

## The falsifiable hypothesis (written BEFORE the run — D-21 discipline applied to a verification)

**B1 states:** `resolveLoanMonthlyCost` nets the offset (`propertyCashflow.ts:246` — `l.principal - l.offsetBalance`), but **no `offsetBalance` is passed anywhere under `app/dashboard/properties/`**; both call sites (`page.tsx:496`, `[id]/page.tsx:180`) hand `computePropertyCashflow` loans without it. If true, the property pages compute on the **FULL balance**.

**The sharp test.** The balances **LoanDetailDialog** takes a different route to the same number: `components/loans/LoanDetailDialog.tsx:231` reads `loan.resolvedCost ?? resolveLoanMonthlyCost(loan)`, and `resolvedCost` is served by `app/api/loans/route.ts:128` → `resolveLoanCostsForUser` — the canonical, offset-aware leg. So:

> **PREDICTION (B1 TRUE):** for a loan with a material offset — **Guildford, offset ≈ $303,889.96** — the monthly loan cost shown on `/dashboard/properties` will **DISAGREE** with the same loan's monthly cost in the balances dialog, and the gap will be consistent with interest on the un-netted offset.
>
> **PREDICTION (B1 FALSE / CLEARED):** the two figures **AGREE to the cent**, meaning the offset reaches the property pages by a route the static read missed.

Either outcome is a real result. **A run that cannot obtain both figures reports PARTIAL, never a guess.**

---

## Identity assertion — assert BEFORE reading any number

Reza's personal account. Portfolio **$4,990,000** · **6** properties · **5** loans · net worth **$3,401,782** · Portfolio LVR — owned **40.8%**. A run that cannot prove its account is **void** and is reported as void, never as numbers. **Never open the admin portal in this browser profile** (MON-162 — the admin login silently overwrites the user session; this is what voided VR-044 and VR-046).

---

## Checks

| # | Surface | Check | Expected |
|---|---|---|---|
| **K1** | `/dashboard/properties` — Guildford tile | Record the property's monthly/annual cashflow and any loan-cost figure shown | Recorded verbatim; no assumption |
| **K2** | Balances → Guildford's loan → LoanDetailDialog | Record the monthly cost AND the basis chip text | Recorded verbatim |
| **K3** | **K1 vs K2 — THE DECIDING COMPARISON** | Same loan, two kept surfaces | **AGREE to the cent** ⇒ B1 CLEARED · **DISAGREE** ⇒ B1 CONFIRMED, register immediately, do NOT fix in passing (§23.2.1) |
| **K4** | `/dashboard/properties/[id]` — Guildford detail, "Cashflow rhythm" per-loan rows | Record each loan row's monthly figure and which basis it claims | Consistent with K1 (same producer, same inputs) |
| **K5** | Any property whose loan has **no** offset | Same two-surface comparison | **MUST agree** — if a no-offset loan also disagrees, the cause is NOT the offset and B1's diagnosis is wrong |
| **K6** | `/dashboard/activity` — Money-Flow Sankey "Loan repayments" | Record the annual figure | This is the ONE kept consumer of the leg VR-047B verified; it was absent from VR-047's verified list, so this is its first live read |
| **K7** | Basis honesty | Does every kept surface that renders a loan cost NAME its basis? | Per MON-145's M2 slice, the basis must be stated, not implied |

## mustNotMove (regression cluster — byte-identical or the run FAILS)

Portfolio value **$4,990,000** · net worth **$3,401,782** · Portfolio LVR — owned **40.8%** on both the scoreboard and the properties banner · the property tiles verified on 2026-08-25 (Las Vegas $380,000/$15,000 · Broadbeach $600,000/38.0%/5.89%/$15,879 · Thornland Lot 2 $900,000/53.6%/3.76%/$3,580) · the FY2025-26 pack totals (income $14,389.23 · expenses $10,591.03 · 35 transactions · identity 35+39+0+313=387).

## Result format

`matrix-result/v1`, validated with `npm run matrix:check -- <file>` before it is acted on, posted to the PR that carries this handout. `sectionsNotRun[]` is mandatory. If the deciding comparison K3 cannot be obtained, the verdict is **PARTIAL** and says so — a Ring-3 that guesses at its deciding check is worse than one that admits it did not run.

## Coverage boundary

**Establishes:** whether the kept property surfaces and the canonical loan-cost leg agree on the same loan, on live data; the first live read of the activity Sankey's loan figure; basis-labelling honesty on kept loan-cost renders.
**Does NOT establish:** anything about hidden-module loan-cost producers (MON-156's eleven remain HELD under D-20) · the pack's per-loan interest (it has none — depth-sweep #11, an M3.1 gap) · MON-145's undated-rate limitation, which is schema-bound and separately queued.
