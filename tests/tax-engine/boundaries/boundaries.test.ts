/**
 * AFSL / TPB / NCCP boundaries renderer tests — Phase 41e.0 slice D.
 *
 * Pins the editorial half of the boundary contract per architecture
 * doc §1(5) + §5: every figure surfaced to the user is paired with
 * (a) authority audit trail, (b) UNCOMPUTED disclosures, (c) the
 * canonical "general information only" boundary statement.
 */

import { describe, it, expect } from 'vitest';
import {
  BOUNDARY_STATEMENT,
  formatCitation,
  renderBoundaryFootnote,
  renderBoundaryOneLine,
} from '@/lib/tax-engine/boundaries';
import type { AuthorityCitation, UncomputedFlag } from '@/lib/tax-engine/types';

describe('formatCitation', () => {
  it.each([
    [{ kind: 'ITAA_1997', reference: 's115-25', lastReviewed: '2026-05-05' } as AuthorityCitation, 'ITAA 1997 s115-25'],
    [{ kind: 'ITAA_1936', reference: 's100A', lastReviewed: '2026-05-05' } as AuthorityCitation, 'ITAA 1936 s100A'],
    [{ kind: 'TR', reference: '2022/4', lastReviewed: '2026-05-05' } as AuthorityCitation, 'TR 2022/4'],
    [{ kind: 'PCG', reference: '2022/2', lastReviewed: '2026-05-05' } as AuthorityCitation, 'PCG 2022/2'],
    [{ kind: 'SIS_ACT', reference: 's62', lastReviewed: '2026-05-05' } as AuthorityCitation, 'SIS Act s62'],
  ])('formats %j → %s', (citation, expected) => {
    expect(formatCitation(citation)).toBe(expected);
  });
});

describe('renderBoundaryFootnote', () => {
  it('with citations + no UNCOMPUTED → computedPer + boundary only', () => {
    const result = renderBoundaryFootnote({
      citations: [
        { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
        { kind: 'ITAA_1997', reference: 'Div 1-6', lastReviewed: '2026-05-05' },
      ],
      uncomputed: [],
      fyLabel: 'FY24-25',
    });
    expect(result.computedPer).toBe('Computed per ITAA 1997 s4-10, ITAA 1997 Div 1-6.');
    expect(result.uncomputedNotes).toEqual([]);
    expect(result.boundary).toBe(BOUNDARY_STATEMENT);
    expect(result.fyContext).toBe('Figures for FY24-25.');
  });

  it('empty citations → fallback "Computed per current Australian tax law."', () => {
    const result = renderBoundaryFootnote({ citations: [], uncomputed: [] });
    expect(result.computedPer).toBe('Computed per current Australian tax law.');
  });

  it('de-duplicates citations by kind+reference', () => {
    const result = renderBoundaryFootnote({
      citations: [
        { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
        { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-04' }, // dup
        { kind: 'ITAA_1997', reference: 'Div 1-6', lastReviewed: '2026-05-05' },
      ],
      uncomputed: [],
    });
    expect(result.computedPer).toBe('Computed per ITAA 1997 s4-10, ITAA 1997 Div 1-6.');
  });

  it('renders UNCOMPUTED rationale (one per flag)', () => {
    const flags: UncomputedFlag[] = [
      { id: 'UC-FBT', rationale: 'FBT not computed for personal-use Pty Ltd assets.' },
      { id: 'UC-PT-IVA', rationale: 'Pt IVA general anti-avoidance is out of scope.' },
    ];
    const result = renderBoundaryFootnote({ citations: [], uncomputed: flags });
    expect(result.uncomputedNotes).toEqual([
      'FBT not computed for personal-use Pty Ltd assets.',
      'Pt IVA general anti-avoidance is out of scope.',
    ]);
  });

  it('de-duplicates UNCOMPUTED flags by id', () => {
    const flags: UncomputedFlag[] = [
      { id: 'UC-FBT', rationale: 'A' },
      { id: 'UC-FBT', rationale: 'B (dup id)' },
      { id: 'UC-PAYROLL-TAX', rationale: 'C' },
    ];
    const result = renderBoundaryFootnote({ citations: [], uncomputed: flags });
    expect(result.uncomputedNotes).toEqual(['A', 'C']);
  });

  it('omits fyContext when fyLabel is undefined', () => {
    const result = renderBoundaryFootnote({ citations: [], uncomputed: [] });
    expect(result.fyContext).toBeUndefined();
  });
});

describe('renderBoundaryOneLine', () => {
  it('joins FY context + computedPer + boundary in one line', () => {
    const line = renderBoundaryOneLine({
      citations: [
        { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
      ],
      uncomputed: [],
      fyLabel: 'FY24-25',
    });
    expect(line).toBe(
      'Figures for FY24-25. Computed per ITAA 1997 s4-10. ' + BOUNDARY_STATEMENT,
    );
  });

  it('skips FY prefix when not provided', () => {
    const line = renderBoundaryOneLine({ citations: [], uncomputed: [] });
    expect(line).toBe(
      'Computed per current Australian tax law. ' + BOUNDARY_STATEMENT,
    );
  });
});

describe('BOUNDARY_STATEMENT', () => {
  it('mentions the three regulated boundaries (TPB / AFSL / NCCP)', () => {
    expect(BOUNDARY_STATEMENT).toMatch(/TPB/);
    expect(BOUNDARY_STATEMENT).toMatch(/AFSL/);
    expect(BOUNDARY_STATEMENT).toMatch(/NCCP/);
  });

  it('explicitly states this is general information, not personal advice', () => {
    expect(BOUNDARY_STATEMENT).toMatch(/general information/i);
    expect(BOUNDARY_STATEMENT).toMatch(/not personal/i);
  });
});
