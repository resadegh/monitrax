/**
 * Phase 41i — Calc engine registrations: property metrics.
 *
 * Covers `lib/utils/calculations.ts` — the canonical helpers for
 * LVR, equity, and rental yield (per CLAUDE.md §6.2).
 */

import { calcEngineRegistry } from '../registry';

import {
  calculateLVR,
  calculateEquity,
  calculateRentalYield,
} from '@/lib/utils/calculations';

calcEngineRegistry.register({
  name: 'property.LVR',
  description: 'Loan-to-Value Ratio. LVR = loan balance / property value × 100.',
  category: 'PROPERTY',
  sourcePath: 'lib/utils/calculations.ts',
  execute: (input: { loanBalance: number; propertyValue: number }) =>
    calculateLVR(input.loanBalance, input.propertyValue),
  fixtures: [
    {
      name: '$400k loan / $800k property → 50% LVR',
      description: 'Standard 50% LVR scenario.',
      input: { loanBalance: 400_000, propertyValue: 800_000 },
      assertions: [
        {
          description: 'LVR = 50 (50%)',
          check: (r) => Math.abs(r - 50) < 0.001,
        },
      ],
      authoritySource: 'Hand-calculation: $400k / $800k × 100 = 50%.',
    },
    {
      name: 'Zero property value → 0% LVR (defensive)',
      description: 'Edge case: division-by-zero defence.',
      input: { loanBalance: 100_000, propertyValue: 0 },
      assertions: [
        {
          description: 'LVR = 0 (no NaN/Infinity leakage)',
          check: (r) => r === 0,
        },
      ],
      authoritySource: 'Defensive: division-by-zero must not produce NaN/Infinity.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'property.equity',
  description: 'Property equity. Equity = property value − loan balance.',
  category: 'PROPERTY',
  sourcePath: 'lib/utils/calculations.ts',
  execute: (input: { propertyValue: number; loanBalance: number }) =>
    calculateEquity(input.propertyValue, input.loanBalance),
  fixtures: [
    {
      name: '$800k property − $400k loan → $400k equity',
      description: 'Standard equity scenario.',
      input: { propertyValue: 800_000, loanBalance: 400_000 },
      assertions: [
        {
          description: 'Equity = $400,000',
          check: (r) => r === 400_000,
        },
      ],
      authoritySource: 'Hand-calculation: $800k − $400k = $400k.',
    },
  ],
});

calcEngineRegistry.register({
  name: 'property.rentalYield',
  description: 'Rental yield. Yield = annual rent / property value × 100.',
  category: 'PROPERTY',
  sourcePath: 'lib/utils/calculations.ts',
  execute: (input: { annualRent: number; propertyValue: number }) =>
    calculateRentalYield(input.annualRent, input.propertyValue),
  fixtures: [
    {
      name: '$32k rent / $800k property → 4% yield',
      description: 'Standard 4% rental yield.',
      input: { annualRent: 32_000, propertyValue: 800_000 },
      assertions: [
        {
          description: 'Yield = 4 (4%)',
          check: (r) => Math.abs(r - 4) < 0.001,
        },
      ],
      authoritySource: 'Hand-calculation: $32k / $800k × 100 = 4%.',
    },
  ],
});
