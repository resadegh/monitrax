# Phase A gate — decision session, 30 July 2026 (part 2)

**Continues `DECISION_SESSION_2026-07-30.md` (D17–D25). Both parts fold into
`REFERENCE_NUMBERS_DESIGN.md` §6 when all 28 are settled.**

**Progress: 12 of 28 settled.**

---

## D26 — Property equity: attached loans, and the RENTAL type is split

**Decided (Q19):**

**(a) The subtrahend is the loans ATTACHED to the property**, not loans classified as mortgages.
Classification is a category; attachment is the actual encumbrance. A loan typed INVESTMENT may be
secured against a different property, and a loan typed otherwise may be the mortgage on this one.
Equity means value less what is secured against it — the only version that survives a reclassification.

**Equity subtracts the FULL loan balance, not balance-minus-offset** — deliberately different from
D21, and it must be written into the contract so nobody "fixes" the apparent inconsistency later.
Interest uses the net figure because that is what the bank charges. Equity uses the gross balance
because the offset cash is already counted as a liquid asset (D5/D29); netting it off the loan as
well would count the same money twice.

**(b) The RENTAL property type is split.** One type is doing two incompatible jobs: a property the
user owns and rents *out* (an asset, with attached loans and rental income) and a home the user rents
*as a tenant* (not an asset at all — a monthly expense). Forcing one answer means either investment
properties vanish from equity or a rented residence appears as owned. This is why the exclusion at
`app/dashboard/properties/page.tsx:494` looked like a definition — it was a workaround for a type
that means two things. **D10 stands: owned-and-rented-out carries value and its loans.** A tenanted
residence stops being a property row and becomes a rent expense.

**Until the data is split, do not guess** — flag affected rows for Reza to confirm once.

**Negative equity must NOT be floored at zero.** A property worth less than its loan has negative
equity and the portfolio total must carry it through. A floor would silently overstate net worth —
the one figure that currently reconciles to the cent.

**Addition made after ATO verification (changes scope, not just detail): the split must carry the
OWNING ENTITY, because CGT discount eligibility is entity-dependent** — **50% for individuals and
trusts, 33⅓% for complying superannuation funds, and NIL for companies.** Renew Group Holding is a
Pty Ltd, so anything held inside it gets no discount. The inventory already records a CGT path
applying the 50% discount with **no 12-month ownership check** (R1); if it also fails to check entity
type, a company-held gain would receive a discount it has no entitlement to — a larger error than the
missing 12-month test. **This makes D26 a precondition for the CGT work, not merely an equity fix.**

Also pinned for the CGT engine: for property the **CGT event is the contract date, not settlement**,
and the ownership period excludes both the acquisition date and the event date.

**Fact still needed from Reza:** are any loans secured over more than one property? Cross-
collateralisation requires a per-property allocation rule, which will be asked for rather than
invented.

**Not asserted:** main-residence exemption specifics (six-year absence rule, partial exemptions).
These get their own verification when the CGT tranche arrives.

## D27 — Accessible funds at market, and MANAGED_FUND counts

**Decided (Q10):** shares and managed funds are counted at **market value**. Cost is irrelevant to
accessibility — what could be realised is market value; cost matters only for computing the gain.
Using cost would understate accessible funds by the entire capital growth.

**The bucket is defined by redemption term, not by asset type:** realisable within roughly 30 days
without penalty. Listed ETFs settle T+2 and are accessible. Unlisted managed funds have redemption
windows and can be frozen — those belong in locked, as does the SMSF.

**Cost basis is still stored as a FACT**, for CGT. Market for display, cost for the gain — two values,
one asset, different jobs.

**Consistent with D17:** realising triggers CGT, so accessible-at-market overstates net proceeds. The
fix is **not** to embed an after-tax figure in the bucket — that would put a tax estimate inside a
balance-sheet number. The bucket stays at market; the page notes that realising triggers tax; the tax
stays in the tax engine.

## D28 — `breakdown.liquidAssets` is renamed AND derived, not re-founded

**Decided (Q20/Q22):** `computeLiquidCash` remains canonical per D5. `breakdown.liquidAssets`
(`lib/health/metricAggregation.ts:129`) is **renamed to realisable assets and derived as
liquid + accessible** — a consumer of the two canonical buckets, not a third producer.

Including shares and ETFs was never a bug; it is a **different quantity**, already named as the
accessible bucket in D27. So the answer is neither "change its formula to match D5" nor "leave it as
a rival liquid" — it stops computing and starts reading. **The producer count drops rather than the
problem being renamed.**

## D29 — Cash classification: net of oscillating accounts, gross of credit cards

**Decided (Q10 sibling / Decision 12):** the Balances "Cash" tile is **net of genuinely oscillating
accounts including when overdrawn, and gross of credit cards**, which appear as short-term
liabilities. Neither "gross accounts" nor "net of everything".

**Grounded in AASB 107 / IAS 7.8:** a bank overdraft is included as a *negative* component of cash
and cash equivalents **only** where it is repayable on demand **and** forms an integral part of cash
management — and the test for that is that the balance **frequently fluctuates between positive and
overdrawn**. Facilities that do not oscillate are financing, not cash equivalents, regardless of how
short the notice period is.

A credit card does not oscillate — it is either owed or nil — so it is **financing and must not net
off cash**. An offset or transaction account does oscillate and is a demand deposit, so it is cash,
and nets negatively when overdrawn.

**Implementation rule, kept deliberately simple:** transaction and offset accounts net, including
negative balances; credit cards do not. A genuine cash-management overdraft facility can be flagged
as such **if one ever exists** — not built speculatively.

**Expect the figure to sit between the two current extremes** — slightly worse than "net everything
off", slightly better than gross accounts. It is the standards-consistent middle.

---

## Still to settle (16)

Decisions 13–28 of `NUMBER_INVENTORY.md` §5.1. Next: **Decision 13 — the survival runway: producer
home, whether the 6-month target survives, and what zero burn renders.**

**Phase B writes nothing until all 28 are settled.**

---
*Recorded by The Matrix, 30 July 2026. Standards and rules verified in session for this part: ATO CGT
discount (eligibility, 12-month rule, entity-dependent percentages, contract-date CGT event) and
AASB 107 / IAS 7.8 (cash and cash equivalents, overdraft inclusion test, short-term borrowings as
financing).*
