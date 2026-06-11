# Changelog - 2026-06-11

## Session: phase14.7-mobile-trail-tabs-LIlK9

### Changes Made
- **Type**: Fix (mobile IA regression)
- **Scope**: `components/editorial/shell/EditorialBottomNav.tsx` — replace
  hardcoded 5-cell list with the canonical `mobileTabBarItems` SSOT.
- **Description**: Reza reported on mobile (2026-06-11) that "I don't have
  all the sidebar pages available. My budget and safety net are not
  available." Investigation: `EditorialBottomNav` had hardcoded its own
  list of 5 cells (Home / Accounts / Wealth / Guide / More) that drifted
  from the canonical `mobileTabBarItems` SSOT in
  `lib/navigation/trailNav.tsx` — Phase 14.6 v4 (2026-05-08) had explicitly
  expanded the bar to 6 tabs to include Reduce (My Budget) and Anchor
  (My Safety Net), per Reza directive "trail is the IA, all five stages
  should be visible end-to-end." The editorial-shell refactor regressed
  the bar back to the pre-v4 5-cell layout and the bug went unnoticed
  until today. Budget + Safety Net were also missing from `mobileMoreItems`,
  so users had no path to either surface from mobile.

### Fix
- `components/editorial/shell/EditorialBottomNav.tsx` rewritten to render
  from the canonical `mobileTabBarItems` (6 tabs: Home / Track / Reduce /
  Anchor / Invest / Guide) + a 7th "More" cell that opens the existing
  `<MoreSheet />` drawer for the non-stage surfaces (Household / Vault /
  Reports / Settings — unchanged from `mobileMoreItems`).
- Active state per tab now adopts the TRAIL stage tone (sky T / amber R /
  indigo A / emerald I / violet L) instead of a single fixed emerald —
  matches the visual semantics across the rest of the editorial system.
- Cell width: `flex-1` distributes space evenly; 7 cells on a 320px iPhone
  give ~45px each which still passes the 44px tappable-minimum.
- Labels ≤6 chars per the canonical SSOT contract — no truncation risk.

### Files Modified
- `components/editorial/shell/EditorialBottomNav.tsx` — 5-cell hardcoded
  list replaced with `mobileTabBarItems`-driven render + TRAIL-tone active
  states.

### Build Status
- TypeScript compilation: **PASS**.

### Doc-sync (CLAUDE.md §16.5)
Surfaces changed in this PR:
- [x] visual design system / component pattern (mobile bottom nav now
  TRAIL-tone-aware, 6 stage tabs + More)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/changelog/CHANGELOG_2026_06_11.md` (this entry)
- `docs/IMPLEMENTATION_PLAN.md` — ✅ Recently Completed entry
- File-header JSDoc on `EditorialBottomNav.tsx` documents the Phase 14.7
  rewrite + cross-references TRAIL_FRAMEWORK.md §5 and the Phase 14.6 v4
  directive (§16.4 file-header rule)

### Destructive write checklist (CLAUDE.md §12.11)
No destructive Prisma writes. No schema change (§12.12 N/A).

### Stitch (CLAUDE.md §18)
N/A — this is a structural / IA fix that restores the pre-existing TRAIL
mobile-bar design intent. No new visual primitive introduced. The original
Stitch screen `dc038cd19aea4cfc8d0300f4d9122ffd` (5-cell layout) is now
superseded by the canonical SSOT and noted as visual reference only in
the file-header JSDoc.

### PR
- PR URL: TBD
- Status: Draft

## Session: phase45.8.1-cashflow-tonumber-hotfix-LIlK9

### Changes Made
- **Type**: Hot fix (production crash)
- **Scope**: `lib/utils/formatters.ts` — defensive `formatCurrency` against
  string-serialized Decimals.
- **Description**: Phase 45.8 (PR #1064) shipped a §18.7.2 glass redesign of
  `/cashflow` whose new tiles call the shared `lib/utils/formatters.ts`
  `formatCurrency` (where the previous tiles used local helpers that
  silently accepted strings via `Intl.NumberFormat.format`). The shared
  helper's previous branch — `typeof amount === 'number' ? amount :
  amount.toNumber()` — crashed at runtime when any Decimal-typed field
  arrived as a JSON-serialized string (Prisma Decimal's default
  `toJSON()` produces `"12345.67"` strings, not numbers). Reza saw
  `Something went wrong / e.toNumber is not a function` on production
  /cashflow ~minutes after the Phase 45.8 deploy went READY.

### Fix
- `lib/utils/formatters.ts` — added `string` to `CurrencyFormatInput` and
  branched the coercion explicitly: number → use as-is; string → `Number()`;
  duck-typed `{toNumber()}` → call it; everything else → empty placeholder.
  Defensive at the call site so the entire app gains robustness to any
  Decimal-as-string leak, not just the cashflow page. JSDoc records the
  Phase 45.8.1 origin.
- Old call sites that pass numbers are byte-equivalent (number branch
  short-circuits as before).

### Files Modified
- `lib/utils/formatters.ts` — `formatCurrency` now accepts strings.

### Build Status
- TypeScript compilation: **PASS** (no errors in changed files).

### Doc-sync (CLAUDE.md §16.5)
Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new failure mode — Decimal-as-string in
  `formatCurrency`)
- [ ] strategic decision

Docs updated in this PR:
- `docs/changelog/CHANGELOG_2026_06_11.md` (this entry)
- Inline JSDoc on `lib/utils/formatters.ts` documents the failure mode +
  fix (§16.4 file-header rule)

### Destructive write checklist (CLAUDE.md §12.11)
No destructive Prisma writes. No schema change (§12.12 N/A).

### PR
- PR URL: TBD
- Status: Draft

## Session: phase45.8-cashflow-redesign-LIlK9

### Changes Made
- **Type**: Redesign + new feature
- **Scope**: `/cashflow` page (full §18.7.2 glass-vocabulary rewrite) + new
  `Saving Opportunities` detector + enhanced `Money Leaks` classifier.
- **Description**: Phase 45.8 — Reza brief 2026-06-11: "Let's redesign the
  cashflow page using stitch and the design principles … the leak detector
  is a good indicator. I want the user to see where the money is leaking
  and should be looked at, maybe duplicated transactions, suspicious, etc.
  … one of my major pain points is due to having multiple accounts and
  properties it is very hard for me to pinpoint where my money is going and
  if there are any saving opportunities available. maybe even saving
  opportunity is another tile that can be very useful". Approved "all good,
  ship it" / "looks good , ship it".

### Stitch-first compliance (CLAUDE.md §18)
Project `1859462351962811110`; 4-variant matrix per §18.7.2 dark-mode
reviewer enforcement:
| Variant | Screen ID |
|---|---|
| Desktop dark | `ff0beab3c934409893fe04441120a472` |
| Desktop light | `60c5d43c95a64920b38a5da2b777faea` |
| Mobile dark | `be8c24402cad45ae88d55de0daa59781` |
| Mobile light | `ffda21749e004a4daf958ec437b7e35b` |
Artefacts committed at
`.stitch/designs/cashflow-redesign/dashboard-cashflow-redesign-v1-*.{html,png}`.
Generation prompts seeded with the §18.7.2 digest verbatim (warm-ivory page
bg, glass-card recipe + exact shadow values, radius hierarchy, money-signal
mapping for emerald / amber / rose / sky / indigo / violet, gems, tabular-
nums, behaviour-psychology framing); mobile applied §18.7.6 Compact
Dashboard mechanics (KPI swipe strip + 3 Bento Pair rows). Direction
approved by Reza before React port.

### New composition (top-to-bottom)

1. **Hero** — confident money-story headline (-$ net in rose, +$ in
   emerald, =$0 in foreground), supporting sentence (warm copy per §0
   behaviour-psychology lens, never alarming), Cashflow Health pill (tier
   → emerald / sky / amber / rose chip tone), 4-tile inline KPI row (Money
   In emerald · Money Out rose · Balance neutral · 30-Day Forecast indigo)
   reflowing 2×2 on mobile.
2. **Bento Pair 1** — Money Flow waterfall (sky→indigo glass, top-5 by abs
   value, mini progress bars) + Next Best Action (indigo→violet glass,
   distilled AI summary sentence, primary CTA, estimated-impact pill).
3. **Bento Pair 2** — Budget vs Actual (emerald glass, overall progress
   bar + top-5 categories, OVER = amber not red per §18.7.2 money-signal)
   + Tax Summary (violet glass, gradient hero number, 3-cell mini-grid,
   top strategy callout).
4. **Bento Pair 3** — Money Leaks **ENHANCED** (amber glass, behavioural
   classifier chips per leak: duplicate / subscription creep / forgotten
   subscription / category overspend, annual context if ≥$500/yr,
   celebratory empty state) + Saving Opportunities **NEW** (emerald glass,
   list of 3 levers with rationale + estimated annual benefit + CTA,
   general-information-only footnote pinned).
5. **Smart Actions long-tail** — preserves the existing
   `SmartActionsEnhanced` list (rank 2+) to keep all current actions
   surfaced (Reza directive: "do not remove any of the tiles without my
   confirmation, we are only redesigning").
6. Data-coverage footer.

### Files Modified / Created
- `lib/cashflow/savingOpportunities.ts` — **NEW** pure detector over
  `MasterFinancialSnapshot`. Three v1 opportunity kinds: `HISA_UPGRADE`
  (2.5pp uplift × liquid cash, ≥$5k threshold, ≥$125/yr benefit),
  `OFFSET_LINK` (non-investment loan balance ≥$50k + surplus liquid cash
  beyond 3-month essential buffer, capped at loan balance × 5.5% rate,
  ≥$200/yr benefit), `SALARY_SACRIFICE` (gross income > $90k + concessional
  wedge to $30k FY27 cap × 15pp net-of-super-tax saving, ≥$300/yr benefit).
  Sorted by estimated annual benefit; empty array is a celebrated state.
  Conservative assumptions documented inline. Never recommends offsetting
  an investment loan (converts deductible interest to non-deductible —
  documented in source).
- `app/api/cashflow/intelligence/route.ts` — extended to call
  `getMasterFinancialSnapshot()` + `detectSavingOpportunities()` after the
  existing intelligence build, with try/catch so the saving-opportunity
  failure mode (e.g. snapshot fetch error) doesn't block the rest of the
  response.
- `app/(dashboard)/cashflow/components/intelligence/glass/GlassMoneyFlowTile.tsx`
  — NEW. Sky→indigo glass wrapper around waterfall data.
- `app/(dashboard)/cashflow/components/intelligence/glass/GlassNextBestActionTile.tsx`
  — NEW. Indigo→violet glass tile distilling AI summary + top SmartAction
  into a single tile with one CTA + estimated-impact pill.
- `app/(dashboard)/cashflow/components/intelligence/glass/GlassBudgetTile.tsx`
  — NEW. Emerald glass. UNDER/ON_TRACK/OVER each get a gradient bar but
  OVER = amber, never red (§18.7.2). Celebrating empty-state CTA links to
  budget-analysis.
- `app/(dashboard)/cashflow/components/intelligence/glass/GlassTaxTile.tsx`
  — NEW. Violet glass. Gradient hero number + 3-cell mini-grid +
  top-recommendation callout.
- `app/(dashboard)/cashflow/components/intelligence/glass/GlassMoneyLeaksTile.tsx`
  — NEW. Amber glass. In-tile `classifyLeak()` maps the existing leak
  shape into 4 behavioural kinds via category + trend + description
  patterns (no new backend data needed): `DUPLICATE` (desc contains
  duplicate / charged twice / multiple charges), `SUBSCRIPTION_CREEP`
  (subscription category + INCREASING trend), `FORGOTTEN_SUB` (subscription
  category + STABLE/DECREASING trend), `CATEGORY_LEAK` (everything else).
  Empty state celebrates ("Nothing flagged this month — N transactions
  analysed, no duplicates / creep / forgotten charges").
- `app/(dashboard)/cashflow/components/intelligence/glass/GlassSavingOpportunitiesTile.tsx`
  — **NEW**. Emerald glass. Renders the 3 opportunities with their gems
  (PiggyBank / Building2 / TrendingUp), rationale, annual benefit pill,
  CTA link. Pinned general-information footnote per §0 financial-adviser
  lens (estimates use conservative market-rate assumptions, not personal
  advice).
- `app/(dashboard)/cashflow/components/intelligence/glass/index.ts` — barrel.
- `app/(dashboard)/cashflow/page.tsx` — full rewrite. New `CashflowHero`
  with 4-tile KPI row + Cashflow Health pill; new 3-Bento-Pair composition;
  glass skeleton + error state; preserves `SmartActionsEnhanced` long-tail
  (rank 2+) per "do not remove any tiles" directive.
- `docs/IMPLEMENTATION_PLAN.md` — entry under ✅ Recently Completed.
- `docs/changelog/CHANGELOG_2026_06_11.md` — this entry.

### Build Status
- TypeScript compilation: **PASS** (no errors in changed files; only
  pre-existing unrelated `.next` cache type for the deleted
  `auth/resend-verification` route lingers).
- `lint:financial-surfaces`: **PASS** (18 grandfathered, 0 new).

### §18.7.4 / §18.7.5 / §18.7.6 status
- §18.7.4 Cremorne pattern: not applied here — `/cashflow` is a
  multi-section diagnostic dashboard, not a single-asset detail page.
- §18.7.5 Asset Spotlight template: not applicable — list-of-sections
  dashboard, not a single-focal-asset page.
- §18.7.6 Compact Dashboard pattern: applied to the mobile reflow (Hero
  KPIs become 2×2 grid on mobile because each of the 4 tiles needs to
  remain readable — full swipe-strip with page dots was considered but
  the 4-tile width was small enough that the 2×2 collapse reads better
  than a horizontal scroll for this surface).

### Behaviour-psychology lens (§0)
- Empty states for both Money Leaks and Saving Opportunities celebrate
  (no flagged leaks = "Your spending patterns are tight this month"; no
  opportunities = "Your structure is tight" — never "nothing to do" or
  "you have no savings opportunities").
- Saving Opportunities footnote: "Estimates use conservative assumptions
  about market rates. General information only, not personal advice."
  Reza brief never asked for advice; the tile is decision support.
- Amber, never red, for leaks (caution money signal per §18.7.2).
- Annual leak context only surfaces if ≥$500/yr to avoid amplifying small
  signals into urgency.

### Doc-sync (CLAUDE.md §16.5)
Surfaces changed in this PR:
- [x] visual design system / component pattern (6 new glass tiles +
  cashflow page composition + new hero)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` (✅ Recently Completed entry)
- `docs/changelog/CHANGELOG_2026_06_11.md` (this entry)
- Inline JSDoc on each new component file points back to the canonical
  Stitch screen IDs (§16.4 file-header rule)
- `.stitch/designs/cashflow-redesign/` artefacts committed alongside

### Destructive write checklist (CLAUDE.md §12.11)
No destructive Prisma writes in this PR. No schema change (§12.12 N/A).

### PR
- PR URL: TBD
- Status: Draft

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

## Session: serene-goodall-6smazx — Phase 49.5 (review-row category editing + action-cluster layout)

### Changes
Two pieces of Reza feedback on the 49.4 review surface (2026-06-11):
1. *"there is no option to change categories on each line"* — added the third action:
   the category pill is now TAPPABLE and opens the existing CategoryPickerSheet; picking a
   category files the queue item with the corrected triple via the shared
   confirmReviewItem('EDIT') path (USER_CORRECTION — a stronger learning signal than confirm).
2. *"the category should sit next to the confirmation buttons"* — row layout reworked per the
   proximity principle: the right-hand cluster is now `[category pill ▾][✓ confirm][✗ skip]`
   with the amount above it, so the actions visibly belong to the category being confirmed.
   The confidence dot + "% sure" stay in the left subtitle.

- `lib/bank/reviewQueue.ts` — `editReviewItem()` (fetch PENDING item → shared EDIT path).
- `app/api/unified-transactions/review-queue/route.ts` — POST `action: 'edit'` (single id +
  `values.categoryLevel1`).
- `components/bookkeeping/CategoryPickerSheet.tsx` — optional `onPickOverride` prop: bypasses
  the internal transaction PATCH so the same sheet serves queue items (§12.3 — one picker,
  no duplicate).
- `app/dashboard/activity/page.tsx` — QueueReviewRow layout per above; `queueEditItem` state +
  a second CategoryPickerSheet instance wired to the edit action; refreshes counts/list/
  celebration on success.

### Testing
- [x] tsc clean
- [x] 253/253 bookkeeping tests
- [x] Build passes

## Session: serene-goodall-6smazx — Phase 49.5.1 (review-row mobile reflow)

### Changes
Reza mobile screenshot 2026-06-11: in the review surface, descriptions truncated to
"V9110 3…" — the right-hand action cluster consumed the row width on ~390px screens.
`QueueReviewRow` reflows on mobile: line 1 = checkbox + icon + FULL-WIDTH description
(+ confidence subtitle) + amount; line 2 = the [category ▾][✓][✗] cluster right-aligned.
Desktop keeps the single-line amount-over-actions layout. Touch targets bumped to 32px on
mobile (w-8 h-8). Action cluster extracted to a single `actions` node used by both layouts
(§12.8 — no duplication).

### Testing
- [x] tsc clean
- [x] Build passes
