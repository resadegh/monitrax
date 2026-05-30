# PHASE 21: ASSET MANAGEMENT ENGINE

### *Personal Asset Tracking with Expense Allocation for Monitrax*

---

## 1. Purpose

This phase introduces a comprehensive **Asset Management** module to track personal assets such as vehicles, furniture, electronics, and other valuable items. The primary goals are:

- Track asset values and depreciation over time
- Link expenses to specific assets for cost-of-ownership analysis
- Provide insights into total cost of ownership (TCO)
- Integrate assets into the portfolio snapshot for complete net worth visibility
- Support tax-related depreciation tracking where applicable

---

## 2. Core Concepts

### 2.1 Asset Types

The system supports multiple asset categories:

| Asset Type | Description | Common Expenses |
|------------|-------------|-----------------|
| **VEHICLE** | Cars, motorcycles, boats | Registration, insurance, fuel, maintenance, servicing |
| **ELECTRONICS** | Computers, phones, TVs | Warranty, repairs |
| **FURNITURE** | Home furnishings | Repairs, cleaning |
| **EQUIPMENT** | Tools, machinery | Maintenance, repairs |
| **COLLECTIBLE** | Art, watches, wine | Insurance, storage |
| **OTHER** | Miscellaneous assets | Various |

### 2.2 Asset Lifecycle

```
Purchase → Ownership → (Depreciation) → Disposal/Sale
    │           │
    │           └── Ongoing Expenses Linked
    │
    └── Initial Value Recorded
```

### 2.3 Expense Allocation

Expenses can be linked to assets to track:
- Total cost of ownership
- Running costs per asset
- Annual expense breakdown by asset
- Category-wise expense distribution per asset

---

## 3. Data Model

### 3.1 Enums

```prisma
enum AssetType {
  VEHICLE
  ELECTRONICS
  FURNITURE
  EQUIPMENT
  COLLECTIBLE
  OTHER
}

enum AssetStatus {
  ACTIVE        // Currently owned
  SOLD          // Sold/disposed
  WRITTEN_OFF   // Written off (damaged/lost)
}

enum VehicleFuelType {
  PETROL
  DIESEL
  ELECTRIC
  HYBRID
  LPG
  OTHER
}
```

### 3.2 Asset Entity

```prisma
model Asset {
  id                    String        @id @default(uuid())
  userId                String

  // Core fields
  name                  String
  type                  AssetType
  status                AssetStatus   @default(ACTIVE)
  description           String?

  // Value tracking
  purchasePrice         Float
  purchaseDate          DateTime
  currentValue          Float
  valuationDate         DateTime      // When currentValue was set

  // Sale/disposal tracking
  salePrice             Float?
  saleDate              DateTime?

  // Depreciation (optional)
  depreciationMethod    DepreciationMethod?
  depreciationRate      Float?        // Annual rate (e.g., 0.15 for 15%)
  usefulLifeYears       Int?
  residualValue         Float?        // Expected value at end of useful life

  // Vehicle-specific fields (nullable for non-vehicles)
  vehicleMake           String?
  vehicleModel          String?
  vehicleYear           Int?
  vehicleRegistration   String?
  vehicleFuelType       VehicleFuelType?
  vehicleOdometer       Int?          // Current odometer reading
  vehicleVin            String?       // Vehicle Identification Number

  // Images
  imageUrl              String?

  // Metadata
  serialNumber          String?
  warranty Expiry       DateTime?
  notes                 String?

  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  // Relationships
  user                  User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  expenses              Expense[]
  assetValueHistory     AssetValueHistory[]
  assetServiceRecords   AssetServiceRecord[]

  @@index([userId])
  @@index([type])
  @@index([status])
  @@map("assets")
}
```

### 3.3 Asset Value History

Track value changes over time for reporting and analysis:

```prisma
model AssetValueHistory {
  id          String    @id @default(uuid())
  assetId     String
  value       Float
  valuedAt    DateTime  @default(now())
  source      String?   // "MANUAL", "REDBOOK", "MARKET", "DEPRECIATION"
  notes       String?

  // Relationships
  asset       Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@index([valuedAt])
  @@map("asset_value_history")
}
```

### 3.4 Asset Service Records (Primarily for Vehicles)

```prisma
model AssetServiceRecord {
  id              String    @id @default(uuid())
  assetId         String
  expenseId       String?   // Link to associated expense record

  serviceDate     DateTime
  serviceType     String    // "ROUTINE", "REPAIR", "REGISTRATION", "INSURANCE", etc.
  description     String
  provider        String?   // Service provider name
  cost            Float

  // Vehicle-specific
  odometerReading Int?

  notes           String?
  createdAt       DateTime  @default(now())

  // Relationships
  asset           Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@index([serviceDate])
  @@map("asset_service_records")
}
```

### 3.5 Expense Entity Updates

Extend the existing Expense model to support asset linking:

```prisma
// Add to ExpenseSourceType enum:
enum ExpenseSourceType {
  GENERAL
  PROPERTY
  LOAN
  INVESTMENT
  ASSET       // NEW: Link expenses to assets
}

// Add to Expense model:
model Expense {
  // ... existing fields ...

  assetId               String?       // NEW: Link to asset

  // Relationships
  asset                 Asset?        @relation(fields: [assetId], references: [id], onDelete: SetNull)

  @@index([assetId])     // NEW index
}
```

---

## 4. GRDCS Relationship Map

### 4.1 New Relationships

```
asset → expense[]           // Expenses linked to this asset
asset → assetValueHistory[] // Value changes over time
asset → assetServiceRecord[] // Service/maintenance records
asset → document[]          // Linked documents (registration, insurance, receipts)
```

### 4.2 Entity Contract

```typescript
interface AssetEntity {
  id: string;
  type: 'asset';
  name: string;
  href: string;
  metadata: {
    assetType: AssetType;
    status: AssetStatus;
    purchasePrice: number;
    currentValue: number;
    totalExpenses: number;
    annualExpenses: number;
    // Vehicle-specific
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleYear?: number;
  };
  links: GRDCSLink[];
}
```

---

## 5. Financial Calculations

### 5.1 Total Cost of Ownership (TCO)

```
TCO = Purchase Price
    + Sum(All Linked Expenses)
    - Sale Price (if sold)
```

### 5.2 Annual Running Cost

```
Annual Running Cost = Sum(Linked Expenses in Current Year)
```

### 5.3 Depreciation Calculation

**Prime Cost Method:**
```
Annual Depreciation = (Purchase Price - Residual Value) / Useful Life Years
```

**Diminishing Value Method:**
```
Annual Depreciation = Current Value × Depreciation Rate
```

### 5.4 Net Asset Value

```
Net Asset Value = Current Value - Any Secured Loans (future feature)
```

### 5.5 Portfolio Snapshot Integration

Assets contribute to net worth:
```
Total Assets = Sum(asset.currentValue) WHERE status = 'ACTIVE'
```

---

## 6. API Specification

### 6.1 Core CRUD Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List all assets |
| GET | `/api/assets/:id` | Get single asset |
| POST | `/api/assets` | Create asset |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset (soft delete) |

### 6.2 Specialized Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets/:id/expenses` | Get expenses linked to asset |
| GET | `/api/assets/:id/history` | Get value history |
| POST | `/api/assets/:id/valuation` | Record new valuation |
| GET | `/api/assets/:id/tco` | Get total cost of ownership |
| GET | `/api/assets/:id/service-records` | Get service history |
| POST | `/api/assets/:id/service-records` | Add service record |

### 6.3 Request/Response Schema

**Create Asset Request:**
```typescript
interface CreateAssetRequest {
  name: string;
  type: AssetType;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  description?: string;

  // Vehicle-specific (when type = VEHICLE)
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleRegistration?: string;
  vehicleFuelType?: VehicleFuelType;
  vehicleOdometer?: number;

  // Depreciation
  depreciationMethod?: DepreciationMethod;
  depreciationRate?: number;
  usefulLifeYears?: number;
}
```

**Asset Response:**
```typescript
interface AssetResponse {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;

  // Computed fields
  totalExpenses: number;
  annualExpenses: number;
  depreciation: number;
  totalCostOfOwnership: number;

  // Vehicle details (if applicable)
  vehicle?: {
    make: string;
    model: string;
    year: number;
    registration: string;
    fuelType: VehicleFuelType;
    odometer: number;
  };

  // Related data
  expenses: ExpenseSnapshot[];
  recentServices: ServiceRecord[];
}
```

---

## 7. UI/UX Specification

### 7.1 Dashboard Navigation

Add "Assets" to the main navigation under the Financial section:

```
Dashboard
├── Properties
├── Loans
├── Accounts
├── Investments
├── Assets ← NEW
├── Income
└── Expenses
```

### 7.2 Assets List Page (`/dashboard/assets`)

**Layout:**
- Page header with "Add Asset" button
- Filter/sort controls (by type, status, value)
- Asset cards or table view toggle
- Summary stats (total value, total running costs)

**Asset Card:**
```
┌─────────────────────────────────────┐
│ [Image]  Toyota Camry 2021          │
│          VEHICLE • ACTIVE           │
│                                     │
│  Purchase: $35,000                  │
│  Current:  $28,000                  │
│  Running:  $4,200/year              │
│                                     │
│  [View] [Edit] [Add Expense]        │
└─────────────────────────────────────┘
```

### 7.3 Asset Detail Page (`/dashboard/assets/:id`)

**Sections:**
1. **Overview** - Key metrics, value, photo
2. **Expenses** - Linked expenses with filtering
3. **Service History** - Maintenance records (for vehicles)
4. **Value History** - Chart showing value over time
5. **Documents** - Linked documents (rego, insurance, receipts)
6. **Settings** - Edit asset details, depreciation settings

**Metrics Display:**
```
┌──────────────────────────────────────────────────────┐
│ Toyota Camry 2021                      [Edit] [More] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Purchase Value    Current Value    Depreciation     │
│  $35,000          $28,000          -$7,000 (20%)    │
│                                                      │
│  Total Expenses    Annual Costs     Cost/km          │
│  $12,450          $4,200           $0.42            │
│                                                      │
├──────────────────────────────────────────────────────┤
│ [Expenses] [Services] [Value History] [Documents]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Recent Expenses                                     │
│  ├── Registration Renewal    $850    15 Nov 2024    │
│  ├── Full Service           $420    10 Oct 2024    │
│  └── Insurance Premium      $1,200   01 Sep 2024   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 7.4 Add/Edit Asset Dialog

**Tabbed Form:**
- **Basic Info** - Name, type, description, purchase details
- **Vehicle Details** (if type = VEHICLE) - Make, model, year, rego, odometer
- **Valuation** - Current value, depreciation settings
- **Photo** - Upload asset image

### 7.5 Quick Expense Entry

When adding an expense, users can optionally link it to an asset:

```
┌─────────────────────────────────────┐
│ Add Expense                         │
├─────────────────────────────────────┤
│ Name:     [ Registration Renewal  ] │
│ Amount:   [ $850                  ] │
│ Category: [ TRANSPORT        ▼   ] │
│ Frequency:[ ANNUAL           ▼   ] │
│                                     │
│ ☑ Link to Asset                     │
│ Asset:    [ Toyota Camry 2021  ▼ ] │
│                                     │
│           [Cancel]    [Save]        │
└─────────────────────────────────────┘
```

---

## 8. Vehicle-Specific Features

### 8.1 Odometer Tracking

- Record odometer at each service
- Calculate cost per kilometer
- Track annual distance driven

### 8.2 Service Reminders

**Shipped (Phase 21.5, 2026-05-29 — Tier 1, in-app):**
- ✅ Registration expiry reminders
- ✅ CTP (green-slip) renewal reminders
- ✅ Comprehensive insurance renewal reminders
- ✅ Warranty expiry reminders (any asset type)
- ✅ **Property renewals (R3 producer):** council/water rates, land tax,
  building & contents insurance, strata/body-corp, lease renewal, compliance
  certificate. Owner-paid bills (rates/land-tax/strata/compliance) are hidden
  on RENTAL properties — a renter still tracks lease + contents insurance.

Stored as nullable date columns on `Asset` (`vehicleRegistrationExpiry`,
`vehicleCtpProvider` + `vehicleCtpExpiry`, `vehicleInsuranceProvider` +
`vehicleInsurancePolicyNumber` + `vehicleInsuranceExpiry`; `warrantyExpiry`
pre-existed) and on `Property` (`councilRatesDueDate`, `waterRatesDueDate`,
`landTaxDueDate`, `buildingInsuranceProvider` + `buildingInsurancePolicyNumber`
+ `buildingInsuranceExpiry`, `strataDueDate`, `leaseExpiry`,
`complianceCertExpiry`). Projected into reminders by the **canonical reminder
engine** `lib/reminders/reminderEngine.ts` (a pure, fetch-free engine per §6.4
— the SSOT for "what needs renewing and how urgent"). Surfaced in-app via
`<RenewalsCard>` (self-contained island on the Assets page + Home) and a
per-property renewals block in the property detail dialog. Served by the thin
`GET /api/reminders` route (now fans out assets + properties + loans +
consents).

**Tier 2 — in progress (R1):**
- ✅ **Snooze / dismiss / done state (R1 PR1, 2026-05-29)** — new `ReminderState`
  table keyed by the engine's synthetic id (`${entityId}:${sourceType}`) +
  due-date cycle; pure `applyReminderStates()` merge in the engine; `GET
  /api/reminders` honours it; `POST /api/reminders/state` persists it; the
  `<RenewalsCard>` rows gained a snooze 7/30-day · mark-done · dismiss menu with
  optimistic removal. State auto-resets when a renewal rolls to its next cycle.
- ✅ **In-app notification bell / centre (R1 PR2, 2026-05-29)** — `<NotificationBell>`
  replaces the dead bell button in `EditorialTopBar`: count badge (rose if
  overdue, amber otherwise) + dropdown panel of surfaced reminders with inline
  snooze (7d) + dismiss. Shared `useReminders` hook is the SSOT for fetch +
  actions across the bell and the card. Built on `DropdownMenu` (no new dep).
- ⏳ Bank-detected bills feed producer (`RecurringPayment.nextExpected`), gated
  by the `pushBillReminders` toggle so the high-volume feed is opt-out-able
  in-app (R1 PR3).
- ✅ **User-created custom reminders (R1 PR2b, 2026-05-29)** — new `Reminder`
  model (title + dueDate + optional note) + `computeCustomReminders` producer +
  `POST /api/reminders/custom`; created from the bell's "+ New" → `<AddReminderDialog>`.
  Flow through the same feed + snooze/dismiss/done state (synthetic key
  `${id}:CUSTOM`); rendered non-navigable (no entity page). Edit / hard-delete /
  a dedicated manage view are a fast-follow (Dismiss removes from view for now).
- ✅ **Transaction-import-cadence reminder (R7-PR1, 2026-05-29)** —
  `computeImportReminder` producer emits one `IMPORT_DUE` reminder ("time to
  import your latest transactions") for manual-import users when their data is
  ~a month stale (reads latest `ImportBatch.dateRangeEnd` + account
  `balanceSource`; suppressed for fully Basiq-fed users). Importing advances the
  cycle so it clears + returns monthly. Rationale: Basiq is off by default, so
  manual import is the primary data path — stale imports silently drift every
  downstream number. **R7-PR2 ⏳** adds the in-app export guide (date-range
  pre-fill + **QIF-preferred** how-to) to the import wizard.

**Still future:**
- Next service due (by date or km)
- Email / push delivery of the above (Tier 3 / R2 — Cloud Scheduler sweep +
  Resend, preference-gated; wires the dead `pushBillReminders` toggle for
  delivery)

**Where this pattern should be replicated next** (same engine, new producers —
each is its own slice): ~~Property renewals~~ ✅ shipped 2026-05-29 (R3);
term-deposit maturity, standalone insurance policies (health/life/income-
protection/home/pet/travel — new model), personal documents (licence/passport/
visa/Medicare/professional registration — new model), and the high-volume
bank-detected bills feed (`RecurringPayment.nextExpected` — belongs with the
Tier 2 bell because it needs snooze/dismiss state).

### 8.3 Fuel Tracking (Future Enhancement)

```prisma
model FuelRecord {
  id              String    @id @default(uuid())
  assetId         String
  date            DateTime
  litres          Float
  pricePerLitre   Float
  totalCost       Float
  odometer        Int
  fullTank        Boolean   @default(true)

  // Calculated
  efficiency      Float?    // L/100km

  asset           Asset     @relation(fields: [assetId], references: [id])

  @@index([assetId])
  @@map("fuel_records")
}
```

---

## 9. Portfolio Snapshot Integration

### 9.1 Snapshot Updates

Add assets to the portfolio snapshot response:

```typescript
interface PortfolioSnapshot {
  // ... existing fields ...

  assets: {
    totalValue: number;
    count: number;
    byType: {
      [type: string]: {
        count: number;
        totalValue: number;
      };
    };
    annualExpenses: number;
  };

  assetSnapshots: AssetSnapshot[];
}

interface AssetSnapshot {
  id: string;
  name: string;
  type: AssetType;
  currentValue: number;
  annualExpenses: number;
  totalCostOfOwnership: number;
}
```

### 9.2 Net Worth Calculation Update

```
Net Worth = Properties Market Value
          + Investment Account Values
          + Bank Account Balances
          + Asset Values            ← NEW
          - Loan Principals
```

---

## 10. Insights Engine Integration

### 10.1 Asset-Related Insights

| Insight Type | Trigger | Severity |
|--------------|---------|----------|
| High Running Cost | Annual expense > 20% of asset value | MEDIUM |
| Depreciation Alert | Value dropped > 30% in 12 months | LOW |
| Service Overdue | Last service > 12 months ago | MEDIUM |
| Registration Expiring | Rego expires within 30 days | HIGH |
| Insurance Gap | No insurance expense in 12 months | CRITICAL |

### 10.2 Example Insight

```typescript
{
  type: 'ASSET_HIGH_RUNNING_COST',
  severity: 'MEDIUM',
  title: 'High Running Costs on Toyota Camry',
  description: 'Your Toyota Camry has cost $4,200 this year (15% of current value). Consider reviewing expenses.',
  affectedEntities: [{ type: 'asset', id: 'asset-xxx' }],
  recommendedAction: 'Review linked expenses and consider if all costs are necessary.'
}
```

---

## 11. Default Expense Categories for Assets

### 11.1 Vehicle Expense Templates

| Category | Description | Typical Frequency |
|----------|-------------|-------------------|
| Registration | Vehicle registration | ANNUAL |
| Insurance | Comprehensive/CTP | ANNUAL |
| Fuel | Petrol/Diesel/Charging | WEEKLY/MONTHLY |
| Servicing | Scheduled maintenance | ANNUAL |
| Repairs | Unscheduled repairs | As needed |
| Tyres | Tyre replacement | As needed |
| Parking | Regular parking costs | MONTHLY |
| Tolls | Road tolls | MONTHLY |
| Car Wash | Cleaning | MONTHLY |
| Roadside Assist | RACV/NRMA membership | ANNUAL |

### 11.2 Expense Wizard Integration

Add asset-linked templates to the Expense Wizard:

```typescript
const vehicleExpenseTemplates = [
  { name: 'Registration', category: 'TRANSPORT', frequency: 'ANNUAL' },
  { name: 'Comprehensive Insurance', category: 'INSURANCE', frequency: 'ANNUAL' },
  { name: 'CTP Insurance', category: 'INSURANCE', frequency: 'ANNUAL' },
  { name: 'Scheduled Service', category: 'MAINTENANCE', frequency: 'ANNUAL' },
  { name: 'Fuel', category: 'TRANSPORT', frequency: 'MONTHLY' },
  { name: 'Parking', category: 'TRANSPORT', frequency: 'MONTHLY' },
  { name: 'Tolls', category: 'TRANSPORT', frequency: 'MONTHLY' },
];
```

---

## 12. Tax Considerations (Australian)

### 12.1 Work-Related Vehicle Expenses

For users who use vehicles for work:
- Log book method tracking
- Cents per kilometre method
- Deductible expense flagging

### 12.2 Depreciation for Tax

Assets used for income-producing purposes may be depreciable:
- Link to Phase 20 Tax Intelligence Engine
- Track effective life for ATO purposes
- Calculate claimable depreciation

---

## 13. Implementation Phases

### Phase 21.1: Core Asset Management
- [x] Database schema (Asset, AssetValueHistory, AssetServiceRecord)
- [x] Basic CRUD API endpoints
- [x] Assets list page with tile/list views
- [x] Asset detail dialog with tabs
- [x] Add/Edit asset dialog with vehicle-specific fields

### Phase 21.2: Expense Linking
- [x] Add assetId to Expense model
- [x] Update expense forms to allow asset linking (via Transaction Link Dialog)
- [x] Asset expense summary calculations
- [x] TCO calculations

### Phase 21.3: Vehicle Features
- [x] Service records model and API
- [x] Service history UI (tab in detail dialog)
- [x] Odometer tracking
- [x] Cost per km calculations

### Phase 21.4: Portfolio Integration
- [ ] Update Portfolio Snapshot API
- [ ] Update dashboard net worth
- [x] Asset summary widget (on assets page)

### Phase 21.5: Insights & Alerts
- [ ] Asset-related insights rules
- [x] Service reminder system — Tier 1 in-app (canonical engine `lib/reminders/reminderEngine.ts` + `<RenewalsCard>` + `<RenewalChip>` + `GET /api/reminders`, 2026-05-29). **Tier 2 snooze/dismiss/done shipped (R1 PR1, 2026-05-29)** — `ReminderState` table + pure `applyReminderStates()` merge + `POST /api/reminders/state` + RenewalsCard action menu. **In-app notification bell shipped (R1 PR2, 2026-05-29)** — `<NotificationBell>` in `EditorialTopBar` + shared `useReminders` hook. **Custom reminders shipped (R1 PR2b, 2026-05-29)** — `Reminder` model + `computeCustomReminders` + `POST /api/reminders/custom` + `<AddReminderDialog>`. **Import-cadence reminder shipped (R7-PR1, 2026-05-29)** — `computeImportReminder` nudges manual-import users when data is ~a month stale. Tier 2 remaining: bills feed (PR3) + R7-PR2 import guide (QIF-preferred). Tier 3 (email/push delivery) = R2.
- [x] Registration/insurance alerts — rego + CTP + comprehensive renewal dates on `Asset`, projected into reminders (2026-05-29). Loan fixed-rate expiry + bank/CDR consent expiry + warranty expiry also wired as producers (Tier A trio).
- [x] Property renewals (R3 producer) — council/water rates, land tax, building & contents insurance, strata, lease, compliance cert on `Property`, projected by the same engine + surfaced in the property detail dialog (2026-05-29).

---

## 14. Acceptance Criteria

The Asset Management module is complete when:

- [x] Users can create, edit, and delete assets
- [x] Vehicle-specific fields are captured for vehicle assets
- [x] Expenses can be linked to assets (schema ready)
- [x] Total cost of ownership is calculated and displayed
- [ ] Asset values appear in portfolio snapshot
- [x] Value history is tracked over time
- [x] Service records can be logged for vehicles
- [ ] Asset insights are generated by the Insights Engine
- [ ] Assets follow GRDCS entity conventions
- [x] All API endpoints are documented and tested

---

## 15. Future Enhancements

1. **Fuel Tracking** - Detailed fuel consumption logging
2. **GPS Integration** - Automatic trip logging (mobile app)
3. **Market Valuation API** - Integrate with RedBook/Glass's Guide for vehicle valuations
4. **Asset Loans** - Link loans secured against assets
5. **Insurance Integration** - Automatic policy renewal tracking
6. **Maintenance Scheduling** - Predictive service reminders based on odometer/time
7. **Multi-Asset Comparison** - Compare running costs across vehicles
8. **Carbon Footprint** - Track emissions based on fuel consumption

---

## 16. Related Documentation

- [03_DATA_MODEL.md](./03_DATA_MODEL.md) - Core entity definitions
- [04_GRDCS_SPECIFICATION.md](./04_GRDCS_SPECIFICATION.md) - Relationship linking
- [07_API_STANDARDS.md](./07_API_STANDARDS.md) - API conventions
- [PHASE_05_BACKEND_INTEGRATION.md](./PHASE_05_BACKEND_INTEGRATION.md) - Source type patterns
- [PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md](./PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md) - Tax depreciation

---

## 17. Implementation Notes (2025-12-04)

### Files Created/Modified

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | Added Asset, AssetValueHistory, AssetServiceRecord models |
| `app/api/assets/route.ts` | GET (list) and POST (create) endpoints |
| `app/api/assets/[id]/route.ts` | GET, PUT, DELETE endpoints |
| `app/dashboard/assets/page.tsx` | Full assets UI page |
| `components/DashboardLayout.tsx` | Added Assets to Portfolio navigation group |

### API Endpoints Implemented

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List all user assets with computed totals |
| POST | `/api/assets` | Create new asset |
| GET | `/api/assets/:id` | Get asset with expenses, history, services |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |

### Computed Fields

The API automatically calculates:
- `annualExpenses` - Normalized annual expense total
- `totalExpenses` - Sum of all linked expenses
- `depreciation` - Purchase price minus current value
- `depreciationPercent` - Percentage of value lost
- `totalCostOfOwnership` - Purchase + expenses - sale price
- `costPerKm` - TCO divided by odometer (vehicles only)

---

---

## 18. Transaction Link Dialog Integration

> **Status: IMPLEMENTED** (December 2025)

### 18.1 Asset Source Type in Transaction Linking

When linking bank transactions to create new expense entries via the Transaction Link Dialog, users can now select "Asset" as the expense source type.

**Files Modified:**
- `components/transactions/TransactionLinkDialog.tsx`
- `app/api/transactions/[id]/link/route.ts`

#### Features:
- **Asset Option in Source Dropdown** - Shows Package icon with "Asset" label
- **Asset Selector** - Dropdown to select which asset to link the expense to
- **API Support** - `assetId` field in expense creation payload

#### UI Flow:
1. User clicks on transaction in Transactions page
2. Selects "Create New" tab
3. Chooses "Asset" from Source dropdown
4. Selects the specific asset from the asset dropdown
5. Fills in other expense details (name, category, frequency)
6. Submits to create expense linked to the asset

#### Source Options (Expense):
```
General     - General expenses (default)
Property    - Property-related expenses
Loan        - Loan expenses (auto-sets category)
Investment  - Investment account expenses
Asset       - Asset-related expenses (NEW)
```

This completes **Phase 21.2: Expense Linking** by enabling asset linking from the transaction flow, not just the expense form.

---

*Document Version: 1.2*
*Created: 2025-12-01*
*Updated: 2025-12-18*
*Phase Status: IMPLEMENTED (Core Features + Transaction Linking)*
