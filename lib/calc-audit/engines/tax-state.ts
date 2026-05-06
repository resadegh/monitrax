/**
 * Phase 41i.2 — Calc engine registrations: per-state land-tax + stamp-duty engines.
 *
 * Extends the audit coverage from 41i.0+41i.1's NSW-only state
 * adapters to all 8 Australian states/territories. Each state's
 * engine wraps `calculateLandTax(input, <state-config>)` and
 * `calculateStampDuty(input, <state-config>)` — identical pattern,
 * varies only by config.
 *
 * Adding a new state? Match the pattern — register both the land-tax
 * and stamp-duty adapters, each with at least one fixture pulling
 * concrete numbers from the state's Duties / Land Tax Act.
 */

import { calcEngineRegistry } from '../registry';

import {
  calculateLandTax,
  VIC_LAND_TAX_FY2024_25,
  QLD_LAND_TAX_CY2025,
  SA_LAND_TAX_FY2024_25,
  WA_LAND_TAX_FY2024_25,
  TAS_LAND_TAX_FY2024_25,
  ACT_LAND_TAX_FY2024_25,
  NT_LAND_TAX_FY2024_25,
  type LandTaxInput,
} from '@/lib/tax-engine/landTax/stateLandTax';
import {
  calculateStampDuty,
  VIC_STAMP_DUTY_FY2024_25,
  QLD_STAMP_DUTY_FY2024_25,
  SA_STAMP_DUTY_FY2024_25,
  WA_STAMP_DUTY_FY2024_25,
  TAS_STAMP_DUTY_FY2024_25,
  ACT_STAMP_DUTY_FY2024_25,
  NT_STAMP_DUTY_FY2024_25,
  type StampDutyInput,
} from '@/lib/tax-engine/stampDuty/stateStampDuty';

// ============================================================
// Land Tax — VIC / QLD / SA / WA / TAS / ACT / NT
// ============================================================

calcEngineRegistry.register({
  name: 'tax.landTax.VIC',
  description: 'VIC land tax — Schedule 1 + s46IB trust + s46IC absentee.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, VIC_LAND_TAX_FY2024_25),
  fixtures: [
    {
      name: 'VIC individual @ $600k',
      description: 'Above $50k threshold; no trust; no absentee surcharge.',
      input: {
        taxableLandValue: 600_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $3,950 ($1,100 + 0.95% × $300k; per Sch 1)',
          check: (r) => Math.abs(r.generalLandTax - 3_950) < 1,
        },
        {
          description: 'No trust surcharge',
          check: (r) => r.trustSurcharge === 0,
        },
      ],
      authoritySource: 'VIC Land Tax Act 2005 Schedule 1.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.landTax.QLD',
  description: 'QLD land tax — Sch 1 (resident scale) + Sch 3 (absentee surcharge).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, QLD_LAND_TAX_CY2025),
  fixtures: [
    {
      name: 'QLD individual @ $1M',
      description: 'Top of bracket 2 ($600k–$1M).',
      input: {
        taxableLandValue: 1_000_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $4,500 ($500 + 1% × $400k; per Sch 1)',
          check: (r) => Math.abs(r.generalLandTax - 4_500) < 1,
        },
      ],
      authoritySource: 'QLD Land Tax Act 2010 Sch 1.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.landTax.SA',
  description: 'SA land tax — s5 general scale + s13 trust.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, SA_LAND_TAX_FY2024_25),
  fixtures: [
    {
      name: 'SA individual @ $1.098M',
      description: 'Top of bracket 2 ($755k–$1.098M).',
      input: {
        taxableLandValue: 1_098_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $1,715 ($0 + 0.5% × $343k; per s5)',
          check: (r) => Math.abs(r.generalLandTax - 1_715) < 1,
        },
        {
          description: 'No foreign land tax surcharge (SA is stamp-duty-only)',
          check: (r) => r.foreignOwnerSurcharge === 0,
        },
      ],
      authoritySource: 'SA Land Tax Act 1936 s5.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.landTax.WA',
  description: 'WA land tax — s5 general scale (no trust + no foreign surcharge).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, WA_LAND_TAX_FY2024_25),
  fixtures: [
    {
      name: 'WA individual @ $420k',
      description: 'Top of bracket 1 ($300k–$420k).',
      input: {
        taxableLandValue: 420_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $600 ($300 + 0.25% × $120k; per s5)',
          check: (r) => Math.abs(r.generalLandTax - 600) < 1,
        },
        {
          description: 'No foreign + no trust surcharge',
          check: (r) => r.foreignOwnerSurcharge === 0 && r.trustSurcharge === 0,
        },
      ],
      authoritySource: 'WA Land Tax Act 2002 s5.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.landTax.TAS',
  description: 'TAS land tax — s11 general scale + foreign surcharge (residential only).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, TAS_LAND_TAX_FY2024_25),
  fixtures: [
    {
      name: 'TAS individual @ $500k residential',
      description: 'Top of bracket 2 ($100k–$500k).',
      input: {
        taxableLandValue: 500_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax = $1,850 ($50 + 0.45% × $400k; per s11)',
          check: (r) => Math.abs(r.generalLandTax - 1_850) < 1,
        },
      ],
      authoritySource: 'TAS Land Tax Act 2000 s11.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.landTax.ACT',
  description: 'ACT — Rates Act 2004 approximation; UC-ACT-RATES-VS-LAND-TAX surfaces structural mismatch with NSW/VIC model.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, ACT_LAND_TAX_FY2024_25),
  fixtures: [
    {
      name: 'ACT individual @ $500k → flat-bracketed approximation > 0',
      description:
        'ACT runs a different model — flat-bracketed approximation; structural disclosure UC always surfaces.',
      input: {
        taxableLandValue: 500_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General land tax > 0',
          check: (r) => r.generalLandTax > 0,
        },
        {
          description: 'UC-ACT-RATES-VS-LAND-TAX surfaced',
          check: (r) =>
            r.uncomputed.some((u) => u.id === 'UC-ACT-RATES-VS-LAND-TAX'),
        },
      ],
      authoritySource: 'ACT Rates Act 2004.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.landTax.NT',
  description:
    'NT — no land tax regime. Structural zero with UC-NT-NO-LAND-TAX flag for cross-state aggregator iteration.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/landTax/stateLandTax.ts',
  execute: (input: LandTaxInput) => calculateLandTax(input, NT_LAND_TAX_FY2024_25),
  fixtures: [
    {
      name: 'NT — any value → $0 + UC-NT-NO-LAND-TAX',
      description: 'NT does not levy land tax.',
      input: {
        taxableLandValue: 5_000_000,
        ownershipType: 'INDIVIDUAL',
        isForeignOwner: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'Total tax = $0',
          check: (r) => r.totalTax === 0,
        },
        {
          description: 'UC-NT-NO-LAND-TAX surfaced',
          check: (r) => r.uncomputed.some((u) => u.id === 'UC-NT-NO-LAND-TAX'),
        },
      ],
      authoritySource: 'NT — no land tax regime (structural zero).',
    },
  ],
});

// ============================================================
// Stamp Duty — VIC / QLD / SA / WA / TAS / ACT / NT
// ============================================================

calcEngineRegistry.register({
  name: 'tax.stampDuty.VIC',
  description: 'VIC stamp duty — Sch 1 + Pt 5 FPAD 8% (raised 2024).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, VIC_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'VIC individual @ $500k',
      description: 'Top of bracket 3 ($130k–$960k).',
      input: {
        dutiableValue: 500_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty = $25,070 ($2,870 + 6% × $370k; per Sch 1)',
          check: (r) => Math.abs(r.generalDuty - 25_070) < 1,
        },
      ],
      authoritySource: 'VIC Duties Act 2000 Sch 1.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.stampDuty.QLD',
  description: 'QLD stamp duty — s24-s26 + Ch 4 AFAD 8%.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, QLD_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'QLD individual @ $540k',
      description: 'Top of bracket 3 ($75k–$540k).',
      input: {
        dutiableValue: 540_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty = $17,325 ($1,050 + 3.5% × $465k; per s24-s26)',
          check: (r) => Math.abs(r.generalDuty - 17_325) < 1,
        },
      ],
      authoritySource: 'QLD Duties Act 2001 s24-s26.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.stampDuty.SA',
  description: 'SA stamp duty — Sch 2 + Pt 4 foreign 7%.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, SA_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'SA individual @ $500k',
      description: 'Top of bracket 8 ($300k–$500k).',
      input: {
        dutiableValue: 500_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty = $21,330 ($11,330 + 5% × $200k; per Sch 2)',
          check: (r) => Math.abs(r.generalDuty - 21_330) < 1,
        },
      ],
      authoritySource: 'SA Stamp Duties Act 1923 Sch 2.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.stampDuty.WA',
  description: 'WA stamp duty — Sch 2 + Ch 3 Pt 5 foreign 7%.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, WA_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'WA individual @ $360k',
      description: 'Top of bracket 3 ($150k–$360k).',
      input: {
        dutiableValue: 360_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty = $11,115 ($3,135 + 3.8% × $210k; per Sch 2)',
          check: (r) => Math.abs(r.generalDuty - 11_115) < 1,
        },
      ],
      authoritySource: 'WA Duties Act 2008 Sch 2.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.stampDuty.TAS',
  description: 'TAS stamp duty — Sch 2 + Ch 4 Pt 6 FBI 8% (raised 2024).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, TAS_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'TAS individual @ $200k',
      description: 'Top of bracket 4 ($75k–$200k).',
      input: {
        dutiableValue: 200_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty = $5,935 ($1,560 + 3.5% × $125k; per Sch 2)',
          check: (r) => Math.abs(r.generalDuty - 5_935) < 1,
        },
      ],
      authoritySource: 'TAS Duties Act 2001 Sch 2.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.stampDuty.ACT',
  description: 'ACT stamp duty — Pt 3 + Pt 5A foreign 0.75% (lowest in AU).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, ACT_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'ACT individual @ $500k → bracket 3',
      description: 'Top of bracket 3 ($300k–$500k).',
      input: {
        dutiableValue: 500_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty > 0 (within bracket 3 of Pt 3)',
          check: (r) => r.generalDuty > 0,
        },
      ],
      authoritySource: 'ACT Duties Act 1999 Pt 3.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'tax.stampDuty.NT',
  description: 'NT stamp duty — Sch 1 (NT is the only AU jurisdiction without a foreign-purchaser surcharge).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/stampDuty/stateStampDuty.ts',
  execute: (input: StampDutyInput) =>
    calculateStampDuty(input, NT_STAMP_DUTY_FY2024_25),
  fixtures: [
    {
      name: 'NT individual @ $500k → simplified bracket 1',
      description: 'Within bracket 1 ($0–$525k) at 3.49% rate.',
      input: {
        dutiableValue: 500_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: false,
        isResidential: true,
      },
      assertions: [
        {
          description: 'General duty > 0 (within bracket 1)',
          check: (r) => r.generalDuty > 0,
        },
      ],
      authoritySource: 'NT Stamp Duty Act 1978 Sch 1.',
    },
    {
      name: 'NT foreign purchaser → no FPAD + UC-STAMP-DUTY-NT-NO-FPAD',
      description: 'NT is the only AU jurisdiction without an FPAD/AFAD/FBI regime.',
      input: {
        dutiableValue: 1_000_000,
        purchaserType: 'INDIVIDUAL',
        isForeignPurchaser: true,
        isResidential: true,
      },
      assertions: [
        {
          description: 'foreignPurchaserSurcharge = $0',
          check: (r) => r.foreignPurchaserSurcharge === 0,
        },
        {
          description: 'UC-STAMP-DUTY-NT-NO-FPAD surfaced',
          check: (r) =>
            r.uncomputed.some((u) => u.id === 'UC-STAMP-DUTY-NT-NO-FPAD'),
        },
      ],
      authoritySource:
        'NT Stamp Duty Act 1978 — no foreign-purchaser surcharge regime.',
    },
  ],
});
