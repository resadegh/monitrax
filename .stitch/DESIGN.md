# Monitrax — Public Website Design System

> **Status:** Active for the public-website redesign phase (Phase 47, 2026-05-26).
> **Scope:** Public surfaces only — landing, marketing pages, pricing, sign-in/up, public nav/footer. Internal app surfaces use their own tokens (canonical in `08_BRAND_UI_DESIGN.md`).
> **North star:** *"The operating system for Australian wealth-builders."* Designed to feel like Mercury, Stripe, Linear, Arc, Apple — never crypto, never trading-app neon, never template-shaped SaaS.

---

## 1. Brand Foundation

**Brand essence:** Advisor-grade clarity for everyday wealth-builders. Calmly confident — we know the numbers, we don't shout.

**Voice & tone:**
- Clear over clever. *"Net cash flow this month"* beats *"liquidity vibes"*.
- Short labels, longer explanations.
- Never alarmist. *"Worth reviewing"* beats *"WARNING"*.
- Never shame. *"72% of Australians feel this"* beats *"you're behind"*.
- Inclusive, neutral. No gendered language, no socio-economic assumptions.

**Reference brands (borrow feeling, never copy):**
- **Apple** — restraint, typography-as-art, ambient depth
- **Mercury** — sober financial premium, generous whitespace
- **Stripe** — editorial sub-display, narrative density done well
- **Linear** — pure typography, no ornament
- **Arc** — soft glassmorphic chrome, calm motion
- **Ramp** — confident product-glimpse heroes
- **Notion** — warm whites + restrained accents

**Anti-references (never look like these):**
- Trading apps (Robinhood, Coinbase neon)
- Crypto landing pages (Web3 gradient barf, illustrated mascots)
- Budget apps with cartoon mascots (Cleo, Mint legacy)
- Template SaaS heroes (Webflow gallery clones)
- Fear-driven fintech (red gradients, anxiety-inducing alerts)

---

## 2. Color System

The single source of truth is **navy + emerald + warm-ivory**. Every other hue exists only as a **TRAIL stage accent** (sky · amber · indigo · emerald · violet) and is used sparingly — *never* as a primary surface or CTA.

### 2.1 Surface palette (use these for backgrounds, cards, dividers)

| Token | Hex | Usage |
|---|---|---|
| **`ivory`** | `#FAFAF7` | Page background — warm, off-white, never pure white. The dominant surface across the whole site. |
| **`white`** | `#FFFFFF` | Cards, elevated surfaces, modal interiors only. Sparingly. |
| **`stone-100`** | `#F4F3EE` | Soft divider band between sections (alternative to a hairline rule). |
| **`stone-200`** | `#E8E6E0` | Hairline borders, input borders. |
| **`navy`** | `#0B1220` | Brand primary. Header background, footer background, dark hero band, primary button fill. |
| **`navy-elevated`** | `#111A2E` | Slightly elevated dark surface (cards on a navy section, hover state on navy buttons). |
| **`slate-700`** | `#334155` | Secondary text on light surfaces. |
| **`slate-500`** | `#64748B` | Tertiary text, captions, footer labels. |
| **`slate-300`** | `#CBD5E1` | Muted UI elements on navy (inactive nav items, disabled state). |

### 2.2 Accent palette

| Token | Hex | Usage |
|---|---|---|
| **`emerald-500`** | `#16A34A` | **Primary CTA color.** Action buttons (`Start free`, `Sign in`). Success states. Progress indicators. The single most-used accent on the site. |
| **`emerald-600`** | `#15803D` | Hover state for emerald CTAs. |
| **`emerald-50`** | `#F0FDF4` | Emerald CTA glow / soft fill backgrounds. |

### 2.3 TRAIL stage hues (use ONLY when explicitly representing a TRAIL stage)

These are the canonical SSOT from `lib/navigation/trailNav.tsx` → `TRAIL_STAGE_TONES`. The same five hues appear on every TRAIL surface in the app. Marketing pages MUST match.

| Stage | Hex | Use only for |
|---|---|---|
| **T — Track** | **Sky** `#0EA5E9` | Track-stage callouts, "T" badges, Track capability card |
| **R — Reduce** | **Amber** `#F59E0B` | Reduce-stage callouts, "R" badges, Reduce capability card |
| **A — Anchor** | **Indigo** `#6366F1` | Anchor-stage callouts, "A" badges, Anchor capability card |
| **I — Invest** | **Emerald** `#16A34A` | Invest-stage callouts, "I" badges, Invest capability card *(coincides with brand accent — fine, they're the same colour)* |
| **L — Live** | **Violet** `#8B5CF6` | Live-stage callouts, "L" badges, Live capability card |

### 2.4 Forbidden colours

- **No red** (`#DC2626` and family) — except for true validation errors. Loss-aversion-safe. Brand accent is emerald, warning accent is amber, *never red*.
- **No pure black** (`#000000`) — backgrounds use ivory or navy.
- **No pure white** (`#FFFFFF`) — primary surface is ivory.
- **No neon / fluorescent** anything.
- **No saturated gradients** (rainbow, purple-to-cyan, etc.) — the only gradients allowed are *navy → navy-elevated* (subtle depth) or *ivory → white* (subtle elevation) or single-hue mesh atmospheres (sky-50 → indigo-50, for TRAIL hero atmospheres only).

### 2.5 Dark mode

Public site is **light-mode-first** (warm-ivory background). A dark-mode version may follow as Phase 47.2 but is NOT in scope for the initial redesign.

---

## 3. Typography

**One font family:** **Inter**, weights 400 / 500 / 600 / 700. No serif accents in v1 (we may add an editorial serif phrase per hero in v2, but the v1 brief is Inter-only restraint).

### 3.1 Type scale

| Token | Size | Weight | Line-height | Letter-spacing | Usage |
|---|---|---|---|---|---|
| `display-xl` | 60px / 4rem (desktop), 36px / 2.25rem (mobile) | **600 (semibold — NOT bold)** | 1.05 | `-0.03em` | Hero headlines ONLY. One per page. |
| `display-lg` | 48px / 3rem (desktop), 32px / 2rem (mobile) | 600 | 1.1 | `-0.025em` | Section headlines. |
| `display-md` | 32px / 2rem | 600 | 1.15 | `-0.02em` | Sub-section headlines, card titles. |
| `body-lg` | 18px / 1.125rem | 400 | 1.65 | normal | Hero subheadlines, opening paragraphs. |
| `body` | 16px / 1rem | 400 | 1.65 | normal | Default body copy. |
| `body-sm` | 14px / 0.875rem | 400 | 1.55 | normal | Captions, footer labels, microcopy. |
| `eyebrow` | 12px / 0.75rem | 500 (medium) | 1 | `0.18em` (wide tracking), UPPERCASE | Section eyebrows, category labels above headlines. |
| `mono` | matches body | 400 | 1.5 | `tabular-nums` | Any numerical display (prices, stats, code). Use Inter's `tabular-nums` feature — no separate mono font. |

**Rules:**
- **Never bold (`font-weight: 700`) for display sizes.** Semibold (600) is the premium feeling. Bold reads as Webflow-template.
- **One display size per viewport.** Don't compete headlines.
- **Body line-height stays at 1.65** for any text ≥ 14px. Generous reading rhythm is part of the premium feel.
- **Eyebrow letter-spacing is non-negotiable** at 0.18em. Cleaner than at 0.1em, more refined than at 0.25em.
- **No inline `style={letterSpacing}` or `style={lineHeight}`.** Use Tailwind tokens consistently.

---

## 4. Spacing & Layout

**Base unit:** 4px. All spacing is a multiple of 4 — `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128`.

**Section vertical rhythm:** `py-24` (96px) on desktop, `py-16` (64px) on mobile. Generous. **Never less than `py-16` on a section.**

**Container widths:**
- `max-w-7xl` (1280px) — header, footer, full-bleed sections
- `max-w-6xl` (1152px) — feature grids, multi-column content
- `max-w-4xl` (896px) — hero, narrative sections
- `max-w-3xl` (768px) — long-form paragraphs, FAQ
- `max-w-2xl` (672px) — single-column CTA blocks

**Padding inside containers:** `px-6` (24px) mobile, `px-8` (32px) desktop.

**Card padding:** `p-8` (32px) standard, `p-10` (40px) for hero-adjacent cards, `p-6` (24px) for compact items.

**Grid gap rules:**
- Feature card grids: `gap-6` (24px)
- Tight stat clusters: `gap-4` (16px)
- Hero-to-section spacing: `gap-12` or `space-y-12` (48px)

**No `100dvh` heroes.** Hero is ~70-80vh and immediately scrollable. Full-viewport heroes are a 2020s template trope.

---

## 5. Corners, borders, elevation

### 5.1 Corner radii

| Token | Radius | Usage |
|---|---|---|
| `rounded-full` | 9999px | Pills (eyebrows, badges, capability chips). |
| `rounded-2xl` | 16px | Standard cards, input fields, modals. |
| `rounded-[22px]` | 22px | Atmospheric tiles (`MetricTile` family — Phase 39 standard). |
| `rounded-[28px]` | 28px | Hero glass surfaces (`GlassHero` family — Phase 39 standard). |
| `rounded-xl` | 12px | Buttons (primary, secondary), small tags. |
| `rounded-lg` | 8px | Form inputs, dropdowns, small interactive elements. |

### 5.2 Borders

- **Light surfaces:** `border border-stone-200` (a `#E8E6E0` hairline). Never visible at high contrast — should read as a *suggestion* of an edge.
- **Dark / navy surfaces:** `border border-white/[0.08]` — barely-there hairline at low opacity. Same idea, inverted.
- **Glass surfaces** (Apple-glass tiles): `ring-1 ring-foreground/[0.04]` + a subtle inner top highlight (`shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`).
- **Never use** thick borders (>1px), dashed borders, or colored borders as the primary edge treatment.

### 5.3 Shadows

| Token | CSS | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(11, 18, 32, 0.04)` | Standard card resting state. |
| `shadow-md` | `0 4px 12px rgba(11, 18, 32, 0.06)` | Hover state for interactive cards. |
| `shadow-lg` | `0 12px 32px rgba(11, 18, 32, 0.08)` | Hero card, primary CTA hover halo. |
| `shadow-glow-emerald` | `0 12px 32px rgba(22, 163, 74, 0.18)` | Primary CTA resting state — soft emerald halo. |

All shadow colour is **navy at low alpha**, not pure black. Black shadows read as 2010s-flat.

---

## 6. Design System Notes for Stitch Generation

> **Copy this entire block into every Stitch prompt.** This is the canonical block Stitch reads to keep generations on-brand.

**Brand:** Monitrax — Australian wealth-operating-system for mass-affluent wealth-builders. Visual reference: Mercury, Stripe, Linear, Arc, Apple. Never crypto, never trading app, never template SaaS.

**Background:** Warm ivory `#FAFAF7` (NEVER pure white, NEVER pure black). Dark sections use deep navy `#0B1220`. Section transitions are *subtle band changes*, not light/dark/light alternation.

**Primary text:** Slate-900 `#0F172A` on ivory. Ivory `#FAFAF7` on navy.
**Secondary text:** Slate-500 `#64748B` on ivory. Slate-300 `#CBD5E1` on navy.

**Primary CTA:** Emerald `#16A34A`, white text, `rounded-xl` (12px), `px-6 py-3` (or `px-8 py-4` for hero CTA), `font-medium` (500), soft emerald shadow at rest (`0 12px 32px rgba(22, 163, 74, 0.18)`), lifts 2px on hover (`translate-y-[-2px]`). NEVER amber, NEVER navy fill as primary CTA. NEVER gradients on CTAs except a subtle emerald-500 → emerald-600 vertical gradient.

**Secondary CTA:** Ghost button. Text in navy/ivory matching surface, no fill, small underline animation on hover.

**Typography:** Inter only. Weights 400 / 500 / 600 / 700. Display headlines use **semibold 600 (never bold 700)**, letter-spacing `-0.03em`, line-height 1.05–1.1. Body text uses regular 400, line-height 1.65. Eyebrows use medium 500, UPPERCASE, letter-spacing `0.18em`.

**Section vertical rhythm:** `py-24` (96px) desktop, `py-16` (64px) mobile. NEVER less than `py-16`.

**Card surfaces:**
- Standard card: `bg-white`, `rounded-2xl` (16px), `border border-stone-200`, `p-8`, `shadow-sm`, hover `shadow-md` + `translate-y-[-2px]`.
- Apple-glass hero tile: `rounded-[28px]`, white at 85% with `backdrop-blur-xl`, `ring-1 ring-black/5`, subtle inner top highlight, single-hue atmospheric mesh gradient *only* (sky-50 → indigo-50, OR ivory → emerald-50, never rainbow).
- Atmospheric tile: `rounded-[22px]`, same family but smaller.

**Hero pattern:** Eyebrow (uppercase, tracked, slate-500) → display-xl headline (max two lines, semibold) → body-lg subhead (one paragraph, slate-500, max 60ch) → two CTAs (primary emerald + secondary ghost) → product-glimpse imagery (treated screenshot in a warm-ivory frame with soft shadow). NEVER 100dvh — hero is ~70-80vh, scroll-encouraged.

**Imagery treatment:** Product screenshots are treated assets — soft `shadow-lg` (warm-navy-tinted, never pure black), `rounded-2xl` frame, slight upward tilt (≤2deg) for hero only, no tilt for in-section. NEVER fullbleed-bleeding-off-the-edge product imagery. ALWAYS framed.

**Iconography:** Lucide icons at 16-24px, stroke 1.5px (the lighter-than-default weight). Filled silhouette glyphs are reserved for in-app surfaces. On the public site use line icons only.

**Motion:** Smooth, subtle, Apple-grade. Easing curve is `cubic-bezier(0.25, 0.46, 0.45, 0.94)` ("appleEase"). Hover lifts are 2px max. Section entries are fade-up 24px over 700ms with 120ms stagger. NEVER bouncy springs, parallax, or scroll-driven scale effects. ALL motion respects `prefers-reduced-motion: reduce`.

**TRAIL stages** (when representing the five-stage framework): T=Sky `#0EA5E9`, R=Amber `#F59E0B`, A=Indigo `#6366F1`, I=Emerald `#16A34A`, L=Violet `#8B5CF6`. Each stage gets its hue ONLY when explicitly representing that stage. NEVER mix stage hues at random.

**Forbidden:** Pure black, pure white, red (except true errors), neon, rainbow gradients, glassmorphic-on-everything, drop-shadows in pure black, font-weight 700 on display sizes, bouncy spring motion, parallax, 100dvh heroes, cartoon illustrations, mascots, abstract 3D blobs, generic stock photography.

**Required:** Inter typography, warm-ivory base, emerald CTAs, generous whitespace (py-24 sections), light-touch shadows, semibold (600) display weights, restraint-as-premium discipline.

---

## 7. Motion Vocabulary

Single source of truth: `components/shell/motion.ts`.

| Token | Curve / Spring | Usage |
|---|---|---|
| `appleEase` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | All non-spring transitions. |
| `springSnap` | `stiffness: 320, damping: 28, mass: 0.8` | Tile hover-lift, button press. |
| `heroEnter` | fade + 24px upward, 700ms, `appleEase` | Hero text sequence. |
| `tileEnter(index)` | fade + 16px upward, 550ms, 40ms stagger | Card grid entries. |
| `breathingGlow` | opacity 0.4 ↔ 0.7, 6s ease-in-out, infinite | Atmospheric mesh on hero tiles. |

**Rules:**
1. **`prefers-reduced-motion: reduce` collapses all motion** to instant or static. Use the `useReducedMotionSafe()` hook at the top of every animated component.
2. **No parallax.** No scroll-driven scale or opacity transforms. They feel cheap on retina.
3. **Hover lifts are 2px maximum.** A 6px lift reads as a video-game button, not premium product.
4. **Section entries are fade+rise, never slide-from-side.**
5. **Buttons get a `springSnap` press scale** (98% momentarily on `:active`). No more.

---

## 8. TRAIL Stage System

The TRAIL framework is Monitrax's product IA spine. **Marketing pages MUST use the canonical SSOT hues** (sky → amber → indigo → emerald → violet). The current site at `components/marketing/TrailJourney.tsx` uses wrong hues (amber/orange/emerald/sky/yellow) — that's a known bug being fixed in this redesign.

| Stage | Verb | Promise | Hue |
|---|---|---|---|
| **T — Track** | "Track your full picture" | See every account, debt, dollar in one view. | Sky `#0EA5E9` |
| **R — Reduce** | "Reduce the waste, fix the leaks" | Spending leaks, cashflow positive. | Amber `#F59E0B` |
| **A — Anchor** | "Anchor your safety net" | 3 months emergency fund, bills covered. | Indigo `#6366F1` |
| **I — Invest** | "Invest in your future" | Property, super, shares — build deliberately. | Emerald `#16A34A` |
| **L — Live** | "Live on your terms" | Decisions from abundance, not scarcity. | Violet `#8B5CF6` |

When representing TRAIL on the public site (e.g. capability cards, journey diagrams), each stage carries its hue as a *single tonal element* (icon container fill, accent stripe, badge) — NOT as a card background. The card itself stays warm-ivory or white. The stage hue is a *signal*, not a *surface*.

---

## 9. Accessibility

- **WCAG AA contrast** floor for all body text. Slate-500 on ivory passes; slate-300 on ivory does not — use only on navy.
- **Focus rings:** `focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory`. Visible, premium-shaped.
- **Tap targets:** ≥44px (Apple HIG) for any interactive element on mobile.
- **Reduced motion:** every animated component gates on `prefers-reduced-motion`. No exceptions.
- **Skip-to-content link** in the nav, visible on focus.

---

## 10. Versioning

| Version | Date | Notes |
|---|---|---|
| **v1.0** | 2026-05-26 | Initial spec for Phase 47 Public Website Redesign. Locks navy + emerald + ivory direction, kills amber as primary brand colour, aligns TRAIL hues to SSOT. |
