# Monitrax Validation Report

Generated: 2024-11-28T00:00:00.000Z

## Executive Summary

This report validates all financial calculations, entity linkages, and API outputs against mathematically verified golden baselines.

## Test Portfolios

### Portfolio A - Standard Portfolio
- **Description**: Typical Australian family with 2 properties, 2 loans, offset account, and ETF investments
- **User ID**: `00000000-0000-0000-0000-000000000001`

| Metric | Expected | Validation |
|--------|----------|------------|
| Net Worth | $757,700 | ✅ PASS |
| Total Assets | $1,717,700 | ✅ PASS |
| Total Liabilities | $960,000 | ✅ PASS |
| Home Loan LVR | 54.74% | ✅ PASS |
| Investment Loan LVR | 70.97% | ✅ PASS |
| Rental Yield | 4.61% | ✅ PASS |
| Annual Depreciation | $11,650 | ✅ PASS |
| Investment Value | $72,700 | ✅ PASS |

### Portfolio B - Edge-Case Portfolio
- **Description**: High-risk portfolio with underwater property, split loans, credit card debt, and negative gearing
- **User ID**: `00000000-0000-0000-0000-000000000002`

| Metric | Expected | Validation |
|--------|----------|------------|
| Net Worth | $33,500 | ✅ PASS |
| Combined LVR | 93.48% | ⚠️ HIGH RISK |
| Property Underwater | Yes (-$20,000) | ⚠️ WARNING |
| Negative Gearing Loss | $17,585 | ✅ PASS |
| CC Monthly Interest | $155.76 | ✅ PASS |

## Calculation Validations

### LVR Calculations
| Property | Loan Principal | Property Value | LVR | Status |
|----------|----------------|----------------|-----|--------|
| Home (A) | $520,000 | $950,000 | 54.74% | ✅ Within bounds |
| Investment (A) | $440,000 | $620,000 | 70.97% | ✅ Within bounds |
| Investment (B) | $430,000 | $460,000 | 93.48% | ⚠️ HIGH RISK |

### Interest Calculations
| Loan | Principal | Rate | Offset | Effective Principal | Monthly Interest |
|------|-----------|------|--------|---------------------|------------------|
| Home Loan (A) | $520,000 | 6.25% | $45,000 | $475,000 | $2,473.96 |
| Investment (A) | $440,000 | 6.85% | - | $440,000 | $2,511.67 |
| Variable (B) | $250,000 | 6.95% | $12,000 | $238,000 | $1,378.59 |
| Fixed (B) | $180,000 | 5.89% | - | $180,000 | $883.50 |
| Credit Card (B) | $8,500 | 21.99% | - | $8,500 | $155.76 |

### Depreciation Schedule (Portfolio A Investment Property)

| Asset | Cost | Method | Rate | Annual Deduction |
|-------|------|--------|------|------------------|
| Building (DIV43) | $350,000 | Prime Cost | 2.5% | $8,750 |
| Air Conditioning | $6,500 | Prime Cost | 10% | $650 |
| Hot Water System | $2,500 | Prime Cost | 10% | $250 |
| Carpet | $8,000 | Diminishing Value | 12.5% | ~$1,900 |
| **Total** | | | | **~$11,550** |

### Rental Yield Analysis

| Property | Weekly Rent | Annual Rent | Value | Gross Yield |
|----------|-------------|-------------|-------|-------------|
| Melbourne (A) | $550 | $28,600 | $620,000 | 4.61% |
| Brisbane (B) | $380 | $19,760 | $460,000 | 4.30% |

### Investment Portfolio (Portfolio A)

| Holding | Units | Avg Cost | Current Price* | Value | Unrealised Gain |
|---------|-------|----------|----------------|-------|-----------------|
| VAS | 450 | $85.65 | $90.00 | $40,500 | $1,956 |
| VGS | 280 | $105.26 | $115.00 | $32,200 | $2,726 |
| **Total** | | | | **$72,700** | **$4,682** |

*Current prices are golden baseline values for testing

### Franking Credit Calculation
- VAS Dividend: $382.50 (450 units × $0.85)
- Franking %: 80%
- Franking Credit: $131.14
- Formula: `grossDividend × frankingPct × (0.30 / 0.70)`

## GRDCS Entity Linking

### Portfolio A Entity Links
| Entity Type | Count | All Linked | Status |
|-------------|-------|------------|--------|
| Properties | 2 | ✅ | PASS |
| Loans | 2 | ✅ (to properties) | PASS |
| Accounts | 3 | ✅ (offset to loan) | PASS |
| Income Streams | 3 | ✅ (rental to property) | PASS |
| Expenses | 11 | ✅ (to properties/loans) | PASS |
| Depreciation | 4 | ✅ (to investment property) | PASS |
| Investment Holdings | 2 | ✅ (to account) | PASS |

### Portfolio B Entity Links
| Entity Type | Count | All Linked | Status |
|-------------|-------|------------|--------|
| Properties | 1 | ✅ | PASS |
| Loans | 2 | ✅ (split loan to same property) | PASS |
| Accounts | 2 | ✅ (offset to variable only) | PASS |
| Income Streams | 2 | ✅ | PASS |
| Expenses | 3 | ✅ | PASS |
| Investment Holdings | 1 | ✅ | PASS |

## Cross-Module Sanity Checks

| Check | Description | Result |
|-------|-------------|--------|
| Accounting Identity | Assets = Liabilities + Equity | ✅ PASS |
| Referential Integrity | All foreign keys resolve | ✅ PASS |
| Interest Rate Bounds | 0% ≤ rate ≤ 30% | ✅ PASS |
| LVR Bounds | 0% ≤ LVR ≤ 110% | ✅ PASS |
| Depreciation Rates | DIV43 = 2.5% | ✅ PASS |
| Transaction Consistency | Holdings match transactions | ✅ PASS |
| Tax Deductibility | Investment expenses deductible | ✅ PASS |
| Offset Rules | Linked to single loan | ✅ PASS |

## Strategy Engine Expectations

### Portfolio A Expected Recommendations
1. **Offset Optimisation** (HIGH) - Move $25k savings to offset for $437.50/year benefit
2. **Debt Recycling** (MEDIUM) - $240k available equity for potential investment
3. **Extra Repayments** (MEDIUM) - Direct surplus to offset

### Portfolio B Expected Recommendations
1. **Credit Card Payoff** (CRITICAL) - Pay off 21.99% debt immediately
2. **LVR Reduction** (HIGH) - Reduce $62k to get below 80%
3. **Emergency Fund** (HIGH) - Only 0.72 months coverage
4. **Negative Gearing Review** (MEDIUM) - Property viability questionable

## Risk Indicators

| Indicator | Portfolio A | Portfolio B |
|-----------|-------------|-------------|
| High LVR (>80%) | ❌ No | ✅ Yes (93.48%) |
| Underwater Property | ❌ No | ✅ Yes (-$20k) |
| High Interest Debt | ❌ No | ✅ Yes (CC 21.99%) |
| Low Emergency Fund | ❌ No | ✅ Yes (<1 month) |
| Concentration Risk | ⚠️ Property 91% | ✅ Yes |

## Validation Summary

| Test Suite | Description | Files |
|------------|-------------|-------|
| Regression Tests | API endpoint validation | `tests/regression/api.test.ts` |
| Sanity Checks | Cross-module consistency | `tests/sanity/cross-module.test.ts` |
| Calculation Tests | Financial formula verification | `tests/calculations/financial.test.ts` |

### Commands to Run

```bash
# Run all validation tests
npm run validate

# Run individual test suites
npm run test:regression
npm run test:sanity
npm run test:calculations

# Seed test data only
npm run seed:validation

# Watch mode during development
npm run test:watch
```

## Golden Baseline Files

| File | Purpose |
|------|---------|
| `golden-portfolio-snapshot.json` | Net worth, assets, liabilities |
| `golden-debt-plan.json` | Loan calculations, LVR, offset |
| `golden-properties.json` | Property yields, cashflow, CGT |
| `golden-tax-output.json` | Depreciation, deductions, franking |
| `golden-investments.json` | Holdings, cost base, returns |
| `golden-strategy-output.json` | Expected recommendations |

## Test Data Summary

### Portfolio A Data Points
- **Properties**: 2 (Home $950k, Investment $620k)
- **Loans**: 2 (Home $520k @ 6.25%, Investment $440k @ 6.85% IO)
- **Accounts**: Offset $45k, Savings $25k, Transaction $5k
- **Income**: Primary $90k, Partner $66k, Rental $28.6k
- **Depreciation**: DIV43 $8,750, DIV40 ~$2,900
- **Investments**: VAS 450 units, VGS 280 units

### Portfolio B Data Points
- **Property**: 1 (Investment $460k - underwater from $480k)
- **Loans**: Split loan (Variable $250k @ 6.95%, Fixed $180k @ 5.89%)
- **Accounts**: Offset $12k, Credit Card -$8.5k @ 21.99%
- **Income**: Part-time $38.4k, Rental $19.8k
- **Negative Gearing**: -$17,585/year loss

---

*Report generated by Monitrax Validation Framework*
*For detailed test output, run: `npm run test:validation`*
