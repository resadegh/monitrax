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

## 4. Mobile sticky-stack scroll pattern

> **Status as of 39.1d (mock):** prototyped on Properties only via PR #58? for visual review. Pattern queued for app-wide replication once Reza approves (see IMPLEMENTATION_PLAN queued items).

### Brief from Reza (2026-05-02)

> *"Is it possible to change the design for the mobile to show a transition between tiles when I scroll down rather than one tile after another? So I want to feel the new tile overlays the current one like a transition instead of scroll down feel."*

Apple Wallet card-deck feel — as the user scrolls down a list of tiles on mobile, each tile pins to the top and the next tile rises up and **overlays** it (instead of pushing it off-screen in a flat list). The receding tile gets a subtle scale + opacity dim to give a depth/parallax cue.

### Implementation

| Layer | What |
|---|---|
| **Positioning** | `position: sticky; top: 12px` on each tile on mobile. `md:static md:top-auto` reverts to normal flow on desktop where the grid layout takes over. |
| **Stack order** | Default DOM stack order is sufficient — later siblings naturally render above earlier ones. No `z-index` needed. |
| **Scroll-driven dim** | Each tile uses `framer-motion` `useScroll({ target: ref, offset: ['start start', 'end start'] })`. Two `useTransform` calls produce `scale` (`1 → 0.96`) and `opacity` (`1 → 0.7`) as the next tile rises to cover this one. |
| **Mobile detection** | `hooks/useIsMobile.ts` — `matchMedia('(max-width: 767px)')`, SSR-safe (returns `false` on first render, updates on hydrate). |
| **Reduced motion** | Pattern fully disabled when `prefers-reduced-motion: reduce` — falls back to standard scroll, no transforms. |
| **Variant** | **Subtle** by default — pairs well with v4 atmosphere/hue treatment. **Dramatic** variant (`scale 0.92 / opacity 0.5`) is one-line tweak if a more cinematic Apple-iOS-product-page feel is wanted later. |

### Where this pattern should be replicated next

App-wide, queued behind Reza's approval of the Properties mock. Concretely:

| Surface | Owner |
|---|---|
| `/dashboard/properties` (PropertyTile) | Phase 39.1d (this mock) |
| `/dashboard/investments/accounts` (InvestmentAccountTile — TBD) | Phase 39.2 |
| `/dashboard/investments/holdings` (HoldingTile — TBD) | Phase 39.2 |
| `/dashboard/assets` (AssetTile — TBD) | Phase 39.3 |
| All other tile-list pages app-wide (Balances, Budget, Safety Net, Reports, etc.) | Phase 40+ — queued pending Reza's reaction across My Wealth |

### Reusable hook

`hooks/useIsMobile.ts` is intentionally generic so any future tile component can opt in by adding a `motion.div` wrapper with the same `useScroll` + `useTransform` pattern. The wrapper pattern (separating sticky+scroll from the inner tile content) keeps the existing tile's hover/animation/layout props untouched — drop-in.

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
