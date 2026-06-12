/**
 * Phase 47 F2a — per-type role templates (the Entity File pattern).
 * Guidance layer beside the validity matrix's law layer.
 */

import { describe, it, expect } from 'vitest';
import { roleTemplateFor, roleCompleteness } from '@/lib/entity-graph/roleTemplates';

describe('Phase 47 F2a — role templates', () => {
  it('company file shows director (required), shareholder (expected), secretary (optional)', () => {
    const rows = roleTemplateFor('COMPANY');
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
    expect(byKey['director'].requirement).toBe('required');
    expect(byKey['director'].anyOf).toContain('DIRECTOR_OF');
    expect(byKey['shareholder'].requirement).toBe('expected');
    expect(byKey['secretary'].requirement).toBe('optional');
  });

  it('trust file shows trustee (required) + beneficiaries + settlor/appointor', () => {
    const rows = roleTemplateFor('DISCRETIONARY_TRUST');
    const keys = rows.map(r => r.key);
    expect(keys).toEqual(expect.arrayContaining(['trustee', 'beneficiary', 'appointor', 'settlor']));
    expect(rows.find(r => r.key === 'trustee')!.requirement).toBe('required');
  });

  it('bare trust requires BOTH trustee and held-for beneficiary (the LRBA shape)', () => {
    const rows = roleTemplateFor('BARE_TRUST');
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.requirement === 'required')).toBe(true);
  });

  it('SMSF requires trustee + members', () => {
    const rows = roleTemplateFor('SMSF');
    expect(rows.map(r => r.anyOf[0])).toEqual(['TRUSTEE_OF', 'MEMBER_OF']);
    expect(rows.every(r => r.requirement === 'required')).toBe(true);
  });

  it('deceased estate accepts executor OR administrator on one row', () => {
    const row = roleTemplateFor('DECEASED_ESTATE').find(r => r.key === 'administrator')!;
    expect(row.anyOf).toEqual(['EXECUTOR_OF', 'ADMINISTRATOR_OF']);
  });

  it('completeness counts required+expected rows, satisfied by anyOf', () => {
    // Company with a director only: director ✓, shareholder ✗ → 1/2.
    const c1 = roleCompleteness('COMPANY', new Set(['DIRECTOR_OF']));
    expect(c1).toMatchObject({ filled: 1, total: 2, filledRequired: 1, totalRequired: 1 });
    // Estate with an administrator satisfies the executor/administrator row.
    const c2 = roleCompleteness('DECEASED_ESTATE', new Set(['ADMINISTRATOR_OF']));
    expect(c2.filledRequired).toBe(1);
  });

  it('custodian/platform and OTHER have empty templates (full grammar via More roles)', () => {
    expect(roleTemplateFor('CUSTODIAN_PLATFORM')).toHaveLength(0);
    expect(roleTemplateFor('OTHER')).toHaveLength(0);
  });
});
