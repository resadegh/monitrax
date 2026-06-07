# Changelog - 2026-06-07

## Session: qdec-pr3e-ui-consumers-LIlK9

### Changes Made

- **Type**: Feature / Foundation — Q-DEC PR 3.E (final PR 3 sub-PR) + new `0·MA` maths-audit workstream
- **Scope**: Q-DEC PR 3.E — widen `lib/utils/formatters.ts:formatCurrency` to be defensive against all input shapes (number, Decimal-duck-typed, null, undefined, non-finite). Plus: add `0·MA — Maths / Calc / Data-Relationship Sanity Audit` to `IMPLEMENTATION_PLAN.md` per Reza directive 2026-06-07.

### Files Modified

- `lib/utils/formatters.ts` — `formatCurrency` signature widened from `(amount: number)` → `(amount: CurrencyFormatInput)` where `CurrencyFormatInput = number | { toNumber(): number } | null | undefined`. Empty-state placeholder `"—"` (em-dash) returned for null / undefined / NaN / Infinity. Decimal-like duck-type accepted directly (forward-compat: no `.toNumber()` call site required at the consumer).
- `tests/utils/formatters.test.ts` — updated existing NaN/Infinity tests to assert the `"—"` placeholder; added 3 new tests covering null, undefined, and Decimal-duck-type input.
- `docs/IMPLEMENTATION_PLAN.md` — workstream `0·WI` PR 3.E row flipped IN FLIGHT this PR; Last touched flipped to 2026-06-07; **new workstream `0·MA` added** (see below).

### New workstream: `0·MA — Maths / Calc / Data-Relationship Sanity Audit`

Per Reza directive 2026-06-07: *"add to the plan for a comprehensive and deep dive maths, calc, data relationships and formula sanity check across the app."*

Five-pass audit, each its own sub-PR:
- **MA.1** — Tax formulas vs ATO authority (PAYG NAT 1004; Medicare; Div 293/296; CGT 50% / Div 115; ECPI s295-385; stamp duty; land tax).
- **MA.2** — Cashflow + frequency math (`weeklyToAnnual = ×52`, `monthlyToAnnual = ×12`, rounding-policy consistency).
- **MA.3** — Data-relationship audit (GRDCS hygiene; orphan rows; FK invariants).
- **MA.4** — Cross-engine formula consistency (any "same metric, different code path" must agree or carry a documented divergence comment).
- **MA.5** — Reform-aware formula correctness (Phase 41E §10 — 8 measures × FW-1/FW-2 gates).

**Trigger:** before Phase 45 PR 1 (engine composition) ships. Orthogonal to Q-DEC PR 4 (Float drop) — can run in parallel.

### Architectural notes — why widen the formatter and not the consumer

- **The consumer pages need no code changes.** Route handlers serialize Decimal → number at the JSON boundary via `serializeDecimalsForJson` (PR 3.B). `await response.json()` produces `number`-typed leaves. The 5 consumer pages already work correctly with the cutover engines.
- **Why widen `formatCurrency` anyway?** Forward-compat. There are future paths where a Decimal value reaches the formatter without crossing JSON: (a) server components that read Prisma Decimal columns directly via Prisma client, (b) shared utility code that composes engines and renders results inline (e.g. SSR-rendered tiles). Both should be able to call `formatCurrency(decimalValue)` without a `.toNumber()` boilerplate. The duck-type check (`{ toNumber(): number }`) covers `Prisma.Decimal` + `decimal.js` + any future Decimal flavour.
- **The empty-state `"—"` em-dash** matches the editorial empty-state pattern (My Wealth glass vocabulary). Previously `formatCurrency(NaN) === "$NaN"` — a visible UX bug surfaced as part of the cutover work.
- **§12.14 reform-agnosticism:** the formatter is purely presentational, not reform-aware. FW-1 outcome (a).

### Testing

- [x] 4 updated tests + 3 new tests pass (53 total formatter tests).
- [x] `npx tsc --noEmit` clean.
- [x] Full vitest sweep: **2,304 passing, 69 skipped (opt-in integration), 0 failures.**

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / runbook
- [x] strategic decision (PR 3.E IN FLIGHT — closes out PR 3 cutover; new `0·MA` audit workstream added per Reza directive)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` PR 3.E row + Last touched + new `0·MA` workstream
- `docs/changelog/CHANGELOG_2026_06_07.md` — this entry (new daily file)

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] `formatCurrency` is purely presentational — no engine math, no regime branch, no reform-aware behaviour. FW-1 outcome (a).
- [x] No `commencementVerified` gate (FW-2 outcome (a)).
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A).
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive code only. The function signature is widened, not narrowed; existing `formatCurrency(123)` calls continue to work unchanged.

### Next

- **PR 4 — Float column drop.** Gated on 7-day parallel-run window (proves Float ↔ Decimal agree byte-for-byte in production). §12.11 destructive-write checklist mandatory. Drops `*_decimal` suffix from all 17 models.
- **Workstream `0·MA` — Maths sanity audit.** Runs in parallel; required before Phase 45 PR 1.
- **Phase 45 PR 1** — engine composition (`salarySacrificeToSuper.ts` + `tenYearProjection.ts` + H1/H2/H3 hardening). Gated on `0·MA` (so we don't compose audited-broken engines) + PR 4 (so the audit lives on a Decimal-only schema).
