/**
 * Entity-type catalog — Phase 47 F1 (Structure Capture Completion).
 *
 * The CANONICAL catalog of LegalEntity types as the capture surfaces see
 * them: which types exist, how they group into the two-tier picker
 * (COMMON first paint / EXTENDED behind "More structures"), their warm
 * one-line descriptions (§14.3 — never clinical), which conditional
 * fields apply per type, and the trustType auto-derivation that keeps
 * Phase 41E Measure-3 dispatch correct (§12.14) when the new trust
 * types are created.
 *
 * Consumers: `app/api/entities/route.ts` + `[id]/route.ts` (whitelists),
 * `app/dashboard/entities/page.tsx` (two-tier picker), and — from
 * Phase 47 F4 — the onboarding wizard's EntitiesStep. One SSOT so the
 * wizard and My Structure can never drift (§12.2).
 *
 * Design SoT (CLAUDE.md §18): Stitch screens
 *   light `eb5dd4a37e5c47b087d2405f50d13f49`
 *   dark  `c3c62699a61c4439a5d06a5ac7fcb5af`
 * Artefacts: `.stitch/designs/phase47-f1/add-entity-two-tier-picker{,-dark}.{html,png}`
 * Spec: docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md §4 Stage F (F1).
 */

import type { LegalEntityType, LegalEntityRole, TrustType, CompanySubtype } from '@prisma/client';

/** Tier 1 — the seven common types every user sees first. Order = display order. */
export const COMMON_ENTITY_TYPES: readonly LegalEntityType[] = [
  'PERSONAL_NAME',
  'COMPANY',
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'SMSF',
  'PARTNERSHIP',
  'SOLE_TRADER',
] as const;

/** Tier 2 — the extended Phase 44 grammar, behind "More structures". */
export const EXTENDED_ENTITY_TYPES: readonly LegalEntityType[] = [
  'BARE_TRUST',
  'INDIVIDUAL',
  'FIXED_TRUST',
  'HYBRID_TRUST',
  'TESTAMENTARY_TRUST',
  'DECEASED_ESTATE',
  'FOREIGN_COMPANY',
  'INCORPORATED_ASSOCIATION',
  'CO_OPERATIVE',
  'STRATA_BODY_CORPORATE',
  'CUSTODIAN_PLATFORM',
  'OTHER',
] as const;

export const ALL_ENTITY_TYPES: readonly LegalEntityType[] = [
  ...COMMON_ENTITY_TYPES,
  ...EXTENDED_ENTITY_TYPES,
];

export const ALL_ENTITY_ROLES: readonly LegalEntityRole[] = [
  'PERSONAL',
  'HOLDING',
  'OPERATING',
  'INVESTMENT',
  'SUPERANNUATION',
  'CORPORATE_TRUSTEE',
] as const;

export const ENTITY_TYPE_LABELS: Record<LegalEntityType, string> = {
  PERSONAL_NAME: 'My personal name',
  COMPANY: 'Company (Pty Ltd)',
  DISCRETIONARY_TRUST: 'Family / discretionary trust',
  UNIT_TRUST: 'Unit trust',
  SMSF: 'Self-Managed Super Fund',
  PARTNERSHIP: 'Partnership',
  SOLE_TRADER: 'Sole trader',
  INDIVIDUAL: 'Individual',
  FIXED_TRUST: 'Fixed trust',
  HYBRID_TRUST: 'Hybrid trust',
  BARE_TRUST: 'Bare trust',
  TESTAMENTARY_TRUST: 'Testamentary trust',
  DECEASED_ESTATE: 'Deceased estate',
  FOREIGN_COMPANY: 'Foreign company',
  INCORPORATED_ASSOCIATION: 'Incorporated association',
  CO_OPERATIVE: 'Co-operative',
  STRATA_BODY_CORPORATE: 'Strata / body corporate',
  CUSTODIAN_PLATFORM: 'Custodian / platform',
  OTHER: 'Other structure',
};

/** Warm one-line descriptions for the picker cards (§14.3). */
export const ENTITY_TYPE_DESCRIPTIONS: Record<LegalEntityType, string> = {
  PERSONAL_NAME: 'Assets held in your own name',
  COMPANY: 'A Pty Ltd or Ltd you own or run',
  DISCRETIONARY_TRUST: 'The classic family trust',
  UNIT_TRUST: 'Fixed units, like shares in a trust',
  SMSF: 'Your self-managed super',
  PARTNERSHIP: 'A business run with partners',
  SOLE_TRADER: 'A business in your own name (ABN)',
  INDIVIDUAL: 'A person in your structure',
  FIXED_TRUST: 'Fixed entitlements, no units',
  HYBRID_TRUST: 'Mix of fixed and discretionary',
  BARE_TRUST: 'Holds one asset for someone else — e.g. an SMSF property loan',
  TESTAMENTARY_TRUST: 'A trust created by a will',
  DECEASED_ESTATE: 'An estate being administered',
  FOREIGN_COMPANY: 'A company incorporated overseas',
  INCORPORATED_ASSOCIATION: 'A state-registered association',
  CO_OPERATIVE: 'A registered co-operative',
  STRATA_BODY_CORPORATE: 'An owners corporation',
  CUSTODIAN_PLATFORM: 'A wrap platform or custodian',
  OTHER: 'Something else — recorded and flagged',
};

/** Entity types that ARE trusts — they carry `trustType` + deed/vesting dates. */
export const TRUST_FAMILY_TYPES: readonly LegalEntityType[] = [
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'FIXED_TRUST',
  'HYBRID_TRUST',
  'BARE_TRUST',
  'TESTAMENTARY_TRUST',
] as const;

/** Entity types that are companies — they carry ACN + `companySubtype`. */
export const COMPANY_FAMILY_TYPES: readonly LegalEntityType[] = [
  'COMPANY',
  'FOREIGN_COMPANY',
] as const;

/**
 * Auto-derive `trustType` from the entity type when the user hasn't
 * picked one. Keeps Phase 41E Measure-3 dispatch correct by
 * construction (§12.14): only DISCRETIONARY is reform-affected, and the
 * new trust types map to their correctly-EXCLUDED subtypes. BARE_TRUST
 * has no TrustType subtype of its own — the entity type itself is the
 * precise fact; Measure 3 never applies (OTHER).
 */
export function deriveTrustType(type: LegalEntityType): TrustType | null {
  switch (type) {
    case 'DISCRETIONARY_TRUST': return 'DISCRETIONARY';
    case 'UNIT_TRUST': return 'UNIT';
    case 'FIXED_TRUST': return 'FIXED';
    case 'HYBRID_TRUST': return 'HYBRID';
    case 'TESTAMENTARY_TRUST': return 'TESTAMENTARY';
    case 'BARE_TRUST': return 'OTHER';
    default: return null;
  }
}

export function isTrustFamily(type: LegalEntityType): boolean {
  return TRUST_FAMILY_TYPES.includes(type);
}

export function isCompanyFamily(type: LegalEntityType): boolean {
  return COMPANY_FAMILY_TYPES.includes(type);
}

export const COMPANY_SUBTYPE_OPTIONS: ReadonlyArray<{ value: CompanySubtype; label: string }> = [
  { value: 'PROPRIETARY', label: 'Proprietary (Pty Ltd)' },
  { value: 'PUBLIC', label: 'Public (Ltd)' },
  { value: 'LIMITED_BY_GUARANTEE', label: 'Limited by guarantee' },
  { value: 'UNLIMITED', label: 'Unlimited' },
  { value: 'NO_LIABILITY', label: 'No liability (NL)' },
] as const;

/**
 * Partnership subtypes — F-LAW review (2026-06-12). Corporate limited
 * partnerships are taxed AS COMPANIES (Div 5A ITAA36); VCLP / ESVCLP
 * carry Phase 41E Measure 7 treatment. String set mirrors the schema's
 * documented values.
 */
export const PARTNERSHIP_SUBTYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'GENERAL', label: 'General partnership' },
  { value: 'LIMITED', label: 'Limited partnership' },
  { value: 'INCORPORATED_LIMITED', label: 'Incorporated limited partnership' },
  { value: 'VCLP', label: 'Venture capital LP (VCLP)' },
  { value: 'ESVCLP', label: 'Early-stage venture capital LP (ESVCLP)' },
] as const;

/** Estate administration stages — mirrors the schema's documented string set. */
export const ESTATE_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'EARLY', label: 'Early administration' },
  { value: 'PARTLY', label: 'Partly administered' },
  { value: 'FULLY_ADMINISTERED', label: 'Fully administered' },
  { value: 'FINAL_DISTRIBUTION_COMPLETE', label: 'Final distribution complete' },
] as const;

/** Which optional identifier / detail fields apply per type. */
export function entityFieldApplicability(type: LegalEntityType): {
  abn: boolean;
  acn: boolean;
  tfn: boolean;
  companySubtype: boolean;
  dateOfBirth: boolean;
  trustDates: boolean; // deedDate + vestingDate
  estateStatus: boolean;
  partnershipSubtype: boolean;
} {
  const company = isCompanyFamily(type);
  const trust = isTrustFamily(type);
  return {
    // Individuals and personal names have no ABN; everything else may.
    abn: type !== 'PERSONAL_NAME' && type !== 'INDIVIDUAL',
    acn: company,
    tfn: true,
    companySubtype: company,
    dateOfBirth: type === 'INDIVIDUAL' || type === 'PERSONAL_NAME',
    trustDates: trust,
    estateStatus: type === 'DECEASED_ESTATE',
    partnershipSubtype: type === 'PARTNERSHIP',
  };
}

/** Sensible default role per type (the form pre-selects; user can change). */
export function defaultRoleForEntityType(type: LegalEntityType): LegalEntityRole {
  switch (type) {
    case 'PERSONAL_NAME':
    case 'INDIVIDUAL':
      return 'PERSONAL';
    case 'SMSF':
      return 'SUPERANNUATION';
    case 'COMPANY':
    case 'FOREIGN_COMPANY':
    case 'SOLE_TRADER':
    case 'PARTNERSHIP':
    case 'INCORPORATED_ASSOCIATION':
    case 'CO_OPERATIVE':
      return 'OPERATING';
    case 'BARE_TRUST':
    case 'CUSTODIAN_PLATFORM':
      return 'HOLDING';
    case 'UNIT_TRUST':
      return 'INVESTMENT';
    case 'DISCRETIONARY_TRUST':
    case 'FIXED_TRUST':
    case 'HYBRID_TRUST':
    case 'TESTAMENTARY_TRUST':
    case 'DECEASED_ESTATE':
    case 'STRATA_BODY_CORPORATE':
    case 'OTHER':
    default:
      return 'HOLDING';
  }
}
