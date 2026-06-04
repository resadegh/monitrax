/**
 * Income Aggregator
 *
 * Single source of truth for income aggregation.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Handles both gross and net income calculations,
 * integrating with tax engine for salary adjustments.
 */

import { toMonthly, toAnnual, toMonthlyDecimal, toAnnualDecimal } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';

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
  /**
   * Phase 41a — `LegalEntity` ownership FK (Phase 41e.0 audit C-3).
   * Populated by Prisma reads for any caller that wants entity-scoped
   * aggregation. Optional + nullable for backward-compat: existing
   * call sites that don't read the column see `undefined`, and the
   * `ownerEntityId` filter param on `aggregateIncome()` defaults to
   * "no filter" so omitting it preserves pre-41e behaviour exactly.
   */
  ownerEntityId?: string | null;
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
/**
 * Get gross income amount for an income item.
 *
 * **Contract** (verified by Phase 41i calc-audit fixture
 * `core.incomeAggregator`):
 * - `frequency` MUST use the UPPERCASE `Frequency` enum
 *   (`'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'`).
 *   Lowercase strings fall through `toAnnual`'s default branch and
 *   return raw amounts unchanged.
 * - For `type === 'SALARY'`, the resolution depends on `salaryType`:
 *   - `salaryType === 'GROSS'` → use `amount` × frequency conversion
 *   - `salaryType === 'NET'` + `grossAmount` set → use `grossAmount`
 *     directly (already-annual; divided by 12 for monthly target)
 * - For non-salary income, `amount` × frequency conversion.
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
 * Get PAYG withholding for an income item.
 *
 * **Contract** (verified by Phase 41i calc-audit fixture):
 * `paygWithholding` is an **already-annual figure** (asymmetric with
 * `amount` which uses `frequency`). Caller must convert PAYG to
 * annual before storing. For monthly target, divides by 12; for
 * annual target, returns as-is. Only applies when `type === 'SALARY'`
 * AND `paygWithholding != null`.
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
 * Aggregate income to a target frequency (monthly or annual).
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only items
 * whose `ownerEntityId` matches are aggregated. Default = no filter
 * for backward-compat — existing call sites that don't pass this
 * parameter see exactly the pre-41e behaviour.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.3.
 */
export function aggregateIncome(
  income: IncomeInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly',
  ownerEntityId?: string,
): IncomeAggregation {
  let grossTotal = 0;
  let netTotal = 0;
  let paygWithholding = 0;
  let taxableIncome = 0;
  let nonTaxableIncome = 0;

  const byType: Record<string, { gross: number; net: number }> = {};

  const filtered = ownerEntityId
    ? income.filter((i) => i.ownerEntityId === ownerEntityId)
    : income;

  for (const item of filtered) {
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

// =============================================================================
// Q-DEC PR 2.B — Decimal sibling path
// =============================================================================
//
// Mirrors the Float path's salary GROSS/NET handling exactly: when
// salaryType === 'NET' and grossAmount is set, gross is the
// pre-stored grossAmount (already annual). When salaryType === 'GROSS'
// and netAmount is set, net is the pre-stored netAmount (already
// annual). PAYG is asymmetric and is divided by 12 for monthly.
//
// The Float helper functions (getGrossAmount/getNetAmount/getPaygAmount)
// stay live. We don't re-export Decimal versions of them because they
// are internal — only `aggregateIncomeDecimal` is the public surface.

export interface IncomeAggregationDecimal {
  grossTotal: Decimal;
  netTotal: Decimal;
  paygWithholding: Decimal;
  byType: Record<string, { gross: Decimal; net: Decimal }>;
  taxableIncome: Decimal;
  nonTaxableIncome: Decimal;
}

function getGrossAmountDecimal(
  item: IncomeInput,
  targetFrequency: 'monthly' | 'annual',
): Decimal {
  const converter = targetFrequency === 'monthly' ? toMonthlyDecimal : toAnnualDecimal;

  if (item.type === 'SALARY' && item.salaryType === 'NET' && item.grossAmount != null) {
    const gross = toDecimal(item.grossAmount) ?? new Decimal(0);
    return targetFrequency === 'monthly' ? gross.div(12) : gross;
  }
  if (item.type === 'SALARY' && item.salaryType === 'GROSS') {
    return converter(item.amount, item.frequency as Frequency);
  }
  return converter(item.amount, item.frequency as Frequency);
}

function getNetAmountDecimal(
  item: IncomeInput,
  targetFrequency: 'monthly' | 'annual',
): Decimal {
  const converter = targetFrequency === 'monthly' ? toMonthlyDecimal : toAnnualDecimal;

  if (item.type === 'SALARY' && item.salaryType === 'GROSS' && item.netAmount != null) {
    const net = toDecimal(item.netAmount) ?? new Decimal(0);
    return targetFrequency === 'monthly' ? net.div(12) : net;
  }
  if (item.type === 'SALARY' && item.salaryType === 'NET') {
    return converter(item.amount, item.frequency as Frequency);
  }
  return converter(item.amount, item.frequency as Frequency);
}

function getPaygAmountDecimal(
  item: IncomeInput,
  targetFrequency: 'monthly' | 'annual',
): Decimal {
  if (item.type !== 'SALARY' || item.paygWithholding == null) {
    return new Decimal(0);
  }
  const payg = toDecimal(item.paygWithholding) ?? new Decimal(0);
  return targetFrequency === 'monthly' ? payg.div(12) : payg;
}

/**
 * Decimal sibling of `aggregateIncome`. Same contract — salary GROSS/NET,
 * PAYG asymmetry, taxable vs non-taxable split.
 */
export function aggregateIncomeDecimal(
  income: IncomeInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly',
  ownerEntityId?: string,
): IncomeAggregationDecimal {
  let grossTotal = new Decimal(0);
  let netTotal = new Decimal(0);
  let paygWithholding = new Decimal(0);
  let taxableIncome = new Decimal(0);
  let nonTaxableIncome = new Decimal(0);
  const byType: Record<string, { gross: Decimal; net: Decimal }> = {};

  const filtered = ownerEntityId
    ? income.filter((i) => i.ownerEntityId === ownerEntityId)
    : income;

  for (const item of filtered) {
    const gross = getGrossAmountDecimal(item, targetFrequency);
    const net = getNetAmountDecimal(item, targetFrequency);
    const payg = getPaygAmountDecimal(item, targetFrequency);

    grossTotal = grossTotal.plus(gross);
    netTotal = netTotal.plus(net);
    paygWithholding = paygWithholding.plus(payg);

    if (item.isTaxable !== false) {
      taxableIncome = taxableIncome.plus(gross);
    } else {
      nonTaxableIncome = nonTaxableIncome.plus(gross);
    }

    const type = item.type || 'Other';
    if (!byType[type]) {
      byType[type] = { gross: new Decimal(0), net: new Decimal(0) };
    }
    byType[type].gross = byType[type].gross.plus(gross);
    byType[type].net = byType[type].net.plus(net);
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
 * Decimal sibling of `aggregateIncomeBySource`.
 */
export function aggregateIncomeBySourceDecimal(
  income: IncomeInput[],
  sourceType: 'property' | 'investment',
  sourceId: string,
  targetFrequency: 'monthly' | 'annual' = 'monthly',
): IncomeAggregationDecimal {
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
  return aggregateIncomeDecimal(filtered, targetFrequency);
}
