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

---

## Session: ma1-tax-formula-audit-LIlK9

### Changes Made

- **Type**: Audit / Foundation — first pass of workstream `0·MA` (Maths Sanity Audit)
- **Scope**: MA.1 — Tax formulas vs ATO authority. Cross-check `lib/tax-engine/config/taxYearConfig.ts` + `reformConstants.ts` + `paygCalculator.ts` + `medicareLevyCalculator.ts` against ATO + Treasury publications.
- **Description**: First sub-PR of the maths audit workstream Reza added 2026-06-06. Verified the FY24-25 Stage 3 income tax brackets, PAYG NAT 1004 coefficients, LITO formula, super constants, CGT discount, and Phase 41E reform cut-over timestamp byte-for-byte against ATO authority. Found 4 issues — 2 cosmetic (in-PR fixes), 1 follow-up nit, 1 medium-severity Medicare Levy indexation lag deferred to Reza-confirmed fix PR.

### Files Created

- `docs/audit/2026-06-MATHS-AUDIT.md` — anchor doc for the entire `0·MA` workstream. Section 2 covers MA.1 findings + verification table per constant. Sections 4 + 5 queue MA.1b (state taxes), MA.2 (cashflow), MA.3 (data relationships), MA.4 (cross-engine consistency), MA.5 (reform-aware correctness).

### Files Modified

- `lib/tax-engine/core/paygCalculator.ts` — added bracket-boundary comment explaining the integer-vs-ATO-$X.99 equivalence (MA.1-002 cosmetic finding). Documents why a future maintainer should NOT "fix" the integer bounds.
- `lib/tax-engine/config/reformConstants.ts` — fixed `FOREIGN_PURCHASE_BAN` commencement timestamp from `2025-01-01T13:00:00Z` (2 Jan 2025 00:00 AEDT, off by 24h) to `2024-12-31T13:00:00Z` (1 Jan 2025 00:00 AEDT, correct). MA.1-004 finding. No current code path observed the difference, but the literal value now matches the comment + Treasury fact sheet.
- `docs/IMPLEMENTATION_PLAN.md` — workstream `0·WI` Last touched flipped to PR 3.E ✅ MERGED + audit reference; workstream `0·MA` status flipped from QUEUED → IN PROGRESS with MA.1 findings summary.

### Findings catalog (MA.1)

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| MA.1-001 | Stage 3 income tax brackets FY24-25 | — | ✅ VERIFIED |
| MA.1-002 | PAYG bracket boundaries (integer vs $X.99) | Cosmetic | Added code comment explaining equivalence |
| MA.1-003 | Medicare Levy thresholds FY24-25 indexation lag | Medium | 🛑 Deferred to follow-up fix PR pending Reza-confirmed ATO indexation values |
| MA.1-004 | `FOREIGN_PURCHASE_BAN` commencement 24h off | Low | Fixed in this PR |
| LITO formula | s61-105 + max $700 + dual-tier phase-out | — | ✅ VERIFIED |
| Super constants (SG / caps / Div 293 / TBC) | s291-20 / s292-85 / Subdiv 293-D / s294-35 | — | ✅ VERIFIED |
| Div 296 ($3M + 15% additional rate) | `commencementVerified === false` gate | — | ✅ VERIFIED gated correctly |
| CGT 50% discount | s115-25 ITAA 1997 | — | ✅ VERIFIED |
| REFORM_CUT_OVER_UTC | 7:30pm AEST 12 May 2026 = 09:30 UTC | — | ✅ VERIFIED (incl. AEDT-end check) |
| Measure commencement dates M1-M3, M5, M7-M9 | Phase 41E doc §10 | — | ✅ VERIFIED |

### Architectural notes

- **MA.1-003 (Medicare thresholds) is the most material finding.** The current thresholds `$26,000 single / $43,846 family` match the FY23-24 Medicare Levy Amendment (Low-Income Thresholds) Bill 2024. For FY24-25 the ATO publishes indexed thresholds (single $27,222 / family $45,907 per current ATO publication). Borderline low-income taxpayers in the shade-in range are affected by up to ~$60-80 in Medicare Levy. Fix is straightforward (update 3 constants) but requires Reza to confirm the source publication date so the audit trail is complete. Deferred to a 1-commit follow-up PR.
- **PAYG bracket-boundary comment is critical operational documentation.** Without it, a future maintainer reading the ATO docs would see `0 – $361.99` and "fix" the code to match — which would silently break consumers that rely on integer arithmetic on `weeklyEarningsMin/Max`. The comment names the audit ID so the rationale is searchable.
- **Foreign-purchase-ban timestamp fix is precautionary.** No code path currently uses M6's commencement at sub-FY granularity (the only consumer is `isPostCommencementFy` which reads FY-start; off-by-24h doesn't affect any FY's verdict). But future per-asset-acquisition-date logic would have surfaced the bug eventually. Fixed now while it costs nothing.

### Testing

- [x] `npx tsc --noEmit` clean.
- [x] Full vitest sweep: **2,304 passing, 69 skipped, 0 failures.** No test changes; audit is read-only on the engine math.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security
- [x] operational procedure (new audit doc + workstream methodology pattern + MA.1-002 code-comment discipline for boundary equivalences)
- [x] strategic decision (MA.1 first pass complete; queued passes MA.1b, MA.2, MA.3, MA.4, MA.5)

Docs updated in this PR:
- `docs/audit/2026-06-MATHS-AUDIT.md` — new audit anchor doc
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Last touched + workstream `0·MA` status flipped IN PROGRESS
- `docs/changelog/CHANGELOG_2026_06_07.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] MA.1 audit explicitly verifies Phase 41E reform constants (`REFORM_CUT_OVER_UTC` + 8 measure commencement dates + Div 293/296 thresholds). FW-1 + FW-2 gates on Div 296 + reform measures verified correct.
- [x] No new schema columns (FW-3 N/A).
- [x] No new AI tool (FW-4 N/A) — audit is documentation + 2 small fixes.
- [x] No per-asset tax-position UI surface (FW-5 N/A).

### Destructive write checklist (CLAUDE.md §12.11)

NONE — additive doc + 2 small code changes (one comment, one timestamp 24h shift with no test impact).

### Next

- **MA.1-003 follow-up fix PR** — Medicare Levy threshold indexation. Reza confirms ATO publication date; constants updated; thresholds-per-FY auditable.
- **MA.1b** — state stamp duty + land tax bracket cross-check (8 state Acts).
- **MA.2 / MA.3 / MA.4 / MA.5** — queued; can run in parallel with each other and with Q-DEC PR 4 (Float drop). Phase 45 PR 1 is gated on MA.1 + MA.2 + MA.4 + MA.5 (MA.3 is data-relationship; orthogonal to engine math).
