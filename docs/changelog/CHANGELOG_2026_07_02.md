# Changelog — 2026-07-02

## Fix — import 504 timeout: import categorisation is now DETERMINISTIC-ONLY

**Type**: Fix (live prod bug — Reza hit "Import Failed — took too long and timed out" on a 4.8 KB NAB QIF; console showed `POST /api/accounts/…/import` → 504).

**Root cause (verified from the code path, not guessed):** the import ran the AI cascade **inline, serially, per transaction**:
`import route → categoriseWithLearning → categoriseUnknownsViaCascade → categoriseTransactionBatch` (a `for…await categoriseTransaction` loop) → `geminiCategoriseOnMiss` for each unknown. With `KB_GEMINI_ENABLED` **and** `KB_GEMINI_GROUNDING_ENABLED` both on in prod, every unknown merchant triggered an ungrounded **plus** a grounded **web-search** Gemini call — multi-second each, N of them in series. A file with ~20 unknowns → dozens of slow serial LLM calls → the function blew past its timeout → 504 (surfaced by the client's 504 handler as "took too long, split the file").

**Fix:** the import path now passes `skipAiOnMiss: true` — the deterministic cascade only (user mappings + ~50 AU rules + shared-KB prior). Fast + free; known merchants still categorise; genuine unknowns land in review. AI over unknowns is the **opt-in, deduped, cost-bounded "Ask AI for the rest" re-scan** (Phase 54.2g) — the correct home for slow/paid LLM work. Since AI never auto-files (§54.2), those guesses always went to review anyway → **no UX loss**, and no per-import LLM cost (aligns with the cost posture behind disabling Claude).

### Files Modified
- `lib/tie/categorisation.ts` — `categoriseTransactionBatch` options gained `skipAiOnMiss?: boolean` (forwarded to `categoriseTransaction`).
- `lib/bank/aiCategorisation.ts` — `categoriseUnknownsViaCascade` calls the batch with `{ skipAiOnMiss: true }` (import = deterministic-only), with a comment explaining the 504.
- `tests/neobrain/cascadeReconcile.test.ts` — +2 tests: known merchant still resolves (RULE) under skipAiOnMiss; unknown → FALLBACK/Uncategorised with no LLM call.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — drifted anchors fixed (categoriseWithLearning 303→311, processUserConfirmation 436→444; §21.2.1).

### Testing
- [x] 118 neobrain tests green (+2). `tsc` clean on touched files. `neomatrix:check` green.

### Self-review gate (§20.5) — financial build 10/10
Requirement: stop the import timeout without losing categorisation or correctness. 3× review: v1 drop only grounding at import (rejected — still N serial ungrounded calls + per-import cost) → v2 deterministic-only import + AI on-demand (chosen — fully fixes timeout + cost; §54.2 means AI guesses went to review regardless, so identical outcome) → v3 confirmed known merchants still categorise (RULE/KB) and the on-demand re-scan is the deduped/capped home for AI. Numbers unchanged; §19.1 actuals unaffected.
