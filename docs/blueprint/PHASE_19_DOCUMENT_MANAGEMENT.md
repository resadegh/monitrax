# PHASE 19 — DOCUMENT MANAGEMENT & STORAGE LAYER
**Monitrax Blueprint — Phase 19**
**Version:** v1.5

---

## Overview

Monitrax evolves to become a comprehensive repository for both financial data and supporting documents (PDFs, contracts, valuations, statements, receipts). This phase introduces a fully integrated Document Management System aligned with Monitrax's entity architecture:

- Properties
- Loans
- Expenses
- Income
- Bank/Offset Accounts
- Investment Accounts
- Investment Holdings
- (Optional) Tax & Debt Planner modules

> "Users can upload, preview, organize, and securely store documents in either Monitrax-managed storage or via integration with their own cloud storage providers" (Google Drive at launch).

---

## Objectives

- Add first-class support for document uploads across the entire app
- Automatically link documents to the correct financial entities
- Maintain a consistent, extensible organizational scheme
- Offer both Monitrax's internal storage OR user-managed cloud storage
- Provide a global "Documents Library" for universal access, filtering, and management
- Support previews, metadata, categorization, and multi-entity linking

**Constraints:** No financial logic changes. No UI regressions. No breaking changes to existing models.

---

## Key Principles

- **Zero hallucination:** All document generation, linking, and metadata derives from real entity relationships
- **Zero duplication:** Upload once → link to many entities
- **Auto-organization:** Storage paths mirror Monitrax's financial structure
- **Security-first:** Short-lived signed URLs, encrypted credentials, and strict access control
- **Provider-agnostic:** Storage provider abstraction allows future expansion to iCloud, OneDrive, S3, etc.

---

## Core Features

### 1. Document Uploading

**Upload from:**
- Detail dialogs (Properties, Loans, Expenses, etc.)
- A new Global Documents screen
- Add/Edit forms (e.g., attaching a PDS when creating an insurance expense)

**Supported Types:** PDF, images, DOCX, XLSX, CSV, TXT; max size configurable.

### 2. Document Auto-Linking

> "Documents automatically link to entities based on upload context."

Example: Uploading an Insurance PDS to an Expense linked to a Property automatically creates:
- DocumentLink (EXPENSE → expenseId)
- DocumentLink (PROPERTY → propertyId)

### 3. Storage Provider Abstraction Layer

StorageProvider API ensures the system can swap storage backends without code changes.

**Supported in Phase 19:**
- Monitrax Managed Storage (S3 or Supabase or Render blob)

**Planned:**
- Google Drive Integration (Phase 19B)
- (Future) iCloud Drive, OneDrive

### 4. Global Documents Library

**New screen:** `/dashboard/documents`

**Capabilities:**
- Filter by linked entity
- Filter by category (PDS, Contract, Statement, Tax, etc.)
- Preview documents
- Open in external providers (Google Drive)
- Delete/unlink documents

### 5. Entity "Documents" Tab

Every detail dialog receives a new tab:
`Overview | Loans | Cashflow | Depreciation | Documents`

Each Documents tab includes:
- DocumentUploadDropzone
- DocumentList with previews, metadata, and linked-entity chips

---

## Data Model Additions (Prisma)

### Document
Stores metadata (not the binary file).

```prisma
model Document {
  id                String            @id @default(uuid())
  userId            String
  user              User              @relation(fields: [userId], references: [id])

  filename          String
  originalFilename  String
  mimeType          String
  size              Int               // bytes
  category          DocumentCategory

  // Storage reference
  storageProvider   StorageProviderType @default(MONITRAX)
  storagePath       String            // key/path in storage
  storageUrl        String?           // external URL for Google Drive etc.

  // Metadata
  description       String?
  tags              String[]

  // Links
  links             DocumentLink[]

  // Timestamps
  uploadedAt        DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  deletedAt         DateTime?         // soft delete

  @@index([userId])
  @@index([category])
}
```

### DocumentLink
Polymorphic relationship connecting documents to ANY Monitrax entity.

```prisma
model DocumentLink {
  id            String           @id @default(uuid())
  documentId    String
  document      Document         @relation(fields: [documentId], references: [id], onDelete: Cascade)

  entityType    LinkedEntityType
  entityId      String

  // Optional: which user created the link
  createdAt     DateTime         @default(now())

  @@unique([documentId, entityType, entityId])
  @@index([entityType, entityId])
}
```

### StorageProviderConfig
Per-user configuration for storage provider + OAuth tokens.

```prisma
model StorageProviderConfig {
  id            String              @id @default(uuid())
  userId        String              @unique
  user          User                @relation(fields: [userId], references: [id])

  provider      StorageProviderType
  isActive      Boolean             @default(true)

  // Encrypted OAuth credentials
  accessToken   String?
  refreshToken  String?
  tokenExpiry   DateTime?

  // Provider-specific config
  config        Json?

  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}
```

### Enums

```prisma
enum DocumentCategory {
  CONTRACT
  STATEMENT
  RECEIPT
  TAX
  PDS           // Product Disclosure Statement
  VALUATION
  INSURANCE
  MORTGAGE
  LEASE
  INVOICE
  OTHER
}

enum StorageProviderType {
  MONITRAX
  GOOGLE_DRIVE
  // Future: ONEDRIVE, ICLOUD, S3
}

enum LinkedEntityType {
  PROPERTY
  LOAN
  EXPENSE
  INCOME
  ACCOUNT
  OFFSET_ACCOUNT
  INVESTMENT_ACCOUNT
  INVESTMENT_HOLDING
  TRANSACTION
}
```

---

## Backend Architecture

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents/upload` | POST | Uploads + auto-links files |
| `/api/documents` | GET | Search, filter, list |
| `/api/documents/[id]` | GET | Returns metadata + signed/view URL |
| `/api/documents/[id]` | DELETE | Soft or hard delete |

**Optional Helpers:** `/api/properties/[id]/documents`, etc.

### Storage Providers

**MonitraxStorageProvider**
- S3/supabase/blob storage
- Signed URLs
- Organized hierarchical key paths

**GoogleDriveStorageProvider (Phase 19B)**
- OAuth
- Upload into structured folder tree
- Use Drive's webViewLink

---

## Frontend Components

1. **DocumentUploadDropzone** - Drag-and-drop + file picker
2. **DocumentList** - Preview, metadata, linked chips, provider badges
3. **DocumentBadge** - Small badge indicating number of attached documents
4. **Documents Library Page** - Browser-like explorer with filters, sorting, search
5. **Entity Tab Integrations** - Documents tab added to:
   - Properties
   - Loans
   - Expenses
   - Income
   - Accounts
   - Investment Accounts
   - Investment Holdings

---

## Auto-Organization Logic

### Path Rules (Monitrax storage)

Structured by entity:
```
properties/{propertyId}/expenses/{expenseId}/timestamp_filename.pdf
loans/{loanId}/contracts/...
investment/accounts/{accountId}/statements/...
```

Most specific entity takes precedence.

### Link Rules
- Expense with property? → Link to both
- Holding transaction? → Link to account + holding
- Income linked to property? → Link to both

---

## Security Requirements

- Owner-only access to documents & metadata
- Encrypted OAuth tokens at rest
- Signed URLs < 5 minutes
- Backend-enforced MIME filtering
- Rate limiting to prevent abuse

---

## Implementation Roadmap

### A. Schema & Storage Layer
- Add Prisma models + enums
- Implement storage provider abstraction
- Implement MonitraxStorageProvider

### B. Core API
- /upload, /list, /delete, /view
- Entity helpers (optional)

### C. UI Components
- Dropzone
- List
- Badges

### D. Entity Integration
- Add Documents tab to Property
- Add to Expenses (with multi-link automation)
- Add to Loans
- Add to Accounts, Investments, Holdings
- Add synchronized preview system

### E. Documents Library
- Full UI explorer

### F. Google Drive Integration (19B)
- OAuth flow
- Drive provider implementation
- Storage provider switching UI

---

## Testing Requirements

- Full upload → link → preview → delete flow across all entity types
- Provider failovers
- Storage path correctness
- Metadata correctness
- DocumentLink relational correctness
- Permissions testing (CANNOT access other user)

---

## Acceptance Criteria

Phase 19 is complete when:

1. A user can upload a document to ANY entity
2. The document automatically appears in the correct "Documents" tab
3. The same document is visible in the Global Documents Library
4. The document is correctly stored in the cloud backend
5. The document has correct metadata + linkages
6. Switching to Google Drive works seamlessly (Phase 19B)
7. Zero regressions to calculations or financial logic

---

## Deliverables

- Fully integrated DMS inside Monitrax UI
- Storage abstraction layer
- Complete API suite
- Entity-level Documents tabs
- Global Documents dashboard
- Google Drive integration (sub-phase)

---

## 19.11 IMPLEMENTATION STATUS

**Status:** ✅ CORE IMPLEMENTED
**Started:** 2025-11-30
**Branch:** `claude/continue-ai-strategy-engine-01Y1tCB7457LqYNMe3hwg1Jk`

### 19.11.1 Files Created

| File | Purpose |
|------|---------|
| `lib/documents/types.ts` | Core type definitions (50+ types) |
| `lib/documents/storage/interface.ts` | Storage provider interface |
| `lib/documents/storage/monitraxProvider.ts` | Monitrax storage implementation |
| `lib/documents/storage/factory.ts` | Storage provider factory |
| `lib/documents/storage/index.ts` | Storage module exports |
| `lib/documents/documentService.ts` | Main document service (upload, list, delete, link) |
| `lib/documents/index.ts` | Public API exports |
| `app/api/documents/route.ts` | List and upload API |
| `app/api/documents/[id]/route.ts` | Get, update, delete API |
| `app/api/documents/download/route.ts` | Signed URL file serving |
| `components/documents/DocumentUploadDropzone.tsx` | Drag-and-drop upload component |
| `components/documents/DocumentList.tsx` | Document list with preview |
| `components/documents/DocumentBadge.tsx` | Document count badge |
| `components/documents/index.ts` | Component exports |
| `app/dashboard/documents/page.tsx` | Documents Library page |

### 19.11.2 Prisma Schema Additions

| Model | Fields |
|-------|--------|
| `Document` | id, userId, filename, originalFilename, mimeType, size, category, storageProvider, storagePath, storageUrl, description, tags, uploadedAt, deletedAt |
| `DocumentLink` | id, documentId, entityType, entityId, createdAt |
| `StorageProviderConfig` | id, userId, provider, isActive, accessToken, refreshToken, tokenExpiry, config |

**Enums Added:**
- `DocumentCategory` (11 values)
- `StorageProviderType` (2 values)
- `LinkedEntityType` (9 values)

### 19.11.3 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/documents` | List with filters (category, entity, search, tags) |
| POST | `/api/documents` | Upload with multipart form data |
| GET | `/api/documents/[id]` | Get document with signed URL |
| DELETE | `/api/documents/[id]` | Soft or hard delete |
| PATCH | `/api/documents/[id]` | Add/remove entity links |
| GET | `/api/documents/download` | Serve file via signed URL |

### 19.11.4 UI Features

- **Documents Library Page** (`/dashboard/documents`)
  - Upload dropzone with drag-and-drop
  - Category selection per file
  - Description and tags input
  - Search and category filtering
  - Document list with preview/download/delete
  - Stats cards (total documents, storage used, categories)

- **Document Components**
  - Upload dropzone with file validation
  - Document list with preview dialog
  - Category badges with color coding
  - Entity link chips

### 19.11.5 Storage Provider

- Monitrax provider using local filesystem (dev mode)
- Signed URL generation with HMAC signature
- 5-minute URL expiry for security
- Hierarchical path organization by entity
- Ready for S3/Supabase swap in production

### 19.11.6 Navigation

Added "Documents" to sidebar navigation with FolderOpen icon, positioned after Reports.

### 19.11.7 Supported File Types

PDF, Word (doc/docx), Excel (xls/xlsx), CSV, TXT, Images (jpg/png/gif/webp/heic/heif)

Max file size: 10MB

---

## 19.12 PHASE 19.1 IMPLEMENTATION STATUS

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2025-12-01
**Branch:** `claude/review-blueprint-docs-015uPr1Z4GBmBwKrwso9yTsu`

### 19.12.1 Settings Section Implementation

A comprehensive Settings section has been added to the application sidebar with the following pages:

| Page | Route | Purpose |
|------|-------|---------|
| General | `/dashboard/settings` | Overview and quick access |
| Profile | `/dashboard/settings/profile` | Personal information |
| Security | `/dashboard/settings/security` | Password, 2FA, sessions |
| Cloud Storage | `/dashboard/settings/storage` | Storage provider management |
| Notifications | `/dashboard/settings/notifications` | Email and push preferences |
| Appearance | `/dashboard/settings/appearance` | Theme, currency, dates |
| API Keys | `/dashboard/settings/api-keys` | API access management |
| Billing | `/dashboard/settings/billing` | Subscription and payments |

### 19.12.2 Cloud Storage Provider Integration

| Provider | Status | OAuth Flow |
|----------|--------|------------|
| Monitrax Storage | ✅ Active (default) | N/A - Built-in |
| Google Drive | ✅ Implemented | `/api/oauth/callback/google-drive` |
| iCloud Drive | ✅ Implemented | `/api/oauth/callback/icloud` |
| OneDrive | ✅ Implemented | `/api/oauth/callback/onedrive` |

### 19.12.3 Files Created

| File | Purpose |
|------|---------|
| `app/dashboard/settings/layout.tsx` | Settings layout with side navigation |
| `app/dashboard/settings/page.tsx` | General settings overview |
| `app/dashboard/settings/profile/page.tsx` | Profile management |
| `app/dashboard/settings/storage/page.tsx` | Cloud storage configuration |
| `app/dashboard/settings/notifications/page.tsx` | Notification preferences |
| `app/dashboard/settings/appearance/page.tsx` | Theme and display settings |
| `app/dashboard/settings/api-keys/page.tsx` | API key management |
| `app/dashboard/settings/billing/page.tsx` | Subscription management |
| `app/api/settings/storage/route.ts` | Storage settings API |
| `app/api/settings/storage/connect/[provider]/route.ts` | OAuth initiation |
| `app/api/settings/storage/disconnect/[provider]/route.ts` | Provider disconnection |
| `app/api/settings/storage/active/route.ts` | Active provider selection |
| `app/api/oauth/callback/google-drive/route.ts` | Google Drive OAuth callback |
| `app/api/oauth/callback/icloud/route.ts` | iCloud OAuth callback |
| `app/api/oauth/callback/onedrive/route.ts` | OneDrive OAuth callback |

### 19.12.4 Schema Updates

```prisma
enum StorageProviderType {
  MONITRAX
  GOOGLE_DRIVE
  ICLOUD      // Added in Phase 19.1
  ONEDRIVE    // Added in Phase 19.1
}
```

### 19.12.5 Sidebar Navigation Update

Settings link added to the user section at the bottom of the sidebar with the Settings icon.

### 19.12.6 Environment Variables Required

For cloud storage integrations to work, the following environment variables must be configured:

```env
# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# iCloud (Sign in with Apple)
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=

# OneDrive (Microsoft)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# App URL for OAuth callbacks
NEXT_PUBLIC_APP_URL=
```

---

## 19.13 PHASE 19.2 IMPLEMENTATION STATUS

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2025-12-05
**Branch:** `claude/fix-prompt-length-error-01CjVUZZsrZPvUyS2PmMS6tY`

### 19.13.1 Database Storage Implementation

**Problem:** The Monitrax storage provider was using filesystem storage (`./uploads/documents`) which is ephemeral on platforms like Render. Documents were being lost on every redeploy.

**Solution:** Implemented true database storage using PostgreSQL.

#### Schema Changes

```prisma
model Document {
  // ... existing fields
  fileContent       Bytes?  // NEW: Store file binary content in database
}
```

#### Migration Required

```sql
ALTER TABLE "documents" ADD COLUMN "fileContent" BYTEA;
```

#### Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `fileContent` Bytes field |
| `lib/documents/storage/monitraxProvider.ts` | Rewritten for database storage |
| `lib/documents/documentService.ts` | Store file content in document record |
| `lib/documents/types.ts` | Added `fileBuffer` to upload result |

### 19.13.2 Local Drive Storage Option

**Feature:** Users can save documents directly to their local computer using the browser's File System Access API.

#### Storage Provider Type Added

```prisma
enum StorageProviderType {
  MONITRAX
  GOOGLE_DRIVE
  ICLOUD
  ONEDRIVE
  LOCAL_DRIVE   // NEW: User's local filesystem
}
```

#### Folder Structure (Australian Financial Year)

Documents are organized by Australian Financial Year (July 1 - June 30):

```
[User Selected Folder]/
└── Monitrax/
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

#### Files Created

| File | Purpose |
|------|---------|
| `lib/documents/storage/localDriveService.ts` | Local drive storage service using File System Access API |
| `hooks/useLocalDriveStorage.ts` | React hook for local drive operations |
| `hooks/useDocumentUpload.ts` | Unified upload hook (local or server) |
| `components/documents/LocalDriveStorageCard.tsx` | Settings UI component |

#### Browser Support

| Browser | Support |
|---------|---------|
| Chrome 86+ | ✅ Full support |
| Edge 86+ | ✅ Full support |
| Opera 72+ | ✅ Full support |
| Safari | ❌ Not supported (shows warning) |
| Firefox | ❌ Not supported (shows warning) |

#### Key Features

- **Persistent folder access** - Folder permission stored in IndexedDB across sessions
- **Automatic FY detection** - Uses current date to determine financial year
- **Perfect for tax time** - Just zip the FY folder for accountant

### 19.13.3 Expense Category to Document Folder Mapping

Documents are saved to appropriate folders based on expense category:

| Expense Category | Document Folder |
|-----------------|-----------------|
| INSURANCE | Insurance/ |
| RATES, LAND_TAX | Tax Documents/ |
| LOAN_INTEREST | Mortgage/ |
| UTILITIES | Statements/ |
| STRATA | Invoices/ |
| HOUSING, MAINTENANCE, PERSONAL, FOOD, TRANSPORT, ENTERTAINMENT, REGISTRATION, MODIFICATIONS | Receipts/ |
| OTHER | Other/ |

### 19.13.4 Settings Integration

Local Drive Storage option added to **Settings > Storage** page:

- Displays browser compatibility warning if not supported
- Shows "Select Folder" button to choose local storage location
- Displays folder info (name, file count, financial years)
- Shows folder structure preview
- Disconnect option to clear saved folder handle

### 19.13.5 API Updates

**POST /api/documents** now accepts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `storageProvider` | string | `'LOCAL_DRIVE'` for local storage |
| `localPath` | string | Path where file was saved locally |

For LOCAL_DRIVE uploads:
- File content is NOT stored in database
- Only metadata and local path are stored
- `fileContent` is set to `null`

---

## 19.14 PHASE 19.3 - GOOGLE CLOUD STORAGE INTEGRATION

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2025-12-10
**Branch:** `claude/google-backend-integrations-01DaDaQEvzPyus6apSWk17wo`

### 19.14.1 Overview

Google Cloud Storage (GCS) has been implemented as the primary production storage provider, replacing database storage for better scalability and cost-effectiveness.

### 19.14.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Monitrax Google Cloud Account                    │
│                    (monitrax-479700)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │           monitrax-documents (Single Bucket)             │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │                                                          │   │
│   │   {userId}/                      ← Per-user folder       │   │
│   │   ├── properties/{propId}/       ← Property documents    │   │
│   │   ├── expenses/{expId}/          ← Expense receipts      │   │
│   │   ├── loans/{loanId}/            ← Loan contracts        │   │
│   │   └── general/                   ← Unlinked documents    │   │
│   │                                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **Single bucket** for all users (standard SaaS pattern)
- **Per-user folder isolation** via path prefix (`{userId}/...`)
- **Backend-enforced access control** - users can only access their own paths
- **Service account authentication** - no user Google accounts required

### 19.14.3 Multi-Tenant Storage Model

| Question | Answer |
|----------|--------|
| Who owns the storage? | Monitrax (the business) |
| Do users need Google accounts? | No - Monitrax handles all storage |
| How are users separated? | By folder path (`userId/...`) |
| Who pays for storage? | Monitrax (as infrastructure cost) |
| Is data secure between users? | Yes - backend enforces isolation |

### 19.14.4 Files Created/Modified

| File | Purpose |
|------|---------|
| `lib/documents/storage/googleCloudStorageProvider.ts` | GCS provider implementation |
| `lib/documents/storage/factory.ts` | Updated to support GCS auto-detection |
| `lib/documents/storage/index.ts` | Added GCS exports |
| `lib/documents/types.ts` | Added `GOOGLE_CLOUD_STORAGE` enum |
| `lib/documents/documentService.ts` | Smart provider detection |
| `app/api/storage/health/route.ts` | Storage health check endpoint |

### 19.14.5 Storage Provider Type

```prisma
enum StorageProviderType {
  MONITRAX              // Database storage (fallback)
  GOOGLE_CLOUD_STORAGE  // GCS bucket (primary for production)
  GOOGLE_DRIVE          // User's personal Drive (OAuth)
  ICLOUD
  ONEDRIVE
  LOCAL_DRIVE
}
```

### 19.14.6 Environment Variables

```env
# Required for GCS
GCS_PROJECT_ID=monitrax-479700
GCS_BUCKET_NAME=monitrax-documents
GCS_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>
```

### 19.14.7 Auto-Fallback Behavior

The system automatically selects storage provider:

1. **If GCS configured** → Use Google Cloud Storage
2. **If GCS not configured** → Fall back to database storage (MONITRAX)

This ensures the app works in all environments:
- **Production** (Render): Uses GCS
- **Development** (local): Uses database storage
- **Testing**: Uses database storage

### 19.14.8 Cost Management

#### Pricing (australia-southeast1)

| Cost Type | Price | Notes |
|-----------|-------|-------|
| Storage | ~$0.023/GB/month | Standard storage class |
| Class A ops | $0.05/10,000 | Uploads, list operations |
| Class B ops | $0.004/10,000 | Downloads, metadata |
| Network egress | $0.12/GB | Data transferred to users |

#### Estimated Monthly Costs

| Users | Storage/User | Downloads/User | Est. Cost |
|-------|--------------|----------------|-----------|
| 100 | 50MB | 100 | ~$2-5 |
| 100 | 200MB | 500 | ~$10-20 |
| 500 | 200MB | 500 | ~$50-100 |
| 1000 | 500MB | 1000 | ~$200-400 |

#### Cost Control

1. **Budget Alerts**: Set up in Google Cloud Console → Billing → Budgets
2. **Lifecycle Policies**: Auto-delete soft-deleted files after 30 days
3. **Storage Classes**: Use Standard for frequently accessed, Nearline for archives

### 19.14.9 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/storage/health` | GET | Check storage provider status |

**Response:**
```json
{
  "success": true,
  "storage": {
    "configured": { "monitrax": true, "googleCloudStorage": true },
    "healthy": { "monitrax": true, "googleCloudStorage": true },
    "activeProvider": "google_cloud_storage",
    "googleCloudStorage": {
      "bucket": "monitrax-documents",
      "location": "australia-southeast1",
      "storageClass": "STANDARD"
    }
  }
}
```

### 19.14.10 Security Features

- **Signed URLs**: 5-minute expiry for all file access
- **Service Account**: Limited permissions (Storage Object Admin only)
- **Path Isolation**: Users can only access `{userId}/*` paths
- **No Public Access**: Bucket is private, all access via signed URLs

---

## 19.15 PHASE 25 - DOCUMENT MANAGEMENT ENGINE

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2025-12-10
**Branch:** `claude/google-backend-integrations-01DaDaQEvzPyus6apSWk17wo`

### 19.15.1 Overview

The Document Management Engine (DME) is a centralized orchestration layer that manages all document uploads across the application. Instead of scattered upload logic in multiple components, the DME provides a single entry point that intelligently determines:

- **Where** documents are stored (GCS, Database, Local Drive)
- **How** they are categorized (based on context and content)
- **Which** entities they link to (with automatic cascade linking)
- **What** path structure is used (entity hierarchy with Australian FY)

### 19.15.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Document Upload Entry Points                      │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Documents│  Expense │ Property │   Loan   │   Bank   │    API      │
│  Library │   Form   │   Form   │   Form   │  Import  │   Direct    │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬──────┘
     │          │          │          │          │            │
     ▼          ▼          ▼          ▼          ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Upload Context Builder                            │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Source  │  │ Entities │  │ User Input │  │ File Metadata      │  │
│  │ Type    │  │ Context  │  │ (category, │  │ (name, type, size) │  │
│  │         │  │          │  │  tags, etc)│  │                    │  │
│  └────┬────┘  └────┬─────┘  └─────┬──────┘  └──────────┬─────────┘  │
└───────┴────────────┴──────────────┴────────────────────┴────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DOCUMENT MANAGEMENT ENGINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Rule Engine                              │    │
│  ├──────────────┬──────────────┬───────────────┬────────────────┤    │
│  │ StorageRules │ CategoryRules│ LinkingRules  │   PathRules    │    │
│  │ (Priority:   │ (Auto-detect │ (Cascade      │ (Entity        │    │
│  │  100-10)     │  category)   │  linking)     │  hierarchy)    │    │
│  └──────────────┴──────────────┴───────────────┴────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Resolved Config                           │    │
│  │  • Storage Provider (GCS/DB/LocalDrive)                     │    │
│  │  • Category (TAX/RECEIPT/CONTRACT/etc.)                     │    │
│  │  • Entity Links [(EXPENSE, id), (PROPERTY, id)]             │    │
│  │  • Storage Path (userId/properties/xxx/FY24-25/receipts/)   │    │
│  │  • Suggested Tags                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Storage Execution                                │
├────────────────────┬────────────────────┬───────────────────────────┤
│    GCS Provider    │   DB Provider      │   Local Drive Provider    │
│    (Production)    │   (Fallback)       │   (User's Computer)       │
└────────────────────┴────────────────────┴───────────────────────────┘
```

### 19.15.3 Files Created

| File | Purpose |
|------|---------|
| `lib/documents/engine/types.ts` | Core type definitions (UploadContext, EntityContext, Rules) |
| `lib/documents/engine/rules/StorageRules.ts` | Priority-based storage provider selection |
| `lib/documents/engine/rules/CategoryRules.ts` | Auto-categorization from expense type/filename |
| `lib/documents/engine/rules/LinkingRules.ts` | Entity linking with cascade logic |
| `lib/documents/engine/rules/PathRules.ts` | Intelligent path generation with FY support |
| `lib/documents/engine/rules/index.ts` | Rules module exports |
| `lib/documents/engine/RuleEngine.ts` | Rule processing orchestrator |
| `lib/documents/engine/DocumentManagementEngine.ts` | Main engine singleton |
| `lib/documents/engine/index.ts` | Engine public exports |
| `hooks/useDocumentEngine.ts` | React hook for uploads |
| `app/api/documents/upload/route.ts` | Unified upload API endpoint |
| `lib/documents/constants.ts` | Centralized constants |

### 19.15.4 Storage Rules (Priority-Based)

| Priority | Rule Name | Condition | Provider |
|----------|-----------|-----------|----------|
| 100 | User Preference | User explicitly selects provider | Selected |
| 90 | Local Drive Request | User requests local storage | LOCAL_DRIVE |
| 80 | Tax Documents | Category is TAX | GCS (for backup) |
| 70 | Large Files | Size > 5MB | GCS |
| 50 | GCS Available | GCS is configured | GCS |
| 10 | Default | Always matches | MONITRAX (DB) |

### 19.15.5 Category Rules

**Expense Category Mapping:**

| Expense Category | Document Category |
|-----------------|-------------------|
| INSURANCE | INSURANCE |
| RATES, LAND_TAX | TAX |
| LOAN_INTEREST | MORTGAGE |
| UTILITIES | STATEMENT |
| STRATA | INVOICE |
| HOUSING, MAINTENANCE, etc. | RECEIPT |

**Filename Pattern Detection:**

| Pattern | Category |
|---------|----------|
| `*contract*`, `*agreement*` | CONTRACT |
| `*statement*` | STATEMENT |
| `*receipt*` | RECEIPT |
| `*invoice*` | INVOICE |
| `*tax*` | TAX |
| `*insurance*`, `*policy*` | INSURANCE |
| `*mortgage*`, `*loan*` | MORTGAGE |

### 19.15.6 Entity Linking with Cascade

**Cascade Rules:**
- Expense with Property → Link to both EXPENSE and PROPERTY
- Expense with Loan → Link to EXPENSE, LOAN, and any linked PROPERTY
- Income with Property → Link to both INCOME and PROPERTY
- Transaction with Account → Link to TRANSACTION and ACCOUNT

**Example Cascade:**
```
Upload from Expense Form
├── Expense ID: exp_123 (linked to Property prop_456)
└── Engine creates:
    ├── DocumentLink(EXPENSE, exp_123)
    └── DocumentLink(PROPERTY, prop_456)
```

### 19.15.7 Path Generation

**Path Template:**
```
{userId}/{entityType}/{entityId}/FY{year}/{ category}/{timestamp}_{filename}
```

**Examples:**
```
abc123/properties/prop_456/FY24-25/receipts/20251210_receipt.pdf
abc123/expenses/exp_789/FY24-25/invoices/20251210_invoice.pdf
abc123/general/FY24-25/contracts/20251210_lease.pdf
```

**Australian Financial Year:**
- FY starts July 1, ends June 30
- FY24-25 = July 2024 - June 2025

### 19.15.8 React Hook Usage

```typescript
import { useDocumentEngine, createExpenseUploadOptions } from '@/hooks/useDocumentEngine';

function ExpenseForm() {
  const { upload, isUploading, progress, error } = useDocumentEngine();

  const handleUpload = async (file: File) => {
    const options = createExpenseUploadOptions(
      expenseId,
      propertyId,
      loanId,
      expenseCategory
    );

    const document = await upload(file, options);
    if (document) {
      console.log('Uploaded:', document.id);
    }
  };
}
```

### 19.15.9 API Endpoint

**POST /api/documents/upload**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | File | Yes | The file to upload |
| source | string | No | Upload source (defaults to API_DIRECT) |
| propertyId | string | No | Link to property |
| expenseId | string | No | Link to expense |
| loanId | string | No | Link to loan |
| incomeId | string | No | Link to income |
| accountId | string | No | Link to account |
| category | string | No | Force category |
| tags | string | No | Comma-separated tags |
| storagePreference | string | No | Force storage provider |

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "doc_abc123",
    "filename": "receipt_8f4a2b1c.pdf",
    "originalFilename": "receipt.pdf",
    "category": "RECEIPT",
    "storageProvider": "GOOGLE_CLOUD_STORAGE",
    "storagePath": "user123/expenses/exp_456/FY24-25/receipts/...",
    "links": [
      { "entityType": "EXPENSE", "entityId": "exp_456" },
      { "entityType": "PROPERTY", "entityId": "prop_789" }
    ]
  },
  "storagePath": "...",
  "storageUrl": "https://storage.googleapis.com/..."
}
```

---

## 19.16 Future Enhancements

The following features are planned for future iterations:

1. **Entity Documents Tab** - Add Documents tab to Property, Loan, Expense pages
2. ~~**Auto-linking Rules** - Smart linking based on upload context~~ ✅ (Phase 25)
3. **Document Versioning** - Track document revisions
4. **Bulk Upload** - Upload multiple files at once
5. **Document Search** - Full-text search within documents (OCR)
6. **Document Analysis (OCR)** - Auto-populate expense fields from receipts
7. **iCloud CloudKit Integration** - Full CloudKit API for file storage
8. **Dropbox Integration** - Additional storage provider option
9. **Local Drive Sync** - Sync documents between local drive and cloud storage
10. **GCS Lifecycle Policies** - Auto-archive old documents to Nearline storage
11. **Storage Analytics** - Per-user storage usage dashboard
