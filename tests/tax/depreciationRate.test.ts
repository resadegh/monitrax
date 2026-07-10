/**
 * MON-003 + MON-026 — depreciation must use the ONE canonical engine, and the
 * schedule rate is a PERCENTAGE, not a decimal (§19.2 worked example + §19.4 lock).
 *
 * WHAT WAS WRONG:
 *   • MON-003 — the property detail page summed a non-existent `annualClaim`
 *     field → Depreciation/yr always $0.
 *   • MON-026 (critical) — the tax engine computed `cost × rate` with NO /100.
 *     `DepreciationSchedule.rate` is stored as a PERCENTAGE (validator max(100),
 *     writer ×100, schema "// 2.5%"), so `cost × 2.5` = 250% of cost — 100× too
 *     high → depreciation deduction 100× inflated → taxable income + tax owed
 *     understated. In BOTH `getUserTaxPosition` (the shared /cashflow + My Guide
 *     source) and `/api/tax/position`.
 *
 * THE FIX: every depreciation figure comes from `calculateDepreciationAnnual`,
 * which does `rate / 100` and the prime-cost / diminishing-value math.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateDepreciationAnnual } from '../../lib/depreciation';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-026: DepreciationSchedule.rate is a PERCENTAGE (not a decimal)', () => {
  it('prime-cost: $100k @ 2.5% → $2,500/yr — NOT $250,000 (the 100× bug)', () => {
    const r = calculateDepreciationAnnual({
      id: 'd1',
      assetName: 'Building',
      category: 'DIV43' as never,
      cost: 100_000,
      startDate: new Date('2024-07-01') as never,
      rate: 2.5, // percentage
      method: 'PRIME_COST' as never,
    });
    expect(r.annualDepreciation).toBe(2_500);
    // The old `cost * rate` (rate-as-decimal assumption) would give 250,000.
    expect(r.annualDepreciation).not.toBe(250_000);
    expect(100_000 * 2.5).toBe(250_000); // demonstrate the old formula's magnitude
  });

  it('diminishing-value: $10k @ 20% DIV40 → first-year ~ $4,000 (2×rate on WDV), not $200,000', () => {
    const r = calculateDepreciationAnnual({
      id: 'd2',
      assetName: 'Carpet',
      category: 'DIV40' as never,
      cost: 10_000,
      startDate: new Date() as never, // ~0 years elapsed → WDV ~ cost
      rate: 20, // percentage
      method: 'DIMINISHING_VALUE' as never,
    });
    // effectiveRate = 20% × 2 = 40%; year-0 WDV ≈ cost → ≈ 4,000. Never 200,000.
    expect(r.annualDepreciation).toBeGreaterThan(3_500);
    expect(r.annualDepreciation).toBeLessThanOrEqual(4_000);
  });
});

describe('MON-003/MON-026: every surface reads the ONE depreciation engine (§19.4 lock)', () => {
  it('the shared tax source uses calculateDepreciationAnnual, not cost×rate', () => {
    const src = read('lib/tax-engine/position/userTaxPosition.ts');
    expect(src).toContain('calculateDepreciationAnnual(');
    expect(src).not.toContain('dep.cost * dep.rate');
  });
  it('/api/tax/position uses the engine (no bare cost×rate)', () => {
    const src = read('app/api/tax/position/route.ts');
    expect(src).toContain('calculateDepreciationAnnual(');
    expect(src).not.toContain('dep.cost * dep.rate');
  });
  it('the property detail page uses the engine, not the phantom annualClaim field', () => {
    const src = read('app/dashboard/properties/[id]/page.tsx');
    expect(src).toContain('calculateDepreciationAnnual(');
    expect(src).not.toContain('annualClaim');
  });
});
