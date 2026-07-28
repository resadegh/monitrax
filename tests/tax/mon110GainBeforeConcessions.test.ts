/**
 * MON-110 — the engine STATES `gainBeforeConcessions`; the surface renders
 * it and performs no arithmetic on engine result fields (VR-037 finding 7:
 * the card reconstructed the pre-concession gain from
 * `steps[0].runningGain + steps[0].reduction` — arithmetically right on
 * every checked branch, and still a Calc-SSOT wall breach that breaks
 * silently the moment step ordering changes).
 *
 * Three locks:
 *  1. THE FIELD — both twins return `gainBeforeConcessions` on every
 *     branch, equal to the clamped input gain; Float ≡ Decimal.
 *  2. NO SURFACE RECONSTRUCTION — the card renders the stated field; the
 *     `steps[0]` arithmetic is gone.
 *  3. NO-SURFACE-ARITHMETIC AUDIT (tightened, now automated) — no file in
 *     `components/tax/**` applies an arithmetic operator to an engine
 *     result field. This is the "cards do no tax arithmetic" guard VR-037
 *     Part D ran by hand, promoted into CI.
 *
 * Coverage (precise): verifies the engine field, parity, and the source
 * scan. Does NOT verify the rendered value on screen (Ring-3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

const BRANCHES: Array<[string, Div152Input, number]> = [
  ['full ladder', { ...BASE, electRetirementExemption: true, retirementExemptionUsedToDate: 400_000, electRollover: true }, 120_000],
  ['15-year short-circuit', { ...BASE, monthsHeld: 190 }, 120_000],
  ['basic conditions not met', { ...BASE, isActiveAsset: false }, 120_000],
  ['zero gain', { ...BASE, gainAfterDiv115: 0 }, 0],
];

describe('MON-110 · gainBeforeConcessions is stated by the engine, both twins', () => {
  it.each(BRANCHES)('%s → gainBeforeConcessions = %i on Float AND Decimal (parity)', (_n, input, expected) => {
    const f = applyDiv152(input);
    const d = applyDiv152Decimal(input);
    expect(f.gainBeforeConcessions).toBe(expected);
    expect(d.gainBeforeConcessions.toNumber()).toBe(expected);
    // The old reconstruction identity still holds — proving the stated
    // field replaces it losslessly on ladder branches.
    if (f.steps.length > 0 && f.basicConditionsMet) {
      expect(f.steps[0].runningGain + f.steps[0].reduction).toBe(f.gainBeforeConcessions);
    }
  });
});

describe('MON-110 · the surface renders, never derives', () => {
  it('Div152AssessmentCard renders the stated field; the steps[0] reconstruction is gone', () => {
    const src = readFileSync(join(process.cwd(), 'components/tax/Div152AssessmentCard.tsx'), 'utf8');
    expect(src).toContain('div152Result.gainBeforeConcessions');
    expect(src).not.toMatch(/steps\[0\]\.runningGain\s*\+/);
  });

  it('no file in components/tax/** applies an arithmetic operator to an engine result field', () => {
    const DIR = join(process.cwd(), 'components/tax');
    const ENGINE_FIELDS =
      '(?:runningGain|reduction|assessableGain|gainBeforeConcessions|psiAttributedToIndividual|retirementExemptionApplied|rolloverApplied)';
    // `.field <op>` or `<op> …path.field` — either side of +, -, *, /.
    const LEFT = new RegExp(`\\.${ENGINE_FIELDS}\\b\\s*[+\\-*/]`);
    const RIGHT = new RegExp(`[+\\-*/]\\s*[\\w$.\\[\\]]*\\.${ENGINE_FIELDS}\\b`);
    const hits: string[] = [];
    for (const file of readdirSync(DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) {
      const src = readFileSync(join(DIR, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      src.split('\n').forEach((line, i) => {
        if (LEFT.test(line) || RIGHT.test(line)) hits.push(`${file}:${i + 1} — ${line.trim()}`);
      });
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });
});
