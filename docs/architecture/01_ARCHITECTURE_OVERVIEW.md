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



---

# **§13 — Phase 32B/32C/33g: B2B2C Surface (May 2026)**

*Added 2026-05-09 (doc-sync catch-up).* The B2B2C surface adds a
parallel route tree at `/portal/*`, `/admin/*`, `/marketplace/*` that
reuses the canonical engines without forking them. Architectural
invariant: **`getMasterFinancialSnapshot()` is the canonical engine
for both consumer and adviser views; the `viewerContext` parameter
applies service-layer scope filtering, NOT a forked engine.**

## **§13.1 New Engines / Services**

Eight new canonical services in `lib/services/`:

| Service | Responsibility |
|---|---|
| `legalEntityService.ts` | Entity layer (Phase 41a/b) — `getDefaultLegalEntityId`, `listEntitiesForUser`, `createEntity`, `updateEntity`, `deleteEntity`. Every owned-row table now carries `ownerEntityId`. |
| `moneyFlowService.ts` | Per-entity money flow Sankey (Phase 41d) — `getMoneyFlow(userId)`. |
| `marketplaceService.ts` | Professional marketplace listings (Phase 32C PR4a) — three caller scopes (Org / admin / public) on one canonical service. |
| `askAProfessionalService.ts` | Picker candidate resolver (Phase 32C PR4b) — `getCandidatesForUser(userId, context?)` with leaky-funnel guardrail. |
| `professionalRequestService.ts` | Request lifecycle (Phase 32C PR4c) — submit / accept / decline / withdraw with state-machine guards. |
| `conversationService.ts` | Conversation thread + email-through-app (Phase 32C PR4d) — `createForAcceptedRequest`, `postMessage`, `assertParticipant` access gate. |
| `stripeBillingService.ts` | Stripe test-mode billing (Phase 32C PR6a/b) — subscription + lead-fee invoicing + webhook reconciliation. |
| `feedbackService.ts` | Adviser feedback inbox (Phase 33g) — separate from `ProfessionalConversation` (different participants / retention / status workflow). |

Plus one new helper:
- `lib/portal/adviserClientAccess.ts` — `verifyAdviserClientAccess` is the centralised consent + membership + role + assignment guard that all `/api/portal/clients/[id]/*` endpoints route through. **Reviewers reject any new portal client-data endpoint that doesn't use it.**

### The entity-graph rules engine — `lib/entity-graph/` (Phase 44 Part 1b)

A new **pure** rules + traversal layer — the centralised SSOT for the typed entity graph (`PHASE_44_ENTITY_GRAPH.md` §8.4):

| Module | Responsibility |
|---|---|
| `lib/entity-graph/types.ts` | The in-memory graph shapes (`EntityGraph`, `GraphNode`, `GraphEdge`), the node-type group predicates, the §6.1 issue/state types, the time-bounding helper. |
| `lib/entity-graph/validityMatrix.ts` | The §6 grammar — node/edge legality (§6.2), the three-state classifier (§6.1: `VALID` / `NON_COMPLIANT_BUT_RECORDED` / `IMPOSSIBLE_SYSTEM_ERROR`), the corrected SMSF rules (§6.3), entity validity (§6.4), cycle handling (§6.5). |
| `lib/entity-graph/queries.ts` | Pure graph traversal — `getTrusteesOf` (the canonical replacement for the frozen `LegalEntity.parentEntityId` self-FK), `getControllersOf`, `getOwnershipChain`, cycle detection, `isAssociateOf`, `resolveBeneficialOwner`. |

These are **pure functions** — no I/O, no clock reads, no tax/financial arithmetic. The grammar GRADES; it does not blanket-reject — legal non-compliance is recorded and flagged, never erased (§6.1, §9). Every consumer (the relationship service, the entity UI, the onboarding wizard, the tax engine) reads these; a validity rule or a graph traversal is re-implemented nowhere else (CLAUDE.md §12.2). Loading the graph from the database and writing edges is the relationship service's job (Part 1b-ii).

## **§13.2 Architectural rules across the B2B2C surface**

Documented in full in `docs/architecture/03_DATA_MODEL.md` §11.7 and `docs/architecture/07_API_STANDARDS.md` §15.1-15.7. Summary:

1. **Leaky-funnel guardrail** — org-attached users never see public marketplace surfaces. Enforced at the service boundary.
2. **`assertParticipant` is the single access-control gate** for conversations. Cross-org leakage structurally impossible.
3. **Sender role frozen at write-time** — audit accuracy preserved if a member later leaves the org.
4. **Tier rates frozen at submit-time** — in-flight `ProfessionalRequest` rows protected from listing-side rate edits.
5. **PORTAL_OWNER-only commercial actions** — submit-listing / subscribe / cancel / resume.
6. **Billing intent vs payment** — `acceptRequest` records `leadFeeChargedAt` synchronously; Stripe Invoice creation is best-effort post-transaction.
7. **Webhook signature verification IS the auth** for `/api/stripe/webhooks` and `/api/conversations/inbound`. No `withPermission` gate. 4xx on signature mismatch (Stripe / SendGrid retry on 5xx, not 4xx).

## **§13.3 New Top-Level Routes**

| Route prefix | Audience | Purpose |
|---|---|---|
| `/portal/dashboard` | Org members | Practice dashboard (KPIs + alerts + client book table) |
| `/portal/clients/[id]/view` | Org members | Drill-in canonical client view (Structure / Money Flow / Dashboard tabs) |
| `/portal/marketplace/listing` | PORTAL_OWNER + ADMIN | Org-side marketplace listing editor |
| `/portal/requests(/[id])` | Org members | Marketplace request inbox + drill-in |
| `/portal/conversations(/[id])` | Org members | Conversation threads + email-through-app |
| `/portal/billing` | PORTAL_OWNER | Subscription tier + invoice history |
| `/portal/feedback` | Org members | Send feedback to Monitrax |
| `/dashboard/entities` | Consumer | Entity tree + money flow Sankey |
| `/dashboard/requests` | Consumer | Request status tracker |
| `/dashboard/conversations(/[id])` | Consumer | Conversation threads (consumer perspective) |
| `/marketplace(/[slug])` | Public + D2C | Public professional marketplace browse + detail |
| `/admin/marketplace/listings(/[id])` | Monitrax admin | Marketplace approval queue + drill-in |
| `/admin/feedback` | Monitrax admin | Adviser feedback inbox |
| `/print/help/[...slug]` | All | Auditor-clean Save-as-PDF view of any help article |

## **§13.4 New env vars**

Documented in `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md`. Summary:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`, `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL` (Phase 32C PR6)
- `SENDGRID_API_KEY`, `MONITRAX_INBOUND_FROM_ADDRESS`, `MONITRAX_INBOUND_DOMAIN` (Phase 32C PR4d)

All Stripe + SendGrid integration paths fall back gracefully when their env var is unset (`isStripeConfigured()` returns false; `sendConversationEmail` console-logs instead of sending). Dev/demo environments work without secrets; the architectural pattern stays visible.

## **§13.5 What this layer is NOT**

- **Not a forked engine.** `getMasterFinancialSnapshot()` is still the canonical financial engine. Adviser drill-in passes a `viewerContext` parameter; service-layer scope filtering applies.
- **Not a parallel auth system.** Portal routes use the same `withPermission` middleware as consumer routes; they layer on a portal-role mapping (`UserRole` → `PortalUserRole`) for portal-specific actions.
- **Not a separate data store.** All B2B2C data lives in the same Prisma schema as consumer data; new tables share the same database, same `_prisma_migrations` table, same backup policy.

The B2B2C surface is a **shape** built on top of the canonical engines, not a separate system.
