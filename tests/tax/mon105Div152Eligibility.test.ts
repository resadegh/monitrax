/**
 * MON-105 — Div 152 capture eligibility is its OWN grammar, never the PSI
 * list (VR-037 finding 2: the Div 152 card was unreachable for INDIVIDUAL /
 * PERSONAL_NAME — the single most common Div 152 taxpayer class).
 *
 * Locks:
 *  1. REACHABILITY — the entity types VR-037 named as shut out are Div 152
 *     eligible, INDIVIDUAL and PERSONAL_NAME first among them.
 *  2. NOT-ALIASES — the two predicates are provably independent: types
 *     exist that are Div 152-eligible but not PSI-eligible. A refactor that
 *     re-derives one from the other goes red here.
 *  3. GRAMMAR SHAPE — Div 152 is an EXCLUSION grammar (entity-type-agnostic
 *     per s152-10; SMSF keeps its dedicated fund view), and the page gates
 *     the card on it (topology).
 *
 * Coverage (precise): verifies the predicates and the page's use of them.
 * Does NOT verify the rendered card for each type (Ring-3 owns that).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIV152_INELIGIBLE_TYPES,
  PSI_ELIGIBLE_TYPES,
  isDiv152EligibleEntityType,
  isPsiEligibleEntityType,
} from '@/lib/tax-engine/eligibility';

const VR037_SHUT_OUT = [
  'INDIVIDUAL',
  'PERSONAL_NAME',
  'FIXED_TRUST',
  'HYBRID_TRUST',
  'TESTAMENTARY_TRUST',
  'DECEASED_ESTATE',
];

describe('MON-105 · Div 152 reachability', () => {
  it.each(VR037_SHUT_OUT)('%s is Div 152-eligible (was shut out behind PSI_TYPES)', (t) => {
    expect(isDiv152EligibleEntityType(t)).toBe(true);
  });

  it('the PSI set stays eligible too — broadening never narrowed', () => {
    for (const t of PSI_ELIGIBLE_TYPES) expect(isDiv152EligibleEntityType(t)).toBe(true);
  });

  it('SMSF keeps its dedicated fund view (the one exclusion)', () => {
    expect(isDiv152EligibleEntityType('SMSF')).toBe(false);
    expect(DIV152_INELIGIBLE_TYPES).toEqual(['SMSF']);
  });

  it('null entity type (not yet loaded) renders neither card', () => {
    expect(isDiv152EligibleEntityType(null)).toBe(false);
    expect(isPsiEligibleEntityType(null)).toBe(false);
  });
});

describe('MON-105 · the two grammars are NOT aliases', () => {
  it('types exist that are Div 152-eligible but not PSI-eligible', () => {
    const div152Only = VR037_SHUT_OUT.filter(
      (t) => isDiv152EligibleEntityType(t) && !isPsiEligibleEntityType(t),
    );
    expect(div152Only.length).toBeGreaterThan(0);
  });

  it('the PSI grammar is unchanged (Part 2-42 entity types)', () => {
    expect([...PSI_ELIGIBLE_TYPES].sort()).toEqual(
      ['COMPANY', 'DISCRETIONARY_TRUST', 'PARTNERSHIP', 'SOLE_TRADER', 'UNIT_TRUST'].sort(),
    );
    expect(isPsiEligibleEntityType('INDIVIDUAL')).toBe(false);
  });
});

describe('MON-105 · topology — the page gates each card on its own predicate', () => {
  it('the entity tax page imports both predicates and defines no local PSI_TYPES list', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/dashboard/entities/[id]/tax/page.tsx'),
      'utf8',
    );
    expect(src).toContain('isPsiEligibleEntityType');
    expect(src).toContain('isDiv152EligibleEntityType');
    expect(src).toContain('isDiv152Relevant && (');
    // The pre-fix gate: one list, both cards behind it.
    expect(src).not.toMatch(/const PSI_TYPES\s*=/);
    expect(src).not.toMatch(/isPsiRelevant \? \(\s*<>/);
  });
});
