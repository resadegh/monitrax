/**
 * MON-109 — legislated tax thresholds live in the engine ONLY; the capture
 * layer reads the exported constants for both comparisons and display copy
 * (VR-037 finding 4: `0.8` inline in the classifier AND the PSI card;
 * `180` / `$6,000,000` / `$2,000,000` / `$500,000` re-typed on the Div 152
 * card).
 *
 * Two locks:
 *  1. THE CONSTANTS — pinned to the legislated values with their provisions,
 *     and the surfaces import them (topology).
 *  2. THE DETECTOR (NeoAudit, durable prevention) — no tax-threshold
 *     numeral may appear in `components/tax/**`: percentage literals in a
 *     comparison, formatted/underscored currency literals, or bare
 *     magnitudes ≥ 1,000 — outside comments, className strings, and
 *     FY-label strings. Annotate a genuine presentational literal with
 *     `@tax-threshold-allowed: <reason>` on the same line.
 *
 * Registered in the NeoAudit rule inventory (docs/blueprint/NEOAUDIT.md §7)
 * — the guard that stops the next reform from moving a threshold in the
 * engine while the card keeps showing the old number.
 *
 * Coverage (precise): pins the constant values and statically scans the
 * capture-card layer. Does NOT scan the whole app (the financial-surfaces
 * lint owns the broad pass) and does NOT verify rendered copy (Ring-3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ONE_CLIENT_THRESHOLD } from '@/lib/tax-engine/divisions/psiClassifier';
import {
  FIFTEEN_YEAR_MONTHS,
  MNAV_THRESHOLD,
  RETIREMENT_LIFETIME_CAP,
  TURNOVER_THRESHOLD,
} from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';

describe('MON-109 · the engine constants are THE thresholds', () => {
  it('pinned to the legislated values', () => {
    expect(ONE_CLIENT_THRESHOLD).toBe(0.8); // s87-15(3) 80% rule, TR 2022/3
    expect(MNAV_THRESHOLD).toBe(6_000_000); // s152-15
    expect(TURNOVER_THRESHOLD).toBe(2_000_000); // s152-20
    expect(RETIREMENT_LIFETIME_CAP).toBe(500_000); // s152-310
    expect(FIFTEEN_YEAR_MONTHS).toBe(180); // s152-105 (15 × 12)
  });

  it('the capture cards import the constants they render', () => {
    const psi = readFileSync(join(process.cwd(), 'components/tax/PsiAssessmentCard.tsx'), 'utf8');
    expect(psi).toContain('ONE_CLIENT_THRESHOLD');
    const div = readFileSync(join(process.cwd(), 'components/tax/Div152AssessmentCard.tsx'), 'utf8');
    for (const c of ['FIFTEEN_YEAR_MONTHS', 'MNAV_THRESHOLD', 'TURNOVER_THRESHOLD', 'RETIREMENT_LIFETIME_CAP']) {
      expect(div).toContain(c);
    }
  });

  it('the classifier compares against the constant, not an inline 0.8', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/tax-engine/divisions/psiClassifier.ts'),
      'utf8',
    );
    expect(src).toContain('oneClientPercentage < ONE_CLIENT_THRESHOLD');
    expect(src).not.toMatch(/oneClientPercentage\s*<\s*0\.8/);
  });
});

describe('MON-109 · NeoAudit detector — no tax-threshold numerals in components/tax/**', () => {
  const DIR = join(process.cwd(), 'components/tax');

  /** Strip what the detector must ignore: comments, className strings, FY labels. */
  function scannable(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc headers)
      .replace(/\/\/[^\n]*/g, '') // line comments
      .replace(/className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, 'className=""') // tailwind numerals
      .replace(/(['"`])\d{4}-\d{2}\1/g, '$1FY$1'); // FY-label strings ('2025-26')
  }

  const OFFENDERS: Array<[string, RegExp]> = [
    ['percentage literal in a comparison (e.g. >= 0.8)', /[<>]=?\s*0\.\d/],
    ['formatted currency literal (e.g. $6,000,000)', /\b\d{1,3}(?:,\d{3})+\b/],
    ['underscored numeric literal (e.g. 500_000)', /\b\d+_\d{3}\b/],
    // Year-like 4-digit numbers (ITAA 1997/1936, TR 2022/3) are legal
    // citations, not thresholds — excluded.
    ['bare magnitude ≥ 1,000 (e.g. 180 months is fine; 6000000 is not)', /\b(?!(?:19|20)\d{2}\b)[1-9]\d{3,}\b/],
  ];

  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  it.each(files)('%s carries no unannotated threshold numeral', (file) => {
    const raw = readFileSync(join(DIR, file), 'utf8');
    const lines = scannable(raw).split('\n');
    const rawLines = raw.split('\n');
    const hits: string[] = [];
    lines.forEach((line, i) => {
      if (rawLines[i]?.includes('@tax-threshold-allowed:')) return;
      for (const [what, re] of OFFENDERS) {
        if (re.test(line)) hits.push(`${file}:${i + 1} — ${what}: ${line.trim()}`);
      }
    });
    expect(hits, hits.join('\n')).toEqual([]);
  });
});
