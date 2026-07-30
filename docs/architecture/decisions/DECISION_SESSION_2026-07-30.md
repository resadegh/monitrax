# Phase A gate — decision session, 30 July 2026

**Live document. Written as each decision is made; folds into `REFERENCE_NUMBERS_DESIGN.md` §6 when
all 28 are settled.** Continues the register from D16.

Every decision below is **Reza's**, made in session. Where the Matrix's recommendation was changed
or rejected, that is recorded — the reasoning matters more than the outcome, because Phase B
implements the reasoning.

**Progress: 8 of 28 settled.**

---

## D17 — Income means what reaches the bank (supersedes the Matrix's Option A)

**Decided:** there is ONE canonical income quantity, and it is **cash actually received**.

- Gross-entered salary has withholding derived and removed, because that tax never reaches the
  account. **HELP/HECS compulsory repayment is part of that withholding** — from 1 July 2026 the
  marginal system applies ($69,528 threshold; `$9,028 + 17%` over $129,717 in Reza's band).
- Where the user knows their actual net pay from a payslip, **that is a FACT and wins** over any
  derived estimate. Derived withholding is the fallback for gross entry and ABN/contractor income.
- Rental, dividends and distributions count **as received, untaxed** — the tax on them is not
  withheld and must not be modelled as if it were.
- **Year-end tax lives only in the tax engine**, as an estimated payable/refundable position,
  labelled as an estimate. It never touches the income figure.

**Rejected:** the Matrix's proposal to define net income as after-tax across all sources.
**Reza's reasoning, which is better:** (1) deducting estimated tax at the income line and showing
tax payable in the tax engine double-counts the same liability; (2) a cash figure is checkable
against a bank statement — an after-tax figure is checkable against nothing the user can see;
(3) a tax estimate is a range, not a number, because deductions and offsets move it, and that
uncertainty belongs in the tax engine rather than smuggled into income.

Two consequences the Matrix accepted:
- **Naming.** It is not called "net income" — accountants, lenders and every serviceability
  calculation mean *after-tax* by that phrase. Banked/received income, named as such.
- **No second income quantity for now.** The Matrix proposed keeping an after-tax figure for
  ratios; Reza declined, and was right — it would reintroduce the multiplicity being removed.
  Revisit only if a lender-facing serviceability feature needs it, and then name it once.

**Open, and recorded as Reza's stated fact rather than derived:** PAYG instalments. Gross rent **is**
instalment income per the ATO, and automatic entry triggers at instalment income $4,000+, tax
payable $1,000+ on the latest assessment, and estimated tax $500+. Reza's tax page shows **$11,129
payable** after $26,658 withheld, which clears the trigger. **Reza states tax is settled at
year-end**, so no instalment outflow is modelled. If quarterly activity statements begin arriving,
this changes and the Matrix re-raises it. *The Matrix initially asserted Reza was "almost certainly"
in the instalment system — an inference about his circumstances from a general rule, withdrawn.
The rule stands; the claim about him did not.*

## D18 — Savings rate: principal repayment is saving, not spending

**Decided:** savings rate = (banked income − interest − other spending) ÷ banked income.
**Principal repayment counts as saving.** Denominator follows D17 by consequence.

**Reasoning:** a principal repayment does not leave the user's wealth; it converts cash into
equity. Interest is an expense; principal is a balance-sheet movement. This is D8 applied to the
savings rate, which had never been told. For a leveraged property investor the distinction is the
difference between a metric that says "going backwards" and one that says "accumulating equity
through debt reduction".

**Established:** of Reza's $12,779/mo loan cost, **$3,709 is pure interest** (the two interest-only
Bankwest loans, VR-041-verified) and is spending under any definition. The remaining ~$9,070 is P&I
across three loans and **its principal/interest split is NOT established** — derive it per loan in
Tranche 2; do not guess.

**Required on the surface:** the page must state that principal repayments are counted as saving.
Without that label this replaces an unfairly harsh number with a quietly flattering one — the same
failure in the opposite direction.

## D19 — Unassigned entity rows default to personal, with provenance retained

**Decided:** a row with no entity assignment is treated as **personal** for every display and every
calculation. No "Unassigned" bucket in the UI.

**Rejected:** the Matrix's recommendation of an explicit Unassigned slice. **Reza's reasoning:** for
a single user the overwhelming majority of rows genuinely are personal; company rows are the ones
deliberately assigned. Defaulting the other way makes the user do work to state the obvious.

**Accepted guard (Reza confirmed):** an explicitly assigned attribution is a **FACT**; a
default-to-personal attribution is **DERIVED** — an assumption. Under D1 those cannot be identical
in the data even where they are identical on screen. So: store whether attribution was **assigned or
assumed**, and have entity **tax** views state how much of the position rests on assumption — e.g.
*"12 of 47 rows attributed by default."* A disclosure line, not a warning banner.

**Why the guard is not optional:** the ATO requires attribution to follow **legal interest** and
explicitly rejects private agreements as a substitute — in the ATO's own worked example an 80/20
written partnership agreement between joint tenants was overridden to 50/50.

**Invariant regardless:** entity slices must sum to the total, always — a permanent test. Today
unowned cashflow rows silently vanish from every slice. (Net worth slices already reconcile exactly:
$2,651,781.52 + $750,000 = $3,401,781.52.)

**Flagged, not folded in:** proportional ownership. A row belongs to one entity or none, but real
ownership is often a percentage — and per the ATO rule above, the percentage is what tax follows.
Overlaps Decision 9.

## D20 — Calc engines split by source, in three layers

**Decided:** engines are split by income source, **layered**, never flat.

- **Layer 1 — source engines.** One per source *that has its own rules*: salary (withholding, HELP,
  salary sacrifice) · rental (per-property, agent fees, ownership share) · dividends (cash received;
  franking excluded from cash) · business distributions (trust vs company, **PSI attribution** —
  material given Renew Group Holding). Each computes a banked amount and nothing else.
- **Layer 2 — aggregator.** Sums Layer 1 into banked income. Pure summation.
  **Invariant: sources must sum to the total.**
- **Layer 3 — tax engine.** Takes taxable income on its own basis with deductions and computes tax
  **once, on the aggregate.**

**The constraint that decides the shape: tax is assessed on the total, never per source.** Tax logic
inside a source engine would tax rental in isolation — destroying negative gearing, since a property
loss is meant to reduce tax on salary — and would apply the wrong marginal rate. **Layer 3 must
never be split by source.**

**Banked income and taxable income are two different quantities on two different bases and will
never be equal.** Both correct. Separate names, separate pipelines — D6, and the reason 13
quantities came back UNNAMED.

**The test for a legitimate split:** does this source have a rule none of the others has? If yes it
earns its own engine. If two sources follow identical rules they share one — splitting where rules
are identical recreates the multiplicity being removed. Interest income likely does not warrant one.

**Must stay shared, not split:** frequency conversion. Every engine calls the one `monthlyRunRate`
utility, or we rebuild the 28 converters inside a nicer structure.

**Consequence accepted:** income becomes four or five named quantities, so Phase A gains contracts
and the gate moves out slightly. The aggregator becomes the only component that sees everything and
therefore the new place a bug could hide — which is what the sum-of-sources invariant is for.

## D21 — Loan monthly interest is net of offset

**Decided:** the canonical loan interest quantity is **net of offset** — interest on
(balance − offset), which is what the bank charges.

**Reasoning:** it is the only figure that is real. Under D17 numbers must match the bank, and gross
interest is a hypothetical. It is also the **deductible** amount — interest is deductible as
*incurred*, and an offset reduces what is incurred, so claiming gross would overstate the deduction.
And it already agrees with actuals: the interest-only loans resolve from linked repayments ($1,191
and $2,518), which are post-offset. Gross would put the canonical figure at odds with the bank feed.

**Gross survives only as a scenario input** — "what would this cost if the offset were withdrawn" —
under that name, never as "interest".

**Two contract notes required:**
- **Offset ≠ redraw.** An offset leaves the loan balance untouched and reduces interest charged. A
  **redraw** changes the loan itself, and the ATO is explicit that redrawing for private purposes
  permanently splits the loan into deductible and private components, with all future interest **and
  principal** apportioned. Treating a redraw as an offset overstates the deduction for the life of
  the loan.
- **Deductibility follows use, not security.** A mixed-purpose loan needs apportioning, so the
  interest engine takes a deductible-portion input rather than assuming 100%. Whether any of Reza's
  loans are mixed-purpose is a fact for him or his accountant.

## D22 — Committed and Essential are two named quantities

**Decided:**
- **`monthlyCommitted` = all recurring non-loan expenses + canonical loan cost.** Everything leaving
  the account on a repeating basis, discretionary or not.
- **`monthlyEssential` = non-discretionary recurring + loan cost.** Used **only** in the survival
  runway, where the question is what cannot be cut if income stops (D3/D4).

**Why both:** the two collapsed axes — *fixed vs variable* and *essential vs discretionary* — are
orthogonal. A gym membership is recurring, fixed and entirely discretionary; council rates are
recurring, fixed and unavoidable. Treating recurring as a proxy for unavoidable is what produced
MON-024's "906% discretionary spending". Excluding discretionary recurring costs from *committed*
would understate what is actually paid each month.

**Naming collision resolved:** three distinct things were all being called some form of
"essential"/"committed" — recurring bills ($1,482), loan cost ($12,779), and their sum ($14,261).
D4 used "essential" for the total; the implementation used it for the component.

**Note on the data:** on Reza's current figures **both options give $14,261** — all his recurring
non-loan expenses appear classified essential. Two definitions agreeing today says nothing about
whether they are the same definition. This is the coincidence-of-data trap.

**Dependency:** the runway needs a trustworthy discretionary flag. MON-024 was caused by
discretionary and essential being computed on different bases — the flag's basis must be defined in
the contract, not assumed, or the bug is inherited.

## D23 — One budget-variance producer, four tiers, shared with the AI

**Decided:** one survivor. Delete V1 (no web consumer) and V4's dead exports; **fold V4's four-tier
scale into the survivor**; fix V3's input shape; **point V2 at the survivor** so the AI and the
screen read the same number.

**Why the four-tier scale:** over/under/on-track is a report card — it reports after the fact. A
warning tier between on-track and over is a control; it fires while the user can still act.

**Two failures worse than the duplication:**
- **The rendered producer is broken at its input.** V3's `buildBudgetComparison` runs
  `Object.entries()` over stored analysis blobs, so the "budgeted" side of the tile is built from
  blob metadata keys (`generatorVersion`, `committedTotal`) rather than per-category amounts. The
  budget side of the budget-vs-actual tile is not a budget.
- **The AI is advised on a different number than the user sees** — V2 feeds Gemini, V3 feeds the
  screen. Likely a violation of the repo's own `lint:ai-grounding` gate.

**Deferred by design:** thresholds and the target definition are set in D24, because variance is
meaningless until the budget exists. Canonising tolerance bands around the ABS benchmark would fix
the producer against a target D24/D25 abolishes.

**Noted:** the tile renders a meaningless comparison until Tranche 7. Reza was offered the option of
silencing it in the interim; not taken up, and not pulled forward unilaterally.

## D24 — The budget remainder, on two bases

**Decided:** build it (MON-127), as **two named quantities**:
- **Planning remainder** = banked income − committed. *"What could I direct if nothing unexpected
  happened."*
- **Actual remainder** = banked income − trailing-12-month outgoings. *"What has actually been left
  over."*

Both shown, with the gap between them named.

**Why two:** committed is $14,261 but actual outgoings run at **$25,973/mo** — a gap of roughly
**$11,712/mo of real, non-recurring spending**, much of it likely lumpy property costs. A single
remainder computed from committed would present ~$10,000/mo as available when history says nearly
all of it gets spent. The planning figure is the target; the actual figure is the reality check.
One without the other is either fantasy or fatalism. This is also why the savings rate reads −30.5%
while the remainder looks healthy — they measure different things.

**Indicative arithmetic (not a commitment):** banked ≈ $317,751 gross − $26,658 withheld ≈
**$24,250/mo**, possibly ~$1,000 lower if HELP withholding sits outside that figure (not
established). Remainder ≈ **$10,000/mo**. For contrast the tool currently suggests $4,442, and an
earlier Matrix figure of $27,042 was computed off the inflated $41,303 income — neither was right.

**Allocation modes are strategies, not fixed percentages** — security-weighted (buffer to target,
then non-deductible debt) · balanced · growth-weighted (tax-effective investment first) — computing
an allocation from the user's actual position.

**Two facts needed before the growth mode is built** (requested from Reza):
- **Total super balance.** Reza's locked bucket reads ~$3.03M. If that is his TSB, **carry-forward
  concessional contributions are unavailable** (needs < $500,000 at 30 June prior) and the
  **non-concessional bring-forward is also out** (needs < $2.1M). The 2026-27 concessional cap is
  **$32,500** including employer SG.
- **Division 293.** Threshold **$250,000**, never indexed. Income for that purpose **adds back net
  rental and investment losses**, so the $145,426 taxable income is not the relevant figure — with
  $172,325 of deductions in play the Division 293 income could be materially higher. If he is over,
  concessional contributions attract an extra 15%, cutting the salary-sacrifice benefit from roughly
  24% to about 9%.

**Compliance flag (raised, not advised on):** a tool that says "put $10,000/mo into super" is close
to personal financial advice, which in Australia requires a licence. Framing modes as **scenarios
with consequences** — effect on tax, debt and runway — rather than recommendations keeps that
boundary. For Reza's own compliance view.

## D25 — The ABS benchmark is relabelled, and its provenance is challenged

**Decided:** relabel on **all four surfaces together** as an explicit comparison — "typical for a
household your size" — never "your budget", never a default, never a variance target (D23 routes
variance to the real budget). **Display the vintage and source on the surface.** And **verify the
provenance before republishing the figures.**

**Why the provenance is in question:** the benchmark is hardcoded per-person base costs (groceries
$400/adult, $200/child, $350/teen) attributed to **ABS 2023-24**. That attribution does not
reconcile. The ABS's current series is the **Monthly Household Spending Indicator** — aggregate
spending by category at national and state level, published monthly, current to April 2026. It does
not publish per-adult/per-child benchmarks. The survey that would support a per-person breakdown is
substantially older than 2023-24.

**A number attributed to a source that does not publish it is worse than an unattributed one** — the
citation lends authority it has not earned, and this is the figure four screens have been calling the
user's budget. If it traces to a real ABS series, cite that series and release. If it does not,
**drop the per-person figures rather than restate a citation that cannot be stood behind.** This is
D12 applied to an external constant instead of a legislated one.

**Consequence accepted:** if provenance fails, those four surfaces lose the peer-comparison answer
until a real source is found. D24's remainder gives them something real to show instead.

---

## Still to settle (20)

Decisions 9–28 of `NUMBER_INVENTORY.md` §5.1. Next: **Decision 9 — property equity: which loans are
the subtrahend, and do RENTAL rows carry value.**

**Phase B writes nothing until all 28 are settled.**

---
*Recorded by The Matrix during the Phase A gate session, 30 July 2026, at `4e6cdd5c`. Tax and data
positions grounded in session: ATO instalment income (gross rent included, salary excluded) · PAYG
instalment entry thresholds · HELP 2026-27 marginal repayment system · 2026-27 rates 0/15/30/37/45
with Medicare 2% · co-owner attribution by legal interest · ATO redraw apportionment · Division 293
threshold and income definition · 2026-27 super caps and carry-forward eligibility · ABS Monthly
Household Spending Indicator as the current household spending series.*
