# Verification Protocol — The Number Ledger

**Standing protocol. Runs after every MON-131 tranche reaches PROD, and in full at completion.**
**Owner:** The Matrix · **Commissioned by Reza, 2026-07-29:** *"track each number individually in the whole app… all derived numbers calling the same calc engine… presented number the same and correct in all locations… both code verification and through Chrome in PROD real numbers."*

---

## 1. The trap this protocol is designed around

**"Same" and "correct" are different tests, and consistency can be uniformly wrong.**

If 28 producers collapse to 1 and that 1 carries a bug, every surface agrees perfectly — and a cross-surface consistency check **passes**. The MON-131 fix makes this failure mode *more* likely, not less: it removes the disagreement that used to make errors visible.

So every quantity needs **three** independent verdicts, and all three must pass:

| Axis | Question | Fails when |
|---|---|---|
| **A — Singularity** | Is there exactly one producer? | code says 2+ |
| **B — Consistency** | Does every surface render the same value? | any two cells differ |
| **C — Correctness** | Is that value right, derived independently? | value ≠ law/rule-derived expectation |

**C is the one that cannot be automated away and must never be skipped.** B without C is how a uniformly wrong number ships.

---

## 2. The Ledger

One row per **(quantity × surface)** cell. ~23 quantities × the surfaces that render each.

```
QUANTITY        e.g. monthlyCommitted
CLASSIFICATION  FACT | DERIVED
PRODUCER        the single canonical producer, file:function
PRODUCER_COUNT  from census:producers — must be 1 (+ Decimal twin)
SEMANTIC        basis · window · inclusions · exclusions · units
EXPECTATION     independently derived, with the arithmetic shown, and its SOURCE
                (legislation / canonical formula / arithmetic identity — NEVER another screen)
CELLS[]         { surface, route, label, renderedValue, capturedAt }
VERDICT         A: SINGLE|MULTIPLE · B: CONSISTENT|DIVERGENT · C: CORRECT|WRONG|UNVERIFIABLE
```

`UNVERIFIABLE` is a legitimate and required outcome. It is recorded honestly, never upgraded to a pass.

---

## 3. Axis A — code verification

Per quantity, at the pinned HEAD:

1. `npm run census:producers` — count must be **1** (plus its Decimal twin). Any other count fails A.
2. Every remaining call site is a **CONSUMER** (calls the producer) or a **DIFFERENT-QUANTITY** (renamed, contracted). No un-contracted duplicates.
3. `lint:source-lock` (now scanning `lib/`) green; exception counts ratcheted **down**.
4. Float ≡ Decimal parity test present and passing.
5. The producer's semantic matches its Quantity Contract from Phase A of the build.

**Axis A is necessary and not sufficient.** One producer proves nothing about its correctness.

## 4. Axis B — live consistency via Chrome, PROD, real data

1. Confirm the PROD deployment SHA equals the pinned HEAD. **Never verify against an unpinned surface.**
2. For each quantity, visit **every** surface in its `CELLS[]` and capture the rendered value, its label and route.
3. Every cell must be **byte-identical**. Rounding differences are a FAIL, not a tolerance — they indicate two conversion paths.
4. Any divergence is recorded with both values and both routes, and filed as a new MON with the exact captured figures.

Practical notes carried from VR-038/040/041:
- Beware **stale caches**. On `/dashboard/budget-analysis` a cached card rendered new captions over old numbers. Force regeneration; never trust a first paint.
- Read the **persisted** value after a hard reload, not the on-screen state.
- Extraction is scripted per surface for repeatability; ad-hoc reading does not survive a re-run.

## 5. Axis C — independent correctness

**The expectation is derived from law, a canonical formula, or an arithmetic identity — never from what another screen shows.** This is the holistic-verification law applied to verification itself.

Worked precedents from this programme:

| Quantity | Independent derivation |
|---|---|
| Income tax | Re-walk the brackets from the *rendered* bracket table, re-deriving every base amount (VR-039: `$4,020 = 0.15 × 26,800`; `$31,020 = 4,020 + 27,000`; `$51,370 = 31,020 + 20,350`) |
| Net income | **`netTotal ≤ grossTotal`** — an arithmetic impossibility test that would have caught MON-128 on day one |
| Property equity | Σ per-property equity **must equal** the portfolio hero, with negative equity preserved un-floored |
| Balance-sheet buckets | Liquid + Accessible + Locked **must equal** net worth to the dollar |
| Loan cost | Σ per-loan rows **must equal** the stated aggregate; an interest-only loan must never be $0 |
| Emergency runway | `liquid / (essential − salary-independent income)`, recomputed by hand from its inputs |
| Depreciation | Same schedule through every path yields the same annual figure (the 100× rate-unit guard) |

**Where no independent derivation exists, the verdict is `UNVERIFIABLE` — never `CORRECT`.**

## 6. Cadence

- **Per tranche, on PROD:** Axis A + B for every quantity that tranche touched, plus Axis C for any whose value moved. Diff against the golden baseline (§11 of the build brief) — **any movement not in `expectedMoves` stops the programme.**
- **Regression guard, every tranche:** the untouched cluster from VR-041 Part C must be byte-identical.
- **At completion:** the full ledger — all 23 quantities, every surface, all three axes. Published as `docs/verification/runs/VR-0XX-number-ledger.md`.
- **Standing thereafter:** re-run at each release. Axis A is CI-cheap and should run every build.

## 7. Definition of done

- **23 quantities, 23 canonical producers.** Census ratchet green.
- Every ledger cell **CONSISTENT**.
- Every quantity **CORRECT** against an independent derivation, or explicitly **UNVERIFIABLE** with the reason recorded.
- Golden-baseline diff clean; every movement pre-declared with its arithmetic.
- The ~19 downstream issues re-verified live and closed on their own evidence — not on the assumption that the root-cause fix closed them.

## 8. Standing constraints during any run

- **Never fix a number.** Verification does not touch data or code. Entering a fixture to exercise a path is permitted; withdrawing it afterwards is mandatory.
- **No API probing.**
- **Untraced difference = observation, not finding.** Root cause established before anything is filed.
- Every run records what it did **not** cover, per surface. Partial coverage reported as full coverage is the failure this protocol exists to prevent.
