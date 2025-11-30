# PHASE 11 — AI STRATEGY ENGINE (UI & INTEGRATION LAYER)
### Strategy Dashboard • AI Advisor Panel • Entity Strategy Tabs • Conflict Resolution
Version: 2.0

---

# 1. PURPOSE

This document defines the **UI & Integration Layer** for the Phase 11 AI Strategy Engine. It builds on top of:
- The deterministic Strategy Engine (analyzers, scoring, synthesis)
- The AI/LLM Integration (OpenAI GPT-4 for natural language advice)

The goal is to provide users with:
- A comprehensive Strategy Dashboard
- AI-powered explanations and advice
- Entity-level strategy views
- Conflict resolution interfaces
- Seamless integration between rule-based recommendations and AI insights

---

# 2. DESIGN PRINCIPLES

1. **Rule-Based Foundation, AI Enhancement**
   - Core recommendations come from deterministic business logic
   - AI provides natural language explanations and personalized context
   - Users always see the distinction between algorithm and AI

2. **Transparency First**
   - Every recommendation shows its evidence graph
   - AI responses are clearly labeled as AI-generated
   - Confidence levels and data quality are always visible

3. **Actionable Interface**
   - Accept/Dismiss actions readily available
   - Clear next steps for each recommendation
   - Entity linking for context

4. **Responsive & Accessible**
   - Mobile-first responsive design
   - Keyboard navigation support
   - Screen reader compatible

---

# 3. COMPONENT ARCHITECTURE

```
app/(dashboard)/strategy/
├── page.tsx                     # Strategy Dashboard
├── [id]/page.tsx               # Strategy Detail View
└── preferences/page.tsx        # User Preferences

app/(dashboard)/properties/[id]/strategy/page.tsx
app/(dashboard)/loans/[id]/strategy/page.tsx
app/(dashboard)/investments/[id]/strategy/page.tsx

components/strategy/
├── AiAdvisorPanel.tsx          # AI Chat Interface
├── ConflictResolver.tsx        # Conflict Comparison UI
├── RecommendationCard.tsx      # Individual Recommendation
├── DataQualityBadge.tsx        # Data Quality Indicator
├── EvidenceGraph.tsx           # Evidence Visualization
├── ReasoningTrace.tsx          # Step-by-step Reasoning
└── ForecastChart.tsx           # Projection Visualization

lib/ai/
├── contextBuilder.ts           # AI Context Preparation
├── financialAdvisor.ts         # AI Service Layer
├── openai.ts                   # OpenAI Client
└── types.ts                    # AI Type Definitions
```

---

# 4. STRATEGY DASHBOARD

## 4.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Strategy Dashboard                                           │
├─────────────────────────────────────────────────────────────┤
│ [Data Quality: Good 78%] │ Last updated: 2 hours ago        │
│                          │ [🔄 Refresh Strategy]             │
├─────────────────────────────┬───────────────────────────────┤
│ TOP OPPORTUNITIES           │ RISK & FORECAST               │
│ ┌─────────────────────────┐ │ ┌───────────────────────────┐ │
│ │ 1. Refinance Home Loan  │ │ │ Risk Score: 42/100        │ │
│ │    SBS: 87 | HIGH       │ │ │ [Low Risk Indicator]      │ │
│ │    [View] [Accept] [AI] │ │ │                           │ │
│ ├─────────────────────────┤ │ │ Net Worth Trend: ↑ 12%    │ │
│ │ 2. Build Emergency Fund │ │ │ Debt Ratio: 32%           │ │
│ │    SBS: 75 | HIGH       │ │ │                           │ │
│ │    [View] [Accept] [AI] │ │ │ [View Full Forecast →]    │ │
│ └─────────────────────────┘ │ └───────────────────────────┘ │
├─────────────────────────────┴───────────────────────────────┤
│ ALL RECOMMENDATIONS                                          │
│ [Filter: Category ▾] [Status ▾] [Confidence ▾] [Sort: SBS ▾]│
├─────────────────────────────────────────────────────────────┤
│ │ Title              │ Category │ SBS │ Status  │ Actions  │ │
│ ├────────────────────┼──────────┼─────┼─────────┼──────────┤ │
│ │ Refinance Loan     │ DEBT     │ 87  │ PENDING │ [▶][✓][AI]│ │
│ │ Emergency Fund     │ CASHFLOW │ 75  │ PENDING │ [▶][✓][AI]│ │
│ │ Rebalance Portfolio│ INVEST   │ 68  │ ACCEPTED│ [▶]  [AI]│ │
│ └────────────────────┴──────────┴─────┴─────────┴──────────┘ │
│ Showing 1-10 of 24                    [◀ Prev] [Next ▶]     │
└─────────────────────────────────────────────────────────────┘
```

## 4.2 Features

### Top Strip
- **Data Quality Badge**: Shows overall data quality score with color coding
  - Green (80-100%): Excellent
  - Yellow (60-79%): Good
  - Orange (40-59%): Fair
  - Red (<40%): Limited
- **Last Updated**: Timestamp of last strategy generation
- **Refresh Button**: Triggers POST /api/strategy/generate

### Top Opportunities
- Shows top 5 recommendations by SBS score
- Quick action buttons (View, Accept, AI)
- Visual SBS score indicator

### Risk & Forecast Panel
- Portfolio risk score visualization
- Key metrics summary
- Link to detailed forecast view

### Recommendations Table
- Filterable by category, status, confidence
- Sortable by SBS (default), date, category
- Pagination (10 per page)
- Actions: View details, Accept/Dismiss, Ask AI

---

# 5. STRATEGY DETAIL VIEW

## 5.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Strategy Dashboard                                 │
├─────────────────────────────────────────────────────────────┤
│ REFINANCE HOME LOAN                                          │
│ Category: DEBT | Type: TACTICAL | SBS: 87 | Confidence: HIGH│
├─────────────────────────────┬───────────────────────────────┤
│ SUMMARY                     │ LINKED ENTITIES               │
│ ┌─────────────────────────┐ │ ┌───────────────────────────┐ │
│ │ Current Rate: 5.5%      │ │ │ 🏠 123 Main Street        │ │
│ │ Market Rate: 4.2%       │ │ │    Property Value: $850K  │ │
│ │ Monthly Savings: $340   │ │ │    [View Property →]      │ │
│ │ Break-even: 8 months    │ │ ├───────────────────────────┤ │
│ │ Total Savings: $47,000  │ │ │ 💰 ANZ Home Loan          │ │
│ │                         │ │ │    Balance: $520,000      │ │
│ │ [✓ Accept] [✗ Dismiss]  │ │ │    [View Loan →]          │ │
│ └─────────────────────────┘ │ └───────────────────────────┘ │
├─────────────────────────────┼───────────────────────────────┤
│ FINANCIAL IMPACT            │ AI ADVISOR                    │
│ ┌─────────────────────────┐ │ ┌───────────────────────────┐ │
│ │ Monthly: -$340 payment  │ │ │ 💬 Ask about this...      │ │
│ │ Yearly: $4,080 saved    │ │ │                           │ │
│ │ 30-year: $47,000 saved  │ │ │ [Explain this rec]        │ │
│ │                         │ │ │ [What are the risks?]     │ │
│ │ Risk Impact: Low        │ │ │ [Compare alternatives]    │ │
│ │ Liquidity: Neutral      │ │ │                           │ │
│ └─────────────────────────┘ │ │ ─────────────────────────  │ │
├─────────────────────────────┤ │ AI Response:               │ │
│ EVIDENCE & REASONING        │ │ "Based on your current..." │ │
│ ┌─────────────────────────┐ │ │                           │ │
│ │ Step 1: Analyzed loan   │ │ │ ⚠️ AI-generated - not     │ │
│ │ Step 2: Compared rates  │ │ │    financial advice       │ │
│ │ Step 3: Calculated...   │ │ └───────────────────────────┘ │
│ └─────────────────────────┘ │                               │
├─────────────────────────────┴───────────────────────────────┤
│ ALTERNATIVES                                                 │
│ ┌───────────────┬───────────────┬───────────────────────────┐
│ │ Conservative  │ Moderate      │ Aggressive                │
│ │ Fixed 3yr     │ Variable Rate │ Split Loan                │
│ │ SBS: 72       │ SBS: 87       │ SBS: 65                   │
│ └───────────────┴───────────────┴───────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

## 5.2 Sections

### Summary Card
- Title, category, type, SBS score, confidence level
- Current status with action buttons
- Key metrics specific to the recommendation type

### Linked Entities
- Properties, loans, investments affected by this recommendation
- Quick links to entity detail pages
- Key metrics preview

### Financial Impact
- Monthly/yearly/lifetime impact projections
- Risk and liquidity impact assessment
- Cost-benefit breakdown

### Evidence & Reasoning
- Step-by-step logic trace
- Data sources used
- Thresholds and rules applied

### AI Advisor Panel
- Embedded chat interface
- Pre-defined quick questions
- AI-generated explanations with disclaimers

### Alternatives
- Conservative/Moderate/Aggressive options
- Side-by-side comparison
- Different risk/return profiles

---

# 6. AI ADVISOR PANEL

## 6.1 Component Specification

```typescript
interface AiAdvisorPanelProps {
  mode: 'portfolio' | 'entity' | 'recommendation';
  entityId?: string;
  entityType?: 'property' | 'loan' | 'investment';
  recommendationId?: string;
  onConversationUpdated?: (conversationId: string) => void;
}
```

## 6.2 Features

### Modes
- **Portfolio Mode**: General financial questions about the entire portfolio
- **Entity Mode**: Questions specific to a property, loan, or investment
- **Recommendation Mode**: Explain and discuss a specific recommendation

### Quick Actions
- "Explain this recommendation"
- "What are the risks?"
- "Compare with alternatives"
- "How does this affect my goals?"

### Response Display
- Markdown rendering for formatted responses
- Code highlighting for calculations
- Clear AI attribution and disclaimers

### Safety
- All responses include disclaimer: "AI-generated explanation – not personal financial advice"
- Data quality indicator shows context completeness
- Links to professional advice resources

---

# 7. ENTITY STRATEGY TABS

## 7.1 Structure

Each entity type (Property, Loan, Investment) gets a Strategy tab:

```
/properties/[id]/strategy
/loans/[id]/strategy
/investments/[id]/strategy
```

## 7.2 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 123 Main Street - Strategy                                   │
├─────────────────────────────────────────────────────────────┤
│ Property Value: $850,000 | Equity: $330,000 | Yield: 4.2%   │
├─────────────────────────────────────────────────────────────┤
│ TOP RECOMMENDATIONS FOR THIS PROPERTY                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Refinance Linked Loan    SBS: 87  [View] [Accept]    │ │
│ │ 2. Increase Rent            SBS: 62  [View] [Accept]    │ │
│ │ 3. Review Insurance         SBS: 45  [View] [Accept]    │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [🤖 Ask AI about this property]                             │
├─────────────────────────────────────────────────────────────┤
│ ALL RECOMMENDATIONS                                          │
│ (Filtered list of recommendations affecting this entity)    │
└─────────────────────────────────────────────────────────────┘
```

## 7.3 Features

- Entity header with key metrics
- Top 3 recommendations filtered by entity
- AI Advisor button in entity mode
- Full list of related recommendations

---

# 8. CONFLICT RESOLVER

## 8.1 Component Specification

```typescript
interface ConflictResolverProps {
  conflictGroup: ConflictGroup;
  onLearnMore?: (recommendationId: string) => void;
}

interface ConflictGroup {
  id: string;
  type: 'mutually_exclusive' | 'competing_priority';
  recommendations: Recommendation[];
  tradeoffAnalysis: TradeoffOption[];
  suggestedResolution: string;
}
```

## 8.2 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ CONFLICTING RECOMMENDATIONS                               │
│ These options compete for the same resources                 │
├─────────────────────────┬───────────────────────────────────┤
│ OPTION A                │ OPTION B                          │
│ Pay Down Mortgage Early │ Invest Surplus in Shares          │
├─────────────────────────┼───────────────────────────────────┤
│ SBS Score: 72           │ SBS Score: 68                     │
│ Financial Impact: $45K  │ Financial Impact: $62K            │
│ Risk Level: Low         │ Risk Level: Medium                │
├─────────────────────────┼───────────────────────────────────┤
│ ✓ Reduce debt faster    │ ✓ Build wealth                    │
│ ✓ Save interest         │ ✓ Compound growth                 │
│ ✓ Peace of mind         │ ✓ Tax advantages                  │
├─────────────────────────┼───────────────────────────────────┤
│ ✗ Less liquidity        │ ✗ Market volatility               │
│ ✗ Opportunity cost      │ ✗ Maintain debt longer            │
├─────────────────────────┼───────────────────────────────────┤
│ [Learn More →]          │ [Learn More →]                    │
└─────────────────────────┴───────────────────────────────────┘
│ 💡 Suggested: Consider a balanced approach - allocate 60%   │
│    to debt reduction and 40% to investments.                │
└─────────────────────────────────────────────────────────────┘
```

## 8.3 Features

- Side-by-side comparison of conflicting options
- Pros and cons for each option
- SBS scores and financial impact
- Suggested resolution from the engine
- Links to full recommendation details

---

# 9. CONTEXT BUILDER

## 9.1 Purpose

Prepares comprehensive context for AI prompts by gathering:
- Portfolio snapshot data
- Relevant recommendation details
- User preferences
- Historical context

## 9.2 Interface

```typescript
interface StrategyAiContextInput {
  userId: string;
  recommendationId?: string;
  entityId?: string;
  entityType?: 'property' | 'loan' | 'investment';
  sessionId?: string;
}

interface StrategyAiContext {
  portfolio: PortfolioSummary;
  recommendation?: RecommendationContext;
  entity?: EntityContext;
  preferences: UserPreferences;
  dataQuality: DataQualityReport;
}
```

## 9.3 Implementation

The context builder:
1. Fetches minimal required data (not full snapshots)
2. Formats data for AI consumption
3. Includes evidence graphs when available
4. Adds user preference context

---

# 10. API INTEGRATION

## 10.1 Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/strategy/generate | POST | Generate new recommendations |
| /api/strategy | GET | List recommendations with filters |
| /api/strategy/[id] | GET | Get recommendation details |
| /api/strategy/[id] | PATCH | Accept/dismiss recommendation |
| /api/strategy/conflicts | GET | Get conflict groups |
| /api/strategy/stats | GET | Get summary statistics |
| /api/ai/advisor | POST | Get AI-powered advice |
| /api/ai/ask | POST | Ask specific questions |
| /api/ai/scenario | POST | Analyze scenarios |

## 10.2 Query Parameters

**GET /api/strategy**
- `status`: PENDING | ACCEPTED | DISMISSED | EXPIRED
- `category`: GROWTH | DEBT | CASHFLOW | INVESTMENT | PROPERTY | RISK_RESILIENCE
- `confidence`: HIGH | MEDIUM | LOW
- `entityId`: Filter by affected entity
- `limit`: Number of results (default: 10)
- `offset`: Pagination offset

---

# 11. SAFETY & DISCLAIMERS

## 11.1 Required Disclaimers

All AI-generated content must include:
- "AI-generated explanation – not personal financial advice"
- "Based on provided data only"
- "Consult a licensed financial advisor for personal advice"

## 11.2 Data Quality Warnings

When data quality is below 60%:
- Show warning banner on dashboard
- Indicate limited confidence in AI responses
- Suggest data improvements

## 11.3 Audit Trail

All AI interactions are logged:
- Timestamp
- User ID
- Query type
- Response summary
- Token usage

---

# 12. IMPLEMENTATION STAGES

## Stage 1: Blueprint Creation ✅
- Create this blueprint document

## Stage 2: Strategy Dashboard Enhancement ✅
- Refactor dashboard with new layout
- Add filters and sorting
- Integrate data quality badge
- Add AI entry points
- Add DashboardLayout wrapper for sidebar navigation

## Stage 3: Strategy Detail View Enhancement ✅
- Add linked entities panel
- Integrate AI Advisor panel
- Show alternatives section
- Add conflict resolver integration

## Stage 4: AI Advisor Panel ✅
- Create reusable chat component (`components/strategy/AiAdvisorPanel.tsx`)
- Implement quick actions
- Add markdown rendering
- Include safety disclaimers
- Add auth token for API calls

## Stage 5: Entity Strategy Tabs ✅
- Create property strategy page (`app/dashboard/properties/[id]/strategy/page.tsx`)
- Create loan strategy page (`app/dashboard/loans/[id]/strategy/page.tsx`)
- Create investment strategy page (`app/dashboard/investments/holdings/[id]/strategy/page.tsx`)
- Filter recommendations by entity

## Stage 6: Conflict Resolver UI ✅
- Create comparison component (`components/strategy/ConflictResolver.tsx`)
- Show pros/cons
- Display suggested resolution
- Add "Ask AI" button for each option
- Dark mode support

## Stage 7: Context Builder ✅
- Create context builder module (`lib/ai/contextBuilder.ts`)
- Entity-specific context builders (property, loan, investment)
- Add usage logging

## Stage 8: Documentation ✅
- Update `docs/api/STRATEGY_API.md` with AI endpoints
- Add integration examples

## Stage 9: Floating AI Chat Button ✅ (Added 2025-11-30)
- Create `components/AiChatButton.tsx` for global AI access
- Add to `DashboardLayout.tsx` for all dashboard pages
- Brand-aligned styling (emerald primary, navy header)

---

# 13. ACCEPTANCE CRITERIA

Phase 11 UI V2 is complete when:

- [x] Strategy Dashboard shows top opportunities and full list
- [x] Filters and sorting work correctly
- [x] Data quality badge displays accurately
- [x] Strategy detail view shows all sections
- [x] AI Advisor panel responds to queries
- [x] Entity strategy tabs filter correctly
- [x] Conflict resolver displays comparisons
- [x] All safety disclaimers are shown
- [x] Mobile responsive design works
- [x] TypeScript compilation passes
- [x] No console errors in browser
- [x] Floating AI chat button on all dashboard pages (added 2025-11-30)
- [x] Auth tokens added to all API calls

---

# END OF PHASE 11 — AI STRATEGY ENGINE (UI & INTEGRATION LAYER)
