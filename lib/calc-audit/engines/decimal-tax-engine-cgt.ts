/**
 * Q-DEC PR 2.D.3b — Shadow comparison adapters for CGT division engines.
 *
 * Two engines with real arithmetic (shadow tested):
 *   - cgtDiscount.calculateCgtDiscount (Div 115 entity-rate dispatch)
 *   - capitalLossNetting.applyCapitalLossNetting (s100-50 + s115-100
 *     ordering + blended discount)
 *
 * Three skeleton modules (contract tested, not shadow tested — they
 * return UNCOMPUTED in stage 1):
 *   - cgtIndexation.applyCgtIndexation
 *   - cgtMinimumRate.applyCgtMinimumRate
 *   - foreignResidentCgt.applyForeignResidentCgt
 *
 * §12.14 FW-1/FW-2 regime guards preserved bit-for-bit on every Decimal sibling.
 */

import {
  calculateCgtDiscount,
  calculateCgtDiscountDecimal,
} from '@/lib/tax-engine/divisions/cgtDiscount';
import {
  applyCapitalLossNetting,
  applyCapitalLossNettingDecimal,
} from '@/lib/tax-engine/divisions/capitalLossNetting';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// cgtDiscount — entity-rate dispatch
// ---------------------------------------------------------------------------

export const cgtDiscountShadow: ShadowEngine<
  {
    entityType: import('@/lib/tax-engine/divisions/cgtDiscount').CgtEligibleEntityType;
    monthsHeld: number;
    nominalGain: number;
    isComplying?: boolean;
    isForeignResident?: boolean;
  },
  Omit<ReturnType<typeof calculateCgtDiscount>, 'citations' | 'uncomputed' | 'reason'>,
  Omit<ReturnType<typeof calculateCgtDiscountDecimal>, 'citations' | 'uncomputed' | 'reason'>
> = {
  name: 'tax.divisions.cgtDiscount.shadow',
  description: 'Shadow Float vs Decimal `calculateCgtDiscount` (Div 115 entity-rate dispatch).',
  sourcePath: 'lib/tax-engine/divisions/cgtDiscount.ts',
  floatExecute: (input) => {
    const r = calculateCgtDiscount(input);
    return {
      discountRate: r.discountRate,
      discountAmount: r.discountAmount,
      discountedGain: r.discountedGain,
      metHoldingPeriod: r.metHoldingPeriod,
    };
  },
  decimalExecute: (input) => {
    const r = calculateCgtDiscountDecimal(input);
    return {
      discountRate: r.discountRate,
      discountAmount: r.discountAmount,
      discountedGain: r.discountedGain,
      metHoldingPeriod: r.metHoldingPeriod,
    };
  },
  // discountRate is a 0..1 ratio (50% = 0.5); use rate tolerance for it.
  fieldPolicy: {
    discountRate: 'rate',
  },
  fixtures: [
    {
      name: 'PERSONAL_NAME 50% discount on $100k gain',
      description: 'Held 24 months, individual.',
      input: { entityType: 'PERSONAL_NAME', monthsHeld: 24, nominalGain: 100_000 },
    },
    {
      name: 'COMPANY no discount',
      description: 'Companies not eligible (s115-280).',
      input: { entityType: 'COMPANY', monthsHeld: 36, nominalGain: 100_000 },
    },
    {
      name: 'SMSF complying 33.33% discount',
      description: 'SMSF gets 1/3 discount per s115-100.',
      input: { entityType: 'SMSF', monthsHeld: 24, nominalGain: 90_000 },
    },
    {
      name: 'SMSF non-complying no discount',
      description: 'Non-complying SMSF s115-100 carve-out.',
      input: { entityType: 'SMSF', monthsHeld: 24, nominalGain: 90_000, isComplying: false },
    },
    {
      name: 'held under 12 months',
      description: 'No discount per s115-25.',
      input: { entityType: 'PERSONAL_NAME', monthsHeld: 6, nominalGain: 50_000 },
    },
    {
      name: 'DISCRETIONARY_TRUST 50%',
      description: 'Trust gets 50% discount, flows on stream.',
      input: { entityType: 'DISCRETIONARY_TRUST', monthsHeld: 18, nominalGain: 75_500 },
    },
    {
      name: 'fractional gain',
      description: '$1234.56 gain, individual.',
      input: { entityType: 'PERSONAL_NAME', monthsHeld: 24, nominalGain: 1234.56 },
    },
    {
      name: 'negative nominalGain (loss-shaped)',
      description: 'Loss passed in; discountAmount floor at 0 via Math.max(0, gain).',
      input: { entityType: 'PERSONAL_NAME', monthsHeld: 24, nominalGain: -5000 },
    },
  ],
};

// ---------------------------------------------------------------------------
// capitalLossNetting — s100-50 + s115-100 ordering
// ---------------------------------------------------------------------------

export const capitalLossNettingShadow: ShadowEngine<
  {
    entityType: import('@/lib/tax-engine/divisions/cgtDiscount').CgtEligibleEntityType;
    events: Array<{ id: string; monthsHeld: number; nominalAmount: number; label?: string }>;
    carryForwardLosses?: Array<{ financialYear: string; amount: number }>;
    isComplying?: boolean;
  },
  Omit<ReturnType<typeof applyCapitalLossNetting>, 'citations' | 'uncomputed' | 'breakdown' | 'discountResult'>,
  Omit<ReturnType<typeof applyCapitalLossNettingDecimal>, 'citations' | 'uncomputed' | 'breakdown' | 'discountResult'>
> = {
  name: 'tax.divisions.capitalLossNetting.shadow',
  description: 'Shadow Float vs Decimal `applyCapitalLossNetting` (s100-50 + s115-100 ordering).',
  sourcePath: 'lib/tax-engine/divisions/capitalLossNetting.ts',
  floatExecute: (input) => {
    const r = applyCapitalLossNetting(input);
    return {
      totalNominalGains: r.totalNominalGains,
      totalCurrentYearLosses: r.totalCurrentYearLosses,
      totalPriorYearLosses: r.totalPriorYearLosses,
      netGainBeforeDiscount: r.netGainBeforeDiscount,
      assessableNetCapitalGain: r.assessableNetCapitalGain,
      carryForwardOut: r.carryForwardOut,
    };
  },
  decimalExecute: (input) => {
    const r = applyCapitalLossNettingDecimal(input);
    return {
      totalNominalGains: r.totalNominalGains,
      totalCurrentYearLosses: r.totalCurrentYearLosses,
      totalPriorYearLosses: r.totalPriorYearLosses,
      netGainBeforeDiscount: r.netGainBeforeDiscount,
      assessableNetCapitalGain: r.assessableNetCapitalGain,
      carryForwardOut: r.carryForwardOut,
    };
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'no events',
      description: '',
      input: { entityType: 'PERSONAL_NAME', events: [] },
    },
    {
      name: 'single gain individual 50% discount',
      description: 'One $80k gain, held 24 months.',
      input: {
        entityType: 'PERSONAL_NAME',
        events: [{ id: 'e1', monthsHeld: 24, nominalAmount: 80_000 }],
      },
    },
    {
      name: 'gain + current-year loss',
      description: '$100k gain - $30k loss → $70k net, discounted to $35k.',
      input: {
        entityType: 'PERSONAL_NAME',
        events: [
          { id: 'e1', monthsHeld: 24, nominalAmount: 100_000 },
          { id: 'e2', monthsHeld: 12, nominalAmount: -30_000 },
        ],
      },
    },
    {
      name: 'losses > gains → carry forward',
      description: '$30k gain - $50k loss → $0 assessable + $20k carry-forward.',
      input: {
        entityType: 'PERSONAL_NAME',
        events: [
          { id: 'e1', monthsHeld: 24, nominalAmount: 30_000 },
          { id: 'e2', monthsHeld: 18, nominalAmount: -50_000 },
        ],
      },
    },
    {
      name: 'prior-year carry-forward applied',
      description: '$80k gain - $20k current loss - $30k prior CF = $30k net.',
      input: {
        entityType: 'PERSONAL_NAME',
        events: [
          { id: 'e1', monthsHeld: 24, nominalAmount: 80_000 },
          { id: 'e2', monthsHeld: 12, nominalAmount: -20_000 },
        ],
        carryForwardLosses: [
          { financialYear: '2022-23', amount: 15_000 },
          { financialYear: '2023-24', amount: 15_000 },
        ],
      },
    },
    {
      name: 'mixed holding periods (UC-CGT-MIXED-HOLDING)',
      description: '$50k qualifying + $30k non-qualifying.',
      input: {
        entityType: 'PERSONAL_NAME',
        events: [
          { id: 'e1', monthsHeld: 24, nominalAmount: 50_000 },
          { id: 'e2', monthsHeld: 8, nominalAmount: 30_000 },
        ],
      },
    },
    {
      name: 'SMSF 1/3 discount on $90k net',
      description: '',
      input: {
        entityType: 'SMSF',
        events: [{ id: 'e1', monthsHeld: 24, nominalAmount: 90_000 }],
      },
    },
  ],
};

export const taxEngineCgtShadowEngines = [
  cgtDiscountShadow,
  capitalLossNettingShadow,
] as const;
