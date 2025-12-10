# PHASE 26 — DOCUMENT INTELLIGENCE ENGINE
**Monitrax Blueprint — Phase 26**
**Version:** v1.0
**Status:** Planned
**Created:** 2025-12-10

---

## Overview

The Document Intelligence Engine (DIE) extends the Document Management Engine (Phase 25) with AI-powered document analysis capabilities. When users upload documents, the engine can extract structured data and automatically populate relevant forms, create entities, or suggest actions.

> "Upload a receipt, and Monitrax understands what it is, extracts the details, and offers to create the expense for you."

---

## Objectives

- Extract structured data from uploaded documents using OCR and AI
- Auto-populate expense, income, loan, and property forms from document content
- Support multiple document types (receipts, invoices, contracts, statements, policies)
- Understand Australian financial document formats (ABN, GST, ATO references)
- Provide confidence scores and allow user verification/correction
- Integrate seamlessly with the Document Management Engine (Phase 25)

**Constraints:**
- User must always confirm extracted data before entity creation
- No automatic entity creation without user approval
- Extraction failures should gracefully fall back to manual entry
- Cost-effective API usage with caching and batching where possible

---

## Key Principles

- **Accuracy over speed** — Better to show "low confidence" than wrong data
- **User control** — Always present extracted data for confirmation
- **Privacy-first** — Document content processed securely, not stored in logs
- **Australian context** — Optimized for Australian financial documents
- **Graceful degradation** — If AI fails, user can still manually enter data

---

## Supported Document Types

### Tier 1: Full Extraction (High Accuracy)

| Document Type | Extractable Fields | Monitrax Action |
|--------------|-------------------|-----------------|
| **Receipt** | Vendor, date, total, GST, items | Create Expense |
| **Invoice** | Vendor, invoice #, due date, amount, line items | Create Expense with payment tracking |
| **Bank Statement** | Account, period, transactions, balances | Verify account, import transactions |
| **Utility Bill** | Provider, service period, amount, due date | Create recurring Expense |

### Tier 2: Structured Extraction (Medium Accuracy)

| Document Type | Extractable Fields | Monitrax Action |
|--------------|-------------------|-----------------|
| **Rate Notice** | Council, property address, amount, period | Create Expense (RATES category) |
| **Insurance Policy** | Insurer, policy type, premium, cover, expiry | Create Expense + set reminder |
| **Loan Statement** | Lender, principal, interest, repayment | Update Loan balance/details |
| **Rental Statement** | Property, tenant, rent received, period | Create/verify Income |

### Tier 3: AI-Interpreted (Requires Review)

| Document Type | Extractable Fields | Monitrax Action |
|--------------|-------------------|-----------------|
| **Loan Contract** | Lender, amount, rate, term, conditions | Pre-fill new Loan form |
| **Lease Agreement** | Parties, property, rent, term, conditions | Pre-fill Income + create Property link |
| **Valuation Report** | Property, value, date, valuer | Update Property current value |
| **Tax Return/Notice** | Income, deductions, tax payable/refund | Tax planning verification |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Document Upload Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User uploads document                                                  │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              Document Management Engine (Phase 25)               │   │
│   │   • Store document • Categorize • Link entities • Generate path │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│            │                                                             │
│            │ analyze=true                                                │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              DOCUMENT INTELLIGENCE ENGINE (Phase 26)             │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │                                                                  │   │
│   │   ┌──────────────────────────────────────────────────────────┐  │   │
│   │   │                   Document Classifier                     │  │   │
│   │   │   • Detect document type (receipt, invoice, contract...)  │  │   │
│   │   │   • Route to appropriate analyzer                         │  │   │
│   │   └──────────────────────────────────────────────────────────┘  │   │
│   │                              │                                   │   │
│   │              ┌───────────────┼───────────────┐                  │   │
│   │              ▼               ▼               ▼                  │   │
│   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │   │
│   │   │   Receipt    │ │   Invoice    │ │   Contract   │           │   │
│   │   │   Analyzer   │ │   Analyzer   │ │   Analyzer   │  ...      │   │
│   │   └──────────────┘ └──────────────┘ └──────────────┘           │   │
│   │              │               │               │                  │   │
│   │              └───────────────┼───────────────┘                  │   │
│   │                              ▼                                   │   │
│   │   ┌──────────────────────────────────────────────────────────┐  │   │
│   │   │                  Australian Parser                        │  │   │
│   │   │   • ABN validation • GST extraction • ATO references     │  │   │
│   │   │   • Date formats (dd/mm/yyyy) • Currency (AUD)           │  │   │
│   │   └──────────────────────────────────────────────────────────┘  │   │
│   │                              │                                   │   │
│   │                              ▼                                   │   │
│   │   ┌──────────────────────────────────────────────────────────┐  │   │
│   │   │                 Confidence Scorer                         │  │   │
│   │   │   • Field-level confidence (0-100%)                      │  │   │
│   │   │   • Overall document confidence                          │  │   │
│   │   │   • Flag low-confidence fields for review                │  │   │
│   │   └──────────────────────────────────────────────────────────┘  │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Extraction Result                             │   │
│   │   {                                                              │   │
│   │     documentType: "RECEIPT",                                     │   │
│   │     confidence: 0.92,                                            │   │
│   │     extracted: {                                                 │   │
│   │       vendor: { value: "Bunnings", confidence: 0.98 },          │   │
│   │       date: { value: "2025-12-10", confidence: 0.95 },          │   │
│   │       total: { value: 156.80, confidence: 0.99 },               │   │
│   │       gst: { value: 14.25, confidence: 0.97 },                  │   │
│   │       items: [...]                                               │   │
│   │     },                                                           │   │
│   │     suggestedActions: ["Create expense", "Link to property"]    │   │
│   │   }                                                              │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    UI: Confirmation Dialog                       │   │
│   │   • Show extracted data with confidence indicators              │   │
│   │   • Allow user to edit/correct values                           │   │
│   │   • Confirm action (Create Expense, Update Loan, etc.)          │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Options

### Option A: Google Cloud Vision + Document AI (Recommended)

**Why Recommended:**
- Already using Google Cloud for GCS storage
- Same service account, same billing
- Document AI has pre-built parsers for invoices/receipts
- 1,500 free pages/month with Document AI

| Component | Service | Pricing |
|-----------|---------|---------|
| OCR | Cloud Vision API | 1,000 free/month, then $1.50/1,000 |
| Receipt/Invoice Parsing | Document AI | 1,500 free/month, then $0.01/page |
| Complex Documents | Document AI Custom | $0.10/page (train custom model) |

**Pros:**
- Pre-trained for Australian receipts and invoices
- Structured output (no parsing needed)
- Same GCP project as existing infrastructure

**Cons:**
- Less flexible than AI models for complex documents
- Custom training required for unique document types

### Option B: Claude Vision API

| Component | Service | Pricing |
|-----------|---------|---------|
| All Document Analysis | Claude 3.5 Sonnet | ~$0.003/image |

**Pros:**
- Excellent at understanding context
- Can interpret Australian tax implications
- Handles complex/unusual documents well
- Natural language explanations

**Cons:**
- Higher latency than dedicated OCR
- Requires prompt engineering
- No pre-trained parsers

### Option C: Hybrid Approach (Best of Both)

```
┌─────────────────────────────────────────────────────┐
│                   Hybrid Pipeline                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│   1. Google Cloud Vision (OCR)                      │
│      └─ Extract raw text from document              │
│                                                      │
│   2. Document AI (Structured Extraction)            │
│      └─ For receipts, invoices (known formats)      │
│                                                      │
│   3. Claude Vision (Complex Understanding)          │
│      └─ For contracts, policies, unusual formats    │
│      └─ For Australian tax context interpretation   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Recommendation:** Start with Option A (Google Cloud Vision + Document AI) for Tier 1 documents, add Claude for Tier 3 documents later.

---

## Data Model Additions

### DocumentAnalysis Model

```prisma
model DocumentAnalysis {
  id              String    @id @default(uuid())
  documentId      String    @unique
  document        Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)

  // Analysis metadata
  analyzedAt      DateTime  @default(now())
  analyzerVersion String    // e.g., "vision-v1", "docai-v1", "claude-v1"
  processingTime  Int       // milliseconds

  // Classification
  documentType    DocumentAnalysisType
  typeConfidence  Float     // 0.0 - 1.0

  // Extracted data (JSON)
  extractedData   Json      // Structured extraction result
  rawText         String?   // Full OCR text (for search)

  // Confidence metrics
  overallConfidence Float   // 0.0 - 1.0
  lowConfidenceFields String[] // Field names needing review

  // User verification
  userVerified    Boolean   @default(false)
  userCorrectedFields String[] // Fields user modified
  verifiedAt      DateTime?

  // Entity creation tracking
  createdEntityType String?   // "EXPENSE", "INCOME", "LOAN", etc.
  createdEntityId   String?   // ID of created entity

  @@index([documentId])
  @@index([documentType])
}

enum DocumentAnalysisType {
  RECEIPT
  INVOICE
  BANK_STATEMENT
  UTILITY_BILL
  RATE_NOTICE
  INSURANCE_POLICY
  LOAN_STATEMENT
  LOAN_CONTRACT
  LEASE_AGREEMENT
  VALUATION_REPORT
  TAX_DOCUMENT
  UNKNOWN
}
```

---

## API Endpoints

### POST /api/documents/analyze

Analyze an already-uploaded document.

**Request:**
```json
{
  "documentId": "doc_abc123",
  "forceReanalyze": false
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "documentType": "RECEIPT",
    "typeConfidence": 0.95,
    "overallConfidence": 0.92,
    "extracted": {
      "vendor": {
        "value": "Bunnings Warehouse",
        "confidence": 0.98
      },
      "abn": {
        "value": "18 004 278 639",
        "confidence": 0.99,
        "valid": true
      },
      "date": {
        "value": "2025-12-10",
        "confidence": 0.95
      },
      "total": {
        "value": 156.80,
        "confidence": 0.99
      },
      "gst": {
        "value": 14.25,
        "confidence": 0.97
      },
      "items": [
        {
          "description": "Dulux Wash & Wear 4L",
          "quantity": 1,
          "unitPrice": 89.00,
          "total": 89.00,
          "confidence": 0.94
        },
        {
          "description": "Paint Brushes 3pk",
          "quantity": 2,
          "unitPrice": 33.90,
          "total": 67.80,
          "confidence": 0.91
        }
      ]
    },
    "lowConfidenceFields": [],
    "suggestedActions": [
      {
        "action": "CREATE_EXPENSE",
        "label": "Create Expense",
        "prefilled": {
          "vendor": "Bunnings Warehouse",
          "amount": 156.80,
          "date": "2025-12-10",
          "category": "MAINTENANCE",
          "taxDeductible": true
        }
      }
    ]
  }
}
```

### POST /api/documents/upload (Enhanced)

Upload with optional immediate analysis.

**Request (FormData):**
```
file: [binary]
source: expense_form
analyze: true          # NEW: Request immediate analysis
expenseId: exp_123     # Optional: Link to expense
propertyId: prop_456   # Optional: Link to property
```

**Response:**
```json
{
  "success": true,
  "document": { ... },
  "analysis": {
    "documentType": "RECEIPT",
    "extracted": { ... },
    "suggestedActions": [ ... ]
  }
}
```

### POST /api/documents/analyze/confirm

Confirm extracted data and create entity.

**Request:**
```json
{
  "analysisId": "analysis_xyz",
  "action": "CREATE_EXPENSE",
  "data": {
    "vendor": "Bunnings Warehouse",
    "amount": 156.80,
    "date": "2025-12-10",
    "category": "MAINTENANCE",
    "taxDeductible": true,
    "propertyId": "prop_456"
  },
  "corrections": {
    "category": true  // User changed this field
  }
}
```

**Response:**
```json
{
  "success": true,
  "entity": {
    "type": "EXPENSE",
    "id": "exp_789",
    "data": { ... }
  }
}
```

---

## Extraction Schemas

### Receipt Extraction

```typescript
interface ReceiptExtraction {
  vendor: ExtractedField<string>;
  abn?: ExtractedField<string> & { valid: boolean };
  date: ExtractedField<string>;  // ISO date
  total: ExtractedField<number>;
  subtotal?: ExtractedField<number>;
  gst?: ExtractedField<number>;
  paymentMethod?: ExtractedField<'CASH' | 'CARD' | 'EFTPOS' | 'OTHER'>;
  items?: ExtractedField<LineItem[]>;
  receiptNumber?: ExtractedField<string>;
}

interface ExtractedField<T> {
  value: T;
  confidence: number;  // 0.0 - 1.0
  source?: 'ocr' | 'docai' | 'ai';
  boundingBox?: BoundingBox;  // For UI highlighting
}
```

### Invoice Extraction

```typescript
interface InvoiceExtraction {
  vendor: ExtractedField<string>;
  abn?: ExtractedField<string>;
  invoiceNumber: ExtractedField<string>;
  invoiceDate: ExtractedField<string>;
  dueDate?: ExtractedField<string>;
  total: ExtractedField<number>;
  subtotal?: ExtractedField<number>;
  gst?: ExtractedField<number>;
  items?: ExtractedField<LineItem[]>;
  paymentTerms?: ExtractedField<string>;
  bankDetails?: ExtractedField<BankDetails>;
}
```

### Loan Document Extraction

```typescript
interface LoanDocumentExtraction {
  lender: ExtractedField<string>;
  loanType: ExtractedField<'HOME_LOAN' | 'INVESTMENT_LOAN' | 'PERSONAL' | 'CAR' | 'OTHER'>;
  principalAmount: ExtractedField<number>;
  interestRate: ExtractedField<number>;
  rateType: ExtractedField<'VARIABLE' | 'FIXED'>;
  loanTerm: ExtractedField<number>;  // months
  repaymentType: ExtractedField<'PRINCIPAL_AND_INTEREST' | 'INTEREST_ONLY'>;
  repaymentFrequency: ExtractedField<'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'>;
  repaymentAmount?: ExtractedField<number>;
  settlementDate?: ExtractedField<string>;
  propertyAddress?: ExtractedField<string>;
  accountNumber?: ExtractedField<string>;
  bsb?: ExtractedField<string>;
}
```

### Insurance Policy Extraction

```typescript
interface InsurancePolicyExtraction {
  insurer: ExtractedField<string>;
  policyNumber: ExtractedField<string>;
  policyType: ExtractedField<'BUILDING' | 'CONTENTS' | 'LANDLORD' | 'CAR' | 'HEALTH' | 'LIFE' | 'OTHER'>;
  premium: ExtractedField<number>;
  premiumFrequency: ExtractedField<'MONTHLY' | 'ANNUAL'>;
  coverAmount?: ExtractedField<number>;
  excessAmount?: ExtractedField<number>;
  policyStart: ExtractedField<string>;
  policyEnd: ExtractedField<string>;
  insuredProperty?: ExtractedField<string>;
  insuredItems?: ExtractedField<string[]>;
}
```

---

## Australian-Specific Features

### ABN Validation

```typescript
function validateABN(abn: string): { valid: boolean; formatted: string } {
  // Remove spaces and validate 11-digit ABN
  const digits = abn.replace(/\s/g, '');
  if (!/^\d{11}$/.test(digits)) return { valid: false, formatted: abn };

  // ABN validation algorithm (weighted sum mod 89 === 0)
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const adjusted = [parseInt(digits[0]) - 1, ...digits.slice(1).split('').map(Number)];
  const sum = adjusted.reduce((acc, d, i) => acc + d * weights[i], 0);

  return {
    valid: sum % 89 === 0,
    formatted: `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  };
}
```

### GST Detection

- Standard GST rate: 10%
- Detect "GST Included", "Inc GST", "Total (incl. GST)"
- Calculate GST from total if not explicitly stated: `gst = total / 11`
- Flag GST-free items

### Date Parsing

```typescript
// Australian date formats
const AU_DATE_FORMATS = [
  'DD/MM/YYYY',      // 10/12/2025
  'DD-MM-YYYY',      // 10-12-2025
  'D/M/YYYY',        // 10/12/2025
  'DD MMM YYYY',     // 10 Dec 2025
  'DD MMMM YYYY',    // 10 December 2025
  'YYYY-MM-DD',      // 2025-12-10 (ISO)
];
```

### Expense Category Inference

| Document Content | Suggested Category |
|-----------------|-------------------|
| Council, rates, property tax | RATES |
| Insurance, policy, premium | INSURANCE |
| Water, electricity, gas, internet | UTILITIES |
| Strata, body corporate | STRATA |
| Real estate agent, property management | PROPERTY_MANAGEMENT |
| Bunnings, hardware, paint, repairs | MAINTENANCE |
| Accountant, tax agent | PROFESSIONAL_SERVICES |
| Bank, loan, interest | LOAN_INTEREST |

---

## UI Components

### AnalysisPreviewCard

Shows extraction results with confidence indicators.

```tsx
interface AnalysisPreviewCardProps {
  analysis: DocumentAnalysis;
  onConfirm: (data: ConfirmedData) => void;
  onReject: () => void;
  onEdit: (field: string, value: any) => void;
}

// Visual indicators
// - Green: High confidence (>90%)
// - Yellow: Medium confidence (70-90%)
// - Red: Low confidence (<70%) - requires review
```

### SmartUploadDialog

Enhanced upload dialog with live analysis.

```tsx
interface SmartUploadDialogProps {
  source: UploadSource;
  entityContext?: EntityContext;
  onUploadComplete: (document: Document, analysis?: Analysis) => void;
  analyzeOnUpload?: boolean;  // Default: true
}
```

### ExtractionReviewForm

Form for reviewing and confirming extracted data.

```tsx
interface ExtractionReviewFormProps {
  extraction: ExtractedData;
  targetEntity: 'EXPENSE' | 'INCOME' | 'LOAN' | 'PROPERTY';
  onConfirm: (data: EntityData) => void;
  onCancel: () => void;
}
```

---

## Implementation Phases

### Phase 26.1: Core Infrastructure

- [ ] Set up Google Cloud Vision API integration
- [ ] Create DocumentAnalysis model and migrations
- [ ] Implement basic OCR text extraction
- [ ] Create `/api/documents/analyze` endpoint
- [ ] Build AnalysisPreviewCard component

### Phase 26.2: Receipt & Invoice Analysis

- [ ] Integrate Document AI receipt parser
- [ ] Integrate Document AI invoice parser
- [ ] Implement Australian-specific parsing (ABN, GST, dates)
- [ ] Add expense category inference
- [ ] Build confirmation flow for expense creation

### Phase 26.3: Statement & Bill Analysis

- [ ] Add bank statement parsing
- [ ] Add utility bill parsing
- [ ] Add rate notice parsing
- [ ] Implement recurring expense detection
- [ ] Add account balance verification

### Phase 26.4: Contract & Policy Analysis

- [ ] Add Claude Vision for complex documents
- [ ] Implement loan contract extraction
- [ ] Implement insurance policy extraction
- [ ] Implement lease agreement extraction
- [ ] Add valuation report parsing

### Phase 26.5: Smart Features

- [ ] Add learning from user corrections
- [ ] Implement bulk document processing
- [ ] Add document search by extracted content
- [ ] Implement smart suggestions ("You uploaded a receipt, want to create an expense?")
- [ ] Add extraction history and analytics

---

## Environment Variables

```env
# Google Cloud Vision (uses existing GCS service account)
# No additional config needed if GCS_SERVICE_ACCOUNT_KEY is set

# Document AI (optional, for enhanced parsing)
DOCUMENT_AI_PROCESSOR_ID=<receipt-processor-id>
DOCUMENT_AI_LOCATION=australia-southeast1

# Claude Vision (optional, for complex documents)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Cost Estimates

### Per-Document Processing Costs

| Document Type | Method | Cost |
|--------------|--------|------|
| Receipt/Invoice | Document AI | $0.01 |
| Simple OCR | Cloud Vision | $0.0015 |
| Complex Document | Claude Vision | $0.003 |

### Monthly Cost Projections

| Usage Level | Documents/Month | Est. Cost |
|-------------|-----------------|-----------|
| Light | 100 | $1-2 |
| Medium | 500 | $5-8 |
| Heavy | 2,000 | $20-30 |
| Enterprise | 10,000 | $100-150 |

### Free Tier Coverage

- Cloud Vision: 1,000 units/month FREE
- Document AI: 1,500 pages/month FREE
- Most individual users will stay within free tier

---

## Security Considerations

1. **Data Privacy**
   - Document content processed via secure API calls
   - No document content stored in logs
   - Extracted data stored encrypted in database

2. **API Key Security**
   - Service account keys stored as environment variables
   - Keys never exposed to client-side code
   - API calls made server-side only

3. **User Consent**
   - Clear indication that document will be analyzed
   - Option to disable automatic analysis
   - User must confirm before entity creation

---

## Testing Requirements

1. **Unit Tests**
   - ABN validation
   - Date parsing for Australian formats
   - GST calculation
   - Category inference

2. **Integration Tests**
   - Full upload → analyze → confirm flow
   - API error handling
   - Confidence scoring accuracy

3. **Sample Documents**
   - Australian receipts (Woolworths, Bunnings, etc.)
   - Council rate notices
   - Bank statements (CBA, NAB, etc.)
   - Insurance policies
   - Loan contracts

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Receipt extraction accuracy | >95% |
| Invoice extraction accuracy | >90% |
| User correction rate | <10% |
| Time saved per document | >2 minutes |
| User adoption rate | >50% of uploads analyzed |

---

## Dependencies

- **Phase 25** (Document Management Engine) - Required
- **Phase 19** (Document Management) - Required
- **Google Cloud Project** - Required (existing)
- **Anthropic API** - Optional (for Tier 3 documents)

---

## Related Documents

- `PHASE_19_DOCUMENT_MANAGEMENT.md` - Document storage and management
- `PHASE_25_DOCUMENT_MANAGEMENT_ENGINE.md` - Upload orchestration
- `MASTER_BLUEPRINT.md` - Overall architecture

---

*Document Version: 1.0*
*Created: 2025-12-10*
*Status: Planned*
