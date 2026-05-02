# Phase 39 — My Wealth premium redesign

> **Status:** In progress (Properties shipped). Investments + Assets queued.
> **Started:** 2026-05-01
> **Owner:** Reza (direction) + Claude (build)
> **Why this phase exists:** "My Wealth" is the heart of TRAIL Stage I (Invest) — where users see what they're building. The pages should feel premium, warm, and celebratory, not like a tax spreadsheet. Reza's brief: *"Apple glass-like tiles with interactive buttons, transitions and animations. Don't make it childish but cool, and engaging. Make sure you consider mobile view as well as most users will be using mobile."*

This phase brings the design language of the Home TRAIL banner (`components/dashboard/TrailStageIndicator.tsx` v3, PR #568/#570) and the My Accounts / My Budget pages (PRs #573/#574) to the three pages under My Wealth: Properties, Investments, Assets.

---

## 1. Brief

| Aspect | Direction |
|---|---|
| Tone | Wealth-building celebration, not financial anxiety. Greens for equity gains, sky/indigo for the Invest stage signal, warm amber only for genuine cautions. |
| Vibe | Apple product-page energy. Glassmorphic, restrained motion, premium typography. |
| Mobile | First-class. Most users are on mobile. 1-column stacked tiles, drawer-style detail panels, full-width primary buttons. |
| Accessibility | Full `prefers-reduced-motion` support — every animation collapses to instant or static. |

## 2. Design tokens (reused from `TrailStageIndicator` for visual coherence)

| Token | Value | Source |
|---|---|---|
| `appleEase` | `[0.25, 0.46, 0.45, 0.94]` | `components/dashboard/TrailStageIndicator.tsx` |
| `springy` | `{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }` | same |
| Stage I gradient | `from-sky-300 via-sky-500 to-indigo-600` | same `stages[3]` |
| Stage I glow | `rgba(14,165,233,…)` | same |
| Card radius | `rounded-[28px]` (hero) / `rounded-[22px]` (tile) | matches banner |
| Glass surface | `bg-card/70 backdrop-blur-xl` + 1px sky border | matches banner |
| Stage I status pill | `border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-300` | new (canonicalised here) |

No new dependencies introduced. `framer-motion` v12, `recharts` v3, `lucide-react`, `tailwindcss` v3.4, `tailwindcss-animate` are all already in `package.json`.

## 3. Page-by-page plan

### 3.1 `/dashboard/properties` — SHIPPED (this PR)

**New components introduced:**

| Component | Path | Purpose |
|---|---|---|
| `PropertiesHero` | `components/properties/PropertiesHero.tsx` | Glassmorphic hero summary. Total portfolio value, equity, loans, average LVR, allocation bar (Home / Investment / Rental). Sky/indigo atmospheric mesh gradient. Stage I status pill. |
| `PropertyTile` | `components/properties/PropertyTile.tsx` | Glassmorphic property tile. Type-aware (HOME / INVESTMENT / RENTAL branches). Hero `currentValue` with gradient gain pill, equity + LVR row with mini animated LVR bar, investment-only yield + cashflow row, linked-data pills, primary `View details` CTA gradient button. Stagger-on-load via `motion.div` index. |

**Wiring in `app/dashboard/properties/page.tsx`:**

- Hero summary card inserted after the `PageHeader`, before the `ListFilter`. Visible only when `properties.length > 0` and not loading.
- Tile rendering loop replaced with `<PropertyTile />` calls. Calculation helpers (`calculateGain`, `calculateLVR`, `calculateEquity`, `calculateRentalYield`, `calculateCashflow`) stay in the page and are passed in as `metrics`.
- `description` prop on `PageHeader` reworded from a stat-stuffed line to the warmer narrative line *"What you're building — your homes, investments, and rentals."* (the stats now live in the hero card).
- All other behaviour preserved: list view, dialogs, search/filter, edit, delete, address autocomplete, depreciation, expense dialogs, strategy tab.

**Accessibility:**

- `prefers-reduced-motion` collapses all motion (atmosphere mesh, breathing glow, stagger, hover-lift, LVR-bar fill). Tiles still render and are still fully interactive.
- All buttons are keyboard-focusable. Hover-revealed action cluster (edit / delete) also stays visible via `sm:flex` so it never disappears on no-hover devices.

**Mobile:**

- Hero stats grid collapses to 3-col on mobile (still legible at `text-lg`).
- Tile grid: 1 col by default, 2 col `md`, 3 col `xl`.
- Action cluster on tiles is hover-revealed on desktop but always present on mobile via `sm:flex`.

### 3.2 `/dashboard/investments/*` — QUEUED

Apply the same `WealthHero` + `WealthTile` patterns. Likely component shape:

- `InvestmentsHero` — total portfolio value + asset-class allocation pie (`recharts`) + cash balance.
- `InvestmentAccountTile` — type-coloured icon, total holdings + cash, account-level KPIs.
- `HoldingTile` — ticker / name, units / avg price / current value, allocation %, optional micro-sparkline (52-week price using framer-motion `pathLength`).

Transactions stays nested inside the holdings detail dialog; not promoted to a standalone page in this phase.

### 3.3 `/dashboard/assets` — QUEUED

- `AssetsHero` — total asset value + count by type + active-vs-sold split.
- `AssetTile` — type-coloured icon (Vehicle / Electronics / Furniture / etc.), purchase + current value, depreciation %, optional vehicle-specific readout (make/model/odometer).

## 4. Mobile view redesign & uplift

> **Status as of 2026-05-02:** PARKED. Two attempts (sticky-stack v1 PR #587, sticky-stack v2 PR #590) shipped to production and were rolled back. The desired UX is documented below in full so a future session can pick this up cleanly without re-explaining requirements from scratch.
>
> **Action when revisiting:** read this section in full, then choose a *different* implementation approach from the candidate list (§4.5). Do not re-attempt sticky-stack with `useScroll/useTransform` — the same browser-quirk + sticky-tracking issues will recur.

### 4.1 The brief (Reza, verbatim)

> *"Is it possible to change the design for the mobile to show a transition between tiles when I scroll down rather than one tile after another? So I want to feel the new tile overlays the current one like a transition instead of scroll down feel."*
>
> *"Most probably I would like the same effect for all other pages on mobile view, so keep the design in the plan, document it. If I like what I see for assets, I will ask you to replicate for all of the app. Start with subtle for now and we can tweak as we go."*
>
> *"The transitions should be very smooth and clean so it feels premium and modern."*

### 4.2 Desired UX (the target, in plain words)

When a user scrolls a vertical list of tiles on mobile:

1. The currently-visible tile pins to the top of the visible content area (just below the page header chrome).
2. As the user keeps scrolling, the *next* tile rises up from below and **overlays** the current one — like sliding a fresh card onto a stack.
3. Once the new tile fully covers the previous, the previous is hidden and the new tile takes the foreground role.
4. The receding tile gets a *subtle* depth cue (slight scale-down + slight opacity dim) so the user senses depth, not abruptness.
5. The whole thing must feel **premium, smooth, and modern** — Apple Wallet / iOS Stocks card-deck feel, not "fancy CSS demo."
6. Desktop (multi-column grid) is unaffected — only mobile (single-column) gets this behaviour.
7. `prefers-reduced-motion` collapses to plain scroll.

### 4.3 The right starting list of pages to apply it to

Once a working pattern is approved, these are the surfaces to apply it to **in order**:

| # | Surface | Component | Notes |
|---|---|---|---|
| 1 | `/dashboard/properties` | `PropertyTile` | Approval ground for the pattern |
| 2 | `/dashboard/investments/accounts` | `InvestmentAccountTile` (Phase 39.2) | Per-type palette + glyph already defined |
| 3 | `/dashboard/investments/holdings` | `HoldingTile` (Phase 39.2) | Same |
| 4 | `/dashboard/assets` | `AssetTile` (Phase 39.3) | Different palette family (warmer for tangible objects) |
| 5 | Phase 40 — app-wide replication | Balances, Budget, Safety Net, Reports/Vault, etc. | Pending approval across all of My Wealth |

### 4.4 What we tried & why it didn't work

#### Attempt 1 — sticky-stack v1 (PR #587, merged 2026-05-02)

Approach: each tile wrapped in `<motion.div className="sticky top-3 md:static">`, with `useScroll({ target })` + `useTransform` driving a scale (1 → 0.96) and opacity (1 → 0.7) dim on the tile being covered. `useIsMobile` hook gated the behaviour to mobile + non-reduced-motion.

What broke (Reza, on iPhone Safari):
- The first pinned tile was cut off at the top — the pinned position landed *behind* the dashboard's mobile header (`fixed top-0 z-40 h-14`, 56px) at `DashboardLayout.tsx:550`. `top-3` (12px) put the tile under the header.
- Tile contents from the receding tile bled through the rising tile because `bg-{color}-50/60` is translucent. The user saw two equity values, two LVR readings, two addresses overlapping on screen.
- Transitions felt jarring, not premium.

#### Attempt 2 — sticky-stack v2 (PR #590, merged 2026-05-02)

Three structural fixes layered on top of v1:
1. `top-16` (64px) to clear the mobile header.
2. Opaque tile bg on mobile (`bg-{color}-50`), translucent only on `md:+` (`md:bg-{color}-50/60`) — so stacked tiles cover each other cleanly.
3. Restructured into 3 nested layers (outer ref div for scroll tracking + middle sticky div with `useScroll → useSpring → useTransform`-driven scale/opacity + inner motion.div with the existing tile content), so `useScroll` could track scroll progress against the *outer non-sticky wrapper's* moving rect (the sticky inner element's rect freezes once pinned, which silently breaks `useScroll`).

What still broke (Reza, on iPhone Safari):
- "Mobile transitions work once and then it goes back to scroll." Likely cause: iOS Safari's URL-bar resize behaviour disturbs the sticky pin reference; once the URL bar collapses (on first scroll), the sticky-pinned offset is computed against a different viewport and breaks for subsequent tiles.
- "Still overlays and the previous tile is still visible." The opaque bg fix worked locally but apparently not in the user's actual production environment — possibly the `dark:md:bg-{color}-{shade}/{opacity}` Tailwind variant chain wasn't being correctly extracted by JIT, leaving the runtime bg as the translucent dark-mode variant.
- "Not sure if the effects are shown on my mobile." Production rendering diverged from local — a sign the implementation has fragile assumptions.

### 4.5 What to try next time (do NOT re-attempt sticky-stack)

`position: sticky` + scroll-driven transforms on iOS Safari has too many edge cases (URL-bar viewport resize, sticky bounding-rect freezing, transparent stacking, JIT class extraction) for a "premium feel" target. Pick one of these alternatives:

#### Candidate A — CSS scroll-driven animations (modern, ideal)

Use the modern CSS `animation-timeline: scroll()` / `view-timeline-name` properties. Each tile has a CSS animation tied to its own viewport entry/exit. No JS scroll listeners, no sticky positioning, no `useScroll` quirks.

- **Pros:** native, performant, no main-thread cost, no SSR pitfalls.
- **Cons:** Chromium 115+ and Safari 17+ only. Need a fallback for older browsers (could be plain scroll — acceptable given target audience is iOS + recent Android).
- **Risk:** low if browser support matches user base.

#### Candidate B — Snap scroll with full-viewport tiles

`scroll-snap-type: y mandatory` on the tile list container, `scroll-snap-align: start` on each tile, each tile sized to ~`100dvh` (or `90dvh` for a peek of the next). Each tile becomes a "page". Scrolling snaps to the next.

- **Pros:** native, predictable, well-supported, no JS.
- **Cons:** doesn't give the "overlay" feel — new tile slides in *below*, old slides up *above*. More like Stories / iPhone home screen than Wallet card-deck.
- **Risk:** Reza may say "this is just paged scroll, not what I wanted." Worth confirming with him before building.

#### Candidate C — Swipe deck (gesture-driven, framer-motion native)

Vertical swipe with framer-motion's `drag` prop. Each tile is absolutely positioned; only the top tile is interactive. Swipe up to throw it away (translateY off-screen + fade), reveal the next.

- **Pros:** very smooth, premium feel, full control over animation curve.
- **Cons:** swipe ≠ scroll; users instinctively scroll to navigate lists. Discoverability issue.
- **Risk:** medium — diverges from "scroll" mental model.

#### Candidate D — IntersectionObserver-driven overlay

Each tile uses `position: relative` (no sticky). An `IntersectionObserver` on each tile watches for when the *next* tile enters the viewport at the top. When triggered, the current tile gets a CSS class that animates a scale + opacity dim. Plus the next tile gets `position: fixed; top: <header>` for the duration it's "active."

- **Pros:** no sticky, full control over the moment of transition, no `useScroll` tracking issues.
- **Cons:** more code. Need careful state machine for "which tile is currently active" + cleanup on scroll back.
- **Risk:** medium — more state to manage.

#### Recommendation when revisiting

Try **Candidate A** first. If browser support is acceptable, it's the cleanest possible implementation. If not, **Candidate D** is the most flexible fallback. Avoid `position: sticky` on the tile element itself — every variation of that approach we tried has a quirk that surfaces on production iOS Safari.

### 4.6 Reusable building blocks already in the codebase

These survive the revert and can be used by whichever approach is chosen next:

- `hooks/useIsMobile.ts` — `matchMedia('(max-width: 767px)')`, SSR-safe. Drop-in for any tile component that needs to gate behaviour by viewport.
- `components/properties/PropertyTile.tsx` — clean, no sticky-stack code. Pattern is: `motion.div` with `whileHover`, atmosphere layer, hue layer, glyph layer, content. Easy to wrap in a different mobile-only behaviour later.
- `framer-motion` v12 + `useScroll` / `useSpring` / `useTransform` — these all work fine for *non-sticky* targets. They were the wrong tool for sticky-stacked elements specifically.

### 4.7 Files removed during the revert

- The mobile sticky-stack wrapper code in `PropertyTile.tsx` (the outer ref div, middle sticky motion.div, scroll-driven transforms, useSpring smoothing). Reverted to direct `motion.div` return.
- Translucent → opaque mobile bg switch on `bg-amber-50/60` etc. Reverted to plain translucent `/60` because there's no overlap problem when sticky-stack isn't active.
- The `useIsMobile` import from `PropertyTile.tsx` (the hook itself remains for future use).

The file is now back to "plain v4 visual treatment, no mobile-specific scroll behaviour."

## 5. Out of scope (explicitly)

- Dialogs for property/investment/asset detail views — they keep their current layout for now. A separate phase can redesign them once the page-level patterns are settled.
- Strategy tab visuals (`EntityStrategyTab` component).
- Linked-data panel (`LinkedDataPanel`) styling — still uses the existing GRDCS-aware component.
- New chart engine choice — sticking with `recharts` v3 (already installed) where charts are needed.

## 6. Acceptance criteria

- [x] Build green (`npm run build`)
- [x] Stage I palette consistent across hero + tile
- [x] All TRAIL_FRAMEWORK §2 emotional brief honoured (warm tone, no shame language)
- [x] `prefers-reduced-motion` honoured throughout
- [x] Mobile breakpoints verified (1 col → 2 col `md` → 3 col `xl`)
- [ ] Dark mode visually verified (sky borders, gradient text, mesh gradients all need a dark-mode pass — tile classes use `dark:` variants but production verification pending)
- [ ] Investments redesign shipped (queued — Phase 39.2)
- [ ] Assets redesign shipped (queued — Phase 39.3)
