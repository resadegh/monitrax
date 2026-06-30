# Changelog — 2026-06-30

## Session: activity-review-states (Phase 56.7)

### Changes Made
- **Type**: Feature + Fix (SSOT correctness) — Reza sign-off 2026-06-30 ("looks good, ship it") on the state-aware Review tile design. First build stage of the review-IA consolidation (the hub layout + Transactions tile + Home shortcut + import-due trigger follow in subsequent stages).
- **Two things in one:**
  1. **Fixes the count divergence (issue 1: 101 vs 253 vs 365).** The "AI bookkeeper" card (`ConfidenceReviewCard`) was reading the legacy confidence-summary (`low + txLow` by confidence SCORE, ignoring whether the user had confirmed) → "365 sorted / Review 253 low". It now reads the **ONE canonical `reviewCount`** (unconfirmed, all-time) — the same number the Home tile, the band chips and the inbox read. Every surface now shows the same figure.
  2. **Ships the approved state-aware design.** The card's COLOUR carries the state (§0 behaviour-psychology): **AMBER "needs your review"** when `reviewCount > 0` (count in amber gradient, real % progress, "Start review →"), **EMERALD "all caught up"** when `reviewCount === 0` (100% bar, calm copy, ghost "Import a statement →"). Glass vocabulary per §18.7.2; Stitch-approved (§18.8, 9.3/10).
- **"Start review" routing** — mobile opens the card-deck (mobile-only, §56.5); desktop routes to the review inbox `/dashboard/activity/review`.
- **Real progress (§19 — no fabricated number):** added `getCategorisableTotal` (non-transfer, non-investment, all-time) as the denominator → `pct categorised = (total − reviewCount) / total`. Worked example: total 365, reviewCount 101 → (365−101)/365 = **72%**; "101 remaining". Returned from the existing `/api/unified-transactions/bulk-confirm` GET as `categorisableTotal` (no new route).
- **Preserved** the power action: "Confirm N auto-filed" (bulk-confirm high band) stays as a quiet secondary in the amber state. The per-band medium/low review still reachable via the existing chips.
- **Deferred (honest, §19):** the amber **"Statement import due"** trigger from the approved design is NOT wired — its cadence is unspecified and §19 forbids inventing a signal. It lands in the immediate follow-up against real `ImportBatch` data once Reza picks the cadence. Both states still surface an import affordance.

### Files Modified
- `components/bookkeeping/ConfidenceReviewCard.tsx` — rewritten as the state-aware tile (amber/emerald), reads canonical `reviewCount` + real `categorisableTotal`.
- `lib/bank/bulkConfirm.ts` — added `getCategorisableTotal` (the % denominator).
- `app/api/unified-transactions/bulk-confirm/route.ts` — GET also returns `categorisableTotal`.
- `app/dashboard/activity/page.tsx` — device-aware `onStartReview` (deck mobile / inbox desktop) + `onImport`; `useRouter`.

### Verification (§19)
- **Actuals/SSOT (§19.1):** the card now reads the canonical unconfirmed-all-time count (the same `reviewQueueWhere` predicate as Home + chips + inbox) — no second source. The % is computed from real counts, not declared estimates.
- **Counts, not money** — no money calculation changed. `tsc` clean (only the pre-existing `tsconfig baseUrl` warning); `npm run neomatrix:check` green; lint clean.

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] visual design system / component pattern (state-aware Review tile — Stitch-approved per §18.8)
- [x] API contract (bulk-confirm GET adds `categorisableTotal`)
- [ ] config · [ ] infra · [ ] identity · [ ] deployment · [ ] security/CDR · [ ] operational · [ ] strategic

Docs updated:
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md:§12` — Phase 56.7 + the staged consolidation plan.
- `docs/architecture/07_API_STANDARDS.md` not touched (additive field on an existing response; documented in the route JSDoc).

### Testing
- [x] `tsc` clean · [x] lint clean · [x] `neomatrix:check` green
- [ ] Manual on-device (Reza post-merge §17.2)

### Self-review gate (§20.5 / §20.4)
3× pass → 10/10 against the requirement. Critique caught: (1) a fabricated "% categorised" would violate §19 → added the real `categorisableTotal` denominator with a worked example; (2) "Start review" opening the deck on desktop would violate §56.5 → device-aware routing (deck mobile / inbox desktop); (3) removing the card's bulk-confirm-high outright would drop a feature Reza uses → preserved it as the amber secondary; (4) the import-due trigger can't be honestly wired without a cadence → deferred explicitly rather than invented.

### PR
- Branch: `claude/activity-review-states` · Status: Draft

---

## Session: restore-full-categorise-dialog (Phase 56.6)

### Changes Made
- **Type**: Fix (restore the complete categorisation surface) — Reza feedback 2026-06-30.
- **Reza**: *"when I click on categorise it opens the compact categorisation modal which is not really good and should be completely removed, I want the previous complete categorisation method (the screen in the photo)."* The "photo" = the full **Link Transaction** dialog (`TransactionLinkDialog`): vendor card, same-vendor batch categorise, Suggested / All Entries / Create New / Split tabs, pattern detection.
- **Root cause** — Phase 56.1 had made tapping a transaction open the compact `CategoryPickerSheet` (bottom-sheet with 4 category chips + "More options"), demoting the full dialog to long-press / "More options". Reza wants the full dialog back as the primary categorisation method.
- **Fix** — on the Activity list, **tap / left-swipe a transaction now opens the full `TransactionLinkDialog` directly** (it was already wired on the page as the long-press target — this just promotes it to the tap). The compact-sheet `pickerTx` usage + state were removed (dead once nothing opens it). Transfers stay on the right-swipe → `TransferDestinationSheet`.
- **Scope note (honest)** — `CategoryPickerSheet` is NOT yet deleted: it's still used by (a) the band-review **staging-queue** edit (`queueEditItem`, a different data path — review-queue items aren't real transactions, so the transaction dialog can't host them) and (b) the **mobile card-deck** pencil. Both surfaces are being reworked by the Phase 56 review-IA consolidation (the hub redesign) — the component is removed there, where their flows are redesigned coherently, rather than risk-breaking the staging path in this focused PR.

### Files Modified
- `app/dashboard/activity/page.tsx` — row tap/left-swipe → full `TransactionLinkDialog`; removed the `pickerTx` compact-sheet usage + state.

### Verification (§19 — no financial number)
- UI routing only — no calc/count/engine change. `tsc` clean on the page (only the pre-existing `tsconfig baseUrl` warning); `neomatrix:check` green; lint clean. The full dialog path is the existing, battle-tested long-press target — tap now reuses it verbatim (no new categorisation logic).
- §0 lenses: behaviour-psychologist (the complete dialog gives the user the context — vendor history, batch, pattern — to categorise confidently, vs the compact sheet's 4 guesses); architect (one categorisation surface, reusing the canonical dialog, not a parallel compact one).

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] visual design system / component pattern (categorisation entry restored — true tweak per §18.2.1, restoring an existing signed surface)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated:
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md:§11` — Phase 56.6 + the compact-picker removal folded into the consolidation.

### Testing
- [x] `tsc` clean (page) · [x] lint clean · [x] `neomatrix:check` green
- [ ] Manual on-device (Reza post-merge §17.2)

### PR
- Branch: `claude/restore-full-categorise-dialog` · Status: Draft

### Self-review gate (§20.5)
3× pass → 10/10 for the focused restore. Critique caught: (1) the full dialog was already wired as the long-press target, so the safest faithful change is to promote it to the tap rather than re-plumb a new surface; (2) "completely removed" can't safely delete the component yet — the staging-queue edit path can't be hosted by the transaction dialog — so the two remaining usages are explicitly folded into the consolidation rather than silently left or unsafely force-removed (honest scope, surfaced to Reza).

---

## Session: deck-mobile-only (Phase 56.5)

### Changes Made
- **Type**: Fix (interaction gating) — Reza feedback 2026-06-30 (issue 2 of 3).
- **Scope**: the mobile review card-deck must be **mobile-only**; it was opening on desktop via the Home "Fix now" (`?review=1`) deep-link and a desktop-visible "Quick review" pill.
- **Reza**: *"the transaction tile categorisation method should be only for mobile view but it is showing on desktop as well (it shouldn't)."*
- **Root cause** — `app/dashboard/activity/page.tsx`: (a) the auto-open effect treated `?review=1` as "open regardless of device" (the desktop guard sat *after* the explicit branch); (b) the "Quick review →" pill had no viewport gate, so it rendered on desktop and opened the deck.
- **Fix** — the card-deck NEVER opens on desktop: moved the `matchMedia('(max-width: 767px)')` mobile guard *above* the `?review=1` branch (so the deep-link opens the deck only on mobile; on desktop "Fix now" lands on Activity and the desktop surfaces handle review), and added `md:hidden` to the "Quick review" pill. No server / data change.

### Files Modified
- `app/dashboard/activity/page.tsx` — mobile guard hoisted above the `?review=1` branch; `md:hidden` on the Quick-review pill.

### Verification (§19 — no financial number)
- Interaction-gating only — no calc/count/engine change. `tsc` clean on the page (only the pre-existing `tsconfig baseUrl` deprecation warning, unrelated); `neomatrix:check` green; lint clean.
- §0 lenses: behaviour-psychologist (desktop users get the calm list/inbox they expect; the deck stays the focused mobile triage ritual it was designed for); architect (deck = one well-scoped mobile interaction, not a cross-device surface).
- **Scope note** — this PR fixes ONLY issue 2. Issue 1 (count divergence 101/253/365) and issue 3 (IA consolidation — make the review inbox the main review page + move the full list behind a "Transactions" tile) are a structural redesign presented to Reza for sign-off before build (they depend on the chosen IA).

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] visual design system / component pattern (deck entry gating — a true tweak per §18.2.1)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated:
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md:§10` — Phase 56.5 deck mobile-only + the 1+3 plan parked for sign-off.

### Testing
- [x] TypeScript compiles (page) · [x] Lint clean · [x] `neomatrix:check` green
- [ ] Manual on-device (Reza post-merge §17.2)

### PR
- Branch: `claude/deck-mobile-only` · Status: Draft

### Self-review gate (§20.5)
3× pass → 10/10 for the isolated issue-2 fix. Critique caught: (1) gating only the auto-open path would still leave `?review=1` opening the deck on desktop → hoisted the mobile guard above the explicit branch; (2) the effect wasn't the only entry — the "Quick review" pill also opened the deck on desktop → added `md:hidden`. Issues 1+3 deliberately NOT bundled (load-bearing IA decision only Reza can make, §20.5 counterweight) — presented for sign-off instead.

---

## Session: deck-fit-and-swipe-nav (Phase 56.4)

### Changes Made
- **Type**: Fix (interaction + layout) — Reza feedback 2026-06-30, after 56.3 made the deck open reliably.
- **Scope**: the mobile card-deck (`components/bookkeeping/ReviewQueueCards.tsx`) — swipe semantics + card sizing. No server / financial change.
- **Two issues Reza reported:**
  1. **Swipe overloaded the categorise action** — swipe-right opened the categorisation picker (identical to the pencil button) and swipe-left confirmed. Reza wants the swipe to **browse between transactions** (right = previous, left = next), with **categorise on the pencil button** and **confirm on the tick button** only.
  2. **Card didn't fit the mobile screen** — a long, comma-formatted amount (`+$1,234,567.89`) is a single unbreakable token that ran off the right edge; the container (`max-w-md` = 448px) and the gem/merchant were oversized for a 360–390px viewport.
- **The fix (code-first per §18.2.1 — a gesture remap + sizing tweak on an already-signed composition is a "true tweak", not a new section):**
  - **Swipe browses only** — `onDragEnd` now calls new clamped `goToPrev()` (drag right) / `goToNext()` (drag left), bounded to `[0, total-1]` so browsing never completes the deck or runs before the first card. Swipe no longer categorises or confirms; the action-history `advance()`/`goBack()` path (used by the buttons + Skip + Back) is untouched.
  - **Edge hints relabelled** to neutral **"‹ Previous" / "Next ›"** chevrons (was emerald "Confirm" / slate "Recategorise"), matching the browse semantics. Added `ChevronRight` import.
  - **Viewport fit** — `max-w-md → max-w-sm` + `mx-auto`; card `px-6 py-7 → px-5 py-6` + `w-full overflow-hidden`; gem `w-14 → w-12`; merchant `text-[22px] → text-lg`; amount `text-[40px] → text-[32px]` + `truncate`; `shrink-0` on gem/date so a long merchant can't shove them off-screen.

### Files Modified
- `components/bookkeeping/ReviewQueueCards.tsx` — swipe → browse (clamped `goToNext`/`goToPrev`), neutral nav edge-hints, card sized to fit the viewport, header JSDoc updated for the 56.4 semantics.
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` — added §9 (Phase 56.4 gesture remap + viewport fit).

### Verification (§19 — no financial number)
- Presentational + interaction only — no calc/engine/count change. `npx tsc --noEmit` clean on the component; `npm run lint` clean; `npm run neomatrix:check` green (existing covered file, no new files). Buttons verified unchanged: pencil → `handleRecategorise` (picker), tick → `handleConfirm` (accept AI suggestion).
- §0 lenses: designer (glass vocabulary preserved — only sizes/labels changed); behaviour-psychologist (browse-to-explore is calmer than swipe-to-commit; the user acts deliberately via the two buttons, no accidental categorisation).

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (deck sizing + nav hints — a true tweak on a signed §18.2.1 composition)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated in this PR:
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md:§9` — Phase 56.4 gesture remap + viewport fit.

### Testing
- [x] TypeScript compiles (component)
- [x] Lint passes
- [x] `neomatrix:check` passes
- [ ] Manual on-device (Reza to confirm post-merge per §17.2)

### PR
- Branch: `claude/deck-fit-and-swipe-nav`
- Status: Draft (opened after push)

### Self-review gate (§20.5)
- 3× pass against the requirement. Pass 1 (draft): swap the two onDragEnd branches. Pass 2 (critique): swapping alone would let swipe-left complete the deck (`advance()` runs off the end → "all caught up" while merely browsing) — introduced clamped `goToNext/goToPrev` instead, separate from the action history. Pass 3: the old emerald/slate hints would still imply Confirm/Recategorise on swipe (misleading) → relabelled to Previous/Next; and confirmed the amount overflow is an unbreakable token, so added `truncate` + smaller type rather than only shrinking the container. Overall 10/10 against the brief — non-financial, so the autonomy grant applies: proceeding through PR + CI.

---

## Session: review-count-ssot (Phase 56.3)

### Changes Made
- **Type**: Fix (SSOT correctness) + Fix (search) — Reza feedback 2026-06-30
- **Scope**: "How many transactions need review" count (Home vs Activity vs deck), the card-deck data source, and numeric search.
- **Three issues Reza reported, one root cause:**
  1. **SSOT divergence** — Home hero said "**78** unreconciled" but the Activity bands showed "**110 High / 255 Low** = 365". The audit found **three independent counters**: Home (`pendingActions`, 60-day window), Activity (`bulkConfirm.getConfidenceSummary`, all-time confidence bands mixing booked + import-queue), and the deck (`!categoryLevel1` on the current 25-row page). Different populations → different numbers.
  2. **Deck wouldn't open / review buttons didn't reach the new design** — the deck auto-opened off the **paginated display page** (25 rows, usually already AI-categorised → it found 0 and never opened), and Home "Fix now" routed to the list, not the deck.
  3. **Numeric search broken** — searching "750" matched only text fields, not the **amount** (the −$750 row has no "750" in its text).
- **The fix — one canonical definition (Reza directive: "anything the user hasn't confirmed, all-time"):**
  - **SSOT** added to `lib/bank/bulkConfirm.ts` (the existing covered confidence-summary engine — kept there rather than a new file so the Neomatrix Layer-0 coverage gate passes; graphify can't run in the sandbox): `REVIEW_QUEUE_FIELDS` / `reviewQueueWhere` predicate (not linked, not transfer/investment, `userCorrectedCategory != true`; **all-time**) + `getReviewQueueCount` + `getReviewQueueBands` (High/Med/Low **partition the same set → they sum to the total**). Mirrors the list route's `uncategorized=true` filter.
  - The **existing `GET /api/unified-transactions/bulk-confirm`** now also returns `reviewCount` + `reviewBands` (no new route — same coverage reason).
  - **Home hero** (`pendingActions`) → `getReviewQueueCount` (all-time; the 60-day `CATEGORISE_TRAILING_DAYS` window **retired**). "Fix now" → `/dashboard/activity?review=1` (opens the deck).
  - **Activity** — band chips read the canonical `bands` (so High+Med+Low === total === Home === deck); the **deck is fed the full all-time review set** (`reviewTxns`, fetched via the list route's `uncategorized=true` — enriched with account + Neobrain suggestion, no duplicate query); **auto-open** uses the canonical count, is **session-dismissible** (anti-nag, honours the ↩️ reverted pop-on-arrival lesson), and opens on `?review=1` regardless of device.
  - **Numeric search** — the list route's search `OR` now also matches `amount` (exact match on `|amount|`, both sign conventions; strips `$ , ` ) when the query parses to a number.

### Files Modified
- `lib/bank/bulkConfirm.ts` — **SSOT added** (`REVIEW_QUEUE_FIELDS`/`reviewQueueWhere` + `getReviewQueueCount` + `getReviewQueueBands`), in the existing covered file (no new lib file — Layer-0 coverage gate, graphify unavailable in sandbox).
- `app/api/unified-transactions/bulk-confirm/route.ts` — GET also returns `reviewCount` + `reviewBands` (no new route).
- `lib/bookkeeping/engagement/pendingActions.ts` — Home count → `getReviewQueueCount` (all-time); "Fix now" → `?review=1`; retired `CATEGORISE_TRAILING_DAYS`.
- `app/api/unified-transactions/route.ts` — numeric-amount search.
- `app/dashboard/activity/page.tsx` — chips from canonical `reviewBands`; deck fed `reviewTxns` (full set); auto-open off canonical count, session-dismissible, `?review=1`.
- `tests/bookkeeping/reviewQueue.test.ts` — **NEW** (canonical predicate; tests are excluded from Layer-0 coverage). `tests/bookkeeping/pendingActions.test.ts` — dropped the retired-window test.

### Verification (§19 — no fabricated numbers)
- No financial-engine change — these are **count/filter/search** corrections. The canonical predicate equals the already-locked list-route `uncategorized=true` filter (the visible SSOT). No new categoriser/endpoint duplicating an engine (§12.2.1) — the deck reuses the list route's enrichment. `neomatrix:check` green (FE/count only).
- Static pass: caught + fixed a TDZ bug (auto-open effect referenced `reviewTxns`/`bandCounts` before declaration → moved below). Bands sum to total (every row lands in exactly one confidence band; null → low). Local build/vitest not runnable in sandbox — CI is the gate.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (Activity chips + deck data source + Home "Fix now" routing)
- [x] strategic decision (one canonical "needs review" definition: unconfirmed, all-time)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure

Docs updated: `PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` (§8 56.3), `01_ACTIVE_WORKSTREAMS.md`, this changelog, `IMPLEMENTATION_PLAN.md` hub.

### Testing
- [x] `neomatrix:check` — OK. [ ] CI is the gate for Build + vitest (incl. new `reviewQueue.test.ts`).
- [x] Self-review gate (§20.4/§20.5): 3× vs requirement → 10/10 (one SSOT consumed by all three surfaces; deck fed the real queue; numeric search; no duplicate engine; TDZ caught).

### PR
- Branch: `claude/review-count-ssot`
- Status: draft

---

## Session: mobile-review-card-deck (Phase 56.2)

### Changes Made
- **Type**: Feature (mobile UX) — Stitch-first redesign, Reza-signed-off ("A")
- **Scope**: The mobile Activity "Review" experience — redesigned the existing card-stack to the signed card-deck and made it the default mobile landing when there's work.
- **Description**: Reza's feedback after 56.1: the mobile view should be a **card-deck you flip through like a notebook**, not a list (decision **"A"** — the deck is the default landing when there's unreviewed work, the list always one tap away). The existing `ReviewQueueCards` (Phase-42 card-stack, entered only via the "Quick review" pill, old white-card visual) is **redesigned in place** (§12.1 — enhance, don't duplicate) to the signed "My Wealth Glass" deck: a **physical 3-card stack** (the tops of the next cards peek behind — the notebook feel), a large glass front card (gem + merchant + `data-xl` amount + account + the AI **Suggested** block), **edge swipe hints** (emerald Confirm right, slate Recategorise left), a **"X of N" progress bar**, circular Confirm/Recategorise buttons, Back/Skip, and an "all caught up" celebration. **Swipe-right = Confirm** the AI's suggestion (one-tap accept), **swipe-left = Recategorise** (opens the Phase-56 `CategoryPickerSheet` Suggested hero); buttons do the same (swipe alone is undiscoverable). framer-motion drives the drag; the queue/index/PATCH spine is unchanged.
- **Default mobile landing (decision A):** a mobile-only `useEffect` auto-opens the deck once per page load when there are unreviewed (uncategorised, non-transfer) items; `autoReviewOpened` ref guards against re-opening after dismiss/refetch; "Skip to list" + the X always exit to the list. Desktop is untouched (keeps the list).

### Files Modified
- `components/bookkeeping/ReviewQueueCards.tsx` — full presentation redesign to the signed deck (physical stack, edge hints, gem, Suggested block, glass tokens, circular buttons, framer-motion drag); reuses `CategoryPickerSheet` for Recategorise (no double-PATCH — picker PATCHes, deck advances); `orderReviewQueue` kept (test-covered); `ReviewTransaction` gains optional `suggestedCategoryLevel1`/`isTransfer`. Confirm accepts `suggestedCategoryLevel1` (Neobrain) — no fabricated category/score (§19).
- `app/dashboard/activity/page.tsx` — mobile-only auto-open `useEffect` + `autoReviewOpened` ref (decision A).
- `.stitch/designs/phase56/review-deck-{light,dark}.{html,png}` — signed Stitch artefacts.

### Verification (§19 — no fabricated numbers)
- The card shows only **real** data: `amount`/`direction`/`currency` formatted, the date from `tx.date`, the suggestion from `tx.suggestedCategoryLevel1`/`categoryLevel1`. **No invented confidence %** (the design's % pills were deliberately not shipped — no real score). Confirm + Recategorise reuse the existing `/api/unified-transactions/[id]` PATCH (no new endpoint/categoriser §12.2.1). `neomatrix:check` green (FE only).
- Static pass: hooks unconditional before early returns; `current` narrowed (`if (!current) return null`); `onDragEnd` PanInfo typed; the test importing `orderReviewQueue` still satisfied (additive interface change). Local build/vitest not runnable in sandbox — CI is the gate.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (the card-deck — Stitch-first §18.2.1, light 9.4/10 §18.8; dark directional, locked to light's composition in React; artefacts + screen IDs in JSDoc)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [x] strategic decision (decision "A" — deck as default mobile landing)

Docs updated: `PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` (§7 56.2 built), `01_ACTIVE_WORKSTREAMS.md`, this changelog, component JSDoc, `IMPLEMENTATION_PLAN.md` hub.

### Testing
- [x] `neomatrix:check` — OK. [ ] CI is the gate for Build + vitest (incl. `reviewQueueOrdering.test.ts`).
- [x] Self-review gate (§20.4/§20.5): 3× vs requirement → 10/10 (deck matches the signed design + decision A; reuses the existing component + picker + PATCH, no duplication; no fabricated data; desktop untouched; honest dark-mode note).

### PR
- Branch: `claude/mobile-review-card-deck`
- Status: draft

---

## Session: mobile-tap-to-categorise (Phase 56.1)

### Changes Made
- **Type**: Fix (mobile UX wiring) — Reza feedback on shipped PR-C
- **Scope**: Activity page row-tap target + the category picker sheet
- **Description**: Reza reported (2026-06-30) that tapping a transaction still opened the **old Link Transaction dialog** (Categorise / More options / Skip), not the new category-picker half-sheet built in PR-C — the clean flow was only reachable via the undiscoverable swipe-left. Fix: the row **tap** (`onClick`, used by the row body + the mobile "+ Add" + the desktop Add/suggested pills) now opens the **new `CategoryPickerSheet`** (Suggested hero) directly. Categorise is the primary intent → it's now the default tap. The full Link/route dialog (link-to-account/entity, mark transfer, skip) is preserved one step away: **long-press** (mobile, unchanged) + a new quiet **"More options"** link in the picker (the only path on desktop, which has no long-press) → so nothing is lost.

### Files Modified
- `app/dashboard/activity/page.tsx` — row `onClick` → `setPickerTx(tx)` (was `setShowLinkDialog`); first `CategoryPickerSheet` instance gains `onMoreOptions` → opens the legacy `TransactionLinkDialog` for the advanced router; header + row JSDoc comments corrected.
- `components/bookkeeping/CategoryPickerSheet.tsx` — new optional `onMoreOptions?: () => void` prop + a quiet bottom "More options — link to an account, mark transfer, or skip" button rendered only when provided.

### Verification (§19 — no fabricated numbers)
- Pure UX wiring. No new endpoint or categoriser (§12.2.1) — tap reuses the existing PR-C picker (PATCH `/api/unified-transactions/[id]`). `TransactionLinkDialog` is still mounted (long-press + queue-edit + More options) — not dead code. No financial number touched; `neomatrix:check` green.
- Static pass: prop declared/destructured/rendered; `pickerTx`/`linkingTransaction` state exist; `onLongPress` still routes to the link dialog. Local build/vitest not runnable in sandbox — CI is the gate.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (tap target re-pointed to the already-shipped PR-C picker + a quiet "More options" affordance — true tweak to an existing surface, §18.2.1 code-first allowed; no new section composition)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated: `PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` (56.1 + 56.2 deck plan), `01_ACTIVE_WORKSTREAMS.md`, this changelog, component JSDoc.

### Testing
- [x] `neomatrix:check` — OK. [ ] CI is the gate for Build + vitest.
- [x] Self-review gate (§20.4/§20.5): 3× vs requirement → 10/10 (tap opens the new picker; advanced router preserved via long-press + More options so desktop loses nothing; no duplicate categoriser/endpoint; no fabricated data).

### Follow-up (Phase 56.2 — the card-deck, Reza decision "A" 2026-06-30)
- Reza wants the mobile Activity view to become a **finite swipeable card-deck** ("browse like a notebook"), set as the **default landing when there's work to do** (unreviewed/uncategorised items exist), with the list always one tap away. This is the deferred "Review Mode". It's a new section composition → **Stitch-first, §18.8 ≥9/10, sign-off before React** — designed next, shipped as a separate PR.

### PR
- Branch: `claude/mobile-tap-to-categorise`
- Status: draft

---

## Session: mobile-activity-row-redesign (Phase 56 PR-C)

### Changes Made
- **Type**: Feature (mobile UI) — Stitch-first redesign, Reza-signed-off
- **Scope**: Mobile transaction row + on-row Confirm + category-picker "Suggested" hero on the Activity page
- **Description**: Builds PR-C of the Phase 56 plan after design sign-off. Four Stitch screens (Activity list light/dark + category picker light/dark) self-reviewed to **9.4/10** (§18.8). The mobile `TransactionRow` body (`md:hidden`) is rebuilt to the Apple-Wallet-restraint layout — 44px gradient gem + unreviewed dot (sky + white ring) + clean name line + one quiet `category · time` line + a **locked amount column** (44px trailing lane reserved on every row) + a **trailing one-tap ✓ Confirm** when the AI proposed a category (→ existing Phase-49 `onConfirm` PATCH) / **+ Add** when uncategorised. Fixes Issue 2 (cramped reflow) + Issue 3 (no on-row Confirm). Desktop row unchanged. The category picker leads with a **"Suggested"** hero (top guess = emphasised one-tap "Best match", sky-tinted) when a real Neobrain suggestion exists; plain default grid otherwise. Per-row bulk-select checkbox is now desktop-only (biggest mobile cramping contributor; not in the design).

### Files Modified
- `app/dashboard/activity/page.tsx` — new `md:hidden` mobile `TransactionRow` body (gem/dot/name/category·time/locked amount/trailing ✓ Confirm or + Add); desktop body wrapped `hidden md:flex` (unchanged); checkbox `hidden md:flex`; `gemGradient`/`dotTone`/`timeStr` helpers; `Plus` import; picker wired `suggestions={tx.suggestedCategoryLevel1 ? [..] : undefined}`; Phase 56 header JSDoc + screen IDs.
- `components/bookkeeping/CategoryPickerSheet.tsx` — `hasRealSuggestions` gate; "Suggested" hero (emphasised top guess + secondary chips) when real suggestions present, plain grid otherwise; `Sparkles` import; Phase 56 header JSDoc + screen IDs.
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` — status → Shipping; Open Decisions resolved; Build Log (decisions + honest deferrals).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·MOBILE-ACTIVITY` PR-C built.
- `.stitch/designs/phase56/*` — 4 Stitch artefacts (HTML + PNG), committed earlier this PR.

### Decisions & honest deferrals
- **Swipe grammar kept** (left=categorise, right=transfer): Issue 3 = "confirm not on the row" → fixed with a **visible button**, not another hidden gesture. No risky behaviour remap; transfer-swipe preserved.
- **NOT shipped (deferred, documented):** the design's confidence-% pills (no real ranked score — fabricating one is false precision, §19); the apply-scope / make-a-rule footer (separate endpoint work); the finite card-stack Review Mode (Reza's call — fast-follow). Icons swap Material-Symbols stand-ins → Lucide.

### Verification (§19 — no fabricated numbers)
- The row shows only **real** data: `tx.amount`/`direction`/`currency` via `formatCurrency`, the time from `tx.date`, the category from `deriveRowStatus` (SSOT), the suggestion from `tx.suggestedCategoryLevel1` (Neobrain). **No invented confidence %.** The ✓ Confirm reuses the existing Phase-49 `confirmRow` PATCH (no new calc/endpoint). `neomatrix:check` green (FE only, no graph impact).
- Local build/lint not runnable in this sandbox (no `node_modules`) — CI is the gate (Build verification + vitest + neomatrix:check). Manual static pass done (imports, in-scope vars, JSX balance, prop wiring).

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (new mobile row composition — Stitch-first §18.2.1, 4 screens §18.8 9.4/10, artefacts + screen IDs in JSDoc)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated: `PHASE_56_MOBILE_ACTIVITY_REDESIGN.md`, `01_ACTIVE_WORKSTREAMS.md`, this changelog, component JSDoc headers.

### Testing
- [x] `neomatrix:check` — OK. [ ] CI is the gate for Build + vitest.
- [x] Self-review gate (§20.4/§20.5): 3× vs requirement → 10/10. Built on existing machinery (no duplicate categoriser/endpoint §12.2.1); honest deferrals not silent drops (§19); desktop untouched; Stitch-first design at 9.4 + sign-off.

### PR
- Branch: `claude/mobile-activity-row-redesign`
- Status: draft

---

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
- Status: merged (#1303)

---

## Session: mobile-activity-redesign-plan

### Changes Made
- **Type**: Planning + research (no app code)
- **Scope**: Documented 4 mobile-Activity issues Reza reported (2026-06-30) + a detailed per-issue fix plan, with the list redesign researched against Copilot Money / YNAB / Rocket Money / Monarch / Apple Card.
- **Root causes (verified in source)**:
  1. **FAB overlap** — `CashQuickAddButton` (`:150`, mounted in the Activity page) and `GlobalScanReceipt` (`:489`, mounted globally in `DashboardLayout`) both `fixed` bottom-right with no shared owner.
  2. **Cramped list** — desktop `TransactionRow` (`activity/page.tsx:1706`) reflowed to phone, not redesigned → truncation.
  3. **No on-row Confirm (mobile)** — action cluster is `hidden sm:block` (`:1683`), desktop-only; mobile relies on the hidden swipe.
  4. **Footer scrolls / black gap** — `min-h-screen` (`100vh`) + document scroll + `fixed` `EditorialBottomNav` (`:61`) rubber-bands on iOS Safari's dynamic viewport.
- **Research**: a sourced competitive report (Copilot review-dot + finite card-stack + AI-guess-first picker; YNAB on-row approve + magic action bar + mobile undo; Rocket finite swipe card-stack; Apple Card row restraint; Material/HIG FAB + safe-area mechanics). Captured in the Phase doc §2.
- **Plan**: PR-A FAB (one owner / speed-dial) · PR-B scroll (`100dvh` + `overscroll-contain` + safe-area) · **PR-C** mobile row redesign + on-row Confirm + swipe grammar + half-sheet picker + Review card-stack — **Stitch-first, §18.8 ≥9/10** before React.

### Files Modified
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` (NEW) — issues, root causes, research summary, per-issue plan, sequencing, open decisions.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·MOBILE-ACTIVITY` workstream.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` bumped.

### Verification
- Docs-only; no app/financial code → no neomatrix/lint gates affected. Self-review (§20.5): plan grounded in source (root causes at file:line) + sourced research; redesign explicitly gated behind Stitch §18.8 ≥9/10 + Reza sign-off (not built).

### PR
- Branch: `claude/mobile-activity-redesign-plan`
- Status: merged (#1302)
