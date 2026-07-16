/**
 * Phase 59 — Calc engine registrations: managed-rental reconciliation.
 *
 * Covers `lib/calculations/rentalReconciliation.ts` — the ONE canonical
 * producer of the agent-cost gap (PHASE_59_MANAGED_RENTAL_INCOME.md §4/§7 R0).
 * Fixtures lock: gap = cadence-normalised gross − net; Float === Decimal
 * parity; materiality + anomaly semantics.
 */

import { calcEngineRegistry } from '../registry';

import {
  reconcileManagedRental,
  reconcileManagedRentalDecimal,
} from '@/lib/calculations/rentalReconciliation';

/** The spec §3 canonical example — shared by the parity fixture's closure. */
const CANONICAL_INPUT = {
  declaredGrossAmount: 650,
  declaredGrossFrequency: 'WEEKLY',
  netDisbursementAmount: 1100,
  disbursementFrequency: 'FORTNIGHTLY',
} as const;

calcEngineRegistry.register({
  name: 'property.managedRentalGap',
  description:
    'Managed-rental agent-cost gap. gap = declared gross normalised to the disbursement cadence − net disbursement; the deductible agent cost per period.',
  category: 'PROPERTY',
  sourcePath: 'lib/calculations/rentalReconciliation.ts',
  execute: (input: {
    declaredGrossAmount: number;
    declaredGrossFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'HALF_YEARLY';
    netDisbursementAmount: number;
    disbursementFrequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'HALF_YEARLY';
    rule?: { baselineGapAmount: number; tolerancePct: number };
  }) => reconcileManagedRental(input),
  fixtures: [
    {
      name: '$650/wk gross, $1,100/ft net → $200/ft gap ($5,200/yr)',
      description: 'The spec §3 canonical example — weekly rent, fortnightly disbursement.',
      input: {
        declaredGrossAmount: 650,
        declaredGrossFrequency: 'WEEKLY',
        netDisbursementAmount: 1100,
        disbursementFrequency: 'FORTNIGHTLY',
      },
      assertions: [
        {
          description: 'gross per fortnight = 650 × 52 ÷ 26 = 1,300',
          check: (r) => Math.abs(r.grossPerDisbursementPeriod - 1300) < 1e-9,
        },
        {
          description: 'gap = 1,300 − 1,100 = 200',
          check: (r) => Math.abs(r.gap - 200) < 1e-9,
        },
        {
          description: 'annual deduction = 200 × 26 = 5,200',
          check: (r) => Math.abs(r.gapAnnual - 5200) < 1e-9,
        },
        {
          description: 'material (200 ≥ $5 and 200/1300 ≥ 1%)',
          check: (r) => r.material === true,
        },
      ],
      authoritySource:
        'Hand-calculation: 650 × 52 = 33,800/yr ÷ 26 = 1,300/ft; 1,300 − 1,100 = 200; 200 × 26 = 5,200. ATO: gross rent assessable (ITAA 1997 s6-5), agent costs deductible (s8-1).',
    },
    {
      name: 'Float === Decimal parity on the canonical example',
      description: 'The two engine paths must never disagree (§12.2.1).',
      input: CANONICAL_INPUT,
      assertions: [
        {
          description: 'Decimal gap/gapAnnual/material match Float exactly',
          check: (r) => {
            const d = reconcileManagedRentalDecimal(CANONICAL_INPUT);
            return (
              Math.abs(Number(d.gap.toString()) - r.gap) < 1e-9 &&
              Math.abs(Number(d.gapAnnual.toString()) - r.gapAnnual) < 1e-9 &&
              d.material === r.material
            );
          },
        },
      ],
      authoritySource: 'Q-DEC Float/Decimal shadow discipline — identical semantics on both paths.',
    },
    {
      name: 'Net equals normalised gross → zero gap, not material',
      description: 'A direct-equivalent disbursement must not fire the card.',
      input: {
        declaredGrossAmount: 650,
        declaredGrossFrequency: 'WEEKLY',
        netDisbursementAmount: 1300,
        disbursementFrequency: 'FORTNIGHTLY',
      },
      assertions: [
        { description: 'gap = 0', check: (r) => Math.abs(r.gap) < 1e-9 },
        { description: 'not material', check: (r) => r.material === false },
      ],
      authoritySource: 'Hand-calculation: 1,300 − 1,300 = 0.',
    },
    {
      name: 'Anomaly: $450 gap vs $200 baseline (tol 20%) → re-confirm, excess $250',
      description: 'The learn-once rule + anomaly re-confirm semantics (likely a repair).',
      input: {
        declaredGrossAmount: 650,
        declaredGrossFrequency: 'WEEKLY',
        netDisbursementAmount: 850,
        disbursementFrequency: 'FORTNIGHTLY',
        rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
      },
      assertions: [
        { description: 'gap = 1,300 − 850 = 450', check: (r) => Math.abs(r.gap - 450) < 1e-9 },
        { description: 'anomaly fires (|450−200| = 250 > 20% × 200 = 40)', check: (r) => r.anomaly === true },
        { description: 'anomalyExcess = 250', check: (r) => Math.abs(r.anomalyExcess - 250) < 1e-9 },
      ],
      authoritySource: 'Hand-calculation per spec §3 learn-once/anomaly semantics.',
    },
    {
      name: 'Within tolerance: $210 gap vs $200 baseline (tol 20%) → silent',
      description: 'In-tolerance gaps auto-derive silently — no re-confirm.',
      input: {
        declaredGrossAmount: 650,
        declaredGrossFrequency: 'WEEKLY',
        netDisbursementAmount: 1090,
        disbursementFrequency: 'FORTNIGHTLY',
        rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
      },
      assertions: [
        { description: 'gap = 210', check: (r) => Math.abs(r.gap - 210) < 1e-9 },
        { description: 'no anomaly (|210−200| = 10 ≤ 40)', check: (r) => r.anomaly === false },
      ],
      authoritySource: 'Hand-calculation per spec §3 learn-once/anomaly semantics.',
    },
  ],
});
