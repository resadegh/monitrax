# PHASE 09 — GLOBAL NAVIGATION, HEALTH SYSTEM & INSIGHTS LAYER  
### Unified Navigation Framework • Real-Time Health • Insights v2 UI • Analytics  
Version: 1.0  

---

# 1. PURPOSE

Phase 09 unifies Monitrax’s **navigation, system health, and insights intelligence** into a single coherent user experience.

It creates the global experience layer:  
- The breadcrumb bar  
- The health badge  
- System-level warning ribbons  
- Insights surfaces  
- Back-navigation stack  
- Real-time UI Sync Engine  
- Navigation analytics  
- Cross-module deep linking  

This phase is the “global brainstem” of the platform.

---

# 2. OBJECTIVES

1. Build a consistent cross-module navigation experience.  
2. Surface global system health at all times.  
3. Provide a universal insights system integrated across modules.  
4. Keep UI reactive to backend changes (health, snapshot, insights).  
5. Track how users navigate across data for future AI phases.  
6. Guarantee no broken links, missing relationships, or blind spots.  

---

# 3. PHASE SUBCOMPONENTS

### 3.1 Unified Navigation Layer (CMNF)  
Breadcrumbs, relational context, deep linking, back navigation.

### 3.2 Global Health Indicator  
Real-time badge, modal breakdown, and health-driven warnings.

### 3.3 Global Insights Integration  
Unified components, dashboard feed, per-module insights, entity-level insights tabs.

### 3.4 UI Sync Engine  
A background engine that keeps the UI consistent with backend snapshot + health.

### 3.5 Global Warning System  
Ribbon/warnings triggered by health & consistency issues.

### 3.6 Navigation Analytics  
Anonymous, local-only usage analytics for future AI enhancements.

---

# 4. UNIFIED NAVIGATION LAYER (CMNF)

## 4.1 Purpose  
Provide a **deterministic, entity-aware navigation system** independent of routing.

## 4.2 Key Responsibilities

- Maintain navigation stack (push, pop, restore).  
- Guarantee context-aware back navigation.  
- Generate global breadcrumb chain.  
- Handle cross-module deep linking.  
- Preserve state:
  - Active tab  
  - Scroll position  
  - Parent chain  
  - Relational entrypoint  
  - Historical ancestry  

## 4.3 Architectural Requirements

- Entirely client-managed  
- Zero hardcoded module routes  
- Must rely exclusively on GRDCS  
- Every navigation action must produce a deterministic breadcrumb  
- Preserve relational context even when deep linking multiple entities  

## 4.4 NavigationContext Must Store:

- `navStack[]`  
- `lastEntity`  
- `activeTab`  
- `lastRouteState`  
- `scrollPositions{}`  
- `contextMetadata{}`  

## 4.5 Breadcrumb Rules

- Must show real relational ancestry (from GRDCS)  
- Must collapse long chains (truncate middle segments)  
- Must always show current + parent entity  
- Must allow click-to-navigate  

## 4.6 Back Navigation Rules

- Not browser history  
- Use navigation stack  
- Must restore:
  - Tabs  
  - Scroll  
  - Entity context  
  - Breadcrumb  
  - Relational entrypoint  

---

# 5. GLOBAL HEALTH INDICATOR

## 5.1 Purpose  
Surface a **real-time view** of the system’s relational health.

## 5.2 Display Rules

- Must be present on every dashboard page  
- Badge color reflects health severity  
- Tooltip shows quick metrics  
- Clicking opens Health Modal  

## 5.3 Severity Colors

| Score Range | Color     | Meaning |
|-------------|-----------|---------|
| 85–100      | Green     | Healthy |
| 70–85       | Yellow    | Minor issues |
| 50–70       | Orange    | Structural issues |
| <50         | Red       | Critical issues |

## 5.4 Health Modal Requirements

Must include:

- Module breakdown  
- Missing links list  
- Orphaned entities  
- Consistency violations  
- Recommended fixes  
- Snapshot timestamp  
- Drill-down to affected entities  

---

# 6. GLOBAL INSIGHTS INTEGRATION (INSIGHTS ENGINE V2)

## 6.1 Purpose  
Provide a **unified intelligence layer** across the whole UI.

## 6.2 Insight Types

- Critical  
- High  
- Medium  
- Low  

## 6.3 Component Surfaces

### A. Dashboard Insights Feed  
- Prioritised insights (sorted by severity)  
- Quick actions (“Fix”, “Open Entity”)  

### B. Module-Level Insights  
- Top insights per module  
- “View all insights” button  

### C. Entity-Level Insights Tab  
- Insight list scoped to the specific entity  
- Linkage-related issues  
- Recommendations  

### D. Severity Indicators  
- Badges  
- Bars  
- Meters  

All must use consistent color and severity rules system-wide.

---

# 7. UI SYNC ENGINE

## 7.1 Purpose  
Automatically keeps the UI fresh without manual refresh.

## 7.2 Polling Sources

- Portfolio Snapshot  
- Linkage Health  
- Global Insights  

## 7.3 Responsibilities

- Update header health badge  
- Refresh insights feed  
- Update dashboard widgets  
- Refresh entity insights  
- Trigger warning ribbons  
- Notify navigation layer if relationships change  

## 7.4 Requirements

- Default polling: 15 seconds  
- Debounce updates to avoid flickers  
- Never interrupt user interaction  
- Never rerender dialogs unexpectedly  
- All updates must be idempotent  

---

# 8. GLOBAL WARNING SYSTEM

Triggered when health engine detects critical issues.

## 8.1 Ribbon Conditions

- orphanCount > 0  
- missingLinks > threshold  
- crossModuleConsistency < 75  
- globalHealthScore < 70  

## 8.2 Ribbon Rules

- Visible at top of every screen  
- Click opens Health Modal  
- Auto-dismiss if issues are resolved  
- Style consistent across modules  

## 8.3 Entity Dialog Warning Banners

Shown when entity has:

- missing parents  
- incomplete relationships  
- invalid references  
- orphaned state  

---

# 9. NAVIGATION ANALYTICS

## 9.1 Purpose  
Collect behaviour data to support future AI (Phase 11).

## 9.2 Must Track

- Most-navigated entity types  
- Broken navigation attempts  
- Navigation path depth  
- Repeated navigation loops  
- Which modules lead to which entities  
- Time spent inside certain flows  
- Entities that cause user drop-off  

## 9.3 Requirements

- Entirely local (no backend storage)  
- JSON persisted in localStorage  
- Resettable via Dev Panel  
- Only functional data, no PII  
- Consumed in Phase 11 AI advisor training  

---

# 10. CROSS-MODULE INTEGRATION RULES

### 10.1 All Navigation Must Use CMNF  
No module may define its own routing rules.

### 10.2 All Relationships Must Use GRDCS  
No manual relationship mapping allowed.

### 10.3 All Insights Must Use Snapshot + Health  
No local calculations except UI formatting.

### 10.4 All Health Indicators Must Use Linkage Health  
No local heuristics allowed.

---

# 11. ACCEPTANCE CRITERIA

Phase 09 is complete when:

### Navigation
- Breadcrumbs reflect relational ancestry  
- Back navigation works for all entity types  
- Navigation stack restores full context  
- Zero broken entity paths  
- Multi-hop navigation works across all modules  

### Insights
- Dashboard feed shows valid insights  
- Module pages show module-specific insights  
- Entity dialogs show contextual insights  
- CTA buttons correctly navigate via CMNF  

### Health
- Badge always accurate  
- Modal diagnostics correct  
- Warning ribbons trigger correctly  
- Entity banners correspond to health engine signals  

### Sync Engine
- UI updates automatically every 15 seconds  
- No unintended UI jumps  
- Snapshot & insights update seamlessly  

### Analytics
- Data captured locally  
- Dev panel displays data  
- No crashes, leaks, or UI interruptions  

---

# END OF PHASE 09 — GLOBAL NAVIGATION, HEALTH & INSIGHTS LAYER
