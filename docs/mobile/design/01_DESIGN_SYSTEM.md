# Mobile Design System

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §13
**Shared Brand Guide:** `docs/architecture/08_BRAND_UI_DESIGN.md` (NOT duplicated here)

---

## 1. DESIGN PHILOSOPHY

"Financial Calm UI" adapted for mobile — same brand, different density.

| Principle | Web | Mobile |
|-----------|-----|--------|
| Information density | Full tables, multi-column layouts | ~50% less; single-column, cards |
| Primary interaction | Click, hover, keyboard | Tap, swipe, haptic feedback |
| Navigation depth | Unlimited (CMNF chain) | Max 3 levels + "Continue on Desktop" |
| Screen purpose | Multi-purpose dashboards | One purpose per screen |
| Dead-ends | Zero (every screen leads somewhere) | Zero (same rule) |

---

## 2. COLOUR SYSTEM

Inherited from `docs/architecture/08_BRAND_UI_DESIGN.md` — no changes:

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` (Navy) | `#0B1220` | Navigation, headers, tab bar |
| `brand-secondary` (Emerald) | `#16A34A` | Positive numbers, success, health |
| `brand-accent` (Amber) | `#F59E0B` | Warnings, yields, watch indicators |
| `error` (Red) | `#DC2626` | Critical alerts, negative cashflow |
| `info` (Sky) | `#0EA5E9` | Informational badges |
| Dark mode background | `#020617` | Soft slate (not pure black) |

**Insight severity colours (immutable):**
- Critical: `#DC2626` (Red)
- High: `#EA580C` (Orange)
- Medium: `#F59E0B` (Amber)
- Low: `#3B82F6` (Blue)

---

## 3. TYPOGRAPHY

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero number (Net Worth) | Inter / System | 32pt | SemiBold |
| Section header | Inter / System | 20pt | SemiBold |
| Card title | Inter / System | 16pt | Medium |
| Body text | Inter / System | 14pt | Regular |
| Caption / label | Inter / System | 12pt | Medium |
| Amount (transaction) | Inter / System | 16pt | SemiBold |
| Tab bar label | Inter / System | 10pt | Medium |

**Minimum text size:** 12pt (accessibility)

---

## 4. SPACING & LAYOUT

| Token | Value | Usage |
|-------|-------|-------|
| `space-xs` | 4pt | Inline element gaps |
| `space-sm` | 8pt | Between related elements |
| `space-md` | 12pt | Card internal padding |
| `space-lg` | 16pt | Section spacing |
| `space-xl` | 24pt | Screen-level padding |
| Screen padding (horizontal) | 16pt | All screens |
| Card padding | 16pt | Internal padding |
| Card gap | 12pt | Between cards |

---

## 5. COMPONENT PATTERNS

### 5.1 Cards

```
┌─────────────────────────────────────┐
│  Label                    $12,345 ▲ │  ← title row (label + hero value)
│  +2.3% this month                   │  ← subtitle (muted)
│                                     │
│  ████████████████░░░░ 78%           │  ← progress bar (optional)
└─────────────────────────────────────┘
Corner radius: 16pt
Shadow: subtle (1pt blur, 4% opacity)
```

### 5.2 Transaction Row

```
┌─────────────────────────────────────┐
│  🟢  Woolworths          -$82.50   │  ← icon/initial + merchant + amount
│      Groceries • 2 hours ago       │  ← category badge + relative time
└─────────────────────────────────────┘
Height: 72pt minimum (44pt touch target + padding)
Swipe right: category picker
Swipe left: flag/exclude
```

### 5.3 Insight Card

```
┌─────────────────────────────────────┐
│  🔴 CRITICAL                        │  ← severity badge
│  Cashflow shortfall in 5 days       │  ← title
│  Projected deficit of $420 based    │  ← description (2 lines max)
│  on upcoming payments.              │
│                                     │
│  [Review Cashflow]    [Dismiss]     │  ← action buttons
└─────────────────────────────────────┘
```

### 5.4 Health Score Ring

```
        ┌───────────┐
        │   ╭───╮   │
        │  │ 78  │  │  ← score inside ring
        │   ╰───╯   │
        │    B+      │  ← grade below
        └───────────┘
Diameter: 120pt
Stroke: 10pt
Colour: grade-dependent (A=Emerald, B=Emerald, C=Amber, D=Amber, F=Red)
Animation: 800ms ease-out on mount
```

### 5.5 Bottom Sheet

Used for: category picker, quick-add forms, notification preferences.

```
┌─────────────────────────────────────┐
│  ═══════  (drag handle)             │
│                                     │
│  Sheet content                      │
│                                     │
└─────────────────────────────────────┘
Initial height: 50% screen
Expandable to: 90% screen
Corner radius: 24pt (top only)
Backdrop: semi-transparent (40% opacity)
```

---

## 6. GESTURE LANGUAGE

| Gesture | Action | Context | Haptic |
|---------|--------|---------|--------|
| Swipe right | Categorise | Transaction row | `selectionChanged` |
| Swipe left | Flag/exclude | Transaction row | `selectionChanged` |
| Long press | AI explanation | Transaction row | `impactMedium` |
| Tap | Drill down | Everywhere | None |
| Pull down | Refresh | Lists, home | `impactLight` at threshold |
| Double tap | Quick-add expense | FAB area | `notificationSuccess` |

---

## 7. NAVIGATION

### Bottom Tab Bar

```
┌──────────┬──────────┬──────────┬──────────┐
│   Home   │  Trans.  │ Insights │   More   │
│   🏠     │   💳     │   💡     │   ⋯     │
└──────────┴──────────┴──────────┴──────────┘
```

- Active tab: Emerald icon + label
- Inactive tab: Grey icon + label
- Height: 83pt (iPhone safe area) / 64pt (Android)
- Tab bar background: White (light) / `#0B1220` (dark)

### Screen Transitions

| Transition | Animation | Duration |
|-----------|-----------|----------|
| Tab switch | Fade | 150ms |
| Push (drill down) | Slide from right | 250ms |
| Bottom sheet open | Slide from bottom | 200ms |
| Modal (alert) | Fade + scale up | 200ms |
| Pull-to-refresh | Native platform refresh | System default |

---

## 8. DARK MODE

| Element | Light | Dark |
|---------|-------|------|
| Background | `#FFFFFF` | `#020617` |
| Surface (cards) | `#F8FAFC` | `#0F172A` |
| Text primary | `#0B1220` | `#F1F5F9` |
| Text secondary | `#64748B` | `#94A3B8` |
| Border | `#E2E8F0` | `#1E293B` |
| Tab bar | `#FFFFFF` | `#0B1220` |

Inherits from web app's theme toggle preference via `UserPreference.theme`.

---

## 9. ACCESSIBILITY

| Requirement | Target |
|-------------|--------|
| Touch targets | ≥44x44pt (WCAG 2.1 AAA) |
| Contrast ratio (text) | ≥4.5:1 (AA) |
| Contrast ratio (large text) | ≥3:1 (AA) |
| VoiceOver (iOS) | All screens readable |
| TalkBack (Android) | All screens readable |
| Dynamic Type (iOS) | Supports up to xxxLarge |
| Font scaling (Android) | Supports system font scale |
| Reduce Motion | Respects system "Reduce Motion" setting |
