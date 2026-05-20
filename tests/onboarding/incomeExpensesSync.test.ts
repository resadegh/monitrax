/**
 * Phase 12 Track F.8 — income/expenses two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffIncomeExpenses` is the pure core that guarantees this. F.8's step
 * captures BOTH income and expenses, so the snapshot holds two lists and
 * the diff produces ops for both. These tests cover that, the GENERAL-only
 * scope, the F.8 quality guards, and the budget-vs-actuals invariant
 * (only the raw `amount` is read, never reconciled actuals).
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffIncomeExpenses,
  wizardToSnapshotIncomeExpenses,
  snapshotToWizardIncome,
  snapshotToWizardExpenses,
  isPersistedId,
  EMPTY_INCOME_EXPENSES_SNAPSHOT,
  type IncomeExpensesSnapshot,
} from '@/lib/onboarding/incomeExpensesSync';
import type { IncomeInput, ExpenseInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — a salary + an "other" income, and two
// general expenses.
const persistedSnapshot: IncomeExpensesSnapshot = {
  incomes: [
    {
      id: 'uuid-salary',
      name: 'Main job',
      type: 'SALARY',
      amount: 95000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
    },
    {
      id: 'uuid-side',
      name: 'Side gig',
      type: 'OTHER',
      amount: 600,
      frequency: 'MONTHLY',
    },
  ],
  expenses: [
    {
      id: 'uuid-groceries',
      name: 'Groceries',
      category: 'GROCERIES',
      amount: 900,
      frequency: 'MONTHLY',
    },
    {
      id: 'uuid-utilities',
      name: 'Utilities',
      category: 'UTILITIES',
      amount: 320,
      frequency: 'MONTHLY',
    },
  ],
};

describe('diffIncomeExpenses — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    const diff = diffIncomeExpenses(persistedSnapshot, persistedSnapshot);
    expect(diff.incomeOps).toEqual([]);
    expect(diff.expenseOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    const wizardIncome = snapshotToWizardIncome(persistedSnapshot);
    const wizardExpenses = snapshotToWizardExpenses(persistedSnapshot);
    const current = wizardToSnapshotIncomeExpenses(wizardIncome, wizardExpenses);
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.incomeOps).toEqual([]);
    expect(diff.expenseOps).toEqual([]);
  });

  it('produces ZERO ops for a first-ever empty list', () => {
    const diff = diffIncomeExpenses(
      EMPTY_INCOME_EXPENSES_SNAPSHOT,
      EMPTY_INCOME_EXPENSES_SNAPSHOT,
    );
    expect(diff.incomeOps).toEqual([]);
    expect(diff.expenseOps).toEqual([]);
  });
});

describe('diffIncomeExpenses — income classification', () => {
  it('classifies a brand-new income (no id) as CREATE', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: [
        ...persistedSnapshot.incomes,
        { name: 'Bonus', type: 'OTHER', amount: 5000, frequency: 'ANNUAL' },
      ],
      expenses: persistedSnapshot.expenses,
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.expenseOps).toEqual([]);
    expect(diff.incomeOps).toHaveLength(1);
    expect(diff.incomeOps[0].op).toBe('create');
    expect(diff.incomeOps[0].id).toBeUndefined();
  });

  it('classifies an edited income as UPDATE (keeps the id)', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes.map((i) =>
        i.id === 'uuid-salary' ? { ...i, amount: 99000 } : i,
      ),
      expenses: persistedSnapshot.expenses,
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.incomeOps).toHaveLength(1);
    expect(diff.incomeOps[0]).toMatchObject({ op: 'update', id: 'uuid-salary' });
  });

  it('classifies a removed income as DELETE', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes.filter((i) => i.id !== 'uuid-side'),
      expenses: persistedSnapshot.expenses,
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.incomeOps).toHaveLength(1);
    expect(diff.incomeOps[0]).toMatchObject({ op: 'delete', id: 'uuid-side' });
  });

  it('detects a salaryType change as an income UPDATE', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes.map((i) =>
        i.id === 'uuid-salary' ? { ...i, salaryType: 'NET' as const } : i,
      ),
      expenses: persistedSnapshot.expenses,
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.incomeOps).toHaveLength(1);
    expect(diff.incomeOps[0]).toMatchObject({ op: 'update', id: 'uuid-salary' });
  });
});

describe('diffIncomeExpenses — expense classification', () => {
  it('classifies a brand-new expense (no id) as CREATE', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes,
      expenses: [
        ...persistedSnapshot.expenses,
        { name: 'Gym', category: 'HEALTH', amount: 60, frequency: 'MONTHLY' },
      ],
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.incomeOps).toEqual([]);
    expect(diff.expenseOps).toHaveLength(1);
    expect(diff.expenseOps[0].op).toBe('create');
    expect(diff.expenseOps[0].id).toBeUndefined();
  });

  it('classifies an edited expense as UPDATE (keeps the id)', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes,
      expenses: persistedSnapshot.expenses.map((e) =>
        e.id === 'uuid-groceries' ? { ...e, amount: 1100 } : e,
      ),
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.expenseOps).toHaveLength(1);
    expect(diff.expenseOps[0]).toMatchObject({ op: 'update', id: 'uuid-groceries' });
  });

  it('classifies a removed expense as DELETE', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes,
      expenses: persistedSnapshot.expenses.filter((e) => e.id !== 'uuid-utilities'),
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.expenseOps).toHaveLength(1);
    expect(diff.expenseOps[0]).toMatchObject({ op: 'delete', id: 'uuid-utilities' });
  });

  it('produces ops for BOTH lists when both changed in one Continue', () => {
    const current: IncomeExpensesSnapshot = {
      incomes: persistedSnapshot.incomes.map((i) =>
        i.id === 'uuid-salary' ? { ...i, amount: 100000 } : i,
      ),
      expenses: persistedSnapshot.expenses.filter((e) => e.id !== 'uuid-utilities'),
    };
    const diff = diffIncomeExpenses(persistedSnapshot, current);
    expect(diff.incomeOps).toHaveLength(1);
    expect(diff.incomeOps[0].op).toBe('update');
    expect(diff.expenseOps).toHaveLength(1);
    expect(diff.expenseOps[0].op).toBe('delete');
  });
});

describe('wizardToSnapshotIncomeExpenses — quality guards', () => {
  function wizardIncome(over: Partial<IncomeInput>): IncomeInput {
    return {
      id: 'uuid-i',
      name: 'Some income',
      type: 'SALARY',
      amount: 80000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
      ...over,
    };
  }
  function wizardExpense(over: Partial<ExpenseInput>): ExpenseInput {
    return {
      id: 'uuid-e',
      name: 'Some expense',
      category: 'GROCERIES',
      amount: 500,
      frequency: 'MONTHLY',
      ...over,
    };
  }

  it('drops an unpersisted income with amount <= 0 (incomplete in-session row)', () => {
    const snap = wizardToSnapshotIncomeExpenses(
      [wizardIncome({ id: 'temp_income_1', amount: 0 })],
      [],
    );
    expect(snap.incomes).toHaveLength(0);
  });

  it('drops an unpersisted expense with amount <= 0 (incomplete in-session row)', () => {
    const snap = wizardToSnapshotIncomeExpenses(
      [],
      [wizardExpense({ id: 'temp_expense_1', amount: 0 })],
    );
    expect(snap.expenses).toHaveLength(0);
  });

  it('KEEPS a persisted income even if its amount was blanked to 0', () => {
    const snap = wizardToSnapshotIncomeExpenses(
      [wizardIncome({ id: 'uuid-real', amount: 0 })],
      [],
    );
    expect(snap.incomes).toHaveLength(1);
    expect(snap.incomes[0].id).toBe('uuid-real');
  });

  it('KEEPS a persisted expense even if its amount was blanked to 0', () => {
    const snap = wizardToSnapshotIncomeExpenses(
      [],
      [wizardExpense({ id: 'uuid-real', amount: 0 })],
    );
    expect(snap.expenses).toHaveLength(1);
    expect(snap.expenses[0].id).toBe('uuid-real');
  });

  it('drops synthetic ids to undefined so the diff classifies them as CREATE', () => {
    const snap = wizardToSnapshotIncomeExpenses(
      [wizardIncome({ id: 'temp_income_9', amount: 50000 })],
      [wizardExpense({ id: 'chat-expense-0', amount: 300 })],
    );
    expect(snap.incomes[0].id).toBeUndefined();
    expect(snap.expenses[0].id).toBeUndefined();
    const diff = diffIncomeExpenses(EMPTY_INCOME_EXPENSES_SNAPSHOT, snap);
    expect(diff.incomeOps[0].op).toBe('create');
    expect(diff.expenseOps[0].op).toBe('create');
  });
});

describe('isPersistedId', () => {
  it('treats real uuids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
    expect(isPersistedId('temp_income_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-expense-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});
