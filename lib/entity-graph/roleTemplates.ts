/**
 * Per-type role templates — Phase 47 F2a (the "Entity File" pattern).
 *
 * Reza (2026-06-12): *"there is an easy way to mark the company
 * director, shareholders, trustee, beneficiary, etc for any entity
 * based on the required type of entity… make sure all related
 * information is captured and stored and used where and when needed."*
 *
 * The advisor org-chart works because each card is TYPE-AWARE — a
 * company card shows Director / Shareholder / Secretary rows, a trust
 * card shows Trustee / Beneficiary rows. This module is the canonical
 * map from `LegalEntityType` → the roles its file carries, split into:
 *
 *   - `required`  — the structure is incomplete without it (company
 *                   needs a director; trust needs a trustee)
 *   - `expected`  — present on almost every real example (shareholders,
 *                   beneficiaries)
 *   - `optional`  — legitimate but not assumed (secretary, settlor,
 *                   appointor)
 *
 * THE GUIDANCE LAYER, NOT THE LAW. The validity matrix
 * (`lib/entity-graph/validityMatrix.ts`) keeps judging structural
 * legality (SIS Act SMSF rules etc.) — templates only name the rows the
 * UI offers, so the two never duplicate (CLAUDE.md §12.2). Consumers:
 * the Roles & People section (F2), the universe preview popover, and —
 * from F4 — the onboarding wizard's per-type cards.
 *
 * Direction convention: every role edge points INTO the entity —
 * `from = the person/entity holding the role`, `to = this entity`
 * ("Reza DIRECTOR_OF Renew Group Holding").
 *
 * Spec: docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md §4 Stage F (F2a).
 */

import type { LegalEntityType, EntityRelationshipType } from '@prisma/client';

export type RoleRequirement = 'required' | 'expected' | 'optional';

export interface RoleTemplateRow {
  /** Stable key for React lists + tests. */
  key: string;
  /** Warm row label (§14.3) — "Director", "Beneficiaries", "Trustee". */
  label: string;
  /** CTA label when the row is empty — "Add a director". */
  addLabel: string;
  /**
   * Which edge types satisfy this row. Usually one; rows like the
   * deceased-estate "Executor / administrator" accept either.
   */
  anyOf: readonly EntityRelationshipType[];
  requirement: RoleRequirement;
}

const row = (
  key: string,
  label: string,
  addLabel: string,
  anyOf: readonly EntityRelationshipType[],
  requirement: RoleRequirement,
): RoleTemplateRow => ({ key, label, addLabel, anyOf, requirement });

const COMPANY_ROWS: readonly RoleTemplateRow[] = [
  row('director', 'Directors', 'Add a director', ['DIRECTOR_OF'], 'required'),
  row('shareholder', 'Shareholders', 'Add a shareholder', ['SHAREHOLDER_OF'], 'expected'),
  row('secretary', 'Secretary', 'Add a secretary', ['SECRETARY_OF'], 'optional'),
  row('public-officer', 'Public officer', 'Add a public officer', ['PUBLIC_OFFICER_OF'], 'optional'),
];

const TRUST_ROWS: readonly RoleTemplateRow[] = [
  row('trustee', 'Trustee', 'Add the trustee', ['TRUSTEE_OF'], 'required'),
  row('beneficiary', 'Beneficiaries', 'Add a beneficiary', ['BENEFICIARY_OF'], 'expected'),
  row('appointor', 'Appointor', 'Add an appointor', ['APPOINTOR_OF'], 'optional'),
  row('settlor', 'Settlor', 'Add the settlor', ['SETTLOR_OF'], 'optional'),
  row('guardian', 'Guardian', 'Add a guardian', ['GUARDIAN_OF'], 'optional'),
];

const UNIT_TRUST_ROWS: readonly RoleTemplateRow[] = [
  row('trustee', 'Trustee', 'Add the trustee', ['TRUSTEE_OF'], 'required'),
  row('unitholder', 'Unitholders', 'Add a unitholder', ['UNITHOLDER_OF'], 'expected'),
  row('settlor', 'Settlor', 'Add the settlor', ['SETTLOR_OF'], 'optional'),
];

/** The full map. Types absent from a template still get the full grammar via "More roles". */
const TEMPLATES: Record<LegalEntityType, readonly RoleTemplateRow[]> = {
  PERSONAL_NAME: [
    row('family', 'Family links', 'Link a family member', ['FAMILY_MEMBER_OF'], 'optional'),
  ],
  INDIVIDUAL: [
    row('family', 'Family links', 'Link a family member', ['FAMILY_MEMBER_OF'], 'optional'),
  ],
  COMPANY: COMPANY_ROWS,
  FOREIGN_COMPANY: COMPANY_ROWS,
  DISCRETIONARY_TRUST: TRUST_ROWS,
  FIXED_TRUST: TRUST_ROWS,
  HYBRID_TRUST: [
    row('trustee', 'Trustee', 'Add the trustee', ['TRUSTEE_OF'], 'required'),
    row('beneficiary', 'Beneficiaries', 'Add a beneficiary', ['BENEFICIARY_OF'], 'expected'),
    row('unitholder', 'Unitholders', 'Add a unitholder', ['UNITHOLDER_OF'], 'expected'),
    row('appointor', 'Appointor', 'Add an appointor', ['APPOINTOR_OF'], 'optional'),
    row('settlor', 'Settlor', 'Add the settlor', ['SETTLOR_OF'], 'optional'),
  ],
  UNIT_TRUST: UNIT_TRUST_ROWS,
  TESTAMENTARY_TRUST: TRUST_ROWS,
  BARE_TRUST: [
    // The LRBA shape — one trustee holding for one beneficiary (often
    // the SMSF). Both load-bearing: a bare trust without either is
    // structurally meaningless.
    row('trustee', 'Trustee', 'Add the trustee', ['TRUSTEE_OF'], 'required'),
    row('beneficiary', 'Held for', 'Add who it is held for', ['BENEFICIARY_OF'], 'required'),
  ],
  SMSF: [
    row('trustee', 'Trustee', 'Add the trustee', ['TRUSTEE_OF'], 'required'),
    row('member', 'Members', 'Add a member', ['MEMBER_OF'], 'required'),
  ],
  PARTNERSHIP: [
    row('partner', 'Partners', 'Add a partner', ['PARTNER_OF'], 'required'),
  ],
  SOLE_TRADER: [
    row('operator', 'Operated by', 'Link the operator', ['OPERATES_AS_SOLE_TRADER'], 'required'),
  ],
  DECEASED_ESTATE: [
    row(
      'administrator',
      'Executor / administrator',
      'Add the executor or administrator',
      ['EXECUTOR_OF', 'ADMINISTRATOR_OF'],
      'required',
    ),
    row('beneficiary', 'Beneficiaries', 'Add a beneficiary', ['BENEFICIARY_OF'], 'expected'),
  ],
  INCORPORATED_ASSOCIATION: [
    row('director', 'Committee / directors', 'Add a committee member', ['DIRECTOR_OF'], 'expected'),
    row('secretary', 'Secretary', 'Add a secretary', ['SECRETARY_OF'], 'optional'),
    row('member', 'Members', 'Add a member', ['MEMBER_OF'], 'expected'),
  ],
  CO_OPERATIVE: [
    row('director', 'Directors', 'Add a director', ['DIRECTOR_OF'], 'expected'),
    row('member', 'Members', 'Add a member', ['MEMBER_OF'], 'expected'),
  ],
  STRATA_BODY_CORPORATE: [
    row('member', 'Lot owners / members', 'Add a member', ['MEMBER_OF'], 'expected'),
    row('secretary', 'Secretary', 'Add a secretary', ['SECRETARY_OF'], 'optional'),
  ],
  CUSTODIAN_PLATFORM: [],
  OTHER: [],
};

/** The canonical template rows for an entity type. */
export function roleTemplateFor(type: LegalEntityType): readonly RoleTemplateRow[] {
  return TEMPLATES[type] ?? [];
}

export interface RoleCompleteness {
  /** Required rows with at least one active edge. */
  filledRequired: number;
  totalRequired: number;
  /** required+expected rows filled / total — drives the chip copy. */
  filled: number;
  total: number;
}

/**
 * Per-entity completeness from the template + the entity's ACTIVE
 * inbound edge types. Invitation framing, never a shame score —
 * consumers render "Structure file 2/3" style copy, no red.
 */
export function roleCompleteness(
  type: LegalEntityType,
  activeInboundTypes: ReadonlySet<EntityRelationshipType>,
): RoleCompleteness {
  const rows = roleTemplateFor(type).filter(r => r.requirement !== 'optional');
  const requiredRows = rows.filter(r => r.requirement === 'required');
  const isFilled = (r: RoleTemplateRow) => r.anyOf.some(t => activeInboundTypes.has(t));
  return {
    filledRequired: requiredRows.filter(isFilled).length,
    totalRequired: requiredRows.length,
    filled: rows.filter(isFilled).length,
    total: rows.length,
  };
}
