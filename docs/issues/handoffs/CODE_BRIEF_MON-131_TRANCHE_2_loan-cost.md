# CODE BRIEF — MON-131 Tranche 2: loan cost (MON-130)

**Model: Opus 5. Branch off `main`.**
**changesNumbers: YES.** Reza reviews a before/after table and clicks the merge.

**Read first, in order:**
1. **`CLAUDE.md` — in full, before anything else.** See §-1. This is not a formality.
2. `docs/verification/runs/VR-045.md` — T1 closed. §7 records an open income divergence; it is not T2's.
3. `docs/implementation/MON-131_TRANCHE_LEDGER.md` §2 (gates) and §3 (T2 row) and §4 (drift log, **D3**).
4. `docs/issues/handoffs/CODE_BRIEF_MON-131_TRANCHE_1C_repair.md` §9 — how T1 failed and what caught it. **The same failure mode is available here.**

---

## §-1 CLAUDE.md and the documentation duty — non-negotiable

**Read `CLAUDE.md` in full before writing any code, and follow it.** It is the repository's operating contract: the documentation obligations, the changelog and `0·REF` workstream requirements, the Neo-sync protocol (§21.2.2), the promotion and gate rules (§20.6, §23.2.3, §24.2), and the registry discipline in `FIX_PROTOCOL.md`. Everything in this brief sits *inside* those rules, not beside them.

**Across T1, documentation fell behind the code.** Reza has raised it directly: work was built and merged without the corresponding record being written. That is a CLAUDE.md violation on its own terms, and it is also a programme risk — this whole tranche plan exists because Monitrax accumulated numbers nobody could trace back to a decision. **Undocumented fixes are how that happens.**

So, explicitly, for T2:

1. **Every change is documented as it is made**, not reconstructed afterwards. What changed, which file, which decision or contract entry authorises it, and what number it moves.
2. **Every deleted producer cites its contract entry.** "Deleted as dead" and "collapsed" are different claims and are published separately (D46).
3. **The ledger is updated in the same PR as the code** — `MON-131_TRANCHE_LEDGER.md` §3's T2 row, with evidence in every cell. §1's rule stands: *no cell is filled without evidence, and an empty cell is information.*
4. **Changelog + `0·REF` workstream entry**, per CLAUDE.md.
5. **Neo-sync (§21.2.2)** — Neomatrix re-pin, NeoAudit ratchets, census re-run with was-and-now published. See §8.
6. **The registry moves on evidence**, per `FIX_PROTOCOL.md`: MON-130 stays `FIXING` until a Ring-3 run records, and it never reaches `VERIFIED` on a passing unit test or a formula argument.
7. **The PR body carries the before/after table** in Reza's language, plus the consumer enumeration from §3.1 and the §2.1 explanation. **The PR body is a deliverable, not a summary.**

**A tranche that lands correct numbers with no record of how is not done.** If the documentation is not in the PR, the tranche is not finished — and I will say so in the Ring-3 run regardless of whether the numbers pass.

## §0 T2 is structurally the fix that just worked

**The canonical loan-cost producer already exists and is already correct.** `lib/services/loanCosts.ts:resolveLoanCostsForUser` returns **$12,779/mo**, actuals-first, and `/dashboard/expenses` renders it with per-loan basis labels. That was settled by PR #1523 and Ring-3 verified in VR-041.

**`masterFinancialService` does not read it.** It carries `cashflow.monthlyLoanRepayments` **8,816.65** and `annualLoanRepayments` **105,799.80** — the uncanonical `minRepayment` sum, in which both interest-only loans contribute **$0**.

So the core of T2 is the same job as T1-C: **one consumer, wired onto the canonical producer.** T1-B failed by wiring some consumers and not others, and T1-C fixed it by enumerating them. **Enumerate first here.** State the count of loan-cost consumers in the PR body before wiring any of them.

Understated today: **$3,962/mo · $47,548/yr.**

## §1 Where every loan actually stands

Read live at `3cdaa8c4`, Reza's account. Use these as the starting facts; re-derive rather than trust them.

| Loan | Balance | Rate | Type | Rendered monthly cost | Basis label |
|---|---|---|---|---|---|
| HECS / student | $25,000 | 4.00% var | P&I | **$83** | interest cost (no repayment linked or set) |
| Bankwest — Broadbeach | $228,000 | 6.69% var | **IO** | **$1,191** | from linked repayments |
| Bankwest — Thornland Lot 2 | $482,000 | 6.69% var | **IO** | **$2,518** | from linked repayments |
| Bankwest — Thornland Lot 1 | $947,076 | 6.49% var | P&I | **$6,197** | from linked repayments |
| Bankwest — Guildford | $377,822 | 6.24% var | P&I | **$2,790** | from linked repayments |
| | | | | **$12,779** | |

**Guildford carries an offset:** `Guildford Offsett $303,890`, rendered as *"Net after offset: −$73,932"*.

## §2 Two things in that table need explaining before anything is migrated

### 2.1 Both interest-only loans repay LESS than their contractual interest — by the same factor

An interest-only loan's repayment should equal its interest. These don't:

| Loan | Contractual interest/mo | Rendered actual | Ratio |
|---|---|---|---|
| Broadbeach | `228,000 × 6.69% ÷ 12 =` **$1,271.10** | $1,191 | **0.93698** |
| Thornland Lot 2 | `482,000 × 6.69% ÷ 12 =` **$2,687.15** | $2,518 | **0.93706** |

**Two independent loans, different balances, landing on the same ratio to five significant figures.** That is not noise and it is not two coincidences — it is a systematic factor of roughly **0.9370** somewhere in the actuals path.

Candidate explanations, none verified: an averaging window shorter than a full period (`0.9370 × 365 ≈ 342 days`); a partial first or last month included in the average; a day-count convention mismatch; or the linked-repayment set missing a payment in the window.

**This must be explained before T2 declares any loan number.** If actuals are being averaged over a short window, then **every** actuals-first figure in the app is understated by that factor — including the $12,779 that T2 is about to make canonical. Migrating onto a producer with a systematic 6.3% understatement would ship a wrong number with more authority than the one it replaced.

**If it turns out to be correct behaviour, say why in the PR.** Do not leave it unexplained.

### 2.2 HECS reconciles, and it is the control

`25,000 × 4.00% ÷ 12 = $83.33` → renders **$83** ✓. This row is derived from rate and balance, not from linked repayments, and it lands. That is the evidence the derivation path is sound and the anomaly in §2.1 is in the **actuals** path specifically. Use it as the control when tracing.

## §3 Scope

### 3.1 The wiring

Every loan-cost consumer reads `resolveLoanCostsForUser`. Enumerate them; state the count; delete the uncanonical producers citing their contract entry. The census must land below its pre-T2 seed, **collapsed published separately from deleted-as-dead** (D46).

### 3.2 The principal/interest split — derive, never guess

The ledger records this as **not established**. It is required by D18 (X3: principal separates from spending — a loan principal payment is saving, not consumption) and by D21.

Per loan: `interest = f(balance, rate, offset, day-count)` and `principal = actual repayment − interest`. Both components must be named quantities with one producer each. **A split that cannot be derived for a given loan renders undetermined — it does not render zero and it does not render an estimate.**

Indicative only, to show the scale — **these are not declarations and must not be copied into `expectedMoves`:** on Thornland Lot 1, `947,076 × 6.49% ÷ 12 ≈ 5,122` interest against a $6,197 actual leaves roughly $1,075 of principal. Compute the real ones.

### 3.3 D21 — interest nets the offset. D26 — equity does not.

This asymmetry is deliberate and settled. **Interest** on Guildford is charged on the balance net of the offset: `377,822 − 303,890 = $73,932`. **Equity** is computed on the full balance, because the offset is cash the user still owns and is already counted in liquid assets ($303,890 sits in `liquid $301,808`'s neighbourhood — check the reconciliation, do not assume it).

Getting this backwards double-counts the offset in one direction or vanishes it in the other. **Write a test that pins both halves of the asymmetry**, so a later refactor cannot quietly make them consistent with each other.

`377,822 × 6.24% ÷ 12 = $1,964.68` on the full balance versus `$384.45` on the net — a **5.1×** difference on one loan. This is the single largest correctness lever in the tranche.

### 3.4 The Q1 rate-unit defect — fix it here

`components/dashboard/EntityCashflowSummary.tsx:693` divides `interestRateAnnual` by 100 when the schema already stores a decimal (`0.0625`). A 100× error.

**Drift log D3 is explicit that it has no rendered surface** — the component is imported at `app/dashboard/page.tsx:49` and never mounted; Home renders `GlassEntityCashflow`, which never touches `taxBenefit`. Fix it anyway, and **state in the PR that it changes no rendered number**, so the before/after table is not padded with a move that cannot be observed.

### 3.5 Explicitly NOT T2

- `/dashboard/income` **$22,579** vs Home **$25,347** — VR-045 §7, needs its own id.
- Home debt tile: `Good 1,657,076 + Bad 25,000 = 1,682,076` against a stated total **2,059,898**; the **377,822** gap is exactly Guildford, classified as neither. I assigned this to **T5** in VR-042 and VR-044. It is adjacent to T2 and you may argue it belongs here — **if you pull it forward, say so explicitly and amend the ledger**, so the assignment does not drift silently.
- T3 expense producers · T4 tax reconciliation · T6 (MON-139, per-member tax positions).

## §4 Facts the tranche needs — establish them from data, not from Reza

The ledger's G5 row lists three: cross-collateralised loans, fixed-rate loans, mixed-purpose loans. **All three are answerable from the schema and the loan rows.** Every loan on this account renders as `variable`; check whether the schema can express fixed at all, and whether any loan secures more than one property.

**T1's §0 lesson stands: asking the user for a number the engine owes them is the same failure class as a fabricated default.** Where a value genuinely can only come from the user — a loan's purpose split, say — the answer is a **FACT field with an undetermined state**, not a question in a chat.

## §5 `expectedMoves` — computed, per path, before the first migration commit

Run old and new producers against the same live data through the relay and let the difference be the declaration. **Never a directional entry.**

**Paths that will move** — anchors from VR-045's measured state, to be replaced by computed values:

- `cashflow.monthlyLoanRepayments` **8,816.65** → the canonical figure
- `cashflow.annualLoanRepayments` **105,799.80** → its annual sibling, **derived from annual components, not monthly × 12** (VR-045 §2.1)
- `cashflow.monthlyCashflow` / `.monthlySurplus` **15,047.71** → moves; loans is a term in it
- `cashflow.annualCashflow` / `.annualSurplus` **180,572.50**
- `cashflow.savingsRate` **59.37** and `quickMetrics.savingsRate` — **and this one is not a simple substitution.** D18/X3 separates principal out of spending and into saving, so the numerator changes shape, not just size. `expected-moves-t1.json` already declared this would move again in T2.
- `cashflow.debtServiceRatio` **34.78** · `debt.metrics.debtServiceRatio` · `debt.metrics.debtToIncomeRatio` **677.24**
- `quickMetrics.monthlyCashflow` **15,047.71** · `keptAfterEssentials` **23,864.36** · `keptMargin` **82.49**
- Home `THIS MONTH'S BUDGET · Loans` **$8,817** → the canonical figure, and `Saved` **$15,048** with it
- Per-loan interest and principal components — **new quantities**, so they arrive declared rather than moved

**Must NOT move** — the regression cluster, byte-identical across VR-041 to VR-045:

net worth **3,401,782** · total assets **5,461,679** · liquid **301,808** · accessible **67,871** · locked **3,032,102** · property equity **2,955,102** · engine taxable income **145,426** · net tax **37,786** · PAYG withheld **43,004** · Medicare **2,909** · deductions **172,325** · committed **14,261** · recurring **1,482** · one-off **50,840**.

**Note carefully:** `/dashboard/expenses` `Loan Repayments` **$12,779** and all five per-loan rows are in the cluster **because they are already canonical**. T2 must move `masterFinancialService` **onto** them, not move them. **If they move, that is a defect**, and it is the clearest early signal that the wiring went the wrong way.

**And the T1 quantities stay put:** banked income **304,158.61** · gross **347,162.61** · monthly income **25,346.55**. T2 changes the loan leg only.

## §6 Acceptance

The Matrix re-runs on Reza's account, identity asserted from a known figure first:

1. **Every declared path lands on its declared value.** Not "close" — VR-045 §2.1 records a two-cent miss that was reported rather than absorbed, and that standard holds.
2. **The regression cluster is byte-identical**, including `/dashboard/expenses` per-loan rows.
3. **No undeclared movement.**
4. **Rendered surfaces read live in Chrome** and cross-checked against producer values.
5. **Identities hold on real data:** per-loan `interest + principal ≡ actual repayment` · the five per-loan costs sum to the aggregate · `committed − loans ≡ recurring expenses`.
6. **§2.1 is resolved** — the 0.9370 factor is either explained as correct or fixed, with the arithmetic shown.
7. **The D21/D26 asymmetry is pinned by a test**, both halves.
8. **§-1 is satisfied** — ledger row filled with evidence, changelog and `0·REF` entered, Neo-sync complete, every deleted producer citing its contract entry, and the PR body carrying the before/after table and the consumer enumeration. **The Ring-3 run reports on this alongside the numbers.** Correct numbers with no record of how they were reached is a tranche that is not finished.

**Any of 1, 2 or 3 failing → revert. Do not patch forward.** That contract has been exercised once and it held.

## §7 Ledger

T2 row → `IN BUILD` with the §1 facts cited. Drift log entry if §2.1 turns out to affect figures already recorded as verified — **VR-041 verified the $12,779 aggregate against per-loan rows that reconcile to each other; it did not verify them against contractual interest.** That is a coverage gap in my own prior run, and it should be recorded as one rather than discovered later.

## §8 Neo-sync (§21.2.2)

Neomatrix re-pin for the wired consumers and deleted producers; NeoAudit gains the §6.5 identities plus the D21/D26 asymmetry test; census re-run with was-and-now published; changelog + `0·REF`; ledger rows filled with evidence.

---
*Prepared by The Matrix, 31 July 2026. Live figures read at `3cdaa8c4` on Reza's account, identity-asserted, read-only. Decisions: D18 · D21 · D26 · D46 · X3. Drift log: D3.*
