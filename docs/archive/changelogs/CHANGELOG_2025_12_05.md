# MONITRAX CHANGELOG — December 5, 2025

**Session ID:** claude/fix-prompt-length-error-01CjVUZZsrZPvUyS2PmMS6tY
**Date:** 2025-12-05
**Status:** Implemented & Pushed

---

## Summary of Changes

This session focused on fixing document storage issues and implementing local drive storage for better document organization aligned with Australian Financial Year requirements.

---

## 1. Database Storage for Documents

**Type:** Bug Fix (Critical)
**Files Modified:**
- `prisma/schema.prisma`
- `lib/documents/storage/monitraxProvider.ts`
- `lib/documents/documentService.ts`
- `lib/documents/types.ts`

### Problem
The Monitrax storage provider was using filesystem storage (`./uploads/documents`) which is ephemeral on platforms like Render. Documents were being lost on every redeploy.

### Solution
Implemented true database storage using PostgreSQL BYTEA column.

#### Schema Change
```prisma
model Document {
  // ... existing fields
  fileContent       Bytes?  // Store file binary content in database
}
```

#### Migration Required
```sql
ALTER TABLE "documents" ADD COLUMN "fileContent" BYTEA;
```

### Impact
- Documents now persist across deployments
- No dependency on filesystem storage
- Maximum file size: 10MB (reasonable for receipts/documents)

---

## 2. Local Drive Storage Option

**Type:** New Feature
**Files Created:**
- `lib/documents/storage/localDriveService.ts`
- `hooks/useLocalDriveStorage.ts`
- `hooks/useDocumentUpload.ts`
- `components/documents/LocalDriveStorageCard.tsx`

**Files Modified:**
- `app/dashboard/settings/storage/page.tsx`
- `prisma/schema.prisma`
- `lib/documents/types.ts`

### Problem
Users wanted to save documents locally for easy access during tax time and sharing with accountants.

### Solution
Implemented local drive storage using the browser's File System Access API.

#### New Storage Provider
```prisma
enum StorageProviderType {
  MONITRAX
  GOOGLE_DRIVE
  ICLOUD
  ONEDRIVE
  LOCAL_DRIVE   // NEW
}
```

#### Australian Financial Year Folder Structure
```
[User Folder]/Monitrax/
├── FY2024-25/
│   ├── Receipts/
│   ├── Statements/
│   ├── Tax Documents/
│   ├── Contracts/
│   ├── Insurance/
│   ├── Mortgage/
│   ├── Leases/
│   ├── Invoices/
│   ├── Product Disclosures/
│   ├── Valuations/
│   └── Other/
└── FY2023-24/
    └── (same structure)
```

#### Key Features
- Automatic Financial Year detection (July 1 - June 30)
- Persistent folder access via IndexedDB
- Browser support: Chrome 86+, Edge 86+, Opera 72+
- Category-based folder organization
- Perfect for tax preparation

### Browser Compatibility
| Browser | Support |
|---------|---------|
| Chrome 86+ | ✅ |
| Edge 86+ | ✅ |
| Opera 72+ | ✅ |
| Safari | ❌ (warning shown) |
| Firefox | ❌ (warning shown) |

---

## 3. Unified Document Upload Hook

**Type:** Feature Enhancement
**Files Created:**
- `hooks/useDocumentUpload.ts`

### Purpose
Created a unified hook that handles document uploads to either local drive or server storage based on user configuration.

```typescript
const { upload, isUploading, storageMode } = useDocumentUpload();

// Automatically uses local drive if configured, otherwise server storage
await upload(file, {
  category: DocumentCategory.RECEIPT,
  description: 'Receipt for expense',
  links: [{ entityType: 'EXPENSE', entityId: '...' }],
  entityName: 'Expense Name', // For folder organization
});
```

---

## 4. Expense Category to Document Folder Mapping

**Type:** Feature Enhancement
**Files Modified:**
- `app/dashboard/expenses/page.tsx`

### Problem
Documents were always saved to "Receipts" folder regardless of expense category.

### Solution
Added mapping from expense category to appropriate document folder:

| Expense Category | Document Folder |
|-----------------|-----------------|
| INSURANCE | Insurance/ |
| RATES, LAND_TAX | Tax Documents/ |
| LOAN_INTEREST | Mortgage/ |
| UTILITIES | Statements/ |
| STRATA | Invoices/ |
| HOUSING, MAINTENANCE, etc. | Receipts/ |
| OTHER | Other/ |

---

## 5. Settings Page Updates

**Type:** UI Enhancement
**Files Modified:**
- `app/dashboard/settings/storage/page.tsx`

### Changes
- Added LocalDriveStorageCard component to storage settings
- Added "Organize by Financial Year (Australian)" option
- Shows folder structure preview
- Displays connected folder info and file count

---

## Commit History

| Commit | Message |
|--------|---------|
| `c5d1d6d` | fix(documents): implement database storage for document uploads |
| `41763ad` | feat(documents): add local drive storage option with FY organization |
| `aa11f78` | fix(documents): integrate local drive storage with expense uploads |
| `28c262c` | fix(documents): save documents to correct category folder based on expense type |

---

## Testing Notes

- All changes passed TypeScript compilation (`npx tsc --noEmit`)
- Local drive storage tested on Chrome/Edge
- Folder structure creation verified
- Category mapping verified for all expense types

---

## Related Blueprint Phases

- **Phase 19** — Document Management & Storage Layer (Updated)
- **Phase 19.1** — Document Management System Expansion
- **Phase 19.2** — Database Storage & Local Drive (NEW - this session)

---

## Database Migration Required

After deployment, run:

```sql
ALTER TABLE "documents" ADD COLUMN "fileContent" BYTEA;
```

---

*Document Version: 1.0*
*Created: 2025-12-05*
