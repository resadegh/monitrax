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
discovered. Everything below is verbatim-faithful to the brief; nothing is invented.

**Gap 1 — the decisions register (§6) — NOW CLOSED.** The reconstruction could only recover the
decisions the brief happened to cite (D3, D4, D5, D8–D13). **D1, D2, D6, D7 and D14 were supplied
by the Matrix from its original register on 2026-07-29** and are recorded below with their original
owner and date. The register is now complete; nothing in §6 is a guess.

**Gap 2 — MON-115…124 remain a ten-id ledger gap.** The ids are reserved in the Matrix ledger;
their definitions were destroyed when a sandbox clone was clobbered and survive only as prose in
`docs/verification/runs/VR-040.md`. Seven of the ten were subsequently **demoted to observations**
under the holistic-verification law (an untraced cross-surface difference is not a finding), so
they are re-filed only after re-tracing — not restored wholesale. `VR-040.md` itself is still
uncommitted. The Matrix's reconciliation PR owns: executing `scripts/matrix/vr038-039-advance.mjs`
+ `vr038-039-promote.mjs` (merged in #1521, still unexecuted — MON-104…110 read FIXING despite
VR-038/039) and registering MON-127…133 in pinned order via
`scripts/matrix/registry-reconcile.mjs`. Both #1521 scripts are idempotent and were dry-validated
end-to-end on 2026-07-29 (they apply cleanly: 104…110 → VERIFIED, 105…110 → CLOSED, 104 HELD,
112/113/114 raised, gates green at 116 issues).

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
| **−1b** | The Matrix Relay — admin-side capture endpoints so the baseline runs without a terminal | — | NO |
| **0** | Enforcement: `census:producers` ratchet, source-lock → `lib/`, `REFERENCE_NUMBERS.md` | MON-131 (opens) | NO — ships alone, first |
| **1** | Income | MON-128 | YES |
| **2** | Loan cost | MON-130 | YES |
| **3** | Expense run-rate | MON-129 | YES |
| **4** | Tax-domain constants + depreciation (D11, D12) | MON-133, (MON-073/117 class) | YES |
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
  **⛔ STATED PRECONDITION — MON-135 (LANDED 2026-07-30, PR-1 of the tranche sequence): the AI
  categoriser stamped `isRecurring: false` unconditionally on every prediction; composed with
  T3's strict `=== false` gate that would have zeroed every AI-categorised expense at once, and
  the golden baseline would have absorbed the loss inside T3's legitimate expected downward
  moves. Fixed at the producer: predictions now carry `null` (no determination), recurrence is
  set `true` only from learned recurring-pattern evidence, and the tri-state is pinned by the
  Wall-B2 fixtures (Float + Decimal). T3 MUST NOT merge before the MON-135 PR is merged +
  Ring-3-verified (expenses screen unchanged).**
- **T4:** D11 depreciation rate-unit contract (the `cost×(rate/100)×2` vs `cost×rate×2` 100× trap —
  `properties/[id]/depreciation/page.tsx:194` vs `reports/contextBuilder.ts:521`); D12 every
  legislated constant from `TAX_YEAR_CONFIGS` (`what-if/[lever]/page.tsx:422` hardcodes `30000` +
  `0.12`; `income/page.tsx:356` invents PAYG as `annual × 0.30`; `lib/wealthCheck/lever.ts:88` has
  its own `CONCESSIONAL_CAP_ANNUAL`; `EntityCashflowSummary.tsx:693` hardcodes `0.37`).
  **MON-133 is this tranche's registry issue** — ~35 hardcoded legislated constants across ~12
  files, including a **stale Super Guarantee rate of 11.5%** at `income/page.tsx:566` and
  `savingOpportunities.ts:162` when the legislated rate is **12%**.
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

| Id | Decision | Owner | Date | Status |
|---|---|---|---|---|
| D1 | Numbers classify as **FACT** or **DERIVED**; facts stored once, derived computed once | Reza | 29 Jul | ✅ **DECIDED** |
| D2 | Do **not** store derived values in a table; snapshots for audit only | Matrix (Reza delegated design) | 29 Jul | ✅ **DECIDED** |
| D3 | **Emergency fund = survival runway**: `liquid cash / (essential expenses − salary-independent income)`. Must read *"if you lose your salary income, how long you can survive"* **on the page** | Reza | 29 Jul | ✅ **DECIDED** |
| D4 | **Loan repayments ARE essential** in D3. essential = $1,482 bills + $12,779 loans = $14,261/mo. Burn = −rental ~$10,102 = ~$4,159/mo → **~72 months** (vs 11.6 shown) | Reza | 29 Jul | ✅ **DECIDED** |
| D5 | **Liquid = cash equivalents only** (AASB 107). Shares/ETFs a separate labelled line; **SMSF assets excluded from both** (preserved, not merely illiquid). `metricAggregation.ts:129` "liquid incl. shares" is the *other named quantity*, not a bug to delete | Matrix (adviser lens) | 29 Jul | ✅ **RECOMMENDED** |
| D6 | Collapse to **named** quantities, not one scalar (§3.1) — index the definition (semantic, basis, window, inclusions), not just the function name | Reza confirmed | 29 Jul | ✅ **DECIDED** |
| D7 | Tranche 0 (enforcement) **ships first and alone**, and moves no numbers | Matrix | 29 Jul | ✅ **DECIDED** |
| D8 | Cashflow subtracts the **full** loan repayment (cash is cash), but the principal portion is labelled **"wealth transfer, not spending"** (interest = expense; principal = balance-sheet movement). Affects the headline −$6,073/mo | Reza delegated → Matrix | 29 Jul | ✅ **DECIDED** |
| D9 | Income "net" becomes after-tax across **all** sources, or the field is renamed — net may never exceed gross | Matrix (adviser lens) | 29 Jul | ↩️ **SUPERSEDED by D17** (30 Jul — income = banked/received cash; the rename branch won; no after-tax income quantity exists) |
| D10 | Portfolio equity **includes** RENTAL properties; `properties/page.tsx:494` excluding them is a bug, not a definition | Matrix (adviser lens) | 29 Jul | ✅ **REFINED by D26** (stands for owned-and-rented-out; the RENTAL type splits — tenanted residences become a rent expense) |
| D11 | Depreciation collapses to ONE producer with an explicit **rate-unit contract stated in the type** (percentage vs fraction — the MON-026 100× class) | Matrix | 29 Jul | ✅ **RECOMMENDED** |
| D12 | Every legislated constant (caps, SG rate, thresholds, marginal rates) reads from `TAX_YEAR_CONFIGS` — **never typed into a page or component** | Matrix | 29 Jul | ✅ **EXTENDED by D33 + D41** (resolved per the row's own period; config carries per-period RULES/regimes, not merely values) |
| D13 | The four health scores (`aggregateEngine`, `masterFinancialService:1434`, `healthScoreAggregator`, `safetyScore`) are **four different questions** — name them separately; do not reconcile to one number | Matrix | 29 Jul | ✅ **RECOMMENDED** |
| D14 | The fix is executed by **dedicated agents per calc engine**, partitioned by **FILE ownership** (never by quantity — files host many quantities and would collide). Phase A specs → **Reza gate** → Phase B migration → Phase C adversarial verification (§9) | Reza | 29 Jul | ✅ **DECIDED** |
| D15 | The health-score trend is built from **stored monthly snapshots of the real score** (`HealthScoreSnapshot`, the `netWorthHistory` audit-snapshot pattern §3.2), **never generated**. Where history is insufficient (<2 snapshots) the UI says so (`INSUFFICIENT_HISTORY`) rather than showing a number — no `changePercent`, no `'STABLE'` fallback. Snapshots carry the formula version; a trend spanning a version change shows the break, never smooths over it. (*"let's score monthly based on a real number and formula. not invention."* — MON-134) | Reza | 29 Jul | ✅ **DECIDED** |

| D16 | The reference-number law applies to **every** number in the app; **nothing is out of scope.** Remediation is sequenced — MON-131's quantities first, fully verified, then **MON-136** for the remainder, then a **complete Matrix sweep**. No unrelated issue is worked before that sweep passes. (*"I want to cover all numbers. nothing is out of scope … a complete and full sweep by the Matrix … before we move to fixing any other issues."*) | Reza | 29 Jul | ✅ **DECIDED** |
| **LAW** | **Real numbers, regardless of how they look** (*"I don't care how it makes them look — we need to produce real numbers and facts for the users."*). No figure softened, floored, defaulted or omitted because the honest value is unflattering. Also adopted: every Matrix recommendation labelled **grounded** (source) or **judgement** (reasoning), researched through primary channels, never memory | Reza | 30 Jul | ⚖️ **STANDING LAW** |
| D17 | **Income = cash actually received (banked)** — ONE canonical income quantity. Withholding (incl. HELP from 1 Jul 2026) derived + removed on gross entry; payslip net pay is a FACT and wins; rental/dividends/distributions count as received, untaxed; year-end tax lives ONLY in the tax engine as a labelled estimate. Named banked/received income, never "net income". Supersedes D9. PAYG instalments: settles at year-end per Reza's stated fact; re-raise if activity statements arrive | Reza | 30 Jul | ✅ **DECIDED** |
| D18 | **Savings rate = (banked income − interest − other spending) ÷ banked income; principal repayment counts as SAVING** (D8 applied). $3,709/mo of the $12,779 loan cost is pure interest (VR-041); the rest's P&I split NOT established — derive per loan in Tranche 2. Surface must state the principal-as-saving convention | Reza | 30 Jul | ✅ **DECIDED** |
| D19 | **Unassigned entity rows default to personal** — no Unassigned UI bucket; assigned = FACT vs assumed = DERIVED stored distinctly; entity tax views disclose "N of M attributed by default" (ATO: legal interest governs). Permanent invariant: entity slices sum to the total | Reza | 30 Jul | ✅ **DECIDED** |
| D20 | **Engines split by income source, three layers**: L1 source engines (only where a source has own rules), L2 pure-sum aggregator (sources-sum-to-total invariant), L3 tax computed ONCE on the aggregate — never per source. Banked vs taxable income: two named quantities, never equal. Frequency conversion stays shared (`monthlyRunRate`) | Reza | 30 Jul | ✅ **DECIDED** |
| D21 | **Loan interest is NET of offset** (what the bank charges; the deductible amount; matches linked actuals). Gross only as a named scenario input. Contract notes: offset ≠ redraw (ATO permanent apportionment); deductibility follows use — deductible-portion input | Reza | 30 Jul | ✅ **DECIDED** |
| D22 | **`monthlyCommitted` (ALL recurring + loan cost) and `monthlyEssential` (non-discretionary recurring + loan cost, runway-only) are TWO quantities** — the axes are orthogonal (MON-024). Both = $14,261 today: coincidence-of-data, recorded as such. Runway depends on a contract-defined discretionary flag | Reza | 30 Jul | ✅ **DECIDED** |
| D23 | **Budget variance: ONE producer, four tiers, shared with the AI** — delete V1 + V4 dead exports, fold in V4's four-tier scale, fix V3's blob-metadata input, point V2 (Gemini) at the survivor so AI and screen read one number. Thresholds deferred to D24 | Reza | 30 Jul | ✅ **DECIDED** |
| D24 | **Budget remainder: BUILD (MON-127) as planning remainder (banked − committed) AND actual remainder (banked − trailing-12 outgoings)**, both shown, gap named (~$11,712/mo). Allocation modes = strategies from the actual position, framed as scenarios-with-consequences (compliance flag). Growth mode blocked on: TSB + Div-293 facts from Reza. Amended by D41 (projected-period regime) | Reza | 30 Jul | ✅ **DECIDED** |
| D25 | **ABS benchmark relabelled on all four surfaces** ("typical for a household your size", vintage + source displayed) — and **provenance verified before republishing**: the "ABS 2023-24" per-person attribution does not reconcile with any current ABS series; if it fails, DROP the figures (D12 applied to an external constant) | Reza | 30 Jul | ✅ **DECIDED** |
| D26 | **Property equity: subtrahend = ATTACHED loans at FULL balance** (not net-of-offset — offset already counted in liquid; deliberate asymmetry vs D21, written into the contract). **RENTAL type SPLIT**: owned-and-rented-out = asset (D10 stands) vs tenanted residence = rent expense; flag rows for Reza, don't guess. **Negative equity never floored.** Split carries the OWNING ENTITY (CGT discount entity-dependent: 50/33⅓/NIL) → **precondition for the CGT work**; CGT event = contract date. Amended by D41 (time+entity). Fact needed: cross-collateralised loans? | Reza | 30 Jul | ✅ **DECIDED** |
| D27 | **Accessible funds at MARKET; MANAGED_FUND counts by redemption term** (~30 days no-penalty; unlisted windows + SMSF → locked). Cost basis stays a stored FACT for CGT. Realising-triggers-tax = page note; tax stays in the tax engine | Reza | 30 Jul | ✅ **DECIDED** |
| D28 | **`breakdown.liquidAssets` → renamed "realisable assets" AND derived as liquid + accessible** — a consumer of the two canonical buckets, not a third producer. Producer count drops | Reza | 30 Jul | ✅ **DECIDED** |
| D29 | **Cash tile: NET of oscillating accounts (incl. overdrawn), GROSS of credit cards** (AASB 107/IAS 7.8 — cards don't oscillate → financing, shown as short-term liabilities) | Reza | 30 Jul | ✅ **DECIDED** |
| D30 | **Runway = TWO quantities in a pure engine + Decimal twin (never in the assembler); 6-month target RETIRED; zero/negative burn renders INDEFINITE** — emergency-fund months = liquid ÷ essential (≈21 mo; ASIC Moneysmart benchmark is 3 months) and survival runway = liquid ÷ net burn (≈73 mo, own bands). The rendered 11.6 (÷ total outgoings) is a third basis — retired. INDEFINITE is a state, not a number — downstream scores handle it. Rental-at-50% stress variant flagged, not built | Reza | 30 Jul | ✅ **DECIDED** |
| D31 | **Net burn = GROSS flows both sides**: (living + property operating + all loan costs) − (gross rent + other salary-independent income) — bank-observable terms, kills the double-subtraction risk (mgmt $432 + insurance $812 already in essential). Per-property NET stays its own quantity. Tranche-1 fact: Income page $121,227 vs Tax page $121,881 rental — establish which is gross | Reza (judgement) | 30 Jul | ✅ **DECIDED** |
| D32 | **ONE headline score, re-founded on the CBA–Melbourne Institute OBSERVED scale dimensions** (only scale computable from Monitrax data; validated instrument > homegrown formula). Canonical producer `generateHealthReport` (54 today — expected to move with Tranche 1, predicted with arithmetic first). Other three producers map-to-dimension-or-retire (Phase A determination). Survey scale, if ever, shown SEPARATELY. Portal snapshot-score label RETIRED. CFO buffer: loans essential (D4 enforcement vs `scoreCalculator:210`). Framework licensing = legal check | Reza (grounded) | 30 Jul | ✅ **DECIDED** |
| D33 | **SG rate re-derived per the ROW'S OWN period from config — never stored, never re-stamped** (0.115 was correct FOR 2024-25; 12% from 2025-26). Payslip SG = FACT; estimated SG = DERIVED, never stored. Estimate applies the maximum contribution base (2026-27: $270,830 ANNUAL — format changed from quarterly), knows Payday Super (1 Jul 2026), kills the `\|\|30000` fallback (2026-27 cap $32,500; SG at the base ≈ the whole cap). Fact needed: Reza's salary component | Reza | 30 Jul | ✅ **DECIDED** |
| D34 | **Carry-forward caps: config extended to 2021-22, ROLLING 5-year window** (2026-27 accesses 2021-22…2025-26; the FY2019-20 premise was wrong; refuse-to-compute wrong — the missing years are recent) | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D35 | **PAYG withholding coefficients per-FY in config**, bracket discipline (FY24-25 hardcoded today — two years stale; the 15% band from 1 Jul 2026 changes withholding). Never annual × rate | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D36 | **Yield: portfolio-average reads canonical engine rent; yield-on-cost = own named quantity, never a silent fallback; the invented 4%/2% dividend yield DELETED** (MON-134 class — no real data, show nothing) | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D37 | **Break-even: no second producer survives unnamed** — Phase A determines delete-one vs name-both; expectation deletion | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D38 | **Investment value: `currentValue` (market) authoritative; `units × avgPrice` is COST (CGT basis), never a value; absent market → VALUE UNKNOWN, never cost-as-value** | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D39 | **Refinance costs ITEMISED**: fixed-fee schedule defaulting in the real $500–$2,000 band + conditional LMI (>80% LVR) + required break-cost input on fixed loans. Both prior models (flat $1,500; 2%-of-balance) were wrong | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D40 | **MON-136 scope confirmed** — the 23 sweep quantities become register rows; names are proposals finalised in their contracts | Reza (batch) | 30 Jul | ✅ **DECIDED** |
| D41 | **AMENDMENT — NG/CGT reform (announced 12 May 2026 7:30pm AEST, commences 1 Jul 2027):** NG quarantined to residential-rental income for post-cut-off acquisitions (new builds exempt, prior grandfathered); CGT deemed disposal 1 Jul 2027, 50% discount → indexation + 30% minimum rate for resident individuals/partnerships/trusts; companies + super EXCLUDED (keep current treatment); pre-CGT assets lose status. Amends D26 (TIME+entity dimension), the decision-17 engine park (hard deadline 1 Jul 2027, producers stay censused), D24 (projected-period regime). **Extends D12: config carries per-period RULES, not merely values (regime versioning) — lands in the contracts NOW.** Accrued-gain apportionment mechanics NOT verified — establish before the CGT tranche | Reza raised · Matrix verified | 30 Jul | ✅ **DECIDED** |

**Session record:** `docs/architecture/decisions/DECISION_SESSION_2026-07-30{,_part2,_part3}.md` + `D41_AMENDMENT_ng-cgt-reform-2027.md` (the reasoning); consolidated register: `REFERENCE_NUMBERS_DECISIONS.md`. **Still open — 5 of the inventory's 28 (Phase B blocked):** #17 NG zero-rental edge (the engine-park half carries D41's deadline) · #20 depreciation method · #21 multi-year projection · #22 dead forecast stack · #25 insurance adequacy.

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

## §9 The agent model (two-phase, brief §10 — decision D14)

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

The CLI requires `DATABASE_URL` and therefore a terminal that can reach Cloud SQL. **Tranche −1b
(the Matrix Relay) moves the same capture behind admin-only API routes** so the Matrix can run it
over an authenticated browser session — see
`docs/issues/handoffs/CODE_BRIEF_MON-131_matrix-relay.md`.

## §11 Definition of done (brief §11.5)

- Census: **23 quantities, 23 canonical producers** (+ Decimal twins); every other site a consumer
  or a differently-named quantity.
- `docs/architecture/REFERENCE_NUMBERS.md` published and complete.
- Census ratchet + `lib/` source-lock green in CI.
- Golden baseline diff clean, every movement pre-declared.
- The ~19 downstream issues in §5 re-verified live and closed on their own evidence.
- **Medicare levy is no longer the only single-sourced number in the app.**
