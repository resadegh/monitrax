/**
 * David + Emma Mitchell archetype — family with trust + SMSF.
 *
 * The most common HNW structure encountered in the AU adviser market:
 *   - PERSONAL_NAME × 2 (David, Emma)
 *   - COMPANY (Mitchell Holdings Pty Ltd as trustee — non-operating)
 *   - DISCRETIONARY_TRUST (Mitchell Family Trust)
 *   - SMSF (Mitchell Super Fund) with COMPANY corporate trustee
 *
 * Tests:
 *   - Trust streaming (Div 6/6E — when 41e.4 lands)
 *   - Corporate trustee `parentEntityId` walking (when 41e.0 lands)
 *   - SMSF contribution caps + Div 293 + Div 296 (when 41e.2/3 land)
 *   - Household roll-up across two adults (when 41e.17 lands)
 *
 * v1 fixture: David salary $180k + Emma part-time salary $48k. One
 * investment property held by the trust producing rental income +
 * deductible interest + property expenses. Modest dividend income from
 * a fully-franked AU equity holding inside Emma's name. SMSF concessional
 * contributions at the cap. Numbers chosen to put David in the 37%
 * bracket (Div 293 watch) and Emma below the LITO cutoff.
 */

import type { ArchetypeFixture } from './types';

export const davidEmma: ArchetypeFixture = {
  id: 'david-emma',
  name: 'David + Emma Mitchell',
  persona: 'Family with discretionary trust + corporate trustee SMSF',
  financialYear: '2024-25',
  taxInputs: {
    incomes: [
      {
        id: 'david-income-salary',
        name: 'David — engineering manager salary',
        type: 'SALARY',
        amount: 15000,
        frequency: 'MONTHLY',
        grossAmount: 180000,
        paygWithholding: 51288,
      },
      {
        id: 'emma-income-salary',
        name: 'Emma — part-time consulting salary',
        type: 'SALARY',
        amount: 4000,
        frequency: 'MONTHLY',
        grossAmount: 48000,
        paygWithholding: 5538,
      },
      {
        id: 'family-trust-rental',
        name: 'Mitchell Family Trust — rental income',
        type: 'RENTAL',
        amount: 580,
        frequency: 'WEEKLY',
        propertyId: 'family-trust-property-1',
      },
      {
        id: 'emma-dividends',
        name: 'AU equity dividends (fully franked)',
        type: 'DIVIDEND',
        amount: 4200,
        frequency: 'ANNUALLY',
        frankingPercentage: 100,
      },
    ],
    expenses: [
      {
        id: 'family-trust-interest',
        name: 'Investment loan interest',
        category: 'property',
        amount: 1850,
        frequency: 'MONTHLY',
        isTaxDeductible: true,
        propertyId: 'family-trust-property-1',
      },
      {
        id: 'family-trust-rates',
        name: 'Council rates',
        category: 'property',
        amount: 2400,
        frequency: 'ANNUALLY',
        isTaxDeductible: true,
        propertyId: 'family-trust-property-1',
      },
      {
        id: 'family-trust-insurance',
        name: 'Landlord insurance',
        category: 'property',
        amount: 1200,
        frequency: 'ANNUALLY',
        isTaxDeductible: true,
        propertyId: 'family-trust-property-1',
      },
      {
        id: 'mitchell-living',
        name: 'Mortgage on PPOR',
        category: 'living',
        amount: 3200,
        frequency: 'MONTHLY',
        isTaxDeductible: false,
      },
    ],
    depreciations: [],
    superContributions: {
      concessional: 30000, // at the cap (split David $20k SG+sacrifice / Emma $5520 SG)
      nonConcessional: 0,
    },
  },
};
