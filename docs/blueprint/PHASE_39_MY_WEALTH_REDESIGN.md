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

### 3.2 `/dashboard/investments/*` — SHIPPED (Phase 39.2)

**New components introduced:**

| Component | Path | Purpose |
|---|---|---|
| `InvestmentsHero` | `components/investments/InvestmentsHero.tsx` | Shared glassmorphic hero summary used by both pages. Stage I sky/indigo atmosphere; gradient-text total; up to 3 KPI cells; optional allocation segment bar with colour-coded type legend; slow-breathing soft glow. Honours `prefers-reduced-motion`. |
| `InvestmentAccountTile` | `components/investments/InvestmentAccountTile.tsx` | Per-type tile for investment accounts. Five Stage-I-family palettes: BROKERAGE (sky/cyan), SUPERS (indigo/violet), FUND (blue/sky), TRUST (violet/purple), ETF_CRYPTO (cyan/teal). Hero `totalValue`, holdings/cash split, linked transactions/income/expenses pills, gradient `View details` CTA. |
| `HoldingTile` | `components/investments/HoldingTile.tsx` | Per-type tile for individual holdings. Four palettes: SHARE (sky/blue), ETF (violet/sky), MANAGED_FUND (indigo/blue), CRYPTO (warm amber/orange — "digital gold"). Hero `currentValue` with allocation % gradient pill, units + avg price KPI row, franking pill if applicable. |

**Glyph library expansion:** `components/wealth/wealthGlyphs.tsx` got 9 new filled silhouette glyphs + 2 resolvers (`AccountGlyph`, `HoldingGlyph`). Same design rules as the property glyphs (single closed silhouettes, fill="currentColor", viewBox 0 0 120 120, no negative-space tricks).

| Account glyph | Composition |
|---|---|
| BROKERAGE | three-bar candlestick skeleton (rising sequence) |
| SUPERS | classical column / pillar |
| FUND | three layered waves |
| TRUST | shield silhouette |
| ETF_CRYPTO | hexagonal lattice |

| Holding glyph | Composition |
|---|---|
| SHARE | single dominant candlestick on a baseline |
| ETF | diamond lattice (4 diamonds in a 2×2 grid) |
| MANAGED_FUND | braided rope (three twisting filled lines) |
| CRYPTO | single large hexagon (universal blockchain symbol) |

**Wiring in `app/dashboard/investments/accounts/page.tsx`:**

- Hero card inserted after `PageHeader` (visible only when `accounts.length > 0` and not loading).
- Tile rendering loop replaced with `<InvestmentAccountTile />` calls.
- New computed values fed to hero: `totalCash`, `totalHoldingsValue`, `totalHoldingsCount`, `heroSegments` (allocation by account type).
- `PageHeader` description reworded from stat-stuffed line to warm narrative *"Where your money is invested — brokerage, super, funds, and more."*
- Tile grid: `md:grid-cols-2 xl:grid-cols-3` (was `md:grid-cols-2 lg:grid-cols-3`).

**Wiring in `app/dashboard/investments/holdings/page.tsx`:**

- Hero card inserted after `PageHeader` with allocation-by-asset-class segment bar.
- Tile rendering loop replaced with `<HoldingTile />` calls.
- New computed values fed to hero: `holdingsSegments`, `distinctAccounts`.
- `PageHeader` description reworded to *"What you own — every share, ETF, fund, and coin in your portfolio."*
- Tile grid: `md:grid-cols-2 xl:grid-cols-3`.

**Untouched (intentional scope cap):**

- All dialogs (Add/Edit Account, Add/Edit Holding, Detail view tabs).
- List view (table behind the `viewMode` toggle on accounts page).
- Calculation helpers (`calculateTotalValue`, `calculateAllocation`, etc.) — used as before; results passed in as tile props.
- All data fetching, search/filter, account-holding linkage, transactions sub-table.

**Transactions:** stays nested inside the holdings detail dialog; not promoted to a standalone page in this phase.

### 3.3 `/dashboard/assets` — SHIPPED (Phase 39.3)

**New components introduced:**

| Component | Path | Purpose |
|---|---|---|
| `AssetsHero` | `components/assets/AssetsHero.tsx` | Glassmorphic hero summary. Stage I (Invest) but **warm sub-palette** (amber + rose + peach mesh, orange-amber breathing glow) — assets are tangible objects, not financial growth. Total value (gradient text), active/sold split subtitle, KPI cells (purchase cost, annual costs, active count), allocation segment bar with type colour codes. |
| `AssetTile` | `components/assets/AssetTile.tsx` | Per-type tile with **six warm sub-palettes** within Stage I: VEHICLE amber/orange, ELECTRONICS rose/pink, FURNITURE stone/amber, EQUIPMENT slate/zinc, COLLECTIBLE fuchsia/violet, OTHER orange/amber. Hero `currentValue` with depreciation pill (rose for loss, emerald for gain), depreciation $ + annual cost KPI row, vehicle subtitle (Make Model Year) when applicable, status pill (Sold / Written off) for inactive assets, tile dimmed to 75% opacity when inactive. |

**Glyph library expansion:** `components/wealth/wealthGlyphs.tsx` got 6 new filled silhouette glyphs + an `AssetGlyph` resolver:

| Glyph | Composition |
|---|---|
| VEHICLE | car silhouette (body + sloped roof + two wheels + ground line) |
| ELECTRONICS | laptop silhouette (screen + base wedge) |
| FURNITURE | sofa silhouette (back + seat + arms + legs) |
| EQUIPMENT | wrench silhouette (single closed path) |
| COLLECTIBLE | cut-diamond silhouette (crown + tapered pavilion) |
| OTHER | generic package / box silhouette |

Same design rules as the rest of `wealthGlyphs` (filled paths, fill="currentColor", viewBox 0 0 120 120, no decorative micro-details).

**Wiring in `app/dashboard/assets/page.tsx`:**

- 4-card summary block (Total Assets / Total Value / Vehicles / Other Assets) replaced with a single `<AssetsHero />` — fewer surfaces, more visual impact.
- `renderAssetCard` (the inline tile renderer) replaced with `<AssetTile />` calls. The original function remains in the file but is now unused for the tile view (still referenced by list view; kept for now to minimise diff surface).
- Hero segments computed from `summary.byType` per-type counts and values.
- New aggregates: `totalPurchaseCost`, `totalAnnualCosts` (passed as KPI cells).
- `PageHeader` description reworded from *"Track your personal assets, vehicles, and their costs"* to *"What you own — vehicles, electronics, furniture, and more."*
- Tile grid: `md:grid-cols-2 xl:grid-cols-3` (was `md:grid-cols-2 lg:grid-cols-3`).

**Status handling:**

ACTIVE / SOLD / WRITTEN_OFF assets all render as tiles. Inactive (sold/written-off) tiles get an explicit status pill (next to the type label) and a 75% opacity wrapper so they read as "no longer current" without being rejected from the layout.

**Untouched (intentional scope cap):**

- All dialogs (Add/Edit Asset, Detail view tabs).
- List view (table rendered via `renderListView()` behind the `viewMode` toggle).
- Asset expense templates (the per-type expense quick-pick UI in the dialog).
- Calculation helpers (`asset._computed`) — used as before; results passed in as tile props.
- Filter / search (`ListFilter` with `assetFilterConfigs`).

### 3.4 `/dashboard/investments/super` — SHIPPED (Phase 39.4)

**Brief:** everyday (retail/industry) superannuation had no post-onboarding home. It was only capturable in the onboarding wizard (`SuperStep`) and shown read-only on the Tax page (My Guide → Tax, Super tab). SMSF, by contrast, gets the full Entities UI. Phase 39.4 closes that gap with a first-class My Wealth surface, designed Stitch-first (CLAUDE.md §18) before any React.

**Stitch:** project `5991501424852019479` · desktop screen `1c01d0c1e990458899afbf2f68d5a615` · mobile screen `e7a87730d34844ab8c170c9d86fc01b9`. Artifacts committed at `.stitch/designs/super-wealth-{desktop,mobile}.{html,png}`. Prompts seeded with the §18.7.2 My Wealth glass principles.

**New components introduced:**

| Component | Path | Purpose |
|---|---|---|
| `SuperAccountTile` | `components/wealth/SuperAccountTile.tsx` | Stage I glass tile for a single fund. Mirrors `InvestmentAccountTile` with the fixed **indigo→violet Super sub-palette**: 3px top strip, atmosphere mesh, oversized `SuperFilledGlyph` (classical column) watermark bleeding off the right edge, gradient icon badge + "SUPER FUND" label, fund-name headline + nickname subtitle, neutral `tabular-nums` balance, Tax-free / Taxable KPI mini-grid, emerald 1-yr gain pill (positive only; amber if negative), option + member-ID ghost pills, gradient CTA. |
| `SuperCapMeter` | `components/wealth/SuperCapMeter.tsx` | **Canonical** concessional + non-concessional contribution-cap meter pair (CLAUDE.md §12.2 SSOT). Rounded-full sky→indigo / indigo→violet fills; amber→rose only when a cap is exceeded; `tabular-nums`; reduced-motion safe; optional `showHelp` for the glossary tooltips. Renders the meters only — each surface supplies its own card chrome. **Consumed by both** the Super page (glass card) and the Tax page (shadcn Card) — the Tax page's previously-inlined meter markup was deleted and now imports this. |

**Hero reuse (no new hero):** `InvestmentsHero` is reused directly — total = `summary.totalBalance`, KPIs = Total balance / Tax-free / Concessional used %, allocation segments = per-fund balances (Stage I family cycle). Fewer surfaces, less code (§12.1).

**Data flow (no new aggregation, §12.2/§12.4):** the page reads the existing `GET /api/tax/super` (summary, caps, accounts, optimisation) and writes via `POST /api/tax/super` + `PUT/DELETE /api/tax/super/[id]`. The `PUT` was extended from the original three wizard fields (name/fundName/currentBalance) to the full editable set (member#, ABN, tax components, investment option) — ownership-guarded single-row update; `POST` already accepted these. No `masterFinancialService` / snapshot changes.

**Nav:** "Superannuation" child added under My Wealth in `lib/navigation/trailNav.tsx` (the existing `/dashboard/investments` matchRoute already covers the route). Sits between Investments and Assets.

**Behaviour-psychology (§0.1):** the amber caps insight celebrates the *next achievable action* (remaining concessional headroom + salary-sacrifice nudge from the optimisation engine) rather than shaming. Empty state ("Add your first super fund") frames super as wealth, not admin.

**Detail dialog (follow-up PR after #965):** the tile's "View details" CTA opens a read-only dialog — Overview (balance, tax-free/taxable components, 1yr/5yr returns, fund/nickname/member#/option) + Contributions tab (per-account concessional/non-concessional YTD totals + the `recentContributions` list from `GET /api/tax/super`). No new API. Closes the v1 shortcut where "View details" opened the edit form.

**Out of scope (v2):** manual per-contribution logging UI (write path via `POST /api/tax/super/contributions`); the `SuperannuationAccount.concessionalCap`/`nonConcessionalCap` column-default refresh (27500/110000 → 30000/120000 — cosmetic, runtime already correct via `taxYearConfig`, needs a `prisma migrate dev` run per §12.12 — Dead Code #26).

**Blocked (NOT a clean duplicate):** retiring the `SUPERS` option in onboarding `InvestmentsStep` — Reza flagged (2026-06-01) it may legitimately serve **SMSF** investment accounts, distinct from retail super. Needs an SMSF-model decision first (IMPLEMENTATION_PLAN Open Question #8 / Dead Code #27).

## 4. Mobile sticky-stack scroll pattern

> **Status as of 39.1d (mock):** prototyped on Properties only via PR #58? for visual review. Pattern queued for app-wide replication once Reza approves (see IMPLEMENTATION_PLAN queued items).

### Brief from Reza (2026-05-02)

> *"Is it possible to change the design for the mobile to show a transition between tiles when I scroll down rather than one tile after another? So I want to feel the new tile overlays the current one like a transition instead of scroll down feel."*

Apple Wallet card-deck feel — as the user scrolls down a list of tiles on mobile, each tile pins to the top and the next tile rises up and **overlays** it (instead of pushing it off-screen in a flat list). The receding tile gets a subtle scale + opacity dim to give a depth/parallax cue.

### Implementation (v2 — current)

| Layer | What |
|---|---|
| **Positioning** | `position: sticky; top: 16` (64px) on each tile on mobile. The `top: 16` clears the 56px fixed mobile header at `DashboardLayout.tsx:550`. `md:static md:top-auto` reverts to normal flow on desktop where the multi-column grid takes over. |
| **Stack order** | Default DOM stack order is sufficient — later siblings naturally render above earlier ones. No `z-index` needed. |
| **Tile background** | **Opaque on mobile** (`bg-{color}-50`), **translucent on desktop** (`md:bg-{color}-50/60`). Mobile must be opaque so sticky-stacked tiles fully cover each other when overlapping; if they're translucent the lower tile bleeds through and creates visible chaos. The desktop grid never overlaps so it can keep the glassmorphic feel. |
| **Mobile detection** | `hooks/useIsMobile.ts` — `matchMedia('(max-width: 767px)')`, SSR-safe (returns `false` on first render, updates on hydrate). |
| **Reduced motion** | Pattern fully disabled when `prefers-reduced-motion: reduce` — falls back to standard scroll. |

### v1 → v2 lessons (do not repeat)

1. **`top-3` (12px) is hidden behind the 56px mobile header.** The dashboard layout has a `lg:hidden fixed top-0 z-40 h-14` header; sticky tiles must use `top-16` or higher to clear it.
2. **Translucent backgrounds break sticky-stacking.** When tile B pins on top of tile A, B's bg must be opaque or A bleeds through. `bg-amber-50/60` looks beautiful in isolation but is unusable for stacked overlap. Solution: opaque on mobile, translucent on desktop.
3. **`useScroll({ target })` does not track sticky elements.** Once the element pins, its bounding rect freezes, and `scrollYProgress` stops updating. Any scroll-driven scale/opacity dim using a sticky target will silently fail. The opaque overlap itself provides the "new rising over old" visual cue without needing scroll-driven transforms — keep it simple.

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

`hooks/useIsMobile.ts` is intentionally generic so any future tile component can opt in by:
1. Wrapping its existing motion.div in a sticky container (`<div className="sticky top-16 md:static md:top-auto">`).
2. Switching its bg classes from `bg-{color}-{shade}/{opacity}` to `bg-{color}-{shade} md:bg-{color}-{shade}/{opacity}` (opaque mobile, translucent desktop).
3. Conditionally opting out via `if (!isMobile || reduced) return tile;` to keep the desktop grid layout untouched.

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
- [x] **Phase 39.2 — Investments redesign shipped** (PR #592, merged 2026-05-02)
- [x] **Phase 39.3 — Assets redesign shipped** (PR #593, merged 2026-05-02)
- [ ] Dark mode visually verified across all three pages — tile classes use `dark:` variants but production verification pending

## 7. App-wide propagation — DECISION (2026-05-02)

> **Decision:** the v4 tile pattern stays scoped to **My Wealth only** for now. NOT propagated to other entity-list pages.

Reza's call after reviewing all three Phase 39 pages in production:

> *"For now I decided to keep the design and not propagate to other entity list pages (maybe that changes in future)."*

### What this means

- **My Accounts (Balances)**, **My Budget (categories)**, **My Safety Net**, and any other tile-list surface keep their current visual treatment.
- The TRAIL-rainbow proposal (per-stage tonal palettes — warm amber for Track, orange/rose for Reduce, emerald/teal for Anchor, sky/indigo for Invest, sunset for Live) is **parked**, not rejected. Re-evaluate when the My Wealth experience has bedded in and Reza signals interest.

### Why this is a good call (post-mortem)

Phase 39 took 3 PRs across Properties, Investments accounts + holdings, and Assets. Propagating to the remaining 5+ entity-list surfaces would have been ~3–4 more PRs of similar scope (~9–12 hours of work), each introducing more per-section palette variation across the app. That risks visual fragmentation (many sections, many palettes — the page-by-page coherence we have within My Wealth might not extend to a sweep across the whole app without further design work on what unifies the experience). Better to validate the My Wealth experience under real use first, then decide whether/how to extend the language.

### Reusable building blocks left in place for the future

If propagation is reactivated:

- **Glyph library** `components/wealth/wealthGlyphs.tsx` is the canonical home for new filled silhouettes. It already houses 18 glyphs across Properties / Investments / Assets and can absorb more (e.g. bank-account types for Balances) without restructure.
- **Tile pattern** is documented in §3.1–§3.3 of this doc — atmosphere mesh + per-type hue + filled glyph + top accent strip + gradient CTA + spring hover-lift. Drop-in for any new tile component.
- **Hero pattern** is in `PropertiesHero` / `InvestmentsHero` / `AssetsHero`. The InvestmentsHero is parameterised (title, total, subtitle, kpis, segments) and could be promoted to a generic `WealthHero` if propagation kicks off.

### When to revisit

Triggers that would justify reopening this decision:
1. User feedback that the My Accounts / My Budget / My Safety Net pages feel visually "left behind" the My Wealth experience.
2. Onboarding research showing the visual contrast between sections is confusing rather than purposeful.
3. A larger-scale design refresh (e.g. an internal brand evolution) that wants section-level unification anyway.
