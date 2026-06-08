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
