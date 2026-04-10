Official brand, visual identity, and UI design specification for Monitrax.

Last updated: 2025-11-30

⸻

1. Brand Foundations

1.1 Brand Essence

Monitrax = “Advisor-grade clarity for everyday investors.”

We sit between a spreadsheet and a private wealth advisor: precise, transparent, and calm — never flashy or “trading app” hyped.

1.2 Brand Attributes

Monitrax should always feel:
	•	Calmly confident – we know the numbers; we don’t shout.
	•	Advisor-grade – professional, precise, compliant-looking.
	•	Human & approachable – no jargon walls, no intimidating charts.
	•	Australian context aware – franking, offset accounts, LVR, CGT, etc.
	•	Data-first – numbers and evidence lead; visuals support.

1.3 Tone of Voice (UX Writing)
	•	Clear over clever. Prefer “Net cash flow this month” over “Liquidity vibes”.
	•	Short labels, long explanations.
	•	Buttons: “Add Property”, “Edit Loan”.
	•	Helper copy: explain in 1–2 lines below.
	•	No fear mongering. For risk: “Worth watching” > “Danger!”.
	•	Inclusive & neutral. No gendered language, no socio-economic assumptions.

⸻

2. Visual Identity

2.1 Color System Overview

We use a deep navy + emerald base with neutral greys and a warm accent for attention.

Think: calm banking app, not neon trading terminal.

2.1.1 Core Brand Palette
Name these in Tailwind / CSS tokens (example shown):
	•	Brand Primary (Navy)
	•	--color-brand-primary: #0B1220 (deep navy)
	•	Usage: primary navigation, key headings, main CTAs in dark mode.
	•	Brand Secondary (Emerald)
	•	--color-brand-secondary: #16A34A (emerald)
	•	Usage: positive numbers, success states, “healthy” stats, key highlights.
	•	Brand Accent (Amber)
	•	--color-brand-accent: #F59E0B
	•	Usage: warnings, “watch this” indicators, yields, highlights in insights.
	•	Neutrals
	•	--color-neutral-0: #FFFFFF
	•	--color-neutral-50: #F9FAFB
	•	--color-neutral-100: #F3F4F6
	•	--color-neutral-200: #E5E7EB
	•	--color-neutral-300: #D1D5DB
	•	--color-neutral-600: #4B5563
	•	--color-neutral-800: #111827
	•	Usage: backgrounds, cards, borders, text.

2.1.2 Semantic Colors
Map these to Tailwind / theme tokens, and use them consistently:
	•	Success / Positive
	•	Color: #16A34A (emerald)
	•	Usage: positive cash flow, growth, good savings rate, successful actions.
	•	Warning / Watch
	•	Color: #F59E0B (amber)
	•	Usage: high LVR, low emergency buffer, soon-to-expire fixed rate.
	•	Error / Risk
	•	Color: #DC2626 (red)
	•	Usage: failing validation, broken sync, severe risk.
	•	Info / Neutral Highlight
	•	Color: #0EA5E9 (sky)
	•	Usage: information notes, “just so you know” messages.

2.1.3 Data Visualization Colors
Series colors for charts (avoid neon; stay muted but readable):
	1.	Series 1: #16A34A (emerald)
	2.	Series 2: #0EA5E9 (sky)
	3.	Series 3: #6366F1 (indigo)
	4.	Series 4: #F59E0B (amber)
	5.	Series 5: #EC4899 (pink)

Rules:
	•	Limit max 5 series colors per chart.
	•	Always use brand secondary (emerald) for “total portfolio” or “primary metric.”
	•	Avoid using error red in charts except for true negative values / losses.

⸻

3. Typography

3.1 Font Stack

Use a clean, modern sans-serif:
	•	Primary font: Inter, system UI or similar.
3.2 Type Scale & Usage

Define a small, consistent scale (can map to Tailwind text sizes):
	•	Page Title / H1 – text-2xl / font-semibold
	•	Usage: top-level page titles (“Dashboard”, “Properties”).
	•	Section Title / H2 – text-xl / font-semibold
	•	Usage: card titles, section headings (“Linked Loans”, “Cashflow”).
	•	Subheading / H3 – text-lg / font-medium
	•	Usage: subsections within cards, subtabs.
	•	Body – text-sm to text-base / font-normal
	•	Usage: descriptions, labels, helper text.
	•	Caption / Meta – text-xs / font-medium
	•	Usage: dates, chip labels, tax notes, “Last updated” metadata.

Rules:
	•	Never smaller than text-xs for body-like content (accessibility).
	•	One font weight per line (don’t mix bold and regular in a single label).

⸻

4. Layout, Spacing & Elevation

4.1 Layout Principles
	•	Use a 12-column grid (implicit via Tailwind) with gap-6 for main layouts.
	•	Max width for content: max-w-6xl / max-w-7xl where appropriate.
	•	Keep critical info left-aligned; avoid center-heavy dashboards.

4.2 Spacing Scale

Use Tailwind spacing scale and keep it consistent:
	•	Page padding: px-4 py-6 mobile, px-8 py-8 desktop.
	•	Card padding: p-4 mobile, p-6 desktop.
	•	Grid gaps: gap-4 for dense content, gap-6 for main sections.

Rules:
	•	Prefer more whitespace over cramming more information in.
	•	Group related statistics into clusters with internal gap-3 or gap-4.

4.3 Corners & Elevation
	•	Border radius: rounded-xl for cards, rounded-2xl for modals.
	•	Buttons: rounded-full for pills (filters), rounded-lg for primary CTAs.
	•	Elevation:
	•	Base cards: subtle shadow or border: shadow-sm or border border-neutral-200.
	•	Modals: shadow-lg, slightly darker backdrop.

⸻

5. Core Components (Brand-Aligned)

These are the components you already have (or close to) that should align with the branding.

5.1 Page Header

Usage: All major dashboard pages.
	•	Includes:
	•	Title (H1)
	•	Optional description (1–2 lines)
	•	Optional right-aligned actions (buttons, filters)
	•	Style:
	•	Title: text-2xl font-semibold
	•	Description: text-sm text-muted-foreground
	•	Actions: primary button in brand secondary (emerald), secondary as outline.

5.2 StatCard

Usage: Top-level metrics (Net Worth, Cash Flow, LVR, Savings Rate, etc.)
	•	Content:
	•	Title (small label)
	•	Value (prominent)
	•	Optional subtitle/description
	•	Optional icon (muted, right-aligned or top-left)
	•	Variants:
	•	Use variant="green" for positive/progress metrics.
	•	variant="orange" for risk/warning.
	•	variant="blue" for informational stats.
	•	variant="default" for neutral.
	•	Behavior:
	•	Often clickable to take user to a relevant detail view.
	•	Hover: subtle lift (shadow-md) + slight background emphasis.

5.3 Cards

Usage: Properties, Loans, Accounts, Investments, etc.
	•	Structure:
	•	Header: title + key badges (type, status)
	•	Body: 1–3 primary metrics (value, LVR, equity, yield)
	•	Footer (optional): metadata or call to action
	•	Design:
	•	Card with rounded-xl, border, bg-card, hover:bg-muted/50 for clickable cards.
	•	Keep 3–6 core metrics visible; move the rest into detail dialogs.

5.4 Detail Dialogs (Entity Details)

Pattern: Already used heavily (Properties, Loans, Accounts, Investments).
	•	Standard layout:
	•	Title: “[Entity Name]” with icon
	•	Subtitle: short descriptor (“Investment property in NSW”)
	•	Tabs: e.g., Overview · Cashflow · Loans · Linked Data · Tax
	•	Rules:
	•	Always include a Linked Data tab once Phase 8 is fully in place.
	•	Avoid more than 5 tabs; group rarely used info into sub-panels.

5.5 Linked Data Panel (Brand Treatment)

(For Phase 8 cross-module linking)
	•	Visually treated as a relationship map in list form:
	•	Each row: icon + label + small metrics.
	•	Grouped by type: Properties, Loans, Accounts, Investments, Income, Expenses.
	•	Design:
	•	Simple list with subtle separators.
	•	Badges for status or type (e.g. “Offset”, “Rent”, “Interest”).
	•	Use info blue or neutral accents; avoid heavy colors (this is reference info).

5.6 Buttons
	•	Primary:
	•	Use brand secondary (emerald).
	•	Text: text-sm font-medium.
	•	Shape: rounded-lg.
	•	Secondary:
	•	Outline style, neutral border.
	•	Tertiary:
	•	Ghost, muted text; for low-priority actions.

⸻

6. Domain-Specific UI Patterns

6.1 Dashboard
	•	Top row: 3–4 StatCards (Net Worth, Cash Flow, LVR, Savings Rate).
	•	Left/main column: Charts & key summaries.
	•	Right column: Insights & alerts.
	•	Chart colors follow data visualization palette; background is neutral.

6.2 Properties UI
	•	Card surface:
	•	Large value (current value), smaller purchase info.
	•	Key metrics: LVR, equity, gross yield, net cash flow.
	•	Depreciation & tax info: keep secondary visually (muted card), avoid feeling like a tax form.
	•	Property type badges (house, unit, etc.) use neutral / subtle colors.

6.3 Loans UI
	•	Emphasize:
	•	Remaining principal
	•	LVR (with color-coded risk)
	•	Rate type (fixed/variable) with small pill.
	•	Offset relationships:
	•	Use subtle visual “link line” metaphor in layout or a “Linked offset account” section with badges.
	•	Avoid aggressive red for high LVR; use amber/orange plus calm copy like “Worth reviewing”.

6.4 Investments & Holdings
	•	Accounts:
	•	Show total value, 24h / daily movement, income yield.
	•	Holdings:
	•	Show ticker + name + simple quality badge (e.g. “Blue-chip”, “Growth”, optional future).
	•	Gains/losses: green/red but muted; don’t create casino vibes.

⸻

7. Dark Mode

7.1 Philosophy

Dark mode should feel:
	•	Soft and muted, not pure black.
	•	Same hierarchy as light mode; just inverted luminance, not meaning.

7.2 Key Tokens
	•	Background: #020617 (slate/near-black).
	•	Card: #020617 to #020617 with border-neutral-800.
	•	Text: mostly #E5E7EB (near-white), with text-muted-foreground as #9CA3AF.
	•	Primary & semantic colors: same hue, slightly adjusted brightness if needed for contrast.

⸻

8. Implementation Notes

8.1 Theme Tokens
Expose the branding through CSS variables (or Tailwind theme.extend.colors):
:root {
  --color-brand-primary: #0B1220;
  --color-brand-secondary: #16A34A;
  --color-brand-accent: #F59E0B;

  --color-bg: #F9FAFB;
  --color-surface: #FFFFFF;
  --color-border: #E5E7EB;
  --color-text: #111827;
  --color-text-muted: #6B7280;
}

---

9. Implementation Status

### Completed (2025-11-30)

| Component | Status | Notes |
|-----------|--------|-------|
| `app/globals.css` | DONE | Brand colors, semantic colors, light/dark themes |
| `tailwind.config.ts` | DONE | `brand.*` and semantic color utilities |
| `DashboardLayout.tsx` | DONE | Navy header, emerald accents, clean sidebar |
| `StatCard.tsx` | DONE | Brand-aligned variants (green, orange, blue) |
| `AiChatButton.tsx` | DONE | Brand colors for AI chat panel |

### CSS Variables Implemented

**Light Mode:**
- `--color-brand-primary: 216 52% 9%` (Navy)
- `--color-brand-secondary: 142 71% 37%` (Emerald)
- `--color-brand-accent: 38 92% 50%` (Amber)
- `--primary: 142 71% 37%` (Emerald for CTAs)
- Semantic: `--color-success`, `--color-warning`, `--color-error`, `--color-info`

**Dark Mode:**
- `--background: 222 47% 2%` (Soft slate, not pure black)
- Colors adjusted for contrast (slightly brighter)

### Tailwind Utilities Added

```typescript
brand: {
  primary: 'hsl(var(--color-brand-primary))',
  secondary: 'hsl(var(--color-brand-secondary))',
  accent: 'hsl(var(--color-brand-accent))',
}
success: 'hsl(var(--color-success))'
warning: 'hsl(var(--color-warning))'
error: 'hsl(var(--color-error))'
info: 'hsl(var(--color-info))'
```

### Remaining Work

- [ ] Apply brand typography scale consistently across all pages
- [ ] Update remaining entity cards (Properties, Loans, etc.) with rounded-xl
- [ ] Audit all buttons for brand secondary (emerald) usage
- [ ] Update chart components to use `--chart-*` colors
