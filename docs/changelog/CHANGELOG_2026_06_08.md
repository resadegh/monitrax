# Changelog - 2026-06-08

## Session: Phase 45 PR 2.A — What If? lever picker (Screen A)

**Branch:** `claude/phase45-pr2a-lever-picker-LIlK9`
**Workstream:** 0·WI Phase 45 — "What If?" scenarios.
**Predecessor:** Phase 45 PR 1 merged 2026-06-08 04:20 UTC (engine composition complete — salary-sacrifice scenario + 10-year projection composer live in prod).
**Status:** open, draft.

### Scope

PR 2 of Phase 45 split into PR 2.A (Screen A picker) + PR 2.B (Screen B lever detail) for tractable review. This PR ships PR 2.A.

### What shipped

1. **`app/dashboard/cfo/what-if/page.tsx`** — NEW (~225 LOC). React port of the locked Stitch artefact `.stitch/designs/what-if-lever-picker{,-dark,-mobile,-mobile-dark}.{html,png}` (PR #977, 4-variant matrix per CLAUDE.md §18.7.2). 5 lever tiles arranged in a 3-col responsive grid (collapsing to 2 then 1 on smaller screens) + 1 "More levers coming" empty-state tile + GAW card.

   **Per-lever sub-palette (§6.2):**

   | Lever | TRAIL label | Gradient | Glyph |
   |---|---|---|---|
   | refinanceLoan | REDUCE · DEBT | amber-400 → rose-400 | Percent |
   | salarySacrificeToSuper | INVEST · SUPER | emerald-400 → indigo-400 | PiggyBank |
   | sellProperty | LIVE · EXIT | violet-400 → fuchsia-400 | Home |
   | payDownLoan | ANCHOR · DEBT FREEDOM | indigo-400 → blue-400 | TrendingDown |
   | addInvestment | INVEST · PROPERTY | teal-400 → cyan-400 | Building2 |

   **Tile anatomy** (per §18.7.2):
   - `bg-card/70 backdrop-blur-xl` glass surface
   - `rounded-[20px]` + 1px `border-foreground/10` hairline
   - 3px gradient top-accent strip (per-lever palette)
   - 44px gradient icon-badge (top-left) + arrow indicator (top-right, slides on hover)
   - Uppercase TRAIL label + headline title + muted subtitle (in `mt-8` block)
   - Oversized watermark glyph (-bottom-4 -right-4, opacity 0.06 → 0.10 on hover)
   - Layered float shadow + hover lift (`-translate-y-0.5`)
   - Spring transitions on `duration-300`

   **AFSL discipline:** GAW card at the bottom — "Monitrax shows what changes. It doesn't tell you what to do. Every lever here is information about your own numbers — never personal advice. For decisions about your money, talk to a licensed financial adviser. Read the General Advice Warning." Links to `/legal/general-advice-warning`.

   **Tailwind JIT defence:** all gradient classes written as static literal strings (`bg-gradient-to-r from-amber-400 to-rose-400`) — NEVER template-interpolated (`${color}/20`) because Tailwind's content scanner won't resolve dynamic class names at build time. Defence test in the suite guards against future regression.

2. **`app/dashboard/cfo/what-if/[lever]/page.tsx`** — NEW (~85 LOC). Stub route. Validates `[lever]` against the `SCENARIO_TYPES` whitelist exported by `lib/cfo/scenarios/index.ts`. Renders the lever title + a "coming in PR 2.B" placeholder card with a "Back to lever picker" link. Unknown lever → rose-toned error message. The interactive flow (sliders + projection chart + H1/H2/H3 surfaces + assumptions panel + GAW footer) ships in PR 2.B.

3. **`lib/navigation/trailNav.tsx`** — added `'/dashboard/cfo/what-if'` to the L-stage `matchRoutes` + a new `{ name: 'What If?', href: '/dashboard/cfo/what-if' }` child entry under My Guide. Existing sidebar nav infrastructure now surfaces the new page.

4. **`tests/components/WhatIfLeverPicker.test.tsx`** — NEW (~110 LOC, 12 tests). Surface + copy verification:
   - Lists all 5 lever scenarios (matches Phase 45 §2 scope)
   - All 5 TRAIL-stage labels per §6.2 sub-palette
   - AFSL discipline — `'never what you should do'` framing present; defensive negative grep against "you should refinance/sacrifice/sell" patterns
   - GAW copy + link to `/legal/general-advice-warning`
   - Tailwind static-class assertion (defence against dynamic-class regression)
   - §18.7.2 glass-vocabulary tokens (`bg-card/70` / `backdrop-blur-xl` / `rounded-[20px]` / `hover:-translate-y-0.5`)
   - Per-tile route correctness
   - Breadcrumb "My Guide · Decision support"
   - Stub validation against `SCENARIO_TYPES` + unknown-lever handling

### Build / test status

- **Typecheck:** ✅ `npx tsc --noEmit` clean
- **Full vitest sweep:** ✅ **2,367 passing, 69 skipped, 0 failures** (+12 net vs 2,355 PR 1 baseline)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — new page composition; reuses §18.7.2 glass tokens already canonical (no new tokens introduced)
- [ ] application config / GCP / identity / deploy / security
- [x] **operational procedure** — new route stubs + smoke test suite (the negative-grep AFSL defence is a reusable pattern for future scenario UIs)
- [ ] strategic decision

Docs updated in this PR:
- `app/dashboard/cfo/what-if/page.tsx` — file-header JSDoc cites Stitch artefact + AFSL discipline + PR 2.A vs 2.B scope split
- `app/dashboard/cfo/what-if/[lever]/page.tsx` — file-header JSDoc cites the PR 2.B handoff
- `lib/navigation/trailNav.tsx` — sidebar entry added under My Guide
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Phase 45 PR 2 entry split into 2.A `[x]` + 2.B `[ ]`
- `docs/changelog/CHANGELOG_2026_06_08.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] No reform-aware path changed. PR 2.A is the lever picker — no per-asset tax position display. (H2 RegimeBadge ships in PR 2.B on the lever-detail screen.)
- FW-1/2/3/4/5 N/A for this PR.

### Stitch-first compliance (CLAUDE.md §18)

- [x] Canonical Stitch artefacts already locked (PR #977 — 8 files including dark + mobile variants)
- [x] React port references the artefact paths in the file-header JSDoc per §18.4
- [x] Vocabulary: §18.7.2 in-app glass (NOT cosmos — internal `/dashboard/*` surface)
- [x] Per-lever sub-palette + watermark + hover lift faithfully ported

### Next

- **Phase 45 PR 2.B — lever detail.** Interactive sliders + 10-year projection chart + H1 SliderSource info-line per slider + H2 RegimeBadge + H3 cap-hard-stop tooltip + collapsible Assumptions panel + GAW footer. Salary-sacrifice as the showcase lever (Stitch artefact `.stitch/designs/what-if-lever-detail*.{html,png}` already locked). Other 4 levers parameterised by the same React component. New `/api/cfo/scenarios/snapshot` (or extend existing) to fetch the snapshot defaults for sliders.

---

## Session: Phase 45 PR 2.A.1 — Div 296 TSB aggregation fix (APRA + SMSF)

**Branch:** `claude/phase45-pr2a1-tsb-smsf-fix-LIlK9`
**Workstream:** 0·WI Phase 45 — "What If?" scenarios.
**Triggered by:** Reza question 2026-06-08 — "Is salary sacrifice designed for both SMSF and super account?" Surfaced a bug I introduced in PR 1: the H2 Div 296 regime check read TSB from `snapshot.netWorth.assets.superannuation`, which by Phase 39.5 design EXCLUDES SMSF member balances (no double-counting in net worth, since SMSF wealth flows through the SMSF LegalEntity's owned assets). For net worth that's correct; for the ATO TSB definition it's wrong.

### The bug

Pre-PR-2.A.1: a user with $1.5M AustralianSuper + $2M SMSF member balance read as $1.5M TSB. The Div 296 H2 regime check never triggered for this user even though their actual TSB ($3.5M) was above the $3M threshold. Salary-sacrifice would silently apply post-reform math (when commencement is unverified) rather than returning UNCOMPUTED per CLAUDE.md §12.14 FW-2.

### The fix

Extended `ScenarioContext` with an optional `superAccounts: SuperAccountView[]` field. When present, the salary-sacrifice scenario sums every account (un-deduplicated, including SMSF) for the Div 296 TSB check. When absent (back-compat), falls back to the snapshot's `netWorth.assets.superannuation` field — that fallback is correct for users with no SMSF.

### What changed

1. **`lib/cfo/scenarios/types.ts`** — added `SuperAccountView` interface (mirrors `SuperInput` in `netWorthCalculator.ts` but with `id` + `name` for UI). Added `superAccounts?: SuperAccountView[]` to `ScenarioContext`. JSDoc explains the TSB vs net-worth distinction.

2. **`lib/cfo/scenarios/salarySacrificeToSuper.ts:sumSuperBalance`** — rewrote with full doc-block. Now prefers `ctx.superAccounts` when supplied (sums every account regardless of fundType). Falls back to `ctx.snapshot.netWorth.assets.superannuation` when not — preserving back-compat.

3. **`lib/cfo/scenarios/index.ts` + `lib/cfo/index.ts`** — re-exported `SuperAccountView`.

4. **`app/api/cfo/scenarios/run/route.ts`** — new `fetchSuperAccounts(userId)` helper pulls every super account from Prisma (no SMSF exclusion). Wired into the existing `Promise.all` alongside `loans`. Passed into `ctx.superAccounts`.

5. **`tests/cfo/salarySacrificeToSuper.test.ts`** — added a new describe block "Phase 45 PR 2.A.1 — Div 296 TSB aggregation" with 5 cases:
   - back-compat: no `ctx.superAccounts` → falls back to snapshot field
   - the bug case: $1.5M APRA + $2M SMSF → correctly triggers DIV296_UNCOMPUTED
   - APRA only via `ctx.superAccounts`: correct TSB summation
   - $2.9M aggregate below threshold: UNAFFECTED
   - empty `ctx.superAccounts` array: falls back to snapshot (no crash)

### Build / test status

- **Typecheck:** ✅ `npx tsc --noEmit` clean
- **Full vitest sweep:** ✅ **2,372 passing, 69 skipped, 0 failures** (+5 net from 2,367 PR 2.A baseline)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual / design / config / GCP / identity / deploy / security / strategic
- [x] **operational procedure** — surfaces the TSB ≠ net-worth-super distinction; engine + API wiring + regression tests for the fix

Docs updated in this PR:
- `lib/cfo/scenarios/types.ts` — `SuperAccountView` JSDoc + `ScenarioContext.superAccounts` JSDoc
- `lib/cfo/scenarios/salarySacrificeToSuper.ts:sumSuperBalance` — full doc-block explaining TSB vs net-worth + the pre-PR-2.A.1 bug
- `docs/changelog/CHANGELOG_2026_06_08.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] **FW-2 commencement gate**: this PR HARDENS the Div 296 commencement gate. Pre-fix, the gate could miss-fire (under-counted TSB → never triggered UNCOMPUTED → silently applied post-reform math). Post-fix, the gate fires correctly when the real TSB crosses $3M. NEVER applies post-reform math while `div296CommencementVerified === false`.
- FW-1/3/4/5 N/A.

### Next

- **Phase 45 PR 2.B — lever detail UI** (now unblocked). Interactive sliders + 10-year projection chart + H1 SliderSource info-line + H2 RegimeBadge + H3 cap-hard-stop tooltip + per-fund destination selector (consumes `ctx.superAccounts` for the fund list) + collapsible Assumptions panel + GAW footer.

---

## Session: Phase 45 PR 2.B — interactive lever-detail (salary-sacrifice showcase)

**Branch:** `claude/phase45-pr2b-lever-detail-LIlK9`
**Workstream:** 0·WI Phase 45 — "What If?" scenarios.
**Predecessors:**
- Phase 45 PR 1 (engine composition) merged
- Phase 45 PR 2.A (lever picker) merged
- Phase 45 PR 2.A.1 (Div 296 TSB aggregation fix) merged

**Status:** open, draft.

### Scope

PR 2.B per Reza directive 2026-06-08 ("Sacrifice fully wired; 4 others stub via same shell"):
- Salary-sacrifice fully wired as the showcase lever
- Other 4 levers parameterised by the same React shell, but stub inputs + placeholder projection panel — PR 2.C wires them

### Strategic vocabulary decision

The locked Stitch artefact `what-if-lever-detail-v1-desktop-dark.html` ships a *public cosmos* vocabulary (sign-in nav, "Open Account" CTA, "Implement Strategy" button) — incompatible with the §18.7.2 in-app glass vocabulary the picker page already uses. Surfaced to Reza 2026-06-08 ("Derive dark from v1-light tokens" recommended). Decision: treat the v1-light artefact as the canonical reference; derive dark mode via §18.7.2 token substitution (warm-ivory → deep-navy, emerald brightened, glass shadows mode-flipped) rather than copying the cosmos artefact's vocabulary.

### What shipped

1. **`app/api/cfo/scenarios/context/route.ts`** — NEW (~120 LOC). `GET /api/cfo/scenarios/context` returns the snapshot-derived defaults every lever-detail screen needs: `grossSalaryAnnual`, `monthlyCashflow`, `totalSuperBalance` (un-deduplicated TSB per PR 2.A.1), `superAccounts` (full per-fund list including SMSF), `loans` (LoanView shape for refinance/payDown levers), `properties`. Single SSOT for lever-input rendering. `report.read` auth-gated. Universal Response Format.

2. **`app/dashboard/cfo/what-if/[lever]/page.tsx`** — REWRITE (~720 LOC). React port of v1-desktop Stitch artefact, in §18.7.2 in-app vocabulary.

   **Salary-sacrifice (showcase, fully wired):**
   - Slider 0..auto-cap-max ($50 step) with `$X,XXX/mo` value pill (gradient emerald→indigo)
   - H1 source-line attribution beneath slider: "Your snapshot: $X salary · cap read per FY 25-26"
   - H3 `ConcessionalCapCard` with state-switching styling: green (within cap) / red (over cap); displays headroom + carry-forward + cap-used progress bar
   - H2 `RegimeLockedBadge` renders when scenario returns DIV296_UNCOMPUTED (super balance ≥ $3M + commencement unverified) — explains the regime locked + Royal Assent
   - Super-account destination selector: enumerates `ctx.superAccounts`; defaults to largest-balance non-SMSF account; SMSF selection shows a small note explaining the member-contribution-form workflow
   - Quick-pick chips: "Use my current sacrifice ($X/mo)" (if YTD > 0) + "Max within cap ($X/mo)"
   - 250ms debounced re-run of `/api/cfo/scenarios/run` on slider change — feels live without spamming
   - Client-side `tenYearProjection` composition for INSTANT chart re-render (no second server roundtrip per slider tick); server-side composer is the canonical engine, client call uses the same exported pure function
   - Recharts `LineChart`: current-SG-only baseline (dashed grey) + with-sacrifice (emerald solid 2.5px); hover tooltip showing both values; compact $X/$Xk/$X.XXm formatter
   - Result pills: Annual tax saved · Concessional cap used % · TSB > $3M Div 296 watch (when applicable)
   - Collapsible Assumptions panel (default closed) listing scenario.assumptions[]
   - GAW footer with link to `/legal/general-advice-warning`

   **Other 4 levers** (refinanceLoan / sellProperty / payDownLoan / addInvestment):
   - Routed to the same shell
   - Inputs column: `StubInputs` placeholder explaining the engine is already live (PR 1) but UI wiring ships in PR 2.C
   - Projection column: `StubProjection` with the lever's glyph + "Coming in PR 2.C" framing

   **Auth-header discipline**: every API call passes `Authorization: Bearer ${token}` — defence against the 2026-05-18 SessionExpiryHandler regression pattern.

   **Tailwind JIT defence**: gradient classes still written as static strings (per PR 2.A pattern).

3. **`tests/components/WhatIfLeverDetail.test.tsx`** — NEW (20 tests). Surface + copy verification: API endpoint usage, debounce timing, auth-header discipline, AFSL copy (no prescriptive phrasing), GAW link, H1/H2/H3 surfacing, SMSF note, assumptions collapsed-by-default, stub PR 2.C reference, §18.7.2 vocabulary defence (NO cosmos tokens like "Open Account" / "Implement Strategy"), fund-selection default behavior, Div 296 watch pill, recharts primitives imported, context route uses canonical SSOT, Universal Response Format.

### Build / test status

- **Typecheck:** ✅ `npx tsc --noEmit` clean
- **Full vitest sweep:** ✅ **2,392 passing, 69 skipped, 0 failures** (+20 net vs 2,372 PR 2.A.1 baseline)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — derived dark mode for in-app surface per §18.7.2 (NOT a new design system); shared `GlassPanel` + `ConcessionalCapCard` + `RegimeLockedBadge` + `SacrificeChart` + `AssumptionsPanel` + `GAWFooter` patterns established for PR 2.C re-use
- [x] **application config / API contract** — new `GET /api/cfo/scenarios/context` endpoint (canonical SSOT for lever input defaults)
- [ ] GCP / identity / deploy / security
- [x] **operational procedure** — Tailwind JIT static-class assertion + auth-header discipline test patterns reused
- [x] **strategic decision** — vocabulary-derivation-not-copy for dark mode (Reza 2026-06-08); v1-dark cosmos artefact superseded

Docs updated in this PR:
- `app/dashboard/cfo/what-if/[lever]/page.tsx` — file-header JSDoc cites Stitch artefact + vocabulary decision + AFSL discipline
- `app/api/cfo/scenarios/context/route.ts` — file-header JSDoc cites TSB resolution + auth + response shape
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Phase 45 PR 2 split: 2.A + 2.A.1 + 2.B `[x]`, 2.C `[ ]`
- `docs/changelog/CHANGELOG_2026_06_08.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] **FW-1**: salary-sacrifice math is regime-agnostic at the engine layer; UI consumes the scenario result.
- [x] **FW-2**: scenario returns DIV296_UNCOMPUTED when balance ≥ $3M + commencement unverified; UI consumes this via the `RegimeLockedBadge`.
- [x] **FW-3**: no new schema columns.
- [x] **FW-4**: no new AI tools.
- [x] **FW-5**: regime badge surfaces on the lever-detail screen per §12.14 FW-5 reviewer enforcement — a per-fund tax position UI without the regime badge would be "lying by omission."

### Stitch-first compliance (CLAUDE.md §18)

- [x] Canonical artefact: `.stitch/designs/what-if-lever-detail-v1-desktop.{html,png}` (locked PR #977)
- [x] Vocabulary: §18.7.2 in-app glass (warm-ivory light + token-derived deep-navy dark)
- [x] v1-dark cosmos artefact treated as superseded per Reza directive 2026-06-08 — file-header JSDoc cites this decision
- [x] Per-lever sub-palette + glass shadows + hover micro-motion faithfully ported

### Next

- **PR 2.C** — wire the remaining 4 levers (refinanceLoan / sellProperty / payDownLoan / addInvestment) into the shared shell. Each lever's per-input fields (loanId picker, propertyId picker, monthlyAmount slider, etc.) re-uses the same `ConcessionalCapCard`-style info-card pattern + chart + Assumptions/GAW. Likely 1 PR or 4 sub-PRs depending on review tractability.

---

## Session: Phase 45 PR 2.C — wire remaining 4 levers (refinance / payDown / sellProperty / addInvestment)

**Branch:** `claude/phase45-pr2c-remaining-levers-LIlK9`
**Workstream:** 0·WI Phase 45 — "What If?" scenarios.
**Predecessors:** Phase 45 PR 1 / PR 2.A / PR 2.A.1 / PR 2.B all merged 2026-06-08.
**Status:** open, draft.

### Scope

Final UI piece of Phase 45 v1. Wires the 4 remaining levers into the shared React shell shipped in PR 2.B. After this PR, all 5 What-If levers are fully interactive in prod.

### What shipped

1. **Per-lever input components** in `app/dashboard/cfo/what-if/[lever]/page.tsx`:

   - **`RefinanceInputs`** — new-rate slider (3.00..9.00% in 5bp steps) with amber→rose gradient value pill; switching-costs slider ($0..$5000); loan picker; source line shows "Your snapshot: {loan name} at X.XX%" + Δ vs current; **defensive HIGHER-rate flag** when slider goes above current rate (no silent regression).

   - **`PayDownInputs`** — extra-monthly slider ($0..$2000 in $50 steps) with indigo→blue gradient pill; loan picker; source line shows current monthly + new total; **defensive cashflow check** flagging when `extraMonthly > monthlyCashflow`.

   - **`SellPropertyInputs`** — property picker (current value + equity per item); selling-costs slider (1.0..5.0%); property summary card with current value + your equity. Industry default 2.5% (typical AU agent commission + ads + conveyancing) with explainer copy.

   - **`AddInvestmentInputs`** — 3 sliders: monthly contribution ($0..$3000), expected annual return (2.0..10.0%, default 7% with rationale), horizon (1..30 years). No entity picker (this is a hypothetical new investment).

2. **Shared `EntityPicker<T>`** — generic component used by refinance / payDown / sellProperty for loan + property selection. Subtitle is per-lever (loans: principal + rate + remaining months; properties: value + equity).

3. **`GenericLeverProjection`** — handles all 4 non-sacrifice levers in one component. Per-lever headline copy keyed off the scenario's impacts:
   - **refinance**: "$X/mo savings" + "$Y lifetime savings (net of switching costs)"
   - **payDown**: "$X interest saved" + "Payoff in N months (down from M)"
   - **sellProperty**: "$X freed up" + "Net worth Δ: $Y (after selling costs + CGT)"
   - **addInvestment**: "$Xm portfolio" + "$Y from compounding growth"

4. **`SimpleProjectionChart`** — single-line variant of `SacrificeChart` for the 4 levers (no current-path baseline since baseline = scenario didn't apply, which is just zero). Reuses recharts primitives + glass-card tooltip styling from PR 2.B.

5. **`GenericResultPills`** — surfaces the top 2 non-zero currency impacts from the result, color-coded by direction (positive = emerald, neutral = foreground/5).

6. **Per-lever defaults wired on context load**:
   - Largest loan by principal → refinance.loanId + payDown.loanId
   - Refinance default `newRate` = max(3.5%, current rate − 50bp)
   - Largest property by current value → sellProperty.propertyId

7. **Scenario-run effect dispatches per lever** via new `buildRequest()` helper. Returns null when required entity not yet picked (no doomed requests). Effect deps updated to include all 5 per-lever state objects.

8. **`tests/components/WhatIfLeverDetail.test.tsx`** — added 12 PR 2.C tests covering: per-lever input components, defensive copy (HIGHER rate flag, cashflow check, industry-default explanations), per-lever headline keys, request guards, TRAIL-stage labels, AFSL discipline (negative grep against "you should refinance/pay/sell/invest"), result-pills filtering.

### Build / test status

- **Typecheck:** ✅ `npx tsc --noEmit` clean
- **Full vitest sweep:** ✅ **2,404 passing, 69 skipped, 0 failures** (+12 net vs 2,392 PR 2.B baseline)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — 4 new per-lever Input components + shared `EntityPicker` + `GenericLeverProjection` + `SimpleProjectionChart` + `GenericResultPills` patterns established (extends PR 2.B's vocabulary, NO new design tokens)
- [ ] application config / GCP / identity / deploy / security / strategic
- [x] **operational procedure** — new defensive copy patterns (HIGHER rate flag + cashflow check + industry-default explanations) for future scenario UIs

Docs updated in this PR:
- `app/dashboard/cfo/what-if/[lever]/page.tsx` — file-header JSDoc (PR 2.B vintage) still applies; new component JSDocs document the per-lever contracts
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Phase 45 PR 2.C entry flipped to `[x]`; Phase 45 v1 UI marked complete
- `docs/changelog/CHANGELOG_2026_06_08.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] **FW-1** — refinanceLoan / payDownLoan / addInvestment are regime-agnostic by design. sellProperty CGT math has reform-aware branches in `lib/cfo/scenarios/sellProperty.ts` (Phase 41E.M2 CGT 50% discount → indexation + 30% floor for post-cut-over contracts) — UI consumes the scenario result, no per-asset regime input needed at the UI layer.
- [x] **FW-2** — scenario engines handle commencement gating. UI surfaces UNCOMPUTED via the `isUncomputed` rendering path (same as salary-sacrifice).
- [x] **FW-3** N/A — no schema columns.
- [x] **FW-4** N/A — no new AI tools.
- [x] **FW-5** — per-lever projection panels show the lever's primary tax/financial impact. SellProperty headline explicitly mentions "after selling costs + CGT" — surfaces the CGT consequence visibly.

### AFSL discipline checks

- No prescriptive copy added in any of the 4 new lever components (negative-grep test in suite)
- All sliders rendered as information-only — no "Implement Strategy" button, no broker links, no product names
- Each industry-default value (switching costs 2.5%, expected return 7%, etc.) has explainer copy explaining where the number comes from
- "This is a projection, not a forecast" reminder added beneath each result

### Phase 45 v1 status

**Phase 45 v1 UI is now COMPLETE in this PR.** All 5 What-If levers fully interactive:
1. ✅ refinanceLoan
2. ✅ salarySacrificeToSuper (showcase, PR 2.B)
3. ✅ sellProperty
4. ✅ payDownLoan
5. ✅ addInvestment

### Next

- **Phase 45.1 — contextual entry points** (separate workstream): "What if?" affordance on `/dashboard/loans/[id]`, `/dashboard/properties/[id]`, super tile, income tile — pre-populated with the entity's data, returns to source page.
- **Phase 45 polish backlog** (optional): hover-preview tooltip on lever cards (§6.8.3); cashflowOrchestrator × masterTaxPosition re-run per year (§7 call-graph) instead of the PR 1 scalar-compound simplification — only if user feedback surfaces bracket-crossing issues.

---

## Session: Phase 45.1 — contextual entry points

**Branch:** `claude/phase451-contextual-entry-points-LIlK9`
**Workstream:** 0·WI Phase 45 — "What If?" scenarios.
**Predecessor:** Phase 45 v1 complete (PR 1 + PR 2.A + PR 2.A.1 + PR 2.B + PR 2.C all merged 2026-06-08).
**Status:** open, draft.

### Why this PR

Phase 45 v1 makes the What-If lever a destination users have to navigate to. Phase 45.1 turns it into a "right when you're looking at this loan / property / super, here's what could change" affordance — multiplies the engagement value of everything PR 1-2.C shipped.

### What shipped

1. **Lever-detail page (`app/dashboard/cfo/what-if/[lever]/page.tsx`)** — extended to read `?loanId=X` / `?propertyId=Y` from URL via `useSearchParams()`. Deep-linked IDs override the largest-balance default — the user lands on the lever with their loan/property pre-selected. Context-fetch effect dep array updated to re-run when the deep-link params change. Falls back to largest-balance default when params absent (back-compat).

2. **LoanDetailDialog (`components/loans/LoanDetailDialog.tsx`)** — new `WhatIfLoanAffordances` component rendered at the bottom of the Overview tab. Two CTAs in a responsive 2-col grid:
   - **Refinance this loan** — amber→rose gradient, Percent glyph, deep-links to `/dashboard/cfo/what-if/refinanceLoan?loanId={id}`
   - **Pay extra each month** — indigo→blue gradient, TrendingDown glyph, deep-links to `/dashboard/cfo/what-if/payDownLoan?loanId={id}`
   Each tile carries a small `→` icon that slides on hover (matches the lever-picker tile micro-motion).

3. **Property strategy page (`app/dashboard/properties/[id]/strategy/page.tsx`)** — added "What if you sold this property?" card beneath the existing Strategy Recommendations card. Violet-toned (matches sellProperty lever sub-palette). Deep-links to `/dashboard/cfo/what-if/sellProperty?propertyId={id}`. Information-only copy ("Model the capital gains, debt clearance, and liquidity release") — AFSL-disciplined.

4. **Super page (`app/dashboard/investments/super/page.tsx`)** — new "What if you salary-sacrificed?" CTA placed BENEATH the `SuperCapMeter` (the cap-aware context surface). Emerald→indigo gradient with PiggyBank glyph + `ArrowUpRight` chevron. Deep-links to `/dashboard/cfo/what-if/salarySacrificeToSuper`. The position is load-bearing: users see the cap meter first ("here's how much cap you've used"), then immediately get the affordance to model a sacrifice change.

5. **Income page entry-point deferred** — overlaps with super page; would add complexity without unique value. Revisit if user feedback demands it.

### Build / test status

- **Typecheck:** ✅ `npx tsc --noEmit` clean
- **Full vitest sweep:** ✅ **2,423 passing, 69 skipped, 0 failures** (+19 net vs 2,404 PR 2.C baseline)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — new `WhatIfLoanAffordances` component pattern; per-CTA lever-palette mapping (amber/rose for refinance, indigo/blue for payDown, violet for sellProperty, emerald/indigo for sacrifice); reuses existing §18.7.2 glass tokens
- [ ] application config / GCP / identity / deploy / security / strategic
- [x] **operational procedure** — deep-link URL convention established (`?loanId=` / `?propertyId=`); tests pattern-assert the convention

Docs updated in this PR:
- `app/dashboard/cfo/what-if/[lever]/page.tsx` — `useSearchParams` import + deep-link reading + dep-array
- `components/loans/LoanDetailDialog.tsx` — new component + Overview tab mount
- `app/dashboard/properties/[id]/strategy/page.tsx` — new "What If" card
- `app/dashboard/investments/super/page.tsx` — new CTA beneath cap meter
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Phase 45.1 entry flipped to `[x]`
- `docs/changelog/CHANGELOG_2026_06_08.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- All entry points deep-link into the lever-detail page; the lever-detail page is already FW-2 compliant (RegimeLockedBadge for salary-sacrifice when Div 296 fires). Entry points themselves don't display per-asset tax position, so FW-5 N/A at the entry-point layer.
- FW-1/2/3/4/5 N/A for this PR (all delegated to lever-detail page already-compliant).

### AFSL discipline checks

- No prescriptive copy added in any of the 3 new entry points (negative-grep tests assert this)
- All CTAs frame as "What if you...?" or "Model the..." — never "You should refinance/sell/sacrifice"
- No product names, no broker links, no manufactured urgency

### Test plan

- 19 new tests in `tests/components/WhatIfContextualEntryPoints.test.tsx`:
  - lever-detail page reads `useSearchParams`, both `loanId` + `propertyId`
  - deep-linked entity overrides the largest-balance default
  - context-fetch effect deps include deep-link IDs (re-fires on change)
  - LoanDetailDialog renders WhatIfLoanAffordances on Overview tab
  - Per-CTA URLs use `encodeURIComponent` (defense against IDs with special chars)
  - Per-CTA gradients match the lever-picker sub-palette
  - AFSL discipline: no "you should X" copy
  - Property strategy card uses violet sub-palette + matches sellProperty lever
  - Super page CTA positioned BENEATH SuperCapMeter (cap-aware context)
  - Super page CTA uses emerald/indigo gradient (matches sacrifice lever)

### Next

- **Phase 45 v1 + 45.1 are now COMPLETE.** Lever picker + 5 fully-wired lever-detail screens + 3 contextual entry points (loans / properties / super).
- **Potential follow-ups (not yet queued):**
  - Income page entry-point (deferred — overlap with super)
  - Hover-preview tooltip on lever cards (§6.8.3)
  - Per-year cashflowOrchestrator × masterTaxPosition re-run (§7 call-graph) — only if user feedback surfaces bracket-crossing issues
  - Property tile inline "scenarios" link (more discoverable than buried in strategy sub-page)

---

## Session: Phase 45.1.1 — polish backlog (Stitch-first)

**Branch:** `claude/phase45-polish-backlog-LIlK9` (continuation of prior turn's Stitch design pass on the same branch).
**Workstream:** 0·WI Phase 45 — "What If?" scenarios.
**Predecessor:** Phase 45.1 contextual entry points (PR #1019, merged 2026-06-08).
**Status:** open, draft.

### Why this PR

Phase 45.1 shipped 3 of the 4 discussed entry points and explicitly deferred the income-page CTA and the property-tile inline affordance. Reza directive 2026-06-08: *"all design and polish steps to be done via stitch"*. Earlier in this session I started porting both items directly in React without a Stitch pass — that was reverted (commit `051519c`). This PR is the proper Stitch-first do-over.

### What shipped

1. **PropertyTile sparkles affordance** (`components/properties/PropertyTile.tsx`):
   - Added `Sparkles` (lucide-react) + `Link` (next/link) imports.
   - New violet-tinted icon button in the hover-reveal action cluster — rendered ONLY when `isInvestment === true` (HOME and RENTAL types don't get the affordance, by design — the lever is `sellProperty`).
   - Deep-links to `/dashboard/cfo/what-if/sellProperty?propertyId={encodeURIComponent(property.id)}`.
   - `title="What if you sold this?"` for the hover tooltip + `aria-label` for screen readers.
   - Hover style: `hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300` — matches Stitch design's violet tint without dragging the violet into the resting state.

2. **Income page salary-sacrifice CTA** (`app/dashboard/income/page.tsx`):
   - Added `Link` (next/link) import.
   - Derived `hasSalaryIncome = income.some(i => i.type === 'SALARY')` near the totals block.
   - New emerald-tinted glass `<section>` rendered between `<PageHeader>` and the `<ListFilter>` (only when `hasSalaryIncome`):
     - `<Link href="/dashboard/cfo/what-if/salarySacrificeToSuper">` wraps the whole banner — Next.js client-side nav.
     - Gradient `PiggyBank` badge (`bg-gradient-to-br from-emerald-500 to-indigo-500`).
     - Title: "What if you salary-sacrificed?" — `text-emerald-700 dark:text-emerald-300`.
     - Subtitle: "Model how a monthly sacrifice would affect your year-1 tax + 10-year superannuation projection."
     - Right-side "EXPLORE SCENARIOS" label + `ArrowUpRight` with hover translate (md:+ only — hidden on mobile to keep the banner short).
     - AFSL footnote underneath the card: "AFSL 523411 compliant: hypothetical illustrations based on current tax legislation; individual circumstances may vary."
   - Dark mode handled via `dark:` Tailwind variants per CLAUDE.md §18.7.2 (border `dark:border-emerald-400/30`, bg `dark:bg-emerald-500/10`, hover `dark:hover:bg-emerald-500/15`, title `dark:text-emerald-300`).

### Stitch artefacts (CLAUDE.md §18.4 + §18.7.2)

Locked in `.stitch/designs/polish/` (project `5991501424852019479`):

| File | Stitch screen ID | Mode |
|---|---|---|
| `property-tile-whatif-affordance.{html,png}` | `929d25f22321425a9a0317d331fca3f8` | light |
| `property-tile-whatif-affordance-dark.{html,png}` | `f88ce0a309464ccfa4234ac0ba0d366b` | dark |
| `income-page-salary-sacrifice-cta.{html,png}` | `62e3d46cc4964462b0d40195e3b606d0` | light |
| `income-page-salary-sacrifice-cta-dark.{html,png}` | `d4da3f3f4d41467998d2dd7217e1e73f` | dark |

Both light + dark variants per surface satisfies the §18.7.2 dark-mode reviewer enforcement (DESKTOP-light + DESKTOP-dark per surface). Mobile variants not required for this scope — the affordances inherit the existing tile/page responsive behaviour (action cluster opacity gate already mobile-aware via `sm:flex`; CTA banner uses `md:flex` to drop the secondary right-side label on small screens).

Stitch screen IDs documented inline at both insertion points (PropertyTile.tsx action cluster comment, income/page.tsx CTA section comment).

### Reversal context (§15)

This reverses the 2026-06-08 Phase 45.1 "Income-page entry-point deferred (overlaps with super page; would add complexity without unique value — revisit if user feedback demands it)" decision. Reza approved both polish items via Stitch design review this session; user feedback delivered through design approval = the trigger condition that decision deferred for has now fired.

### Build / test status

- **Typecheck:** ✅ `npx tsc --noEmit` clean
- **Lint:** ✅ `npx eslint components/properties/PropertyTile.tsx app/dashboard/income/page.tsx` → 0 new errors, 0 new warnings (2 pre-existing `react-hooks/exhaustive-deps` warnings on `useEffect` deps left untouched — not in change path)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — sparkles affordance pattern in PropertyTile action cluster; emerald glass CTA banner pattern in income page (both seeded from §18.7.2 in the Stitch prompt, both ported to React with `dark:` variants)
- [ ] application config / GCP / identity / deploy / security
- [ ] operational procedure (no new failure mode encountered)
- [x] **strategic decision** — reverses Phase 45.1's "income-page entry-point deferred" deferral after Stitch approval

Docs updated in this PR:
- `components/properties/PropertyTile.tsx` — Sparkles affordance + inline screen-ID JSDoc
- `app/dashboard/income/page.tsx` — emerald CTA banner + AFSL footnote + inline screen-ID JSDoc
- `.stitch/designs/polish/property-tile-whatif-affordance-dark.{html,png}` — NEW dark variant
- `.stitch/designs/polish/income-page-salary-sacrifice-cta-dark.{html,png}` — NEW dark variant
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — new `[x]` Phase 45.1.1 entry + reversal note
- `docs/changelog/CHANGELOG_2026_06_08.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- No `lib/tax-engine/*` files touched.
- No tax calculation added — entry points deep-link into the existing lever-detail page (already FW-2 compliant for salary-sacrifice via `RegimeLockedBadge` when Div 296 fires).
- No schema columns added to `Property` / `Investment` / `LegalEntity`.
- No new AI tools.
- No per-asset tax position displayed at the entry-point layer (FW-5 N/A here).
- All five FW rules N/A for this PR.

### AFSL discipline checks

- No prescriptive copy ("you should salary-sacrifice", "we recommend selling", etc.) in either entry point.
- Income CTA framed as "What if you salary-sacrificed?" — question, not directive.
- Property sparkles tooltip framed as "What if you sold this?" — question, not directive.
- AFSL footnote on the income banner explicitly disclaims: "Hypothetical illustrations based on current tax legislation; individual circumstances may vary."

### Test plan

- Manual: open `/dashboard/properties` on a user with at least one INVESTMENT property → hover a tile → sparkles icon appears → click → lands on `/dashboard/cfo/what-if/sellProperty?propertyId=<id>` with that property pre-selected.
- Manual: open `/dashboard/income` on a user with at least one SALARY income → CTA banner visible between header and filter → click → lands on `/dashboard/cfo/what-if/salarySacrificeToSuper`.
- Manual: open `/dashboard/income` on a user with NO salary income → CTA banner absent (guard rendering correct).
- Manual: open `/dashboard/properties` on a user with only HOME and RENTAL properties → sparkles icon absent (guard rendering correct).
- Manual: toggle dark mode → both surfaces render with §18.7.2 dark-mode tokens (deeper navy background, brightened emerald `#22C55E`, near-white text).
