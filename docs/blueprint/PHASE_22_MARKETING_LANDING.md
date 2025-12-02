# PHASE 22: MARKETING SITE & AUTH SHELL

### *Monitrax Marketing Landing Page & Sign-In Experience*

---

**Status:** PLANNED
**Owner:** Product + Frontend
**Depends on:**
- Phase 7: Dashboard Redesign
- Phase 11: AI Strategy Engine (public positioning)
- Phase 10: Auth & Security (email/password + OAuth wiring)

---

## 1. Objectives

Create a **public marketing landing page** and **sign-in experience** that:

- Mirrors the clarity and structure of best-in-class personal finance tools (hero, social proof, feature grid, testimonials, security, footer)
- Uses a **Monitrax-first brand**: Australian wealth, forecasting, property + investments, AI strategy engine
- Shares the same **layout and content hierarchy** as the internal dashboard (PageHeader, StatCard, etc.) for design consistency
- Minimises friction to **sign up / sign in** while keeping security and trust front and centre

### Primary Deliverables

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page (unauthenticated) |
| `/signin` | Sign-in page (email/password + OAuth) |
| Shared layout | Theme primitives ready for future pages (`/pricing`, `/learn`, etc.) |

---

## 2. User Personas & Journeys

### Persona A — Aspiring Wealth Builder (AU, late 20s–40s)

- Owns or wants to buy property, has super + some ETFs
- Wants "one place that understands Australian tax, loans, property and investments together"
- **Journey:** Lands on `/` → scrolls hero + feature sections → clicks "See plans" or "Sign in"

### Persona B — Spreadsheet Power User (Global)

- Currently uses sheets or basic budgeting apps
- Interested in forecasting, what-if analysis, and detailed reports
- **Journey:** Lands on `/` via blog/SEO → reads forecasting & AI sections → signs up via `/signin`

### Persona C — Busy Professional

- Time poor, cares about "one glance" clarity and automation
- **Journey:** Lands on `/` from referral → scans hero + social proof → immediately clicks "Sign in with Google"

---

## 3. Routes & Architecture

### 3.1 Route Structure

```
Public Routes (no auth required):
├── /                 → Marketing landing page
├── /signin           → Sign-in form
├── /pricing          → Pricing plans (future)
├── /security         → Security overview (future)
└── /learn            → Educational content (future)

Authenticated Routes:
└── /dashboard/*      → Main application (existing)
```

### 3.2 File Structure (Next.js App Router)

```
app/
├── (public)/
│   ├── layout.tsx              # Marketing layout wrapper
│   ├── page.tsx                # Landing page (/)
│   └── signin/
│       └── page.tsx            # Sign-in page
│
components/
├── marketing/
│   ├── MarketingLayout.tsx     # Top nav + footer wrapper
│   ├── Hero.tsx                # Above-the-fold hero section
│   ├── FeatureGrid.tsx         # 4 key features display
│   ├── SocialProof.tsx         # Trust badges and logos
│   ├── Testimonials.tsx        # Customer testimonials carousel
│   ├── SecurityStrip.tsx       # Security & trust section
│   ├── ForecastSection.tsx     # "See the future" section
│   ├── DashboardPreview.tsx    # Custom dashboards showcase
│   └── Footer.tsx              # Site-wide footer
│
└── auth/
    └── SignInForm.tsx          # Reusable sign-in form
```

All marketing pages use `MarketingLayout` (top nav + footer) and reuse global `ThemeProvider`.

---

## 4. Landing Page — Content & Layout

**Route:** `/`
**Goal:** "Know where your wealth is headed" — clear, aspirational, Australian-flavoured, forecast-oriented.

### 4.1 Above-the-Fold Hero

**Layout:**
- Full-width section, light background, 2 columns (stack on mobile):
  - **Left:** Headline, subheadline, primary + secondary CTAs
  - **Right:** App preview card (mini dashboard screenshot or composited UI)

**Copy (Monitrax-branded):**

| Element | Content |
|---------|---------|
| **Pill badge** | "Australian wealth OS • Forecasts • Strategy" |
| **Headline** | "Know where your wealth is heading, not just where it's been." |
| **Subheadline** | "Monitrax brings your properties, loans, investments and cash together with Australian-aware forecasts and an AI strategy engine." |
| **Primary CTA** | "See plans & pricing" |
| **Secondary CTA** | "Sign in" |

**Trust Icons Row (under CTAs):**
- Property • Investments • Tax • Cashflow (simple icon set)

### 4.2 Social Proof Stripe

Immediately below hero:

- Compact strip with trust badges:
  - "Built for Australian wealth builders"
  - "Trusted for long-term property and portfolio planning"

- Featured quote:
  > "Monitrax is the first tool that actually understands my properties, loans, super and ETFs in one place."

### 4.3 "Get Your Entire Wealth at Your Fingertips"

3-column section summarising core value pillars:

| Column | Title | Description |
|--------|-------|-------------|
| 1 | **Unify your wealth** | Connect banks, brokers and property data to see your net worth in real time. |
| 2 | **See the future** | Forecast cashflow, equity and net worth for decades, not just months. |
| 3 | **Turn insight into strategy** | Use the AI Strategy Engine to explore smarter debt, property and investment moves. |

### 4.4 Feature Grid (4 Key Features)

Four stacked rows or 2×2 grid:

| # | Title | Description | Icon Theme |
|---|-------|-------------|------------|
| 1 | **Property-centric portfolio view** | Single view of properties, loans, offset accounts, and cash. | Building/Home |
| 2 | **Forecasts that actually match reality** | Uses real rates, tax settings, property yields and contributions. | Chart/Timeline |
| 3 | **Australian tax & debt aware** | Understands offsets, interest-only vs P&I, negative gearing scenarios. | Calculator/Dollar |
| 4 | **AI Strategy Engine** | Surface trade-offs: extra repayments vs investing, upgrade vs renovate, sell vs hold. | Brain/Sparkle |

Each feature has a "Learn more" link (anchors initially, dedicated pages future).

### 4.5 "See the Future" — Forecasting Section

**Layout:** 2 columns
- **Left:** Copy explaining forecasting horizon (up to 30 years)
- **Right:** Stylised chart showing balances, property equity and investment value over time (static SVG/image)

**Key Bullets:**
- Project cash balance, net worth and equity month-by-month
- Build and compare multiple strategy timelines
- Stress-test rate rises, rent changes and contribution tweaks

### 4.6 Custom Dashboards & Reports Section

Mirroring PocketSmith's approach but Monitrax-style:

**Custom Dashboards:**
- Property equity & LVR
- Investment performance and allocations
- Cash and offset utilisation

**Reporting:**
- Income & expenses by category
- Property cashflow
- Investment distributions and contributions

### 4.7 Testimonials Carousel

3–6 AU-flavoured testimonials (fictional placeholders for MVP):

| Quote | Attribution |
|-------|-------------|
| "The first app that treats my home and investments as one strategy." | Chris, Melbourne |
| "I went from spreadsheets to having a clear 10-year plan in a weekend." | Sarah, Sydney |
| "Seeing how extra repayments compare to investing changed how I use my offset account." | James, Brisbane |
| "Finally, software that understands negative gearing properly." | Emma, Perth |
| "The forecasting is incredible — I can see exactly when I'll be debt-free." | Michael, Adelaide |

Simple horizontal carousel (can be static list for MVP).

### 4.8 Security & Trust Section

**Headline:** "Keeping your information secure is non-negotiable."

**Trust Points:**
- Bank-grade encryption in transit and at rest
- We earn money from subscriptions, not selling your data
- Two-factor authentication available
- No ads. No third-party trackers that follow you around the internet

**CTA Button:** "Read our Security & Privacy overview" → `/security`

### 4.9 Footer

**Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ [Monitrax Logo]                                             │
├─────────────────────────────────────────────────────────────┤
│ App          │ Resources    │ Legal        │ Company       │
│ ─────────────│──────────────│──────────────│───────────────│
│ Features     │ Blog         │ Terms        │ About         │
│ Pricing      │ Learn        │ Privacy      │ Contact       │
│ Sign In      │ Roadmap      │ Cookies      │ Careers       │
│ API (future) │ Changelog    │ Security     │               │
├─────────────────────────────────────────────────────────────┤
│ [LinkedIn] [X/Twitter]     © 2025 Monitrax. All rights.    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Sign-In Page — Structure & UX

**Route:** `/signin`
**Goal:** Fast, trustworthy, minimal friction entry point into the app.

### 5.1 Layout

- Centered card on neutral background
- Optional small hero tagline on the left for desktop:
  - "Be productive with your wealth, your way."
- Right (or main) side: sign-in card

### 5.2 Sign-In Card Contents

**Header:**
- Title: "Sign in to Monitrax"
- Subtext: "Don't have an account? [See plans & pricing](/pricing)"

**Form Fields:**

| Field | Type | Validation |
|-------|------|------------|
| Email | text input | Email format check |
| Password | password input | Non-empty |
| Remember me | checkbox | "Keep me signed in for 2 weeks" |

**Buttons:**
- Primary: "Sign in"
- Divider: "or"
- Secondary: "Sign in with Google" (OAuth from Phase 10)

**Links:**
- "Forgot your password?" → `/forgot-password`
- Footer text: "By signing in you agree to our [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy)."

### 5.3 Form States

| State | Behavior |
|-------|----------|
| **Default** | Empty form, ready for input |
| **Loading** | Button shows spinner, inputs disabled |
| **Error** | Inline error above form (e.g., "Incorrect email or password") |
| **Validation** | Email format + password non-empty checks |
| **Success** | Redirect to `/dashboard` (or last visited authenticated route) |

---

## 6. Visual & Brand Guidelines

### 6.1 Colour Palette

- Light, calm palette aligned with existing Monitrax dashboard
- Primary: Teals / deep blues
- Accents: Subtle gradients
- Avoid "cartoonish" finance style — aim for **professional but approachable**

### 6.2 Typography

- Same font stack as main app
- Large, clear hero typography
- Short, simple sentences; no jargon unless explained

### 6.3 Imagery

- Use app UI composites (dashboard, charts, strategy panels) instead of stock photos
- When using people imagery, keep it generic and diverse
- No fake endorsements

### 6.4 Component Consistency

Marketing components should mirror dashboard patterns:

| Dashboard Component | Marketing Equivalent |
|--------------------|---------------------|
| `PageHeader` | `Hero` title structure |
| `StatCard` | Feature cards |
| `DataTable` | Comparison tables |
| `Button` variants | Same primary/secondary styles |

---

## 7. Technical Requirements

### 7.1 Stack

- **Framework:** Next.js 15 App Router
- **Language:** TypeScript
- **UI Library:** shadcn/ui primitives
- **Styling:** TailwindCSS
- **Theme:** Global `ThemeProvider` (dark mode support)

### 7.2 Performance Targets (Lighthouse)

| Metric | Target |
|--------|--------|
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 90 |

### 7.3 Responsive Breakpoints

| Breakpoint | Width | Notes |
|------------|-------|-------|
| Mobile | ≤ 480px | Single column, stacked layout |
| Tablet | ~768px | 2-column where applicable |
| Desktop | ≥ 1280px | Full multi-column layouts |
| Minimum | 320px | Must remain functional |

### 7.4 Content Management

- All content strings extracted to config or i18n-ready structure
- Future localisation support considered

---

## 8. Implementation Phases

### Phase 22.1: Core Infrastructure
- [ ] Create `(public)` route group with layout
- [ ] Implement `MarketingLayout` component
- [ ] Set up shared theme/styling for marketing pages
- [ ] Create `Footer` component

### Phase 22.2: Landing Page
- [ ] Implement `Hero` section
- [ ] Implement `SocialProof` stripe
- [ ] Implement "At your fingertips" 3-column section
- [ ] Implement `FeatureGrid` component
- [ ] Implement `ForecastSection`
- [ ] Implement dashboards/reports preview section
- [ ] Implement `Testimonials` carousel
- [ ] Implement `SecurityStrip` section

### Phase 22.3: Sign-In Experience
- [ ] Create `/signin` route
- [ ] Implement `SignInForm` component
- [ ] Wire up email/password authentication
- [ ] Add Google OAuth button (using Phase 10 infra)
- [ ] Implement form states (loading, error, success)
- [ ] Add redirect logic post-authentication

### Phase 22.4: Polish & Optimization
- [ ] Mobile responsiveness testing
- [ ] Lighthouse optimization
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Content review and refinement
- [ ] Cross-browser testing

---

## 9. Acceptance Criteria

### Landing Page (`/`)

- [ ] Visiting `/` when not authenticated shows marketing landing page
- [ ] Hero section displays with headline, subheadline, and CTAs
- [ ] Social proof stripe visible below hero
- [ ] "At your fingertips" 3-column section renders
- [ ] Feature grid shows 4 key features
- [ ] Forecasting section displays with chart visual
- [ ] Custom dashboards section renders
- [ ] Testimonials carousel/list displays
- [ ] Security section shows trust points
- [ ] Footer renders with all link columns

### Sign-In Page (`/signin`)

- [ ] Primary CTA "Sign in" navigates to `/signin`
- [ ] Email + password fields render
- [ ] "Remember me" checkbox works
- [ ] "Sign in" button submits form
- [ ] "Sign in with Google" button present (OAuth wired)
- [ ] "Forgot your password?" link present
- [ ] Terms and Privacy links in footer
- [ ] Successful sign-in redirects to `/dashboard`
- [ ] Failed sign-in shows inline error without losing field values

### Technical

- [ ] Layout looks good on mobile (≤ 480px), tablet (~768px), desktop (≥ 1280px)
- [ ] No console errors in production build
- [ ] `next build` passes without errors
- [ ] TypeScript typecheck passes
- [ ] Lighthouse scores meet targets

---

## 10. Out of Scope (Future Phases)

| Feature | Notes |
|---------|-------|
| `/pricing` page | Separate phase for pricing tiers |
| `/security` detailed page | Currently stubs to section |
| `/learn` content hub | Educational content phase |
| Sign-up flow | Depends on pricing/plans |
| Animated charts | Static images for MVP |
| Blog integration | Separate content phase |
| Multi-language support | i18n structure prepared but not implemented |

---

## 11. Reference & Inspiration

### PocketSmith Design Patterns (Reference)

| Pattern | Monitrax Adaptation |
|---------|---------------------|
| Dashboard widget customization | Emphasize property + investment dashboards |
| 60-year forecasting | Highlight 30-year Australian-aware forecasts |
| Category customization | Focus on tax-aware categorization |
| Security messaging | Similar trust messaging, Australian compliance focus |

### Key Differentiators

1. **Australian-first:** Tax, offsets, negative gearing, super
2. **Property-centric:** Properties as core wealth asset
3. **AI Strategy Engine:** Unique recommendation capability
4. **Forecasting depth:** Long-term wealth trajectory focus

---

## 12. Related Documentation

- [PHASE_07_DASHBOARD_REBUILD.md](./PHASE_07_DASHBOARD_REBUILD.md) — Dashboard design patterns
- [PHASE_10_AUTH_AND_SECURITY.md](./PHASE_10_AUTH_AND_SECURITY.md) — Authentication infrastructure
- [PHASE_11_AI_STRATEGY_ENGINE.md](./PHASE_11_AI_STRATEGY_ENGINE.md) — AI positioning
- [08_BRAND_UI_DESIGN.md](./08_BRAND_UI_DESIGN.md) — Brand guidelines

---

*Document Version: 1.0*
*Created: 2025-12-02*
*Phase Status: PLANNED*
