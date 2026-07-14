# MONITRAX VERIFICATION PLAYBOOK — NeoAudit Ring-3 operating manual

> Part of **NeoAudit** (platform blueprint: `docs/blueprint/NEOAUDIT.md` — rings/nodes, non-overlap roles, Eyes & Ears brief library, tooling register).

> **Canonical operating manual for verifying that every number Monitrax shows is correct — on synthetic data in CI and on Reza's real data in the live app.** Any Claude session can pick this up cold and run it. The standing rules live in CLAUDE.md Part 23; this doc is the *how*. When they disagree, CLAUDE.md wins.
>
> Reza directives (2026-07-11): *"I want to work towards zero fail and mistake on Monitrax, so the fixes should not break another thing. We should gain 100% correctness."* and *"For all issues we need to really find the root cause, fix and remove the culprit for future — do not add more code on top of the broken one."*

---

## 1. Why bugs still escaped (the honest diagnosis)

The 2026-07-11 real-data run (VR-001) proved the gap. Every prior gate verifies a *layer*:

| Existing gate | What it proves | What it CANNOT see |
|---|---|---|
| calc-audit fixtures (§22) | the engine's formula is right on synthetic inputs | whether the app actually feeds the engine the right inputs |
| Neomatrix A3 convergence (§21) | every surface traces to the SAME engine | same engine ≠ same **inputs** (MON-028: one route dropped the actuals) |
| Source-lock tests | the code contains the right call | whether the call's data is populated at runtime |
| §19.4 propagation tests | the engine's outputs reconcile internally | the API→JSON→page plumbing between engine and screen |

**MON-028 is the type specimen:** `computePropertyCashflow` was correct on all three surfaces; `/api/properties/[id]` silently dropped `linkedTransactions` from its JSON, so the detail page fed the correct engine *declared-only* inputs and drifted +$34K from the list/Home. No formula test can catch a serialization drop. **The missing layer is end-to-end: known data in → exact number out, through the real route/serialization/page path.**

## 2. The four-ring defense

Every number is defended by four rings. A bug that escapes ring N must be caught by ring N+1 — and then (per the Ratchet, §5) a test is added at the *lowest* ring that could have caught it, so it can never escape again.

| Ring | Name | What it proves | Where it lives | Runs |
|---|---|---|---|---|
| **0** | **Engine correctness** | each formula is right (worked examples, §19.2) | `lib/calc-audit/*` fixtures, `tests/calculations/*` | every CI run |
| **1** | **Wiring / SSOT** | one producer per number; anchors resolve; no re-derivation | `neomatrix:check` (A3), `lint-financial-surfaces`, source-lock tests | every CI run + build |
| **2** | **Golden Household end-to-end** | with a KNOWN dataset, the real route → serialization → page path yields the exact hand-computed number, and every surface pair with the same `semanticKey` yields the SAME number (input-parity) | `tests/golden/*` (build-out queued — §6) | every CI run |
| **3** | **Real-data verification** | invariants + cross-surface parity + regression snapshot hold on Reza's LIVE data in the rendered UI | this playbook, executed via Claude-in-Chrome relay (and, once shipped, the self-audit endpoint) | after every money-touching merge; before any issue → VERIFIED |

Rings 0–2 are fully automated in CI. Ring 3 is semi-automated (Chrome reads, a session compares) until the self-audit endpoint ships (§6.2), which collapses most of Ring 3 into a button.

## 3. Ring 3 — the real-data run (step-by-step, any session)

### 3.1 Operating rules

1. **One run = one sitting.** All figures captured from the same data snapshot; note the date/time. If Reza adds data mid-run, restart the affected part.
2. **Exact figures, named pages.** No rounding, no "about". Every value cites the page it was read on.
3. **Read-only.** Chrome must not write, except an explicitly-labelled `[ACTION]` step Reza approves.
4. **Two-pass on mismatches.** Before reporting a MISMATCH, Chrome re-reads both values once — guards against its own misreads.
5. **Tolerance policy.** Identities computed from the *same displayed figures* must be EXACT. Values that pass through display rounding (e.g. "$3.4M" tiles) get ±$1 per rounded operand; report raw values so the session can judge. Anything outside tolerance is a FAIL, no exceptions.
6. **Property spread.** Part A runs on 2–3 properties of different types: one owner-occupied, one geared investment, one with a non-monthly rent cadence.
7. **Machine-comparable output.** Part F (regression snapshot) is emitted as a fenced JSON block with the fixed keys from §3.4 — never prose — so the comparing session can diff it mechanically.

### 3.2 The relay protocol (who does what)

1. **Session** hands Reza the run brief (§3.3, verbatim — do not improvise a new one; edit THIS doc if the brief must change). **The brief is a LIVING document (NEOAUDIT.md §10 step 5):** whenever a run finds a defect that reveals a NEW CLASS of human scrutiny the brief never directed the auditor to apply (e.g. MON-048 → "read the LABEL, not just the number"), broaden §3.3 in the SAME fix PR so every future run inherits the lens. The brief only ever gets more complete — automatable specifics leave it (become Ratchet tests, §5), newly-recognised categories of judgement enter it.
2. **Reza** opens Monitrax (prod, or a PR preview URL when verifying a specific fix) → opens Claude-in-Chrome → pastes the brief → allows navigation/reading, denies writes → asks for the final report in the output format → pastes the report back to the session.
3. **Session** compares (§3.5) and produces the PASS/FAIL table mapped to MON-### issues; registers new MON-### for every new FAIL; applies the Ratchet (§5).
4. **Session** stores the run under `docs/verification/runs/VR-NNN.md` (sequential) and, if this run becomes the new reference, updates `docs/verification/baselines/`.

### 3.3 The canonical run brief (paste to Claude-in-Chrome verbatim)

The full brief — Parts A–F plus the invariant list — is maintained ONCE, here:

```
You are helping me verify financial calculations on my Monitrax account, in my logged-in browser session. You can SEE my real numbers; a separate engineer cannot. Capture what the app SHOWS — inputs AND outputs — so the maths can be checked.

RULES:
- READ-ONLY. Do NOT add, edit, save, or delete anything, EXCEPT a step explicitly labelled [ACTION] that I approve.
- Quote EXACT figures, no rounding ("$4,190.00", not "about $4k"), and name the page each value was read on.
- Before reporting any MISMATCH, re-read both values once to rule out a misread.
- If something isn't on my account, say "not found" — never guess.

=== YOUR JOB IS PHASE 1 — COMPLETE CAPTURE (not analysis) ===
Monitrax is a HOLISTIC tool: a number is only "correct" in relation to the others (a property's cashflow must agree across its detail page, the list tile and the Home tile; net worth must tie to assets−liabilities AND to liquid+accessible+locked). So the capture must be WHOLE and done in ONE pass — never section-by-section, or the cross-surface comparisons are lost. Your job here is to OPEN EVERYTHING and RECORD every number faithfully. You do NOT need to do the final maths/verdicts — a separate session does the staged holistic analysis (Phase 2) from what you capture. If you spot an obvious MISMATCH, note it, but your priority is complete, accurate reads.

COVERAGE IS MANDATORY: you MUST visit every sidebar item and open every entity, and you MUST fill the "coverage" object in the MACHINE REPORT with true/false per sidebar section + list anything you could not open in "skipped". A false or a non-empty "skipped" is an incomplete run — say so plainly rather than pretend completeness.

=== MISSION: OPEN EVERYTHING (this is an EXHAUSTIVE sweep, not a spot-check) ===
Click INTO every entity and read the numbers INSIDE — never stop at a summary tile (a tile can read correctly while the detail page behind it is wrong — the MON-028 class).
- For EVERY property, investment account, super account, loan and bank account: click "View details" (or the tile) to open its DETAIL page/dialog and read the figures inside.
- Open EVERY tab inside any entity dialog (Overview, Linked Data, Insights, Actions).
- Expand EVERY collapsible; click every "Show more" / "View all" / "See breakdown".
- Do NOT summarise or skip "similar" items — read each one and record its figures.
- Walk the WHOLE left sidebar top-to-bottom so nothing is missed: Home · My Accounts (Accounts, Loans, Income, Spending, Transactions, Recurring) · My Budget (Budget, Cashflow, Debt Freedom, Tax) · My Safety Net · My Wealth (Properties, Investments, Super, Assets) · My Guide (Health, Actions, Progress) · Reports · Settings (Household).
- My Guide what-if levers: move each slider, confirm the projected output moves in the SENSIBLE direction, then Cancel/reset (no save).

=== PART A — CROSS-SURFACE CONSISTENCY (EVERY property — open each via "View details") ===
For each property, report the "Cashflow / yr" (or monthly ×12) shown on ALL of:
  1. the property detail page, 2. the Properties LIST tile, 3. the Home dashboard tile (×12).
State MATCH or MISMATCH by $X across the three. Then for the same property report:
  - Rent: one "Rental income" line or several? cadence label? monthly amount?
  - Each expense row: name, amount, frequency label, and its "Actual"/"Estimate" tag.
  - Expenses card: annual total and monthly total.
  - Loan: balance, interest rate, repayment figure used.
  - Depreciation/yr and the schedules feeding it (asset cost, rate %, method).
  - Tax card figure vs the cash Cashflow figure — which is more negative?
  - Yield on all three surfaces — MATCH or MISMATCH.
  - If this property's LIST tile shows NO "Cashflow / yr" line at all, record its OWNERSHIP TYPE (owner-occupied home / investment / tenant-rented) — an owner-occupied home legitimately has no rental cashflow line, but an INVESTMENT property with a blank cashflow line is a defect. (MON-039c)

=== PART B — NET-WORTH TIE-OUTS ===
  - Portfolio/total equity on the Properties page AND anywhere else it appears — MATCH?
  - Balances page: Liquid, Accessible, Locked, Net worth. Does Liquid+Accessible+Locked EXACTLY equal Net worth? Gap if not.
  - Total assets / Net worth across Home, Balances, Investments — report each, MATCH?

=== PART C — TAX / CASHFLOW ONE STORY ===
  - Estimated annual tax on /cashflow vs My Guide (CFO) — identical? Medicare levy visible/included?
  - /cashflow "Money In" figures — do the two agree? If no income landed this month, do BOTH read $0? Also capture the "N income source(s)" note next to it: how many income sources are DECLARED vs the actual "Money In" $. If Money In is $0 but N≥1 sources are declared, state whether the page distinguishes ACTUALS ("Money In" = what landed) from the DECLARED source COUNT (expected, not a bug) or presents them as the same basis (confusing — a labelling defect). (MON-039b)
  - INCOME BASIS RECONCILIATION (MON-043): capture the ANNUAL INCOME figure on EVERY surface that shows one — Home, Activity/Spending, and Tax — each with its BASIS label ("Last 12 months" / trailing-12-mo actuals / declared gross / etc.). Then open the income BREAKDOWN and list each category + amount. If an "Other" or uncategorised income component exists (e.g. a large ~$190k line), state whether it is TRANSACTION-BACKED (real deposits in the statement/activity) or DECLARED-ONLY (a manually-entered income row with no matching transactions). This one capture decides whether a cross-surface income gap is a REAL actuals under-count (to fix) or a basis/labelling difference (to clarify) — so it must be read, not inferred.
  - "Month-End Balance" on My Guide vs the Cashflow forecast — same number?
  - [MON-030] My Guide (CFO) overall score AND letter grade vs the Home "Health" score AND grade — IDENTICAL? (both now come from the ONE health engine, so they MUST match to the digit and the letter; any gap is a FAIL.) Then look at the CFO score's coloured bars: they should be the SEVEN warm categories — Cash on hand / Cash flow / Debt health / Investments / Property / Protection / Long-term outlook — NOT a different set of six CFO metrics. Report the score, the grade, and the bar labels you see on each surface.

=== PART D — EDGE CASES (yes/no each) ===
  - Owner-occupied HOME: does ANY surface show a "Yield" for it? (should NOT)
  - Property with unknown/$0 purchase price: green "+0.0%" gain pill anywhere? (should NOT)
  - A one-off expense (battery, ATO payment, one-off legal/renovation): shown anywhere as "$X /mo"? (should NOT). Also check its FREQUENCY/CADENCE BADGE on every list it appears in — the property "Cashflow rhythm" / Recent-activity rows, the Spending list, any activity feed: a one-off must read "One-off", NOT "Monthly"/"Weekly"/etc. (MON-048 — the label lied even though the $ amount was right).
  - LABELS, not just numbers: on every row that carries a badge (frequency/cadence, "Actual" vs "Estimate", "Appreciation" vs "Depreciation", a basis label like "Net"/"Gross"/"Last 12 months"), read the badge and flag any that contradicts the row (e.g. an appreciating asset badged "-200% depreciation", a one-off badged "Monthly", income figures on two pages with no basis label to explain why they differ). A correct number with a wrong label is still a defect.
  - "High Discretionary Spending": exact % — is it 0–100%?
  - CFO Loan Opportunities: any sentinel text ("Save 69 years", "999")? refinance offered on a loan over 100% LVR?

=== PART E — SANITY INVARIANTS (PASS/FAIL + delta; formula-free) ===
  - Assets − Liabilities = Net worth (report all three).
  - Liquid + Accessible + Locked = Net worth.
  - Σ per-property equity = Portfolio equity.
  - Essential + Discretionary = Recurring monthly spend.
  - Every % is 0–100% (LVR may exceed 100).
  - Negative portfolio cashflow ⇒ no "Positive Cashflow" full-marks sub-score; Safety score < 100.
  - The SAME metric (net worth, savings rate, health score AND its letter grade, liquid savings, each property's cashflow) reads the SAME on every page it appears — list each occurrence. [MON-030: Home health score/grade === My Guide CFO score/grade.]
  - No sentinel leaks: "69 years", "999", decades-long payoff, "$0 repayment" on a property that has a loan.
  - COUNTS across surfaces: the Household "Vehicles" count (Settings › Household) vs the number of VEHICLE assets on My Wealth › Assets — report BOTH numbers. The Household value is a DECLARED dropdown (0–5, used for expense estimates); the Assets value is the actual ledger. If they differ, LIST what each vehicle asset is (so plant/equipment such as an excavator is distinguishable from cars — an excavator is not a household car). (MON-042)

=== PART F — REGRESSION SNAPSHOT (the fixed regression keys) ===
Capture these figures for the snapshot — they are emitted inside the MACHINE REPORT's "partF" object below (do NOT also print a separate Part F block): netWorth, totalAssets, totalLiabilities, portfolioEquity; per-property cashflowYrDetail/List/Home + yieldDetail/List; totalMonthlyExpenses, estimatedAnnualTax; safetyScore, healthScoreHome, healthScoreCfo, healthGradeHome, healthGradeCfo; emergencyFundMonths, savingsRateCfo, savingsRateHome; balances.liquid/accessible/locked. Use null for not-found. Numbers only (no $ or commas).

=== OUTPUT FORMAT — produce BOTH, in this order ===
(1) HUMAN SUMMARY — numbered list, one value per line: [Part] [what] = [exact figure] (page). Note any MATCH/MISMATCH you happen to see — but this is a secondary signal; Phase 2 recomputes every verdict from the captured numbers, so faithful reads matter more than your judgments.

(2) MACHINE REPORT — THE PRIMARY DELIVERABLE (Phase 2 consumes this). A SINGLE fenced ```json block, FIXED KEYS. Fill EVERY field from what you actually read; null for not-found; [] for no findings. The "coverage" object is mandatory — set each sidebar section true only if you actually opened it, and list anything you couldn't open in "skipped". Every MISMATCH/FAIL you did notice should also appear as a "findings" entry (if none, "findings": []).
{
  "meta": { "asOf": "<date+time>", "account": "<email or label>", "env": "production" },
  "coverage": {
    "Home": true, "MyAccounts": true, "MyBudget": true, "MySafetyNet": true,
    "MyWealth": true, "MyGuide": true, "Reports": true, "Settings": true,
    "everyEntityOpened": true, "skipped": []
  },
  "partF": {
    "netWorth": 0, "totalAssets": 0, "totalLiabilities": 0, "portfolioEquity": 0,
    "properties": { "<name>": { "cashflowYrDetail": 0, "cashflowYrList": 0, "cashflowYrHome": 0, "yieldDetail": 0, "yieldList": 0 } },
    "totalMonthlyExpenses": 0, "estimatedAnnualTax": 0,
    "safetyScore": 0, "healthScoreHome": 0, "healthScoreCfo": 0, "healthGradeHome": null, "healthGradeCfo": null,
    "emergencyFundMonths": 0, "savingsRateCfo": 0, "savingsRateHome": 0,
    "balances": { "liquid": 0, "accessible": 0, "locked": 0 },
    "vehicleCountHousehold": null, "vehicleCountAssets": null
  },
  "incomeBasis": {
    "home": { "annual": null, "basisLabel": null },
    "activity": { "annual": null, "basisLabel": null },
    "tax": { "annual": null, "basisLabel": null },
    "otherComponent": { "amount": null, "backing": null },
    "moneyIn": null, "declaredSourceCount": null
  },
  "crossSurface": {
    "<propertyName>": {
      "cashflowYr": { "detail": 0, "list": 0, "home": 0, "match": true, "maxAbsDelta": 0 },
      "yield": { "detail": 0, "list": 0, "match": true }
    }
  },
  "invariants": [
    { "id": "assets_minus_liabilities_eq_networth", "pass": true, "delta": 0 },
    { "id": "liquid_accessible_locked_eq_networth", "pass": true, "delta": 0 },
    { "id": "sum_property_equity_eq_portfolio", "pass": true, "delta": 0 },
    { "id": "essential_plus_discretionary_eq_recurring", "pass": true, "delta": 0 },
    { "id": "all_percentages_0_100", "pass": true, "delta": null },
    { "id": "neg_cashflow_no_full_positive_subscore", "pass": true, "delta": null },
    { "id": "same_metric_consistent_everywhere", "pass": true, "delta": null },
    { "id": "no_sentinel_leaks", "pass": true, "delta": null }
  ],
  "edgeCases": {
    "homeShowsYield": false, "zeroPriceGainPill": false, "oneOffShownAsMonthly": false,
    "discretionaryPctInRange": true, "loanSentinelText": false, "refinanceOfferedOver100Lvr": false
  },
  "mon030": {
    "healthScoreHome": 0, "healthGradeHome": null, "cfoScore": 0, "cfoGrade": null,
    "scoreMatch": true, "gradeMatch": true, "cfoBarLabels": [], "barsAreSevenWarmCategories": true
  },
  "findings": [
    { "part": "A|B|C|D|E", "surface": "<page>", "what": "<metric/check>", "expected": "<should be>", "actual": "<showed>", "severity": "critical|high|medium|low" }
  ]
}
```

**Consuming it (the comparing session):** `partF` diffs against `baselines/BASELINE.md` (§3.4 buckets); `mon030.scoreMatch && gradeMatch` gates MON-030 FIXING→VERIFIED; `invariants[].pass` + `crossSurface[].match` are hard PASS/FAIL; every `findings[]` entry that isn't an explained baseline delta becomes a MON via `npm run issues:raise` (§3.1) — `part`→area, `surface`→--surface, `expected`/`actual`→evidence. The `incomeBasis` object resolves the 2026-07-14 open forks from captured GROUND TRUTH instead of a guess: `otherComponent.backing === "transaction"` ⇒ MON-043 is a real actuals under-count (fix); `=== "declared"` ⇒ a basis/labelling refinement. `moneyIn === 0 && declaredSourceCount ≥ 1` with the page distinguishing actuals-vs-declared ⇒ MON-039b is correct-as-is (close). `partF.vehicleCountHousehold !== vehicleCountAssets` with the difference explained by declared-dropdown vs actual-ledger (e.g. an excavator) ⇒ MON-042 is a label clarification, not a count bug.

Optional `[ACTION]` add-flow test (MON-008 class): add a clearly-labelled test expense (e.g. "Test — smoke alarm service, $120, Annual") on one property's Expenses card, confirm it appears immediately and the annual total rises by exactly $120, then delete it.

### 3.4 Baselines and runs

- `docs/verification/runs/VR-NNN.md` — every run's full report + the session's PASS/FAIL comparison table. Append-only, sequential.
- `docs/verification/baselines/BASELINE.md` — the Part F JSON of the most recent **accepted** run (all known FAILs annotated). A new run's Part F is diffed against it; every delta is bucketed **unchanged / expected (Reza confirms: data added or fix shipped) / UNEXPLAINED → new MON-### issue**. When a run is accepted as the new reference, its JSON replaces BASELINE.md (with annotations).

### 3.5 The comparing session's procedure (Phase 2 — staged holistic analysis)

The comparing session (Claude, in-repo) runs the checks in STAGES over the COMPLETE captured dataset — the numbers are holistic, so every stage reasons over the whole (never a partial capture). No browser needed (the only live-interaction check — what-if lever direction — is captured in Phase 1).

- **Stage A — net-worth tie-outs:** assets−liabilities=net worth; liquid+accessible+locked=net worth; Σ per-property equity=portfolio equity.
- **Stage B — cross-surface parity:** each property's cashflow (detail/list/home) and yield agree; every shared metric reads the same on every surface (the MON-028 class).
- **Stage C — story convergence:** health Home==CFO (score+grade); savings rate one value; tax one-story (/cashflow==CFO); Month-End Balance==forecast.
- **Stage D — edge cases + sentinel leaks** (Part D/E booleans).
- **Stage E — baseline diff + disposition:** diff `partF` vs BASELINE.md, bucket every delta (unchanged / expected-fix / UNEXPLAINED); recompute each Part-A figure from captured inputs via the canonical formula (actuals-first §19.1; loan floor; frequency conversion) — state the arithmetic; map each FAIL to an existing MON-### or register a new one via `npm run issues:raise` (DIAGNOSED requires a §19.2-verified root cause — investigate in code before writing `rootCause`); apply the Ratchet (§5) for every FAIL rings 0–2 should have caught; store the VR-NNN run file and update the registry.

### 3.6 The two-phase model (why capture and analysis are separated — 2026-07-14)

> **Reza directive 2026-07-14:** *"Monitrax is a holistic tool, so all numbers are meaningful as a whole rather than individually. However after a complete sweep of existing numbers you can perform checks in stages (considering holistic numbers)."*

A single agent task that both captures AND analyses the whole app tends to shortcut on a long sweep (VR-002: the agent nearly skipped sidebar items). The fix is NOT to chunk the sweep by section — that would break the cross-surface comparisons that are the whole point (a property's cashflow lives on 3 surfaces; splitting the capture loses the tie). The fix is to split by KIND of work:

- **Phase 1 — CAPTURE (the Chrome relay, §3.3):** ONE exhaustive holistic pass whose only job is to OPEN EVERYTHING and record every number into the MACHINE REPORT, with a mandatory `coverage` checklist so any skip is visible. Capture-only is low-cognitive-load, so the single pass is reliable. (If the app ever outgrows one pass, capture MAY be chunked ONLY IF every chunk is unioned into one dataset BEFORE Phase 2 — never analyse a partial capture.)
- **Phase 2 — STAGED ANALYSIS (the comparing session, §3.5):** the relational checks, run in stages over the COMPLETE captured dataset. Staging is safe here because every stage sees the whole.

**The rule:** capture is whole and one-pass; staging happens in the analysis, never in the capture. A run whose `coverage` shows a false/`skipped` is incomplete — re-capture the missing surfaces before Phase 2.

## 4. The fix loop (root-cause → remove-the-culprit → retest)

Every number defect follows this loop — no shortcuts:

1. **Register** — MON-### in `docs/issues/ISSUES.json` at discovery (OPEN/DIAGNOSED).
2. **Root-cause in code (§19.2)** — inputs/units → governing formula → expected output → verify against the real code path. Never guess; hypotheses are labelled as hypotheses until the code proves them (MON-028's root cause was the *reverse* of the first hypothesis).
3. **Fix by REMOVING the culprit (Reza directive 2026-07-11).** The fix deletes/repairs the broken producer or path at its source. **Never** add a compensating calculation, a UI-side correction, a second producer, or a wrapper on top of broken code. If a duplicate producer exists, the fix is to delete it and point the surface at the canonical source — not to make the duplicate agree.
4. **Lock with tests at the right ring (§19.4 + the Ratchet §5)** — the propagation/parity test that fails if the bug ever returns.
5. **Retest** — CI green (rings 0–2) + a Ring-3 re-check of the specific numbers on the PR preview (targeted mini-brief: just the affected Part) → only then FIXING → VERIFIED.
6. **Model** — Neomatrix updated in the same PR if an engine/number/lineage moved (§21.2.1).

## 5. The Ratchet (zero-fail mechanism)

> **Every bug that reaches Ring 3 (real data) is proof of a hole in rings 0–2. Closing the bug without closing the hole is a process violation.**

For every Ring-3 FAIL, the fix PR MUST add a permanent automated test at the **lowest ring that could have caught it**:

- Wrong formula → Ring 0 fixture (calc-audit / worked-example test).
- Second producer / re-derivation → Ring 1 (Neomatrix A3 model + surface-lint pattern + source-lock).
- Plumbing (route drops/mangles a field; page feeds wrong inputs; serialization shape) → Ring 2 (golden route-level test asserting the exact JSON shape + input-parity across surfaces). *MON-028's ratchet: `tests/api/propertyDetailActuals.test.ts` (interim source-lock) → upgrade to a golden route test when Ring 2 lands.*
- Rendered-only (display formatting, wrong gate on a UI element) → Ring 2 UI-tier (Playwright DOM assertion) or a display-guard test.

This is how the system converges to zero-fail: the bug class dies permanently, coverage only grows. "100% correctness" = every headline number covered by rings 0–2 + a clean Ring-3 run — a ratchet we tighten every merge, never a one-off claim.

## 6. Build-out roadmap (Ring 2 + self-audit)

### 6.1 Golden Household (Ring 2) — `tests/golden/`
A fixed synthetic household (2 adults, 3 properties incl. one owner-occupied + one fortnightly rental + one $0-purchase, 2 loans incl. one interest-only, reconciled transactions with known cadences, one one-off expense, super, investments) with **every headline number hand-computed in a manifest** (`tests/golden/expected.ts`, each value citing its §19.2 derivation).
- **Tier 1 (no new infra):** invoke route handlers directly in vitest with a mocked Prisma client returning the golden rows + mocked auth; assert the exact JSON (fields present — the MON-028 class — and values). Assert **input-parity**: detail route and list route yield identical engine inputs for the same property; every `semanticKey` surface pair produces the identical number.
- **Tier 2 (needs CI Postgres):** GitHub Actions Postgres service + `prisma migrate deploy` + seed script; run the same tests against a real DB.
- **Tier 3 (UI):** Playwright (pre-installed) renders the pages against the seeded app and asserts the DOM shows the manifest values on every surface — the full path, screen included.

### 6.2 Self-audit endpoint — `GET /api/verify/invariants`
An auth-gated (`withPermission`) route that computes Part E's invariants **server-side on the logged-in user's own data** and returns `{ pass, fail: [{invariant, lhs, rhs, delta}] }` (+ a minimal admin surface to render it). Collapses most of Ring 3 into one request on real data — Chrome (or Reza) just reads PASS/FAIL, no figure-relay needed. Chrome's remaining unique job: the rendered-UI layer (what the screen literally shows). CDR note: reads only the user's own data under their token; returns no raw CDR values in logs (§13.3).

### 6.3 What we do NOT need
No new MCP/skills are blocking. There is no direct channel between this session and Claude-in-Chrome (it runs in Reza's browser session; this session is an isolated container) — the relay stands until §6.2 removes most of it. Playwright is already installed. The biggest lever is pure code: §6.1 Tier 1.

## 7. Reviewer enforcement

Reject any PR/session that: (a) fixes a number bug by adding compensating code instead of removing the culprit (§4.3); (b) closes a Ring-3-found bug without the Ratchet test (§5); (c) moves a `changesNumbers` issue to VERIFIED without a Ring-3 re-check recorded (run ID in the issue notes); (d) improvises a new Chrome brief instead of updating §3.3 in this doc; (e) claims "verified" from a formula argument alone when the plumbing path was never exercised.
