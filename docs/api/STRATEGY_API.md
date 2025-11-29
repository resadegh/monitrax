# Strategy Engine API Documentation

**Version:** 1.0.0
**Base Path:** `/api/strategy`
**Authentication:** Required (Bearer token)

---

## Overview

The Strategy Engine API provides endpoints for generating, managing, and viewing AI-powered financial strategy recommendations.

All endpoints require authentication via Bearer token in the `Authorization` header.

---

## Endpoints

### 1. POST /api/strategy/generate

Generate strategy recommendations for the authenticated user.

**Request Body:**
```json
{
  "forceRefresh": boolean (optional, default: false)
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "uuid",
        "category": "DEBT" | "GROWTH" | "CASHFLOW" | "INVESTMENT" | "PROPERTY" | "RISK_RESILIENCE",
        "type": "TACTICAL" | "OPERATIONAL" | "STRATEGIC" | "LONG_TERM",
        "severity": "critical" | "high" | "medium" | "low",
        "title": "string",
        "summary": "string",
        "sbsScore": number (0-100),
        "confidence": "HIGH" | "MEDIUM" | "LOW",
        "status": "PENDING" | "ACCEPTED" | "DISMISSED" | "EXPIRED"
      }
    ],
    "dataQuality": {
      "overallScore": number (0-100),
      "canProceed": boolean,
      "isLimitedMode": boolean,
      "warnings": string[]
    },
    "stats": {
      "totalFindings": number,
      "recommendationsSaved": number,
      "analyzersRun": number,
      "executionTime": number (ms)
    }
  },
  "errors": string[] (optional)
}
```

**Example:**
```bash
curl -X POST https://app.monitrax.com/api/strategy/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"forceRefresh": true}'
```

---

### 2. GET /api/strategy

List all strategy recommendations for the authenticated user.

**Query Parameters:**
- `status` (optional): Filter by status (PENDING, ACCEPTED, DISMISSED, EXPIRED)
- `category` (optional): Filter by category
- `limit` (optional, default: 50): Number of results to return
- `offset` (optional, default: 0): Pagination offset

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "recommendations": [...],
    "pagination": {
      "total": number,
      "limit": number,
      "offset": number,
      "hasMore": boolean
    }
  }
}
```

**Example:**
```bash
curl https://app.monitrax.com/api/strategy?status=PENDING&limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. GET /api/strategy/:id

Get a single strategy recommendation by ID.

**URL Parameters:**
- `id`: Recommendation UUID

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category": "DEBT",
    "type": "TACTICAL",
    "severity": "high",
    "title": "Refinance home loan to save $450/month",
    "summary": "Current loan rate (5.5%) is 1.5% above market average...",
    "detail": "Full detailed explanation...",
    "sbsScore": 87,
    "confidence": "HIGH",
    "financialImpact": {
      "min": 5000,
      "max": 6000,
      "currency": "AUD",
      "timeframe": "annual",
      "monthlySavings": 450,
      "totalSavings": 135000,
      "breakEven": 18
    },
    "riskImpact": {
      "current": 6.5,
      "projected": 5.0,
      "factors": ["rate_risk", "liquidity_risk"]
    },
    "reasoning": "Step-by-step explanation...",
    "evidenceGraph": {
      "dataPoints": [...],
      "historicalTrend": [...],
      "snapshotValues": {...},
      "insightFlags": [...],
      "healthIssues": [...],
      "calculations": {...}
    },
    "alternativeIds": ["uuid1", "uuid2"],
    "affectedEntities": [
      {
        "id": "loan1",
        "type": "loan",
        "name": "Home Loan - Bank ABC",
        "href": "/dashboard/loans?id=loan1"
      }
    ],
    "status": "PENDING",
    "createdAt": "ISO-8601 date",
    "updatedAt": "ISO-8601 date",
    "expiresAt": "ISO-8601 date"
  }
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "Recommendation not found"
}
```

---

### 4. PATCH /api/strategy/:id

Accept or dismiss a recommendation.

**URL Parameters:**
- `id`: Recommendation UUID

**Request Body:**
```json
{
  "status": "ACCEPTED" | "DISMISSED",
  "notes": "string (optional, required for DISMISSED)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ACCEPTED",
    "acceptedAt": "ISO-8601 date" // or dismissedAt + dismissReason for DISMISSED
  }
}
```

**Example:**
```bash
curl -X PATCH https://app.monitrax.com/api/strategy/abc-123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACCEPTED"}'
```

---

### 5. DELETE /api/strategy/:id

Delete a recommendation.

**URL Parameters:**
- `id`: Recommendation UUID

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### 6. GET /api/strategy/:id/alternatives

Get alternative approaches for a recommendation.

**URL Parameters:**
- `id`: Recommendation UUID

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "id": "uuid",
      "title": "string",
      "category": "DEBT",
      "sbsScore": 87
    },
    "alternatives": [
      {
        "id": "alt1",
        "approach": "CONSERVATIVE",
        "title": "Conservative alternative",
        "summary": "Lower risk version...",
        "sbsScore": 75,
        "financialImpact": {...},
        "riskImpact": {...},
        "tradeoffs": {
          "pros": ["Lower risk", "Faster break-even"],
          "cons": ["Lower potential returns"]
        }
      },
      {
        "id": "alt2",
        "approach": "AGGRESSIVE",
        "title": "Aggressive alternative",
        "summary": "Higher reward version...",
        "sbsScore": 82,
        "financialImpact": {...},
        "riskImpact": {...},
        "tradeoffs": {
          "pros": ["Higher returns", "Faster wealth building"],
          "cons": ["Higher risk", "Longer commitment"]
        }
      }
    ]
  }
}
```

---

### 7. GET /api/strategy/conflicts

Detect conflicts between current recommendations.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "conflictCount": number,
    "recommendationsAnalyzed": number,
    "conflicts": [
      {
        "id": "conflict1",
        "type": "resource_allocation" | "contradictory_advice" | "timing_overlap",
        "severity": "critical" | "high" | "medium",
        "recommendations": ["uuid1", "uuid2"],
        "description": "Both recommendations require the same funds...",
        "resolution": "Choose higher SBS score or defer one action"
      }
    ]
  }
}
```

---

### 8. GET /api/strategy/stats

Get summary statistics for user's recommendations.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "byStatus": {
      "PENDING": number,
      "ACCEPTED": number,
      "DISMISSED": number,
      "EXPIRED": number
    },
    "byCategory": {
      "DEBT": number,
      "GROWTH": number,
      "CASHFLOW": number,
      "INVESTMENT": number,
      "PROPERTY": number,
      "RISK_RESILIENCE": number
    },
    "topRecommendations": [
      {
        "id": "uuid",
        "title": "string",
        "category": "DEBT",
        "sbsScore": 92,
        "severity": "critical"
      }
    ],
    "averageSBSScore": number,
    "recentActivity": [
      {
        "id": "uuid",
        "title": "string",
        "status": "ACCEPTED",
        "createdAt": "ISO-8601",
        "acceptedAt": "ISO-8601",
        "dismissedAt": null
      }
    ]
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid request parameters",
  "details": "Specific error message"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to generate strategies",
  "details": "Specific error message"
}
```

---

## Rate Limiting

- Strategy generation is rate-limited to 10 requests per hour per user
- Other endpoints: 100 requests per minute per user

---

## Data Models

### Strategic Benefit Score (SBS)

The SBS is a 0-100 score calculated from weighted components:

| Component | Weight |
|-----------|--------|
| Financial Benefit | 40% |
| Risk Reduction | 25% |
| Cost Avoidance | 15% |
| Liquidity Impact | 10% |
| Tax Impact | 5% |
| Data Confidence | 5% |

**SBS Ratings:**
- 80-100: CRITICAL (highest priority)
- 60-79: HIGH (important)
- 40-59: MEDIUM (consider)
- 0-39: LOW (optional)

### Confidence Levels

- **HIGH**: Data completeness > 80%, recent data < 30 days
- **MEDIUM**: Data completeness 60-80%, data < 90 days
- **LOW**: Data completeness < 60%, data > 90 days

### Evidence Graph

Each recommendation includes an evidence graph showing:
- **dataPoints**: Historical financial data used
- **historicalTrend**: Trend analysis over time
- **snapshotValues**: Current values from snapshot
- **insightFlags**: Related insights from insights engine
- **healthIssues**: GRDCS health issues considered
- **calculations**: Step-by-step calculation trace

---

## Best Practices

1. **Generate strategies regularly** - Run once per week for fresh recommendations
2. **Review high-priority items first** - Focus on SBS > 80 recommendations
3. **Check for conflicts** - Always check `/conflicts` before accepting multiple recommendations
4. **Review alternatives** - Consider conservative/aggressive alternatives for major decisions
5. **Update preferences** - Keep user preferences current for better recommendations

---

---

## AI-Powered Endpoints

### 9. POST /api/ai/ask

Ask the AI advisor a specific financial question.

**Request Body:**
```json
{
  "question": "string (required, max 1000 chars)",
  "entityId": "string (optional)",
  "entityType": "property" | "loan" | "investment" (optional),
  "recommendationId": "string (optional)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "question": "How can I reduce my mortgage interest?",
    "answer": "Based on your current loan at 5.5%...",
    "suggestions": [
      "What about refinancing options?",
      "How does an offset account help?",
      "What are the break fees?"
    ],
    "dataQualityNote": "Note: Limited financial data available...",
    "usage": {
      "model": "gpt-4",
      "totalTokens": 1250,
      "estimatedCost": 0.04
    }
  }
}
```

**Example:**
```bash
curl -X POST https://app.monitrax.com/api/ai/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "What should be my next financial priority?"}'
```

**Entity-Specific Question:**
```bash
curl -X POST https://app.monitrax.com/api/ai/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How can I optimize this property?",
    "entityType": "property",
    "entityId": "prop-123"
  }'
```

---

### 10. POST /api/ai/advice

Generate comprehensive AI-powered financial advice.

**Request Body:**
```json
{
  "mode": "quick" | "detailed" (default: "detailed"),
  "focusAreas": ["debt", "investment", "property"] (optional),
  "includeProjections": boolean (optional, default: false)
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "advice": {
    "summary": "Your financial health is good with a score of 72...",
    "healthScore": 72,
    "observations": [
      {
        "category": "debt",
        "finding": "High interest loan detected",
        "impact": "concern",
        "details": "Your credit card at 19.9% is costing $200/month extra"
      }
    ],
    "recommendations": [
      {
        "id": "rec_1",
        "title": "Pay off high-interest credit card",
        "description": "Detailed description...",
        "category": "debt",
        "priority": "high",
        "potentialImpact": "Save $2,400/year in interest",
        "timeframe": "1-3 months",
        "steps": ["Step 1", "Step 2"]
      }
    ],
    "riskAssessment": {
      "overallRisk": "moderate",
      "riskFactors": [...],
      "mitigationStrategies": [...]
    },
    "prioritizedActions": [
      {
        "rank": 1,
        "action": "Pay off credit card",
        "reason": "Highest interest cost",
        "urgency": "immediate",
        "estimatedImpact": "$2,400/year"
      }
    ],
    "projections": [
      {
        "metric": "Net Worth",
        "currentValue": 500000,
        "projectedValue": 750000,
        "timeframeYears": 5,
        "assumptions": ["7% investment return", "5% property growth"],
        "confidenceLevel": "medium"
      }
    ]
  },
  "usage": {
    "model": "gpt-4",
    "promptTokens": 2000,
    "completionTokens": 1500,
    "totalTokens": 3500,
    "estimatedCost": 0.12
  },
  "generatedAt": "ISO-8601 date"
}
```

---

### 11. POST /api/ai/enhance

Enhance a strategy recommendation with AI-powered explanations.

**Request Body:**
```json
{
  "recommendationId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "recommendationId": "uuid",
    "enhancement": {
      "summary": "Plain language explanation...",
      "detailedExplanation": "Comprehensive analysis...",
      "riskAnalysis": {
        "riskLevel": "medium",
        "factors": [...],
        "mitigations": [...]
      },
      "alternativeApproaches": [
        {
          "approach": "Conservative",
          "description": "...",
          "tradeoffs": { "pros": [...], "cons": [...] }
        }
      ],
      "actionSteps": ["Step 1", "Step 2", "Step 3"],
      "disclaimer": "This is AI-generated advice..."
    }
  }
}
```

---

## AI Configuration

The AI features require OpenAI API configuration:

### Environment Variables
```env
OPENAI_API_KEY=sk-...your-api-key
OPENAI_MODEL=gpt-4  # Optional, default: gpt-4
```

### Model Selection
- **Quick queries** use `gpt-3.5-turbo` for faster responses
- **Detailed analysis** uses `gpt-4` for comprehensive advice
- **Projections** use `gpt-3.5-turbo` with conservative prompts

### AI Response Guidelines
All AI responses include:
- Clear financial advice tailored to Australian context
- Consideration of user's risk appetite and preferences
- Disclaimers about seeking professional financial advice
- Follow-up question suggestions

---

## Changelog

### v1.1.0 (2025-11-29)
- Added AI-powered `/api/ai/ask` endpoint
- Added AI advice generation `/api/ai/advice`
- Added recommendation enhancement `/api/ai/enhance`
- Entity-specific AI context support

### v1.0.0 (2025-01-26)
- Initial release
- 8 core API endpoints
- Full CRUD operations for recommendations
- Conflict detection
- Alternative generation
- Statistics dashboard
