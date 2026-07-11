/**
 * MON-005 (show a property's expenses on the property) + MON-008 (enter them
 * inline, actuals-first) — source guards.
 *
 * changesNumbers=false: this is a display + data-entry affordance. These guards
 * lock the SSOT wiring so a future edit can't reintroduce a second producer or a
 * duplicate expense form.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-005: PropertyExpensesCard reads the canonical engine (one source)', () => {
  const src = read('components/properties/PropertyExpensesCard.tsx');

  it('header total + rows come from computePropertyCashflow (SSOT §12.2.1)', () => {
    expect(src).toContain('computePropertyCashflow');
    expect(src).toContain('cf.annualExpenses');
    expect(src).toContain('cf.expenseLines');
  });

  it('renders both Actual and Estimate status (actuals-first §19.1)', () => {
    expect(src).toContain('Actual');
    expect(src).toContain('Estimate');
  });
});

describe('MON-008: add/edit/delete reuse the canonical path (no second form)', () => {
  const src = read('components/properties/PropertyExpensesCard.tsx');

  it('reuses the canonical ExpenseDialog rather than an inline form', () => {
    expect(src).toContain('ExpenseDialog');
  });

  it('delete calls the canonical DELETE /api/expenses/[id] endpoint', () => {
    expect(src).toContain("method: 'DELETE'");
    expect(src).toContain('/api/expenses/');
  });

  it('has a celebratory, form-led empty state (§0 psychology)', () => {
    expect(src).toContain('Add your first expense');
    expect(src).toContain('No expenses tracked for this property yet');
  });
});

describe('MON-005: the detail page shows the card and drops the duplicate summary row (§6.7)', () => {
  const page = read('app/dashboard/properties/[id]/page.tsx');

  it('renders PropertyExpensesCard', () => {
    expect(page).toContain('PropertyExpensesCard');
  });

  it('no longer pushes the old read-only expense summary row into LinkedEntitiesCard', () => {
    expect(page).not.toContain("id: 'exp-summary'");
  });
});
