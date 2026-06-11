# Changelog - 2026-06-11

## Session: gallant-gates-kb264m (continued)

### Changes Made — Phase WX.5.2: in-widget Wealth Universe navigation
- **Type**: Feature (UX / navigation)
- **Scope**: `WealthUniverseWidget` (dashboard "My Structure" widget)
- **Driver**: Reza 2026-06-11 — *"the widget is still only taking me to the structure page and it has no functionality by itself. Can we have a minimal navigation on the widget as well?"*
- **Solution**: The widget is now a living miniature of the universe with the same microscopic camera as the full canvas:
  - **Bubble tap zooms IN-PLACE** — entities / individuals / groups / clusters with holdings unfold into the focused scene (parent re-centres, satellites ring it) inside the widget itself, via the canonical `layoutWealthExplorer(snapshot, { expandedEntityIds })`. No navigation, no page change.
  - **Camera**: keyed `AnimatePresence` scene swap, scale+opacity only (no animated blur — iOS Safari frame-drops `filter` animations; WX.5.1 lesson applied from the start), snappier 0.5s (the field is small, the journey shorter), `useReducedMotion` → crossfade.
  - **"‹ Universe" back pill** top-left of the mini canvas when zoomed in — mirrors the full canvas's trail-back affordance so the gesture vocabulary is identical.
  - **Tap the bubble you're inside** → zooms back out (same toggle contract as the full canvas).
  - **Asset satellites** and holdings-free entities continue on the full page (`router.push('/dashboard/entities?focus=<layer>')`) — the widget has no detail sheet; leaves hand off to the surface that does.
  - **Header arrow + footer "Open Wealth Universe →"** are now the ONLY full-page navigations, both carrying the current layer as `?focus=` so tap-through reads as "keep zooming", never "start over". Chip + footer totals stay pinned to the universe-level layout (`universeNodes`) so the header numbers never change while zoomed in.
- **Stitch (§18)**: focused-state widget screen generated in project `1859462351962811110` — screen `77b13314b96a4423975b3e89782efa46` ("Wealth Universe · Widget · Focused View"), artefact committed at `.stitch/designs/wealth-universe-zoom/universe-widget-focused-dark.{html,png}`, recorded in `.stitch/metadata.json`. Prompt seeded with the dark-universe vocabulary per §18.7.1; render matches the implementation (back pill, centred protagonist + focal ring, satellite ring, ribbons). The widget is the deliberate dark premium-moment surface, so it ships as a dark variant like the prior `universe-widget-level1-dark`.

### Files Modified
- `components/wealth-explorer/WealthUniverseWidget.tsx` — camera state + `handleTileTap`/`zoomOut`, AnimatePresence scene wrap on the mini canvas, back pill, `WidgetTile` Link→button, header arrow + footer link → `?focus=`-carrying Links, JSDoc updated with the WX.5.2 contract + Stitch SoT.
- `.stitch/designs/wealth-universe-zoom/universe-widget-focused-dark.{html,png}` — new Stitch artefact.
- `.stitch/metadata.json` — screen entry recorded.
- `docs/IMPLEMENTATION_PLAN.md` — WX.5.2 appended to the Phase 47 workstream ledger.

### Build Status
- [x] TypeScript compilation passes (`tsc --noEmit` exit 0)
- [x] ESLint passes on touched file (exit 0)
- [x] Financial-surfaces gate passes (exit 0 via `${PIPESTATUS[0]}` — 18 grandfathered, 0 new)
- [x] Tests: 39/39 green (`tests/wealth-explorer` 21 + `tests/ownership` 18)
- [x] Build passes (`npm run build` exit 0)

### Commit History
| Hash | Message |
|------|---------|
| (this PR) | feat(wealth-universe): WX.5.2 in-widget navigation — bubbles zoom the widget in place |

---

## Session: gallant-gates-kb264m (continued) — WX.5.3

### Changes Made — Phase WX.5.3: remove the redundant first zoom layer + lower the focused scene
- **Type**: Fix (UX / navigation), from Reza's live prod testing (screenshots, 2026-06-11)
- **Scope**: shared `wealthExplorerLayout` + all three universe surfaces (desktop canvas, mobile, dashboard widget)
- **Feedback 1**: *"first layer is too busy on mobile view, and on desktop view it is faded and not useful, the first layer can be removed"* — in cluster mode (≤2 entities) tapping YOU unfolded an all-holdings scene ringing every asset at once (8 inner + rest outer = 15 mixed satellites for Reza), which duplicates what the type clusters already split cleanly.
- **Feedback 2**: *"third layer the top node is hidden behind the text, it might be best to move the chart a bit lower"* — the focused-scene centre at y=42% put the top ring satellite at y=18%, colliding with the breadcrumb/trail text floating over the canvas top band.
- **Solution**:
  - New `WealthNode.isExpandable` flag computed by the layout (SSOT): clusters always; groups with holdings always (group assets never cluster — the group scene is the only way in); entities with holdings only OUTSIDE cluster mode. All three tap handlers + both deep-link effects now check `isExpandable` instead of `assetSummary` (which also powers totals and stays set).
  - In cluster mode, tapping YOU opens the entity detail card over the universe (desktop), raises the detail sheet (mobile — a tap must visibly land), or routes to the full page (widget). The journey is now Universe → cluster → assets, one meaning per layer.
  - Layout focused-scene early return defends the same rule for deep links: `?focus=<entityId>` in cluster mode falls through to the universe instead of building the removed scene.
  - Focused-scene centre moved y 42% → 52% so the top satellite clears the breadcrumb (inner ring top now ~28%, was 18%).
- **Tests**: 3 new layout tests pin the contract (entity not expandable in cluster mode / entity-focus fall-through / entities stay expandable with 3+ entities); scene-centre expectation updated. 42/42 green.

### Files Modified
- `lib/data/wealthExplorerTypes.ts` — `isExpandable` field + contract JSDoc
- `lib/data/wealthExplorerLayout.ts` — centre y=52, cluster-mode entity-focus fall-through, `isExpandable` on entity/group/cluster nodes
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — click + deep-link use `isExpandable`
- `components/wealth-explorer/WealthUniverseMobile.tsx` — tap + deep-link use `isExpandable`; non-expandable entity tap raises the sheet
- `components/wealth-explorer/WealthUniverseWidget.tsx` — tap uses `isExpandable`
- `tests/wealth-explorer/semanticZoomLayout.test.ts` — contract tests

### Build Status
- [x] tsc / eslint / financial gate (exit codes checked) / 42 tests / `npm run build` — all pass

### §17.2 post-merge verification — PR #1057 (WX.5.2)
- Prod deploy `dpl_2LvHQD8sgbYjxj8LG4QMsmCm4BdK` reached `READY` (2026-06-11 02:12:25), runtime logs clean:
  `(no runtime logs in the retention window — no recent traffic, or the deploy is too old)` — no errors since deploy.

---

## Session: gallant-gates-kb264m (continued) — WX.5.4

### Changes Made — Phase WX.5.4: asset bubbles no longer 404 in the detail panel
- **Type**: Fix (bug, Reza prod screenshot 2026-06-11: Qantas Credit Card → "Couldn't load full details / Failed (404)")
- **Root Cause**: the desktop `EntityDetailPanel` fetched `/api/entities/<node.id>` for EVERY selected bubble. Asset bubbles (and `group-<id>` ownership-group bubbles) are synthetic canvas nodes with no entity record — the fetch 404s. The mobile card already gated this (`isEntity`); the desktop panel never got the gate.
- **Solution**:
  - Desktop panel ports the mobile `isEntity` gate (`type !== 'ownership-group' && !type.startsWith('asset-')`) — no fetch for synthetic nodes.
  - Asset bubbles render a proper card from the in-memory graph record: value, **"Held by <owner>"** (ownership-trail rule — owner visible on every layer), subtype, and a warm click-through CTA. Group bubbles show value + the held-jointly asset list (resolved via `OwnershipGroup.ownedObjectId` — group assets don't match `ownerEntityId`).
  - Mobile asset card upgraded the same way: actual owner name ("Held by Reza Sadegh") + click-through CTA.
  - **`assetHrefFor` consolidated** into canonical `lib/data/wealthExplorerTypes.ts` (§12.2) — the two per-component copies had drifted: investments + super gained Asset Spotlight detail pages (Phases 45.2.1/45.2.2) while both maps still pointed at list routes. Now `investment-account → /dashboard/investments/accounts/<id>` and `super → /dashboard/investments/super/<id>`. New `assetCtaLabelFor` for warm per-kind CTA wording (§14.3).

### Files Modified
- `lib/data/wealthExplorerTypes.ts` — canonical `assetHrefFor` + `assetCtaLabelFor`
- `components/wealth-explorer/EntityDetailPanel.tsx` — `isEntity` gate, asset/group body (value + held-by + CTA + held-jointly list), local href map deleted
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — passes `assetRecord`/`ownerName`; group assets resolved via ownership groups
- `components/wealth-explorer/WealthUniverseMobile.tsx` — owner name + CTA on asset card, local href map deleted

### Build Status
- [x] tsc / eslint / financial gate (exit codes checked) / 42 tests / `npm run build` — all pass

### §17.2 post-merge verification — PR #1058 (WX.5.3)
- Prod deploy `dpl_EDvvDcKNQg7k5NsbDrGNdaQnRC5K` reached `READY` (2026-06-11 02:33:48). Reza's live testing on this deploy surfaced the WX.5.4 asset-bubble 404 (pre-existing since Phase WX.5 — not introduced by #1058).
