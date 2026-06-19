# Changelog - 2026-06-19

## Session: Wealth Universe — WX.6.1 (tap to zoom first, details second)

### Changes Made
- **Type**: Fix (UI interaction)
- **Scope**: `WealthUniverseCanvas.tsx` + `WealthUniverseMobile.tsx` tap handlers.
- **Problem (Reza, 2026-06-19 prod screenshots ×3)**: clicking an entity (e.g.
  YOU) on Level 1 zoomed into its bundles AND opened the entity detail file at
  the same time — the file greyed out the universe the user had just zoomed
  into, forcing a close before the bundles could be seen. *"First click on a
  layer change needs to only zoom in; second click should open the node
  details."*
- **Solution**: split the two actions across two taps.
  - **First tap** on an expandable bubble → **zoom in only** (`expandedIds`
    push/replace; `selectedId` cleared, so no panel).
  - **Second tap** on the centred bubble → opens its detail file (entity /
    group). A **cluster** has no file, so its second tap zooms back out
    (the breadcrumb is the other way back).
  - A leaf asset, or a holding-less entity (nothing to zoom into), opens its
    file on the first tap — unchanged.
  - Deep-link `?focus=` mirrors a manual first tap (zoom, no panel).

### Files Modified
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — `handleNodeClick`
  first-tap-zoom / second-tap-details; deep-link no longer auto-selects.
- `components/wealth-explorer/WealthUniverseMobile.tsx` — same for `onTapTile`
  + deep-link.

### Build Status
- [x] `tsc --noEmit` — clean
- [x] `next lint` — clean on changed files
- [x] `npm run build` — passes
- [x] `tests/wealth-explorer/semanticZoomLayout.test.ts` — 36/36 (layout
  unchanged; this is an interaction-only change in the components, which the
  codebase does not have a test harness for).

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] component pattern / interaction → `docs/architecture/06_UI_UX_FOUNDATION.md`
  (semantic-zoom section: new tap-semantics rule 7 + reviewer-reject rule 8)
- [ ] config / infra / identity / deployment / security / strategic decision — none

### Notes
- §18.2.1: interaction-behaviour tweak (tap semantics) on an approved surface —
  no new section-level composition or visual primitive → true tweak, code-first
  permitted; no Stitch pass required.
- Pure-presentation — no schema, no migration, no calc-engine touch.
- Follow-up to WX.6 (PR #1158, merged); fixes the panel-on-zoom-in interaction.
