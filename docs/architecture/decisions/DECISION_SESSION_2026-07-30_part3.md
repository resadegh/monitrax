# Phase A gate — decision session, 30 July 2026 (part 3)

**Continues parts 1 (D17–D25) and 2 (D26–D29). All parts fold into
`REFERENCE_NUMBERS_DESIGN.md` §6 when all 28 are settled.**

**Progress: 23 of 28 settled.**

---

## LAW — real numbers, regardless of how they look

**Reza, 30 July 2026:** *"I don't care how it makes them look — we need to produce real numbers and
facts for the users."*

Standing principle, recorded as a law rather than a decision. It is the presentation-side twin of
*never fix a number*: no figure is softened, floored, defaulted or omitted because the honest value
is unflattering. Applies to negative equity (D26), to properties that increase net burn (D31), and
to every score that moves when its inputs are corrected.

**Also adopted this session, at Reza's instruction:** every Matrix recommendation is labelled
**grounded** (with its source) or **judgement** (with the reasoning), and recommendations are
researched through primary channels rather than asserted from memory. Raised after the Matrix gave
two design opinions without checking available literature — the check reversed one of them (D32).

---

## D30 — The runway is two named quantities, and zero burn renders INDEFINITE

**Decided (Q14):**

**(a) Producer home: a pure engine with a Decimal twin**, not an extension of the master builder.
The master service is an *assembler*; a runway is a formula over inputs. Putting a formula inside an
assembler is the pattern that created this programme, and it makes the calculation untestable without
a database — so the invariant could never become a permanent test.

**(b) The 6-month target is retired, and there are TWO quantities** *(grounded — this revised the
Matrix's first recommendation):*
- **Emergency fund months** = liquid ÷ essential expenses. Reza: $301,808 ÷ $14,261 ≈ **21 months**.
  This is the one comparable to a published benchmark, because it is in the same units.
  **ASIC Moneysmart's target is three months of expenses — not six** — so the app's 6-month figure
  had no stated basis and was not the Australian regulator's number either.
- **Survival runway** = liquid ÷ net burn (D3/D4). ≈ **73 months**. Banded in its own units, with no
  borrowed benchmark.

**The 11.6 months currently rendered is a THIRD basis** — liquid ÷ total actual outgoings ($25,973),
which ties exactly. **Retire it.** Total actual outgoings include one-off capital spending, which a
user would not continue if income stopped.

**(c) Zero or negative burn renders `INDEFINITE`**, with the reason stated plainly ("your rental
income currently covers your essential costs"). Never 0 (reads as catastrophe when it means the
opposite), never 12, never 999 — the three values today's producers return.

**Implementation trap recorded:** `INDEFINITE` must not be treated as infinity in downstream
arithmetic. If the health score averages runway months, an infinity or a 999 sentinel silently
distorts it — which is how 999 got there. **The score must handle the state, not a stand-in number.**

**Flagged, not built:** the ~73-month runway assumes rental income continues. It is not riskless.
A stress variant (rental at 50%) would be the honest companion. New scope; not folded in.

## D31 — Net burn uses GROSS flows on both sides

**Decided (Q14 sibling)** *(judgement — no authority governs runway construction):*

`net burn = (personal living costs + property operating costs + all loan costs) − (gross rent +
other salary-independent income)`

**Per-property NET rental does NOT bind here.** It remains valid as its own quantity for judging
property performance — a different question, keeping its own name (D6).

**Why gross on both sides:** every term is a cash movement observable on a bank statement, so nothing
can be double-counted, and it follows D17. The alternative (net rental) is equally consistent **only
if property costs are absent from essential** — and getting that wrong is invisible. **The live risk
is real:** essential currently includes property management $432 and insurance $812; if the rental
figure is net of those same costs they are subtracted twice.

**Fact to establish in Tranche 1, not guess:** the rental figure is $121,227/yr on the Income page
($10,102/mo) but **$121,881 on the Tax page** — a $654 difference, and it is not established which is
gross, which is net, or whether the gap is something else. Consuming the wrong one silently shifts the
runway.

**Accepted consequence:** a cash-flow-negative property now *increases* net burn rather than
disappearing into a net figure. Correct, more honest, and it will make one or two properties look
worse. Covered by the law above.

## D32 — One headline score, re-founded on a published framework

**Decided (Q36-39)** *(grounded — and it reversed the Matrix's own recommendation):*

The Matrix first recommended one headline score on UX grounds. Research reversed the reasoning: the
**CBA–Melbourne Institute Financial Wellbeing Scales**, developed on Australian banking data,
deliberately report **two separate scales** — *Reported* (survey-based) and *Observed* (from banking
data) — as "distinct, yet related", explicitly **not** collapsed into one composite. D13's original
instinct was better founded than the override.

**So:** one headline is still correct, but because **only the Observed scale is computable from
Monitrax's data** — there are no survey responses.

**The headline is re-founded on the Observed scale's published dimensions** — payment problems,
liquid balance frequency, spending patterns, emergency fund access, savings buffer — rather than
remaining a bespoke formula. Four of the five are already computed. **This matters beyond tidiness:
a score built on a validated, published instrument can be explained and defended; a homegrown score
cannot, and for a product that guides money that is a real exposure.**

The canonical producer is already declared in code: `scoreCalculator.ts` states the health score is
the **`generateHealthReport`** value. Reza's current score is **54**.

The other three producers are each assessed against those dimensions and either **map to a dimension
and survive as a named component**, or **retire**. A Phase A determination, not decided here. The
CFO's six already describe themselves as action-signals rather than scores.

**If a survey is ever added, the Reported scale is shown SEPARATELY — never merged.** Merging
subjective and objective measures is exactly the false reconciliation D13 forbids.

**Boundary stated:** the Matrix read the framework's overview, **not** its methodology or licensing.
The algorithm may not be public and using the scale by name may require licence or attribution.
**Recommendation is to align to its dimensions; licensing to be checked properly — a legal question,
not a technical one.**

**Portal snapshot-score label: retired** *(judgement)*. An admin view showing a different number than
the user sees is an unreconcilable fourth answer.

**CFO buffer months: loans count as essential.** Not a decision — `scoreCalculator:210` contradicts
**D4**, which Reza already settled. Enforcement.

**Expect 54 to move** when Tranche 1 lands, because the score consumes income — the figure overstating
by 77%. Predicted with arithmetic before it moves, per §10.

## D33 — The SG rate is re-derived per period, never stored, and capped

**Decided (Q2)** *(grounded):*

**Re-derive on read from the tax-year config, resolved for the ROW'S OWN period. Do not re-stamp.**

The stored `0.115` is not simply wrong — it is the **2024-25** rate. The schedule is 10.5% (2022-23),
11% (2023-24), 11.5% (2024-25), **12% (2025-26 and 2026-27)**. Re-stamping every row to 12% would make
historical rows *newly* wrong. The rate is a legislated constant, not a fact about the user — under D2
it should not be stored at all.

**FACT/DERIVED split:** an actual SG contribution from a payslip or fund statement is a **FACT** —
store it. An estimated SG is **DERIVED** from the period's legislated rate and never stored. Same rule
as net pay in D17.

**Three things the estimate must handle:**
- **The maximum contribution base caps SG.** For 2026-27 it is **$270,830 annually** — and the format
  **changed from quarterly** ($62,500/quarter in 2025-26) **to annual**. Any code carrying a quarterly
  cap is wrong for this year. Without the cap, salary × 12% overstates employer contributions above
  the base.
- **Payday Super commenced 1 July 2026** — employers must pay SG **each payday**, not at least
  quarterly. Annual totals unchanged; contribution *timing* changed.
- **Stale fallbacks are worse than flagged:** `capTracker.ts` falls back to `|| 30000`. That was
  2025-26. The 2026-27 concessional cap is **$32,500**.

**The consequence worth noticing:** SG at the maximum contribution base is 12% × $270,830 =
**$32,499.60** — essentially identical to the $32,500 concessional cap. That is deliberate in the
legislation, and it means **if salary is at or above $270,830, employer SG alone consumes the entire
concessional cap** and any salary sacrifice creates excess contributions.

**Fact needed from Reza:** his approximate **salary** component, separate from rental and other
income. This feeds directly back into D24's growth mode — if salary is near that base, salary
sacrifice is not an available strategy and the mode must not offer one.

---

# The accepted batch (D34–D40)

Presented together as confirmations of patterns already set; accepted as a set.

## D34 — Carry-forward caps: extend to 2021-22, rolling window *(grounded)*

Carry-forward runs **five years**, so 2026-27 accesses **2021-22, 2022-23, 2023-24 ($27,500 each),
2024-25 and 2025-26 ($30,000 each)**. **The question's premise (FY2019-20) was wrong**, and 2021-22
expires after this year. Config starting 2023-24 is short by two recent years.

**Extend to 2021-22 and make the window ROLLING** — a hardcoded start goes stale every July.
Refuse-to-compute is wrong because the missing years are recent, not ancient.

Moot for Reza (carry-forward needs TSB under $500,000 at 30 June; his locked bucket reads ~$3.03M).
This is for other users.

## D35 — PAYG withholding coefficients per FY, in config *(grounded)*

Adopt per-FY coefficient tables with the same discipline as brackets. Currently hardcoded to
**FY24-25** — two years stale, and the **new 15% band from 1 July 2026 changes withholding directly**.

Withholding is a **published schedule, not marginal tax**. It must never be approximated as
annual × a rate — which is what `income/page.tsx` does at **× 0.30**.

## D36 — Yield: engine rent, yield-on-cost named, invented dividend yield deleted *(grounded)*

- Portfolio-average feed reads the **canonical engine rent**. A separate declared feed is a second
  producer.
- **Yield-on-cost keeps its own name and stops being a fallback.** Gross yield = annual rent ÷
  *current value*; yield on cost = annual rent ÷ *purchase price*. Different denominators, different
  quantities. Silent substitution mixes bases.
- **The invented 4%/2% dividend yield is DELETED.** A fabricated number presented as data is the same
  class as the MON-134 health trend. Without real dividend data, show nothing.

## D37 — Break-even: no second producer survives unnamed *(judgement)*

`cashflow/route.ts:237` vs `intelligence/route.ts:509`. Phase A determines whether they compute the
same thing: if yes, one is deleted and the other consumed; if they genuinely differ, both get names.
Expectation is deletion.

## D38 — Investment value: `currentValue` authoritative; cost is not a value *(grounded)*

Not a choice between two value methods — **`units × avgPrice` is COST**, the CGT cost base wearing a
value label. `currentValue` (market) is authoritative when present; cost basis moves to the CGT field.
**When `currentValue` is absent the holding shows as VALUE UNKNOWN**, never substituting cost, which
would understate the holding by its entire capital growth.

## D39 — Refinance costs are itemised; both offered options were wrong *(grounded)*

Real Australian costs: discharge $350–500 · deregistration and registration $130–250 each · title
search $50–100 · application $0–750 · settlement $100–400 · valuation $50–600. **Typical total
$500–$2,000.**

**2% of balance is badly wrong** — $10,000 on a $500k loan, five times the top of the range. **Flat
$1,500 is also wrong**, because it hides the two costs that actually decide a refinance: **LMI** above
80% LVR (thousands) and **break costs** on a fixed loan (potentially large).

**Itemised estimate:** fixed fees as a schedule defaulting inside the $500–$2,000 band, **plus
conditional LMI** when LVR exceeds 80%, **plus a break-cost input** required when the loan is fixed.
Never one magic number.

Reza's portfolio LVR is 41.3%, so no LMI. Fixed-vs-variable status unknown.

## D40 — MON-136 scope confirmed *(confirmation)*

The 23 new quantities from the sweep become register rows. **Names are proposals** and are finalised
in their own contracts.

---

## Still to settle (5)

**17** negative-gearing zero-rental edge + the dormant reform engine · **20** depreciation method
(~4× divergence) · **21** multi-year projection (four producers, fabricated defaults, LLM-invented
projections) · **22** the dead forecast stack · **25** insurance adequacy.

**Phase B writes nothing until all 28 are settled.**

---
*Recorded by The Matrix, 30 July 2026. Verified in session for this part: ASIC Moneysmart emergency
fund target · CBA–Melbourne Institute Financial Wellbeing Scales structure · ATO super guarantee rate
schedule, maximum contribution base and Payday Super commencement · ATO carry-forward five-year window
and TSB test · Australian refinancing cost itemisation.*
