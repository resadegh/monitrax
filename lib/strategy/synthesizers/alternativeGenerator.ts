/**
 * ALTERNATIVE GENERATOR
 * Phase 11 - Stage 4.3
 *
 * Generates alternative approaches for each recommendation:
 * - Conservative alternative (lower risk, lower return)
 * - Moderate alternative (balanced)
 * - Aggressive alternative (higher risk, higher return)
 */

// =============================================================================
// TYPES
// =============================================================================

interface Recommendation {
  id: string;
  category: string;
  type: string;
  title: string;
  summary: string;
  detail: string;
  sbsScore: number;
  financialImpact: any;
  riskImpact: any;
}

export interface Alternative {
  profile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  title: string;
  description: string;
  financialImpact: any;
  riskLevel: number;
  pros: string[];
  cons: string[];
}

// =============================================================================
// MAIN ALTERNATIVE GENERATION
// =============================================================================

/**
 * Generate 2-3 alternatives for a recommendation
 */
export function generateAlternatives(
  recommendation: Recommendation
): Alternative[] {
  const alternatives: Alternative[] = [];

  // Generate based on category
  switch (recommendation.category) {
    case 'DEBT':
      alternatives.push(...generateDebtAlternatives(recommendation));
      break;

    case 'CASHFLOW':
      alternatives.push(...generateCashflowAlternatives(recommendation));
      break;

    case 'INVESTMENT':
      alternatives.push(...generateInvestmentAlternatives(recommendation));
      break;

    case 'PROPERTY':
      alternatives.push(...generatePropertyAlternatives(recommendation));
      break;

    case 'RISK_RESILIENCE':
      alternatives.push(...generateRiskAlternatives(recommendation));
      break;

    case 'GROWTH':
      alternatives.push(...generateGrowthAlternatives(recommendation));
      break;

    default:
      // Generic alternatives
      alternatives.push(...generateGenericAlternatives(recommendation));
  }

  return alternatives;
}

// =============================================================================
// DEBT ALTERNATIVES
// =============================================================================

function generateDebtAlternatives(rec: Recommendation): Alternative[] {
  const alternatives: Alternative[] = [];

  if (rec.type === 'DEBT_REFINANCE') {
    // Conservative: Just switch to better rate
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Refinance to Fixed Rate',
      description:
        'Switch to a fixed-rate loan for stability. Lower risk but potentially less flexible.',
      financialImpact: {
        monthlySavings: (rec.financialImpact.monthlySavings || 0) * 0.8,
        totalSavings: (rec.financialImpact.totalSavings || 0) * 0.8,
      },
      riskLevel: 20,
      pros: ['Predictable payments', 'Protected from rate rises', 'Peace of mind'],
      cons: ['Less flexibility', 'May cost more if rates fall', 'Break fees if selling'],
    });

    // Aggressive: Variable rate + offset
    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Variable Rate with Offset Account',
      description:
        'Maximum flexibility and potential savings with offset account optimization.',
      financialImpact: {
        monthlySavings: (rec.financialImpact.monthlySavings || 0) * 1.2,
        totalSavings: (rec.financialImpact.totalSavings || 0) * 1.2,
      },
      riskLevel: 60,
      pros: ['Maximum flexibility', 'Offset reduces interest', 'No break fees'],
      cons: ['Rate rise risk', 'Requires discipline', 'Variable payments'],
    });
  } else if (rec.type === 'DEBT_CONSOLIDATE') {
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Pay Highest Rate First',
      description: 'Focus extra payments on highest-interest loan without consolidating.',
      financialImpact: {
        monthlySavings: (rec.financialImpact.monthlySavings || 0) * 0.7,
      },
      riskLevel: 15,
      pros: ['No consolidation costs', 'Simpler', 'Flexibility'],
      cons: ['Slower progress', 'Multiple payments to manage'],
    });

    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Consolidate + Extra Repayments',
      description: 'Consolidate AND make extra repayments to accelerate debt freedom.',
      financialImpact: {
        monthlySavings: (rec.financialImpact.monthlySavings || 0) * 1.3,
      },
      riskLevel: 55,
      pros: ['Fastest debt reduction', 'Single payment', 'Lower total interest'],
      cons: ['Requires higher cashflow', 'Less liquidity', 'Commitment needed'],
    });
  }

  return alternatives;
}

// =============================================================================
// CASHFLOW ALTERNATIVES
// =============================================================================

function generateCashflowAlternatives(rec: Recommendation): Alternative[] {
  const alternatives: Alternative[] = [];

  if (rec.type === 'CASHFLOW_EMERGENCY_LOW') {
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Build to 6 Months Slowly',
      description: 'Allocate 10% of surplus to emergency fund over time.',
      financialImpact: {
        monthlyAllocation: rec.financialImpact.monthlySavings * 0.1,
        timeToComplete: 60,
      },
      riskLevel: 25,
      pros: ['Gradual approach', 'Maintains flexibility', 'Low stress'],
      cons: ['Slower progress', 'Extended risk period'],
    });

    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Build to 3 Months Quickly',
      description: 'Allocate 50% of surplus until 3 months reached, then invest remainder.',
      financialImpact: {
        monthlyAllocation: rec.financialImpact.monthlySavings * 0.5,
        timeToComplete: 12,
      },
      riskLevel: 50,
      pros: ['Fast progress', 'Earlier investment opportunity', 'Motivation'],
      cons: ['Less flexible short-term', 'Minimum buffer only'],
    });
  }

  return alternatives;
}

// =============================================================================
// INVESTMENT ALTERNATIVES
// =============================================================================

function generateInvestmentAlternatives(rec: Recommendation): Alternative[] {
  const alternatives: Alternative[] = [];

  if (rec.type === 'INVESTMENT_REBALANCE') {
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Rebalance with New Contributions Only',
      description: 'Direct new investments to underweight assets without selling.',
      financialImpact: {
        taxImpact: 0,
        rebalanceSpeed: 'slow',
      },
      riskLevel: 20,
      pros: ['No tax on sales', 'No transaction costs', 'Gradual adjustment'],
      cons: ['Slow rebalancing', 'Drift continues temporarily'],
    });

    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Full Rebalance with Tax Loss Harvesting',
      description: 'Sell overweight positions, harvest losses, and rebalance completely.',
      financialImpact: {
        taxImpact: -500,
        rebalanceSpeed: 'immediate',
      },
      riskLevel: 45,
      pros: ['Immediate rebalancing', 'Tax optimization', 'Fresh start'],
      cons: ['Transaction costs', 'Potential tax', 'Market timing risk'],
    });
  }

  return alternatives;
}

// =============================================================================
// PROPERTY ALTERNATIVES
// =============================================================================

function generatePropertyAlternatives(rec: Recommendation): Alternative[] {
  const alternatives: Alternative[] = [];

  if (rec.type === 'PROPERTY_LOW_YIELD') {
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Increase Rent Moderately',
      description: 'Raise rent to market rate gradually over 2-3 years.',
      financialImpact: {
        yearlyIncrease: 2000,
      },
      riskLevel: 30,
      pros: ['Tenant retention', 'Gradual improvement', 'Low risk'],
      cons: ['Slow yield improvement', 'Still below optimal'],
    });

    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Sell and Redeploy Capital',
      description: 'Sell property and invest in higher-yielding assets.',
      financialImpact: {
        potentialGain: 50000,
        newYield: 0.05,
      },
      riskLevel: 70,
      pros: ['Higher returns possible', 'Diversification', 'Liquidity'],
      cons: ['CGT liability', 'Transaction costs', 'Market timing risk'],
    });
  }

  return alternatives;
}

// =============================================================================
// RISK ALTERNATIVES
// =============================================================================

function generateRiskAlternatives(rec: Recommendation): Alternative[] {
  const alternatives: Alternative[] = [];

  if (rec.type === 'RISK_HIGH_LEVERAGE') {
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Gradual Debt Reduction',
      description: 'Allocate 20% of surplus to debt reduction over 5 years.',
      financialImpact: {
        leverageReduction: 0.10,
        timeframe: 60,
      },
      riskLevel: 25,
      pros: ['Steady progress', 'Maintains flexibility', 'Sustainable'],
      cons: ['Slow leverage reduction', 'Opportunity cost'],
    });

    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Sell Underperforming Asset',
      description: 'Sell lowest-performing asset to immediately reduce leverage.',
      financialImpact: {
        leverageReduction: 0.25,
        timeframe: 3,
      },
      riskLevel: 65,
      pros: ['Immediate improvement', 'Risk reduction', 'Simplification'],
      cons: ['CGT liability', 'Loss of potential upside', 'Forced sale'],
    });
  }

  return alternatives;
}

// =============================================================================
// GROWTH ALTERNATIVES
// =============================================================================

function generateGrowthAlternatives(rec: Recommendation): Alternative[] {
  const alternatives: Alternative[] = [];

  if (rec.type === 'RETIREMENT_SHORTFALL') {
    alternatives.push({
      profile: 'CONSERVATIVE',
      title: 'Delay Retirement 2-3 Years',
      description: 'Work longer to build additional savings and reduce drawdown period.',
      financialImpact: {
        additionalYears: 3,
        additionalSavings: 150000,
      },
      riskLevel: 20,
      pros: ['More time to save', 'Compound growth', 'Reduced risk'],
      cons: ['Delayed retirement', 'Health considerations'],
    });

    alternatives.push({
      profile: 'AGGRESSIVE',
      title: 'Increase Savings + Higher Risk Portfolio',
      description: 'Increase savings rate AND shift to growth-focused investments.',
      financialImpact: {
        requiredSavings: rec.financialImpact.monthlySavings * 1.5,
        expectedReturn: 0.10,
      },
      riskLevel: 75,
      pros: ['Potential to retire on time', 'Wealth maximization'],
      cons: ['High savings rate needed', 'Market risk', 'Lifestyle sacrifice'],
    });
  }

  return alternatives;
}

// =============================================================================
// GENERIC ALTERNATIVES
// =============================================================================

function generateGenericAlternatives(rec: Recommendation): Alternative[] {
  return [
    {
      profile: 'CONSERVATIVE',
      title: 'Gradual Approach',
      description: 'Implement recommendation gradually over extended timeframe.',
      financialImpact: {
        impact: (rec.financialImpact?.monthlySavings || 0) * 0.7,
        timeframe: 'extended',
      },
      riskLevel: 25,
      pros: ['Lower stress', 'More time to adjust', 'Reversible'],
      cons: ['Slower results', 'Extended exposure to current situation'],
    },
    {
      profile: 'AGGRESSIVE',
      title: 'Accelerated Approach',
      description: 'Implement recommendation immediately with maximum commitment.',
      financialImpact: {
        impact: (rec.financialImpact?.monthlySavings || 0) * 1.3,
        timeframe: 'immediate',
      },
      riskLevel: 60,
      pros: ['Fastest results', 'Maximum benefit', 'Momentum'],
      cons: ['Higher risk', 'Less flexibility', 'More stress'],
    },
  ];
}
