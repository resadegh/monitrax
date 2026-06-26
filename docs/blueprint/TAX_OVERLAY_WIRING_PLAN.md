# Tax Step-3 Overlay Wiring — Implementation Plan (deferred)

> **Status:** PLANNED (not built). Reza decision 2026-06-26: *"for uncomputed shells go with your
> recommendation, however document and plan it for later implementation."* The recommendation —
> **do NOT ship empty router shells now**; wire the overlays as a real end-to-end feature when
> scheduled, FTE/IEE first as the proving slice. This doc is that plan.
>
> **Scope discipline:** documentation/model only at this stage. NO financial logic changes ship from
> this doc until the work is explicitly scheduled. Every fact below was read in source (§19.2); no
> guesses. The five engines are correct, tested, and dormant — the gap is *wiring + input capture*,
> not the math.

---

## 1. Why this exists — the verified current state

`lib/tax-engine/orchestrator/masterTaxPosition.ts:27-34` designs a **step-3 "per-entity advanced
overlays"** stage listing five engines: **Div 152 SBC, PSI, FTE/IEE, trust loss rules, company loss
rules.** Today none of them affect a single user-facing number. Two distinct reasons, both verified:

| # | Engine | Entry point (verified) | Wired into orchestrator? | Input ever populated? | Net effect |
|---|---|---|---|---|---|
| 1 | **PSI classifier** | `divisions/psiClassifier.ts:141` `classifyPsi(PsiInput)` | ❌ no (never added to the loop) | — | dormant |
| 2 | **Div 152 SBC** | `divisions/div152SmallBusinessConcessions.ts:150` `applyDiv152(Div152Input)` | ❌ no | — | dormant |
| 3 | **FTE/IEE** | `divisions/fteIeeClassifier.ts:166` `classifyFteIeeDistributions(FteIeeInput)` | ❌ no | — | dormant |
| 4 | **Trust loss rules** | `divisions/trustLossRules.ts:128` `applyTrustLossRules(TrustLossInput)` | ✅ yes (`masterTaxPosition.ts:231-237`) | ❌ `input.trustLossByEntity` never set | dormant |
| 5 | **Company loss rules** | `divisions/companyLossRules.ts:83` `applyCompanyLossRules(...)` | ✅ yes (`masterTaxPosition.ts:239-245`) | ❌ `input.companyLossByEntity` never set | dormant |

**Plus a third, larger fact:** `buildMasterTaxPosition` itself has **zero production callers** —
`grep buildMasterTaxPosition app/ → ∅`. The LIVE per-entity tax path is
`/api/tax/entity/[entityId]` → `calculateEntityTaxPosition` (`entity/entityTaxRouter.ts:300`). So even
the two "wired" overlays (4, 5) are *doubly* dormant: their host orchestrator isn't called, and their
inputs aren't populated.

> This is a **MISS, not dead code** (Reza's review question 2026-06-26 — "is it a miss or really dead
> code?" — audited to: a miss). The overlay loop was completed for 2 of 5 engines and the orchestrator
> that hosts it was never promoted into a route. The engines are real, unit-tested, and citation-rich;
> they were built ahead of the data capture + assembly that would feed them.

---

## 2. What "wired" actually requires (the four parts, per engine)

An overlay is only real when all four exist. Today every engine has **part A** and nothing else.

| Part | What | Today |
|---|---|---|
| **A. Engine** | the pure calc (input → result + citations + UNCOMPUTED flags) | ✅ exists for all 5 |
| **B. Input contract** | the typed input the engine consumes | ✅ types exist; ❌ never assembled |
| **C. Assembler** | code that turns the user's entity data into part B (`entityTaxFactsAssembler.ts` is the home) | ❌ does not populate overlay inputs |
| **D. Surface** | a route that calls the engine + a UI that shows the outcome (with a regime/UNCOMPUTED badge, §12.14 FW-5) | ❌ none |

The honest reason not to "just wire them now": parts **C** and **D** are the actual feature. Adding the
engine call to a route without C/D produces an **UNCOMPUTED shell** — the engine runs on empty inputs
and returns "cannot compute" for every user. That is worse than honest absence: it implies a capability
the product doesn't have. (This is the §19 correctness discipline applied to a *missing* number — don't
render a tax outcome we can't actually compute.)

---

## 3. The data each engine needs (capture plan — part B/C)

Sourced from each engine's input interface (§19.2). This is the new data the assembler/onboarding must
capture before the overlay can produce a real outcome.

### 3.1 FTE/IEE — `FteIeeInput` (the recommended first slice)
- `hasFamilyTrustElection: boolean` — **already captured** at `entityTaxRouter.ts:387`
  (`facts.trustDistribution.hasFamilyTrustElection`) but never passed to this engine.
- per beneficiary: `beneficiaryId`, `beneficiaryName`, `distributionAmount`, **`hasQuotedTfn`**,
  and family-group membership. `EntityTaxFacts.trustDistribution.beneficiaries` already has id / name /
  `presentlyEntitledShare`; **missing:** `hasQuotedTfn` + whether the beneficiary is inside the family
  group of the test individual.
- **Why first:** the trigger flag is already in the data model; the gap is the smallest (one boolean
  per beneficiary + the family-group link). It proves the end-to-end pattern (B→C→D) on the engine with
  the least new capture, and FTDT is a real, common trust pain point (behaviour-psychology lens: a
  warm "your distribution to X is outside the family group — FTDT may apply" beats silence).

### 3.2 PSI — `PsiInput`
- `totalPsiIncome`, `incomeFromLargestClient`, number of unrelated clients, results/tools/premises
  tests. **None captured today.** Needs a PSI questionnaire on the relevant entity (sole-trader /
  PSE company). Medium capture cost.

### 3.3 Div 152 SBC — `Div152Input`
- `gainAfterDiv115` — derivable from the existing CGT path (`applyCapitalLossNetting` → discount).
- `maxNetAssetValue` (MNAV < $6M) + aggregated turnover (< $2M) + active-asset test + 15-year /
  retirement / rollover concession selections. **Active-asset + MNAV not captured.** Highest capture
  cost (connected-entity aggregation is itself UNCOMPUTED in v1 of the engine).

### 3.4 Trust loss rules — `TrustLossInput`
- the four trust-loss tests (income injection, 50% stake, pattern of distributions, control) +
  prior-year losses. Needs trust loss carry-forward + the test outcomes. Not captured.

### 3.5 Company loss rules — `CompanyLossInput`
- continuity-of-ownership (COT) / business-continuity (BCT/SBT) outcomes + carry-forward losses.
  Not captured.

---

## 4. Recommended sequencing (the plan)

1. **Slice 1 — FTE/IEE end-to-end (the proving slice).** Capture `hasQuotedTfn` + family-group link on
   trust beneficiaries → assembler builds `FteIeeInput` → call `classifyFteIeeDistributions` in the
   **live** entity path (`entityTaxRouter` trust branch, where `hasFamilyTrustElection` is already
   read) → surface the per-beneficiary outcome on the trust/entity tax position with a "FTDT may apply"
   badge. **v1 surfaces the rule outcome only — does NOT change the result number** (§4.1 boundary).
   This establishes B→C→D once, reusably.
2. **Slice 2 — PSI** (sole-trader / PSE questionnaire → `classifyPsi` → personal-services badge).
3. **Slice 3 — Div 152** (active-asset + MNAV capture → `applyDiv152` on the CGT path).
4. **Slices 4–5 — Trust loss / Company loss** (loss carry-forward + test-outcome capture). These also
   require deciding whether to promote `buildMasterTaxPosition` into a route or fold the loss overlays
   into the entity router (see §5).

### 4.1 The v1/v2 result-number boundary (unchanged, load-bearing)
v1 of every overlay **surfaces the rule outcome + citations + UNCOMPUTED flags; it does NOT re-compute
the entity's tax number.** The rules *can* change the underlying tax (deny a loss deduction, attribute
PSI to an individual, levy FTDT) — that is a **v2** decision, gated and flagged per §12.14 FW-2
(`commencementVerified` / UNCOMPUTED), never applied silently. Surfacing-only keeps v1 financially safe
(§19): we never show a wrong number, only a correct *flag*.

---

## 5. Architectural decision to resolve before Slices 4–5

**Where do the loss overlays live?** Two options, to be decided when scheduled:
- **(a) Promote `buildMasterTaxPosition` into a route** — it already hosts the loss-overlay loop
  (`:231-245`); give it a `/api/tax/master` caller and a household-wide UI. Bigger lift, but it's the
  designed home and unlocks cross-entity + cross-cutting (land tax / GST) in one surface.
- **(b) Fold the loss overlays into `entityTaxRouter`** — smaller, matches the live per-entity path,
  but duplicates the overlay loop the orchestrator already has (a §12.2.1 SSOT risk — would need the
  loop extracted to a shared helper both call).

**Recommendation when scheduled:** (a) — promote the orchestrator, because the overlay loop + citation
aggregation + AFSL footer already exist there and (b) would re-implement them (SSOT violation). But
this is a real architecture call, flagged for Reza at scheduling time, not pre-decided here.

---

## 6. Neomatrix alignment (already done)

The three unwired engines (PSI / Div 152 / FTE-IEE) are modelled in `financial-graph.json` and show
**honestly as allowed islands** via the A6 connectivity gate's reviewed allowlist
(`scripts/neomatrix/graphlib.mjs` `A6_ISLAND_ALLOWLIST`), each annotated *"production-unwired (MISS, not
dead code)"* with its `Fix: input.*ByEntity`. **When a slice ships, the matching engine moves off the
A6 allowlist and its lineage edges to the assembler/route are added in the same PR** (§21.2.1
zero-drift) — the graph becoming connected is the proof the wiring is real.

---

## 7. Reform interaction (§12.14)

Every slice is a §12.14 trigger (touches `lib/tax-engine/*` + per-entity tax position). Each must:
carry a regime parameter or derive it (FW-1), gate any post-reform branch behind `commencementVerified`
or return UNCOMPUTED (FW-2), document grandfathering impact of any new field (FW-3), and surface the
regime badge on the per-asset/entity position (FW-5). The v1 surfacing-only boundary (§4.1) keeps this
simple — no post-reform *number* is computed in v1.

---

## 8. Definition of done (per slice)

- [ ] Input captured (schema + form/assembler) — real data, not a stub.
- [ ] Engine called on the **live** path with assembled input (no UNCOMPUTED-for-everyone shell).
- [ ] UI surfaces the outcome with a regime/UNCOMPUTED badge (§12.14 FW-5).
- [ ] §19.2 worked-example evidence + §20.4 recorded 10/10 (financial build).
- [ ] Neomatrix: engine moved off A6 allowlist, lineage edges added, `neomatrix:check` green (§21.2.1).
- [ ] Doc-sync (§16): Phase 41 doc + this plan ticked.

---

*Created 2026-06-26. Owner: deferred (awaiting scheduling). Source of truth for the step-3 overlay
wiring backlog item in `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md`.*
