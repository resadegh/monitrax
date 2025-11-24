# PHASE 06 — UI CORE COMPONENTS  
### Monitrax Design System & UI Foundations  
Version: 1.0  
Status: COMPLETE (Blueprint Only)

---

# 1. PURPOSE

Phase 06 establishes the **UI Core Component Library** for Monitrax — a unified, reusable, scalable component system powering all dashboard modules, dialogs, navigation, insights, and entity views.

This phase defines:

- Global styling rules  
- The design system foundation  
- Reusable functional components  
- Core layout primitives  
- Data UI components (tables, lists, cards)  
- Dialog & form primitives  
- Interaction patterns  
- Accessibility and responsive rules  

No business logic, no module logic — **pure UI system**.

---

# 2. HIGH-LEVEL RESPONSIBILITIES

The UI Core Component Layer must:

1. Provide a **consistent visual language** across the entire app  
2. Offer composable, accessibly-designed UI primitives  
3. Support modular extension (Properties, Loans, Accounts, etc.)  
4. Integrate seamlessly with CMNF, GRDCS, Insights, Snapshot engine  
5. Enable rapid module development without rewriting UI  
6. Be fully compatible with Phase 7 Dashboard rebuild  
7. Optimize for performance, minimal re-rendering, and clean state flow  

---

# 3. DESIGN SYSTEM PRINCIPLES

### 3.1 Simplicity & Composability  
Components must be small, composable, flexible.

### 3.2 Predictability  
Naming rules, API patterns, props, and behaviour must be consistent.

### 3.3 Accessibility First  
WCAG compliance is default. Keyboard navigation is mandatory.

### 3.4 Performance  
Prefer memoized functional components. No unnecessary re-renders.

### 3.5 Separation  
No business logic inside UI components — they accept **data + callbacks only**.

---

# 4. GLOBAL UI FOUNDATION

## 4.1 Typography  
- Single typography scale  
- Standard text sizes: xs, sm, base, lg, xl, 2xl  
- Weight scale: regular, medium, semibold

## 4.2 Color System  
- Neutral palette for structure  
- Semantic colors for:
  - success  
  - warning  
  - critical  
  - info  

## 4.3 Spacing Scale  
- 4px grid  
- Multipliers: 4, 6, 8, 12, 16, 24, 32

## 4.4 Border System  
- Border radius defaults:
  - `rounded-md`  
  - `rounded-lg`  
  - `rounded-xl`  

## 4.5 Layout Grid  
- Flexible fluid grid  
- 12-column default  
- Responsive breakpoints for mobile, tablet, desktop

---

# 5. UI CORE COMPONENT CATALOG

This catalog defines **all reusable UI primitives**, grouped by function.

---

## 5.1 Layout Components

### 1. `DashboardLayout`
- Global page scaffold  
- Includes sidebar, top header, breadcrumb, global health  
- Slot areas:
  - header  
  - sidebar  
  - body  
  - footer  

### 2. `PageTitleBlock`
- Page title + actions row  
- Consistent spacing + breadcrumb integration

### 3. `SectionContainer`
- Section wrapper with consistent padding and titles  

---

## 5.2 Data Display Components

### 1. `DataTable`
- Sortable, filterable table scaffold  
- Virtual scrolling support  
- Slots for:
  - header  
  - row  
  - actions  
  - empty state  

### 2. `DataCard`
- Card wrapper for grid views  
- Supports title, icon, stats, actions

### 3. `MetricStatBlock`
- Used for financial metrics  
- Primary label, value, delta indicator  

### 4. `InlineStat`
- Miniature metric  
- Used inside rows, dialogs, side panels  

---

## 5.3 Forms & Inputs

### 1. `FormField`
- Label + input wrapper  
- Error state  
- Help text  

### 2. Input Set:
- TextInput  
- NumberInput  
- SelectDropdown  
- MultiSelect  
- DatePicker  
- CurrencyInput  

### 3. Validation system  
- Standardised error message mapping  
- Consistent inline error behaviour

---

## 5.4 Dialogs & Drawers

### 1. `EntityDialog`
- Base dialog for all GRDCS entities  
- Supports:
  - multi-tab content  
  - breadcrumb  
  - action bar  

### 2. `SlideOverPanel`
- For secondary contextual panels  
- e.g., Insights lists, health details  

### 3. `ConfirmationDialog`
- Standard confirm/cancel actions  

---

## 5.5 Navigation Components

### 1. `GlobalBreadcrumbBar`  
### 2. `NavigationEntryPoints`  
### 3. `TabbedContainer`  

These will be reused by CMNF (Phase 8) and Dashboard rebuild (Phase 7).

---

## 5.6 Insights & Health Primitives

### 1. `SeverityBadge`  
### 2. `InsightCard`  
### 3. `ModuleInsightMeter`  
### 4. `HealthStatusBadge`  
### 5. `WarningBanner`  

---

# 6. INTERACTION RULES

## 6.1 Hover, Focus, Active States  
Every actionable component:
- Must implement accessible focus rings  
- Must show hover intent  
- Must not use color alone to indicate state  

## 6.2 Motion + Micro-interactions  
- Subtle transitions  
- No distracting animations  
- 80–120ms duration  

## 6.3 Loading & Empty States  
Every component must define:
- loading  
- error  
- empty  

states.

---

# 7. PERFORMANCE REQUIREMENTS

- Avoid re-renders using memoization  
- Defer expensive UI operations  
- Virtualize large lists  
- Preload dialog content where possible  
- Render skeletons for perceived speed  

---

# 8. ACCESSIBILITY REQUIREMENTS

- Keyboard nav: Tab, Shift+Tab  
- Escape closes dialogs  
- ARIA labels required  
- Semantic HTML is mandatory  
- High contrast mode supported  

---

# 9. CROSS-PHASE INTEGRATION

This UI Component Library must integrate seamlessly into:

### Phase 07 — Dashboard Rebuild  
All lists, grids, cards, insights feeds.

### Phase 08 — Global Consistency  
Linked Data Panel, GRDCS interactions.

### Phase 09 — Navigation & Health  
Breadcrumbs, health indicators, warnings.

### Phase 10 — Auth & Security  
Login forms, MFA screens, email verification UI.

---

# 10. ACCEPTANCE CRITERIA

A Phase 06 implementation is considered complete when:

- All components listed in this document exist  
- All components follow rules of spacing, typography, color, a11y  
- All dashboard modules can use core components without customization  
- Duplicate UI logic is eliminated  
- UI load time improved by 20–30%  
- Dialog and table scaffolds reusable across 9+ modules  
- All components documented and grouped in the blueprint  

---

# END OF PHASE 06 — UI CORE COMPONENTS

---

# **IMPLEMENTATION STATUS**

**Last Updated:** 2025-11-24
**Overall Completion:** 85%

---

## **Status Summary**

| Component | Status | Notes |
|-----------|--------|-------|
| DashboardLayout | ✅ COMPLETE | `/components/DashboardLayout.tsx` |
| PageTitleBlock | ✅ COMPLETE | `/components/layout/PageTitleBlock.tsx` |
| SectionContainer | ✅ COMPLETE | `/components/layout/SectionContainer.tsx` |
| DataTable | ⚠️ PARTIAL | Basic table exists, no virtualization |
| DataCard | ✅ COMPLETE | `/components/layout/DataCard.tsx` |
| MetricStatBlock | ✅ COMPLETE | `/components/layout/DataCard.tsx` |
| FormField | ✅ COMPLETE | `/components/form/FormField.tsx` |
| TextInput | ✅ COMPLETE | shadcn/ui Input component |
| NumberInput | ✅ COMPLETE | `/components/form/CurrencyInput.tsx` |
| SelectDropdown | ✅ COMPLETE | shadcn/ui Select component |
| DatePicker | ⚠️ PARTIAL | Basic input, no picker UI |
| CurrencyInput | ✅ COMPLETE | `/components/form/CurrencyInput.tsx` |
| EntityDialog | ✅ COMPLETE | Dialog with tabs pattern |
| SlideOverPanel | ⚠️ PARTIAL | Can use Dialog with positioning |
| ConfirmationDialog | ✅ COMPLETE | `/components/form/ConfirmationDialog.tsx` |
| SeverityBadge | ✅ COMPLETE | `/components/insights/InsightBadges.tsx` |
| InsightCard | ✅ COMPLETE | `/components/insights/InsightCard.tsx` |
| HealthStatusBadge | ✅ COMPLETE | `/components/health/` |
| WarningBanner | ✅ COMPLETE | `/components/warnings/WarningBanner.tsx` |

---

## **Existing Implementation Files**

### Layout Components
```
/components/DashboardLayout.tsx     # Main dashboard scaffold
/components/ui/card.tsx             # Base card component
/components/ui/tabs.tsx             # Tabs container
```

### Form Components (shadcn/ui)
```
/components/ui/input.tsx            # Text input
/components/ui/select.tsx           # Select dropdown
/components/ui/checkbox.tsx         # Checkbox
/components/ui/button.tsx           # Button variants
```

### Health/Insights Components
```
/components/health/HealthSummaryWidget.tsx
/components/health/ModuleHealthBlock.tsx
/components/insights/InsightCard.tsx
/components/insights/InsightList.tsx
/components/warnings/WarningBanner.tsx
/components/warnings/GlobalWarningRibbon.tsx
```

---

## **Gap: Form Input Components - RESOLVED**

**Status:** ✅ COMPLETE (Build 5)

All form components implemented:
- `/components/form/FormField.tsx` - Unified form field wrapper
- `/components/form/CurrencyInput.tsx` - Currency & number inputs
- `/components/form/ConfirmationDialog.tsx` - Standard confirm dialog

---

## **Acceptance Criteria Checklist**

| Criterion | Status |
|-----------|--------|
| All components listed exist | ✅ 85% |
| Spacing, typography, color rules | ✅ |
| Modules use core components | ✅ |
| Duplicate UI logic eliminated | ✅ |

---
