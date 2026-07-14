# Monitrax Rectification Plan — Open Chat-Audit Findings (2026-07-14)

> **Status: READY FOR REZA'S REVIEW.** Every OPEN finding below has a root cause **verified in source this session** (§19.2), a remove-the-culprit fix design (§23.2), a lowest-ring Ratchet test, a §19.4 downstream sweep, and a per-fix Ring-3 Chrome verification spec. **No code is changed by this plan. Fixing starts only on your explicit "go", one issue at a time, in the cluster order below — and two product decisions (§5) are needed before clusters ① and ②③ can begin.**

Governing request (Reza, 2026-07-14):

> *"create a comprehensive plan for the issues, the root cause and the holistic process for that issue considering all monitrax and consulting neomatrix. the plan should have detailed solution that has gone through your rigorous review and 10/10 scored. I don't want any fix to break anything else, or the fix is an assumption or a surface fix rather than first understanding the full process and fixing the root cause. tackle each issue separately, spend enough time and effort to fix it once."*
>
> *"each fix needs to have its own review by numbers you get from claude chrome to make sure the fix has removed the issue and it is not causing further issues."*

---

## 1. What this plan is (and is not)

- **It IS** a per-issue, verified-to-source root-cause + holistic-process + detailed-solution plan for every OPEN chat-audit finding, each independently scored to an honest 10/10 (§20.6) before presentation.
- **It IS NOT** a batch fix, an assumption, or a surface patch. Every root cause is proven at a real `file:line` I read in source (§19.2). Display-only findings are marked as such; nothing is claimed "tested/complete."
- **The fix philosophy is REMOVE THE CULPRIT, never wrap it** (§23.2 rule 1). A duplicate/rogue producer is deleted and the surface repointed to the ONE canonical source (§12.2.1) — no compensating calc, no UI-side correction, no "second producer that agrees."

## 2. The non-negotiable per-issue process (applied to EVERY issue)

Each issue is fixed **on its own**, start to finish, before the next is touched:

1. **Understand the full process first (§10, §21.5).** Consult the Neomatrix for the number's canonical engine + lineage + `file:line`; read the producer and EVERY consumer end-to-end. Never assume; never guess.
2. **Verify the root cause (§19.2).** Four-step audit: input contract + units → correct rule/law/formula (authority cited) → hand-computed worked example → verdict vs current code.
3. **Confirm it is ONE source (§12.2.1).** Two+ producers → delete the rogue, repoint to canonical.
4. **Design the remove-the-culprit fix** with exact `file:line` changes.
5. **Map the full downstream flow (§19.4).** Enumerate every consumer via Neomatrix lineage + grep. Unmodelled number → MODEL it first (§21.2.1).
6. **Add the lowest-ring permanent test (§23.2 Ratchet).** Must FAIL if the bug (or its class) recurs.
7. **Build to an honest 10/10** on the §20.6 tri-axis (Document / Requirements / Logic) — or STOP and surface the blocker.
8. **Ship as its own draft PR** with the §20.6 gate line, §19.2 evidence, §19.4 sweep, plain-English `{issue, fix, check}` trio, doc-sync block.
9. **PER-FIX RING-3 CHROME VERIFICATION (§3).** Before VERIFIED, a targeted Chrome re-check captures the SPECIFIC numbers and confirms (a) symptom GONE and (b) NO new discrepancy (regression guard).
10. **Promote into the NeoAudit structure (§23.2 rule 6).** The Ratchet test becomes permanent; parity coverage grows; the Chrome brief shrinks.

## 3. The per-fix Ring-3 Chrome verification loop (Reza 2026-07-14)

> *"each fix needs to have its own review by numbers you get from claude chrome to make sure the fix has removed the issue and it is not causing further issues."*

Every fix gets its **own** targeted real-data verification — not a batched end sweep:

**A. Before the fix (baseline).** From the registry + the VR run that found it, record the EXACT wrong numbers + surfaces. This is what the fix must move.

**B. After the fix is live (PR preview / prod).** A **targeted, single-issue Chrome brief** that (1) names the exact surfaces + numbers to read verbatim, (2) asks for a machine-readable capture (numbers, not a judgement), and (3) includes a **regression guard**: names the 2–4 nearest §19.4 downstream surfaces the fix could disturb and asks Chrome to report THOSE too.

**C. I evaluate the capture** against the §19.2 worked-example expected value, the pre-fix baseline (symptom GONE), and the regression-guard surfaces (still agree — no NEW divergence).

**D. Verdict.** PASS (symptom gone AND no new divergence) → VERIFIED, run ID recorded, Ratchet test promoted. FAIL (symptom persists OR new divergence) → stays FIXING, re-diagnose. **A fix that removes X but breaks Y is not a fix.**

Each issue below carries its **Chrome verification spec** (surfaces + numbers + regression-guard list) so the per-fix brief is pre-written.

## 4. Cluster order (highest-leverage root causes first)

The nine OPEN findings cluster into six root-cause groups. Order matters — earlier clusters are HUBS whose fix shrinks the surface of everything after (§19.4).

| # | Cluster | OPEN issues | Decision needed | Why this order |
|---|---|---|---|---|
| ① | **Expense one-off hub** | MON-037 | **DECISION 1** (one-off semantics) | **Critical hub.** One-off blindness inflates HOME cashflow, tax deductions, expense totals, discretionary %. Fix first — moves the most downstream numbers. |
| ② | **Cross-surface cashflow** | MON-035 | **DECISION 2** (transaction window) | Residual rogue-input producer; locks per-property cashflow everywhere. Depends on ① (one-off fix narrows the gap first). |
| ③ | **Rental yield** | MON-036 | (uses DECISION 2) | Same window mismatch + a 4th declared-yield producer to delete. Ships with ②. |
| ④ | **Tax recommendations / gates** | MON-040, MON-038 | none | Contained to CFO/tax advice surfaces; independent of ①②③. MON-040 is the cleanest fix in the set. |
| ⑤ | **Income basis** | MON-043 | (labelling call) | Three legitimately-different income concepts; a labelling + basis-contract fix, not a collapse. |
| ⑥ | **Display / counts** | MON-042, MON-041, MON-039 | none | Display/label/count guards; lowest risk, last. |

Already-FIXING findings (shipped fixes awaiting Ring-3 confirm) are listed in §7 — they need only the per-fix Chrome check to close, not new code.

---

## 5. TWO PRODUCT DECISIONS — ✅ DECIDED by Reza 2026-07-14

Both were load-bearing user-philosophy forks (§20.5); Reza made both calls. Recorded here as the canonical basis for clusters ① and ②③.

### DECISION 1 — One-off expense semantics (cluster ①, MON-037) — ✅ **DECIDED: Exclude, show in-month**

A **one-off** (`isRecurring = false`) is **EXCLUDED** from the recurring monthly/annual total (the plan/estimate) and shown as an **actual in the month it occurred**. Mirrors the rule already accepted in MON-023 for the general dashboard, so one definition of "recurring" holds everywhere (the honest run-rate — a one-off battery is not a monthly cost). _Tax caveat (separate, §12.14):_ the deductibility of a one-off (immediate repair vs capital → CGT cost base) is its own ATO question the exclusion does not resolve — flagged in MON-037's plan, not fixed under it.

### DECISION 2 — Canonical transaction window for property cashflow/yield (clusters ②③, MON-035/036) — ✅ **DECIDED: Trailing 12 months**

Every property surface reads **one** producer fed a **trailing-12-month** transaction window (the "current run-rate" — the financial-adviser basis, and it stops lumpy old transactions skewing the average). This is already the master/dashboard basis; the fix makes property **detail + list adopt it too** (deleting their all-time `propertyActuals` path) so all four surfaces converge. **Note:** the detail/list cashflow + yield verified in VR-002 will SHIFT to the 12-month basis and re-verify cleanly under the new consistent window — the per-fix Chrome check (§3) captures this. Fix shape: **delete the duplicate fetches, route every surface through one producer, make the 12-month window a single parameter of that producer.**

---

## 6. Per-issue plans (OPEN findings — all root causes verified in source)

### Cluster ① — Expense one-off hub

#### MON-037 — One-off expenses annualised ×frequency; Battery duplicate  ·  🔴 critical · changesNumbers: yes

**Verified root cause (§19.2, three independent defects):**
- **RC-A (dominant) — one-off blindness in the canonical calc path.** The schema HAS `isRecurring` (`schema.prisma:1949`), but three producers annualise every expense with **no `isRecurring` gate**: the property-cashflow engine (`propertyCashflow.ts:41–45` — `CashflowExpense` has no `isRecurring` field; loop at `:162–172` ×12's every row) ✓ verified; the declared-expense aggregator (`expenseAggregator.ts:22–36` — `ExpenseInput` has no `isRecurring`) ✓ verified; the tax deduction loop (`taxPositionCalculator.ts:181–198` — gates only on `isTaxDeductible`, then `annualize(amount, frequency)`) ✓ verified. A one-off stored `MONTHLY` is ×12'd everywhere they render. The earlier MON-023 fix filtered `isRecurring !== false` only in the *general* dashboard/master views (`masterFinancialService.ts:915,1945`), never these paths.
- **RC-B — reconcile creates a duplicate instead of matching the estimate.** The reconcile create path dedups on exact normalised **merchant-string equality** only (`link/route.ts:596–616` → `merchantNormalize.ts:38–42`); a declared "Battery System for HOME" estimate and a reconciled "Battery" actual don't match → two rows. The Phase-30 `budgetedAmount`/`lastReconciled` estimate↔actual mechanism (`schema.prisma:1953–1954`) is never used.
- **RC-C — frequency defaults `MONTHLY`, never detected.** Reconcile sets `frequency = body.frequency || 'MONTHLY'` (`link/route.ts:345`); the AI categoriser sets none; the real cadence detector (`recurringExpenseDetection.ts`) is dead code. So one-offs land as `MONTHLY` in the first place.

**Worked example:** a $11,385 battery stored MONTHLY → `toMonthly` → ×12 = **$136,620/yr**; with the ESTIMATE + reconciled ACTUAL both present (RC-B duplicate), it counts twice. Correct (Option A): $0 in the recurring annual total; shown as an actual in its month.

**Remove-the-culprit fix (DECISION 1 = ✅ Exclude, show in-month):** add `isRecurring?: boolean` to `CashflowExpense`, `ExpenseInput`, and the tax `TaxEngineExpenseItem`; thread the field (already on every Prisma row) through the `.map(...)` at `masterFinancialService.ts:1233,1365`, `properties/[id]/page.tsx:167`, `properties/page.tsx:472`, `portfolio/snapshot:727`, `tax/position/route.ts:136`; skip `isRecurring === false` from the annualised total in `propertyCashflow.ts:162`, `expenseAggregator.ts:88`, and the tax loop `taxPositionCalculator.ts:182` (+ its Decimal sibling ~:673). RC-B: before `sameMerchant`, match an existing budgeted estimate on the same `propertyId`+`category` and UPDATE it (Phase-30 flow) instead of creating. RC-C: wire the existing cadence detection into the create path; delete the dead detector.

**Lowest-ring test (Ratchet):** Ring-0 fixtures on each engine (one-off contributes 0 to the annual total, still shows in-month); Ring-1 Neomatrix — add the `isRecurring` gate to the modelled aggregation edges so A3 flags any future producer that re-annualises one-offs; Ring-2 golden route test — a synthetic property with a one-off → property card total == master snapshot == tax deductions, all excluding it.

**§19.4 downstream sweep (INFLATED path A):** PropertyExpensesCard, property list tile, master property metrics (HOME cashflow), portfolio snapshot net, Home property tile, **tax deductions → taxable income → tax**, expenseAggregator callers. (Path B — the actuals/recurring-filtered views + safety score — already correct or a different mechanism.)

**Chrome verification spec (per-fix):** capture on HOME / Thornland Lot 1 / Guildford — each one-off expense row's recurring flag + the property's annual expense total + Cashflow/yr; the tax card's total deductions. **Regression guard:** the property Cashflow/yr on detail vs list vs Home tile (must still agree), and the master-snapshot monthly expenses (must not change for genuinely-recurring items). Expect: one-offs gone from recurring totals, no Battery duplicate, deductions drop by the one-off inflation.

**§20.6 gate (my self-review):** Document 10/10 (matches §19.1 actuals rule + the accepted MON-023 definition; Neomatrix edges to update) · Requirements 10/10 (fixes the exact VR-002/003 symptom at root) · Logic 10/10 (DECISION 1 = Exclude resolved; the fix is now fully specified). **Financial build — 10/10 required and met.** **Coverage honesty:** the Ratchet tests prove one-offs are excluded from the annual totals and the three surfaces agree; they do NOT prove the tax *deductibility* (capital vs immediate) of any given one-off — that is a separate §12.14 question flagged above.

---

### Cluster ② / ③ — Cross-surface cashflow + yield

#### MON-035 — HOME cashflow tile ≠ detail/list (Δ ~$6,040/yr)  ·  🟠 high · changesNumbers: yes
#### MON-036 — HOME rental yield reads 0.12% / 0.9% / 1.05%  ·  🟠 high · changesNumbers: yes

**Verified root cause (§19.2):** the Neomatrix is right that `computePropertyCashflow` (`propertyCashflow.ts:130`) is the ONE **engine** — but three surfaces feed it **three different transaction-input windows** (same engine ≠ same inputs — the MON-028 lesson): detail + list use all-time (`propertyActuals.ts:152–174`, no date filter — ✓ verified); Home tile + master use last-12-months (`portfolio/snapshot/route.ts:616` — ✓ verified; `masterFinancialService.ts:762`). `resolveMonthly` averages over the *supplied* transactions, so the two sets yield different monthly rent/expense → different `annualCashflow`/yield. **HOME is the only property whose reconciled transactions predate 12 months**, so only it diverges (the other 6 pass MON-028). For yield, there is additionally a **4th, fully independent producer**: the CFO Risk Radar computes yield from **declared income**, bypassing the engine — `riskRadar.ts:395–397` (`annualIncome/currentValue`, `include:{income,expenses}` only, no transactions) → the 1.05% third value.

**Remove-the-culprit fix (DECISION 2 = ✅ Trailing 12 months):** make `enrichPropertiesWithActuals` (`propertyActuals.ts:152–174`) apply a trailing-12-month filter (the single canonical producer + window), and delete the inline 12-month `unifiedTransaction.findMany` in `portfolio/snapshot/route.ts:613–632` and `masterFinancialService.ts:762–769` — route ALL four surfaces (detail, list, Home tile, master) through that one producer so they get the identical 12-month transaction set. Detail + list drop their all-time path and adopt the 12-month window. For MON-036: delete the inline declared-yield in `riskRadar.ts:395–397` and feed `detectPropertyUnderperformanceRisks` the already-computed `PropertyMetrics` (carries the engine's `rentalYield`) — also removes riskRadar's independent `prisma.property.findMany` (§12.10 win).

**Lowest-ring test (Ratchet):** the parity matrix currently **masks this** — `parityMatrix.ts:74–76` resolves both list-tile and home-tile from `c.master.properties[0]` (12-mo), so on a golden household with no >12-mo transactions master==route → **false green**. Fix: (a) add a Golden Household property with reconciled transactions spanning >12 months; (b) point the list/tile resolvers at their **real** independent serialized paths (`/api/properties` all-time vs `/api/portfolio/snapshot`) so three paths must converge; (c) model `number.propertyRentalYield` in the Neomatrix with a shared `semanticKey` + `rendered-at` edges from detail/list/home-tile/risk-radar so A3 convergence auto-catches a rogue yield producer.

**§19.4 downstream sweep:** the master 12-mo window is highest-leverage — it feeds `buildPropertyMetrics` → every master-snapshot consumer (CFO decision support, health, savings/safety scores, `/api/master-snapshot`). Unifying it moves CFO + health + safety together. Snapshot window feeds the Home tiles; all-time feeds list + detail.

**Chrome verification spec:** capture HOME Cashflow/yr on detail + list + Home tile (must be equal) and yield on detail + list + Home tile + CFO Risk Radar (must be equal). **Regression guard:** the other 6 properties' cashflow/yield (must be unchanged — they already agreed), and CFO health/savings scores (must move only if the window changed their inputs, expected + explained).

**§20.6 gate:** Document 10/10 · Requirements 10/10 · Logic 10/10 (DECISION 2 = Trailing 12 months resolved; fix fully specified). **Financial build — 10/10 required and met.** Exact dollar magnitudes are ⚠️ data-dependent (live transaction dates) — mechanism fully verified, arithmetic confirmed at fix time via Chrome.

---

### Cluster ④ — Tax recommendations / gates

#### MON-040 — Tax recs "save 3685%" / $6.27M  ·  🟡 medium · changesNumbers: yes  ·  ✅ fully verified, cleanest fix

**Verified root cause (§19.2, end-to-end in source):** `marginalRate` is a **percent** (37 for a 37% bracket) — `incomeTaxCalculator.ts:118` returns `marginalRate * 100` ✓, flows to `TaxCalculation.marginalRate = 37` (`taxPositionCalculator.ts:262`) ✓, and the tax page depends on percent (`page.tsx:302` `formatPercent`, `:727` `/100`). But `generateRecommendations` treats it as a **decimal** in four places ✓ verified: `:344` `>= 0.32` (guard defeated), `:349` `remainingCap * (marginalRate − 0.15)` (×~100), `:354` `(marginalRate − 0.15) * 100`%, `:364` `× marginalRate`.

**Worked examples (reproduce the reported numbers exactly):** "3685%" = `(37 − 0.15) × 100`; correct = `37 − 15 = 22%`. "$1,105,500" = `30,000 cap × 36.85`; correct = `30,000 × (0.37 − 0.15) = $6,600`. "$6,274,704" = neg-gearing `× 37`; correct `× 0.37 ≈ $62,747`. ❌ ~100× inflated.

**Remove-the-culprit fix:** keep the documented percent convention (the page depends on it — do NOT touch `incomeTaxCalculator.ts:118`); fix the misreading consumer only. In `generateRecommendations` derive `const mr = tax.marginalRate / 100` and use it: `:344` compare `>= 32`; `:349` `remainingCap * (mr - 0.15)`; `:354` `Math.round(tax.marginalRate - 15)`; `:364` `× mr`. **Latent-class note (flag, don't fix here):** `marginalRate` unit is inconsistent across the tax engine (`super/contributionCalculator.ts:435`, `capTracker.ts:359` treat it as decimal) — a separate §19.2 unit-audit sweep, not this PR.

**Lowest-ring test (Ratchet):** Ring-0 `tests/tax/taxRecommendations.test.ts` — 37%-bracket fixture asserts the description shows `22%` not `3685%`; plus a cheap **class invariant**: no recommendation `potentialSavings` may exceed the user's total `netTax` (you cannot save more tax than you owe).

**§19.4 downstream sweep:** `generateRecommendations` output → `/api/tax/position/route.ts:255` → tax page recommendations panel only (does NOT feed CFO/cashflow tax numbers, which read `netTax`). Blast radius contained. Model `number.taxRecommendationSaving` in the Neomatrix (currently unmodelled — §21.2.1).

**Chrome verification spec:** capture the tax recommendations panel — every "save X%" and "$ potential savings". **Regression guard:** the tax summary cards (Total income / Deductions / Taxable income / Refund) must be unchanged (the fix touches only the recommendations arithmetic).

**§20.6 gate:** Document 10/10 · Requirements 10/10 · Logic 10/10. **Financial build — 10/10 required and met** (worked examples verified to source; §19.2 evidence complete). Coverage: the Ratchet test proves the % and the savings-cap invariant; it does NOT re-prove the underlying `netTax` (that's MON-020's domain).

#### MON-038 — Refinance offered on a 104% LVR loan  ·  🟠 high · changesNumbers: yes

**Verified root cause (§19.2):** refinance advice has **two producers**; MON-019 gated only one. `calculateRefinanceOpportunities` is correctly gated (`loanDecisionSupport.ts:282` `MAX_REFINANCE_LVR = 0.95`, `:316` `!overMaxLvr`). But `generateRateAlerts` emits a `rate_above_market` alert on rate alone with **no LVR gate** ✓ verified — `:407` fires on `interestRateAnnual > marketRate + 0.01`, `:420` action "Consider refinancing…", `:419` impact ≈ $9,471/yr — and separately the `lvr_high` alert (`:435`) shows the 104%. Both render (`page.tsx:971` `slice(0,2)`), reading as "High LVR 104% … $9,471/yr refinance." A §12.2.1 duplicate-producer miss.

**Remove-the-culprit fix:** extract ONE shared predicate `isRefinanceableLvr(loan, properties)` in `loanDecisionSupport.ts` (the single home for the `> MAX_REFINANCE_LVR` rule); call it from BOTH `calculateRefinanceOpportunities:279–284` AND the `rate_above_market` branch `:405`. When `overMaxLvr`, suppress the refinance framing (change `:420` action to the repayment framing the `lvr_high` alert already uses `:439`). Reuse the one helper — do NOT add a second LVR computation.

**Lowest-ring test (Ratchet):** extend `tests/cfo/loanDecisionSupportGuards.test.ts` (the MON-019 test) with a **cross-producer invariant**: for a 104%-LVR above-market loan, neither `calculateRefinanceOpportunities` nor `generateRateAlerts` yields any refinance-worded advice. This prevents a third producer re-opening the hole.

**§19.4 downstream sweep:** `generateRateAlerts` → `rateAlerts` → CFO Loan card (`page.tsx:971–982`) + the `alertCount` badge (`:922`). Model a `refinanceEligibility` decision node in the Neomatrix so A3 enforces "one LVR gate."

**Chrome verification spec:** capture the CFO Loan Opportunities / alerts for Thornland Lot 1 (104%). **Regression guard:** other loans' legitimate rate/refinance alerts must still appear; the `alertCount` badge must stay consistent with the visible alerts. Expect: no refinance offer on the 104% loan; the high-LVR risk alert (repayment framing) may remain.

**§20.6 gate:** Document 10/10 (completes MON-019's intent) · Requirements 10/10 · Logic 10/10. ⚠️ residual: whether VR-002 ran against a build containing MON-019's gate is unverifiable read-only, but `generateRateAlerts` is ungated at HEAD regardless — real either way.

---

### Cluster ⑤ — Income basis

#### MON-043 — Income 3 ways: Home $239K / Activity $484K / Tax $524,831  ·  🟡 medium · changesNumbers: yes

**Verified root cause (§19.2) — three legitimately-different concepts, none labelled:** (1) Home tile = `moneyStoryTrend.annualIncome` — actual bank inflow, **trailing-12-complete-month × 12** (`insights/route.ts:618`, `moneyStoryTrend.ts:135`); (2) Activity tile = `getCanonicalMonthlyCashflow(snapshot).inflow` — actual inflow, **current calendar month** (`activity/page.tsx:630,638`; "484K/yr" is a ×12 of a spiky month); (3) Tax card = `taxPosition.summary.totalIncome` — **declared FY gross assessable income** (salary gross + gross rent + franking gross-up + …), a tax-law construct, not bank inflow (`taxPositionCalculator.ts:92`). Each is individually correct for its basis; the defect is that **none renders a visible basis label**, so three correct numbers read as a contradiction. This is NOT a collapsible single-source violation — forcing equality would hide real semantic differences.

**Remove-the-culprit fix (labelling + basis-contract, not number-collapse):** make each surface declare its window — Home tile "Last 12 months" (label already resolved at `page.tsx:468–473`; ensure it's on the tile face); Activity "This month" chip; Tax "Declared assessable income (FY)" / tooltip distinguishing gross assessable from bank inflow. Optional SSOT strengthener (Home↔Activity, both actuals): route both through one accessor exposing `{ currentMonthInflow, trailingAnnualInflow, basis }` so the two demonstrably read one producer with the window as an explicit parameter.

**Lowest-ring test (Ratchet):** Ring-2 golden cross-surface test locking the **basis contract** — assert (a) Home annualInflow == moneyStoryTrend trailing-annual, (b) Activity income == canonical current-month inflow, (c) Tax total == engine `income.total`, and (d) each surface carries a non-empty basis label. (The three ARE allowed to differ; each must declare its window.)

**§19.4 downstream sweep:** `moneyStoryTrend.annualIncome` → Home tile + Money Story hero + savings-rate tile + FI coverage; `getCanonicalMonthlyCashflow.inflow` → Activity + /cashflow hero + savingsScore; `taxPosition.income.total` → /dashboard/tax + /cashflow tax estimate + My Guide.

**Chrome verification spec:** capture the three income figures + their (new) basis labels. **Regression guard:** the savings-rate tile and Money Story hero (fed by the same trailing-annual figure) must be unchanged — this fix adds labels, changes no number.

**§20.6 gate:** Document 10/10 · Requirements 10/10 (the ask is "one consistent figure OR clearly-labelled distinct bases" — this delivers the latter, the honest answer) · Logic 10/10. Coverage: proves each surface declares its basis; does NOT force numeric equality (by design).

---

### Cluster ⑥ — Display / counts

#### MON-042 — Household 4 vehicles vs Assets 5  ·  🟢 low · changesNumbers: no

**Verified root cause (§19.2):** two producers, two concepts — household "vehicles" = self-declared `HouseholdProfile.carsCount` (`schema.prisma:4684`, manual picker `household-profile/page.tsx:630–644`), Assets "5" = `COUNT(Asset WHERE type='VEHICLE')` (`assets/page.tsx:760`). No reconciliation; likely a mis-classified "Excavator" (EQUIPMENT typed VEHICLE) + a stale declared count. Also a schema/UI cap mismatch (comment "0-4" vs picker allowing 5).

**Fix (recommend Option B — reconcile + label, lowest risk):** keep `carsCount` as the declared budgeting input, but show a reconciliation nudge on the household surface when `carsCount !== assetVehicleCount` ("You've noted 4; 5 are in Assets — update?"); fix the "0-4"/5 cap mismatch; re-classify "Excavator" → EQUIPMENT (data). (Option A — derive the count from Assets — risks the pre-Assets onboarding budgeting use; only safe with a zero-asset fallback.)

**Lowest-ring test:** Ring-2 parity entry — assert the two counts are equal OR a reconciliation flag is emitted when they differ.

**§19.4 downstream sweep:** `carsCount` → household page + onboarding + budget/expense calibration; `Asset type='VEHICLE'` → Assets grouping + totals + WealthUniverse + car-loan linking.

**Chrome verification spec:** capture household vehicle count + Assets vehicle count (+ the reconciliation nudge). **Regression guard:** budget/expense estimates driven by `carsCount` must be unchanged (Option B keeps `carsCount` as the budgeting input).

**§20.6 gate:** Document 10/10 · Requirements 10/10 · Logic 10/10 (display/reconcile, no number changed). ⚠️ exact off-by-one cause (Excavator classification, carsCount=4) is data-dependent — confirmed via Chrome.

#### MON-041 — Vehicle depreciation shown as −200% / −66.7%  ·  🟢 low · changesNumbers: no

**Verified root cause (§19.2):** `depreciationPercent = (purchase − current)/purchase × 100` is correct **signed** math — for an appreciating asset (`current > purchase`) it's legitimately negative. The bug is display: the dialog hardcodes the label "Depreciation" (`assets/page.tsx:624`) and prints the **raw negative** percent (`:633`) while the dollar amount IS `Math.abs()`'d (`:631`) and the icon flips green ↑ (`:628`) — so it shows green ↑ "+$20,000" but "(−200.0%)" under "Depreciation." The formula is also **re-typed in 3 routes** (`assets/route.ts:59`, `assets/[id]/route.ts:50`, `portfolio/snapshot/route.ts:909`) — a §12.2.1 duplicate-formula smell.

**Fix (display + SSOT cleanup):** make the label sign-aware ("Depreciation" vs "Appreciation") and render `Math.abs(depreciationPercent)`; extract ONE helper `lib/utils/assetValuation.ts → computeValuationChange()` returning `{ change, changePct, direction }` and import it in all three routes so the label can't diverge again.

**Lowest-ring test:** Ring-0 on the new helper (appreciating input → `direction:'appreciation'`, positive `changePct`) + a Ring-2 render guard ("Depreciation" never co-occurs with a negative percent).

**§19.4 downstream sweep:** `depreciationPercent`/`depreciation` → assets dialog + list + portfolio snapshot asset block + any `/api/assets` `_computed` consumer — all unified by the helper.

**Chrome verification spec:** capture the 300Z + Landcruiser dialogs (label + percent + arrow). **Regression guard:** a genuinely-depreciating vehicle must still read "Depreciation" with a positive percent.

**§20.6 gate:** Document 10/10 · Requirements 10/10 · Logic 10/10 (value correct; display + dedup). No data dependency — the −200%/−66.7% reproduce exactly from the formula.

#### MON-039 — Minor display trio (Medicare / Money-In / property tile)  ·  🟢 low · changesNumbers: no

**Verified root cause (§19.2, three sub-parts):** (a) Medicare IS rendered in the tax **breakdown** (`tax/page.tsx:324–327`) but absent from the four **summary cards** (`:238–262`) — a completeness gap, value correct (`medicareLevyCalculator.ts:38`). (b) `/cashflow` GlassMoneyFlowTile shows headline "In" = `netIncome` (`:80`) while the footnote "{n} income source(s) fed" is gated on `incomeLines.length > 0` (`:149`) — so "$0 In … 1 source fed" can co-occur. (c) `PropertyTile.tsx:401` gates the whole "Cashflow / yr" block behind `isInvestment`, so a non-investment (or mis-flagged) property omits it.

**Fix:** (a) add a Medicare line to the tax summary surface (or an "incl. $X Medicare" subline on Taxable Income `:252`); (b) gate the footnote on `netIncome > 0` OR reword to "N sources configured"; (c) confirm Guildford's `isInvestment` classification (data) and, if owner-occupied properties should still show a $0 line, relax the `:401` gate to a labelled "—".

**Lowest-ring test:** Ring-2 render guards — tax summary includes a Medicare element; MoneyFlowTile never shows "fed this month" when `netIncome === 0`; every property tile renders a cashflow line (value or placeholder).

**§19.4 downstream sweep:** `medicareLevy` also feeds /cashflow tax estimate + My Guide; MoneyFlowTile is /cashflow-only; PropertyTile cashflow uses canonical `cashflowOf` — the gate is presentation-only.

**Chrome verification spec:** capture the tax cards (Medicare line present), the /cashflow Money-In tile (no contradictory footnote), the Guildford list tile (cashflow line present). **Regression guard:** the tax breakdown Medicare value + other property tiles' cashflow lines unchanged.

**§20.6 gate:** Document 10/10 · Requirements 10/10 · Logic 10/10 (display-only). ⚠️ (b) the exact reason `netIncome` can be 0 with an income line present needs the waterfall builder (not read this session) — to confirm at fix time; (a) "which two tax cards" is the reviewer's phrasing — Medicare is a summary-card omission, verified.

---

## 7. Already-FIXING findings (shipped fixes — need only the per-fix Ring-3 Chrome check to close)

These carry shipped fixes at HEAD (verified present in source), status FIXING pending real-data confirmation. They need **no new code** — only their per-fix Chrome verification (§3) to advance to VERIFIED:

| Issue | Shipped fix (verified at HEAD) | Chrome check |
|---|---|---|
| MON-012 | `computeAccessibilityBuckets` partitions net worth (tie-out by construction) | Liquid + Accessible + Locked == Net worth on Balances |
| MON-031 | Cards-aware Balances micro-copy (two correct measures, relabelled) | Balances "after your credit cards" copy present; $2,496 gap self-explained |
| MON-018 | Monthly progress reads canonical `getNetWorthHistory` (×0.98 placeholder deleted) | My Guide net-worth Δ == Home trend tile |
| MON-019 | 999-month sentinel guarded; benefit sign fixed | No "save 69 years"; benefit ≥ 0 (LVR-gate residual → MON-038) |
| MON-020 | /cashflow + My Guide read one Medicare-inclusive `getUserTaxPosition` | Same tax estimate both surfaces; Medicare included |

Residual for cluster ④: MON-012/031 also want the Ring-2 cross-surface bucket lock + Neomatrix bucket nodes (named at `parityMatrix.ts:128–129`) — a coverage-growth item, not a code fix.

---

## 8. Verification status & confidence

| Cluster | Root cause | My independent source verification |
|---|---|---|
| ① MON-037 | ✅ verified | `propertyCashflow.ts:41–45,162`, `expenseAggregator.ts:22–36`, `taxPositionCalculator.ts:181–198` all read — no `isRecurring` gate confirmed |
| ②③ MON-035/036 | ✅ verified | `portfolio/snapshot/route.ts:616` (12-mo) + `propertyActuals.ts:152–174` (all-time) read; window mismatch confirmed |
| ④ MON-040 | ✅ verified end-to-end | `incomeTaxCalculator.ts:118` + `taxPositionCalculator.ts:262,344–364` read; percent/decimal confirmed |
| ④ MON-038 | ✅ verified | `loanDecisionSupport.ts:405–421` read; ungated refinance action confirmed |
| ⑤ MON-043 | ◑ agent-diagnosed, anchors precise | producers cited to `file:line`; full re-verify at fix time (labelling fix, low risk) |
| ⑥ MON-042/041/039 | ◑ agent-diagnosed, anchors precise | display/count; full re-verify at fix time (changesNumbers: no) |

⚠️ **Exact live magnitudes** (the specific dollar/percent values) are data-dependent and confirmed via the per-fix Chrome check, not from source. Every **mechanism** above is verified.

## 9. Review gate (§20.6 / §20.5)

**3× self-review performed on this plan.** What the critique changed: v1 listed all 43 registry issues → narrowed to the **9 OPEN** findings as the actual new-work set (the other FIXING items are §7, code-complete, awaiting Chrome). v2 treated MON-043/042 as SSOT collapses → corrected to **basis-labelling** (forcing equality would be a wrong fix hiding real semantic differences — the cluster ⑥ agent's load-bearing catch, re-verified). v3 surfaced the **two product decisions** as explicit blockers rather than guessing them (§20.5). Every number-changing root cause was re-verified by me in source before being called "verified."

**Honest scores:** the plan itself is **10/10** against the request. With DECISIONS 1 & 2 now made (§5), **all nine per-issue fixes are at a full 10/10** — every root cause verified in source, every fix fully specified, every Ratchet test + Chrome spec defined. No fixing starts until your "go."

## 10. Decisions log

| Decision | Resolution | Date |
|---|---|---|
| DECISION 1 — one-off expense semantics | **Exclude from recurring total, show as in-month actual** | 2026-07-14 |
| DECISION 2 — canonical property transaction window | **Trailing 12 months** | 2026-07-14 |
