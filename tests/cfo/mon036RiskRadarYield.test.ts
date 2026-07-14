/**
 * MON-036 — the CFO Risk Radar's rental yield.
 *
 * The bug: `detectPropertyUnderperformanceRisks` computed
 * `grossYield = annualIncome / property.currentValue` from DECLARED income,
 * bypassing the ONE cashflow engine AND `calculateRentalYield` — a 4th,
 * independent yield producer. On real data it showed 1.05% while the property
 * detail page / list / Home tile (which read the actuals-based engine) showed
 * a far lower figure. (The MON-035 window fix converged those three; this
 * removes the last rogue producer.)
 *
 * The fix: riskRadar enriches properties over the ONE canonical 12-month window
 * (`enrichPropertiesWithActuals`) and takes yield from `computePropertyCashflow`
 * + `calculateRentalYield` — the SAME source as every other surface. This is the
 * Ring-1 source-lock (the F1/F2 "no rogue producer" guard); value convergence
 * then holds by construction (one engine, one window) and is checked on live
 * data by the Ring-3 Chrome sweep.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(resolve(__dirname, '../../lib/cfo/riskRadar.ts'), 'utf8');

describe('MON-036 · Risk Radar yield reads the canonical engine, not declared income', () => {
  it('imports the canonical cashflow engine + rental-yield helper + the enricher', () => {
    expect(SRC).toMatch(/import \{ computePropertyCashflow \} from '@\/lib\/calculations\/propertyCashflow'/);
    expect(SRC).toMatch(/import \{ calculateRentalYield \} from '@\/lib\/utils\/calculations'/);
    expect(SRC).toMatch(/enrichPropertiesWithActuals/);
  });

  it('computes property yield via calculateRentalYield(cf.annualRent, ...) — one source', () => {
    expect(SRC).toMatch(/calculateRentalYield\(cf\.annualRent, property\.currentValue\)/);
  });

  it('NO declared-income yield producer remains (annualIncome / currentValue removed)', () => {
    expect(SRC).not.toMatch(/annualIncome\s*\/\s*property\.currentValue/);
  });

  it('the underperformance scan runs on the ENRICHED (windowed-actuals) properties', () => {
    expect(SRC).toMatch(/detectPropertyUnderperformanceRisks\(enrichedProperties\)/);
  });
});
