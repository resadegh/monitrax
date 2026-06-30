# PHASE 56 — Mobile Activity / Reconciliation Redesign

**Monitrax Blueprint — Phase 56**
**Status:** 🟡 Planning (documented issues + plan; redesign is Stitch-first, not yet built)
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

## 5. Open decisions for Reza
1. **FAB**: speed-dial (one `+` → Add cash / Scan) *(rec)* or keep-both-stacked?
2. **Review Mode**: build the finite **card-stack** review now, or start with just the **on-row Confirm + swipe** and add the card-stack later?
3. **Scope of C**: row + on-row Confirm only first, or the full row + picker-sheet + card-stack together?

---

*Phase 56 v0.1 — planning + root-cause record. Governed by CLAUDE.md §18 (Stitch-first + §18.8 ≥9/10), §18.7.2 (in-app glass vocabulary), §0 (four lenses), §15 (this is a registered workstream). No React written yet — design sign-off gates the build of PR-C.*
