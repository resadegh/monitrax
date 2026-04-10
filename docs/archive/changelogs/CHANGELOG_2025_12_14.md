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
| `ac9e09d` | docs: add Phase 27 documentation and update blueprints |
| `af1a14f` | feat(ui): add 'Powered by Gemini AI' badges to AI-powered components |
| `7d328fd` | fix(ai): update system prompts to identify as Google Gemini AI |
| `602d8b6` | feat(ai): add AI-powered debt analysis to Debt Planner |
| `ebb71e3` | fix(ai): fix Property type reference in debt analysis API |
| `df5f361` | feat(ai): add smart budgeting rules to debt analysis |
| `c97ecc6` | fix(ai): constrain debt recommendations to actual available cash flow |
| `c41ba5a` | fix(ai): add server-side validation to cap debt recommendations |

---

## Server-Side AI Validation (Phase 27.2)

### Critical Fix: AI Recommendation Capping

Fixed a critical bug where the AI was recommending surplus amounts exceeding the user's actual available cashflow. For example, recommending $8,443/month when only $4,969/month was available.

#### Root Cause
The AI (Gemini) was not reliably following prompt constraints about available cashflow, even with explicit instructions. The AI would hallucinate "True Disposable Income" values that exceeded the actual calculated cashflow.

#### Solution: Server-Side Validation
Added `validateAndCapRecommendations()` function that enforces hard limits on AI recommendations:

```typescript
// Calculate realistic surplus limits based on actual available cashflow
const maxAggressiveSurplus = Math.round(availableForExtra * 0.9);  // 90%
const maxRecommendedSurplus = Math.round(availableForExtra * 0.6); // 60%
const maxMinimumSurplus = Math.round(availableForExtra * 0.3);     // 30%
```

#### Key Changes

| Change | Description |
|--------|-------------|
| Server-side capping | All surplus recommendations are now capped to percentages of actual available cashflow |
| Budget analysis validation | `trueDisposableIncome` capped to `availableForExtraRepayments` |
| Emergency fund tracking | Cash balance checked against thresholds ($10k critical, $20k needs building) |
| Hierarchy enforcement | Ensures minimum < recommended < aggressive |
| User warning | Warning added when AI recommendations were significantly off |
| API response | Now includes `availableForExtraRepayments` and `cashBalance` for UI validation |

#### Validation Rules

| Tier | Percentage of Available | Purpose |
|------|------------------------|---------|
| Minimum | 30% | Sustainable long-term payment |
| Recommended | 60% | Balanced approach |
| Aggressive | 90% | Maximum while leaving buffer |

---

## AI-Powered Debt Analysis (Phase 27.1)

### New API Endpoint

**POST /api/ai/debt-analysis**

AI-powered debt strategy advisor that analyzes user's loans, income, and expenses to provide personalized debt reduction recommendations.

#### Features
- **Debt Health Score** (0-100) - Overall assessment of debt situation
- **Strategy Recommendation** - Tax-Aware, Avalanche, or Snowball with reasoning
- **Optimal Surplus Amounts** - Minimum, recommended, and aggressive payment levels
- **Key Insights** - Opportunities, warnings, and tips with quantified impact
- **Loan Priority Order** - Which loans to pay first and why
- **Action Plan** - Step-by-step instructions with timelines
- **Projections** - Debt-free date, interest saved, time saved

#### New Files
| File | Purpose |
|------|---------|
| `app/api/ai/debt-analysis/route.ts` | AI debt analysis API endpoint |

#### Updated Files
| File | Changes |
|------|---------|
| `lib/ai/google/promptManager.ts` | Added `DEBT_ANALYSIS_PROMPT` |
| `lib/ai/google/index.ts` | Export new prompt |
| `app/dashboard/debt-planner/page.tsx` | AI Strategy Advisor panel UI |

### UI Components Updated

Added "Powered by Gemini AI" badges to:
- `components/AiChatButton.tsx` - Chat panel header
- `components/strategy/AiAdvisorPanel.tsx` - Advisor panel
- `components/documents/FormDocumentUpload.tsx` - Document scan
- `components/documents/intelligence/AnalysisPreviewCard.tsx` - Analysis results

### System Prompts Updated

All AI system prompts now explicitly identify as "powered by Google Gemini AI":
- `FINANCIAL_ADVISOR_SYSTEM_PROMPT`
- `QUICK_ANALYSIS_SYSTEM_PROMPT`
- `QUESTION_ANSWERING_PROMPT`
- `PROJECTIONS_SYSTEM_PROMPT`
- `DOCUMENT_EXTRACTION_PROMPT`
- `FORM_AUTOFILL_PROMPT`
- `SCENARIO_ANALYSIS_PROMPT`
- `GOAL_PROGRESS_PROMPT`
- `DEBT_ANALYSIS_PROMPT`

---

### Documentation Updates

- Created `PHASE_27_GEMINI_AI_MIGRATION.md`
- Updated `PHASE_26_DOCUMENT_INTELLIGENCE_ENGINE.md` - Removed OpenAI fallback references
- Updated `CHANGELOG_2025_12_12.md` - Superseded by this changelog

---

## December 15, 2025 — NET vs GROSS salaryType Double-Taxation Fix

### Bug Fix: Cashflow Tax Calculation

**Issue:** When users entered salary as "Net (After Tax)", the cashflow calculations were incorrectly deducting PAYG tax again, resulting in double-taxation.

**Root Cause:** The income normalizer and snapshot API were always calculating PAYG from the raw `amount` field, ignoring the `salaryType` field that indicates whether the user entered NET or GROSS income.

**Files Modified:**
| File | Changes |
|------|---------|
| `app/api/portfolio/snapshot/route.ts` | Added `getGrossIncomeAmount()`, `getPaygWithholding()` helpers |
| `lib/cashflow/incomeNormalizer.ts` | Updated `normalizeIncomeStream()` to handle NET/GROSS |
| `lib/cashflow/types.ts` | Extended `IncomeStream` interface with salary fields |
| `app/api/cashflow/route.ts` | Pass salary-specific fields to normalizer |

**Commit:** `e824a9b` fix: respect salaryType when calculating cashflow tax deduction

---

*Status: Complete*
*Author: Claude Code*
