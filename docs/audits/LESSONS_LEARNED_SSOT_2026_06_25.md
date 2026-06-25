# Lessons Learned — the SSOT / duplicate-source class of bugs (2026-06-25)

> **Why this doc exists.** On 2026-06-25 a single user-visible discrepancy — the dashboard "Monthly cash flow" tile showing **+$10,505** while the `/cashflow` page showed **−$20,914** for the same month — triggered a comprehensive audit that found the *same class of mistake* repeated dozens of times across the codebase. This doc records the root causes and the guardrails now in place, so future builds don't re-introduce them. Companion to [`SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md`](./SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md).
>
> **The one-sentence lesson:** *two places that produce "the same number" is not a single source of truth — it is a drift bug that has not surfaced yet.*

---

## 1. The mistakes we made (the patterns, with real examples)

### M1 — Two sources for one number (the core defect)
A value was produced in more than one place instead of read from one canonical producer. Neither copy was "wrong code" — the **duplication itself** was the defect, because the two diverge the moment one changes.
- **Dashboard cashflow** read declared `snapshot.cashflow.*`; `/cashflow` + Money Story read the canonical actuals resolver → +$10,505 vs −$20,914. (PR #1235)
- **Emergency-fund months** (`liquidCash / monthlyExpenses`) re-typed in **≥9** files despite a canonical `buildEmergencyFundMetrics()`.
- **Savings rate** (`net / income × 100`) re-typed in **7** files — including 3 AI prompt builders that feed the CFO advisor (so the advisor could quote a different number than the dashboard).
- **LVR** in **7** files + **two competing** "canonical" LVR functions.
- **`buildHealthInput`** copy-pasted wholesale across two API routes; **`lib/testing/exporter.ts`** shadowed nearly every engine.

### M2 — Declared shown as actual (§19.1 violation)
Surfaces read the *declared* "plan" figures (income/expense records × frequency) as if they were *actual* (bank transactions), silently dropping uncategorised spend → false-optimistic surplus/savings.
- The dashboard told a user they were **saving 51.9%** while they ran a real monthly **deficit**. (PR #1235)
- `lib/intelligence/insightsEngine.ts` drove "you're saving X%" + emergency-buffer narratives from declared cashflow.
- The portal's `ClientCanonicalDashboard.tsx` (ironically named) showed advisers declared KPIs for their clients.

### M3 — Stale hardcoded values, and trusting a comment
A constant was copied inline instead of read from canonical config, then went stale — and a **comment lied about it**.
- `cashflow/intelligence/route.ts` shipped a bracket table commented "2024-25" but holding **FY23-24** values (first rate `0.19` vs the real `0.16`) → **overstated tax for every user**. (W0 / PR #1238)
- Super-contributions tax `0.15` hardcoded in **~15** tax-engine files; some FY25-26 thresholds already wrong.

### M4 — A dead source nobody noticed
A whole table/engine kept being read after it stopped being written.
- The legacy `Transaction` table had **zero writers** but Money Story (+ export + ownership) still read it → empty/stale data for every user. (PR #1233)

### M5 — Enforcement had blind spots
The guards we *did* have only covered part of the app, so the duplication accumulated where nobody was looking.
- The surface linter (`lint-financial-surfaces.ts`) scanned only `app/dashboard`/`app/portal`/`components` — **not `lib/` or `app/api/`**, where the audit found the overwhelming majority of duplication.
- The Neomatrix only modelled surfaces that were **explicitly added** — an unmodelled surface (the dashboard tiles) was a blind spot, which is exactly why the +$10,505 bug slipped past an earlier connectivity audit.

---

## 2. Why these happened (root causes, not symptoms)

1. **"Correct" was mistaken for "right."** Each duplicate computed the number correctly *in isolation*, so it passed review. The defect is structural (two producers), not arithmetic — reviewers weren't looking for *duplication*, only correctness.
2. **No search-before-build habit.** New surfaces re-derived a number from raw rows instead of finding the existing producer. Building a parallel source is faster in the moment and invisible until it drifts.
3. **Plan vs actual was easy to conflate.** Declared records and actual transactions both exist on the snapshot; grabbing the wrong field is a one-word mistake with a silent, optimistic failure mode.
4. **Constants were inlined "to ship",** then nobody updated them when the law changed — and the comment made it look current.
5. **Enforcement didn't cover the layers where the work actually happens** (`lib/`, `app/api/`), so drift had a safe place to grow.

---

## 3. The guardrails now in place (what we changed)

| Guardrail | Where | Catches |
|---|---|---|
| **§12.2.1 SEARCH-FIRST** (CLAUDE.md) | governance | M1 — mandates searching Neomatrix + `lib/` + the SSOT table for an existing producer before building a new one |
| **§21.2.1 ZERO-DRIFT** (CLAUDE.md) | governance | M5 — model every money surface in the Neomatrix *in the same PR*, with its `semanticKey`, so A3 catches divergence |
| **§21.5 Neomatrix-FIRST** (CLAUDE.md) | governance | comprehension — read the verified map before re-deriving |
| **A3 convergence-contradiction** | `neomatrix:check` (build gate) | M1 — two surfaces of the same `semanticKey` tracing to different engines = build failure |
| **Surface linter Pattern 4** (`DECLARED_CASHFLOW_SOURCE`) | `lint:financial-surfaces` | M2 — flags any surface reading declared `*.cashflow.{net,savingsRate,totalIncome,totalExpenses}` directly |
| **§19.1 actuals-vs-declared** (already in CLAUDE.md) | discipline | M2 — actuals when transactions exist; declared only as labelled fallback |
| **§19.2 never trust a comment** (already in CLAUDE.md) | discipline | M3 — verify the value against the law/config, not the comment next to it |

---

## 4. The checklist for every future build (the takeaways)

Before writing **any** value, calculation, formula, accessor, or endpoint:

1. **SEARCH FIRST.** Does the Neomatrix (`GENERATED_CORE.md` / `financial-graph.json` / `/admin/neomatrix`), `lib/`, or the §12.2 SSOT table already produce this? If yes → **import it**. Never re-type a formula. (§12.2.1)
2. **One number, one producer.** If a figure appears on N surfaces, all N read it from the **same** source. A tile never re-derives from raw rows.
3. **Actuals, not the plan.** When the user has transactions, headline money = actuals (`getCanonicalMonthlyCashflow` / `quickMetrics.actual*`). Declared is a labelled fallback only. (§19.1)
4. **Constants come from config.** Tax rates/caps/thresholds → `taxYearConfig.ts`. Never inline a rate. And **verify the value against the law — not the comment.** (§19.2 / §12.14)
5. **Model it in the Neomatrix as you go.** A money surface you build gets a node + `semanticKey` in the same PR, so A3 guards it. The graph never lags the code. (§21.2.1)
6. **Check the source is alive.** Before reading a table/engine, confirm something still writes/produces it.

---

## 5. What's still open (so the next session doesn't think this is finished)

The audit's **8-wave remediation** is in progress, not done:

- **W0 — done** (PR #1238): stale tax brackets → canonical engine.
- **W1 — in progress / has a wrinkle:** extending the surface linter to `lib/` + `app/api/` surfaces **173–215 raw violations**, but ~half are the **FREQUENCY pattern over-matching** legitimate `* 12` annualisation + interest-rate `/12` inside the canonical engines (NOT-A-DUP per the audit). **Lesson for W1:** the linter's frequency pattern must be **tightened for `lib/`** (flag the enum-`switch` re-implementations of `toMonthly`/`toAnnual`, not every `* 12`) and skip the canonical-source files — otherwise the baseline becomes noise. Do NOT baseline all 215.
- **W2–W7 — queued:** declared-vs-actual (insightsEngine + portal) · collapse `buildHealthInput` · emergency-fund/savings-rate/LVR/yield/equity dedup (+ create canonical homes for net-yield & debt-to-asset, which have none) · super/SG/cap constants → config · data-source re-aggregation · frequency-converter + ~30 formatter dedup + retire the `exporter.ts` shadow.
- **Deferred:** drop the dead `Transaction` table (§12.11/§12.12 migration) — after the waves.

Full file:line worklist: [`SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md`](./SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md) §8.

---

*Recorded 2026-06-25. The mistakes here are not a list of who-did-what — they're the structural traps the codebase makes easy. The guardrails in §3 exist so the trap is now a build failure, not a production surprise.*
