# PHASE 26 — DOCUMENT INTELLIGENCE ENGINE
**Monitrax Blueprint — Phase 26**
**Version:** v1.2
**Status:** Complete (Phase 26.6 Form Auto-Fill with Gemini)
**Created:** 2025-12-10
**Updated:** 2025-12-14

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

## Form Auto-Fill Feature (Phase 26.6)

### Overview

The Form Auto-Fill feature allows users to attach documents directly to entity forms (Expense, Income, Loan) and have the form fields automatically populated from the document content.

> "Attach a receipt to the expense form, and watch the fields fill themselves."

### User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Form Auto-Fill Flow                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. User opens Expense Form (or Income, Loan form)                         │
│                    │                                                         │
│                    ▼                                                         │
│   2. User clicks "Attach Document" / "Scan Receipt" button                  │
│                    │                                                         │
│                    ▼                                                         │
│   3. User uploads document (image/PDF)                                      │
│                    │                                                         │
│                    ▼                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                   Document Intelligence Engine                       │   │
│   │                                                                      │   │
│   │   a) Vision API performs OCR → extracts text                        │   │
│   │   b) Gemini AI analyzes text + form context → maps to fields        │   │
│   │   c) Returns field mappings with confidence scores                   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│   4. Form fields auto-populate with extracted values                        │
│      • High confidence fields: filled normally                              │
│      • Low confidence fields: highlighted for review                        │
│                    │                                                         │
│                    ▼                                                         │
│   5. User reviews, edits if needed, and submits form                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Form Auto-Fill Architecture                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Client (Form Component)                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  FormDocumentUpload Component                                        │   │
│   │  • Accepts file upload                                               │   │
│   │  • Shows upload/analyzing progress                                   │   │
│   │  • Receives field mappings and updates form state                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              │ POST /api/documents/analyze-for-form         │
│                              │ { file, formType, formFields }               │
│                              ▼                                               │
│   Server                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  /api/documents/analyze-for-form                                     │   │
│   │                                                                      │   │
│   │  1. Upload to GCS (temporary or permanent)                          │   │
│   │  2. Vision API → OCR text extraction                                │   │
│   │  3. Gemini AI → Intelligent field mapping                           │   │
│   │     Prompt includes:                                                │   │
│   │     - OCR text                                                      │   │
│   │     - Form type (expense, income, loan)                            │   │
│   │     - Available form fields with types                              │   │
│   │     - Australian context (GST, ABN, date formats)                  │   │
│   │  4. Return mapped fields with confidence                           │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│   Response                                                                   │
│   {                                                                          │
│     "success": true,                                                         │
│     "documentId": "doc_123",                                                │
│     "fieldMappings": {                                                       │
│       "vendor": { "value": "Bunnings", "confidence": 0.98 },               │
│       "amount": { "value": 156.80, "confidence": 0.99 },                   │
│       "date": { "value": "2025-12-10", "confidence": 0.95 },               │
│       "category": { "value": "MAINTENANCE", "confidence": 0.85 },          │
│       "gst": { "value": 14.25, "confidence": 0.97 },                       │
│       "taxDeductible": { "value": true, "confidence": 0.90 }               │
│     },                                                                       │
│     "lowConfidenceFields": ["category"],                                    │
│     "rawText": "...",                                                       │
│     "documentType": "RECEIPT"                                               │
│   }                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoint

#### POST /api/documents/analyze-for-form

Analyzes a document and returns field mappings for a specific form type.

**Request (FormData):**
```
file: [binary]           # The document file
formType: "expense"      # expense | income | loan | property
formFields: JSON string  # Available form fields
propertyId?: string      # Optional property context
```

**formFields Example:**
```json
{
  "vendor": { "type": "string", "label": "Vendor Name" },
  "amount": { "type": "number", "label": "Amount" },
  "date": { "type": "date", "label": "Date" },
  "category": {
    "type": "enum",
    "label": "Category",
    "options": ["MAINTENANCE", "UTILITIES", "INSURANCE", "RATES", "OTHER"]
  },
  "description": { "type": "string", "label": "Description" },
  "taxDeductible": { "type": "boolean", "label": "Tax Deductible" },
  "gst": { "type": "number", "label": "GST Amount" }
}
```

**Response:**
```json
{
  "success": true,
  "documentId": "doc_abc123",
  "storageUrl": "gs://bucket/path/to/file",
  "fieldMappings": {
    "vendor": {
      "value": "Bunnings Warehouse",
      "confidence": 0.98,
      "source": "ocr"
    },
    "amount": {
      "value": 156.80,
      "confidence": 0.99,
      "source": "ocr"
    },
    "date": {
      "value": "2025-12-10",
      "confidence": 0.95,
      "source": "ocr"
    },
    "category": {
      "value": "MAINTENANCE",
      "confidence": 0.85,
      "source": "ai_inference",
      "reason": "Hardware store purchase suggests maintenance category"
    },
    "description": {
      "value": "Paint and brushes for property maintenance",
      "confidence": 0.80,
      "source": "ai_generated"
    },
    "taxDeductible": {
      "value": true,
      "confidence": 0.90,
      "source": "ai_inference",
      "reason": "Linked to investment property"
    },
    "gst": {
      "value": 14.25,
      "confidence": 0.97,
      "source": "ocr"
    }
  },
  "lowConfidenceFields": ["category", "description"],
  "documentType": "RECEIPT",
  "rawText": "BUNNINGS WAREHOUSE\nTAX INVOICE\n..."
}
```

### Gemini AI Prompt Strategy

The system uses Google Gemini to intelligently map OCR text to form fields:

```typescript
const FORM_AUTOFILL_SYSTEM_PROMPT = `You are an expert at extracting data from Australian financial documents and mapping them to form fields.

CONTEXT:
- The user is filling out a {formType} form
- They have uploaded a document (usually a receipt, invoice, or statement)
- You need to extract relevant data and map it to the form fields

FORM FIELDS:
{formFields}

INSTRUCTIONS:
1. Analyze the OCR text carefully
2. Extract values that match the form fields
3. For each field, provide:
   - value: The extracted value (in correct type)
   - confidence: 0.0-1.0 how confident you are
   - source: "ocr" (direct extraction) or "ai_inference" (derived/inferred)
   - reason: (for ai_inference only) Brief explanation

AUSTRALIAN SPECIFICS:
- Dates are typically DD/MM/YYYY format
- GST is 10% (calculate as total/11 if not shown)
- ABN format: XX XXX XXX XXX (validate using weighted sum)
- Currency is AUD ($ symbol)

EXPENSE CATEGORY HINTS:
- Bunnings, hardware stores → MAINTENANCE
- Council rates → RATES
- Insurance → INSURANCE
- Electricity, gas, water → UTILITIES
- Strata → STRATA

Return a JSON object with fieldMappings for each field you can fill.
Only include fields where you found relevant data.
`;
```

### UI Component: FormDocumentUpload

```tsx
interface FormDocumentUploadProps {
  formType: 'expense' | 'income' | 'loan' | 'property';
  formFields: FormFieldDefinition[];
  onFieldsExtracted: (mappings: FieldMappings) => void;
  onDocumentAttached: (documentId: string) => void;
  propertyId?: string;
  disabled?: boolean;
}

// Usage in ExpenseForm:
<FormDocumentUpload
  formType="expense"
  formFields={EXPENSE_FORM_FIELDS}
  propertyId={selectedPropertyId}
  onFieldsExtracted={(mappings) => {
    // Auto-fill form fields
    if (mappings.vendor) setVendor(mappings.vendor.value);
    if (mappings.amount) setAmount(mappings.amount.value);
    if (mappings.date) setDate(mappings.date.value);
    if (mappings.category) setCategory(mappings.category.value);
    // ... etc
  }}
  onDocumentAttached={(docId) => setAttachedDocumentId(docId)}
/>
```

### Form Integration Points

| Form | Document Types | Auto-Fill Fields |
|------|---------------|------------------|
| **Expense** | Receipt, Invoice, Bill | vendor, amount, date, category, gst, description, taxDeductible |
| **Income** | Rental Statement, Bank Statement | source, amount, date, frequency |
| **Loan** | Loan Contract, Statement | lender, principalAmount, interestRate, term, repaymentAmount |
| **Property** | Valuation Report, Rate Notice | currentValue, purchasePrice, councilRates |

### Implementation Checklist

- [x] Create `/api/documents/analyze-for-form` endpoint
- [x] Implement AI field mapping logic (Gemini-only, see Phase 27)
- [x] Create `FormDocumentUpload` component
- [x] Integrate with Expense form
- [ ] Integrate with Income form
- [ ] Integrate with Loan form
- [x] Add confidence indicators to form fields
- [ ] Add "Attached Document" badge to forms
- [ ] Test with various Australian document types

---

## Implementation Status (2025-12-12)

### Completed Features

#### 1. Form Auto-Fill API (`/api/documents/analyze-for-form`)
**File:** `/app/api/documents/analyze-for-form/route.ts`

The API endpoint handles document upload, OCR, and AI-powered field extraction:

```
Document Upload → PDF/Image Detection → OCR/Text Extraction → AI Field Mapping → Response
```

**Key Features:**
- Supports PDF and image uploads (JPEG, PNG, WebP)
- PDF text extraction using `pdfjs-dist` (serverless-compatible)
- Image OCR using Google Cloud Vision API
- AI field mapping with automatic fallback chain
- Australian-specific parsing (ABN, GST, date formats)
- Confidence scoring for extracted fields

#### 2. AI Integration - Google Gemini (Primary)
**File:** `/lib/ai/gemini.ts`

We chose Google Gemini over OpenAI for field mapping because:
- Same Google Cloud ecosystem as GCS storage
- Cost-effective (generous free tier)
- Good JSON output support

**Model Configuration:**
```typescript
export const GEMINI_MODELS = {
  FLASH: 'gemini-2.0-flash',      // Primary - fast and reliable
  FLASH_LATEST: 'gemini-2.5-flash', // Latest flash model
  PRO: 'gemini-2.5-pro',          // Complex analysis
};
```

**Automatic Fallback Chain:**
If the primary model fails (404), the system automatically tries fallback models:
```
gemini-2.0-flash → gemini-2.5-flash → gemini-flash-latest → gemini-2.0-flash-001
```

**Note:** Google deprecated the old model names (gemini-1.5-flash, gemini-1.0-pro, etc.) in late 2025. The current available models are gemini-2.0-flash, gemini-2.5-flash, and gemini-2.5-pro.

#### 3. FormDocumentUpload Component
**File:** `/components/documents/FormDocumentUpload.tsx`

React component that integrates with forms to provide:
- Drag-and-drop file upload
- Upload progress indicator
- "Analyzing..." state during AI processing
- Auto-population of form fields from extraction results
- Low confidence field highlighting

#### 4. Expense Form Integration
**File:** `/app/dashboard/expenses/page.tsx`

The expense form dialog now includes:
- "Smart Document Scan" upload button
- Automatic field population after document analysis
- Support for CTP insurance, receipts, invoices, etc.

### Environment Variables Required

```env
# Google Cloud Vision (OCR) - uses existing GCS service account
GCS_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Google Gemini AI (Field Mapping)
GEMINI_API_KEY=AIza...

# Note: OpenAI is no longer used (removed in Phase 27)
# All AI features now use Gemini exclusively
```

### API Key Setup for Gemini

**Important:** The Gemini API key must be created from Google AI Studio:

1. Go to https://aistudio.google.com/app/apikey
2. Create API key in a project that has Gemini API enabled
3. Ensure the key is **unrestricted** or has "Generative Language API" access
4. Add to Vercel as `GEMINI_API_KEY`

**Troubleshooting 404 Errors:**
If all models return 404, check:
1. API key is from Google AI Studio (not Google Cloud Console)
2. The project has Generative Language API enabled
3. API key has no restrictive API filters

**Debug Endpoint:**
The analyze-for-form endpoint includes diagnostic logging:
```
[Gemini Direct Test] Starting with key: AIzaSyBbw2...
[Gemini Direct Test] List models status: 200
[Gemini Direct Test] Found models: [...]
```

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/lib/ai/gemini.ts` | Gemini AI service with model fallback |
| `/app/api/documents/analyze-for-form/route.ts` | Form auto-fill API endpoint |
| `/components/documents/FormDocumentUpload.tsx` | Upload component for forms |
| `/app/dashboard/expenses/page.tsx` | Expense form with smart scan |

### Known Issues / In Progress

1. **Gemini API 404 Errors** (RESOLVED ✓)
   - Old model names (gemini-1.5-flash, gemini-1.0-pro) were deprecated by Google
   - Solution: Updated to current model names (gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro)
   - Image document extraction now works correctly

2. **PDF Parsing in Serverless** (RESOLVED ✓)
   - Module import error: `Cannot find module 'pdfjs-dist/legacy/build/pdf.js'`
   - Solution: Updated to use dynamic imports with multiple fallback paths
   - Added serverless-compatible configuration for pdfjs-dist

3. **PDF Scanned Documents**
   - Currently only extracts embedded text from PDFs
   - Scanned PDFs (images inside PDF) return empty text
   - Workaround: User uploads image instead of scanned PDF
   - Future: Could use Vision API for OCR on scanned PDFs

### Testing Checklist

- [x] Upload receipt image → verify field extraction ✓
- [ ] Upload PDF invoice → verify text extraction (awaiting deployment)
- [x] Upload CTP insurance → verify amount/GST extraction ✓ ($204.05 correctly extracted)
- [ ] Test with investment property context
- [x] Verify Gemini fallback chain works ✓ (gemini-2.0-flash working)
- [ ] Test pattern-based fallback when AI unavailable

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

*Document Version: 1.2*
*Created: 2025-12-10*
*Updated: 2025-12-12*
*Status: In Progress (Phase 26.6 Form Auto-Fill)*
