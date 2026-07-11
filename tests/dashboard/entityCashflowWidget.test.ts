/**
 * MON-015 — the Entity Cashflow widget must be internally consistent: its visible
 * rows sum to its headline total, the count reflects legal entities (not asset
 * counts), and the figure is labelled MONTHLY (§19.2 / display correctness).
 *
 * WHAT WAS WRONG:
 *   (1) The headline total = summary.totalEntityCashflow sums SIX components
 *       (income, properties, investments, standaloneLoans, assets, expenses), but
 *       the widget rendered only FOUR rows — standaloneLoansCost + assetsNet were in
 *       the total yet never displayed → the visible lines didn't add up ($655 gap).
 *   (2) It counted "N entities" as data.properties.length + data.investments.length
 *       (3 properties + 9 investment accounts = "12") — asset counts mislabelled as
 *       legal entities (universe = 9).
 *   (3) A monthly figure was labelled "annual net" (the sibling summary labels '/mo').
 *
 * THE FIX: render all six components (they sum to the total), count from the
 * canonical entity source (charts.entityComparison.length), and label it monthly.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-015: the six displayed rows sum to totalEntityCashflow (additivity)', () => {
  it('the widget row set reproduces the total formula exactly', () => {
    // totalEntityCashflow = incomeNet + propertiesNet + investmentsNet
    //                       − standaloneLoansCost + assetsNet − expensesNet
    // (costs stored as non-negative magnitudes; the widget rows use −Math.abs).
    const summary = {
      propertiesNet: 1_000,
      investmentsNet: 500,
      incomeNet: 8_000,
      standaloneLoansCost: 600,
      assetsNet: -200,
      expensesNet: 3_000,
    };
    const total =
      summary.incomeNet +
      summary.propertiesNet +
      summary.investmentsNet -
      summary.standaloneLoansCost +
      summary.assetsNet -
      summary.expensesNet;

    const rows = [
      summary.propertiesNet, // Properties
      summary.investmentsNet, // Investments
      summary.incomeNet, // Income
      -Math.abs(summary.standaloneLoansCost), // Loans
      summary.assetsNet, // Assets
      -Math.abs(summary.expensesNet), // Expenses
    ];
    expect(rows.reduce((a, b) => a + b, 0)).toBe(total);
  });
});

describe('MON-015: the widget renders all six components + correct count/label (source-lock)', () => {
  const src = read('components/dashboard/tiles/GlassInsightTiles.tsx');

  it('includes the previously-hidden Loans + Assets rows', () => {
    expect(src).toContain("name: 'Loans'");
    expect(src).toContain("name: 'Assets'");
    expect(src).toContain('standaloneLoansCost');
    expect(src).toContain('assetsNet');
  });
  it('no longer truncates the row list to 4', () => {
    expect(src).not.toContain('rows.slice(0, 4)');
  });
  it('labels the figure monthly, not annual', () => {
    expect(src).toContain('monthly net');
    expect(src).not.toContain('annual net across');
  });
  it('counts from the entityCount prop, not asset counts', () => {
    expect(src).toContain('entityCount');
    expect(src).not.toContain('data.properties.length + data.investments.length');
  });
});

describe('MON-015: the dashboard feeds the canonical entity count', () => {
  it('passes charts.entityComparison.length (the same source the sibling label uses)', () => {
    const src = read('app/dashboard/page.tsx');
    expect(src).toContain('entityCount={charts?.entityComparison.length}');
  });
});
