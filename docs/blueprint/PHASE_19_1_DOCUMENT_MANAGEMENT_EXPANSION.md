# PHASE 19.1 — DOCUMENT MANAGEMENT SYSTEM (DMS) EXPANSION
Monitrax Blueprint — Phase 19.1
Version: v1.6
Status: Design Complete – Ready for Claude Implementation

---

# 1. Overview
Phase 19.1 expands Monitrax's Document Management System into a complete, entity-attached document layer, allowing users to upload, view, preview, and organize documents at the same place they enter financial data.

Monitrax will now function as a:

- Financial portfolio system
- Strategy engine
- Smart document vault for all financial paperwork

Users can upload documents directly while entering:

- Property expenses
- Insurance policies
- Council rates
- Renovation receipts
- Loan contracts
- Bank statements
- PDS documents
- Investment statements
- Income & expense invoices

All documents are stored with:

- Structured storage paths
- Entity auto-linking
- Google Drive / iCloud / Monitrax Storage support
- Zero guesswork — the system derives links from entity relationships

---

# 2. Goals

### Primary Objectives
✔ Document upload UI added to all entity forms
✔ Multiple storage providers (configurable)
✔ Auto-organization by entity type & hierarchy
✔ Expiration tracking (insurance, rates, etc.)
✔ Vendor name & due date fields
✔ Notification system for renewal
✔ Repair & renovation tracking
✔ Central documents library
✔ Zero regressions in calculations

---

# 3. Problem This Solves
Before Phase 19.1:

- ❌ No upload from entity forms
- ❌ No repair/renovation tracking
- ❌ No expiration alerts
- ❌ Storage not configurable
- ❌ Folder structure inconsistent

Phase 19.1 fixes all.

---

# 4. Architecture Constraints

### Allowed
- UI changes
- Schema & backend extension
- New APIs
- Storage abstraction
- Notification system

### Forbidden
- Changing existing financial logic
- Breaking calculations
- Hallucination-based logic
- Removing existing relationships

---

# 5. Enhanced Requirements (Gap Analysis)

| Feature | Current | Required | Gap |
|--------|---------|----------|-----|
| Upload in forms | ❌ | ✔ | Missing |
| Auto folder structure | ✔ | ✔ | Needs expansion |
| Vendor & due dates | ❌ | ✔ | Missing |
| Repairs tracking | ❌ | ✔ | Missing |
| Storage provider selection | ✔ ? | ✔ | Make functional |
| Expiration alerts | ❌ | ✔ | Missing |
| Smart preview | ✔ Partial | ✔ | Needs component |

---

# 6. Data Model Extensions

### Expense Enhancements

```prisma
model Expense {
  id              String   @id @default(uuid())
  propertyId      String?
  loanId          String?
  investmentId    String?

  vendorName      String?
  dueDate         DateTime?
  autoNotify      Boolean  @default(false)

  documentLinks   DocumentLink[]
  expenseCategory ExpenseCategory @default(GENERAL)
}
```
