# Phase 45 — "What If?" Scenarios Surface

**Status:** 🟡 SPEC (workstream `0·WI`)
**Created:** 2026-06-01
**Owner:** Reza (direction + visual sign-off) + Claude (engineering + Stitch design + four-lens review)
**Workstream:** `IMPLEMENTATION_PLAN.md` → `0·WI`
**Anchors:**
- `CLAUDE.md` §0 (advisory mindset — four lenses), §12.2 (SSOT), §12.3 (single calc engine), §12.14 (Phase 41E reform-awareness), §14 (TRAIL + warm words), §18 (Stitch-first)
- `docs/IMPLEMENTATION_PLAN.md` Up Next row 67 (Phase 45 brief), row 69 (Q-DEC), Q-HOOK-AFSL (AFSL pre-review)
- `docs/blueprint/PHASE_46_WEALTH_CHECK_HOOK.md` (sibling public-surface — same engines)
- `lib/cfo/scenarios/` (Phase 40 deterministic engines — 4 of 5 levers already live)
- `lib/cashflow/` + `lib/tax-engine/` + `lib/calculations/` (the composed engines)

---

## 1. Why this phase exists

Reza decision 2026-05-24: "What If?" is the **wedge feature for the wealth-builder ICP** (Q-ICP-1, also 2026-05-24). The mass-affluent integration-debt persona doesn't get value from "track your spending" — they already have 5+ levers in motion (mortgage, investments, super, salary, debt) and the question they can't answer alone is *"what happens to my picture if I move one of them?"*

No AU PFM answers that. Every existing app shows you the **current** picture. Monitrax already computes the **per-entity** picture via Phase 44 + Phase 41E. Phase 45 adds the **counterfactual** picture: same engines, one input changed, 10-year trajectory composed.

The wedge is real because:
1. The five levers map directly to the conversations advisers have with mass-affluent clients (refinance, salary-sacrifice, sell IP, extra repayments, buy IP).
2. Each lever's output is structurally information, not advice — the AFSL boundary stays intact (Q-HOOK-AFSL pre-review 2026-05-24).
3. The composition reuses canonical engines (CLAUDE.md §12.2 / §12.3) — no parallel calc paths to maintain.

## 2. Scope — what ships in v1

| Lever | Existing engine | New work |
|---|---|---|
| (a) Refinance loan X at rate Y | `lib/cfo/scenarios/refinanceLoan.ts` ✅ | UI input + 10-yr composer wrap |
| (b) Salary-sacrifice $X/month to super | **NEW** — composes `lib/tax-engine/divisions/*` super logic | New `salarySacrificeToSuper.ts` scenario + concessional cap headroom guard |
| (c) Sell property X at $Y | `lib/cfo/scenarios/sellProperty.ts` ✅ | UI input + 10-yr composer wrap |
| (d) Pay $X extra/month on debt X | `lib/cfo/scenarios/payDownLoan.ts` ✅ | UI input + 10-yr composer wrap |
| (e) Buy investment property at $Y with $Z LVR | `lib/cfo/scenarios/addInvestment.ts` ✅ (close cousin) | Refit for property-specific inputs (rental yield, vacancy assumption) + 10-yr composer wrap |

**The new code is small:** one scenario function (salary-sacrifice) + one composer (`tenYearProjection.ts`) + the React UI.

## 3. Out of scope for v1

- Multi-lever stacking ("refinance AND sell IP AND salary-sacrifice")
- Goal seeking ("how much salary-sacrifice gets me to $X by 65")
- Scenario save / share
- Phase 45.1 contextual entry points (separate PR after v1 ships)

## 4. Architectural rules (CLAUDE.md §12.2 + §12.3 + §0.4)

- **ZERO new calc engines.** Every lever computes via existing primitives. New code is composition + UI only.
- **Pure functions in the scenario layer.** No I/O, no globals. `runScenario(type, ctx, params)` → `ScenarioResult` shape (matches Phase 40 contract).
- **10-year composer = a loop over per-year cashflow + tax position.** Inputs: scenario delta on the user's snapshot; outputs: 10 × `{ year, netWorth, cashflowDelta, taxDelta }`.
- **Snapshot defaults from `getMasterFinancialSnapshot()`.** Don't ask for data already on file — pre-populate the slider with current state, let the user move it.
- **AFSL discipline (Q-HOOK-AFSL pre-review 2026-05-24):**
  - "If you refinanced at 5.5%, your monthly drops by $X" — NEVER "you should refinance"
  - "This closes part of the gap" framing — partly-closable preserves self-efficacy (Klontz 2011)
  - Concessional cap headroom check on salary-sacrifice — never silently model an illegal contribution
  - General Advice Warning footer on every lever output (s949A)
  - No product names ever; no broker recommendations
  - Assumptions panel collapsed by default but always present
- **§12.14 Phase 41E reform-awareness:** the salary-sacrifice scenario MUST read regime status per FY via the established `taxYearConfig` dispatch. If the FY is post-commencement on a measure that affects super, surface the verbatim notice (mirrors the Wealth Universe Money Flow lens pattern).
- **Editorial palette (Reza decision 2026-06-01):** `/dashboard/cfo/what-if` matches the rest of `/dashboard/cfo` — warm-ivory + emerald + navy ink. NOT a cosmos-style dark surface.

## 5. Q-DEC is the gate

Reza decision 2026-06-01: Phase 45 v1 ships AFTER Q-DEC (Float→Decimal) lands. Rationale: 10-year horizons compound Float error to visibly-wrong cents; the entire product promise is "regulator-grade accuracy, every number traceable"; pre-revenue is the cheap time to fix the precision foundation.

Sequencing:
1. ✅ **Q-DEC PR 1 — additive Decimal schema (core 10 models) — MERGED PR #974 (2026-06-03)** — ~45 columns on Property/Loan/Account/Income/Expense/InvestmentAccount/InvestmentHolding/PurchaseLot/SuperannuationAccount/Asset.
2. 🟡 **Q-DEC PR 1.5 — supplementary Decimal columns (7 models, this PR's follow-up) — IN FLIGHT** — ~23 columns on Transaction/InvestmentTransaction/CapitalGainEvent/CapitalGainLotAllocation/RecurringPayment/SmsfAnnualReturn/SuperContribution. Phase 41E models already Decimal; TaxPosition cache deferred.
3. Q-DEC PR 2 — engine adapter layer
4. **Phase 45 Stitch design pass begins HERE in parallel with Q-DEC PR 3** (so Reza can iterate the UI design while engine cutover proceeds)
5. Q-DEC PR 3 — engine-by-engine cutover
6. Q-DEC PR 4 — Float drop (after 7-day parallel-run)
6. Phase 45 PR 1 — engine composition (salary-sacrifice scenario + `tenYearProjection.ts`)
7. Phase 45 PR 2 — UI port (`/dashboard/cfo/what-if` + 5 lever-detail screens)
8. Phase 45.1 — contextual entry points (separate PR)

## 6. Stitch design pass (CLAUDE.md §18) — §18.7.2 glass vocabulary applied to Phase 45

### 6.0 Vocabulary anchor (load-bearing decision, 2026-06-04)

Phase 45's two canonical surfaces (`/dashboard/cfo/what-if` lever picker + `/dashboard/cfo/what-if/[lever]` lever detail) inherit the **Monitrax in-app glass vocabulary** documented verbatim in `CLAUDE.md §18.7.2` — the same design language Phase 39 ships on My Wealth (`components/properties/PropertyTile.tsx`, `components/properties/PropertiesHero.tsx`, `components/wealth/wealthGlyphs.tsx`).

**Lesson recorded (2026-06-04):** the June 1 AskUserQuestion "Editorial palette" answer was poorly framed — it surfaced the flat **Restrained Editorial** asset (`5eb40c25ecd946828ee9ba4d60c0662c`) as the default rather than §18.7.2. The first Stitch generation (Screen A v1, screen `2093dc0bec5e4656baf06596e0749232`, 2026-06-04) rendered with flat paper-white cards and 1.5px Lucide line icons — visually correct for the home dashboard (`0·StD`) but **wrong for Phase 45**, which is a sibling of the My Wealth surface and must carry the same glass+gradient identity. Reza overruled the v1 direction; this §6 is the corrected anchor. Going forward: every Phase 45 Stitch call seeds §18.7.2 verbatim and does **not** specify the Restrained Editorial design system asset (the inline tokens dominate).

### 6.1 Canonical vocabulary — copy these tokens verbatim into every Phase 45 Stitch prompt

Reproduced from `CLAUDE.md §18.7.2` (single source of truth). Any deviation here = update CLAUDE.md first, then copy back.

| Principle | Token / rule |
|---|---|
| **Page surface** | Warm ivory `#FAFAF7` (never clinical white, never cool blue). Content max-width ~1200px, generous whitespace. |
| **Glass** | `bg-card/70 backdrop-blur-xl` + 1px hairline border (entity-tinted, low opacity ~15-25%) + soft layered float shadow `shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]`. Premium **because** of what's removed. |
| **Radius** | Hero `rounded-[28px]`, tile `rounded-[22px]`, KPI sub-box `rounded-[12px]`, gradient icon badge `rounded-[14px]`, interactive pill `rounded-full`. No sharp corners. |
| **Per-entity sub-palette** | Each lever carries a 3px gradient top-accent strip + an oversized faint glyph watermark (~6–12% opacity) bleeding off the right edge. |
| **Tile anatomy** | gradient icon badge (44px `rounded-[14px]`, gradient fill, 1px ring) → tiny uppercase gradient-text type label → title + muted subtitle → glass surface → faint watermark → quiet "Open →" affordance in the gradient accent. |
| **Money signal (Screen B only)** | Emerald `#16A34A` reserved for positive returns only (gain pill `bg-emerald-500/12 text-emerald-700 ring-emerald-500/20`). Big balance numbers use the brand sky→indigo gradient text. Amber only for genuine caution. No red except true loss. |
| **Typography** | Inter throughout. Confident `tabular-nums` numerals with tight tracking for money. Warm plain-English microcopy. `label-sm` uppercase tracked labels (`tracking-[0.16em]`, weight 600). |
| **Glyphs** | Lucide filled silhouettes preferred (`viewBox 0 0 120 120`, `fill='currentColor'`, no strokes) for the watermarks; standard line icons OK for the badge glyph. Reuse `components/wealth/wealthGlyphs.tsx` patterns where applicable. |
| **Motion** | `appleEase = [0.25,0.46,0.45,0.94]`; `springSnap = { stiffness:320, damping:28, mass:0.8 }`. Tile entrance 0.55s + 40ms stagger. `prefers-reduced-motion` honoured. |
| **Behaviour-psychology** | Celebrate the next achievable action; normalise rather than shame; no false precision, no manufactured urgency, no invented numbers. |

### 6.2 Per-lever sub-palette — TRAIL-stage + financial-domain mapping

Each lever inherits a sub-palette in the same way Phase 39 maps entity types to colour families (Home=amber, Investment/Super=sky→indigo, Rental=teal). Phase 45 maps **lever** to a TRAIL-stage + financial-domain identity.

| Lever | TRAIL stage | Sub-palette gradient | Hex stops | Type label | Glyph (Lucide) |
|---|---|---|---|---|---|
| (a) Refinance a loan | REDUCE | amber → rose | `#F59E0B → #F43F5E` | `REDUCE · DEBT` | `Percent` |
| (b) Salary-sacrifice to super | INVEST | emerald → indigo | `#10B981 → #6366F1` | `INVEST · SUPER` | `PiggyBank` |
| (c) Sell a property | LIVE | violet → fuchsia | `#8B5CF6 → #D946EF` | `LIVE · EXIT` | `Home` (with subtle exit arrow if available) |
| (d) Pay extra off a debt | ANCHOR | indigo → violet | `#6366F1 → #8B5CF6` | `ANCHOR · DEBT FREEDOM` | `TrendingDown` |
| (e) Buy an investment property | INVEST | sky → cyan | `#0EA5E9 → #06B6D4` | `INVEST · PROPERTY` | `Building2` (with small `+` indicator) |

Rationale: each lever gets a structurally **distinct** gradient so the grid reads as five differentiated decisions, not a uniform palette. The TRAIL-stage anchor preserves the warm-words framework (`CLAUDE.md §14`) — every lever names which stage of the wealth journey it serves.

### 6.3 Screen A — Lever picker (`/dashboard/cfo/what-if` home)

Content area (sidebar + topbar are already drawn by the app shell — do NOT redraw them).

1. **Page header block** (top).
   - Eyebrow: `MY GUIDE · DECISION SUPPORT` — uppercase, navy at 60% opacity, 11px, tracked `tracking-[0.18em]`, weight 600.
   - Headline: `What if?` — 36-40px, navy semibold, tight letter-spacing. Optionally brand sky→indigo gradient text.
   - Explainer: "See how a single move would change your 10-year picture. Pick one lever — Monitrax shows what changes, never what you should do." — muted slate, 16px, weight 400.

2. **Lever grid** — 3 columns × 2 rows. Five real lever cards per §6.2 + one quiet "More levers coming" glass placeholder (dashed-outline inner, no gradient strip, no badge).

   Each lever card uses the §6.1 anatomy:
   - 3px gradient top-accent strip (per-lever, from §6.2 table).
   - 44px gradient icon badge top-left, `rounded-[14px]`, 1px ring at higher gradient opacity, Lucide glyph 18-20px inside in white at ~90% opacity.
   - Tiny uppercase gradient-text type label to the right of the badge (e.g. `REDUCE · DEBT`).
   - Lever title — 18-20px navy semibold, single line.
   - Muted subtitle — 13-14px slate, 2 lines max.
   - Oversized faint glyph watermark bleeding off the bottom-right corner (110-140px, opacity ~6-10%, single tone from the lever's gradient).
   - Quiet "Open →" affordance bottom-left in the gradient accent.

3. **AFSL boundary footer** below the grid (~32-48px below). Single wide glass card spanning the content column, `rounded-[28px]`:
   - Left: Lucide `ShieldCheck` or `Info` icon, ~24px, slate.
   - Eyebrow: `WHY NO RECOMMENDATIONS`.
   - Headline (15px navy): "Monitrax shows what changes. It doesn't tell you what to do."
   - Body (13px slate): "Every lever here is information about your own numbers — never personal advice. That's a job for a licensed financial adviser. Read the General Advice Warning."
   - Trailing link: `→ Read the warning` in slate, hover shifts to navy.

### 6.4 Screen B — Lever detail (`/dashboard/cfo/what-if/[lever]`)

Same vocabulary as §6.1; the layout adds money numbers + sliders. Two-column layout on md+ (`grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8`).

- **Breadcrumb row** (top): `← What if? · {Lever name}` — back chevron is a button. Lever-name pill carries the lever's sub-palette gradient as text-fill (per §18.7.2 "tiny uppercase gradient-text type label" rule).

- **Left column — Inputs (glass card, `rounded-[28px]`).**
  - Eyebrow: `INPUTS` + lever-stage label (`REDUCE`, `INVEST`, etc.).
  - Entity picker if applicable (e.g. "Which loan?") — glass sub-card, `rounded-[12px]`, slim list rows.
  - Slider(s) for the lever input(s) — track in slate-200, fill in the lever's gradient. Pre-fill with snapshot value. Show the active value as `tabular-nums` to the right of the slider.
  - "Use current market rate" / "Use snapshot" sensible-default affordances as ghost pills (`border-foreground/10 bg-background/50 backdrop-blur`).
  - Concessional-cap headroom check (salary-sacrifice only) — surfaces UNCOMPUTED + amber-tinted warning when input exceeds cap.

- **Right column — Result (glass card, `rounded-[28px]`).**
  - Headline metric — large `tabular-nums`, brand sky→indigo gradient text (e.g. "Monthly savings: $213").
  - Sub-headline delta — `body-sm` slate, "vs. your current path".
  - 10-year net-worth trajectory chart — sparkline-style (Wealthfront Path reference), 1.5px emerald line, 8% emerald area fill, dotted reference line for "current path" in navy 30%. Y-axis: minimal, just the start + end value. X-axis: year labels every 2 years.
  - Tax-position delta block — gain pill `bg-emerald-500/12 text-emerald-700` when the move reduces tax, amber pill `bg-amber-500/12 text-amber-700` for caution (CGT exposure, cap impact, Div 7A risk). NEVER red.
  - "How we computed this" — chevron-collapsed Assumptions panel below the chart. Lists every assumption verbatim ("annual return 7%", "inflation 2.5%", "your snapshot as of 2026-06-04"). Pre-collapsed but always visible — surfaces, not hides, the load-bearing modelling choices.

- **Bottom — AFSL footer** (always visible, mirrors Screen A's panel but compact).

### 6.5 The locked Stitch prompt template

Every Phase 45 Stitch call uses the template below. **Do not** specify a design system asset — the inline tokens dominate (`CLAUDE.md §18.7` rule: "Do NOT let Stitch's default design system stand unchallenged"). The prompt MUST cite §6.1 vocabulary + the §6.2 per-lever sub-palette table verbatim.

```
PROJECT: 1859462351962811110 (canonical Monitrax Stitch project)
DESIGN SYSTEM ASSET: none — inline tokens dominate
DEVICE: DESKTOP
MODEL: GEMINI_3_1_PRO

PROMPT TEMPLATE (paste §6.1 vocabulary table + §6.2 per-lever table + the
Screen A or Screen B layout block from §6.3 / §6.4 verbatim, ending
with):

REFERENCE FILES (ground truth for the glass vocabulary, do not redraw):
- components/properties/PropertyTile.tsx
- components/properties/PropertiesHero.tsx
- components/wealth/wealthGlyphs.tsx
- components/shell/motion.ts

CONSTRAINTS (red lines):
- NO flat paper-white cards. Every card MUST use glass.
- NO multi-colour confetti. Each card gets ONE gradient.
- NO red. No down-indicators in red.
- NO pure white, NO cool blue. Background is warm ivory #FAFAF7.
- NO emojis. NO excitement punctuation.
- NO numerical examples on the lever picker — those live on Screen B.
- The screen reads as a direct visual sibling of the My Wealth page
  (Phase 39), NOT as a separate design system.
```

### 6.6 Artefacts committed to `.stitch/designs/`

Per `CLAUDE.md §18.4`:
- `.stitch/designs/what-if-lever-picker.{html,png}` — Screen A (final approved version)
- `.stitch/designs/what-if-lever-detail.{html,png}` — Screen B (final approved version)
- Iterations as `what-if-*-vN.{html,png}` etc. Each iteration's Stitch screen ID recorded in this section.

**Iteration log:**

| Date | Screen | Version | Stitch screen ID | Notes |
|---|---|---|---|---|
| 2026-06-04 | A — Lever picker | v1 | `2093dc0bec5e4656baf06596e0749232` | ❌ Wrong vocabulary — used Restrained Editorial flat. Reza overruled. Lesson recorded in §6.0. Kept as reference. |
| 2026-06-04 | A — Lever picker | v2 | `ed9fd957a19f4511842be0ef3ba29136` | Generated AFTER §6 spec was locked; first attempt at §18.7.2 glass + per-lever gradients per §6.2. Pending Reza review. |

### 6.7 Reviewer enforcement (CLAUDE.md §18.5)

Any future Phase 45 Stitch generation that does not seed §6.1 + §6.2 + §6.5 verbatim must be rejected. The prompt text used in each `mcp__stitch__generate_screen_from_text` call should be quoted in the iteration-log row above so a reviewer can audit prompt-vs-spec alignment.

### 6.8 Interaction patterns — hover, focus, tap (load-bearing, 2026-06-04)

Static mockups don't tell the story alone. The Phase 45 surfaces are **interactive decision-support** — the value is in the live feedback as the user moves a slider or hovers a lever. Every Stitch generation MUST show the hover state (typically rendered as one card in the hover state, others at rest, so reviewers can audit both).

#### 6.8.1 Lever-card hover (Screen A)

When pointer enters a lever card on `/dashboard/cfo/what-if`:

| Element | At rest | On hover |
|---|---|---|
| Card surface | `bg-card/70 backdrop-blur-xl` | `bg-card/85` (slightly more opaque — the glass "wakes up") |
| Card transform | `translateY(0)` | `translateY(-2px)` (subtle Apple-style lift; respects `prefers-reduced-motion`) |
| Card shadow | `shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]` | `shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_48px_rgba(15,23,42,0.10)]` (deeper layered float) |
| 3px gradient top-accent strip | `opacity-100` | `opacity-100` + 1px hairline glow extending outward (the lever's identity asserts itself) |
| Gradient icon badge | static | subtle 1.5° rotation OR a 600ms gradient-sweep animation (one or the other, not both — restraint) |
| Faint watermark | `opacity-[0.07]` | `opacity-[0.11]` (rises slightly) |
| "Open →" affordance | gradient-text accent | gradient-text accent + arrow translates `translateX(2px)` |
| Cursor | `cursor: pointer` on the whole card | — |
| Hover-preview tooltip | hidden | (optional v2 polish — see §6.8.3) |

Motion timing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (`appleEase` from `components/shell/motion.ts`), duration 180-220ms. Respects `prefers-reduced-motion` — translate + scale + rotate fallback to opacity-only.

Focus state (keyboard navigation) mirrors hover + adds a 2px emerald focus ring at the card's outer edge (`focus-visible:ring-2 ring-emerald-500/40 ring-offset-2`). The whole card is the click target — no nested focusable elements except the explicit "Open →" link inside.

#### 6.8.2 Lever-detail interaction (Screen B)

The lever-detail screen has MORE hover surfaces because of the live calculator feedback. Every visible number must have an explanation on hover.

| Element | Hover behaviour |
|---|---|
| **Slider thumb** | While dragging: a floating value tooltip above the thumb, `tabular-nums` (e.g. "5.50%"), `rounded-full` pill in the lever's gradient. Released: the tooltip fades. |
| **Slider track** | Hover anywhere on the track shows a "set to here" ghost thumb in slate at the cursor position. |
| **"Use snapshot" ghost pill** | Hover: a tooltip showing "Your snapshot: 6.25% as of 2026-06-04". Anchored to the pill, slate background, navy text. |
| **"Use current market rate" ghost pill** | Hover: a tooltip showing "ABS June 2026 average: 5.85% · refresh weekly". Same tooltip pattern. |
| **Headline metric (e.g. "Monthly savings: $213")** | Hover: a thin underline appears in the gradient accent + a `(?)` glyph fades in at the trailing edge. Click the `(?)` → expands the assumptions panel. |
| **10-year trajectory chart — data points** | Hover on any year tick: a tooltip showing `{year}: Net worth $X · vs current path $Y · delta $Z`. Tooltip uses the glass surface (`bg-card/90 backdrop-blur-xl` + 1px hairline border + soft shadow), `rounded-[14px]`. |
| **10-year trajectory chart — dotted reference line** | Hover: tooltip surfaces "Current path — if you don't change anything." |
| **Tax-position pill (e.g. "CGT exposure $12,400")** | Hover: expands a small popover showing the underlying calc — "Capital gain $X × 50% discount × marginal rate Y%" — anchored to the pill. Glass surface, same as chart tooltip. |
| **"How we computed this" header** | Hover: subtle navy underline. Click: chevron rotates + assumptions panel slides open with `springSnap` motion. |
| **Each assumption row** | Hover: a slate background highlight + an inline pencil icon appears (future: edit-in-place; v1 the pencil opens a modal listing where to change the source value in-app). |

#### 6.8.3 Hover-preview tooltip on lever cards (Screen A, v2 polish — DEFERRED to a follow-up)

Optional richer hover state for the lever cards: after 400ms of sustained hover, surface a small contextual peek of what the user would see on Screen B with their current snapshot. Example for the Refinance card: "Your loans · $543,200 across 2 mortgages · last rate 6.25%". Anchored to the right or below the card.

**Decision (2026-06-04):** v1 ships without this peek. It's a nice-to-have that risks information overload on the picker — the lever's job is to invite a tap, not to show the answer. Re-evaluate after friendlies feedback.

#### 6.8.4 No-hover environments

Touch devices (mobile, tablet) don't fire hover. Equivalent affordances:
- Lever cards: tap = click-through (no preview peek). Press state = same depressed shadow as the hover state.
- Sliders: drag is the natural interaction; the value tooltip is permanently visible above the thumb while the thumb is being touched.
- Chart tooltips: tap-to-pin (Apple Stocks pattern). A second tap or scroll dismisses.
- Ghost pills: tap shows the tooltip for 3s, then auto-dismisses.

### 6.9 Mobile / tablet layout (load-bearing, 2026-06-04)

Phase 45 ships responsive from day one — the mobile composition is NOT an afterthought. Reza directive 2026-06-04: "consider mobile design as well."

#### 6.9.1 Breakpoints

Inherit the Phase 39 / Wealth Universe mobile breakpoints:
- **Mobile** — `< 768px` (`md:`) — phone portrait.
- **Tablet** — `768-1024px` — iPad portrait + small landscape.
- **Desktop** — `≥ 1024px` (`lg:`) — laptops + above.

#### 6.9.2 Lever picker — Screen A mobile

Container: stays warm ivory `#FAFAF7`. Mobile-shell sidebar already covered by `MobileTabBar` / `EditorialMobileDrawer` chrome at the bottom — Phase 45 content area sits between the topbar and the bottom tab bar.

Layout adjustments at `< md`:
- **Header**: same eyebrow + headline + explainer. Headline scales from `~38px` → `~28px` (Inter semibold). Max content width = `100%` minus 16-20px gutter.
- **Lever grid**: collapses to **single column**, full-width cards, vertical stack. Gap `16px`. Total six cards (5 real + 1 placeholder) rendered in this single column.
- **Each lever card** at mobile:
  - Same glass surface + 3px gradient top-accent strip + per-lever sub-palette gradient.
  - Internal layout shifts from "badge-top-row + title + subtitle + watermark" (desktop) to a **horizontal landscape composition** so each card stays compact (~120-140px tall instead of ~280px square):
    - Gradient icon badge sits **left** (44px square).
    - To the right: tiny uppercase gradient-text type label → lever title (16-17px) → muted subtitle (12-13px, 2 lines max).
    - Quiet "Open →" affordance at the bottom-right inside the card.
    - Watermark **smaller** (~80px instead of 140px) and still bleeding off the right edge — a touch-friendlier proportion at small width.
  - Press state (no hover): 100ms ease-out depress (`translateY(1px)` + slightly deeper shadow), then full-screen route transition on tap.

- **AFSL footer panel** at mobile: same glass card spanning the content width, but the icon stacks **above** the eyebrow (not beside it) at narrow widths; body text drops to 13px; the "→ Read the warning" link sits below the body, left-aligned.

#### 6.9.3 Lever detail — Screen B mobile

The two-column desktop layout collapses to single-column stack.

Order from top to bottom at `< md`:
1. **Breadcrumb row** — `← What if?` text button + lever gradient pill.
2. **Result hero** (was right column on desktop) — headline metric + 10-year trajectory chart. Promoted to the top so the user sees the **outcome first** on a small screen, even before they've tweaked the inputs. The chart is full-width, ~180-220px tall.
3. **Tax-position delta block** — directly below the chart. Compact pills.
4. **Inputs card** (was left column on desktop) — entity picker + slider(s) + sensible-default pills, all in one glass card. Slider thumb tooltip is permanently visible above the thumb (no hover-only state on mobile).
5. **"How we computed this" accordion** — collapsed by default. Tap to expand the assumptions panel.
6. **AFSL footer** — compact pinned-to-bottom-of-content variant.

Rationale (behaviour-psychology lens): on a phone, the user is more likely to be "exploring" than "configuring." Putting the result hero **first** at mobile gives the user immediate feedback as they tweak a slider below — they don't have to scroll up and down between input and output. Apple Numbers calculator follows this exact pattern on iOS.

#### 6.9.4 Tablet (768-1024px)

In-between: the lever picker collapses from 3-column → **2-column** grid. The lever detail stays two-column at `≥ md` but the columns are narrower; the trajectory chart sits to the right at the same height as the inputs, slider tooltips appear on touch.

#### 6.9.5 Mobile-specific motion + accessibility

- Spring snap on tap (Framer Motion `springSnap` per `components/shell/motion.ts`) for the lever-to-detail route transition.
- `safe-area-inset-bottom` honoured so the AFSL footer never collides with the system home-bar.
- All tooltip variants tap-to-pin on touch + tap-elsewhere dismiss.
- `prefers-reduced-motion`: route transitions degrade to opacity crossfade; slider tooltip stays fixed (no spring overshoot).

#### 6.9.6 Iteration discipline

Every Phase 45 Stitch generation MUST produce **both** a desktop and a mobile screen per surface. The iteration log (§6.6) gains a `Device` column:

| Date | Screen | Version | Device | Stitch screen ID | Notes |
|---|---|---|---|---|---|
| 2026-06-04 | A — Lever picker | v1 | DESKTOP | `2093dc0bec5e4656baf06596e0749232` | ❌ wrong vocabulary (Restrained Editorial flat) |
| 2026-06-04 | A — Lever picker | v2 | DESKTOP | `ed9fd957a19f4511842be0ef3ba29136` | ⚠️ first §18.7.2 attempt, no hover state, no mobile companion |
| 2026-06-04 | A — Lever picker | v3 | DESKTOP | `9a4fa51d1fee41698e34065d72cb8cb9` | First §6.8.1 hover state explicitly rendered (Card B Salary-sacrifice). Pending Reza review. |
| 2026-06-04 | A — Lever picker | v3 | MOBILE | `9664c0a2a86d4cd3bc2f3c62e90258b8` | First §6.9.2 landscape composition (single-column stack, ~130px tall per card). Pending Reza review. |


## 7. Composed engines — call graph

```
runWhatIfScenario(type, snapshot, params)
  ├─ Year 1 — runScenario(type, ctx, params) → existing Phase 40 scenario
  │     └─ returns { cashflowDelta, taxDelta, warnings, oneYearDelta }
  └─ Year 2-10 — tenYearProjection(snapshot, delta)
        ├─ per year: apply delta → cashflowOrchestrator() → masterTaxPosition()
        ├─ compose: netWorth[y] = netWorth[y-1] + savings[y] - taxPaid[y] + assetGrowth[y]
        └─ returns [{ year, netWorth, cashflowDelta, taxDelta }, ...]
```

The 10-year composer is the new piece. Per Reza decision, the existing scenarios stay 1-year impact only (they're shared with the Phase 40 AI advisor surface, which uses 1-year impact for its narration). Phase 45 wraps each with the 10-year composer.

## 8. Risks (load-bearing)

| Risk | Mitigation |
|---|---|
| Lever inputs sparse on user's snapshot (e.g. no rental yield data) | Sensible defaults from market median + clear "we assumed X" copy in the assumptions panel |
| 10-year projections compound assumption error | Assumptions panel surfaced (not hidden); explicit "this is a projection, not a forecast" copy; lever output never says "you will have" — always "if your assumptions hold, this trajectory would land at" |
| `Float` precision compounds over 10y | **Q-DEC migration runs first** (Reza decision 2026-06-01) |
| Info overload at 5 levers + sliders + chart + assumptions | Progressive disclosure: lever picker → focused detail screen (one lever at a time) |
| AFSL line drift | All copy reviewed against Q-HOOK-AFSL framework; "people-like-you-and-a-pattern" framing; General Advice Warning footer; no product/broker names |
| Salary-sacrifice scenario silently models illegal contribution | Concessional cap headroom check at function entry; returns `UNCOMPUTED` + warning when over-cap (mirrors Phase 41E `trustMinimumTax.ts` pattern) |

## 9. Acceptance criteria

- [ ] All 5 levers render at `/dashboard/cfo/what-if/[lever]` with snapshot-defaulted inputs
- [ ] Each lever returns: year-1 cashflow impact + 10-year trajectory + tax-position delta
- [ ] Assumptions panel present on every lever (collapsed by default)
- [ ] General Advice Warning footer on every lever output
- [ ] Salary-sacrifice scenario returns `UNCOMPUTED` when input exceeds concessional cap headroom
- [ ] No new calc engine introduced (every output traces to existing primitives)
- [ ] Editorial palette throughout (no cosmos-* tokens on internal surface)
- [ ] Stitch designs committed to `.stitch/designs/what-if-*.{html,png}` BEFORE React port begins
- [ ] §12.14 reform-awareness applied to salary-sacrifice (FY-aware regime classification)
- [ ] All numbers traceable to canonical engine output via Q-DEC adapter layer
- [ ] No `Float`-derived projection numbers cross the API boundary (post Q-DEC)
- [ ] Tests: scenario contract tests + 10-year composer determinism tests + concessional-cap-guard tests

## 10. Open questions for v1

(none yet — Reza locked in palette + scope + Q-DEC sequencing via AskUserQuestion 2026-06-01)

## 11. Doc-sync (CLAUDE.md §16 — for every PR in this workstream)

Each PR MUST update:
- `IMPLEMENTATION_PLAN.md` → workstream `0·WI` phase checkbox + Last touched
- `docs/changelog/CHANGELOG_YYYY_MM_DD.md` → session entry
- This file (`PHASE_45_WHAT_IF_SCENARIOS.md`) when scope/architecture clarifies
- `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §13.1 if salary-sacrifice scenario adds a new consumer of the reform discipline (probable)
- `docs/architecture/06_UI_UX_FOUNDATION.md` if the lever-picker / detail-screen patterns become reusable
