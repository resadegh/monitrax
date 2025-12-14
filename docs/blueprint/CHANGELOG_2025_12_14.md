# Changelog — 2025-12-14

## Phase 27: Complete AI Migration to Google Gemini

### Summary

Complete migration of all AI-powered features from OpenAI to Google Gemini. This consolidates the AI infrastructure under a single provider and removes all OpenAI dependencies from active code paths.

**Breaking Change:** `OPENAI_API_KEY` is no longer used. `GEMINI_API_KEY` is now required for all AI features.

---

### New Files

#### lib/ai/google/
| File | Purpose |
|------|---------|
| `geminiClient.ts` | Enhanced Gemini client with automatic model fallback |
| `modelConfig.ts` | Model IDs, pricing, capabilities, and fallback chains |
| `promptManager.ts` | Centralized system prompts for all AI features |
| `index.ts` | Module exports |

#### lib/ai/services/
| File | Purpose |
|------|---------|
| `financialAdvisor.ts` | Financial advice service using Gemini |
| `index.ts` | Service exports |

---

### Modified Files

#### API Routes
| File | Changes |
|------|---------|
| `app/api/ai/ask/route.ts` | Now uses `isGeminiConfigured()`, `askFinancialQuestion()` |
| `app/api/ai/advisor/route.ts` | Now uses `generateAIAdvice()` with Gemini |
| `app/api/ai/status/route.ts` | Reports `provider: "google-gemini"` |
| `app/api/ai/goal/route.ts` | Now uses `isGeminiConfigured()` |
| `app/api/ai/scenario/route.ts` | Now uses `isGeminiConfigured()` |
| `app/api/documents/analyze-for-form/route.ts` | Removed OpenAI fallback, Gemini-only |

#### AI Library
| File | Changes |
|------|---------|
| `lib/ai/index.ts` | Exports from new `./google` and `./services` modules |
| `lib/ai/strategyEnhancer.ts` | Migrated from OpenAI to Gemini |

#### Document Intelligence
| File | Changes |
|------|---------|
| `lib/documents/intelligence/analyzers/aiDocumentAnalyzer.ts` | Uses Gemini for document analysis |

---

### Deleted Files

| File | Reason |
|------|--------|
| `lib/ai/financialAdvisor.ts` | Replaced by `lib/ai/services/financialAdvisor.ts` |

---

### AI Features Migrated

| Feature | Previous | Now | Model |
|---------|----------|-----|-------|
| Financial Advisor | OpenAI gpt-4o-mini | Gemini | gemini-2.5-flash |
| Question Answering | OpenAI gpt-4o-mini | Gemini | gemini-2.0-flash |
| Document Form Auto-Fill | OpenAI (fallback) | Gemini | gemini-2.0-flash |
| Document Analysis | OpenAI gpt-4o-mini | Gemini | gemini-2.0-flash |
| Goal Progress Analysis | OpenAI gpt-4o-mini | Gemini | gemini-2.0-flash |
| Scenario Analysis | OpenAI gpt-4o-mini | Gemini | gemini-2.0-flash |
| Recommendation Enhancement | OpenAI gpt-4o-mini | Gemini | gemini-2.0-flash |
| Executive Summary | OpenAI gpt-4o-mini | Gemini | gemini-2.0-flash |

---

### Technical Details

#### Gemini Model Configuration

```typescript
GEMINI_MODELS = {
  FLASH: 'gemini-2.0-flash',
  FLASH_LATEST: 'gemini-2.5-flash-preview-05-20',
  PRO: 'gemini-2.5-pro-preview-05-06',

  // Use-case aliases
  QUICK_RESPONSE: 'gemini-2.0-flash',
  FINANCIAL_ADVISOR: 'gemini-2.5-flash-preview-05-20',
  DOCUMENT_ANALYSIS: 'gemini-2.0-flash',
}
```

#### Model Fallback Chains

```typescript
MODEL_FALLBACKS = {
  'gemini-2.0-flash': ['gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash'],
  'gemini-2.5-flash-preview-05-20': ['gemini-2.0-flash', 'gemini-1.5-flash'],
  'gemini-2.5-pro-preview-05-06': ['gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash'],
}
```

#### Token Usage Tracking

All AI responses now include usage metrics:

```typescript
{
  usage: {
    model: 'gemini-2.0-flash',
    promptTokens: 1200,
    completionTokens: 450,
    totalTokens: 1650,
    estimatedCost: 0.00049
  }
}
```

---

### Environment Configuration

```env
# Required for all AI features
GEMINI_API_KEY=AIza...

# Get your key from: https://aistudio.google.com/app/apikey
```

---

### Verification

#### Check AI Status
```bash
GET /api/ai/status

# Expected Response
{
  "configured": true,
  "provider": "google-gemini",
  "version": "2.0.0",
  "features": {
    "financialAdvisor": true,
    "chatAssistant": true,
    "projections": true,
    "documentAnalysis": true
  }
}
```

#### Server Logs
When AI is working correctly, logs show:
```
[API] Getting Gemini AI response...
[Gemini] Trying model: gemini-2.0-flash
[Gemini] Raw response length: 1523
[API] Gemini AI response generated
[API] Token usage: 1650
```

---

### Commits

| Hash | Message |
|------|---------|
| `a75c1dd` | feat(ai): migrate all AI features from OpenAI to Google Gemini (Phase 27) |
| `a844493` | fix(ai): complete Gemini migration - remove remaining OpenAI dependencies |

---

### Documentation Updates

- Created `PHASE_27_GEMINI_AI_MIGRATION.md`
- Updated `PHASE_26_DOCUMENT_INTELLIGENCE_ENGINE.md` - Removed OpenAI fallback references
- Updated `CHANGELOG_2025_12_12.md` - Superseded by this changelog

---

*Status: Complete*
*Author: Claude Code*
