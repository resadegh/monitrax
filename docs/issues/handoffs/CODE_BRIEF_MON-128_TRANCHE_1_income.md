# CODE BRIEF — MON-131 TRANCHE 1: income (MON-128)

**Model: Fable 5. Branch off `main`.**
**changesNumbers: YES** — extensively. Reza reviews a before/after table and clicks the merge.
**Gate evidence goes in `docs/implementation/MON-131_TRANCHE_LEDGER.md` §3 as you go.**

---

## §0 A Matrix correction that changes how this tranche is scoped

An earlier Matrix message described Tranche 1 as **blocked on facts from Reza** — his salary
component, his HELP repayment income, whether the rental figure is gross or net. **That was wrong,
and it conflated two different jobs.**

- **Building the formulas** needs rules, schema fields and regimes. **It is blocked on nothing.**
- **Predicting the movement** needs data — and that prediction should be **computed, not asked for**.

Worse, three of those "facts" are things **the engine is supposed to calculate**:

| Was asked of Reza | Actually |
|---|---|
| HELP repayment income | **Computed**: taxable income (excl. FHSS released) + reportable fringe benefits + total net investment loss + reportable super contributions + exempt foreign employment income. Every input is already in Monitrax |
| Division 293 exposure | **Computed**: Division 293 income = taxable income + the same net investment loss add-back + concessional contributions, against the $250,000 threshold |
| Salary component | **Already in the data** — the Income rows carry type and amount |
| Rental gross vs net | **A code question**, not a user question: trace which field feeds the $121,227 on the Income page versus the $121,881 on the Tax page. One of them is wrong or they are two quantities |

**Asking the user for a number the engine owes them is the same failure class as a fabricated
default: it papers over a missing producer.** Where a value genuinely can only come from the user, the
answer is **a captured FACT field**, not a question in a chat.

## §1 Scope

The income quantity family, per **D17** (banked income), **D20** (three-layer engines) and **D18**
(savings-rate denominator). Root defect: `lib/calculations/incomeAggregator.ts` has **no one-off gate**
and `getNetAmount` deducts tax **only for salary**, so `quickMetrics.monthlyIncome` reads
**$41,303/mo = $495,636/yr** labelled net-of-PAYG against a declared gross of **$317,751/yr**.

## §2 What to build

### 2.1 Layer 1 — source engines (D20)

One engine per source **that has rules of its own**. Each returns a **banked** amount — cash that
reaches the account — and nothing else. No tax logic beyond withholding.

**Salary.** Gross → banked requires **PAYG withholding + HELP withholding + salary sacrifice**.
- **Where actual net pay is recorded, it is a FACT and wins.** Derived withholding is the fallback
  for gross entry and for ABN/contractor income.
- **PAYG withholding is a published per-FY schedule, not a rate.** Delete the `annual × 0.30`
  invention at `app/dashboard/income/page.tsx:356`. **Scope note:** D35 assigns the coefficient tables
  to Tranche 4, but a correct banked salary cannot be produced without them — **bring the FY2026-27
  coefficients forward into this tranche** and record the scope move in the ledger. Stale FY24-25
  coefficients would make Tranche 1's headline figure wrong on arrival.
- **HELP withholding** — 2026-27: nil below **$69,528**; 15c per $1 over the threshold to $129,717;
  **$9,028 + 17c per $1 over $129,717** to $186,050; **above $186,050, 10% of *total* repayment
  income — a cliff, not a marginal band.** Code the top band as a flat 10% of the whole.
- **Repayment income is computed** per the table in §0. The net-investment-loss add-back matters: a
  negatively geared portfolio *raises* repayment income, so it can cross the cliff even where taxable
  income does not.

**Rental.** Per-property, agent fees, ownership share. **Resolve the $121,227 / $121,881 discrepancy
by tracing both producers** — do not pick one. If they are two quantities, name both (D6).

**Dividends.** Cash received only. **Franking credits are not cash** — they are a tax offset and
belong to Layer 3.

**Business distributions.** Trust versus company; PSI attribution under Part 2-42.

**The one-off gate applies to every source:** `isRecurring === false` contributes **0** to any
monthly or annual run-rate. Route through the canonical `monthlyRunRate` / `annualRunRate` — **never
a local converter.** `grep isRecurring lib/calculations/incomeAggregator.ts` currently returns nothing.

### 2.2 Layer 2 — the aggregator

Sums Layer 1 into **banked income**. Pure summation, no arithmetic of its own.
**Invariant: the sources must sum to the total.** This is the only component that sees everything, so
it is the new place a bug could hide — the invariant is what makes that visible.

### 2.3 Layer 3 — untouched by this tranche

Tax stays computed **once, on the aggregate**. **Do not move tax logic into a source engine** — it
would tax rental in isolation, destroying negative gearing, and apply the wrong marginal rate.

### 2.4 Naming (D17)

**Not "net income."** That phrase means after-tax everywhere else. Banked/received income, named as
such, and every ratio built on it states its basis. The four other producers are renamed or deleted
**citing their contract entry**.

## §3 Invariants that become permanent tests

- **`netTotal ≤ grossTotal`**, always, Float and Decimal. This alone would have caught MON-128 on day
  one.
- Sources sum to banked income.
- A one-off income row contributes **0** to every monthly and annual run-rate, on every migrated
  producer.
- Float ≡ Decimal parity across every migration.
- HELP: a repayment income of $186,051 produces **10% of the whole**, not 10% of the excess. Test the
  boundary in both directions — the cliff is the part most likely to be coded as a band.
- Withholding resolves from the **row's own period**, not today's (D33's discipline).

## §4 `expectedMoves` — computed, not estimated

**Do not write predictions by hand.**

Run the **existing** producers and the **new** producers against the same real data through the relay,
and let the difference *be* the declaration. Commit it **before** the migration merges, with the
arithmetic per path.

**Declare per path, never directionally.** A prefix entry like "income falls" would absorb an
unrelated regression as expected — the exact failure mode MON-135 exists to prevent on the expense
side.

Paths that will move, to be filled with computed values rather than the Matrix's indicative figures:
`quickMetrics.monthlyIncome` · savings rate · debt-to-income · the health score
(`generateHealthReport`) · the budget generator's income-sanity guard at
`app/api/budget-analysis/generate/route.ts:267`.

**Must NOT move** — the regression cluster: net worth **$3,401,782** · total assets **$5,461,679** ·
liquid **$301,808** · taxable income **$145,426** · tax **$37,786** · committed **$14,261** · the
per-loan costs. Any movement here that is not declared **stops the tranche**.

## §5 New FACT fields this tranche needs

Where a value can only come from the user, the answer is a **field**, not a question:

- **Actual net pay** per income row, so the fact can win over the estimate.
- **Salary sacrifice** amount, since it changes both withholding and taxable income.
- **HELP loan present** flag — an employer only withholds where the employee has declared the loan.
  Absence of the flag is not evidence of absence of a loan; render **undetermined**, never zero.

Each ships with the field, its intake path, and an undetermined state. **No defaults that assert a
tax position.**

## §6 Done gates (ledger §2)

G6 merged + deploy READY · **G7 baseline diff shows only declared movement** · G8 Ring-3 live on real
data with the expectation derived independently — `netTotal ≤ grossTotal` and the declared-gross
cross-check, **never read off another screen** · G9 census published as was-and-now for the income
quantities, **collapsed separately from deleted-as-dead** · G10 regression cluster byte-identical ·
G11 downstream issues verified on their own evidence.

**If G7 or G8 fails: revert the merge. Do not patch forward.**

## §7 Coverage boundary to state in the PR

What was migrated, what was renamed, what was deleted and on whose contract authority — and **what
was not touched**. Specifically: whether the rental discrepancy was resolved or deferred, and whether
any income row's withholding could not be derived and therefore renders undetermined.

## §8 Neo-sync (§21.2.2)

Neomatrix re-pin for the new source engines and the aggregator; NeoAudit gains the
`netTotal ≤ grossTotal` and sum-of-sources ratchets plus the HELP cliff boundary test; census re-run
with published counts; changelog + `0·REF`; ledger §3 rows filled with evidence. Nothing sandbox-only.

---
*Prepared by The Matrix, 30 July 2026. Decisions: D17 · D18 · D20 · D33 · D35 · D42 (C2, C3).
Tax positions verified against ato.gov.au in session — HELP thresholds and the top-band basis, PAYG
withholding as a schedule, Division 293's add-back, and the 2026-27 rates. §0 records a Matrix scoping
error and its correction.*
