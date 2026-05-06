/**
 * Phase 41i.2 — Calc engine registrations: tax divisions + classifiers + orchestrator.
 *
 * Extends the audit coverage from 41i.0+41i.1's seven tax engines
 * to include every Phase 41e module the AI advisor relies on. Each
 * adapter follows the assertion-based fixture pattern locked in by
 * 41i (no `expectedOutput: engine(input)` self-reference).
 *
 * Authority pinned in each fixture's `assertions` description so a
 * future engine refactor that changes the canonical output forces
 * a deliberate fixture update + reviewer sign-off.
 */

import { calcEngineRegistry } from '../registry';

import {
  applyCapitalLossNetting,
  type CapitalLossNettingInput,
} from '@/lib/tax-engine/divisions/capitalLossNetting';
import {
  classifyDiv7ALoans,
  type Div7ALoanInput,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';
import {
  classifyPsi,
  type PsiInput,
} from '@/lib/tax-engine/divisions/psiClassifier';
import {
  classifyFteIeeDistributions,
  type FteIeeInput,
} from '@/lib/tax-engine/divisions/fteIeeClassifier';
import {
  applyDiv152,
  type Div152Input,
} from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';
import {
  classifySmsfTriumvirate,
  type SmsfTriumvirateInput,
} from '@/lib/tax-engine/divisions/smsfTriumvirateClassifier';
import {
  calculateHighIncomeSuperTax,
  type HighIncomeSuperTaxInput,
} from '@/lib/tax-engine/super/highIncomeSuperTax';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import {
  buildMasterTaxPosition,
  type MasterTaxPositionInput,
} from '@/lib/tax-engine/orchestrator/masterTaxPosition';

// ============================================================
// Capital loss netting (Div 102-A / s100-50 / s115-100)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.cgtNetting',
  description:
    'Capital loss netting + s115-100 discount + Div 102-A assessable net capital gain.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/capitalLossNetting.ts',
  execute: (input: CapitalLossNettingInput) => applyCapitalLossNetting(input),
  fixtures: [
    {
      name: 'Individual — $100k discount-eligible gain, $20k loss',
      description:
        'One $100k gain held >12 months + one $20k loss; net pre-discount = $80k. Discount step then applies.',
      input: {
        entityType: 'PERSONAL_NAME',
        events: [
          { id: 'gain', label: 'Property A', monthsHeld: 14, nominalAmount: 100_000 },
          { id: 'loss', label: 'Shares B', monthsHeld: 6, nominalAmount: -20_000 },
        ],
      },
      assertions: [
        {
          description: 'Total nominal gains = $100,000',
          check: (r) => r.totalNominalGains === 100_000,
        },
        {
          description: 'Total current-year losses = $20,000',
          check: (r) => r.totalCurrentYearLosses === 20_000,
        },
        {
          description: 'Net gain before discount = $80,000 (gain − loss; s100-50)',
          check: (r) => r.netGainBeforeDiscount === 80_000,
        },
      ],
      authoritySource:
        'ITAA 1997 s100-50 (loss netting order); Div 102-A (assessable net CG); s115-100 (discount).',
    },
  ],
});

// ============================================================
// Div 7A loan classifier (s109B-s109ZE)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.div7aClassifier',
  description:
    'Div 7A — classifies private-company loans as COMPLIANT / MRP_SHORTFALL / NO_AGREEMENT / SUB_TRUST_UPE / DEEMED_DIVIDEND.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/div7aLoanClassifier.ts',
  execute: (input: { loans: Div7ALoanInput[] }) =>
    classifyDiv7ALoans(input.loans),
  fixtures: [
    {
      name: 'No agreement → DEEMED_DIVIDEND (s109D)',
      description:
        '$100k unsecured loan with no written Div 7A agreement → automatically deemed dividend.',
      input: {
        loans: [
          {
            loanId: 'L1',
            openingBalance: 100_000,
            yearsRemaining: 7,
            benchmarkRate: 0.0837,
            paymentsMadeThisFy: 0,
            hasComplianceAgreement: false,
          },
        ],
      },
      assertions: [
        {
          description: 'Highest severity = NO_AGREEMENT (s109D — no written agreement)',
          check: (r) => r.highestSeverity === 'NO_AGREEMENT',
        },
        {
          description: 'Total deemed dividend > 0',
          check: (r) => r.totalDeemedDividend > 0,
        },
        {
          description: 'One classification returned',
          check: (r) => r.classifications.length === 1,
        },
      ],
      authoritySource: 'ITAA 1936 s109D (no written agreement → deemed dividend).',
    },
    {
      name: 'Empty loans → COMPLIANT + zero exposure',
      description: 'No loans assessed; engine returns clean state.',
      input: { loans: [] },
      assertions: [
        {
          description: 'highestSeverity = COMPLIANT',
          check: (r) => r.highestSeverity === 'COMPLIANT',
        },
        {
          description: 'totalDeemedDividend = 0',
          check: (r) => r.totalDeemedDividend === 0,
        },
      ],
      authoritySource: 'Engine contract: empty input returns clean state.',
    },
  ],
});

// ============================================================
// PSI classifier (Part 2-42 ITAA 1997)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.psiClassifier',
  description:
    'Personal Services Income classifier — runs the 5 Part 2-42 tests (80%/results/unrelated/employment/premises) and determines PSB status.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/psiClassifier.ts',
  execute: (input: PsiInput) => classifyPsi(input),
  fixtures: [
    {
      name: 'Single client over 80% → not a PSB → full attribution',
      description:
        '$100k PSI from a single client → fails 80% test → no other PSB tests pass → full attribution to individual at marginal rates (s86-15).',
      input: {
        totalPsiIncome: 100_000,
        incomeFromLargestClient: 100_000,
        unrelatedClientCount: 1,
        gainedClientsViaDirectAdvertising: false,
        producesProductionResult: false,
        bearsCostOfRectifyingDefects: false,
        suppliesPlantOrEquipment: false,
        engagesEmployeesForAtLeast20PercentOfWork: false,
        usesBusinessPremises: false,
      },
      assertions: [
        {
          description: 'isPsi is true (income is personal services)',
          check: (r) => r.isPsi === true,
        },
        {
          description: '80%-one-client test fails',
          check: (r) => r.tests.eightyPercentOneClient === 'FAIL',
        },
        {
          description: 'unrelated clients test fails (only 1 client)',
          check: (r) => r.tests.unrelatedClientsTest === 'FAIL',
        },
        {
          description: 'isPsb is false',
          check: (r) => r.isPsb === false,
        },
        {
          description: 'Full $100,000 attributed to individual',
          check: (r) => r.psiAttributedToIndividual === 100_000,
        },
      ],
      authoritySource:
        'ITAA 1997 Part 2-42 + s86-15 (PSI attribution to individual when not a PSB).',
    },
  ],
});

// ============================================================
// FTE / IEE classifier (Sch 2F ITAA 1936)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.fteIeeClassifier',
  description:
    'Family Trust Election + Interposed Entity Election classifier — distributions inside vs outside the family group; FTDT at 47% on outside-group; TFN withholding at 47% on non-quoting.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/fteIeeClassifier.ts',
  execute: (input: FteIeeInput) => classifyFteIeeDistributions(input),
  fixtures: [
    {
      name: 'Distribution to family member with FTE → INSIDE_FAMILY',
      description:
        'Family member receives a distribution; FTE in force; classifies as INSIDE_FAMILY (no FTDT, no TFN withholding).',
      input: {
        hasFamilyTrustElection: true,
        beneficiaries: [
          {
            beneficiaryId: 'spouse',
            beneficiaryName: 'Test spouse',
            distributionAmount: 50_000,
            relationship: 'FAMILY_MEMBER',
            hasQuotedTfn: true,
          },
        ],
      },
      assertions: [
        {
          description: 'Distribution classified INSIDE_FAMILY',
          check: (r) => r.classifications[0]?.outcome === 'INSIDE_FAMILY',
        },
        {
          description: 'No FTDT applied',
          check: (r) => r.classifications[0]?.ftdtPayableByTrustee === 0,
        },
        {
          description: 'No TFN withholding',
          check: (r) => r.classifications[0]?.tfnWithholdingDeducted === 0,
        },
        {
          description: 'totalFtdtPayable = 0',
          check: (r) => r.totalFtdtPayable === 0,
        },
      ],
      authoritySource: 'Sch 2F ITAA 1936 — family group distributions.',
    },
  ],
});

// ============================================================
// Div 152 small business CGT concessions
// ============================================================

calcEngineRegistry.register({
  name: 'tax.div152',
  description:
    'Div 152 small-business CGT concessions — 15-yr exemption / 50% active asset / retirement $500k / rollover. Stacking applied per legislated order.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/div152SmallBusinessConcessions.ts',
  execute: (input: Div152Input) => applyDiv152(input),
  fixtures: [
    {
      name: 'Basic conditions not met → no concessions',
      description:
        'MNAV $10M (over $6M threshold) + turnover $5M (over $2M threshold) → fails MNAV test + fails SBE turnover test → assessable gain unchanged.',
      input: {
        gainAfterDiv115: 100_000,
        maxNetAssetValue: 10_000_000,
        aggregatedTurnover: 5_000_000,
        isActiveAsset: true,
        monthsHeld: 60,
        isRetirementOrIncapacity: false,
      },
      assertions: [
        {
          description: 'basicConditionsMet = false (over both thresholds)',
          check: (r) => r.basicConditionsMet === false,
        },
        {
          description: 'assessableGain unchanged at $100,000',
          check: (r) => r.assessableGain === 100_000,
        },
        {
          description: '15-year exemption NOT applied',
          check: (r) => r.fifteenYearExemptionApplied === false,
        },
      ],
      authoritySource:
        'ITAA 1997 Div 152 — basic conditions: MNAV ≤ $6M (s152-15) OR turnover ≤ $2M (s152-20).',
    },
  ],
});

// ============================================================
// SMSF triumvirate (full — sole purpose / in-house / LRBA / NALI)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.smsfTriumvirate',
  description:
    'SMSF compliance triumvirate — sole purpose test (s62 SIS) + in-house asset 5% cap (Pt 8) + LRBA compliance (s67A + PCG 2016/5) + NALI (s295-550).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/divisions/smsfTriumvirateClassifier.ts',
  execute: (input: SmsfTriumvirateInput) => classifySmsfTriumvirate(input),
  fixtures: [
    {
      name: 'All-clear fund → no breach + 15% rate',
      description:
        'Sole purpose passes, no in-house assets, no LRBA, no NALI. Standard complying outcome.',
      input: {
        totalFundValue: 1_000_000,
        meetsSolePurposeTest: true,
        fyIncome: 50_000,
        hasNonArmsLengthIncome: false,
      },
      assertions: [
        {
          description: 'Sole purpose status = PASS',
          check: (r) => r.solePurpose.status === 'PASS',
        },
        {
          description: 'Applicable income rate = 15% (complying)',
          check: (r) => r.applicableIncomeRate === 0.15,
        },
        {
          description: 'NALI tax = $0 (no NALI)',
          check: (r) => r.naliTax === 0,
        },
        {
          description: 'No breach overall',
          check: (r) => r.anyBreach === false,
        },
      ],
      authoritySource:
        'SIS Act s62 + Pt 8 + s67A; ITAA 1997 s295-550 (NALI); s295-160 (non-complying 45%).',
    },
    {
      name: 'Non-complying (sole purpose fail) → 45% rate',
      description:
        'Sole purpose fails → fund is non-complying → 45% rate applies (s295-160).',
      input: {
        totalFundValue: 1_000_000,
        meetsSolePurposeTest: false,
        fyIncome: 50_000,
        hasNonArmsLengthIncome: false,
      },
      assertions: [
        {
          description: 'Sole purpose status = FAIL',
          check: (r) => r.solePurpose.status === 'FAIL',
        },
        {
          description: 'Applicable income rate = 45% (non-complying)',
          check: (r) => r.applicableIncomeRate === 0.45,
        },
        {
          description: 'anyBreach = true',
          check: (r) => r.anyBreach === true,
        },
        {
          description: 'UC-SMSF-NON-COMPLYING surfaced',
          check: (r) => r.uncomputed.some((u) => u.id === 'UC-SMSF-NON-COMPLYING'),
        },
      ],
      authoritySource:
        'SIS Act s62 + ITAA 1997 s295-160 (non-complying SMSF rate).',
    },
  ],
});

// ============================================================
// High-income super tax (Div 293 + Div 296 gating)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.highIncomeSuperTax',
  description:
    'Div 293 high-income super tax (15% on concessional contributions when income for surcharge purposes ≥ $250k) + Div 296 gating placeholder.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/super/highIncomeSuperTax.ts',
  execute: (input: HighIncomeSuperTaxInput) =>
    calculateHighIncomeSuperTax(input, getTaxYearConfig('2024-25')),
  fixtures: [
    {
      name: 'Income $260k + $30k concessional → Div 293 applies',
      description: '$10k over threshold → Div 293 surcharge applies on lesser of excess income and concessional contributions.',
      input: {
        div293Income: 260_000,
        concessionalContributions: 30_000,
        totalSuperBalance: 500_000,
      },
      assertions: [
        {
          description: 'Div 293 applies',
          check: (r) => r.div293.applies === true,
        },
        {
          description: 'Excess income over threshold = $10,000',
          check: (r) => r.div293.excessIncomeOverThreshold === 10_000,
        },
        {
          description: 'Tax > 0',
          check: (r) => r.div293.tax > 0,
        },
      ],
      authoritySource: 'ITAA 1997 Div 293 — $250k threshold, 15% rate on lesser of excess + concessional contributions (s293-15).',
    },
    {
      name: 'Income $200k → Div 293 does not apply',
      description: 'Below $250k threshold; no Div 293 liability.',
      input: {
        div293Income: 200_000,
        concessionalContributions: 30_000,
        totalSuperBalance: 200_000,
      },
      assertions: [
        {
          description: 'Div 293 does NOT apply',
          check: (r) => r.div293.applies === false,
        },
        {
          description: 'Tax = $0',
          check: (r) => r.div293.tax === 0,
        },
      ],
      authoritySource: 'ITAA 1997 Div 293 — applies only when income ≥ $250k.',
    },
  ],
});

// ============================================================
// MasterTaxPosition orchestrator (Phase 41e.17)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.masterTaxPosition',
  description:
    'MasterTaxPosition orchestrator — wires every Phase 41e module into one entity-aware household result + AFSL footer envelope.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/orchestrator/masterTaxPosition.ts',
  execute: (input: MasterTaxPositionInput) => buildMasterTaxPosition(input),
  fixtures: [
    {
      name: 'Single PERSONAL_NAME entity with salary',
      description:
        'Minimal household: one PERSONAL_NAME entity with $100k salary. Verifies orchestrator pipeline runs end-to-end.',
      input: {
        userId: 'audit-user-1',
        fy: { financialYear: '2024-25', label: 'FY24-25' },
        entities: [
          {
            entityId: 'e1',
            entityType: 'PERSONAL_NAME',
            fy: { financialYear: '2024-25', label: 'FY24-25' },
            incomes: [
              {
                id: 'i1',
                name: 'Salary',
                type: 'SALARY',
                amount: 100_000,
                frequency: 'YEARLY',
                paygWithholding: 22_000,
              },
            ],
            expenses: [],
            depreciations: [],
          },
        ],
      },
      assertions: [
        {
          description: 'Returns exactly 1 entity in entities array',
          check: (r) => r.entities.length === 1,
        },
        {
          description: 'modulesInvoked includes entityTaxRouter',
          check: (r) => r.modulesInvoked.includes('entityTaxRouter'),
        },
        {
          description: 'Boundary footer always populated',
          check: (r) =>
            r.boundary !== undefined && r.boundary.boundary.length > 0,
        },
        {
          description: 'computedAt is ISO-8601',
          check: (r) => /^\d{4}-\d{2}-\d{2}T/.test(r.computedAt),
        },
      ],
      authoritySource:
        'Engine contract — pure orchestrator wiring per Phase 41e.17.',
    },
  ],
});
