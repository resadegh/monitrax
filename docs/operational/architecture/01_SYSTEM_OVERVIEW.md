# System Overview

Monitrax is an Australian personal wealth management platform. It consolidates property, loan, investment, income, expense, and bank account data into a single dashboard with AI-driven insights. This document describes the system at a level appropriate for BAU support -- what the pieces are, how they connect, and where data flows.

---

## High-Level Architecture

```
                          +------------------+
                          |     Users        |
                          |  (Web Browser)   |
                          +--------+---------+
                                   |
                                   | HTTPS
                                   v
                    +------------------------------+
                    |     Vercel (CDN + Edge)       |
                    |  Next.js 15 Frontend + API    |
                    +------+-----------+-----------+
                           |           |
              +------------+           +------------+
              |                                     |
              v                                     v
+---------------------------+         +---------------------------+
| GCP Identity Platform     |         | GCP Cloud SQL             |
| (Firebase Auth)           |         | (PostgreSQL)              |
| - Sign-in / OAuth         |         | - All application data    |
| - MFA (TOTP)              |         | - 83 Prisma models        |
| - Token issuance          |         | - CDR financial data      |
+---------------------------+         +---------------------------+
                                                    ^
                                                    |
              +-------------------------------------+
              |                    |                 |
              v                    v                 v
+------------------+  +-------------------+  +------------------+
| Basiq Open       |  | Google Cloud      |  | External APIs    |
| Banking API      |  | Storage (GCS)     |  | - Resend (email) |
| - AU bank data   |  | - Documents       |  | - Twilio (SMS)   |
| - CDR accounts   |  | - Receipts        |  | - Google Maps    |
| - Transactions   |  | - Uploads         |  | - Gemini AI      |
+------------------+  +-------------------+  +------------------+
```

---

## Component Descriptions

### Vercel (Frontend + API)

Vercel hosts the entire Next.js application -- both the React frontend and the API route handlers. There is no separate backend server. Every API call (`/api/*`) runs as a Vercel serverless function.

| Aspect | Detail |
|--------|--------|
| Framework | Next.js 15.2.6 (App Router) |
| Rendering | React Server Components + client components |
| API routes | 204 route handlers across 46 modules |
| Build | `prisma generate && next build` |
| CDN | Vercel Edge Network (automatic) |

### GCP Cloud SQL (PostgreSQL)

The primary data store. All user data, financial records, audit logs, and CDR data live here.

| Aspect | Detail |
|--------|--------|
| Engine | PostgreSQL 15 |
| ORM | Prisma 5.22.0 |
| Models | 83 Prisma models |
| Instances | `monitrax-db-prod` (production), `monitrax-db-dev` (dev/UAT) |
| Region | us-west1 (Oregon) |
| Schema sync | Manual only -- never automated in build scripts |

### GCP Identity Platform (Firebase Auth)

The sole identity provider. All authentication is delegated to Firebase -- Monitrax does not issue or manage its own JWTs for API authentication.

| Aspect | Detail |
|--------|--------|
| Sign-in methods | Google, Apple, Microsoft, Facebook, Magic Links, Passkeys |
| MFA | Firebase TOTP |
| Token type | Firebase ID token (JWT, 1-hour expiry, auto-refreshed) |
| Session timeout | 30-minute idle auto-logout |
| RBAC | 4 roles: Owner, Admin, Contributor, Viewer (50+ permissions) |

### Google Cloud Storage (GCS)

File storage for documents, receipts, and uploaded files. Managed via the Document Management Engine (Phase 25).

### Basiq Open Banking API

Connects to Australian banks via the Consumer Data Right (CDR) regime. Provides account balances, transaction history, and account details from connected financial institutions.

| Aspect | Detail |
|--------|--------|
| Scope | Australian banks only |
| Data | Account balances, transactions, account numbers, BSBs |
| CDR classification | All Basiq data is CDR-protected |
| Consent | Active consent required for data access |

---

## Data Flow: User Request to Response

A typical authenticated API request flows through these layers:

```
1. User action in browser
       |
2. React component calls /api/{resource}
   with Authorization: Bearer <firebase-id-token>
       |
3. Vercel serverless function receives request
       |
4. Auth middleware (withAuth / withPermission)
   - Verifies Firebase ID token against Google public certs
   - Extracts userId, email, role
   - Syncs user to local DB if first login
       |
5. API route handler
   - Validates input (Zod schemas)
   - Calls canonical service/engine
   - Queries database via Prisma
       |
6. Response returned
   - Standard format: { success, data, error, meta }
   - CDR data sanitised from logs/errors
       |
7. React component renders result
```

**Key rule:** API route handlers are thin wrappers. Business logic lives in dedicated services and engines under `lib/`.

---

## Financial Engines

All financial calculations are performed by pure engine functions. Engines accept data, compute results, and return structured output. They never fetch data themselves or mutate state.

| Engine | Purpose | Location |
|--------|---------|----------|
| Master Financial Service | Single source of all financial data (net worth, cashflow, expenses, debt, health) | `lib/services/masterFinancialService.ts` |
| Tax Engine | ATO-compliant tax calculations | `lib/calculations/` |
| Debt Planner | Loan payoff simulation, strategy comparison | `lib/calculations/` |
| Investment Analytics | CAGR, IRR, TWR, Sharpe Ratio | `lib/calculations/` |
| Depreciation Engine | Division 40 and Division 43 calculations | `lib/calculations/` |
| CGT Engine | Capital gains tax with 5-element cost base | `lib/calculations/` |
| Financial Health Engine | Health scoring across categories (0-100) | `lib/health/` |
| Cashflow Optimisation | Forecasting and stress testing | `lib/calculations/cashflowOrchestrator.ts` |
| AI Strategy Engine | Multi-horizon recommendations via Google Gemini | `lib/ai/` |
| Personal CFO Engine | Unified intelligence orchestration | `lib/services/` |
| Reporting Engine | CSV, Excel, JSON export | `lib/reports/` |
| Document Intelligence | OCR extraction, Gemini AI analysis | `lib/documents/` |

**Important:** The Master Financial Service (`/api/master-snapshot`) is the single entry point for all financial data. Support should direct any "numbers look wrong" investigation there first.

---

## GRDCS: How Modules Connect

The Global Relational Data Consistency System (GRDCS) is the relationship layer that connects all entities. It ensures every entity has:

- A canonical ID (format: `{module}-{uuid}`)
- A canonical URL (format: `/{module}/{id}`)
- A list of linked entities (e.g., a property links to its loans, expenses, income)

GRDCS powers:
- Cross-module navigation (click a loan, see its linked property)
- The LinkedDataPanel in entity detail dialogs
- Linkage health scoring (detects orphan entities or missing relationships)
- Insights Engine input (uses the relationship graph to detect issues)

### Module Relationship Map

```
Properties ----> Loans
    |               |
    v               v
 Expenses     Offset Accounts
    |               |
    v               v
 Income        Transactions
    
Investment Accounts ----> Holdings
         |                    |
         v                    v
    Transactions         Transactions
```

**Strict boundary rule:** Modules do not directly query each other's data. All cross-module data flows through the Snapshot Engine, Insights Engine, or the module's own API.

---

## Dashboard Modules

The application has 17 dashboard sections:

| Module | Path | Description |
|--------|------|-------------|
| Properties | `/dashboard/properties` | Investment and personal property tracking |
| Balances | `/dashboard/balances` | **Canonical accounts surface (Phase 36 + Phase 43.1, 2026-05-09)** — Cash / Credit / Debt sections, inline `<AccountDetailDialog>` + `<LoanDetailDialog>`, Connect Bank, Hidden Wealth Lens (3-bucket accessibility split). Replaces both legacy `/dashboard/accounts` and bare `/dashboard/loans` list pages. |
| Loans (detail) | `/dashboard/loans/[id]` | Loan full-page detail + `/[id]/strategy` debt-strategy planner. **Bare `/dashboard/loans` redirects to `/dashboard/balances`** as of Phase 36 Phase 2e (2026-05-09). |
| Income | `/dashboard/income` | All income sources with budget vs actual |
| Expenses | `/dashboard/expenses` | Categorised expenses with receipt attachments. **Phase 43.2 Spending Pareto Lens (2026-05-09)** — top-vital-few categories driving 80% of monthly spend. |
| Budget Analysis | `/dashboard/budget-analysis` | AI-generated budget estimate. **Phase 43.3 Margin Trend Lens (2026-05-09)** — 6-month savings-rate sparkline + sliding-window trend direction. |
| Investments | `/dashboard/investments` | Investment accounts and holdings |
| Assets | `/dashboard/assets` | Vehicles, equipment, collectibles |
| Tax | `/dashboard/tax` | ATO tax calculations and deductions |
| Debt Planner | `/dashboard/debt-planner` | Loan payoff strategies and simulations |
| CFO | `/dashboard/cfo` | Personal CFO score, risk radar, action engine |
| Reports | `/dashboard/reports` | Export and reporting |
| Budget Analysis | `/dashboard/budget-analysis` | Budget vs actual analysis |
| Documents | `/dashboard/documents` | Document management and uploads |
| Household Profile | `/dashboard/household-profile` | Household members, pets, profile |
| Settings | `/dashboard/settings` | User preferences and configuration |
| Admin | `/dashboard/admin` | Administrative functions |
| Main Dashboard | `/dashboard` | Portfolio overview with insights |

---

## API Structure

API routes follow the pattern `/api/{module}/route.ts` with standard CRUD operations. All responses use the universal format:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "timestamp": "2026-04-09T12:00:00.000Z",
    "durationMs": 42
  }
}
```

Key operational endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/api/master-snapshot` | All financial data (single source of truth) |
| `/api/health` | Application health check |
| `/api/basiq/*` | Open Banking connection and sync |
| `/api/cdr/*` | CDR data lifecycle management |
| `/api/auth/*` | Authentication helpers |
| `/api/admin/*` | Administrative operations |

---

## Audit Logging

All state-changing actions are logged to an immutable audit trail (40+ event types). Audit logs record who did what and when, but never include CDR-protected financial data in the metadata (sanitised via `sanitizeCdrMetadata()`).

---

Last Updated: 2026-04-09
