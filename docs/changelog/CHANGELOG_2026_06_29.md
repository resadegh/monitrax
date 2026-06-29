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
- Status: draft
