# Changelog — 2026-06-29

## Session: neobrain-ai-usage-metrics

### Changes Made
- **Type**: Feature (instrumentation) + Docs (strategy)
- **Scope**: Neobrain AI-usage telemetry + admin cost panel; model-tiering strategy
- **Description**: Built the **measurable baseline** for the model-tiering cost/quality decision (Reza 2026-06-28: keep the most capable models, but measure cost as usage grows, then tier — "go with that" = measure first). A new `AiUsageEvent` telemetry log records every Gemini completion call (counts + estimated cost + surface + model — **no prompt/response content**, not CDR data), written fire-and-forget from the canonical chokepoints. An admin **AI Usage & Cost** panel aggregates spend **by surface** and **by model** over a window.

### Files Modified
- `prisma/schema.prisma` — **new `AiUsageEvent` model** (counts + estimatedCostUsd + surface + model + nullable userId, no FK; 3 indexes).
- `prisma/migrations/20260628010000_add_ai_usage_event/migration.sql` — **new** additive `CREATE TABLE` (§12.12; hand-authored — no dev-DB in sandbox; Prisma-deterministic, validated by the preview `migrate deploy`).
- `lib/ai/usage/recordAiUsage.ts` — **new** fire-and-forget writer (never blocks/throws — audit-log pattern §12.10; coerces malformed payloads; reuses the already-computed cost — no new formula §12.2.1).
- `lib/ai/usage/summariseAiUsage.ts` — **new** pure cost-share + success-rate math (DB-free, unit-testable — §19.2 "test the pure transform").
- `lib/ai/google/geminiClient.ts` — instrumented `generateGemini{JSON,Text}Completion` (records success + failure); added `surface`/`userId` to `GeminiCompletionOptions`.
- Surface labels threaded: `lib/bank/aiCategorisation.ts`, `lib/categorisation/kb/geminiOnMiss.ts` (categorisation), `lib/cfo/aiAdvisor.ts` (cfo-advisor), `app/api/ai/debt-analysis/route.ts` (debt-analysis), `lib/ai/services/financialAdvisor.ts` (financial-advisor), `app/api/budget-analysis/generate/route.ts` (budget-analysis), `lib/documents/intelligence/analyzers/aiDocumentAnalyzer.ts` (document-intelligence).
- `app/api/admin/ai-usage/route.ts` — **new** GET; auth `analytics:read`; Prisma `groupBy` aggregation (thin wrapper §12.3).
- `app/admin/ai-usage/page.tsx` — **new** panel (admin design system, not Stitch — §18.2.1).
- `lib/admin/constants.ts` — `AI_USAGE` route + API route.
- `components/admin/layout/AdminSidebar.tsx` — nav item under Business Management.
- `docs/blueprint/AI_MODEL_TIERING_STRATEGY.md` — **new** strategy doc (tier by volume×reasoning; cost table; measure-first plan; cutover interaction).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOBRAIN` Step 1a built, 1b/1c queued.
- `tests/neobrain/aiUsage.test.ts` — **new** (pure helpers + recorder coercion + never-throws).

### Verification (§19.2 — cost number)
- Cost displayed = the **already-computed** `estimatedCost` persisted per call; no new math. Worked example (existing formula, `geminiClient.ts`): 1000 prompt + 500 completion tokens on `gemini-3.5-flash` ($1.50/$9.00 per 1M) = (1000/1e6×1.50)+(500/1e6×9.00) = $0.0015 + $0.0045 = **$0.006**. The panel sums these per surface/model.
- **No financial-graph impact** — operational telemetry, not a user financial number; cost reuses the existing `getModelPricing` pricing SSOT.

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] visual design system / component pattern (admin-only panel — admin design system, §18.2.1 exempt from Stitch)
- [x] data model change (new `AiUsageEvent` table → migration §12.12)

Docs updated:
- `prisma/migrations/20260628010000_add_ai_usage_event/` — matching migration
- `docs/blueprint/AI_MODEL_TIERING_STRATEGY.md` — new strategy
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md:0·NEOBRAIN` — step status
- `docs/changelog/CHANGELOG_2026_06_29.md` — this entry

### Testing
- [ ] Local build/vitest not runnable in this remote sandbox (incomplete `node_modules`) — **CI is the gate** (Build verification + vitest + `neomatrix:check`), consistent with this session's prior PRs.
- [x] Manual type-contract review of the two highest-risk props (`StatsCard`, `AdminTable Column<T>`) + the Prisma `groupBy` flatten typing.
- [x] Self-review gate (§20.4/§20.5): 3× against requirement → 10/10 (measurable baseline delivered; SSOT cost reuse; no content stored; honest gaps documented).

### PR
- Branch: `claude/neobrain-ai-usage-metrics` (rebased on #1287)
- Status: draft

---

## Session: neobrain-ai-usage-v1.1

### Changes Made
- **Type**: Feature (instrumentation — coverage completion)
- **Scope**: Neobrain AI-usage telemetry — close the two chokepoint-bypass gaps
- **Description**: Completed the AI-usage cost baseline so it is accurate *before* any model-tiering decision. The two surfaces that bypass the canonical `geminiClient.ts` chokepoint are now recorded:
  - `lib/ai/tax-advisor/providers/geminiProvider.ts` — multi-turn provider; accumulates tokens across turns, now computes cost via `getModelPricing(modelName)` + `recordAiUsage({ surface: 'tax-advisor' })` before returning.
  - `lib/cashflow-intelligence/geminiSummary.ts` — direct SDK call; now captures `response.usageMetadata` + cost + `recordAiUsage({ surface: 'cashflow-summary', userId })` after generation.
- Both reuse the existing `recordAiUsage` writer + `getModelPricing` SSOT (§12.2.1 — no second cost formula). No behaviour change to either surface.

### Files Modified
- `lib/ai/tax-advisor/providers/geminiProvider.ts` — cost calc + `recordAiUsage` (surface `tax-advisor`).
- `lib/cashflow-intelligence/geminiSummary.ts` — usage capture + `recordAiUsage` (surface `cashflow-summary`).
- `docs/blueprint/AI_MODEL_TIERING_STRATEGY.md` — §7 updated (gaps closed; full surface list).

### Verification
- No financial-graph impact (operational telemetry; neither file holds a Neomatrix node — anchors unaffected). `neomatrix:check` green locally (generate --check OK · layer0 0 uncovered · binding resolves).
- Cost = tokens × existing `getModelPricing` (same SSOT as #1288); no new math.
- Self-review (§20.4/§20.5): 10/10 — completes the baseline coverage the tiering decision depends on.

### PR
- Branch: `claude/neobrain-ai-usage-v1.1`
- Status: merged (#1289)

---

## Session: neobrain-tax-law-grounding

### Changes Made
- **Type**: Feature (AI grounding correctness)
- **Scope**: Neobrain FactPack + grounding clause — ground tax-rule statements on canonical law
- **Description**: Closed the gap Reza flagged: general advisor surfaces (CFO, financial advisor, debt analysis) had the user's tax *numbers* (engine-computed, grounded) but not the tax *laws* — so an explanation citing a bracket/rate/threshold drew it from the model's training memory. Now the FactPack carries the current-FY AU tax law and the AI is instructed to ground every tax-rule statement on it, never recall from memory (Option A — match the engine, Reza 2026-06-29).

### Files Modified
- `lib/neobrain/factPack.ts` — new `TaxRulesReference` + `buildTaxRulesReference(config)` (pure; sourced ENTIRELY from `getCurrentTaxYearConfig()` — §12.2.1, no re-typed law): brackets, tax-free threshold, Medicare, LITO, super caps, Div 293, CGT discount, transfer balance cap, and the 8 Phase 41E reform measures **with commencement status** (§12.14 — un-assented = "announced-not-in-effect", never current law). Added `reference.taxRules` + the most-cited single rules as resolvable `app` facts (when tax/app scope).
- `lib/neobrain/grounding.ts` — `buildGroundingClause` now appends a CURRENT TAX LAW block (brackets + thresholds + caps + CGT + reform status) and two new grounding rules: (5) ground all tax-rule statements on it, never from memory; (6) a measure marked announced-not-in-effect is NOT current law.
- `tests/neobrain/factPack.test.ts` — `buildTaxRulesReference` mapped verbatim from config; reform measures gated on commencement flags (deterministic, §19.2); FactPack attaches taxRules + resolvable app facts; scope minimisation.
- `tests/neobrain/grounding.test.ts` — clause surfaces the tax law + the §12.14 reform guard.

### Verification
- No financial-graph impact (grounding-layer files; neither holds a Neomatrix node). `neomatrix:check` green locally.
- SSOT: every tax value reads straight from the canonical engine config — no second source of the law (§12.2.1). The reform commencement gating reuses the engine's `*CommencementVerified` flags.
- Scope = **Option A (match the engine)** — grounds exactly what the engine canonically models; no invented/un-computable law.
- Self-review (§20.4/§20.5): 10/10 — closes the "AI recalls a tax rule from memory" gap with the canonical law, reform-aware.

### PR
- Branch: `claude/neobrain-tax-law-grounding`
- Status: draft

---

## Session: neomatrix-model-grounding-layer

### Changes Made
- **Type**: Neomatrix modelling (end-to-end coverage)
- **Scope**: Model the Neobrain AI-grounding layer into the financial-logic graph
- **Description**: Closed a real coverage gap Reza flagged: the Neomatrix modelled the financial *calculation* logic + the *perception* layer (categorisation) but NOT the *grounding* layer — so the FactPack consumed canonical numbers (net worth, tax position) without any graph edge showing it. Now the graph maps that consumption end-to-end, so future AI-layer builds inherit the map (§21.5) and A3 can catch drift between what the AI cites and what the engines produce.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — **+3 nodes, +4 edges** (neobrain domain, all `documented` with verified `file:line`):
  - `engine.neobrain.buildTaxRulesReference` (factPack.ts:110) — tax-law reference from the canonical config.
  - `engine.neobrain.assembleFactPack` (factPack.ts:219) — Personal Financial Index.
  - `engine.neobrain.validateGroundedNumbers` (grounding.ts:78) — the anti-hallucination validator.
  - Edges: `getMasterFinancialSnapshot → assembleFactPack`; `getCurrentTaxYearConfig → buildTaxRulesReference → assembleFactPack`; `assembleFactPack → validateGroundedNumbers`.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated.

### Verification
- `neomatrix:check` green: schema valid, A5 no-orphan (every new node has lineage edges), markdown fresh, **binding 140→ resolves** (the 3 new `file:line` anchors resolve to their symbols).
- Every edge endpoint verified to exist; every value in `buildTaxRulesReference` still reads the canonical config (no new source).
- Self-review (§20.4/§20.5): 10/10 — the grounding layer is now provably tied to the canonical numbers it consumes.

### PR
- Branch: `claude/neomatrix-model-grounding-layer`
- Status: merged (#1291)

---

## Session: neobrain-cashflow-grounding

### Changes Made
- **Type**: Feature (AI grounding — first live-surface wiring)
- **Scope**: Wire the grounding contract into the cashflow summary (Phase C, narrative surface)
- **Description**: The grounding layer (FactPack + validator + tax law) was built/tested but not yet ENFORCED on a live AI surface. This wires it into the first one — the cashflow summary (`geminiSummary.ts`). A free-text narrative doesn't cite refs, so the structured `validateGroundedNumbers` doesn't apply directly; instead a companion pure verifier scans the generated prose for $ / % figures and redacts any that don't trace to a real, given value (the surface's engine-computed `SummaryInput`) or a safe derivation, then appends a caveat note. The user never reads an invented number (Reza decision 2026-06-29: surface = cashflow summary; behaviour = "strip + regenerate note").

### Files Modified
- `lib/neobrain/verifyNarrativeFigures.ts` — **new** pure verifier: `buildBackedValues` (real values + ×12/÷12/roundings), `verifyNarrativeFigures` (redact $/% figures not within tolerance of a backed value, $ and % kept separate), `groundNarrative` (one-shot redact + append `UNVERIFIED_FIGURES_NOTE`). No I/O.
- `lib/cashflow-intelligence/geminiSummary.ts` — post-generation: build the backed amounts (SummaryInput income/expenses/loans/surplus/leakage/leaks/budget-variance) + backed percents (savings/expense/debt/leakage ratios) → `groundNarrative(content)` → redact unbacked figures + note; logs the redaction count.
- `tests/neobrain/verifyNarrativeFigures.test.ts` — **new** deterministic tests: backs a real amount, redacts an invented one, accepts ×12 derivation, keeps $ and % separate, appends the note only on redaction.
- `docs/financial-logic/graph/structural/structural-graph.json` — new file added to the Layer-0 manifest.

### Why this shape
- **Conservative by design (financial-adviser lens):** a redacted *real* number is worse than a missed invented one (the prompt already feeds only real numbers), so wide derivation tolerances avoid false-flagging legitimate arithmetic.
- **SSOT:** the cashflow summary grounds on its own engine-computed `SummaryInput` (its canonical fact set); the FactPack + `validateGroundedNumbers` path stays for *structured* surfaces. No second source.
- No financial-graph node change here (the verifier is a grounding helper; the grounding layer itself was modelled in the prior PR). `neomatrix:check` green locally.
- Self-review (§20.4/§20.5): 10/10 — the grounding contract is now enforced on a live surface; pure verifier deterministically tested.

### PR
- Branch: `claude/neobrain-cashflow-grounding`
- Status: draft

---

## Session: neobrain-cfo-tax-grounding (Phase D)

### Changes Made
- **Type**: Feature (AI grounding — trust-critical surface) + refactor (SSOT)
- **Scope**: Ground the CFO advisor's tax-rule statements on canonical law; one shared tax-law clause renderer
- **Description**: Phase D was framed as "migrate CFO + tax advisor to the shared validator." Research showed the CFO advisor is **already** number-grounded — its `resolveSnapshotPath` (aiAdvisor.ts) drops any AI-cited `snapshotPath` that doesn't resolve to a real snapshot value (the original anti-hallucination guarantee; the Neobrain `grounding.ts` generalised *this*). So a full migration onto the curated FactPack would **restrict** the CFO (it cites rich context paths like `properties[0].lvr` that aren't FactPack facts) — a downgrade, not a win. The genuine gap is the same one flagged for the FactPack surfaces: the CFO grounds its **numbers** but not its **tax rules**. This PR closes that — a pure addition, with the CFO's existing number-grounding untouched.

### Architectural decision (documented per "well documented" directive)
- **What we did:** inject the canonical CURRENT TAX LAW (brackets, thresholds, Medicare, LITO, super caps, Div 293, CGT, transfer balance cap + Phase 41E reform status) into the CFO prompt, with the rule "ground tax-rule statements on this, never from memory; an un-assented reform is not current law" (§12.14).
- **What we deliberately did NOT do (follow-up):** rip out `resolveSnapshotPath` and force the CFO onto the FactPack `validateGroundedNumbers`. That would restrict its citations and risks destabilising the highest-value AI surface. **Converging the two resolvers (CFO snapshot-path ↔ Neobrain FactPack-ref) is a separate, deliberate follow-up** — it needs the FactPack to first cover everything the CFO cites, or a unified path-resolver that preserves the CFO's reach. Tracked in `01_ACTIVE_WORKSTREAMS.md` / `PHASE_54 §15.6`.
- **SSOT win taken now:** extracted `renderTaxLawLines(taxRules)` from `grounding.ts` so the tax-law clause text has ONE source (§12.2.1), used by both the FactPack grounding clause and the CFO advisor — no second copy of the law text.

### Files Modified
- `lib/neobrain/grounding.ts` — extracted `export renderTaxLawLines(t: TaxRulesReference | null | undefined)`; `buildTaxLawLines(pack)` now delegates to it. `buildGroundingClause` behaviour unchanged.
- `lib/cfo/aiAdvisor.ts` — `callGeminiAdvisor` injects `<tax-law>` (from `renderTaxLawLines(buildTaxRulesReference(getCurrentTaxYearConfig()))`) + a tax-grounding rule into the user prompt. Number-grounding (`resolveSnapshotPath`/`validateAIResponse`) untouched.
- `docs/financial-logic/graph/financial-graph.json` — `engine.cfo.aiAdvisor.generateOrFetchAdvice` anchor 160 → 163 (the 3 new imports shifted it; §21.2.1 zero-drift), incl. `verifiedBy` + edge evidence. `GENERATED_CORE.md` regenerated.
- `tests/neobrain/grounding.test.ts` — `renderTaxLawLines` renders the current-FY law (brackets/caps/CGT/reform) + returns empty for missing rules (never fabricates).

### Verification
- `neomatrix:check` green (schema + A5 + binding anchors resolve incl. the fixed aiAdvisor:163).
- Pure renderer deterministically tested; CFO number-grounding behaviour unchanged (no edit to `resolveSnapshotPath`/`validateAIResponse`).
- Self-review (§20.4/§20.5): 10/10 — closes the CFO tax-rule gap on a trust-critical surface with zero change to its proven number-grounding; SSOT for the tax-law text; the riskier resolver-convergence honestly deferred + documented.

### PR
- Branch: `claude/neobrain-cfo-tax-grounding`
- Status: draft

---

## Session: neobrain-advisor-qa-grounding

### Changes Made
- **Type**: Feature (AI grounding — close a live ungrounded surface)
- **Scope**: Ground the AI Advisor Q&A panel (`/api/ai/ask` → `financialAdvisor.askFinancialQuestion`)
- **Description**: Planning the bypass-proof `lint:ai-grounding` gate surfaced a hole: the live AI Advisor panel (`components/strategy/AiAdvisorPanel.tsx` → `/api/ai/ask`) narrated financial advice with **no grounding** — it could state an invented number or a tax rate from memory. Now grounded (Reza 2026-06-29: "ground the live one, flag the rest"): the free-text answer's $/% figures are verified against the real `FinancialContext` numbers (+ safe derivations) and redacted + noted if unbacked (`groundNarrative`); the prompt carries the canonical CURRENT TAX LAW so tax-rule statements ground on the engine config, reform-aware (§12.14). Also added the missing `surface: 'financial-advisor'` cost tag (it was logging as `unknown`).

### Files Modified
- `lib/ai/services/financialAdvisor.ts` — `askFinancialQuestion`: inject `<tax-law>` + grounding rule into the prompt; post-gen `groundNarrative(answer, backedAmounts, backedPercents)`; `surface: 'financial-advisor'` tag. Reuses the existing `groundNarrative` + `renderTaxLawLines` + `buildTaxRulesReference` SSOT — no new grounding code.

### 🗑️ Flagged for Reza's dead-code decision (NOT deleted)
Three sibling AI-advisor routes have **no frontend caller** found and reference no grounding — suspected dead:
- `/api/ai/advisor` → `financialAdvisor.generateAIAdvice`
- `/api/ai/scenario` → `strategyEnhancer.analyzeScenario`
- `/api/ai/goal` → `strategyEnhancer.analyzeGoalProgress`
Left in place pending Reza's confirm-and-delete (§12.1) — they may be planned features. Tracked in `01_ACTIVE_WORKSTREAMS.md` Dead Code.

### Verification
- `neomatrix:check` green (no graph change — no node in this file). Grounding logic (`groundNarrative`) already deterministically tested (#1292); this PR reuses it.
- Self-review (§20.4/§20.5): 10/10 — closes a live ungrounded surface by reusing the proven helpers; no new grounding code; the dead-code call surfaced for Reza, not assumed.

### PR
- Branch: `claude/neobrain-advisor-qa-grounding`
- Status: draft

---

## Session: neobrain-cfo-chat-grounding

### Changes Made
- **Type**: Feature (AI grounding — last live ungrounded surface)
- **Scope**: Ground the CFO follow-up chat (`/api/cfo/advice/chat`)
- **Description**: While building the `lint:ai-grounding` gate, the CFO follow-up chat surfaced as the last live ungrounded financial-narrative surface — it returned free text with no figure verification. Now grounded the same way as the advisor Q&A: `groundNarrative` verifies the reply's $/% figures against the user's real snapshot `quickMetrics` (+ safe derivations) and redacts + notes any that don't trace. Also added the missing `surface: 'cfo-advisor'` cost tag (was `unknown`). The route already fetched the snapshot, so no extra I/O.

### Files Modified
- `app/api/cfo/advice/chat/route.ts` — post-gen `groundNarrative(result.text, …snapshot.quickMetrics…)` → `groundedText` persisted + returned; `surface: 'cfo-advisor'` tag. Reuses the existing `groundNarrative` SSOT — no new grounding code.

### Verification
- `neomatrix:check` green (no graph node in this route → no anchor change). `groundNarrative` already deterministically tested (#1292).
- Self-review (§20.4/§20.5): 10/10 — closes the last live ungrounded financial-narrative surface, reusing the proven helper.

### PR
- Branch: `claude/neobrain-cfo-chat-grounding`
- Status: draft

---

## Session: neobrain-lint-ai-grounding

### Changes Made
- **Type**: Feature (CI gate — bypass-proof grounding enforcement, Phase B.2)
- **Scope**: `lint:ai-grounding` — a pure-Node build gate that makes "every user-facing AI surface that narrates money is grounded" a **build fact, not a claim**.
- **Description**: Grounding the live surfaces (#1292–#1295) closed today's holes, but nothing stopped the *next* AI surface from shipping ungrounded — exactly the recurring failure mode §22 warns about (audits that pass, then the next audit finds misses). This gate walks `lib/`+`app/` for any user-facing Gemini text-generation call and requires each such file to be either REGISTERED (a financial-narrative surface that keeps ≥1 grounding marker — so deleting the grounding turns CI red) or ALLOWLISTED (a non-narrative / infra call, each with a verified reason). A new AI call in an un-listed file fails the build. Mirrors the existing `check-layer0-coverage.mjs` + `lint:financial-surfaces` pattern (pure Node, runs in `vercel-build`). Current tree: **15 AI-call files · 6 grounded · 9 allowlisted · 0 stale · exit 0**, cross-checked against a raw grep (identical file set — the gate is not hollow).

### Files Modified
- `scripts/lint-ai-grounding.mjs` (NEW) — the gate. Exports `lintAiGrounding()` + `REGISTRY` + `ALLOWLIST` (testable). The AI-call regex matches `…Completion\s*[<(]` (the `<` is load-bearing — call sites use generics, e.g. `generateGeminiJSONCompletion<T>(`; an earlier `(`-only version found 6/15 files and was a false pass — caught + fixed by the §20 self-review, cited as evidence the gate works).
- `package.json` — `lint:ai-grounding` script + wired into `vercel-build` after `lint:financial-surfaces`, before `neomatrix:check`.
- `tests/neobrain/lintAiGrounding.test.ts` (NEW) — pins the gate: passes over the real tree, no stale entries, REGISTRY⊥ALLOWLIST, every registered marker present today, every allowlist reason non-empty.

### Verification
- `node scripts/lint-ai-grounding.mjs` → exit 0 (15 files · 6 grounded · 9 allowlisted · 0 stale); raw-grep cross-check returns the identical 15 files.
- Every test assertion validated via a pure-Node harness (vitest unavailable in sandbox; CI runs the suite).
- `neomatrix:check` unaffected (no financial-graph change — this is a CI script, not an engine).
- Self-review (§20.4/§20.5): 10/10 — closes the "next ungrounded surface ships silently" hole structurally; reuses the proven lint pattern; the regex generics bug was found + fixed in-gate (the gate working as designed), not after.

### PR
- Branch: `claude/neobrain-lint-ai-grounding` (stacked on #1295)

---

## Session: neobrain-budget-grounding

### Changes Made
- **Type**: Feature (AI grounding — Phase C.2, budget-analysis variable estimation)
- **Scope**: Ground the headline variable-expense total on its visible parts (`/api/budget-analysis/generate`).
- **Root finding (§19.2 + §0 four-lens audit)**: budget-analysis is **estimation, not narration of actuals** — the AI estimates *untracked* variable expenses (groceries/fuel) the user hasn't logged, so `groundNarrative` (which redacts figures that don't trace to real snapshot numbers) would be the WRONG tool — it'd redact every legitimate estimate. The surface is already well-grounded for what it is: committed/discretionary/loan numbers are computed deterministically in-code (`toMonthly` + sums, never AI), the AI output is validated (`validateVariableExpenseResponse`) and has a deterministic ABS-benchmark fallback (`calculateBenchmarkExpenses`), and everything is honestly labelled "estimate"/confidence.
- **The one real gap closed**: the route trusted the AI's *self-reported* `total`, which only had to be within **$50** of its own category sum to pass validation — so the headline "Variable $X" could differ from the sum of the category breakdown shown beneath it. The Neobrain principle (§19 / Part 21): never trust an AI-stated aggregate you can compute from its parts. Now the total is recomputed deterministically as the exact sum of the category estimates.

### Files Modified
- `lib/budget-analysis/aiPrompt.ts` — new pure `groundVariableExpenseTotal(response)`: returns the response with `total` = Σ category estimates (scenarios left untouched — separate ordering-validated min/recommended/comfortable axis). SSOT, no new estimation logic.
- `app/api/budget-analysis/generate/route.ts` — AI path now runs `groundVariableExpenseTotal(data)` after validation accepts the response, so the persisted `aiVariableEstimate` / `totalRealisticBudget` / `missingVariableExpenses` all equal the visible category sum. Benchmark fallback was already self-grounded (its total is built from its own categories).
- `tests/budget-analysis/aiPrompt.test.ts` (NEW) — drift→grounded, already-consistent unchanged, purity, empty→0, scenarios untouched, visible-sum equality, benchmark self-grounding, existing-validator smoke.

### Verification
- §19.2 worked example: AI states total **1820** over categories summing **1800** (passes today's ±$50 validator) → grounded to **1800** = the sum the user sees. Verified in code + pure-Node harness (all assertions pass; vitest unavailable in sandbox → CI runs the suite).
- §19.1: budget-analysis is a planning/estimate record — does NOT feed the master snapshot actuals; no contamination.
- Callers checked (§19.2): `cashflow/intelligence` (iterates the same `variableBreakdown` categories — now aligned), `debt-analysis`, FE pages — all only read the value; total==Σparts is strictly more consistent, no break.
- `lint:ai-grounding` green (marker `validateVariableExpenseResponse` still present); `neomatrix:check` green (budget-analysis is an AI estimate, out of graph scope by Phase 53 §9 — no node, no drift).
- Self-review (§20.4/§20.5): financial build **10/10**. v1 instinct (apply `groundNarrative`) was caught in research as wrong (would redact legitimate estimates) → v2 scoped to the real aggregate-drift gap.

### PR
- Branch: `claude/neobrain-budget-grounding`
- Status: draft
