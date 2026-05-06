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

---

# **§11 — PHASE 32B/32C/33g: B2B2C SURFACE DATA MODEL**

*Added 2026-05-09 (doc-catch-up). Phases 32B/32C/33g shipped between
2026-05-04 and 2026-05-09 as the B2B2C Practice surface that lets
Australian financial advisers, brokers, and accountants run their
client book on Monitrax. This section catalogues the new entities,
the relationships between them, and the architectural rules that
hold across all of them.*

The new domain is layered:

```
Public  ─── Marketplace listing ───┐
                                   ▼
Picker  ─── Ask-a-Pro candidates ──┤
                                   ▼
Bridge  ─── Professional request ──┤
                                   ▼
Engagement ─ ClientLink ───────────┤
                                   ▼
Comms ──── Conversation thread ────┤
                                   ▼
Billing ── Stripe customer/sub ────┘ ── Lead-fee invoice
```

Every layer has a single canonical service in `lib/services/` and
every layer enforces the **leaky-funnel guardrail** at the service
boundary: org-attached users (any active+granted `OrganizationClient`)
never see the public marketplace, never receive public-marketplace
suggestions, and cannot submit public-marketplace requests. Strategic
decision per `IMPLEMENTATION_PLAN.md` Up Next #15 (2026-05-04):
orgs pay for Monitrax to be their CRM + comms channel; the platform
must not redirect their clients to competitors.

## **§11.1 — `Organization.profession`** (Phase 32B PR1)

Added field, forced at registration:

```prisma
model Organization {
  profession  OrganizationType  @default(FINANCIAL_ADVISOR)
}

enum OrganizationType {
  ACCOUNTING_FIRM
  FINANCIAL_ADVISOR
  MORTGAGE_BROKER
  TAX_AGENT
  BOOKKEEPER
  OTHER
}
```

Drives Practice dashboard layout, alert library, scope presets, and
AFSL/credit-licence guardrails. Cannot be flipped in-page (no toggle,
no env-gated demo mode — Reza directive 2026-05-04). The legacy
`OrganizationPortalSettings.organizationType` is now a shadow that
the canonical column will eventually subsume.

## **§11.2 — Marketplace** (Phase 32C PR4a)

```prisma
model ProfessionalListing {
  organizationId        String  @unique  // one per Org at v1
  publicSlug            String  @unique
  status                ListingStatus  // DRAFT/PENDING_REVIEW/APPROVED/REJECTED/SUSPENDED
  discipline            OrganizationType
  specialisations       ProfessionalSpecialisation[]
  targetTiers           ListingTargetTier[]
  regions               ListingRegion[]
  afslNumber            String?
  creditRepNumber       String?
  tpbNumber             String?
  abn                   String?
  leadFeeTierEmerging   Decimal  @default(80)
  leadFeeTierGrowing    Decimal  @default(150)
  leadFeeTierEstablished Decimal @default(250)
  reviewedByAdminId     String?         // FK AdminUser
  asicCrossCheckedAt    DateTime?       // manual cross-check at v1
  tpbCrossCheckedAt     DateTime?
  ratingsCount          Int             // denormalised for browse perf
  averageRating         Decimal?
  acceptedRequestsCount Int
}

model ProfessionalRating {
  listingId       String
  raterUserId     String
  stars           Int             // 1-5
  comment         String?
  isPublic        Boolean         // moderation flag — admin can hide without deleting
  flaggedAt       DateTime?
  @@unique([listingId, raterUserId])  // one rating per user per listing
}
```

**Lifecycle invariants:**
- Editing an `APPROVED` listing flips it back to `PENDING_REVIEW` — admin re-checks before re-publish.
- Editing a `REJECTED` listing returns it to `DRAFT`.
- Submit-for-review requires ≥10-char tagline, ≥100-char blurb, ≥1 specialisation + region, discipline-conditional compliance number (AFSL for FINANCIAL_ADVISOR, credit rep for MORTGAGE_BROKER, TPB for TAX_AGENT/ACCOUNTING_FIRM).
- Lead-fee tiers stored per-listing so per-Org overrides are possible at admin-approval time.

## **§11.3 — Professional Request lifecycle** (Phase 32C PR4c)

```prisma
model ProfessionalRequest {
  requesterUserId       String
  listingId             String
  contextLabel          String?         // 'tax' / 'refinance' / etc — biases AskAPro picker
  question              String
  snapshotContextJson   Json?           // user-curated metrics shared at submit (CDR-sanitised; max 8KB)
  status                RequestStatus   // SUBMITTED/ACCEPTED/DECLINED/WITHDRAWN/EXPIRED
  respondedByMemberId   String?         // FK OrganizationMember
  declineReason         String?
  withdrawnAt           DateTime?
  // Lead fee — tier resolved at submit-time, billing intent recorded at accept-time
  leadFeeTier           LeadFeeTier?
  leadFeeAmount         Decimal?
  leadFeeChargedAt      DateTime?
  // Phase 32C PR6b — Stripe Invoice linkage
  stripeInvoiceId       String?  @unique
  leadFeeStatus         LeadFeeStatus?  // PENDING_CREATE/PENDING_PAYMENT/PAID/FAILED/VOIDED
  leadFeeInvoiceUrl     String?
  leadFeePaidAt         DateTime?
  leadFeeFailedAt       DateTime?
  // Engagement materialised on accept
  clientLinkId          String?  @unique  // FK OrganizationClient
  conversation          ProfessionalConversation?  // 1-1 auto-created on accept
}
```

**State machine:**

```
   SUBMITTED ──accept──→ ACCEPTED  → ClientLink created + conversation created + lead-fee invoice created
            ──decline─→ DECLINED  → reason text required
            ──withdraw→ WITHDRAWN
            ──14d──────→ EXPIRED  (PROD scheduler; not implemented in v1)
```

**Lead-fee tier is FROZEN at submit-time** — the listing's per-tier
rate is read at submit and the resolved amount stored on the request.
Downstream tier-rate edits on the listing don't retroactively change
in-flight requests.

**Accept transaction:** lifecycle transition + `OrganizationClient`
upsert (status=INVITED, consentStatus=PENDING — engagement materialises
through the existing consent flow) run in a single
`prisma.$transaction`. Conversation auto-create + lead-fee invoice
creation run AFTER the transaction commits as best-effort follow-ups
(failure does NOT roll back accept; ops can re-run idempotently).

## **§11.4 — Conversations** (Phase 32C PR4d)

```prisma
model ProfessionalConversation {
  requestId        String?  @unique  // 1-1 with ProfessionalRequest (NULL for org-scoped)
  organizationId   String
  replyToSlug      String  @unique  // 32-char hex; routes inbound emails
  subject          String  @db.VarChar(160)
  isClosed         Boolean
  lastMessageAt    DateTime
}

model ConversationParticipant {
  conversationId   String
  userId           String?         // CONSUMER role
  memberId         String?         // PROFESSIONAL role (FK OrganizationMember)
  role             ConversationRole  // CONSUMER/PROFESSIONAL/AI_HELPER
  hiddenFromUser   Boolean         // soft-delete from this participant's view
  lastReadAt       DateTime?       // read-receipt
  @@unique([conversationId, userId, memberId])
}

model ConversationMessage {
  conversationId    String
  senderUserId      String?
  senderRole        ConversationRole  // FROZEN at send time for audit
  body              String  @db.Text
  channel           MessageChannel    // IN_APP/EMAIL_OUT/EMAIL_IN/SYSTEM
  externalMessageId String?           // SendGrid message id (outbound) or stub id (dev)
  inboundFromEmail  String?
  inboundSubject    String?
  retentionUntil    DateTime          // = createdAt + 7 years (AFSL compliance)
}
```

**Compliance archive invariants:**
- Every message has `retentionUntil = createdAt + 7 years` per AFSL recordkeeping requirement (decision 2026-05-04).
- Soft-delete from a participant's view (`ConversationParticipant.hiddenFromUser`) does NOT remove the message row — the compliance archive persists.
- Sender role is FROZEN at send time so the audit trail stays accurate after a person leaves the org.
- Only the consumer can hide a conversation from their own view; professional-side hiding is not implemented.
- VIEWER seats are excluded from `ConversationParticipant` rows on creation — they can't take inbound, so they shouldn't appear in the participant list.

**Inbound webhook routing:** `replyToSlug` is a 32-char hex string used
in the reply-to address: `monitrax+conv-<slug>@<inbound-domain>`.
SendGrid Inbound Parse extracts the slug from the `to` header,
verifies the sender email matches a CONSUMER participant, posts the
message body as `EMAIL_IN`. Hardening (DKIM/SPF strict, signed-event
verification, sender-domain allowlist, Cloud DLP attachment scanning,
rate-limiting per conversation) defers to PROD.

## **§11.5 — Stripe billing** (Phase 32C PR6a/b)

```prisma
model StripeCustomer {
  organizationId    String  @unique
  stripeCustomerId  String  @unique  // cus_xxx from Stripe
  email             String
  isTestMode        Boolean
}

model StripeSubscription {
  organizationId         String  @unique
  customerId             String  @unique  // FK StripeCustomer
  stripeSubscriptionId   String  @unique  // sub_xxx
  status                 SubscriptionStatus  // mirrors Stripe's status enum
  planTier               BillingPlanTier     // STUDIO/PRACTICE/ENTERPRISE
  stripePriceId          String
  stripeProductId        String
  currentPeriodStart     DateTime
  currentPeriodEnd       DateTime
  cancelAtPeriodEnd      Boolean
  isTestMode             Boolean
}

model StripeWebhookEvent {
  stripeEventId   String  @unique  // evt_xxx — dedupe key
  eventType       String
  livemode        Boolean
  payload         Json
  processedAt     DateTime?
  processingError String?
  receivedAt      DateTime
}
```

**`BillingPlanTier` is a NEW enum** (STUDIO/PRACTICE/ENTERPRISE) on
the new `StripeSubscription` table — not a destructive rename of the
legacy `OrganizationPlan` enum (STARTER/PROFESSIONAL/BUSINESS/ENTERPRISE).
Reason: BUSINESS has no clean target in the 3-tier Xero-style model;
collapsing it into PRACTICE would require §12.11 user-confirmation.
The new enum on the new table sidesteps this; the existing
`lib/portal/planTier.ts` mapping shadow handles the legacy fallback.
Legacy enum rename is queued for a future PR.

**Plan-tier resolution:** `resolvePlanTierForOrg(orgId)` reads the
`StripeSubscription` row first (TRIALING/ACTIVE/PAST_DUE = entitled,
honouring Stripe's 3-day grace window), falls through to the legacy
`OrganizationPortalSettings.plan` only when no subscription exists.

**Webhook idempotency:** every event Stripe delivers is recorded in
`StripeWebhookEvent` with a unique constraint on `stripeEventId`.
Re-deliveries (Stripe retries up to 3 days) are deduped at the
database boundary. Lead-fee invoice events are routed by
`monitrax_request_id` metadata on the InvoiceItem, so subscription
invoices and lead-fee invoices don't collide in the dispatcher.

## **§11.6 — Adviser feedback inbox** (Phase 33g)

```prisma
model FeedbackThread {
  authorUserId  String      // The adviser submitting feedback
  surface       FeedbackSurfaceTag  // PORTAL_DASHBOARD/PORTAL_REQUESTS/PORTAL_BILLING/...
  surfaceRoute  String?     // pathname captured from the help drawer
  severity      FeedbackSeverity   // LOW/MEDIUM/HIGH/CRITICAL — default MEDIUM
  status        FeedbackStatus     // NEW/IN_REVIEW/RESPONDED/RESOLVED/WONT_FIX
  internalNotes String?     @db.Text  // ONLY visible to Monitrax admins
  taggedForAi   Boolean     // admin opt-in to include in AI training export
}

model FeedbackMessage {
  threadId    String
  authorRole  FeedbackAuthorRole  // ADVISER/MONITRAX_ADMIN
  body        String  @db.Text
}
```

Architectural decision documented in `lib/services/feedbackService.ts`
file-header JSDoc: keep `FeedbackThread` separate from
`ProfessionalConversation` — different participants, retention rules,
status workflow. Feedback is adviser→Monitrax; conversation is
adviser↔consumer.

`internalNotes` are NEVER returned by the adviser-facing API and
NEVER included in the Markdown export the admin downloads. The
service layer is the single boundary where this is enforced.

## **§11.7 — Architectural rules across the B2B2C surface**

Every layer enforces these rules at the **service boundary**:

1. **Leaky-funnel guardrail.** Org-attached users (any active+granted
   `OrganizationClient`) never see the public marketplace. The
   `getCandidatesForUser` AskAPro service returns only the org's
   roster; the `submitRequest` service rejects with
   `ORG_USER_PUBLIC_BLOCKED` if called by an org-attached user.

2. **`assertParticipant` is the single access-control gate** for
   conversations. Every read/write goes through it; cross-org leakage
   is structurally impossible because the API can't return a
   conversation without matching a `ConversationParticipant` row.

3. **Sender role frozen at write-time** — `ConversationMessage.senderRole`
   is recorded as it was at send time. Audit trail stays accurate
   even if a member later leaves the org.

4. **Tier rates frozen at submit-time** — `ProfessionalRequest.leadFeeAmount`
   is captured from the listing's per-tier rate at the moment of
   submission. Downstream tier-rate edits don't retroactively change
   in-flight requests.

5. **PORTAL_OWNER-only commercial actions** — submit-for-review
   (marketplace listing), subscribe / cancel / resume (billing),
   are all OWNER-only. Anti-poaching guardrail; mirrors the
   `team:invite` PORTAL_OWNER restriction from PR #603.

6. **Billing intent vs payment** — accept-time records `leadFeeChargedAt`
   as the billing intent; the actual Stripe Invoice is created in a
   best-effort post-transaction follow-up. Failure to create the
   invoice does NOT roll back the accept; ops can re-run
   `createLeadFeeInvoiceForRequest` for any request with
   `stripeInvoiceId IS NULL` after status=ACCEPTED.

7. **Webhook signature verification IS the auth** for `/api/stripe/webhooks`
   and `/api/conversations/inbound`. Neither route uses
   `withPermission`; both verify the request via signed payload at
   the route boundary. 4xx on signature mismatch (Stripe retries on
   5xx, not 4xx); 5xx on dispatch failure to trigger Stripe's retry.

8. **`isStripeConfigured()` / `SENDGRID_API_KEY` guards** allow
   dev/demo environments to run without secrets. The architectural
   pattern is visible (events are logged; messages are recorded; UI
   renders friendly notices) without requiring real keys.
=======

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
- **Slice C (PR #647 — shipped 2026-05-05):** Div 6 basic + `trustDistribution.ts` skeleton. New `lib/tax-engine/divisions/trustDistribution.ts` exporting `allocateTrustDistribution(input)`. Implements ITAA 1936 s95 (net income definition), s97 (presently-entitled beneficiary assessment), s99A (trustee penalty rate **47%** on undistributed residual when no beneficiary is presently entitled). Validates beneficiary shares (≥ 0; sum ≤ 1.0 with floating-point tolerance; throws on negative or over-distribution). Always flags `UC-S100A-RISK` (zone classifier per TR 2022/4 + PCG 2022/2 lands in 41e.5 — different rationale wording for FTE vs non-FTE trusts) and `UC-DIV-6E-STREAMING` (character allocation lands in 41e.4 — v1 distributes franking + capital gains generically pro-rata to net-income share). Flags `UC-S98-TRUSTEE-ASSESSMENT` when any beneficiary is non-resident or under legal disability. The `S99A_TRUSTEE_PENALTY_RATE` constant is exported for direct AFSL footer use. 20 unit tests covering basic distribution, s99A penalty (no/partial entitlement), validation errors (negative, over-distribution, floating-point tolerance), all UNCOMPUTED flags, citation rules (s99A only when residual > 0), edge cases.
- **Slice D-1 (PR #649 — shipped 2026-05-05):** Wire `trustDistribution` into `entityTaxRouter`. New optional `EntityTaxFacts.trustDistribution` field carrying `trustNetIncome` + `beneficiaries` + `hasFamilyTrustElection`. When provided for a DISCRETIONARY_TRUST or UNIT_TRUST entity, the router runs `allocateTrustDistribution` (slice C) and produces a real `EntityTaxPosition.result` with the per-beneficiary breakdown + s95/s97 citations + the always-on UC-S100A-RISK / UC-DIV-6E-STREAMING flags. Without distribution data, trust entities still flag UNCOMPUTED (audit §10.3 — never false numbers). New `entityHasConditionalComputedTax(type)` helper exposes the conditional capability matrix. New `POST /api/tax/entity/[entityId]` handler accepts a body with `trustDistribution` so callers can exercise the wiring via curl until a UI captures distribution data — first user-testable Div 6 surface. 6 new router tests covering: TRUST without data → UNCOMPUTED, TRUST with data → computed, UNIT_TRUST with data → pro-rata, partial entitlement → s99A penalty, COMPANY/SMSF still UNCOMPUTED, PERSONAL_NAME ignores trustDistribution.
- **Slice D-2 (PR #650 — shipped 2026-05-05):** Wire `cgtDiscount` + `capitalLossNetting` into `entityTaxRouter` for any entity with `cgtEvents`. **Closes 41e.1.** New optional `EntityTaxFacts.cgtEvents` + `carryForwardCapitalLosses` + `smsfIsComplying` + `isForeignResident` fields. New optional `EntityTaxPosition.cgtResult` — independent of `result` so a COMPANY entity (income tax UNCOMPUTED) can carry a fully-computed CGT figure with the right per-entity discount rate (0% per s115-280). For TRUST entities with BOTH `trustDistribution` AND `cgtEvents`, the router populates both `result` (Div 6 distribution) AND `cgtResult` (Div 115 net capital gain) with deduplicated cumulative citations. POST `/api/tax/entity/[entityId]` extended to accept `cgtEvents` + `carryForwardCapitalLosses` body fields. 8 new router tests covering: PERSONAL_NAME with cgtEvents → 50% discount; **COMPANY with cgtEvents → cgtResult populated even though result still null** (the audit's "never false silence" complement to "never false numbers"); SMSF with cgtEvents → 33⅓%; TRUST with both inputs → both populated independently; losses > gains → carry-forward; prior-year losses applied; no cgtEvents → cgtResult undefined; empty array → undefined.

After 41e.1, the audit's "never false numbers" principle relaxes for the v1-supported scope: TRUST entities with distribution data + ANY entity with disposal events return computed figures, paired with the boundary footer citing exactly which sections were applied. **41e.1 is COMPLETE.** **41e.2 (SMSF contribution caps)** starts next.

## **10.14 Phase 41e.2 — SMSF contribution caps (PR #651 — shipped 2026-05-05)**

Wires the existing `capTracker.trackContributionCaps` primitive into the entity router. New optional `EntityTaxFacts.smsfContributions` field carrying YTD contributions + total super balance + carry-forward unused amounts. When provided for an SMSF entity, the router runs `trackContributionCaps(input, config)` and produces an `EntityTaxPosition.result` containing the `CapTrackingResult` shape — concessional + non-concessional cap headroom, carry-forward (s291-20(3) TSB threshold) + bring-forward (s292-85(2) TSB tiers) eligibility, excess-contribution warnings.

**SMSF UNCOMPUTED flag retained:** the contribution-cap dispatch ships, but the **SMSF triumvirate** (sole purpose test s62 / in-house asset 5% cap Pt 8 SIS / LRBA per PCG 2016/5) is still flagged as `UC-SMSF-SOLE-PURPOSE` until 41e.11. The `UC-ENTITY-SMSF` placeholder flag is gone — replaced with the more specific UC-SMSF-SOLE-PURPOSE that documents exactly which compliance dispatch is still UNCOMPUTED.

**POST endpoint extended** with `smsfContributions` body field. 5 new router tests covering: SMSF without data → still UNCOMPUTED, SMSF with data → CapTrackingResult populated, cap exceeded → isExceeded + excessContributionsTax, carry-forward applied with TSB < $500k threshold, SMSF with BOTH smsfContributions AND cgtEvents → both populated.

After 41e.2: SMSF entities with contribution data return real cap-tracking figures. **41e.3 (TBC + Div 293 + Div 296 gated)** starts next.

## **10.15 Phase 41e.3 — TBC + Div 293 + Div 296 (PR #652 — shipped 2026-05-05)**

New `lib/tax-engine/super/highIncomeSuperTax.ts` exporting `calculateHighIncomeSuperTax(input, config)` — computes Division 293 (high-income concessional surcharge), Division 296 (high-balance super tax, **gated** until Royal Assent verified via config flag), and Transfer Balance Cap headroom (s294-35).

**TaxYearConfig extended** with `transferBalanceCap` ($1.9M FY24-25), `div296CommencementVerified` (false until Royal Assent), `div296TsbThreshold` ($3M proposed), `div296Rate` (15%). All three FY configs (FY23-24, FY24-25, FY25-26) populated.

**`EntityTaxFacts.highIncomeSuper`** optional input (companion to `smsfContributions`): `div293Income`, `concessionalContributions`, `totalSuperBalance`, optional `tsbEarnings`, optional `transferBalanceUsed`.

**SMSF dispatch result shape extended** — `result` is now `{ capResult, highIncomeSuperTax }` instead of bare `capResult`. Pre-existing tests updated to access `.capResult.concessional` etc.

**UNCOMPUTED flags raised:**
- **UC-DIV-296-PENDING** — when TSB exceeds the proposed threshold but the Bill is not yet enacted. The flag flips off automatically once `div296CommencementVerified` is set to `true` in the FY config — no code change needed.
- **UC-TBC-EXCESS** — when transfer balance exceeds the cap. Excess transfer tax (s294-230) computation deferred to a future sub-PR.

**9 new tests** for `calculateHighIncomeSuperTax`: Div 293 below/above threshold (with `min(excess, contributions)` cap per s293-15), Div 296 pending vs verified, TSB ≤ threshold no flag, TBC reporting + excess flag, citation completeness. **1 router-integration test** asserting SMSF + highIncomeSuper produces `result.highIncomeSuperTax.div293.applies` + TBC headroom.

## **10.16 Phase 41e.4 — Div 6E character streaming (PR #653 — shipped 2026-05-05)**

**Flips off `UC-DIV-6E-STREAMING`** when a valid streaming resolution is provided. Trust beneficiaries now have a `streaming` allocation field carrying absolute dollars of franked dividends + capital gains; trust input now has `characterPools` (the franked + CGT pools in net income) + `streamingResolutionAt` (ISO date the trustee resolution was passed).

**Validation:** `streamingResolutionAt` must fall within the FY (parsed from `financialYear` field — e.g. "2024-25" → between 1 July 2024 and 30 June 2025) per s207-58 + s115-228. Post-30-June resolution → falls back to pro-rata + `UC-DIV-6E-STREAMING-INVALID-RESOLUTION` flag.

**Citations added when streaming applies:** Div 6E + s207-58 + s115-228.

**`BeneficiaryDistribution.character`** is new — `{ frankedDividends, capitalGains, ordinaryIncome }` — sums to `amount`. Without character pools, all amount is ordinary; with pools but no streaming, character flows pro-rata; with streaming + valid resolution, character is allocated explicitly.

**Five FY-end states**:
1. No characterPools provided → all amount classified as ordinary income; UC-DIV-6E-STREAMING surfaces.
2. characterPools provided, no streaming requested → character flows pro-rata; UC-DIV-6E-STREAMING surfaces.
3. Streaming requested + valid resolution + characterPools → explicit allocation; UC-DIV-6E-STREAMING flag **gone**; citations include Div 6E + s207-58 + s115-228.
4. Streaming requested but invalid/missing resolution → fallback to pro-rata; UC-DIV-6E-STREAMING-INVALID-RESOLUTION surfaces.
5. Streaming requested but no characterPools → silently ignored (nothing to stream); UC-DIV-6E-STREAMING surfaces.

6 new tests in `trustDistribution.test.ts` covering all five states.

POST endpoint validates the streaming body shape and passes it through.

**41e.5 — s100A zone classifier per TR 2022/4 + PCG 2022/2** is next. After 41e.5 lands, the UC-S100A-RISK flag's wording will go from "review with a tax agent" to "this distribution is a green/blue/yellow/red zone risk per the classifier".

## **10.17 Phase 41e.5 — s100A reimbursement-agreement zone classifier (PR #654 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/s100aZoneClassifier.ts` exporting `classifyS100AZones(input)` — per ITAA 1936 s100A + TR 2022/4 + PCG 2022/2. Replaces the always-on `UC-S100A-RISK` flag from 41e.1 slice C with a real per-beneficiary WHITE/GREEN/BLUE/RED zone classification when input data permits.

**Decision priority (highest → lowest):**
1. **RED** — UPE + (funds used by another OR funds NOT received)
2. **RED** — funds used by another (no UPE)
3. **RED** — minor + funds NOT received
4. **WHITE** — testamentary trust (PCG 2022/2 ¶13)
5. **GREEN** — FTE + (CONTROLLER or IMMEDIATE_FAMILY) + funds received + no UPE (PCG 2022/2 ¶17-19)
6. **BLUE** — default (PCG 2022/2 ¶20-21)

**Conservative by design:** v1 confidently classifies WHITE / GREEN / RED only when input carries strong signals. Everything else falls into BLUE — review-warranted but no commissioner action expected on facts alone.

**`TrustDistributionInput.s100aFacts`** (per beneficiary): `relationshipToController`, `isMinor`, `beneficiaryReceivedFunds`, `unpaidPresentEntitlement`, `fundsUsedByOther`. **`TrustDistributionInput.isTestamentaryTrust`** for the testamentary white-zone path.

**`TrustDistributionResult.s100aClassification`** carries the full classifier result when facts are provided. The conservative blanket `UC-S100A-RISK` flag is REPLACED by `UC-S100A-NUANCED` when any classification falls into BLUE or RED.

**20 new classifier tests + 3 router-integration tests.** Zero regressions on existing 26 trustDistribution tests — the new fields are fully optional/backward-compat.

**41e.6 — Div 7A loan classifier** is next.

## **10.18 Phase 41e.6 — Division 7A loan classifier (PR #655 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/div7aLoanClassifier.ts` exporting `classifyDiv7ALoans(loans)` + `calculateMinimumYearlyRepayment(balance, years, rate)`. Compliance check on private-company → shareholder/associate loans per ITAA 1936 Div 7A.

**Status dispatch (priority highest → lowest):**
| Status | Trigger | Deemed dividend |
|---|---|---|
| **SUB_TRUST_UPE** | `isSubTrustUpe` | $0 (deferred to TR 2010/3 + PCG 2017/13 deep-case sub-PR) |
| **NO_AGREEMENT** | `!hasComplianceAgreement` | full opening balance (s109D) |
| **MRP_SHORTFALL** | payments < s109N MRP | shortfall amount |
| **COMPLIANT** | payments ≥ MRP | $0 |

**MRP formula (s109N — Schedule 4 ITAA 1936):** standard amortising-annuity:
```
MRP = B × [r × (1+r)^N] / [(1+r)^N − 1]
```
where B = opening balance, r = ATO benchmark rate (caller provides per FY), N = years remaining. Degenerate cases handled: zero balance / zero years → MRP = 0; zero rate → straight-line `B / N`.

**`EntityTaxFacts.div7aLoans`** new optional field. Wired into router COMPANY branch — when loans data is provided for a COMPANY entity, `result.div7aClassification` carries the full result. Income tax dispatch (base-rate 25%/30% + franking) STILL UNCOMPUTED — that's 41e.7 territory. **"Never false silence" pattern:** COMPANY with `div7aLoans` returns Div 7A classification + `UC-ENTITY-COMPANY` for income tax.

**UNCOMPUTED flags:**
- **UC-DIV7A-DISTRIBUTABLE-SURPLUS** — when total deemed dividend > 0. s109Y surplus cap is its own beast (net assets + paid-up capital + repayments + non-commercial loans, less prior frankable distributions).
- **UC-DIV7A-SUBTRUST-UPE** — when any loan is flagged `isSubTrustUpe`. Option 1/2/3 sub-trust regimes deferred.

**20 new tests** + **3 router-integration tests**: COMPLIANT path (payments ≥ MRP), MRP_SHORTFALL with deemed dividend = shortfall (NOT entire balance), NO_AGREEMENT with deemed = full balance, SUB_TRUST_UPE priority over NO_AGREEMENT, multi-loan aggregation (`highestSeverity` = worst), citation completeness, `calculateMinimumYearlyRepayment` boundary cases (zero balance, zero years, zero rate, higher rate → higher MRP). Router integration: COMPANY without data still UNCOMPUTED, with data → real classification + UC-ENTITY-COMPANY preserved, with both div7aLoans + cgtEvents → both populated.

**41e.7 — Div 152 small business CGT concessions** is next.

## **10.19 Phase 41e.7 — Division 152 small business CGT concessions (PR #655 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/div152SmallBusinessConcessions.ts` exporting `applyDiv152(input)`. Stacks four concessions on top of Div 115 (50% discount from 41e.1):

| Step | Concession | Authority | Effect |
|---|---|---|---|
| 1 | **15-year exemption** | s152-105 | gain entirely disregarded if asset held ≥15yr + retirement/incapacity |
| 2 | **50% active asset reduction** | s152-205 | halves remaining gain |
| 3 | **Retirement exemption** | s152-305 | up to $500k lifetime cap (s152-310) |
| 4 | **Small business rollover** | s152-410 | defer remaining gain (replacement asset) |

**Basic conditions (s152-10):** MNAV ≤ $6M (s152-15) OR aggregated turnover ≤ $2M (s152-20), AND asset is active (s152-35). Without basic conditions met → returns gain unchanged regardless of elections.

**Stacking note:** 15-year exemption is mutually exclusive with the other three (when applied, returns immediately). Other three stack in order — caller elects each via `electActiveAssetReduction` (default `true`), `electRetirementExemption`, `electRollover`.

**`Div152Result.steps`** array reports each concession applied + reduction amount + running gain — surfaces in AFSL footer for full audit trail.

**UNCOMPUTED flags:**
- **UC-DIV152-AGGREGATION** — when MNAV or turnover within ±20% of threshold; user must aggregate connected entities + affiliates per s152-15(2). v1 takes caller's figures at face value.
- **UC-DIV152-RETIREMENT-CAP** — when lifetime cap binds (less than full retirement-exemption available).
- **UC-DIV152-ROLLOVER** — replacement-asset tracking deferred (caller must acquire within 2yr or deferred gain crystallises).

24 module tests covering basic conditions, 15-year exemption, 50% reduction (default + opt-out), retirement (no cap / partial cap / cap exceeded), rollover, full-stack interaction (`$2M gain → 50% → retirement-cap → rollover residual`), citation rules, edge cases (zero gain, basic conditions fail).

Router wiring: 41e.7 module is currently NOT auto-wired into `entityTaxRouter` — Div 152 elections are taxpayer-specific (the choice between concessions is a financial-advisor decision, not an automatic dispatch). Caller invokes `applyDiv152()` directly when scenario-modelling a disposal. Future sub-PR may add a `cgtEvent.div152Election` field if user feedback warrants automatic dispatch.

**41e.8 — negative gearing per-entity aggregator** is next.

## **10.20 Phase 41e.8 — Negative gearing + per-entity loss treatment (PR #656 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/negativeGearing.ts` exporting `applyNegativeGearing(input)` + `entityCanOffsetLossesCurrentFy(type)`. Dispatches the tax treatment of net losses by entity type per ITAA 1997 Div 8 (deductibility) + Div 36 (loss offset).

**Loss treatment by entity type:**
| Entity | Treatment | Rationale |
|---|---|---|
| **PERSONAL_NAME** | Offset other income same FY | "Negative gearing" — rental loss reduces salary tax |
| **SOLE_TRADER** | Offset other income same FY | Sole trader = individual for tax |
| **PARTNERSHIP** | Offset partner income | Losses flow per s92 partnership agreement |
| **SMSF** | Offset other fund income | Fund-level offset (NALI rules in 41e.11) |
| **DISCRETIONARY_TRUST** | Trap at entity, carry forward | Cannot distribute losses; subject to Sch 2F loss tests |
| **UNIT_TRUST** | Trap at entity, carry forward | Same Sch 2F regime |
| **COMPANY** | Trap at entity, carry forward | Subject to Div 165 COT/SBT tests |

**UNCOMPUTED flags:**
- **UC-TAX-LOSS-CARRY-FORWARD** — when individual loss exceeds other income (multi-year tracking deferred — caller must persist in tax-loss register)
- **UC-TRUST-LOSS-TESTS** — TRUST loss carries forward; Sch 2F (Income Injection / Pattern of Distributions) tests deferred to 41e.15
- **UC-COMPANY-LOSS-TESTS** — COMPANY loss carries forward; Div 165 (COT) + Div 165-13 (SBT) tests deferred to 41e.15

**Result shape** — reports `netResult` + `lossTreatment` ('OFFSET_OTHER_INCOME' | 'TRAPPED_AT_ENTITY' | 'NO_LOSS') + `lossAbsorbedThisFy` + `lossCarriedForward` + `taxableIncomeAtEntity` + `reason` + citations.

**Not auto-wired into router** — same pattern as Div 152: caller invokes `applyNegativeGearing()` directly because the input shape (gross income / deductible expenses / other income at entity) is computed differently per source (property loss vs business loss vs investment loss).

23 module tests covering all 7 entity types + all 3 loss-treatment paths + loss-exceeds-income carry-forward + citation completeness.

**41e.9 — Personal Services Income (PSI) rules** is next.

## **10.21 Phase 41e.9 — Personal Services Income classifier (PR #657 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/psiClassifier.ts` exporting `classifyPsi(input)` per ITAA 1997 Part 2-42 + TR 2022/3. Determines whether a Pty Ltd / Trust earning "personal services income" qualifies as a Personal Services Business (PSB) — if it does, no income attribution; if it doesn't, full PSI is attributed to the individual at marginal rates regardless of company structure.

**Decision flow:**
1. **PSB Determination held** (s87-60) → automatic PSB
2. **Results test** (s87-18) — paid for a result + supplies plant/equipment + liable for rectification → automatic PSB
3. **80%-one-client gate** (s87-15):
   - `< 80% from one client`: ANY of unrelated-clients (s87-20) / employment (s87-25) / premises (s87-30) → PSB
   - `≥ 80% from one client`: must satisfy results test or hold determination → otherwise NOT PSB
4. **Unrelated clients test** requires ≥ 2 clients gained via DIRECT advertising (not personal contacts / labour-hire)
5. NOT PSB → full PSI attributed to individual per s86-15

**`PsiClassificationResult.tests`** reports per-test outcomes for AFSL footer rendering.

**UNCOMPUTED:** UC-PSI-DEDUCTION-RESTRICTIONS — when PSI is attributed, deductions are restricted per s86-60 (only those deductible if individual earned directly). v1 reports gross attribution; net deduction-restricted calc deferred.

**Not auto-wired into router** — same pattern as Div 152/41e.8: caller invokes `classifyPsi()` directly when the entity has personal-services income (typically COMPANY entity earning consulting fees).

18 module tests covering all 5 tests + PSB Determination short-circuit + 80% boundary cases + citation completeness.

**41e.10 — Family Trust Election + Interposed Entity Election** is next.

## **10.22 Phase 41e.10 — FTE + IEE + 47% TFN withholding (PR #658 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/fteIeeClassifier.ts` exporting `classifyFteIeeDistributions(input)` per Sch 2F ITAA 1936. Classifies each trust distribution into one of four outcomes:

| Outcome | Trigger | Effect |
|---|---|---|
| **INSIDE_FAMILY** | TEST_INDIVIDUAL / FAMILY_MEMBER / CONTROLLED_ENTITY | Normal trust assessment |
| **INSIDE_VIA_IEE** | OUTSIDE_FAMILY but covered by IEE (s272-85) | Treated as inside |
| **OUTSIDE_FAMILY_FTDT** | OUTSIDE_FAMILY beneficiary | **47% Family Trust Distribution Tax** payable by trustee (s271-15) |
| **TFN_WITHHOLDING** | Beneficiary did not quote TFN | **47% withheld** by trustee per Pt VA ITAA 1936 |

**Family group definition (s272-95):** test individual + spouse / parent / sibling / lineal descendant + their spouses + entities controlled by family (>50% ownership / distribution power).

**Constants exported:**
- `FAMILY_TRUST_DISTRIBUTION_TAX_RATE = 0.47` (s271-15; indexed to top marginal + Medicare)
- `TFN_WITHHOLDING_RATE = 0.47` (Pt VA)

**Result reports:** per-beneficiary `outcome` + `grossDistribution` + `ftdtPayableByTrustee` + `tfnWithholdingDeducted` + `netToBeneficiary`. Aggregates `totalFtdtPayable` + `totalTfnWithholding`.

**UNCOMPUTED flags:**
- **UC-FTDT-OUTSIDE-FAMILY** when FTDT applies — surfaces the trustee's 47% tax exposure
- **UC-FTE-CONTROL-TEST** when CONTROLLED_ENTITY relationship claimed — control test is fact-dependent, v1 trusts caller

**Priority:** TFN withholding takes priority over OUTSIDE_FAMILY (a non-quoting beneficiary outside family has 47% withheld; no FTDT layered on top because beneficiary already receives net 53%).

17 module tests covering all 4 outcomes + IEE override + custom FTDT rate + multi-beneficiary aggregation + no-FTE fallback + citation completeness + edge cases.

**41e.11 — SMSF triumvirate (sole purpose / in-house asset / LRBA)** is next.

## **10.23 Phase 41e.11 — SMSF triumvirate compliance classifier (PR #659 — shipped 2026-05-05)**

New `lib/tax-engine/divisions/smsfTriumvirateClassifier.ts` — the hardest of the 41e sub-PRs. Three intertwined SMSF compliance regimes plus NALI in one classifier:

| Regime | Authority | Effect of breach |
|---|---|---|
| **Sole purpose test** | SIS Act s62 | Fund non-complying → 45% rate on all income (s295-160) |
| **In-house asset 5% cap** | SIS Act Pt 8 | Trustee must prepare written disposal plan; BRP exception per s71(1)(b) |
| **LRBA compliance** | SIS Act s67A + PCG 2016/5 | Per-loan: BREACH_MULTI_ASSET / BREACH_BARE_TRUST / BREACH_RECOURSE / NALI_RISK |
| **NALI** | ITAA 1997 s295-550 | 45% on the whole non-arm's-length income amount |

**Constants exported:** `NON_COMPLYING_SMSF_RATE = 0.45`, `NALI_RATE = 0.45`, `IN_HOUSE_ASSET_CAP = 0.05`.

**Result reports** per-regime status: `solePurpose` (PASS/FAIL), `inHouseAsset` (status + value + cap + breach amount + percentage), `lrba` (overall status + per-loan breakdown), `naliTax` (dollar amount), `applicableIncomeRate` (15% complying or 45% non-complying), `anyBreach` headline boolean.

**4 UNCOMPUTED flags:**
- **UC-SMSF-NON-COMPLYING** when sole purpose fails
- **UC-SMSF-IN-HOUSE-BREACH** when 5% cap exceeded
- **UC-SMSF-LRBA-BREACH** when structural LRBA requirements fail
- **UC-SMSF-NALI** when NALI applies

**24 module tests** covering all 4 regimes + BRP exception + per-loan LRBA paths + NALI triggers + worst-case combination (all 4 flags surface) + edge cases.

**41e.12 — State land tax (NSW + VIC)** is next.

## **10.24 Phase 41e.12 — State land tax (NSW + VIC) (PR — shipped 2026-05-05)**

New module `lib/tax-engine/landTax/stateLandTax.ts` + new directory `lib/tax-engine/landTax/`. First of the per-state regimes — NSW + VIC ship now (largest states by taxable land value); QLD/SA/WA/TAS/ACT/NT + cross-state aggregator land in 41e.13.

**Per-state config pattern locked in:**

```ts
export interface LandTaxConfig {
  state: AustralianState;
  label: string;                       // e.g. "NSW CY2025"
  generalThreshold: number;
  brackets: LandTaxBracket[];          // progressive
  trustSurchargeRate: number;
  foreignOwnerSurchargeRate: number;
  citations: AuthorityCitation[];
}
```

**Configs shipped:**

| Config | Threshold | Top bracket | Trust surcharge | Foreign surcharge |
|---|---|---|---|---|
| `NSW_LAND_TAX_CY2025` | $1,075,000 | $88,036 + 2% over $6,571,000 | 1.5% × first $1.075M (special trust s5A) | 4% on residential (Sch 1A) |
| `VIC_LAND_TAX_FY2024_25` | $50,000 | $46,950 + 2.65% over $3M | 0.5% × value (s46IB) | 4% on all taxable land — absentee (s46IC) |

**Authority:**
- NSW Land Tax Act 1956 — s10 (taxable value), s27 (general rates), s5A (special trust), Sch 1A (foreign surcharge)
- VIC Land Tax Act 2005 — Schedule 1 (general rates), s46IB (trust), s46IC (absentee)

**Order of operations** (`calculateLandTax(input, config)`):
1. **General progressive brackets** — value ≥ threshold runs through the per-state ladder; below threshold = $0 general tax.
2. **Trust surcharge** — applied if `ownershipType ∈ {DISCRETIONARY_TRUST, UNIT_TRUST_NON_FIXED}`. NOT applied for `UNIT_TRUST_FIXED`.
3. **Foreign / absentee surcharge** — applied if `isForeignOwner`. NSW limited to residential; VIC covers all taxable land.

**Helpers:** `getLandTaxConfig(state)` (throws for unsupported), `getSupportedStates()` (returns `['NSW', 'VIC']` in v1).

**3 UNCOMPUTED flags** (every result):
- **UC-MULTI-STATE-LAND-TAX** — single-state assessment only; cross-state aggregation rules (NSW grouping Pt 4, VIC trustee aggregation Pt 3 Div 4) ship in 41e.13.
- **UC-LAND-TAX-PPOR-EXEMPTION** — caller's responsibility (pass `taxableLandValue: 0` if PPOR exempt). Partial exemption (PPOR-converted-to-rental within FY) NOT computed.
- **UC-LAND-TAX-TRUST-SURCHARGE-NUANCE** — v1 simplifies trust surcharge to a flat % over taxable value; real-world calc uses progressive trust-specific scales.

**33 module tests:**
- NSW general (6 cases — 0/below threshold/at threshold/$1.5M/$2M/top bracket)
- VIC general (4 cases — below $50k/at $100k/$600k/top bracket)
- Trust surcharge (7 cases — NSW @ $500k, NSW @ $2M cap, VIC @ $500k, UNIT_TRUST_NON_FIXED, UNIT_TRUST_FIXED no surcharge, INDIVIDUAL no surcharge, UNCOMPUTED flag emitted)
- Foreign surcharge (5 cases — NSW residential, NSW non-residential excluded, VIC residential, VIC non-residential included, AU resident excluded)
- Combined (NSW foreign discretionary trust @ $1.5M residential = $6,900 + $16,125 + $60,000 = $83,025)
- UNCOMPUTED flag presence + skip-when-PPOR (3 cases)
- Citations (NSW + VIC) (2 cases)
- `getLandTaxConfig` + `getSupportedStates` (4 cases)

**41e.13 — Rest-of-states (QLD/SA/WA/TAS/ACT/NT) + cross-state aggregator** is next.

## **10.25 Phase 41e.13 — State land tax rest-of-states + cross-state aggregator (PR — shipped 2026-05-05)**

Extends `lib/tax-engine/landTax/stateLandTax.ts` with **6 more state configs** (`QLD_LAND_TAX_CY2025`, `SA_LAND_TAX_FY2024_25`, `WA_LAND_TAX_FY2024_25`, `TAS_LAND_TAX_FY2024_25`, `ACT_LAND_TAX_FY2024_25`, `NT_LAND_TAX_FY2024_25`) and adds new module `lib/tax-engine/landTax/crossStateAggregator.ts` for multi-state owner aggregation.

**All 8 states/territories now supported.** `getSupportedStates()` returns `['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']`.

**State-by-state matrix:**

| State | Threshold | Trust surcharge | Foreign surcharge | Notes |
|---|---|---|---|---|
| NSW | $1,075,000 | 1.5% × first $1.075M (s5A) | 4% residential (Sch 1A) | shipped 41e.12 |
| VIC | $50,000 | 0.5% × value (s46IB) | 4% all land (s46IC absentee) | shipped 41e.12 |
| QLD | $600,000 | 1.75% v1 simplification | 2% all land (Sch 3 absentee) | new |
| SA | $755,000 | 0.5% (s13) | **none** (stamp-duty-only state) | new |
| WA | $300,000 | **none** (standard scale) | **none** (stamp-duty-only state) | new |
| TAS | $100,000 | none | 2% residential (since 2022) | new |
| ACT | $0 | none | 0.75% residential | structural mismatch flagged |
| NT | $∞ (no regime) | n/a | n/a | structural zero |

**Config interface extended** with `foreignSurchargeResidentialOnly?: boolean` so the foreign-surcharge dispatch is data-driven (NSW/TAS/ACT = `true`; VIC/QLD = `false`; SA/WA = surcharge rate is 0).

**Two new UNCOMPUTED flags:**
- **UC-ACT-RATES-VS-LAND-TAX** — ACT does not run a "land tax" in the same shape as NSW/VIC. Rates Act 2004 charges (a) annual general rates on every parcel + (b) residential land tax on non-owner-occupied properties only. v1 applies a flat-bracketed approximation; consult ACT Revenue Office for exact figure.
- **UC-NT-NO-LAND-TAX** — NT does not levy land tax. Config returns $0 for structural completeness so the aggregator can iterate uniformly.

**Cross-state aggregator** — `calculateCrossStateLandTax({ properties, ownershipType, isForeignOwner })`:

1. Groups properties by state; sums `taxableLandValue` per state (within-state aggregation = same owner's parcels in one state assessed against that state's progressive scale).
2. Calls `calculateLandTax` for each state's aggregated value with shared owner-level facts.
3. Returns `perStateAssessments[]` (sorted alphabetically by state for stable rendering) + `grandTotalGeneralTax` + `grandTotalTrustSurcharge` + `grandTotalForeignSurcharge` + `grandTotalTax` + de-duped citations + de-duped UNCOMPUTED flags.

**Aggregator-specific UC flag:**
- **UC-LAND-TAX-JOINT-OWNERSHIP** — joint ownership apportionment (multiple owners per parcel) and inter-trust grouping rules (NSW Pt 4 grouping, QLD Pt 5 related-corp) NOT computed in v1. Aggregator assumes a single owner across all `properties`.

**32 new tests** covering all 6 new state configs (per-bracket + foreign + trust where applicable) + cross-state aggregator (single-state, within-state aggregation, across-state independence, alphabetical ordering, NT structural zero, foreign-owner mix, citation/UC de-dup, empty input). **Existing test "throws for unsupported states"** removed (no longer applicable post-41e.13).

**Total tax-engine tests:** 342 → 374 (+32). tsc clean.

**41e.14 — Stamp duty + foreign purchaser surcharge** is next.

## **10.26 Phase 41e.14 — Stamp duty + foreign purchaser surcharge (PR — shipped 2026-05-05)**

New module `lib/tax-engine/stampDuty/stateStampDuty.ts` + new directory `lib/tax-engine/stampDuty/`. Stamp duty is a **point-of-sale** state tax (different cadence from annual land tax in 41e.12-13). Same per-state config pattern as land tax.

**8 state configs** — `NSW_STAMP_DUTY_FY2024_25` (Sch 1 brackets to 7% premium + FPAD 8% per Ch 2 Pt 4 Div 4) + `VIC_STAMP_DUTY_FY2024_25` (brackets to 6.5% + FPAD 8% per Pt 5, raised from 7% in 2024) + `QLD_STAMP_DUTY_FY2024_25` (brackets to 5.75% + AFAD 8% per Ch 4) + `SA_STAMP_DUTY_FY2024_25` (brackets to 5.5% + foreign 7%) + `WA_STAMP_DUTY_FY2024_25` (brackets to 5.15% + foreign 7%) + `TAS_STAMP_DUTY_FY2024_25` (brackets to 4.5% + FBI 8% per Ch 4 Pt 6, raised 2024) + `ACT_STAMP_DUTY_FY2024_25` (brackets + foreign 0.75% per Pt 5A — lowest in AU) + `NT_STAMP_DUTY_FY2024_25` (brackets only — **no FPAD regime**, only AU jurisdiction without).

**4 UNCOMPUTED flags:**
- **UC-STAMP-DUTY-NT-NO-FPAD** — NT-only when foreign purchaser
- **UC-STAMP-DUTY-CONCESSION** — caller-asserted FHB / off-the-plan / PPR
- **UC-STAMP-DUTY-MULTI-PURCHASER** — foreign-share apportionment per NSW s104X / VIC s28A NOT computed
- **UC-STAMP-DUTY-NEW-BUILD** — off-the-plan / vacant-land state-specific concessions deferred

19 module tests; tsc clean.

## **10.27 Phase 41e.15 — Trust + company loss rules (PR — shipped 2026-05-05)**

Two new modules under `lib/tax-engine/divisions/`.

**Trust loss rules** (`trustLossRules.ts`) — per Sch 2F ITAA 1936:

| Trust type | Tests required |
|---|---|
| FAMILY_TRUST_FTE | Income Injection Test (Div 270) only |
| FIXED_TRUST | 50% Stake (s269-50) + Same Business (s269-100) + IIT (Div 266) |
| NON_FIXED_TRUST | 50% Stake + Pattern of Distributions (s267-30) + Control (s269-95) + IIT (Div 267) |
| EXCEPTED_TRUST | None — losses flow freely (Div 268) |

Outcomes: `LOSSES_DEDUCTIBLE` / `LOSSES_DENIED` / `INCONCLUSIVE`. UC-TRUST-LOSS-DENIED + UC-TRUST-LOSS-INCONCLUSIVE.

**Company loss rules** (`companyLossRules.ts`) — per Div 165 ITAA 1997:

- **COT** (s165-12) primary test
- **BCT** fallback when COT fails: SBT (s165-210) or Similar Business Test (s165-211 — broader, added 2019)
- Outcomes: `LOSSES_DEDUCTIBLE_VIA_COT` / `LOSSES_DEDUCTIBLE_VIA_BCT` / `LOSSES_DENIED` / `INCONCLUSIVE`
- 4 UNCOMPUTED flags: UC-COMPANY-LOSS-COT-NOT-ASSERTED / UC-COMPANY-LOSS-BCT-FACTUAL / UC-COMPANY-LOSS-DENIED / UC-COMPANY-LOSS-BCT-NOT-ASSERTED

**v1 design:** factual tests (multi-year history) take caller-asserted PASS/FAIL/NOT_ASSERTED rather than computing from share register or business activity records.

17 module tests; tsc clean.

## **10.28 Phase 41e.16 — GST / BAS calculator (PR — shipped 2026-05-05)**

New module `lib/tax-engine/gst/gstCalculator.ts` + new directory. Per *A New Tax System (GST) Act 1999*.

**Constants:** `GST_RATE = 0.1` (s9-70), `GST_REGISTRATION_THRESHOLD = 75_000` (s23-15).

**4 supply classifications:** TAXABLE (10% GST applies) / GST_FREE (s38 — basic food, health, education, exports — no GST charged but ITC available) / INPUT_TAXED (s40 — residential rent, financial supplies — no GST + no ITC) / OUT_OF_SCOPE.

**Reverse charge** (Div 84) — recipient self-assesses GST + claims offsetting ITC.

**BAS labels aggregated:** G1 (sales incl GST) / G2 (export GST-free) / G3 (other GST-free) / G10 (capital purchases incl GST) / G11 (non-capital incl GST) / 1A (output GST = `gstCollected`) / 1B (input tax credits = `gstCreditsClaimable`). Net GST = 1A − 1B.

**3 UNCOMPUTED flags:**
- **UC-GST-INPUT-TAXED-DENIAL** — per-acquisition when no ITC available
- **UC-GST-REGISTRATION-REQUIRED** — turnover ≥ $75k + unregistered
- **UC-GST-ADVANCED-DIVISIONS** — always: Div 48 grouping, Div 162 instalments, Div 75 margin scheme, s38-325 going-concern, Div 142 excess GST out of v1 scope

18 module tests; **428 total tax-engine tests**; tsc clean.

**41e.17 — MasterTaxPosition orchestrator** is next (closes Phase 41e).

## **10.29 Phase 41e.17 — MasterTaxPosition orchestrator (PR — shipped 2026-05-05)**

**Closes Phase 41e.** New module `lib/tax-engine/orchestrator/masterTaxPosition.ts` + new directory. The canonical replacement for `buildTaxSummary()` (the old single-entity adapter) for callers that need a household-wide view across multiple entities + cross-cutting state taxes + GST + per-entity loss-rule overlays.

**Pipeline (deterministic, pure):**

1. **Per-entity dispatch** — calls `calculateEntityTaxPosition()` from the existing entity router. The router already wires Phase 41e.0/1/2/3/4/5/6/8/11 (CGT discount, capital loss netting, trust distribution, SMSF caps + Div 293, Div 6E streaming, s100A facts, Div 7A loans, negative gearing, SMSF triumvirate). Per-entity income tax + CGT come back from this call.
2. **Cross-cutting modules** — land tax (cross-state aggregator from 41e.13), stamp duty (per-transaction from 41e.14), GST (BAS calc from 41e.16). Each invoked once per `buildMasterTaxPosition()` call.
3. **Per-entity advanced overlays** — trust loss rules (41e.15) + company loss rules (41e.15) keyed by `entityId`. Decorate the matching entity's citations + UNCOMPUTED flags; do NOT modify the entity's `result` number in v1 (rules can deny loss deductions, but v1 surfaces the rule outcome rather than re-computing — v2 decision).
4. **Citation + UNCOMPUTED aggregation** — de-duped across every module that ran via `${kind}|${reference}` key.
5. **Boundary footer envelope** — calls `renderBoundaryFootnote()` from `lib/tax-engine/boundaries/`. Output's `boundary` field is ready for UI render via `BoundaryFootnote.tsx`.

**New types:**

```ts
export interface MasterTaxPositionInput {
  userId: string;
  fy: FYReference;
  entities: EntityTaxFacts[];
  landTax?: CrossStateLandTaxInput;
  stampDutyTransactions?: StampDutyTransaction[];
  gst?: GstInput;
  trustLossByEntity?: Record<string, TrustLossInput>;
  companyLossByEntity?: Record<string, CompanyLossInput>;
}

export interface MasterTaxPositionV2 extends MasterTaxPosition {
  crossCutting?: CrossCuttingTaxResult;
  boundary: BoundaryFootnote;
  modulesInvoked: string[];
}
```

`MasterTaxPositionV2` extends the existing `MasterTaxPosition` interface (in `types.ts`) with the new 41e.17 fields. The base shape is unchanged so existing callers that consume `MasterTaxPosition` continue to compile.

**`crossCutting` block** populated only when at least one cross-cutting module ran:

```ts
export interface CrossCuttingTaxResult {
  landTax?: CrossStateLandTaxResult;
  stampDuty?: { perTransaction: Array<{ transactionId, state, result }>; total: number };
  gst?: GstResult;
  trustLossByEntity?: Record<string, TrustLossResult>;
  companyLossByEntity?: Record<string, CompanyLossResult>;
}
```

**Determinism:** pure function. Same inputs → same output. No DB calls. No side effects. Citation + UNCOMPUTED ordering is stable (insertion order via `Set` de-dup).

**21 module tests** covering: single entity / multi-entity household aggregation / cross-cutting land tax (skip when empty / run when properties present) / cross-cutting stamp duty (skip / run, totals) / cross-cutting GST (skip / run) / per-entity trust + company loss overlays (each + both) / full household integration (every module at once → modulesInvoked complete; citations + UNCOMPUTED aggregated) / edge cases (zero entities, no cross-cutting → undefined block).

**Total tax-engine tests:** 428 → 449 (+21). tsc clean.

**Phase 41e is COMPLETE.** Next phase: 41h (the AI advisor pitch using these calcs as the regulatory engine).

## **10.30 Phase 41h.0 — AI Tax Advisor tool registry foundation (PR — shipped 2026-05-05)**

First sub-PR of Phase 41h. Establishes the structural contract for the AI advisor — the surface that lets users ask the Gemini-powered AI questions about their tax position. Reza brief 2026-05-05 locks in two **hard rules** that join D-1 (full demo scope) and D-2 (structural AFSL boundary) as Phase 41 invariants:

| Rule | What it forbids the AI to do | How it's enforced |
|---|---|---|
| **HR-1** — Numbers come from the app, never the AI | Estimating, rounding, projecting, or fabricating any monetary figure, percentage, ratio, or threshold. | (a) AI can only emit numbers from a tool result's `numericFields[]`. (b) Registry has no `estimate*` / `guess*` primitive. (c) Validator (41h.1) rejects any AI output number that doesn't match a tool-result value. |
| **HR-2** — Claims come from AU law, never AI memory | Citing a section / ruling / threshold from training-data recall ("ITAA usually says…"). | (a) Tool results carry `IdentifiedCitation[]` lifted from Phase 41e calc engines. (b) Registry has no `lookupRule` / `searchTaxLaw` primitive that hits the open web or model memory. (c) Validator (41h.1) rejects fabricated citations. |

**Three structural enforcement layers:**

1. **Tool layer** (this PR — `lib/ai/tax-advisor/`). Finite, code-reviewed registry. The registry's `ToolKind` discriminant is a closed set of `'FACT_LOOKUP' | 'SCENARIO_RUN'` — there is **no `RECOMMENDATION` kind**, so a recommendation tool literally cannot be added without changing the type system. Reviewers MUST reject any PR that adds a kind here.
2. **Schema layer** (Phase 41h.1 — next PR). AI response objects are typed: every numeric field references a `numericFields[].path`; every citation field references a `citations[].id`.
3. **Validator layer** (Phase 41h.1). Post-processor rejects responses whose numbers / citations don't resolve back to the `ToolSession`.

**Module shape:**

```
lib/ai/tax-advisor/
├── types.ts            # ToolKind, NumericField, IdentifiedCitation, ToolResult,
│                       # TaxAdvisorTool, ToolSession + session-lookup helpers
├── registry.ts         # Singleton registry + assertToolKind guard
├── index.ts            # Bootstrap (auto-registers canonical tools on import)
└── tools/
    ├── getContributionCapHeadroom.ts  # wraps capTracker (s291-20 + s292-85)
    ├── getLandTaxPosition.ts          # wraps crossStateAggregator (8-state Land Tax Acts)
    └── getEntityTaxPosition.ts        # wraps entityTaxRouter (full Phase 41e dispatch)
```

**3 canonical tools shipped (all `FACT_LOOKUP` kind):**

| Tool | Wraps | Citations surfaced |
|---|---|---|
| `getContributionCapHeadroom` | `capTracker.trackContributionCaps` | s291-20, s291-20(3), s292-85, s292-85(2) |
| `getLandTaxPosition` | `landTax.calculateCrossStateLandTax` | All 8 states' Land Tax Acts (NSW 1956 / VIC 2005 / QLD 2010 / SA 1936 / WA 2002 / TAS 2000 / ACT Rates Act 2004) |
| `getEntityTaxPosition` | `entity.calculateEntityTaxPosition` | ITAA 1997 s4-10 / Div 1-6 / Div 115 / Div 6 + Div 6E (varies by entity type) |

Every tool result is a `ToolResult` carrying `numericFields[]` (path-addressed numbers the AI may emit), `citations[]` (id-addressed authority entries the AI may reference), `uncomputed[]` (deferred-rule flags surfaced verbatim from the calc engine), and a `narrativeText` paraphrase hint that embeds `[cit:cit-N]` reference tokens — never raw legal claims.

**Session-lookup helpers** (`findNumericFieldInSession`, `findCitationInSession`, `collectSessionCitations`, `collectSessionUncomputed`) — used by the upcoming validator (41h.1) to resolve every number / citation referenced in the AI's response back to a tool result that actually produced it.

**23 tests** covering: registry bootstrap (3 tools, alphabetical, duplicate-throws), HR-1/HR-2/D-2 structural enforcement (no RECOMMENDATION kind, every numeric field has a stable path, every `citationIds` entry resolves to an actual citation, every citation has `kind`/`reference`/`lastReviewed`/`id`), per-tool fact correctness (FY24-25 cap = $30k; cross-state aggregation; entity router PERSONAL_NAME path), session-lookup helpers (resolve real paths, return undefined for fabricated paths/ids — the structural defence against HR-1/HR-2 violations), and tool-description / tool-name banned-word checks (no `recommend` / `estimate` / `guess` / `suggest`).

**Total tests:** 449 → 472 (+23). tsc clean.

**Phase 41h.1 — AI Policy Gateway** is next.

## **10.31 Phase 41h.1 — AI Policy Gateway (PR — shipped 2026-05-06)**

The **single entry point** every Gemini (or future Claude / OpenAI) call in the app must go through. Per Reza brief 2026-05-06, the gateway makes the AI **Monitrax-centric** — generic LLM smarts for paraphrasing / education / structure, but bound by Monitrax's rules for numbers and citations.

**No code outside `lib/ai/tax-advisor/` may call a provider SDK directly.** Reviewers reject any PR that does. The gateway is the choke point that guarantees HR-1 / HR-2 / D-2 enforcement at runtime, complementing the type-system enforcement from 41h.0.

### Architecture (industry-standard layered pattern)

```
lib/ai/tax-advisor/
├── gateway.ts                  # createTaxAdvisorGateway() — public surface
├── policy/
│   ├── systemPrompt.ts         # Monitrax persona + tool catalogue + HR-1/HR-2/D-2 in prose
│   ├── responseSchema.ts       # Zod schema for AI responses (4 segment types)
│   └── validators.ts           # HR-1/HR-2/D-2 runtime post-processor
├── providers/
│   ├── types.ts                # AIProvider interface + ProviderError
│   └── mockProvider.ts         # Deterministic provider for tests + dev
├── audit/
│   └── auditLogger.ts          # AuditEntry + AuditSink (CDR-safe, no raw question/response)
├── tools/                      # (existing — 3 canonical FACT_LOOKUP tools)
├── registry.ts                 # (existing — closed-set ToolKind discriminant)
├── types.ts                    # (existing — NumericField / IdentifiedCitation / ToolSession)
└── index.ts                    # bootstrap + public re-exports
```

### Pipeline (per call)

1. Generate trace ID + start clock
2. Build the Monitrax system prompt (persona + tool catalogue derived from the registry)
3. Construct an empty `ToolSession`
4. Invoke the provider with an `executeTool` callback that records every tool call into the session
5. Provider returns raw structured output
6. **Zod-validate** the response shape (`responseSchema.ts`) — catches malformed responses
7. **HR-1/HR-2/D-2 validate** against the session (`validators.ts`) — catches fabrications
8. Assemble citations + UNCOMPUTED + AFSL boundary footer via `renderBoundaryFootnote`
9. Audit-log the outcome via the injected `AuditSink`
10. Return a typed `GatewayResponse` with `status: 'OK' | 'BLOCKED_VALIDATION' | 'BLOCKED_RECOMMENDATION' | 'PROVIDER_ERROR' | 'SCHEMA_INVALID'`

**Failure modes:** the gateway never throws. Every failure produces a structured response with the appropriate `status`. Callers render based on status (e.g. `BLOCKED_RECOMMENDATION` → automatic Tier 2 routing surface).

### Response schema (Zod)

The AI returns a JSON object with 4 segment types — every number, every citation, every UNCOMPUTED reference points back to a tool result:

| Segment | Purpose | What the validator checks |
|---|---|---|
| `TEXT` | Plain-English paraphrase / context (general knowledge OK here, **except** bare financial numbers and recommendation language) | Bare `$N`/`N%` → HR-1 leak. "you should", "I recommend" → D-2 leak in TIER_1. |
| `NUMBER_REF` | A number from a tool result, ref `<toolName>#<path>` | Path must resolve in `ToolSession` (`findNumericFieldInSession`) |
| `CITATION_REF` | A citation from a tool result, ref `<toolName>#cit-<id>` | Composite id must resolve (`findCitationInSession`) |
| `UNCOMPUTED_NOTE` | A deferred-rule flag, `flagId` from a tool result | Flag id must exist in any session invocation's `uncomputed[]` |

Plus a `tier` field — `TIER_1_FACTS` (AI surfaces facts) or `TIER_2_ROUTE_TO_PRO` (AI defers to Ask-a-Pro per D-2). Tier 2 requires `askAProRouting: { profession, reason }`.

### Three structural enforcement layers (now complete)

| Layer | Where | What it does |
|---|---|---|
| **Tool layer** (41h.0) | `registry.ts` + `types.ts` | Closed-set `ToolKind` discriminant. No `RECOMMENDATION` kind exists at the type level. |
| **Schema layer** (this PR) | `responseSchema.ts` (Zod) | Runtime shape validation. Every numeric/citation/UC reference must use the typed segment, not free text. |
| **Validator layer** (this PR) | `validators.ts` | Runtime resolution against the `ToolSession`. Fabricated paths/ids/flags rejected before reaching the user. |

### Provider abstraction

Industry-standard pattern: gateway calls `AIProvider.invoke(request)`, not a specific SDK. Swapping Gemini → Claude → OpenAI is a one-file change in 41h.2 (the upcoming Gemini adapter). 41h.1 ships a `MockProvider` for tests + dev.

```ts
interface AIProvider {
  name: string;
  invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse>;
}
```

### Audit logger (CDR-safe)

Per CLAUDE.md §13.3, financial data MUST be sanitised from log metadata. The audit entry carries: `traceId` / `userId` / `provider` / `toolsInvoked` / `outcome` / `validationIssueCodes` / `durationMs` / `tokenUsage` — but NOT the user's raw question or the AI's response text (either could echo CDR data). For full-payload reproduction, the trace ID retrieves from the production-store-of-record (sealed, access-logged).

`InMemoryAuditSink` for tests; `ConsoleAuditSink` for dev; Cloud Logging wire-up lands in 41h.2.

### Public surface

```ts
import { createTaxAdvisorGateway, MockProvider, InMemoryAuditSink } from '@/lib/ai/tax-advisor';

const gateway = createTaxAdvisorGateway({
  provider: new MockProvider(), // or GeminiProvider in 41h.2
  auditSink: new InMemoryAuditSink(),
});

const response = await gateway.ask({
  userId: 'user-1',
  question: "What's my super contribution cap headroom?",
  fyLabel: 'FY24-25',
});

// response.status, .answer, .citations, .uncomputed, .boundary,
// .durationMs, .tokenUsage, .validationIssues (if blocked)
```

### Tests (33 new)

| Section | Coverage |
|---|---|
| Zod schema | 6 cases (well-formed Tier 1 / Tier 2; rejects malformed NUMBER_REF / CITATION_REF / empty segments / unknown tier) |
| HR-1 validator | 6 cases (resolves real path; rejects unknown tool; rejects fabricated path; rejects bare `$30,000` in TEXT; rejects bare `50%` in TEXT; passes TEXT with no numbers) |
| HR-2 validator | 3 cases (resolves real cit; rejects fabricated cit-id; rejects cit for un-invoked tool) |
| D-2 validator | 3 cases (rejects "you should" in Tier 1; rejects "I recommend"; allows same language in Tier 2 routing) |
| UC + Tier 2 routing | 2 cases (rejects fabricated UC flag; rejects Tier 2 missing routing) |
| System prompt | 3 cases (embeds HR-1/HR-2/D-2; lists every tool; explicitly forbids recommending) |
| Gateway end-to-end | 8 cases (OK; fabricated number BLOCKED; fabricated citation BLOCKED; recommendation BLOCKED; valid Tier 2 OK; SCHEMA_INVALID; PROVIDER_ERROR; unregistered-tool ProviderError) |
| Audit logger | 2 cases (records all metadata fields; CDR-safe — no raw question/response leaks) |

**Total tests:** 472 → 505 (+33). tsc clean.

**Phase 41h.2 — Gemini provider adapter** is next (lives behind the gateway; just translates gateway → Gemini API).

## **10.32 Phase 41h.2 — Gemini provider adapter + production audit sink (PR — shipped 2026-05-06)**

Implements `AIProvider` for Google's Gemini API. **No code outside `lib/ai/tax-advisor/providers/` should import the Gemini SDK directly** — reviewers reject any PR that does. The gateway now has a real production-ready provider plus an in-memory mock for tests.

### Architecture

```
lib/ai/tax-advisor/providers/
├── types.ts                # (existing) AIProvider interface + ProviderError
├── mockProvider.ts         # (existing) Deterministic provider for tests
└── geminiProvider.ts       # NEW — real Gemini SDK adapter

lib/ai/tax-advisor/audit/
├── auditLogger.ts          # (existing) AuditEntry + AuditSink + InMemorySink + ConsoleSink
└── productionAuditSink.ts  # NEW — wires gateway audit into existing AuditLog pipeline
```

### `GeminiProvider` — what it does

1. **Tool schema conversion** — `toolToFunctionDeclaration()` converts each `TaxAdvisorTool` to a Gemini `FunctionDeclaration` (Gemini's schema dialect is a subset of OpenAPI; our `ToolInputSchema` maps cleanly).
2. **Chat session with system prompt** — `model.startChat()` with `systemInstruction` set to the Monitrax persona (from `buildSystemPrompt`); `tools: [{ functionDeclarations }]`; `responseMimeType: 'application/json'`.
3. **Multi-turn dispatch loop** — capped at `MAX_TURNS = 8` to prevent runaway loops:
   - Send message → read response
   - If `response.functionCalls()` non-empty → execute each via `request.executeTool()` (the gateway-supplied callback that records into `ToolSession`); send back as `functionResponse` parts; continue
   - Otherwise → expect final JSON text → parse → return
4. **Token usage aggregation** across all turns (`usageMetadata.promptTokenCount` + `candidatesTokenCount` + `totalTokenCount`).
5. **Timeout guard** — defaults to 30s per turn; throws `ProviderError` with provider-specific cause.
6. **Structured output** — relies on Gemini's `responseMimeType: 'application/json'` mode + post-parse Zod validation in the gateway. We don't pass a `responseSchema` to Gemini because Zod's `discriminatedUnion` doesn't translate cleanly to Gemini's schema dialect.

### `ProductionAuditSink` — what it does

Wires `AuditEntry` from the gateway into Monitrax's existing audit pipeline (`lib/security/auditLog.ts` → Prisma `AuditLog` table, action `AI_ADVISOR_INVOCATION`).

**Outcome → status mapping:**
- `OK` → `SUCCESS`
- `BLOCKED_VALIDATION` / `BLOCKED_RECOMMENDATION` → `BLOCKED`
- `PROVIDER_ERROR` / `SCHEMA_INVALID` → `FAILURE`

**CDR-safe metadata (CLAUDE.md §13.3):** only structural fields persisted — `traceId`, `provider`, `toolsInvoked`, `outcome`, `validationIssueCodes`, `durationMs`, `tokenUsage`. Raw question + AI response text never reach this sink (gateway never passes them in).

**Fire-and-forget** per CLAUDE.md §12.10 — DB write failure logs to `console.error` and the trace ID lets us reconstruct from Cloud Logging; never blocks the response.

### Constructor pattern

```ts
// Production:
const provider = new GeminiProvider();  // reads GEMINI_API_KEY from env

// Test:
const provider = new GeminiProvider({ client: mockClient });  // injected SDK
```

The dependency-injection pattern lets every test run deterministically without network calls.

### Tests (8 new)

- Tool schema conversion (1 case)
- Constructor (2 cases — throws without API key; accepts injected client)
- Single-turn invoke (2 cases — JSON response parsed correctly with token usage; non-JSON throws ProviderError)
- Multi-turn function calling (3 cases — function call dispatched via callback then continues; token usage aggregated across turns; MAX_TURNS guard throws)

**Total tests:** 505 → 513 (+8). tsc clean.

### Three Phase 41 invariants now active

| Rule | Where | What it forbids |
|---|---|---|
| **HR-1** | 41h.0 type system + 41h.1 validator | AI authoring numbers |
| **HR-2** | 41h.0 type system + 41h.1 validator | AI fabricating citations |
| **HR-3** *(locked in this PR)* | Phase 41 §1 invariant 11 + Phase 41i (next) | User-visible calc errors |

**Phase 41i — Calculation Audit System** is next. Cross-app silent admin-side safety net per HR-3. Layered: L1 deterministic fixture differential (CI-gated), L3 on-demand admin-portal "audit this user" route. L2 anomaly-detection agent deferred to 41i.5 (needs Cloud Scheduler infra).

## **10.33 Phase 41i — Calculation Audit System (PR — shipped 2026-05-06)**

Cross-app silent safety net per **HR-3** (Phase 41 §1 invariant 11). Industry pattern (Stripe reconciliation pipeline, Wise invariants, banking shadow ledger). The system runs every registered calc engine against reference fixtures with **hardcoded assertions** captured from source authority — drift = a code change has caused an engine to produce a different number for the same input.

### Architecture

```
lib/calc-audit/
├── types.ts                   # CalcEngine<TInput,TOutput>, CalcFixture, CalcAssertion,
│                              # AuditFinding, Severity, Resolution, FixtureRunResult,
│                              # DifferentialReport
├── registry.ts                # calcEngineRegistry singleton
├── runDifferential.ts         # L1: runs every fixture; produces DifferentialReport
├── index.ts                   # bootstrap (auto-registers via engine adapter imports)
└── engines/
    ├── tax.ts                 # 7 Phase 41e engines registered
    ├── core.ts                # 4 core calc engines registered
    └── property.ts            # 3 property metric helpers registered

app/api/admin/calc-audit/
└── route.ts                   # GET — runs differential + returns report (audit:read)

app/admin/calc-audit/
└── page.tsx                   # Admin portal page — gated by AdminFeatureGate
```

### What's registered (v1)

**14 calc engines / 18 fixtures across the app**, locked at current behaviour as of 2026-05-06:

| Category | Engines |
|---|---|
| **TAX** (7) | `tax.capTracker` (s291-20 / s292-85) · `tax.gstCalculator` (GST Act s9-70/s38/s40/s23-15) · `tax.landTax.NSW` (Land Tax Act 1956 s27/s5A/Sch 1A) · `tax.crossStateLandTax` (NSW + VIC + QLD aggregator) · `tax.stampDuty.NSW` (Duties Act 1997 Sch 1 + Ch 2 Pt 4 Div 4 FPAD) · `tax.trustLossRules` (Sch 2F ITAA 1936 — IIT/50% Stake/Pattern of Distributions/Control/SBT) · `tax.companyLossRules` (Div 165 ITAA 1997 — COT + s165-210/s165-211 BCT) |
| **CORE** (4) | `core.netWorth` · `core.incomeAggregator` · `core.expenseAggregator` · `core.loanAggregator` |
| **PROPERTY** (3) | `property.LVR` · `property.equity` · `property.rentalYield` |

### Assertion-based fixture pattern

> **Why assertions, not deep-equal `expectedOutput`:** An expected-output snapshot tempts engineers to write `expectedOutput: engine(input)` — self-referential, never fails. Assertions force concrete hardcoded invariants captured from source authority. Reviewers reject any fixture whose assertions reference engine output rather than authority-published values.

```ts
{
  name: 'NSW individual @ $1.5M residential',
  input: { taxableLandValue: 1_500_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true },
  assertions: [
    {
      description: 'General land tax = $6,900 ($100 + 1.6% × ($1.5M − $1.075M); per Land Tax Act 1956 s27)',
      check: (r) => Math.abs(r.generalLandTax - 6_900) < 1,
    },
    {
      description: 'No trust surcharge (individual ownership)',
      check: (r) => r.trustSurcharge === 0,
    },
  ],
  authoritySource: 'NSW Land Tax Act 1956 s27 (general scale CY2025).',
}
```

### Admin portal

- Route `/admin/calc-audit` — gated by `AdminFeatureGate feature="adminPortalEnabled"` + `audit:read` permission on the API endpoint.
- Renders summary (engines / fixtures / pass / fail / errored), per-failure detail (which assertions failed), full engine catalogue grouped by category.
- "Re-run differential" button calls `GET /api/admin/calc-audit` on demand.
- **Per HR-3: no user-facing variant exists.** Reviewers reject any PR that adds one.

### Drift-detection example (this PR's smoke test)

When I first wrote fixtures with hand-calculated expected values, the audit caught **5 genuine discrepancies** between hand-calc and actual engine behaviour (e.g. `expenseAggregator` doesn't currently convert frequencies; `netWorth` classifies `type: 'MORTGAGE'` as personal loan; GST G1 is $12k not $11k for the test scenario). Fixtures were updated to lock in **current engine behaviour** as the baseline. Future engine changes that alter these outputs will fail the audit — **the system works**.

### Tests (19 new)

| Section | Coverage |
|---|---|
| Registry structure (8) | bootstrap; alphabetical listing; every engine has fixtures; every fixture has assertions; sourcePath under `lib/`; totalFixtures matches sum; throws on duplicate; throws on engine without fixtures |
| Differential full sweep (3) | Report covers every fixture; **every fixture passes against current engine implementation (drift baseline)**; duration recorded |
| `runOne` outcomes (5) | PASS when assertions hold; FAIL with assertion descriptions; ERROR with engine error message; async engines supported; thrown assertions caught and surfaced |
| Per-category coverage (3) | TAX/CORE/PROPERTY each include their canonical engines |

**Total tests:** 513 → 532 (+19). tsc clean.

### Deferred to follow-up

- **L2 anomaly detection agent** — Cloud Scheduler daily job; AI surfaces outliers (5σ from peers) across users. Deferred until Cloud Scheduler infra is in place.
- **L3 on-demand "Audit this user"** — admin portal action that re-runs every engine for a specific user with their stored data. v1 ships the framework + L1; L3 added as a follow-up sub-PR (41i.3) along with the `CalcAuditFinding` Prisma model for persistent finding history.
- **Health engine** + **CGT engine** + **MasterTaxPosition** + **PSI / FTE / Div 7A classifiers** — straightforward to add as additional adapters following the `engines/tax.ts` pattern. Each is a small follow-up.

### Adding a new engine (going-forward pattern)

1. Add adapter in `lib/calc-audit/engines/<category>.ts` calling `calcEngineRegistry.register(...)`.
2. Each fixture must have ≥1 `assertion` with hardcoded values from source authority — never `engine(input)` self-reference.
3. Import the adapter from `lib/calc-audit/index.ts`.
4. Run tests — the existing differential sweep test enforces 0 failures.


## **10.34 Phase 41h.3 — AI Advisor Practice surface UI (PR — shipped 2026-05-07)**

Resumes Phase 41h after the 41i calc-audit safety net landed. Ships the **first real user-shaped surface** for the AI advisor — a structured renderer that takes the gateway's `GatewayResponse` and presents it with citations next to numbers, AFSL/TPB/NCCP boundary footer, UNCOMPUTED flags surfaced explicitly, and Tier 2 → Ask-a-Pro routing card. Lives behind the admin portal as the integration surface (`/admin/ai-advisor`) until 41h.4 (Ask-a-Pro routing) and 41h.5 (tool registry expansion) graduate it to user-facing dashboards.

### Architecture

```
components/ai-advisor/
├── TaxAdvisorAnswer.tsx           # Top-level renderer — branches per response.status
├── TaxAdvisorBoundaryFooter.tsx   # AFSL/TPB/NCCP footer with citations
├── TaxAdvisorUncomputedFlag.tsx   # Per-flag amber-accent renderer
├── TaxAdvisorAskForm.tsx          # Question textarea + example chips
└── index.ts                       # public surface

app/api/admin/ai-advisor/ask/route.ts
└── POST endpoint — wraps gateway with GeminiProvider + ProductionAuditSink;
    503 if GEMINI_API_KEY not configured

app/admin/ai-advisor/page.tsx
└── Admin demo page — gated by AdminFeatureGate adminPortalEnabled
```

### Status routing in the renderer

| Gateway status | UI surface |
|---|---|
| `OK` + `TIER_1_FACTS` | Renders segments inline (TEXT / NUMBER_REF / CITATION_REF / UNCOMPUTED_NOTE) + UNCOMPUTED section + boundary footer + trace metadata |
| `OK` + `TIER_2_ROUTE_TO_PRO` | Routing card with profession-specific copy (ADVISER / ACCOUNTANT / BROKER) + reason + trace |
| `BLOCKED_RECOMMENDATION` | Auto-routes to default ADVISER Tier 2 card (HR-3 boundary) |
| `BLOCKED_VALIDATION` / `SCHEMA_INVALID` | Generic accuracy error (don't expose validator detail to users) + trace |
| `PROVIDER_ERROR` | "AI is temporarily unavailable" + trace |

**Trace metadata always rendered** at the bottom — `traceId`, `durationMs`, `tokenUsage.total`. Lets ops correlate user reports with audit log entries.

### Gating

- API route: admin-only (`audit:read` permission), 503 if `GEMINI_API_KEY` is unset (clear "not configured" message rather than silent failure)
- Admin page: `AdminFeatureGate adminPortalEnabled`
- Component lives in `components/ai-advisor/` — provider-agnostic, ready to be embedded in user-facing dashboards in 41h.4+

### Tests (12 new — 544 total)

| Section | Coverage |
|---|---|
| Boundary footer (2) | renders boundary statement verbatim; renders citations inline |
| UNCOMPUTED flag (2) | with citation; without citation |
| Status routing (5) | PROVIDER_ERROR + trace; BLOCKED_VALIDATION generic; SCHEMA_INVALID same; BLOCKED_RECOMMENDATION → ADVISER; OK + TIER_1 segments + boundary |
| Tier 2 routing (1) | TIER_2_ROUTE_TO_PRO renders profession-specific copy + reason |
| UNCOMPUTED section (1) | flags render in dedicated section |
| Trace metadata (1) | trace + duration + tokens always at bottom |

Tests use `react-dom/server.renderToString` (no RTL setup needed — pure SSR check). Updated `vitest.config.ts` to include `.test.tsx` files going forward.

**544 total tests** (532 → 544, +12). tsc clean.

### Smoke-test path (admin)

1. Set `GEMINI_API_KEY` in env
2. Navigate to `/admin/ai-advisor` (admin portal enabled)
3. Pick an example question or type one
4. Observe: real Gemini call → tool dispatch → validated answer with citations + boundary footer

If `GEMINI_API_KEY` is unset, the page renders the form but submission shows a clear "AI advisor not configured" message — never a silent failure.

**Phase 41h.4 — Ask-a-Pro router** is next (detects recommendation-shaped questions and routes to marketplace per Phase 32C; graduates the advisor surface to user-facing dashboards).

## **10.35 Phase 41h.4 — Ask-a-Pro router + user-facing surface (PR — shipped 2026-05-07)**

**Graduates the AI advisor from admin-demo to user-facing.** The Tier 2 routing card now links to the existing Phase 32C marketplace, scoped to the right discipline based on the AI's `askAProRouting.profession`. Same gateway, same components — just the surface graduates.

### What ships

```
lib/ai/tax-advisor/
├── askAProRouting.ts       # NEW — profession → marketplace.discipline mapping
└── runAdvisorQuery.ts      # NEW — shared helper for both admin + user routes

app/api/ai-advisor/ask/route.ts                # NEW — user-facing endpoint (report.read)
app/api/admin/ai-advisor/ask/route.ts          # refactored to use runAdvisorQuery
app/dashboard/cfo/ask/page.tsx                 # NEW — user-facing AI advisor page

components/ai-advisor/TaxAdvisorAnswer.tsx     # RouteToPro now has clickable CTA
```

### Routing (HR-3 + D-2 alignment)

| Profession | Marketplace `discipline` | Licensing |
|---|---|---|
| `ADVISER` | `FINANCIAL_ADVISOR` | AFSL — personal financial advice + product recommendations |
| `ACCOUNTANT` | `TAX_AGENT` | TPB — personal tax advice |
| `BROKER` | `MORTGAGE_BROKER` | NCCP — credit advice + product recommendations |

The mapping is **intentionally narrow** — an advisory question routes to AFSL-licensed pros, a tax question routes to TPB-registered agents, a credit question routes to NCCP-authorised brokers. **Reviewers reject any change that broadens the mapping** (e.g. routing AFSL questions to TPB-only agents).

### Deep-link contract

`buildAskAProDeepLink({ profession, question?, reason? })` produces `/marketplace?discipline=<mapped>&question=<encoded>&reason=<encoded>`. The marketplace listing detail page can pick up the URL params to pre-fill the request submission form (Phase 32C `submitRequest`). **Sensitive context (CDR data) is NEVER placed in the URL** — the user opts in to sharing snapshot context inside the request form.

### User-facing surface

- Route: `/dashboard/cfo/ask`
- Auth: `report.read` permission (lightest authenticated touch — surface returns facts; HR-1 + HR-2 structurally enforce that the AI never invents either)
- Components: same `TaxAdvisorAskForm` + `TaxAdvisorAnswer` from 41h.3
- 503 path identical to admin route — clear "AI advisor not configured" message when `GEMINI_API_KEY` is unset

### Why both routes coexist

- `/api/admin/ai-advisor/ask` — admin diagnostic; `audit:read` permission; access via `/admin/ai-advisor`
- `/api/ai-advisor/ask` — user-facing; `report.read` permission; access via `/dashboard/cfo/ask`

Both delegate to `runAdvisorQuery` so provider wiring + validation logic live in one place. The auth surface is the only difference.

### Tests (17 new — 561 total)

| Section | Coverage |
|---|---|
| `professionToDiscipline` (3) | ADVISER → FINANCIAL_ADVISOR, ACCOUNTANT → TAX_AGENT, BROKER → MORTGAGE_BROKER |
| `buildAskAProDeepLink` (5) | base path; discipline param; question + reason encoding; omits when not supplied; URL-special chars |
| `runAdvisorQuery` validation (4) | empty / whitespace / over-cap rejected; cap edge accepted |
| `runAdvisorQuery` config (1) | NOT_CONFIGURED when `GEMINI_API_KEY` unset |
| `RouteToPro` CTA wiring (4) | Tier 2 ADVISER href + copy; BLOCKED_RECOMMENDATION default; ACCOUNTANT → TAX_AGENT; BROKER → MORTGAGE_BROKER |

**561 total tests** (544 → 561, +17). tsc clean.

**Phase 41h.5 — Tool registry expansion** is next (`runScenario` SCENARIO_RUN tool + additional fact lookups: CGT exposure, Div 7A risk, in-house asset ratio, contribution-cap deltas). Closes Phase 41h.

## **10.36 Phase 41h.5 — Tool registry expansion + SCENARIO_RUN (PR — shipped 2026-05-07). CLOSES PHASE 41h.**

**Closes Phase 41h.** The AI advisor surface is now feature-complete: gateway + 7 tools + admin/user surfaces + Ask-a-Pro routing + calc-audit safety net underpinning everything.

### What ships

```
lib/ai/tax-advisor/tools/
├── getCgtExposure.ts            # NEW (FACT_LOOKUP) — wraps applyCapitalLossNetting
├── getDiv7aRisk.ts              # NEW (FACT_LOOKUP) — wraps classifyDiv7ALoans
├── getInHouseAssetRatio.ts      # NEW (FACT_LOOKUP) — wraps classifySmsfTriumvirate (in-house portion)
└── runContributionScenario.ts   # NEW (SCENARIO_RUN) — first SCENARIO_RUN tool in registry
```

Registry size: **3 → 7** (4 new). `ToolKind` discriminant now exercises both values:
- **FACT_LOOKUP × 6** — `getCgtExposure`, `getContributionCapHeadroom`, `getDiv7aRisk`, `getEntityTaxPosition`, `getInHouseAssetRatio`, `getLandTaxPosition`
- **SCENARIO_RUN × 1** — `runContributionScenario`

### SCENARIO_RUN pattern (established this PR)

Structurally identical to FACT_LOOKUP — same `ToolResult` shape with `numericFields[]` + `citations[]` + `uncomputed[]` + `narrativeText`. The only difference is **semantic intent**:
- `FACT_LOOKUP` = current state from calc engine (what IS)
- `SCENARIO_RUN` = re-invokes calc engine with hypothetical inputs (what WOULD be)

`runContributionScenario` returns BOTH baseline + scenario results + delta numerical fields, so the AI can narrate the change without computing it itself (HR-1 still applies — the delta is computed in the tool, not by the AI).

**Why SCENARIO_RUN does NOT breach D-2:** returning a scenario number is NOT a recommendation. *"If you contribute $5k more, your headroom becomes $3k"* is a fact. *"You should contribute $5k more"* remains forbidden — there is no recommendation tool in the registry, and the gateway's validator catches recommendation language in TIER_1 responses.

### What's available to the AI now

| Domain | FACT_LOOKUP | SCENARIO_RUN |
|---|---|---|
| Super contributions | `getContributionCapHeadroom` (s291-20 / s292-85) | `runContributionScenario` ("what if I contribute $X more?") |
| CGT | `getCgtExposure` (Div 102-A / s100-50 / s115-100) | — |
| Land tax | `getLandTaxPosition` (cross-state aggregator + per-state Land Tax Acts) | — |
| Stamp duty + entity tax | `getEntityTaxPosition` (entity router — wires Phase 41e) | — |
| Div 7A | `getDiv7aRisk` (s109B-s109ZE) | — |
| SMSF | `getInHouseAssetRatio` (Pt 8 SIS Act — 5% cap) | — |

### Tests (34 new — 595 total)

| Section | Coverage |
|---|---|
| Registry size + kind discriminator (4) | 7 tools; 1 SCENARIO_RUN; 6 FACT_LOOKUP; all new names present |
| `getCgtExposure` (3) | net gain after netting + discount; cites Div 102-A/s100-50/s115; citationIds resolve |
| `getDiv7aRisk` (3) | compliant loan; NO_AGREEMENT deemed dividend; zero-loan input |
| `getInHouseAssetRatio` (3) | within 5% cap; exceed cap → BREACH with breach amount + percentage; cites Pt 8 |
| `runContributionScenario` (5) | baseline + scenario + delta fields; zero-hypothetical produces zero delta; cap-crossing surfaces excess tax delta; cites s291-20 / s292-85 / Div 291; citationIds resolve |
| HR-1/HR-2/D-2 contract per tool (16) | 4 tools × 4 contract checks (stable path; well-formed citations; no banned words; description disclaim) |

**595 total tests** (561 → 595, +34). tsc clean.

### Phase 41h is COMPLETE

All sub-PRs shipped:
- **41h.0** — Tool registry foundation (3 FACT_LOOKUP tools)
- **41h.1** — AI Policy Gateway (5-status pipeline; HR-1/HR-2/D-2 enforcement)
- **41h.2** — Gemini provider adapter + production audit sink
- **41h.3** — Practice surface UI (admin demo)
- **41h.4** — Ask-a-Pro router + user-facing surface graduation
- **41h.5** — Tool registry expansion + SCENARIO_RUN pattern (this PR)

**Three structural enforcement layers** all live:
1. Tool layer — closed `ToolKind` discriminant; no `RECOMMENDATION` kind
2. Schema layer — Zod `RawAIResponseSchema`; typed segments
3. Validator layer — runtime resolution against `ToolSession`; rejects fabricated numbers / citations / recommendation language

**Calc audit safety net** (Phase 41i) catches calc drift silently before users see wrong numbers (HR-3).

**Next phase:** Phase 41 is COMPLETE for its core scope. Future iterations can add more SCENARIO_RUN tools (`runCgtScenario`, `runLandTaxScenario`, `runDiv7aRefinanceScenario`) and graduate the advisor surface from `/dashboard/cfo/ask` to natural-IA placement (e.g. under "My Guide" per TRAIL framework). 41i.2-5 follow-ups extend the calc-audit system (more engines / L3 on-demand audit / alerting / L2 anomaly detection).

## **10.37 Phase 41i.2 — Calc audit engine adapter expansion (PR — shipped 2026-05-07)**

Extends the calc audit registry from **14 → 36 engines** (45 fixtures, all green). Closes the "more engines" item in the Phase 41i sequence — every Phase 41e module the AI advisor relies on now has assertion-based audit coverage.

### What ships

```
lib/calc-audit/engines/
├── tax.ts              # (existing) NSW + cross-state aggregator + loss rules + GST + capTracker
├── tax-divisions.ts    # NEW — 8 division/classifier adapters
├── tax-state.ts        # NEW — 14 state adapters (7 land tax + 7 stamp duty)
├── core.ts             # (existing) net worth, income/expense/loan aggregators
└── property.ts         # (existing) LVR / equity / rental yield
```

### New TAX adapters (8 in `tax-divisions.ts`)

| Engine | Wraps | Authority |
|---|---|---|
| `tax.cgtNetting` | `applyCapitalLossNetting` | Div 102-A / s100-50 / s115-100 |
| `tax.div7aClassifier` | `classifyDiv7ALoans` | ITAA 1936 s109B-s109ZE |
| `tax.psiClassifier` | `classifyPsi` | ITAA 1997 Part 2-42 + s86-15 |
| `tax.fteIeeClassifier` | `classifyFteIeeDistributions` | Sch 2F ITAA 1936 |
| `tax.div152` | `applyDiv152` | ITAA 1997 Div 152 |
| `tax.smsfTriumvirate` | `classifySmsfTriumvirate` (full) | SIS Act s62 + Pt 8 + s67A; s295-550/-160 |
| `tax.highIncomeSuperTax` | `calculateHighIncomeSuperTax` | ITAA 1997 Div 293 |
| `tax.masterTaxPosition` | `buildMasterTaxPosition` (Phase 41e.17 orchestrator) | Aggregates entity router + Phase 41e modules |

### New state adapters (14 in `tax-state.ts`)

7 land tax + 7 stamp duty adapters covering VIC / QLD / SA / WA / TAS / ACT / NT — bringing both regimes to **all 8 states/territories** (NSW shipped in 41i.0+1).

### Registry now 36 engines / 45 fixtures

| Category | Count |
|---|---|
| TAX | 29 (was 7) |
| CORE | 4 |
| PROPERTY | 3 |

All 45 fixtures green. tsc clean.

### Tests added (2 new specifically for new engines)

| Test | Locks in |
|---|---|
| TAX includes Phase 41i.2 division/classifier adapters | All 8 new adapters from `tax-divisions.ts` |
| TAX covers all 8 states for land tax + stamp duty | `tax.landTax.{state}` + `tax.stampDuty.{state}` for every state |

The existing "every fixture passes against current implementation" test now enforces 45 PASSes (was 19) — any future engine refactor that changes the canonical output forces a deliberate fixture update.

**597 total tests** (595 → 597, +2). tsc clean.

**41i.3 — L3 on-demand "Audit this user"** is next — adds the `CalcAuditFinding` Prisma model + admin portal action that re-runs every registered engine for a specific user with their stored data, surfaces drift findings.

## **10.38 Phase 41i.3 — L3 audit foundation: persistent findings + lifecycle (PR — shipped 2026-05-07)**

Persistence layer for the calc audit system. Every drift / error event from `runDifferential()` is now recorded in the `calc_audit_findings` table with a full lifecycle workflow. Foundation for 41i.4 alerting and the per-user "Audit this user" pre-existing audit-this-user adapter set (deferred — see "What's deferred" below).

### Schema additions

```prisma
enum CalcAuditFindingSource {
  L1_DIFFERENTIAL  L3_ON_DEMAND  L2_ANOMALY
}
enum CalcAuditFindingSeverity {
  INFO  LOW  MEDIUM  HIGH  CRITICAL
}
enum CalcAuditFindingResolution {
  OPEN  INVESTIGATING  FALSE_POSITIVE  FIX_REQUIRED  FIXED
}

model CalcAuditFinding {
  id, detectedAt, source, engineName, fixtureName?, userId?,
  severity, resolution, summary, failedAssertions?, errorMessage?,
  adminNotes?, resolvedAt?, resolvedBy?, createdAt, updatedAt
  @@map("calc_audit_findings")
}
```

CLAUDE.md §12.11 N/A — additive table, no existing rows touched. CLAUDE.md §12.12 satisfied — migration ships in same PR.

### Lifecycle (state machine)

```
         ┌─────────────┐
         │    OPEN     │← initial state on creation
         └──────┬──────┘
                ↓
         ┌─────────────┐         ┌──────────────┐
   ┌─────┤INVESTIGATING│←───────┤FALSE_POSITIVE│
   │     └──────┬──────┘         └──────────────┘
   ↓            ↓                       ↑
 FALSE_         FIX_REQUIRED ────→ FIXED ┘
 POSITIVE       (admin works on it)
```

**Allowed transitions (locked in `findingService.ts`):**

| From | To |
|---|---|
| `OPEN` | INVESTIGATING / FALSE_POSITIVE / FIX_REQUIRED |
| `INVESTIGATING` | FALSE_POSITIVE / FIX_REQUIRED / OPEN |
| `FIX_REQUIRED` | FIXED / INVESTIGATING |
| `FALSE_POSITIVE` | INVESTIGATING (re-open) |
| `FIXED` | INVESTIGATING (regression) |

Self-transitions are forbidden (every state's allowed-list excludes itself). Terminal states (`FIXED`, `FALSE_POSITIVE`) re-open ONLY via `INVESTIGATING` — forces an admin to deliberately re-investigate before re-classifying.

### What ships

```
prisma/
├── schema.prisma                                       # adds CalcAuditFinding + 3 enums
└── migrations/20260507120000_add_calc_audit_finding/
    └── migration.sql                                   # hand-crafted (no DB access in env)

lib/calc-audit/findingService.ts                        # NEW — record / list / transition

app/api/admin/calc-audit/route.ts                       # MODIFIED — auto-persist on differential run
app/api/admin/calc-audit/findings/route.ts              # NEW — GET findings list (paginated, filtered)
app/api/admin/calc-audit/findings/[id]/route.ts         # NEW — PATCH lifecycle update

app/admin/calc-audit/page.tsx                           # MODIFIED — Findings queue section + lifecycle buttons
```

### Auto-persist + dedup behaviour

Every call to `GET /api/admin/calc-audit` now:
1. Runs the differential
2. **Persists every FAIL/ERROR result** as a `CalcAuditFinding`
3. Dedupes: if an OPEN/INVESTIGATING finding already exists for the same `(engineName, fixtureName)`, the existing finding's `detectedAt` + `summary` are refreshed instead of creating a duplicate

This prevents queue spam when a single bug causes the same fixture to fail every CI run while still capturing the LATEST occurrence.

### Severity defaults

- `FAIL` outcome → `MEDIUM` (overridable per-call)
- `ERROR` outcome (engine threw) → `HIGH`

### Admin endpoints (all `audit:read`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/calc-audit` | Run differential + auto-persist + return report (existing endpoint, extended) |
| GET | `/api/admin/calc-audit/findings` | Paginated findings list with filters (`resolution`, `source`, `engineName`) |
| PATCH | `/api/admin/calc-audit/findings/[id]` | Apply lifecycle transition + admin notes |

### Admin UI changes

- New **Findings queue** section above the engine catalogue
- **Lifecycle counts tile** (OPEN / INVESTIGATING / FIX_REQUIRED / FIXED / FALSE_POSITIVE)
- **Per-finding card** shows badge + summary + failed assertions + admin notes + transition buttons (context-aware per current state)
- Empty state: *"No open findings. The audit system is silent — that's the goal (HR-3)."*

### Tests (9 new — 606 total)

The codebase doesn't carry a Prisma mocking layer (`tests/sanity/` uses real DB). For 41i.3 v1 the **pure-logic tests** lock in:
- All 5 lifecycle states have correct allowed-next-state lists
- Self-transitions forbidden (no FIXED → OPEN, no OPEN → OPEN, etc.)
- Terminal states re-open only via INVESTIGATING (regression / re-investigate path)
- `FindingTransitionError` carries structured `code` (`NOT_FOUND` | `INVALID_TRANSITION`) + message

End-to-end persistence is exercised via manual smoke against the admin endpoint after deploy. Future PR can add a Prisma mock layer for full integration tests.

**606 total tests** (597 → 606, +9). tsc clean.

### What's deferred

- **Per-user L3 "Audit this user"** — requires per-engine adapters that fetch user data from DB and reconstruct the engine's input. 36 engines × 36 different input shapes = substantial workstream. Foundation (the `calcEngineRegistry` + `recordDifferentialFindings(report, source)`) is already in place; per-engine "fetch from user state" adapters are the missing piece. Tracked as **41i.3b** for a follow-up PR.
- **Prisma mock layer for unit tests** — would let us test `recordDifferentialFindings` / `listFindings` / `updateFindingResolution` end-to-end in CI without a real DB. Tracked as cross-cutting infra.

### Per going-forward commitment

- `docs/architecture/03_DATA_MODEL.md` new §10.38 (this entry)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.3 SHIPPED row

**41i.4 — Alerting + workflow** is next (Slack / email when severity ≥ HIGH; the lifecycle is now in place to support it).
