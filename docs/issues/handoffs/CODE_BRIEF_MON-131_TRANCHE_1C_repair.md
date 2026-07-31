# CODE BRIEF — MON-131 Tranche 1-C: repair the partial flip

**Model: Opus 5.** *(T1-A and T1-B were built on Fable 5, which has reached its weekly limit. Nothing in this brief depends on that continuity — every decision is written down. Read §0 first; you may be starting cold.)*
**Branch off `main`.**
**changesNumbers: YES.** Reza reviews a before/after table and clicks the merge.

**Read before writing any code, in this order:**
1. `docs/verification/runs/VR-044.md` — the failure, with the mechanism derived to the cent. **This is the brief's evidence base; do not re-derive it.**
2. `.audit/expected-moves-t1.json` — the declared contract T1-B was measured against. Still valid.
3. `docs/issues/handoffs/CODE_BRIEF_MON-131_TRANCHE_1B_flip.md` — the tranche's scope and its §5 acceptance contract.
4. `docs/implementation/MON-131_TRANCHE_LEDGER.md` §2 — the gates.

---

## §0 Where things stand, cold-start summary

MON-131 is a programme to give every number in Monitrax exactly one producer. Tranche 1 is income. It shipped in two parts:

- **T1-A (PR #1542)** — the new banked-income engine, added *beside* the legacy calculators, wired to nothing. Acceptance: the golden baseline must not move. **It did not. PASS** (VR-043).
- **T1-B (PR #1545)** — the flip: point every consumer at the new engine and delete the legacy ones. **FAIL** (VR-044).

**T1-B was a partial flip.** The new engine is live and correct. Some consumers were wired to it; `masterFinancialService` was not. The result is two live producers giving different answers to "what is annual income" — **304,158.61** and **462,560.05** — and Reza can see both on his Home screen without scrolling.

### 0.1 What T1-B got right — do not rebuild or revert these away

| | Evidence |
|---|---|
| `/dashboard/tax` renders **PAYG withheld $43,004** and **Estimated Refund $5,218** | VR-044 §1.1 — both declared to the dollar, rest of the page frozen |
| MON-137 — the double PAYG deduction | fixed |
| VR-042 V2 — `annualGrossIncome` fed the net total | fixed |
| MON-138 — Schedule-1 band gaps | fixed |
| The banked engine itself | `moneyFlowService.getMoneyFlow.totalIncome` = **304,158.61**, exactly as declared |
| The study-loan intake | shipped |
| The regression cluster | **byte-identical** — balances 13/13, expenses 13/13, net worth, assets, LVR |

**Roughly half of T1-B is correct.** A rebuild from scratch would throw it away.

### 0.2 What failed, and exactly why

**22 declared paths missed.** `income.annual.all.grossTotal` is **byte-identical to its pre-merge value — it did not move at all.** Everything else in `masterFinancialService` moved only because the new withholding wedge was subtracted from an unchanged gross.

The whole discrepancy is one number:

```
505,564.05 − 347,162.61 = 158,401.44      the gap
     13,200.12 × 12     = 158,401.44      the banked engine's own one-off total, annualised
```

**Ten one-off income rows totalling $13,200.12 are still being treated as a monthly run-rate and multiplied by twelve** inside `masterFinancialService`. That is MON-128's original defect — *"`incomeAggregator.ts` has no one-off gate"* — still live after the tranche that existed to fix it.

Composition cross-check, same number two ways: salary excess `227,519.50 − 192,719.50 = 34,800.00` plus `OTHER 123,601.44` = **158,401.44**.

## §1 The first task — and it decides the second

**Answer this before writing anything:**

> **Is `masterFinancialService`'s income block computed on read, or read from a persisted snapshot that T1-B writes but does not recompute?**

The evidence is genuinely ambiguous and that is why it must be checked rather than assumed:

- **For "computed on read":** the returned object carries `calculatedAt` at read time, **and** its `paygWithholding` is the new 43,004. A wholly stale row would still say 36,197.69.
- **For "persisted":** VR-041 recorded this exact trap live in Monitrax — the budget card rendered new captions over old numbers because the documented auto-regeneration did not fire on visit. It is a known pattern in this codebase, not a hypothetical.

| Answer | Then |
|---|---|
| **Persisted / not recomputed on read** | The wiring may be correct and the defect is in the regeneration path. **Fix forward** — §2A. Much smaller than a revert. |
| **Computed on read, consumer never wired** | The flip genuinely missed this consumer. **Revert first** — §2B — then re-land complete. |

**Do not skip this to save time.** Reverting a correct wiring because of a caching defect would destroy working code and leave the real bug in place.

## §2 The fix

### §2A — if the income block is persisted and not recomputed

Make the read path recompute, or make the write path fire on the events that invalidate it. Whichever, the acceptance is unchanged: **every path in `.audit/expected-moves-t1.json` lands on its declared value.**

State in the PR which mechanism you chose and why the other was rejected.

### §2B — if the consumer was never wired

1. **Revert PR #1545.** Per the T1-B brief §5 — *"revert the merge, do not patch forward."* This is a merge-commit revert; take the whole thing rather than cherry-picking, so the tree returns to a known state.
2. **Re-land as one PR**, restoring everything in §0.1 unchanged, plus the wiring `masterFinancialService` was missing.
3. **The wiring already has a correct reference implementation.** `moneyFlowService` was wired onto `assembly.ts` and returns 304,158.61 exactly. Apply the same pattern. If it cannot be applied identically, say why in the PR — a second wiring shape in the tranche built to eliminate second implementations needs a stated reason.

**Either way — the rule that failed once already:** *every* consumer of income goes through `assembly.ts`. Before opening the PR, enumerate the consumers and state the count in the PR body. T1-B's failure was a consumer nobody enumerated.

## §3 Two instrument defects — fix these or the next verification is blind

Both are in the verification machinery, not the product. **Neither is optional**, because both cause a *false pass*.

**3.1 `renderedPartC.payg` reads a retired field.** It returns **11,129** while `taxPosition.paygWithheld` is **43,004**. The relay's own regression instrument is reading the source T1-B retired — **it would have reported "payg unchanged — pass."** Repoint it to `taxPosition.paygWithheld`.

> A regression detector that reads a retired source is worse than no detector, because it produces confident wrong answers.

**3.2 `perMember.1.taxPosition.paygWithheld` = 11,129** against a top-level **43,004**. The per-member breakdown still reads the retired stored column. Per-member refunds read **−17,205** and **+827** against a top-level **+5,218** — whether those bases are meant to reconcile is your call, but they are not the same one, and if any of them render, that is a new visible contradiction.

## §4 What must not move

The regression cluster from `.audit/expected-moves-t1.json` `mustNotMove`, byte-identical across VR-041 through VR-044:

net worth **3,401,782** · total assets **5,461,679** · liquid **301,808** · accessible **67,871** · locked **3,032,102** · property equity **2,955,102** · engine taxable income **145,426** · net tax **37,786** · Medicare **2,909** · deductions **172,325** · committed **14,261** · recurring **1,482** · one-off **50,840** · loans monthly **12,779** and all five per-loan rows with their basis labels.

**Out of scope, and moving any of them contaminates the diff:** `cashflow.monthlyLoanRepayments` **8,816.65** (T2) · `expenses.monthly.all.total` **52,322.58** and `expensesByCategory` (T3) · reconciling `cashflow.taxableIncome` to the engine's **145,426** (T4, VR-042 V4 stays open) · Home's `−$6,073` / `−30.5%` tiles, filed as **MON-139 → T6** · the Home debt tile's **377,822** unclassified gap (T5).

## §5 `expectedMoves`

**`.audit/expected-moves-t1.json` is still valid and still declared.** Its after-values were computed by the relay on live production data (VR-043 §3) and nothing has changed them.

- If you take **§2B**, the file survives the revert unchanged — re-commit it before the migration commit.
- If you take **§2A**, it applies as-is.
- **Amend only what §3 changes**, and only with arithmetic.

**Never a directional entry.** "Income falls" would absorb an unrelated regression as expected — the exact failure MON-135 exists to prevent on the expense side.

## §6 Acceptance — unchanged from the T1-B brief §5

The Matrix re-runs on Reza's account, with identity asserted from a known figure before any number is read:

1. **Every declared path lands on its declared value.** Not "close", not "directionally right" — this is what T1-B failed.
2. **The regression cluster is byte-identical.**
3. **No undeclared movement** anywhere in the 1,767 leaves.
4. **Rendered surfaces read live in Chrome** — Home, `/dashboard/tax`, `/dashboard/balances`, `/dashboard/expenses` — and cross-checked against producer values.
5. **The identities hold on real data:** `gross − withholding ≡ banked` · sources sum to the total on both bases · `netTotal ≤ grossTotal` in Float and Decimal.
6. **The §4 contradiction is gone:** Home's `ENTITY CASHFLOW · Income` and `THIS MONTH'S BUDGET · Income` derive from the same producer.

**Any of 1, 2 or 3 failing → revert. Do not patch forward.** This time that contract has already been exercised once; it is not theoretical.

## §7 Ledger

`docs/implementation/MON-131_TRANCHE_LEDGER.md` §3:

- T1-A row → **DONE**, citing VR-043.
- T1-B row → **FAILED, verified**, citing VR-044, with the §2 decision and its evidence recorded.
- **Drift log D8** — the tranche declared 22 paths and delivered a partial flip that put two contradictory income figures on one screen. Root cause: consumers were not enumerated before wiring, so an unwired one was invisible to CI (which was fully green) and only appeared under Ring-3 against real data. **The lesson is the enumeration, not the individual miss.**
- MON-128 / MON-137 / MON-138 stay `FIXING` until the Matrix's run records.

## §8 Neo-sync (§21.2.2)

Neomatrix re-pin for every wired consumer and every deleted legacy producer; NeoAudit gains the §6.5 identities as permanent ratchets **plus a test that asserts every income consumer resolves through `assembly.ts`** — the ratchet that would have caught this; census re-run with was-and-now published, collapsed separately from deleted-as-dead (D46); changelog + `0·REF`; ledger rows filled with evidence.

---

## §9 A note on how this failure was caught, because it should shape how you work

CI was **fully green** — 8 checks, 303 files, 4,387 tests. The build was correct in every way the build could check itself. What caught this was a **contract of exact before/after values, written down before the code was built**, and then measured against real production data.

That is the whole method. When you write the PR, the before/after table is not a courtesy — it is the instrument. Make every value in it exact, and make it enumerate what you touched, so the next failure is as cheap to find as this one was.

---
*Prepared by The Matrix, 31 July 2026. Evidence: VR-044 (live production, Reza's account, identity-asserted, read-only). Decisions: D6 · D17 · D18 · D20 · D33 · D35 · D42 (C2, C3) · D46.*
