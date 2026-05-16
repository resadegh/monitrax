/**
 * Phase 41E.1 — Negative gearing regime classifier tests.
 *
 * Pins the boundary-day classification + the commencement-flag gate
 * + the property-type scope. Per CLAUDE.md §12.14 FW-2, the engine
 * must never silently apply post-reform math before commencement is
 * verified — these tests assert that wall.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveNegativeGearingRegime,
  regimePermitsLossOffsetOtherIncome,
  type NegativeGearingRegimeInput,
} from '@/lib/tax-engine/divisions/negativeGearingRegime';
import { TAX_YEAR_2025_26 } from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';

// Build a TaxYearConfig with the commencement flag flipped on.
// Used to test the "what would happen IF Royal Assent verified" path.
function configWithReformOn(): TaxYearConfig {
  return {
    ...TAX_YEAR_2025_26,
    negativeGearingReformCommencementVerified: true,
  };
}

const PRE_CUT_OVER = new Date('2025-12-31T00:00:00Z');
const ONE_SEC_BEFORE_CUT_OVER = new Date('2026-05-12T09:29:59Z');
const EXACT_CUT_OVER = new Date('2026-05-12T09:30:00Z');
const ONE_SEC_AFTER_CUT_OVER = new Date('2026-05-12T09:30:01Z');
const POST_CUT_OVER = new Date('2026-06-15T00:00:00Z');

describe('Phase 41E.1 — deriveNegativeGearingRegime — commencement gate', () => {
  it('returns PRE_REFORM_GRANDFATHERED when reform flag is false (Stage 1 default)', () => {
    // The Stage 1 wall: even if every other input would put the
    // property in POST_REFORM_RESTRICTED, the commencement-not-verified
    // gate keeps it grandfathered. This is the FW-2 enforcement test.
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER, // would be post-reform if reform was live
      isNewBuild: false, // would be restricted if reform was live
      fy: '2027-28', // post-commencement FY
      config: TAX_YEAR_2025_26, // commencementVerified = false
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });
});

describe('Phase 41E.1 — deriveNegativeGearingRegime — FY commencement gate', () => {
  it('FY 2026-27 (pre-commencement) → PRE_REFORM_GRANDFATHERED even with reform flag on', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER,
      isNewBuild: false,
      fy: '2026-27',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });

  it('FY 2027-28 (commencement FY) → reform-aware', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('POST_REFORM_RESTRICTED');
  });
});

describe('Phase 41E.1 — deriveNegativeGearingRegime — property-type scope', () => {
  it('RENTAL (user is the renter) → PRE_REFORM_GRANDFATHERED (out of scope)', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'RENTAL',
      contractDate: POST_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });

  it('HOME (residential) → in scope', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'HOME',
      contractDate: POST_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('POST_REFORM_RESTRICTED');
  });

  it('INVESTMENT (residential investment) → in scope', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER,
      isNewBuild: true,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('POST_REFORM_NEW_BUILD');
  });
});

describe('Phase 41E.1 — deriveNegativeGearingRegime — boundary day classification', () => {
  // These are the load-bearing tests — they pin the wall between
  // grandfathered and post-reform at the second. Getting any one of
  // these wrong moves a real user into the wrong regime forever.

  it('contract well before cut-over → PRE_REFORM_GRANDFATHERED', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: PRE_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });

  it('contract ONE SECOND before cut-over → PRE_REFORM_GRANDFATHERED', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: ONE_SEC_BEFORE_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });

  it('contract AT the cut-over moment → PRE_REFORM_GRANDFATHERED (inclusive boundary)', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: EXACT_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });

  it('contract ONE SECOND after cut-over → POST_REFORM_RESTRICTED', () => {
    // The most important boundary in the entire reform. One second
    // makes the difference between "negative gearing offsets salary
    // forever" and "negative gearing denied from FY 2027-28".
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: ONE_SEC_AFTER_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('POST_REFORM_RESTRICTED');
  });
});

describe('Phase 41E.1 — deriveNegativeGearingRegime — new-build branch', () => {
  it('post-cut-over + isNewBuild=true → POST_REFORM_NEW_BUILD (offset still permitted)', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER,
      isNewBuild: true,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('POST_REFORM_NEW_BUILD');
  });

  it('post-cut-over + isNewBuild=false → POST_REFORM_RESTRICTED', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER,
      isNewBuild: false,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('POST_REFORM_RESTRICTED');
  });

  it('post-cut-over + isNewBuild=null → UC_NEW_BUILD_UNCONFIRMED (needs user confirmation)', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: POST_CUT_OVER,
      isNewBuild: null,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('UC_NEW_BUILD_UNCONFIRMED');
  });
});

describe('Phase 41E.1 — deriveNegativeGearingRegime — UNKNOWN contract date', () => {
  it('residential + post-commencement FY + null contract date → UC_PROPERTY_CONTRACT_DATE_UNKNOWN', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'INVESTMENT',
      contractDate: null,
      isNewBuild: null,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('UC_PROPERTY_CONTRACT_DATE_UNKNOWN');
  });

  it('non-residential + post-commencement FY + null contract date → PRE_REFORM_GRANDFATHERED (out of scope)', () => {
    const input: NegativeGearingRegimeInput = {
      propertyType: 'RENTAL',
      contractDate: null,
      isNewBuild: null,
      fy: '2027-28',
      config: configWithReformOn(),
    };
    expect(deriveNegativeGearingRegime(input)).toBe('PRE_REFORM_GRANDFATHERED');
  });
});

describe('Phase 41E.1 — regimePermitsLossOffsetOtherIncome', () => {
  it('PRE_REFORM_GRANDFATHERED → permits offset', () => {
    expect(regimePermitsLossOffsetOtherIncome('PRE_REFORM_GRANDFATHERED')).toBe(true);
  });

  it('POST_REFORM_NEW_BUILD → permits offset', () => {
    expect(regimePermitsLossOffsetOtherIncome('POST_REFORM_NEW_BUILD')).toBe(true);
  });

  it('POST_REFORM_RESTRICTED → does NOT permit offset', () => {
    expect(regimePermitsLossOffsetOtherIncome('POST_REFORM_RESTRICTED')).toBe(false);
  });

  it('UC_PROPERTY_CONTRACT_DATE_UNKNOWN → permits offset (conservative fallback)', () => {
    // The conservative default — when in doubt, give the user the
    // pre-reform treatment until they confirm the contract date.
    expect(regimePermitsLossOffsetOtherIncome('UC_PROPERTY_CONTRACT_DATE_UNKNOWN')).toBe(true);
  });

  it('UC_NEW_BUILD_UNCONFIRMED → permits offset (conservative fallback)', () => {
    expect(regimePermitsLossOffsetOtherIncome('UC_NEW_BUILD_UNCONFIRMED')).toBe(true);
  });
});
