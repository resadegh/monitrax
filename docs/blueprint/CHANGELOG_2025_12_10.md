# MONITRAX CHANGELOG — December 10, 2025

**Session ID:** claude/google-backend-integrations-01DaDaQEvzPyus6apSWk17wo
**Date:** 2025-12-10
**Status:** Implemented & Pushed

---

## Summary of Changes

This session addressed multiple deployment issues with Google integrations (GCS, Places API) and implemented the comprehensive Document Management Engine (Phase 25) to centralize all document upload logic.

---

## 1. Google Cloud Storage Configuration Fixes

**Type:** Bug Fix
**Severity:** Critical
**Files Modified:**
- `lib/documents/storage/factory.ts`
- `lib/documents/storage/googleCloudStorageProvider.ts`
- `app/api/storage/health/route.ts`
- `app/dashboard/settings/storage/page.tsx`

### Problem

1. **Storage status stuck on "checking"**: The storage health check wasn't properly handling GCS initialization errors
2. **GCS not receiving uploads**: The `isGCSConfigured` function only checked `GCS_PROJECT_ID` and `GCS_BUCKET_NAME`, missing `GCS_SERVICE_ACCOUNT_KEY`
3. **No error visibility**: GCS initialization errors weren't being surfaced to the UI

### Solution

#### 1.1 Fixed isGCSConfigured Check

```typescript
// Before (incomplete)
export function isGCSConfigured(): boolean {
  return !!(process.env.GCS_PROJECT_ID && process.env.GCS_BUCKET_NAME);
}

// After (complete)
export function isGCSConfigured(): boolean {
  const configured = !!(
    process.env.GCS_PROJECT_ID &&
    process.env.GCS_BUCKET_NAME &&
    process.env.GCS_SERVICE_ACCOUNT_KEY  // Now required
  );
  return configured;
}
```

#### 1.2 Enhanced Storage Health Endpoint

```typescript
// Added GCS initialization error tracking
let gcsInitError: string | null = null;

if (isGCSConfigured()) {
  try {
    const gcs = getGoogleCloudStorageProvider();
    const gcsHealthy = await gcs.isHealthy();
    // ... handle result
  } catch (initError) {
    gcsInitError = initError instanceof Error ? initError.message : 'GCS init failed';
  }
}

// Added 'ready' state for UI consumption
return NextResponse.json({
  storage: {
    ready: gcsHealthy || monitraxHealthy,  // At least one provider working
    error: gcsInitError,
    // ... other fields
  }
});
```

#### 1.3 Updated Storage Settings Page

```tsx
// Now shows ready state and error messages
const status = data.ready ? 'Active' : 'Error';
const showError = data.error && !data.ready;
```

---

## 2. Google Places API Error Logging

**Type:** Enhancement
**Severity:** Medium
**Files Modified:**
- `app/api/places/autocomplete/route.ts`
- `app/api/places/details/route.ts`

### Problem

Address autocomplete was not finding addresses, but there was no visibility into why (API key issues, REQUEST_DENIED, etc.).

### Solution

Added comprehensive error logging:

```typescript
console.log('[Places Autocomplete] Request:', {
  hasApiKey: !!GOOGLE_PLACES_API_KEY,
  apiKeyPrefix: GOOGLE_PLACES_API_KEY?.slice(0, 10),
  input: query,
});

// Log full API response for debugging
console.log('[Places Autocomplete] API Response:', {
  status: data.status,
  predictions: data.predictions?.length || 0,
  error_message: data.error_message,
});
```

---

## 3. Documents Page Folder Structure Rewrite

**Type:** Feature Enhancement
**Severity:** High
**Files Modified:**
- `app/dashboard/documents/page.tsx`

### Overview

Completely rewrote the Documents page to support folder-based navigation with:
- Sidebar folder tree navigation
- Category/Financial Year/Entity hierarchy
- Breadcrumb navigation
- Grid and list view toggle
- Document counts per folder

### Components Added

| Component | Purpose |
|-----------|---------|
| `FolderTree` | Sidebar navigation with expandable folders |
| `DocumentBreadcrumb` | Path navigation with clickable segments |
| `DocumentFolderView` | Grid/list display of folder contents |

### Folder Structure

```
📁 All Documents
├── 📁 By Category
│   ├── 📁 Receipts (12)
│   ├── 📁 Contracts (5)
│   └── 📁 Tax Documents (3)
├── 📁 By Financial Year
│   ├── 📁 FY 2024-25 (15)
│   └── 📁 FY 2023-24 (8)
└── 📁 By Entity
    ├── 📁 Properties
    │   └── 📁 123 Main St (7)
    └── 📁 Expenses
        └── 📁 Insurance (4)
```

---

## 4. Document Management Engine (Phase 25)

**Type:** New Feature
**Severity:** Major
**Files Created:**
- `lib/documents/engine/types.ts`
- `lib/documents/engine/rules/StorageRules.ts`
- `lib/documents/engine/rules/CategoryRules.ts`
- `lib/documents/engine/rules/LinkingRules.ts`
- `lib/documents/engine/rules/PathRules.ts`
- `lib/documents/engine/rules/index.ts`
- `lib/documents/engine/RuleEngine.ts`
- `lib/documents/engine/DocumentManagementEngine.ts`
- `lib/documents/engine/index.ts`
- `hooks/useDocumentEngine.ts`
- `app/api/documents/upload/route.ts`
- `lib/documents/constants.ts`
- `docs/blueprint/PHASE_25_DOCUMENT_MANAGEMENT_ENGINE.md`

**Files Modified:**
- `lib/documents/index.ts`
- `docs/blueprint/PHASE_19_DOCUMENT_MANAGEMENT.md`
- `docs/blueprint/MASTER_BLUEPRINT.md`

### Overview

The Document Management Engine (DME) is a centralized orchestration layer that manages all document uploads. Instead of scattered logic across multiple components, the DME provides intelligent, context-aware document handling.

### Key Features

#### 4.1 Upload Context

Every upload creates a rich context:

```typescript
interface UploadContext {
  source: UploadSource;           // Where upload initiated
  file: File | Buffer;            // The file
  filename: string;               // Original filename
  mimeType: string;               // MIME type
  size: number;                   // File size in bytes
  entities: EntityContext;        // Linked entities
  userInput: UserInput;           // User preferences
  userId: string;                 // Owner
  timestamp: Date;                // Upload time
}
```

#### 4.2 Storage Rules (Priority-Based)

| Priority | Rule | Condition | Result |
|----------|------|-----------|--------|
| 100 | User Preference | User selects provider | Selected provider |
| 90 | Local Drive | Request local storage | LOCAL_DRIVE |
| 80 | Tax Documents | Category is TAX | GCS (for backup) |
| 70 | Large Files | Size > 5MB | GCS |
| 50 | GCS Available | GCS configured | GCS |
| 10 | Default | Always | Database |

#### 4.3 Category Auto-Detection

**From Expense Category:**

| Expense Category | Document Category |
|-----------------|-------------------|
| INSURANCE | INSURANCE |
| RATES, LAND_TAX | TAX |
| LOAN_INTEREST | MORTGAGE |
| UTILITIES | STATEMENT |
| STRATA | INVOICE |
| HOUSING, MAINTENANCE | RECEIPT |

**From Filename Patterns:**

| Pattern | Category |
|---------|----------|
| `*contract*`, `*agreement*` | CONTRACT |
| `*statement*` | STATEMENT |
| `*receipt*` | RECEIPT |
| `*invoice*` | INVOICE |
| `*tax*` | TAX |

#### 4.4 Cascade Entity Linking

When uploading to an expense that's linked to a property:

```
Upload → Expense(exp_123) → Property(prop_456)
                ↓
DocumentLinks created:
├── (EXPENSE, exp_123)
└── (PROPERTY, prop_456)
```

#### 4.5 Intelligent Path Generation

Paths follow entity hierarchy with Australian Financial Year:

```
{userId}/properties/{propId}/FY24-25/receipts/{timestamp}_{filename}
{userId}/expenses/{expId}/FY24-25/invoices/{timestamp}_{filename}
{userId}/general/FY24-25/contracts/{timestamp}_{filename}
```

### API Usage

**React Hook:**

```typescript
import { useDocumentEngine, createExpenseUploadOptions } from '@/hooks/useDocumentEngine';

function ExpenseForm() {
  const { upload, isUploading, progress } = useDocumentEngine();

  const handleUpload = async (file: File) => {
    const options = createExpenseUploadOptions(expenseId, propertyId);
    const document = await upload(file, options);
  };
}
```

**Direct API:**

```bash
curl -X POST /api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@receipt.pdf" \
  -F "source=expense_form" \
  -F "expenseId=exp_123" \
  -F "propertyId=prop_456"
```

---

## 5. Blueprint Documentation Updates

**Type:** Documentation
**Severity:** Low
**Files Modified:**
- `docs/blueprint/MASTER_BLUEPRINT.md` (v2.1 → v2.2)
- `docs/blueprint/PHASE_19_DOCUMENT_MANAGEMENT.md`

### Changes

1. **Master Blueprint:**
   - Added Phase 25 to completed phases
   - Added Document Management Engine to Core Engines list
   - Updated phase count (24 → 25)
   - Updated file storage description
   - Updated Document Management section with Phase 25 details

2. **Phase 19 Document:**
   - Added Section 19.15: Phase 25 Document Management Engine
   - Full architecture diagrams
   - Storage/Category/Linking/Path rules documentation
   - React hook usage examples
   - API endpoint documentation
   - Updated future enhancements list

---

## Files Summary

| Action | File | Change Type |
|--------|------|-------------|
| Modified | `lib/documents/storage/factory.ts` | Fixed isGCSConfigured |
| Modified | `lib/documents/storage/googleCloudStorageProvider.ts` | Added logging |
| Modified | `app/api/storage/health/route.ts` | Error tracking, ready state |
| Modified | `app/dashboard/settings/storage/page.tsx` | UI error display |
| Modified | `app/api/places/autocomplete/route.ts` | Error logging |
| Modified | `app/api/places/details/route.ts` | Error logging |
| Rewritten | `app/dashboard/documents/page.tsx` | Folder structure view |
| Created | `lib/documents/engine/types.ts` | Engine types |
| Created | `lib/documents/engine/rules/StorageRules.ts` | Storage provider rules |
| Created | `lib/documents/engine/rules/CategoryRules.ts` | Category detection |
| Created | `lib/documents/engine/rules/LinkingRules.ts` | Entity linking |
| Created | `lib/documents/engine/rules/PathRules.ts` | Path generation |
| Created | `lib/documents/engine/rules/index.ts` | Rules exports |
| Created | `lib/documents/engine/RuleEngine.ts` | Rule processor |
| Created | `lib/documents/engine/DocumentManagementEngine.ts` | Main engine |
| Created | `lib/documents/engine/index.ts` | Engine exports |
| Created | `hooks/useDocumentEngine.ts` | React hook |
| Created | `app/api/documents/upload/route.ts` | Unified upload API |
| Created | `lib/documents/constants.ts` | Constants |
| Modified | `lib/documents/index.ts` | Engine exports |
| Created | `docs/blueprint/PHASE_25_DOCUMENT_MANAGEMENT_ENGINE.md` | Blueprint |
| Modified | `docs/blueprint/PHASE_19_DOCUMENT_MANAGEMENT.md` | Added Phase 25 |
| Modified | `docs/blueprint/MASTER_BLUEPRINT.md` | Added Phase 25 |
| Created | `docs/blueprint/CHANGELOG_2025_12_10.md` | This document |

---

## Testing Notes

- TypeScript compilation passes
- GCS provider properly initializes with service account key
- Storage health endpoint returns accurate status
- Document uploads route through engine correctly
- Entity linking cascade works as designed
- Path generation uses Australian FY format

---

## Related Blueprint Phases

- **Phase 19** — Document Management (infrastructure updates)
- **Phase 19.3** — Google Cloud Storage Integration (fixes)
- **Phase 25** — Document Management Engine (NEW)

---

*Document Version: 1.0*
*Created: 2025-12-10*
