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
