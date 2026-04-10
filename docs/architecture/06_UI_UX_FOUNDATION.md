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

# **14. Acceptance Criteria**

Monitrax UI/UX foundation is correct when:

- All modules look cohesive and uniform  
- All interactions feel predictable  
- Navigation is seamless and contextual  
- Dialogs are the dominant interaction pattern  
- Health + insights panels behave identically everywhere  
- No module has “its own style”  

Consistency is the north star.

---


