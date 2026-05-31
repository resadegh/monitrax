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
| **Phone** | `<md` | `<768px` | `<MobileTabBar />` (6-tab bottom bar — Home + 5 TRAIL stages) | `<SectionTabsRow />` (iOS-style segmented control fixed below the brand header) |
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
│  🏠  👛  🎯  🛡  🏘  🧭          │  ← <MobileTabBar /> (6 tabs, fixed bottom)
│ Home Track Reduce Anchor Invest Guide │
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
iOS safe-area-inset padding. Six tabs in a CSS grid (`grid-cols-6`) —
Home + the five TRAIL stages.
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

### **12.4 The 6 Mobile Tabs Are TRAIL — Colour Psychology Applied**

The bottom bar IS the TRAIL framework. Each tab maps to a stage AND
carries a dedicated hue chosen by colour psychology to *reinforce the
emotional state of the stage*. The colour identity is consistent
across every surface (mobile bar icon + sub-tab segmented control bar
hue + desktop sidebar icon), so the user is constantly reminded of
which TRAIL stage they're in.

| Tab | Route | Stage | Hue | Why (colour psychology) |
|---|---|---|---|---|
| **Home** | `/dashboard` | — | brand primary | Journey overview (no stage) |
| **Track** | `/dashboard/balances` | T | **Sky blue** | Trust, calm, clarity, no-judgment awareness — the user is *seeing* their full picture. Universal "I trust this" colour in fintech (Stripe, Mercury). Sky specifically: open, visible, nothing hidden. |
| **Reduce** | `/cashflow` | R | **Amber** | Action, energy, decisive movement. The user is *fixing leaks* — amber says "do this now" without the alarm of red. |
| **Anchor** | `/dashboard/safety-net` | A | **Indigo** | Depth, stability, anchored security. The user is *building safety* — deep blue evokes anchored waters, foundational depth. |
| **Invest** | `/dashboard/properties` | I | **Emerald** | Growth, prosperity, abundance. The user is *building wealth* — universal "money + nature + growing" colour. |
| **Guide** | `/dashboard/cfo` | L | **Violet** | Aspiration, freedom, transcendence. The user is *living on their terms* — violet evokes royalty, accomplishment, freedom. |

**Where the stage colour appears (consistent across all surfaces):**

1. **Active tab icon + label** — full-saturation `text-{tone}-600` on light theme, `text-{tone}-400` on dark theme.
2. **Inactive tab icon + label** — muted `text-{tone}-500/55` so the stage identity is visible at all times, not just on active.
3. **Top accent stripe** on the active tab — solid `bg-{tone}-500`.
4. **Sub-tab segmented control bar background** — subtle stage hue (`bg-{tone}-50/70`) so the chrome reads as belonging to the stage. Reza directive: *"even a hue background colour should be the same as each trail stage."*
5. **Desktop sidebar icon container** — when item is active, container fills with stage colour (`bg-{tone}-500 text-white`); when inactive, container shows muted stage hue. The TRAIL stage badge ([T]/[R]/[A]/[I]/[L]) follows the same pattern.

**The bar size is 6 (Home + 5 TRAIL stages).** Apple HIG suggests ≤5
tabs on native iOS tab bars; Monitrax is a web app where the TRAIL
journey *is* the IA — keeping all five stages visible end-to-end is
more important than the native ceiling. At 320px viewport width
(smallest iPhone), 6 equal-width tabs give each tab ~53px which
comfortably fits a 22px icon + 6-character label at 10px tracking.

**The bar is locked at 6.** Adding a 7th tab is forbidden — the
TRAIL framework has exactly five stages plus Home, and any future
destination must either replace an existing tab (with explicit
framework-level justification) or live in MoreSheet. Reviewers MUST
reject any PR that grows the bar past 6 without a corresponding
TRAIL_FRAMEWORK.md update signed off by Reza.

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
  `violet` | `indigo` *(added Phase 43, 2026-05-09 — for the Anchor
  TRAIL stage; tones tuned to match `TRAIL_STAGE_TONES.A`
  in `lib/navigation/trailNav.tsx`)* | `slate`), breathing-glow,
  gradient-text headline, KPI cells. Honours `prefers-reduced-motion`
  from day one.
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

### Canonical hero — `MoneyStoryHero` (Phase 43, 2026-05-09)

`components/dashboard/MoneyStoryHero.tsx` is the canonical
**orientation hero** on `/dashboard` Home — a 3-line personal-P&L
scoreboard (Earned · Kept · Free today) translated from Jason Andrew's
Stark Naked Numbers hierarchy into TRAIL T → R → A.

**Composition rules (NON-NEGOTIABLE):**
- Composes `<GlassHero atmosphere="…">` + `<GlassHeroEyebrow>` +
  `<GlassHeroHeadline>` + `<GlassHeroKpiCell>` from
  `components/shell/`. **No local re-implementation** of the
  rounded-28px glass surface, the mesh atmosphere, the breathing
  glow, or `appleEase` — all of those come from the shell layer
  (§15.10 above).
- The component is **pure presentational**. It takes 8 props (`earned`,
  `kept`, `keptMargin`, `freeToday`, `freeDays`, `taxWithheld`,
  `surplus`, `enoughHistory`, `trailStage?`) and renders. **It computes
  nothing.** Any derived number must be added to
  `MasterFinancialSnapshot.quickMetrics` first, then read through
  (CLAUDE.md §6.1, §12.2 SSOT).
- **Stage colours pinned to `TRAIL_STAGE_TONES`** in
  `lib/navigation/trailNav.tsx` (T=sky, R=amber, A=indigo, I=emerald,
  L=violet). The atmosphere prop AND the headline gradient AND the
  drill-down destination all rotate with `trailStage`. All three
  scoreboard lines always render (guided, not gated, CLAUDE.md §14.3).
  Reviewers MUST reject any change that drifts the hero's stage
  colours away from the SSOT.
- **The Money Story Bar** (3-segment proportional visualisation —
  Tax · Spent · Saved) renders between the headline copy and the KPI
  cells. Behavioural-psychology contract (loss-aversion-safe slate
  palette, emerald reserved for Saved as the Bandura victory tone,
  System-1 spatial encoding) is documented in
  `PHASE_43_MONEY_STORY.md` §5a. Reviewers MUST reject any change that
  introduces red on the bar, more than three segments, or repurposes
  the emerald victory tone.
- **Drill-down (Principle 3.2)**: the entire hero is wrapped in a
  `<Link>` routing to a stage-appropriate detail page (T →
  `/dashboard/balances`, R → `/dashboard/budget-analysis`, A →
  `/dashboard/safety-net`, I/L → `/dashboard/cfo`). The drill-down
  label appears in the eyebrow row with an `ArrowUpRight` glyph so the
  surface always reads as interactive.
- **`enoughHistory` gate**: when `monthlyExpenses === 0`, replace the
  per-day display ("47 days of life") with "Truly liquid right now".
  False precision is worse than missing precision.

**Tone discipline:** Andrew's words *vanity / sanity / reality* are
deliberately NOT used as line labels. The hierarchy is borrowed; the
brutality is left at the door. The 24% AU-household-savings-rate
comparator is normalising-not-judgemental copy. Reviewers MUST reject
any change that adopts the book's brutal voice — the math is sharp,
the language is kind.

**SurfaceDescriptor (Phase 41i.6 pending):** when the
`lib/calc-audit/surfaces/` registry ships (Phase 41i.6a), the hero
MUST register a descriptor mapping its 5 rendered fields to their
`quickMetrics` source paths. Until then the contract is enforced by
code review — see `docs/blueprint/PHASE_43_MONEY_STORY.md` §6 for the
exact shape. **Reviewers MUST reject** any PR that adds inline math to
`MoneyStoryHero` instead of routing through `quickMetrics`.

Spec: `docs/blueprint/PHASE_43_MONEY_STORY.md`. TRAIL framework
context: `docs/blueprint/TRAIL_FRAMEWORK.md` §5 ("The 3-line scoreboard
pattern").

### Canonical analytical card — `HiddenWealthLens` (Phase 43.1, 2026-05-09)

`components/balances/HiddenWealthLens.tsx` is the canonical
**typography-led analytical card** on `/dashboard/balances`. Translates
Andrew's *"the balance sheet is where all the cash is hiding"* into a
three-bucket accessibility view of Total Assets:

- **Liquid Today** — cash + offsets (24-hour access)
- **Accessible** — shares / ETFs / managed funds (~days, CGT applies)
- **Locked Long-Term** — property equity + super + personal assets

**Composition rules (NON-NEGOTIABLE):**
- **Typography-led, not a glass card.** The page already has a
  minimalist Net Position hero; introducing `<GlassHero>` would clash
  visually. Subtle border + faint background only
  (`rounded-3xl border border-foreground/[0.06] bg-foreground/[0.015]`).
- **The component is pure presentational.** 6 props in (`liquidToday`,
  `accessible`, `lockedLongTerm`, `netWorth`, `totalAssets`,
  `breakdown?`); JSX out. **Computes nothing.** Bucket percentages,
  rounding, and copy variants are derived inside the render — but
  every $-amount must come from `/api/dashboard/hidden-wealth`, which
  is a thin wrapper around `getMasterFinancialSnapshot()`.
- **No fields added to `quickMetrics`** (D-43.1-2 — promote-on-second-
  use, not on speculation). The bucket terminology is presentation-
  layer specific; coupling the calc layer to a UI taxonomy would
  invert the architecture.
- **Self-hides when `totalAssets ≤ 0`.** A fully-grey bar would
  misinform.
- **3-segment proportional bar palette: emerald → sky → slate.**
  Emerald reserved for Liquid as the Bandura victory tone (reaching
  cash *is* the small win). Sky for Accessible (calm, can-act). Slate
  for Locked (neutral foundation). **No red anywhere** — loss aversion
  is built into the colour choice.
- **Emerald-reservation rule scope clarification:** the rule registered
  in `PHASE_43_MONEY_STORY.md` §5a ("emerald reserved for Saved") is
  scoped to the Money Story Bar component. `HiddenWealthLens` and
  `MoneyStoryHero` never co-render (different pages); emerald can
  carry "victory/access" semantics on this surface without conflict.
  Reviewers MUST reject any change that introduces red on either bar.
- **Reduced-motion-safe** segment-fill animation (left-anchored
  `scaleX` 0.7s `appleEase`, suppressed under `prefers-reduced-motion`).

**SurfaceDescriptor (Phase 41i.6 pending):** when the
`lib/calc-audit/surfaces/` registry ships, register a descriptor
mapping each rendered $-amount to its source path
(`quickMetrics.liquidCash`, `investments.totalValue`,
`propertyPortfolioEquity`, `netWorth.assets.superannuation`,
`netWorth.assets.personalAssets`). Until then enforced by code review.

Spec: `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md`.

### Canonical analytical card — `SpendingParetoLens` (Phase 43.2, 2026-05-09)

`components/expenses/SpendingParetoLens.tsx` is the canonical
**Pareto-cut focus list** on `/dashboard/expenses`. Surfaces the
*vital few* spending categories driving ~80% of monthly outgoings —
Andrew's *"fire your worst 20% of customers"* (Stark Naked Numbers)
inverted for personal finance.

**Composition rules (NON-NEGOTIABLE):**
- **Same family as `HiddenWealthLens`** — typography-led, subtle
  border + faint background, no glass tile. Sits below `<PageHeader>`
  on `/dashboard/expenses`. Reviewers MUST reject any change that
  introduces a glass card here without first updating this section.
- **The component is pure presentational.** Takes 8 props (`vitalFew`,
  `vitalFewTotal`, `vitalFewPct`, `trivialMany*`, `totalMonthlySpend`,
  `totalCategoryCount`); JSX out. **Computes nothing** — the Pareto
  cut happens in `/api/dashboard/spending-pareto`, which reads
  `snapshot.expenses.monthly.byCategory`.
- **`MAX_VITAL_FEW = 8` guardrail in the route, not the component.**
  If 80% is spread across 30+ categories, the user doesn't have a
  Pareto problem to focus on; the lens caps the displayed list at 8
  even if cumulative hasn't hit 80% yet.
- **Inline mini-bars per row, not a chart.** Width is
  `pct ÷ maxPct × 100` so the #1 category fills 100% of its row's
  bar; everything scales proportionally. Single colour
  (`bg-slate-500/80`); no segmentation, no axis, no legend.
- **No red anywhere, even at 50% concentration.** Even a category at
  50% of monthly spend renders in slate. The Pareto framing is
  *focus*, not *failure* (Kahneman & Tversky loss aversion).
- **Locus-of-control closing copy** — *"the highest-leverage spending
  review you can do"*. The user is the actor, the lens just points
  at the leverage. Never prescriptive ("you should cut X").
- **Self-hides when `vitalFew.length === 0`** — empty state is
  silence, not a placeholder.
- **Reduced-motion-safe** mini-bar reveal animation.

**Behavioural-psychology contract** (full citations in
`PHASE_43_2_SPENDING_PARETO.md` §5):
- Cognitive ease (4 lines vs 30 — Kahneman, *Thinking Fast and Slow*).
- No red anywhere — Pareto as opportunity, not verdict (Kahneman &
  Tversky).
- Locus-of-control framing (Bandura self-efficacy + Rotter).
- Concreteness (numbered list + dollars + percentages — Heath & Heath).
- Pareto framing as opportunity not verdict — even at 95%
  concentration, copy stays neutral.

**SurfaceDescriptor (Phase 41i.6 pending):** when the
`lib/calc-audit/surfaces/` registry ships, register a descriptor
mapping each rendered $-amount to its source path
(`snapshot.expenses.monthly.byCategory[i].amount` /
`snapshot.expenses.monthly.byCategory[i].category`). Until then
enforced by code review.

Spec: `docs/blueprint/PHASE_43_2_SPENDING_PARETO.md`.

### Canonical analytical card — `MarginTrendLens` (Phase 43.3, 2026-05-09)

`components/budget/MarginTrendLens.tsx` is the canonical
**savings-rate trend card** on `/dashboard/budget-analysis`. Surfaces
the user's monthly net-cashflow + savings-rate trend over the last 6
months as a pure-SVG sparkline + delta-from-last-month — Andrew's
*"the direction of your GP margin matters more than the absolute"*
(Stark Naked Numbers, Principle 2) translated to personal finance.

**Composition rules (NON-NEGOTIABLE):**
- **Same family as `HiddenWealthLens` + `SpendingParetoLens`** —
  typography-led, subtle border + faint background, no glass tile.
  Reviewers MUST reject any change that introduces a glass card here
  without first updating this section.
- **The component is pure presentational.** Takes 8 props (`months`,
  `current`, `previous`, `savingsRateDelta`, `netCashflowDelta`,
  `trend`, `enoughHistory`, `monthsWithIncome`); JSX out.
  **Computes nothing** — the trend direction, sliding-window math,
  and delta calculations all happen in
  `/api/dashboard/margin-trend`, which queries
  `prisma.unifiedTransaction` directly. Lens does pathbuilding only.
- **Pure-SVG sparkline, no chart library.** ~60 lines of pathbuilding
  (`buildSparkPath`) emit a line `<path>` + a faint area-fill
  `<path>` + a last-point `<circle>`. Recharts / Chart.js / D3
  would add 200KB+ of bundle for the same visual; the existing
  `<NetWorthTrend>` precedent (`components/dashboard/NetWorthTrend.tsx`)
  set the same rule. Reviewers MUST reject any chart-library import
  for sparklines on Monitrax surfaces.
- **Self-hides when `enoughHistory === false`.** The route gates this
  at `monthsWithIncome >= 3` — drawing trend lines on 1–2 months is
  dishonest. Same family of false-precision guardrails as
  `HiddenWealthLens` (`totalAssets ≤ 0`) and `SpendingParetoLens`
  (`vitalFew.length === 0`).
- **No red anywhere.** Down trend is **amber**, never `red-*`.
  Kahneman & Tversky loss aversion: red on a trend that swings
  5pp month-on-month is panic-inducing for an honest fluctuation.
- **Trend palette discipline.** Emerald (up — Bandura victory tone),
  amber (down — loss-aversion-safe), slate (flat — neutral). Same
  family as the rest of the Stark-Naked-Numbers stack. Reviewers
  MUST reject any change that introduces red, or that uses emerald
  for non-positive trend states.
- **Reduced-motion-safe** — path-draw + area-fade + last-point-pop
  animations all suppress under `prefers-reduced-motion`; the line
  still renders.

**Behavioural-psychology contract** (full citations in
`PHASE_43_3_MARGIN_TREND.md` §5):
- Direction-over-absolute framing (Andrew, Stark Naked Numbers).
- Loss aversion (Kahneman & Tversky) — no red.
- Self-efficacy (Bandura) — sparkline + dot reinforce capability.
- Locus of control (Rotter, Bandura) — closing copy never
  prescriptive; the user is the actor.
- Narrative-fallacy resistance (Kahneman) — up-trend copy is
  *measured*, never celebratory.
- Concreteness (Heath & Heath) — dual-axis honesty (savings-rate
  points + net cashflow dollars).

**SurfaceDescriptor (Phase 41i.6 pending):** when the
`lib/calc-audit/surfaces/` registry ships, register a descriptor
mapping each rendered savings-rate trace + headline value to its
`prisma.unifiedTransaction` query path. Until then enforced by code
review.

Spec: `docs/blueprint/PHASE_43_3_MARGIN_TREND.md`.

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

---

# **14. Conversational Onboarding Visual Language (Phase 12 Track E, 2026-05-17)**

> **Canonical spec lives at** `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` **§4a**.
> This section is a pointer + the cross-surface reuse rules. Do not
> duplicate the §4a content here — keep one SSOT for the design
> language.

## 14.1 Primitives

| Primitive | File | Role |
|---|---|---|
| `PresenceOrb` | `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx` | Canonical visual identity of the Monitrax AI agent. 4 states: `idle` / `listening` / `thinking` / `settled`. Warm-ivory iridescent SVG. `prefers-reduced-motion` collapses to a static dot. **NOT** a face / mascot / robot / logo — ambient intelligence, not a character. |
| `motionTokens.ts` | `components/onboarding/wizard-chat/design/motionTokens.ts` | SSOT for every animation duration / easing / stagger in the chat surface. Hard-coding values elsewhere = code-review reject. Includes `useReducedMotion()` hook + `jitteredThinkingPauseMs()` helper. |
| `presenceOrb.css` | `components/onboarding/wizard-chat/design/presenceOrb.css` | Keyframes for the orb's 4 state animations. Defense-in-depth `@media (prefers-reduced-motion: reduce)` kills any straggler animations. |

## 14.2 Reuse policy

The `PresenceOrb` primitive is the **canonical AI-presence element for ALL future AI surfaces in Monitrax** — not Track E only:

- `/dashboard/cfo` (the AI Guide surface) — reserved for a future workstream that wires `PresenceOrb` in. Same orb, same 4 states.
- Any future agent surface (Phase 32C marketplace introduction agent, if it ever exists; future tax-advisor chat refresh, etc.) — same orb, same states.

Changing the orb's design later is expensive once it becomes a brand surface across multiple AI features. Any change to its SVG, states, or animation timings goes through §4a of the Phase doc as the source-of-truth review.

## 14.3 What we say NO to (load-bearing dissent — pinned 2026-05-17)

This list exists to prevent persona drift. Adding any of these requires an explicit CLAUDE.md / Phase doc update + Reza sign-off:

- ❌ Avatar / face / robot / mascot
- ❌ Naming the agent (e.g. "Monty", "Tracksy")
- ❌ Character voice different from Monitrax's product voice
- ❌ Emojis in agent messages
- ❌ Three-dot typing indicator without an orb (the orb's `thinking` state replaces the chatbot tell)
- ❌ Cleo-style snark, Replika-style warmth, Schwabby-style cartoon

See `PHASE_12_CONVERSATIONAL_ONBOARDING.md` §4a.6 + §8 risk row **E-R11 (Persona drift)** for the reviewer-reject rule.

---

# **15. Data Source Hygiene Primitives (Phase 12 PR 3c.1–3c.2d, 2026-05-18)**

> **Canonical spec lives at** `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` **§6A**.
> **Canonical BAU support doc lives at** `docs/operational/runbooks/10_DATA_SOURCE_HYGIENE.md`.
> This section is a pointer + the cross-surface reuse rules.

## 15.1 Primitives

| Primitive | File | Role |
|---|---|---|
| `DataSourceChip` | `components/accounts/DataSourceChip.tsx` | The **one** UI element that turns `(balanceSource, balanceLastUpdatedAt)` into a user label. 5 visual states keyed by `(source, age)`: BASIQ=emerald / IMPORT=sky / USER_VERIFIED=indigo / MANUAL-fresh=slate / MANUAL-stale-≥14d=amber. Renders nothing when source is null. Default + `compact` size variants. |
| `isBalanceStale` | exported from `DataSourceChip.tsx` | Pure predicate; SSOT for "is this balance stale?". Imported by `<StaleBalanceNudge>` + Settings > Data Health. Don't reimplement this rule anywhere else. |
| `MANUAL_STALE_THRESHOLD_DAYS` | exported from `DataSourceChip.tsx` | Single number, single import. Currently `14`. |
| `StaleBalanceNudge` | `components/dashboard/StaleBalanceNudge.tsx` | Top-of-page banner on `/dashboard/balances`. Fires when ≥1 MANUAL account ≥14 days. Session-only dismiss via sessionStorage. Basiq CTA gated on `useBasiqEnabled()`. |
| `UpgradeAccountButton` | `components/accounts/UpgradeAccountButton.tsx` | 2-CTA row: Connect via Basiq (gated) + Upload statement. Renders nothing for BASIQ/IMPORT. `compact` size strips icons + shortens labels. Optional `onBeforeNavigate` for caller-side close hooks. |
| `BalanceUpgradeNudgeModal` | `components/onboarding/BalanceUpgradeNudgeModal.tsx` | First-visit modal. 3-CTA stack (Connect via Basiq + Upload statement + Keep manual). Any CTA flips server flag forward via `POST /api/settings/balance-upgrade-nudge`. ESC + click-outside also flip the flag (no escape hatch). |
| `ConfidenceIndicator` (PR 3c.2e, 2026-05-19) | `components/dashboard/ConfidenceIndicator.tsx` | Small amber "may be stale" chip rendered next to any derived metric (Net Position hero today; portable to other tiles in follow-up). Renders nothing when `staleness.anyStale === false`. Links to Settings > Data Health. Amber not red — informational, not alarming. |
| `balanceWriteFields` | `lib/utils/accountBalance.ts` | NOT a UI primitive but the **load-bearing data-write companion**. Every `prisma.account.{create, update, upsert}` that writes `currentBalance` MUST spread `...balanceWriteFields(source)`. Reviewer-reject rule documented in file JSDoc. |
| `StalenessMetadata` (PR 3c.2e, 2026-05-19) | `lib/services/masterFinancialService.ts` | Service-layer companion. Block on every `MasterFinancialSnapshot`: `{ staleManualCount, totalManualCount, oldestManualAgeDays, anyStale, summary }`. Consumer surfaces pass it to `<ConfidenceIndicator>` unchanged. |

## 15.2 Reuse policy

The `<DataSourceChip>` primitive is the **canonical balance-source label** anywhere an `Account.currentBalance` is rendered. Future surfaces:

- Anywhere a balance appears (cashflow widgets, net-worth tiles, portfolio reports) → consider whether the staleness signal would help the user, and if yes, render the chip alongside the number. Don't reimplement the 5-state mapping inline.
- Any new "is this stale?" check → import `isBalanceStale()`; don't write your own threshold. To change the threshold globally, edit `MANUAL_STALE_THRESHOLD_DAYS`.

The `<UpgradeAccountButton>` primitive is the **canonical upgrade-CTA pair** for moving an account from MANUAL/USER_VERIFIED to BASIQ/IMPORT. Future surfaces that want to offer the upgrade journey use this — not inline `<Link>` to `?action=…`.

## 15.3 Basiq feature-flag gating — the rule for all data-source-hygiene primitives

Every Basiq CTA in this family of primitives MUST be gated by `useBasiqEnabled()` (client) and protected by `basiqRouteGuard()` (server). When the `BASIQ_INTEGRATION` flag is OFF, the Basiq button hides; the Upload + Keep-manual paths remain visible.

The chip itself is **not** gated — when an account's `balanceSource` IS `BASIQ` (legacy data from when flag was ON), the chip truthfully renders "Synced X ago". The chip describes existing state; it never advertises Basiq.

See `docs/operational/runbooks/06_BASIQ_INTEGRATION_TOGGLE.md` §2 for the exhaustive gating reference + `docs/operational/runbooks/10_DATA_SOURCE_HYGIENE.md` §4 for surface-by-surface gating notes.

---

## Entity-structure canvas (Phase 44 Part 1c, 2026-05-22)

The entity section's centrepiece is the **entity-structure canvas** — the
digital, live equivalent of the org chart an accountant hands a client
(`PHASE_44_ENTITY_GRAPH.md` §11A). Canonical component:
`components/entities/EntityCanvas.tsx`.

**Library.** Built on **React Flow (`@xyflow/react`) + `@dagrejs/dagre`**
— choice confirmed with Reza before build. React Flow supplies the
interaction engine only (pan / zoom / drag / hit-testing / viewport);
dagre supplies the layered auto-layout. The canvas brings its **own**
node component (`canvas/EntityCanvasNode.tsx`) so the Phase 39 / 41c
design language — role palette, Apple-glass surface, restraint — carries
over unchanged. The canvas is dynamically imported (`ssr:false`) so the
graph libraries never weigh on other routes' bundles.

**The five §11A patterns:**

1. **Colour by role.** Each box is tinted by `LegalEntityRole` using the
   established `ROLE_PALETTE` (`components/entities/types.ts`) — Personal
   amber / Holding indigo / Operating emerald / Investment fuchsia /
   Superannuation violet / Corporate-trustee slate. One colour system
   across the whole app.
2. **Progressive disclosure.** The box shows name + type + one key line
   (the ABN, or "Trustee: …"). Full detail — every relationship, the
   §6.1 state — opens in the entity-detail dialog on click.
3. **The lens toggle.** Control / Ownership / Money-flow / All. Because
   the §3A model keeps legal title / beneficial ownership / control
   distinct, the canvas shows one dimension at a time. Default is
   **Control**. The money-flow lens folds in the existing
   `MoneyFlowSankey` (there is no longer a separate Money Flow tab).
   Edge-set definitions live in `canvas/graphMeta.ts` — the Control lens
   reuses the exact control-edge set `lib/entity-graph/queries.ts`
   defines, one SSOT for "what is a control edge".
4. **Interactive + navigable.** Click a box → `EntityDetailDialog`;
   click a connector → `RelationshipDetailDialog`. Every box carries a
   §6.1 three-state badge — green `VALID`, amber
   `NON_COMPLIANT_BUT_RECORDED` (reason on hover), red
   `IMPOSSIBLE_SYSTEM_ERROR`.
5. **Auto-layout + nudge.** Layered top-to-bottom dagre layout;
   controllers/owners sit above what they control. Manual drag is
   allowed and persisted to `localStorage` (per device — Part 1c ships
   zero schema changes); a "Reset layout" affordance clears it.

**Presentational only.** The canvas reads `/api/entities/graph`, runs
the pure `lib/entity-graph/` rules engine (`classifyGraph` for the
badges, `classifyEdge` for the add-relationship live preview) and
renders. It computes nothing financial and performs no tax arithmetic
(§8.3 / §8.4).

**Accountant-review report** (`/dashboard/entities/accountant-review`) —
a standalone, print-friendly structure report (every entity +
relationship, §6.1 state, accountant-verified status, a verification
progress meter, an accountant sign-off block). Action controls carry
`print:hidden` so the browser print / Save-as-PDF output is clean.

**Where this pattern replicates next.** The accountant portal client
view (`app/portal/clients/[id]/view`) still renders the legacy
`EntityTree` (the Phase 41c two-row SVG tree). A future PR can adopt the
canvas there too — `EntityCanvas` is self-contained and only needs a
graph endpoint scoped to the viewed client. Out of scope for Part 1c.

---

## §16.x Restrained Editorial — internal-app dashboard (workstream 0·StD, 2026-05-27, Phase R1)

**Scope:** the internal `/dashboard/*` surfaces. Public-website Cosmos
(Phase 48) + internal-app legacy brand tokens both continue to work
alongside; the editorial-* namespace is **purely additive** and replaces
them gradually as the dashboard restyle PRs land.

**Aesthetic:** Restrained Editorial — warm ivory + deep navy + emerald
accent, calibrated against Mercury, Apple Wallet, Linear, Stripe. Premium
without decoration; never childish, never gamified, never anxious.
Source of truth: `docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md`. Stitch
project `1859462351962811110`, anchor screens
`f723372ebbd83b197770129eff849a2` (14 content sections) +
`2543c8240b944c8fa6b6e89d20ac8e77` (app shell).

### Tokens (CSS variables + Tailwind utilities)

Defined in `app/globals.css` editorial block and surfaced through
`tailwind.config.ts` as the `editorial.*` colour family + `boxShadow`
keys.

| Token | Hex | Purpose |
|---|---|---|
| `editorial.ivory` | `#FAFAF7` | Page background. NEVER pure white. |
| `editorial.paper` | `#FFFFFF` | Card surface. |
| `editorial.warm` | `#FAF8F3` | Daily Pulse strip / surface-container-low. |
| `editorial.surface` | `#F1EFE8` | Segmented control / surface-container. |
| `editorial.tint` | `#F1F5F9` | Progress bar track (slate-100). |
| `editorial.ink` | `#0B1220` | Primary text — deep navy, not pure black. |
| `editorial.slate` | `#64748B` | Secondary text. |
| `editorial.muted` | `#94A3B8` | Metadata + dashed-outline empty states. |
| `editorial.divider` | `#E2E8F0` | Card border (1.5px) + 1px row dividers. |
| `editorial.emerald` | `#16A34A` | Primary action + positive delta + chart accent. |
| `editorial.emerald-chip` | `#DCFCE7` | Emerald 10% chip background. |
| `editorial.amber` | `#F59E0B` | Caution + negative delta. NEVER red for "down". |
| `editorial.sky` | `#0EA5E9` | TRAIL Track. |
| `editorial.indigo` | `#6366F1` | TRAIL Anchor. |
| `editorial.violet` | `#8B5CF6` | TRAIL Live. |
| `editorial.red` | `#DC2626` | Destructive ONLY (e.g. delete confirmations). |

Three shadow keys: `shadow-editorial-card`, `shadow-editorial-card-hover`,
`shadow-editorial-popover` — all navy-tinted at low opacity (premium
stationery feel; never neutral grey).

### Typography utilities

`@layer utilities` defines five canonical text classes:

- `.text-eyebrow` — 12px / 500 / 0.18em / uppercase / slate-500
- `.text-data-xl` — 40px / 600 / -0.02em / tabular-nums
- `.text-data-lg` — 28px / 600 / -0.02em / tabular-nums
- `.text-headline-md` — 24px / 600 / -0.03em
- `.text-headline-sm` — 20px / 600 / -0.02em
- `.tabular-nums-data` — `font-variant-numeric: tabular-nums` shortcut

Numbers always use tabular-nums so columns of currency align cleanly.

### Card primitive

`.editorial-card` is the canonical white card shell (16px radius, 1.5px
divider border, navy shadow, 24px padding). `.editorial-card-hover` adds
a subtle 1px translate + elevated shadow on hover, with a
`prefers-reduced-motion: reduce` fallback.

### Primitive components (`components/editorial/`)

| Component | What it does |
|---|---|
| `Eyebrow` | The signature uppercase section label. Wraps `.text-eyebrow`. |
| `DataValue` | Tabular-nums semibold navy number. `size: 'xl' \| 'lg' \| 'md'`. |
| `DeltaChip` | Emerald (positive) / amber (negative) / slate (neutral) pill with directional arrow. NEVER red. |
| `EditorialCard` | The canonical white card surface. `padded` + `hover` variants. |
| `MetricTile` | Eyebrow + data-xl value + helper line with optional `DeltaChip` + optional sparkline slot. The building block of the 6-tile metrics row. |
| `PairedMetricCard` | Two side-by-side metrics with a vertical 1px divider (Copilot Assets / Debts pattern). Stacks on mobile. |
| `EditorialMoneyStoryHero` | The three-line Earned · Kept · Free today dashboard hero. TRAIL-stage-aware row emphasis (3px emerald left bar on the headline row). Replaces `MoneyStoryHero` on the new composition; both coexist until full migration. |

Barrel export at `components/editorial/index.ts` for clean consumer
imports.

### Chart primitives (`components/editorial/charts/`, Phase R-Charts-1, 2026-05-29)

The interactive-chart vocabulary. All theme-aware via editorial-* CSS
variables and **purely presentational** — every financial calculation is
done server-side in `/api/dashboard/charts` so the components never trip
the Phase 41i.6b financial-surface linter. Grounded in the locked Stitch
design `dashboard-interactive-charts` (project 1859462351962811110).

| Component | What it does |
|---|---|
| `EditorialChartCard` | Shared card shell — eyebrow + optional headline/sub + top-right slot (period pill / delta) + plot area + optional footer. Every chart sits in one. |
| `EditorialChartTooltip` | Styled popover wrapper (ivory→navy flip, 1px divider, soft shadow, uppercase label row). Recharts v3 dropped `payload` from `TooltipProps`, so each chart defines a minimal local payload type and renders this card. |
| `EditorialDonutChart` | Recharts `PieChart` donut + centred total + legend table. Slice palette: Property = sky, Investments (incl. super) = emerald, Cash = indigo, Other = muted. Slices ≤ $0 dropped. |
| `EditorialBarChart` | Recharts grouped vertical bars — emerald earned vs amber spent (a two-tone comparison, not an alarm). Hidden Y axis, thin month X axis, rounded bar tops. |
| `EditorialEntityBars` | CSS diverging horizontal bars for per-entity net value. Positive → emerald right; negative → amber left (never red). Geometry from local vars only (linter-safe). |
| `EditorialLineChart` | Recharts bezier `<AreaChart>` + emerald area fill + month-label X axis + styled tooltip. Powers the Net Worth Trend tile (R-Charts-2). **Honesty contract**: shows an empty-state placeholder when <2 points — never invents history. |

Barrel export at `components/editorial/charts/index.ts`.

**Data contract.** Charts consume the dedicated `/api/dashboard/charts`
endpoint (a distinct concern from `/api/dashboard/insights`, §12.4). The
per-entity figures come from the canonical
`lib/calculations/entityValueBreakdown.ts`, which reuses
`calculateTotalAssets`/`calculateTotalLiabilities` with the `ownerEntityId`
filter — so the chart's numbers reconcile to the Net Worth tile (SSOT).

**Preview.** `/dashboard/labs/charts` renders all three against live data
with per-chart empty states. Consumer-swap onto `/dashboard` is a queued
phase (see `IMPLEMENTATION_PLAN.md` 0·StD → R-Charts).

### Where this pattern replicates next

- All six existing dashboard metric tiles (`Tile.tsx`) migrate to
  `MetricTile` — Phase R3.
- All paired diagnostic rows (Health + Emergency, Debt + Entity Cashflow,
  Net Worth Trend + Entity Comparison, Insights + Budget, Money Bleeding
  + Spending by Category, Asset Allocation + Insights, Holdings tabs)
  restyle in subsequent phases — Phase R4 onwards.
- The `DashboardLayout` sidebar redesigns to the 8-item TRAIL nav with
  emerald active-state in Phase R2.

### Banned in editorial surfaces

- Pure white backgrounds. Use `editorial.ivory` for pages,
  `editorial.paper` for cards.
- Red `#DC2626` as a "down" delta indicator. Use amber for negative
  cashflow / over-budget / target-not-met; reserve red for destructive
  confirmations only.
- Multi-colour charts. Monochromatic emerald + one accent. TRAIL spectrum
  permitted only for stage categorisation (donut allocations, status chips).
- Emojis or excitement punctuation (`!`) in production UI copy.
- 1px or 2px card borders. Always 1.5px.
- Inline currency formatting. Use `lib/utils/formatters.ts` `formatCurrency`.

### Reviewer enforcement

Any PR adding a new dashboard surface MUST use the editorial primitives
above (or extend them with a new file in `components/editorial/` + an
update to this section + the barrel) — never inline a one-off
`<div className="bg-white rounded-2xl shadow ...">` clone. CLAUDE.md
§12.2 (SSOT) + §16.4 (file-header JSDoc + linked Phase doc) apply.

---

## Renewals & reminders pattern (Phase 21.5, 2026-05-29)

Two shared primitives for surfacing renewal/expiry reminders in-app. Both are
**presentational only** — all urgency/timing logic lives in the canonical
engine `lib/reminders/reminderEngine.ts` (SSOT §12.2/§12.3); these components
never recompute days or urgency.

| Component | File | Role |
|---|---|---|
| `<RenewalChip>` | `components/reminders/RenewalChip.tsx` | Compact urgency pill (overdue/due-soon/upcoming). Auto-hides for `OK`. Used on `AssetTile`, asset detail dialog, and inside `RenewalsCard` + `NotificationBell`. |
| `<RenewalsCard>` | `components/reminders/RenewalsCard.tsx` | Self-contained island — **self-hides while loading and when nothing is coming up**. Drop onto any page with zero data plumbing. Mounted on the Assets page + Home. Per-row action menu (snooze 7/30d · done · dismiss). |
| `<NotificationBell>` | `components/reminders/NotificationBell.tsx` | Dashboard top-bar centre (R1 PR2). Bell + count badge + dropdown panel of surfaced reminders with inline snooze (7d) + dismiss. Built on the `DropdownMenu` primitive (no new popover dep — §12.7). Mounted in `EditorialTopBar`. |
| `<AddReminderDialog>` | `components/reminders/AddReminderDialog.tsx` | Create a custom reminder (R1 PR2b) — title + date + optional note. Launched from the bell's "+ New". Confirms the saved date inline so far-future reminders (not yet in the "coming up" window) still feel saved. Persists via `useReminders().createCustom`. |
| `useReminders` (hook) | `hooks/useReminders.ts` | Shared SSOT for fetch + snooze/dismiss/done + `createCustom` (§12.2/§12.3). Consumed by both `RenewalsCard` and `NotificationBell` — neither re-implements the `/api/reminders` fetch or the `POST /api/reminders/state` / `/custom` calls. |

**Custom reminders (R1 PR2b)** render with the `CUSTOM` category (Pin glyph) and
**no destination** (empty `href`) — both row surfaces render them non-navigable
(no link wrapper, no chevron), hide the secondary label, and show the user's
note as the subtitle. They share the snooze/dismiss/done machinery with derived
reminders.

**Import-cadence reminder (R7)** renders with the `IMPORT` category (Download
glyph), entity name "Your transactions", and links to the import flow
(`/dashboard/balances?action=import`). One per user, only when they rely on
manual import and their data is ~a month stale. Warm subtitle ("Up to date
through 30 Apr 2026"), never shaming.

**Bill reminders (R1 PR3)** render with the `BILL` category (Receipt glyph),
the merchant as the name, an amount + cadence subtitle ("$15.99 · monthly"), and
link to `/recurring`. **Opt-in** — only present when `pushBillReminders` is on
(default off), so the high-volume feed never floods the bell uninvited; snooze/
dismiss let opted-in users tune the noise per bill.

**Urgency colour** (warm + calm per CLAUDE.md §0 — overdue stated plainly, not
alarmist): OVERDUE → rose, DUE_SOON → amber, UPCOMING → sky. Aligns with the
§6.7 severity vocabulary. The bell's **count badge** follows the same calm rule:
rose only when something is overdue, amber otherwise.

**Behaviour-psychology:** the card vanishes entirely when you're caught up (a
quiet win, not an empty nag); the bell panel celebrates "You're all caught up"
rather than nagging. Surfaces overdue first; every row leads somewhere (a link
to where you fix it) and can be snoozed/dismissed/done (Tier 2 state, R1 PR1).
Acting on a row removes it optimistically across both surfaces.

**Where to replicate next:** new reminder producers (standalone insurance,
personal-document expiry) plug into the engine, not the UI — both `RenewalsCard`
and `NotificationBell` render them automatically once the engine emits them.

---

## Wealth Universe Explorer pattern (Phase 44 Part 3, 2026-05-31)

**The spatial-canvas pattern for visualising the user's full legal-entity +
asset graph.** Lives at `/dashboard/entities` (My Accounts → My Structure)
on desktop. Replaces the legacy React Flow `EntityCanvas` (which read as a
corporate org-chart). Mobile pattern documented separately below — Apple
Maps hybrid (compact canvas + draggable bottom sheet).

### Visual identity — what makes this pattern distinct

Three premium "wow" elements that DON'T exist anywhere else in the app, and
SHOULD only be used here (and any future surface that's specifically a
spatial map):

| Element | Spec | Why it's reserved for this pattern |
|---|---|---|
| **Gravitational anchor** | YOU node, 96px squircle, violet→fuchsia gradient + pulsing emerald rings (two concentric, decreasing opacity, 2.4s loop). Always rendered at the spatial centre of the canvas. | Establishes "you are here" psychologically the moment the page loads. Behavioural-psych load-bearing — without it, users get lost in a graph of abstract entities. |
| **Silk-thread ribbons** | 1px curved Bezier with `feGaussianBlur` halo. Rest opacity 22%, active opacity 85% + animated particle stream (3 dots drifting along the path). Bend perpendicular to the line, magnitude `min(distance * 0.18, 8)`. | Distinguishes from engineering node-graphs (sharp 1.5px orthogonal lines). The bezier + glow reads as "relationship" not "dataflow." |
| **Dust-mote layer** | 36 particles, 1–3px white or emerald, opacity 4–11%, drift via CSS keyframes (12–18s loops). Background is a deep-navy radial-gradient vignette (`#0A0E1F → #060914 → #050810`). | Communicates "spatial environment" / "wealth universe." Without it the canvas reads flat. |

### Component breakdown (the 9 reusable components)

Currently all inlined in `WealthUniverseCanvas.tsx` for fast iteration.
Extraction policy: extract a component the SECOND time it's needed
(per §12.8 "Simplicity Over Cleverness" — no premature abstraction).
Phase 5 (dashboard widget) is the natural extraction trigger.

| # | Component | File | Role |
|---|---|---|---|
| 1 | `WealthExplorerPage` | `app/dashboard/entities/page.tsx` (currently inlined) | Thin route wrapper — `DashboardLayout` + viewport gate (`md:block` for canvas, `md:hidden` for legacy mobile) |
| 2 | `WealthUniverseCanvas` | `components/wealth-explorer/WealthUniverseCanvas.tsx` | Orchestrator. Holds React state (`hoveredId` / `selectedId` / `searchQuery` / `activeFilter`). Computes derived: visibility opacity, ribbon active/dimmed, tile fan-scale |
| 3 | `WealthNodeTile` | (inlined) | Single tile — squircle (`borderRadius: '30%'`), accent inner-glow via `box-shadow inset`, anchor pulsing rings, focal ring, hover scale 1.6× + magnifier corner icon |
| 4 | `RelationshipRibbon` | (inlined) | SVG path with Gaussian-blur filter + optional `<animateMotion>` for particle stream |
| 5 | `EntityPreviewPopover` | (inlined) | Hover popover — `anchorRight = node.position.x < 65` (flips left when the tile is on the right half so popover never goes off-screen) |
| 6 | `EntityDetailPanel` | `components/wealth-explorer/EntityDetailPanel.tsx` | Slide-in right panel (`framer-motion` spring, `damping: 28, stiffness: 280`). On-demand fetch of `/api/entities/[id]` |
| 7 | `WealthFilterBar` | (inlined) | Horizontal chip strip with live counts (All / People / Trusts / SMSF / Companies). Active chip = emerald-soft fill + emerald border |
| 8 | `WealthSearch` | (inlined) | Search pill — fuzzy name match. Non-matches dim to 35% (preserves spatial memory; never hides) |
| 9 | `ZoomControls` | (inlined) | Bottom-left stack (+/- / fit). Currently visual chrome — gesture-handler wiring is Phase 3 |

### Canonical data flow (SSOT chain)

```
/api/wealth-graph (route, withPermission('entity.read'))
    ↓
getWealthGraphSnapshot(userId)   ← lib/services/wealthGraphService.ts
    ↓                              (Promise.all reads — NO calc, NO tax math)
WealthGraphSnapshot
    ↓
useWealthExplorerData() hook     ← lib/hooks/useWealthExplorerData.ts
    ↓
layoutWealthExplorer(snapshot)   ← lib/data/wealthExplorerLayout.ts
    ↓                              (pure function — zone-based placement,
LayoutResult                       satellite arcs, ribbon derivation)
{ nodes, relationships, isEmpty }
    ↓
WealthUniverseCanvas             ← presentational only
```

**Strict separation:** the canvas component knows nothing about Prisma,
`/api/entities`, or any business logic. The layout function knows
nothing about React. The service knows nothing about the canvas. Three
isolated layers — each replaceable without touching the others.

### Entity-type colour tokens

Each `WealthNodeType` has a single canonical accent. Drives the tile's
inner glow, the glyph colour, the ribbon stroke when this entity is an
endpoint. **Do not invent new entity types without adding a token here**
— the canvas will fall back to undefined behaviour.

| Type | Hex | Glyph (Lucide) |
|---|---|---|
| `holding-company` | `#38BDF8` sky | `Briefcase` |
| `trustee-company` | `#7DD3FC` sky-light (dashed border) | `Scroll` |
| `smsf-trustee-company` | `#6EE7B7` emerald-light (dashed border) | `Shield` |
| `other-company` | `#FBBF24` amber | `Box` |
| `trust` | `#818CF8` indigo | `Umbrella` |
| `smsf` | `#34D399` emerald | `Rocket` |
| `individual` | `#A78BFA` violet | `User` |
| `asset-property` | `#38BDF8` sky | `Home` |
| `asset-vehicle` | `#FBBF24` amber | `Car` |
| `asset-investment` | `#818CF8` indigo | `LineChart` |
| `asset-cash` | `#34D399` emerald | `CircleDollarSign` |
| `asset-loan` | `#F87171` amber-rose | `Banknote` |
| `ownership-group` | `#F0ABFC` pink-violet | `Users` |

### Relationship-type ribbon colours

| Bucket | Hex | Sourced from |
|---|---|---|
| `owns` | `#34D399` emerald | SHAREHOLDER_OF / UNITHOLDER_OF / PARTNER_OF / holding-company → child |
| `controls` | `#7DD3FC` sky | DIRECTOR_OF / APPOINTOR_OF / TRUSTEE_OF (other than ATF) / SECRETARY_OF / GUARDIAN_OF / POWER_HOLDER_OF / LPR / EXECUTOR_OF / ADMINISTRATOR_OF |
| `trustee` (ATF) | `#FBBF24` amber | TRUSTEE_OF when it's the actual ATF edge (trustee → trust / SMSF) |
| `beneficiary` | `#A78BFA` violet | BENEFICIARY_OF + BeneficialOwnershipOverride beneficial chain |
| `member` | `#6EE7B7` emerald-soft | MEMBER_OF |
| `household` | `#F0ABFC` pink-violet | FAMILY_MEMBER_OF / ASSOCIATE_OF |
| `holds` | per asset-kind | Entity → asset (sky/indigo/emerald/amber by asset type) |

### Interaction patterns

**Apple Dock fan-effect.** When a tile is hovered, every other tile gets a
scale boost based on distance from the hovered one. Cosine falloff over
14% canvas radius:

```ts
function fanScale(hoveredPos, tilePos, radiusPct = 14) {
  const dist = Math.hypot(tilePos.x - hoveredPos.x, tilePos.y - hoveredPos.y);
  if (dist >= radiusPct) return 1;
  const t = 1 - dist / radiusPct;
  return 1 + 0.2 * t * t;
}
```

The hovered tile itself is excluded from the fan (gets a direct `1.6` scale).

**Edge-aware popover anchoring.** `anchorRight = node.position.x < 65` —
when the focused tile is in the right 35% of the canvas, the popover
flips to the left so it doesn't clip off-screen.

**Ribbon highlighting.** When a tile is hovered: ribbons where
`from === hoveredId || to === hoveredId` go full-brightness (opacity 85%,
2px stroke, Gaussian-blur halo at 6px, particle stream); all OTHER
ribbons dim to 6% opacity (almost invisible). This makes the focused
entity's relationships POP without hiding the structural map.

**Click → detail panel (Level 3).** Sets `selectedId`.
`EntityDetailPanel` mounts (Framer Motion `AnimatePresence`), fetches
`/api/entities/[selectedId]` on mount for the identity/parent metadata,
then renders identity / controlled-by / asset counts / **linked
assets list** (Phase 3 — Level 3 extension). Each linked-asset row
click-throughs to the asset's individual detail page where one exists
(property → `/dashboard/properties/{id}`, loan →
`/dashboard/loans/{id}`); account/investment/asset fall back to their
list page. Backdrop click or `X` closes.

**Click → ecosystem dim (Level 2 — Phase 3).** Same click as above ALSO
triggers an ecosystem-dim pass: every tile NOT directly connected to
the focal entity (via any ribbon — structural or money-flow) recedes
to 0.22 opacity, ribbons not touching the focal recede to 0.06. The
focal tile + its direct neighbours stay at full brightness. The
breadcrumb advances from "Level 1 · Universe" to
"← Universe · Level 2 · {entity name}" with the entity's accent
colour. No re-layout — the layout is already informative and spatial
memory is the asset; dim is the right move per §0.4 restraint.

**Search dim, never hide.** Non-matching tiles drop to 35% opacity.
Spatial memory is the asset — the user knows where their HOME tile is
even if it's currently dim, and reflection / dimming preserves that;
hiding does not.

**Filter chip dim, never hide.** Out-of-bucket tiles drop to 18%
opacity. Same psychological rationale as search.

**Lens toggles (Phase 1.1 + Phase 2).** Two primary lens toggles in
the canvas chrome:
- **Structure / Money flow** (Phase 2) — renders only when ≥1
  CONFIRMED money flow exists. Switches the canvas from showing
  ownership ribbons (default) to animated emerald flow ribbons with
  $ amount pill labels.
- **Legal / Beneficial** (Phase 1.1) — renders only when ≥1
  `BeneficialOwnershipOverride` exists AND the primary lens is in
  Structure mode. Toggles emphasis between the legal ownership chain
  and the beneficial-owner chain.

**FY scrubber (Phase 2 enhancement).** When the Money flow lens is
active, a ghost-glass pill strip sits where the breadcrumb would —
one pill per FY with CONFIRMED data, sorted descending. Selecting a
pill dims flows from other FYs; the chrome-level "N pending Royal
Assent" §12.14 pill auto-retracks the selection.

### Mobile pattern — Apple Maps hybrid (Stitch design 2026-05-31, React port pending)

Stitch screen `72ea8d79fa7e4a0c865a2c2a9d73d198`.
Artefact: `.stitch/designs/wealth-explorer-mobile-v1-dark.{html,png}`.

**Structure** (top → bottom):

1. **Compact canvas** (~320px tall, full-width). All 13 nodes from the
   desktop fixture at smaller sizes — YOU 56×56 (still pulsing), Family
   Trust 48×48 (focal), assets 28–40×28–40. Pinch-zoom + pan via
   gesture only; tiny "Two-finger" hint top-right, "↕ Drag sheet"
   chip bottom-right.
2. **Draggable bottom sheet** — three snap states:
   - **Peek** (~80px): drag handle + search pill only. Canvas takes
     the rest.
   - **Half** (~380px, default open): drag handle + search + filter
     chips + selected-entity detail card + entity list (5 rows
     visible).
   - **Full** (covers canvas): same content, scrollable list takes the
     full screen.
3. **Bottom nav** — unchanged from the existing My Wealth aesthetic.

**Tap behaviour:** tap tile = sheet rises to half + that entity's
detail card appears at top. Tap a list row = both zooms/highlights
the tile on the canvas AND scrolls the list to that row. The two
surfaces stay in sync.

**Why this not just "shrink the desktop":** at 375px wide, 13
spatial tiles + hover-magnify-on-touch-which-doesn't-exist would be
unusable. The hybrid preserves the wealth-universe identity (compact
canvas always visible) while giving mobile-native tap-to-explore via
the sheet.

### Where this pattern should be replicated next

The Wealth Universe canvas is **the** spatial-graph pattern for
Monitrax. The intent is a single specialised pattern, not a class
of patterns to repeat. **Do NOT clone** for:
- Investment holdings (use a portfolio table — different mental model)
- Spending categories (use Sankey + bars — different mental model)
- Document organisation (use a folder list — different mental model)

**DO consider** for:
- The simplified dashboard widget on `/dashboard` (Phase 5) — same
  components, smaller canvas, no detail panel
- Future "Inheritance / Estate" planning surface (Phase 41E.x) — same
  spatial model, time-travel lens added (FY slider per Phase 2
  enhancement)

### Reviewer enforcement (§16.6)

Any PR that materially touches the Wealth Universe surface MUST:
1. Either reuse the canonical components above OR explain in the PR
   description why a fork is necessary
2. Maintain the SSOT chain (no fetching `/api/entities` directly from
   the canvas — must go via `useWealthExplorerData()` → `/api/wealth-graph`)
3. Not introduce a new node-type or relationship-type without adding
   the corresponding token to `NODE_ACCENT` / `RIBBON_COLOR`
4. Keep the design-language elements (gravitational anchor pulsing,
   silk-thread ribbon glow, dust-mote layer) — removing any one of
   them changes the identity
