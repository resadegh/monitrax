# 🎨 **06 — UI / UX FOUNDATION**  
### *Systemwide Design Language, Interaction Model & Component Architecture for Monitrax*

---

# **1. Purpose of This Document**

This section defines the **foundational UX principles**, **global interaction patterns**, and the **unified component architecture** that power the entire Monitrax platform.

It ensures:

- Every page follows predictable interaction rules  
- Every module uses consistent UI components  
- Every feature follows a shared mental model  
- All new features scale horizontally across the platform  

This is the contract for **how Monitrax should look, behave, and feel**.

---

# **2. Design Philosophy**

### **2.1 Clarity Over Cleverness**
Every screen must instantly communicate:

- What this page is  
- What the user can do  
- What the system is telling them  

Zero cognitive fog.

### **2.2 Predictable Interaction Rules**
Users should never wonder:

- “What will happen if I click this?”  
- “How do I get back?”  
- “Where did my last screen go?”  

Predictability = perceived stability.

### **2.3 Financial Calm UI**
Fintech can be overwhelming — the interface must intentionally feel:

- Clean  
- Uncluttered  
- Soft-toned  
- Stable  
- High-trust  

### **2.4 No Dead-Ends**
Every dialog, card, and insight must provide:

- A follow-up action  
- A recommended path  
- A link or insight to move forward  

Dead-ends kill user flow.

---

# **3. Layout Foundation**

## **3.1 DashboardLayout**
The global layout includes:

- **Header**
  - Breadcrumb Bar
  - Global Health Indicator
  - User menu
- **Sidebar**
  - Primary navigation
  - System Health Widget
  - Insights Summary
- **Main Content Area**
  - Module content
  - Tables, analytics, forms

Sidebar behavior:

- Collapsible  
- Auto-expanding on hover  
- Static width on desktop  
- Drawer mode on mobile  

---

# **4. Global Components (UI Baseline)**

Monitrax uses a tightly curated design system:

### **4.1 Core UI Set**
```
Button
Input
Select
DropdownMenu
Tabs
Dialog
Modal
Sheet
Tooltip
Badge
Card
Skeleton
Accordion
Avatar
ProgressBar
```

### **4.2 Interaction Rules**
- Buttons must have clear hierarchy:
  - **Primary** = action
  - **Secondary** = safe / neutral
  - **Tertiary** = link-like, low-emphasis  
- Hover states = soft shadows, subtle lift  
- Focus states = accessible, thick highlight ring  

---

# **5. Table Architecture (Critical)**

Monitrax is heavily table-driven. Every table uses the same ground rules:

### **5.1 Table Rules**
- Must be virtualized for large datasets  
- Must support:
  - Infinite scroll OR pagination
  - Sorting
  - Filtering
  - Column visibility toggles
  - Row selection  
- Row click opens detail dialog  
- Linked entities show “Open in context” entry points  

### **5.2 Row Loading State**
Every table uses **SkeletonRows** during async loading.

### **5.3 Truncation Rules**
Text must truncate gracefully with:

```
text-ellipsis
max-width constraints
tooltip on hover
```

---

# **6. Dialog & Modal Foundation**

The defining component of Monitrax.

### **6.1 Entity Dialog**
Every entity dialog MUST include:

```
Header: entity name + type badge
Tabs:
   - Overview
   - Linked Data (Phase 8)
   - Insights (Phase 9)
   - Actions
Body: content according to each tab
Footer: contextual actions
```

### **6.2 State Preservation**
Dialogs preserve:

- Last opened tab  
- Scroll state  
- Fields in progress  
- Relationship context from CMNF  

### **6.3 Dialog Size Standards**
- **Standard entity dialog**: 720–960px width  
- **Wide analytics dialog**: 1200px  
- **Critical modal**: narrower, center-locked  

---

# **7. Navigation Visual Language**

### **7.1 Breadcrumb Bar**
- Dynamic based on CMNF  
- Collapses middle segments on long paths  
- Left side: Back button  
- Right side: Contextual actions  

### **7.2 Global Health Indicator**
Color-coded badge with severity:

- Green: Healthy  
- Yellow: Minor issues  
- Orange: Structural issues  
- Red: Critical data failures  

Tooltip shows:

- Completeness score  
- Missing links  
- Orphaned entities  
- Worst offending modules  

Modal opens with full health diagnostics.

---

# **8. Insights Visual Framework (Phase 9)**

### **8.1 Insight Card Design**
Must include:

- Severity badge  
- Description  
- Affected Entities  
- Recommended Fix  
- CTA Buttons  
  - "Fix Now"  
  - "Open Entity"  

### **8.2 Severity Colors**
- **Critical** → Red #DC2626  
- **High** → Orange #EA580C  
- **Medium** → Amber #F59E0B  
- **Low** → Blue #3B82F6  

### **8.3 Dashboard Insights Feed**
Lives on the main dashboard:

- Grouped by severity  
- Auto-refresh  
- Collapsible lists  

---

# **9. Form Behavior Standards**

### **9.1 Form Rules**
- All forms auto-save where possible  
- Save button disabled unless changes exist  
- Required fields visually indicated  
- Inline validation only — no modal errors  

### **9.2 Error Display**
Errors display as:

```
Red text under the field
Red border
Optional tooltip
```

### **9.3 Success Behavior**
- Green highlight  
- Fade-out confirmation  
- Never interrupt user with full-screen success dialogs  

---

# **10. Notifications & Feedback**

### **10.1 Toasts**
- 3–4 seconds  
- Non-intrusive  
- Max 3 stacked  

### **10.2 Warning Ribbon**
Triggered by linkage-health:

- Shows at top of layout  
- Opens Health modal  
- Always contextual  

---

# **11. Accessibility & Motion Principles**

### **11.1 Accessibility**
- Minimum WCAG AA  
- Keyboard navigation everywhere  
- High-contrast mode planned  

### **11.2 Motion**
- Small, purposeful animations  
- Dialog entry: fade + slight upward motion  
- Button hover: micro-lift  
- Table insertions: gentle fade  

No flashy motion. Fintech ≠ carnival.

---

# **12. Mobile & iPad Navigation Standard (Phase 14.6)**

> **Canonical standard.** This section is the contract for how Monitrax
> looks and behaves on phones and tablets. Every future mobile/tablet
> change refers back here. The theme (brand tokens, glass tile language,
> `appleEase` motion) is the same on every tier — only the nav chrome
> rearranges.

> **SSOT files:**
> - **Nav structure:** `lib/navigation/trailNav.tsx` (`trailNavItems`,
>   `mobileTabBarItems`, `mobileMoreItems`, `TRAIL_STAGE_TONES`,
>   `findActiveNavItem`, `findActiveMobileTab`, `isNavItemActive`).
> - **Mobile primitives:** `components/shell/MobileTabBar.tsx`,
>   `components/shell/SectionTabsRow.tsx`,
>   `components/shell/MoreSheet.tsx`.
> - **Layout shell:** `components/DashboardLayout.tsx` (composes the
>   sidebar, mobile header, MobileTabBar, SectionTabsRow, MoreSheet).
> - **Motion vocabulary:** `components/shell/motion.ts` (`appleEase`,
>   `springSnap`, `useReducedMotionSafe`).

### **12.1 Three-Tier Viewport Model**

Three tiers, not two. Tablet is its own first-class tier — iPad portrait
(810px) gets the desktop sidebar, not the phone bottom bar.

| Tier | Tailwind | Pixel range | Primary nav | Sub-tab nav |
|---|---|---|---|---|
| **Phone** | `<md` | `<768px` | `<MobileTabBar />` (5-tab bottom bar) | `<SectionTabsRow />` (iOS-style segmented control fixed below the brand header) |
| **Tablet** | `md`–`lg` | `768`–`1023px` | Persistent left sidebar (same component as desktop) | Sidebar-accordion (parent expands when active) |
| **Desktop** | `≥lg` | `≥1024px` | Persistent left sidebar | Sidebar-accordion |

The Tailwind `md:` breakpoint (768px) is the gate. `<md` = phone tab bar
mode; `md+` = persistent sidebar. There is no separate tablet stylesheet,
no separate tablet component tree — iPad simply sees the desktop layout
at narrower content width.

### **12.2 Phone Layout Anatomy**

```
┌──────────────────────────────────┐
│  [avatar]   Monitrax    [⌕] [☼]   │  ← Mobile header (h-14, brand-primary, fixed top)
├──────────────────────────────────┤
│  ┌─Balances─┬─Activity─┬─Struct─┐ │  ← <SectionTabsRow /> (segmented control, fixed)
│  └──────────┴──────────┴────────┘ │
├──────────────────────────────────┤
│                                  │
│        Page content (main)        │
│                                  │
│        pb-24 to clear tab bar     │
├──────────────────────────────────┤
│  🏠   👛   🎯   🏘   🧭            │  ← <MobileTabBar /> (5 tabs, fixed bottom)
│ Home Track Reduce Invest Guide   │
└──────────────────────────────────┘
```

**Header (`md:hidden`, `fixed top-0`, `z-40`).** Brand-primary background
(deep navy), height 56px (`h-14`), three-zone layout: avatar (left →
opens MoreSheet) · brand wordmark (centre, link to `/dashboard`) ·
search + theme (right). The hamburger pattern is permanently retired.

**Sub-tab segmented control (`md:hidden`, `fixed top-14`, `z-30`).**
iOS-style segmented control — single cohesive bar with equal-width
segments, internal hairline dividers, and one corner radius — fixed
just below the brand header so the two read as a single stacked
header zone. Apple-glass background (`bg-background/85
backdrop-blur-xl`). Renders only when the active TRAIL section has
`children`. Each segment is a `<Link>` (URL-routed; deep-linkable).
Active segment uses an elevated white-ish chip (`bg-background
shadow-sm ring-1`) with stage-tone text (`TRAIL_STAGE_TONES`). An
in-flow `h-14` spacer is rendered as a sibling so subsequent content
sits below the fixed bar.

**Bottom tab bar (`md:hidden`, `fixed bottom-0`, `z-30`).** Apple-glass
surface — warm-ivory backdrop-blur, 1px ring, soft inner highlight,
iOS safe-area-inset padding. Five tabs in a CSS grid (`grid-cols-5`).
Active tab uses stage-tone text + a 3px-tall top accent stripe (Apple
Wallet / Apple Music indicator pattern). Tap targets ≥56px.

**More sheet (`md:hidden`, dialog).** Triggered by avatar button.
Bottom-sheet chrome from §15.3 (rounded-top-28px, slide-in-from-bottom,
body-scroll lock, Esc to close). Holds: My Safety Net, My Household,
My Vault, Reports, Settings, Sign out.

### **12.3 Tablet + Desktop Layout (≥md)**

Persistent left sidebar (256px wide), full content area uses
`md:pl-64`. Mobile header is hidden (`md:hidden`). The sidebar renders
all 9 TRAIL items + Settings, with sub-tabs accordion-expanded under
the active parent — same code path that has shipped since Phase 14.5.

### **12.4 The 5 Mobile Tabs Are TRAIL**

The bottom bar IS the TRAIL framework. Each tab maps to a stage:

| Tab | Route | TRAIL stage | Tone (`TRAIL_STAGE_TONES`) |
|---|---|---|---|
| **Home** | `/dashboard` | — (journey overview) | brand primary fallback |
| **Track** | `/dashboard/balances` | T | slate |
| **Reduce** | `/cashflow` | R | amber |
| **Invest** | `/dashboard/properties` | I | emerald |
| **Guide** | `/dashboard/cfo` | L | violet |

**Anchor (My Safety Net) folds into MoreSheet** per
`TRAIL_FRAMEWORK.md` §5 — Anchor "is tracked through Financial Health
score + Guide recommendations, not a dedicated sidebar section." On
phones the limit of 5 tabs (Apple HIG ceiling) makes this fold
structural, not a compromise.

If a future change requires a 6th destination at the bottom bar, do NOT
add a 6th tab — the iOS HIG cap is hard. Move something into MoreSheet,
or argue (with the framework lens) that the new surface should replace
an existing tab.

### **12.5 Hard Rules**

1. **One nav SSOT.** `lib/navigation/trailNav.tsx` defines every
   nav-related constant (top-level items, sub-tabs, match-routes,
   stage tones, mobile-tab mapping, more-sheet items). Never inline a
   nav definition inside a component.
2. **Theme parity.** Phones, tablets, and desktop see the same brand
   tokens, glass tile language, typography stack, and motion vocabulary.
   The only thing that changes per tier is nav chrome.
3. **One-tap reach.** A phone user reaches any sub-tab in ≤2 taps from
   any starting page (1 tap for the bottom bar tab, 1 tap for the
   sub-tab segment). The two-step hamburger-drawer pattern is banned.
4. **`md:` is the desktop-sidebar gate.** Not `lg:`. iPad portrait
   (810px) gets the rail.
5. **Tap targets.** Bottom tab buttons ≥56px. Sub-tab segments ≥36px.
   FABs and modals ≥44px (Apple HIG).
6. **Sub-tab navigation is a fixed segmented control, not scrolling
   pills.** A header-style fixed bar at `top-14` reads as part of the
   header zone; scrolling pills read as page content. Three-to-four
   children fit cleanly at 100% width with equal-width segments — no
   horizontal overflow. If a future section ever needs >4 sub-tabs,
   reduce the section, don't reach for a scroll affordance.
7. **Dialogs become bottom sheets** on phones — §15.3 chrome reused, no
   parallel implementations.
8. **Bottom-fixed components must clear the tab bar.** FABs use
   `bottom-24` on phones (`md:bottom-8` on desktop). Sticky toolbars use
   `bottom-[64px]` on phones. iOS safe-area-inset is applied via
   `pb-[env(safe-area-inset-bottom)]` on the tab bar wrapper itself.
9. **`prefers-reduced-motion` is honoured everywhere.** Mobile-tab
   active scale, segmented control press scale, sheet slide-in — all
   gated by `motion-safe:` utilities.
10. **Reviewers MUST reject** any mobile surface that re-rolls the
    bottom-tab-bar, sub-tab segmented control, or bottom-sheet pattern
    instead of importing the canonical primitives from
    `components/shell/`. Same enforcement spirit as §15.10
    cross-surface alignment.

### **12.6 Tailwind Breakpoints (project-wide, unchanged)**

```
xs:  <480px       (rare — only for very dense phone tables)
sm:  480–640px
md:  640–1024px   ← phone/tablet boundary lives at the lower edge (768px)
lg:  1024–1440px
xl:  1440–1920px
2xl: >1920px
```

The `md:` breakpoint at 768px is the structurally important one — it
is the boundary between "phone bottom bar" and "tablet+ sidebar." Do
not introduce nav-altering breakpoints inside `sm:` or `lg:`.

### **12.7 Surfaces Not Yet Migrated**

Not every section page has Phase 14.6 sub-tab routes yet. Some still
use Radix `<Tabs>` (state-based, not URL-based). Migration is
incremental — when touching a section page, prefer URL-routed sub-tabs
so `<SectionTabsRow />` highlights the active segment correctly.
Tracking list lives in `IMPLEMENTATION_PLAN.md` 🟡 Active Workstream
"Phase 14.6".

### **12.8 Acceptance Criteria for "Mobile-Ready"**

A surface is mobile-ready when:

- It renders without horizontal scroll on any phone width ≥320px.
- All interactive controls meet the ≥44pt tap-target floor.
- Any modal renders as a bottom sheet (not a centred 480px dialog) on
  `<sm:`.
- Any sub-tab navigation reads from `<SectionTabsRow />` (URL-routed,
  fixed segmented control). New surfaces never re-roll the pattern.
- The page does not introduce a parallel implementation of any pattern
  documented in this §12 or §15.

---

---

# **13. UI Component Library Standards**

All components must:

- Be headless or low-level UI primitives  
- Be fully typed (TS)  
- Be fully controlled (no hidden internal state)  
- Have clear prop contracts  
- Be documented for reuse  

---

# **14. Practice (B2B2C) Surface — Phase 32B**

The professional surface (`/portal/*`) inherits the **same design tokens** as the consumer dashboard. No separate component library, no slate-900 admin look, no parallel typography stack.

**Commitments (added 2026-05-04):**

- **Tokens.** Brand primary (deep navy `#0B1220`), secondary (emerald `#16A34A`), accent (amber `#F59E0B`), warm-ivory background. Same as consumer.
- **Glass tile pattern.** `PracticeGlassCard` mirrors the Phase 39 Apple-Wallet tile language — 22px radius, 1px ring border at low opacity, white/85 backdrop-blur, soft inner highlight, hover lift via shadow + translate (skipped on `prefers-reduced-motion`).
- **TRAIL chip parity.** `TrailStageChip` uses the same stage-coloured palette as the consumer TRAIL banner (TRACK slate, REDUCE amber, ANCHOR indigo, INVEST emerald, LIVE violet). When a professional shares screen with a client, both literally see the same component.
- **Severity accents.** Critical = warm rose (`rose-400/80`), opportunity = mint (`emerald-400/80`), milestone = sky (`sky-400/80`). Applied as a 3px left strip on alert cards, not as a fill.
- **Tabular numerics.** Every numeric column uses `tabular-nums` so columns align across rows.
- **Drill-in is the consumer dashboard.** Professional drilling into a client renders `app/dashboard/*` verbatim with a `viewerContext` prop tree and an adviser overlay docked right (desktop) / bottom-sheet (mobile). NOT a separate `ClientDetail.tsx`. This commitment lands in PR3; PR1 ships the primitives + demo dataset only.
- **AFSL boundary in copy.** Alert text NEVER recommends a specific product or action. The platform surfaces the *trigger*; the professional generates the *recommendation*. Reviewers must reject any future copy that crosses this line.

**Where this pattern should be replicated next (per CLAUDE.md §3.1 design-system-change row):**
- Repaint of `components/portal/layout/PortalSidebar.tsx` and `app/portal/PortalLayoutClient.tsx` to brand tokens (PR2).
- Apply `PracticeGlassCard` + `TrailStageChip` to `app/portal/clients/page.tsx` and `components/portal/clients/ClientList.tsx` once the dashboard ships and validates the language (PR2/PR3).
- Retire `components/portal/ui/PortalCard.tsx` + `PortalButton.tsx` after the Practice surface stabilises (queued under `IMPLEMENTATION_PLAN.md` 🗑️ Dead Code if zero callers remain).

---

# **15. Acceptance Criteria**

Monitrax UI/UX foundation is correct when:

- All modules look cohesive and uniform  
- All interactions feel predictable  
- Navigation is seamless and contextual  
- Dialogs are the dominant interaction pattern  
- Health + insights panels behave identically everywhere  
- No module has “its own style”  

Consistency is the north star.

---

# **13. AFSL / TPB / NCCP Boundary Footnote Pattern (Phase 41e.0)**

Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §1(5) + §5 — Monitrax surfaces tax + financial calculations as **general information**, never personal advice. **Every UI surface that renders a tax-shaped number MUST end with the boundary footnote.**

### **13.1 Canonical component**

`components/tax/BoundaryFootnote.tsx`

```tsx
<BoundaryFootnote
  citations={[
    { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 'Div 1-6', lastReviewed: '2026-05-05' },
  ]}
  uncomputed={[
    { id: 'UC-FBT', rationale: 'FBT not computed ...' },
  ]}
  fyLabel="FY24-25"
  calculatedAt={taxPosition.metadata.calculatedAt}
/>
```

### **13.2 What it renders (in order)**

1. **FY context** — *"Figures for FY24-25."* (optional)
2. **Computed-per audit trail** — *"Computed per ITAA 1997 s4-10, ITAA 1997 Div 1-6."*
3. **UNCOMPUTED rows** — one per `UncomputedFlag`, with `AlertCircle` icon + amber colour. Plain-English rationale only — never the raw `UC-*` id.
4. **Boundary statement (bold)** — the canonical *"These figures are general information only — not personal financial, tax, or credit advice. Confirm with a registered tax agent (TPB), financial adviser (AFSL), or credit assistant (NCCP) before acting."*
5. **Last-calculated timestamp** (optional) — small + low-opacity.

### **13.3 The legal copy lives in ONE place**

`lib/tax-engine/boundaries/index.ts:BOUNDARY_STATEMENT`. Never hand-write the boundary phrase in JSX. If legal copy ever changes, every surface updates in lock-step from the constant.

### **13.4 When to use the compact variant**

Pass `compact` prop when rendering inside a tile / card with limited vertical space. Compact uses `text-[0.7rem]` and `space-y-1` instead of the standard `text-xs` + `space-y-2`. UNCOMPUTED rows still render — never collapse the disclosure to save space.

### **13.5 Surfaces that MUST render the footnote**

- ✅ `/dashboard/tax` — full footer at page bottom (replaces the old free-text Disclaimer block as of 41e.0 slice D)
- 🟡 `/dashboard/cfo` — every AI-generated tax recommendation card (queued — wire up when slice 41e.1 lands per-entity figures)
- 🟡 `/dashboard/entities` Money Flow tab — under the Sankey canvas (queued — replaces the v1 "Annual reference period. Tax allocated proportionally..." caveat once 41e.4 ships Div 6E streaming)
- 🟡 `/portal/clients/[id]/view` — adviser drill-in tax surface (queued — adviser context needs the same boundary because read-only ≠ scope-of-advice)

The matrix expands as 41e.1+ surfaces land. Reviewers reject any new tax-shaped surface that doesn't include `<BoundaryFootnote />`.

---



---

# **15. Phase 32B/32C/33g — B2B2C UI Patterns**

*Added 2026-05-09 (doc-catch-up).* The Practice surface introduced a
distinct visual vocabulary alongside the existing consumer surface.
Patterns here are reusable across the new B2B2C modules
(`/portal/dashboard`, `/portal/clients`, `/portal/marketplace`,
`/portal/requests`, `/portal/conversations`, `/portal/billing`,
`/portal/feedback`) and should be referenced — not re-invented — for
new surfaces in the same domain.

## **15.1 PracticeGlassCard** (`components/portal/practice/PracticeGlassCard.tsx`)

The canonical surface for Practice tiles. Apple-glass aesthetic per
CLAUDE.md §0 designer lens: **warm-ivory background, 28px corner
radius, 1px ring border at low opacity, subtle inner highlight at
the top, hover lift via shadow + scale (skipped on
`prefers-reduced-motion`)**. No heavy drop-shadow — depth reads from
the ring + gradient, not from a halo.

Props: `padding` (none/sm/md/lg), `interactive` (true triggers hover
lift), `accentTone` (`'critical' | 'opportunity' | 'milestone' | null`
— renders a 4px-wide vertical accent strip on the left edge).

Reusable across every Practice tile + `<MarketplaceListingEditor>` +
`<LeadFeeInvoiceHistory>` + adviser inbox cards. **Do not re-invent**
— if the new surface needs Apple-glass, use this primitive.

## **15.2 Status pill colour vocabulary**

Consistent across the B2B2C surface so the status family is recognisable
at a glance:

| Status family | Tone | Tailwind classes |
|---|---|---|
| **Active / Healthy / Approved / Paid** | Emerald | `bg-emerald-50 text-emerald-800 ring-emerald-200` |
| **Pending / Awaiting / Trialing** | Amber | `bg-amber-50 text-amber-800 ring-amber-200` |
| **Trialing / Info** | Sky | `bg-sky-50 text-sky-800 ring-sky-200` |
| **Rejected / Failed / Critical** | Rose | `bg-rose-50 text-rose-800 ring-rose-200` |
| **Closed / Suspended / Voided / Withdrawn / Neutral** | Slate | `bg-slate-100 text-slate-700 ring-slate-200` |

Pill base: `inline-flex items-center rounded-full ring-1 ring-inset
px-2.5 py-0.5 text-[11px] font-medium`. Use the same pill chrome
across **every** status surface — listing status, request status,
subscription status, conversation closed-state, lead-fee invoice
status, feedback status. Future surfaces follow this vocabulary;
don't invent new status colours.

## **15.3 Slide-in / bottom-sheet dialog pattern**

`<AskAProfessionalDialog />`, `<ComposeRequestDialog />`,
`<HelpDrawer />` all share the same dialog chrome:

- **≥sm:** right-edge slide-in ~480px
- **<sm:** bottom-sheet 90vh with `rounded-t-[28px]`
- Sticky header with title + dismiss X
- Body-scroll lock on the document for iOS Safari
- Esc to close, backdrop click to close
- `prefers-reduced-motion`-aware via Tailwind `motion-safe:*` utilities (NOT framer-motion — keeps the bundle lean)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the title

Animation: `motion-safe:animate-in motion-safe:fade-in
motion-safe:slide-in-from-bottom motion-safe:sm:zoom-in-95
motion-safe:sm:slide-in-from-bottom-0 duration-200`.

Don't pull `framer-motion` for new dialogs in this family — the
Tailwind motion utilities cover the surface area we need.

## **15.4 Conversation thread chrome** (`components/conversations/ConversationThread.tsx`)

Reusable across portal + dashboard surfaces. Header (subject + counterparty)
+ message list + composer + 7yr archive disclosure footer. Polls
every 5 seconds for new messages. Optimistic-add on send with
rollback on failure. Scroll-to-bottom on new message + initial mount.
⌘/Ctrl+Enter to send. Channel badges (`IN_APP` / via email / from
email) on each message.

**Never** introduce a parallel conversation thread component for
new surfaces; reuse `<ConversationThread />`. The component takes
`viewerRole` ('CONSUMER' | 'PROFESSIONAL'), `viewerName`,
`counterpartyName`, `isClosed`, `onSent` callback. Both sides of
the thread render the same component with different perspective
props.

## **15.5 Compose dialog with AI starter prompts**

`<ComposeRequestDialog />` is the canonical pattern for any user-input
form that benefits from AI-suggested starters. Sticky header + body
+ context-aware AI starter prompts (10 contexts × 1-3 starters each)
+ free-text textarea + opt-in metadata-share checkbox + submit
button.

The starter-prompts pattern is reusable: when a future feature wants
to lower friction on a free-text input by offering common starting
points, copy the `STARTERS_BY_CONTEXT` map structure + the
button-row UI (rounded-lg gray pills that populate the textarea on
click).

## **15.6 Plan tile pattern** (`/portal/billing`)

Three-column tile grid for subscription plans. Each tile carries:
- Tier name + Recommended pill (emerald) on the recommended tier
- Headline price (24px, tabular-num) + frequency caption
- Feature checklist with `✓` markers (emerald-600 bullets)
- OWNER-only Subscribe button with `disabled` if not owner
- "Current plan" disabled-emerald state when this is the active tier
- Enterprise tile uses `mailto:sales@monitrax.com.au` instead of the Subscribe button

Reusable for any future tier-comparison surface (e.g. a future
add-on packs surface).

## **15.7 Channel badge** (used on conversation messages + invoice rows)

Small inline indicator that this row originated from a non-default
channel. Examples:
- "via email" on conversation messages bridged through SendGrid
- "from email" on conversation messages received through Inbound Parse
- "Test mode" on Stripe customer / subscription rows in dev/demo

Visual treatment: pill `inline-flex items-center rounded-full
bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 text-[10px]
font-medium text-amber-800` — small enough that screen-readers
treat it as a label, not a button. Auditors notice; users barely do.

## **15.8 Empty-state copy guidance**

Empty states across the B2B2C surface follow this pattern:
1. **Affirming** — *"No active conversations yet."* (not *"You have nothing"*)
2. **Educational** — *"Conversations are auto-created when you accept a marketplace request."*
3. **Actionable** — *"Open inbox →"* (links to the surface where they'd take the next step)

Never use *"Nothing to see here"* / *"Empty"* / *"You haven't done X
yet"*. Per CLAUDE.md §0 behaviour-psychology lens — surface helps
the user act, doesn't shame them for not having acted.

## **15.10 Shared shell layer (Phase 32-design-A1)**

Canonical reusable primitives at `components/shell/`:
- `GlassHero` + `GlassHeroEyebrow` / `GlassHeroHeadline` /
  `GlassHeroKpiCell` — `rounded-[28px]` glass surface with
  configurable atmosphere (`sky` | `emerald` | `amber` | `rose` |
  `slate`), breathing-glow, gradient-text headline, KPI cells. Honours
  `prefers-reduced-motion` from day one.
- `MetricTile` + `MetricTileHeadline` — `rounded-[22px]` atmospheric
  tile with tone families (`sky` | `emerald` | `amber` | `rose` |
  `violet` | `slate`), filled-silhouette glyph watermark slot, springy
  hover lift, staggered entry.
- `PortalPageHero` — thin wrapper around `GlassHero` for non-dashboard
  portal page headers (clients, conversations, requests, marketplace,
  billing, team, integrations). Composes the eyebrow + greeting +
  practice-label badge + page title + subtitle + optional actions
  pattern. Use this for any new portal surface that needs a page
  header. Each page picks its `atmosphere` to encode emotional fit:
  sky for engaged data, emerald for healthy/management, amber for
  billing/payments, rose for inbox/attention, violet for
  conversations/integrations.
- `motion.ts` — single source of truth for `appleEase`
  `[0.25, 0.46, 0.45, 0.94]`, `springSnap` (stiffness 320 / damping 28
  / mass 0.8), `tileEnter(index)` (0.55s with 40ms stagger),
  `heroEnter`, `breathingGlow`, `useReducedMotionSafe()`. **Any new
  Monitrax surface that wants to feel like the consumer app imports
  from here — DO NOT redefine `appleEase` locally.**
- `practiceGlyphs.tsx` — companion to `wealthGlyphs.tsx` for the
  Org-Portal domain (`ClientsGlyph` / `RequestsGlyph` /
  `ConversationsGlyph` / `AnalyticsGlyph` / `HealthGlyph`). Same rules:
  `viewBox 0 0 120 120`, `fill="currentColor"`, no strokes,
  `preserveAspectRatio="xMaxYMid meet"`, single closed silhouette.

### Cross-surface alignment policy

| Surface | Policy |
|---|---|
| Consumer (`app/dashboard/*`) | Currently has its own copies of the same patterns (Phase 39 wealth tiles + heroes). Will migrate to `components/shell/` in a follow-up PR. Do NOT duplicate the patterns again. |
| Org Portal (`app/portal/*`) | **Aligns to consumer language via `components/shell/*`.** Phase 32-design-A1 ships dashboard hero + 3 click-through MetricTiles. Other portal pages propagate one-PR-at-a-time. |
| Admin Portal (`app/admin/*`) | **Type-aligns only — does NOT adopt glass tiles.** Stays dense + dark + functional (Linear/GCP-Console aesthetic). Adopts canonical type scale, `tabular-nums` on every number, eyebrow `tracking-[0.18em]`, emerald focus rings, `appleEase` for any new transition. Glass-morphism on a dense ops console reduces scanability — wrong tool for the job. |

Reviewers MUST reject any PR that re-implements `appleEase` or
re-rolls the rounded-22px / rounded-28px glass tile pattern locally
instead of importing from `components/shell/`.

## **15.9 Accessibility checklist (B2B2C surfaces)**

Every interactive component in the B2B2C surface meets:
- `focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-emerald-500 focus-visible:ring-offset-1`
- ARIA `role="dialog"` + `aria-modal` + `aria-labelledby` on every
  modal
- Buttons have explicit `type="button"` (defensive against form
  submission default)
- Esc closes any modal that's open
- Body-scroll lock on iOS Safari for any modal that's open
- Native HTML controls preferred over custom (radio / checkbox /
  textarea / select — used in `MarketplaceListingEditor`,
  `ComposeRequestDialog`, `/portal/billing` plan tiles)

If a new surface introduces a custom interactive control, it MUST
re-implement these guarantees; reviewers reject PRs that don't.

---

# **16. My Settings IA contract (Settings overhaul 2026-05-08)**

The consumer Settings surface (`/dashboard/settings/*`) is organised as
**five mental-model groups**, not a flat list. The grouping reduces
the cognitive cost of finding the right control (Mani et al. 2013 —
financial stress reduces cognitive function by 13 IQ points; Settings
is the surface where users go when something already feels wrong).

| Group | Sub-pages | Mental model |
|---|---|---|
| **Me** | Profile · Appearance · Trusted contact | "Things about me" |
| **My money data** | Bank connections · Cloud storage · AI categorisation · Shares | "Where my data lives + who sees it" |
| **Privacy & safety** | Security · Two-factor auth · Privacy & CDR | "How my account is locked down" |
| **My notifications** | Notifications | "What I get pinged about" |
| **My plan** | Billing · API access | "What I'm paying for" |

The TRAIL warm-language rule (CLAUDE.md §14) applies: header reads
**"My Settings"** (not "Settings"), copy uses warm framing throughout.
Bank connections live in Settings, not on `/dashboard/accounts` — the
mental model is "stop sharing my bank with Monitrax", which is a
Settings operation.

**Right-to-erasure** is a 30-day soft-delete grace period (Privacy Act
APP 11.2 + CDR §3.2). The Delete-account surface always surfaces the
pending state with a Cancel button, not just the destructive request
button. Reviewers reject PRs that re-introduce a one-click hard-delete.

**Right-to-portability** is a JSON export from the Privacy & CDR page,
calling `GET /api/account/export`. The surface NEVER claims data is
permanently deleted by clicking Export — it's a read, not a write.

**Account-lifecycle reviewer rules:**

1. The Delete-account surface MUST always render with both states:
   pending-deletion banner with Cancel, OR neutral state with the
   destructive request button. A bare "Delete" button is a CLAUDE.md
   §16.3 violation (security / CDR posture changed without UI making
   the soft-delete contract visible).
2. New Settings sub-pages MUST land in one of the five groups above.
   If the proposed page doesn't fit, the IA conversation comes first
   — don't add a sixth group without §16.3 doc-sync.
3. The mock-UI rule: NEVER ship a Settings sub-page that pretends to
   work but doesn't. Mock UI in production damages trust faster than
   missing UI. If the feature isn't ready, ship an honest
   "Coming with Phase X" placeholder, not a fake.
