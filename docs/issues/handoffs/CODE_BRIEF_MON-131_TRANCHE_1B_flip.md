# CODE BRIEF — MON-131 Tranche 1-B: the flip

**Model: Fable 5. Branch off `main`.**
**changesNumbers: YES — extensively.** Reza reviews a before/after table and clicks the merge.
**Evidence base:** `docs/verification/runs/VR-043.md` (merged). Build brief: `CODE_BRIEF_MON-128_TRANCHE_1_income.md`. Start gate: `CODE_BRIEF_MON-131_TRANCHE_1_START_GATE.md` — **§1.1 of that file is withdrawn**, see VR-043 §6.

---

## §0 Where T1 stands

**T1-A acceptance: PASS.** VR-043 §1.3 — a leaf-by-leaf diff of the pre-merge tree at `d3d7e147` against a fresh capture at `3028c08a`: 10,233 leaves identical, **0 money leaves moved, 0 disappeared**, 64 new leaves all `null` and all exactly the four declared FACT columns. `captureErrors: []`. **Do not revert.**

**The baseline reference now exists** — `treeHash 6f2369a6f0f94279e171bf95db3af26fcee16ef07d0371c14480ac98b16c0224` at `3028c08a`, 8 trees, 1,767 leaves, determinism checked. This is the "before" for T1-B's G7 diff.

**G3 is fillable.** All 24 `PENDING_RELAY` after-values are computed on real production data and tabulated in VR-043 §3.

**One gate remains, and it has four parts.** They are §1 below. All four are answerable from the codebase — **none requires anything from Reza.**

## §1 The four gates — answer before writing the flip

### 1.1 Does `/dashboard/tax` PAYG move? **(blocks G7)**

`income.annual.all.paygWithholding` is declared **11,128.70 → 43,004**. `/dashboard/tax` renders `PAYG withheld $11,129`, and `renderedPartC.payg` still reads **11,129** post-merge. It comes from `getUserTaxPosition` — **and no `getUserTaxPosition` path appears in the 24 declared moves.**

Trace the producer feeding that surface. Exactly one of these is true and each has a required action:

| If | Then | Required |
|---|---|---|
| The tax page reads a **different** producer and will not move | The app renders "$11,129 withheld" beside an engine that withheld **$43,004** — a *new* contradiction created by the fix | **Not acceptable as a shipped state.** Either bring it into T1-B's scope, or file it with a MON id, a tranche assignment and a dated commitment. Do not leave it unnamed |
| The tax page **does** read this path | `taxOwing` moves with it: `37,786 − 43,004` turns a **$26,658 bill into a ≈$5,218 refund** | **Declare it, with arithmetic, per path** — `payg`, `taxOwing`, and anything else downstream. Undeclared, it stops the tranche on G7 |

**This is the largest user-visible swing in the tranche.** It is also the one most likely to be right — the old $11,129 was never the amount the engine withheld (VR-042 V3). Whichever way it resolves, it resolves *explicitly*.

### 1.2 Do Home's cashflow and savings-rate tiles move? **(blocks G7)**

Home renders **−$6,073/mo** and **−30.5%**. The declared set moves `cashflow.monthlyCashflow` **+27,987.35 → +15,047.71** and `cashflow.savingsRate` **73.1 → 59.37**, plus their `quickMetrics` twins. **Both pairs render on the same screen today** — that is VR-042 V7, and it is the clearest single instance of MON-131 a user can see.

Trace Home's tiles. Same three-way outcome as §1.1: they move and are declared · they read a producer T1 does not touch and that producer is **named, id'd and assigned a tranche** · or they are in scope and T1-B collapses them too. **Silence is the one option that is not available**, because an undeclared move stops G7 and an undeclared non-move ships the contradiction.

### 1.3 Name the third rental value

VR-043 §4 settled two of three, and they are **legitimately distinct quantities**: `declaredRunRateAnnual` **121,227.40** versus actuals-first banked **154,443.11**. Legacy `byType` already equals the per-property engine, so those two were never in conflict.

**$121,881 — the Tax-page figure named in the build brief §2.1 — appears nowhere in the relay output.** Locate it or prove it no longer exists. D6 requires every surviving value to carry its own name; closing T1 with an unexplained third value is the exact failure D6 exists to prevent.

### 1.4 Confirm the hash gate excludes clock and calendar leaves

The tree contains at least one leaf that changes with the calendar rather than with code: `getMasterFinancialSnapshot.staleness.oldestManualAgeDays` went **41 → 42** between the two captures. `scanForRisks.lastScanned`, `generateHealthReport.evidence.lastUpdated`, and the per-scan risk UUIDs and `detectedAt` stamps are the same class.

If any of these are inside the 1,767-leaf hashed set, `?format=hash` emits a **false STOP at every day boundary** — and a gate that cries wolf gets ignored, which is worse than no gate. The 1.5-second determinism check in VR-043 §1.2 **cannot** distinguish "excluded" from "not enough time passed."

Confirm the canonicalisation excludes them. If it does not, exclude them and **re-issue the reference hash** — T1-B's G7 depends on it.

## §2 Scope of the flip

1. **Wire every consumer onto `assembly.ts`.** It is the ONE wiring, per T1-A's own design and the MON-035 parity lesson.
2. **Delete the legacy producers, citing their contract entry** — not deprecate, not leave dormant. The census reseed declared in T1-A (+~30 transitional sites) carries a hard commitment: **every count lands BELOW its pre-T1 seed.** Publish was-and-now, with **collapsed** separated from **deleted as dead** (D46) — removing code nobody ran is not progress and must not read as progress.
3. **MON-138** — Schedule-1 band selection's one-dollar gaps. Fix and declare; T1-A deliberately preserved the legacy behaviour.
4. **The `helpLoanDeclared` intake.** See §4 — this is the highest-value item in the tranche.
5. **The FACT intake UI** for `actualNetPay` and salary sacrifice (build brief §5). Every field ships with an **undetermined** state. **No default asserts a tax position.**
6. **The D17 naming.** Not "net income" — banked/received, named as such, and every ratio built on it states its basis.

**Explicitly NOT in scope** — fixing these here contaminates the diff: the loan producer at `cashflow.monthlyLoanRepayments` **8,816.65** (T2) · the pre-MON-126 expense producer at **52,322.58** and `expensesByCategory` collapsed to OTHER (T3) · `cashflow.taxableIncome` reconciling to the tax engine's **145,426** (T4, VR-042 V4 stays open) · the Home debt tile's **377,822** unclassified gap (T5).

## §3 `expectedMoves` — fill it before the first migration commit

Copy VR-043 §3 verbatim, **per path, with the arithmetic**, plus whatever §1.1 and §1.2 resolve to. Correct the health pathPrefix to `…generateHealthReport.healthScore.score` at fill time, as T1-A's PR noted.

**Never a directional prefix.** "Income falls" would absorb an unrelated regression as expected — the precise failure mode MON-135 exists to prevent on the expense side.

**Must NOT move** — the regression cluster at `3028c08a`, byte-identical across VR-041, VR-042 and VR-043:

net worth **3,401,782** · total assets **5,461,679** · liquid **301,808** · accessible **67,871** · locked **3,032,102** · property equity **2,955,102** · taxable income **145,426** · tax net **37,786** · Medicare **2,909** · deductions **172,325** · committed **14,261** · recurring **1,482** · one-off **50,840** · loans **12,779** and all five per-loan rows.

**`payg 11,129` is deliberately NOT in this cluster** (start-gate brief §4) — freezing it would freeze a defect. §1.1 gives it its arithmetic instead.

## §4 The study loan — why this is the tranche's highest-value item

`bankedSummary.withholding.help` = **0**, because 5 of 6 income rows carry `helpLoanDeclared: null`. That is the correct UNDETERMINED state and the engine is right to refuse to guess.

But the balance sheet shows a **HECS / student loan of $25,000 at 4.00% variable**, and the engine's own `repaymentIncome` derivation returns **225,765.90** — `complete: false`, with `totalNetInvestmentLoss` and `reportableSuperContributions` PROVIDED and three components `DEFAULT_ZERO`. **That figure is above the $186,050 cliff.** On the engine's own top-band rule — 10% of the whole — roughly **$22,576/yr** is currently rendered as **$0**.

A correct engine that never runs produces the same number as no engine. **The intake is what makes it real**, and it is the single largest correction available in T1. Ship it with the flip.

Two things it must not do: it must not default the flag (absence of a declaration is not evidence of absence of a loan — render **undetermined**), and it must not present the resulting figure as advice. It is the engine's output under published thresholds.

## §5 Ring-3 acceptance — the Matrix's contract, stated in advance

So the shape of the verification is known before the build, not negotiated after:

1. **`?format=hash` against `6f2369a6…`.** A match means nothing moved anywhere. A mismatch is expected here — T1-B moves numbers by design — so the hash is the *detector*, and the per-path diff localises.
2. **Every declared path lands on its declared value.** Not "close", not "directionally right".
3. **The regression cluster is byte-identical**, §3.
4. **No undeclared movement anywhere in the 1,767 leaves.**
5. **Rendered surfaces read live in Chrome** — Home, `/dashboard/tax`, `/dashboard/balances`, `/dashboard/expenses` — and cross-checked against the producer values. Producer-and-screen agreement is its own check; VR-042 §2.1 and VR-043 established the method.
6. **The identities hold on real data:** `gross − withholding ≡ banked` · sources sum to the total on both bases · `netTotal ≤ grossTotal` in Float and Decimal.

**If any of 2, 3 or 4 fails: revert the merge. Do not patch forward.**

## §6 Order of work

1. §1.1 – §1.4 — the four traces. **They gate everything else**, and two of them may change what T1-B's scope is.
2. Fill `.audit/expected-moves-t1.json` (§3), commit it **before** the first migration commit.
3. Build §2.
4. Ledger §3: T1-A row DONE citing VR-043; T1-B row IN BUILD; record VR-043 §6 as the resolution of the leaf-count question and mark start-gate §1.1 withdrawn.
5. The before/after table for Reza's merge review — in his language, not path names.

## §7 Neo-sync (§21.2.2)

Neomatrix re-pin for every wired consumer and every deleted legacy producer; NeoAudit gains the three §5.6 identities as permanent ratchets plus the MON-138 boundary test; census re-run with was-and-now published per §2.2; changelog + `0·REF`; ledger rows filled with evidence. Nothing sandbox-only.

---
*Prepared by The Matrix, 30 July 2026. Evidence: VR-043 (live production, admin relay, read-only). Decisions: D6 · D17 · D18 · D20 · D33 · D35 · D42 (C2, C3) · D46.*
