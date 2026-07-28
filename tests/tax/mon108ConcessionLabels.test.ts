/**
 * MON-108 — one producer per string: the engine's `concession` label is
 * clean prose and `citation` is the SOLE citation carrier, so the card's
 * `{concession} ({citation})` renders the provision exactly once (VR-037
 * finding 6: `50% active asset reduction (s152-205) (s152-205)` live).
 *
 * Fixed at the PRODUCER (both twins), never by stripping at the surface —
 * a surface strip would be a second producer of the same string.
 *
 * Coverage (precise): asserts every step label across every branch of both
 * twins. Does NOT verify the card's DOM (Ring-3 owns the rendered row).
 */
import { describe, it, expect } from 'vitest';
import {
  applyDiv152,
  applyDiv152Decimal,
  type Div152Input,
} from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';

const BASE: Div152Input = {
  gainAfterDiv115: 120_000,
  maxNetAssetValue: 4_200_000,
  aggregatedTurnover: 2_500_000,
  isActiveAsset: true,
  monthsHeld: 64,
  isRetirementOrIncapacity: true,
};

// Every branch: full ladder (AAR + retirement + rollover), 15-year
// short-circuit, and basic-conditions-not-met.
const BRANCHES: Array<[string, Div152Input]> = [
  ['full ladder', { ...BASE, electRetirementExemption: true, retirementExemptionUsedToDate: 400_000, electRollover: true }],
  ['15-year short-circuit', { ...BASE, monthsHeld: 190 }],
  ['basic conditions not met', { ...BASE, isActiveAsset: false }],
];

describe('MON-108 · concession labels carry no embedded citation (both twins)', () => {
  it.each(BRANCHES)('%s — no label matches /\\(s\\d/, every citation is a bare provision', (_name, input) => {
    for (const result of [applyDiv152(input), applyDiv152Decimal(input)]) {
      expect(result.steps.length).toBeGreaterThan(0);
      for (const step of result.steps) {
        expect(step.concession).not.toMatch(/\(s\d/);
        expect(step.citation).toMatch(/^s\d{3}-\d+$/);
      }
    }
  });

  it('the rendered row shape `label (citation)` therefore cites exactly once', () => {
    const r = applyDiv152({ ...BASE, electRetirementExemption: true, retirementExemptionUsedToDate: 400_000 });
    for (const step of r.steps) {
      const rendered = `${step.concession} (${step.citation})`;
      const cites = rendered.match(/\(s\d{3}-\d+\)/g) ?? [];
      expect(cites).toHaveLength(1);
    }
  });
});
