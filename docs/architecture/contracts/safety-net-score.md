# safety-net-score

**Proposed name:** `safety-net-score` (D13 quantity 4 of 4 — the question it answers:
**"How ready is my safety net for a shock — buffer, bills discipline, debt restraint, positive
cashflow — the TRAIL Anchor readiness score?"** This is the Safety Net page's **63**; it is a
different question from Home's 54 and must never be reconciled to it.)

Phase A Quantity Contract (MON-131, brief §3). READ-ONLY analysis at HEAD `2f9f2e16`.

## classification

**DERIVED** (D1). 0–100 integer + grade (STRONG/BUILDING/FRAGILE/AT RISK) + 4-dimension breakdown.
Computed per request, never stored.

## semantic

- **Question:** shock-readiness of the safety net (TRAIL Stage A / Anchor), a 4-dimension additive
  score — deliberately behavioural (bills tracking earns points) rather than balance-sheet-wide.
- **Formula shape** (`safetyScore.ts:59–90`):
  - emergencyFund (max 40) = min(monthsCovered/targetMonths × 40, 40); targetMonths ≤ 0 ⇒ 0
  - billsOnTime (max 30) = totalBills > 0 ? billsOnTime/totalBills × 30 : **0** (MON-017: zero
    tracked bills is not full marks)
  - noNewDebt (max 15) = **flat 15 placeholder** (declared, not measured — no data source yet)
  - positiveCashflow (max 15) = cashflow > 0 ? 15 : cashflow > −200 ? 8 : 0
  - `total = round(Σ)`; grade ≥80 STRONG, ≥60 BUILDING, ≥40 FRAGILE, else AT RISK.
- **Inputs** (route `app/api/safety-net/route.ts:88–94`): `snapshot.emergencyFund.monthsCovered` +
  `.targetMonths` (canonical), active `RecurringPayment` counts, and
  `getCanonicalMonthlyCashflow(snapshot).net` (actuals-first — MON-017 residual fix at `:63`).
- **Units:** dimensionless 0–100 + grade.

## canonicalHome

`lib/calculations/safetyScore.ts:59` `computeSafetyScore` (pure engine, MON-017).
**Decimal twin: NOT ESTABLISHED.**
Under D13 this quantity keeps its own home.

## callSites

| Site | Tag |
|---|---|
| `app/api/safety-net/route.ts:21` (import), `:88` (call) | CONSUMER (sole runtime caller) |
| `tests/calculations/safetyScore.test.ts`, `tests/golden/ring2.safetyNetRoute.test.ts`, `tests/verification/vr001Ratchet.test.ts:10,28,37` | CONSUMER (Ring-0/Ring-2 locks incl. route drift guard) |

No other producer found (single-sourced; the pre-MON-017 inline fiction was deleted).

## invariants

- `total ∈ [0,100]`: dimensions capped 40+30+15+15 = 100, each floored at 0.
- Zero tracked bills ⇒ billsOnTime.score = 0 (never 30) — locked by `safetyScore.test.ts:64`.
- Deficit cashflow ⇒ positiveCashflow.score = 0 (locked `:42`, hand example −6073 ⇒ 0).
- `noNewDebt = 15` is a DECLARED PLACEHOLDER, not a measurement — any ledger claim about this score
  must carry that caveat (max honest measured range is 0–85 + 15 assumed).
- Monotone in monthsCovered up to target; saturated (40/40) for monthsCovered ≥ targetMonths.

## independentExpectation

**NONE FOUND.** Dimension maxima (40/30/15/15), the −200 grace band and grade cut-offs are product
policy. Externally **UNVERIFIABLE**; verification = the existing worked-example fixtures
(EF 40 + bills 30 + 15 + 15 identity in `ring2.safetyNetRoute.test.ts`).

## surfaces

| Route | Label |
|---|---|
| `/dashboard/safety-net` | headline score + grade + 4-dimension bars — `safety-net/page.tsx:178–191` (`data.safetyScore.total/.grade/.breakdown`). **This is the "63".** |

Single surface at HEAD (exhaustive per grep of `computeSafetyScore` + `/api/safety-net` fetchers).

## expectedMoves

**The D3/D4 runway migration (11.6 → ~72.6 months) predicts NO movement in this score — with the
arithmetic:** emergencyFund dimension = min(months/6 × 40, 40); at 11.6 months it is already
saturated at 40/40, and 72.6 keeps it 40/40. The other three dimensions do not read the runway.
Total unchanged (63 stays 63 on the same day's data).
Falsifiability caveat: if MON-132 changes `targetMonths` semantics (see runway contract decision 5)
or introduces ∞/INSUFFICIENT months values, `monthsCovered/targetMonths` needs a defined behaviour
(∞/6 must still cap at 40, and INSUFFICIENT must not NaN the score) — the migration PR must add that
fixture before touching the input type.

## decisionsRequired

1. **`noNewDebt` placeholder** (flat 15/15): ship transaction-based new-debt detection, rescale the
   score to /85, or keep the labelled placeholder? Each option changes the displayed 63 differently —
   Reza call, phrased: "13 of your 63 safety points are currently assumed, not measured."
2. When the Safety Net page adopts the D3/D4 survival-runway sentence, should THIS score's
   emergency-fund dimension also switch its input to the survival-runway months (same value flows in;
   semantics of the 40-point dimension changes from "expense cover" to "salary-loss survival")?
   Cosmetic today (saturated either way) but changes what the dimension MEANS — name it before
   Phase B.
3. UI naming per D13: label the page score "Safety Score" (already close) and ensure no surface
   calls it "health".

## coverageBoundary

Read at HEAD: `safetyScore.ts` (full), `app/api/safety-net/route.ts:1–180`,
`safety-net/page.tsx` (score + EF regions), the three test files' cited asserts. NOT read:
recurringPayment data quality (bills counts feed dimension 2 — their correctness is a FACT-intake
question outside this contract). Verifies producer, formula, single surface; does NOT verify the
canonical cashflow/emergency-fund inputs themselves (other contracts).

*Drift:* none — `:59` exact at HEAD.

## Adversarial review (§7) — 2026-07-29
- Claims checked: 19 (anchors 11 · arithmetic 6 · negative-claims 2)
- REFUTED / CORRECTED: **none.**
- Verified intact at HEAD (696ec349; commits since pinned 2f9f2e16 are docs-only): `computeSafetyScore` :59 EXACT and every dimension formula matches source :59–90 — EF `min(months/target×40, 40)` with `targetMonths ≤ 0 ⇒ 0` :61–62; bills `totalBills > 0 ? ratio×30 : 0` :66 (MON-017); `noNewDebtScore = 15` flat placeholder :70 with the header's own "optimistic default / not a measured value" disclosure :68–69; cashflow `>0 ⇒ 15 · >−200 ⇒ 8 · else 0` :75; `total = round(Σ)` :77; grades 80/60/40 :80. Route: import :21, `qm.liquidCash` :42, EF reads :50–54, `getCanonicalMonthlyCashflow(snapshot).net` :63 EXACT (actuals-first input claim confirmed), engine call with the five inputs :88–94 EXACT, months render :152. Tests: deficit −6073 ⇒ 0 at `safetyScore.test.ts:41–42` ✓; zero-bills ⇒ 0 at :63–64 ✓; `vr001Ratchet.test.ts` :10 import + :26–40 Ring-0 deficit ✓; `ring2.safetyNetRoute.test.ts` exists ✓.
- Negative claims attacked and SURVIVED: (1) **single surface** — independent grep for `/api/safety-net` fetchers finds only `app/dashboard/safety-net/page.tsx:107`; grep for other `computeSafetyScore` callers finds only the route + tests. Single-sourced and single-surfaced CONFIRMED. (2) **"NONE FOUND" independentExpectation** — agreed; 40/30/15/15, the −200 band and grade cut-offs are product policy.
- expectedMoves arithmetic recomputed: min(11.6/6 × 40, 40) = 40 (saturated); min(72.6/6 × 40, 40) = 40. The other three dimensions read no runway input. **No-move prediction sound.** The ∞/INSUFFICIENT caveat is real — :62 divides `monthsCovered/targetMonths` with no non-finite guard today, so an ∞ input would propagate without the fixture the contract demands.
- Honest-range check: "max honest measured range 0–85 + 15 assumed" — dimensions 40+30+15 = 85 measured + 15 placeholder ✓.
- Could not verify: recurringPayment data quality (bills counts — FACT-intake, disclosed); the rendered "63" (Ring-3).
- Verdict impact: **none. PASS** — survives the hostile read unchanged.
