# Strategy Analyzer Business Rules

**Version:** 1.0.0
**Last Updated:** 2025-01-26

---

## Overview

This document details the deterministic business rules used by each analyzer in the Strategy Engine. All recommendations are generated using pure algorithmic logic - **no LLM/AI models are used**.

---

## 1. Debt Analyzer

**File:** `lib/strategy/analyzers/debtAnalyzer.ts`

### 1.1 Refinance Opportunity Detection

**Rule:** Recommend refinance if current rate is significantly above market average

**Logic:**
```typescript
if (currentRate - marketRate) >= 0.005 AND         // 0.5% minimum gap
   estimatedMonthlySavings > 200 AND              // $200/month minimum
   breakEvenMonths <= 24                          // 24 months max break-even
then RECOMMEND refinance
```

**Calculation:**
- Monthly Savings = (Principal × RateDifference) / 12
- Break-even = (RefinanceCosts) / (MonthlySavings)
- Total Savings = MonthlySavings × RemainingTermMonths

**SBS Components:**
- Financial Benefit: (TotalSavings / Principal) × 100
- Risk Reduction: 20 (reduces rate risk)
- Cost Avoidance: (RefinanceCosts / AvoidedInterest) × 100

### 1.2 Debt-to-Income Warning

**Rule:** Flag if DTI ratio exceeds safe thresholds

**Logic:**
```typescript
monthlyDebtPayments = sum(all loan repayments)
dtiRatio = monthlyDebtPayments / monthlyIncome

if dtiRatio > 0.43 then CRITICAL warning
if dtiRatio > 0.36 then HIGH warning
if dtiRatio > 0.28 then MEDIUM warning
```

**Recommendation:** Reduce debt or increase income to improve DTI

### 1.3 Offset Account Optimization

**Rule:** Recommend moving surplus cash to offset account

**Logic:**
```typescript
if hasOffsetAccount AND
   availableCash > emergencyFund × 1.5 AND
   offsetBalance < loanPrincipal × 0.1
then RECOMMEND increase offset balance
```

**Calculation:**
- Interest Saved = (AdditionalOffsetAmount × InterestRate) / 12
- Annual Benefit = Interest Saved × 12

---

## 2. Cashflow Analyzer

**File:** `lib/strategy/analyzers/cashflowAnalyzer.ts`

### 2.1 Emergency Fund Adequacy

**Rule:** Ensure emergency fund covers 3-6 months of expenses

**Logic:**
```typescript
emergencyFundTarget = monthlyExpenses × 6
currentLiquidCash = sum(savings, checking accounts)

if currentLiquidCash < emergencyFundTarget × 0.5 then CRITICAL
if currentLiquidCash < emergencyFundTarget then HIGH
```

**Recommendation:**
- CRITICAL: Build to 3 months minimum immediately
- HIGH: Build to 6 months over next 12 months

### 2.2 Surplus Allocation Strategy

**Rule:** Optimize allocation of monthly surplus

**Logic:**
```typescript
monthlySurplus = monthlyIncome - monthlyExpenses

Priority 1: Emergency fund to target
Priority 2: High-interest debt (>7%)
Priority 3: Investment contributions
Priority 4: Extra loan repayments
```

**Allocation Formula:**
- If emergency fund < target: 100% to emergency fund
- Else if highInterestDebt exists: 70% debt / 30% invest
- Else: 50% invest / 50% extra repayments

### 2.3 Spending Risk Detection

**Rule:** Flag if surplus is declining or negative

**Logic:**
```typescript
if monthlySurplus < 0 then CRITICAL (spending exceeds income)
if surplusTrend === declining for 3+ months then HIGH warning
if savingsRate < 0.10 (10%) then MEDIUM warning
```

---

## 3. Investment Analyzer

**File:** `lib/strategy/analyzers/investmentAnalyzer.ts`

### 3.1 Asset Allocation Drift

**Rule:** Detect when portfolio allocation deviates from target

**Logic:**
```typescript
targetAllocation = getUserPreferredAllocation() // e.g., 60/40 stocks/bonds
currentAllocation = calculateCurrentAllocation()

drift = abs(targetAllocation - currentAllocation)

if drift > 0.10 (10%) then HIGH - rebalance recommended
if drift > 0.15 (15%) then CRITICAL - rebalance urgent
```

**Rebalancing Suggestion:**
- Sell overweight assets
- Buy underweight assets
- Calculate trade amounts to restore target

### 3.2 Concentration Risk

**Rule:** Flag if single investment exceeds 20% of portfolio

**Logic:**
```typescript
for each holding in portfolio:
  percentage = (holdingValue / totalPortfolioValue)

  if percentage > 0.20 then HIGH warning
  if percentage > 0.30 then CRITICAL warning
```

**Recommendation:** Diversify by selling portion and reinvesting

### 3.3 Underperformance Detection

**Rule:** Identify consistently underperforming investments

**Logic:**
```typescript
if investment.return < marketBenchmark for 12+ months AND
   investment.return < 0 (negative) AND
   investment.type !== tax-advantaged
then RECOMMEND review and consider selling
```

---

## 4. Property Analyzer

**File:** `lib/strategy/analyzers/propertyAnalyzer.ts`

### 4.1 Hold vs Sell Analysis

**Rule:** Analyze whether to hold or sell investment property

**Logic:**
```typescript
rentalYield = (annualRent / propertyValue) × 100
capitalGrowthRate = calculateHistoricalGrowth()
totalReturn = rentalYield + capitalGrowthRate

if totalReturn < 4% AND isNegativeGeared then CONSIDER selling
if rentalYield < 2% AND capitalGrowth < 3% then CONSIDER selling
if property is capital city AND held > 7 years then REVIEW
```

**Factors Considered:**
- Rental yield
- Capital growth
- Negative gearing benefit
- Market conditions
- Holding period
- Tax implications

### 4.2 Refinance for Investment Property

**Rule:** Similar to debt analyzer but considers investment-specific factors

**Additional Logic:**
```typescript
if isInvestmentProperty AND
   currentRate > marketRate + 0.005 AND
   negativeGearingBenefit > refinanceCosts
then RECOMMEND refinance
```

### 4.3 Property Concentration Risk

**Rule:** Flag if property equity exceeds 60% of net worth

**Logic:**
```typescript
propertyEquity = totalPropertyValue - totalPropertyDebt
netWorthAllocation = propertyEquity / netWorth

if netWorthAllocation > 0.60 then HIGH - consider diversifying
if netWorthAllocation > 0.75 then CRITICAL - high concentration risk
```

---

## 5. Risk Analyzer

**File:** `lib/strategy/analyzers/riskAnalyzer.ts`

### 5.1 Portfolio Risk Score

**Rule:** Calculate overall portfolio risk (1-10 scale)

**Logic:**
```typescript
riskScore = 5 (baseline)

// Increase for concentration
if singleAssetRisk then riskScore += 1
if propertyConcentration > 80% then riskScore += 1

// Increase for liquidity
if liquidityMonths < 3 then riskScore += 2
if liquidityMonths < 6 then riskScore += 1

// Increase for debt stress
if !canSurvive2PercentRateRise then riskScore += 2
if !canSurvive3PercentRateRise then riskScore += 1

riskScore = min(10, max(1, riskScore))
```

**Risk Levels:**
- 1-3: LOW
- 4-5: MODERATE
- 6-7: HIGH
- 8-10: VERY HIGH

### 5.2 Stress Testing

**Rule:** Model impact of interest rate increases

**Logic:**
```typescript
scenarios = [+2%, +3%, +4%]

for each scenario:
  newMonthlyRepayment = calculateRepayment(currentRate + scenario)
  surplusAfterIncrease = monthlyIncome - monthlyExpenses - newMonthlyRepayment

  if surplusAfterIncrease < 0 then FAIL scenario
```

**Recommendation:**
- If fails +2%: CRITICAL - reduce debt immediately
- If fails +3%: HIGH - build buffer or reduce debt
- If fails +4%: MEDIUM - monitor and prepare

---

## 6. Liquidity Analyzer

**File:** `lib/strategy/analyzers/liquidityAnalyzer.ts`

### 6.1 Liquidity Coverage

**Rule:** Ensure adequate liquid assets for emergencies

**Logic:**
```typescript
liquidAssets = cash + savings + liquidInvestments
monthlyExpenses = averageMonthlyExpenses
monthsCovered = liquidAssets / monthlyExpenses

if monthsCovered < 3 then CRITICAL
if monthsCovered < 6 then HIGH
if monthsCovered < 12 then MEDIUM
```

### 6.2 Liquidity-to-Debt Ratio

**Rule:** Maintain healthy ratio of liquid assets to debt

**Logic:**
```typescript
liquidityRatio = liquidAssets / totalDebt

if liquidityRatio < 0.05 (5%) then CRITICAL
if liquidityRatio < 0.10 (10%) then HIGH
if liquidityRatio < 0.15 (15%) then MEDIUM
```

**Recommended Target:** 10-15% minimum

---

## 7. Tax Analyzer

**File:** `lib/strategy/analyzers/taxAnalyzer.ts`

### 7.1 Negative Gearing Optimization

**Rule:** Maximize negative gearing benefits

**Logic:**
```typescript
investmentIncome = sum(rental income for investment properties)
investmentExpenses = sum(expenses + interest for investment properties)
negativeGearingAmount = max(0, investmentExpenses - investmentIncome)
marginalTaxRate = getUserMarginalTaxRate()
taxBenefit = negativeGearingAmount × marginalTaxRate
```

**Recommendation:** Ensure all deductible expenses are claimed

### 7.2 Capital Gains Tax Planning

**Rule:** Optimize timing of asset sales for CGT

**Logic:**
```typescript
if asset.holdingPeriod < 12 months AND
   unrealizedGain > 0 AND
   canDefer sale by 3+ months
then RECOMMEND defer to qualify for 50% CGT discount
```

### 7.3 Superannuation Contribution Optimization

**Rule:** Maximize concessional contribution benefits

**Logic:**
```typescript
currentContributions = employerContributions + salary sacrifice
concessionalCap = 27500 // Annual cap
availableCapSpace = concessionalCap - currentContributions
marginalTaxRate = getUserMarginalTaxRate()

if marginalTaxRate > 0.32 AND availableCapSpace > 5000 then
  RECOMMEND increase salary sacrifice up to cap
```

---

## 8. Time Horizon Analyzer

**File:** `lib/strategy/analyzers/timeHorizonAnalyzer.ts`

### 8.1 Retirement Runway Calculation

**Rule:** Calculate years until retirement and required savings

**Logic:**
```typescript
yearsToRetirement = retirementAge - currentAge
currentNetWorth = totalAssets - totalLiabilities
retirementTarget = annualExpenses × 25 // 4% withdrawal rule
shortfall = retirementTarget - currentNetWorth
requiredAnnualSaving = shortfall / yearsToRetirement

if requiredAnnualSaving > annualIncome × 0.50 then CRITICAL - unlikely to meet goal
if requiredAnnualSaving > currentAnnualSaving × 2 then HIGH - need significant increase
```

### 8.2 Goal-Based Planning

**Rule:** Align recommendations with time horizon

**Logic:**
```typescript
if timeHorizon < 5 years then
  RECOMMEND low-risk, high-liquidity strategies
  AVOID volatile investments
  PRIORITIZE capital preservation

if timeHorizon 5-15 years then
  RECOMMEND balanced approach
  ALLOW moderate risk
  FOCUS ON growth + stability

if timeHorizon > 15 years then
  RECOMMEND growth-focused strategies
  ACCEPT higher volatility
  MAXIMIZE compound growth
```

---

## Safeguards

All analyzers respect these financial safety limits:

```typescript
const SAFEGUARDS = {
  maxDebtToIncome: 0.43,        // Never recommend if DTI > 43%
  minEmergencyFund: 3,          // Require 3 months expenses minimum
  maxSingleInvestment: 0.20,    // No investment > 20% of portfolio
  minLiquidityRatio: 0.10,      // Keep 10% in liquid assets
  minRefinanceGap: 0.005,       // 0.5% minimum rate difference
  maxRefinanceBreakeven: 24,    // 24 months maximum break-even
};
```

**Override Policy:** Safeguards cannot be bypassed. If a recommendation violates a safeguard, it will not be generated.

---

## Confidence Scoring

Each recommendation includes a confidence level:

**HIGH Confidence:**
- Data completeness > 80%
- Recent data < 30 days
- All required inputs available
- Clear business rule match

**MEDIUM Confidence:**
- Data completeness 60-80%
- Data < 90 days old
- Some inputs estimated
- Business rule match with assumptions

**LOW Confidence:**
- Data completeness < 60%
- Data > 90 days old
- Missing key inputs
- Recommendation requires validation

Only HIGH confidence recommendations are shown by default.

---

## Calculation Transparency

All recommendations include:

1. **Reasoning Trace**: Step-by-step explanation of logic applied
2. **Calculations**: All intermediate values shown
3. **Evidence Graph**: Data sources and historical context
4. **Assumptions**: Any assumptions clearly stated
5. **Alternatives**: Conservative/aggressive variations

This ensures full explainability and user trust.

---

## Changelog

### v1.0.0 (2025-01-26)
- Initial documentation of all 8 analyzers
- Business rules for debt, cashflow, investment, property, risk, liquidity, tax, and time horizon
- Safeguard definitions
- Confidence scoring rules
