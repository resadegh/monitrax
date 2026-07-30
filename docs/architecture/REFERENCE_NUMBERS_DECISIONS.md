# REFERENCE NUMBERS — the consolidated decisions register (D17–D41)

> **The Phase A gate decisions, consolidated.** One entry per decision, faithful to the session
> logs — the logs are the record of *reasoning* (`docs/architecture/decisions/
> DECISION_SESSION_2026-07-30{,_part2,_part3}.md` + `D41_AMENDMENT_ng-cgt-reform-2027.md`);
> this file is the register Phase B briefs cite. Where they could ever disagree, the session logs
> win. All rows also fold into `REFERENCE_NUMBERS_DESIGN.md` §6 (the living register D1→).
>
> **Provenance note (§21.2.2):** assembled in-repo from the four committed session logs. A
> session-local draft of this file existed only in the Matrix's sandbox and never landed — the
> rule that nothing lives outside the repo is why this consolidation exists.

**Session:** 30 July 2026, at `4e6cdd5c` (the Phase A inventory merge). Every decision is
**Reza's**, made live; Matrix recommendations that were changed or rejected are recorded as such.
**Settled: 23 of the inventory's 28 §5.1 decisions, plus the D41 reform amendment. Open: 5 —
Phase B writes nothing until all 28 are settled.**

---

## THE LAW — real numbers, regardless of how they look

> **Reza, 30 July 2026:** *"I don't care how it makes them look — we need to produce real numbers
> and facts for the users."*

The presentation-side twin of *never fix a number*: no figure is softened, floored, defaulted or
omitted because the honest value is unflattering. Applies to negative equity (D26), properties
that increase net burn (D31), and every score that moves when its inputs are corrected.

**Also adopted, Reza's instruction:** every Matrix recommendation is labelled **grounded** (with
its source) or **judgement** (with the reasoning), researched through primary channels, never
asserted from memory. The first application reversed one of the Matrix's own opinions (D32).

---

## The decisions

### D17 — Income means what reaches the bank *(supersedes D9)*
ONE canonical income quantity: **cash actually received**. Withholding (including HELP/HECS from
1 July 2026 — marginal system, $69,528 threshold) is derived and removed on gross entry; a
payslip's actual net pay is a **FACT and wins**; rental, dividends and distributions count **as
received, untaxed**; year-end tax lives **only in the tax engine** as a labelled estimate.
**Not named "net income"** — banked/received income (after-tax is what that phrase means
everywhere else). No second income quantity unless a serviceability feature ever demands one.
**Rejected:** the Matrix's after-tax-across-all-sources Option A (double-counts the tax
liability; unverifiable against anything the user can see; smuggles a range into a number).
PAYG instalments: gross rent IS instalment income and Reza clears the entry triggers, but **Reza
states tax settles at year-end** — no instalment outflow modelled; re-raise if activity
statements arrive.

### D18 — Savings rate: principal repayment is saving, not spending
`savings rate = (banked income − interest − other spending) ÷ banked income`. Principal converts
cash to equity — a balance-sheet movement (D8 applied). Established: of the $12,779/mo loan cost,
**$3,709 is pure interest** (VR-041); the P&I split of the remaining ~$9,070 is **NOT
established** — derive per loan in Tranche 2, never guess. **The surface must say** principal
repayments are counted as saving, or an unfairly harsh number becomes a quietly flattering one.

### D19 — Unassigned entity rows default to personal, with provenance retained
No "Unassigned" UI bucket. **Guard (not optional):** an assigned attribution is a **FACT**; a
defaulted one is **DERIVED** — stored distinctly (D1), with entity tax views disclosing *"N of M
rows attributed by default"* (ATO: attribution follows **legal interest**; private agreements
don't override it). **Invariant, permanent test: entity slices sum to the total** — today unowned
cashflow rows vanish from every slice (net worth already reconciles:
$2,651,781.52 + $750,000 = $3,401,781.52). Proportional ownership flagged, not folded in.

### D20 — Calc engines split by source, in three layers
**L1 source engines** (salary · rental · dividends · business distributions incl. PSI) — only
where a source has rules of its own; each computes a banked amount and nothing else. **L2
aggregator** — pure summation; *sources must sum to the total* (invariant). **L3 tax engine** —
tax computed **once, on the aggregate, never per source** (per-source tax destroys negative
gearing and mis-rates the margin). Banked income and taxable income are **two named quantities on
two bases, never equal** (D6). Frequency conversion stays shared — every engine calls the one
`monthlyRunRate`.

### D21 — Loan monthly interest is net of offset
Canonical interest = interest on (balance − offset) — what the bank charges (D17), what is
**deductible** (incurred), and what the linked actuals already show ($1,191 and $2,518). Gross
survives **only as a named scenario input** ("if the offset were withdrawn"). Contract notes:
**offset ≠ redraw** (a private-purpose redraw permanently splits deductibility — ATO
apportionment of all future interest AND principal); **deductibility follows use, not
security** — the engine takes a deductible-portion input.

### D22 — Committed and Essential are two named quantities
**`monthlyCommitted`** = ALL recurring non-loan expenses + canonical loan cost. **`monthlyEssential`**
= non-discretionary recurring + loan cost — used **only** in the survival runway (D3/D4). The two
collapsed axes (fixed-vs-variable, essential-vs-discretionary) are orthogonal — treating one as a
proxy for the other produced MON-024's "906% discretionary". On current data **both give
$14,261** — the coincidence-of-data trap, recorded as such. Dependency: the runway needs a
trustworthy discretionary flag whose **basis is defined in the contract**.

### D23 — One budget-variance producer, four tiers, shared with the AI
One survivor: delete V1 (no consumer) and V4's dead exports; **fold V4's four-tier scale in**
(a warning tier is a control, not a report card); **fix V3's input shape** (its "budget" side is
blob metadata keys — `generatorVersion`, `committedTotal` — not categories); **point V2 at the
survivor** so Gemini and the screen read the same number (today the AI is advised on a different
figure than the user sees). Thresholds/target deferred to D24 by design. The tile stays
meaningless until Tranche 7 — silencing it was offered, not taken up.

### D24 — The budget remainder, on two bases *(amended by D41)*
**Build it (MON-127) as two named quantities:** **planning remainder** = banked income −
committed; **actual remainder** = banked income − trailing-12 outgoings — both shown, the gap
named (committed $14,261 vs actual $25,973 ⇒ ~**$11,712/mo of real non-recurring spend**).
Indicative, not committed: banked ≈ $24,250/mo, remainder ≈ $10,000/mo (the tool says $4,442;
an earlier $27,042 rode the inflated $41,303 income — both wrong). **Allocation modes are
strategies computed from the actual position** (security-weighted · balanced · growth-weighted),
never fixed percentages. **Growth mode blocked on two facts from Reza:** total super balance
(locked bucket reads ~$3.03M → carry-forward AND bring-forward likely unavailable; 2026-27
concessional cap **$32,500** incl. SG) and **Division 293** exposure ($250,000 threshold, adds
back net rental/investment losses — the $145,426 taxable figure is not the relevant income).
**Compliance flag:** modes are framed as scenarios-with-consequences, never recommendations.
**D41:** growth-mode scenarios must use the regime applying in the projected period.

### D25 — The ABS benchmark is relabelled, and its provenance is challenged
Relabel **all four surfaces together** as "typical for a household your size" — never "your
budget", never a default, never a variance target. **Display vintage + source.** The hardcoded
per-person figures ($400/adult…) attributed to "ABS 2023-24" **do not reconcile with any current
ABS series** (the current series is the Monthly Household Spending Indicator — aggregate, not
per-person). **Verify provenance before republishing; if it fails, drop the figures** rather than
restate an unearned citation (D12 applied to an external constant). D24's remainder replaces what
those surfaces lose.

### D26 — Property equity: attached loans; the RENTAL type is split *(amended by D41)*
**(a)** Subtrahend = loans **ATTACHED** to the property (attachment is the encumbrance;
classification is a category). **FULL balance, not net-of-offset** — deliberately different from
D21 (offset cash is already in liquid, D5/D29 — netting twice counts the money twice); write the
asymmetry into the contract so nobody "fixes" it. **(b) RENTAL is two incompatible things:**
owned-and-rented-out (asset — **D10 stands**) vs a home rented as a tenant (a rent expense, not a
property row). Until the data splits, **flag rows for Reza — don't guess**. **Negative equity is
never floored.** **(c)** The split **carries the owning entity** — CGT discount is
entity-dependent (50% individual/trust · 33⅓% complying super · **NIL companies** — Renew Group
Holding is a Pty Ltd), which makes **D26 a precondition for the CGT work** (R1 already applies
50% with no 12-month check; an entity-blind path is worse). CGT event = **contract date**, not
settlement. **Fact needed:** any loan secured over more than one property?

### D27 — Accessible funds at market; MANAGED_FUND counts by redemption term
Shares and managed funds at **market value** (cost is irrelevant to accessibility). The bucket is
defined by **redemption term** (~30 days without penalty): listed ETFs in; unlisted funds with
redemption windows and the SMSF → locked. **Cost basis stays stored as a FACT for CGT** — two
values, one asset, different jobs. Realising-triggers-CGT is a page note; the tax stays in the
tax engine (D17 discipline).

### D28 — `breakdown.liquidAssets` is renamed AND derived, not re-founded
`computeLiquidCash` stays canonical (D5). `metricAggregation.ts:129` is **renamed to realisable
assets and derived as liquid + accessible** — a consumer of the two canonical buckets. It stops
computing and starts reading; **the producer count drops** rather than the problem being renamed.

### D29 — Cash tile: net of oscillating accounts, gross of credit cards
Grounded in **AASB 107 / IAS 7.8**: an overdraft is negative cash only where repayable on demand
AND integral to cash management — the test is that the balance **oscillates**. Transaction and
offset accounts net (including overdrawn); **credit cards never net** (owed-or-nil = financing;
they appear as short-term liabilities). A genuine cash-management overdraft can be flagged if one
ever exists — not built speculatively. Expect the figure between today's two extremes.

### D30 — The runway is two named quantities; zero burn renders INDEFINITE
**Producer: a pure engine + Decimal twin** — never inside the master assembler (formulas in
assemblers are the pattern this programme kills, and they can't be tested without a DB).
**The 6-month target is retired.** Two quantities: **emergency-fund months** = liquid ÷ essential
($301,808 ÷ $14,261 ≈ **21 mo** — comparable to **ASIC Moneysmart's THREE-month** benchmark, the
app's "6" had no basis) and **survival runway** = liquid ÷ net burn (≈ **73 mo**, banded in its
own units). The rendered **11.6** (liquid ÷ total outgoings $25,973) is a third basis — **retire
it** (total outgoings include one-off capital spend a user wouldn't continue). **Zero/negative
burn → `INDEFINITE`** with the reason stated — never 0, 12 or 999. **Trap recorded:** INDEFINITE
is a state, not a number — downstream scores handle the state, never a stand-in. Stress variant
(rental at 50%) flagged as new scope.

### D31 — Net burn uses GROSS flows on both sides *(judgement)*
`net burn = (personal living + property operating + all loan costs) − (gross rent + other
salary-independent income)`. Every term is bank-observable, so nothing double-counts — the live
risk was real: essential already carries property management $432 + insurance $812; a net-rental
feed would subtract them twice. Per-property NET rental stays its own quantity (D6).
**Tranche-1 fact to establish, not guess:** rental is $121,227/yr on the Income page but
$121,881 on the Tax page — which is gross? **Accepted:** a cash-negative property now raises
burn (covered by the LAW).

### D32 — One headline score, re-founded on a published framework *(grounded — reversed the Matrix's own first recommendation)*
The **CBA–Melbourne Institute Financial Wellbeing Scales** report *Reported* and *Observed* as
two scales, deliberately never merged — vindicating D13's instinct. One headline is still right,
but only because **only the Observed scale is computable from Monitrax's data**. The headline is
**re-founded on the Observed scale's published dimensions** (payment problems · liquid balance
frequency · spending patterns · emergency access · savings buffer — four of five already
computed): a validated instrument can be explained and defended; a homegrown score cannot.
Canonical producer: **`generateHealthReport`** (code already declares it; Reza's score **54**,
**expected to move** when Tranche 1 fixes the income it consumes — predicted with arithmetic
first, per §10). The other three producers **map to a dimension or retire** (Phase A
determination). A future survey scale is shown **separately, never merged**. **Portal
snapshot-score label: retired.** **CFO buffer months: loans count as essential** — not a
decision, enforcement of D4 against `scoreCalculator:210`. **Boundary:** framework methodology +
licensing not read — licensing is a legal check before shipping the name.

### D33 — The SG rate is re-derived per period, never stored, and capped *(grounded)*
**Re-derive on read from config, resolved for the ROW'S OWN period — never re-stamp** (0.115 was
*correct* for 2024-25; the schedule is 10.5 → 11 → 11.5 → **12% for 2025-26 and 2026-27**;
re-stamping history makes old rows newly wrong; under D2 a legislated rate is never stored).
Actual SG from a payslip/fund statement = FACT, stored. Estimated SG = DERIVED, never stored.
The estimate must: apply the **maximum contribution base** (2026-27: **$270,830 ANNUAL** — the
format changed from quarterly; any quarterly-cap code is wrong this year), know **Payday Super**
(from 1 Jul 2026, SG per payday), and kill the **`||30000` fallback** (2026-27 cap **$32,500**).
Noticed: SG at the base = $32,499.60 ≈ the entire concessional cap — at/above $270,830 salary,
sacrifice creates excess contributions. **Fact needed: Reza's salary component** (feeds D24's
growth mode).

### D34–D40 — the accepted batch *(patterns already set, accepted as a set)*
- **D34 Carry-forward caps** *(grounded)*: extend config to **2021-22**, window is **ROLLING**
  five years (2026-27 accesses 2021-22…2025-26 — the question's FY2019-20 premise was wrong;
  2021-22 expires after this year). Refuse-to-compute is wrong here. Moot for Reza (TSB test);
  built for other users.
- **D35 PAYG coefficients** *(grounded)*: per-FY tables in config, bracket discipline. Currently
  FY24-25 — two years stale; the **15% band from 1 Jul 2026 changes withholding directly**.
  Never annual × rate (`income/page.tsx` × 0.30).
- **D36 Yield** *(grounded)*: portfolio-average reads **canonical engine rent**; **yield-on-cost
  is its own named quantity**, never a silent fallback (different denominator); the **invented
  4%/2% dividend yield is DELETED** — a fabricated number presented as data is the MON-134 class.
- **D37 Break-even** *(judgement)*: no second producer survives unnamed — Phase A determines
  same (delete one) or different (name both); expectation: deletion.
- **D38 Investment value** *(grounded)*: **`currentValue` (market) is authoritative**;
  `units × avgPrice` is **COST** — the CGT cost base wearing a value label; absent market value
  renders **VALUE UNKNOWN**, never cost-as-value.
- **D39 Refinance costs** *(grounded)*: **itemised** — fixed-fee schedule defaulting inside the
  real **$500–$2,000** band + **conditional LMI** above 80% LVR + a **required break-cost input**
  on fixed loans. Both prior models were wrong (2% = 5× the top of the range; flat $1,500 hides
  the two costs that decide a refinance). Reza's LVR 41.3% → no LMI; fixed-vs-variable unknown.
- **D40 MON-136 scope** *(confirmation)*: the 23 sweep quantities become register rows; names
  are proposals, finalised in their own contracts.

### D41 — AMENDMENT: the NG/CGT reform (announced 12 May 2026, commences 1 July 2027)
Raised by Reza (post-cutoff for the Matrix; verified against ATO guidance + two law-firm
analyses; Reza's 1-July-2026 commencement framing corrected — 12 May 2026 is the
announcement/grandfathering cut-off). **NG:** dwellings acquired after 7:30pm AEST 12 May 2026
lose negative gearing from 1 Jul 2027 — losses **quarantine to residential-rental assessable
income**; prior acquisitions grandfathered; **new builds exempt**. **CGT:** deemed disposal +
reacquisition 1 Jul 2027; **50% discount → cost-base indexation + a 30% minimum rate** for
resident individuals/partnerships/trusts; **companies, super funds, life insurers, foreign and
temporary residents EXCLUDED** (keep current treatment); pre-CGT assets **lose pre-CGT status**.
**Amendments:** D26's discount table holds only to 30 Jun 2027 — **the CGT engine needs a TIME
dimension, not just entity**; inventory decision 17's engine-park gains a **hard deadline
(1 Jul 2027)** with both producers staying censused, and its inputs grow (acquisition date vs the
cut-off, new-build status, quarantining logic); D24's growth mode uses the projected period's
regime. **The architectural consequence — D12 is extended: the config carries per-period RULES,
not merely per-period values** (regime versioning; the D33 discipline generalised from rates to
methods) — this lands in the contracts NOW, not mid-Tranche-4. **For Reza (established):** Renew
Group Holding (company) and the SMSF sit outside the new regime; pre-12-May-2026 properties are
NG-grandfathered; personally-held post-2027 gains face indexation + the floor. **Not verified:**
the accrued-gain apportionment mechanics across the deemed disposal — established before the CGT
tranche builds the transition, never inferred.

---

## Supersessions and refinements of D1–D16

| Earlier | Changed by | How |
|---|---|---|
| **D9** (net = after-tax across all sources, or rename) | **D17** | **SUPERSEDED** — income is banked/received cash; no after-tax income quantity exists; the rename branch won |
| **D10** (equity includes RENTAL) | **D26** | **REFINED** — stands for owned-and-rented-out; the RENTAL type splits, tenanted residences become an expense |
| **D12** (constants from config) | **D33 + D41** | **EXTENDED** — resolved per the row's own period (D33); config carries per-period RULES/regimes, not just values (D41) |
| **D3/D4** (runway definition) | **D30/D31** | **REFINED** — two named quantities; 6-month target retired; INDEFINITE state; net burn on gross flows both sides |

## Still open — 5 of 28 (Phase B remains blocked)

| Inventory §5.1 # | Question | Note |
|---|---|---|
| 17 | Negative gearing zero-rental edge (CFO vs tax page) | The dormant-engine half now carries D41's hard park deadline (1 Jul 2027, both producers censused); the edge semantics remain OPEN |
| 20 | Depreciation METHOD default (~4× divergence) | |
| 21 | Multi-year projection survivor (4 producers incl. LLM-invented; fabricated defaults) | |
| 22 | The dead forecast stack (CFE/stress/insights/strategies) | |
| 25 | Insurance adequacy — build or remove the hardcoded 70 | |

## Facts requested from Reza (asked, never assumed)

1. **Total super balance** (D24 — carry-forward + bring-forward eligibility).
2. **Division 293 exposure** basis (D24).
3. **Salary component** separate from rental/other income (D33 — decides whether salary sacrifice
   is even offerable).
4. **Cross-collateralised loans?** (D26 — per-property allocation rule would be asked for, not
   invented.)
5. **D41 trio:** any property acquired after 7:30pm 12 May 2026 · any pre-20-Sep-1985 · any
   new build?

---
*Consolidated 2026-07-30 from the four Matrix session logs at `matrix/decision-session-2026-07-30`.
The logs carry the full reasoning and in-session source verifications; this register carries the
rulings. Folded into `REFERENCE_NUMBERS_DESIGN.md` §6 in the same PR.*
