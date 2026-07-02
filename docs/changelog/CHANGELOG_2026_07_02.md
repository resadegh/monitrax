# Changelog — 2026-07-02

## Session: dashboard-tile-zeros-issue-vrnapu

### Changes Made
- **Type**: Fix (financial correctness) + UX
- **Scope**: Dashboard KPI tiles (Monthly cash flow / Annual income / Annual outgoings / Saving rate) + their delta pills.
- **Root Cause**: The tiles headlined the **in-progress current calendar month × 12**. In the
  first days of a month the current month has little/no data (e.g. salary not yet paid), so
  `Annual income` → $0, `Saving rate` → 0.0% (net ÷ 0 income), and `Annual outgoings` → a
  2-day-of-spend × 12 figure. The delta pills (`-100% YoY`, `vs avg`, `vs last mo`) were also
  computed against the partial current month, producing an alarming and wrong `-100% YoY`.
  The honest declared/trailing numbers were only in the tile subtext.
- **Solution (Phase 57)**: Headline the **trailing basis** — the average of **COMPLETE, populated
  calendar months × 12** (the in-progress current month is excluded; a data-driven divisor means
  months with no imported transactions don't drag the figure). Computed once in the canonical
  `moneyStoryTrend` engine (no parallel source, §12.2.1) and read verbatim by the tiles via the
  insights route's `canonical` block. Falls back to the declared **plan** when there are no
  complete actual months yet (brand-new user), and shows an em-dash + a next-action nudge instead
  of a bare, misleading `$0` (§0 behaviour lens). Delta pills now compute over complete months, so
  `-100% YoY` no longer appears. A `Last 12 months` / `Your plan` basis label makes the source
  explicit so the tile never lies about what it's showing (§19.1).

### Files Modified
- `lib/calculations/moneyStoryTrend.ts` — added trailing annual basis (`annualIncome`,
  `annualOutgoings`, `annualNet`, `avgMonthlyNet`, `savingsRateTrailing`, `trailingMonthsWithData`);
  recomputed the three KPI deltas over complete months (exclude the in-progress current month).
- `app/api/dashboard/insights/route.ts` — `kpiTiles.canonical` now serves the trailing basis
  (with a declared-plan fallback + `basis: 'actual-ttm' | 'declared'`).
- `app/dashboard/page.tsx` — tiles bind to the trailing figures; basis label; em-dash + nudge
  instead of `$0`; helper copy reflects the basis (mobile + desktop).
- `tests/neomatrix/moneyStoryTrendAudit.test.ts` — new `partialCurrentRows` fixture (§19.2 worked
  example) + updated delta assertions + trailing-basis + regression assertions.
- `docs/financial-logic/graph/financial-graph.json` — updated the `moneyStoryTrend` engine node
  (drifted anchor 68→88, produces/formula/workedExample); regenerated `GENERATED_CORE.md`.

### §19.2 Worked example (verified in the A1 test)
Clock = Jun 15. Complete months Mar/Apr/May earned 38k/40k/42k & spent 30k/28k/32k; June (current)
$0 income + $200 spent → **June excluded**. `annualIncome = avg(38,40,42)k=40k ×12 = 480,000`;
`annualOutgoings = avg(30,28,32)k=30k ×12 = 360,000`; `annualNet 120,000`; `avgMonthlyNet 10,000`;
`savingsRateTrailing 25.0%`; `incomeΔ (42−38)/38 = +10.5%` (never −100%); `cashflowΔ May10k−Apr12k = −2,000`;
`outgoingsΔvsAvg 32k−30k = +2,000`.

### §19.1 basis statement
Actuals win when present (trailing complete months from `UnifiedTransaction`, transfers excluded,
uncategorised included); declared **plan** is the fallback only when there are no complete actual
months. No user-facing money number is produced from declared records when actual transactions exist.

### Build Status
- [x] `vitest` — A1 `moneyStoryTrendAudit` 11/11 pass (incl. the §19.2 worked example).
- [x] `eslint` — clean on the 3 changed source files (1 pre-existing unrelated warning at page.tsx:358).
- [x] `tsc --noEmit` — the 3 changed files are type-clean. (The repo-wide errors are ALL the
      missing-generated-`@prisma/client` pattern — this sandbox's proxy blocks the Prisma engine
      binary download, so `prisma generate` can't run here.)
- [x] `npm run neomatrix:check` — OK (anchor 68→88 resolves, markdown fresh, census/binding OK).
- [ ] `next build` — NOT runnable in this sandbox (needs `prisma generate`; engine binary download
      blocked by the proxy). Verified on Vercel via the PR preview build; §17.2 post-merge check to follow.

### §20.4 self-review (financial build → 10/10)
v1 critique caught: (a) fixing only the big numbers would leave "-100% YoY" on the delta pill → deltas
now computed over complete months too; (b) the fallback must be the declared PLAN, not current-month
actuals (which is the bug) → declared net used directly; (c) partial-current-month drag → current month
excluded + data-driven divisor; (d) bare $0 → em-dash + nudge; (e) `basis` union type error → fixed.
Score: **10/10 against requirement**; code correctness verified by tests + types + lint + neomatrix
(build-run deferred to the Vercel preview — sandbox can't download the Prisma engine).

### Not in this PR (deferred — needs Reza's decision)
- **Freedom Horizon** hero (`EARNED / KEPT / MARGIN 100%` + the `N months of freedom` number). The
  `MARGIN 100%` is the same partial-current-month bug (declared income − current-month actual spend).
  The `N months` number is a **liquid-cash runway** mislabelled as "freedom" (ignores income + the
  $5.5M in assets, likely duplicates the Emergency tile). Reframing it is a product-philosophy fork
  presented to Reza; the fix ships in a focused follow-up once the direction is chosen.

---

## Session (cont.): Phase 58 — the "Freedom" hero (Financial Independence)

### Changes Made
- **Type**: Feature (the "wow" — cross-portfolio Financial Independence) + Fix (hero MARGIN 100%)
- **Scope**: Dashboard hero (`MoneyStoryHeroV2`) + new canonical FI engine.
- **Why (Reza, 2026-07-02)**: *"I need the tiles to be real value add … something that wow the
  users (that will be very hard for the user to figure out without having all portfolio in one page)."*
- **Solution**: reframe the hero from a liquid-cash **runway** into a **Financial Independence**
  number: *"your portfolio covers N% of the life you actually live"* = **net, accessible** passive
  income ÷ **real** (trailing) lifestyle spend. Net = Σ per-property net cashflow (rent − costs −
  loan repayments) + dividends + interest + royalties — **gross rent is never used** (it would
  overstate freedom on geared property). Preserved super is **excluded** from "now" and surfaced as
  an **"→ N% once your super unlocks at 60"** line (labelled 4% safe-withdrawal assumption). A
  **growth-vs-income split** ("2 building equity · 1 producing income") reframes negatively-geared
  property as the deliberate strategy it is, not a failure. The `MARGIN 100%` hero bug is fixed by
  putting earned/kept on the same trailing basis.

### Files
- `lib/calculations/financialIndependence.ts` — NEW pure canonical engine (`computeFinancialIndependence`).
- `tests/neomatrix/financialIndependenceAudit.test.ts` — NEW A1 worked-example audit (9 tests).
- `app/api/dashboard/insights/route.ts` — assemble net-accessible passive + lifestyle + super, call
  the engine, expose `moneyStory.freedom*`; fix earned/kept to the trailing basis (MARGIN).
- `components/editorial/money-story/MoneyStoryHeroV2.tsx` — FI-coverage hero number + at-60 + split
  lines; em-dash (never a bare 0%) when no lifestyle data.
- `components/dashboard/tiles/GlassInsightTiles.tsx`, `app/dashboard/page.tsx` — prop wiring.
- Neomatrix: NEW `engine.financialIndependence.computeFinancialIndependence` node + 2 edges
  (moneyStoryTrend → FI → hero); Layer-0 manifest updated for the new file (graphify binary
  unavailable in-sandbox — manifest hand-reconciled, to be regenerated on next graphify run);
  `GENERATED_CORE.md` regenerated; `neomatrix:check` green (Layer 0, binding 150/150, census 0 uncovered).

### §19.2 worked example (verified — FI test 9/9)
net passive $24k/yr ÷ lifestyle $120k/yr → **coverageNow 20.0%**; preserved super $300k × 4% = $12k →
**coverageAt60 30.0%**; propertyNetMonthly [-500,200,-300] → 1 income-producing, 2 growth-building;
lifestyle 0 → coverage 0 + hasData false (em-dash, no bare 0%).

### §19.1 basis + honesty
Net (not gross) passive; accessible (super excluded from "now"); lifestyle = trailing real spend.
Known caveat (documented): SMSF assets flow through entity investments and are not yet
preservation-gated — a v1 limitation for the "now" figure.

### §20.4 self-review (financial build → 10/10)
Critique caught: gross-rent would lie → used per-property net cashflow; super in "now" would mislead
→ at-60 layer; a bare "0%" empty state → em-dash guard; new engine must be modelled + connected in
the graph (not an island) → added node + 2 edges. **10/10 against requirement.**

### Build Status
- [x] `vitest` — FI 9/9 + moneyStory 11/11 (20/20).
- [x] `lint:financial-surfaces` — 0 new (engine math lives in the engine; route assembly annotated).
- [x] `tsc --noEmit` — changed files type-clean (repo-wide errors are the missing-Prisma-client pattern).
- [x] `neomatrix:check` — green.
- [ ] `next build` — Vercel preview (Prisma engine download blocked in-sandbox).

### PR
- PR: #1330 (same branch — Phase 57 + 58)
- Status: Draft

---

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

---

## Fix — CSV import: blank-column immunity + content-aware detection for any bank

**Type**: Fix (Reza uploaded a real AMEX/Qantas CSV that still failed — now with the CLEAR message from the previous fix: "We read 20 row(s) but couldn't understand any of them (Missing or invalid amount)" — and asked "CSV files can be different formats from different banks, how can we manage this?").

**Root cause (reproduced with the real file, §19.2):** the CSV had a **blank column** (`Date,Amount,Account Number,,Transaction Type,…`). Both `detectBankMapping` and `findColumnIndex` matched columns with `h.includes(p) || p.includes(h)` — and `p.includes('')` is **always true**, so the empty header matched EVERY pattern. Result: "CBA Transaction Export" matched 100% via the blank column, and every column lookup (amount/description/credit/debit) collapsed onto that blank column → amount read from an empty cell → "Missing or invalid amount". Any bank's CSV with a blank column would hit this.

**Fix (robust + general — answers the "different banks" question):**
1. **Blank-column immunity:** extracted `headerMatches(h, p)` used by both detectors — an empty header never matches; the reverse `p.includes(h)` direction is gated to headers ≥3 chars so a stray short header can't capture unrelated targets. With this, the real file correctly matches on Date / Amount / Transaction Details (amount +$500 IN, desc "BPAY PAYMENT").
2. **Content-aware inference for unknown banks:** `inferColumns` (date = most parseable-dates column; amount = signed column preferring negatives + smallest magnitude so a running balance is never mistaken for it; description = most text-like) now runs for **any** headed CSV where no known bank matches — not just headerless — so a bank we don't have a mapping for still parses from its data.

### Files Modified
- `lib/bank/parsers/csv.ts` — `headerMatches()` (blank-column immunity, shared by `detectBankMapping` + `findColumnIndex`); inference now runs for any no-known-bank CSV (headed or headerless).
- `tests/bank/csvParser.test.ts` — +2 (AMEX/Qantas blank-column format with full-month dates; unknown-bank headed CSV inferred from data). Real file kept OUT of the repo (user financial data) — a synthetic equivalent is used.

### Testing
- [x] 131 bank + neobrain tests green (9 CSV). Verified the real uploaded file: 20 rows → 20 normalised, 0 errors. `tsc` clean; `neomatrix:check` green.

### Self-review gate (§20.5) — financial build 10/10
Requirement: make different-bank CSVs import; the reported AMEX/Qantas file must work. 3× review: v1 add the missing bank mapping (rejected — an ever-growing bank list doesn't scale + doesn't fix the blank-column poison) → v2 fix the empty-header match (root cause, one shared helper) + run data inference for any unknown bank → v3 hardened `headerMatches` reverse-direction to ≥3 chars, verified amount inference still ignores the balance column. Reproduced the real file end-to-end before + after.
