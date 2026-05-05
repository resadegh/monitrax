# 🧩 **03 — DATA MODEL**  
### *Canonical Entity & Relationship Specification for Monitrax*

---

# **1. Purpose of the Data Model**

This document defines:

- The **canonical shape** of every entity in Monitrax  
- All **cross-module relationships**  
- The **global entity graph** used by GRDCS  
- ID and href conventions  
- Required fields vs optional fields  
- Financial aggregation rules  
- Standardised enums  
- Long-term extensibility guidelines  

The data model is the *absolute foundation* of:

- Portfolio Snapshot Engine  
- GRDCS  
- Financial Engines  
- Insights Engine v2  
- CMNF navigation  
- Linkage Health  

---

# **2. Global Entity Framework**

Monitrax uses a **strict entity contract**:

```
id: string
type: string
name: string
href: string
metadata: Record<string, any>
links: GRDCSLink[]
```

Every entity must include:

## **2.1 Canonical ID**
Format:

```
{module}-{uuid}
```

Examples:

- `property-83fa3a2c`
- `loan-2024ab19`
- `holding-c3f19a0e`

## **2.2 Canonical HREF**
Pattern:

```
/{module}/{id}
```

Examples:

- `/properties/property-83fa3a2c`
- `/loans/loan-2024ab19`

These are consumed by:

- CMNF navigation  
- Breadcrumb builder  
- LinkedDataPanel  
- Entity dialogs  

---

# **3. Core Domain Modules & Entities**

The Monitrax domain includes **nine core financial modules**, each with exact entity definitions.

---

# **3.1 Properties**

### **Entity: Property**

```
id: string
type: "property"
name: string
address: string
purchasePrice: number
purchaseDate: string
marketValue: number
imageUrl?: string
propertyManager?: string
notes?: string
```

### **Relationships**

```
property → loan[]
property → expense[]
property → income[]
property → account? (offset / redraw)
```

### **Financial Rules**

- Market value drives LVR calculations  
- Links to loans determine equity & leverage  
- Property expenses affect cashflow  

---

# **3.2 Loans**

### **Entity: Loan**

```
id: string
type: "loan"
name: string
lender: string
loanType: "HOME" | "INVESTMENT" | "CAR" | "PERSONAL" | "LINE_OF_CREDIT" | "STUDENT" | "BUSINESS"
principal: number
interestRateAnnual: number
rateType: "VARIABLE" | "FIXED"
isInterestOnly: boolean
fixedExpiry?: string
offsetAccountId?: string
linkedAssetId?: string      // For CAR loans - link to vehicle asset
linkedAccountId?: string    // For LINE_OF_CREDIT - link to credit card/account
redrawBalance?: number
extraRepaymentCap?: number
```

### **Loan Types**

| Type | Description | Tax Deductible | Can Link To |
|------|-------------|----------------|-------------|
| HOME | Primary residence mortgage | No | Property, Offset Account |
| INVESTMENT | Investment property loan | Yes | Property, Offset Account |
| CAR | Vehicle financing | No | Asset (Vehicle) |
| PERSONAL | Unsecured personal loan | No | - |
| LINE_OF_CREDIT | Revolving credit facility | No | Account (Credit Card) |
| STUDENT | Education/HECS-HELP debt | No | - |
| BUSINESS | Business loan | Yes | Property (if secured) |

### **Relationships**

```
loan → property?          (HOME, INVESTMENT, BUSINESS)
loan → account[]          (offset for HOME/INVESTMENT)
loan → asset?             (CAR - vehicle)
loan → account?           (LINE_OF_CREDIT - credit card)
loan → transaction[]
loan → expense[]
```

### **Financial Rules**

- Drives repayment schedules
- Interest-only rules change amortisation
- Offset account integration reduces interest (HOME/INVESTMENT only)
- Tax-aware debt planner prioritises non-deductible loans first
- CAR loans can track vehicle depreciation via linked asset
- LINE_OF_CREDIT tracks revolving balance via linked account  

---

# **3.3 Accounts**

### **Entity: Account**

```
id: string
type: "account"
name: string
institution: string
accountType: "OFFSET" | "SAVINGS" | "CHECKING"
balance: number
bsb?: string
numberMasked?: string
```

### **Relationships**

```
account → transaction[]
account → loan? (offset)
account → property? (rare)
```

---

# **3.4 Income**

### **Entity: Income**

```
id: string
type: "income"
name: string
incomeType: "SALARY" | "RENT" | "RENTAL" | "INVESTMENT" | "OTHER"
customCategoryId?: string     // Reference to user-defined Category (takes precedence over incomeType if set)
sourceType: "GENERAL" | "PROPERTY" | "INVESTMENT"
amount: number
frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "ANNUAL"
startDate?: string
endDate?: string
propertyId?: string
investmentAccountId?: string
isTaxable: boolean            // Is this income taxable? (default: true)
```

### **Source Types**

| Source Type | Description | Links To |
|-------------|-------------|----------|
| GENERAL | General income (salary, etc.) | None |
| PROPERTY | Property rental income | Property |
| INVESTMENT | Investment returns | Investment Account |

### **Relationships**

```
income → property?
income → investmentAccount?
income → customCategory?      // User-defined category
```

---

# **3.5 Expenses**

### **Entity: Expense**

```
id: string
type: "expense"
name: string
category: "HOUSING" | "RATES" | "INSURANCE" | "MAINTENANCE" | "PERSONAL" | "UTILITIES" | "FOOD" | "TRANSPORT" | "ENTERTAINMENT" | "SUBSCRIPTION" | "STRATA" | "LAND_TAX" | "LOAN_INTEREST" | "REGISTRATION" | "MODIFICATIONS" | "OTHER"
customCategoryId?: string     // Reference to user-defined Category (takes precedence over category if set)
sourceType: "GENERAL" | "PROPERTY" | "LOAN" | "INVESTMENT" | "ASSET"
amount: number
frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL"
vendorName?: string
isEssential: boolean          // Is this an essential expense? (default: true)
isTaxDeductible: boolean      // Is this expense tax deductible? (default: false)
isRecurring: boolean          // Is this a recurring expense or one-off? (default: true)
startDate?: string
endDate?: string
propertyId?: string
loanId?: string
investmentAccountId?: string
assetId?: string
```

### **Expense Type Classification**

| isRecurring | Description | Examples |
|-------------|-------------|----------|
| `true` | Recurring/committed expenses | Bills, subscriptions, regular payments |
| `false` | One-off/discretionary spending | Impulse purchases, variable spending |

### **Source Types**

| Source Type | Description | Links To |
|-------------|-------------|----------|
| GENERAL | General household expenses | None |
| PROPERTY | Property-related expenses | Property |
| LOAN | Loan-related expenses (interest) | Loan |
| INVESTMENT | Investment account expenses | Investment Account |
| ASSET | Asset-related expenses | Asset (Vehicle, Equipment) |

### **Relationships**

```
expense → property?
expense → loan?
expense → investmentAccount?
expense → asset?
expense → customCategory?    // User-defined category
```

---

# **3.6 Categories (Custom)**

### **Entity: Category**

User-defined categories for expenses and income, allowing customization beyond system categories.

```
id: string
type: "category"
userId: string               // Owner of the category
name: string                 // Display name (e.g., "Pet Care", "Side Business")
code: string                 // Unique code per user (auto-generated from name)
categoryType: "EXPENSE" | "INCOME"
description?: string         // Optional description
color?: string               // Hex color for UI (e.g., "#FF5733")
icon?: string                // Icon name for UI
isSystem: boolean            // True for system defaults (false for user-created)
isActive: boolean            // Soft delete flag (default: true)
sortOrder: number            // Custom ordering
createdAt: string
updatedAt: string
```

### **Relationships**

```
category → user
category → expense[]         // Expenses using this category
category → income[]          // Income entries using this category
```

### **Category Types**

| Type | Description | System Categories |
|------|-------------|-------------------|
| EXPENSE | Expense categories | HOUSING, RATES, INSURANCE, UTILITIES, FOOD, TRANSPORT, etc. |
| INCOME | Income types | SALARY, RENT, RENTAL, INVESTMENT, OTHER |

### **Usage Notes**

- System categories are available to all users and cannot be modified or deleted
- Custom categories are user-specific and appear in "My Categories" section
- When `customCategoryId` is set on an Expense/Income, it takes precedence over the system `category` field
- Categories can be soft-deleted (isActive: false) if in use, or permanently deleted if unused

---

# **3.7 Investment Accounts**

### **Entity: InvestmentAccount**

```
id: string
type: "investment-account"
name: string
provider: string
accountNumberMasked?: string
balance: number
```

### **Relationships**

```
investmentAccount → holdings[]
investmentAccount → transactions[]
```

---

# **3.7 Holdings**

### **Entity: Holding**

```
id: string
type: "holding"
symbol: string
units: number
averagePrice: number
marketValue: number
investmentAccountId: string
```

### **Relationships**

```
holding → investmentAccount
holding → transactions[]
```

---

# **3.8 Investment Transactions**

### **Entity: InvestmentTransaction**

```
id: string
type: "transaction"
transactionType: "BUY" | "SELL" | "DIVIDEND" | "FEE"
symbol: string
units: number
price: number
amount: number
date: string
holdingId?: string
investmentAccountId: string
```

---

# **4. Frequency Enum (Global)**

```
"WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "ANNUAL"
```

Conversion table used by:

- Income  
- Expenses  
- Loan extra repayments  
- Cashflow engine  

---

# **5. GRDCS Relationship Map**

The **canonical relationship map** defines **every valid edge** in the system.

```
property → loan
property → expense
property → income
property → account (offset)

loan → property
loan → account (offset or linked for LINE_OF_CREDIT)
loan → asset (vehicle for CAR loans)
loan → transaction
loan → expense

account → transaction
account → loan (offset or credit line)

asset → loan (CAR loans)
asset → expense
asset → valueHistory
asset → serviceRecord

category → expense[]
category → income[]

investmentAccount → holding
investmentAccount → transaction

holding → transaction
```

GRDCS stores this as adjacency lists.

### **GRDCS Entity Types**

```typescript
type GRDCSEntityType =
  | 'property'
  | 'loan'
  | 'income'
  | 'expense'
  | 'account'
  | 'asset'           // Phase 21: Asset Management
  | 'category'        // Custom user-defined categories
  | 'investmentAccount'
  | 'investmentHolding'
  | 'investmentTransaction'
  | 'depreciationSchedule';
```

---

# **6. Aggregation Rules (Snapshot Engine)**

### **6.1 Portfolio Value**

```
sum(property.marketValue)
+ sum(investmentAccount.balance)
+ sum(account.balance)
- sum(loan.principalRemaining)
```

### **6.2 Cashflow Calculation**

```
sum(income converted to monthly)
- sum(expenses converted to monthly)
- loan repayments (engine)
```

### **6.3 LVR Calculation**

```
loan.principalRemaining / property.marketValue
```

### **6.4 Equity Calculation**

```
property.marketValue - outstandingLoans
```

---

# **7. Data Model Requirements**

### **7.1 Must Not Change Without Migration**
Any changes to:

- Field names  
- Data types  
- Enum values  
- Relationship rules  
- Entity structure  

require:

- Schema migration  
- GRDCS rebuild  
- Snapshot recalibration  
- Insights rule updates  

### **7.2 Must Use Canonical Types**
All modules use **shared global types**, not module-specific variants.

---

# **8. Future Extensions**

The data model is designed to support future phases:

- Multi-currency  
- Multi-tenant  
- Tax engine  
- Forecasting  
- Financial health scoring  
- External bank/feed ingestion  
- Smart categorisation  

---

# **9. B2B2C / Practice (Phase 32B)**

## **9.1 Organisation profession (canonical)**

Added 2026-05-04 (migration `20260504120000_add_organisation_profession`):

```
Organization {
  ...
  profession  OrganizationType  @default(FINANCIAL_ADVISOR)
  ...
}
```

`profession` is the canonical "what kind of firm is this?" field. Drives the Practice dashboard layout, alert library defaults, scope presets, and AFSL/credit/TPB compliance framing. **Forced at registration; no MULTI option** (multi-discipline firms register two Orgs under one billing account).

Reuses the existing `OrganizationType` enum (`ACCOUNTING_FIRM | FINANCIAL_ADVISOR | MORTGAGE_BROKER | TAX_AGENT | BOOKKEEPER | OTHER`). At v1 only the first three have explicit Practice config; `TAX_AGENT` + `BOOKKEEPER` fall back to accountant config; `OTHER` falls back to adviser config.

The legacy `OrganizationPortalSettings.organizationType` field is now a **shadow** of this canonical value (backfilled by the migration). Per CLAUDE.md §12.2 SSOT, exactly one canonical source. Dedup queued under `IMPLEMENTATION_PLAN.md` 🗑️ Dead Code #13 — the column on `OrganizationPortalSettings` will be dropped after PR2/PR3 ship.

## **9.2 Three layers of consent (never collapsed)**

| Layer | Granted by → to | Stored as | Revocable | Audit |
|---|---|---|---|---|
| CDR consent | User → Monitrax (via Basiq) | `Consent` row, `ConsentStatus.ACTIVE` | Yes; revocation triggers data purge | `CDR_DATA_*` |
| Professional consent | User → Organisation/Seat | `OrganizationClient` row, `accessScopes[]`, `consentStatus` | Yes; revocation revokes scopes immediately | `PRO_ACCESS_GRANTED/REVOKED/SCOPE_CHANGED` |
| Per-view access event | Implicit each pro render of client data | `ClientAccessLog` row | n/a (read-only history) | `PRO_VIEW`, `PRO_NOTE`, `PRO_TASK`, `PRO_EXPORT` |

The `getMasterFinancialSnapshot()` call from a professional path **must** pass `viewerContext` with `seatId` + `clientUserId` + `accessScopes`. Service rejects the call if any are missing. Scope filter happens at the **service layer**, not the UI — if consent doesn't include `LOANS`, loan data never enters the response payload, even if the UI accidentally tries to render it.

**Wiring shipped Phase 32B PR3 (2026-05-04).** The viewerContext path lives in `lib/services/masterFinancialService.ts` (`ViewerContext` interface + `assertValidViewerContext()` + `loadOrganizationClient()` + `applyScopeFilter()` + `logProDashboardView()`), the canonical entry point is `GET /api/portal/clients/[id]/snapshot`, and the per-view audit emits BOTH a top-level `AuditLog` row (`PRO_DASHBOARD_VIEW`, additive enum migration `20260504160000_add_pro_dashboard_view_action`) AND a `ClientAccessLog` row (per-view detail tied to the `OrganizationClient` row). The caller-asserted `accessScopes` array is treated as informational only — the actual filter applies the canonical DB-stored `OrganizationClient.accessScopes`, so a malicious caller cannot widen scope by lying. Drill-in surface lives at `/portal/clients/[id]/view` and renders the canonical consumer-dashboard primitives via `components/portal/clients/ClientCanonicalDashboard.tsx` + `AdviserOverlay.tsx`.

---

# **10. Entity Layer (Phase 41 — `LegalEntity`)**

Added 2026-05-04 (migration `20260504130000_add_legal_entity` — Phase 41a).

## **10.1 Why an entity layer**

Pre-Phase-41, every owned object (Property / Loan / Account / InvestmentAccount / Asset / Income / Expense) hung directly off `User.userId`. That was sufficient when "the user" was always the legal owner — i.e. every asset was held in a natural person's name. As soon as a real Australian household enters the picture (Family Trust holds the IP, SMSF holds the share portfolio, Pty Ltd runs the side business, personal name owns the home), the flat user-ownership model collapses: the AI advisor can't reason about Div 115 CGT discount per holding period, the tax engine can't allocate trust distributions to beneficiaries, and the adviser pitch demo has nothing to show.

Phase 41a introduces `LegalEntity` as the canonical "who owns this?" layer. Every owned object now has an `ownerEntityId`, and the entity carries the type (`PERSONAL_NAME` / `COMPANY` / `DISCRETIONARY_TRUST` / `UNIT_TRUST` / `SMSF` / `PARTNERSHIP` / `SOLE_TRADER`), the role (`PERSONAL` / `HOLDING` / `OPERATING` / `INVESTMENT` / `SUPERANNUATION`), and the structural identifiers (ABN / ACN / encrypted TFN / trading name / established date / parent-entity for trustee → trust hierarchies).

## **10.2 The `LegalEntity` shape**

```
LegalEntity {
  id               String        @id @default(uuid())
  userId           String        // owning user (the principal of the entity)
  name             String        // "Smith Family Trust" / "Reza Sadeghi" / "Acme Pty Ltd"
  type             LegalEntityType
  role             LegalEntityRole
  abn              String?       // 11-digit Australian Business Number
  acn              String?       // 9-digit Australian Company Number
  tfnEncrypted     String?       // optional, encrypted at rest, never logged, never sent to AI
  tradingName      String?
  establishedDate  DateTime?
  parentEntityId   String?       // self-FK for trustee → trust
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  user             User
  parentEntity     LegalEntity?  @relation("EntityHierarchy")
  childEntities    LegalEntity[] @relation("EntityHierarchy")

  // back-references
  properties / loans / accounts / investmentAccounts /
  assets / incomes / expenses
}
```

Indexed on `userId`, `type`, `parentEntityId`. Mapped to the `legal_entities` Postgres table.

### Enums

- `LegalEntityType` — `PERSONAL_NAME | COMPANY | DISCRETIONARY_TRUST | UNIT_TRUST | SMSF | PARTNERSHIP | SOLE_TRADER`. Foreign trusts, bare trusts, and other rare shapes escalate to OTHER-style support requests at v1; the taxonomy widens only when demand proves out.
- `LegalEntityRole` — `PERSONAL | HOLDING | OPERATING | INVESTMENT | SUPERANNUATION`. One person + multiple entities is normal: PERSONAL (natural name) + HOLDING (family trust holds investments) + OPERATING (Pty Ltd runs a business) + SUPERANNUATION (SMSF). Drives Phase 41c entity-tree colour and Phase 41h AI advisor framing.

### Self-reference (trustee → trust)

`parentEntityId` models the corporate-trustee relationship: a Pty Ltd that acts as trustee for a family trust is the **parent** of that trust. `ON DELETE SET NULL` on the self-FK so removing a trustee company doesn't cascade-delete the trust it controls.

## **10.3 The `ownerEntityId` pattern**

Every owned object now carries:

```
ownerEntityId  String                        // NOT NULL — required at create time
ownerEntity    LegalEntity  @relation(...)   // ON DELETE RESTRICT
```

Affected models: `Property`, `Loan`, `Account`, `InvestmentAccount`, `Asset`, `Income`, `Expense`. Each has an index on `ownerEntityId`.

`ON DELETE RESTRICT` is deliberate. A user must explicitly migrate every owned row off an entity before deleting it — there is no silent "delete the trust, lose the property" path. This is the structural guard that makes the entity layer trustworthy under future entity-rename / entity-merge / entity-archive flows.

## **10.4 Migration & backfill (one-shot, additive)**

Migration `20260504130000_add_legal_entity` runs additively:

1. Create the two enums + `legal_entities` table + self-FK + user-FK.
2. Add `ownerEntityId` (NULLABLE) on each owned table.
3. Backfill — for every existing `User`, INSERT one row into `legal_entities` with `type = PERSONAL_NAME`, `role = PERSONAL`, `name = users.name`. Then UPDATE every Property / Loan / Account / InvestmentAccount / Asset / Income / Expense row WHERE `ownerEntityId IS NULL` to point at its user's PERSONAL_NAME entity. The `IS NULL` guard is the §12.11 safety check — only rows that have never been assigned an entity are touched.
4. ALTER each `ownerEntityId` to `NOT NULL`, add the index, add the FK with `ON DELETE RESTRICT`.

After backfill, behaviour is identical end-to-end to the pre-migration state (every existing object is owned by the user's natural name) — but the foundation is in place for Phase 41b's wizard to introduce additional entities and Phase 41c's tree to visualise them.

## **10.5 The default-entity service**

Until Phase 41b's onboarding wizard ships and asks "How is your wealth held?" up front, every new owned row defaults to the user's `PERSONAL_NAME` entity. Resolution is centralised in `lib/services/legalEntityService.ts`:

```
getDefaultLegalEntityId(userId, [tx]): Promise<string>
```

- Returns the user's `PERSONAL_NAME` entity id.
- Creates one on demand if missing (new registrations between Phase 41a deploy and Phase 41b ship).
- Optional transaction client — pass `tx` when calling from inside `prisma.$transaction` so the entity creation is part of the same atomic write.

Per CLAUDE.md §12.2 SSOT, **never** duplicate this lookup in route handlers or components — always import the helper. Eighteen call sites (every API route + service that creates an owned row) were updated in Phase 41a to use this helper.

## **10.6 TFN handling (CDR §13)**

`tfnEncrypted` follows three hard rules:

1. **Optional, default-off.** Wizard collects TFN only if the user explicitly opts in.
2. **Encrypted at rest.** Wrapped via `lib/security/tfnEncryption.ts` (`encryptTfn` / `decryptTfn` / `maskTfn`). The current implementation mirrors the `MFAMethod.secret` pattern (base64 obfuscation) and is a single swap-point for upgrading to KMS-backed CMEK encryption when CMEK lands (`IMPLEMENTATION_PLAN.md` Up Next #3).
3. **Never logged, never in audit metadata, never sent to AI.** If a tfn-bearing entity flows through `createAuditLog()` by accident, it must be sanitised through `sanitizeCdrMetadata()` first. AI advisor inputs (`lib/cfo/aiAdvisor.ts`) explicitly omit the field.

## **10.7 What this enables (Phase 41b–h)**

- ✅ **41b** Onboarding wizard "How is your wealth held?" + standalone `/dashboard/entities` surface — **SHIPPED 2026-05-04 (PR-41b).** See §10.8.
- ✅ **41c** Interactive Entity Tree at `/dashboard/entities` — **SHIPPED 2026-05-04 (PR-41c).** Replaces the 41b list per Reza directive. See §10.9.
- ✅ **41d** Money Flow Sankey at `/dashboard/entities` (Money Flow tab) — **SHIPPED 2026-05-05 (PR-41d).** See §10.10.
- **41e** Entity-aware tax engine — Div 115 per-entity holding period, trust distributions to beneficiaries, SMSF caps, etc. See `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` for the full authority-mapped architecture.
- **41f** Personal Xero / MYOB integration — connects a user's `OPERATING` Pty Ltd entity to its bookkeeping system.
- ✅ **41g** Adviser drill-in mounts EntityTree + MoneyFlowSankey at `/portal/clients/[id]/view` — **SHIPPED 2026-05-05 (PR-41g).** See §10.11.
- **41h** AI Guide entity-aware diagnosis — general-information only ("Div 115 50% applies after 12 months"), structural recommendations channel through Ask-a-Pro per the structural Gemini-tool-registry boundary in PHASE_41_REGULATORY_ARCHITECTURE §5.

## **10.8 Phase 41b — entity management surfaces**

Added 2026-05-04 (PR-41b). Three surfaces, three API routes, one canonical service.

### Surfaces

| Surface | Route / Component | Purpose |
|---|---|---|
| Wizard step | `components/onboarding/wizard/steps/EntitiesStep.tsx` | First-time onboarding — "How is your wealth held?" between Household and Properties |
| Standalone management | `app/dashboard/entities/page.tsx` (TRACK sidebar → My Accounts → My Structure) | Existing users add/edit/remove entities anytime |
| AIHelper context | `components/onboarding/wizard/AIHelper.tsx` | Step-aware AI guidance for the wizard step |

### API endpoints

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/entities` | `entity.read` | List user's entities + owned-objects counts |
| POST | `/api/entities` | `entity.write` | Create new entity (validates ABN/ACN/TFN format; encrypts TFN) |
| GET | `/api/entities/[id]` | `entity.read` | Fetch single entity (excludes plaintext TFN) |
| PUT | `/api/entities/[id]` | `entity.write` | Partial update (TFN: undefined = leave untouched, null = clear, string = replace) |
| DELETE | `/api/entities/[id]` | `entity.delete` | Remove entity. 409 if has owned objects (with friendly counts). 409 if it's the last PERSONAL_NAME (default-owner protection). |

### Service exports (canonical `lib/services/legalEntityService.ts`)

```typescript
getDefaultLegalEntityId(userId, [tx])          // Phase 41a — returns user's PERSONAL_NAME, creates on demand
listEntitiesForUser(userId, [tx])              // Phase 41b — returns LegalEntitySummary[] with _count aggregations
createEntity(userId, input, [tx])              // encrypts TFN via tfnEncryption.ts; validates parent FK
updateEntity(userId, entityId, input, [tx])   // partial update; same TFN/parent rules
deleteEntity(userId, entityId, [tx])           // throws EntityHasOwnedObjectsError if any owned rows
EntityHasOwnedObjectsError                     // structured error for 409 mapping
type LegalEntitySummary                        // never includes tfnEncrypted value, only `hasTfn: boolean`
```

### AU regulatory validators (`lib/utils/auValidators.ts`)

Single SSOT used by client (wizard form + management page) and server (route validation):
- `isValidAbn(input)` — 11-digit modulus-89 checksum per ATO ABN spec.
- `isValidAcn(input)` — 9-digit ASIC complement checksum per RG 22.
- `isValidTfnFormat(input)` — 8/9-digit format only (ATO does not publish TFN checksum).
- `formatAbn(d)` / `formatAcn(d)` — display formatters.

### TFN handling (CDR §13 — recap)

- OPTIONAL, default-off, opt-in only via dedicated UI switch.
- Encrypted at rest via `lib/security/tfnEncryption.ts` (single swap-point for KMS-backed CMEK upgrade).
- `LegalEntitySummary` returns `hasTfn: boolean` only — the value never crosses the API boundary by default.
- `logCRUD` audit metadata wraps all entity payloads through `sanitizeCdrMetadata` and records `hasTfn` instead of the value.
- AI advisor inputs explicitly omit `tfnEncrypted`.

## **10.9 Phase 41c — Interactive Entity Tree**

Added 2026-05-04 (PR-41c). Reza directive: *"Yes it should replace, the tree view should be an interactive and live tree view that user can view, track and navigate through the tree view."*

### What changed

The standalone management surface at `/dashboard/entities` no longer renders a flat list of entity cards. It now renders an interactive 3-row glass-tile tree with SVG connectors. The list rendering block (~98 lines) was deleted; the page is now a thin orchestrator that fetches data and mounts `EntityTree` + the existing `EntityFormDialog` from 41b.

### Component anatomy

```
components/entities/
├── types.ts          — shared client-side types (Entity, HouseholdMember,
│                       OwnedObjectsCount, ROLE_PALETTE, TYPES, ROLES, labels)
└── EntityTree.tsx    — the visualisation component
    ├── PersonTile    — top row: household members (or generic "You" anchor)
    ├── EntityTile    — middle row: legal entities, role-coloured
    └── Connectors    — SVG layer drawing Person→Entity Bézier paths
                        + dashed Trustee→Trust corporate links
```

### Data sources

| Data | Endpoint | Used for |
|---|---|---|
| Entities + owned-objects counts | `/api/entities` (Phase 41b) | Tile rendering + chip counts + parent FK |
| Household members | `/api/household-members` | People row labels + Person→Entity matching |

Both fetched in parallel from the page on mount and on dialog close (live refresh).

### Visual rules

- **Apple-glass aesthetic** matching Phase 39 — `rounded-2xl` tiles, `ring-1 ring-slate-900/[0.04]`, `backdrop-blur-sm`, hover-lift via framer-motion.
- **Role-coloured palette** so colour-blind readers can still distinguish via the labels:
  - PERSONAL → warm amber (matches Phase 39 PERSONAL_NAME archetype)
  - OPERATING → emerald (active business)
  - HOLDING → indigo (passive structure)
  - SUPERANNUATION → violet (the Phase 39 super tone)
  - INVESTMENT → fuchsia (accent that contrasts with HOLDING)
- **Owned-objects rendered as chips inside each entity tile** — clickable, drill to `/dashboard/{properties|balances|investments/accounts|assets}`. Stops the tree from needing a third row (one less layout dimension).
- **Trustee→trust link**: dashed fuchsia Bézier path between two entity tiles, plus a "↳ trustee: {parent.name}" line inside the child tile (always visible; SVG is desktop-only).
- **`prefers-reduced-motion`** respected — entrance animations short-circuit, hover lift suppressed.

### Click affordances

| Element | Action |
|---|---|
| Entity tile (anywhere on the tile) | Opens `EntityFormDialog` in **edit** mode |
| Owned-objects chip (`2 properties`, etc.) | Stops propagation, navigates to the relevant `/dashboard/*` page |
| "Add a trust, SMSF, or company" CTA | Opens `EntityFormDialog` in **create** mode |
| Person tile | No-op for v1 (Phase 41e+ will navigate to a person-scoped tax position view) |
| Entity dialog → "Remove" footer button | Closes the dialog and opens the AlertDialog removal flow (per-tile remove buttons retired — single canonical entry point) |

### People→Entity edge heuristic (v1)

The schema doesn't yet model shareholder / beneficiary links between `LegalEntity` and `HouseholdMember`. Phase 41c uses a v1 heuristic:

1. **PERSONAL_NAME entity → matching person** by case-insensitive name (or first-substring match), or the first household member if no match.
2. **Non-PERSONAL_NAME entity** → fans out to **every** PERSONAL_NAME entity's matched person. (e.g. a Family Trust connects to both David Mei *and* Emma Liu when both are present.)

When household members aren't seeded yet (single-user accounts, pre-onboarding), a single anchor labelled "You" stands in.

This heuristic intentionally over-connects rather than under-connects so the visual stays informative for joint-name structures. Phase 41e's beneficiary / shareholder fields will replace this with explicit edges from real DB rows.

### Mobile fallback (<md)

- SVG layer suppressed (canvas measurements break in flowed-vertical layouts; hard-coded paths would mislead).
- Tiles stack vertically with the same content.
- Trustee→trust hierarchy is communicated by the in-tile "↳ trustee: {parent.name}" line.
- The "Add" CTA renders as a full-width button at the bottom of the stack.

### Why no react-flow / @xyflow/react

Evaluated and rejected per CLAUDE.md §12.7 (prefer existing capability) + §12.8 (simplicity over cleverness):

- The tree is a static 2-row + connector layer. No drag, no zoom, no pan needed.
- `reactflow` adds ~150 KB to the bundle for one page.
- `framer-motion` (already in deps) covers the entrance/hover motion.
- A 350-line component using CSS grid + a small SVG layer is more maintainable than configuring react-flow nodes/edges and writing custom node renderers.

If Phase 41 ever needs pan/zoom for very large structures (10+ entities), revisit.

### What this unblocks (41d/e/f/g/h)

- **41d Sankey** — the second wow moment in the lighthouse pitch. Reuses the entity layer's data shape; same role palette so colour continuity carries between the two visualisations.
- **41e tax engine** — the entity tree is the visual that the 41h AI advisor will reference ("your trust holds property X with $300k unrealised CGT").
- **41g adviser overlay** — the same `EntityTree` component will mount inside `/portal/clients/[id]/view` as the primary diagnostic surface above the canonical consumer dashboard.




## **10.10 Phase 41d — Money Flow Sankey**

Added 2026-05-05 (PR-41d). The "where does the money actually go?" view — the **second wow moment** in the lighthouse pitch (Step 4) and the natural complement to the 41c entity tree (the tree shows *what you own*; the Sankey shows *how money moves through it*).

### What it shows

A 3-stage flow visualisation rendered with `recharts <Sankey>`:

```
Income sources           Legal entities                  Outflows
───────────────         ───────────────                 ───────────────
Salary                  PERSONAL_NAME                   Tax
Rental                  OPERATING (Pty Ltd)             Essential expenses
Investment              HOLDING (Trust)                 Discretionary
Other                   SUPERANNUATION (SMSF)           Loan repayments
                        INVESTMENT (Unit Trust)         Surplus
```

### Component anatomy

```
lib/services/moneyFlowService.ts        — getMoneyFlow(userId) orchestrator
app/api/money-flow/route.ts             — GET wrapper (`report.read` permission)
components/entities/MoneyFlowSankey.tsx — recharts <Sankey> wrapper
app/dashboard/entities/page.tsx         — tab toggle (Structure | Money Flow)
```

### Income source classification

Raw `IncomeType` enum values are normalised to four user-readable labels so the left column stays scannable:

| Source label | IncomeType / sourceType |
|---|---|
| Salary | `SALARY` |
| Rental | `RENTAL` or `RENT` |
| Investment | `INVESTMENT` (or `sourceType === 'INVESTMENT'`) |
| Other | everything else (`OTHER`, government payments, gifts, hobby income) |

Source nodes with zero amount are filtered out (no ghost columns).

### Outflow buckets

| Outflow | Source |
|---|---|
| Tax | Sum of `Income.paygWithholding` per entity (proportional allocation when entity-level PAYG isn't recorded) |
| Essential expenses | Sum of `Expense.amount` (annualised) where `isEssential = true`, by entity |
| Discretionary | Sum of `Expense.amount` (annualised) where `isEssential = false`, by entity |
| Loan repayments | Sum of `Loan.minRepayment` (annualised), by entity |
| Surplus | Residual: `incomeIn - tax - essential - discretionary - loanRep`, clamped to ≥0 (deficit shown separately in headline chip) |

### v1 heuristics (to be replaced by Phase 41e)

- **Tax allocation is proportional** to each entity's share of taxable income across the household. Real per-entity tax requires Div 6/6E trust distribution math (Phase 41e.1 / 41e.4); v1 is honest about this with an inline italic caveat.
- **Loan repayments** use `minRepayment` annualised — no interest/principal split, no offset-account effect on effective interest. The entity-aware tax engine (Phase 41e.5) will compute deductible vs. non-deductible interest correctly.
- **Surplus** is the arithmetic residual. Negative residuals (deficit) clamp to 0 for the Sankey layout (recharts can't draw negative-width links) but are surfaced in the headline chip strip as `Deficit $X`.

### Visual rules

- **Role palette continuity** — entity nodes use the same role-coloured hex palette as the 41c tree (PERSONAL warm amber `#d97706` / OPERATING emerald `#059669` / HOLDING indigo `#4f46e5` / SUPERANNUATION violet `#7c3aed` / INVESTMENT fuchsia `#c026d3`). Income sources tinted cool (sky/teal/cyan); outflows tinted warm (red/orange/amber/purple) with surplus emerald (positive).
- **Custom Node renderer** outputs Apple-glass-style rounded rectangles with AUD labels positioned outside the column; abbreviated currency for compact display, full AUD in the tooltip.
- **Custom Tooltip** shows `{Source} → {Target}` with formatted `$X per year`.
- **Headline chip strip** above the canvas: Income / Tax / Essentials / Discretionary / Loans / Surplus (or Deficit, in rose). Lets the viewer read the totals before tracing the flows.
- **`prefers-reduced-motion`** collapses the entrance fade.

### Why recharts (not @nivo/sankey, not d3-sankey)

Evaluated and rejected per CLAUDE.md §12.7 + §12.8:
- `recharts` is **already in deps** (v3.5.0); zero new dependencies.
- `@nivo/sankey` would add ~150-200 KB (full nivo runtime).
- `d3-sankey` would add ~30 KB but requires writing the SVG renderer ourselves; recharts' `<Sankey>` is good enough.

### What this unblocks

- **Phase 41e** — the entity-aware tax engine replaces the proportional tax allocation with Div 6/6E + s100A + Div 7A correctness (per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`).
- **Phase 41g** — the same `MoneyFlowSankey` component will mount inside `/portal/clients/[id]/view` as a complementary diagnostic alongside the entity tree.
- **Phase 41h** — the AI advisor will reference flow facts ("$24k of your salary leaks to tax annually under your current structure") via the same service.

## **10.11 Phase 41g — Adviser drill-in entity layer**

Added 2026-05-05 (PR-41g). Mounts the Phase 41c `EntityTree` and Phase 41d `MoneyFlowSankey` inside the adviser drill-in surface at `/portal/clients/[id]/view`, populated with the **client's** data (not the adviser's). The brief: *"the adviser cannot give wealth advice without seeing the structure first; this surfaces it prominently."*

### What changed

- New 3-tab toggle on `/portal/clients/[id]/view`: **Structure** (default — entity tree) | **Money Flow** (Sankey) | **Dashboard** (the existing `ClientCanonicalDashboard` from Phase 32B PR3).
- Two new portal endpoints (`GET /api/portal/clients/[id]/entities` and `GET /api/portal/clients/[id]/money-flow`) that delegate to the same canonical services as the consumer endpoints (`listEntitiesForUser`, `getMoneyFlow`), but pass the **client's** userId.
- New shared helper `lib/portal/adviserClientAccess.ts` extracts the consent + membership + role + assignment guard from the existing `/snapshot` route. All three portal endpoints (snapshot, entities, money-flow) now share one canonical access check.

### Auth guard — `verifyAdviserClientAccess`

Layered checks (rejection at any layer returns a structured error that the page surfaces):
1. `OrganizationClient` row exists for `params.id`
2. Status === 'ACTIVE' AND consentStatus === 'GRANTED'
3. Caller has an active `OrganizationMember` seat on the same org
4. Caller's role permits viewing client data (`PermissionGuards.canViewClientData`)
5. If caller is `PORTAL_ADVISOR`, they're assigned to this client (`PORTAL_OWNER` / `PORTAL_ADMIN` see the whole book)

Returns the canonical `accessScopes` from the DB row — never from caller-provided input. Per CLAUDE.md §0 architect lens, the consent source-of-truth is the database, never URL params or headers.

**Reviewers reject any new portal client-data endpoint that doesn't route through this helper.**

### Audit

The page-level `/snapshot` request already writes a `PRO_DASHBOARD_VIEW` row to `ClientAccessLog` for the view session. The new entities + money-flow endpoints **piggyback on that row** — they don't write their own. Multiplying audit rows per component would pollute the compliance log without adding signal. If component-level access logs are ever required, we add new action codes (`PRO_ENTITY_VIEW`, `PRO_MONEY_FLOW_VIEW`) and emit them at the route layer.

### Read-only in adviser view

Advisers can NOT edit a client's entity layer:
- The `EntityTree`'s `onEntityClick` is a no-op (no edit dialog opens)
- The `EntityTree`'s `onAdd` is a no-op (no Add CTA fires)
- No `EntityFormDialog` mounted on the adviser page

This is deliberate. Editing a client's structure is a personal-advice activity that needs to happen through the proper Ask-a-Pro / consent channels (Phase 32C) — not via a side-door API the adviser can hit because they have a viewing seat. A future Phase 41 slice may surface a *"Suggest a structural change"* affordance that opens an Ask-a-Pro thread for the client to action.

### Failure modes

- **Snapshot fails** → page shows the existing `Cannot view this client` error; entities/flow don't load.
- **Entities fail** (e.g. Prisma schema drift, network) → the Structure tab renders with empty arrays; the EntityTree's empty-state hero shows.
- **Money flow fails** → the Money Flow tab renders the friendly "No money flow data available for this client yet" message.
- **Dashboard tab is unaffected** by entities/flow failures — it only depends on the snapshot.

### What this unblocks (41h)

- The AI advisor (Phase 41h) composes the same flow shape and entity tree to produce entity-aware diagnostics ("Olivia's trust holds property X with $300k unrealised CGT"). Both visualisations are now reachable from the adviser drill-in, so the AI's recommendations show up next to the same evidence the adviser is reading.

## **10.12 Phase 41e.−1 cleanup + 41e.0 foundation — schema-relevant changes**

The Phase 41e.−1 cleanup PR (slices A/B/C/D — PRs #626/#629/#630/#633) and Phase 41e.0 foundation (slices A/B in flight via PRs #634/#636) introduce schema-adjacent changes worth recording here even though most of 41e is calc-engine and type-system work.

### `TaxYearConfig` extended (slice A — PR #626)

`lib/tax-engine/types.ts` extended with 7 new required fields on `TaxYearConfig` carrying primary-authority citations in JSDoc. These are **type-only** changes (no DB schema impact) but they are the canonical SSOT for AU tax thresholds (CLAUDE.md §12.2):

| Field | Purpose | Authority |
|---|---|---|
| `label` | Display string ("FY24-25") | — |
| `superGuaranteeQuarterlyCap` | ATO maximum super contribution base | ATO annual publication |
| `superContributionsTaxRate` | Taxed-in-fund rate (15% across all FYs) | ITAA 1997 s295-485 |
| `coContributionIncomeThreshold` | Phase-out upper bound | ATO annual indexation |
| `carryForwardTsbThreshold` | TSB threshold for carry-forward concessional | ITAA 1997 s291-20(3) |
| `bringForwardThresholds` | TSB tiers for non-concessional bring-forward | ITAA 1997 s292-85(2) |
| `reviewSchedule` | Per-FY review checkpoint (forces explicit human review before each new FY) | Audit doc §10.2 |

`TAX_YEAR_2025_26` added (resolves audit C-4). SG rises to 12% per ATO schedule.

### LegalEntity DB CHECK constraint (slice B — PR #636)

Migration `20260506110000_legal_entity_no_self_parent` adds:

```sql
ALTER TABLE "legal_entities"
  ADD CONSTRAINT "legal_entities_no_self_parent"
  CHECK ("id" <> "parentEntityId" OR "parentEntityId" IS NULL);
```

**Defence-in-depth** for the `parentEntityId` cycle-detection contract documented in audit §7. The application-layer `validateParentChain()` helper in `lib/services/legalEntityService.ts` is the primary guard (SELF_PARENT / CYCLE_DETECTED / MAX_DEPTH_EXCEEDED at chain depth 10 / PARENT_NOT_FOUND); this CHECK constraint catches the simplest cycle (`id = parent_entity_id`) at the storage layer regardless of how a row reaches the database.

Pure additive — only rejects rows the application has been blocking since 41a. §12.11 N/A.

### Phase 41e.0 entity-aware orchestration types (slice A — PR #634)

New type contracts in `lib/tax-engine/types.ts` (no DB schema impact, but they're the canonical contract for the new layer per architecture doc §4):

- `AuthorityCitation` — primary AU authority reference (ITAA 1936/1997 / SIS Act / TR / TD / PCG / PS LA / state acts) attached to every rule result.
- `FYReference` — FY-indexed lookup contract.
- `EntityTaxFacts` — per-entity dispatcher input.
- `EntityTaxPosition` — output of single-entity dispatch.
- `UncomputedFlag` — audit-friendly "deliberately not computed" structure.
- `MasterTaxPosition` — household-wide roll-up; the canonical replacement for `buildTaxSummary()` once 41e.17 lands.

### Aggregator extensions (slice C — shipped 2026-05-05, PR #639)

The 5 financial aggregators gained an optional `ownerEntityId?: string` parameter (default = no filter, backward-compatible). This is the application-layer flow that activates the existing `ownerEntityId` FK on every owned object. **No DB schema change** — pure application code.

| Aggregator | New signature |
|---|---|
| `aggregateIncome(income, targetFrequency, ownerEntityId?)` | filter applied to the income array before aggregation |
| `aggregateExpenses(expenses, targetFrequency, ownerEntityId?)` | filter applied before category breakdown |
| `aggregateLoanRepayments(loans, targetFrequency, ownerEntityId?)` | filter applied before principal/interest summation |
| `calculateCashflow(input, ownerEntityId?)` | filter applied to all three sub-arrays (`income` / `expenses` / `loans`) once at the top |
| `calculateTotalAssets(properties, accounts, investments, super, personalAssets, ownerEntityId?)` | filter applied to each asset class via internal helper |
| `calculateTotalLiabilities(loans, ownerEntityId?)` | filter applied before mortgage / personal / credit-card classification |

Every `*Input` interface gained an `ownerEntityId?: string | null` field — additive, optional, nullable. Existing callers that don't read the column see `undefined` and the aggregator's filter param defaults to "no filter" so the resulting numbers match pre-41e behaviour exactly.

**18 tests** in `tests/calculations/aggregatorEntityScoping.test.ts` pin the contract for both halves: (1) omitting the filter param reproduces pre-41e household-wide totals; (2) providing it returns only matching items; (3) per-entity sums equal the household total (proves no double-counting). The third assertion is the structural correctness guarantee — `e1.total + e2.total === household.total`.

**Resolves audit C-3** — the last open audit critical. With this slice, all four C-class findings (C-1, C-2, C-3, C-4) are resolved. 41e.0 needs only slice D (router skeleton + boundaries renderer + new endpoints) before 41e.1 starts.

### Entity tax router + boundaries renderer + new endpoints (slice D — shipped 2026-05-05, PR #642)

Slice D ships the orchestration scaffolding that makes the entity-aware layer reachable from the UI:

- **`lib/tax-engine/entity/entityTaxRouter.ts`** — `calculateEntityTaxPosition(facts)` dispatches by `LegalEntityType`. PERSONAL_NAME / SOLE_TRADER → wraps Phase 20's `calculateTaxPosition()` with citations (ITAA 1997 s4-10 + Div 1-6 / s8-1). COMPANY / DISCRETIONARY_TRUST / UNIT_TRUST / SMSF / PARTNERSHIP → returns `null` result + structured `UncomputedFlag` documenting which sub-PR (41e.1, 41e.2/3, 41e.4, 41e.6, 41e.11) will produce the real number. **Never false numbers** per audit §10.3.
- **`lib/tax-engine/boundaries/index.ts`** — `renderBoundaryFootnote(input)` assembles the AFSL / TPB / NCCP footer from authority citations + UNCOMPUTED flags + the canonical `BOUNDARY_STATEMENT` constant. De-duplicates citations + flags so repeat sources don't pollute the footer.
- **`components/tax/BoundaryFootnote.tsx`** — the React component. Renders the footer in 5 stacked rows: FY context → computed-per audit trail → UNCOMPUTED disclosures (one row per flag, with amber alert icon) → boundary statement (bold) → last-calculated timestamp. Compact variant for tile use.
- **`GET /api/tax/config`** — returns `TaxYearConfig` for `?fy=YYYY-YY` (default current FY) + the available FY list. `tax_data.read` permission. Closes audit §6.8 entry — was originally tagged as 41e.−1 work but landed in slice D for tighter scoping.
- **`GET /api/tax/entity/[entityId]`** — per-entity tax position via the router skeleton. `tax_data.read`. Caller must own the entity (Prisma `findFirst` with `userId` scoping). Response shape: `{ success, data: { entityPosition, boundary } }`.

`/dashboard/tax` page now renders `<BoundaryFootnote citations={TAX_PAGE_CITATIONS} fyLabel={taxConfig.label} calculatedAt={taxPosition?.metadata.calculatedAt} />` at the page bottom — replaces the old free-text Disclaimer card. **First user-visible 41e.0 surface.**

26 new tests: `tests/tax-engine/entity/entityTaxRouter.test.ts` (11 tests — both halves of the dispatch contract) and `tests/tax-engine/boundaries/boundaries.test.ts` (15 tests — citation formatting, de-duplication, UNCOMPUTED rendering, BOUNDARY_STATEMENT contains TPB/AFSL/NCCP).

After slice D, **41e.0 is COMPLETE.** 41e.1 (Div 115 + Div 6 basic + capital loss netting) starts.

## **10.13 Phase 41e.1 — Div 115 CGT discount, Div 6 basic, capital loss netting (in flight)**

41e.1 is the first **rule** sub-PR. Sliced for digestibility:

- **Slice A (PR #644 — shipped 2026-05-05):** Div 115 CGT discount module. New `lib/tax-engine/divisions/cgtDiscount.ts` with the entity-aware rate dispatch:
  - PERSONAL_NAME / SOLE_TRADER / DISCRETIONARY_TRUST / UNIT_TRUST / PARTNERSHIP → 50% per ITAA 1997 s115-25
  - SMSF (complying) → 33⅓% per ITAA 1997 s115-100
  - SMSF (non-complying) → 0% (s115-100 carve-out)
  - COMPANY → 0% per ITAA 1997 s115-280 (companies not eligible)
  - Any entity, < 12 months held → 0% per ITAA 1997 s115-25
  - Foreign-resident → flagged `UC-FOREIGN-RESIDENT-CGT` (Subdiv 115-D apportionment deferred to a future sub-PR)
  
  Pure functions; no consumers yet — slice D wires the router to call this for `cgt_event` inputs. 24 unit tests covering every entity branch + holding-period gate + SMSF complying/non-complying split + foreign-resident UNCOMPUTED + edge cases (zero gain, negative gain).

- **Slice B (PR #645 — shipped 2026-05-05):** Capital loss netting + ordering. New `lib/tax-engine/divisions/capitalLossNetting.ts` exporting `applyCapitalLossNetting(input)`. Implements ITAA 1997 s100-50 (loss-method ordering) + s115-100 (discount applied to net gain after losses, NOT to gross gains then summed) + Div 102-A (assessable net capital gain). Composes slice A's `calculateCgtDiscount` per entity. Handles current-year + prior-year carry-forward losses (FIFO by FY); when losses > gains, surfaces the unconsumed residual via `carryForwardOut`. Mixed holding periods raise `UC-CGT-MIXED-HOLDING` with proportional discount applied to the qualifying-share of the net gain. The **critical s115-100 ordering rule** is pinned by a dedicated test: gain $100k + loss $30k under 50% discount must produce $35k assessable (not $20k — applying discount to gross then subtracting loss is the consumer-tax mistake we explicitly catch). 18 unit tests covering current-year netting, prior-year carry-forward, FIFO ordering, entity dispatch (PERSONAL/SMSF/COMPANY/TRUST), mixed holding period UNCOMPUTED, carry-forward residual, edge cases.
- **Slice C (queued):** Div 6 basic + `trustDistribution.ts` skeleton. Presently-entitled allocation per ITAA 1936 s95–s99B. Streaming (Div 6E) lands in 41e.4.
- **Slice D (queued):** Wire `entityTaxRouter` to consume the new modules. COMPANY / DISCRETIONARY_TRUST UNCOMPUTED branches start producing real numbers for the simple-disposal + non-streamed-distribution cases. AFSL footer surfaces s115-25 + Div 6 citations on per-entity API responses.

After 41e.1, the audit's "never false numbers" principle relaxes: COMPANY and TRUST entities start returning computed CGT figures for disposal events, paired with the boundary footer citing exactly which sections were applied.
