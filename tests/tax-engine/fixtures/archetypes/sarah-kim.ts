/**
 * Sarah Kim archetype — sole-trader IT consultant.
 *
 * Smallest realistic structure: PERSONAL_NAME + COMPANY (Sarah Kim Pty Ltd).
 * Tests SOLE_TRADER income (flowing through to her individual return),
 * Div 7A risk on director loans (when 41e.6 lands), and base-rate company
 * tax dispatch (when 41e.0 + 41e.17 land).
 *
 * v1 fixture: salary income (paid through her own Pty Ltd) + a few
 * deductible business expenses + modest concessional super. Numbers
 * sit in the 30% marginal bracket so LITO has phased out and the user
 * gets a clean PAYG-vs-tax-payable comparison.
 */

import type { ArchetypeFixture } from './types';

export const sarahKim: ArchetypeFixture = {
  id: 'sarah-kim',
  name: 'Sarah Kim',
  persona: 'Sole-trader IT consultant via Pty Ltd',
  financialYear: '2024-25',
  taxInputs: {
    incomes: [
      {
        id: 'sarah-income-salary',
        name: 'Sarah Kim Pty Ltd — director salary',
        type: 'SALARY',
        amount: 9500, // monthly net-equivalent (gross provided below)
        frequency: 'MONTHLY',
        grossAmount: 130000, // annual gross — overrides amount × frequency
        paygWithholding: 31288, // ATO Schedule 1 Scale 2 estimate FY24-25
      },
    ],
    expenses: [
      {
        id: 'sarah-expense-software',
        name: 'Software subscriptions',
        category: 'work-related',
        amount: 250,
        frequency: 'MONTHLY',
        isTaxDeductible: true,
      },
      {
        id: 'sarah-expense-internet',
        name: 'Home office internet (50% business)',
        category: 'work-related',
        amount: 60,
        frequency: 'MONTHLY',
        isTaxDeductible: true,
      },
      {
        id: 'sarah-expense-rent',
        name: 'Apartment rent',
        category: 'living',
        amount: 2400,
        frequency: 'MONTHLY',
        isTaxDeductible: false, // private; not deductible
      },
    ],
    depreciations: [],
    superContributions: {
      concessional: 14950, // 11.5% SG on $130k
      nonConcessional: 0,
    },
  },
};
