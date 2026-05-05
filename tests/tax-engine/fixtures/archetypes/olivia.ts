/**
 * Olivia Novak archetype — multi-entity HNW.
 *
 * Stress-test fixture. Structure:
 *   - PERSONAL_NAME (Olivia)
 *   - 4× properties (mix of personal-name PPOR + 3× trust-held investment)
 *   - DISCRETIONARY_TRUST (Novak Family Trust)
 *   - UNIT_TRUST (Novak Investment Unit Trust — held proportionally)
 *   - COMPANY (Novak Investments Pty Ltd)
 *   - SMSF (Novak Super Fund) with corporate trustee
 *
 * Tests:
 *   - Trust-to-trust chain streaming + character preservation (when 41e.4 + 41e.10 land)
 *   - FTE/IEE family-group walking (when 41e.10 lands)
 *   - SMSF unit-trust holding — NALI risk (when 41e.11 lands)
 *   - State land tax aggregation across 4 properties (when 41e.12-13 land)
 *   - PSI through Pty Ltd (when 41e.9 lands)
 *   - High-bracket marginal rate (45%+) — Div 293 + Div 296 dispatch
 *
 * v1 fixture: high salary + multiple rental income streams + significant
 * dividends (mixed franking) + interest from cash holdings. SMSF
 * concessional contributions at the cap. Numbers chosen to land Olivia
 * comfortably in the 45% bracket and inside Div 293 territory.
 */

import type { ArchetypeFixture } from './types';

export const olivia: ArchetypeFixture = {
  id: 'olivia',
  name: 'Olivia Novak',
  persona: 'Multi-entity HNW with 4 properties + trust + unit trust + Pty Ltd + SMSF',
  financialYear: '2024-25',
  taxInputs: {
    incomes: [
      {
        id: 'olivia-salary-pty',
        name: 'Novak Investments Pty Ltd — director salary',
        type: 'SALARY',
        amount: 25000,
        frequency: 'MONTHLY',
        grossAmount: 300000,
        paygWithholding: 100000,
      },
      {
        id: 'olivia-rental-1',
        name: 'Family Trust property 1 — Sydney apartment',
        type: 'RENTAL',
        amount: 720,
        frequency: 'WEEKLY',
        propertyId: 'olivia-property-1',
      },
      {
        id: 'olivia-rental-2',
        name: 'Family Trust property 2 — Melbourne townhouse',
        type: 'RENTAL',
        amount: 650,
        frequency: 'WEEKLY',
        propertyId: 'olivia-property-2',
      },
      {
        id: 'olivia-rental-3',
        name: 'Unit Trust property — Brisbane house',
        type: 'RENTAL',
        amount: 580,
        frequency: 'WEEKLY',
        propertyId: 'olivia-property-3',
      },
      {
        id: 'olivia-dividends-franked',
        name: 'AU equities (fully franked)',
        type: 'DIVIDEND',
        amount: 18000,
        frequency: 'ANNUALLY',
        frankingPercentage: 100,
      },
      {
        id: 'olivia-dividends-unfranked',
        name: 'International equities (unfranked)',
        type: 'DIVIDEND',
        amount: 9500,
        frequency: 'ANNUALLY',
        frankingPercentage: 0,
      },
      {
        id: 'olivia-interest',
        name: 'Cash management account interest',
        type: 'INTEREST',
        amount: 6800,
        frequency: 'ANNUALLY',
      },
    ],
    expenses: [
      // Property 1 (Sydney)
      {
        id: 'olivia-property-1-interest',
        name: 'Investment loan interest — Sydney',
        category: 'property',
        amount: 2300,
        frequency: 'MONTHLY',
        isTaxDeductible: true,
        propertyId: 'olivia-property-1',
      },
      {
        id: 'olivia-property-1-rates',
        name: 'Sydney council rates + strata',
        category: 'property',
        amount: 6800,
        frequency: 'ANNUALLY',
        isTaxDeductible: true,
        propertyId: 'olivia-property-1',
      },
      // Property 2 (Melbourne)
      {
        id: 'olivia-property-2-interest',
        name: 'Investment loan interest — Melbourne',
        category: 'property',
        amount: 2100,
        frequency: 'MONTHLY',
        isTaxDeductible: true,
        propertyId: 'olivia-property-2',
      },
      {
        id: 'olivia-property-2-rates',
        name: 'Melbourne council rates',
        category: 'property',
        amount: 3200,
        frequency: 'ANNUALLY',
        isTaxDeductible: true,
        propertyId: 'olivia-property-2',
      },
      // Property 3 (Brisbane)
      {
        id: 'olivia-property-3-interest',
        name: 'Investment loan interest — Brisbane',
        category: 'property',
        amount: 1750,
        frequency: 'MONTHLY',
        isTaxDeductible: true,
        propertyId: 'olivia-property-3',
      },
      {
        id: 'olivia-property-3-rates',
        name: 'Brisbane council rates',
        category: 'property',
        amount: 2800,
        frequency: 'ANNUALLY',
        isTaxDeductible: true,
        propertyId: 'olivia-property-3',
      },
    ],
    depreciations: [],
    superContributions: {
      concessional: 30000,
      nonConcessional: 110000, // bring-forward partial
    },
  },
};
