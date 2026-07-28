/**
 * MON-105 — capture-card eligibility grammar: which LegalEntity types get
 * which tax self-assessment capture card.
 *
 * PSI and Div 152 are UNRELATED eligibility concepts that happened to land
 * in adjacent capture stages (MON-102 / MON-103). VR-037 finding 2: the
 * Div 152 card was gated behind the PSI list, so INDIVIDUAL / PERSONAL_NAME
 * / FIXED_TRUST / HYBRID_TRUST / TESTAMENTARY_TRUST / DECEASED_ESTATE could
 * never capture Div 152 facts — yet an individual disposing of an active
 * business asset is the single most common Div 152 taxpayer in Australia.
 * The two predicates below are DELIBERATELY independent — a lint/ratchet
 * (tests/tax/mon105Div152Eligibility.test.ts) asserts they are not aliases.
 *
 * Used by app/dashboard/entities/[id]/tax/page.tsx to gate the capture
 * cards. Eligibility only — no tax arithmetic lives here (§8.3).
 */

/**
 * Entity types the PSI rules (ITAA 1997 Part 2-42) can apply to — PSI can
 * flow through an interposed company / trust / partnership, and a sole
 * trader earns it directly (s84-5, s86-15).
 */
export const PSI_ELIGIBLE_TYPES: readonly string[] = [
  'COMPANY',
  'SOLE_TRADER',
  'PARTNERSHIP',
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
];

export function isPsiEligibleEntityType(entityType: string | null): boolean {
  return entityType !== null && PSI_ELIGIBLE_TYPES.includes(entityType);
}

/**
 * Div 152 (small business CGT concessions) is ENTITY-TYPE-AGNOSTIC: the
 * s152-10 basic conditions ask about the taxpayer's size (MNAV s152-15 /
 * turnover s152-20) and the asset's active use (s152-35) — never the legal
 * form. Any entity that can hold and dispose of a CGT asset is eligible to
 * capture Div 152 facts, so this is an EXCLUSION list, not an allow-list
 * derived from PSI's.
 *
 * SMSF is the one exclusion: the fund view on the entity tax page is its
 * dedicated Div 295 income-tax estimate, and a complying super fund's
 * disposals are dealt with under the fund CGT rules, not Div 152.
 */
export const DIV152_INELIGIBLE_TYPES: readonly string[] = ['SMSF'];

export function isDiv152EligibleEntityType(entityType: string | null): boolean {
  return entityType !== null && !DIV152_INELIGIBLE_TYPES.includes(entityType);
}
