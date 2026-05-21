# 🔌 **07 — API STANDARDS**  
### *Monitrax Unified API Contract, Versioning Rules & Integration Architecture*

---

# **1. Purpose of This Document**

This section defines the **backend API standards** used across Monitrax.  
It ensures:

- Every endpoint behaves consistently  
- Every module exposes predictable CRUD patterns  
- Snapshot, Insights, Navigation & Health services all align  
- Frontend and backend evolve without breaking releases  

This is the architectural contract between the Monitrax backend and all consuming clients (web, mobile, AI agents).

---

# **2. Architectural Principles**

### **2.1 Predictable, Stable, Self-Describing APIs**
Every API must be:

- Consistent across all modules  
- Fully typed  
- Self-documenting via schema validation  
- Never ambiguous  

### **2.2 Response Shape Uniformity**
All API responses follow the same shape:

```
{
  "success": boolean,
  "data": {},
  "error": null | {
      "code": string,
      "message": string,
      "details": any
  },
  "meta": {
      "timestamp": ISO8601,
      "durationMs": number
  }
}
```

### **2.3 API Consumers Are Not Trusted**
Backend must validate every single request using:

- Zod schemas  
- TypeScript types  
- Access control middleware (Phase 10)  

### **2.4 “Backend Is The Source of Truth”**
No business logic is allowed in the frontend.

---

# **3. Directory Structure**

Monitrax uses a modular file pattern:

```
app/api/
   {module}/
      route.ts
   {module}/{id}/
      route.ts
api/_utils/
api/_schemas/
api/_middleware/
```

Consistency matters more than flexibility.

---

# **4. HTTP Methods & Their Rules**

### **4.1 CRUD Standardization**
Each module implements the following:

| Operation | HTTP | Route Pattern | Description |
|----------|------|----------------|-------------|
| List     | GET  | /api/{module} | Return all items |
| Get      | GET  | /api/{module}/{id} | Return single entity |
| Create   | POST | /api/{module} | Create entity |
| Update   | PUT  | /api/{module}/{id} | Full update |
| Patch    | PATCH | /api/{module}/{id} | Partial update |
| Delete   | DELETE | /api/{module}/{id} | Soft delete |

If a module only supports read operations, the same structure still applies.

---

# **5. Schema Validation (Zod)**

Every route must:

- Import a matching Zod request schema
- Validate before executing
- Generate typed results

Minimum required schema pattern:

```
import { z } from "zod";

export const CreateSchema = z.object({
  name: z.string().min(1),
  value: z.number().nonnegative(),
});
```

Backends must never assume client correctness.

---

# **6. Error Handling Contract**

Every API error must follow a strict format:

### **6.1 Validation Error**
```
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: string,
    details: zodErrors
  }
}
```

### **6.2 Not Found**
```
{
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "Resource not found."
  }
}
```

### **6.3 Server Error**
```
{
  success: false,
  error: {
    code: "SERVER_ERROR",
    message: "Unexpected server issue occurred."
  }
}
```

No stack traces are ever leaked to the client.

---

# **7. Authentication & Security Requirements**

> **Updated February 2026**: GCP Identity Platform is the sole identity provider.
> All API routes authenticate using GCP/Firebase ID tokens.

### **7.1 GCP Identity Platform Token Authentication**

All API routes verify GCP/Firebase ID tokens. Three entry points are available:

```typescript
// Option 1: verifyToken() — lightweight, returns { userId, email }
import { verifyToken } from '@/lib/auth';
const user = await verifyToken(token);

// Option 2: getAuthContext() — full context with role, name, tenantId
import { getAuthContext } from '@/lib/auth/context';
const context = await getAuthContext(request);

// Option 3: withAuth() — middleware wrapper with auto-sync
import { withAuth } from '@/lib/middleware';
return withAuth(request, handler);
```

**Token flow:**
1. Client obtains Firebase ID token via Firebase SDK (`onIdTokenChanged`)
2. Client sends `Authorization: Bearer <firebase-id-token>` with every request
3. Server verifies token via `verifyGCPIdToken()` (Google public certs, RS256)
4. Server looks up local user by GCP UID or auto-syncs on first request

**Key rules:**
- No Monitrax JWTs are issued for API authentication
- Tokens expire after 1 hour (Firebase SDK auto-refreshes)
- RBAC permissions checked via `getAuthContext()` or route guards

### **7.2 Rate Limiting Hooks**
All endpoints must expose a wrapper:

```
withRateLimit(handler, { max: X, windowMs: Y })
```

### **7.3 Audit Logging**
All mutations are logged:

- Who changed data (userId from GCP token)
- When (timestamp)
- Old vs new values
- IP address and user agent  

---

# **8. Versioning**

Monitrax uses implicit versioning rules:

### **8.1 Breaking Changes → New Endpoint**
Example:
```
/api/properties-v2
```

### **8.2 Non-Breaking Changes → Extend Schema**
Never rename, remove, or repurpose an existing field.

### **8.3 Additive-only Policy Until v1.0**
All public clients depend on predictability.

---

# **9. Performance Rules**

### **9.1 Snapshot APIs**
Must respond in:

- **< 200ms** for standard snapshot  
- **< 300ms** for extended snapshot  

### **9.2 Insights APIs**
Must precompute heavy operations server-side.

### **9.3 Pagination Required When > 100 Items**
All list endpoints must enforce server-side pagination.

---

# **10. Caching Rules**

### **10.1 Server Cache**
Snapshot 2.0 requires:

- Smart dependency-based invalidation  
- Cached GRDCS outputs  
- Cached linkage-health metrics  

### **10.2 No Client Cache Assumptions**
Frontend must never assume a previous response is valid.

---

# **11. Standards for Complex Modules**

### **11.1 Portfolio Snapshot**
One endpoint, total platform state:

```
/api/portfolio/snapshot
```

Must include:

- All GRDCS entities  
- Relational map  
- Insights feed  
- Linkage-health metrics  
- Summaries  
- Totals  

---

### **11.2 Insights Engine API**
```
/api/insights
```

- Returns grouped insights  
- Includes recommended actions  
- Includes affected entities  

---

### **11.3 Linkage Health Service**
```
/api/linkage/health
```

Returns:

- completenessScore
- orphanCount
- missingLinks[]
- module breakdown

---

### **11.4 Categories API**
```
/api/categories
/api/categories/{id}
```

Manages user-defined custom categories for expenses and income.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/categories` | GET | List all categories (system + user custom) |
| `/api/categories` | POST | Create a new custom category |
| `/api/categories/{id}` | GET | Get single category by ID |
| `/api/categories/{id}` | PUT | Update a custom category |
| `/api/categories/{id}` | DELETE | Soft delete or force delete category |

**Query Parameters (GET /api/categories):**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `EXPENSE` \| `INCOME` | Filter by category type |
| `includeSystem` | `boolean` | Include system categories (default: true) |

**System Category Prefixes:**
System categories are returned with special IDs:
- `system:expense:HOUSING`, `system:expense:UTILITIES`, etc.
- `system:income:SALARY`, `system:income:RENT`, etc.

System categories cannot be modified or deleted.

**Response Shape (GET list):**
```json
{
  "success": true,
  "data": [
    {
      "id": "system:expense:HOUSING",
      "code": "HOUSING",
      "name": "Housing",
      "type": "EXPENSE",
      "isSystem": true,
      "isActive": true,
      "sortOrder": 0,
      "color": null,
      "icon": null,
      "description": null
    },
    {
      "id": "uuid-here",
      "code": "PET_CARE",
      "name": "Pet Care",
      "type": "EXPENSE",
      "isSystem": false,
      "isActive": true,
      "sortOrder": 0,
      "color": "#FF5733",
      "icon": "paw",
      "description": "Vet bills, food, supplies"
    }
  ],
  "_meta": {
    "totalCount": 25,
    "systemCount": 19,
    "customCount": 6
  }
}
```

---

### **11.5 Dashboard derivation APIs (Phase 43 stream, 2026-05-09)**

A family of thin endpoints under `/api/dashboard/*` that derive
presentation-layer projections from the canonical Master Financial
Snapshot or directly from `prisma.unifiedTransaction`. **Each is a
read-through wrapper — never a new calc engine** (CLAUDE.md §6.1 +
§12.2 SSOT). Promote a derivation into `lib/calculations/` only on
second consumer (the promote-on-second-use rule applied across all
five Phase 43 surfaces).

```
/api/dashboard/insights         (extended with Phase 43 moneyStory block)
/api/dashboard/hidden-wealth    (Phase 43.1)
/api/dashboard/spending-pareto  (Phase 43.2)
/api/dashboard/margin-trend     (Phase 43.3)
```

Family rules:

- All `withPermission('report.read')` — no new permission scopes
  introduced for the Phase 43 stream.
- Standard envelope `{success, data, error}` — no deviation.
- Each endpoint owns ONE presentation projection. No mixing surfaces
  inside a single response.
- Lens components consuming these endpoints are **pure presentational** —
  they take the response shape as props, render JSX, compute nothing.
- Self-hide gates live at the COMPONENT (e.g. lens hides when bucket
  totals are 0) AND the ROUTE (e.g. `vitalFew: []` when
  `totalMonthlySpend ≤ 0`); double-defence for false-precision
  guardrails.

The pattern is canonical for any future "lens" surface that derives a
dashboard projection from already-canonical data: thin endpoint,
read-through, no calc engine, no `quickMetrics` field, presentation-
layer-only.

See:
- `docs/blueprint/PHASE_43_MONEY_STORY.md`
- `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md`
- `docs/blueprint/PHASE_43_2_SPENDING_PARETO.md`
- `docs/blueprint/PHASE_43_3_MARGIN_TREND.md`
- `docs/blueprint/PHASE_43_4_ENOUGH_HISTORY_GATE.md`

---

# **12. Logging Rules**

### **12.1 API Log Format**
Each request logs:

- IP  
- Auth user  
- Method  
- Path  
- Status code  
- Duration  
- Error codes (if any)  

### **12.2 Error Log File**
Monitrax MUST maintain:

```
/ERROR_LOG.md
```

This file stores:

- All audit issues  
- Fix timelines  
- Cross-system references  

---

# **13. Testing Standards**

### **13.1 Required Automated Tests**
- Schema validation tests  
- API contract tests  
- Error format tests  
- Snapshot contract tests  
- Data consistency validation tests  

### **13.2 Manual Regression Suite (Phase 9.7)**
Must be run before merge to main.

---

# **14. Acceptance Criteria**

The API layer is correct when:

- All endpoints follow consistent CRUD patterns  
- All responses follow the unified envelope format  
- Every mutation is validated using Zod  
- No unhandled exceptions leak to clients  
- Snapshot + Insights + Health endpoints are contract-stable  
- Future phases (auth, AI engine) plug in without breaking changes  

---


---

# **15. Phase 32B/32C/33g — B2B2C API Patterns**

*Added 2026-05-09 (doc-catch-up).* The B2B2C surface introduced three
new auth patterns + one new caller-scope dimension that route
handlers across the new modules use. They're documented here as
canonical patterns; new endpoints that touch the same surfaces
should follow the same rules.

## **15.1 Three auth gates, three caller types**

| Caller | Auth gate | Permission |
|---|---|---|
| **Consumer** (D2C user) | `withPermission('report.read')` etc | Standard `lib/auth/permissions.ts` registry |
| **Org-side** (PORTAL_OWNER / PORTAL_ADMIN / PORTAL_ADVISOR / PORTAL_VIEWER) | `withPermission('org.read'/'org.update')` + per-route active-membership check | Portal permissions in `lib/portal/permissions.ts` |
| **Admin** (Monitrax AdminUser) | `verifyAdminGCPAuth(request)` + `hasAdminPermission(role, perm)` | `lib/admin/permissions.ts` |
| **Webhook** (Stripe / SendGrid Inbound Parse) | **NO auth gate** — signature verification is the auth mechanism. Read raw body via `request.text()` BEFORE parsing. | n/a |

Webhook routes deliberately reject naked `withPermission` — they're
called by an external service, not an authenticated Monitrax user.
The signature header is the authority. 4xx on signature mismatch
(Stripe / SendGrid retry on 5xx, not 4xx); 5xx only on dispatch
failure to trigger retry-with-backoff.

## **15.2 Org-scoped routes**

Every portal endpoint that operates on an Org's data takes the
`organizationId` either as a path parameter or as a query string,
and uses this pattern:

```ts
const membership = await prisma.organizationMember.findFirst({
  where: { userId: auth.userId, organizationId, isActive: true },
  select: { id: true, role: true },
});
if (!membership) {
  return NextResponse.json(
    { error: { code: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organisation' } },
    { status: 403 },
  );
}
const portalRole = ROLE_MAPPING[membership.role] ?? 'PORTAL_VIEWER';
if (!hasPortalPermission(portalRole, 'marketplace:listing:write')) {
  return NextResponse.json(
    { error: { code: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient role' } },
    { status: 403 },
  );
}
```

The `ROLE_MAPPING` (UserRole → PortalUserRole) is duplicated in each
route file deliberately — keeps the route file readable + auditable
without a hidden import. Future refactor may consolidate via a helper.

**Anti-poaching guardrail:** commercial actions (submit-for-review on
marketplace listing, subscribe / cancel / resume on billing) are
restricted to PORTAL_OWNER even when other writes are allowed.
Mirrors the `team:invite` PORTAL_OWNER restriction from PR #603.

## **15.3 Drill-in client routes — `verifyAdviserClientAccess`**

Every `/api/portal/clients/[id]/*` endpoint MUST route through the
shared `lib/portal/adviserClientAccess.ts` helper. Layered checks
(rejection at any layer returns a structured error):

1. `OrganizationClient` row exists for `params.id`
2. status === 'ACTIVE' AND consentStatus === 'GRANTED'
3. Caller has an active `OrganizationMember` seat on the same org
4. Caller's role permits viewing client data
5. If caller is `PORTAL_ADVISOR`, they're assigned to this client (`PORTAL_OWNER` / `PORTAL_ADMIN` see whole book)

Returns the canonical `accessScopes` from the DB row — never from
caller-provided input. Per CLAUDE.md §0 architect lens, the consent
source-of-truth is the database, never URL params or headers.

**Reviewers reject any new portal client-data endpoint that doesn't
route through this helper.**

### Org-scoped *aggregate* portal endpoints (`?organizationId=`) — `withPermission('org.read')` + membership check

A small family of portal endpoints answers an **org-level, aggregate-only**
question rather than returning a single client's data:
`GET /api/portal/alerts?organizationId=…` (the org's ACTIVE alert rows)
and `GET /api/portal/clients?organizationId=…` (the org's client-book
KPI summary — `activeClients` / `needsAttention` / `trailAdvancedThisWeek`
/ `averageHealth` / `averageHealthDelta`, plus a thin per-client array of
aggregate scalars: health score, TRAIL-stage letter, active-alert count).

These do **not** route through `verifyAdviserClientAccess` (that helper
gates a single client's *data* on per-client GRANTED consent). Instead:
`withPermission('org.read', …)` + an inline active-`OrganizationMember`
check against the requested org (→ 403 if the caller isn't a member).
The data they return is already consent-gated upstream — the alert/marker
rows are written by the sweep, which applies `scopeAllowedTriggers` per
client — so re-checking per-client consent here would be redundant. They
return **no balances and no CDR data** (CLAUDE.md §13.3): only the
aggregate scalars + the client's display name/initials.

Reviewers: a new org-scoped aggregate endpoint may use this pattern only
if it returns aggregates already produced under the consent gate; anything
that would expose a single client's underlying data must use
`verifyAdviserClientAccess` instead.

## **15.4 Webhook idempotency**

Both signed-payload webhooks (`/api/stripe/webhooks` and
`/api/conversations/inbound`) implement idempotency at the database
boundary:

- Stripe: every event recorded in `StripeWebhookEvent` with unique
  constraint on `stripeEventId`. Re-deliveries dedupe at insert.
- Inbound email: `replyToSlug` extracted from `to` header; conversation
  resolved via `findConversationByReplyToSlug`; sender email matched
  against the consumer participant; message posted with
  `channel='EMAIL_IN'` (which bypasses the `assertParticipant` gate
  since the webhook isn't an authenticated user).

Both webhooks return:
- 400 on signature mismatch / missing required fields (permanent failure — don't retry)
- 4xx on validation failure (e.g. unknown slug, sender mismatch)
- 5xx on internal dispatch failure (transient — Stripe / SendGrid retry with backoff)

## **15.5 Error code vocabulary (additions)**

The unified envelope (per §2.2) gains these codes across the B2B2C
surface. Codes are typed strings on the route boundary so the UI can
branch on them without parsing free-text messages:

| Code | HTTP | Meaning |
|---|---|---|
| `NOT_A_MEMBER` | 403 | Caller has no active OrganizationMember seat on this org |
| `INSUFFICIENT_ROLE` | 403 | Caller's portal role doesn't permit the action (commercial actions are OWNER-only) |
| `PLAN_TIER_REQUIRED` | 402 | Caller's resolved PlanTier doesn't unlock this feature (e.g. white-label is PRACTICE+) |
| `CONSENT_NOT_GRANTED` | 403 | OrganizationClient row exists but consent isn't ACTIVE+GRANTED |
| `CLIENT_NOT_ASSIGNED` | 403 | PORTAL_ADVISOR caller; client isn't assigned to them |
| `ORG_USER_PUBLIC_BLOCKED` | 403 | Org-attached user attempted to use the public marketplace surface (leaky-funnel guardrail) |
| `LISTING_NOT_AVAILABLE` | 409 | Listing isn't APPROVED at request-submit time |
| `INVALID_STATUS_TRANSITION` | 409 | Status transition violates the lifecycle state machine |
| `SLUG_TAKEN` | 409 | Marketplace `publicSlug` already in use by another Org |
| `INCOMPLETE_DRAFT` | 400 | Submit-for-review failed validation (≥10-char tagline / ≥100-char blurb / etc) |
| `PAYLOAD_TOO_LARGE` | 413 | Snapshot context >8KB on `submitRequest`, or message body >10KB on `postMessage` |
| `WEBHOOK_VERIFICATION_FAILED` | 400 | Stripe / SendGrid signature mismatch — permanent failure |
| `NOT_CONFIGURED` | 503 | Stripe / SendGrid keys not set in this environment (dev/demo path) |

## **15.6 Audit-log conventions**

State-changing routes write a `createAuditLog()` row fire-and-forget
(`.catch(() => {})`) so audit writes never block responses. The
following actions are canonical for the B2B2C surface:

```
PRO_DASHBOARD_VIEW                       — adviser opened drill-in
PORTAL_SEAT_INVITED                      — anti-poaching guardrail
MARKETPLACE_LISTING_UPDATED|SUBMITTED|APPROVED|REJECTED|SUSPENDED
PROFESSIONAL_REQUEST_SUBMITTED|ACCEPTED|DECLINED|WITHDRAWN|EXPIRED
CONVERSATION_CREATED|MESSAGE_SENT|EMAIL_OUTBOUND|EMAIL_INBOUND|SOFT_DELETED_FROM_USER
BILLING_CHECKOUT_STARTED|SUBSCRIPTION_CREATED|UPDATED|CANCELLED|INVOICE_PAID|INVOICE_FAILED|WEBHOOK_RECEIVED
FEEDBACK_THREAD_REPLIED|STATUS_CHANGED|INTERNAL_NOTE_UPDATED
```

CDR-protected metadata MUST go through `sanitizeCdrMetadata()`. For
the B2B2C surface, none of the new audit metadata is CDR-protected
(listing slugs, lead-fee tiers, conversation ids, plan tiers are all
non-CDR), but new endpoints that introduce CDR-derived metadata
should follow the CLAUDE.md §13.3 sanitization requirement.

## **15.7 Webhook source-of-truth principle**

For any data mirrored from an external system (Stripe subscriptions,
inbound emails, future Xero sync), the external system is the
authoritative source. Local state mirrors what the external system
reports via webhooks. This means:

- Don't read local state for billing decisions; read `StripeSubscription.status`, which is mirrored from the latest webhook.
- Don't trust caller-provided "current status"; always look up server-side.
- Don't try to sync from local back to external (the `cancelAtPeriodEnd` action calls Stripe first, then mirrors the result locally — Stripe stays the source of truth).
- When the external system has a richer state model than ours, store the verbatim mirror + a derived field for our use (e.g. `SubscriptionStatus` enum mirrors Stripe's status names exactly; `BillingPlanTier` is our derived column resolved from price-id + metadata).
=======
# **15. Phase 41e — Entity-aware tax endpoints**

Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.8. New endpoints landing in 41e.0 slice D + 41e.−1 cleanup, all using the `tax_data.*` permission family (Phase 41e.0 slice A).

| Endpoint | Method | Sub-PR | Permission | Purpose |
|---|---|---|---|---|
| `/api/tax/config` | GET | 41e.0 slice D | `tax_data.read` | Returns the canonical FY config (`TaxYearConfig`) for `?fy=YYYY-YY` (default current FY). Replaces hard-coded thresholds. |
| `/api/tax/entity/[entityId]` | GET | 41e.0 slice D | `tax_data.read` | Returns per-entity tax position via the `entityTaxRouter`. PERSONAL_NAME / SOLE_TRADER → real Phase 20 result + boundary footnote; COMPANY / TRUST / SMSF / PARTNERSHIP → null result + UNCOMPUTED flag (per audit §10.3). Caller must own the entity. |
| `/api/tax/entity/[entityId]` | POST | 41e.1 - 41e.6 | `tax_data.read` | Same response shape as GET. Body fields: `trustDistribution` (Div 6 + 6E streaming + s100A facts), `cgtEvents` + `carryForwardCapitalLosses` (Div 115 + s100-50 netting), `smsfContributions` (cap tracking), `highIncomeSuper` (Div 293 + Div 296 gated + TBC), `div7aLoans` (Div 7A classifier — s109N MRP + s109D deemed-dividend exposure for COMPANY entities). Caller must own the entity. |
| `/api/tax/master-position` | GET | 41e.17 (queued) | `tax_data.read` | Household-wide tax position roll-up. Replaces the `buildTaxSummary()` adapter from cleanup PR C. |
| `/api/tax/trust-distribution` | POST | 41e.4 (queued) | `tax_data.write` | Computes Div 6/6E streaming + per-beneficiary share + character. |
| `/api/tax/div7a-check` | POST | 41e.6 (queued) | `tax_data.write` | Compliance check on a COMPANY → shareholder loan. |
| `/api/tax/cgt-disposal` | POST | 41e.1 (queued) | `tax_data.write` | Entity-aware CGT (50% / 33⅓% / 0% / nil discount). |
| `/api/tax/state-tax/[entityId]?state=NSW` | GET | 41e.12-14 (queued) | `tax_data.read` | Land tax + stamp duty + foreign-person surcharge. |

### Response shape — boundary footnote

Per architecture doc §1(5) + §5, every endpoint returning a tax-shaped figure surfaces a `boundary` field alongside the data, computed by `lib/tax-engine/boundaries/index.ts:renderBoundaryFootnote()`:

```json
{
  "success": true,
  "data": {
    "entityPosition": { ... },
    "boundary": {
      "computedPer": "Computed per ITAA 1997 s4-10, ITAA 1997 Div 1-6.",
      "uncomputedNotes": [
        "FBT not computed for personal-use Pty Ltd assets."
      ],
      "boundary": "These figures are general information only — not personal financial, tax, or credit advice. Confirm with a registered tax agent (TPB), financial adviser (AFSL), or credit assistant (NCCP) before acting.",
      "fyContext": "Figures for FY24-25."
    }
  }
}
```

UI consumers render this via `<BoundaryFootnote citations={...} uncomputed={...} fyLabel="FY24-25" />` (component at `components/tax/BoundaryFootnote.tsx`). One source of truth for legal copy across every tax surface.

---

## **15.8 Entity routes as onboarding write boundaries (Phase 12 Track F)**

Track F makes the existing entity APIs the onboarding wizard's SSOT write
boundary (replacing the `bulk-create` "write everything at the end" model).
Two consequences for the property aggregate routes, applied in F.2
(2026-05-20):

1. **Audit logging.** `/api/properties`, `/api/loans`, `/api/income` and
   `/api/expenses` (POST + `[id]` PUT/DELETE) now call `createAuditLog()` on
   every state-changing write (§12.5 / §15.6). Property writes use
   `PROPERTY_CREATED/UPDATED/DELETED`; loan/income/expense use the generic
   `CREATE/UPDATE/DELETE` actions with an `entityType`. Metadata carries
   type/category + booleans only — never CDR/financial values (§13.3).
2. **Numeric validation accepts 0.** `/api/properties` POST (`purchasePrice`,
   `currentValue`) and `/api/loans` POST (`minRepayment`,
   `termMonthsRemaining`) validate these as *present* (`!= null`), not
   *truthy* — `0` is a legitimate value the wizard's two-way sync can send.
3. **`/api/properties` reform fields.** POST + PUT now accept + persist the
   Phase 41E inputs `acquisitionContractDate` / `isNewBuild` /
   `newBuildEvidence`, applying the cut-over backfill (CLAUDE.md §12.14).
   Previously only `bulk-create` wrote these — routing wizard property
   writes through `/api/properties` without this would have dropped them.

Applied in **F.3** (2026-05-20) for the accounts domain:

4. **`/api/accounts` audit + extended fields.** POST + `[id]` PUT/DELETE
   now call `createAuditLog()` (`ACCOUNT_CREATED/UPDATED/DELETED`). POST
   gained `interestRate`; PUT gained `institution` — the route pair now
   covers every field the wizard `AccountInput` carries. `currentBalance`
   validation accepts `0` (present, not truthy).
5. **`/api/accounts` offset→loan link.** POST + PUT accept `linkedLoanId`;
   for an `OFFSET` account the route sets `Loan.offsetAccountId`
   server-side, in the same transaction as the account write,
   ownership-verified. PUT clears any stale link first (re-link / un-link).
   F.3's two-way sync writes **MANUAL** accounts only — BASIQ / IMPORT
   accounts are externally sourced and never written by the wizard.

Applied in **F.5** (2026-05-20) for the investments domain:

6. **`/api/investments/*` audit.** `/api/investments/accounts` (POST +
   `[id]` PUT/DELETE) and `/api/investments/holdings` (POST + `[id]`
   PUT/PATCH/DELETE) now call `createAuditLog()` — `INVESTMENT_*` for the
   account, generic `CREATE/UPDATE/DELETE` (`entityType: 'InvestmentHolding'`)
   for holdings. No route-contract change — the existing Zod schemas
   already cover every wizard `InvestmentAccountInput` / `HoldingInput`
   field.

Applied in **F.6** (2026-05-20) for the superannuation domain:

7. **New `/api/tax/super/[id]` route.** The super API (`/api/tax/super`)
   had GET + POST only. F.6 adds the per-id route — **PUT** (partial
   update of name / fundName / currentBalance; other columns untouched)
   and **DELETE** — both ownership-guarded (`verifyOwnership`). Audit
   logging (`SUPER_CREATED/UPDATED/DELETED`) added to POST + the new
   PUT/DELETE. PUT/DELETE use `income.write` / `income.delete`
   permissions (consistent with the existing super POST's `income.write`).

Applied in **F.7** (2026-05-20) for the assets domain:

8. **`/api/assets` audit + validation.** `/api/assets` (POST + `[id]`
   PUT/DELETE) now call `createAuditLog()` (`ASSET_CREATED/UPDATED/DELETED`).
   `purchasePrice` / `currentValue` are validated/written as *present*
   (not *truthy*) on both POST and PUT — `0` is a legitimate value the
   wizard's two-way sync can send. Asset-expense writes route through the
   already-audited `/api/expenses` routes.

Applied in **F.8** (2026-05-20) for the income / expenses domain:

9. **No route change — the income/expense routes were already onboarding
   write boundaries.** F.8 (the last Track F domain) reuses `/api/income`
   + `/api/income/[id]` and `/api/expenses` + `/api/expenses/[id]`
   exactly as they stand. They already gained `createAuditLog()` in F.2
   (generic `CREATE/UPDATE/DELETE`, `entityType: 'Income'` / `'Expense'`)
   and already validate `amount` as *present* (`amount === undefined`
   check), so a `0` budget is accepted. F.8 therefore adds **no new audit
   actions and no migration** — like F.4. The wizard `IncomeExpensesStep`
   writes only **GENERAL** rows (`sourceType === 'GENERAL'`, no
   property/loan/asset/investment FK); `bulk-create` sections 6 + 7
   no-op for GENERAL rows while section 6 preserves the INVESTMENT-income
   path. The `GET` routes' transaction-reconciled actuals
   (`actualFromTransactions`, `monthlyAverageActual`, …) are NOT read by
   the sync — it reads only the raw budget `amount` (budget-vs-actuals
   invariant; see `PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.4 / §6.8).

Applied in **Track G G.3c** (2026-05-21) — `bulk-create` retired:

00. **`/api/onboarding/bulk-create` is DELETED.** After Track F + G.3a +
    G.3b every domain writes itself to its real tables via its step's
    commit, and the cross-domain wiring moved to `/api/onboarding/
    complete`. The route's callers (`app/onboarding/page.tsx`,
    `components/DashboardLayout.tsx`) now call only `completeOnboarding`.
    The onboarding wizard write surface is now: the per-domain entity
    routes (per-step) + `/api/onboarding/complete` (the finaliser). No
    schema change — `UserPreference.onboardingDraft` stays (still used
    for autosave + resume).

Applied in **Track G G.3b** (2026-05-21) — the end-of-wizard finaliser:

0. **`/api/onboarding/complete` is now the finaliser.** It accepts an
   optional wizard-data body and, after marking onboarding complete
   (`onboardingCompleted` / `onboardingCompletedAt` / `onboardingStep` /
   `onboardingProfileType`), performs the cross-domain wiring relocated
   from `bulk-create` — BASIQ/IMPORT offset→loan link, CAR-loan→vehicle-
   asset link, INVESTMENT-type income. The completion write is the
   critical path; the cross-domain wiring is **best-effort** (logged +
   swallowed on failure — must never block a user from finishing
   onboarding). `bulk-create` §1/§3/§5a/§6 are now no-ops; G.3c deletes
   the route.

Applied in **Track G G.3a** (2026-05-21) for the legal-entities domain:

10. **`/api/entities` POST — reform-field plumbing.** `POST /api/entities`
    (and the `createEntity()` service + `CreateEntityInput`) now accept
    `trustType` and `isForeignResident`. Previously only `PUT
    /api/entities/[id]` did, and `bulk-create` wrote them directly via
    Prisma — so routing wizard entity writes through the POST without
    this fix would have dropped a trust's `trustType`. `createEntity()`
    only persists `trustType` for trust entity types (mirrors the PUT).
    No new audit actions / no migration — the entity routes already
    audit via generic `logCRUD` (`entityType: 'LegalEntity'`). This is
    the last Track F/G domain migration (entities via
    `lib/onboarding/entitiesSync.ts`).

---

