/**
 * Phase 41i — Calc engine registrations: tax engine.
 *
 * Each Phase 41e module is wrapped as a `CalcEngine` with at least
 * one reference fixture. **Assertions are hardcoded from source
 * authority** (ATO worked examples, the legislation itself, ATO
 * published rate values for the FY) — never derived from the
 * engine itself, which would make the assertion self-referential.
 *
 * **Fixture provenance discipline (Phase 41 §1.4):** every
 * assertion's hardcoded value was hand-verified against the
 * underlying authority at registration time. If a future engine
 * refactor changes the output shape, the assertion must be updated
 * AND the change documented in the PR description (§16.5 doc-sync).
 */

import { calcEngineRegistry } from '../registry';

import { trackContributionCaps, type CapTrackingInput } from '@/lib/tax-engine/super/capTracker';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { calculateGst, type GstInput } from '@/lib/tax-engine/gst/gstCalculator';
import {
  calculateLandTax,
  NSW_LAND_TAX_CY2025,
  type LandTaxInput,
} from '@/lib/tax-engine/landTax/stateLandTax';
import {
  calculateCrossStateLandTax,
  type CrossStateLandTaxInput,
} from '@/lib/tax-engine/landTax/crossStateAggregator';
import {
  calculateStampDuty,
  NSW_STAMP_DUTY_FY2024_25,
  type StampDutyInput,
} from '@/lib/tax-engine/stampDuty/stateStampDuty';
import {
  applyTrustLossRules,
  type TrustLossInput,
} from '@/lib/tax-engine/divisions/trustLossRules';
import {
  applyCompanyLossRules,
  type CompanyLossInput,
} from '@/lib/tax-engine/divisions/companyLossRules';

// ============================================================
// Super: contribution caps (s291-20 / s292-85)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.capTracker',
  description: 'SMSF + individual super contribution caps (s291-20 concessional, s292-85 non-concessional). Carry-forward + bring-forward eligibility.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/super/capTracker.ts',
  execute: (input: CapTrackingInput) =>
    trackContributionCaps(input, getTaxYearConfig('2024-25')),
  fixtures: [
    {
      name: 'FY24-25 individual mid-cap',
      description: 'Individual at $22k YTD concessional, $0 non-concessional, no carry-forward.',
      input: {
        concessionalYTD: 22_000,
        nonConcessionalYTD: 0,
      },
      assertions: [
        {
          description: 'FY24-25 concessional cap is $30,000 (per s291-20 + ATO published value)',
          check: (r) => r.concessional.cap === 30_000,
        },
        {
          description: 'Used = $22,000 (input)',
          check: (r) => r.concessional.used === 22_000,
        },
        {
          description: 'Remaining = $8,000 ($30k cap − $22k used)',
          check: (r) => r.concessional.remaining === 8_000,
        },
        {
          description: 'No excess contributions tax (under cap)',
          check: (r) => r.excessContributionsTax === 0,
        },
        {
          description: 'FY24-25 non-concessional cap is $120,000 (per s292-85 + ATO published value)',
          check: (r) => r.nonConcessional.cap === 120_000,
        },
      ],
      authoritySource: 'ITAA 1997 s291-20 + s292-85; ATO published cap values FY24-25 ($30k / $120k).',
    },
  ],
});

// ============================================================
// GST / BAS
// ============================================================

calcEngineRegistry.register({
  name: 'tax.gstCalculator',
  description: 'GST calculation + BAS labels (G1/G2/G3/G10/G11/1A/1B). Per A New Tax System (GST) Act 1999.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/gst/gstCalculator.ts',
  execute: (input: GstInput) => calculateGst(input),
  fixtures: [
    {
      name: 'Mixed taxable + GST-free + input-taxed',
      description: '$10k taxable sale + $3k taxable purchase. Expected: $1,000 GST collected, $300 ITC, net $700.',
      input: {
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 10_000 },
          { transactionId: 'p1', supplyType: 'NON_CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 3_000 },
          { transactionId: 's2', supplyType: 'SALE', classification: 'GST_FREE', amountExcludingGst: 1_000, isExport: true },
          { transactionId: 's3', supplyType: 'SALE', classification: 'INPUT_TAXED', amountExcludingGst: 500 },
        ],
        annualTurnover: 100_000,
        isRegistered: true,
      },
      assertions: [
        {
          description: 'GST collected = $1,000 (10% × $10k taxable sale; per s9-70)',
          check: (r) => r.gstCollected === 1_000,
        },
        {
          description: 'ITC claimable = $300 (10% × $3k taxable purchase)',
          check: (r) => r.gstCreditsClaimable === 300,
        },
        {
          description: 'Net GST = $700 (1A − 1B)',
          check: (r) => r.netGst === 700,
        },
        {
          description: 'BAS G2 (export GST-free) = $1,000',
          check: (r) => r.basLabels.G2 === 1_000,
        },
        {
          description: 'BAS G1 (total sales incl GST) = $12,000 ($11k taxable inc GST + $1k GST-free; input-taxed excluded)',
          check: (r) => r.basLabels.G1 === 12_000,
        },
      ],
      authoritySource: 'GST Act s9-70 (10% rate); s38 (GST-free); s40 (input-taxed); ATO BAS quarterly form labels.',
    },
  ],
});

// ============================================================
// State land tax — NSW
// ============================================================

calcEngineRegistry.register({
  name: 'tax.landTax.NSW',
  description: 'NSW land tax — general (s27) + special trust surcharge (s5A) + foreign owner surcharge (Sch 1A).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, NSW_LAND_TAX_CY2025),
  fixtures: [
    {
      name: 'NSW individual @ $1.5M residential',
      description: 'Above $1.075M threshold; no trust; no foreign surcharge. Expected: $100 + 1.6% × $425k = $6,900.',
      input: {
        taxableLandValue: 1_500_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $6,900 ($100 + 1.6% × ($1.5M − $1.075M); per Land Tax Act 1956 s27)',
          check: (r) => Math.abs(r.generalLandTax - 6_900) < 1,
        },
        {
          description: 'No trust surcharge (individual ownership)',
          check: (r) => r.trustSurcharge === 0,
        },
        {
          description: 'No foreign owner surcharge (AU resident)',
          check: (r) => r.foreignOwnerSurcharge === 0,
        },
        {
          description: 'Total tax = general only = $6,900',
          check: (r) => Math.abs(r.totalTax - 6_900) < 1,
        },
      ],
      authoritySource: 'NSW Land Tax Act 1956 s27 (general scale CY2025).',
    },
    {
      name: 'NSW foreign discretionary trust @ $1.5M residential',
      description: 'Combined: general + special trust surcharge (s5A) + foreign surcharge (Sch 1A).',
      input: {
        taxableLandValue: 1_500_000,
        ownershipType: 'DISCRETIONARY_TRUST',
        isForeignOwner: true,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $6,900 (same as individual case)',
          check: (r) => Math.abs(r.generalLandTax - 6_900) < 1,
        },
        {
          description: 'Trust surcharge = $16,125 (1.5% × $1.075M cap; per s5A)',
          check: (r) => Math.abs(r.trustSurcharge - 16_125) < 1,
        },
        {
          description: 'Foreign surcharge = $60,000 (4% × $1.5M; per Sch 1A)',
          check: (r) => Math.abs(r.foreignOwnerSurcharge - 60_000) < 1,
        },
        {
          description: 'Total = $6,900 + $16,125 + $60,000 = $83,025',
          check: (r) => Math.abs(r.totalTax - 83_025) < 1,
        },
      ],
      authoritySource: 'NSW Land Tax Act 1956 s27 + s5A + Sch 1A.',
    },
  ],
});

// ============================================================
// Cross-state land tax aggregator
// ============================================================

calcEngineRegistry.register({
  name: 'tax.crossStateLandTax',
  description: 'Cross-state land tax — within-state aggregation per state\'s Land Tax Act + across-state independence.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/crossStateAggregator.ts',
  execute: (input: CrossStateLandTaxInput) => calculateCrossStateLandTax(input),
  fixtures: [
    {
      name: 'NSW + VIC + QLD individual @ $1.5M each',
      description: 'Multi-state portfolio. NSW $6,900 + VIC $17,700 + QLD $12,750 = $37,350.',
      input: {
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        properties: [
          { propertyId: 'n1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
          { propertyId: 'v1', state: 'VIC', taxableLandValue: 1_500_000, isResidential: true },
          { propertyId: 'q1', state: 'QLD', taxableLandValue: 1_500_000, isResidential: true },
        ],
      },
      assertions: [
        {
          description: '3 states assessed',
          check: (r) => r.statesAssessed === 3,
        },
        {
          description: 'Grand total general tax = $37,350 (NSW + VIC + QLD)',
          check: (r) => Math.abs(r.grandTotalGeneralTax - 37_350) < 1,
        },
        {
          description: 'Per-state assessments alphabetical: NSW, QLD, VIC',
          check: (r) =>
            r.perStateAssessments[0]?.state === 'NSW' &&
            r.perStateAssessments[1]?.state === 'QLD' &&
            r.perStateAssessments[2]?.state === 'VIC',
        },
        {
          description: 'UC-LAND-TAX-JOINT-OWNERSHIP surfaced (multi-state aggregator)',
          check: (r) => r.uncomputed.some((u) => u.id === 'UC-LAND-TAX-JOINT-OWNERSHIP'),
        },
      ],
      authoritySource: 'NSW + VIC + QLD Land Tax Acts (per-state). Cross-state independence verified against per-state hand-calculations.',
    },
  ],
});

// ============================================================
// Stamp duty — NSW
// ============================================================

calcEngineRegistry.register({
  name: 'tax.stampDuty.NSW',
  description: 'NSW stamp duty (transfer) + foreign purchaser additional duty per Duties Act 1997.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) => calculateStampDuty(input, NSW_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'NSW foreign individual @ $1M residential',
      description: 'General duty + 8% FPAD per Ch 2 Pt 4 Div 4. Expected: $40,090 + $80,000 = $120,090.',
      input: {
        dutiableValue: 1_000_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: true,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty = $40,090 ($9,805 + 4.5% × $673k; per Sch 1)',
          check: (r) => Math.abs(r.generalDuty - 40_090) < 1,
        },
        {
          description: 'FPAD = $80,000 (8% × $1M; per Ch 2 Pt 4 Div 4)',
          check: (r) => Math.abs(r.foreignPurchaserSurcharge - 80_000) < 1,
        },
        {
          description: 'Total = $120,090',
          check: (r) => Math.abs(r.totalDuty - 120_090) < 1,
        },
      ],
      authoritySource: 'NSW Duties Act 1997 Sch 1 + Ch 2 Pt 4 Div 4 (FPAD 8%).',
    },
  ],
});

// ============================================================
// Trust loss rules (Sch 2F ITAA 1936)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.trustLossRules',
  description: 'Trust loss utilisation tests per Sch 2F ITAA 1936 (IIT, 50% Stake, Pattern of Distributions, Control, SBT).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/trustLossRules.ts',
  execute: (input: TrustLossInput) => applyTrustLossRules(input),
  fixtures: [
    {
      name: 'Family trust FTE — IIT pass',
      description: 'Family-trust-elected trust where the only required test (IIT) passes. Loss deductible.',
      input: {
        trustType: 'FAMILY_TRUST_FTE',
        lossAmount: 50_000,
        testOutcomes: { incomeInjectionTest: 'PASS' },
      },
      assertions: [
        {
          description: 'Outcome = LOSSES_DEDUCTIBLE',
          check: (r) => r.outcome === 'LOSSES_DEDUCTIBLE',
        },
        {
          description: 'Deductible loss amount = $50,000 (full input)',
          check: (r) => r.deductibleLossAmount === 50_000,
        },
        {
          description: 'FAMILY_TRUST_FTE only requires IIT (1 test in report)',
          check: (r) => r.testReport.length === 1,
        },
      ],
      authoritySource: 'Sch 2F ITAA 1936 Div 270 (Income Injection Test); FTE-protected trusts only need IIT.',
    },
    {
      name: 'Non-fixed trust — IIT fail → LOSSES_DENIED',
      description: 'Non-fixed trust where the Income Injection Test fails. Losses denied.',
      input: {
        trustType: 'NON_FIXED_TRUST',
        lossAmount: 100_000,
        testOutcomes: {
          fiftyPercentStakeTest: 'PASS',
          patternOfDistributionsTest: 'PASS',
          controlTest: 'PASS',
          incomeInjectionTest: 'FAIL',
        },
      },
      assertions: [
        {
          description: 'Outcome = LOSSES_DENIED',
          check: (r) => r.outcome === 'LOSSES_DENIED',
        },
        {
          description: 'Deductible loss = $0 (denied)',
          check: (r) => r.deductibleLossAmount === 0,
        },
      ],
      authoritySource: 'Sch 2F ITAA 1936 Div 267 (non-fixed trust loss tests).',
    },
  ],
});

// ============================================================
// Company loss rules (Div 165 ITAA 1997)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.companyLossRules',
  description: 'Company loss tests per Div 165 ITAA 1997 (COT primary; SBT/Similar Business as fallback).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/companyLossRules.ts',
  execute: (input: CompanyLossInput) => applyCompanyLossRules(input),
  fixtures: [
    {
      name: 'COT pass → LOSSES_DEDUCTIBLE_VIA_COT',
      description: 'Continuity of Ownership Test passes — losses fully deductible.',
      input: {
        priorYearLossAmount: 200_000,
        cotOutcome: 'PASS',
      },
      assertions: [
        {
          description: 'Outcome = LOSSES_DEDUCTIBLE_VIA_COT',
          check: (r) => r.outcome === 'LOSSES_DEDUCTIBLE_VIA_COT',
        },
        {
          description: 'Full $200k deductible',
          check: (r) => r.deductibleLossAmount === 200_000,
        },
      ],
      authoritySource: 'Div 165 ITAA 1997 + s165-12 (COT).',
    },
    {
      name: 'COT fail + Similar Business pass → LOSSES_DEDUCTIBLE_VIA_BCT',
      description: 'COT fails; s165-211 Similar Business Test passes — losses deductible via fallback.',
      input: {
        priorYearLossAmount: 200_000,
        cotOutcome: 'FAIL',
        bctOutcome: 'PASS',
        bctTestType: 'SIMILAR',
      },
      assertions: [
        {
          description: 'Outcome = LOSSES_DEDUCTIBLE_VIA_BCT',
          check: (r) => r.outcome === 'LOSSES_DEDUCTIBLE_VIA_BCT',
        },
        {
          description: 'UC-COMPANY-LOSS-BCT-FACTUAL surfaces (caller-asserted)',
          check: (r) => r.uncomputed.some((u) => u.id === 'UC-COMPANY-LOSS-BCT-FACTUAL'),
        },
      ],
      authoritySource: 'Div 165 ITAA 1997 + s165-211 (Similar Business Test, added 2019).',
    },
  ],
});
