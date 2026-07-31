# MON-131 — the Tranche Ledger

**The programme's state of record.** Indexed from `01_ACTIVE_WORKSTREAMS.md` §0·REF, which stays the
workstream entry; this file holds per-tranche **gate state and evidence**.

> **Why a separate file rather than a second tracker.** The workstream entry is the index — status and
> checklist. This is the evidence record it points at. Same relationship as a canonical producer and
> its consumers: one place holds the state, the other reads it. If this file and any other artefact
> disagree about where the programme is, **this file wins**, because every cell here must cite
> evidence and the others may assert.

## §1 The rule that makes this worth having

**No cell is filled without evidence.** A PR number, a VR run doc, a census delta, a deploy id. Not a
judgement, not a recollection, not "should be fine."

**No tranche is marked done by assertion** — the same rule that stops a number reaching VERIFIED on a
passing unit test. Done means the gates in §2 are each satisfied *and cited*.

**An empty cell is information.** It says the thing has not been established. It must never be filled
to make the table look complete.

## §2 The gates

### Start gates — all must be true before a tranche writes code

| Gate | Evidence required |
|---|---|
| **G1 Preconditions clear** | Every §5.2 precondition for this tranche merged and deploy-verified |
| **G2 Contracts approved** | Contract file(s) in `docs/architecture/contracts/`, adversarially reviewed, semantics settled by a D-decision |
| **G3 `expectedMoves` declared** | Committed **before** the first line of migration, with the arithmetic per moved path |
| **G4 Baseline current** | A capture at the tranche's base SHA, or the prior tranche's post-capture |
| **G5 Facts held** | Every fact this tranche needs from Reza recorded — or the tranche is scoped to exclude what depends on them |

### Done gates — all must be true before the next tranche starts

| Gate | Evidence required |
|---|---|
| **G6 Merged + deployed** | PR number, merge SHA, deploy READY |
| **G7 Baseline diff clean** | Verdict `CLEAN` or `EXPECTED_ONLY`. **Any `MOVED-UNDECLARED` = STOP**, and the tranche does not advance |
| **G8 Ring-3 passed** | VR run doc, live production, real data, expectation derived independently |
| **G9 Census published** | Was-and-now count per quantity, split **collapsed** vs **deleted as dead** |
| **G10 Regression cluster intact** | The VR-041 Part-C figures byte-identical unless a declared move says otherwise |
| **G11 Issues closed on own evidence** | Each downstream issue verified live — never assumed closed because the root cause was fixed |

**If G7 or G8 fails: revert the merge. Do not patch forward.**

## §3 The ledger

Status vocabulary — five words only: `BLOCKED` · `READY` · `IN BUILD` · `VERIFYING` · `DONE`.

### Instrumentation — DONE

| Stage | Status | Evidence |
|---|---|---|
| T−1 golden baseline | **DONE** | PR #1525 merged |
| T0 census ratchet + source-lock → `lib/` | **DONE** | PR #1525; seed `.audit/producer-census.json` |
| T−1b Matrix Relay | **DONE** | PR #1526 merged, deploy verified; parity ratchet `tests/matrix/goldenBaselineRelay.test.ts` |
| Baseline captured | **DONE** | VR-042 §2: capture at `d3d7e147` — 8 trees, **10,254 leaves**, canonical leaf-list SHA-256 `700935f3b4313087eade1d1c8fffd333d41e081649c8ed2bedc024fad01a680e`, `capturedAt 2026-07-30T10:23:05Z`, user `91b6d7ce`. Leaf-count jump vs the lost `4e6cdd5c` capture explained (drift **D8** — partial first capture). **Persistence caveat (start-gate §1.2):** the 282 KB tree still lives only in the Matrix's session; the cell is fully green when a committed reference exists under `.audit/golden-baseline-*.json`. The `?format=hash` endpoint ships in the start-gate PR — the FIRST hash-mode capture after it deploys is the committed reference of record (VR-042's in-session hash predates the canonical in-code construction and is not comparable) |
| Phase A inventory + 48 contract files | **DONE** | PR #1534 merged. Count corrected (drift log **D6**): **48** files on main = 45 full-depth quantity contracts + 3 register/index documents (`mon136-register` · `mon136-unattributed-sweep` · `forecast-flows-index`); "49" was an over-count |
| Phase A gate — 28 decisions | **DONE** | PR #1535 merged (D17–D41); PR #1536 open (D42 corrections + D43–D47) |

### MON-134 — health-trend determinism — DONE

| Gate | State | Evidence |
|---|---|---|
| G6 merged + deployed | ✅ | PRs #1529, #1530, read-path PR |
| G7 baseline diff | ✅ | Relay A3 self-diff **`verdict: CLEAN`**, 1,767 leaves identical, 0 unexpected |
| G8 Ring-3 | ✅ | Capture confirms `direction: "INSUFFICIENT_HISTORY"`, `changePercent` **absent from the object** — not zero |

*Recorded because it is the acceptance precedent: the fix was verified by the instrument it unblocked.*

### MON-135 — categoriser precondition — DONE

**Blocks Tranche 3.** `aiCategorisation.ts` stamps `isRecurring: false` unconditionally; the one-off
gate would zero every AI-categorised expense.

| Gate | State | Evidence |
|---|---|---|
| G2 contract / brief | ✅ | PR #1531 brief |
| Build | ✅ | **PR #1538 (draft, open)** @ `1f80286c` — tri-state prediction (null = no determination) · evidence-based recurrence via `getRecurringPatterns` + the ONE ≤10% tolerance · two `aiIsRecurring` columns nullable · Wall-B2 Float+Decimal tri-state fixtures + never-emits-false guards (vitest 434/434; all seven `=== false` gates in `lib/` verified strict). Migration incident CLOSED: v1 used model names not `@@map`'ped tables (lesson in the migration file); v2 pushed; Reza ran the dev-DB `migrate resolve --rolled-back` 2026-07-30 ~06:21 (output: "marked as rolled back", host `35.189.31.209`); preview REBUILT GREEN at `68dcd899` (deploy `7s94FmhV…` READY — v2 applied cleanly) |
| G3 expectedMoves | ✅ | **Declares NO movement.** This PR changes what a default means, not what a number is |
| G6 merged | ✅ | PR #1538 merged 2026-07-30; prod deploy `dpl_48fktuyb…` READY (migration v2 applied to PROD cleanly). **Production verified at `d3d7e147`** (the relay's own `sha` field, VR-042 §0 — a later commit that includes MON-135; the earlier `b1af5021` note was the merge commit, not the deployed HEAD) |
| G8 Ring-3 | ✅ | **PASS — VR-042 §1 (Path B):** 48 tracked rendered figures across /dashboard/tax · balances · expenses (incl. all five per-loan rows + basis labels) · Home — **all identical** to `rendered-baseline-8700b1d7.json` + VR-041 Part C; producer↔render tie 9/9 (VR-042 §2.1); all seven prior identities + three new ones hold. `changesNumbers: NO` confirmed on every money surface. Registry: MON-135 → VERIFIED (run VR-042) |

### Tranche 1 — income (MON-128) — IN BUILD

> **Execution record (2026-07-30, build session).** T1 ships as **two PRs**, forced by the
> G3 contract: the `PENDING_RELAY` after-values must be COMPUTED by running old and new
> producers against the same REAL data through the relay BEFORE the migration merges — and
> real data exists only in production (previews bind to the dev DB). So:
> **T1-A (scaffold — moves nothing):** per-FY PAYG Schedule 1 coefficient home in
> `TaxYearConfig.paygSchedule` (D35/X1/P1 — FY24-26 set moved from `paygCalculator.ts`,
> FY26-27 set added, ATO-verified 2026-07-30 + one independent secondary byte-identical;
> legacy no-config default preserved byte-identical) · greenfield HELP/STSL engine
> (`helpRepaymentCalculator.ts`, D42 C2 cliff = 10% of the WHOLE) + `repaymentIncome.ts`
> (C3 add-backs, componentBasis honesty) · the banked L1/L2 stack under `lib/income/banked/`
> (salary FACT hierarchy · rental via the ONE `computePropertyCashflow` · received-cash ·
> pure-sum aggregator; Float + Decimal) · FACT-field schema migration
> (`Income.actualNetPay` per-row-period, `Income.helpLoanDeclared` tri-state;
> `Property.genuinelyAvailableForRent` + `availableDaysPerYear` — X7 intake-only) ·
> the compare relay `/api/admin/matrix/golden-baseline/t1-income` (computes every
> PENDING_RELAY after-value through the SAME assembly the flip will wire). Golden baseline
> must hash IDENTICAL at the T1-A merge.
> **T1-B (the flip):** expectedMoves completed per-path from the T1-A relay output on prod →
> consumers flipped (master income/cashflow/quickMetrics, buildHealthInput, moneyFlow,
> portfolio/snapshot, portfolioEngine, cashflow routes) → culprits deleted citing contracts
> (calculateIncomeAmounts + takeHome in the orchestrator [MON-137], normalizeIncomeStream's
> dead siblings, netIncomeCalculator, buildHealthInput's private copy, `income/page.tsx:356`
> ×0.30 invention) → MON-138 band-gap fix (declared) → intake UI for the FACT fields.
> **Scope notes recorded:** D35 brought forward (brief-sanctioned, X1); X6's type split
> ALREADY exists in the data model (`PropertyType.RENTAL` = tenanted residence — engine
> reads it + flags misattached rows; no duplicate column added, §12.2.1); business
> distributions have NO income-row representation (IncomeType has no such value) — the
> received-cash engine covers INVESTMENT/OTHER and LegalEntity-table distribution
> intelligence stays outside T1 (coverage boundary); serialized snapshot field names
> (netTotal etc.) survive T1 for baseline path-continuity — the D17 rename lands at the
> engine + label layer, the on-wire rename is queued (declared in the T1-B coverage
> boundary). **Corrections queued for the expected-moves file at fill time:** the health
> pathPrefix is `…generateHealthReport.healthScore.score` (the tree nests under
> `healthScore`), not `…generateHealthReport.score`.
> **New defect discovered + registered:** MON-138 — Schedule 1 band selection has 1-dollar
> gaps (fractional weekly earnings between integer bounds withhold $0); legacy behaviour
> deliberately preserved in T1-A, fixed + declared at the T1-B flip.
> **CENSUS RESEED DECLARED (T1-A, requires Reza's sign-off at merge review):** the
> producer census is formula-shape site counting, so the NEW canonical homes register as
> +sites before the legacy producers die — the strangler window. Reseeded
> `.audit/producer-census.json` (+~30 sites across 10 quantities: incomeRunRate 135→141 ·
> payg 64→73 · grossIncome 43→47 · taxableIncome 38→41 · deductions 105→107 ·
> expenseRunRate 84→87 · netIncome 45→46 · emergencyMonths 14→15 · negativeGearing 6→7 ·
> insuranceAdequacy 15→16), every added site in the new T1 canonical files.
> **HARD COMMITMENT: the T1-B flip deletes the legacy producers and MUST land every
> reseeded count BELOW its pre-T1 value — the reseed is transitional, never the new floor.**
> Stage-1 censuses (7 producers · input-feed omissions · consumers · the rental
> three-value settlement) recorded on MON-128/MON-137 in the registry.

> **T1-A: DONE (2026-07-30).** PR #1542 merged → main `3028c08a` → prod verified.
> **Ring-3 ACCEPTED — VR-043:** 0 money leaves moved on the live capture; the committed
> hash-mode reference of record issued at `3028c08a` — **1,767 leaves**, tree hash
> `6f2369a6f0f94279e171bf95db3af26fcee16ef07d0371c14480ac98b16c0224`.
> **Start-gate §1.1 (leaf-count reconciliation) WITHDRAWN — VR-043 §6:** the route's
> canonical count is non-array-descending (1,767); the Matrix's 10,254 was its own
> client-side recursion over the same tree — two counting conventions, ONE tree, no
> missing data. Recorded here so no future session re-litigates it.
>
> **T1-B: IN BUILD (this PR — the flip, `changesNumbers: YES extensively`).** Four
> start-gate questions resolved BEFORE code (§1.1 tax-page PAYG IN SCOPE — the withheld
> credit reads the banked wedge via a two-pass `getUserTaxPosition`, 11,129 → 43,004,
> refund −26,657 → +5,218; §1.2 Home actuals tiles untouched, declared twins in the set,
> basis-contradiction filed as MON-139 → T6; §1.3 the $121,881 named
> `rentalTaxableGrossDeclared` + per-row attribution block on the relay; §1.4 calendar
> leaves excluded from the hash via VOLATILE_LEAF_PATTERNS — the reference re-issues at
> the post-T1-B capture since the hashed set changed). G3 expectedMoves REWRITTEN from
> VR-043 §3 (computed on live prod through the relay, commit `d59419ea`) BEFORE the first
> migration commit. MON-138 fixed (floor-based band selection, gap-free; whole composer
> one-FY; legacy no-config pin dead). Core flip: orchestrator takes pre-computed
> BankedIncomeTotals (MON-137 culprits DELETED, not wrapped) · master + health + moneyFlow
> + CFE + portfolio-snapshot + intelligence + debt-analysis + exporter + income page all
> read the ONE producer · legacy producers deleted citing contracts (incomeNormalizer.ts ·
> netIncomeCalculator.ts · aggregateIncome + Decimal/BySource siblings · snapshot-route
> helper trio · buildHealthInput private copy · the ×0.30 preview invention) · intake UI
> shipped (actualNetPay FACT + helpLoanDeclared tri-state, never defaulted — the tranche's
> highest-value item: ≈$22,576/yr HELP currently invisible above the $186,050 cliff).
> **CENSUS LANDED (the T1-A hard commitment):** every reseeded count fell — payg 73→56
> (pre-T1 64) · incomeRunRate 141→128 (135) · netIncome 46→34 (45) · grossIncome 47→38
> (43) · medicareLevy 26→20 · taxableIncome 41→38 (=38 pre-T1). Two honest exceptions vs
> pre-T1, attributed at site level: emergencyMonths 15 vs 14 (the T1-A compare relay
> route — temporary tranche infrastructure, dies with the relay) and deductions 106 vs
> 105 (`assembleRepaymentIncome` — the NEW D42 C3 canonical assembler, one producer of a
> new quantity). Source-lock debt paid down 11 entries (orchestrator reduce-sums → 0).
> moneyFlow design note (financial-adviser lens): with income entering the Sankey as
> BANKED cash, the Tax outflow is 0 by construction — the wedge is taken before pay
> banks; showing it again would double-count. The wedge lives on the §1.1 tax position.

> **T1-B VERIFICATION — VR-044: FAIL (§5.2), then the §6 redirect (2026-07-31).**
> The Matrix ran Ring 3 on the merged flip (`f1c87afb`, prod READY) and **22 declared
> income paths missed**. What LANDED exactly as declared: `paygWithheld` 43,004 ·
> `estimatedRefund` 5,218 · `cashflow.annual/monthlyPaygWithholding` · `healthScore` 53 ·
> `moneyFlow.totalIncome` **304,158.61**. MON-137 is FIXED (the double deduction is gone;
> the gross field carries gross) and the §1.1 tax-page decision shipped to the dollar.
> The regression cluster held byte-identical (§5.3/§5.4 PASS).
>
> **Root cause — NOT an unwired consumer and NOT a stale snapshot** (both §6 hypotheses
> false; `buildIncomeBreakdown` reads `projectAggregation` at the deployed SHA).
> `masterFinancialService`'s income `findMany` carried a HAND-ROLLED `select` that omitted
> `isRecurring`; the engines gate one-offs on `row.isRecurring === false`, which against
> `undefined` never fires, so 10 one-off rows annualised: **13,200.12 × 12 = 158,401.44**,
> reconciling three ways (the measured gap; salary excess 34,800 + OTHER 123,601.44).
> Every OTHER feed uses an unrestricted `findMany` and was correct — which is exactly why
> moneyFlow hit the declared value and Home did not. **ONE engine, TWO feeds** — the
> MON-028 class, reproduced by the tranche built to kill it. `as unknown as
> BankedIncomeRow[]` defeated the guard the row type's docstring promised.
>
> **Resolution: MON-140, PR #1548 merged 2026-07-31** (main `e4040dbb`). Reza took the §6
> redirect over the §5 revert — the tranche was sound and one feed was starved; reverting
> would have discarded verified-correct work and re-landed a larger diff carrying the same
> fix. `BANKED_INCOME_SELECT` is now the ONE definition of the engine's input contract
> (§12.2.1 applied to the INPUT); ratchet `tests/income/bankedInputFeed.test.ts` pins the
> ×12 mechanism and the no-hand-rolled-subset rule, **proven to fail on the VR-044 code**.
> Two lying instruments fixed in the same PR: `RENDERED_PART_C.payg` still held the retired
> 11,129 (VR-044 §4 — it would have passed "unchanged"), and the ratchet's own first draft
> used a non-greedy regex that passed on the bug.
>
> **VR-044's rendered half is VOID** (its §7 — the admin sign-in swapped the browser
> session), so the NEXT run re-does the full Ring 3, not just the producer half.
> **Still open: G7 per-path diff + Ring-3 §5.5 on the post-MON-140 prod.** MON-128/137/140
> stay FIXING until that records.

| Gate | State | Evidence / what's missing |
|---|---|---|
| G1 preconditions | ✅ | MON-134 done; MON-135 does not gate T1 — and is now itself DONE (VR-042 §1 PASS, evidence above) |
| G2 contracts | ✅ | Semantics settled: D17 banked income · D20 layered engines · D18 savings rate |
| G3 expectedMoves | ✅ | **Committed: `.audit/expected-moves-t1.json`** (start-gate PR) — per-path, arithmetic-anchored to VR-042 measured values; includes the three-PAYG reconciliation paths (9,932.00 applied · 11,128.70 reported · 36,197.69 cashflow) and the Home Saved/$27,987 + savings-rate 73.1% sign-inversion pair. **PAYG withheld $11,129 removed from the regression cluster** (it may be the wrong of two candidates — freezing it would freeze a defect); that removal is itself declared, and it is the only one |
| G4 baseline | ✅ | VR-042 §2 capture at `d3d7e147` (10,254 leaves, hash `700935f3…`); committed hash-mode reference follows the start-gate PR deploy (Instrumentation row caveat) |
| G5 facts | ✅ | **Nothing is asked of Reza** (start-gate §3; build brief §0): salary component is in the data (`byType.SALARY` gross 227,519.50 / net 217,587.50, VR-042); HELP repayment income is COMPUTED (taxable income excl. FHSS + reportable fringe benefits + total net investment loss + reportable super + exempt foreign employment — every input in Monitrax); rental gross-vs-net is a code question (build brief §2.1, now with the third value 154,443.11). Genuinely user-only values ship as FACT fields with an undetermined state (build brief §5), never as questions |
| G7–G11 | — | |

**Day-one invariant:** `netTotal ≤ grossTotal`, Float and Decimal.

### Tranche 2 — loan cost (MON-130) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D21 interest net of offset; D26 equity on full balance (the deliberate asymmetry) |
| G3 expectedMoves | — | Must include: Home budget tile Loans $8,817 → $12,779 · per-loan principal/interest split (**not established** — derive, never guess) |
| G5 facts | ❌ | Cross-collateralised loans? · fixed loans? · mixed-purpose loans? |
| G7–G11 | — | |

**Also in scope:** the Q1 rate-unit bug at `EntityCashflowSummary.tsx:693` — see the drift log, §4 D3.

### Tranche 3 — expense run-rate (MON-129) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G1 preconditions | ❌ | **MON-135 must merge first.** Non-negotiable |
| G2 contracts | ✅ | D22 committed vs essential |
| G3 expectedMoves | — | **The trap:** T3 legitimately lowers expenses, so a broad "expenses fall" entry would absorb MON-135's loss as expected. Declare **per-path** arithmetic, never a directional prefix |
| G7–G11 | — | |

### Tranche 4 — tax constants + depreciation — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D33 SG per period + MCB · D35 PAYG coefficients · D44 Div 43/40 split, method locked per asset · **D41 regime versioning** |
| G3 expectedMoves | — | Must include: SG 11.5% → 12% · PAYG on FY26-27 coefficients · depreciation (~4× divergence today) |
| G5 facts | ❌ | **QS depreciation schedules** — if they exist, ingest as facts rather than compute (D44) |
| G7–G11 | — | |

**Carries the architectural change:** the config must hold per-period **rules**, not just values. Seven
regime switches in eight years are already identified.

### Tranche 5 — balance sheet — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D27 accessible at market · D28 realisable derived · D29 cash classification · D26 equity + RENTAL split |
| G3 expectedMoves | — | Must include: cash tile · accessible funds · property equity per property |
| G5 facts | ❌ | Which properties are owned-and-rented-out vs tenanted residence (D26) · **any co-owned property held as a rental *business*** (D42 C1 — changes the attribution rule) |
| G7–G11 | — | |

**Never floored:** negative equity carries through to the portfolio total.

### Tranche 6 — rates, scores, runway — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D30 two runway quantities + INDEFINITE · D31 gross flows · D32 health score re-founded · D47 insurance 70 removed |
| G3 expectedMoves | — | Must include: 11.6 mo retired → ~21 and ~73 · health score 54 → moves · insurance 70 → absent |
| G5 facts | ❌ | Availability and available-days per property (D43) |
| G7–G11 | — | |

**Trap:** `INDEFINITE` is a state. Any downstream score that averages runway months must handle the
state, not a sentinel — that is how 999 got there.

### Tranche 7 — budget remainder (MON-127) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D24 two-basis remainder · D23 variance survivor · D25 ABS relabel · D45 assumptions config |
| G3 expectedMoves | — | Must include: suggested budget $4,442 → planning ~$10,000 and an actual figure |
| G5 facts | ❌ | Total super balance · Division 293 exposure (both gate the growth mode) |
| G7–G11 | — | |

**Compliance:** modes are scenarios with consequences, never recommendations. ASIC assumption
framework applies where any projection touches super.

### Closing stages — BLOCKED

| Stage | Gate | Note |
|---|---|---|
| Number Ledger, MON-131 scope | — | 23 quantities × every surface × three axes. **MON-131 closes here, on evidence** |
| MON-136 | — | Every remaining quantity, same machinery |
| Number Ledger, MON-136 scope | — | |
| **The complete Matrix sweep** | — | Reza's explicit requirement. The only thing that closes the programme |
| Everything else | — | **HELD.** The 36 issues producer collapse won't touch |

## §4 Drift log

**Where a reported state diverged from repo reality.** This section exists because the Matrix's status
page was maintained by hand, outside the repo, and drifted within a day. Every entry is a case for
deriving state from evidence rather than asserting it.

**D1 — census counts stale in the Matrix's reporting.** The status page and several Matrix messages
cited **564 sites across 13 quantities**. Phase A0 extended the census to **1,307 sites across 40
quantities**, plus a 424-function unattributed sweep bucket. *Corrected: the ledger and status page now
cite the Phase A0 figures. Root cause: the Matrix quoted the Tranche 0 seed after Phase A superseded
it.*

**D2 — quantity count conflated.** The Matrix reported **49 quantities**. 49 is the number of
**contracts**; the inventory names **68 quantities**. *Corrected. Root cause: contract count read as
quantity count.*

**D3 — the Q1 100× bug was reported as LIVE on Home; it is not rendered.** `01_ACTIVE_WORKSTREAMS.md`
§0·REF and `NUMBER_INVENTORY.md` describe *"a LIVE 100× bug on Home at `EntityCashflowSummary:693`"*.
The unit error is real and confirmed at both ends — the schema stores `interestRateAnnual` as a decimal
(`0.0625`), `snapshot/route.ts:852` passes it through, and the widget divides by 100 again. **But the
value only reaches a screen through a per-loan "Tax Benefit (est.)" row at `:488`, and Home mounts
`GlassEntityCashflow`, which renders six summary rows from `data.summary.standaloneLoansCost` and never
touches `taxBenefit`. `EntityCashflowSummary` is imported and never mounted.** *Verdict: real defect,
fix in Tranche 2, **no rendered surface**. The "LIVE on Home" framing is an over-claim that did not
survive tracing — Phase A's own headline finding. Root cause: code-path analysis without a mount check.*

**D4 — "Phase B blocked, 5 decisions open" outlived its truth by hours.** The register consolidated
from session logs written before decisions 17, 20, 21, 22 and 25 were settled. *Corrected in PR #1536.
Root cause: consolidation from a snapshot rather than from the live decision state.*

**D5 — the "Baseline captured — DONE" cell cited a relay call, not a committed artefact.** This
ledger's own §1 rule is "no cell is filled without evidence"; the evidence for a baseline is the
committed capture file, and nothing exists under `.audit/golden-baseline-*.json` — the 1,767-leaf
capture at `4e6cdd5c` was sandbox-only and is unrecoverable as a "before" state once any code-touching
merge lands. *Corrected 2026-07-30 (this PR): cell flipped to BLOCKED; recapture-and-commit at current
main required before MON-135 or T1 merge (main is docs-only since `4e6cdd5c`, so a fresh capture still
represents the pre-code state). Root cause: the ledger's opening entry was written from the Matrix's
session memory of the capture, not from the repo — the exact failure the ledger exists to stop, in the
ledger's own first table.*

**D6 — the contract count was off by one everywhere it was cited.** "49 contracts" appears in
`NUMBER_INVENTORY.md`, this ledger's instrumentation row, and D2's own correction. **48** files exist
on main: 45 full-depth quantity contracts + 3 register/index documents (`mon136-register.md`,
`mon136-unattributed-sweep.md`, `forecast-flows-index.md`). *Corrected 2026-07-30 (this PR) in both
files. Root cause: the count was quoted from the assembling session's running tally, never re-derived
from `ls | wc -l` at HEAD.*

**D7 — the T1 G5 row asserted ❌ for three items the build brief's own §0 had already resolved.**
The ledger listed "salary component · HELP repayment income · rental gross-vs-net" as facts owed by
Reza; the build brief §0 had already ruled all three computable-or-code-questions ("asking the user
for a number the engine owes them is the same failure class as a fabricated default"). The ledger
disagreed with the brief it indexes. *Corrected 2026-07-30 (start-gate PR): G5 → ✅ with the
computable basis. Root cause: the ledger row was written before §0's correction and never
re-derived.*

**D8 — the leaf count moved 1,767 → 10,254 between captures, and the old operand cannot be
verified.** VR-042 §2.2 asked whether the serializer changed: **it did not** —
`git log d3d7e147...4e6cdd5c -- lib/matrix/goldenBaseline.ts` is empty and the file is
byte-identical at both shas, so the jump is not instrumentation. The structural explanation: a
failed capture writes a string `__captureError` stub **in-tree, never fatal**
(`goldenBaseline.ts:127`), and leaf counts are **numeric leaves only** — so a capture where the
two slowest compound trees failed still reports "8 trees" while silently losing their numeric
content. Today's tree minus `getUserTaxPosition` (7,924) and `generateHealthReport` (566) is
**1,764 ≈ the remembered 1,767** (Δ3 consistent with small legitimate drift, e.g. the health-trend
history accruing its first real snapshot between captures). Exact attribution is impossible
because the 1,767 capture was never persisted — **the comparison has an unverifiable operand,
which is the D5 lesson restated**. *Ruling: the `d3d7e147` capture (internally verified three
ways: 48/48 rendered identical, 9/9 producer↔render tie, per-tree decomposition recorded) is the
reference. Hardening shipped in the start-gate PR: the `?format=hash` summary carries
`captureErrors` — a non-empty list invalidates the baseline, so a partial capture can never
masquerade as a full one again.*

**Pattern across all eight: state asserted from a stale read.** The mitigation is this ledger — cells
cite evidence, and the status page renders from here rather than being written independently.

## §4b The register gap — MON-112…124 is deliberate, not lost

`docs/issues/ISSUES.json` holds 123 issues, runs to MON-136, and is missing exactly **MON-112…124**.
The gap is accounted for, id by id:

- **MON-112 / 113 / 114** — reserved for the three issues the `vr038-039-advance` script raises.
  The script merged in #1521 and was **executed via `registry-reconcile.mjs` in #1529** for the
  MON-104…110 advancement, but the 112–114 raise portion has not run; the ids stay reserved for it.
- **MON-115…124** — VR-040's ten findings (`docs/verification/runs/VR-040.md`, committed by this PR).
  **Seven of the ten were demoted to observations** under the holistic-verification law (an untraced
  cross-surface difference is an observation, not a finding — D3 in the drift log is the type
  specimen) and are **re-filed only after re-tracing**, under NEW ids if they survive. The remaining
  three were re-filed during reconciliation under new ids (MON-125/126 among them — the brief's
  "MON-115" became MON-126 after an id collision).
- **Ids are never reused.** The gap is the record that these numbers were allocated and their claims
  re-examined — a register that silently compacted would erase that history.

## §5 What this ledger deliberately does not do

It does not track Code's internal task list, and it does not duplicate the contracts — the contracts
hold call sites and `expectedMoves`; this holds whether they were satisfied.

It does not assert progress the census can't confirm. **The census count is the only objective
progress measure in the programme**, because it cannot be talked up — and per D46 it must publish
*collapsed* separately from *deleted as dead*, or removing code nobody ran reads as progress.

And it does not claim the safety net is complete. Known limits, restated so no one relies on more than
exists: the baseline covers **8 orchestrator trees, not all leaf producers** · it captures **values, not
rendered screens**, so a component that stops rendering would not appear in a diff · and **a declared
move can mask an undeclared one**, which is precisely MON-135's shape and why `expectedMoves` must be
per-path rather than directional.

---
*Opened by The Matrix, 30 July 2026, at Reza's direction — "build anything that makes you keep on track
and avoid drifts from the plan." Indexed from `01_ACTIVE_WORKSTREAMS.md` §0·REF. Companion to
`NUMBER_INVENTORY.md`, `REFERENCE_NUMBERS_DECISIONS.md`, `decisions/D42_VERIFICATION_CORRECTIONS.md`
and `PROTOCOL_NUMBER_LEDGER.md`.*
