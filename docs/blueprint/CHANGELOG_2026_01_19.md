# Changelog - 2026-01-19

## Phase 32: Enterprise Portal - APPROVED FOR IMPLEMENTATION

### Overview

Comprehensive blueprint documentation for the Enterprise Portal feature has been completed and **APPROVED**. This enables Monitrax to be sold to organizations (accountants, financial advisors) who can provide the app to their clients while having portal access to view client financial data and integrate with accounting software.

### Document

- **PHASE_32_ENTERPRISE_PORTAL.md** (v1.2) - Complete specification

### Key Decisions Made

| Decision | Resolution |
|----------|------------|
| Pricing Model | TBD - To be finalized later |
| White-Labeling | YES - Required (Phase 30.11) |
| SSO/SAML | YES - Required (Phase 30.12) |
| Multi-Organization Clients | YES - One client can belong to multiple orgs |
| API Access | **CRITICAL** - Required for Xero integration (Phase 30.13) |
| Xero Integration | **CRITICAL** - Primary accounting software integration (Phase 30.14) |
| Other Accounting Apps | YES - Extensible framework for MYOB, QuickBooks, etc. (Phase 30.15) |
| Login Experience | Unified login page with Personal/Organization mode selection |

### Data Models (15 new/enhanced)

| Model | Purpose |
|-------|---------|
| `Organization` (enhanced) | White-labeling, SSO, integration support |
| `OrganizationClient` | Links clients to organizations with consent |
| `OrganizationInvitation` | Manages staff and client invitations |
| `OrganizationApiKey` | API key management for external access |
| `ClientNote` | Private notes for advisors |
| `ClientTask` | Task/reminder management per client |
| `ClientAccessLog` | Compliance audit trail |
| `AccountingIntegration` | Generic multi-provider integration |
| `IntegrationSyncLog` | Sync operation tracking |
| `IntegrationEntityMapping` | Monitrax ↔ External entity mapping |

### New Enums

- `OrganizationType` - ACCOUNTING_FIRM, FINANCIAL_ADVISOR, etc.
- `OrganizationPlan` - STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE
- `ClientStatus` - INVITED, PENDING, ACTIVE, SUSPENDED, ARCHIVED
- `DataAccessScope` - FULL, FINANCIAL, INVESTMENTS, TAX, DOCUMENTS, TRANSACTIONS
- `ConsentStatus` - PENDING, GRANTED, REVOKED, EXPIRED
- `AccountingProvider` - XERO, MYOB, QUICKBOOKS, SAGE, FRESHBOOKS, WAVE, OTHER
- `IntegrationSyncDirection` - OUTBOUND, INBOUND, BIDIRECTIONAL
- `IntegrationSyncStatus` - PENDING, IN_PROGRESS, COMPLETED, FAILED, PARTIAL

### Implementation Phases (15 total)

| Phase | Focus | Priority |
|-------|-------|----------|
| **32.1** | Foundation (schema, auth, routes) | HIGH |
| **32.2** | Organization Management | HIGH |
| **32.3** | Client Management | HIGH |
| **32.4** | Consent System | HIGH |
| **32.5** | Client Data Access | HIGH |
| **32.6** | Advisor Tools (notes, tasks) | MEDIUM |
| **32.7** | Export & Reporting | MEDIUM |
| **32.8** | Audit & Compliance | MEDIUM |
| **32.9** | Billing Integration | MEDIUM |
| **32.10** | Polish & Testing | HIGH |
| **32.11** | White-Labeling | MEDIUM |
| **32.12** | SSO/SAML | MEDIUM |
| **32.13** | API Access | **CRITICAL** |
| **32.14** | Accounting Integrations (Xero) | **CRITICAL** |
| **32.15** | Additional Providers (MYOB, etc.) | LOW |

### API Endpoints (60+)

- Organization management APIs
- Team management APIs
- Client management APIs
- Client data access APIs (read-only)
- Advisor tools APIs (notes, tasks)
- Consent management APIs
- White-labeling APIs
- SSO/SAML APIs
- API key management APIs
- External API (for org API keys)
- Accounting integration APIs

### UI/UX Features

1. **Unified Login Page** - Single entry point with Personal/Organization mode
2. **Context Switcher** - Navigate between personal dashboard and org portals
3. **Portal Dashboard** - Organization overview with client metrics
4. **Client List** - Searchable, filterable client management
5. **Client Detail View** - Read-only financial data with tabs
6. **Integration Settings** - Connect and configure accounting software

---

## Update: Isolation & Non-Breaking Implementation (v1.4)

Added **Section 8: Isolation & Non-Breaking Implementation** to ensure the Enterprise Portal does NOT interfere with the main application.

### Core Isolation Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Additive Only** | Only ADD new code/tables, never modify existing |
| 2 | **Separate Routes** | All portal routes under `/portal/*` and `/api/portal/*` |
| 3 | **Separate Components** | New components in `/components/portal/*` |
| 4 | **Feature Flags** | All features behind flags, disabled by default |
| 5 | **No Existing API Changes** | Current APIs unchanged, new endpoints only |
| 6 | **No Existing UI Changes** | Main dashboard untouched except context switcher |
| 7 | **Approval Required** | ANY main app change requires explicit owner approval |

### Changes Requiring Owner Approval

| Change | Status |
|--------|--------|
| Login mode selector | ⏳ PENDING |
| Context switcher | ⏳ PENDING |
| `/api/auth/me` extension | ⏳ PENDING |
| User settings: Organizations | ⏳ PENDING |
| User model relation | ⏳ PENDING |
| Organization model extension | ⏳ PENDING |
| New permissions | ⏳ PENDING |

### Rollback Strategy

- Feature flags can disable all portal features instantly
- New tables are isolated and don't affect main app
- Emergency: git revert or disable flags

---

## Update: Data Integrity Architecture (v1.3)

Added comprehensive **Section 7: Data Integrity Architecture** to ensure data correctness and prevent duplication.

### Key Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Monitrax = Single Source of Truth** | All data owned by Monitrax only |
| 2 | **Export-Only by Default** | One-way sync to external systems (Xero, etc.) |
| 3 | **No Duplication** | Entity mappings link IDs, don't copy data |
| 4 | **External Edits Ignored** | Changes in Xero don't affect Monitrax |
| 5 | **Hash-Based Change Detection** | Only sync if data actually changed |
| 6 | **Full Audit Trail** | Every sync operation logged |
| 7 | **Transactional Integrity** | Atomic operations, rollback on failure |
| 8 | **Verification Checks** | Post-sync validation of critical fields |
| 9 | **Conflict Alerting** | Warn when external data differs |
| 10 | **Reference-Only Imports** | Inbound data for mapping only, not overwriting |

### Data Flow

```
MONITRAX (Source of Truth)
    │
    │  Export Only (one-way)
    ▼
┌──────────────────────────────────────┐
│  XERO / MYOB / QuickBooks (Consumers) │
│  - Receive data from Monitrax        │
│  - Cannot modify Monitrax data       │
│  - External edits are ignored/warned │
└──────────────────────────────────────┘
```

### Additions to Blueprint

- Section 7.1: Single Source of Truth Strategy
- Section 7.2: Data Flow Rules
- Section 7.3: Data Categories & Ownership
- Section 7.4: Sync Behavior Specification
- Section 7.5: Data Validation Rules
- Section 7.6: Data Consistency Guarantees (ACID)
- Section 7.7: Optional Limited Inbound Data
- Section 7.8: Data Integrity Monitoring
- Section 7.9: Summary of 10 Integrity Principles

---

## Status: APPROVED

**Ready to begin implementation** starting with Phase 30.1 (Foundation).

### Remaining Open Questions

1. Pricing tier specifics (TBD)
2. Data retention period for access logs
3. International/non-Australian org support
4. Custom domain support details

---

*Author: Claude AI*
*Status: Approved for Implementation (pending main app change approvals)*
*Date: 2026-01-19*
*Document Version: 1.4*
