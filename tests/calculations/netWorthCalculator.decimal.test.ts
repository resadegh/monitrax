/**
 * Q-DEC PR 2.A — netWorthCalculator shadow comparison.
 *
 * Proves the Float and Decimal paths agree to within currency
 * tolerance on every fixture in the proof engine. This is the
 * "real" end-to-end test of the PR 2.A scope.
 *
 * Per Phase 41I HR-3 contract — the fixtures are hand-chosen real
 * scenarios; the assertion check is "Float and Decimal paths agree."
 * The Float path's own correctness is asserted by the existing
 * `calcAudit` fixture (`core.netWorth`).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  calculateNetWorthDecimal,
  calculateTotalAssetsDecimal,
} from '@/lib/calculations/netWorthCalculator';
import { netWorthShadowEngine } from '@/lib/calc-audit/engines/decimal-netWorth';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';

describe('netWorthCalculator — Float vs Decimal shadow comparison', () => {
  it.each(netWorthShadowEngine.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within currency tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(netWorthShadowEngine, fixture);
      if (result.status !== 'PASS') {
        // Surface the failing fields' diffs so the test output points
        // at the exact drift, not just "DIFF".
        const detail = result.failedFields
          .map((f) => `${f}: |Δ|=${result.diffs[f]?.absDiff.toString() ?? 'n/a'}`)
          .join('; ');
        throw new Error(
          `Shadow comparison ${result.status} on ${fixture.name}: ${detail || result.errorMessage}`,
        );
      }
      expect(result.status).toBe('PASS');
    },
  );

  it('Decimal path stays EXACT on the IEEE-754 trap fixture', () => {
    // 100 × $0.10 — Float drifts to a sub-cent error; Decimal stays
    // at 10.00 exactly. The shadow test above proves they round to
    // the same cent; THIS test proves the Decimal answer is the right
    // one.
    const accounts = Array.from({ length: 100 }, () => ({ currentBalance: 0.1, type: 'SAVINGS' }));
    const decimalResult = calculateNetWorthDecimal([], accounts, [], [], [], []);
    expect(decimalResult.netWorth.toString()).toBe('10');
    expect(decimalResult.assets.accounts.toString()).toBe('10');

    // And confirm Float really does drift (so we understand the threat).
    const floatResult = calculateNetWorth([], accounts, [], [], [], []);
    expect(floatResult.netWorth).not.toBe(10);
    expect(floatResult.netWorth).toBeCloseTo(10, 5);
  });

  it('Phase 39.5 SMSF exclusion holds on the Decimal path', () => {
    const result = calculateNetWorthDecimal(
      [],
      [],
      [],
      [],
      [
        { balance: 100000, fundType: 'INDUSTRY' },
        { balance: 999999, fundType: 'SMSF' }, // excluded
        { balance: 50000, fundType: 'RETAIL' },
      ],
      [],
    );
    // Only INDUSTRY + RETAIL counted.
    expect(result.assets.superannuation.equals(new Decimal('150000'))).toBe(true);
  });

  it('Phase 41e.0 ownerEntityId filter holds on the Decimal path', () => {
    // calculateNetWorthDecimal doesn't expose the filter directly (matches
    // the Float-side `calculateNetWorth` API). The lower-level
    // calculateTotalAssetsDecimal does — exercise it.
    const assets = calculateTotalAssetsDecimal(
      [
        { currentValue: 100000, type: 'HOME', ownerEntityId: 'entity-A' },
        { currentValue: 200000, type: 'INVESTMENT', ownerEntityId: 'entity-B' },
        { currentValue: 50000, type: 'HOME', ownerEntityId: null },
      ],
      [],
      [],
      [],
      [],
      'entity-A',
    );
    expect(assets.properties.equals(new Decimal('100000'))).toBe(true);
  });
});

describe('netWorthCalculator — full shadow report', () => {
  it('every fixture across the engine PASSes', async () => {
    const report = await runShadowComparisonReport([netWorthShadowEngine]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map((r) => `${r.fixtureName}: ${r.failedFields.join(', ')}`)
        .join('\n');
      throw new Error(`Shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
