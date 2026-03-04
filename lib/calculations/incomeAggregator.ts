/**
 * Income Aggregator
 *
 * Single source of truth for income aggregation.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Handles both gross and net income calculations,
 * integrating with tax engine for salary adjustments.
 */

import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

// =============================================================================
// TYPES
// =============================================================================

export interface IncomeInput {
  amount: number;
  frequency: string;
  type?: string;
  salaryType?: string | null;
  netAmount?: number | null;
  grossAmount?: number | null;
  paygWithholding?: number | null;
  isTaxable?: boolean;
  propertyId?: string | null;
  investmentAccountId?: string | null;
}

export interface IncomeAggregation {
  grossTotal: number;
  netTotal: number;
  paygWithholding: number;
  byType: Record<string, { gross: number; net: number }>;
  taxableIncome: number;
  nonTaxableIncome: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get gross income amount for an income item
 */
function getGrossAmount(item: IncomeInput, targetFrequency: 'monthly' | 'annual'): number {
  const converter = targetFrequency === 'monthly' ? toMonthly : toAnnual;

  // For SALARY type with stored grossAmount (from NET input)
  if (item.type === 'SALARY' && item.salaryType === 'NET' && item.grossAmount != null) {
    return targetFrequency === 'monthly' ? item.grossAmount / 12 : item.grossAmount;
  }

  // For SALARY type entered as GROSS, amount is gross
  if (item.type === 'SALARY' && item.salaryType === 'GROSS') {
    return converter(item.amount, item.frequency as Frequency);
  }

  // For non-salary income, amount is gross
  return converter(item.amount, item.frequency as Frequency);
}

/**
 * Get net income amount for an income item
 */
function getNetAmount(item: IncomeInput, targetFrequency: 'monthly' | 'annual'): number {
  const converter = targetFrequency === 'monthly' ? toMonthly : toAnnual;

  // For SALARY type with stored netAmount
  if (item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount != null) {
    return targetFrequency === 'monthly' ? item.netAmount / 12 : item.netAmount;
  }

  // For SALARY type entered as NET, amount is net
  if (item.type === 'SALARY' && item.salaryType === 'NET') {
    return converter(item.amount, item.frequency as Frequency);
  }

  // For non-salary income, we don't deduct tax (calculated at year end)
  return converter(item.amount, item.frequency as Frequency);
}

/**
 * Get PAYG withholding for an income item
 */
function getPaygAmount(item: IncomeInput, targetFrequency: 'monthly' | 'annual'): number {
  if (item.type !== 'SALARY' || item.paygWithholding == null) {
    return 0;
  }

  return targetFrequency === 'monthly'
    ? item.paygWithholding / 12
    : item.paygWithholding;
}

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * Aggregate income to a target frequency (monthly or annual)
 */
export function aggregateIncome(
  income: IncomeInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly'
): IncomeAggregation {
  let grossTotal = 0;
  let netTotal = 0;
  let paygWithholding = 0;
  let taxableIncome = 0;
  let nonTaxableIncome = 0;

  const byType: Record<string, { gross: number; net: number }> = {};

  for (const item of income) {
    const gross = getGrossAmount(item, targetFrequency);
    const net = getNetAmount(item, targetFrequency);
    const payg = getPaygAmount(item, targetFrequency);

    grossTotal += gross;
    netTotal += net;
    paygWithholding += payg;

    if (item.isTaxable !== false) {
      taxableIncome += gross;
    } else {
      nonTaxableIncome += gross;
    }

    const type = item.type || 'Other';
    if (!byType[type]) {
      byType[type] = { gross: 0, net: 0 };
    }
    byType[type].gross += gross;
    byType[type].net += net;
  }

  return {
    grossTotal,
    netTotal,
    paygWithholding,
    byType,
    taxableIncome,
    nonTaxableIncome,
  };
}

/**
 * Filter and aggregate income by source (property, investment)
 */
export function aggregateIncomeBySource(
  income: IncomeInput[],
  sourceType: 'property' | 'investment',
  sourceId: string,
  targetFrequency: 'monthly' | 'annual' = 'monthly'
): IncomeAggregation {
  const filtered = income.filter((i) => {
    switch (sourceType) {
      case 'property':
        return i.propertyId === sourceId;
      case 'investment':
        return i.investmentAccountId === sourceId;
      default:
        return false;
    }
  });

  return aggregateIncome(filtered, targetFrequency);
}
