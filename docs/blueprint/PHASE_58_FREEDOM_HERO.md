# Phase 58 — The "Freedom" hero: Financial Independence

**Status:** 🟢 Shipping (same PR as Phase 57).
**Started:** 2026-07-02.
**Origin:** Reza (2026-07-02): *"I need the tiles to be real value add … something that wow the
users (that will be very hard for the user to figure out without having all portfolio in one page).
Give me the wow factor."* — after asking the F1/F2/F3 options be run through the four-lens / 10/10 gate.

---

## 1. The decision (gate outcome)

The earlier F1/F2/F3 (runway framings) failed the "wow" bar — a runway is *defensive* and
*guessable*. The 10/10 synthesis: the hero should surface the **one truth only Monitrax can compute**
because every domain is on one page — **how much of the life you actually live is already funded by
your portfolio.**

> **"Your portfolio covers 44% of the life you actually live."**

## 2. The number (honest by construction)

`coverageNow = netAccessiblePassiveAnnual ÷ lifestyleAnnual × 100`

- **NET** — rent counts only after property expenses + loan repayments (per-property `monthlyCashflow`,
  the only net figure). `snapshot.income.passive` is **GROSS** and is never used for rent. Non-property
  passive (dividends / interest / royalties) is added. Gross rent would overstate freedom on a geared
  portfolio — the exact lie §0/§19.1 forbid.
- **ACCESSIBLE** — preserved super is excluded from "now" (you can't draw it). It's surfaced as a
  secondary **"→ N% once your super unlocks at 60"** line via a labelled **4% safe-withdrawal**
  assumption (Bengen/Trinity), never a promise.
- **LIFESTYLE** — the Phase 57 trailing real spend (declared-plan fallback).
- **Growth-vs-income split** — properties with net cashflow ≤ 0 read as *"building equity"*, not
  failure (§0 behaviour lens); > 0 as *"producing income"*.
- **Momentum** (engine-ready, wired next): net-worth Δ split into savings vs "money working".

Why only Monitrax: nets 6 properties against 5 loans' costs + dividends + interest, ÷ real spend —
no bank / share platform / super fund sees across all of it. That's the moat.

## 3. Architecture (SSOT / Neomatrix)

- **One new canonical engine** `lib/calculations/financialIndependence.ts` → `computeFinancialIndependence`
  (pure; §6.4). Reuses existing canonical inputs (per-property net cashflow, passive `byType`,
  `netWorth.assets.superannuation`, trailing spend) — no parallel source (§12.2.1).
- Modelled as Neomatrix node `engine.financialIndependence.computeFinancialIndependence` + edges
  (moneyStoryTrend → FI → dashboard hero), verified `file:line`, §19.2 worked example in the A1 test.
- Hero UI: `MoneyStoryHeroV2` leads with the coverage % (supersedes the legacy `freedomYears`
  runway, kept as a fallback prop). The `MARGIN 100%` bug is fixed by putting earned/kept on the
  trailing basis.

## 4. Known limitations (honest)
- **SMSF**: SMSF assets flow through the owning entity's investments and are counted as accessible;
  they are not yet preservation-gated for the "now" figure. Documented; a follow-up.
- **Momentum line**: engine supports it; wiring the net-worth-history delta is the immediate next step.
- **Per-user drawdown / preservation age**: the at-60 layer uses a flat 4% on total super, not a
  per-member preservation-age model (no birthdate/preservation data yet).

## 5. Follow-ups
- Wire the momentum "your wealth grew $X — $Y while you slept" line (net-worth history).
- SMSF preservation gating for the "now" coverage.
- Regenerate Layer-0 structural graph via `graphify` (the new engine file was hand-reconciled into
  the manifest because the graphify binary isn't available in the build sandbox).
