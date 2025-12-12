# PHASE 27 — UNIFIED GOOGLE AI ENGINE
**Monitrax Blueprint — Phase 27**
**Version:** v1.0
**Status:** Proposed
**Created:** 2025-12-12

---

## Overview

Phase 27 consolidates all AI capabilities under a unified Google AI (Gemini) backend, replacing the existing OpenAI-based implementation. This provides:
- Single AI provider for simplified infrastructure
- Cost optimization through Google Cloud ecosystem
- Consistent AI experience across all features
- Better integration with existing Google services (GCS, Vision API, Places API)

> "One AI engine to power all intelligent features in Monitrax."

---

## Objectives

1. **Replace OpenAI with Google Gemini** across all AI features
2. **Maintain feature parity** with existing Phase 11 AI Strategy Engine
3. **Expand AI capabilities** to new application areas
4. **Reduce operational complexity** with single AI provider
5. **Optimize costs** through Google Cloud unified billing

**Constraints:**
- Zero data loss during migration
- Backward compatible API responses
- Graceful fallback when AI unavailable
- Privacy-first: no financial data stored in AI logs

---

## Current State Analysis

### Existing AI Implementations

| Phase | Feature | Provider | Status | Location |
|-------|---------|----------|--------|----------|
| 11 | AI Strategy Engine | OpenAI | Not Fully Working | `lib/ai/openai.ts`, `financialAdvisor.ts` |
| 11 | Strategy Enhancement | OpenAI | Not Fully Working | `lib/ai/strategyEnhancer.ts` |
| 11 | Context Building | OpenAI | Working | `lib/ai/contextBuilder.ts` |
| 26 | Document Intelligence | Gemini | Working | `lib/ai/gemini.ts` |
| 26 | Form Auto-Fill | Gemini | Working | `app/api/documents/analyze-for-form/` |

### AI API Endpoints (Current)

| Endpoint | Purpose | Provider |
|----------|---------|----------|
| `POST /api/ai/advisor` | Comprehensive financial advice | OpenAI |
| `POST /api/ai/ask` | Answer financial questions | OpenAI |
| `POST /api/ai/scenario` | Scenario analysis | OpenAI |
| `POST /api/ai/goal` | Goal progress analysis | OpenAI |
| `GET /api/ai/status` | Check AI configuration | OpenAI |
| `POST /api/documents/analyze-for-form` | Document field extraction | Gemini |

---

## Proposed Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED GOOGLE AI ENGINE                             │
│                              (Phase 27)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                      lib/ai/google/                                    │ │
│   │                                                                        │ │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │ │
│   │  │  geminiClient   │  │  modelConfig    │  │  promptManager  │       │ │
│   │  │  .ts            │  │  .ts            │  │  .ts            │       │ │
│   │  │                 │  │                 │  │                 │       │ │
│   │  │  - Initialize   │  │  - Model defs   │  │  - System       │       │ │
│   │  │  - Completion   │  │  - Pricing      │  │    prompts      │       │ │
│   │  │  - JSON parse   │  │  - Fallbacks    │  │  - Templates    │       │ │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │ │
│   │                                                                        │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                      AI SERVICE MODULES                                │ │
│   │                                                                        │ │
│   │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐            │ │
│   │  │  Financial     │ │  Document      │ │  Transaction   │            │ │
│   │  │  Advisor       │ │  Intelligence  │ │  Categorizer   │            │ │
│   │  │  Service       │ │  Service       │ │  Service       │            │ │
│   │  │  ✓ Existing    │ │  ✓ Existing    │ │  NEW           │            │ │
│   │  └────────────────┘ └────────────────┘ └────────────────┘            │ │
│   │                                                                        │ │
│   │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐            │ │
│   │  │  Health        │ │  Property      │ │  Chat          │            │ │
│   │  │  Explainer     │ │  Analyzer      │ │  Assistant     │            │ │
│   │  │  Service       │ │  Service       │ │  Service       │            │ │
│   │  │  NEW           │ │  NEW           │ │  NEW           │            │ │
│   │  └────────────────┘ └────────────────┘ └────────────────┘            │ │
│   │                                                                        │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                      API LAYER                                         │ │
│   │                                                                        │ │
│   │  app/api/ai/                                                           │ │
│   │  ├── advisor/route.ts      (Migrate to Gemini)                        │ │
│   │  ├── ask/route.ts          (Migrate to Gemini)                        │ │
│   │  ├── scenario/route.ts     (Migrate to Gemini)                        │ │
│   │  ├── goal/route.ts         (Migrate to Gemini)                        │ │
│   │  ├── status/route.ts       (Update for Gemini)                        │ │
│   │  ├── chat/route.ts         (NEW - Conversational)                     │ │
│   │  ├── categorize/route.ts   (NEW - Transaction categorization)         │ │
│   │  └── explain/route.ts      (NEW - Health score explanations)          │ │
│   │                                                                        │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gemini Model Selection

### Model Configuration

| Use Case | Model | Reasoning |
|----------|-------|-----------|
| **Financial Advisor** | `gemini-1.5-pro-latest` | Complex multi-step reasoning |
| **Quick Questions** | `gemini-1.5-flash-latest` | Fast, cost-effective |
| **Document Analysis** | `gemini-1.5-flash-latest` | OCR + extraction |
| **Transaction Categorization** | `gemini-1.5-flash-latest` | Pattern matching |
| **Chat/Conversation** | `gemini-1.5-flash-latest` | Low latency |
| **Health Explanations** | `gemini-1.5-flash-latest` | Simple text generation |
| **Scenario Analysis** | `gemini-1.5-pro-latest` | Complex calculations |

### Model Fallback Chain

```typescript
const MODEL_FALLBACK_CHAIN = {
  'gemini-1.5-pro-latest': ['gemini-1.5-pro', 'gemini-pro'],
  'gemini-1.5-flash-latest': ['gemini-1.5-flash', 'gemini-pro'],
};
```

### Cost Comparison

| Provider | Model | Input (per 1K tokens) | Output (per 1K tokens) |
|----------|-------|----------------------|------------------------|
| OpenAI | gpt-4-turbo | $0.01 | $0.03 |
| OpenAI | gpt-4o-mini | $0.00015 | $0.0006 |
| Google | gemini-1.5-pro | $0.00125 | $0.005 |
| Google | gemini-1.5-flash | $0.000075 | $0.0003 |

**Estimated Savings:** 60-80% cost reduction vs OpenAI for equivalent tasks.

---

## File Structure

```
lib/ai/
├── index.ts                    # Main exports (updated)
├── types.ts                    # Shared types (updated)
├── google/                     # NEW - Google AI unified client
│   ├── index.ts               # Google AI exports
│   ├── geminiClient.ts        # Gemini client wrapper
│   ├── modelConfig.ts         # Model configuration
│   ├── promptManager.ts       # System prompts management
│   └── usageTracker.ts        # Usage and cost tracking
├── services/                   # NEW - AI service modules
│   ├── financialAdvisor.ts    # Financial advice (migrate from OpenAI)
│   ├── documentIntelligence.ts # Document analysis (existing)
│   ├── transactionCategorizer.ts # NEW - Transaction categorization
│   ├── healthExplainer.ts     # NEW - Health score explanations
│   ├── propertyAnalyzer.ts    # NEW - Property analysis
│   ├── chatAssistant.ts       # NEW - Conversational AI
│   └── scenarioAnalyzer.ts    # NEW - What-if scenarios
├── deprecated/                 # Deprecated OpenAI implementations
│   ├── openai.ts              # Moved from root
│   ├── financialAdvisor.ts    # Moved from root
│   └── strategyEnhancer.ts    # Moved from root
├── contextBuilder.ts          # Keep (provider-agnostic)
└── gemini.ts                  # Keep (base Gemini client)
```

---

## Service Specifications

### 1. Financial Advisor Service (Migration)

**Current:** `lib/ai/financialAdvisor.ts` (OpenAI)
**New:** `lib/ai/services/financialAdvisor.ts` (Gemini)

**Functions:**
```typescript
// Generate comprehensive financial advice
export async function generateFinancialAdvice(
  context: FinancialContext,
  options?: AdviceOptions
): Promise<AIAdvisorResponse>

// Ask specific financial question
export async function askFinancialQuestion(
  context: FinancialContext,
  question: string
): Promise<QuestionResponse>

// Get strategy recommendations explanation
export async function explainRecommendation(
  recommendation: StrategyRecommendation,
  context: FinancialContext
): Promise<ExplanationResponse>
```

**Migration Notes:**
- Response format remains identical
- System prompts adapted for Gemini
- Australian financial context preserved
- Fallback to pattern-based advice if AI fails

---

### 2. Transaction Categorizer Service (NEW)

**Location:** `lib/ai/services/transactionCategorizer.ts`

**Purpose:** Automatically categorize bank transactions using AI.

**Functions:**
```typescript
// Categorize a single transaction
export async function categorizeTransaction(
  transaction: TransactionInput
): Promise<CategoryResult>

// Batch categorize transactions
export async function categorizeBatch(
  transactions: TransactionInput[]
): Promise<BatchCategoryResult>

// Learn from user corrections
export async function learnFromCorrection(
  transactionId: string,
  suggestedCategory: string,
  correctCategory: string
): Promise<void>
```

**Transaction Input:**
```typescript
interface TransactionInput {
  description: string;
  amount: number;
  merchant?: string;
  date: string;
  accountType?: 'personal' | 'business' | 'investment';
}
```

**Category Output:**
```typescript
interface CategoryResult {
  category: ExpenseCategory | IncomeCategory;
  confidence: number;           // 0.0 - 1.0
  reasoning: string;            // Why this category
  suggestedTags?: string[];     // Additional tags
  isTaxDeductible?: boolean;    // Australian tax context
}
```

**System Prompt:**
```
You are a transaction categorizer for Australian personal finance.

CATEGORIES:
Income: SALARY, RENTAL, DIVIDENDS, INTEREST, BUSINESS, OTHER
Expense: HOUSING, RATES, INSURANCE, MAINTENANCE, UTILITIES, FOOD,
         TRANSPORT, ENTERTAINMENT, HEALTHCARE, EDUCATION, PERSONAL,
         STRATA, LAND_TAX, LOAN_INTEREST, OTHER

MERCHANT PATTERNS:
- Woolworths, Coles, Aldi → FOOD
- Bunnings → MAINTENANCE (if linked to property, else PERSONAL)
- Council rates → RATES
- Insurance → INSURANCE
- Electricity, Gas, Water → UTILITIES

Return JSON: { "category": "...", "confidence": 0.95, "reasoning": "..." }
```

---

### 3. Health Explainer Service (NEW)

**Location:** `lib/ai/services/healthExplainer.ts`

**Purpose:** Provide natural language explanations for financial health scores.

**Functions:**
```typescript
// Explain overall health score
export async function explainHealthScore(
  healthReport: FinancialHealthReport
): Promise<HealthExplanation>

// Explain specific category score
export async function explainCategoryScore(
  category: HealthCategory,
  context: FinancialContext
): Promise<CategoryExplanation>

// Generate improvement suggestions
export async function generateImprovementPlan(
  healthReport: FinancialHealthReport
): Promise<ImprovementPlan>
```

**Response Format:**
```typescript
interface HealthExplanation {
  summary: string;              // 2-3 sentence overview
  strengths: string[];          // What's going well
  concerns: string[];           // Areas of concern
  topActions: PrioritizedAction[];
  projectedImpact: string;      // If actions taken
}
```

---

### 4. Property Analyzer Service (NEW)

**Location:** `lib/ai/services/propertyAnalyzer.ts`

**Purpose:** AI-assisted property analysis and valuation insights.

**Functions:**
```typescript
// Analyze property performance
export async function analyzePropertyPerformance(
  property: Property,
  context: FinancialContext
): Promise<PropertyAnalysis>

// Compare property to market
export async function compareToMarket(
  property: Property,
  marketData?: MarketComparison
): Promise<MarketComparison>

// Generate rental optimization suggestions
export async function optimizeRental(
  property: Property,
  expenses: Expense[]
): Promise<RentalOptimization>
```

---

### 5. Chat Assistant Service (NEW)

**Location:** `lib/ai/services/chatAssistant.ts`

**Purpose:** Conversational AI for natural language financial queries.

**Functions:**
```typescript
// Send message in conversation
export async function sendMessage(
  message: string,
  conversationId: string,
  context: FinancialContext
): Promise<ChatResponse>

// Start new conversation
export async function startConversation(
  context: FinancialContext
): Promise<ConversationSession>

// Get conversation history
export async function getConversationHistory(
  conversationId: string
): Promise<ChatMessage[]>
```

**Features:**
- Context-aware responses (knows user's portfolio)
- Follow-up question suggestions
- Action recommendations with links
- Conversation memory (within session)

---

### 6. Scenario Analyzer Service (Migration)

**Location:** `lib/ai/services/scenarioAnalyzer.ts`

**Purpose:** Analyze "what-if" financial scenarios.

**Scenario Types:**
- Extra loan repayment
- Property purchase
- Investment rebalancing
- Income change
- Retirement timing
- Emergency scenarios

---

## API Endpoints

### Updated Endpoints

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/ai/advisor` | POST | Migrate to Gemini |
| `/api/ai/ask` | POST | Migrate to Gemini |
| `/api/ai/scenario` | POST | Migrate to Gemini |
| `/api/ai/goal` | POST | Migrate to Gemini |
| `/api/ai/status` | GET | Update to check Gemini |

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/chat` | POST | Conversational AI |
| `/api/ai/categorize` | POST | Transaction categorization |
| `/api/ai/categorize/batch` | POST | Batch categorization |
| `/api/ai/explain/health` | POST | Health score explanation |
| `/api/ai/explain/recommendation` | POST | Strategy recommendation explanation |
| `/api/ai/property/analyze` | POST | Property analysis |

---

## Environment Configuration

### Required Variables

```env
# Google AI (Gemini) - REQUIRED
GEMINI_API_KEY=AIza...

# Google Cloud (existing)
GCS_PROJECT_ID=monitrax-479700
GCS_BUCKET_NAME=monitrax-documents
GCS_SERVICE_ACCOUNT_KEY=base64...

# OpenAI (DEPRECATED - kept for fallback during migration)
OPENAI_API_KEY=sk-...   # Optional fallback
```

### Configuration Priority

1. **Primary:** Google Gemini API
2. **Fallback:** OpenAI (during migration only)
3. **Final Fallback:** Rule-based/pattern matching

---

## Implementation Phases

### Phase 27.1: Core Migration (Backend)
**Effort:** 8-10 hours

- [ ] Create `lib/ai/google/geminiClient.ts` - Enhanced Gemini client
- [ ] Create `lib/ai/google/modelConfig.ts` - Model configuration
- [ ] Create `lib/ai/google/promptManager.ts` - System prompts
- [ ] Create `lib/ai/services/financialAdvisor.ts` - Migrate from OpenAI
- [ ] Update `lib/ai/index.ts` - New exports
- [ ] Update `/api/ai/status` - Check Gemini configuration

### Phase 27.2: API Migration
**Effort:** 6-8 hours

- [ ] Migrate `/api/ai/advisor` to Gemini
- [ ] Migrate `/api/ai/ask` to Gemini
- [ ] Migrate `/api/ai/scenario` to Gemini
- [ ] Migrate `/api/ai/goal` to Gemini
- [ ] Add response compatibility layer
- [ ] Test all existing AI features

### Phase 27.3: Transaction Categorization (NEW)
**Effort:** 8-10 hours

- [ ] Create `lib/ai/services/transactionCategorizer.ts`
- [ ] Create `/api/ai/categorize` endpoint
- [ ] Create `/api/ai/categorize/batch` endpoint
- [ ] Integrate with bank transaction import (Phase 18)
- [ ] Add category suggestion UI in transactions page

### Phase 27.4: Health Explainer (NEW)
**Effort:** 4-6 hours

- [ ] Create `lib/ai/services/healthExplainer.ts`
- [ ] Create `/api/ai/explain/health` endpoint
- [ ] Integrate with Financial Health Dashboard
- [ ] Add "Explain" button to health score components

### Phase 27.5: Chat Assistant (NEW)
**Effort:** 10-12 hours

- [ ] Create `lib/ai/services/chatAssistant.ts`
- [ ] Create `/api/ai/chat` endpoint
- [ ] Create `ChatAssistant` UI component
- [ ] Add floating chat button to dashboard
- [ ] Implement conversation history

### Phase 27.6: Property Analyzer (NEW)
**Effort:** 6-8 hours

- [ ] Create `lib/ai/services/propertyAnalyzer.ts`
- [ ] Create `/api/ai/property/analyze` endpoint
- [ ] Integrate with property detail page
- [ ] Add AI analysis panel to property dashboard

### Phase 27.7: Cleanup & Documentation
**Effort:** 4-6 hours

- [ ] Move OpenAI code to `lib/ai/deprecated/`
- [ ] Update API documentation
- [ ] Update blueprint documents
- [ ] Create migration guide
- [ ] Remove OPENAI_API_KEY from environment

---

## Testing Requirements

### Unit Tests

```
__tests__/ai/
├── geminiClient.test.ts
├── services/
│   ├── financialAdvisor.test.ts
│   ├── transactionCategorizer.test.ts
│   ├── healthExplainer.test.ts
│   └── chatAssistant.test.ts
└── integration/
    └── aiEndpoints.test.ts
```

### Test Scenarios

1. **Financial Advisor:**
   - Complete portfolio analysis
   - Incomplete data handling
   - Error recovery

2. **Transaction Categorization:**
   - Common merchant patterns
   - Ambiguous transactions
   - Australian-specific merchants

3. **Health Explainer:**
   - High score explanation
   - Low score with recommendations
   - Category-specific explanations

4. **Chat Assistant:**
   - Simple questions
   - Follow-up questions
   - Context retention

---

## Success Metrics

| Metric | Target |
|--------|--------|
| API response time (advisor) | < 3 seconds |
| API response time (quick) | < 1 second |
| Transaction categorization accuracy | > 85% |
| Cost reduction vs OpenAI | > 60% |
| Error rate | < 2% |
| User satisfaction (AI features) | > 80% |

---

## Security Considerations

1. **Data Privacy:**
   - No financial data logged to Google
   - PII stripped from prompts where possible
   - Conversation data stored encrypted

2. **API Security:**
   - Rate limiting per user
   - Token-based authentication
   - Request validation

3. **Cost Control:**
   - Per-user daily token limits
   - Batch processing for efficiency
   - Model downgrade for low-priority requests

---

## Rollback Plan

If issues arise during migration:

1. **Immediate:** Re-enable OpenAI endpoints (env flag)
2. **Short-term:** Dual-provider mode (Gemini primary, OpenAI fallback)
3. **Long-term:** Full revert to OpenAI if Gemini proves unreliable

```typescript
// Dual-provider mode
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const ENABLE_OPENAI_FALLBACK = process.env.ENABLE_OPENAI_FALLBACK === 'true';
```

---

## Dependencies

- **Phase 11** — AI Strategy Engine (base architecture)
- **Phase 12** — Financial Health Engine (health data)
- **Phase 18** — Bank Transactions (transaction data)
- **Phase 26** — Document Intelligence (existing Gemini)
- **Google Cloud Account** — Gemini API access

---

## Related Documents

- `PHASE_11_AI_STRATEGY_ENGINE.md` — Original AI architecture
- `PHASE_11_AI_STRATEGY_ENGINE_UI_V2.md` — AI UI components
- `PHASE_12_FINANCIAL_HEALTH_ENGINE.md` — Health engine
- `PHASE_26_DOCUMENT_INTELLIGENCE_ENGINE.md` — Document AI
- `01_ARCHITECTURE_OVERVIEW.md` — System architecture

---

*Document Version: 1.0*
*Created: 2025-12-12*
*Status: Proposed*
