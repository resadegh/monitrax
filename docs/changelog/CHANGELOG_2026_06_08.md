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
