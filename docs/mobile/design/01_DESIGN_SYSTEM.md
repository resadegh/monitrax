# Mobile Design System — Premium Edition

**Date:** 2026-05-11 | **Version:** 2.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §13
**Shared Brand Guide:** `docs/architecture/08_BRAND_UI_DESIGN.md`

---

## 1. DESIGN VISION

### "Financial Calm meets Apple-grade craft."

Monitrax Mobile should feel like the love child of **Apple Wallet**, **Linear**, and **Mercury**. Premium through restraint — not decoration. Every pixel earns its place. Every animation communicates meaning. Every surface says "your money is in good hands."

### 1.1 Reference Products (Study These)

| Product | What to Learn | Apply To |
|---------|---------------|----------|
| **Apple Wallet / iOS Stocks** | Card-stack metaphor, glanceable data hierarchy, buttery physics | Daily Pulse cards, account cards |
| **Linear** | Precision spacing, type hierarchy, understated colour, motion that signals state | Insight cards, navigation transitions |
| **Mercury (banking)** | Clean financial UI, restrained palette, confident whitespace | Transaction feed, balance displays |
| **Stripe Dashboard** | Information density without clutter, progressive disclosure | Cashflow forecast, budget views |
| **Revolut** | Transaction feed UX, category icons, spending analytics | Transaction triage, spending velocity |
| **Monzo** | Real-time transaction notifications, category doughnuts, impulse spending nudges | Push notifications, spending widgets |
| **Amie (calendar)** | Springy interactions, playful-but-precise motion, zero-chrome UI | Triage card physics, sheet transitions |

### 1.2 Core Design Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **Confident whitespace** | Space is a feature, not waste. A card with breathing room reads "premium." A card crammed with data reads "tax spreadsheet." |
| 2 | **One hero per screen** | Every screen has ONE number, ONE chart, or ONE action that's unmistakably the most important thing. The eye should never wander. |
| 3 | **Motion = meaning** | Every animation communicates a state change. Spring physics for interactive elements (cards, sheets). Fade for content transitions. No motion for decoration. |
| 4 | **Warm, not clinical** | "Your spending is trending down" not "Expenditure decreased 12.4% MoM". The app should feel like a trusted friend who happens to be great with money. |
| 5 | **Celebrate progress** | Small wins get acknowledged. "All transactions triaged!" gets confetti haptic. Health score up gets a subtle green pulse. Shame has no place. |
| 6 | **Progressive disclosure** | Show summary first, detail on tap. The Daily Pulse shows 6 numbers. Each drills into its own screen. No user sees all data at once. |
| 7 | **Restrained colour** | The palette is mostly neutral (slate/grey). Colour is reserved for meaning: emerald = positive, amber = watch, red = act. If everything is coloured, nothing is. |

---

## 2. COLOUR SYSTEM

### 2.1 Brand Palette (inherited from web — immutable)

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `brand.navy` | `#0B1220` | 216° 52% 9% | App chrome: tab bar, headers, navigation backgrounds |
| `brand.emerald` | `#16A34A` | 142° 71% 37% | Positive: income, gains, health, savings, success |
| `brand.amber` | `#F59E0B` | 38° 92% 50% | Caution: warnings, watch items, yields, thresholds |
| `brand.red` | `#DC2626` | 0° 72% 51% | Action needed: critical alerts, negative cashflow, overspending |
| `brand.sky` | `#0EA5E9` | 199° 89% 48% | Informational: tips, low-severity insights, links |

### 2.2 Semantic Tokens (context-dependent)

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `surface.primary` | `#FFFFFF` | `#020617` | Screen backgrounds |
| `surface.raised` | `#FFFFFF` | `#0F172A` | Cards, sheets |
| `surface.sunken` | `#F8FAFC` | `#020617` | Inset areas, grouped backgrounds |
| `text.primary` | `#0F172A` | `#F1F5F9` | Headings, hero numbers |
| `text.secondary` | `#64748B` | `#94A3B8` | Labels, descriptions, timestamps |
| `text.tertiary` | `#94A3B8` | `#475569` | Placeholders, disabled text |
| `border.subtle` | `#E2E8F0` | `#1E293B` | Card borders, dividers |
| `border.strong` | `#CBD5E1` | `#334155` | Input borders, active states |

### 2.3 Insight Severity Palette (immutable across web + mobile)

| Severity | Colour | Hex | Background (10% opacity) |
|----------|--------|-----|--------------------------|
| Critical | Red | `#DC2626` | `#DC262619` |
| High | Orange | `#EA580C` | `#EA580C19` |
| Medium | Amber | `#F59E0B` | `#F59E0B19` |
| Low | Blue | `#3B82F6` | `#3B82F619` |

### 2.4 Financial Colour Language

| Context | Colour | Why |
|---------|--------|-----|
| Money in (income, gains, positive cashflow) | Emerald `#16A34A` | Universal "positive" association |
| Money out (expenses, losses) | Slate `#64748B` | **NOT red.** Red implies danger. Spending is normal. Only overspending is red. (behaviour psychologist lens: normalise spending, don't shame) |
| Overspending (above budget) | Amber → Red gradient | Amber at 100-130% of budget; red only above 130% |
| Net worth | Navy `#0B1220` | Premium, confident, stable |
| Health score ring | Gradient: Red (0-40) → Amber (40-60) → Emerald (60-100) | Smooth gradient, not hard steps |

### 2.5 Dark Mode

| Element | Light | Dark |
|---------|-------|------|
| Background | `#FFFFFF` | `#020617` (soft slate, NOT pure black) |
| Raised surface | `#FFFFFF` with shadow | `#0F172A` with subtle border |
| Tab bar | `#FFFFFF` | `#0B1220` |
| Emerald in dark mode | `#16A34A` | `#22C55E` (slightly lighter for legibility) |
| Amber in dark mode | `#F59E0B` | `#FBBF24` (slightly lighter) |
| Red in dark mode | `#DC2626` | `#EF4444` (slightly lighter) |

**Dark mode is not inverted light mode.** Colours get 1-2 stops lighter to maintain contrast. Shadows become borders. Elevations become surface colour changes.

---

## 3. TYPOGRAPHY

### 3.1 Font Stack

**Primary:** `SF Pro Display` (iOS) / `Google Sans` (Android) — system fonts for native feel.
**Monospace (amounts):** `SF Mono` (iOS) / `Roboto Mono` (Android) — tabular numerals for financial alignment.

### 3.2 Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display.hero` | 40pt | Bold (700) | 1.1 | Net worth hero number |
| `display.large` | 32pt | SemiBold (600) | 1.2 | Screen titles, major amounts |
| `display.medium` | 24pt | SemiBold (600) | 1.3 | Section headers, scores |
| `title.large` | 20pt | SemiBold (600) | 1.3 | Card titles, sub-sections |
| `title.medium` | 17pt | Medium (500) | 1.4 | List item primary text |
| `body.large` | 16pt | Regular (400) | 1.5 | Body text, descriptions |
| `body.medium` | 14pt | Regular (400) | 1.5 | Secondary descriptions |
| `body.small` | 13pt | Regular (400) | 1.4 | Timestamps, meta text |
| `caption` | 11pt | Medium (500) | 1.3 | Badges, labels, tab bar text |
| `amount.large` | 28pt | SemiBold (600) Mono | 1.2 | Transaction amounts, balances |
| `amount.medium` | 17pt | Medium (500) Mono | 1.3 | Inline amounts |

### 3.3 Type Rules

- **Hero numbers use tabular numerals** — digits align vertically so amounts don't jump when values change
- **Never more than 3 font weights on one screen** — Regular, Medium, SemiBold. Bold only for hero numbers.
- **Minimum body text:** 13pt (accessibility)
- **Line length cap:** ~45 characters per line on mobile (prevents eye fatigue)
- **No ALL CAPS except badges** — "CRITICAL" badge is acceptable; "YOUR NET WORTH" heading is not

---

## 4. SPACING & LAYOUT

### 4.1 Spatial Scale (8pt grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space.2` | 2pt | Hairline gaps (badge internal padding) |
| `space.4` | 4pt | Tight element gaps (icon to label) |
| `space.8` | 8pt | Standard element spacing |
| `space.12` | 12pt | Card internal padding (compact) |
| `space.16` | 16pt | Card internal padding (standard), screen horizontal padding |
| `space.20` | 20pt | Between card groups |
| `space.24` | 24pt | Section spacing |
| `space.32` | 32pt | Major section breaks |
| `space.40` | 40pt | Top-of-screen padding (below status bar) |

### 4.2 Screen Layout Pattern

```
┌──────────────────────────────────────────┐
│  Status Bar (system)                      │  ← system-managed
├──────────────────────────────────────────┤
│  16pt padding                             │
│                                           │
│  ┌──── Screen Content ────────────────┐   │
│  │                                    │   │
│  │  Hero area (display.hero)          │   │  ← ONE hero per screen
│  │                                    │   │
│  │  ────────────────────────────      │   │  ← subtle divider or 24pt gap
│  │                                    │   │
│  │  Card group 1                      │   │  ← grouped by concern
│  │  ┌────────────────────────────┐    │   │
│  │  │  Card A       Card B      │    │   │  ← horizontal scroll or grid
│  │  └────────────────────────────┘    │   │
│  │                                    │   │
│  │  20pt gap                          │   │
│  │                                    │   │
│  │  Card group 2                      │   │
│  │  ┌────────────────────────────┐    │   │
│  │  │  Full-width card           │    │   │
│  │  └────────────────────────────┘    │   │
│  │                                    │   │
│  └────────────────────────────────────┘   │
│                                           │
├──────────────────────────────────────────┤
│  Tab Bar                                  │  ← always visible
└──────────────────────────────────────────┘
```

### 4.3 Card Design

```
┌─────────────────────────────────────────┐
│                                         │
│  16pt padding all sides                 │
│                                         │
│  Label (caption, text.secondary)        │
│  8pt gap                                │
│  Hero Value (display.medium or amount)  │
│  4pt gap                                │
│  Subtitle (body.small, text.tertiary)   │
│                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  ← optional inline chart
│                                         │
│  12pt bottom padding                    │
│                                         │
└─────────────────────────────────────────┘

Corner radius: 16pt
Background: surface.raised
Border: 1pt border.subtle (dark mode) / none + shadow (light mode)
Shadow (light): 0 1pt 3pt rgba(0,0,0,0.06), 0 1pt 2pt rgba(0,0,0,0.04)
```

---

## 5. MOTION & ANIMATION

### 5.1 Motion Principles

| Principle | Implementation |
|-----------|---------------|
| **Physics, not keyframes** | Use `react-native-reanimated` spring configs, not CSS-style easing curves |
| **Every motion has a reason** | Entering = slide/spring. Exiting = fade. Reordering = layout animation. Decoration = never. |
| **Respect "Reduce Motion"** | Check `AccessibilityInfo.isReduceMotionEnabled()`; replace springs with instant transitions |
| **Speed = confidence** | Fast transitions (150-250ms) feel decisive. Slow transitions (500ms+) feel sluggish. |

### 5.2 Spring Configurations

```typescript
// Snappy interactions (buttons, toggles, small elements)
const SPRING_SNAPPY = { damping: 20, stiffness: 300, mass: 0.8 };

// Smooth transitions (cards, sheets, screen push)
const SPRING_SMOOTH = { damping: 28, stiffness: 200, mass: 1.0 };

// Bouncy celebrations (triage complete, health score up)
const SPRING_BOUNCY = { damping: 12, stiffness: 180, mass: 0.8 };

// Sheet drag (bottom sheets, triage cards)
const SPRING_SHEET = { damping: 50, stiffness: 500, mass: 1.2 };
```

### 5.3 Transition Inventory

| Transition | Type | Config | Duration |
|-----------|------|--------|----------|
| Tab switch | Cross-fade | Opacity 0→1 | 150ms |
| Screen push (drill down) | Slide from right + fade | SPRING_SMOOTH | ~250ms |
| Screen pop (back) | Slide to right + fade | SPRING_SMOOTH | ~200ms |
| Bottom sheet open | Slide from bottom | SPRING_SHEET | ~300ms |
| Bottom sheet close | Slide to bottom | SPRING_SHEET | ~200ms |
| Card press | Scale 0.97 + shadow reduce | SPRING_SNAPPY | ~100ms |
| Card release | Scale 1.0 + shadow restore | SPRING_SNAPPY | ~150ms |
| Triage card swipe | Follow finger + spring to edge | SPRING_SMOOTH | ~300ms |
| Triage card enter | Scale 0.95→1.0 from stack | SPRING_BOUNCY | ~400ms |
| Health ring fill | Progress 0→score | Custom (800ms ease-out) | 800ms |
| Number count-up | Interpolate 0→value | Linear | 600ms |
| Pull-to-refresh threshold | Haptic + spinner drop | Native platform | System |
| Toast enter | Slide from top + fade | SPRING_SMOOTH | 200ms |
| Toast exit | Fade out | Opacity | 150ms |

### 5.4 Micro-interactions

| Element | Interaction | Motion |
|---------|------------|--------|
| Amount change (net worth) | Value updates | Old number fades out, new number counts up from old value |
| Health score change | Score increases | Ring animates to new fill; if improved, brief emerald pulse glow |
| Triage complete | Last card swiped | Confetti particle burst (5 particles, 400ms) + bouncy checkmark + success haptic |
| Expense saved | Save button pressed | Button shrinks to circle → checkmark appears → expands back → toast |
| Scanner capture | Photo taken | Flash white overlay (50ms) → thumbnail slides to corner |

---

## 6. COMPONENT LIBRARY

### 6.1 Cards

**Summary Card (Daily Pulse widgets)**
```
┌─────────────────────────────┐
│  Monthly Cashflow            │  ← caption, text.secondary
│  +$2,340                     │  ← amount.large, emerald (positive)
│  ↑ 12% vs last month        │  ← body.small, text.tertiary
│                              │
│  ▁▂▃▅▆▇█▇▆▅▃▂▁              │  ← sparkline (optional)
└─────────────────────────────┘
```

**Money Left Until Payday (hero widget)**
```
┌─────────────────────────────────────────┐
│                                         │
│          $1,240                          │  ← display.hero, gradient colour
│    left for 8 days until payday         │  ← body.medium, text.secondary
│                                         │
│  ████████████████░░░░░░░░░              │  ← progress bar (days elapsed)
│                                         │
└─────────────────────────────────────────┘
Gradient: emerald (>60% remaining) → amber (30-60%) → red (<30%)
```

**Transaction Row**
```
┌─────────────────────────────────────────┐
│  🟢  Woolworths              -$82.50    │  ← merchant initial circle + amount
│      Groceries · 2 hours ago            │  ← category pill + relative time
└─────────────────────────────────────────┘
Row height: 72pt (44pt touch + 28pt padding)
Initial circle: 36pt diameter, brand colour from category
Amount: right-aligned, monospace, emerald (in) / slate (out) / red (overspend)
```

**Triage Card**
```
┌─────────────────────────────────────────┐
│                                         │
│         WOOLWORTHS METRO 0432           │  ← title.large, centred
│                                         │
│              -$82.50                     │  ← display.large, centred
│                                         │
│          ANZ Everyday                    │  ← body.medium, text.secondary
│          Today, 2:14 PM                  │  ← body.small, text.tertiary
│                                         │
│     ┌────────────────────────┐          │
│     │  🛒 Groceries (85%)    │          │  ← AI suggestion pill
│     └────────────────────────┘          │
│                                         │
│  ← Flag    ·    ·    Accept →           │  ← hint labels, text.tertiary
│                                         │
└─────────────────────────────────────────┘
Corner radius: 20pt
Shadow: elevated (light mode)
Card stacking: visible 2 cards behind, scale 0.95 + 0.90, offset -8pt + -16pt
Swipe physics: SPRING_SMOOTH with velocity-aware threshold
```

**Insight Card**
```
┌─────────────────────────────────────────┐
│  ● CRITICAL                              │  ← severity dot + badge
│                                         │
│  Cashflow shortfall in 5 days           │  ← title.medium
│                                         │
│  Projected deficit of $420 based on     │  ← body.medium, text.secondary
│  upcoming payments.                      │  ← max 2 lines, truncate
│                                         │
│  ┌──────────────┐  ┌──────────────┐     │
│  │ Review        │  │ Dismiss       │    │  ← action buttons
│  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────┘
Background: severity colour at 10% opacity
Left accent: 3pt vertical bar in severity colour
```

### 6.2 Health Score Ring

```
Outer: 120pt diameter, 10pt stroke width
Track: border.subtle (grey track behind)
Fill: gradient from red (0°) through amber (144°) to emerald (360°)
     — only fills to current score position
Centre: score number (display.medium) + grade letter (caption)
Animation: 800ms ease-out on mount; spring-bounce on value change
Glow: if score improved since last view, 2-second emerald glow pulse
```

### 6.3 Bottom Sheet

```
┌─────────────────────────────────────────┐
│              ═══════                      │  ← drag handle: 36x5pt, rounded, border.subtle
│                                         │
│  Sheet Title                             │  ← title.large
│                                         │
│  ─────────────────────────────────────   │  ← divider
│                                         │
│  Content area (scrollable)               │
│                                         │
│                                         │
│                                         │
└─────────────────────────────────────────┘
Initial: 50% screen height
Expandable: 90% screen
Corner radius: 24pt (top corners only)
Backdrop: #000000 at 40% opacity, blur(8pt)
Snap points: 50%, 90%, 0% (dismiss)
Drag physics: SPRING_SHEET
```

### 6.4 Buttons

| Variant | Style | Usage |
|---------|-------|-------|
| **Primary** | Emerald background, white text, 12pt radius, 48pt height | Main CTA: "Save", "Confirm" |
| **Secondary** | Transparent, emerald text, 1pt emerald border, 12pt radius | Alternative action: "Cancel", "Skip" |
| **Ghost** | Transparent, text.secondary, no border | Tertiary: "Dismiss", "Not now" |
| **Danger** | Red background, white text | Destructive: "Delete", "Revoke" |
| **Icon** | 44x44pt touch target, centred icon | Actions: edit, share, more |

Press state: scale 0.97 with SPRING_SNAPPY. Never use opacity change alone (it looks like a glitch).

---

## 7. GESTURE LANGUAGE

| Gesture | Action | Context | Haptic | Visual |
|---------|--------|---------|--------|--------|
| **Swipe right** | Accept / categorise | Triage cards | `selectionChanged` | Card slides right, emerald tint appears |
| **Swipe left** | Flag / exclude | Triage cards | `selectionChanged` | Card slides left, amber tint appears |
| **Swipe up** | Investigate | Triage cards | `impactMedium` | Card flies up, "Investigating..." toast |
| **Tap** | Drill down / expand | Everything | None | Spring push transition |
| **Long press** | Quick actions / AI explain | Transaction rows | `impactMedium` | Context menu springs from touch point |
| **Pull down** | Refresh | Lists, home | `impactLight` at threshold | Native refresh indicator |
| **Pinch** | Zoom chart timeline | Cashflow forecast | None | Timeline expands/contracts |

---

## 8. NAVIGATION

### 8.1 Tab Bar

```
┌────────────┬────────────┬────────────┬────────────┐
│    Home    │   Triage   │   Alerts   │    More    │
│     🏠     │    ✦ 12    │     🔔     │     ⋯     │
└────────────┴────────────┴────────────┴────────────┘
```

- **Home:** Daily Pulse
- **Triage:** Transaction Triage Mode (badge shows queue count)
- **Alerts:** Insights & notifications hub
- **More:** Settings, transaction feed, cashflow, AI chat, "Continue on Desktop"

**Tab bar design:**
- Active: emerald icon + emerald label (medium weight)
- Inactive: `text.tertiary` icon + label
- Height: 83pt (iOS safe area) / 64pt (Android nav bar)
- Background: `surface.raised` with top hairline border
- Badge: emerald circle with white count, 18pt diameter

### 8.2 Scanner FAB

Persistent floating action button overlaid above tab bar:

```
         ┌──────┐
         │  📷  │   ← 56pt diameter, brand.navy background, white camera icon
         └──────┘       shadow: 0 4pt 12pt rgba(11,18,32,0.3)
                        press: scale 0.92, shadow reduces
```

Position: centred horizontally, 16pt above tab bar.
Always visible on Home, Triage, and Alerts tabs. Hidden on scanner screen itself.

### 8.3 Screen Transitions

| From → To | Animation | Physics |
|-----------|-----------|---------|
| Tab → Tab | Cross-fade (150ms) | Linear |
| List → Detail | Shared element transition (card expands to screen) | SPRING_SMOOTH |
| Any → Scanner | Slide up from bottom (camera reveal) | SPRING_SHEET |
| Any → Bottom sheet | Slide up with backdrop | SPRING_SHEET |
| Push → Screen | iOS: slide from right. Android: shared axis (Material 3) | Platform native |

---

## 9. ICONOGRAPHY

### 9.1 Icon Style

- **Library:** Lucide (same as web app) — consistent cross-platform icon language
- **Size:** 24pt default, 20pt in compact contexts, 28pt in hero contexts
- **Stroke width:** 1.5pt (Lucide default)
- **Colour:** inherits from text colour context (primary, secondary, or semantic)
- **Category icons:** filled circles (36pt) with category colour + white Lucide icon

### 9.2 Category Icon Map

| Category | Icon | Circle Colour |
|----------|------|---------------|
| Groceries | `ShoppingCart` | `#16A34A` (emerald) |
| Transport | `Car` | `#3B82F6` (blue) |
| Food & Dining | `UtensilsCrossed` | `#F59E0B` (amber) |
| Entertainment | `Tv` | `#8B5CF6` (violet) |
| Utilities | `Zap` | `#06B6D4` (cyan) |
| Health | `Heart` | `#EC4899` (pink) |
| Housing | `Home` | `#0B1220` (navy) |
| Insurance | `Shield` | `#64748B` (slate) |
| Subscription | `RotateCw` | `#6366F1` (indigo) |
| Education | `GraduationCap` | `#14B8A6` (teal) |
| Other / Uncategorised | `CircleDot` | `#94A3B8` (grey) |

---

## 10. HAPTIC FEEDBACK

| Event | iOS | Android | Intensity |
|-------|-----|---------|-----------|
| Triage card accepted | `notificationSuccess` | `EFFECT_HEAVY_CLICK` | Satisfying |
| Triage card flagged | `selectionChanged` | `EFFECT_CLICK` | Light |
| Triage queue complete | `notificationSuccess` × 3 (rapid) | `EFFECT_DOUBLE_CLICK` × 2 | Celebratory |
| Expense saved | `notificationSuccess` | `EFFECT_HEAVY_CLICK` | Confirming |
| Pull-to-refresh threshold | `impactLight` | `EFFECT_TICK` | Subtle |
| Overspend alert received | `notificationWarning` | `EFFECT_DOUBLE_CLICK` | Attention |
| Critical insight opened | `notificationError` | `EFFECT_HEAVY_CLICK` | Urgent |
| Scanner photo captured | `impactMedium` | `EFFECT_CLICK` | Shutter feel |
| Amount keypad tap | `selectionChanged` | `EFFECT_TICK` | Tactile keyboard |
| Health score improved | `notificationSuccess` | `EFFECT_HEAVY_CLICK` | Rewarding |

---

## 11. EMPTY STATES & ONBOARDING

### 11.1 Empty State Pattern

Every screen must have a meaningful empty state. Never show a blank screen.

```
┌─────────────────────────────────────────┐
│                                         │
│              [Illustration]              │  ← simple line illustration, brand colours
│                                         │
│     No transactions yet                 │  ← title.large, centred
│                                         │
│     Connect your bank on the web app    │  ← body.medium, text.secondary, centred
│     to see transactions here.           │
│                                         │
│     ┌──────────────────────────┐        │
│     │  Open Web App             │       │  ← primary button (deep link)
│     └──────────────────────────┘        │
│                                         │
└─────────────────────────────────────────┘
```

### 11.2 Language Rules (behaviour psychologist lens)

| Don't | Do | Why |
|-------|-----|-----|
| "No data" | "Let's get started" | Invites action, not failure |
| "You have 14 unresolved transactions" | "14 transactions need your input — takes about 20 seconds" | Frames the effort, not the backlog |
| "Your spending is excessive" | "You're spending more than usual this week" | Observes, doesn't judge |
| "Financial health: POOR" | "Room to grow — here's what helps most" | Normalises, suggests next step |
| "Error loading data" | "We couldn't reach your data. Pull down to try again." | Human language, clear action |

---

## 12. ACCESSIBILITY

| Requirement | Target | Implementation |
|-------------|--------|---------------|
| Touch targets | ≥44x44pt | All interactive elements padded to minimum |
| Contrast ratio (text) | ≥4.5:1 (WCAG AA) | Verified with Colour Contrast Analyzer |
| Contrast ratio (large text) | ≥3:1 (WCAG AA) | Hero numbers, card titles |
| VoiceOver (iOS) | All screens | `accessibilityLabel` on every interactive element |
| TalkBack (Android) | All screens | `accessibilityLabel` on every interactive element |
| Dynamic Type (iOS) | Up to xxxLarge | Text scales; layouts adapt |
| Font scaling (Android) | System font scale | Text scales; layouts adapt |
| Reduce Motion | Respected | Springs → instant, counters → final value, confetti → skip |
| Screen reader order | Logical | Matches visual top-to-bottom, left-to-right |
| Colour-blind safe | All severity states | Severity uses colour + icon + text label (never colour alone) |

---

## 13. APP STORE PRESENCE

### 13.1 App Icon

- **Shape:** Rounded square (iOS auto-clips, Android adaptive icon)
- **Design:** Monitrax "M" lettermark on navy `#0B1220` background with emerald accent
- **Size:** 1024x1024pt source, no transparency (iOS requirement)
- **No text in icon** — Apple rejects icons with text that's too small to read

### 13.2 Screenshots (App Store / Play Store)

| Screenshot | Content | Layout |
|-----------|---------|--------|
| 1 | Daily Pulse (hero) | "Your financial life, at a glance" + full home screen |
| 2 | Transaction Triage | "Sort 30 transactions in 45 seconds" + triage card stack |
| 3 | Receipt Scanner | "Snap a receipt. Done." + camera → auto-fill flow |
| 4 | Push Notifications | "Know the moment it matters" + notification examples |
| 5 | Cashflow Forecast | "See your money future" + forecast chart |
| 6 | Health Score | "Your financial health, scored" + health ring + categories |

Style: device frame (iPhone 15 Pro / Pixel 8), headline text above, clean white/navy background.
