/**
 * Q-DEC PR 2.D.3a — Shadow comparison adapters for the state-tax engines.
 *
 * Four engines:
 *   - gst.calculateGst
 *   - stampDuty.calculateStampDuty
 *   - landTax.calculateLandTax (single state)
 *   - landTax.calculateCrossStateLandTax (multi-state aggregator)
 *
 * Float doesn't round any of these (state-tax engines preserve full
 * decimal precision through the calc). Shadow tolerances default to
 * currency (0.005) on all numeric fields.
 */

import {
  calculateGst,
  calculateGstDecimal,
} from '@/lib/tax-engine/gst/gstCalculator';
import {
  calculateStampDuty,
  calculateStampDutyDecimal,
  getStampDutyConfig,
} from '@/lib/tax-engine/stampDuty/stateStampDuty';
import {
  calculateLandTax,
  calculateLandTaxDecimal,
  getLandTaxConfig,
} from '@/lib/tax-engine/landTax/stateLandTax';
import {
  calculateCrossStateLandTax,
  calculateCrossStateLandTaxDecimal,
} from '@/lib/tax-engine/landTax/crossStateAggregator';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// GST
// ---------------------------------------------------------------------------

export const gstShadow: ShadowEngine<
  {
    transactions: Array<{
      transactionId: string;
      supplyType: 'SALE' | 'CAPITAL_PURCHASE' | 'NON_CAPITAL_PURCHASE';
      classification: 'TAXABLE' | 'GST_FREE' | 'INPUT_TAXED' | 'OUT_OF_SCOPE';
      amountExcludingGst: number;
      isReverseCharge?: boolean;
      isExport?: boolean;
    }>;
    annualTurnover: number;
    isRegistered: boolean;
  },
  Omit<ReturnType<typeof calculateGst>, 'citations' | 'uncomputed'>,
  Omit<ReturnType<typeof calculateGstDecimal>, 'citations' | 'uncomputed'>
> = {
  name: 'tax.state.gst.shadow',
  description: 'Shadow Float vs Decimal `calculateGst` (BAS labels + net GST).',
  sourcePath: 'lib/tax-engine/gst/gstCalculator.ts',
  floatExecute: (input) => {
    const r = calculateGst(input);
    const { citations, uncomputed, ...rest } = r;
    return rest;
  },
  decimalExecute: (input) => {
    const r = calculateGstDecimal(input);
    const { citations, uncomputed, ...rest } = r;
    return rest;
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty',
      description: 'No transactions.',
      input: { transactions: [], annualTurnover: 0, isRegistered: false },
    },
    {
      name: 'taxable sale + non-capital purchase',
      description: 'Sale $1100 + purchase $440.',
      input: {
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 1000 },
          { transactionId: 'p1', supplyType: 'NON_CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 400 },
        ],
        annualTurnover: 250000,
        isRegistered: true,
      },
    },
    {
      name: 'GST-free export + domestic',
      description: 'Export $5k + domestic GST-free $2k.',
      input: {
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'GST_FREE', amountExcludingGst: 5000, isExport: true },
          { transactionId: 's2', supplyType: 'SALE', classification: 'GST_FREE', amountExcludingGst: 2000 },
        ],
        annualTurnover: 200000,
        isRegistered: true,
      },
    },
    {
      name: 'capital purchase with ITC',
      description: '$22k capital purchase incl GST.',
      input: {
        transactions: [
          { transactionId: 'cp1', supplyType: 'CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 20000 },
        ],
        annualTurnover: 80000,
        isRegistered: true,
      },
    },
    {
      name: 'reverse charge import',
      description: 'Reverse-charged offshore intangible.',
      input: {
        transactions: [
          { transactionId: 'p1', supplyType: 'NON_CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 1000, isReverseCharge: true },
        ],
        annualTurnover: 100000,
        isRegistered: true,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Stamp duty
// ---------------------------------------------------------------------------

const NSW_CFG = getStampDutyConfig('NSW');
const VIC_CFG = getStampDutyConfig('VIC');
const NT_CFG = getStampDutyConfig('NT');

export const stampDutyShadow: ShadowEngine<
  {
    dutiableValue: number;
    isForeignPurchaser: boolean;
    isResidential: boolean;
    state: 'NSW' | 'VIC' | 'NT';
    assertsFirstHomeOrConcession?: boolean;
  },
  Omit<ReturnType<typeof calculateStampDuty>, 'citations' | 'uncomputed' | 'breakdown'>,
  Omit<ReturnType<typeof calculateStampDutyDecimal>, 'citations' | 'uncomputed' | 'breakdown'>
> = {
  name: 'tax.state.stampDuty.shadow',
  description: 'Shadow Float vs Decimal `calculateStampDuty` (general + FPAD).',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  floatExecute: ({ state, ...input }) => {
    const cfg = state === 'NSW' ? NSW_CFG : state === 'VIC' ? VIC_CFG : NT_CFG;
    const r = calculateStampDuty({ ...input, purchaserType: 'INDIVIDUAL' }, cfg);
    return {
      generalDuty: r.generalDuty,
      foreignPurchaserSurcharge: r.foreignPurchaserSurcharge,
      totalDuty: r.totalDuty,
    };
  },
  decimalExecute: ({ state, ...input }) => {
    const cfg = state === 'NSW' ? NSW_CFG : state === 'VIC' ? VIC_CFG : NT_CFG;
    const r = calculateStampDutyDecimal({ ...input, purchaserType: 'INDIVIDUAL' }, cfg);
    return {
      generalDuty: r.generalDuty,
      foreignPurchaserSurcharge: r.foreignPurchaserSurcharge,
      totalDuty: r.totalDuty,
    };
  },
  fieldPolicy: {},
  fixtures: [
    { name: 'NSW $1M owner-occupier', description: '', input: { state: 'NSW', dutiableValue: 1_000_000, isForeignPurchaser: false, isResidential: true } },
    { name: 'NSW $1.5M foreign residential', description: 'General + FPAD 8%.', input: { state: 'NSW', dutiableValue: 1_500_000, isForeignPurchaser: true, isResidential: true } },
    { name: 'VIC $800k owner-occupier', description: '', input: { state: 'VIC', dutiableValue: 800_000, isForeignPurchaser: false, isResidential: true } },
    { name: 'VIC $2M foreign residential', description: '', input: { state: 'VIC', dutiableValue: 2_000_000, isForeignPurchaser: true, isResidential: true } },
    { name: 'NT $700k foreign (no FPAD)', description: 'NT has no FPAD regime.', input: { state: 'NT', dutiableValue: 700_000, isForeignPurchaser: true, isResidential: true } },
    { name: 'NSW $87k threshold edge', description: 'At bracket boundary.', input: { state: 'NSW', dutiableValue: 87_000, isForeignPurchaser: false, isResidential: true } },
  ],
};

// ---------------------------------------------------------------------------
// Land tax (single state)
// ---------------------------------------------------------------------------

const NSW_LT = getLandTaxConfig('NSW');
const VIC_LT = getLandTaxConfig('VIC');
const NT_LT = getLandTaxConfig('NT');

export const landTaxShadow: ShadowEngine<
  {
    state: 'NSW' | 'VIC' | 'NT';
    taxableLandValue: number;
    ownershipType: import('@/lib/tax-engine/landTax/stateLandTax').LandTaxOwnershipType;
    isForeignOwner: boolean;
    isResidential: boolean;
  },
  Omit<ReturnType<typeof calculateLandTax>, 'citations' | 'uncomputed' | 'breakdown'>,
  Omit<ReturnType<typeof calculateLandTaxDecimal>, 'citations' | 'uncomputed' | 'breakdown'>
> = {
  name: 'tax.state.landTax.shadow',
  description: 'Shadow Float vs Decimal `calculateLandTax` (general + trust + foreign).',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  floatExecute: ({ state, ...input }) => {
    const cfg = state === 'NSW' ? NSW_LT : state === 'VIC' ? VIC_LT : NT_LT;
    const r = calculateLandTax(input, cfg);
    return {
      generalLandTax: r.generalLandTax,
      trustSurcharge: r.trustSurcharge,
      foreignOwnerSurcharge: r.foreignOwnerSurcharge,
      totalTax: r.totalTax,
    };
  },
  decimalExecute: ({ state, ...input }) => {
    const cfg = state === 'NSW' ? NSW_LT : state === 'VIC' ? VIC_LT : NT_LT;
    const r = calculateLandTaxDecimal(input, cfg);
    return {
      generalLandTax: r.generalLandTax,
      trustSurcharge: r.trustSurcharge,
      foreignOwnerSurcharge: r.foreignOwnerSurcharge,
      totalTax: r.totalTax,
    };
  },
  fieldPolicy: {},
  fixtures: [
    { name: 'NSW $800k below threshold', description: '', input: { state: 'NSW', taxableLandValue: 800_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true } },
    { name: 'NSW $2M above threshold', description: '', input: { state: 'NSW', taxableLandValue: 2_000_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true } },
    { name: 'NSW $2M foreign residential', description: 'General + 4% FPAD.', input: { state: 'NSW', taxableLandValue: 2_000_000, ownershipType: 'INDIVIDUAL', isForeignOwner: true, isResidential: true } },
    { name: 'NSW $500k discretionary trust', description: 'Special trust surcharge 1.5%.', input: { state: 'NSW', taxableLandValue: 500_000, ownershipType: 'DISCRETIONARY_TRUST', isForeignOwner: false, isResidential: true } },
    { name: 'VIC $250k individual', description: '', input: { state: 'VIC', taxableLandValue: 250_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true } },
    { name: 'VIC $1M absentee', description: 'Absentee covers all taxable land.', input: { state: 'VIC', taxableLandValue: 1_000_000, ownershipType: 'INDIVIDUAL', isForeignOwner: true, isResidential: true } },
    { name: 'NT zero', description: 'NT has no land tax.', input: { state: 'NT', taxableLandValue: 1_000_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true } },
  ],
};

// ---------------------------------------------------------------------------
// Cross-state aggregator
// ---------------------------------------------------------------------------

export const crossStateLandTaxShadow: ShadowEngine<
  {
    properties: Array<{
      propertyId: string;
      state: 'NSW' | 'VIC' | 'QLD';
      taxableLandValue: number;
      isResidential: boolean;
    }>;
    ownershipType: import('@/lib/tax-engine/landTax/stateLandTax').LandTaxOwnershipType;
    isForeignOwner: boolean;
  },
  Omit<ReturnType<typeof calculateCrossStateLandTax>, 'citations' | 'uncomputed' | 'perStateAssessments'>,
  Omit<ReturnType<typeof calculateCrossStateLandTaxDecimal>, 'citations' | 'uncomputed' | 'perStateAssessments'>
> = {
  name: 'tax.state.crossStateLandTax.shadow',
  description: 'Shadow Float vs Decimal `calculateCrossStateLandTax` (multi-state aggregator).',
  sourcePath: 'lib/tax-engine/landTax/crossStateAggregator.ts',
  floatExecute: (input) => {
    const r = calculateCrossStateLandTax(input);
    return {
      grandTotalGeneralTax: r.grandTotalGeneralTax,
      grandTotalTrustSurcharge: r.grandTotalTrustSurcharge,
      grandTotalForeignSurcharge: r.grandTotalForeignSurcharge,
      grandTotalTax: r.grandTotalTax,
      statesAssessed: r.statesAssessed,
    };
  },
  decimalExecute: (input) => {
    const r = calculateCrossStateLandTaxDecimal(input);
    return {
      grandTotalGeneralTax: r.grandTotalGeneralTax,
      grandTotalTrustSurcharge: r.grandTotalTrustSurcharge,
      grandTotalForeignSurcharge: r.grandTotalForeignSurcharge,
      grandTotalTax: r.grandTotalTax,
      statesAssessed: r.statesAssessed,
    };
  },
  fieldPolicy: {},
  fixtures: [
    { name: 'empty', description: '', input: { properties: [], ownershipType: 'INDIVIDUAL', isForeignOwner: false } },
    {
      name: 'NSW + VIC + QLD individual',
      description: 'Multi-state portfolio.',
      input: {
        properties: [
          { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
          { propertyId: 'p2', state: 'VIC', taxableLandValue: 800_000, isResidential: true },
          { propertyId: 'p3', state: 'QLD', taxableLandValue: 700_000, isResidential: true },
        ],
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
      },
    },
    {
      name: 'within-state aggregation NSW',
      description: 'Two NSW parcels aggregate against single threshold.',
      input: {
        properties: [
          { propertyId: 'p1', state: 'NSW', taxableLandValue: 600_000, isResidential: true },
          { propertyId: 'p2', state: 'NSW', taxableLandValue: 600_000, isResidential: true },
        ],
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
      },
    },
  ],
};

export const taxEngineStateShadowEngines = [
  gstShadow,
  stampDutyShadow,
  landTaxShadow,
  crossStateLandTaxShadow,
] as const;
