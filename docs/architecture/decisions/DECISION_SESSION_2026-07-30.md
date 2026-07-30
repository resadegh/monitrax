# Phase A gate — decision session, 30 July 2026

**Live document. Written as each decision is made; folds into `REFERENCE_NUMBERS_DESIGN.md` §6 when
all 28 are settled.** Continues the register from D16.

Every decision below is **Reza's**, made in session. Where the Matrix's recommendation was changed
or rejected, that is recorded — the reasoning matters more than the outcome, because Phase B
implements the reasoning.

**Progress: 4 of 28 settled.**

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
**Principal repayment counts as saving.**

Denominator follows D17 by consequence — a cash numerator over a non-cash denominator would be
incoherent.

**Reasoning:** a principal repayment does not leave the user's wealth; it converts cash into
equity. Interest is an expense; principal is a balance-sheet movement. This is D8 applied to the
savings rate, which had never been told. For a leveraged property investor the distinction is the
difference between a metric that says "going backwards" and one that says "accumulating equity
through debt reduction".

**Established:** of Reza's $12,779/mo loan cost, **$3,709 is pure interest** (the two interest-only
Bankwest loans, VR-041-verified) and is spending under any definition. The remaining ~$9,070 is P&I
across three loans and **its principal/interest split is NOT established** — do not guess it; derive
it per loan in Tranche 2.

**Required on the surface:** the page must state that principal repayments are counted as saving.
Without that label this replaces an unfairly harsh number with a quietly flattering one — the same
failure in the opposite direction.

## D19 — Unassigned entity rows default to personal, with provenance retained

**Decided:** a row with no entity assignment is treated as **personal** for every display and every
calculation. No "Unassigned" bucket in the UI.

**Rejected:** the Matrix's recommendation of an explicit Unassigned slice.
**Reza's reasoning:** for a single user the overwhelming majority of rows genuinely are personal;
company rows are the ones deliberately assigned. Defaulting the other way makes the user do work to
state the obvious.

**Accepted guard (Reza confirmed):** an explicitly assigned attribution is a **FACT**; a
default-to-personal attribution is **DERIVED** — an assumption. Under D1 those cannot be identical
in the data even where they are identical on screen. So:

- Store whether attribution was **assigned or assumed**.
- Entity **tax** views state how much of the position rests on assumption — e.g. *"12 of 47 rows
  attributed by default."* Not a warning banner; a disclosure line.

**Why the guard is not optional:** the ATO requires attribution to follow **legal interest** and
explicitly rejects private agreements as a substitute — in the ATO's own worked example an 80/20
written partnership agreement between joint tenants was overridden to 50/50. A tax position built
partly on assumed attribution must disclose that, particularly for anything touching Renew Group
Holding.

**Invariant regardless:** entity slices must sum to the total, always — a permanent test. Today
unowned cashflow rows silently vanish from every slice. (Net worth slices already reconcile exactly:
$2,651,781.52 + $750,000 = $3,401,781.52.)

**Flagged, not folded in:** proportional ownership. A row currently belongs to one entity or none,
but real ownership is often a percentage — and per the ATO rule above, the percentage is what tax
follows. Overlaps Decision 9 (property equity). Not decided here.

## D20 — Calc engines split by source, in three layers

**Decided:** engines are split by income source, **layered**, never flat.

- **Layer 1 — source engines.** One per source *that has its own rules*: salary (withholding, HELP,
  salary sacrifice) · rental (per-property, agent fees, ownership share) · dividends (cash received;
  franking excluded from cash) · business distributions (trust vs company, **PSI attribution** —
  material given Renew Group Holding). Each computes a banked amount and nothing else.
- **Layer 2 — aggregator.** Sums Layer 1 into banked income. Pure summation, no arithmetic of its
  own. **Invariant: sources must sum to the total.**
- **Layer 3 — tax engine.** Takes taxable income on its own basis with deductions and computes tax
  **once, on the aggregate.**

**The constraint that decides the shape: tax is assessed on the total, never per source.** Tax logic
inside a source engine would tax rental in isolation — destroying negative gearing, since a property
loss is meant to reduce tax on salary — and would apply the wrong marginal rate, since the rate on
the last rental dollar depends on salary being counted first. **Layer 3 must never be split by
source.**

**Banked income and taxable income are two different quantities on two different bases and will
never be equal.** Both are correct. Separate names, separate pipelines — D6, and the reason 13
quantities came back UNNAMED.

**The test for a legitimate split:** does this source have a rule none of the others has? If yes it
is a distinct named quantity and earns its own engine. If two sources follow identical rules they
share one — splitting where rules are identical recreates the multiplicity being removed. Interest
income likely does not warrant its own engine.

**Must stay shared, not split:** frequency conversion. Every engine calls the one `monthlyRunRate`
utility. Per-engine conversion would rebuild the 28 converters inside a nicer structure.

**Consequence accepted:** income becomes four or five named quantities instead of one, so Phase A
gains contracts and the gate moves out slightly. Each is smaller and independently checkable. The
aggregator becomes the only component that sees everything and therefore the new place a bug could
hide — which is what the sum-of-sources invariant is for.

---

## Still to settle (24)

Decisions 5–28 of `NUMBER_INVENTORY.md` §5.1. Next: **Decision 4 — loan monthly interest, gross or
net of offset.**

**Phase B writes nothing until all 28 are settled.**

---
*Recorded by The Matrix during the Phase A gate session, 30 July 2026, at `4e6cdd5c`. Tax positions
grounded at the ATO in session: instalment income (gross rent included, salary excluded), PAYG
instalment entry thresholds, HELP 2026-27 marginal repayment system, 2026-27 rates 0/15/30/37/45
with Medicare 2%, and co-owner attribution by legal interest.*
