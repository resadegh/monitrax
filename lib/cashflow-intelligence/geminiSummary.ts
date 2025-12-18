/**
 * GEMINI SUMMARY GENERATOR
 * Phase 29 - Cashflow Intelligence Center
 *
 * Generates natural language summaries using Gemini AI.
 * Summaries are persisted and only regenerated when:
 * 1. User explicitly requests regeneration
 * 2. Significant data change is detected (via hash comparison)
 *
 * Key Principle: AI gets REAL numbers only, zero hallucination.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiSummary, CashflowIntelligence } from './types';
import crypto from 'crypto';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GEMINI_MODEL = 'gemini-1.5-flash';
const MAX_SUMMARY_LENGTH = 500;

// What constitutes a "significant change" requiring regeneration
const SIGNIFICANT_CHANGE_THRESHOLDS = {
  balanceChange: 0.15, // 15% change in total balance
  incomeChange: 0.10, // 10% change in monthly income
  expenseChange: 0.10, // 10% change in monthly expenses
  newLeakCount: 2, // 2+ new leaks detected
  healthScoreChange: 10, // 10 point change in health score
};

// =============================================================================
// TYPES
// =============================================================================

export interface SummaryInput {
  healthScore: {
    overallScore: number;
    tier: string;
  };
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  netSurplus: number;
  emergencyBuffer: number; // in months
  leakageTotal: number;
  topLeaks: { category: string; amount: number }[];
  forecastRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  breakEvenDay: number;
  hasBudget: boolean;
  budgetVariance?: number; // positive = over budget
  smartActionCount: number;
  topAction?: string;
}

// =============================================================================
// HASH GENERATION
// =============================================================================

/**
 * Generate a hash of key financial data to detect significant changes
 */
export function generateDataHash(input: SummaryInput): string {
  const keyData = {
    healthScore: Math.round(input.healthScore.overallScore / 5) * 5, // Round to nearest 5
    income: Math.round(input.monthlyIncome / 100) * 100, // Round to nearest $100
    expenses: Math.round(input.monthlyExpenses / 100) * 100,
    surplus: Math.round(input.netSurplus / 100) * 100,
    leakage: Math.round(input.leakageTotal / 50) * 50, // Round to nearest $50
    buffer: Math.round(input.emergencyBuffer * 2) / 2, // Round to nearest 0.5 months
    risk: input.forecastRisk,
    leakCount: input.topLeaks.length,
  };

  const jsonString = JSON.stringify(keyData);
  return crypto.createHash('md5').update(jsonString).digest('hex');
}

/**
 * Check if data has changed significantly (requires regeneration)
 */
export function hasSignificantChange(
  oldInput: SummaryInput,
  newInput: SummaryInput
): boolean {
  // Health score changed significantly
  if (Math.abs(newInput.healthScore.overallScore - oldInput.healthScore.overallScore)
    >= SIGNIFICANT_CHANGE_THRESHOLDS.healthScoreChange) {
    return true;
  }

  // Income changed significantly
  const incomeChange = Math.abs(newInput.monthlyIncome - oldInput.monthlyIncome) / oldInput.monthlyIncome;
  if (incomeChange >= SIGNIFICANT_CHANGE_THRESHOLDS.incomeChange) {
    return true;
  }

  // Expenses changed significantly
  const expenseChange = Math.abs(newInput.monthlyExpenses - oldInput.monthlyExpenses) / oldInput.monthlyExpenses;
  if (expenseChange >= SIGNIFICANT_CHANGE_THRESHOLDS.expenseChange) {
    return true;
  }

  // New leaks detected
  if (newInput.topLeaks.length - oldInput.topLeaks.length >= SIGNIFICANT_CHANGE_THRESHOLDS.newLeakCount) {
    return true;
  }

  // Forecast risk level changed
  if (newInput.forecastRisk !== oldInput.forecastRisk && newInput.forecastRisk === 'HIGH') {
    return true;
  }

  return false;
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

/**
 * Build the prompt for Gemini using ONLY real numbers
 */
function buildPrompt(input: SummaryInput): string {
  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

  let prompt = `You are a friendly Australian financial advisor. Write a brief, actionable summary of this person's cashflow situation. Use a warm, encouraging tone but be honest about challenges.

IMPORTANT RULES:
1. Use ONLY the numbers provided below - do not make up any figures
2. Keep the summary to 2-3 short paragraphs (max 150 words)
3. Start with the most important insight
4. End with one clear action they should take this week
5. Use Australian English and currency (AUD)

FINANCIAL DATA (all figures are monthly unless stated):
- Health Score: ${input.healthScore.overallScore}/100 (${input.healthScore.tier})
- Monthly Income: ${formatCurrency(input.monthlyIncome)}
- Monthly Expenses: ${formatCurrency(input.monthlyExpenses)}
- Loan Repayments: ${formatCurrency(input.monthlyLoanRepayments)}
- Net Surplus: ${formatCurrency(input.netSurplus)}
- Emergency Buffer: ${input.emergencyBuffer.toFixed(1)} months
- Money Leaks: ${formatCurrency(input.leakageTotal)}/month identified
- Forecast Risk: ${input.forecastRisk}
- Break-Even Day: Day ${input.breakEvenDay > 0 ? input.breakEvenDay : 'N/A'}`;

  if (input.topLeaks.length > 0) {
    prompt += `\n- Top Leak Categories: ${input.topLeaks.slice(0, 3).map(l => `${l.category} (${formatCurrency(l.amount)})`).join(', ')}`;
  }

  if (input.hasBudget && input.budgetVariance !== undefined) {
    const overUnder = input.budgetVariance > 0 ? 'over' : 'under';
    prompt += `\n- Budget Status: ${formatCurrency(Math.abs(input.budgetVariance))} ${overUnder} budget`;
  }

  if (input.smartActionCount > 0 && input.topAction) {
    prompt += `\n- Priority Action: ${input.topAction}`;
  }

  prompt += `\n\nWrite the summary now. Remember: be concise, use only the numbers above, and end with one actionable recommendation.`;

  return prompt;
}

/**
 * Extract key insights from the data for display
 */
function extractKeyInsights(input: SummaryInput): string[] {
  const insights: string[] = [];

  // Health score insight
  if (input.healthScore.overallScore >= 80) {
    insights.push('Your cashflow health is excellent - keep up the great work');
  } else if (input.healthScore.overallScore >= 60) {
    insights.push('Your cashflow is healthy with room for improvement');
  } else if (input.healthScore.overallScore >= 40) {
    insights.push('Your cashflow needs attention - some areas require work');
  } else {
    insights.push('Your cashflow needs immediate attention');
  }

  // Surplus/deficit insight
  if (input.netSurplus > 0) {
    const savingsRate = ((input.netSurplus / input.monthlyIncome) * 100).toFixed(0);
    insights.push(`You're saving ${savingsRate}% of your income each month`);
  } else {
    insights.push('You're spending more than you earn - review expenses');
  }

  // Leakage insight
  if (input.leakageTotal > 200) {
    insights.push(`$${input.leakageTotal.toLocaleString()} in potential savings identified`);
  }

  // Emergency buffer insight
  if (input.emergencyBuffer < 3) {
    insights.push('Consider building a larger emergency buffer');
  } else if (input.emergencyBuffer >= 6) {
    insights.push('Solid emergency buffer in place');
  }

  // Forecast insight
  if (input.forecastRisk === 'HIGH') {
    insights.push('Potential cashflow shortfall detected in forecast');
  }

  return insights.slice(0, 4);
}

// =============================================================================
// GEMINI API CALL
// =============================================================================

/**
 * Generate summary using Gemini AI
 */
export async function generateGeminiSummary(
  input: SummaryInput,
  userId: string
): Promise<GeminiSummary> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Generate data hash for change detection
  const dataHash = generateDataHash(input);

  // Extract key insights (used as fallback and for display)
  const keyInsights = extractKeyInsights(input);

  // If no API key, use fallback
  if (!apiKey) {
    console.warn('[GeminiSummary] No GEMINI_API_KEY found, using fallback summary');
    return {
      id: `summary-${userId}-${Date.now()}`,
      userId,
      content: generateFallbackSummary(input),
      generatedAt: new Date(),
      dataHash,
      isStale: false,
      keyInsights,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = buildPrompt(input);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Validate response length
    let content = text.trim();
    if (content.length > MAX_SUMMARY_LENGTH * 2) {
      content = content.substring(0, MAX_SUMMARY_LENGTH * 2) + '...';
    }

    return {
      id: `summary-${userId}-${Date.now()}`,
      userId,
      content,
      generatedAt: new Date(),
      dataHash,
      isStale: false,
      keyInsights,
    };
  } catch (error) {
    console.error('[GeminiSummary] AI generation failed:', error);
    // Return fallback summary on error
    return {
      id: `summary-${userId}-${Date.now()}`,
      userId,
      content: generateFallbackSummary(input),
      generatedAt: new Date(),
      dataHash,
      isStale: false,
      keyInsights,
    };
  }
}

/**
 * Generate a fallback summary without AI
 */
function generateFallbackSummary(input: SummaryInput): string {
  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

  const surplusText = input.netSurplus >= 0
    ? `a monthly surplus of ${formatCurrency(input.netSurplus)}`
    : `a monthly deficit of ${formatCurrency(Math.abs(input.netSurplus))}`;

  const tierText = {
    'EXCELLENT': 'Your cashflow is in excellent shape.',
    'GOOD': 'Your cashflow is healthy.',
    'MODERATE': 'Your cashflow could use some attention.',
    'CONCERNING': 'Your cashflow needs some work.',
    'CRITICAL': 'Your cashflow needs immediate attention.',
  }[input.healthScore.tier] || 'Your cashflow health score is ' + input.healthScore.overallScore + '/100.';

  let summary = `${tierText} With ${formatCurrency(input.monthlyIncome)} coming in and ${formatCurrency(input.monthlyExpenses + input.monthlyLoanRepayments)} going out, you have ${surplusText}.`;

  if (input.emergencyBuffer < 3) {
    summary += ` Your emergency buffer of ${input.emergencyBuffer.toFixed(1)} months is below the recommended 3-6 months.`;
  }

  if (input.leakageTotal > 100) {
    summary += ` We've identified ${formatCurrency(input.leakageTotal)} in potential monthly savings.`;
  }

  if (input.topAction) {
    summary += ` This week, focus on: ${input.topAction}.`;
  }

  return summary;
}

/**
 * Check if a stored summary is stale based on data hash
 */
export function isSummaryStale(
  storedHash: string,
  currentInput: SummaryInput,
  maxAgeHours: number = 168 // 7 days default
): boolean {
  const currentHash = generateDataHash(currentInput);

  // Hash changed = significant data change
  if (storedHash !== currentHash) {
    return true;
  }

  return false;
}
