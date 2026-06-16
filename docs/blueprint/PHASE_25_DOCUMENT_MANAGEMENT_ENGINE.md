# PHASE 25 — DOCUMENT MANAGEMENT ENGINE
**Monitrax Blueprint — Phase 25**
**Version:** v1.0
**Status:** Implementation
**Created:** 2025-12-10
**Branch:** `claude/google-backend-integrations-01DaDaQEvzPyus6apSWk17wo`

---

## 1. Executive Summary

The Document Management Engine (DME) is a centralized, intelligent system that orchestrates all document operations in Monitrax. Unlike the previous approach where upload logic was scattered across components, the DME provides:

- **Unified Entry Point**: Single API for all document uploads across the application
- **Context-Aware Routing**: Intelligent storage decisions based on upload context
- **Rule-Based Organization**: Automatic categorization, linking, and folder placement
- **Provider Abstraction**: Seamless switching between storage backends
- **Compliance Ready**: Audit trails, retention policies, and access control

> "Upload once, organize automatically, access everywhere"

---

## 2. Problem Statement

### Current Architecture Issues

| Issue | Impact |
|-------|--------|
| Scattered upload logic | 5+ locations with duplicated code |
| Inconsistent categorization | Documents miscategorized based on upload location |
| Manual linking required | Users must explicitly link documents to entities |
| No intelligent routing | Storage provider fixed regardless of document type |
| Hard to extend | Adding new upload points requires code duplication |

### Upload Points Identified

| Component | File | Current Approach |
|-----------|------|------------------|
| Documents Library | `app/dashboard/documents/page.tsx` | Direct API call |
| Expense Dialog | `components/ExpenseDialog.tsx` | Custom upload handler |
| Expenses Page | `app/dashboard/expenses/page.tsx` | useDocumentUpload hook |
| Bank Import Wizard | `components/bank/ImportWizard.tsx` | FormData to API |
| Document Dropzone | `components/documents/DocumentUploadDropzone.tsx` | Generic upload |

---

## 3. Solution Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT MANAGEMENT ENGINE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                       UploadContext                               │  │
│   │  • Source (form, dialog, library, import)                        │  │
│   │  • Entity references (propertyId, expenseId, etc.)               │  │
│   │  • User preferences                                              │  │
│   │  • File metadata                                                 │  │
│   └────────────────────────────┬─────────────────────────────────────┘  │
│                                │                                         │
│                                ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                     Rule Engine                                   │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│   │  │ Storage     │  │ Category    │  │ Linking                 │   │  │
│   │  │ Rules       │  │ Rules       │  │ Rules                   │   │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│   │  │ Path        │  │ Retention   │  │ Notification            │   │  │
│   │  │ Rules       │  │ Rules       │  │ Rules                   │   │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │  │
│   └────────────────────────────┬─────────────────────────────────────┘  │
│                                │                                         │
│                                ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    Storage Orchestrator                           │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│   │  │ GCS Provider │  │ DB Provider  │  │ Local Drive  │            │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘            │  │
│   └────────────────────────────┬─────────────────────────────────────┘  │
│                                │                                         │
│                                ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    Document Record (Prisma)                       │  │
│   │  • Metadata • Links • Storage Path • Audit Trail                 │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Components

#### 3.2.1 UploadContext

Captures all context about a document upload operation.

```typescript
interface UploadContext {
  // Source identification
  source: UploadSource;

  // File information
  file: File | Buffer;
  filename: string;
  mimeType: string;
  size: number;

  // Entity context (optional based on source)
  entities?: {
    propertyId?: string;
    expenseId?: string;
    loanId?: string;
    incomeId?: string;
    accountId?: string;
    investmentAccountId?: string;
    investmentHoldingId?: string;
    transactionId?: string;
  };

  // User input (optional)
  userInput?: {
    category?: DocumentCategory;
    description?: string;
    tags?: string[];
    storagePreference?: StorageProviderType;
  };

  // Request metadata
  userId: string;
  timestamp: Date;
}

enum UploadSource {
  // Library uploads
  DOCUMENTS_LIBRARY = 'documents_library',

  // Entity form uploads
  EXPENSE_FORM = 'expense_form',
  EXPENSE_DIALOG = 'expense_dialog',
  PROPERTY_FORM = 'property_form',
  LOAN_FORM = 'loan_form',
  INCOME_FORM = 'income_form',

  // Import operations
  BANK_IMPORT = 'bank_import',
  BULK_IMPORT = 'bulk_import',

  // API uploads
  API_DIRECT = 'api_direct',
}
```

#### 3.2.2 Rule Engine

Processes upload context through a series of rules to determine document handling.

```typescript
interface RuleEngine {
  // Apply all rules and return resolved configuration
  resolve(context: UploadContext): Promise<ResolvedUploadConfig>;
}

interface ResolvedUploadConfig {
  // Storage decision
  storageProvider: StorageProviderType;
  storagePath: string;

  // Categorization
  category: DocumentCategory;
  suggestedTags: string[];

  // Entity linking
  links: EntityLink[];

  // Retention
  retentionPolicy?: RetentionPolicy;

  // Notifications
  notifications?: NotificationConfig[];
}
```

#### 3.2.3 Rule Types

##### Storage Rules
Determine where documents should be stored.

```typescript
interface StorageRule {
  name: string;
  priority: number;

  // Condition to match
  matches(context: UploadContext): boolean;

  // Storage provider to use
  getProvider(context: UploadContext): StorageProviderType;
}

// Example Rules:
const StorageRules: StorageRule[] = [
  {
    name: 'user_preference',
    priority: 100,
    matches: (ctx) => !!ctx.userInput?.storagePreference,
    getProvider: (ctx) => ctx.userInput!.storagePreference!,
  },
  {
    name: 'tax_documents_always_cloud',
    priority: 90,
    matches: (ctx) => ctx.userInput?.category === 'TAX',
    getProvider: () => StorageProviderType.GOOGLE_CLOUD_STORAGE,
  },
  {
    name: 'large_files_to_cloud',
    priority: 80,
    matches: (ctx) => ctx.size > 5 * 1024 * 1024, // > 5MB
    getProvider: () => StorageProviderType.GOOGLE_CLOUD_STORAGE,
  },
  {
    name: 'default_by_environment',
    priority: 0,
    matches: () => true,
    getProvider: () => isGCSConfigured()
      ? StorageProviderType.GOOGLE_CLOUD_STORAGE
      : StorageProviderType.MONITRAX,
  },
];
```

##### Category Rules
Auto-categorize documents based on context.

```typescript
interface CategoryRule {
  name: string;
  priority: number;
  matches(context: UploadContext): boolean;
  getCategory(context: UploadContext): DocumentCategory;
}

// Example Rules:
const CategoryRules: CategoryRule[] = [
  {
    name: 'user_specified',
    priority: 100,
    matches: (ctx) => !!ctx.userInput?.category,
    getCategory: (ctx) => ctx.userInput!.category!,
  },
  {
    name: 'expense_insurance',
    priority: 90,
    matches: (ctx) =>
      ctx.source === 'expense_form' &&
      ctx.entities?.expenseId &&
      getExpenseCategory(ctx.entities.expenseId) === 'INSURANCE',
    getCategory: () => DocumentCategory.INSURANCE,
  },
  {
    name: 'expense_rates',
    priority: 90,
    matches: (ctx) =>
      ctx.source === 'expense_form' &&
      ctx.entities?.expenseId &&
      ['RATES', 'LAND_TAX'].includes(getExpenseCategory(ctx.entities.expenseId)),
    getCategory: () => DocumentCategory.TAX,
  },
  {
    name: 'bank_import',
    priority: 80,
    matches: (ctx) => ctx.source === 'bank_import',
    getCategory: () => DocumentCategory.STATEMENT,
  },
  {
    name: 'filename_contract',
    priority: 50,
    matches: (ctx) => /contract|agreement/i.test(ctx.filename),
    getCategory: () => DocumentCategory.CONTRACT,
  },
  {
    name: 'default_receipt',
    priority: 0,
    matches: (ctx) => ctx.source.includes('expense'),
    getCategory: () => DocumentCategory.RECEIPT,
  },
  {
    name: 'default_other',
    priority: -1,
    matches: () => true,
    getCategory: () => DocumentCategory.OTHER,
  },
];
```

##### Linking Rules
Determine which entities to link documents to.

```typescript
interface LinkingRule {
  name: string;
  priority: number;
  matches(context: UploadContext): boolean;
  getLinks(context: UploadContext): Promise<EntityLink[]>;
}

// Example Rules:
const LinkingRules: LinkingRule[] = [
  {
    name: 'expense_with_property',
    priority: 100,
    matches: (ctx) => !!ctx.entities?.expenseId,
    getLinks: async (ctx) => {
      const links: EntityLink[] = [
        { entityType: 'EXPENSE', entityId: ctx.entities!.expenseId! },
      ];

      // If expense is linked to property, add property link too
      const expense = await getExpense(ctx.entities!.expenseId!);
      if (expense?.propertyId) {
        links.push({ entityType: 'PROPERTY', entityId: expense.propertyId });
      }

      return links;
    },
  },
  {
    name: 'property_direct',
    priority: 90,
    matches: (ctx) => !!ctx.entities?.propertyId && !ctx.entities?.expenseId,
    getLinks: (ctx) => Promise.resolve([
      { entityType: 'PROPERTY', entityId: ctx.entities!.propertyId! },
    ]),
  },
  {
    name: 'loan_direct',
    priority: 90,
    matches: (ctx) => !!ctx.entities?.loanId,
    getLinks: (ctx) => Promise.resolve([
      { entityType: 'LOAN', entityId: ctx.entities!.loanId! },
    ]),
  },
  {
    name: 'bank_transaction',
    priority: 85,
    matches: (ctx) => ctx.source === 'bank_import' && !!ctx.entities?.accountId,
    getLinks: (ctx) => Promise.resolve([
      { entityType: 'ACCOUNT', entityId: ctx.entities!.accountId! },
    ]),
  },
];
```

##### Path Rules
Generate storage paths based on context.

```typescript
interface PathRule {
  name: string;
  priority: number;
  matches(context: UploadContext, resolvedLinks: EntityLink[]): boolean;
  generatePath(context: UploadContext, resolvedLinks: EntityLink[]): string;
}

// Example Rules:
const PathRules: PathRule[] = [
  {
    name: 'expense_property_path',
    priority: 100,
    matches: (ctx, links) =>
      links.some(l => l.entityType === 'EXPENSE') &&
      links.some(l => l.entityType === 'PROPERTY'),
    generatePath: (ctx, links) => {
      const propertyLink = links.find(l => l.entityType === 'PROPERTY')!;
      const expenseLink = links.find(l => l.entityType === 'EXPENSE')!;
      const timestamp = Date.now();
      const safeFilename = sanitizeFilename(ctx.filename);
      return `${ctx.userId}/properties/${propertyLink.entityId}/expenses/${expenseLink.entityId}/${timestamp}_${safeFilename}`;
    },
  },
  {
    name: 'property_path',
    priority: 90,
    matches: (ctx, links) => links.some(l => l.entityType === 'PROPERTY'),
    generatePath: (ctx, links) => {
      const propertyLink = links.find(l => l.entityType === 'PROPERTY')!;
      const timestamp = Date.now();
      const safeFilename = sanitizeFilename(ctx.filename);
      return `${ctx.userId}/properties/${propertyLink.entityId}/${timestamp}_${safeFilename}`;
    },
  },
  {
    name: 'loan_path',
    priority: 85,
    matches: (ctx, links) => links.some(l => l.entityType === 'LOAN'),
    generatePath: (ctx, links) => {
      const loanLink = links.find(l => l.entityType === 'LOAN')!;
      const timestamp = Date.now();
      const safeFilename = sanitizeFilename(ctx.filename);
      return `${ctx.userId}/loans/${loanLink.entityId}/${timestamp}_${safeFilename}`;
    },
  },
  {
    name: 'category_path',
    priority: 50,
    matches: () => true,
    generatePath: (ctx) => {
      const category = ctx.userInput?.category || 'OTHER';
      const fiscalYear = getAustralianFiscalYear(new Date());
      const timestamp = Date.now();
      const safeFilename = sanitizeFilename(ctx.filename);
      return `${ctx.userId}/general/${fiscalYear}/${category}/${timestamp}_${safeFilename}`;
    },
  },
];
```

---

## 4. Implementation

### 4.1 Directory Structure

```
lib/documents/
├── engine/
│   ├── DocumentManagementEngine.ts    # Main orchestrator
│   ├── RuleEngine.ts                  # Rule processing engine
│   ├── UploadContext.ts               # Context builder
│   ├── types.ts                       # Engine types
│   └── rules/
│       ├── index.ts                   # Rule exports
│       ├── StorageRules.ts            # Storage provider rules
│       ├── CategoryRules.ts           # Auto-categorization rules
│       ├── LinkingRules.ts            # Entity linking rules
│       ├── PathRules.ts               # Storage path rules
│       ├── RetentionRules.ts          # Document retention rules
│       └── NotificationRules.ts       # Alert/notification rules
├── storage/                           # (existing) Storage providers
│   ├── interface.ts
│   ├── factory.ts
│   ├── googleCloudStorageProvider.ts
│   ├── monitraxProvider.ts
│   └── index.ts
├── documentService.ts                 # (updated) Uses engine
├── types.ts                          # Document types
└── index.ts                          # Public exports
```

### 4.2 Core Engine Implementation

```typescript
// lib/documents/engine/DocumentManagementEngine.ts

import { UploadContext, ResolvedUploadConfig, EngineResult } from './types';
import { RuleEngine } from './RuleEngine';
import { getStorageProvider } from '../storage';
import { prisma } from '@/lib/db';

export class DocumentManagementEngine {
  private ruleEngine: RuleEngine;
  private static instance: DocumentManagementEngine;

  private constructor() {
    this.ruleEngine = new RuleEngine();
  }

  static getInstance(): DocumentManagementEngine {
    if (!DocumentManagementEngine.instance) {
      DocumentManagementEngine.instance = new DocumentManagementEngine();
    }
    return DocumentManagementEngine.instance;
  }

  /**
   * Process a document upload through the engine
   */
  async processUpload(context: UploadContext): Promise<EngineResult> {
    console.log('[DME] Processing upload:', {
      source: context.source,
      filename: context.filename,
      size: context.size,
      entities: context.entities,
    });

    try {
      // Step 1: Resolve configuration through rules
      const config = await this.ruleEngine.resolve(context);

      console.log('[DME] Resolved config:', {
        storageProvider: config.storageProvider,
        category: config.category,
        storagePath: config.storagePath,
        links: config.links.length,
      });

      // Step 2: Get storage provider
      const storage = await getStorageProvider(context.userId);

      // Step 3: Upload file
      const fileBuffer = Buffer.isBuffer(context.file)
        ? context.file
        : Buffer.from(await (context.file as Blob).arrayBuffer());

      const uploadResult = await storage.upload({
        userId: context.userId,
        file: fileBuffer,
        filename: context.filename,
        mimeType: context.mimeType,
        path: config.storagePath,
      });

      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error || 'Upload failed',
        };
      }

      // Step 4: Create document record
      const document = await prisma.document.create({
        data: {
          userId: context.userId,
          filename: generateUniqueFilename(context.filename, context.mimeType),
          originalFilename: context.filename,
          mimeType: context.mimeType,
          size: context.size,
          category: config.category,
          storageProvider: config.storageProvider,
          storagePath: uploadResult.storagePath,
          storageUrl: uploadResult.storageUrl || null,
          description: context.userInput?.description || null,
          tags: context.userInput?.tags || config.suggestedTags,
          fileContent: config.storageProvider === 'MONITRAX' ? fileBuffer : null,
        },
      });

      // Step 5: Create entity links
      if (config.links.length > 0) {
        await prisma.documentLink.createMany({
          data: config.links.map(link => ({
            documentId: document.id,
            entityType: link.entityType,
            entityId: link.entityId,
          })),
        });
      }

      // Step 6: Fetch complete document with links
      const completeDocument = await prisma.document.findUnique({
        where: { id: document.id },
        include: { links: true },
      });

      console.log('[DME] Upload complete:', {
        documentId: document.id,
        storagePath: uploadResult.storagePath,
        linksCreated: config.links.length,
      });

      return {
        success: true,
        document: completeDocument!,
        storagePath: uploadResult.storagePath,
        storageUrl: uploadResult.storageUrl,
      };
    } catch (error) {
      console.error('[DME] Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Preview what the engine would do without actually uploading
   */
  async previewUpload(context: UploadContext): Promise<ResolvedUploadConfig> {
    return this.ruleEngine.resolve(context);
  }
}

// Export singleton getter
export function getDocumentManagementEngine(): DocumentManagementEngine {
  return DocumentManagementEngine.getInstance();
}
```

### 4.3 Rule Engine Implementation

```typescript
// lib/documents/engine/RuleEngine.ts

import { UploadContext, ResolvedUploadConfig, EntityLink } from './types';
import { StorageRules } from './rules/StorageRules';
import { CategoryRules } from './rules/CategoryRules';
import { LinkingRules } from './rules/LinkingRules';
import { PathRules } from './rules/PathRules';

export class RuleEngine {
  async resolve(context: UploadContext): Promise<ResolvedUploadConfig> {
    // Apply storage rules
    const storageProvider = this.applyStorageRules(context);

    // Apply category rules
    const category = await this.applyCategoryRules(context);

    // Apply linking rules
    const links = await this.applyLinkingRules(context);

    // Apply path rules
    const storagePath = this.applyPathRules(context, links);

    // Generate suggested tags
    const suggestedTags = this.generateSuggestedTags(context, category, links);

    return {
      storageProvider,
      storagePath,
      category,
      suggestedTags,
      links,
    };
  }

  private applyStorageRules(context: UploadContext): StorageProviderType {
    const sortedRules = [...StorageRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matches(context)) {
        console.log(`[RuleEngine] Storage rule matched: ${rule.name}`);
        return rule.getProvider(context);
      }
    }

    return StorageProviderType.MONITRAX;
  }

  private async applyCategoryRules(context: UploadContext): Promise<DocumentCategory> {
    const sortedRules = [...CategoryRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (await rule.matches(context)) {
        console.log(`[RuleEngine] Category rule matched: ${rule.name}`);
        return rule.getCategory(context);
      }
    }

    return DocumentCategory.OTHER;
  }

  private async applyLinkingRules(context: UploadContext): Promise<EntityLink[]> {
    const allLinks: EntityLink[] = [];
    const sortedRules = [...LinkingRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matches(context)) {
        console.log(`[RuleEngine] Linking rule matched: ${rule.name}`);
        const links = await rule.getLinks(context);
        allLinks.push(...links);
      }
    }

    // Deduplicate links
    return deduplicateLinks(allLinks);
  }

  private applyPathRules(context: UploadContext, links: EntityLink[]): string {
    const sortedRules = [...PathRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matches(context, links)) {
        console.log(`[RuleEngine] Path rule matched: ${rule.name}`);
        return rule.generatePath(context, links);
      }
    }

    // Fallback path
    return `${context.userId}/documents/${Date.now()}_${context.filename}`;
  }

  private generateSuggestedTags(
    context: UploadContext,
    category: DocumentCategory,
    links: EntityLink[]
  ): string[] {
    const tags: string[] = [];

    // Add category as tag
    tags.push(category.toLowerCase());

    // Add source as tag
    tags.push(context.source.replace(/_/g, '-'));

    // Add entity types as tags
    links.forEach(link => {
      tags.push(link.entityType.toLowerCase());
    });

    return [...new Set(tags)];
  }
}
```

---

## 5. API Integration

### 5.1 Unified Upload Endpoint

```typescript
// app/api/documents/upload/route.ts

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDocumentManagementEngine } from '@/lib/documents/engine';
import { UploadSource } from '@/lib/documents/engine/types';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const source = (formData.get('source') as UploadSource) || UploadSource.API_DIRECT;

    // Parse entity context
    const entities = {
      propertyId: formData.get('propertyId') as string | undefined,
      expenseId: formData.get('expenseId') as string | undefined,
      loanId: formData.get('loanId') as string | undefined,
      incomeId: formData.get('incomeId') as string | undefined,
      accountId: formData.get('accountId') as string | undefined,
    };

    // Parse user input
    const userInput = {
      category: formData.get('category') as DocumentCategory | undefined,
      description: formData.get('description') as string | undefined,
      tags: formData.get('tags')?.toString().split(',').filter(Boolean),
      storagePreference: formData.get('storagePreference') as StorageProviderType | undefined,
    };

    // Build upload context
    const context: UploadContext = {
      source,
      file,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      entities: Object.fromEntries(
        Object.entries(entities).filter(([_, v]) => v !== undefined)
      ),
      userInput: Object.fromEntries(
        Object.entries(userInput).filter(([_, v]) => v !== undefined)
      ),
      userId: user.id,
      timestamp: new Date(),
    };

    // Process through engine
    const engine = getDocumentManagementEngine();
    const result = await engine.processUpload(context);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      document: result.document,
      storagePath: result.storagePath,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
```

### 5.2 React Hook Integration

```typescript
// hooks/useDocumentEngine.ts

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { UploadSource, DocumentCategory, StorageProviderType } from '@/lib/documents/engine/types';

interface UploadOptions {
  source: UploadSource;
  entities?: {
    propertyId?: string;
    expenseId?: string;
    loanId?: string;
    incomeId?: string;
    accountId?: string;
  };
  category?: DocumentCategory;
  description?: string;
  tags?: string[];
  storagePreference?: StorageProviderType;
}

export function useDocumentEngine() {
  const { token } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, options: UploadOptions) => {
    if (!token) {
      setError('Not authenticated');
      return null;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', options.source);

      if (options.entities) {
        Object.entries(options.entities).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });
      }

      if (options.category) formData.append('category', options.category);
      if (options.description) formData.append('description', options.description);
      if (options.tags?.length) formData.append('tags', options.tags.join(','));
      if (options.storagePreference) formData.append('storagePreference', options.storagePreference);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();
      setProgress(100);
      return result.document;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [token]);

  return {
    upload,
    isUploading,
    progress,
    error,
    clearError: () => setError(null),
  };
}
```

---

## 6. Migration Plan

### 6.1 Phase 1: Core Engine (Day 1)
- [x] Create engine directory structure
- [x] Implement UploadContext types
- [x] Implement RuleEngine
- [x] Implement base rules (Storage, Category, Linking, Path)
- [x] Create DocumentManagementEngine class

### 6.2 Phase 2: API Integration (Day 1)
- [x] Create unified upload endpoint
- [x] Update existing `/api/documents` to use engine
- [x] Create React hook for engine

### 6.3 Phase 3: Component Updates (Day 2)
- [ ] Update DocumentUploadDropzone to use engine
- [ ] Update ExpenseDialog to use engine
- [ ] Update expenses page upload to use engine
- [ ] Update BankImportWizard to use engine

### 6.4 Phase 4: Testing & Cleanup (Day 2)
- [ ] Test all upload paths
- [ ] Remove duplicated upload logic
- [ ] Update documentation

---

## 7. Rule Definitions

### 7.1 Storage Rules Priority

| Priority | Rule Name | Condition | Provider |
|----------|-----------|-----------|----------|
| 100 | user_preference | User specified storage | User's choice |
| 90 | tax_documents_cloud | Category is TAX | GCS |
| 85 | contracts_cloud | Category is CONTRACT | GCS |
| 80 | large_files_cloud | Size > 5MB | GCS |
| 75 | expense_receipts | Source is expense form | GCS |
| 0 | default | Always | GCS if configured, else DB |

### 7.2 Category Rules Priority

| Priority | Rule Name | Condition | Category |
|----------|-----------|-----------|----------|
| 100 | user_specified | User provided category | User's choice |
| 95 | expense_insurance | Expense category INSURANCE | INSURANCE |
| 95 | expense_rates | Expense category RATES/LAND_TAX | TAX |
| 95 | expense_loan | Expense category LOAN_INTEREST | MORTGAGE |
| 90 | bank_import | Source is bank_import | STATEMENT |
| 80 | filename_contract | Filename contains "contract" | CONTRACT |
| 80 | filename_invoice | Filename contains "invoice" | INVOICE |
| 50 | expense_source | Source includes "expense" | RECEIPT |
| 0 | default | Always | OTHER |

### 7.3 Linking Rules Priority

| Priority | Rule Name | Condition | Links |
|----------|-----------|-----------|-------|
| 100 | expense_with_relations | Has expenseId | EXPENSE + PROPERTY (if linked) |
| 90 | property_direct | Has propertyId only | PROPERTY |
| 90 | loan_direct | Has loanId | LOAN |
| 85 | account_import | Bank import with accountId | ACCOUNT |
| 80 | investment | Has investmentAccountId | INVESTMENT_ACCOUNT |

---

## 8. Testing Requirements

### 8.1 Unit Tests

```typescript
describe('DocumentManagementEngine', () => {
  describe('Storage Rules', () => {
    it('should respect user preference when specified');
    it('should route tax documents to cloud storage');
    it('should route large files to cloud storage');
    it('should fallback to default provider');
  });

  describe('Category Rules', () => {
    it('should use user-specified category');
    it('should auto-categorize insurance expenses');
    it('should auto-categorize bank imports as statements');
    it('should detect category from filename');
  });

  describe('Linking Rules', () => {
    it('should link expense documents to expense entity');
    it('should cascade link to property when expense has property');
    it('should link direct property uploads');
    it('should link bank imports to account');
  });

  describe('Path Generation', () => {
    it('should generate expense-property nested path');
    it('should generate property path for direct uploads');
    it('should generate fiscal year path for general uploads');
    it('should sanitize filenames in path');
  });
});
```

### 8.2 Integration Tests

- Upload from Documents Library
- Upload from Expense Dialog
- Upload from Expense Page
- Bank statement import
- Multi-file upload
- Provider failover scenarios

---

## 9. Performance Considerations

### 9.1 Caching
- Rule evaluation results cached per session
- Entity lookups cached with 5-minute TTL
- Storage provider instances are singletons

### 9.2 Async Operations
- File upload is non-blocking
- Entity link creation is batched
- Progress reporting via streaming (future)

### 9.3 Error Recovery
- Partial upload cleanup on failure
- Retry logic for transient storage errors
- Detailed error logging for debugging

---

## 10. Security

### 10.1 Access Control
- All operations require authenticated user
- Documents isolated by userId in storage path
- Entity links validated against user ownership

### 10.2 Validation
- MIME type validation before upload
- File size limits enforced
- Filename sanitization for path safety

### 10.3 Audit Trail
- All uploads logged with context
- Rule application recorded
- Storage provider decisions tracked

---

## 11. Future Enhancements

### 11.1 Planned Features
- OCR-based content categorization
- Duplicate detection (hash-based)
- Version control for documents
- Bulk upload with batch processing
- Scheduled retention enforcement

### 11.2 Extensibility Points
- Custom rule plugins
- Third-party storage providers
- Webhook notifications
- AI-powered tagging

---

## 12. Acceptance Criteria

Phase 25 is complete when:

1. **Engine Core**: DocumentManagementEngine processes all uploads
2. **Rule System**: All rules evaluate correctly based on context
3. **Integration**: All upload points use the engine
4. **Testing**: Full test coverage for rules and engine
5. **Documentation**: Blueprint complete and accurate
6. **No Regressions**: Existing uploads continue to work
7. **Logging**: Comprehensive logging for debugging

---

## 13. Deliverables

- [ ] `lib/documents/engine/` - Complete engine implementation
- [ ] `hooks/useDocumentEngine.ts` - React hook for uploads
- [ ] Updated API endpoints using engine
- [ ] Updated components using engine
- [ ] Unit and integration tests
- [ ] This blueprint document

---

## 13b. AI Document Router — Phase A (2026-06-16)

Foundation for the AI Document Router (Reza's vision: every doc/receipt → AI
recognises → attaches to the correct item/asset **or** creates a new
item/expense → filed in the right Vault folder for reporting/extraction).
Phased build; Phase A landed two foundational pieces:

1. **`ASSET` linkable document type.** `LinkedEntityType` gained `ASSET` so a
   document can be tagged to a specific asset (vehicle, electronics, etc.).
   Wired through the upload route (`assetId`), the `useDocumentUpload` hook
   (`LINK_FIELD_BY_ENTITY`), and a new `asset_direct` rule (priority 55) in
   `lib/documents/engine/rules/LinkingRules.ts`. Migration
   `20260616093000_add_asset_linked_entity_type` (additive `ADD VALUE`).
2. **Scan recognition fix.** The global "Scan a receipt" was degrading to
   "Saved to Vault" because `POST /api/documents/analyze` 500s in prod on a
   freshly-uploaded photo (the two-step upload→re-read→analyze path). The scan
   now uses the proven single-step `/api/documents/analyze-for-form` (the same
   path the expense/income forms use) — OCRs the in-hand upload + Gemini-maps +
   files as RECEIPT. (Root-causing the `/api/documents/analyze` 500 itself
   remains a separate follow-up — it still powers the My Vault Smart Inbox.)

**Phase B (next):** attach-to-existing-item / Phase 42 transaction-match,
owning-legal-entity linking, multi-link, always-confirm. **Phase C:** per-item
Documents sections (Stitch design under `.stitch/designs/asset-documents/`),
Tax-pack export + ATO 5yr retention, renewal-date tie-in. See
`CHANGELOG_2026_06_16.md` for the completeness review (HEIC, dedupe, security/PII,
storage-at-scale, lifecycle).

---

## 14. References

- Phase 19: Document Management & Storage Layer
- Phase 19.1: Document Management Expansion
- Phase 19.3: Google Cloud Storage Integration
- Monitrax Architecture Overview
