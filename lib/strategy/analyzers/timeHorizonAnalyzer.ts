/**
 * TIME HORIZON ANALYZER
 * Phase 11 - Stage 3B.6
 *
 * Analyzes retirement and long-term goals:
 * - Retirement runway analysis
 * - Goal achievement probability
 * - Savings rate recommendations
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';

export async function analyzeTimeHorizon(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    const retirementFindings = analyzeRetirementRunway(data);
    findings.push(...retirementFindings);

  } catch (error) {
    errors.push(`Time horizon analysis error: ${error}`);
  }

  return {
    analyzer: 'TimeHorizonAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

function analyzeRetirementRunway(data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  const retirementAge = data.preferences?.retirementAge;
  const currentAge = data.snapshot?.cashflowSummary?.userAge || 30; // Default if not available
  const netWorth = data.snapshot?.netWorth || 0;

  if (!retirementAge) {
    return findings; // Can't analyze without target
  }

  const yearsToRetirement = retirementAge - currentAge;

  if (yearsToRetirement <= 0) {
    return findings; // Already at or past retirement
  }

  // Estimate required retirement net worth (simplified)
  // Rule of thumb: 25x annual expenses for 4% withdrawal rate
  const monthlyExpenses = data.snapshot?.cashflowSummary?.monthlyExpenses || 5000;
  const annualExpenses = monthlyExpenses * 12;
  const requiredNetWorth = annualExpenses * 25;

  // Calculate if on track
  const monthlySurplus = data.snapshot?.cashflowSummary?.monthlySurplus || 0;
  const annualSavings = monthlySurplus * 12;

  // Simple projection: current NW + (annual savings * years) * (1 + 7% growth)
  const growthRate = 0.07;
  let projectedNetWorth = netWorth;

  for (let year = 0; year < yearsToRetirement; year++) {
    projectedNetWorth = (projectedNetWorth + annualSavings) * (1 + growthRate);
  }

  const shortfall = requiredNetWorth - projectedNetWorth;
  const achievementProbability = Math.min(100, (projectedNetWorth / requiredNetWorth) * 100);

  if (shortfall > 0) {
    const requiredMonthlySavings = calculateRequiredMonthlySavings(
      netWorth,
      requiredNetWorth,
      yearsToRetirement,
      growthRate
    );

    const severity: 'critical' | 'high' | 'medium' =
      achievementProbability < 50 ? 'critical' :
      achievementProbability < 75 ? 'high' : 'medium';

    findings.push({
      id: `retirement-shortfall-${Date.now()}`,
      type: 'RETIREMENT_SHORTFALL',
      severity,
      title: 'Retirement Savings Shortfall',
      description: `Based on current trajectory, you're projected to be ${(100 - achievementProbability).toFixed(0)}% short of retirement target. Need to save $${requiredMonthlySavings.toFixed(0)}/month to stay on track.`,
      impactScore: {
        financial: 85,
        risk: 80,
        liquidity: 40,
        tax: 15,
        confidence: 70,
      },
      evidence: {
        currentAge,
        retirementAge,
        yearsToRetirement,
        currentNetWorth: netWorth,
        requiredNetWorth,
        projectedNetWorth,
        shortfall,
        achievementProbability,
        currentMonthlySavings: monthlySurplus,
        requiredMonthlySavings,
      },
      suggestedAction: `Increase monthly savings from $${monthlySurplus.toFixed(0)} to $${requiredMonthlySavings.toFixed(0)} to meet retirement goal at age ${retirementAge}.`,
    });
  } else {
    // On track or ahead
    findings.push({
      id: `retirement-ontrack-${Date.now()}`,
      type: 'RETIREMENT_ON_TRACK',
      severity: 'low',
      title: 'Retirement Goal On Track',
      description: `You're on track to meet your retirement goal at age ${retirementAge}. Projected net worth: $${projectedNetWorth.toFixed(0)} (target: $${requiredNetWorth.toFixed(0)}).`,
      impactScore: {
        financial: 60,
        risk: 30,
        liquidity: 20,
        tax: 5,
        confidence: 70,
      },
      evidence: {
        currentAge,
        retirementAge,
        yearsToRetirement,
        currentNetWorth: netWorth,
        requiredNetWorth,
        projectedNetWorth,
        surplus: projectedNetWorth - requiredNetWorth,
        achievementProbability,
      },
      suggestedAction: 'Maintain current savings rate. Consider reviewing assumptions annually.',
    });
  }

  return findings;
}

function calculateRequiredMonthlySavings(
  currentNW: number,
  targetNW: number,
  years: number,
  growthRate: number
): number {
  // Calculate using future value of annuity formula
  // FV = PV(1+r)^n + PMT * [((1+r)^n - 1) / r]
  // Solve for PMT

  const n = years;
  const r = growthRate;

  const futureValueOfCurrent = currentNW * Math.pow(1 + r, n);
  const remainingNeeded = targetNW - futureValueOfCurrent;

  if (remainingNeeded <= 0) {
    return 0;
  }

  const annuityFactor = (Math.pow(1 + r, n) - 1) / r;
  const annualPayment = remainingNeeded / annuityFactor;

  return annualPayment / 12;
}
