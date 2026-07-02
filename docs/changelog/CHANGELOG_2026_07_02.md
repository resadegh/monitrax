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

---

## Fix — CSV import: the account import route now accepts CSV (not just QIF)

**Type**: Fix (Reza: "some banks still don't have QIF! … fix CSV upload"). The Import dialog offered "QIF or CSV" and the file picker accepted `.csv`, but `POST /api/accounts/[id]/import` only handled QIF → CSV uploads returned "Unsupported file format. Please upload a QIF file."

**Root cause (verified in source):** the route's format branch (`route.ts:197`) called `parseQIF` for `.qif`/QIF-content and rejected everything else. A `parseCSV` parser already existed (`lib/bank/parsers/csv.ts`, returning the same `ParsedFile` shape) but was never wired into this route — only the separate `/api/bank/preview` + `/api/bank/import` routes used it.

**Fix:**
1. Wired `parseCSV` into the account import route: `.csv` extension → `parseCSV(content)` (QIF stays content-sniffed so a QIF is never mis-parsed as CSV). Error copy → "QIF or CSV file"; the empty-CSV message now points at the date/description/amount columns.
2. **Parser robustness (§19 — don't ship a feature that drops data):** while testing I found the greedy bank-mapping fuzzy-match (60% header overlap) could pick a bank (e.g. ANZ) for a generic `date,description,amount` CSV, then fail to find that bank's differently-named column (ANZ's `Details`) and **silently drop the description** → blank merchants → everything uncategorised. Added `resolveCol()` in `parseCSV`: when an explicit/mapping column NAME isn't present in the actual headers it falls THROUGH to the positional default (date→col0, description→col1) instead of returning -1. Optional columns (amount/credit/debit/balance/ref) still resolve to -1 (truly absent). Real banks with distinctive headers (NAB/CBA/Westpac/ING/Up) are unaffected — their columns resolve, so the fallback never fires.

### Files Modified
- `app/api/accounts/[id]/import/route.ts` — import + wire `parseCSV`; CSV-aware error copy.
- `lib/bank/parsers/csv.ts` — `resolveCol()` fallback so a mis-detected/generic CSV never drops date/description.
- `tests/bank/csvParser.test.ts` — NEW (4): generic signed-amount CSV, NAB Debits/Credits CSV, garbage → 0, empty → 0.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — import-route anchors updated (POST 105→106; edges 247→258/254→265/338→349; §21.2.1).

### Testing
- [x] 126 bank + neobrain tests green (incl. 4 new CSV). `tsc` clean on touched files. `neomatrix:check` green (150/150 anchors).

### Self-review gate (§20.5) — 10/10
Requirement: accept CSV so QIF-less banks can import. 3× review: v1 wire parseCSV only (rejected — my own test proved generic CSVs silently lose descriptions via the ANZ fuzzy-mis-map) → v2 add resolveCol positional fallback so no CSV drops date/description → v3 confirmed real-bank CSVs (distinctive headers) are untouched + optional columns stay -1. SSOT: reuses the one existing `parseCSV` (§12.2.1), no parallel parser.

---

## Fix — CSV import 500: headerless CSV support + crash guard

**Type**: Fix (Reza after #1327 merged: "still the CSV import is not working". Console: `POST /api/accounts/new/import` → 500 "Failed to process import").

**Root cause (REPRODUCED locally, §19.2 — the Vercel log API was timing out):** the account import route's format fix (#1327) parsed CSV, but a **headerless** CSV — how NAB and several AU banks export — broke downstream. `parseCSV` assumed a header row, so the first transaction was consumed as a phantom "header" and the remaining rows failed column detection (no amount column) → `normaliseTransactions` dropped every row → `normalisationResult.transactions` empty. The route only checked the *raw* parsed count, not the *normalised* count, so it proceeded to `dateRange = new Date(Math.min(...[]))` = **Invalid Date** → Prisma rejected it → the catch-all 500. A local repro test confirmed: headerless 1-row CSV → parsed 1, normalised 0, dateRange Invalid Date.

**Fix (two parts):**
1. **Headerless support** (`lib/bank/parsers/csv.ts`): auto-detect header presence (`rowLooksLikeData` — a header row has no cell that parses as a date; a data row does). When headerless AND no known bank, `inferColumns()` classifies each column from the DATA — date = most parseable-dates column; amount = a signed-money column PREFERRING negatives + smallest magnitude (so a running **balance** column is never mistaken for the amount, §19); description = most text-like column. A headed known-bank CSV keeps its named mapping (unaffected).
2. **Crash guard** (`route.ts`): if 0 rows survive normalisation, return an actionable **400** naming the reason (from the normalise errors — unreadable dates/amounts) instead of proceeding into the Invalid-Date → Prisma 500.

### Files Modified
- `lib/bank/parsers/csv.ts` — `rowLooksLikeData` + `inferColumns`; headerless auto-detect wired into the column fallbacks.
- `app/api/accounts/[id]/import/route.ts` — empty-after-normalise guard → clear 400.
- `tests/bank/csvParser.test.ts` — +3 (headerless infer date/amount/desc; balance-column not mistaken for amount; headed CSV unaffected).

### Testing
- [x] 129 bank + neobrain tests green (7 CSV, incl. 3 new headerless). `tsc` clean on touched files. `neomatrix:check` green (import-route edge anchors 278/285/369).

### Self-review gate (§20.5) — financial build 10/10
Requirement: make real bank CSVs import; never 500. 3× review: v1 crash-guard only (rejected — stops the 500 but Reza's file still wouldn't import) → v2 add headerless detection + positional inference → v3 hardened the amount inference against grabbing the balance column (§19 — a wrong amount mis-states every transaction), verified by a dedicated test. Honest residual: I couldn't read Reza's exact file or the prod logs, so if a bank uses an unusual layout the new 400 now names the reason instead of a blind 500.
