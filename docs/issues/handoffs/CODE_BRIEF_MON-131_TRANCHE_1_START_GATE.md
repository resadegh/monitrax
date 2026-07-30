# CODE BRIEF — MON-131 Tranche 1: the start gate

**Model: Fable 5. Branch off `main` (`d3d7e147`).**
**changesNumbers: NO for this brief.** Nothing here migrates a producer. This clears T1's start gates so the build brief can run.
**Companion to:** `docs/issues/handoffs/CODE_BRIEF_MON-128_TRANCHE_1_income.md` — that is the build brief and it stands unchanged except where §2 below amends it. **Read it first.**

---

## §0 Where the programme actually is

`MON-131_TRANCHE_LEDGER.md` §3 lists Tranche 1 as **BLOCKED** on G3 (`expectedMoves` not written), G4 (baseline) and G5 (facts). VR-042 changes two of those.

| Gate | Was | Now | Basis |
|---|---|---|---|
| **G4 baseline current** | ❌ BLOCKED — no committed artefact (drift log D5) | ✅ **CLEARED** | Capture at `d3d7e147`: 8 trees, 10,254 leaves, canonical leaf-list SHA-256 `700935f3b4313087eade1d1c8fffd333d41e081649c8ed2bedc024fad01a680e`. `docs/verification/runs/VR-042.md` §2 |
| **G1 preconditions** | ✅ | ✅ **now evidenced** | MON-135 Ring-3 acceptance **PASS** — 48 rendered figures, zero movement. VR-042 §1 |
| **G5 facts** | ❌ | ✅ **not a blocker** | Already settled by the build brief's §0. Restated in §3 below because the ledger row still reads ❌ and must be corrected |
| **G3 expectedMoves** | ❌ | ❌ **the one remaining gate** | §4 below |

**So: one gate left, and it is Code's to close.**

## §1 Two open questions from the capture — answer these first

**1.1 The leaf count moved 1,767 → 10,254 for the same user.** Run:

```
git log d3d7e147...4e6cdd5c -- lib/matrix/goldenBaseline.ts
```

- If the `CAPTURES` table or the recursion changed → the difference is **instrumentation**, 10,254 is the new reference, record it in the ledger and proceed.
- If it did not change → the capture is **reaching data it previously did not**, and that needs its own explanation before this baseline is trusted as a "before". **Do not start T1 on an unexplained baseline.**

**1.2 The reference tree has nowhere to live.** It is 282 KB and exists only in the Matrix's browser session. `POST /api/admin/matrix/golden-baseline/diff` takes a prior tree as input, and the Lambda cannot write to the repo — so today there is no committed "before" for T1's G7 diff to run against.

Proposed: add **`?format=hash`** to `GET /api/admin/matrix/golden-baseline`, returning `{sha, leafCount, treeHash, perTree, renderedPartC}` — roughly 400 bytes, committable under `.audit/golden-baseline-<sha>.json`. That is sufficient for the CLEAN/STOP gate: a matching `treeHash` proves nothing moved anywhere. Localising a mismatch still needs the full tree via the CLI.

**This is a real blocker for G7, not a nice-to-have.** Your call on the mechanism; the requirement is that a committed before-state exists before T1's first migration merges.

## §2 What VR-042 changes in the build brief

The build brief §1 states the root defect as: no one-off gate in `incomeAggregator.ts`, plus `getNetAmount` deducting tax only for salary. **Both true. Both incomplete.** The producer capture shows a second, independent mechanism inside `masterFinancialService`, and T1 must fix it or the headline figure will still be wrong after the migration.

### 2.1 The `cashflow` block is mislabelled and double-deducts (VR-042 V2, V3)

Measured at `d3d7e147`, from `getMasterFinancialSnapshot`:

| Field | Value | What it actually is |
|---|---|---|
| `income.annual.all.grossTotal` | **505,564.05** | the real gross |
| `income.annual.all.netTotal` | **495,632.05** | gross less **9,932.00** — and 9,932.00 appears nowhere as a named field |
| `income.annual.all.paygWithholding` | **11,128.70** | ❌ **not the amount actually deducted.** This is the figure `/dashboard/tax` renders as `PAYG withheld $11,129`, but the deduction applied was 9,932.00. Gap **1,196.70** |
| `cashflow.annualGrossIncome` | **495,632.05** | ❌ **this is `netTotal`, in a field named gross** |
| `cashflow.annualPaygWithholding` | **36,197.69** | ❌ a third PAYG figure — **3.25× the rendered one, 3.64× the applied one** |
| `cashflow.annualNetIncome` | **459,434.36** | ❌ `495,632.05 − 36,197.69` — **PAYG deducted a second time, from an already-net figure, using the largest of the three** |

**Three PAYG values, not two:** **9,932.00** applied · **11,128.70** reported and rendered · **36,197.69** used by `cashflow`. Confirmed against the type split — `byType.SALARY` gross **227,519.50** net **217,587.50** is a difference of exactly **9,932.00**, and `OTHER` and `RENTAL` carry gross ≡ net, so salary withholding is the entire deduction. **The number the tax page shows the user as withheld is not the number the engine withheld.**

Same shape monthly: `grossTotal` **42,130.34** − `netTotal` **41,302.67** = **827.67** applied, against a stated `paygWithholding` of **927.39**; `827.67 × 12 = 9,932.00` and `927.39 × 12 = 11,128.70`, so the discrepancy is systematic, not rounding. And `cashflow.monthlyGrossIncome` **41,302.67** ≡ `income.monthly.all.netTotal`, not the gross.

**Three consequences for the build brief.**

- **The `netTotal ≤ grossTotal` invariant in §3 would pass today** — 459,434 ≤ 495,632 — because both operands are wrong in the same direction. Add a stronger sibling: **`cashflow.annualGrossIncome ≡ income.annual.all.grossTotal`**, and the same for the monthly pair and for PAYG. An invariant that compares a quantity to *itself under another name* is what catches this class; a comparison between two derived values does not.
- **This is the actual explanation of MON-128.** The build brief §1 frames `$41,303/mo` against `$317,751/yr` as net-exceeding-gross. It is not a paradox — it is a *different producer's net total, mislabelled gross*, rendered beside a third producer's annual figure. Update §1 of the build brief to say so; the wrong diagnosis would send the fix to the wrong file.
- **A `paygWithholding` field must equal the deduction it describes.** `grossTotal − netTotal ≡ paygWithholding` is the identity, and it fails by **1,196.70/yr** today. Whichever of 9,932.00 and 11,128.70 is correct, one of the two is being computed by a producer that is not the one feeding the subtraction — find both before deciding which survives. **This is the one to trace first**, because the tax page renders 11,129 to Reza as the amount withheld from him, and it is not what the engine withheld.

**This second mechanism may need its own MON id.** It is a distinct producer defect from the missing one-off gate, and G11 requires each downstream issue to close on its own evidence. Registry is yours — allocate or fold into MON-128, but say which in the PR.

### 2.2 The rental discrepancy the build brief §2.1 asks you to trace — a third value now exists

The build brief names **$121,227** (Income page) vs **$121,881** (Tax page). The capture adds `income.annual.all.byType.RENTAL` = **gross 154,443.11, net 154,443.11** (gross ≡ net, i.e. no withholding applied), and `renderedPartC.rentalMonthly` = **10,102** (= $121,224/yr). Trace all three, and name each as its own quantity if that is what they are. **Do not pick one.**

### 2.3 Six values for "annual income" — the full set to reconcile (VR-042 V1)

| Value | Producer / surface |
|---|---|
| **$239K** | Home `ANNUAL INCOME` tile |
| **$317,751** | `/dashboard/tax` TOTAL INCOME (19 sources) |
| **$459,434.36** | `cashflow.annualIncome` / `.annualNetIncome` |
| **$470,261.70** | `moneyFlowService.getMoneyFlow.totalIncome` (`period: "annual"` — confirmed comparable, not a units error) |
| **$495,632.05** | `cashflow.annualGrossIncome` |
| **$505,564.05** | `income.annual.all.grossTotal` |

Spread: **$266,564**. Layer 2's "sources sum to the total" invariant must hold across whichever of these survive; the rest are renamed or deleted **citing their contract entry** (build brief §2.4).

### 2.4 Also visible, and explicitly NOT Tranche 1

Named here so they are not swept up. Each belongs to a later tranche and fixing it in T1 would contaminate the diff:

| Finding | Tranche |
|---|---|
| `cashflow.monthlyLoanRepayments` = **8,816.65** — the uncanonical `minRepayment` producer, both IO loans at $0, understating **$3,962/mo · $47,548/yr**. VR-041 obs 3, now confirmed at the producer | **T2** |
| `expenses.monthly.all.total` = **52,322.58** with `OTHER 25,564` — the pre-MON-126 producer, alive in the same returned object as the gated `1,482.19` | **T3** |
| `cashflow.expensesByCategory` = `{OTHER: 1,482.19}` — every category collapsed | **T3** |
| `cashflow.taxableIncome` **495,632.05** and `income.annual.all.taxableIncome` **505,564.05** vs the tax engine's **145,426**; `cashflow.taxDeductibleExpenses` = **$0** vs $172,325 of deductions | **T4** |
| Home debt tile: Good 1,657,076 + Bad 25,000 = 1,682,076 against a stated 2,059,898 total — the 377,822 gap is exactly the Guildford home loan, classified as neither | **T5** |

**`cashflow.monthlyCashflow` +$27,987.35 and `savingsRate` 73.1% against Home's −$6,073 and −30.5%** (VR-042 V7) is the one to watch: the +$27,987 renders on Home as `Saved $27,987`, on the same screen as the −$6,073 tile. Both are downstream of income, so **T1 will move them**. They belong in `expectedMoves`, not in a later tranche.

## §3 G5 — nothing is asked of Reza

The ledger's T1 G5 row still reads ❌ with three items. **All three are already answered by the build brief §0 and none requires him:**

- **Salary component** — already in the data; the Income rows carry type and amount. `income.annual.all.byType.SALARY` = gross **227,519.50**, net **217,587.50**.
- **HELP repayment income** — computed: taxable income (excl. FHSS released) + reportable fringe benefits + total net investment loss + reportable super contributions + exempt foreign employment income. Every input is in Monitrax.
- **Rental gross vs net** — a code question, per §2.2 above.

**Correct the ledger's G5 row to ✅ with that basis.** Asking the user for a number the engine owes them is the same failure class as a fabricated default.

Where a value genuinely can only come from the user, it becomes a **FACT field** with an undetermined state — build brief §5 lists the three (actual net pay, salary sacrifice, HELP loan present). Ship the fields; do not ship a question.

## §4 G3 — `expectedMoves`, the one remaining gate

Build brief §4 stands: **computed, not estimated**, per path, never directional. Run old and new producers against the same real data through the relay and let the difference be the declaration. Commit it **before** the migration merges.

VR-042 supplies the measured "before" values, so each declared path now has an arithmetic anchor:

**Must move** — declare each with its own arithmetic:

- `cashflow.monthlyGrossIncome` **41,302.67** → the real gross
- `cashflow.annualGrossIncome` **495,632.05** → the real gross
- `cashflow.annualPaygWithholding` **36,197.69** → one PAYG figure, reconciled with **11,128.70** (reported) and **9,932.00** (applied)
- `income.annual.all.paygWithholding` **11,128.70** → whichever value survives; and `/dashboard/tax` `PAYG withheld` **$11,129** moves with it. **This one is in the regression cluster today — if it moves, it must be declared here, or the tranche stops on its own guard**
- `cashflow.annualNetIncome` **459,434.36** → banked income, single deduction
- `cashflow.monthlyCashflow` **+27,987.35** and Home's `Saved $27,987`
- `cashflow.savingsRate` **73.1%** and Home's **−30.5%**
- `cashflow.debtServiceRatio` **23.03%** · Home's debt-to-income **416%**
- Home `ANNUAL INCOME` **$239K** · Home `THIS MONTH'S BUDGET Income` **$41,303**
- `generateHealthReport` — health score **54**
- the budget generator's income-sanity guard, `app/api/budget-analysis/generate/route.ts:267`

**Must NOT move** — the regression cluster, re-baselined at `d3d7e147` and byte-identical across VR-041 and VR-042:

net worth **$3,401,782** · total assets **$5,461,679** · liquid **$301,808** · accessible **$67,871** · locked **$3,032,102** · property equity **$2,955,102** · taxable income **$145,426** · tax **$37,786** · Medicare **$2,909** · deductions **$172,325** · committed **$14,261** · recurring **$1,482** · one-off **$50,840** · loans **$12,779** and all five per-loan rows.

**PAYG withheld $11,129 has been removed from this cluster** — VR-041 and VR-042 both held it, but §2.1 shows it may be the wrong of two candidates, so freezing it would freeze a defect. It moves to the declared list above. That removal is itself a declaration, and it is the only one.

**Any movement here that is not declared stops the tranche.** Revert; do not patch forward.

## §5 Ledger updates this brief requires

`docs/implementation/MON-131_TRANCHE_LEDGER.md` §3:

- Instrumentation → **Baseline captured: BLOCKED → DONE**, citing VR-042 §2 and the `d3d7e147` hash. **Add the persistence caveat from §1.2** — the cell is not fully green until a committed before-state exists.
- MON-135 → **READY → DONE**, G8 filled with VR-042 §1 (48 figures, zero movement).
- Tranche 1 → **G4 ✅** (VR-042), **G5 ✅** (§3 above, basis: computable), **G1 ✅ evidenced**. G3 stays ❌ — it is the gate.
- Drift log → **D7**: the T1 G5 row asserted ❌ for three items the build brief's own §0 had already resolved, so the ledger disagreed with the brief it indexes. Root cause: the ledger row was written before §0's correction and never re-derived.
- §0 of the ledger's MON-135 row records prod at `b1af5021`. **Production is at `d3d7e147`** (merge of #1539). Correct it.

## §6 Order of work

1. §1.1 serializer check — **gates everything else**
2. §1.2 decide the persistence mechanism and ship it
3. §5 ledger corrections
4. §2 amendments into the build brief (§1 diagnosis, §3 invariants, §2.1 rental third value)
5. §4 compute and commit `expectedMoves`
6. **Then** the build brief runs

## §7 Neo-sync (§21.2.2)

Neomatrix re-pin if `?format=hash` lands; NeoAudit gains the `annualGrossIncome ≡ grossTotal` and PAYG-identity ratchets from §2.1; changelog + `0·REF` workstream entry; ledger §3 rows filled with evidence per §5. Nothing sandbox-only.

---
*Prepared by The Matrix, 30 July 2026. Evidence: `docs/verification/runs/VR-042.md` — live production capture at `d3d7e147`, admin relay, read-only. Decisions unchanged: D17 · D18 · D20 · D33 · D35 · D42 (C2, C3).*
