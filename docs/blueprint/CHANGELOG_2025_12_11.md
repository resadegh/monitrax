# MONITRAX CHANGELOG — December 11, 2025

**Session ID:** claude/continue-session-01BTVc9M2B1mWrWBpgf6N3bM
**Date:** 2025-12-11
**Status:** Implemented & Pushed

---

## Summary of Changes

This session implemented the Intelligent Document Folder Structure with entity-based navigation and configurable ZIP export functionality for the Documents page.

---

## 1. Entity Lookup Service

**Type:** New Feature
**Severity:** High
**Files Created:**
- `lib/documents/entityLookup.ts`

### Overview

A centralized service for batch-fetching entity information (names, parent relationships) to populate the document folder tree with actual entity names instead of generic labels.

### Features

| Function | Purpose |
|----------|---------|
| `lookupEntities()` | Batch lookup entity names by IDs for document links |
| `getAllUserEntities()` | Get all entities for folder tree population |

### Supported Entity Types

| Entity Type | Fields Retrieved | Parent Entity |
|-------------|-----------------|---------------|
| Property | name, address | - |
| Loan | name, type | Property |
| Expense | name, category | Property |
| Income | name, type | Property |
| Account | name, institution, type | - |
| InvestmentAccount | name, platform | - |
| InvestmentHolding | name, ticker | InvestmentAccount |

### Code Example

```typescript
import { lookupEntities, getAllUserEntities } from '@/lib/documents/entityLookup';

// Batch lookup specific entities
const entityInfo = await lookupEntities(userId, [
  { entityType: 'PROPERTY', entityId: 'prop_123' },
  { entityType: 'EXPENSE', entityId: 'exp_456' },
]);

// Get all user entities for folder tree
const allEntities = await getAllUserEntities(userId);
// Returns: { properties, loans, expenses, income, accounts, investmentAccounts }
```

---

## 2. Documents Entities API

**Type:** New Feature
**Severity:** Medium
**Files Created:**
- `app/api/documents/entities/route.ts`

### Endpoint

**GET /api/documents/entities**

Returns all user entities for building the folder tree navigation.

### Response

```json
{
  "properties": [
    { "id": "prop_123", "name": "123 Guildford Rd", "type": "PROPERTY" }
  ],
  "loans": [
    {
      "id": "loan_456",
      "name": "Investment Loan",
      "type": "LOAN",
      "parentId": "prop_123",
      "parentName": "123 Guildford Rd",
      "parentType": "PROPERTY"
    }
  ],
  "expenses": [...],
  "income": [...],
  "accounts": [...],
  "investmentAccounts": [...]
}
```

---

## 3. Document Export API (ZIP)

**Type:** New Feature
**Severity:** High
**Files Created:**
- `app/api/documents/export/route.ts`

### Overview

Server-side ZIP generation for document export with configurable folder structure options.

### Endpoint

**POST /api/documents/export**

### Request Body

```json
{
  "path": "/",                          // Current folder path to export from
  "documentIds": ["doc_1", "doc_2"],   // Specific documents (optional)
  "structure": "financial-year-first", // Folder structure option
  "includeSubFolders": true            // Include nested folders
}
```

### Export Structure Options

| Option | Folder Hierarchy | Example Path |
|--------|-----------------|--------------|
| `financial-year-first` | FY → Entity → Category | `FY24-25/Properties/Guildford/Receipts/doc.pdf` |
| `entity-first` | Entity → FY → Category | `Properties/Guildford/FY24-25/Receipts/doc.pdf` |
| `category-first` | Category → FY → Entity | `Receipts/FY24-25/Properties/Guildford/doc.pdf` |

### Response

Returns a ZIP file with:
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="Monitrax_Documents_2025-12-11.zip"`

### Features

- **Australian Financial Year**: July 1 - June 30 (e.g., FY24-25)
- **Entity Hierarchy**: Documents organized by linked entities
- **Category Subfolders**: Receipts, Contracts, Tax_Documents, etc.
- **Duplicate Handling**: Auto-rename with `_1`, `_2` suffixes
- **Storage Agnostic**: Downloads from GCS or database storage

### Category Folder Names

| Category | Folder Name |
|----------|-------------|
| CONTRACT | Contracts |
| STATEMENT | Statements |
| RECEIPT | Receipts |
| TAX | Tax_Documents |
| PDS | Product_Disclosures |
| VALUATION | Valuations |
| INSURANCE | Insurance |
| MORTGAGE | Mortgage |
| LEASE | Leases |
| INVOICE | Invoices |
| OTHER | Other |

---

## 4. Storage Provider Download Method

**Type:** Enhancement
**Severity:** Medium
**Files Modified:**
- `lib/documents/storage/interface.ts`
- `lib/documents/storage/monitraxProvider.ts`
- `lib/documents/storage/googleCloudStorageProvider.ts`

### Overview

Added `download()` method to storage provider interface for ZIP export functionality.

### Interface Addition

```typescript
interface IStorageProvider {
  // ... existing methods

  /**
   * Download file contents from storage
   * Returns the file data as a Buffer
   */
  download(storagePath: string): Promise<{
    success: boolean;
    data?: Buffer;
    error?: string;
  }>;
}
```

### Implementation

**MonitraxProvider (Database Storage):**
```typescript
async download(storagePath: string) {
  const document = await prisma.document.findFirst({
    where: { storagePath, deletedAt: null },
    select: { fileContent: true },
  });
  return { success: true, data: Buffer.from(document.fileContent) };
}
```

**GoogleCloudStorageProvider:**
```typescript
async download(storagePath: string) {
  const [buffer] = await this.bucket.file(storagePath).download();
  return { success: true, data: buffer };
}
```

---

## 5. Updated Documents Page

**Type:** Enhancement
**Severity:** High
**Files Modified:**
- `app/dashboard/documents/page.tsx`
- `components/documents/FolderTree.tsx`

### New Features

#### 5.1 Entity Drill-Down Navigation

The folder tree now shows actual entity names with drill-down capability:

```
📁 By Entity
├── 📁 Properties
│   ├── 📁 123 Guildford Rd (7)
│   └── 📁 45 Smith Street (3)
├── 📁 Expenses
│   ├── 📁 Insurance Premium (2)
│   └── 📁 Council Rates (1)
├── 📁 Loans
│   └── 📁 Investment Loan (4)
└── 📁 Accounts
    └── 📁 CBA Everyday (2)
```

#### 5.2 Export Dialog

New export UI with structure selection:

```tsx
<ExportDialog
  open={showExportDialog}
  onClose={() => setShowExportDialog(false)}
  currentPath={currentPath}
  selectedCount={selectedDocuments.length}
/>
```

#### 5.3 Export Options UI

| Option | Label | Description |
|--------|-------|-------------|
| `financial-year-first` | Financial Year First | FY24-25 / Properties / Name / Category |
| `entity-first` | Entity First | Properties / Name / FY24-25 / Category |
| `category-first` | Category First | Category / FY24-25 / Properties / Name |

---

## 6. Package Dependencies

**Type:** Enhancement
**Files Modified:**
- `package.json`

### Added Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jszip` | ^3.10.1 | Server-side ZIP file generation |

---

## 7. TypeScript Build Fixes

**Type:** Bug Fix
**Severity:** Critical

### Issues Resolved

| Issue | File | Fix |
|-------|------|-----|
| `symbol` doesn't exist on InvestmentHolding | `entityLookup.ts:217` | Changed to `ticker` |
| `category` doesn't exist on Income | `entityLookup.ts` | Changed to `type` |
| `BankAccount` model not found | `entityLookup.ts` | Changed to `Account` |
| `accountType` field not found | `entityLookup.ts` | Changed to `type` |
| `lender` field not found on Loan | `entityLookup.ts` | Changed to `type` |
| `null` not assignable to `string \| undefined` | `entityLookup.ts` | Added `?? undefined` |
| `Uint8Array` not assignable to `BlobPart` | `export/route.ts` | Used `new Uint8Array().buffer as ArrayBuffer` |

---

## Files Summary

| Action | File | Change Type |
|--------|------|-------------|
| Created | `lib/documents/entityLookup.ts` | Entity lookup service |
| Created | `app/api/documents/entities/route.ts` | Entities API endpoint |
| Created | `app/api/documents/export/route.ts` | ZIP export API endpoint |
| Modified | `lib/documents/storage/interface.ts` | Added download() method |
| Modified | `lib/documents/storage/monitraxProvider.ts` | Implemented download() |
| Modified | `lib/documents/storage/googleCloudStorageProvider.ts` | Implemented download() |
| Modified | `app/dashboard/documents/page.tsx` | Entity drill-down, export UI |
| Modified | `components/documents/FolderTree.tsx` | Entity navigation |
| Modified | `package.json` | Added jszip dependency |
| Created | `docs/blueprint/CHANGELOG_2025_12_11.md` | This document |

---

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/documents/entities` | Get all user entities for folder tree |
| POST | `/api/documents/export` | Export documents as ZIP |

---

## Testing Notes

- Entity lookup returns correct parent relationships
- ZIP export generates valid archive with correct folder structure
- All three export structure options work correctly
- Australian Financial Year calculation is accurate (July 1 - June 30)
- TypeScript build passes with no errors

---

## Related Blueprint Phases

- **Phase 19** — Document Management (Section 19.16)
- **Phase 25** — Document Management Engine

---

*Document Version: 1.0*
*Created: 2025-12-11*
