# MON-131 — the Tranche Ledger

**The programme's state of record.** Indexed from `01_ACTIVE_WORKSTREAMS.md` §0·REF, which stays the
workstream entry; this file holds per-tranche **gate state and evidence**.

> **Why a separate file rather than a second tracker.** The workstream entry is the index — status and
> checklist. This is the evidence record it points at. Same relationship as a canonical producer and
> its consumers: one place holds the state, the other reads it. If this file and any other artefact
> disagree about where the programme is, **this file wins**, because every cell here must cite
> evidence and the others may assert.

> **Companion, not competitor: [`MON-131_COMPLETION_BRIEF.md`](MON-131_COMPLETION_BRIEF.md)** (opened
> 2026-08-03, Reza's request for one document both agents keep current). It owns the **forward plan**
> per tranche and the **shared Code + Matrix status log**. It owns nothing else — gate state and the
> change record stay HERE, and its §0 says so explicitly. **If the two ever disagree, this ledger wins.**

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

### Tranche 1 — income (MON-128) — DONE

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
> **Correction (2026-07-31): VR-044's rendered half is NOT void.** This ledger previously
> said it was. Re-reading VR-044 §7: the **first attempt** was void — signing into
> `/admin/login` swapped the browser to the admin account, and that draft was withdrawn.
> The run recorded in the file **is the re-run**, in Reza's own session, with identity
> asserted from net worth $3,401,782 / 6 properties / 5 loans / entity *"Reza"* $2,651,782
> **before any figure was read**. Its rendered evidence is good and must not be discarded —
> it is what proves the `mustNotMove` cluster held 13/13 and what caught the two live Home
> income figures. The next run re-does the full Ring 3 because **#1548 moved the numbers**,
> not because VR-044's reads were unsound.
>
> **CLOSED at VR-045 (2026-07-31, PASS).** 22/22 declared paths land · the Home
> contradiction is gone (`moneyFlowService` 304,158.61 ≡ `masterFinancialService`
> 304,158.61, against 304,158.61 vs 462,560.05 at VR-044) · regression cluster
> byte-identical. **MON-128 · MON-137 · MON-138 · MON-140 → VERIFIED.**
> **The tranche closes WHOLE, not three-quarters** — VR-045 §2b found the Ring-3
> surface the handout pre-declared absent (the FORTNIGHTLY Ingeus **salary** row at a
> fractional $1,919.35 net / $2,301.35 gross, withholding non-zero at $9,672/yr), so
> MON-138 verified on real data and no disposition call went to Reza.
>
> **Instrument for the next run: `docs/verification/briefs/RING3_VR045_T1_REPAIR.md`**
> (PR #1550, merged 2026-07-31, main `3cdaa8c4`). It pins all 22 declared paths with
> VR-044's failure values alongside, the Home one-income-story check
> (`moneyFlowService` ≡ `masterFinancialService` at 304,158.61), the `mustNotMove` cluster,
> and §5's pre-declared non-findings so the run cannot false-fail the documented T6
> deferrals (`perMember[].taxPosition.paygWithheld = 11,129`, `userTaxPosition.ts:286-288`).

| Gate | State | Evidence / what's missing |
|---|---|---|
| G1 preconditions | ✅ | MON-134 done; MON-135 does not gate T1 — and is now itself DONE (VR-042 §1 PASS, evidence above) |
| G2 contracts | ✅ | Semantics settled: D17 banked income · D20 layered engines · D18 savings rate |
| G3 expectedMoves | ✅ | **Committed: `.audit/expected-moves-t1.json`** (start-gate PR) — per-path, arithmetic-anchored to VR-042 measured values; includes the three-PAYG reconciliation paths (9,932.00 applied · 11,128.70 reported · 36,197.69 cashflow) and the Home Saved/$27,987 + savings-rate 73.1% sign-inversion pair. **PAYG withheld $11,129 removed from the regression cluster** (it may be the wrong of two candidates — freezing it would freeze a defect); that removal is itself declared, and it is the only one |
| G4 baseline | ✅ | VR-042 §2 capture at `d3d7e147` (10,254 leaves, hash `700935f3…`); committed hash-mode reference follows the start-gate PR deploy (Instrumentation row caveat) |
| G5 facts | ✅ | **Nothing is asked of Reza** (start-gate §3; build brief §0): salary component is in the data (`byType.SALARY` gross 227,519.50 / net 217,587.50, VR-042); HELP repayment income is COMPUTED (taxable income excl. FHSS + reportable fringe benefits + total net investment loss + reportable super + exempt foreign employment — every input in Monitrax); rental gross-vs-net is a code question (build brief §2.1, now with the third value 154,443.11). Genuinely user-only values ship as FACT fields with an undetermined state (build brief §5), never as questions |
| G7 baseline diff | ✅ | **FAILED at VR-044** (22 paths missed) → **PASS at VR-045 §2**: 21 exact, 1 off by $0.02 — and that one is a **defect in the DECLARATION, not the engine** (`annualCashflow` was declared as rounded-monthly ×12 = 180,572.52; the engine derives from annual components = 180,572.50). Contract amended in this PR with the annual-component arithmetic + a `_meta.declaredCorrections` record. New reference hash at `3cdaa8c4`: `347006b9…`, 1,759 leaves, `captureErrors: []` |
| G8 Ring-3 | ✅ | **FAILED at VR-044** → **PASS at VR-045** (`docs/verification/runs/VR-045.md`, SHA `3cdaa8c4`, prod READY, read in Reza's own session with identity asserted before any figure). §3 Home one-income-story ✅ · §2b MON-138 reachable and passing ✅ |
| G9 census | ✅ | `byType.OTHER` **absent from the tree**, not zeroed — the one-off rows left the run-rate rather than being suppressed. Income producers: SEVEN before T1 (Stage-1 census) → **ONE** (`buildBankedIncome`); the five legacy re-computations deleted at T1-B, the sixth (`cashflowOrchestrator`'s) removed as MON-137's culprit, the starved feed unified as MON-140's `BANKED_INCOME_SELECT` |
| G10 regression cluster | ✅ | VR-045 §4 — `/dashboard/balances` 13/13 · `/dashboard/expenses` 13/13 · `/dashboard/tax` all figures at their T1-B values · out-of-scope producers (T2 `monthlyLoanRepayments` 8,816.65 · T3 `expensesByCategory` · net worth 3,401,781.52) untouched. `renderedPartC.payg` now reads 43,004 — the VR-044 §4 lying instrument is repaired |
| G11 issues closed on own evidence | ✅ | Each verified on its OWN numbers, not by inheritance: MON-128 (one-off gate — `byType.OTHER` gone) · MON-137 (one wedge, identity `347,162.61 − 43,004.00 = 304,158.61` exact) · MON-138 (§2b fractional salary row, non-zero withholding) · MON-140 (Home ≡ moneyFlow). Registry moved in this PR with `test` + resolving `semanticKeys` on all four |
| G9 census | — | Was-and-now per quantity, due with the G7/G8 pass |
| G10–G11 | — | |

**Day-one invariant:** `netTotal ≤ grossTotal`, Float and Decimal.

### Tranche 2 — loan cost (MON-130) — VERIFYING (G8/G10/G11 ✅; G7 permanently HALF — the pre-T2 reference tree was never committed, MON-157)

> **SCOPE, stated once so it is not mistaken for a shortfall later.** T2's contract measures the
> `masterFinancialService` leaves and nothing else, so the migration moves that one producer.
> `loanCost` goes **31 → 30**, not 31 → 1. The remaining 30 sites feed `moneyFlow`'s per-entity
> flow, the CFO score and risk trees, reports, the debt planner and the health tree — all
> **separate golden-baseline captures** that this sweep never touched. Collapsing them inside this
> PR would have moved undeclared numbers and stopped the tranche at G7 by construction, which the
> completion brief §4 forbids. They are **T2-B**, and T2-B needs its own capture and its own
> `expectedMoves` — the same loop, not a shortcut.
>
> **The visible consequence, recorded before anyone reports it as a bug:** after this merge Home's
> budget tile and `/dashboard/expenses` agree at **$12,779**, while the entity-flow Sankey still
> omits the same three loans (**$3,792.92/mo**) because `moneyFlowService.ts:382` is untouched. Net
> inconsistency across the app *falls* — Home stops being the odd one out — but two surfaces now
> disagree that previously agreed on the same wrong number. It is in the Ring-3 handout §5 as a
> pre-declared non-finding.


> **MON-142 v1 — the effective-loan-rate engine (this PR).** Reza approved the recommended
> approach 2026-07-31 (*"go with your recommendation"*): derive the rate where evidence exists,
> flag where it does not, never silently prefer either number.
>
> `lib/calculations/effectiveLoanRate.ts` — ONE producer for *"what rate is this loan actually
> at?"*, a D17-style FACT hierarchy applied to a rate: **charged-interest ledger** (the bank's
> own figure) → **interest-only repayment** (an IO repayment IS the interest) → **stored**, and
> the stored value is never overwritten. Divergence beyond **0.10pp** raises `RATE_STALE`;
> absence of evidence raises `RATE_UNVERIFIED`, so *"we don't know"* cannot be mistaken for
> *"we checked"*. A **P&I repayment is never rate evidence** (it mixes principal in — Thornland
> Lot 1's $6,197/mo would imply 7.85%). D21 honoured: the divisor is `principal − offset`, so
> Guildford derives on $73,932, not $377,822 (a 5× error otherwise).
>
> **MOVES NO NUMBER.** Nothing consumes it — deliberately. It is A6-allowlisted with a named
> removal trigger, because wiring it (the deductible-interest THEORETICAL fallback at
> `propertyLoanInterest.ts:85` and the loan-cost interest floor at `propertyCashflow.ts:199`)
> moves real money and needs its own `expectedMoves` + Ring 3.
>
> Evidence: 16 fixtures on the REAL figures — Broadbeach $1,191/mo → 6.268% vs stored 6.690%
> (−0.4216pp, `RATE_STALE`), and Lot 2's different balance implying the **same** rate to <0.0001,
> which is the observation a per-loan data error cannot produce. Float ≡ Decimal parity across
> all seven shapes. Neo-sync: node `engine.loans.resolveEffectiveLoanRate` + four verified input
> edges; `neomatrix:check` green. Registry: **MON-142 → DIAGNOSED** (root cause verified at
> `file:line`; NOT `FIXING` — no consumer means the user-visible defect is not yet fixed).

> **§2.1 RESOLVED — the 0.9370 factor is NOT in the actuals path.** The T2 brief flagged both
> interest-only loans repaying ~0.937× their contractual interest and required it explained before
> any loan number was declared. The averaging algorithm was cleared first, by running it:
> `calculateMonthlyAverage` uses `totalDays = daysSpan + avgInterval` (= N × interval), so
> `monthly = payment/interval × 30.4375` — a probe of 12 monthly payments at contractual interest
> returns **ratio 1.00000 exactly**, and the result is scale-free in N (so Reza's ~2 months of data
> still averages correctly for what it covers). All four candidate causes named in the brief —
> short window, partial first/last period, day-count mismatch, missing payment — are eliminated.
>
> **The factor is the stored rate.** `1191×12/228,000 = 6.268%` and `2518×12/482,000 = 6.269%` —
> the same implied rate from two different balances, which a per-loan data error cannot produce but
> one lender changing one rate can. **Reza confirmed (2026-07-31): bank rates changed, and he does
> not recall updating the rate in Monitrax.** Raised as **MON-142**.
>
> **Consequence for T2: UNBLOCKED.** The actuals path is trustworthy, so migrating
> `masterFinancialService` onto the canonical $12,779 is safe. The brief's stated risk —
> canonicalising a 6.3% understatement — does not apply.
>
> **§4 G5 facts settled from the schema, not from Reza** (brief §4): fixed-rate is **expressible**
> (`rateType: VARIABLE|FIXED` + `fixedExpiry` + `extraRepaymentCap`) — all five loans reading
> `variable` is a data state, not a schema gap; **cross-collateralisation is structurally
> INEXPRESSIBLE** (`Loan.propertyId` is a single optional FK, so one loan secures at most one
> property) — a schema limit to record, not model around; mixed-purpose has a FACT field already
> (`deductibleFraction @default(1.0)`, Phase 51, read by three tax-engine files).
>
> **SECOND CAPTURE (2026-07-31, at `7be30bef`) — the repair landed, and the METHOD was the defect.**
> `paths` went 8 → 10 and the annual pair reads exactly as derived: `cashflow.annualCashflow` /
> `.annualSurplus` **180,572.50 → 133,020.79** (`304,158.61 − 17,786.31 − 153,351.51`, the $47,551.71
> move). The §5 skip prediction is now correct at three loans.
>
> **But it found TWO MORE undeclared movers** — `cashflow.monthlySurplus` (the monthly twin of a pair
> whose annual half had just been added) and `debt.metrics.monthlyRepayments` (**$3,962.64**, sitting in
> the same object as a path that WAS declared). Reading the assembly to fix them surfaced a **fifth**,
> `quickMetrics.monthlyLoanRepayments`, that no capture had reached.
>
> **Three rounds, five misses — the list was the defect, not any entry in it.** The Matrix named it:
> *"it enumerates paths by name rather than by dependency… adding two names fixed two names; it did not
> fix the method."* Correct, and the fix is theirs: **the derivation sweep.** The relay now re-runs
> `calculateCashflow` and `calculateDebtMetrics` — the REAL engines, on master's REAL inputs — with the
> canonical per-loan cost substituted for the raw `minRepayment`, then diffs every numeric leaf.
> `quickMetrics` mirrors are carried by value-match. Whatever moves, moves: no judgement, no list,
> nothing left to forget. The old input's `l.minRepayment && l.repaymentFrequency` filter — which is
> precisely why both interest-only loans vanish — is gone by construction in the canonical legs.
>
> **Coverage boundary, stated:** the sweep is complete for `cashflow.*`, `debt.metrics.*` and the
> `quickMetrics` mirrors. It does NOT sweep `byEntity`, health, or anything outside those blocks — those
> would need their own recompute, and G7 remains the backstop for them.
>
> **FIRST CAPTURE RETURNED 2026-07-31 — and it caught a hole in my own instrument.** Measured at
> `2627dcdf` on Reza's account (identity asserted: `loanCount === 5`, userId echoed): old
> **8,816.65** → new **12,779.29**, Δ **+3,962.64/mo · +47,551.71/yr**. Every §5 prediction landed
> except one, and the exception was informative: `moneyFlowSkip` returned **three** loans, not two —
> the skip is keyed on *no declared repayment*, not on interest-only, so **HECS is caught too**
> (2,518.34 + 1,191.25 + 83.33 = 3,792.92 exactly). The §2.1 stored-rate diagnosis is confirmed from
> the other side: `impliedRateAnnual 0.0626974` vs `stored 0.0669` = **0.93718**, the same factor the
> brief flagged, identical `divergencePp −0.42026` on both loans.
>
> **The relay was INCOMPLETE and G7 would have stopped the tranche.** `cashflow.annualCashflow` /
> `.annualSurplus` move by **$47,551.71** and were not in the declared paths at all. Fixed in this PR.
> Two paths my own T2 brief listed as movers are correctly absent — `debtToIncomeRatio` and
> `keptAfterEssentials` carry no loan term; the brief was over-inclusive there.
>
> **MON-143 — RESOLVED, #1562 merged `f7b685de` (2026-07-31).** No longer gates the migration.
> The floor now nets the offset, and `loanCosts.ts` **fetches the offsets itself** rather than
> trusting callers — a producer that a forgetful caller can starve is not fixed (the MON-028
> class). Ratchet: `tests/calculations/loanInterestOffsetNetting.test.ts`. The issue stays
> **`FIXING`, not VERIFIED** — no rendered number moves today, so its Ring-3 evidence is the T2
> migration run itself (§23.2.3: CI green is not verification). The original diagnosis, kept for
> the record:
>
> **MON-143 raised from the capture (gates the migration).** The relay surfaced
> `monthlyInterestFloor` per loan, and Guildford's floor is computed on the FULL balance:
> **1,964.67** against **384.45** net of its offset — 5.1×. Verified four-way in source:
> `propertyLoanInterest.ts:87`, `debt-analysis:465` and `portfolioEngine:428` all net the offset;
> **`resolveLoanMonthlyCost:199` — the canonical producer — does not.** Latent today (Guildford
> resolves via ACTUALS so never floors), but T2 migrates every consumer ONTO that producer, so it
> **must be fixed before the migration** or every surface inherits a known D21 breach.
>
> **G3 instrument shipped (#1557): the T2 compare relay.** `expectedMoves` cannot be declared
> from a test — previews bind to the dev DB, so the before/after values only exist in production.
> `/api/admin/matrix/golden-baseline/t2-loan-cost` measures both paths at once and returns, per
> declared path, the current value and the canonical one with its arithmetic. It also returns the
> per-loan **basis** (ACTUALS / DECLARED / INTEREST_FLOOR), the MON-142 effective-rate divergence
> (surfaced, not applied), and the `moneyFlowService.ts:382` skip **measured rather than inferred** —
> the `if (!minRepayment) continue` that drops both interest-only loans to $0 in the entity flow.
> Source-lock + financial-surfaces flagged its raw-`minRepayment` reads, correctly: measuring the OLD
> producer means touching it. Each is annotated with that reason rather than the lint being widened.
>
> **Census correction shipped with the relay (drift D49).** The producer census counted the
> **compare relays themselves** as producers. `app/api/admin/matrix/**` exists to MEASURE producers —
> each relay deliberately reads the OLD and NEW paths side by side — so counting them inflated the
> very metric the tranches drive down, and made every future tranche's instrument look like fresh
> duplication. The T2 relay scored **+1 on five quantities** (loanCost 31→32 · incomeRunRate 128→129 ·
> expenseRunRate 81→82 · savingsRate 30→31 · emergencyMonths 15→16) while deleting nothing.
> `app/api/admin/matrix/**` is now excluded and the seed re-run.
>
> **Read the resulting drop correctly: it is a MEASUREMENT CORRECTION, not deleted duplication.**
> expenseRunRate 81→79 · incomeRunRate 128→126 · payg 56→54 · grossIncome 38→36 · netIncome 34→33 ·
> emergencyMonths 15→14 · deductions 106→105 are **instrument sites leaving the count**. `loanCost`
> stays **31**. **No producer was deleted in this PR** — that is the migration, still to come. The
> census `history` entry carries the same warning so the number cannot be misread later.
>
> **§3.2 gets a FACT-first path.** `LoanTransaction` (Phase 51) already carries `interestPortion` /
> `principalPortion` — *"when known from the statement"* — plus `balanceAfter`. So the split is a
> D17-style hierarchy (statement fact → derive → undetermined), not pure derivation.
>
> **§3.1 first-pass enumeration.** NINE files already read the canonical producer
> (`/api/loans`, portfolio/snapshot, cashflow summary + intelligence, budget-analysis, both CFO
> scenario routes, debt-analysis, goldenBaseline). `masterFinancialService` is **not** among them.
> Candidate uncanonical readers to confirm (separating readers from legitimate writers):
> `masterFinancialService`, `lib/cfo/scoreCalculator.ts`, `lib/cfo/riskRadar.ts`,
> `lib/cfo/aiAdvisor.ts`, `lib/planning/debtPlanner.ts`, `lib/services/moneyFlowService.ts`.
>
> **Still open before declaring `expectedMoves`:** the relay compare on live data (§5), and Reza's
> approach call on MON-142.

| Gate | State | Evidence |
|---|---|---|
| G2 contracts | ✅ | D21 interest net of offset; D26 equity on full balance (the deliberate asymmetry) |
| G3 expectedMoves | ✅ | **CLEARED — `.audit/expected-moves-t2.json` committed.** 13 paths, every after-value produced by the derivation sweep (the real engines on live inputs with the canonical per-loan cost substituted), measured at `915704f0` on Reza's account (`loanCount === 5` asserted). Raw payload committed as its provenance: `.audit/captures/t2-loan-cost-915704f0.json`. Home budget tile Loans **$8,817 → $12,779** is in it; the per-loan split is carried in the capture per loan with its `newBasis`, derived by the resolver — not guessed. Two things the declaration pinned that a list would not have: the **unrounded-feed constraint** (rounded per-loan costs sum a cent low, which cascades) and the **rounding-convention correction** (annual leaves are `round(unrounded monthly × 12)`, so the measured `133,020.78` stands and T1's "derive from annual components" phrasing would have declared `.79` and failed G7) |
| G5 facts | ✅ | All three — cross-collateralised, fixed, mixed-purpose — answered from `prisma/schema.prisma`; see the §4 note above. Nothing asked of Reza (T1 §0 lesson) |
| G6 merged + deployed | ✅ | **PR #1575 MERGED `1e2317b`** (2026-08-03); prod deploy `dpl_Feqx7P9kdnVY7jKPuKgd52QafPuf` **READY** 07:5x UTC — so `vercel-build` ran the whole gate chain against PROD, including `prisma migrate deploy`. §17.2 runtime read: the only `error`-level line is the pre-existing `DEP0169 url.parse` DeprecationWarning already registered as **MON-147** on main — no new pattern. **Coverage caveat, stated rather than glossed:** the runtime-log read TIMED OUT after 468 bytes (the same limitation MON-147's own entry records), so "no new errors" covers the window that returned, not the full retention window. The rendered numbers are NOT verified by this — that is G8 — `masterFinancialService` on `resolveLoanCostsForUser`; `.filter(l => l.minRepayment && l.repaymentFrequency)` DELETED; census `loanCost` **31 → 30** (re-seeded, history says deleted-producer not measurement-correction); source-lock `RAW_MIN_REPAYMENT_COST` ratcheted **4 → 1** (the survivor is `buildPropertyMetrics` passing a declared row INTO `computePropertyCashflow`, which resolves the cost itself — a feed, not a re-derivation) |
| G7 baseline diff | 🟡 **HALF — and permanently so** | **The 15 declared paths are verified live** (VR-047B A2, `c485b05` — every after-value landed, both exactness traps included). **The whole-tree `MOVED-UNDECLARED` sweep CANNOT be run for T2, and the reason is a defect in our process, not a task still queued.** `diffBaselines()` (`lib/matrix/goldenBaseline.ts:244`) flattens BOTH sides to numeric leaves, so it needs a **tree** on the old side. What T1 left behind is a **hash** — `347006b9…`, a string in the prose of `VR-045.md`. The route's own comment states the tradeoff: *'a matching treeHash proves nothing moved anywhere. Localising a mismatch still needs the full tree.'* And `git log --all` over `.audit/golden-baseline*` returns **nothing** — no tree has ever been committed, on any branch, in the repository's history, even though the capture CLI writes one and prints **'COMMIT IT'**. The pre-T2 tree cannot be re-captured: the code has changed and the live data has moved on. Raised as **MON-157** (§21.2.2 rule-4 failure — the instrument's reference lived in a session instead of the repo). **What IS being done:** `docs/verification/briefs/MATRIX_G7_REFERENCE_CAPTURE.md` commits the full tree at the current commit, so **T3's G7 runs as designed**. That closes the hole forward; it cannot reopen T2's. **Declaration amended to 15 paths BEFORE the migration** (opening commit): `debt.summary.totalRepayments` + `.byType.*.repayments` were an unswept sibling of a swept block |
| G8 Ring-3 | ✅ | **PASS across two runs, and it needed both.** **VR-047** (`docs/verification/runs/VR-047.md`) read the rendered half in Reza's own session: Home's budget tile reads **$12,779**, matching `/dashboard/expenses` — two screens, one number, for the first time. Downstream figures reconcile to their derivations ($11,085 Saved · $358/day · 43.734% · 50.4183%), and the regression cluster is byte-identical **including `healthScore` 53**, which the migration PR predicted by computing the clamp rather than hoping. It could reach neither §2 nor the build precondition — both need the admin relay, which the account-first law forbids opening in that profile — so it was `PARTIAL`, not `PASS`. **VR-047B** (`docs/verification/runs/VR-047B.md`, `c485b05`, `matrix:check` exit 0) closed the producer half from the second Chrome profile: build precondition `paths: []` (the migration having landed — the relay now compares the canonical path against itself), all 15 declared paths landed with both exactness traps (`annualLoanRepayments` **153,351.51** not …48; `annualCashflow` **133,020.78** not .79), and **the four-expression identity HOLDS** — `cashflow.monthlyLoanRepayments` · `debt.metrics.monthlyRepayments` · `debt.summary.totalRepayments` · `quickMetrics.monthlyLoanRepayments`, three byte-equal at **12,779.292814353912** and the fourth that same value rounded at the producer. Before T2 those four agreed only because they all read the same wrong thing; a correct-looking tile could never have established it. `byType` keys unchanged and summing bit-identical to the total. Two findings came back and both were acted on in the VR-047B consumption PR: the relay compared a **rounded** old value against an **unrounded** new one (`deltaMonthly 0` beside `deltaAnnual 0.03`) — fixed, verified in source first; and one quantity carried at two precisions in a single snapshot — **MON-154**. A third, earlier VR-047B returned FAIL on `INSTRUMENT_UNREACHABLE` and recommended an auth change; it is **withdrawn in full** — the relay had been called by address-bar navigation instead of a page-context fetch, and no code change was needed (**MON-155** records the dead `admin_session` reader that made the wrong story plausible; every handout now states the fetch form). **MON-143 → VERIFIED** on this evidence. **MON-130 stays `FIXING`** — see the note below. Handouts: `docs/verification/briefs/RING3_T2_LOAN_COST.md` (rendered half) + `docs/verification/briefs/MATRIX_T2_ADMIN_RELAY.md` (admin half), both committed per §3.0b — a build section is done when the instrument for checking it exists |
| G9 census published | ✅ | `loanCost` 31 → 30 in `.audit/producer-census.json` history, **with the honest reading attached**: 30 is not 1, and the note names why the other 30 sites cannot move inside this contract |
| G10 regression cluster | ✅ | VR-047 §4 — the `mustNotMove` cluster byte-identical, `healthScore` **53** included. VR-047B adds the producer-side half: the T1-frozen income denominator unmoved at **25,346.550650921665**, and all five per-loan costs byte-identical to the `915704f0` capture with MON-143's offset-netted floor intact (Guildford **384.45** against a **303,889.96** offset) |
| G11 issues closed on own evidence | ✅ | **MON-143 → VERIFIED** on its own numbers: Guildford's floor 384.45 against a 303,889.96 offset, no per-loan cost moved — the live evidence §23.2.3 requires and CI could never supply. **MON-130 → VERIFIED, narrowed first** (Reza decision **D50, option A**, 2026-08-04). Its title and `rootCause` now name the one producer #1575 actually migrated; the other **11 producers / ~30 raw-read sites** move to **MON-156** with the producer list intact. This is the difference between closing an issue and closing over one: Lever 2 hides the surfaces those eleven feed, which is an **exposure** control, not a **defect** control — the numbers are still wrong, they are merely off-screen, and a hidden wrong number returns the moment a surface is un-hidden. Verified on VR-047 (rendered) + VR-047B (producer) together. **NOT `CLOSED`** — §23.2.6 promotion has the Ratchet test in CI and the Neomatrix delta, but T2's G7 cannot be completed (see the G7 row / MON-157) |
| G1, G4 | — | |

> **One table, deliberately (Matrix instruction, 2026-08-03).** This section carried TWO gate tables
> that **contradicted each other**: the first read `G5 ✅` but left `G1–G4` blank; the second read
> `G3 ✅ CLEARED` but `G5 ❌`. Each was fresher on a different gate, so neither was correct alone and
> reading either in isolation gave a wrong answer. That is not hypothetical — a session on 2026-08-03
> read the blank `G1–G4` row, concluded G3 was still open, blocked the T2 migration on a capture that
> had been committed since #1565, and put "run the T2 capture" in six consecutive task lists before
> the Matrix caught it. The merged row above is the single state of record; if a gate's state changes,
> it changes HERE and nowhere else. (§6's Tranche 2 heading is the *change record* — a PR-by-PR
> history, not gate state — and is deliberately separate.)


**Also in scope:** the Q1 rate-unit bug at `EntityCashflowSummary.tsx:693` — see the drift log, §4 D3.

### Tranche 3 — expense run-rate (MON-129) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G1 preconditions | ✅ | **CLEARED — MON-135 merged (#1538) and is `VERIFIED` in the registry** (VR-042 §1 PASS, 48 figures zero movement). This row read ❌ *"MON-135 must merge first"* until 2026-08-03; it had been stale since #1538 landed, and the same ledger's MON-135 section already recorded it DONE — a contradiction inside one document, caught by the Matrix |
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
| G5 facts | ❌ | **Audited 2026-08-03 (#1569):** `Property.type` answers rented-out vs residence, so that half is a READ not a question. The co-owned-as-a-**business** half has **no home in the schema — MON-144**, so it cannot be determined from data for any property until a field exists. Original entry: Which properties are owned-and-rented-out vs tenanted residence (D26) · **any co-owned property held as a rental *business*** (D42 C1 — changes the attribution rule) |
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

**D48 — VR-041's $12,779 acceptance did not cover contractual interest (2026-07-31).**
VR-041 verified the aggregate against the five per-loan rows, which reconcile *to each other*. It
never compared any of them to `principal × rate ÷ 12`. Doing that during T2's §2.1 investigation
surfaced MON-142 — both IO loans repaying ~0.937× their stored-rate interest. **The $12,779 is not
wrong** (the actuals are what was paid), but the coverage claim was narrower than it read. Recorded
per the T2 brief §7, which asked for this to be logged as a coverage gap rather than discovered
later. Lesson: a set of figures reconciling to each other is not evidence they reconcile to the
contract that generates them.

**D49 — the Neomatrix gates make every anchored-file edit a two-artifact edit, and I nearly escalated
that as a blocker instead of reading the precedent (2026-07-31).**
MON-143 touched two files carrying Layer-1 anchors. That trips *two* gates at once, and the pair form
a catch-22 if read naively:

- **`check-layer0-coverage`** hard-fails on ANCHORED DRIFT — the file's bytes changed since Layer 0
  was extracted, so the meaning layer is claiming things about code it has not seen.
- **`check-binding-coverage`** resolves each Layer-1 line against **Layer 0's** recorded symbol line.
  Layer 0 is frozen at `4ae03705`. So re-pinning an anchor to its *true* current source line — which
  §21.2.1 requires — makes this gate fail, because Layer 0 still holds the old line.

Satisfy one and you break the other; the documented remedy (`npm run neomatrix:graphify`) shells out
to `graphify`, a **local-only CLI absent from this environment and from CI**. My first read was that
this blocked the PR and needed Reza's call, and I hand-waved a manifest rehash as "dishonest" and
reverted it. **Both judgements were wrong.** `d5c9434f` (MON-140) had already solved exactly this:
re-pin Layer 1, shift the moved Layer-0 symbol lines, rehash the manifest, leave `builtAtCommit`
honest. It is a **targeted patch of a generated artifact, not a regeneration**, and it is sound
*provided the patch is verified against source rather than fitted to the gate*. So this PR shifts all
10 moved Layer-0 nodes by the exact diff-hunk offsets and then **asserts each one's label is present
at its new line in the current file** — 17/17 nodes in both files land, including the 7 the gates
never look at. A patch that only moved the two gated anchors would have passed CI and left the
artifact selectively true.

**RESOLVED 2026-08-03 — Reza chose option A: the symbol gate resolves against SOURCE.**
`check-binding-coverage` now finds the symbol's declaration in the current file and compares the node's
claimed line to that, instead of to Layer 0's frozen record. The catch-22 is gone: re-pinning an anchor
to its true line — which §21.2.1 requires — no longer fails a gate. Nothing is lost, because the property
the old behaviour protected (Layer 1 only claims things about code Layer 0 has seen) is enforced by
`check-layer0-coverage`'s ANCHORED DRIFT check, a different gate.

**It found two wrong anchors on its first run.** `input.InvestmentAccount.cashBalance` claimed
`prisma/schema.prisma:2271` — a line reading `ELECTRIC`, inside a *different* model — and
`input.NetWorthSnapshot` claimed 3529, a `createdAt` field 23 lines above the model it names. Both had
passed every build, because the frozen Layer 0 agreed with the stale line. Re-pinned to 2294 and 3552,
verified in source. Gate back to 188/188, and re-verified to still fail on injected drift (a deliberate
+40-line perturbation was caught and named). The migration tax this drift entry describes is therefore
gone — the seven T2 targets need no hand-patched artefacts.

**What was NOT fixed (the original entry, kept because it is the reason the fix exists).** Every T2 migration target —
`masterFinancialService`, `loanAggregator`, `moneyFlowService`, `contextBuilder`,
`cashflowOrchestrator`, `propertyCashflow`, `loanCosts` — is Layer-1 anchored (checked: 169 anchor
files). So the migration hits this on **every file it touches**, and each one needs the same manual
two-artifact patch. That is a real tax on the tranche and a real chance to get an artifact subtly
wrong. The durable fixes are either a CI-runnable extractor or narrowing the symbol-anchor gate to
resolve against **source** rather than a frozen Layer 0 — the latter would remove the catch-22
entirely, since source is what the anchor actually claims. **Neither is done. Recorded, not assumed
covered** (the §4 gate-coverage question, applied to my own gates).

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

## §6 The change record — every change shipped under MON-131

> **Reza directive 2026-07-31:** *"I need you to document all changes for MON-131 and keep it updated."*
>
> **Why it lives HERE and not in a new file.** §1 already declares this ledger the programme's state
> of record — *"if this file and any other artefact disagree, this file wins."* A second MON-131 history
> document would be a §12.2.1 violation at the documentation layer: two sources of truth for
> "what happened to MON-131." The gate state (§3) and the change record (§6) are the same record
> viewed two ways — where the programme IS, and how it GOT here.

**The rule.** Every merged PR that touches MON-131 — engine, contract, instrument, brief, run, registry
move, decision — gets a row here **in the same PR**. Enforced by `npm run mon131:check` (§7).

**On SHAs — the convention, corrected 2026-07-31.** This section first read *"with its SHA. A row
without a SHA is not a row."* That is unenforceable at authoring time: a PR cannot know its own merge
SHA. The workable rule: the authoring PR writes its row with `*(this PR)*`, and **the next MON-131 PR
backfills the SHA** as its first act. Two rows below were backfilled that way (#1554 `ad2bfd3c`,
#1555 `225edd18`) — the flaw was caught by a routine check finding the record failing its own rule.

### Instrumentation + Phase A (the foundation)

| Date | PR | SHA | What changed | Numbers moved? |
|---|---|---|---|---|
| 07-29 | #1525 | — | T−1/T0: golden-baseline capture+diff · producer-census ratchet · source-lock extended to `lib/` | No |
| 07-29 | #1526 | — | T−1b **the Matrix Relay** — capture/diff to `lib/matrix/goldenBaseline.ts` + 3 admin routes; takes Reza's terminal out of every capture loop | No |
| 07-29 | #1534 | `4e6cdd5c` | **Phase A** — `NUMBER_INVENTORY.md` (68 quantities, one verdict each) + 48 contract files, each adversarially re-reviewed | No |
| 07-30 | #1535 | `89ecfd7a` | Decisions register **D17–D41** consolidated | No |
| 07-30 | #1537 | `c07669e5` | Decision corrections + **D42–D47**; the **Build Specification** (all 7 tranches designed in advance); the **Tranche Ledger** (this file) | No |
| 07-30 | #1539 | `d3d7e147` | The handover — VR-040 recovered, ledger corrected (**D5/D6** + §4b register gap), design made discoverable | No |

### Preconditions

| Date | PR | SHA | What changed | Numbers moved? |
|---|---|---|---|---|
| 07-29 | #1529/#1530/#1532 | — | **MON-134** health-trend determinism — `Math.random()` fabrication removed, real `calculateTrend` + snapshot table | Yes (a fabricated trend became honest) |
| 07-30 | #1538 | `b1af5021` | **MON-135** AI categoriser stops asserting one-off — tri-state `isRecurring` (T3 precondition) | No — changes what a default MEANS |

### Tranche 1 — income (MON-128 · MON-137 · MON-138 · MON-140) — **DONE**

| Date | PR | SHA | What changed | Numbers moved? |
|---|---|---|---|---|
| 07-30 | #1541 | `5367209e` | **T1 START GATE** — §1.1 leaf-jump ruled (D8 partial first capture), `?format=hash` baseline persistence, `expectedMoves` committed | No |
| 07-30 | #1542 | `3028c08a` | **T1-A scaffold** — per-FY PAYG Schedule 1 config home · greenfield HELP/STSL engine · the banked L1/L2 stack `lib/income/banked/*` · FACT-field migration · the T1 compare relay | **No — by contract** |
| 07-31 | #1545 | `f1c87afb` | **T1-B THE FLIP** — every consumer onto the ONE banked producer; five legacy income producers deleted; §1.1 two-pass withholding credit (11,129 → **43,004**, owing $26,657 → **refund $5,218**); MON-138 floor-based band selection | **YES — the tranche's number-moving PR** |
| 07-31 | — | `1fe9d4a5` | **VR-044 recorded — FAIL.** 22 declared paths missed; two Income figures 3.1× apart live on Home | — |
| 07-31 | #1548 | `e4040dbb` | **MON-140 repair** — `BANKED_INCOME_SELECT` becomes the ONE definition of the engine's input contract (§12.2.1 applied to the INPUT); ratchet `tests/income/bankedInputFeed.test.ts` | **YES — completes the flip** |
| 07-31 | #1550 | `3cdaa8c4` | **VR-045 handout** — the Ring-3 instrument for the repaired tranche | No |
| 07-31 | #1551 | `8a556efc` | **VR-045 recorded — PASS.** 22/22 land · Home contradiction gone · cluster byte-identical · MON-138 Ring-3-reachable | — |
| 07-31 | #1554 | `ad2bfd3c` | **T1 CLOSED** — registry ×4 → `VERIFIED`; `expectedMoves` `annualCashflow` corrected 180,572.52 → **180,572.50** (VR-045 §2.1 — the declaration was wrong, not the engine); handout §3 corrected (VR-045 §6 — four income-derived figures were wrongly listed as "must return"); playbook gains the derived-figures lens; **MON-141 raised** (VR-045 §7) | No |

### What T1 actually changed for the user

Monthly income **$41,303 → $25,347** · monthly saved **$27,987 → $15,048** · tax **owing $26,657 → refund $5,218** · PAYG withheld **$11,129 → $43,004**. Every income surface now reads one producer.

### Tranche 2 — loan cost (MON-130) — IN BUILD

| Date | PR | SHA | What changed | Numbers moved? |
|---|---|---|---|---|
| 07-31 | #1553 | `16abe093` | The T2 build brief (The Matrix) | No |
| 07-31 | #1555 | `225edd18` | **Pre-build research**: §2.1 resolved (algorithm cleared by probe; stored rate is the factor) · §4 G5 facts settled from schema · §3.2 FACT-first path found in `LoanTransaction` · §3.1 first-pass enumeration · **MON-142 raised** · drift **D48** · `mon131:check` family list → range (it had already gone stale on MON-142) | **No — research only** |
| 07-31 | #1556 | `bcf458b9` | **MON-142 v1** — the effective-loan-rate engine (evidence > typed rate; A6-allowlisted, no consumer) + two `mon131:check` blind spots fixed (hardcoded id list → range; registry ADDs-only → structural per-issue comparison) + these two SHA backfills | **No — engine only** |
| 07-31 | #1557 | `2627dcdf` | **T2 compare relay** — `/api/admin/matrix/golden-baseline/t2-loan-cost`: runs the OLD loan-cost producers and the canonical `resolveLoanCostsForUser` on the SAME live data, returning per-path before/after + per-loan basis + the measured `moneyFlowService:382` interest-only skip. This is what makes T2's `expectedMoves` COMPUTED, not predicted | **No — reads both paths** |
| 07-31 | #1558 | `f897481c` | **T2 relay capture handout** for the Matrix (`docs/verification/briefs/MATRIX_T2_RELAY_CAPTURE.md`) — one GET, identity-asserted (`loanCount === 5`), payload returned verbatim; §5 states falsifiable predictions so a mismatch is the finding | **No — a handout** |
| 07-31 | #1559 | `7be30bef` | **First T2 capture returned + relay repaired.** Capture at `2627dcdf` measured old **8,816.65** → new **12,779.29** (Δ +3,962.64/mo, +47,551.71/yr). The Matrix found the relay MISSING the `annualCashflow`/`annualSurplus` pair — a $47,551.71 undeclared move that G7 would have stopped the tranche on. Added. D18/X3 savings-rate shape recorded as a stated DEFERRAL. **MON-143 raised** (D21 breach in the canonical interest floor) | **No — relay repair** |
| 07-31 | #1561 | `8bed66b6` | **Second capture + THE DERIVATION SWEEP.** Re-capture confirmed the annual pair landed (180,572.50 → **133,020.79**) but found **two more** undeclared movers, and reading the assembly surfaced a **fifth**. Root cause was the METHOD: paths were enumerated from a hand-written list. Replaced with a sweep that re-runs the REAL engines on the REAL inputs with the canonical per-loan cost substituted, and diffs — the declaration is now complete BY CONSTRUCTION | **No — relay only** |
| 07-31 | #1562 | `f7b685de` | **MON-143 — the canonical interest floor nets the offset (D21).** `resolveLoanMonthlyCost` was the only one of four interest derivations charging the floor on the FULL balance; `CashflowLoan` carried no offset field at all, so the engine was *structurally incapable* of netting and no fixture could express the case. Threaded `offsetBalance` through the type, and made `loanCosts.ts` **fetch the offsets itself** (the MON-140 input-feed shape) so no caller can starve the engine by forgetting to pass them. Ratchet test pins the corrected floor, pins the pre-fix **$1,964.67** as WRONG, and pins the **D21/D26 asymmetry both halves**. **Gates the T2 migration** — migrating every consumer onto a producer with a known D21 breach would have propagated it to all of them at once | **No rendered number today** — Guildford resolves via ACTUALS so it never floors. Latent until an offset loan loses its linked repayments; live for every surface the moment T2 wires them |
| 07-31 | #1563 | `915704f0` | **Ledger backfill** — #1562's SHA into §6 and the T2 section's *"MON-143 gates the migration"* note flipped to RESOLVED, with the original diagnosis kept beneath it (the record of what was wrong is why the ratchet test exists). MON-143 deliberately stays `FIXING`, not `VERIFIED`: no rendered number moves on live data, so no Ring-3 run applies — its verification is the T2 migration run itself (§23.2.3) | No — documentation |
| 08-03 | #1579 | `PENDING` | **Two Reza decisions recorded, both narrowing the finish line.** **(1) Lever 2 TAKEN** (`docs/strategy/MON-131_SCOPE_FILTER.md` §4): strip the Money-Flow Sankey WIDGET from `/dashboard/activity`, keep its INTAKE path. That removes `moneyFlowService`'s loan leg from the v1 surface, so **T2-B's capture, declaration and migration are PARKED** — the scaffold (seam + relay) stays merged and inert, one request away if the widget is ever un-hidden. What survives is the scope filter's own finding: `loanCost` is SPLIT and the KEPT half is `masterFinancialService` feeding the property pages, which #1575 already migrated. **T2's kept half is therefore done pending VR-047's §2.** **(2) MON-150 RETRACTED** — Reza: *'the depreciation schedule for both properties are the same as they are identical duplexes.'* Two identical builds on adjacent subdivided lots produce identical QS figures, so agreement to the dollar is the EXPECTED result. Retracted, not closed-as-fixed: nothing was wrong. Kept in the registry with the reasoning, because identical-buildings and one-report-attached-twice are indistinguishable from inside the app and only the owner can tell them apart — raising it as a question rather than asserting a defect was the right call either way. The admin handout is amended to run **PART A only**, with `sectionsNotRun: ["PART B"]` and verdict `PARTIAL` — the validator rule this same PR added | **No — decisions + records only** |
| 08-03 | #NEXT | `PENDING` | **VR-047 consumed + T2-B scaffold.** The Ring-3 run's account-first half PASSED and its §2 half could not run, so the record says **half**, not done — G8 is 🟡 and both issues stay `FIXING`. Five findings registered from it (**MON-149** Laguna counts one of two recurring income rows, ~$6,948/yr uncounted · **MON-150** Lot 1 and Lot 2 both claim depreciation of exactly $12,799 from identically-sized files, a data question only Reza can settle · **MON-151** per-property tax interest ignores the offset — the D21 breach in a second producer · **MON-152** Hunter Premium renders $797 on one card and $812 on three others · **MON-153** three health scores, 53/56/25). Two record corrections the run forced: VR-046's B4 was WRONG (`/dashboard/investments/super` does render a total — T7's blocking fact is $0 and readable), and the handout's §3 saving-rate row was **mis-specified and could not land** (no Home surface renders `cashflow.savingsRate`; Home reads the trailing-12mo actuals 1.9% and always did) — withdrawn, with the reasoning kept, because a prediction that CANNOT land forces a run to choose between a false PASS and a false FAIL. **`matrix:check` tightened**: `sectionsNotRun[]` is now required on a ring3 and a non-empty one forbids `PASS` (new verdict `PARTIAL`). VR-047 passed every prior rule while admitting the deciding section never ran — no check had failed and the finding was `high`, not `critical`. **T2-B SCAFFOLD** (moves nothing): a `loanCostBasis` seam on `getMoneyFlow` — DECLARED default byte-identical, CANONICAL reads `resolveLoanCostsForUser` — plus the compare relay `/api/admin/matrix/golden-baseline/t2b-money-flow` diffing every numeric leaf of two REAL engine runs. The seam is inside the producer rather than replicated in the relay because `getMoneyFlow` does its aggregation, surplus flooring and edge building inline; a relay that re-implemented that would compare a replica to the original (the MON-035 parity failure). Ratchet: `tests/golden/ring2.moneyFlowLoanBasis.test.ts` | **No — scaffold + records only.** `loanCost` still 30; the default basis is unchanged |
| 08-03 | #1575 | `1e2317b` | **T2 MIGRATION — `masterFinancialService` reads the canonical resolver; the filter is DELETED.** `loanCost` **31 → 30**, the programme's first real producer deletion (the 07-31 fall was a measurement correction, and the census history now says which is which). The snapshot's loan leg is `resolveLoanCostsForUser` — UNROUNDED, at MONTHLY, for **every** loan — feeding BOTH `calculateCashflow` and `aggregateLoanRepayments`/`calculateDebtMetrics` from one array, because building it twice is the MON-140 shape. **Declaration AMENDED FIRST, as the PR's opening commit** (G3 ordering visible in the history): the sweep diffs `cashflow.*`, `debt.metrics.*` and the quickMetrics mirrors, but `snapshot.debt` has TWO children and **`debt.summary` was never swept** — yet `masterFinancialService.ts` assigns `quickMetrics.monthlyLoanRepayments = debtSummary.totalRepayments`, a DECLARED leaf, so the summary moved by construction and would have hit G7 as MOVED-UNDECLARED. Found by reading the assembly, not by a capture. Two paths added (13 → 15); the relay's sweep now diffs `snapshot.debt` whole so the class cannot recur. `healthScore` **checked, not assumed** — it is fed the moved figure, but its savings-rate component clamps at 100 both sides (59.37×5 and 43.73×5), so `mustNotMove: 53` stands. **Scope stated plainly: master ONLY.** The other 30 sites move surfaces this sweep does not cover (moneyFlow `byEntity`, the CFO score + risk trees, reports, health — separate golden-baseline captures), and each needs its own declaration (**T2-B**); migrating them here would have produced MOVED-UNDECLARED by construction. Ratchet: `tests/golden/ring2.loanCostFeed.test.ts` — Ring 2 through the REAL assembly on a golden clone carrying an interest-only loan with no declared repayment, the shape the shared golden household lacks (which is why it could not fail on this class). Handout: `RING3_T2_LOAN_COST.md`. Neo-sync: the `resolveLoanCostsForUser → getMasterFinancialSnapshot` edge modelled, 4 anchors re-pinned, `neomatrix:check` green. Also **`scripts/neomatrix/patch-layer0.mjs`** — D49's per-file Layer-0 tax, committed with verification instead of a third throwaway script; it found **MON-148** on its first run (a Layer-0 node for `adjustPropertyRentalIncome()`, deleted in T1-B, invisible because the gate reconciles files and hashes, never symbols) | **YES — the 15 declared paths.** Home's budget tile $8,817 → **$12,779**, matching `/dashboard/expenses`. Unverified until Ring 3 |
| 08-03 | #1570 | `f5e24f5b` | **T2 Stage-1 INPUT-FEED census** (`MON-131_T2_INPUT_FEED_CENSUS.md`) — the step FIX_PROTOCOL §3 requires before any fix code. Finding: **every producer issues its own Prisma `select` and no two agree** — there is no shared loan-row contract, so each caller decides what the cost calculation is allowed to see. `moneyFlowService` selects **three columns** (`ownerEntityId · minRepayment · repaymentFrequency`), which is *why* the two IO loans and HECS read $0 and the $3,792.92 understatement exists; `contextBuilder` selects `principal` **alone** and cannot compute a cost at all; `masterFinancialService` gets 11 columns but **no linked repayments and no offset balance**. `loanCosts.ts` is the ONLY producer that fetches what the calculation needs. Consequence for the migration, recorded before writing it: repointing consumers is NOT enough — a consumer passing its own narrow row would starve the engine, which is the MON-140 one-engine-two-feeds shape T1 already paid for | **No — research only** |
| 08-03 | #1569 | `PENDING` | **The four "facts" audited, and one of them is a defect.** Reza directed that T4–T7's blocking facts be derived from the app rather than asked of him. Auditing `prisma/schema.prisma` per fact: **five of six already have a home** — `DepreciationSchedule` (D11's unit ambiguity lives on its `rate Float`) · `Property.type` HOME/INVESTMENT/RENTAL · `Property.genuinelyAvailableForRent` + `availableDaysPerYear` (added by T1 under X7/D43) · super balance = Σ `SuperannuationAccount.currentBalance` · `TaxPosition.division293Tax`. The sixth — whether a co-owned property is held as a rental **BUSINESS** (D42 C1, which changes the treatment) — has **no home at all**: `OwnershipGroup`/`OwnershipStake` record shares only. Raised as **MON-144** rather than answered in chat, because an answer given in a message is not a source of truth for anything. Also ships the **MON-142 rate-divergence handout** (`docs/verification/briefs/MATRIX_MON142_RATE_DIVERGENCE.md`) — the first written under the §3.0b/§3.0c contract, confirming the stored-vs-implied rate gap FROM THE APP'S OWN DATA | **No — audit + instrument only** |
| 08-03 | #1566 | `PENDING` | **One instrument, one denominator** (Matrix instruction) + the reference-numbers SCOREBOARD. `REFERENCE_NUMBERS.md`'s hand-recorded `Census` column removed from all 29 rows — it was a SECOND instrument measuring producer counts and had drifted into contradicting the ratchet on the same names by up to 5× **in both directions** (medicareLevy 4 vs 20 · cashflow 27 vs 57 · loanCost 24 vs 31 · depreciation 22 vs 15 · superCap 16 vs 10). Neither was lying — they are different instruments — which is exactly why §12.2.1 says one datum one source rather than "keep the accurate one". Counts now live only in `.audit/producer-census.json`, rendered by the new generated `REFERENCE_NUMBERS_SCOREBOARD.md`. Also: **T3 G1** ❌ → ✅ (stale on a precondition MON-135 cleared in #1538 — the same ledger already said DONE above it) and **MON-134** `FIXING` → `VERIFIED` (stale since 07-29 with an unresolved `#PR-3 (this PR)` placeholder; real PRs #1529/#1530/#1532, ratchet test + semanticKey both verified to exist before advancing; NOT closed — §23.2.6 promotion evidence is incomplete) | **No — record only.** No producer deleted; `loanCost` still 31 |
| 08-02 | #1565 | `e8cc3c12` | **G3 CLEARED — the T2 contract is declared.** The third capture returned VALID at `915704f0` (`loanCount === 5`; the Matrix withdrew its own earlier capture for failing the §1 build precondition — it was stamped `8bed66b6`, before the MON-143 fix). `.audit/expected-moves-t2.json` + the raw payload committed. **13 paths, all five previously-missed among them without being named** — the sweep works. **MON-143 confirmed fixed from the other side:** Guildford's floor 1,964.67 → 384.45 and NO per-loan `newMonthly` moved between the two captures. Two findings the capture forced: (1) the **unrounded-feed constraint** — rounded per-loan costs sum to 12,779.28, a cent below the engine's 12,779.29, so the migration must feed unrounded values or G7 fails; (2) the **rounding-convention correction** — the engine computes annual leaves as `round(unrounded monthly × 12)` (`cashflowOrchestrator.ts:265`, read in source), NOT from annual components, so `annualCashflow` is the measured **133,020.78**; T1's written rule would have declared `.79`. Relay `notes[5]` corrected — it still asserted the MON-143 breach in the present tense | **No — declaration only.** The migration is the move |
| 07-31 | #1564 | `997e0d99` | **Record closure** — this row + #1563's, a changelog session entry, the hub's stale *"blocked on re-capture and MON-143"* summary corrected, and the T2 relay handout amended for the THIRD capture (§4b described the second; the build precondition and the sweep's predictions were live only in chat, which §21.2.2 rule 4 forbids) | No — documentation |
| 08-03 | #1571 | `PENDING` | **MON-142 RE-DIAGNOSED — the arrow was backwards** (Reza, 08-03: *"repayments are from before the interest rates were changed. I have changed the interest rates on app but have not updated the transactions."*). Neither figure was stale: **6.2697% is what the loans were at when those repayments were made; 6.69% is what they are at now.** VR-046's own **F1 impact claim is WITHDRAWN** — ~$2,983.92/yr of overstated deductible interest (~$1,104/yr tax) assumed the transactions were truth and the rate stale; with the direction settled, **stored-rate × balance is CORRECT for a forward projection** and the tax page's 15,253 / 32,246 stand. Root cause reassigned from "stale rate" to the **schema asymmetry**: `Loan.interestRateAnnual` is an UNDATED scalar while `LoanTransaction.date` is dated, so a time-varying FACT is stored as one value and the app renders a contradiction instead of a history. **MON-145 raised** (dated rate — a row per `(loan, effectiveFrom)`; the scalar becomes a DERIVED read; MON-142's alert is its FIRST CONSUMER, so MON-142 is now `blockedBy` MON-145). **MON-146 raised** (`/dashboard/expenses` renders every rate 100× too small — the raw decimal with a `%` suffix; display-only, no derived number moves). **T2 scope +F1c:** the migration must record **which basis** produced each cost and **the age of the actuals** consumed — `resolveLoanMonthlyCost` is actuals-first with NO recency requirement, so a repayment from an earlier rate epoch silently becomes canonical. Pre-declared data movement (NOT a regression): importing current-rate statements moves Broadbeach 1,191.25 → ~1,271.10 and Thornland Lot 2 2,518.34 → ~2,687.15. **VR-046 FAILED `matrix:check` on 4 counts** (null `sha`; `expectedUserId` vs `userId`; `identityAssertion` shape; `coverage.verified` missing) — nothing here rests on the payload, only on Reza's ruling; the `sha` failure is a genuine **contract contradiction** (account-first runs are required, but no user-side surface exposes the deployed commit) awaiting his ruling | **No — re-diagnosis + registry only.** No producer changed; `loanCost` still 31 |
| 08-03 | #1571 | `PENDING` | **RATE PRECEDENCE RULE recorded (Reza, 08-03)** — *"the actuals (transactions) will be the source of truth; in the absence of actuals the declared rate should be used. Note that the rates from the bank change and the applied rate to the past transactions might be different to the current existing rate in the app."* Recorded as **PERIOD-SCOPED, not a flat precedence**, because the flat reading is the trap that produced the withdrawn VR-046 F1: actuals are authoritative **for the period they cover** (they evidence the rate in force THEN); the declared rate is authoritative wherever no actuals exist — **which always includes the future**. A forward projection uses the DECLARED rate, since a period that has not happened has no transactions; reading "actuals win" flatly would project FY26-27 at the superseded 6.2697% and re-assert the ~$2,983.92/yr claim that was already withdrawn. Confirms the D17 FACT hierarchy in `effectiveLoanRate.ts` (charged-interest ledger → IO repayment → stored rate) and confirms the tax page's forward 15,253 / 32,246 are correct on the declared rate. **The rule is UNIMPLEMENTABLE until MON-145 lands** — "the rate in force when this transaction occurred" has no representation while `Loan.interestRateAnnual` is an undated scalar | **No — rule record only** |
| 08-03 | #NEXT | `PENDING` | **VR-046 F1 CLOSED AT SOURCE — and a notes-field repair.** Read the full chain the Matrix said to confirm before acting: `deductiblePropertyLoanInterest` (`propertyLoanInterest.ts:70`) is **already actuals-first** — `actualInterestCharged` finite and ≥0 returns `basis:'actual'`; the stored-rate path (`interestBearing * rate`, :87) is only the FALLBACK. The feed: `userTaxPosition.ts:173` builds `actualInterestByLoan` from a DB `_sum` over charged-interest rows and :187 passes `… ?? null`; the two IO loans have **no** such rows, so they resolve to null and the engine correctly takes the theoretical branch. **So F1's 'live number defect' is wrong at the SOURCE level too, not merely superseded by Reza's ruling** — the engine already conforms to his rate-precedence rule and there is nothing here to fix. Residual tied to a verified anchor: :87 applies TODAY's rate across a whole FY, which is the concrete apportionment unlock for MON-145. **Self-caught defect in my own prior edit:** `ISSUES.json.notes` is a STRING, and #1571 appended to it with `.concat([...])`, so array elements were comma-coerced and one ran straight into the next (`…both loans.Reza rule…`). No text was lost; formatting repaired on MON-142/145/146 and verified (0 comma-runs, 0 run-ons) | **No — verification + repair only** |
| 08-03 | #NEXT | `PENDING` | **RULE A on the sha + the T2 gate tables de-duplicated** (Matrix instruction, 08-03). **Rule A:** `check-matrix-result.mjs` now permits `sha: null` under THREE required conditions — `kind === 'ring3'` (relay/golden captures read the relay, so they keep the hard requirement), `sha` **explicitly null** (an omitted field is an oversight; null is a claim), and a **substantive `shaNote` (≥40 chars)** stating why the commit could not be read. Resolves VR-046 F3's genuine contradiction: a Ring-3 run MUST be account-first, yet only the admin relay exposes the deployed commit. The Matrix also caught that the SUCCESS line called `parsed.sha.slice(0,8)` unguarded — it would have thrown on the happy path the moment null became legal; now prints `null (account-first)`. Verified three ways: real VR-046 payload PASSES, short `shaNote` REJECTED, `kind:golden` REJECTED. **De-duplication:** the T2 section carried TWO gate tables that CONTRADICTED each other — one `G5 ✅` with `G1–G4` blank, the other `G3 ✅ CLEARED` with `G5 ❌`. Each was fresher on a different gate. **This is the confirmed root of a real failure:** a session read the blank `G1–G4` row, concluded G3 was open, blocked the T2 migration on a capture committed since #1565, and re-issued "run the T2 capture" to Reza six times. Merged to ONE table (G2 ✅ · G3 ✅ · G5 ✅ · rest —) | **No — gate record + validator only** |
| 08-03 | #NEXT | `PENDING` | **Rule A pinned by CI + the validator made importable + MON-147 registered.** Rule A shipped in #1573 verified only by three HAND-RUN payloads — which does not survive the next edit. 16 tests (`tests/verification/matrixResultContract.test.ts`) now pin all three conditions, both boundaries (`shaNote` at exactly 40 accepted, 39 rejected), and a guard that the exemption did not weaken identity / coverage / checks. **Writing them exposed a second defect:** `check-matrix-result.mjs` ran its CLI body at import, so `import { validateMatrixResult }` called `process.exit(2)` — a module that exits when imported cannot be tested, which is exactly WHY Rule A shipped hand-verified. Wrapped in the standard `isMain` guard (same convention as `producers-census.mjs`); CLI behaviour unchanged and re-verified. **MON-147** registered (LOW, `changesNumbers: false`): prod logs a Node `DEP0169 url.parse` DeprecationWarning at **ERROR** level; zero grep hits in `lib/ app/ scripts/`, so the source is a dependency or the platform runtime and is recorded as **UNIDENTIFIED rather than guessed**. Evidence caveat kept on the entry: the runtime read TIMED OUT after 464 bytes, so 'every cold start' is inferred, not measured | **No — test + registry only** |

### Tranches 3–7 + closing — BLOCKED

No changes shipped. Rows land here as they merge.

---

## §7 Keeping it current — the mechanism, not the intention

> **KNOWN COVERAGE HOLE, found 2026-07-31 by Reza asking whether everything was documented.**
> This gate checks **only this ledger**. It does not check `docs/IMPLEMENTATION_PLAN.md`'s
> `Last updated` or `01_ACTIVE_WORKSTREAMS.md` §0·REF — so both drifted **five PRs** behind
> (#1555…#1559) while the gate stayed green on every one of them, because the ledger row was
> always present. The gate did exactly what it was written to do, and that was not enough.
>
> Widening it to cover the plan hub and the workstream spoke is the obvious next step and is
> **not done yet** — recorded here rather than left implicit, because an ungated rule is the
> failure mode this whole section exists to name.


`scripts/check-mon131-ledger.mjs` (`npm run mon131:check`, wired into the `docs-hygiene` workflow).

**What it enforces:** if a PR's diff against `main` touches any MON-131 surface — `lib/income/banked/**`,
`.audit/expected-moves-t1.json`, `.audit/producer-census.json`, `lib/matrix/**`, the MON-131 doc set,
`docs/verification/runs/**`, or a MON-131-family registry entry — then **this ledger must be touched in
the same diff**. It fails otherwise.

**What it deliberately does NOT do:** judge whether the row is *good*. A machine cannot tell a real
evidence row from a placeholder — that is §1's job and the reviewer's. It closes the failure mode that
actually recurs (the ledger silently falling behind), not the one it cannot see.

**Honest limit:** it is diff-scoped, so it cannot catch a MON-131 change that lands with no file
overlap at all. §1 still governs.

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
| 08-03 | #1580 | `e3a3715` | **VR-047B consumed — G8 CLOSED, and two findings acted on.** The producer half of the T2 Ring-3 came back from the second Chrome profile and PART A passed in full: build precondition `paths: []`, all 15 declared paths landed with both exactness traps, and **the four-expression identity HOLDS** (three leaves byte-equal at `12,779.292814353912`, the fourth that value rounded at the producer). `byType` keys unchanged and summing bit-identical to the total. **G8 ✅** on VR-047 + VR-047B together — neither half was sufficient alone, which is why both ran. **MON-143 → VERIFIED** (Guildford floor 384.45 against a 303,889.96 offset; no per-loan cost moved — the live evidence CI could never supply). **Finding 2 fixed, after verifying its mechanism in source rather than trusting the report:** the relay compared `cf.monthlyLoanRepayments` (rounded by the orchestrator) against the unrounded canonical sum — not, as reported, "annualised the rounded monthly". Pre-migration the 0.0028 residue was invisible against a $3,962.64 delta; post-migration both arms are the same producer, so it *is* the signal (`0.00` monthly, `0.03` annually). Now reads `debt.summary.totalRepayments`, comparing like with like. **MON-154** raised (one quantity at two precisions in one snapshot) and **MON-155** (`lib/admin/auth.ts:501` reads an `admin_session` cookie nothing writes — tagged `@deprecated`). **An earlier VR-047B is withdrawn in full:** it returned FAIL on `INSTRUMENT_UNREACHABLE` and recommended an auth change, having called the relay by address-bar navigation instead of a page-context fetch. Reza refused the diagnosis (*"you never had this issue in the past month"*) and the transcript settled it — all 39 successful relay calls used the fetch form. No code change was made. All three T2 handouts now state the fetch form explicitly. **MON-130 deliberately stays `FIXING`** — its kept half is verified, but its scope is twelve producers and thirty sites remain; Lever 2 hides those surfaces, which is out of v1 scope, not fixed | **No — record + relay repair only.** `loanCost` still 30 |
| 08-04 | #NEXT | `PENDING` | **D50 answered (option A) — MON-130 narrowed and VERIFIED, its residue carried as MON-156 — and G7 turns out to be unclosable for T2 (MON-157).** **D50-A:** MON-130's title and `rootCause` now name the ONE producer #1575 migrated (`masterFinancialService`); the other **11 producers / ~30 raw-read sites** become **MON-156** with the producer list copied verbatim and a re-verify-before-fixing caveat on the line numbers. The reasoning is recorded on both entries so it cannot be re-litigated: Lever 2 hides the surfaces those eleven feed, which is an EXPOSURE control, not a DEFECT control — folding them into a VERIFIED issue would have said they were fixed. **G11 ✅**. **MON-157 — the one that matters beyond T2.** Writing the G7 handout Reza asked for exposed that it cannot be run. `diffBaselines()` needs a TREE on the old side; what T1 left is a HASH (`347006b9…`, a string in VR-045's prose), and `git log --all` over `.audit/golden-baseline*` returns NOTHING — no tree has ever been committed, on any branch, ever, despite the CLI writing one and printing 'COMMIT IT'. The pre-T2 tree cannot be re-captured (code changed, live data moved on), so **T2's G7 stands at HALF permanently** and every prior tranche's G7 rested on either a CLEAN hash match or the declared-path check alone. §21.2.2 rule-4 failure: the reference lived in a session, not the repo. **The handout shipped is therefore a different one** — `MATRIX_G7_REFERENCE_CAPTURE.md` commits the full ~282 KB tree at the current commit (hash-verified on reassembly) and self-diffs it to prove the capture→serialise→POST→flatten→verdict chain end to end before T3 depends on it. **T3's G7 becomes runnable as designed.** Also: **MON-155** `changesNumbers` corrected true → false (auto-raise default; a dead auth branch produces no number, and leaving it true would have demanded a propagation test before it could ever be verified) | **No — records + one handout.** `loanCost` still 30 |

---
*Opened by The Matrix, 30 July 2026, at Reza's direction — "build anything that makes you keep on track
and avoid drifts from the plan." Indexed from `01_ACTIVE_WORKSTREAMS.md` §0·REF. Companion to
`NUMBER_INVENTORY.md`, `REFERENCE_NUMBERS_DECISIONS.md`, `decisions/D42_VERIFICATION_CORRECTIONS.md`
and `PROTOCOL_NUMBER_LEDGER.md`.*
