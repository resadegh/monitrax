# PHASE 56 — Mobile Activity / Reconciliation Redesign

**Monitrax Blueprint — Phase 56**
**Status:** 🟢 Shipping — PR-A + PR-B merged-ready (#1303); PR-C (row redesign + on-row Confirm + picker hero) built, Reza design sign-off 2026-06-30.
**Created:** 2026-06-30
**Owner:** Reza (direction + design sign-off) + Claude (research + build)
**Trigger:** Reza report 2026-06-30 with mobile screenshots — four issues on the Activity page mobile view.

> This doc is the **plan + root-cause record**. Per CLAUDE.md §18.2.1 the list/row redesign (Issue 2) is **Stitch-first** and must pass the §18.8 **≥9/10** self-review before any React is written. Issues 1, 3, 4 are smaller fixes that can ship independently and sooner.

---

## 0. The four reported issues (verbatim intent)

1. **FAB overlap** — the green **+** and the blue **camera** floating buttons overlap on mobile.
2. **Cramped, truncated list** — the mobile transaction list is "a bit cramped and small with most of the data truncated." Wants a **redesigned mobile view** for the transaction list + reconciliation — *simpler, cleaner, mobile-native* — researched against **Copilot Money** and other leading apps. UI-only → **Stitch + self design review > 9/10**.
3. **No Confirm on the mobile row** — the one-tap Confirm available on desktop rows is missing on mobile.
4. **Footer scrolls / black gap** — scrolling up drags the whole page including the bottom nav, revealing empty black space.

---

## 1. Root-cause analysis (verified in source)

### Issue 1 — FAB overlap
**Two independent floating buttons, positioned by different components that don't know about each other:**

| Button | Component | Mount point | Positioning |
|---|---|---|---|
| Green **+** (cash quick-add) | `components/bookkeeping/CashQuickAddButton.tsx:150` | the Activity page (`app/dashboard/activity/page.tsx:1060`) | `fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-[35]` |
| Blue **camera** (scan receipt) | `components/documents/GlobalScanReceipt.tsx:489` | **global**, in `DashboardLayout.tsx:444` | `md:hidden fixed right-4 z-40`, `style bottom: calc(4rem + env(safe-area-inset-bottom) + 0.75rem)` |

Both anchor to the bottom-right on mobile with no shared stack → the 14×14 circles collide. **Root cause: no single FAB owner; two free-floating buttons in the same corner.** (Material guidance: don't float multiple bottom-anchored controls in the same region — [m2.material.io/components/bottom-navigation](https://m2.material.io/components/bottom-navigation).)

### Issue 2 — cramped / truncated list
The mobile list is the **same desktop `TransactionRow` shrunk to a phone** (`app/dashboard/activity/page.tsx:1706`). Long merchants truncate ("Renew Group Ato …", "Payto Pearler Investments 07 11am…", "Cumberland Co…"); the row crams merchant + account + category pill + amount; the action cluster is hidden (see Issue 3). **Root cause: no mobile-specific row; a desktop table row reflowed, not redesigned.** This is the §18 Stitch-first redesign.

### Issue 3 — no Confirm on the mobile row
The row's action cluster is wrapped in **`hidden sm:block`** (`app/dashboard/activity/page.tsx:1683` — `<div className="hidden sm:block shrink-0">{actionRow}</div>`), so the Confirm button (`:1640`) is **desktop-only by design**. Mobile was meant to rely on **swipe** (left = categorise, right = transfer; hint at `:1053`) — undiscoverable, and not what the user wants. **Root cause: Confirm intentionally desktop-only; mobile has only the hidden swipe.**

### Issue 4 — footer scrolls / black gap
The app uses **document-level scrolling**: `DashboardLayout` is `flex min-h-screen` with `<main class="flex-1 px-4 pb-24 …">` (no scroll container), and `EditorialBottomNav` is `fixed inset-x-0 bottom-0 z-30 md:hidden` (`components/editorial/shell/EditorialBottomNav.tsx:61`) using `height: calc(64px + env(safe-area-inset-bottom))` and `min-h-screen` = `100vh`. On iOS Safari this combination **rubber-bands**: during overscroll and the dynamic-toolbar collapse, a `position:fixed` element visually detaches and the dark page background shows below the content. **Root cause: `100vh`/`min-h-screen` + document scroll + `position:fixed` nav on iOS Safari's dynamic viewport.** (Defensive fix is `100dvh` + `overscroll-behavior` + safe-area insets — [samuelkraft.com/blog/safari-15-bottom-tab-bars-web](https://samuelkraft.com/blog/safari-15-bottom-tab-bars-web).)

---

## 2. Competitive research summary (Copilot Money + leading apps)

Full sourced report in the session changelog. The load-bearing patterns to adopt:

- **Copilot Money** — review-status is a **first-class, app-wide property**: a small **light-blue "unreviewed" dot** on every pending row (everywhere in the app), a **"To Review" section** with one-tap **"Mark as reviewed"** (incl. bulk), and the category picker **pre-surfaces the top-2 AI guesses** so the common case is one tap. "Apply to similar / make a rule" is offered **inline at the moment of recategorising** (future + past).
- **YNAB** — the reconciliation reference: **swipe-right-to-Approve on the row**, a **circled-"i" approve icon directly on the row** (one-tap, opens nothing), a **"[N] new transactions" banner** into batch review, a **contextual multi-select action bar** (Approve / Reject / Categorize / Flag), and **mobile undo** (shipped because review actions feel risky without it).
- **Rocket Money** — a **finite card-stack review** ("Tinder for transactions"): N recent transactions one card at a time, **swipe-right = accept the AI category**, **swipe-left = reassign**, re-arms after ~10. Finite + finishable = a small-win ritual (behaviour-psychology).
- **Apple Card / Wallet** — **row restraint**: merchant **logo** + clean name + **right-aligned tabular amount** + a **colour dot** for category. No heavy per-row pills. **Depth lives in the detail sheet, not the row.**
- **Native mechanics** — category picker as a **half-sheet bottom sheet** (medium/large detents) that keeps the list visible behind it; bottom nav **`position:fixed` + `env(safe-area-inset-bottom)`**; **don't** float a FAB over the fixed nav (Material) — dock/inset it or move the action into a sheet.

Sources: Copilot/Monarch/YNAB/Rocket help centres, Apple HIG, Material — see changelog.

---

## 3. Detailed fix plan (per issue)

### PR-A — Issue 1 (FAB overlap) · small · ships first
- Introduce **one FAB owner**: a single bottom-right action. Two options for Reza:
  - **(rec) Speed-dial**: one `+` FAB that expands to **Add cash** + **Scan receipt** (camera moves inside it). Removes the second floating button entirely — matches Material "single add entry → sheet".
  - **Minimal**: keep both but stack them vertically in **one shared container** (camera above `+`, fixed gap), both safe-area-inset, so they never overlap.
- Anchor with `bottom: calc(<navHeight> + env(safe-area-inset-bottom) + gap)` so the cluster always clears the fixed nav + home indicator.
- **No new visual section** → §18.2.1 true tweak (code-first OK). Stitch only if we adopt the speed-dial visual.

### PR-B — Issue 4 (scroll/footer) · small · ships first
- Switch the dashboard shell to a **contained scroll area**: `<main>` becomes the scroller with `flex-1 min-h-0 overflow-y-auto overscroll-y-contain`, the outer wrapper `h-[100dvh]` (not `min-h-screen`/`100vh`), nav pinned as the last flex child (or kept `fixed` but with `100dvh` + `env(safe-area-inset-bottom)` + a matching page background so no black bleed).
- Keep `pb-[calc(navHeight + env(safe-area-inset-bottom))]` on the scroll content so the last row never hides behind the nav.
- Verify on iOS Safari (in-browser **and** PWA) against the dynamic toolbar. Pure CSS/layout; no Stitch.

### PR-C — Issue 2 + Issue 3 (the redesign) · Stitch-first · ships after design sign-off
This is the main piece. **Issue 3 (on-row Confirm) is folded in** because it's part of the new row.

**Design (Stitch-first, ≥9/10 gate, §18.8):** produce a 4-variant matrix (mobile light/dark; the desktop row is unchanged) for:

1. **New mobile transaction row (Apple-Card restraint):**
   - leading **44px merchant logo / category-coloured monogram** + a small **unreviewed dot** (Copilot) when not yet reviewed;
   - **one** primary line: clean merchant name + **right-aligned `tabular-nums` amount** (emerald only for income, §18.7.2);
   - **one** secondary line only: a quiet **category label + colour dot · time** (no heavy pill);
   - a **trailing one-tap ✓ Confirm** shown **only while unreviewed** (YNAB circled-approve) — fixes Issue 3;
   - sticky date-group headers.
2. **Swipe grammar (consistent app-wide):** swipe-right = **Confirm/reviewed** (haptic + emerald flash), swipe-left = **Recategorise** (opens the picker sheet), full-left = **Exclude/transfer**. Every commit **undoable via a 4s snackbar**.
3. **Category picker = half-sheet** (medium/large detents) with **top-2 AI guesses first** (one tap = done), sticky search, recents, full list, and an **"Apply to… just this / all 'Merchant' / rule (future+past)"** footer at decision time.
4. **Review Mode = finite card-stack:** a **"Review (N)"** banner → one card per txn (big logo, merchant, amount, AI category prominent), swipe-right confirm / swipe-left reassign, a **"3 of 12" progress** bar, an **"all caught up ✓"** end-state, and a **"Confirm all suggested"** bulk shortcut (all undoable).

**Build (after sign-off):** new `MobileTransactionRow` + `CategoryPickerSheet` (extend the existing one) + `ReviewCardStack`; the desktop `TransactionRow` stays as-is (render the mobile variant under the `sm` breakpoint). Reuse the §18.7.2 glass tokens; this is in-app design-system, not cosmos.

> **Honest dependency:** the one-tap Confirm + the AI-guess-first picker are only as good as the **suggestion** behind them — and many rows currently have **no** best-guess (the 3-categoriser fragmentation flagged earlier). The redesign surfaces whatever guess exists today; making *every* row carry a confident guess is the **"consolidate the 3 categorisers into one"** follow-up (tracked separately). The redesign and that consolidation compound.

---

## 4. Sequencing

| PR | Scope | Stitch? | Risk | Order |
|---|---|---|---|---|
| **A** | FAB overlap (one owner / speed-dial) | only if speed-dial visual | low | now |
| **B** | Scroll container + dvh + overscroll-contain + fixed nav | no | low-med (cross-device test) | now |
| **C** | Mobile row redesign + on-row Confirm + swipe grammar + picker half-sheet + Review card-stack | **YES (≥9/10)** | med | after design sign-off |

A and B are independent quick wins. C is the design-led redesign and absorbs Issue 3.

## 5. Open decisions for Reza — RESOLVED (2026-06-30)
1. **FAB** → **keep-both-stacked** (PR-A shipped #1303): the `+` now stacks above the camera FAB. Full speed-dial deferred (a new visual; revisit if Reza wants it).
2. **Review Mode** → **start with on-row Confirm + swipe**; finite **card-stack** is the fast-follow (not in PR-C).
3. **Scope of C** → **row + on-row Confirm + a focused picker hero** now; full picker (confidence pills + apply-scope footer) deferred (see Build Log).

---

## 6. Build Log

### PR-A + PR-B — #1303 (merged-ready 2026-06-30)
FAB stack (`CashQuickAddButton`) + iOS scroll (`min-h-[100dvh]` + `overscroll-behavior-y: contain` on the shell + `body`). Pure FE/CSS. PR-B wants Reza on-device iOS verification.

### PR-C — mobile row redesign + on-row Confirm + picker hero (this PR)
Design: 4 Stitch screens (Activity list light/dark + category picker light/dark), §18.8 self-review **9.4/10**, Reza sign-off 2026-06-30. Artefacts at `.stitch/designs/phase56/`.

**Built (verified in source against the live page — most machinery already existed: `useSwipeGesture`, `CategoryPickerSheet`, `deriveRowStatus`, the glass grouped list):**
- **Mobile `TransactionRow` body** (`md:hidden`, `app/dashboard/activity/page.tsx`): 44px gradient gem + unreviewed dot (sky + white ring, `!rowStatus.done`) + clean name line + one quiet `category · time` line + **locked amount column** (44px trailing lane reserved on every row) + **trailing one-tap ✓ Confirm** when `state==='suggested'` (→ `onConfirm`, the existing Phase-49 PATCH) / **+ Add** when `needs-category` (→ opens dialog). Fixes **Issue 2** (cramped reflow) + **Issue 3** (no on-row Confirm). Desktop body unchanged (`hidden md:flex`).
- **Per-row bulk-select checkbox** is now desktop-only (`hidden md:flex`) — it was the biggest mobile cramping contributor and isn't in the signed design. Mobile bulk-select returns later via a long-press selection mode (fast-follow).
- **Category picker hero** (`CategoryPickerSheet`): when the caller passes a real (merchant-mapping) suggestion, the sheet leads with a **"Suggested"** section — the top guess is the emphasised one-tap **"Best match"** (sky-tinted), the rest are quieter chips. Wired from `tx.suggestedCategoryLevel1` (Neobrain). Absent → the plain default grid (no fabricated suggestion).

**Decisions (4-lens):**
- **Swipe grammar kept as-is** (left = Categorise picker, right = Transfer). Issue 3 was literally *"the confirm button is not available on the transaction row"* — the fix is a **visible on-row ✓ button**, not another hidden gesture (undiscoverable gestures were the complaint). The design's swipe-right-confirm intent is realised more strongly + discoverably as the explicit button; transfer-swipe is preserved (no behaviour remap, lower risk).

**Honest deferrals (documented, not silently dropped):**
- **Confidence % pills** ("92% / 74%") shown in the Stitch design are **NOT shipped** — the sheet has no real ranked-confidence score, and inventing a percentage is false precision (§19, §0 financial-adviser lens). They ship when the categorisation engine surfaces real ranked candidates with scores.
- **"Apply to … / make a rule" footer** (apply-scope segmented control) — a separate feature needing its own endpoint params (apply-to-all-merchant; the always-rule path already exists via double-tap). Fast-follow.
- **Finite card-stack Review Mode** — per Reza's decision (#2 above), fast-follow.
- **Icons**: the Stitch artefacts use Material Symbols as stand-ins; the React build uses the app's Lucide set (1.5px) per §18.7.2.

---

## 6. Phase 56.1 — tap-to-categorise (post-PR-C feedback, 2026-06-30)

Reza tested the shipped PR-C and reported two things: (a) the row looks better but the view is still a **list**, and (b) **tapping** a transaction still opened the **old Link Transaction dialog**, not the new picker — the clean flow was only reachable via the undiscoverable swipe-left.

**Fixed (56.1, this PR — code-first, a true tweak to an already-shipped surface §18.2.1):**
- Row **tap** (`onClick` — row body + mobile "+ Add" + desktop Add/suggested pills) now opens the **new `CategoryPickerSheet`** directly. Categorise is the primary intent, so it's the default tap.
- The full Link/route dialog (link-to-account/entity, mark transfer, skip) is preserved one step away: **long-press** (mobile, unchanged) + a new quiet **"More options"** link inside the picker (the only path on desktop — no long-press there). Nothing is lost; `TransactionLinkDialog` stays mounted.

## 7. Phase 56.2 — the card-deck "Review" view (Reza decision "A", 2026-06-30)

Reza clarified the original "tiles, not a long list" intent: he wants a **finite swipeable card-deck** — one transaction per card, flip through like a notebook (Apple Wallet / Rocket-Money triage). Decision **"A"**: the deck is the **default landing for the Activity tab _when there's work to do_** (unreviewed/uncategorised items exist) — open Activity → flip cards → swipe-right confirms the AI category, swipe-left/tap opens the picker, "all caught up ✓" drops into the existing list. When nothing's to review, Activity opens to the (cleaner) list. The **list stays the permanent scan/search view, one tap away** — the deck *adds*, it never replaces (a deck-only browse kills scannability — behaviour + architect lenses).

This is the deferred **Review Mode**, now promoted to the primary mobile experience. It's a **new section composition → Stitch-first, §18.8 ≥9/10, Reza sign-off before any React** (§18.2.1 STRICT).

**Built (56.2, signed off "looks good, ship it"):** the existing `ReviewQueueCards` (Phase-42 card-stack, old white-card visual, entered only via the "Quick review" pill) is **redesigned in place** (§12.1) to the signed deck:
- **Physical 3-card stack** (the next cards' tops peek behind — the "notebook" feel), a large glass front card (gem + merchant + `data-xl` amount + account + the AI **Suggested** block), **edge swipe hints** (emerald Confirm right / slate Recategorise left), a **"X of N" progress bar**, circular Confirm/Recategorise buttons, Back/Skip, and an "all caught up" celebration. framer-motion drives the drag; the queue/index/PATCH spine is unchanged.
- **Swipe-right = Confirm** the AI suggestion (one-tap accept `suggestedCategoryLevel1`); **swipe-left / Recategorise = the Phase-56 `CategoryPickerSheet`** (Suggested hero). No double-PATCH — the picker PATCHes, the deck advances. No fabricated confidence % (§19).
- **Default mobile landing (decision A):** a mobile-only `useEffect` auto-opens the deck once per load when there are unreviewed (uncategorised, non-transfer) items (`autoReviewOpened` ref guards re-open); "Skip to list" + X always exit to the list. Desktop untouched.
- **Stitch:** light `0c621478890b437587d68b0a146158da` (9.4/10) canonical; dark `e0d2f869f1dc4e98a73002d66be650a7` directional (Stitch drifted the dark twin's composition — in React the dark is a token-flip of the same JSX, so it matches the light). Artefacts `.stitch/designs/phase56/review-deck-{light,dark}.{html,png}`.

Honest dependency: the swipe-right magic is only as good as the per-card AI suggestion → compounds with the "consolidate the 3 categorisers" debt.

---

## 8. Phase 56.3 — review-count SSOT + reliable deck + numeric search (Reza feedback, 2026-06-30)

After 56.2 shipped, Reza reported the deck didn't appear (even after a clean reload) and that **the Home hero said "78 unreconciled" while Activity showed 110/255 = 365** — "another SSOT issue" — plus numeric search ("750") didn't match amounts. An audit found the root cause: **three independent counters** for "needs review" (Home `pendingActions` 60-day window · Activity `bulkConfirm` all-time confidence bands incl. import-queue · the deck's `!categoryLevel1` on the paginated page), and the deck auto-opening off the **25-row display page** (usually already categorised → it found 0 and never opened).

**Fixed (56.3), per Reza directive "anything the user hasn't confirmed, all-time":**
- **One SSOT** in `lib/bank/bulkConfirm.ts` (kept in the existing covered file, not a new one, so the Neomatrix Layer-0 coverage gate passes — graphify can't run in the sandbox): `reviewQueueWhere` (not linked, not transfer/investment, `userCorrectedCategory != true`, all-time) + `getReviewQueueCount` + `getReviewQueueBands` (High/Med/Low **partition the same set → sum to total**). Mirrors the list route's `uncategorized=true` filter.
- The existing **`GET /api/unified-transactions/bulk-confirm`** now also returns `reviewCount` + `reviewBands` (no new route). Home hero, Activity chips, and the deck all read this one number.
- **Home "Fix now"** → `/dashboard/activity?review=1` (opens the deck). The 60-day `CATEGORISE_TRAILING_DAYS` window is **retired**.
- **The deck is fed the full all-time review set** (`reviewTxns`, via the list route — enriched, no duplicate query) so it opens reliably with the real queue. Auto-open is **session-dismissible** (anti-nag, honours the ↩️ reverted pop-on-arrival lesson) and opens on `?review=1` on any device.
- **Numeric search** — the list route now also matches `amount` when the query is a number.

*Phase 56 v1.2 — PR-A/B (#1303) + PR-C (#1304) + 56.1 tap (#1305) + 56.2 card-deck (#1306) + 56.3 SSOT (#1307) shipped.*

## 9. Phase 56.4 — deck gesture remap + viewport fit (Reza feedback, 2026-06-30)

After 56.3 made the deck open reliably, Reza flagged two interaction/layout issues on his device:

> *"2 issues 1. the size doesn't fit the mobile screen 2. swipe right is opening the categorisation page (same as clicking on the pencil icon), I want the swipe right and left to navigate between transactions rather than opening categorisation page. Categorisation should be done via pencil and confirmation via tick button."*

**Root cause (verified in source):**
- **Gesture conflict** — `onDragEnd` mapped *swipe-right → Confirm* and *swipe-left → Recategorise* (opens the picker). So a swipe and the pencil button did the same thing, and the gesture overloaded the action it should only *browse*. The buttons (pencil = recategorise, tick = confirm) were already correct — the swipe was the problem.
- **Overflow** — the card amount used `text-[40px]` with no `truncate`; a long, comma-formatted value like `+$1,234,567.89` is a single unbreakable token that ran off the right edge. The container was `max-w-md` (448px) and the gem/merchant were oversized for a 360–390px viewport.

**Fixed (56.4) — code-first per §18.2.1 (a gesture remap + sizing tweak on an already-signed composition is a "true tweak", not a new section):**
- **Swipe now BROWSES only** — drag right → previous card, drag left → next card, clamped to `[0, total-1]` (browsing never completes the deck or runs before the first card). New `goToNext()` / `goToPrev()` helpers, separate from the action-history `advance()`/`goBack()`. Swipe no longer categorises or confirms.
- **Categorise = pencil button** (`handleRecategorise` → picker), **Confirm = tick button** (`handleConfirm` → accept the AI suggestion) — unchanged, now the *only* way to act.
- **Edge hints relabelled** — the emerald "Confirm" / slate "Recategorise" swipe hints are now neutral **"‹ Previous" / "Next ›"** chevrons matching the browse semantics.
- **Viewport fit** — container `max-w-md → max-w-sm` + `mx-auto`; card `px-6 py-7 → px-5 py-6` + `w-full overflow-hidden`; gem `w-14 → w-12`; merchant `text-[22px] → text-lg`; amount `text-[40px] → text-[32px]` + `truncate`; `shrink-0` on the date/gem so a long merchant can't shove them off-screen.

*Phase 56 v1.3 — 56.4 deck gesture remap + viewport fit shipped.*

## 10. Phase 56.5 — deck mobile-only + the review-IA consolidation plan (Reza feedback, 2026-06-30)

Reza reported three issues from desktop, with the meta-observation that *"the process is confusing and also multiple places to do activities related to transactions."*

> *"1. next action tile on dashboard shows 101 uncategorised but the AI bookkeeper shows review 253 low and then the low filter on the list also shows 101 (confusing and SSOT divergence). 2. the transaction tile categorisation method should be only for mobile view but it is showing on desktop as well. 3. there is another page for reviewing through the AI bookkeeping tile ('Open review inbox') — this should be the main review page and the main transaction list currently on the activity page should be accessed through a tile called 'Transactions' (to simplify the activity page)."*

### 10.1 The verified current state (audit, file:line)

Four overlapping review surfaces + three different "needs review" counts:

| Surface | File | Count source | Number |
|---|---|---|---|
| Home "Next actions" tile | `lib/bookkeeping/engagement/pendingActions.ts:115` | `getReviewQueueCount` (canonical, all-time) | **101** |
| Activity band chips | `app/dashboard/activity/page.tsx:345-379` | `getReviewQueueBands` (canonical, partitions the same set) | High·0 / Med·0 / **Low·101** |
| Review-inbox page header | `components/bookkeeping/ReviewCategoriesInbox.tsx` | canonical count | **101** |
| **AI-bookkeeper hero card** | `components/bookkeeping/ConfidenceReviewCard.tsx:109-118` | `getConfidenceSummary` (`low + txLow`, by confidence SCORE, ignoring whether the user already confirmed) | **365 sorted / Review 253 low** ← the diverging one |

Review/categorise can happen in **four** places: the AI-bookkeeper hero band actions, the full inline transaction list (per-row Confirm/picker), the card-deck (`ReviewQueueCards`), and the dedicated `/dashboard/activity/review` inbox (`ReviewCategoriesInbox`).

### 10.2 Issue 2 — FIXED this PR (56.5, isolated, code-first)

The card-deck is now **mobile-only**: the `matchMedia('(max-width: 767px)')` guard was hoisted *above* the `?review=1` branch (so the Home "Fix now" deep-link opens the deck only on mobile — on desktop it lands on Activity), and the desktop-visible "Quick review" pill got `md:hidden`. The deck never opens on desktop.

### 10.3 Issues 1 + 3 — the consolidation (PARKED for Reza sign-off — load-bearing IA)

Root cause of all three symptoms is **IA fragmentation**: review work is scattered, and the hero card counts by confidence-score (`txLow`) instead of the canonical "unconfirmed" predicate. The proposed end-state (to be designed Stitch-first per §18.2.1 once the shape is signed off):

- **One review surface = the inbox.** Promote `/dashboard/activity/review` (the `ReviewCategoriesInbox`) to THE review destination. On mobile that surface launches the card-deck; on desktop it's the calm two-section list. Everything that needs a category is cleared here, against the **one canonical count (101)**.
- **Activity → "Transactions".** The full filterable/searchable ledger (the bulk of today's `activity/page.tsx`) moves behind a clearly-named **Transactions** tile/tab — for browsing & editing history, not the primary review CTA.
- **Kill the count conflation.** The AI-bookkeeper card's review numbers (and anything that says "Review N low") read the canonical `getReviewQueueBands` so every surface shows the same number. "Sorted / auto-filed" stays only as a clearly-separated lifetime stat, never mixed into the review pile.
- **The fork for Reza:** does Activity become (a) a hub landing with two tiles — "Review (N to categorise)" + "Transactions (browse all)" — or (b) two peer sub-tabs under My Accounts — "Review" | "Transactions"? Recommendation: **(a) hub**, because it gives the review CTA primacy (behaviour lens) while keeping the ledger one tap away.

- **The fork for Reza:** ✅ **DECIDED 2026-06-30 — (a) hub landing with two tiles** ("Review — N to categorise" primary + "Transactions — browse all" secondary). Stitch design in progress (project 1859462351962811110, screen 51b4df2c024f4014a6efe2f38884149e); presented for design sign-off before React.
- **Categorisation method = the full Link Transaction dialog** (decided 2026-06-30, shipped in part as 56.6 below). The compact `CategoryPickerSheet` is retired — the consolidation removes its two remaining usages (band-review staging edit + the mobile deck pencil) as those surfaces are reworked.

## 11. Phase 56.6 — restore the full categorisation dialog (Reza feedback, 2026-06-30)

> *"when I click on categorise it opens the compact categorisation modal which is not really good and should be completely removed, I want the previous complete categorisation method (the screen in the photo)."*

The "photo" = the full **`TransactionLinkDialog`** (Phase 51 v3): vendor card, same-vendor batch categorise, Suggested / All Entries / Create New / Split, pattern detection. Phase 56.1 had demoted it — tapping a row opened the compact `CategoryPickerSheet` (4 chips + "More options") instead.

**Fixed (56.6) — code-first per §18.2.1 (restoring an already-signed surface, not a new composition):** on the Activity list, **tap / left-swipe a transaction now opens the full `TransactionLinkDialog` directly** (it was already the long-press target — this promotes it to the tap). The compact-sheet `pickerTx` usage + state were removed.

**Honest scope:** `CategoryPickerSheet` is not yet deleted — it still backs (a) the band-review **staging-queue** edit (`queueEditItem`; review-queue items aren't transactions, so the dialog can't host them) and (b) the **mobile card-deck** pencil. Both are removed by the consolidation (§10.3) where their flows are redesigned — not force-removed here at the risk of breaking the staging path.

*Phase 56 v1.5 — 56.5 deck mobile-only + 56.6 full-dialog restore shipped.*

## 12. Phase 56.7 — state-aware Review tile + canonical count (Reza sign-off 2026-06-30)

Reza approved the hub IA (hub + 2 tiles) AND a **state-aware Review tile** whose COLOUR carries the state, then said *"looks good, ship it."* Stitch design sign-off: §18.8 9.0 (hub) + 9.3 (state sheet); project 1859462351962811110, screens `f2a90f88dfe04d1a8b8aca2f277994dd` (hub) / `75395671e5264c83911c4c0d2531a741` (state sheet); artefacts `.stitch/designs/phase56/`.

**The state rule (Reza's brief):** the tile feels like **action is required** when (1) transactions need review OR (2) a statement/QIF import is due; and feels **green/OK** when up to date. The Home shortcut tile follows the same rule and routes to the hub.

**Shipped in STAGE 1 (this PR — `ConfidenceReviewCard` rewrite):**
- **Canonical count** — the card reads the ONE `reviewCount` (unconfirmed, all-time), killing the "365 sorted / 253 low" divergence (issue 1). Every surface now shows the same number.
- **AMBER "needs your review"** (reviewCount > 0): count in amber→orange gradient, real `% categorised` (denominator `getCategorisableTotal`, §19 — worked example 365/101 → 72%), "Start review →" (mobile deck / desktop inbox), "Confirm N auto-filed" secondary.
- **EMERALD "all caught up"** (reviewCount === 0): 100% bar, calm copy, ghost "Import a statement →".

**The staged remainder (subsequent PRs, each shippable):**
- **56.8** — Activity **hub layout**: KPI strip + the Review tile + the **Transactions** tile (full list moves behind it). The structural route change.
- **56.9** — **Home shortcut tile** adopts the same two states + routes to the hub.
- **56.10** — **import-due trigger** (the amber "Statement import due" pill) wired to real `ImportBatch` data once Reza confirms the cadence (deferred from 56.7 — §19 forbids inventing the signal).
- **56.11** — finish removing `CategoryPickerSheet` (band-review staging edit + deck pencil) as those flows are reworked.
- Each stage ships dark + mobile variants per §18.7.2.

*Phase 56 v1.6 — 56.7 state-aware Review tile + canonical count shipped.*

## 13. Phase 56.8 — Activity hub layout + one-list Review (Reza 2026-06-30)

Reza, after seeing 56.7 live: *"continue with the build, I still see the transaction list on the activity page, and another view of the transaction list when I click on start review … I am not sure if I want a new view for review or just the same transaction list filtered on the uncategorised … keep the search bar, category pill, confidence colour hue but change it to a cleaner design"* — and (next turn) *"make sure you don't break the working functionalities of the list."*

**Decisions locked (Reza, 4-lens advisory):**
- **Review (desktop) = the ONE transaction list filtered to uncategorised** (his Option B). The separate "Review categories" inbox is **retired** — it was a second, separately-designed list that drifted (the 69% vs 54% "% categorised" split). One list = one design = one source (§12.2.1). Mobile keeps the card-deck.
- **List redesign = cleaner refresh** (keep search + confidence-hue category pills + inline categorise; modernise to My-Wealth glass). Deferred to a careful follow-up — NOT bundled with the structural change, per "don't break the list".
- **Import-due cadence = no import in 30 days** (for 56.10).

**Shipped this PR (56.8 — structural, NON-BREAKING):**
- Activity landing is a clean **hub**: KPI snapshot + state-aware Review tile + a **Transactions** tile. The full list lives behind the Transactions tile (`view === 'list'`).
- Desktop "Start review" + Home "Fix now" (`?review=1`) → the **same list filtered to uncategorised**. `/dashboard/activity/review` retired (redirects to the canonical surface). The 69/54% split is gone.
- The list, `TransactionRow`, search, confidence-hue chips, advanced filters, `QueueReviewList`, pagination, FAB, bulk toolbar and modals are **untouched** — only visibility is gated by `view`. Every prior entry point (Transactions tile · KPI clicks · Start review · `?review=1` · `?filter=` · mobile deck) opens the list.

**The staged remainder:** 56.8b cleaner-refresh rows (Stitch-backfill — the preview generator was flaking, so it's verified live on the Vercel preview per §18.2.1 backfill) · 56.9 Home shortcut states · 56.10 import-due (30-day) · 56.11 delete the orphaned `ReviewCategoriesInbox`.

*Phase 56 v1.7 — **56.8 hub layout + one-list Review this PR** (list untouched, gated). Governed by §12.2.1 (one list/source), §18.2.1 (cleaner-refresh deferred + live-verified), §20.5, §0 (architect: retire the duplicate; psychology: clean hub + familiar list).*
