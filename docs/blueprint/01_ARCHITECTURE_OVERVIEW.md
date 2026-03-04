# 🏛️ **01 — ARCHITECTURE OVERVIEW**  
### *High-Level System Architecture for Monitrax*

---

## **1. Purpose**

This document describes the **high-level architecture** of the entire Monitrax platform — backend, frontend, engines, UI, navigation, security, and intelligence systems.

It provides a **holistic, top-down blueprint** used by engineers, product teams, and AI agents (ChatGPT / Claude) to ensure consistent implementation across all phases.

---

# **2. Core Architecture Philosophy**

Monitrax architecture is based on three strategic pillars:

## **2.1 Canonical Data**
There must always be exactly one source of truth for:

- Entity shapes  
- Relationships  
- Financial outputs  
- Navigation paths  
- Insights and health metrics  

This ensures predictability, reliability, and AI-friendly consistency.

## **2.2 Separation of Concerns**
Distinct functional layers handle:

- **Data storage** (Prisma + Database)  
- **Business logic** (Financial Engines)  
- **Data transformation** (Snapshot Engine)  
- **Meaning extraction** (Insights Engine)  
- **UI rendering & navigation** (Next.js + CMNF)  

No layer bleeds into another.

## **2.3 Extensibility**
Every module must be easy to extend without restructuring core architecture.

Examples:

- Adding a new financial module  
- Adding new insight rules  
- Adding new entity types  
- Multi-tenant scaling  
- Multi-currency support  

---

# **3. System Architecture Layers**

Monitrax consists of **7 major layers**, each with strict boundaries.

---

## **3.1 Database Layer (Prisma ORM + PostgreSQL)**

The database stores:

- Core modules  
- Domain entities  
- Historical records  
- Normalized financial data  
- Relational links  

Prisma acts as the ORM with:

- Strong typing  
- Safe migrations  
- Model-level validation  

### **Key Models**

- Property  
- Loan  
- Account  
- Transaction  
- Income  
- Expense  
- InvestmentAccount  
- Holding  

---

## **3.2 API Layer (Next.js Route Handlers)**

Responsibility:

- Act as the *contract boundary*  
- Validate payloads using Zod  
- Return canonical data shapes  
- Never perform business logic  
- Never compute financial values directly  

All business logic lives inside engines.

### **Types of API Routes**

- `/api/properties` (CRUD)  
- `/api/loans` (CRUD)  
- `/api/portfolio/snapshot`  
- `/api/linkage/health`  
- `/api/insights`  
- `/api/calculate/*`  

The API surface is intentionally thin.

---

## **3.3 Financial Engines Layer**

These are **pure functions**, deterministic and testable.

### Includes:

- Loan repayment engine  
- Investment engine  
- Depreciation engine  
- Debt planner  
- Cashflow projections  
- Aggregation & summaries  

Engines must:

- Accept raw data  
- Perform calculations  
- Return structured outputs  
- Never mutate global state  
- Never fetch from external sources  

---

## **3.4 GRDCS Layer (Global Relational Data Consistency System)**

The central canonical graph that stabilizes the entire app.

### GRDCS Provides:

- Entity → Entity relationships  
- Canonical IDs  
- Canonical hrefs  
- Relationship metadata  
- Cross-module linking rules  

### GRDCS Enables:

- LinkedDataPanel  
- CMNF (Cross-Module Navigation Framework)  
- Breadcrumb generation  
- Linkage Health  
- Insights Engine relational metrics  

GRDCS is one of the most critical architectural layers.

---

## **3.5 Portfolio Snapshot Engine (Financial Truth Layer)**

This layer produces the system-wide financial snapshot:

- Aggregated balances  
- Cashflow summaries  
- Total portfolio metrics  
- Multi-module rolled-up values  
- Derived calculations  
- Insights Engine inputs  

It powers:

- Dashboard summaries  
- Financial health metrics  
- Insights Engine severity  
- Global Health Indicator  

Snapshot must be:

- Fast  
- Deterministic  
- Rebuildable at any time  

---

## **3.6 Insights Engine v2**

The meaning extraction layer.

### Responsibilities:

- Identify issues  
- Detect anomalies  
- Surface opportunities  
- Highlight inconsistencies  
- Provide recommended actions  

### Insight Types:

- Critical  
- High  
- Medium  
- Low  

### Engine Inputs:

- GRDCS graph  
- Linkage Health  
- Portfolio snapshot metrics  

### Engine Outputs:

- Insight cards  
- Entity-level insights  
- Dashboard feed  
- Severity summaries  

---

## **3.7 Client Layer (Next.js App Router + React)**

The presentation and interaction layer.

### Components:

- DashboardLayout  
- Module tables  
- Entity dialogs  
- LinkedDataPanel  
- Insight components  
- Health summary widgets  
- Global breadcrumb  
- Navigation context  
- Global health indicator  

### Core UX Concepts:

- Dialog-first architecture  
- Cross-module navigation  
- State restoration  
- Suspense boundaries  
- Real-time UI sync engine  

The client layer must be:

- Fast  
- Predictable  
- Accessible  
- Mobile-friendly  
- Consistent  

---

# **4. Navigation Architecture**

Monitrax uses a custom navigation framework:

## **4.1 CMNF — Cross-Module Navigation Framework**

CMNF handles:

- Navigating between modules  
- Opening entity dialogs  
- Maintaining tab state  
- Breadcrumb management  
- Back-navigation with restoration  
- Deep relational drill-down  

CMNF operates entirely client-side.

---

## **4.2 Navigation Context**

Stores:

- navStack  
- scroll positions  
- active tabs  
- last opened entity  

Exposes methods:

- push()  
- pop()  
- reset()  
- getBreadcrumb()  

---

# **5. Real-Time Sync Architecture**

## **5.1 UI Sync Engine**

Polls:

- `/api/portfolio/snapshot`  
- `/api/linkage/health`  
- `/api/insights`  

On diff detection:

- Refresh UI components  
- Update health indicator  
- Update insights feed  
- Trigger warning ribbons  

---

# **6. Security Architecture**

> **Updated February 2026**: GCP Identity Platform is the sole identity provider.
> Phase 10 built the foundational auth framework; the GCP migration (Feb 2026)
> replaced the custom JWT system with GCP/Firebase token verification for all API routes.

## **6.1 Identity Provider: GCP Identity Platform**

Monitrax uses **GCP Identity Platform (Firebase Auth)** as the single identity provider.
No Monitrax JWTs are issued or verified for API authentication.

- **Client-side**: Firebase SDK handles login, registration, MFA, and token lifecycle
- **Server-side**: `verifyGCPIdToken()` verifies Firebase ID tokens against Google's public certs
- **User sync**: First-time GCP users are auto-created in the local DB via `syncGCPUser()`
- **Token flow**: Firebase ID tokens (1-hour expiry, auto-refreshed by SDK) sent as `Authorization: Bearer <token>`

## **6.2 Server-Side Auth Entry Points**

| Entry Point | Location | Purpose |
|-------------|----------|---------|
| `verifyToken()` | `lib/auth.ts` | Verify GCP token, return `{ userId, email }` |
| `getCurrentUser()` | `lib/auth.ts` | Same as verifyToken, returns `{ id, email }` |
| `getAuthContext()` | `lib/auth/context.ts` | Full auth context with role, name, tenantId |
| `withAuth()` | `lib/middleware.ts` | Middleware wrapper with auto-sync |

## **6.3 Security Features**

- **MFA**: Firebase TOTP via GCP Identity Platform
- **Passwordless**: Magic links, passkeys (FIDO2/WebAuthn)
- **OAuth**: Google, Facebook, Apple, Microsoft (via Firebase Auth)
- **RBAC**: 4 roles (Owner, Admin, Contributor, Viewer) with 50+ permissions
- **Audit logging**: Immutable audit trail (40+ event types)
- **Brute-force protection**: Account lockout after 5 failed attempts
- **CSP headers**: Firebase/GCP domains whitelisted in middleware
- **Rate limiting**: Per-user, per-IP, per-endpoint
- **Inactivity timeout**: 30-minute idle auto-logout with 2-minute warning dialog (`components/auth/IdleTimeoutGuard.tsx`)
- **Custom sign-in branding**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` env var controls Google popup domain display
- **Concurrent request safety**: `syncGCPUser()` uses upsert + retry-on-conflict for race condition resilience

## **6.4 Client-Side Auth Pattern**

All client components that make API calls MUST:
1. Import `useAuth` from `@/lib/context/AuthContext`
2. Destructure `{ token }` from `useAuth()`
3. Guard fetch calls with `if (!token) return` or `if (token)` in useEffect
4. Include `Authorization: Bearer ${token}` header in every fetch call

---

# **7. Intelligence Architecture (Future)**

Coming in Phase 11:

- AI Strategy Engine  
- Recommendation algorithms  
- Multi-year projections  
- Advisor-grade reasoning  
- Explainable AI outputs  

Built on top of:

- GRDCS  
- Snapshot Engine  
- Insights Engine  

---

# **8. Deployment & Infrastructure Layer**

Monitrax uses a split deployment architecture:

## **8.1 Platform Architecture**

| Component | Platform | Purpose |
|-----------|----------|---------|
| Frontend | Vercel | Next.js hosting, CDN, edge functions |
| Backend | Render | API routes, server-side processing |
| Database | Render PostgreSQL | Primary data store |

## **8.2 Build & Deploy Process**

> ⚠️ **CRITICAL SAFETY UPDATE (Feb 2026)**: Build scripts NO LONGER include `prisma db push`.
> Schema changes are now **MANUAL ONLY** to prevent accidental data loss.

**Render Build Command:**
```bash
npm install && npx prisma generate && npm run build
```

**⛔ NEVER ADD `prisma db push` TO BUILD SCRIPTS** — See `MASTER_BLUEPRINT.md` for details.

## **8.3 Database Schema Management**

| Strategy | Description |
|----------|-------------|
| **Method** | **MANUAL ONLY** — via Render Shell |
| **Trigger** | Manual review required before any schema change |
| **Manual Steps** | Create backup → Review changes → Run via Render Shell |

For complete deployment documentation, see: `docs/blueprint/09_INFRASTRUCTURE_AND_DEPLOYMENT.md`

---

# **9. System-Level Diagram (Conceptual)**

```
┌──────────────────────────────────────────────┐
│                    USERS                     │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            VERCEL (Frontend)                 │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                 CLIENT LAYER                 │
│   Next.js + React + CMNF + Real-Time UI Sync │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            RENDER (Backend)                  │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            INSIGHTS ENGINE (v2)              │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│         PORTFOLIO SNAPSHOT ENGINE            │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ GRDCS — Global Relational Data Consistency   │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          FINANCIAL ENGINES (Pure Logic)      │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             API ROUTE HANDLERS               │
└──────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  PRISMA ORM → DATABASE (PostgreSQL/Render)   │
└──────────────────────────────────────────────┘
```

---


