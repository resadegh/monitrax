# Changelog - 2026-06-11

## Session: serene-goodall-6smazx (continued)

### Changes Made
- **Type**: Feature + Redesign
- **Scope**: Activity page (`/dashboard/activity`) + AI categorisation confirmation
- **Description**: Phase 49 — full Stitch-first redesign of the Activity page to the
  Phase 39 glass vocabulary, plus confidence-based bulk confirmation of AI
  categorisations (Reza directives 2026-06-11: "Perform a redesign of the whole page
  based on the design principles and the stitch UI … included the swipe options
  specially on mobile view" + "there should be a bulk confirmation based on the
  confidence level").

### Stitch-first compliance (CLAUDE.md §18)
Project `1859462351962811110`; 4-variant matrix per §18.7.2 dark-mode enforcement:
| Variant | Screen ID |
|---|---|
| Desktop light | `351c6db2f6f34996a93da26f60c47a2b` |
| Desktop dark | `c86cfc05ff8d4a129bc1c608d7748a55` |
| Mobile light | `1f2e9df37c16409c99a448871ff69277` |
| Mobile dark | `fa6a2ea95aab4679be793c2cc8144927` |
Artefacts committed at `.stitch/designs/activity-redesign/*.{html,png}`. Generation
prompts seeded with the §18.7.2 digest verbatim (warm ivory, glass recipe + exact
shadow values, radius hierarchy, money-signal rules, gems, tabular-nums,
behaviour-psychology framing); mobile applied §18.7.6 Compact Dashboard mechanics.
Direction approved by Reza before React ("generate the dark version and ship it").

### Files Modified
- `lib/bank/bulkConfirm.ts` — NEW canonical service: `getConfidenceSummary()` +
  `bulkConfirmCategorisations()` (band or explicit ids; promotes confidenceScore to
  1.0 — the established "user validated" convention from bulk-categorise — and
  reinforces MerchantMapping with `lastConfirmedAt`; never overwrites USER-source
  mappings; no category mutation; no schema change needed)
- `app/api/unified-transactions/bulk-confirm/route.ts` — NEW thin route: GET summary
  + POST confirm (`withPermission` transaction.read/write)
- `components/bookkeeping/ConfidenceReviewCard.tsx` — NEW "Your AI bookkeeper" hero
  card: segmented emerald/amber/rose confidence bar, "Confirm all N medium" primary
  gradient action, "Review N low" → card-stack review, celebratory copy, self-hides
  when tidy
- `app/dashboard/activity/page.tsx` — glass restyle (hero card list, search,
  advanced panel, day-group cards), §18.7.2 polished KPI tiles (rose/emerald/brand-
  gradient/violet gems + top-accent strips), §18.7.6 mobile KPI swipe strip
  (snap-mandatory, 78vw tiles with peek, page dots), per-row confidence dots
  (always-visible when < 0.9), "✓ Looks right" single-row confirm chip, mobile
  category pill under merchant, swipe-affordance hint line, reviewLowMode wiring
  into the existing ReviewQueueCards stack

### Architecture decisions
- **No schema migration**: "confirmed" = `confidenceScore: 1.0`, the same value
  bulk-categorise writes — §12.12 avoided entirely
- **Confirmation ≠ correction**: bulk-confirm never touches the category triple or
  `userCorrectedCategory`; corrections stay on the PATCH/bulk-categorise paths
- **One endpoint per concern (§12.4)**: bulk-confirm (accept AI as-is) is distinct
  from bulk-categorise (re-categorise to a user-chosen triple)
- **TransactionReviewQueue rows deliberately not updated** — import-time staging
  with no UI (🗑️ row 31); confirming live transactions is the user-facing truth

### Testing
- [x] tsc clean
- [x] 458/458 tests (tests/bookkeeping + tests/ai)
- [x] Build passes

---

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

## Session: serene-goodall-6smazx — Phase 49.1 (bulk-confirm correctness fix)

### Root cause
The Phase 49 "AI bookkeeper" card was invisible in prod. Cause: the QIF/CSV
import routes auto-accepted predictions (≥0.9) to `UnifiedTransaction` but parks
MEDIUM (0.7–0.9) and LOW (<0.7) predictions in `TransactionReviewQueue` (PENDING).
The first bulk-confirm service counted medium/low from `UnifiedTransaction` — always
zero — so the card's `pending` was 0 and it self-hid. The pile the user wants to
confirm lives in the review queue, which never had a UI (§12.1 🗑️ row 31).

### Fix (Phase 49.1)
- **NEW `lib/bank/reviewQueue.ts`** — extracted `confirmReviewItem` (create
  UnifiedTransaction from a queue row + Phase 13 learning) out of the per-batch
  review route into a shared service (§12.3 no-duplicate). Confirming now writes
  confidenceScore 1.0 (the confirmed convention) and resolves accountId from the
  item's batch when not passed.
- `app/api/accounts/[id]/import/[batchId]/review/route.ts` — imports the shared
  `confirmReviewItem`; ~120 lines of duplicated helper deleted.
- `lib/bank/bulkConfirm.ts` — rewritten to read MEDIUM/LOW from
  `TransactionReviewQueue` (PENDING, by `confidenceLevel`) and HIGH (auto-filed)
  from `UnifiedTransaction`; `bulkConfirmCategorisations` promotes queue items in a
  band (or by id) into real transactions via the shared service, then rolls up the
  import-batch counters. **This gives the review queue its first user-facing surface.**
- `app/api/unified-transactions/bulk-confirm/route.ts` — body `transactionIds` →
  `reviewItemIds`.
- `components/bookkeeping/ConfidenceReviewCard.tsx` — "Review N low" → "Confirm N
  low" (band confirm); dropped the unused `uncategorised`/`onReviewLow` surface.
- `app/dashboard/activity/page.tsx` — per-row "✓ Looks right" repointed to the
  canonical PATCH path (for genuinely-uncertain UnifiedTransactions e.g. Basiq
  medium-confidence); removed the dead reviewLowMode wiring.

### Testing
- [x] tsc clean
- [x] 253/253 bookkeeping tests
- [x] Build passes

## Session: serene-goodall-6smazx — Phase 49.2 ("Where your money goes" donut redesign)

### Changes
Redesigned the dated grey Sankey on `/dashboard/activity` to a modern Apple-Health-style
DONUT + legend (Reza directive 2026-06-11: "a pie chart might be a better option … modern,
clean, apple like"; donut chosen over solid pie per the design principles). Stitch-first
per §18 — project 1859462351962811110, 4-variant matrix (desktop light
`6b3ab0e0b5494d109d6954e781a1fd27` / desktop dark `7b9c9445bd364b42b972ad19cbea3319` /
mobile light `86078d1815a54d68a6f0f198732cf25c`; dark reuses dark vocabulary). Direction
approved by Reza on the donut before React ("this looks better … ship it"). Artefacts:
`.stitch/designs/money-flow-redesign/`.

- `components/bookkeeping/ConsumerMoneyFlowSankey.tsx` — default view now an inline-SVG donut
  (no chart-lib dep, §12.7) + legend. Donut = proportions at a glance, Surplus the emerald
  hero arc (thicker + soft glow); center celebrates "KEPT 12% / $40K surplus"
  (behaviour-psychology lens). Legend = exact amounts + % (solves donut precision), Surplus
  row emerald-emphasised. The original Sankey is preserved behind a "View flow detail"
  opt-in toggle (desktop Sankey / mobile vertical bars unchanged). Glass vocabulary §18.7.2
  (28px radius, bg-card/70 + blur, 3px gradient top-accent, layered shadow + dark recipe).
  `projectSnapshotToMoneyFlow` (the SSOT projection, §12.3) untouched — donut consumes the
  same `MoneyFlowResult`.

### Testing
- [x] tsc clean
- [x] 10/10 consumerSankeyProjection tests (projection unchanged)
- [x] Build passes
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

## Session: serene-goodall-6smazx — Phase 49.3 (per-account direct import on Balances)

### Changes
Reza directive 2026-06-11: surface QIF/CSV import directly on each account row of
/dashboard/balances (it was buried in the account detail dialog's Transactions tab), and
when launched from an account, skip the "Create New vs Existing account" question — that
choice stays only on the top-level general Import.

- `app/dashboard/balances/page.tsx` — `AccountRowView` restructured from a single `<button>`
  to a `<div>` wrapping the detail-open button + a sibling per-account Import (Upload) icon
  button (nested buttons are invalid HTML). The import button is quiet by default and lights
  up sky on row hover/focus; always visible on touch. New `importTarget` state + `openImport()`
  helper: row/detail-dialog imports pre-target the account; top-level Import / AddSourcePicker
  / `?action=import` deep-link pass no target (general flow). Account detail dialog's
  "Import Transactions" now also pre-targets the account being viewed.
- `components/bank/TransactionImportDialog.tsx` — already supported `accountId` (skips the
  select-account step via `getInitialStep()`); hardened the open-reset effect to set
  `accountMode` deterministically ('existing' when pre-targeted, else 'new') so a prior
  per-account open can't leave the general flow stuck on 'existing'.

### Testing
- [x] tsc clean
- [x] Build passes

### §17.2 — PR #1061 post-merge verification
Prod deploy `dpl_53MakSGzKEwHXipoYXsCcSX76xQF` reached READY; error logs since merge are only
the pre-existing DEP0169 deprecation warning — no new errors. Bulk-confirm fix + donut live.

## Session: serene-goodall-6smazx — Phase 49.4 (confidence-band review surface)

### Changes
Reza directive 2026-06-11: differentiate confidence categories + let the user SEE the
medium/low pile before bulk-confirming (currently blind). Built BOTH requested paths over
one foundation (exposing the review queue to the frontend):
(A) item-level review — band buttons / chips open a list of that band's queue items with a
confidence dot + per-item Confirm/Skip + bulk Confirm/Skip;
(B) confidence-band filter chips on the Activity list (Medium · N / Low · N).

Design note recorded for Reza: did NOT recolour the category tag by confidence — the tag
already encodes the *category* colour, so a separate confidence DOT (amber medium / rose low)
carries the band without overloading one chip with two meanings.

- `lib/bank/reviewQueue.ts` — `listReviewQueueByBand()` + `skipReviewItems()`.
- `app/api/unified-transactions/review-queue/route.ts` — NEW: GET (list band items) +
  POST (action confirm|skip by ids); thin wrappers, reuse bulkConfirm + reviewQueue services.
- `components/bookkeeping/ConfidenceReviewCard.tsx` — band actions reworked: medium = "Confirm
  all" + "Review"; low = "Review" (no blind confirm — it's <70%). New `onReviewBand` prop.
- `app/dashboard/activity/page.tsx` — `confidenceBand` state; band filter chips (counts from
  the summary); when a band is active, the list renders `QueueReviewList` (PENDING queue items
  with confidence dots, per-row + bulk Confirm/Skip, select-all, empty/celebration state)
  instead of the transaction list. Card "Review" buttons set the band + scroll to the list.

### Testing
- [x] tsc clean
- [x] 253/253 bookkeeping tests
- [x] Build passes
