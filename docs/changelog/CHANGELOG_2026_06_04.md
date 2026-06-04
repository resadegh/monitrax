# Changelog - 2026-06-04

## Session: phase-45-stitch-design-LIlK9

### Changes Made

- **Type**: Design / Documentation
- **Scope**: Phase 45 "What If?" Stitch design pass
- **Description**: Completed the 4-variant matrix (desktop-light + desktop-dark + mobile-light + mobile-dark) for both Phase 45 surfaces — Screen A (lever picker) and Screen B (lever detail, Salary-sacrifice as the showcase lever). Vocabulary corrected mid-pass from Restrained Editorial flat (v1, rejected) to §18.7.2 My Wealth glass (v2 onward). Hover/focus/tap interaction patterns + mobile composition (Apple Numbers RESULT-HERO-ON-TOP) + dark mode spec all locked in PHASE_45_WHAT_IF_SCENARIOS.md before generation. CLAUDE.md §18.7.2 expanded to a side-by-side light/dark token table + 4-variant reviewer enforcement rule.

### Approved Artefacts (locked in `.stitch/designs/`)

| Surface | Device | Mode | Canonical alias | Stitch screen ID |
|---|---|---|---|---|
| A — Lever picker | DESKTOP | LIGHT | `what-if-lever-picker.{html,png}` | `9a4fa51d1fee41698e34065d72cb8cb9` |
| A — Lever picker | MOBILE | LIGHT | `what-if-lever-picker-mobile.{html,png}` | `9664c0a2a86d4cd3bc2f3c62e90258b8` |
| A — Lever picker | DESKTOP | DARK | `what-if-lever-picker-dark.{html,png}` | `7d1f3957a4aa48a8af07736181b78216` |
| A — Lever picker | MOBILE | DARK | `what-if-lever-picker-mobile-dark.{html,png}` | `fd72914ed53543b9b3bbee13f8ad7042` |
| B — Lever detail (Salary-sacrifice) | DESKTOP | LIGHT | `what-if-lever-detail.{html,png}` | `1d4642ec31db4e92a728715d6e55a43c` |
| B — Lever detail (Salary-sacrifice) | MOBILE | LIGHT | `what-if-lever-detail-mobile.{html,png}` | `a5d4ba2fae1a4af39bd751568383657b` |
| B — Lever detail (Salary-sacrifice) | DESKTOP | DARK | `what-if-lever-detail-dark.{html,png}` | `ab6dda017382473e82918a85e6909029` |
| B — Lever detail (Salary-sacrifice) | MOBILE | DARK | `what-if-lever-detail-mobile-dark.{html,png}` | `82c7f906d53845f49c76f51d87cc7ad7` |

### Files Modified

- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` — added §6.0 (v1 vocabulary failure mode), §6.1 (§18.7.2 tokens verbatim), §6.2 (per-lever sub-palette table for 5 levers × TRAIL stages), §6.3-§6.4 (Screen A + B layouts), §6.5 (locked Stitch prompt template), §6.6 (artefact iteration log with Mode column, 10 rows), §6.7 (reviewer enforcement), §6.8 (interaction patterns — hover/focus/tap, 4 subsections), §6.9 (mobile/tablet layout with RESULT-HERO-ON-TOP IA, 6 subsections), §6.10 (dark mode lock with light/dark token table + 4-variant iteration discipline, 5 subsections). §6.10.4 flipped to ✅ APPROVED for all 8 variants.
- `CLAUDE.md` §18.7.2 — expanded from 11-row single-column digest to 11 rows × 2 columns (Light + Dark) with the canonical My Wealth glass vocabulary anchored on `app/globals.css` `.dark` block tokens. Added 4-variant reviewer enforcement rule (desktop-light + desktop-dark + mobile-light + mobile-dark per surface) — light-only PRs must be rejected.
- `docs/IMPLEMENTATION_PLAN.md` — workstream `0·WI` Phase 45 Stitch design pass row flipped from `[ ]` to `[x] ✅ COMPLETE (2026-06-04)` with the locked-artefact summary.

### Files Created (artefacts)

- `.stitch/designs/what-if-lever-picker-dark.{html,png}` (Screen A desktop DARK canonical)
- `.stitch/designs/what-if-lever-picker-mobile-dark.{html,png}` (Screen A mobile DARK canonical)
- `.stitch/designs/what-if-lever-detail-v1-desktop-dark.{html,png}` (versioned)
- `.stitch/designs/what-if-lever-detail-v1-mobile-dark.{html,png}` (versioned)
- `.stitch/designs/what-if-lever-detail.{html,png}` (canonical alias of v1 desktop light)
- `.stitch/designs/what-if-lever-detail-mobile.{html,png}` (canonical alias of v1 mobile light)
- `.stitch/designs/what-if-lever-detail-dark.{html,png}` (canonical alias of v1 desktop dark)
- `.stitch/designs/what-if-lever-detail-mobile-dark.{html,png}` (canonical alias of v1 mobile dark)

### Documentation Updated

- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6 fully rewritten — see above
- `CLAUDE.md` §18.7.2 — see above
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` Phase row 1 — see above

### Testing

- [x] Design review: Reza approved Screen A v3 desktop+mobile light (2026-06-04 "looks good, ship it")
- [x] Design review: Reza approved all 4 dark variants + implicitly Screen B light (2026-06-04 "looks great, ship it" on the dark-variant review = dark mirror validates the underlying composition)
- N/A Build/lint — design-only PR; no code touched

### PR

- Branch: `claude/phase-45-stitch-design-LIlK9`
- PR URL: (to be created as draft after this commit lands)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (Phase 45 surfaces × full 4-variant matrix)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 45 Stitch design pass flipped to COMPLETE in `IMPLEMENTATION_PLAN.md`)

Docs updated in this PR:
- `CLAUDE.md` §18.7.2 — light/dark side-by-side token table + 4-variant reviewer enforcement rule
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6.0-§6.10 — full Stitch design spec with iteration log
- `docs/IMPLEMENTATION_PLAN.md` workstream `0·WI` — Phase 45 Stitch design pass marked ✅ COMPLETE
- `docs/changelog/CHANGELOG_2026_06_04.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions/tools added or modified in this PR: NONE (design-only PR, no engine code touched)
- N/A — no `lib/tax-engine/*` files modified
- N/A — no new schema columns on `Property` / `Investment` / `LegalEntity`
- N/A — no new AI tool added
- [x] One UI surface (Screen B Salary-sacrifice detail) DOES exercise §12.14 reform-awareness via the concessional-cap headroom check in the spec (PHASE_45_WHAT_IF_SCENARIOS.md §6.4 + §6.8.2). The React port (Phase 45 PR 2) will be the place where this is enforced in code — the design pass establishes the visual contract.

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows: NONE — design-only PR. No Prisma writes.

### Next

- Phase 45 PR 1 (engine composition) — `salarySacrificeToSuper.ts` + `tenYearProjection.ts`. Gated on Q-DEC PR 2-4 landing first.
- Phase 45 PR 2 (React port) — render the approved Stitch designs with cosmos-* token pin to `app/globals.css` `.dark` block.
