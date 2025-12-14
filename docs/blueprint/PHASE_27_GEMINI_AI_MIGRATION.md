# PHASE 27 — GEMINI AI MIGRATION
**Monitrax Blueprint — Phase 27**
**Version:** v1.0
**Status:** Complete
**Created:** 2025-12-14
**Updated:** 2025-12-14

---

## Overview

Phase 27 completes the migration of all AI-powered features from OpenAI to Google Gemini. This consolidates the AI infrastructure under a single provider, reduces operational complexity, and provides cost savings through Google's competitive pricing.

> "All AI features now speak Gemini — unified, faster, and more cost-effective."

---

## Objectives

- Migrate all AI endpoints from OpenAI to Google Gemini
- Create a robust, modular Gemini client with automatic model fallback
- Centralize system prompts for consistency across features
- Remove OpenAI dependencies from active code paths
- Maintain backward compatibility with existing API contracts
- Document the new AI architecture

**Breaking Change:**
- `OPENAI_API_KEY` is no longer used for AI features
- `GEMINI_API_KEY` is now **required** for all AI functionality

---

## Key Principles

- **Single Provider** — All AI calls go through Gemini for simplified operations
- **Automatic Fallback** — Models gracefully degrade if primary model unavailable
- **Cost Transparency** — Token usage and estimated costs tracked per request
- **Australian Context** — All prompts optimized for Australian financial advice
- **Graceful Degradation** — If AI unavailable, features return meaningful defaults

---

## Architecture

### New Directory Structure

```
lib/ai/
├── google/                      # NEW - Gemini infrastructure
│   ├── geminiClient.ts          # Enhanced client with fallbacks
│   ├── modelConfig.ts           # Model selection and pricing
│   ├── promptManager.ts         # Centralized system prompts
│   └── index.ts                 # Module exports
├── services/                    # NEW - AI service layer
│   ├── financialAdvisor.ts      # Financial advice (Gemini)
│   └── index.ts                 # Service exports
├── contextBuilder.ts            # Unchanged - builds prompts
├── strategyEnhancer.ts          # UPDATED - now uses Gemini
├── gemini.ts                    # Legacy Gemini client (Phase 26)
├── openai.ts                    # Legacy - no longer used
├── types.ts                     # Type definitions
└── index.ts                     # UPDATED - exports Gemini services
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Request Flow                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   API Route (e.g., /api/ai/advisor)                                     │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    lib/ai/index.ts                               │   │
│   │   • Exports: generateAIAdvice, askFinancialQuestion             │   │
│   │   • Exports: isGeminiConfigured, GEMINI_MODELS                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              lib/ai/services/financialAdvisor.ts                 │   │
│   │   • generateAIAdvice() - Full financial analysis                │   │
│   │   • askFinancialQuestion() - Q&A with context                   │   │
│   │   • buildFinancialContextFromSnapshot() - Data prep             │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    lib/ai/google/                                │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │                                                                  │   │
│   │   geminiClient.ts                                                │   │
│   │   ├── getGeminiClient() - Singleton client                      │   │
│   │   ├── isGeminiConfigured() - Check API key                      │   │
│   │   ├── generateGeminiJSONCompletion() - JSON responses           │   │
│   │   └── generateGeminiTextCompletion() - Text responses           │   │
│   │                                                                  │   │
│   │   modelConfig.ts                                                 │   │
│   │   ├── GEMINI_MODELS - Available model IDs                       │   │
│   │   ├── MODEL_FALLBACKS - Fallback chains                         │   │
│   │   ├── getModelPricing() - Cost per 1M tokens                    │   │
│   │   └── getModelCapabilities() - Model limits                     │   │
│   │                                                                  │   │
│   │   promptManager.ts                                               │   │
│   │   ├── FINANCIAL_ADVISOR_SYSTEM_PROMPT                           │   │
│   │   ├── QUESTION_ANSWERING_PROMPT                                 │   │
│   │   ├── DOCUMENT_EXTRACTION_PROMPT                                │   │
│   │   └── buildFinancialContextPrompt()                             │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                 Google Generative AI SDK                         │   │
│   │   @google/generative-ai                                          │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Gemini Model Configuration

### Available Models

| Model ID | Use Case | Input/1M | Output/1M |
|----------|----------|----------|-----------|
| `gemini-2.0-flash` | Quick responses, Q&A | $0.075 | $0.30 |
| `gemini-2.5-flash-preview-05-20` | Financial analysis | $0.15 | $0.60 |
| `gemini-2.5-pro-preview-05-06` | Complex reasoning | $1.25 | $10.00 |

### Model Aliases

```typescript
GEMINI_MODELS = {
  QUICK_RESPONSE: 'gemini-2.0-flash',
  FINANCIAL_ADVISOR: 'gemini-2.5-flash-preview-05-20',
  DOCUMENT_ANALYSIS: 'gemini-2.0-flash',
}
```

### Fallback Chains

If primary model returns 404 (not available), fallback automatically:

```
gemini-2.0-flash
  → gemini-2.5-flash-preview-05-20
  → gemini-1.5-flash

gemini-2.5-flash-preview-05-20
  → gemini-2.0-flash
  → gemini-1.5-flash

gemini-2.5-pro-preview-05-06
  → gemini-2.5-flash-preview-05-20
  → gemini-2.0-flash
```

---

## API Endpoints

### Migrated Endpoints

| Endpoint | Method | Purpose | Model |
|----------|--------|---------|-------|
| `/api/ai/ask` | POST | Question answering | gemini-2.0-flash |
| `/api/ai/advisor` | POST | Financial advice | gemini-2.5-flash |
| `/api/ai/advisor` | GET | Quick status check | N/A |
| `/api/ai/status` | GET | Check AI config | N/A |
| `/api/ai/goal` | POST | Goal analysis | gemini-2.0-flash |
| `/api/ai/scenario` | POST | What-if scenarios | gemini-2.0-flash |
| `/api/documents/analyze-for-form` | POST | Document extraction | gemini-2.0-flash |

### Request/Response Examples

#### POST /api/ai/ask

```typescript
// Request
{
  "question": "Should I pay off my mortgage faster or invest?"
}

// Response
{
  "success": true,
  "data": {
    "question": "Should I pay off my mortgage faster or invest?",
    "answer": "Based on your current situation with a 6.5% mortgage rate...",
    "suggestions": [
      "What's my break-even point for investing vs mortgage payoff?",
      "How would extra repayments affect my loan term?",
      "What investment returns do I need to beat my mortgage rate?"
    ],
    "usage": {
      "model": "gemini-2.0-flash",
      "totalTokens": 1523,
      "estimatedCost": 0.00045
    }
  }
}
```

#### POST /api/ai/advisor

```typescript
// Request
{
  "mode": "detailed",
  "focusAreas": ["debt", "investment"],
  "includeProjections": true
}

// Response
{
  "success": true,
  "data": {
    "advice": {
      "summary": "Your financial position is solid with a net worth of $1.2M...",
      "healthScore": 78,
      "observations": [...],
      "recommendations": [...],
      "riskAssessment": {...},
      "prioritizedActions": [...]
    },
    "dataQuality": { "score": 85, "status": "good" },
    "usage": {
      "model": "gemini-2.5-flash-preview-05-20",
      "totalTokens": 4521,
      "estimatedCost": 0.0027
    },
    "generatedAt": "2025-12-14T10:30:00Z"
  }
}
```

#### GET /api/ai/status

```typescript
// Response
{
  "success": true,
  "data": {
    "configured": true,
    "provider": "google-gemini",
    "version": "2.0.0",
    "features": {
      "financialAdvisor": true,
      "chatAssistant": true,
      "projections": true,
      "documentAnalysis": true
    },
    "models": {
      "quick": "gemini-2.0-flash",
      "detailed": "gemini-2.5-flash-preview-05-20",
      "document": "gemini-2.0-flash"
    }
  }
}
```

---

## Internal Services

### Strategy Enhancer (Updated)

The Strategy Enhancer now uses Gemini for all AI-powered enhancements:

| Function | Purpose | Model |
|----------|---------|-------|
| `enhanceRecommendation()` | Add personalized advice to recommendations | gemini-2.0-flash |
| `enhanceRecommendationsBatch()` | Batch enhancement (max 5) | gemini-2.0-flash |
| `generateExecutiveSummary()` | Portfolio summary generation | gemini-2.0-flash |
| `analyzeScenario()` | What-if scenario analysis | gemini-2.0-flash |
| `analyzeGoalProgress()` | Goal feasibility assessment | gemini-2.0-flash |

### Document Analyzer (Updated)

The AI Document Analyzer uses Gemini for complex document understanding:

| Function | Purpose | Model |
|----------|---------|-------|
| `analyzeDocumentWithAI()` | Extract structured data | gemini-2.0-flash |
| `explainExtraction()` | Explain extraction results | gemini-2.0-flash |

---

## Environment Configuration

### Required Variables

```env
# Required for all AI features
GEMINI_API_KEY=AIza...

# Get your key from: https://aistudio.google.com/app/apikey
```

### Verification

Check AI configuration via API:

```bash
curl -X GET /api/ai/status -H "Authorization: Bearer <token>"
```

Expected response when configured:
```json
{
  "configured": true,
  "provider": "google-gemini"
}
```

---

## Migration Summary

### Files Created

| File | Purpose |
|------|---------|
| `lib/ai/google/geminiClient.ts` | Enhanced Gemini client with fallbacks |
| `lib/ai/google/modelConfig.ts` | Model selection, pricing, capabilities |
| `lib/ai/google/promptManager.ts` | Centralized system prompts |
| `lib/ai/google/index.ts` | Module exports |
| `lib/ai/services/financialAdvisor.ts` | Financial advice service (Gemini) |
| `lib/ai/services/index.ts` | Service exports |

### Files Updated

| File | Changes |
|------|---------|
| `app/api/ai/ask/route.ts` | Now uses Gemini |
| `app/api/ai/advisor/route.ts` | Now uses Gemini |
| `app/api/ai/status/route.ts` | Reports Gemini config |
| `app/api/ai/goal/route.ts` | Now uses Gemini |
| `app/api/ai/scenario/route.ts` | Now uses Gemini |
| `app/api/documents/analyze-for-form/route.ts` | Removed OpenAI fallback |
| `lib/ai/index.ts` | Exports from new Gemini services |
| `lib/ai/strategyEnhancer.ts` | Migrated from OpenAI to Gemini |
| `lib/documents/intelligence/analyzers/aiDocumentAnalyzer.ts` | Uses Gemini |

### Files Removed

| File | Reason |
|------|--------|
| `lib/ai/financialAdvisor.ts` | Replaced by `lib/ai/services/financialAdvisor.ts` |

### Files Deprecated (Not Removed)

| File | Reason |
|------|--------|
| `lib/ai/openai.ts` | Legacy code, not imported anywhere |

---

## Validation Checklist

- [x] All AI endpoints return Gemini-powered responses
- [x] `/api/ai/status` reports `provider: "google-gemini"`
- [x] Model fallback works when primary model unavailable
- [x] Token usage tracked and returned in responses
- [x] No OpenAI references in active code paths
- [x] TypeScript compiles without AI-related errors
- [x] Document extraction uses Gemini
- [x] Strategy enhancer uses Gemini

---

## Commits

| Commit | Message |
|--------|---------|
| `a75c1dd` | feat(ai): migrate all AI features from OpenAI to Google Gemini (Phase 27) |
| `a844493` | fix(ai): complete Gemini migration - remove remaining OpenAI dependencies |

---

## Cost Comparison

### OpenAI (Previous)

| Model | Input/1M | Output/1M |
|-------|----------|-----------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |

### Gemini (Current)

| Model | Input/1M | Output/1M |
|-------|----------|-----------|
| gemini-2.0-flash | $0.075 | $0.30 |
| gemini-2.5-flash | $0.15 | $0.60 |

**Estimated Savings:** 50% reduction for equivalent capability (Flash models)

---

## Known Limitations

1. **Model Availability** — Some Gemini models may not be available in all regions
2. **Rate Limits** — Gemini has different rate limits than OpenAI
3. **JSON Mode** — Gemini's JSON mode occasionally returns malformed JSON (handled by fallback)

---

## Future Considerations

- [ ] Add streaming support for long responses
- [ ] Implement response caching for common queries
- [ ] Add usage analytics dashboard
- [ ] Consider Gemini 2.0 multimodal for document images

---

*Status: Complete*
*Author: Claude Code*
*Phase: 27*
