# Reference Numbers — Design Record (MON-131)

> **THE FIRST-PRIORITY PROGRAMME.** One canonical producer per named financial quantity, everywhere.
> **Registry umbrella:** MON-131. **Tranche issues:** MON-127 (budget remainder) · MON-128 (income) · MON-129 (expense run-rate) · MON-130 (loan cost) · MON-132 (survival runway).
> ⚠️ These ids are **Matrix-ledger assignments, not yet in `docs/issues/ISSUES.json`** — the registry is frozen for the Matrix's reconciliation PR (directive 2026-07-29: no `issues:raise`, no status changes until it merges). Register them there, in pinned order, never via auto-numbering while the gap exists.
> **This file is the living record** — update it as decisions are made (brief §12 footer). CLAUDE.md wins on any conflict.

## §0 Provenance — read this honestly

This document was **reconstructed in-repo on 2026-07-29** from the Matrix code brief
*"CODE BRIEF — MON-131 Reference Numbers"* (prepared by The Matrix at `f13368ef`, census by
three independent read-only agent passes). The Matrix's original design record was **never
committed** — a §21.2.2 violation ("nothing lives outside the repo") flagged the moment it was
discovered. Everything below is verbatim-faithful to the brief; nothing is invented. Two known
gaps, stated rather than papered over:

1. **The decisions register (§6) is partial.** The brief cites decisions **D3, D4, D5, D8, D9,
   D10, D11, D12, D13** with their conclusions; those are recorded below. Any decision ids the
   original register held that the brief does not cite (at minimum **D1, D2, D6, D7**) are
   **NOT RECOVERED** — the Matrix must supply them before any tranche that depends on them.
2. **MON-115…124 are a ten-id ledger gap.** The ids are reserved in the Matrix ledger; their
   definitions were never committed to `docs/issues/ISSUES.json` and are unrecoverable from this
   repo (the brief cites MON-117 in passing — the what-if hardcoded `30000`/`0.12` — but a full
   definition would be a guess, and we never guess). Similarly, **`docs/verification/runs/VR-040.md`
   was never committed**. The registry is FROZEN pending the Matrix's reconciliation PR (directive
   2026-07-29), which owns: executing `scripts/matrix/vr038-039-advance.mjs` +
   `vr038-039-promote.mjs` (merged in #1521, still unexecuted — MON-104…110 read FIXING despite
   VR-038/039), filing MON-115…124's ledger definitions, and registering MON-127…132 in pinned
   order. Both scripts are idempotent and were dry-validated end-to-end on 2026-07-29 (they apply
   cleanly: 104…110 → VERIFIED, 105…110 → CLOSED, 104 HELD, 112/113/114 raised, gates green at
   116 issues).

## §1 The problem

A producer-multiplicity census at `f13368ef`, over `lib/`, `app/api/`, `app/dashboard/`,
`components/`: **~336 producers across 23 quantities. 22 of 23 are MULTIPLE.**

Depreciation 22 · income tax 23 · PAYG 23 · expense run-rate 28 · cashflow 27 · loan cost 24 ·
savings rate 21 · taxable income 21 · net income 16 · super cap 16 · gross income 14 ·
assets/liabilities 14 · property equity 13 · forecast flows 11 · property cashflow/yield 10 ·
liquid cash 8 · deductions 8 · emergency-fund months 8 · net worth 7 · health score 6 ·
land tax 6 · negative gearing 6 · **Medicare levy 4 (2 distinct — Float + Decimal twin of one
function).**

**Medicare is the only single-sourced quantity in the app** — the proof the architecture works
when followed. There is no single answer to compare against, so fixing one place has never fixed
a number — it has only changed which screens disagree.

## §2 Why it was invisible

`scripts/lint-source-lock.ts:53` — `const SCAN_ROOT = 'app';` with the comment *"Engines under
`lib/` are the producers — out of scope."* **The Calc-SSOT wall has never scanned `lib/`,** where
nearly all ~336 producers live. Compounding it: Ring-3 asserts *rendered* values agree — 28
producers that happen to agree on one user's data still pass. Producer count is invisible to a
live-numbers check.

## §3 The architecture

### 3.1 Collapse to **named** quantities, not to one scalar

Several of the N compute genuinely different things that were never **named**, so callers grabbed
whichever they found. "Monthly spending" is really four quantities:

| Named quantity | Semantic | Reza's value at census |
|---|---|---|
| `monthlyRecurringRunRate` | declared recurring, one-off gated | $1,482/mo |
| `monthlyCommitted` | recurring + canonical loan cost | $14,261/mo |
| `trailing12MonthActualSpend` | actuals incl. one-offs | $25,973/mo |
| `currentMonthActualSpend` | this month's transactions | $170 |

All four are legitimate. **Index the definition — semantic, basis, window, inclusions — not just
the function name.** Do the same exercise for cashflow, income and the health score before
migrating them.

### 3.2 FACT vs DERIVED (Reza's governing rule)

- **FACT** — asserted by a user or document (salary + frequency, property value, loan principal,
  rate, balance). Stored once. Guarded by intake dedup.
- **DERIVED** — computed from facts. **One producer, never stored.** Guarded by the census.

**Never store a derived value.** It creates a second copy that desyncs (caused MON-080) and
converts loud drift into silent drift. *Permitted exception:* an immutable point-in-time snapshot
for audit, written once, never read back as the live value — as `netWorthHistory` already does.

## §4 Build order — tranches, one PR each, merged before the next

| Tranche | Scope | Issues | Moves numbers? |
|---|---|---|---|
| **−1** | Golden baseline + registry truth (preconditions §11 of the brief) | — | NO |
| **0** | Enforcement: `census:producers` ratchet, source-lock → `lib/`, `REFERENCE_NUMBERS.md` | MON-131 (opens) | NO — ships alone, first |
| **1** | Income | MON-128 | YES |
| **2** | Loan cost | MON-130 | YES |
| **3** | Expense run-rate | MON-129 | YES |
| **4** | Tax-domain constants + depreciation (D11, D12) | (MON-073/117 class) | YES |
| **5** | Balance sheet (D5, D10) | — | YES |
| **6** | Derived rates, scores, runway (D8, D13, D3+D4 → MON-132) | MON-132 | YES |
| **7** | Budget the remainder | MON-127 | YES |

Every tranche after 0 is number-changing: **Reza reviews a before/after table per tranche and
clicks merge.** The Matrix runs Ring-3 per tranche against the VR-041 Part-C cluster, asserting
movement **only** where predicted. Never begin the next tranche before the current one is merged
and verified. If a tranche's Ring-3 fails, **revert the merge — do not patch forward** (brief
§11.4).

Tranche-specific facts (verified in the brief, to re-verify at source before each build):

- **T1 income (MON-128):** `incomeAggregator.ts:160` has no one-off gate; `getNetAmount:105-106`
  deducts tax only for salary → `quickMetrics.monthlyIncome` = $41,303/mo = $495,636/yr labelled
  net-of-PAYG against declared gross $317,751/yr. **D9** — make "net" after-tax across all sources
  or rename the field; migrate the Decimal twin. The day-one test: **`netTotal ≤ grossTotal`,
  always.**
- **T2 loan cost (MON-130):** 12 producers read raw `loan.minRepayment`; two interest-only loans
  have `minRepayment = 0` so $3,709/mo of real interest reads $0. `moneyFlowService.ts:385` skips
  them entirely (root cause of Activity's "Loans $106K/yr" vs canonical $12,779/mo).
  `buildHealthInput.ts:95` is correct but via its own duplicate interest floor — migrate it too.
  **`Loan` has no `isRecurring` field (schema-verified) — do not apply the one-off gate to loans.**
- **T3 expense run-rate (MON-129):** 23 confirmed-exposed Income/Expense reducers across 12 files
  → `monthlyRunRate`/`annualRunRate`, Float and Decimal.
- **T4:** D11 depreciation rate-unit contract (the `cost×(rate/100)×2` vs `cost×rate×2` 100× trap —
  `properties/[id]/depreciation/page.tsx:194` vs `reports/contextBuilder.ts:521`); D12 every
  legislated constant from `TAX_YEAR_CONFIGS` (`what-if/[lever]/page.tsx:422` hardcodes `30000` +
  `0.12`; `income/page.tsx:356` invents PAYG as `annual × 0.30`; `lib/wealthCheck/lever.ts:88` has
  its own `CONCESSIONAL_CAP_ANNUAL`; `EntityCashflowSummary.tsx:693` hardcodes `0.37`).
- **T5:** D5 + D10 + `portfolioEngine.ts:440` omitting personal loans from gearing.
- **T6:** D8, D13, MON-132 (D3+D4). Savings rate (21), cashflow (27), emergency months (8) largely
  collapse once inputs are single-sourced — **re-run the census before touching them.**
- **T7 (MON-127):** `remainder = monthlyNetIncome − committed`; three modes allocate *that*.
  `calculateBenchmarkExpenses` (`lib/budget-analysis/aiPrompt.ts:311`) takes only household
  composition — keep the ABS benchmark as a *reference*, never as the budget. Label what actually
  produced the number. The `generatorVersion < 2` auto-regeneration does not fire on read.

## §5 What this closes — mechanically checked, not assumed

25 of 54 live issues cite a catalogued producer file. **~19 downstream, should close or become
trivially closeable:** MON-001 · 020 · 023 · 024 · 031 · 034 · 037 · 055 · 056 · 059 · 060 · 063 ·
064 · 073 · 127 · 128 · 129 · 130 · 132. **6 will NOT close** (same files, unrelated causes):
MON-047 (dead unwired code), MON-065 (doubled currency symbol), MON-066 (contradictory copy),
MON-074/084 (duplicate FACT rows — the intake-dedup guard). **Re-check all 19 after each tranche.
Do not close any without its own live verification.**

## §6 Decisions register (the living record)

| Id | Decision | Status |
|---|---|---|
| D1 | *(not recovered — Matrix to supply)* | ❓ NOT RECOVERED |
| D2 | *(not recovered — Matrix to supply)* | ❓ NOT RECOVERED |
| D3 | Emergency fund becomes a **survival runway**: `liquid cash / (essential expenses − salary-independent income)` | ✅ decided (brief §4 T6) |
| D4 | Essential expenses **include loan repayments**; the page must carry the sentence *"if you lose your salary income, how long you can survive"* — the label is part of the fix | ✅ decided (brief §4 T6) |
| D5 | Liquid = **cash equivalents only** (AASB 107). Shares/ETFs a separate labelled line; **SMSF assets excluded from both** (preserved, not merely illiquid). `metricAggregation.ts:129` "liquid incl. shares" is the *other named quantity*, not a bug to delete | ✅ decided (brief §4 T5) |
| D6 | *(not recovered — Matrix to supply)* | ❓ NOT RECOVERED |
| D7 | *(not recovered — Matrix to supply)* | ❓ NOT RECOVERED |
| D8 | Cashflow subtracts the **full** loan repayment (cash is cash), but the principal portion is labelled **"wealth transfer, not spending"** (interest = expense; principal = balance-sheet movement). Affects the headline −$6,073/mo | ✅ decided (brief §4 T6) |
| D9 | Income "net" becomes after-tax across **all** sources, or the field is renamed — net may never exceed gross | ✅ decided (brief §4 T1) |
| D10 | Portfolio equity **includes** RENTAL properties; `properties/page.tsx:494` excluding them is a bug | ✅ decided (brief §4 T5) |
| D11 | Depreciation collapses to ONE producer with an explicit **rate-unit contract stated in the type** (the MON-026 100× class) | ✅ decided (brief §4 T4) |
| D12 | Every legislated constant reads from `TAX_YEAR_CONFIGS`, never typed into a page | ✅ decided (brief §4 T4) |
| D13 | The four health scores (`aggregateEngine`, `masterFinancialService:1434`, `healthScoreAggregator`, `safetyScore`) are **four different questions** — name them separately; do not reconcile to one number | ✅ decided (brief §4 T6) |

New decisions land here as new rows, with date + rationale, in the PR that implements them.

## §7 Standing rules (verbatim from the brief §6)

1. **Never fix a number.** Fix the producer. Entering data to test is fine; adjusting a result to
   match an expected figure never is.
2. **Holistic verification law (Reza, 2026-07-29):** trace producer → assembler → route → surface;
   know the basis of both sides; derive the expectation from a rule or the law, never from another
   screen. An untraced difference is an observation, not a finding.
3. **Do not add a producer. Delete producers.**
4. Float and Decimal twins migrate together, always.
5. Every tranche re-runs the census and publishes new counts. **The count going down is the
   deliverable.**

## §8 Tests (the permanent suite the programme leaves behind)

- **`netTotal ≤ grossTotal`** on every income path, Float and Decimal.
- One-off gate: a fixture with one recurring row and one large one-off — the one-off contributes
  **0** to every monthly and annual run-rate, on every migrated producer.
- Interest-only loan with `minRepayment: 0` contributes its real interest cost, never `$0`.
- Depreciation rate-unit: the same schedule through every producer yields the same annual figure
  (the 100× guard).
- Cross-surface parity per quantity: one number, all surfaces.
- Float ≡ Decimal parity across every migration.
- Census ratchet green; source-lock extended to `lib/` and ratcheted down in the same PR.

## §9 The agent model (two-phase, brief §10)

**Partition by FILE OWNERSHIP, never by quantity** — one file hosts many quantities
(`cashflowOrchestrator.ts` computes nine), so quantity-partitioned agents guarantee write
collisions.

- **Phase A — specification (parallel, READ-ONLY):** one agent per quantity (23) produces a
  **Quantity Contract**: name(s) · FACT/DERIVED · exact semantic · canonicalHome · survivors
  (Float + Decimal) · callSites each tagged CONSUMER / DUPLICATE / **DIFFERENT-QUANTITY** ·
  invariants · **expectedMoves (written BEFORE migration)**. The DIFFERENT-QUANTITY tag is the
  highest-value output — the most dangerous failure is deleting a producer that computes a
  legitimately different number. **GATE: every contract goes to Reza before any Phase B write.**
- **Phase B — migration (parallel, worktree-isolated, disjoint file sets):** B1 income · B2 expense
  · B3 loan · B4 orchestrator · B5 master · B6 cfo · B7 health · B8 tax · B9 depreciation ·
  B10 balance sheet · B11 reports/flow · **B12 surfaces (runs LAST)** · B13 forecast/intel
  (full file lists: brief §10.2). Touch only owned files; a needed change outside the set is
  raised, not made.
- **Phase C — verification (parallel, adversarial):** C1 Float ≡ Decimal parity · C2 invariants as
  permanent tests · C3 adversarial reviewer per tranche briefed to REFUTE semantic preservation ·
  C4 census re-run publishing was/now counts.

Non-negotiables at scale: no agent closes an issue; no semantic change without a Reza-approved
contract; every producer deletion cites the contract entry authorising it; two agents disagreeing
on a meaning = stop and escalate; **a figure that moves without a prior `expectedMoves` entry is a
defect until proven otherwise.**

## §10 The golden baseline (brief §11)

`scripts/matrix/golden-baseline.mjs` captures every catalogued producer's output against Reza's
real data → `.audit/golden-baseline-<sha>.json`, keyed `file:function → value`, plus the rendered
VR-041 Part-C figures: net worth $3,401,782 · liquid $301,808 · committed $14,261 · loans $12,779 ·
rental ~$10,102 · tax net $37,786 · taxable $145,426 · deductions $172,325 · Medicare $2,909 ·
PAYG $11,129.

After **every** tranche, re-run and diff. Three outcomes, only three: **unchanged** (expected for a
consumer migration) · **changed AND in `expectedMoves`** (correct, arithmetic pre-written) ·
**changed and NOT in `expectedMoves`** → **STOP**, treat as a defect, do not proceed.

## §11 Definition of done (brief §11.5)

- Census: **23 quantities, 23 canonical producers** (+ Decimal twins); every other site a consumer
  or a differently-named quantity.
- `docs/architecture/REFERENCE_NUMBERS.md` published and complete.
- Census ratchet + `lib/` source-lock green in CI.
- Golden baseline diff clean, every movement pre-declared.
- The ~19 downstream issues in §5 re-verified live and closed on their own evidence.
- **Medicare levy is no longer the only single-sourced number in the app.**
