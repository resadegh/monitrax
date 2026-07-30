# D42 — Final verification pass: corrections, and the last five decisions

**30 July 2026.** Two jobs. **(1)** `REFERENCE_NUMBERS_DECISIONS.md` on main was assembled — correctly
and faithfully — from the four session logs, but those logs were written **before** a final
verification pass against ATO, ASIC, AASB and Treasury primary sources. That pass produced **six
corrections**, one of which is stated in the register as a flat rule and is **wrong for a real class
of user**. **(2)** Inventory decisions **17, 20, 21, 22 and 25** were settled after the logs were
pushed. **The register's "5 still open / Phase B blocked" line is stale: 28 of 28 are settled.**

> **Precedence:** on any conflict between this file and `REFERENCE_NUMBERS_DECISIONS.md` or the
> session logs, **this file wins on the six corrections in §1** — they are later and primary-sourced.
> Everything else in the register stands.

---

## §1 The six corrections

### C1 — Co-owner attribution has a business carve-out *(amends D19 — the dangerous one)*

The register states, unqualified: *"attribution follows legal interest; private agreements don't
override it."* **That is true only where co-owners are NOT carrying on a rental property business.**

Where co-owners **are partners in a rental property business**, the ATO requires the **partnership
agreement to govern** — *"you must divide the net rental income or loss according to the partnership
agreement… even where the legal interests in the rental properties are different to the partners'
entitlements under the partnership agreement."*

**As written, the register would have Phase B build the wrong rule for business co-owners.**
Monitrax must hold **which case applies as a FACT**, and must not assume the investor case. The ATO
also notes that a person who simply co-owns one or several investment properties is *usually* an
investor, not carrying on a business — so the investor case is the common default, but it is a
default that must be recorded as an assumption under D19's own provenance guard, not baked in.

*Source: ATO, Rental properties 2025 — rental income; TR 93/32.*

### C2 — The HELP top band is a cliff, not a marginal rate *(amends D17)*

The register records the 2026-27 marginal system and the $69,528 threshold. It does not record that
**above $186,050 the repayment is 10% of *total* repayment income** — not 10% of the excess. The
first two bands are genuinely marginal (15c per $1 over the threshold to $129,717; then
$9,028 + 17c per $1 over $129,717). **The top band must be coded as a flat 10% of the whole
repayment income.**

### C3 — "Repayment income" is broader than recorded *(amends D17)*

Five components: taxable income (**excluding** First Home Super Saver released amounts) · reportable
fringe benefits · **total net investment loss, including net rental losses** · reportable super
contributions · **exempt foreign employment income**. The last item and the FHSS exclusion were
missing.

**Consequence for Reza, and the earlier estimate may be materially low.** Because net rental losses
are **added back**, his repayment income exceeds his $145,426 taxable income. With $172,325 of
deductions in play he may be above $186,050, in which case the calculation is 10% of the whole —
roughly **$1,600–1,700/mo** rather than the ~$975/mo first indicated. **Establish from his notice of
assessment. Do not estimate.**

*Source: ATO, Study and training support loans — thresholds and compulsory repayments.*

### C4 — The bring-forward TSB threshold is $1.84M, not $2.1M *(amends D24/D34)*

Two different numbers were conflated. **$390,000 over three years requires a total super balance
under $1.84M** at 30 June 2026. **$2.1M is the general transfer balance cap** — the TSB at or above
which the non-concessional cap is **nil**. Full tiering:

| TSB at 30 June 2026 | Non-concessional available |
|---|---|
| Under $1.84M | $390,000 over 3 years |
| $1.84M to under $1.97M | $260,000 over 2 years |
| $1.97M to under $2.1M | $130,000, no bring-forward |
| $2.1M or more | Nil |

Carry-forward concessional is unchanged: **five years, TSB under $500,000** at 30 June of the prior
year. 2026-27 accesses **2021-22, 2022-23, 2023-24 at $27,500 each; 2024-25 and 2025-26 at $30,000
each** — maximum headroom **$142,500** plus the current-year $32,500.

*Source: ATO, contributions caps; non-concessional contributions cap.*

### C5 — The negative-gearing quarantine is broader, and applies to established dwellings *(amends D41)*

The register says losses quarantine to *"residential-rental assessable income"*. The reform
quarantines them to **other income from residential properties** — broader. And the restriction
applies to **established** residential dwellings acquired after 7:30pm AEST 12 May 2026; **new builds
are exempt**, and dwellings held at the cut-off are **grandfathered until sold**.

Also: the entity list is **Australian resident individuals and trusts** — partnerships flow through
rather than being a separate class.

### C6 — The 2027 deemed disposal is NOT a tax event *(amends D41 — fills its stated gap)*

D41 recorded the accrued-gain apportionment mechanics as unverified. They are now established from
secondary sources, and the finding is materially **less alarming** than "deemed disposal of all
capital assets" implies:

Assets held at midnight 30 June 2027 are deemed sold on 30 June 2027 and immediately reacquired on
1 July 2027 at market value or a ministerial apportionment method — but **the gain or loss on that
deemed disposal is disregarded and deferred until the asset is ultimately realised.** There is no
1 July 2027 tax event. The deferred amount is tracked as a **deferred residential** or **deferred
non-residential capital gain**.

On eventual actual disposal, two components are computed and summed:
1. the **deferred pre-1 July 2027 gain**, eligible for the existing **50% discount** where the
   12-month rule was met; and
2. the **post-1 July 2027 gain**, subject to **cost base indexation** by quarterly CPI, applied per
   element of cost base incurred on or after 1 July 2027 — acquisition costs, capital improvements
   and title costs, **but not ongoing holding costs** such as rates, insurance and repairs.

**Deferred gains from the deemed disposal are excluded from the 30% minimum rate**, as are
income-support recipients and gains still eligible for the discount (new residential dwellings,
affordable housing).

**Still to be confirmed against primary law.** This rests on Cowell Clarke's and Baker McKenzie's
readings of the Bills. The enacted Act is **C2026A00049**; its operative text could not be retrieved
(the Federal Register page returned front matter only; the ATO-hosted PDF returned 403).
**Confirm against the Act or its explanatory memorandum before the CGT tranche builds the
transition.**

---

## §2 The last five decisions — settled

**The register's "Phase B blocked, 5 open" line is stale. 28 of 28 are settled.**

### D43 — Negative gearing at zero rental: one producer taking availability as an input *(inventory #17, grounded)*

**Neither the CFO's answer nor the tax page's is unconditionally right** — the disagreement is a
missing FACT, not a formula error. Deductions on a vacant rental property turn on the **"genuinely
available for rent"** test, whose two limbs are: *"the property is advertised in ways which give it
broad exposure to potential tenants"* and *"having regard to all the circumstances, tenants are
reasonably likely to rent it."* Negative factors include *"unreasonable or stringent conditions on
renting out the property that restrict the likelihood"*.

Zero rental is at least **four** states:
- **genuinely available, untenanted** → deductible; a benefit exists (CFO right)
- **not genuinely available** → denied (tax page right)
- **available part of the year** → **apportioned** *"according to the proportion of the year that the
  property was rented out, and genuinely available for rent"* — **both producers wrong**
- **vacant land** → its own regime; holding costs denied from 1 July 2019, subject to exceptions

**One producer, taking availability and available-days as inputs.** Where availability is unknown the
output is **UNDETERMINED**, not a number — the MON-134 `INSUFFICIENT_HISTORY` pattern.

The dormant reform engine keeps D41's hard park deadline of **1 July 2027**; both it and its Decimal
twin stay **counted in the census**.

**Requires:** availability and available-days as a fact per property per period — a one-time pass
over Reza's six properties.

### D44 — Depreciation: two regimes, no method default *(inventory #20, grounded — the open question is answered)*

**The ~4× divergence ($474.61 versus $2,000) is two regimes wearing one name — an UNNAMED, not a
WRONG.**

**Division 43 capital works** is a **flat 2.5% per year over 40 years, straight-line only**, for
construction commencing on or after 16 September 1987. **There is no method choice.** Code applying
a method default to capital works is wrong by construction.

**Division 40 plant and equipment** is where prime cost versus diminishing value exists, and the
choice is a **taxpayer election recorded per asset — never a default the app picks**, because picking
one asserts a tax position on the user's behalf (D19's principle).

**Now confirmed, previously open:** *"Once you have chosen a method for a particular asset, you
cannot change to the other method for that asset."* The interface captures the election once, then
**locks it per asset**.

**Diminishing value — use the base-value form:** `base value × (days held ÷ 365) × (200% ÷ effective
life)`. Base value is cost in the first year, then opening adjustable value plus any second-element
additions. The 200% factor applies from 10 May 2006 (150% before). **The form rendered on the ATO's
rental page is the year-one special case and must not be coded as the general rule.**

**Thresholds:** immediate deduction for assets costing **$300 or less** (not if part of a set costing
more than $300); **low-value pool for assets under $1,000**.

**Matters more than method:** *"In most cases you can't claim a deduction for second-hand depreciating
assets after 1 July 2017."* If a property was bought established, much of the Division 40 schedule may
be worth **zero**. Eligibility is a fact per asset.

**Split into two named quantities** — capital works and plant and equipment — with the **rate-unit
contract stated in the type** (percentage versus fraction; the 100× trap). **Where quantity surveyor
schedules exist, ingest them as FACTS** rather than computing from rates: the schedule already
determines every asset, its effective life, eligibility and elected method.

*Source: ATO capital works deductions; depreciating assets in rental properties; s 40-130.*

### D45 — Multi-year projection *(inventory #21, grounded on the compliance framework)*

**One survivor**, pure engine with a Decimal twin. `forecastEngine.ts:220` goes regardless — it falls
back to a hardcoded **$100,000 income and $60,000 expenses**.

**Two different things were being called defaults, and they get opposite treatment:**
- **Missing user data** (income, expenses, balances) → **refuse to compute**. Never fabricate the
  user's own figures.
- **Missing forward assumptions** (growth, inflation, rent growth, interest paths) → **explicit,
  sourced, disclosed defaults are necessary**: named, dated, sourced, shown on the surface,
  user-overridable.

**One assumptions config — and it is a relief condition, not hygiene.** ASIC **Instrument 2022/603**
and **RG 276** set a single framework. Default assumptions *"must be reasonable for the purpose of
working out the calculation or estimate"*, with prescribed values including **wage inflation 3.7% pa**,
**CPI 2.5% pa**, **default retirement age 67**, and drawdown to the later of age 92 or five years.
Results in **today's dollars**, with a *"clear and prominent explanation of why these assumptions are
reasonable"*. **Users must be able to change assumptions** in calculators and interactive estimates,
except statutory factors and drawdown mechanics.

**A compliance boundary for Reza, not the Matrix:** under that instrument a superannuation
**calculator** may be provided by any entity, but a **retirement estimate may only be provided by a
superannuation trustee, to its own members.** Monitrax is not a trustee. If any projection presents a
projected retirement balance or retirement income, its substance may be a retirement estimate rather
than a calculator.

**LLM-invented projections: DELETE**, and add to the `lint:ai-grounding` gate.

**And the reform reaches this directly:** any projection running past **1 July 2027 must model both
regimes and the switchover.** A projection assuming today's rules continue is demonstrably wrong for
every year beyond that date.

### D46 — The dead forecast stack is deleted *(inventory #22, judgement)*

Delete the CFE, stress, insights and strategies routes and the never-written `cashflowInsight` table.
The table's absence means the feature was never finished, and **anything resurrected after MON-131
would be built on the definitions being deleted** — wrong by construction. Git history retains it.

**Why this differs from the parked reform engine:** that has a dated, legislated use case eleven
months out. This has no dated use case and no finished data model. **Park what has a date; delete what
does not.**

**Honesty condition, and it applies to the whole programme's headline:** deleting dead producers
lowers the census count **without improving a single number a user sees**. The census report must
distinguish **collapsed** from **deleted as dead** — otherwise "336 down to 23" partly reflects
removing code nobody ran. The retiring ring2 route test is recorded as a **deliberate retirement**, not
a silent coverage drop.

### D47 — Insurance adequacy: remove the 70; rebuild on ASIC's methodology *(inventory #25, grounded)*

**Remove the hardcoded `insuranceGapsScore = 70` now.** A made-up score displayed as a measurement is
the same class as the fabricated health trend, the invented dividend yield and the LLM projections.

**The metric is buildable later on ASIC's own published methodology.** Moneysmart's life insurance
calculator is needs-based: funeral costs (default $5,000) · mortgage less home sale proceeds · other
debts · children's education ages 5–18 · family living costs up to ten years — **less** available
assets including super, savings, investments and property. Assumptions: **inflation 2.5% pa**, **net
investment return 3.0% pa**, used to discount to present value.

**Two limits.** It covers **life cover only** — explicitly excluding income protection, TPD and trauma
— and *"does not consider your eligibility for insured cover or the affordability of the estimated
insurance cover"*. An "insurance gaps" score spanning all cover types would need a methodology no
regulator provides, and inventing one is how the 70 got there. **Scope it to life cover, named as
such.** ASIC's own calculator carries *"not a substitute for financial advice"*; Monitrax needs the
equivalent.

---

## §3 What remains unverified

- **The 2026-27 rate table is not yet published on the ATO's rates page** (last updated 1 June 2026;
  tables run to 2025-26). The **15% rate** is confirmed from Parliament's bill digest and the four
  thresholds are confirmed unchanged from the 2025-26 table, but the **combined table with cumulative
  amounts ($4,020 / $31,020 / $51,370) rests on a secondary source.** The explanatory memorandum and
  the ATO-hosted Act PDF both returned 403.
- **The reform's transition mechanics (C6)** rest on law-firm readings, not the enacted Act.
- **Division 293's non-indexation is inferred**, not sourced — nine unchanged years, no ATO statement
  either way.
- **Main-residence exemption specifics** (six-year absence rule, partial exemptions) deliberately not
  asserted; they need their own verification before the CGT tranche.

## §4 Facts required from Reza — updated list

1. **Salary component**, separate from rental and other income (D33).
2. **Total super balance** at 30 June (D24/C4).
3. **Division 293** exposure basis (D24).
4. **HELP repayment income from the notice of assessment** (C2/C3) — new, and material.
5. **Any property acquired after 7:30pm 12 May 2026** (D41).
6. **Any property predating 20 September 1985** (D41).
7. **Any property qualifying as a new build** (D41/C5).
8. **Any loan secured over more than one property** (D26).
9. **Quantity surveyor depreciation schedules** (D44) — new.
10. **Are any co-owned properties held as a rental property *business*** (C1) — new, and it changes a rule.
11. **Are any loans fixed** (D39).
12. **Are any loans mixed-purpose** (D21).
13. **Availability and available-days per property** (D43) — new.

---
*Recorded by The Matrix, 30 July 2026. Verification pass performed against ato.gov.au, asic.gov.au,
standards.aasb.gov.au, moneysmart.gov.au, treasury.gov.au and aph.gov.au. Fourteen fact groups checked:
eight confirmed as stated, six corrected, four items recorded as unverified.*
