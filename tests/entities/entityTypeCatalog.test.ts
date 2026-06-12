/**
 * Phase 47 F1 — entity-type catalog contract.
 *
 * Pins: (1) the two tiers cover the FULL Prisma LegalEntityType enum
 * with no overlap, (2) trustType auto-derivation keeps Phase 41E
 * Measure-3 dispatch correct by construction (only DISCRETIONARY maps
 * to the reform-affected subtype — §12.14 FW-1/FW-2), (3) per-type
 * field applicability gates the conditional detail fields.
 */

import { describe, it, expect } from 'vitest';
import {
  COMMON_ENTITY_TYPES,
  EXTENDED_ENTITY_TYPES,
  ALL_ENTITY_TYPES,
  ALL_ENTITY_ROLES,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_DESCRIPTIONS,
  TRUST_FAMILY_TYPES,
  deriveTrustType,
  isTrustFamily,
  entityFieldApplicability,
  defaultRoleForEntityType,
} from '@/lib/entities/entityTypeCatalog';

describe('Phase 47 F1 — entity type catalog', () => {
  it('the two tiers are disjoint and total (7 common + 12 extended = 19)', () => {
    expect(COMMON_ENTITY_TYPES).toHaveLength(7);
    expect(EXTENDED_ENTITY_TYPES).toHaveLength(12);
    const overlap = COMMON_ENTITY_TYPES.filter(t =>
      (EXTENDED_ENTITY_TYPES as readonly string[]).includes(t),
    );
    expect(overlap).toHaveLength(0);
    expect(new Set(ALL_ENTITY_TYPES).size).toBe(19);
  });

  it('every type carries a label and a warm description', () => {
    for (const t of ALL_ENTITY_TYPES) {
      expect(ENTITY_TYPE_LABELS[t]).toBeTruthy();
      expect(ENTITY_TYPE_DESCRIPTIONS[t]).toBeTruthy();
    }
  });

  it('includes the Corporate Trustee role (was missing from the picker pre-F1)', () => {
    expect(ALL_ENTITY_ROLES).toContain('CORPORATE_TRUSTEE');
  });

  // §12.14 — only DISCRETIONARY is Measure-3-affected; the auto-derive
  // must map every other trust type to a correctly-EXCLUDED subtype.
  it('auto-derives trustType so Measure-3 dispatch stays correct', () => {
    expect(deriveTrustType('DISCRETIONARY_TRUST')).toBe('DISCRETIONARY');
    expect(deriveTrustType('UNIT_TRUST')).toBe('UNIT');
    expect(deriveTrustType('FIXED_TRUST')).toBe('FIXED');
    expect(deriveTrustType('HYBRID_TRUST')).toBe('HYBRID');
    expect(deriveTrustType('TESTAMENTARY_TRUST')).toBe('TESTAMENTARY');
    expect(deriveTrustType('BARE_TRUST')).toBe('OTHER'); // no Measure-3 exposure
    expect(deriveTrustType('COMPANY')).toBeNull();
    expect(deriveTrustType('SMSF')).toBeNull();
  });

  it('trust family covers all six trust entity types', () => {
    expect(TRUST_FAMILY_TYPES).toHaveLength(6);
    expect(isTrustFamily('BARE_TRUST')).toBe(true);
    expect(isTrustFamily('DECEASED_ESTATE')).toBe(false); // an estate is not a trust
  });

  it('gates conditional fields per type', () => {
    expect(entityFieldApplicability('INDIVIDUAL').dateOfBirth).toBe(true);
    expect(entityFieldApplicability('INDIVIDUAL').abn).toBe(false);
    expect(entityFieldApplicability('COMPANY').companySubtype).toBe(true);
    expect(entityFieldApplicability('COMPANY').acn).toBe(true);
    expect(entityFieldApplicability('BARE_TRUST').trustDates).toBe(true);
    expect(entityFieldApplicability('BARE_TRUST').acn).toBe(false);
    expect(entityFieldApplicability('DECEASED_ESTATE').estateStatus).toBe(true);
    expect(entityFieldApplicability('SMSF').estateStatus).toBe(false);
  });

  it('defaults sensible roles (bare trust holds; SMSF is super)', () => {
    expect(defaultRoleForEntityType('BARE_TRUST')).toBe('HOLDING');
    expect(defaultRoleForEntityType('SMSF')).toBe('SUPERANNUATION');
    expect(defaultRoleForEntityType('INDIVIDUAL')).toBe('PERSONAL');
    expect(defaultRoleForEntityType('FOREIGN_COMPANY')).toBe('OPERATING');
  });
});
