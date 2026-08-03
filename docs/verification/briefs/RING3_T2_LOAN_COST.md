# RING-3 HANDOUT — T2: the loan-cost migration

**Prepared by:** Code session (Opus 5), 2026-08-03 · **Kind:** `ring3` (a verdict, not a capture)
**Under test:** the MON-131 **T2 migration** — `masterFinancialService` stops deriving a loan cost from raw `minRepayment` and reads `resolveLoanCostsForUser`.
**Contract:** `.audit/expected-moves-t2.json` — 15 declared paths (13 from the derivation sweep at `915704f0`, 2 added by the 2026-08-03 amendment).
**Registry:** **MON-130** (`changesNumbers: true`) and **MON-143**, both `FIXING`. This run is the §24.2 #7 per-fix number verification that gates them to `VERIFIED`. CI green is never verification (§23.2.3).

---

## §0 How to run this

1. Paste the **canonical brief** — `VERIFICATION_PLAYBOOK.md` §3.3, **verbatim** — first. That is the complete sweep and this document does not replace it.
2. Then paste **this overlay**.
3. The VR-044 §7 standing rules are **binding**:
   - **Never validate a number through the admin portal's own user.** Admin credentials open the relay door; the data behind it is always `?userId=` scoped to the account under test.
   - **Assert identity before reading any rendered number** — net worth **$3,401,782** · **6** properties · **5** loans · entity *"Reza"* **$2,651,782**. A run that cannot prove its account is **void**, and is reported as void, never as numbers.
   - **Separate browser profiles.** The admin login silently overwrites the user session.
   - **Complete, not sampled.**

### Build precondition — check this BEFORE reading a single number

This run is only meaningful against a build that **contains the T2 migration**. Verify both:

- the deployed `sha` reported by the relay is the merge commit of **PR #1575** (or a later commit on `main` that contains it); and
- `GET /api/admin/matrix/golden-baseline/t2-loan-cost?userId=…` returns **`moves: []`** for the `cashflow.*` and `debt.*` blocks.

That second check is the sharper one and it is worth understanding why. Before the migration the relay compared the **old** producer against the **new** one and reported 15 moves. After it, master *is* the new producer, so the same relay compares the canonical path against itself: **zero moves is the migration having landed**, and any remaining move means a producer is still off the canonical resolver. A capture taken against an older build measures an instrument that has since been replaced — that is what invalidated the second T2 capture, and it is why this precondition is stated before the predictions rather than after.

---

## §1 What was wrong, in one paragraph

Home said loans cost **$8,817/month**. `/dashboard/expenses` said **$12,779** — same five loans, same day. `masterFinancialService` built its loan leg with `data.loans.filter(l => l.minRepayment && l.repaymentFrequency)`, so a loan with no declared repayment was **dropped entirely**: both interest-only Bankwest loans and the HECS debt contributed **$0** while interest was charged on them every month. The surviving two were costed from the declared *plan* rather than the repayments actually made. The filter is now **deleted** — not widened — and every loan's cost comes from the one actuals-first resolver.

---

## §2 THE DECIDING CHECK — all 15 declared paths

Producer tree via the admin relay, `?userId=91b6d7ce…`. **These are predictions, made in advance, that can fail. Do not adjust anything to fit them.** Report the observed value for every row, including the ones that match.

| Path (`masterFinancialService.getMasterFinancialSnapshot.…`) | Was | Must now read |
|---|---|---|
| `cashflow.monthlyLoanRepayments` | 8,816.65 | **12,779.29** |
| `cashflow.monthlyCashflow` | 15,047.71 | **11,085.07** |
| `cashflow.monthlySurplus` | 15,047.71 | **11,085.07** |
| `cashflow.annualLoanRepayments` | 105,799.80 | **153,351.51** |
| `cashflow.annualCashflow` | 180,572.50 | **133,020.78** |
| `cashflow.annualSurplus` | 180,572.50 | **133,020.78** |
| `cashflow.savingsRate` | 59.37 | **43.73** |
| `cashflow.debtServiceRatio` | 34.78 | **50.42** |
| `debt.metrics.debtServiceRatio` | 34.78 | **50.42** |
| `debt.metrics.monthlyRepayments` | 8,816.65 | **12,779.29** |
| `debt.summary.totalRepayments` | 8,816.65 | **12,779.29** |
| `debt.summary.byType.*.repayments` | split of 8,816.65 | **split of 12,779.29** — see §2b |
| `quickMetrics.monthlyCashflow` | 15,047.71 | **11,085.07** |
| `quickMetrics.monthlyLoanRepayments` | 8,816.65 | **12,779.29** |
| `quickMetrics.savingsRate` | 59.37 | **43.73** |

**Two exactness traps, both already paid for once, both worth checking to the cent:**

- `annualLoanRepayments` is **153,351.51**, not 153,351.48. The engine multiplies the *unrounded* monthly by 12; multiplying the rounded 12,779.29 gives the wrong answer.
- `annualCashflow` is **133,020.78**, not .79. Deriving it from annual components (304,158.61 − 17,786.31 − 153,351.51) gives .7878 and rounds to .79. The engine's own output is .78 and the contract takes the measured value.

**Identity that must hold exactly:** all four of `cashflow.monthlyLoanRepayments`, `debt.metrics.monthlyRepayments`, `debt.summary.totalRepayments` and `quickMetrics.monthlyLoanRepayments` read **12,779.29**. They are assembled by four different expressions inside the service; before T2 they agreed only because they all read the same wrong thing. A divergence between them now is a defect, not rounding.

### §2b `debt.summary.byType` — OBSERVE the split, do not judge it

This path is declared with a **constraint**, not a value: the per-type figures must **sum to 12,779.29** and the type keys must be unchanged. The exact split is not predicted, because the committed capture's `perLoan` rows carry each loan's name, principal and basis but **not its `type`** — so predicting five numbers would have meant inventing them.

**Return the split as an observation:** every key, its repayments figure, and the total. If the total is 12,779.29 and the keys are unchanged, this row PASSES. The widened relay measures it from now on.

---

## §3 The user-visible proof — Home and `/dashboard/expenses` must finally agree

| Surface | Was | Must now read |
|---|---|---|
| Home · `THIS MONTH'S BUDGET · Loans` | $8,817 | **$12,779** |
| `/dashboard/expenses` · Loans | $12,779 | **$12,779** — unchanged |

**That single row is the whole tranche.** Two screens, one number, for the first time.

**Figures DOWNSTREAM of the declared move.** Per the VR-045 §6 lesson — a figure downstream of a declared move belongs with its arithmetic, never in a must-not-move list — these will move, and moving is correct. Report each **with the arithmetic that produces it**, checked against its derivation rather than against a remembered value:

| Rendered figure | Derivation | Expect |
|---|---|---|
| Home · `THIS MONTH'S BUDGET · Saved` | `= cashflow.monthlyCashflow` | ~**$11,085** (was $15,048) |
| Daily spending budget | `Saved ÷ days in the current month` | falls with `Saved` |
| ~~Saving-rate copy anywhere on Home~~ | ~~`= cashflow.savingsRate`~~ | **WITHDRAWN — see below** |
| Any rendered debt-service ratio | `= 50.42%` | rises from 34.78% |

A run that flags these as regressions has produced false failures — that is exactly what VR-045 caught happening once.

> **The saving-rate row is WITHDRAWN (corrected 2026-08-03 after VR-047).** It was mis-specified and
> could not land: **no Home surface renders `cashflow.savingsRate`.** Home's SAVING RATE tile and the
> HEALTH panel's Savings sub-metric both read the trailing-12-month **ACTUALS** basis — 1.9% against
> "AU median around 24%", derived from ANNUAL INCOME $239K vs ANNUAL OUTGOINGS $234K. It read 1.9%
> *before* the migration too, so "was 59.4%" was never true of anything on screen. `43.73` is correct
> in the producer tree and simply is not rendered there; it is checked in §2, where it belongs.
>
> Recorded rather than quietly deleted, because the failure mode is instructive: a prediction that
> **cannot** land is worse than a wrong one. It forces the run to choose between a false PASS and a
> false FAIL, and either answer teaches the next session something untrue. VR-047 refused both and
> reported the mis-specification — the right handling, and the reason this row is now struck rather
> than re-numbered. (The underlying "declared tile beside an actuals tile with no basis label" is the
> MON-139 class and is not T2's to fix.)

---

## §4 `mustNotMove` — the regression cluster, byte-identical

Any movement here is a new defect caused by this PR. **Revert, do not patch forward** (G7/G10).

- **Net worth $3,401,782** · **6** properties · **5** loans · entity *"Reza"* **$2,651,782**
- `/dashboard/expenses` — total outgoings **$14,261/mo** · recurring **$1,482** · one-off **$50,840** · and **all five per-loan rows with their basis labels: 83.33 + 1,191.25 + 2,518.34 + 6,196.65 + 2,789.71 = 12,779.29**. These rows were **already canonical**; T2 moves master *onto* them. **If a per-loan row moves, that is a defect, not a tranche effect.**
- `/dashboard/balances` — **LVR 41.3%**
- Home · `HEALTH` score **53** and `Debt / income` **677%**
- **`quickMetrics.monthlyIncome` 25,346.55** — frozen by T1 and the denominator of both ratios above. **If it moves, every after-value in §2 is void and the tranche stops** — that would be a T1 regression, not a T2 effect.

**Why `healthScore` stays 53 — a prediction that can fail, stated with its reasoning.** `buildHealthScore` *is* fed the moved figure, so this was computed rather than assumed. Its savings-rate component is `min(max(savingsRate × 5, 0), 100)`: 59.37 × 5 = 296.85 before and 43.73 × 5 = 218.65 after — **both clamp to 100**. Its debt-to-income component reads *principal*, which has not moved; emergency fund reads the actuals outflow; net worth is untouched. So the score should not move. **If it does, that arithmetic is wrong and it is a finding.**

---

## §5 KNOWN NON-FINDINGS — do not raise these as defects

Pre-declared so this run does not repeat the VR-029 false-fail.

1. **The entity-flow Sankey still shows the understated loan figure.** This is the most important line in this handout. T2 migrates `masterFinancialService` **only** — the one producer whose after-values the contract measures. `moneyFlowService.ts:382` still carries `if (!loan.minRepayment || loan.minRepayment <= 0) continue;`, which drops the same three loans (**2,518.34 + 1,191.25 + 83.33 = $3,792.92/mo**) from the per-entity flow. Its numbers must be **byte-identical to before this PR** — that is the check. Migrating it here would have moved `byEntity` figures the derivation sweep does not cover, producing MOVED-UNDECLARED at G7 by construction; it needs its own capture and its own declaration (**T2-B**). Report the entity-flow loan figures as observations.
2. **Home's budget tile and the entity-flow Sankey will now disagree** for the same reason. Net inconsistency across the app *falls* — Home, `/dashboard/expenses` and `/dashboard/balances` now tell one story where Home used to be the odd one out — but the Sankey is left lagging until T2-B. Record it; do not raise it.
3. **The producer count is 30, not 1.** The headline for T2 is "31 producers → one" and this PR moves it to **30**. The other 30 sites feed surfaces outside this contract (the CFO scores, risk radar, reports, the health tree, the debt planner) and each needs its own declaration.
4. **`ResolvedLoanCost` carries a new `actualsThroughDate` field.** Declared as a structural addition; nothing consumes it and no rendered number depends on it.
5. **MON-142 remains open.** Both interest-only loans still imply ~6.27% against a stored 6.690%. The effective-rate engine surfaces it; no consumer applies it.

---

## §6 Verdict format

| Item | Verdict |
|---|---|
| Build precondition — relay reports `moves: []` on `cashflow.*` / `debt.*` | PASS / FAIL (**stop if FAIL**) |
| §2 — all 15 declared paths land exactly | PASS / FAIL (list every miss with its observed value) |
| §2b — `byType` keys unchanged and summing to 12,779.29 | PASS / FAIL + the observed split |
| §3 — Home budget tile reads **$12,779**, matching `/dashboard/expenses` | PASS / FAIL |
| §3 — the four downstream figures reconcile to their derivations | PASS / FAIL |
| §4 — regression cluster byte-identical (incl. `healthScore` 53) | PASS / FAIL |
| §5 — entity flow unchanged | PASS / FAIL |
| §3.3 canonical sweep — coverage object complete, `skipped: []` | PASS / INCOMPLETE |

**If every row PASSES:** MON-130 and MON-143 move `FIXING → VERIFIED` with this run's ID in the notes.
**If any fails:** report the exact misses with observed values. Code re-diagnoses from Stage 1 (`FIX_PROTOCOL.md`); the issues stay `FIXING`. Every new failure outside the declared set becomes a fresh `MON-###` via `npm run issues:raise`.

---

## §7 Return format (§3.0c) — machine-consumable first

> **Return one fenced ```json block conforming to `matrix-result/v1`, then your human note.**
> The JSON is what Code consumes; the note is what Reza reads. Never only the note.

```json
{
  "schema": "matrix-result/v1",
  "handout": "docs/verification/briefs/RING3_T2_LOAN_COST.md",
  "kind": "ring3",
  "runId": "VR-047",
  "sha": "<full 40-char commit this run executed against>",
  "capturedAt": "<ISO timestamp>",
  "account": {
    "userId": "91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c",
    "identityAssertion": {
      "expected": { "loanCount": 5, "netWorth": 3401782 },
      "observed": { "loanCount": null, "netWorth": null },
      "pass": false
    }
  },
  "verdict": "PASS | PARTIAL | FAIL",
  "sectionsNotRun": [],
  "checks": [
    { "id": "cashflow.monthlyLoanRepayments", "surface": "relay producer tree",
      "expected": 12779.29, "observed": null, "pass": false },
    { "id": "home.budget.loans", "surface": "/dashboard (THIS MONTH'S BUDGET)",
      "expected": 12779, "observed": null, "pass": false }
  ],
  "findings": [],
  "payload": null,
  "coverage": { "verified": "…", "notVerified": "…" }
}
```

Validate with `npm run matrix:check -- <file.json>` before acting on it. Exit 0 means the result is well-formed and self-consistent — **not** that it passed. Read `verdict`. A FAIL is a valid result.

---

## §8 Gate (§20.6)

`Gate (§20.6): Document 10/10 (MON-131_COMPLETION_BRIEF §3.0b/§3.0c · VERIFICATION_PLAYBOOK §3.2/§3.3 · expected-moves-t2.json · RING3_VR045_T1_REPAIR precedent) · Requirements 10/10 · Logic 10/10`

Self-review changed three things. (1) The first draft listed `healthScore 53` in `mustNotMove` without reasoning — but `buildHealthScore` is fed the very figure that moves, so leaving it unexplained would have been an assumption dressed as a guard; §4 now carries the clamp arithmetic and states plainly that it can fail. (2) The first draft had no §5.1 — a run following it would have found Home's budget tile and the entity Sankey disagreeing and reported a regression, when that divergence is the declared, remaining T2-B scope. (3) `byType` was originally written as a normal declared row; since its per-type split is not derivable from the committed capture, it became an **observation with a sum constraint**, because predicting five invented numbers is worse than declaring the bound honestly.

**Coverage boundary, stated precisely.** This run verifies that the 15 declared producer paths land on their declared values, that Home's budget tile matches `/dashboard/expenses`, that the named regression cluster is unmoved, and that the entity flow is unchanged. It does **NOT** verify the correctness of the declared values themselves (that is the derivation sweep at `915704f0` plus the Ring-0/Ring-2 fixtures), does **NOT** verify any loan-cost producer other than `masterFinancialService`, does **NOT** close MON-142, and does **NOT** verify any surface outside the §3.3 canonical sweep plus the paths named here.
