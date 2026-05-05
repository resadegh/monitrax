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

# **12. Mobile & Responsive Rules**

### **12.1 Mobile Requirements**
- Sidebar becomes drawer  
- Breadcrumb collapses  
- Tables → cards  
- Dialogs → full-screen sheets  

### **12.2 Breakpoints**
```
xs: < 480px  
sm: 480–640px  
md: 640–1024px  
lg: 1024–1440px  
xl: 1440–1920px  
2xl: > 1920px  
```

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
