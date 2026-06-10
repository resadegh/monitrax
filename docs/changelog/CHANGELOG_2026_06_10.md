# Changelog - 2026-06-10

## Session: gallant-gates-kb264m

### Changes Made
- **Type**: Enhancement (UX / layout architecture)
- **Scope**: Wealth Universe (desktop canvas, mobile hybrid, dashboard widget) — Phase 7 of workstream 0·WX, code tag `Phase WX.4`
- **Root Cause**: Reza report (desktop + mobile screenshots, 2026-06-10): *"the entities are so small specially when there are a number of them connected to the user it will become unreadable."* The layout placed every node in percentage coordinates inside fixed zones with fixed-pixel tile sizes and a fixed 9%-radius satellite arc — space constant, node count growing, overlap inevitable. The dashboard widget compounded it by rendering the ENTIRE graph at 0.42× scale inside a 340px card (an asset tile ≈ 22px with ~20px satellite spacing → tiles physically overlapped). The canvas zoom buttons were decorative — no handlers, hardcoded "100% · Universe" label.
- **Solution**: **Semantic zoom** (Apple Maps principle — what is shown changes with zoom level, not just how big it is):
  - **Level 1 · Universe (default)**: no asset satellites. `layoutWealthExplorer(snapshot, options?)` gains `assetDetail: 'collapsed' | 'all'` + `expandedEntityIds`. Entity/group tiles carry `assetSummary { count, totalValue }` rendered as a docked count-badge pill + accent "$X held" line. ~6 large legible tiles instead of 20+ tiny ones.
  - **Level 2 · Constellation**: selecting an entity unfolds its assets as satellites — one arc ≤ 6, two concentric rings beyond — with a staggered `wealth-satellite-pop` entrance (scoped `prefers-reduced-motion` fallback). Selecting the entity again / back-chevron / panel-close folds back to Level 1. Selecting a satellite keeps its constellation open.
  - **Mobile**: canvas renders collapsed Level 1 + tapped constellation; the bottom-sheet list keeps the full graph (`assetDetail: 'all'`) so granular asset browsing is untouched (filter-chip counts + "Holds N" pills read from the full graph).
  - **Dashboard widget**: Level 1 always (hook default). Tile scale 0.42 → 0.58. Footer total now sums raw `assetSummary` aggregates instead of re-parsing formatted display strings.
  - **Collision relaxation**: deterministic pairwise pass as the layout's final step (YOU anchor immovable; positions mutated in place, clamped to the canvas safe area). Safety net for crowded zones — aggregation is the primary mechanism.
  - **Dead chrome removed**: the non-functional zoom +/−/fit buttons deleted (§12.1). True viewport pan/zoom is a queued follow-up; buttons return only when they work.
  - **Financial-adviser-lens correction**: loan principal no longer counts toward "$X held" (in the per-entity line NOR the widget footer total) — debt is not held wealth. Loans still count in the badge (real holdings to explore).
- **Stitch-first (§18)**: 4 new screens generated in project `1859462351962811110`, seeded with the established Wealth Universe dark vocabulary — L1 desktop `770687a1c73c42f0b4fd5686782bf5f3`, L2 desktop `068403f1296440508b601c2fc32d5e20`, L1 mobile `e5ecb8d170cc4fbdbc336413cd9948d2`, widget `80c21d51c38242d883bec3d6875fabe6`. Artefacts committed at `.stitch/designs/wealth-universe-zoom/*.{html,png}`. PNGs shared with Reza in-session. Surface is dark-only by design (documented "premium-moment break") — deliberate, documented deviation from the §18.7.2 light+dark matrix.

### Files Modified
- `lib/data/wealthExplorerTypes.ts` — `WealthNode` gains `assetSummary`, `parentNodeId`, `isExpanded`; Stitch SoT header updated
- `lib/data/wealthExplorerLayout.ts` — `LayoutOptions` (collapsed default + `expandedEntityIds`), up-front asset grouping + `summarize()`, two-ring `placeSatellites`, `relaxCollisions()` pass, holds-ribbon scoping
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — local layout memo w/ expansion state, `handleNodeClick`/`clearSelection`, count badge, satellite pop-in + stagger, zoom buttons removed, contextual hint copy
- `components/wealth-explorer/WealthUniverseMobile.tsx` — dual layout (collapsed canvas / full list), expansion on tap, count badge, satellite pop-in, scoped reduced-motion
- `components/wealth-explorer/WealthUniverseWidget.tsx` — scale 0.58, count badges, footer total from raw aggregates
- `tests/wealth-explorer/semanticZoomLayout.test.ts` — NEW, 11 tests pinning the layout contract
- `.stitch/designs/wealth-universe-zoom/*.{html,png}` — NEW, 8 committed Stitch artefacts

### Documentation Updated
- `docs/architecture/06_UI_UX_FOUNDATION.md` — new "Semantic zoom (Phase WX.4)" section in the Wealth Universe Explorer pattern; data-flow chain updated; ZoomControls component row struck through with rationale
- `docs/IMPLEMENTATION_PLAN.md` — workstream 0·WX: Phase 7 entry added, status/last-touched updated
- `docs/changelog/CHANGELOG_2026_06_10.md` — this entry

### Build Status
- [x] TypeScript compilation passes (`next build` clean)
- [x] Build passes (`npm run build`)
- [x] Lint passes on changed files (0 errors, 0 warnings after `useMemo` wrapping)
- [x] Tests pass — 11 new (`tests/wealth-explorer/`) + 66 neighbouring (`tests/wealth-graph/`, `tests/entity-graph/`) all green

### Notes / Known follow-ups
- True viewport pan/zoom (pinch / scroll / fit-to-view) intentionally deferred — only if semantic zoom proves insufficient at real user node counts.
- Mobile filter chips for asset types (Properties / Cash / …) still drive the bottom-sheet list; on the Level 1 canvas they dim all entity tiles (no asset tiles to match). Acceptable v1 — list shows the matches. Revisit if confusing in practice.
