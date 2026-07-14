/**
 * MON-035 (DECISION 2) — the ONE canonical property-actuals window.
 *
 * The bug: `computePropertyCashflow` is one engine, but three surfaces fed it
 * three different transaction WINDOWS — all-time (detail + list via
 * `enrichPropertiesWithActuals`) vs last-12-months (Home tile + master snapshot).
 * Same engine, different inputs → the same property's Cashflow/yr + yield
 * differed across screens (the MON-028 lesson, at the fetch layer).
 *
 * The fix: one window source (`propertyActualsWindow.ts`) referenced by ALL
 * three fetch sites. These are the Ring-0 unit lock + the Ring-1 source-lock:
 *   1. the window is a trailing 12 months (deterministic with an injected now);
 *   2. every fetch site imports the ONE window helper, and NO inline
 *      "setMonth(... - 12)" remains — so a surface can't silently re-diverge
 *      (the F1/F2 partial-fix guard).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PROPERTY_ACTUALS_WINDOW_MONTHS,
  propertyActualsWindowStart,
} from '../../lib/calculations/propertyActualsWindow';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('MON-035 · the window is a trailing 12 months (one source)', () => {
  it('PROPERTY_ACTUALS_WINDOW_MONTHS is 12', () => {
    expect(PROPERTY_ACTUALS_WINDOW_MONTHS).toBe(12);
  });

  it('propertyActualsWindowStart(now) is exactly 12 months before now', () => {
    const now = new Date('2026-07-14T00:00:00Z');
    const start = propertyActualsWindowStart(now);
    const expected = new Date('2025-07-14T00:00:00Z');
    expect(start.getFullYear()).toBe(expected.getFullYear());
    expect(start.getMonth()).toBe(expected.getMonth());
    expect(start.getDate()).toBe(expected.getDate());
  });

  it('does not mutate the passed-in now', () => {
    const now = new Date('2026-07-14T00:00:00Z');
    propertyActualsWindowStart(now);
    expect(now.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });
});

describe('MON-035 · §19.4 source-lock — all three fetch sites use the ONE window', () => {
  const FETCH_SITES = [
    'lib/services/propertyActuals.ts', // detail + list (was all-time — the bug)
    'lib/services/masterFinancialService.ts', // master snapshot / buildPropertyMetrics
    'app/api/portfolio/snapshot/route.ts', // Home dashboard tile
  ];

  it('every fetch site imports + calls the canonical window helper', () => {
    for (const p of FETCH_SITES) {
      const src = read(p);
      expect(src, `${p} imports the window helper`).toMatch(/propertyActualsWindow/);
      expect(src, `${p} calls propertyActualsWindowStart`).toMatch(/propertyActualsWindowStart\(\)/);
    }
  });

  it('NO inline "setMonth(... - 12)" window remains in any fetch site (culprit removed)', () => {
    for (const p of FETCH_SITES) {
      const src = read(p);
      expect(src, `${p} must not re-derive the window inline`).not.toMatch(/setMonth\([^)]*-\s*12\s*\)/);
    }
  });
});
