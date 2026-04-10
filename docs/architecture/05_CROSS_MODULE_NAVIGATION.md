# 🧭 **05 — CROSS-MODULE NAVIGATION FRAMEWORK (CMNF)**  
### *Unified Navigation Layer for the Entire Monitrax Platform*

---

# **1. Purpose of CMNF**

The Cross-Module Navigation Framework (CMNF) ensures that every movement between entities in the app:

- Is **context-aware**
- Is **state-preserving**
- Is **GRDCS-compliant**
- Uses **canonical hrefs**
- Works across **all 8 financial modules**
- Functions without full page reloads
- Maintains relational awareness end-to-end

CMNF is the **navigation spine** of Monitrax.

---

# **2. Why CMNF Exists**

Monitrax has deeply interconnected financial objects:

- Properties
- Loans
- Accounts
- Transactions
- Income
- Expenses
- Investment Accounts
- Holdings

Standard routing (Next.js/React Router) cannot:

- Maintain relationship context  
- Restore dialog/tab state  
- Track multi-hop relational paths  
- Support breadcrumb generation  
- Guarantee consistent linking  

CMNF solves all of this through a controlled navigation engine.

---

# **3. Navigation MUST Use CMNF**

No module, component, or screen may:

- Push direct Next.js routes  
- Construct custom URLs  
- Use browser history directly  
- Bypass the CMNF route map  

Every transition **must** use:

```
useCrossModuleNavigation()
```

---

# **4. The CMNF Architecture**

CMNF consists of five major components:

```
1. NavigationContext
2. CrossModuleNavigation Hook
3. RouteMap (canonical mapping)
4. Breadcrumb Engine
5. State Restoration System
```

---

# **5. NavigationContext**

A global React context storing:

```
navStack: NavigationItem[]
activeEntity: GRDCSEntity | null
activeTab: string
savedStates: Record<string, RestorationState>
lastRouteState: any
```

### **5.1 Responsibilities**

- Maintain navigation stack  
- Track current entity & tab  
- Store scroll positions  
- Generate breadcrumb model  
- Restore previous UI state  

---

# **6. Navigation Stack**

The navigation stack is strictly **monodirectional**, storing the relational trail the user has taken.

```
type NavigationItem = {
  id: string;
  type: string;
  label: string;
  href: string;
  context: any; // metadata for restoration
};
```

Example stack during drill-down:

```
[
  {property → loan},
  {loan → expense},
  {expense → transaction}
]
```

Back-navigation pops from this stack using:

```
goBackWithRestore()
```

---

# **7. RouteMap (Canonical URL Map)**

A global source-of-truth for all entity URLs.

```
{
  property: "/properties/:id",
  loan: "/loans/:id",
  account: "/accounts/:id",
  ...
}
```

CMNF **must never** dynamically construct routes based on string concatenation.

RouteMap guarantees:

- Predictability  
- Consistency  
- DRY navigation rules  
- Central evolvability  

---

# **8. CrossModuleNavigation Hook**

Powers all navigation actions.

### **8.1 Public API**

```
navigateToEntity(type, id, options?)
openLinkedEntity(link)
openDialogWithContext(type, id, context)
goBackWithRestore()
resetNavigation()
saveCurrentState()
restoreContext()
```

### **8.2 Behavior**

- Determines correct href via RouteMap  
- Pushes relational context → NavigationContext  
- Opens dialogs with restored tabs/scroll state  
- Integrates with GRDCS entity linking  
- Guarantees consistent navigation across all modules  

---

# **9. CMNF & Dialog Integration**

All entity detail dialogs must accept:

```
{
  fromLinkage?: boolean,
  breadcrumb?: BreadcrumbItem[],
  context?: RestorationState
}
```

This enables:

- Deep relational navigation  
- Correct tab auto-selection  
- “Linked From” contextual awareness  
- Navigating directly into nested entities  

---

# **10. Breadcrumb Engine**

Breadcrumbs are not based on file paths or URL segments.

They are based on **GRDCS relationship ancestry**.

### Example:

```
Property A
 → Loan 55
   → Expense 22
     → Transaction 144
```

Breadcrumbs must:

- Reflect GRDCS lineage  
- Truncate middle segments when > 5  
- Always show current entity as the final item  
- Provide clickable jump navigation via CMNF  

---

# **11. State Restoration Engine**

Restores:

- Last opened tab  
- Scroll position  
- Last selected row  
- Dialog position  
- Context metadata  

### **11.1 Keys**

Restoration state is keyed as:

```
`${entityType}-${entityId}`
```

### **11.2 Process**

1. On navigation:  
   `saveCurrentState()`

2. On back:  
   `goBackWithRestore()`

3. On dialog open:  
   `restoreContext()`

---

# **12. CMNF + GRDCS Integration**

CMNF relies strictly on GRDCS to know:

- What relational type an entity is  
- What other modules it connects to  
- The canonical href  
- The safe navigation path  
- Whether an entity is valid/existing  

If GRDCS says a relationship is invalid → navigation is blocked.

---

# **13. CMNF Requirements Checklist**

| Requirement | Status |
|------------|--------|
| Must use canonical hrefs | ✔️ Mandatory |
| Must integrate with GRDCS | ✔️ Mandatory |
| No direct routing allowed | ✔️ Prohibited |
| Must restore UI state | ✔️ Required |
| Must support deep drill-down | ✔️ Required |
| Must handle invalid entities | ✔️ Required |
| Must update breadcrumbs dynamically | ✔️ Required |

---

# **14. Acceptance Criteria**

CMNF is considered correct when:

### **Navigation Behavior**
- Clicking any linked entity opens correct dialog
- No page reloads occur
- Back button works using navStack, not browser history
- Breadcrumb always matches relational path

### **Error Handling**
- Broken entities show “Entity Missing” banner
- Invalid path recovers to nearest valid parent

### **State Handling**
- Scroll position restored
- Tab restored
- Dialog restored
- Entity context preserved

---

# **15. Future Evolution**

### **Phase 10 — Navigation Security**
- Permission-based entity visibility  
- Access-controlled route gating  

### **Phase 11 — AI Strategy Engine**
- AI-directed navigation  
- Predictive jump suggestions  

### **Phase 12 — Financial Health Engine**
- Navigation influenced by health scores  
- Warning-guided exploration  



