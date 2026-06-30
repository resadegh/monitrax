# Changelog — 2026-06-30

## Session: mobile-shell-fixes (Phase 56 PR-A + PR-B)

### Changes Made
- **Type**: Fix (mobile UI shell)
- **Scope**: Floating action buttons (FAB) + dashboard scroll container on mobile
- **Description**: The two approved quick wins from the Phase 56 mobile-activity plan (Reza 2026-06-30: "ok go with recommendations" — ship PR-A + PR-B now; PR-C row redesign comes via a Stitch ≥9/10 pass). **PR-A** — on mobile (`<md`) the green "quick add cash" `+` FAB overlapped the global scan/camera FAB (both bottom-right). It now stacks **above** the camera FAB on the same right edge with a clear gap, and restores the normal corner position at `md+` (where the camera FAB is hidden). **PR-B** — iOS Safari's document-level rubber-band dragged the whole page (including the fixed bottom nav) up, revealing a black gap. Fixed by switching the dashboard shell from `min-h-screen` (100vh) to `min-h-[100dvh]` (dynamic viewport, tracks the collapsing toolbar) plus `overscroll-behavior-y: contain` on both the shell and `body`.

### Files Modified
- `components/bookkeeping/CashQuickAddButton.tsx` — `+` FAB className: mobile position `bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] right-4` (stacks above the camera FAB) → `md:bottom-8 md:right-8` desktop; `z-[35]` keeps it above the fixed bottom nav.
- `components/DashboardLayout.tsx` — shell wrapper `min-h-screen` → `min-h-[100dvh] overscroll-y-contain`.
- `app/globals.css` — `body { overscroll-behavior-y: contain; }`.

### Verification (§19 — no financial number)
- **No financial-graph impact** — pure front-end CSS/positioning. `neomatrix:check` green (235 nodes, 312 edges, markdown fresh).
- PR-B requires on-device iOS Safari verification (Reza) — the `100dvh` + `overscroll-behavior` combination is the canonical fix but its effect on the rubber-band is device/OS-version sensitive.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (FAB stacking + scroll container — true tweaks to existing surfaces, §18.2.1 code-first allowed; no new section composition)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/changelog/CHANGELOG_2026_06_30.md` — this entry

Note: the Phase 56 plan doc (`PHASE_56_MOBILE_ACTIVITY_REDESIGN.md`) + the
`0·MOBILE-ACTIVITY` workstream entry live in the separate docs PR (#1302,
off `main`). When #1302 merges, its workstream PR-A/PR-B rows are flipped to
shipped referencing this PR. Keeping the plan/tracking in one PR and the code
in another avoids a cross-branch doc conflict; the changelog above is this PR's
self-contained record.

### Testing
- [ ] Local build/vitest not runnable in this remote sandbox (incomplete `node_modules`) — CI is the gate (Build + vitest + `neomatrix:check`).
- [x] `neomatrix:check` run locally — OK.
- [x] Self-review gate (§20.4/§20.5): 3× against requirement → 10/10 (both fixes are the canonical, minimal, reversible solutions; no new section composition so §18.2.1 allows code-first; PR-C row redesign correctly deferred to Stitch).

### PR
- Branch: `claude/mobile-shell-fixes`
- Status: draft

---
