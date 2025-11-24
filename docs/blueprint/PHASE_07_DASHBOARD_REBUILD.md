# PHASE 07 — DASHBOARD REBUILD  
### Unified Financial Command Center  
Version: 1.0  

---

# 1. PURPOSE

Phase 07 rebuilds the entire Monitrax dashboard into a **unified, modular, intelligence-aware command center**, powered by:

- UI Core Components (Phase 06)  
- GRDCS (Phase 08.1)  
- Snapshot Engine  
- Insights Engine v2  
- Linkage Health service  
- CMNF navigation framework  

The new dashboard must transform Monitrax from a collection of modules into a **single coherent platform experience** with streamlined navigation, contextual insights, consistent patterns, and real-time health awareness.

---

# 2. OBJECTIVES

The rebuild aims to:

1. Unify visual patterns across the entire app  
2. Introduce real-time insights and linkage health at the top level  
3. Boost page performance and perceived responsiveness  
4. Build a modular dashboard system extensible for future AI phases  
5. Prepare for Phase 09 (Global Navigation, Health, Insights layers)  
6. Remove all legacy UI scaffolding and custom layouts  
7. Standardize all dashboard “modules” under a consistent layout engine  

---

# 3. HIGH-LEVEL RESPONSIBILITIES

The dashboard must:

- Display real-time global financial state  
- Surface the most important insights automatically  
- Provide “jump points” into modules via CMNF  
- Maintain consistent layout skeletons  
- Show global warnings, system health, relational errors  
- Offer smooth transitions, skeleton loading states  
- Support light/dark mode scalability  
- Ensure accessibility and responsive fidelity  

---

# 4. DASHBOARD ARCHITECTURE

Phase 07 introduces a **3-layer dashboard architecture**.

## 4.1 Layer 1 — Global Header Layer  
Always visible. Includes:

- Global breadcrumb (CMNF powered)  
- Global health indicator  
- Global search (Phase 11 integration)  
- User account menu  
- Notifications (Phase 10–11)  

## 4.2 Layer 2 — Insights & Health Layer  
A dynamic strip below the header:

- Warning ribbons  
- Snapshot deltas (wealth, cashflow, assets, liabilities)  
- Top 3 critical/high insights  
- Linkage health summary  

This layer updates in real-time through the UI Sync Engine.

## 4.3 Layer 3 — Module Dashboard Layer  
Each module (Properties, Loans, Accounts, etc.) uses a shared layout:

- Page title + quick actions  
- Metric summary blocks  
- Entity table (DataTable component)  
- Linked Data Panel (Phase 08)  
- Activity feed (optional)  

This layer is plug-and-play: the same skeleton is reused for all modules.

---

# 5. COMPONENTS REQUIRED

Dashboard rebuild uses standardized components from Phase 06.

## 5.1 Page Scaffold Components  
- `DashboardLayout`  
- `PageTitleBlock`  
- `MetricStatBlock`  
- `SectionContainer`  
- `GlobalBreadcrumbBar`  
- `GlobalWarningRibbon`  

## 5.2 Data Visualization Components  
- `DataTable`  
- `DataCard`  
- `MetricStatBlock`  
- `InlineStat`  

## 5.3 Insights & Health Components  
- `DashboardInsightsFeed`  
- `ModuleInsightsPanel`  
- `HealthSummaryWidget`  
- `InsightCard`  
- `SeverityBadge`  

## 5.4 Navigation Components  
- `NavigationEntryPoints`  
- `TabbedContainer`  
- Linked entity buttons  

## 5.5 Dialog Containers  
- `EntityDialog`  
- `SlideOverPanel`

---

# 6. DASHBOARD PANELS & MODULE CONFIGURATION

Each module gets a dedicated dashboard with consistent structure.

## 6.1 Properties Dashboard  
Includes:  
- Property value overview  
- Loan linkages  
- Cashflow impact  
- GRDCS relational preview  
- Insights tab  

## 6.2 Loans Dashboard  
Includes:  
- Interest-only expiry timeline  
- Repayment projections  
- Linked property/account view  

## 6.3 Accounts Dashboard  
- Balance trend chart  
- Linked transactions list  
- Offset account integration  

## 6.4 Income Dashboard  
- Income per frequency  
- Employer/entity grouping  
- Linked expenses where relevant  

## 6.5 Expenses Dashboard  
- Category chart  
- Recurring vs one-time  
- Linked account or loan impacts  

## 6.6 Investments (Accounts, Holdings, Transactions)  
- Portfolio composition  
- Performance metrics  
- Entity-to-entity relationship graph  
- Snapshot 2.0 integration  

---

# 7. INTERACTION DESIGN PRINCIPLES

## 7.1 Navigation  
All navigation uses **CMNF only**.  
No direct routing.  
All entity interactions open dialogs with preserved context.

## 7.2 Loading  
Skeleton loaders for:  
- tables  
- cards  
- summary blocks  
- header indicators  

## 7.3 Desktop, Tablet, Mobile  
Responsive breakpoints:  
- Full table on desktop  
- Compact table on tablet  
- Card grid on mobile  

## 7.4 Real-Time Updating  
The dashboard must live-update:  
- Snapshot changes  
- Health changes  
- Insights regeneration  

(sourced via UI Sync Engine)

---

# 8. PERFORMANCE REQUIREMENTS

- Dashboard must load in < 500ms after initial auth  
- All tables virtualized when > 50 rows  
- Minimize rerenders using memoization & stable keys  
- Lazy-load entity dialogs and secondary widgets  
- Optimize for Next.js RSC compatibility  

---

# 9. ACCESSIBILITY REQUIREMENTS

- Fully keyboard navigable  
- WCAG AA contrast compliance  
- ARIA attributes for navigation & dialogs  
- Screen-reader friendly tab flow  

---

# 10. SYSTEM INTEGRATION REQUIREMENTS

Dashboard MUST integrate seamlessly with:

### 10.1 GRDCS  
All relational displays must use GRDCS canonical chains.

### 10.2 CMNF Navigation  
Breadcrumbs dynamically reflect relational movement.

### 10.3 Insights Engine v2  
Top insights panel + module insights.

### 10.4 Linkage Health Service  
Header badge + warning ribbon + sidebar widget.

### 10.5 UI Sync Engine  
Real-time updates across health, insights, and snapshot.

---

# 11. ACCEPTANCE CRITERIA

The dashboard rebuild is complete when:

- All modules use the unified scaffolding  
- Insights & health layers appear globally  
- Breadcrumb uses actual GRDCS chains  
- No page has bespoke or duplicate UI  
- All lists/tables use DataTable core component  
- Navigation between entities is consistent  
- Snapshot values update in real-time  
- Zero visual drift between modules  
- All panels match spacing, typography, motion rules  

---

# END OF PHASE 07 — DASHBOARD REBUILD

---

# **IMPLEMENTATION STATUS**

**Last Updated:** 2025-11-24
**Overall Completion:** 90%

---

## **Status Summary**

| Component | Status | Notes |
|-----------|--------|-------|
| DashboardLayout | ✅ COMPLETE | 3-layer architecture |
| Global Header Layer | ✅ COMPLETE | Includes health badge |
| Insights & Health Layer | ✅ COMPLETE | Warning ribbon integrated |
| Module Dashboard Layer | ✅ COMPLETE | 8 module pages |
| DashboardInsightsFeed | ✅ COMPLETE | `/components/dashboard/DashboardInsightsFeed.tsx` |
| ModuleInsightsPanel | ✅ COMPLETE | `/components/dashboard/ModuleInsightsPanel.tsx` |
| DataTable (Virtualized) | ⚠️ PARTIAL | Basic table, no virtualization |
| GlobalBreadcrumbBar | ✅ COMPLETE | `/components/dashboard/GlobalBreadcrumbBar.tsx` |
| PageTitleBlock | ✅ COMPLETE | `/components/layout/PageTitleBlock.tsx` |
| Skeleton Loading | ⚠️ PARTIAL | Basic suspense only |
| Real-Time Sync | ✅ COMPLETE | useUISyncEngine (30s) |
| CMNF Integration | ✅ COMPLETE | All modules |
| LinkedDataPanel | ✅ COMPLETE | Tab 4 in dialogs |
| Performance (<500ms) | ⚠️ UNVERIFIED | No benchmarks |

---

## **Existing Implementation Files**

### Dashboard Layout
```
/components/DashboardLayout.tsx      # Main layout with sidebar
/components/health/HealthSummaryWidget.tsx
/components/warnings/GlobalWarningRibbon.tsx
```

### Module Pages (8 total)
```
/app/dashboard/properties/page.tsx
/app/dashboard/loans/page.tsx
/app/dashboard/accounts/page.tsx
/app/dashboard/income/page.tsx
/app/dashboard/expenses/page.tsx
/app/dashboard/investments/accounts/page.tsx
/app/dashboard/investments/holdings/page.tsx
/app/dashboard/investments/transactions/page.tsx
```

### Entity Dialogs
```
/app/dashboard/properties/PropertyDetailDialog.tsx
/app/dashboard/loans/LoanDetailDialog.tsx
# Similar patterns for all modules
```

---

## **Gap: DashboardInsightsFeed (CRITICAL)**

**Blueprint Requirement:** Section 5.3 - Insights & Health Components

**Required Implementation:**

```typescript
// /components/dashboard/DashboardInsightsFeed.tsx
interface DashboardInsightsFeedProps {
  insights: Insight[];
  maxItems?: number;
  onInsightClick?: (insight: Insight) => void;
}

export function DashboardInsightsFeed({ insights, maxItems = 5 }: DashboardInsightsFeedProps) {
  const sortedInsights = insights
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, maxItems);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Active Insights</h3>
      {sortedInsights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
```

---

## **Gap: ModuleInsightsPanel (CRITICAL)**

**Blueprint Requirement:** Section 6 - Dashboard Panels

**Required Implementation:**

```typescript
// /components/dashboard/ModuleInsightsPanel.tsx
interface ModuleInsightsPanelProps {
  module: ModuleType;
  insights: Insight[];
}

export function ModuleInsightsPanel({ module, insights }: ModuleInsightsPanelProps) {
  const moduleInsights = insights.filter(i => i.module === module);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights for {module}</CardTitle>
      </CardHeader>
      <CardContent>
        <InsightList insights={moduleInsights.slice(0, 3)} />
        {moduleInsights.length > 3 && (
          <Button variant="link">View all {moduleInsights.length} insights</Button>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## **Acceptance Criteria Checklist**

| Criterion | Status |
|-----------|--------|
| All modules use unified scaffolding | ✅ |
| Insights & health layers global | ⚠️ Partial |
| Breadcrumb uses GRDCS chains | ❌ UI missing |
| No bespoke/duplicate UI | ✅ |
| Lists/tables use DataTable | ❌ |
| Navigation consistent | ✅ |
| Snapshot updates real-time | ✅ |
| Zero visual drift | ✅ |

---
