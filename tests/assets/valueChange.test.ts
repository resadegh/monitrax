/**
 * MON-041 — an appreciating asset (currentValue ≥ purchasePrice) was rendered
 * as a NEGATIVE depreciation ("-200.0%", "-66.7%") on the Assets page dialogs,
 * because they printed the raw signed `depreciationPercent`. The canonical
 * presentation shows the MAGNITUDE and lets the direction (label/colour/icon)
 * carry the sign.
 *
 * `depreciation = purchasePrice − currentValue` → POSITIVE = lost value,
 * NEGATIVE = gained value. This locks the ONE presentation rule
 * (lib/assets/valueChange) all asset surfaces now share.
 */
import { describe, it, expect } from 'vitest';
import { assetValueDirection, assetValueChangeMagnitudePercent } from '../../lib/assets/valueChange';

describe('MON-041 · asset value-change presentation is single-source and never negative', () => {
  it('a depreciating asset (purchase > current) → direction "depreciation"', () => {
    // 300Z bought 40k, now 20k → depreciation +20k, +50%.
    expect(assetValueDirection(20_000)).toBe('depreciation');
  });

  it('an appreciating asset (current > purchase) → direction "appreciation" (was mislabelled)', () => {
    // 300Z bought 20k, now 60k → depreciation −40k, −200%.
    expect(assetValueDirection(-40_000)).toBe('appreciation');
  });

  it('no value change → "unchanged"', () => {
    expect(assetValueDirection(0)).toBe('unchanged');
  });

  it('the DISPLAY percent is always non-negative — an appreciating asset never reads "-200%"', () => {
    expect(assetValueChangeMagnitudePercent(-200)).toBe(200); // the MON-041 case
    expect(assetValueChangeMagnitudePercent(-66.7)).toBeCloseTo(66.7, 1);
    expect(assetValueChangeMagnitudePercent(50)).toBe(50);
    expect(assetValueChangeMagnitudePercent(0)).toBe(0);
  });

  it('the magnitude is sign-agnostic (same reading for equal-and-opposite change)', () => {
    expect(assetValueChangeMagnitudePercent(-33.3)).toBe(assetValueChangeMagnitudePercent(33.3));
  });
});
