/**
 * Phase 41E.3 — `UpdateEntityInput` reform-field shape tests.
 *
 * Pins:
 *   - `UpdateEntityInput` accepts `trustType` from the closed enum
 *     (DISCRETIONARY / FIXED / UNIT / TESTAMENTARY_FIXED / CHARITABLE /
 *     DECEASED_ESTATE / SPECIAL_DISABILITY / OTHER) + null + undefined.
 *   - `UpdateEntityInput` accepts `isForeignResident` as boolean + null + undefined.
 *
 * Type-level pinning — if a future PR narrows the type, this fails to
 * compile rather than silently dropping the field on update.
 */

import { describe, it, expect } from 'vitest';
import type { UpdateEntityInput } from '@/lib/services/legalEntityService';

describe('Phase 41E.3 — UpdateEntityInput accepts reform fields', () => {
  it('accepts trustType across the closed enum', () => {
    const trustTypes: NonNullable<UpdateEntityInput['trustType']>[] = [
      'DISCRETIONARY',
      'FIXED',
      'UNIT',
      'TESTAMENTARY_FIXED',
      'CHARITABLE',
      'DECEASED_ESTATE',
      'SPECIAL_DISABILITY',
      'OTHER',
    ];
    expect(trustTypes).toHaveLength(8);
    // Type-only assertion: compiling this file is the test.
    const _withDiscretionary: UpdateEntityInput = { trustType: 'DISCRETIONARY' };
    const _withNull: UpdateEntityInput = { trustType: null };
    const _withUndefined: UpdateEntityInput = {};
    expect(_withDiscretionary.trustType).toBe('DISCRETIONARY');
    expect(_withNull.trustType).toBeNull();
    expect(_withUndefined.trustType).toBeUndefined();
  });

  it('accepts isForeignResident as boolean / null / undefined', () => {
    const _true: UpdateEntityInput = { isForeignResident: true };
    const _false: UpdateEntityInput = { isForeignResident: false };
    const _null: UpdateEntityInput = { isForeignResident: null };
    const _undefined: UpdateEntityInput = {};
    expect(_true.isForeignResident).toBe(true);
    expect(_false.isForeignResident).toBe(false);
    expect(_null.isForeignResident).toBeNull();
    expect(_undefined.isForeignResident).toBeUndefined();
  });

  it('rejects invalid trustType values at the type level', () => {
    // @ts-expect-error — 'INVALID' is not in the closed enum.
    const _invalid: UpdateEntityInput = { trustType: 'INVALID' };
    expect(_invalid).toBeDefined(); // runtime only — type check is the assertion
  });

  it('rejects non-boolean isForeignResident at the type level', () => {
    // @ts-expect-error — string is not assignable to boolean.
    const _invalid: UpdateEntityInput = { isForeignResident: 'yes' };
    expect(_invalid).toBeDefined();
  });
});
