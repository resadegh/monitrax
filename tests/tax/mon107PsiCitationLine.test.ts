/**
 * MON-107 — the PSI card renders the ENGINE's per-branch citations; the
 * hardcoded `ITAA 1997 Part 2-42 · s86-15` literal is gone (VR-037
 * finding 5: the $0 PSB branch cited the attribution provision).
 *
 * Locks:
 *  1. RENDERED STRING — `formatCitationLine` over the real engine output:
 *     the ATO-determination PSB branch shows s87-60 and NOT s86-15; the
 *     attribution branch shows s86-15; the results-test branch s87-18.
 *  2. TOPOLOGY — the card contains no hardcoded s86-15 literal and calls
 *     the formatter.
 *
 * Coverage (precise): verifies the exact citation string the card renders,
 * from the real classifier output. Does NOT verify the card's DOM (Ring-3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyPsi } from '@/lib/tax-engine/divisions/psiClassifier';
import { formatCitationLine } from '@/components/tax/citationLine';

const base = {
  totalPsiIncome: 150_000,
  incomeFromLargestClient: 135_000, // 90% — fails the 80% one-client test
  unrelatedClientCount: 1,
};

describe('MON-107 · the rendered citation line follows the branch', () => {
  it('ATO-determination PSB ($0 attributed) → cites s87-60, never s86-15', () => {
    const r = classifyPsi({ ...base, hasPsbDetermination: true });
    expect(r.isPsb).toBe(true);
    const line = formatCitationLine(r.citations);
    expect(line).toContain('s87-60');
    expect(line).not.toContain('s86-15');
  });

  it('results-test PSB → cites s87-18, never s86-15', () => {
    const r = classifyPsi({ ...base, meetsResultsTest: true });
    const line = formatCitationLine(r.citations);
    expect(line).toContain('s87-18');
    expect(line).not.toContain('s86-15');
  });

  it('attribution branch → cites s86-15 (the provision that actually applied)', () => {
    const r = classifyPsi(base);
    expect(r.isPsb).toBe(false);
    expect(formatCitationLine(r.citations)).toContain('s86-15');
  });

  it('kind labels render once per consecutive run — readable, not stuttering', () => {
    const r = classifyPsi(base);
    const line = formatCitationLine(r.citations);
    expect(line).toContain('ITAA 1997 Part 2-42 (PSI) · s84-5 · s87-15 (PSB) · TR 2022/3');
  });

  it('engine emitted nothing (stale/absent payload) → the neutral Part 2-42 fallback, no branch claim', () => {
    expect(formatCitationLine(undefined)).toBe('ITAA 1997 Part 2-42');
    expect(formatCitationLine([])).toBe('ITAA 1997 Part 2-42');
  });
});

describe('MON-107 · topology — the card renders, never restates', () => {
  it('PsiAssessmentCard has no hardcoded s86-15 and calls formatCitationLine', () => {
    const src = readFileSync(join(process.cwd(), 'components/tax/PsiAssessmentCard.tsx'), 'utf8');
    expect(src).toContain('formatCitationLine(psiResult.citations)');
    // Comment-insensitive: the JSDoc may NAME s86-15 when documenting the
    // contract; rendered code must not.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toContain('s86-15');
  });
});
