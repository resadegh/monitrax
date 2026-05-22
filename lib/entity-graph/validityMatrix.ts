/**
 * Phase 44 Part 1b — the entity-graph validity matrix (SSOT).
 *
 * The single source of truth for the §6 grammar: node/edge legality,
 * the §6.1 three-state classifier, the corrected §6.3 SMSF rules, the
 * §6.4 entity-validity rules and §6.5 cycle handling. Pure functions —
 * no I/O, no clock reads, no tax arithmetic (PHASE_44_ENTITY_GRAPH.md
 * §8.3 / §8.4). Every consumer — the relationship service (write-time
 * validation), the entity UI, the onboarding wizard, any structural
 * check — calls these; the rules are re-implemented nowhere else
 * (CLAUDE.md §12.2 / §12.3).
 *
 * The §6.1 three states:
 *   VALID                       — legally + logically sound; full computation.
 *   NON_COMPLIANT_BUT_RECORDED  — a real/asserted structure that appears
 *                                 defective; RECORDED + flagged, never erased;
 *                                 downstream tax confidence downgrades.
 *   IMPOSSIBLE_SYSTEM_ERROR     — impossible inside the data model
 *                                 (missing entity, prohibited self-edge);
 *                                 the only state the service rejects.
 *
 * The matrix GRADES — it does not blanket-reject (§3, §6.1). Legal
 * non-compliance is recorded and flagged so Monitrax never lies about
 * the user's reality (§9).
 */

import type { EntityRelationshipType } from '@prisma/client';
import {
  type EntityGraph,
  type GraphNode,
  type GraphEdge,
  type ValidityIssue,
  type ValidityResult,
  type IssueSeverity,
  deriveState,
  isIndividualType,
  isCompanyType,
  isTrustType,
  TRUSTEE_TARGET_TYPES,
  BENEFICIARY_TARGET_TYPES,
  UNIT_ISSUING_TYPES,
  DISCRETIONARY_TRUST_TYPES,
} from './types';
import { edgesTo, edgesFrom, getNode, findTrusteeCycle, findOwnershipCycles } from './queries';

// =============================================================================
// SMALL HELPERS
// =============================================================================

function issue(
  severity: IssueSeverity,
  code: string,
  message: string,
  subjectId: string,
): ValidityIssue {
  return { severity, code, message, subjectId };
}

/** Distinct values, order-preserving. */
function distinct(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Distinct `from` entity ids of the active edges of `type` into `entityId`. */
function inboundSources(
  graph: EntityGraph,
  entityId: string,
  type: EntityRelationshipType,
  asOf: Date,
): string[] {
  return distinct(edgesTo(graph, entityId, asOf, type).map((e) => e.fromEntityId));
}

// =============================================================================
// §6.2 — EDGE LEGALITY
// =============================================================================

type NodePredicate = (node: GraphNode) => boolean;

interface EdgeRule {
  /** Which node types may sit at the `from` end. */
  allowedFrom: NodePredicate;
  /** Which node types may sit at the `to` end. */
  allowedTo: NodePredicate;
  /** Plain-English description of the legal shape — used in the issue message. */
  shape: string;
}

const anyEntity: NodePredicate = () => true;
const individual: NodePredicate = (n) => isIndividualType(n.type);
const company: NodePredicate = (n) => isCompanyType(n.type);
const companyOrIndividual: NodePredicate = (n) =>
  isCompanyType(n.type) || isIndividualType(n.type);
const trust: NodePredicate = (n) => isTrustType(n.type);
const trusteeTarget: NodePredicate = (n) => TRUSTEE_TARGET_TYPES.has(n.type);
const beneficiaryTarget: NodePredicate = (n) => BENEFICIARY_TARGET_TYPES.has(n.type);
const unitIssuer: NodePredicate = (n) => UNIT_ISSUING_TYPES.has(n.type);
/** SHAREHOLDER_OF target — a company that has share capital (not a guarantee company, §6.2). */
const shareCapitalCompany: NodePredicate = (n) =>
  isCompanyType(n.type) && n.companySubtype !== 'LIMITED_BY_GUARANTEE';
const deceasedEstate: NodePredicate = (n) => n.type === 'DECEASED_ESTATE';
const soleTrader: NodePredicate = (n) => n.type === 'SOLE_TRADER';
const partnership: NodePredicate = (n) => n.type === 'PARTNERSHIP';
/** MEMBER_OF target — an SMSF or a company limited by guarantee (§6.2). */
const memberTarget: NodePredicate = (n) =>
  n.type === 'SMSF' || (isCompanyType(n.type) && n.companySubtype === 'LIMITED_BY_GUARANTEE');
/** PUBLIC_OFFICER_OF target — the ATO-facing-officer surfaces (§5). */
const publicOfficerTarget: NodePredicate = (n) =>
  isCompanyType(n.type) || isTrustType(n.type) || n.type === 'SMSF' || n.type === 'PARTNERSHIP';
const beneficiaryFrom: NodePredicate = (n) =>
  isIndividualType(n.type) || isCompanyType(n.type) || isTrustType(n.type);

/**
 * The §6.2 edge-legality table. Each `EntityRelationshipType` declares
 * which node types may sit at each end. A violation is NON_COMPLIANT
 * (recorded + flagged), never IMPOSSIBLE — only true data-model breaks
 * (missing node, self-edge) are rejected (§6.1).
 */
const EDGE_RULES: Record<EntityRelationshipType, EdgeRule> = {
  TRUSTEE_OF: {
    allowedFrom: companyOrIndividual,
    allowedTo: trusteeTarget,
    shape: 'a company or individual → a trust, SMSF or deceased estate',
  },
  APPOINTOR_OF: {
    allowedFrom: companyOrIndividual,
    allowedTo: trust,
    shape: 'a company or individual → a trust',
  },
  GUARDIAN_OF: {
    allowedFrom: companyOrIndividual,
    allowedTo: trust,
    shape: 'a company or individual → a trust',
  },
  POWER_HOLDER_OF: {
    allowedFrom: companyOrIndividual,
    allowedTo: trust,
    shape: 'a company or individual → a trust',
  },
  SETTLOR_OF: {
    allowedFrom: individual,
    allowedTo: trust,
    shape: 'an individual → a trust',
  },
  BENEFICIARY_OF: {
    allowedFrom: beneficiaryFrom,
    allowedTo: beneficiaryTarget,
    shape: 'an individual, company or trust → a discretionary/hybrid/testamentary/bare trust, SMSF or deceased estate',
  },
  EXECUTOR_OF: {
    allowedFrom: companyOrIndividual,
    allowedTo: deceasedEstate,
    shape: 'a company or individual → a deceased estate',
  },
  ADMINISTRATOR_OF: {
    allowedFrom: companyOrIndividual,
    allowedTo: deceasedEstate,
    shape: 'a company or individual → a deceased estate',
  },
  LEGAL_PERSONAL_REPRESENTATIVE_FOR: {
    allowedFrom: companyOrIndividual,
    allowedTo: individual,
    shape: 'a company or individual → an individual',
  },
  UNITHOLDER_OF: {
    allowedFrom: anyEntity,
    allowedTo: unitIssuer,
    shape: 'any entity → a unit or hybrid trust',
  },
  SHAREHOLDER_OF: {
    allowedFrom: anyEntity,
    allowedTo: shareCapitalCompany,
    shape: 'any entity → a company with share capital',
  },
  DIRECTOR_OF: {
    allowedFrom: individual,
    allowedTo: company,
    shape: 'an individual → a company',
  },
  SECRETARY_OF: {
    allowedFrom: individual,
    allowedTo: company,
    shape: 'an individual → a company',
  },
  PUBLIC_OFFICER_OF: {
    allowedFrom: individual,
    allowedTo: publicOfficerTarget,
    shape: 'an individual → a company, trust, SMSF or partnership',
  },
  MEMBER_OF: {
    allowedFrom: individual,
    allowedTo: memberTarget,
    shape: 'an individual → an SMSF or a company limited by guarantee',
  },
  PARTNER_OF: {
    allowedFrom: anyEntity,
    allowedTo: partnership,
    shape: 'any entity → a partnership',
  },
  OPERATES_AS_SOLE_TRADER: {
    allowedFrom: individual,
    allowedTo: soleTrader,
    shape: 'an individual → a sole-trader entity',
  },
  FAMILY_MEMBER_OF: {
    allowedFrom: individual,
    allowedTo: individual,
    shape: 'an individual → an individual',
  },
  ASSOCIATE_OF: {
    allowedFrom: anyEntity,
    allowedTo: anyEntity,
    shape: 'any entity → any entity',
  },
};

/**
 * Classify a single edge against the §6.2 grammar.
 *
 *  - A missing referenced node, or a prohibited self-edge (from === to),
 *    is an IMPOSSIBLE_SYSTEM_ERROR — rejected at write time (§6.1).
 *  - A wrong-typed `from` / `to` is NON_COMPLIANT_BUT_RECORDED — the edge
 *    is still recorded so Monitrax does not lie about the user's reality;
 *    it is flagged and downstream tax confidence downgrades (§6.1, §9).
 */
export function classifyEdge(
  graph: EntityGraph,
  edge: GraphEdge,
  _asOf: Date,
): ValidityResult {
  const issues: ValidityIssue[] = [];
  const fromNode = getNode(graph, edge.fromEntityId);
  const toNode = getNode(graph, edge.toEntityId);

  if (!fromNode || !toNode) {
    issues.push(
      issue(
        'IMPOSSIBLE',
        'EDGE_MISSING_ENTITY',
        'This relationship references an entity that does not exist.',
        edge.id,
      ),
    );
    return { state: deriveState(issues), issues };
  }

  if (edge.fromEntityId === edge.toEntityId) {
    issues.push(
      issue(
        'IMPOSSIBLE',
        'EDGE_SELF_REFERENCE',
        'An entity cannot hold a relationship to itself.',
        edge.id,
      ),
    );
    return { state: deriveState(issues), issues };
  }

  const rule = EDGE_RULES[edge.type];
  if (!rule.allowedFrom(fromNode)) {
    issues.push(
      issue(
        'ERROR',
        'EDGE_ILLEGAL_FROM',
        `A ${edge.type} relationship must be ${rule.shape}. "${fromNode.name}" (${fromNode.type}) cannot be the source.`,
        edge.id,
      ),
    );
  }
  if (!rule.allowedTo(toNode)) {
    issues.push(
      issue(
        'ERROR',
        'EDGE_ILLEGAL_TO',
        `A ${edge.type} relationship must be ${rule.shape}. "${toNode.name}" (${toNode.type}) cannot be the target.`,
        edge.id,
      ),
    );
  }

  return { state: deriveState(issues), issues };
}

// =============================================================================
// §6.3 — SMSF VALIDITY
// =============================================================================

/** An active LEGAL_PERSONAL_REPRESENTATIVE_FOR edge — `from` represents `to`. */
function lprEdgesRepresenting(graph: EntityGraph, representedId: string, asOf: Date): GraphEdge[] {
  return edgesTo(graph, representedId, asOf, 'LEGAL_PERSONAL_REPRESENTATIVE_FOR');
}

/**
 * Is `candidate` permitted as the second director/trustee of a
 * single-member SMSF? §6.3 permits "a relative not employed by the
 * member, or an LPR". Employment is not modelled, so the graph can
 * confirm only the family relationship or the LPR edge — the caller
 * surfaces an INFO asking the user to confirm the employment condition.
 */
function isPermittedSecondActor(
  graph: EntityGraph,
  candidateId: string,
  memberId: string,
  asOf: Date,
): boolean {
  const familyLink = graph.edges.some(
    (e) =>
      e.type === 'FAMILY_MEMBER_OF' &&
      e.effectiveTo === null &&
      ((e.fromEntityId === candidateId && e.toEntityId === memberId) ||
        (e.fromEntityId === memberId && e.toEntityId === candidateId)),
  );
  const lprLink =
    edgesFrom(graph, candidateId, asOf, 'LEGAL_PERSONAL_REPRESENTATIVE_FOR').some(
      (e) => e.toEntityId === memberId,
    ) ||
    lprEdgesRepresenting(graph, candidateId, asOf).length > 0;
  return familyLink || lprLink;
}

function classifySmsf(graph: EntityGraph, smsf: GraphNode, asOf: Date): ValidityIssue[] {
  const issues: ValidityIssue[] = [];
  const id = smsf.id;

  // --- Members: 1..6 (SIS Act s17A) ---------------------------------------
  const memberIds = inboundSources(graph, id, 'MEMBER_OF', asOf);
  if (memberIds.length < 1) {
    issues.push(
      issue('ERROR', 'SMSF_NO_MEMBERS', 'An SMSF must have at least one member (SIS Act s17A).', id),
    );
  } else if (memberIds.length > 6) {
    issues.push(
      issue(
        'ERROR',
        'SMSF_MEMBER_COUNT',
        `An SMSF may have at most 6 members (SIS Act s17A) — found ${memberIds.length}.`,
        id,
      ),
    );
  }

  // --- Trustee arrangement: exactly one (corporate XOR ≥2 individual) ------
  const trusteeNodes = inboundSources(graph, id, 'TRUSTEE_OF', asOf)
    .map((tid) => getNode(graph, tid))
    .filter((n): n is GraphNode => n !== undefined);
  const corporateTrustees = trusteeNodes.filter((n) => isCompanyType(n.type)).map((n) => n.id);
  const individualTrustees = trusteeNodes.filter((n) => isIndividualType(n.type)).map((n) => n.id);
  const hasCorporate = corporateTrustees.length >= 1;
  const hasIndividual = individualTrustees.length >= 1;

  if (!hasCorporate && !hasIndividual) {
    issues.push(
      issue(
        'ERROR',
        'SMSF_NO_TRUSTEE',
        'An SMSF must have a trustee — one corporate trustee, or two or more individual trustees (SIS Act s17A).',
        id,
      ),
    );
    return issues;
  }
  if (hasCorporate && hasIndividual) {
    issues.push(
      issue(
        'ERROR',
        'SMSF_MIXED_TRUSTEE',
        'An SMSF must have either a corporate trustee or individual trustees — not both.',
        id,
      ),
    );
    return issues;
  }
  if (hasCorporate && corporateTrustees.length > 1) {
    issues.push(
      issue(
        'ERROR',
        'SMSF_MULTIPLE_CORPORATE_TRUSTEES',
        'An SMSF must have exactly one corporate trustee.',
        id,
      ),
    );
    return issues;
  }

  // The members ⇔ controllers rules need at least one member to compare.
  if (memberIds.length < 1) return issues;

  if (hasCorporate) {
    const directorIds = inboundSources(graph, corporateTrustees[0], 'DIRECTOR_OF', asOf);
    classifyCorporateTrusteeSmsf(graph, id, memberIds, directorIds, asOf, issues);
  } else {
    classifyIndividualTrusteeSmsf(graph, id, memberIds, individualTrustees, asOf, issues);
  }
  return issues;
}

/**
 * §6.3 — corporate-trustee SMSF: members and the corporate trustee's
 * directors must be the same set, both directions, with the LPR exception.
 */
function classifyCorporateTrusteeSmsf(
  graph: EntityGraph,
  smsfId: string,
  memberIds: string[],
  directorIds: string[],
  asOf: Date,
  issues: ValidityIssue[],
): void {
  const memberSet = new Set(memberIds);
  const directorSet = new Set(directorIds);

  if (memberIds.length === 1) {
    // Single-member fund — the member may be sole director, or one of two
    // where the second satisfies the permitted conditions (§6.3).
    const member = memberIds[0];
    if (!directorSet.has(member)) {
      issues.push(
        issue(
          'ERROR',
          'SMSF_SINGLE_MEMBER_NOT_DIRECTOR',
          'The member of a single-member corporate-trustee SMSF must be a director of the trustee company.',
          smsfId,
        ),
      );
    }
    if (directorIds.length > 2) {
      issues.push(
        issue(
          'ERROR',
          'SMSF_SINGLE_MEMBER_DIRECTOR_COUNT',
          'A single-member corporate-trustee SMSF may have at most two directors.',
          smsfId,
        ),
      );
    } else if (directorIds.length === 2) {
      const other = directorIds.find((d) => d !== member);
      if (other) {
        if (isPermittedSecondActor(graph, other, member, asOf)) {
          issues.push(
            issue(
              'INFO',
              'SMSF_SECOND_DIRECTOR_BASIS',
              'The second director is recorded as a relative / legal personal representative of the member — the "not employed by the member" condition is not modelled; confirm with the accountant.',
              smsfId,
            ),
          );
        } else {
          issues.push(
            issue(
              'ERROR',
              'SMSF_SECOND_DIRECTOR_BASIS',
              'The second director of a single-member corporate-trustee SMSF must be a relative of the member, or a legal personal representative.',
              smsfId,
            ),
          );
        }
      }
    }
    return;
  }

  // Multi-member fund — members ⇔ directors both ways (§6.3).
  for (const m of memberIds) {
    if (!directorSet.has(m)) {
      const excused = lprEdgesRepresenting(graph, m, asOf).some((e) =>
        directorSet.has(e.fromEntityId),
      );
      if (!excused) {
        issues.push(
          issue(
            'ERROR',
            'SMSF_MEMBER_NOT_DIRECTOR',
            'Every member of a corporate-trustee SMSF must be a director of the trustee company (SIS Act s17A) — unless a legal personal representative acts in their place.',
            smsfId,
          ),
        );
      }
    }
  }
  for (const d of directorIds) {
    if (!memberSet.has(d)) {
      const isLprForMember = edgesFrom(
        graph,
        d,
        asOf,
        'LEGAL_PERSONAL_REPRESENTATIVE_FOR',
      ).some((e) => memberSet.has(e.toEntityId));
      if (!isLprForMember) {
        issues.push(
          issue(
            'ERROR',
            'SMSF_DIRECTOR_NOT_MEMBER',
            'Every director of a corporate-trustee SMSF must be a member (SIS Act s17A) — unless they are a legal personal representative of a member.',
            smsfId,
          ),
        );
      }
    }
  }
}

/**
 * §6.3 — individual-trustee SMSF: every member is a trustee and every
 * trustee is a member, with the LPR exception. A single-member fund
 * needs exactly two trustees — the member plus one permitted non-member.
 */
function classifyIndividualTrusteeSmsf(
  graph: EntityGraph,
  smsfId: string,
  memberIds: string[],
  trusteeIds: string[],
  asOf: Date,
  issues: ValidityIssue[],
): void {
  const memberSet = new Set(memberIds);
  const trusteeSet = new Set(trusteeIds);

  if (memberIds.length === 1) {
    const member = memberIds[0];
    if (trusteeIds.length !== 2) {
      issues.push(
        issue(
          'ERROR',
          'SMSF_SINGLE_MEMBER_TRUSTEE_COUNT',
          'A single-member individual-trustee SMSF must have exactly two trustees (SIS Act s17A).',
          smsfId,
        ),
      );
    }
    if (!trusteeSet.has(member)) {
      issues.push(
        issue(
          'ERROR',
          'SMSF_SINGLE_MEMBER_NOT_TRUSTEE',
          'The member of a single-member individual-trustee SMSF must be a trustee.',
          smsfId,
        ),
      );
    }
    for (const t of trusteeIds.filter((tid) => tid !== member)) {
      if (isPermittedSecondActor(graph, t, member, asOf)) {
        issues.push(
          issue(
            'INFO',
            'SMSF_SECOND_TRUSTEE_BASIS',
            'The second trustee is recorded as a relative / legal personal representative of the member — the "not employed by the member" condition is not modelled; confirm with the accountant.',
            smsfId,
          ),
        );
      } else {
        issues.push(
          issue(
            'ERROR',
            'SMSF_SECOND_TRUSTEE_BASIS',
            'The second trustee of a single-member individual-trustee SMSF must be a relative of the member, or a legal personal representative.',
            smsfId,
          ),
        );
      }
    }
    return;
  }

  // Multi-member fund — members ⇔ trustees both ways (§6.3).
  for (const m of memberIds) {
    if (!trusteeSet.has(m)) {
      const excused = lprEdgesRepresenting(graph, m, asOf).some((e) =>
        trusteeSet.has(e.fromEntityId),
      );
      if (!excused) {
        issues.push(
          issue(
            'ERROR',
            'SMSF_MEMBER_NOT_TRUSTEE',
            'Every member of an individual-trustee SMSF must be a trustee (SIS Act s17A) — unless a legal personal representative acts in their place.',
            smsfId,
          ),
        );
      }
    }
  }
  for (const t of trusteeIds) {
    if (!memberSet.has(t)) {
      const isLprForMember = edgesFrom(
        graph,
        t,
        asOf,
        'LEGAL_PERSONAL_REPRESENTATIVE_FOR',
      ).some((e) => memberSet.has(e.toEntityId));
      if (!isLprForMember) {
        issues.push(
          issue(
            'ERROR',
            'SMSF_TRUSTEE_NOT_MEMBER',
            'Every trustee of a multi-member individual-trustee SMSF must be a member (SIS Act s17A) — unless they are a legal personal representative of a member.',
            smsfId,
          ),
        );
      }
    }
  }
}

// =============================================================================
// §6.4 — ENTITY VALIDITY (non-SMSF)
// =============================================================================

function classifyCompany(graph: EntityGraph, node: GraphNode, asOf: Date): ValidityIssue[] {
  const issues: ValidityIssue[] = [];
  const id = node.id;
  const directorIds = inboundSources(graph, id, 'DIRECTOR_OF', asOf);
  const shareholderIds = inboundSources(graph, id, 'SHAREHOLDER_OF', asOf);

  if (node.companySubtype === 'LIMITED_BY_GUARANTEE') {
    // A guarantee company has members, not shareholders (§6.4).
    if (directorIds.length < 1) {
      issues.push(
        issue('WARNING', 'COMPANY_NO_DIRECTOR', 'No director recorded for this company.', id),
      );
    }
    if (inboundSources(graph, id, 'MEMBER_OF', asOf).length < 1) {
      issues.push(
        issue(
          'WARNING',
          'GUARANTEE_COMPANY_NO_MEMBER',
          'No member recorded for this company limited by guarantee.',
          id,
        ),
      );
    }
    if (shareholderIds.length > 0) {
      issues.push(
        issue(
          'ERROR',
          'GUARANTEE_COMPANY_HAS_SHAREHOLDERS',
          'A company limited by guarantee has members, not shareholders — remove the shareholding relationships.',
          id,
        ),
      );
    }
    return issues;
  }

  // Share-capital company (proprietary / public / unlimited / NL, and a
  // null subtype treated as proprietary for the minimum-director floor).
  const minDirectors = node.companySubtype === 'PUBLIC' ? 3 : 1;
  if (directorIds.length < minDirectors) {
    issues.push(
      issue(
        'WARNING',
        'COMPANY_DIRECTOR_COUNT',
        `This company should have at least ${minDirectors} director${minDirectors > 1 ? 's' : ''} — ${directorIds.length} recorded.`,
        id,
      ),
    );
  }
  if (shareholderIds.length < 1) {
    issues.push(
      issue('WARNING', 'COMPANY_NO_SHAREHOLDER', 'No shareholder recorded for this company.', id),
    );
  }
  if (node.companySubtype === 'PUBLIC' && inboundSources(graph, id, 'SECRETARY_OF', asOf).length < 1) {
    issues.push(
      issue('WARNING', 'PUBLIC_COMPANY_NO_SECRETARY', 'A public company must have a secretary.', id),
    );
  }
  return issues;
}

function classifyTrust(graph: EntityGraph, node: GraphNode, asOf: Date): ValidityIssue[] {
  const issues: ValidityIssue[] = [];
  const id = node.id;

  if (inboundSources(graph, id, 'TRUSTEE_OF', asOf).length < 1) {
    issues.push(
      issue('WARNING', 'TRUST_NO_TRUSTEE', 'No trustee recorded for this trust.', id),
    );
  }

  if (node.type === 'UNIT_TRUST') {
    if (inboundSources(graph, id, 'UNITHOLDER_OF', asOf).length < 1) {
      issues.push(
        issue('WARNING', 'UNIT_TRUST_NO_UNITHOLDER', 'No unitholder recorded for this unit trust.', id),
      );
    }
  } else if (DISCRETIONARY_TRUST_TYPES.has(node.type)) {
    if (inboundSources(graph, id, 'BENEFICIARY_OF', asOf).length < 1) {
      issues.push(
        issue('WARNING', 'TRUST_NO_BENEFICIARY', 'No beneficiary recorded for this trust.', id),
      );
    }
    // §6.2 — an appointor is expected for a discretionary/hybrid trust;
    // its absence is a warning, never an error (the deed may not have one).
    if (inboundSources(graph, id, 'APPOINTOR_OF', asOf).length < 1) {
      issues.push(
        issue(
          'WARNING',
          'TRUST_NO_APPOINTOR',
          'No appointor recorded — most discretionary trust deeds name one; confirm the deed.',
          id,
        ),
      );
    }
  }
  return issues;
}

function classifyDeceasedEstate(graph: EntityGraph, node: GraphNode, asOf: Date): ValidityIssue[] {
  const issues: ValidityIssue[] = [];
  const id = node.id;
  const hasAdministrator =
    inboundSources(graph, id, 'EXECUTOR_OF', asOf).length > 0 ||
    inboundSources(graph, id, 'ADMINISTRATOR_OF', asOf).length > 0;
  if (!hasAdministrator) {
    issues.push(
      issue(
        'WARNING',
        'ESTATE_NO_ADMINISTRATOR',
        'No executor or administrator recorded for this deceased estate.',
        id,
      ),
    );
  }
  if (!node.estateAdministrationStatus) {
    issues.push(
      issue(
        'WARNING',
        'ESTATE_NO_STATUS',
        'No administration status recorded for this deceased estate.',
        id,
      ),
    );
  }
  return issues;
}

function classifyPartnership(graph: EntityGraph, node: GraphNode, asOf: Date): ValidityIssue[] {
  const issues: ValidityIssue[] = [];
  if (inboundSources(graph, node.id, 'PARTNER_OF', asOf).length < 2) {
    issues.push(
      issue(
        'WARNING',
        'PARTNERSHIP_PARTNER_COUNT',
        'A partnership needs at least two partners.',
        node.id,
      ),
    );
  }
  return issues;
}

function classifySoleTrader(graph: EntityGraph, node: GraphNode, asOf: Date): ValidityIssue[] {
  const issues: ValidityIssue[] = [];
  const inbound = inboundSources(graph, node.id, 'OPERATES_AS_SOLE_TRADER', asOf);
  if (inbound.length === 0) {
    issues.push(
      issue(
        'WARNING',
        'SOLE_TRADER_UNBOUND',
        'This sole-trader entity is not linked to an individual.',
        node.id,
      ),
    );
  } else if (inbound.length > 1) {
    // A sole trader IS one individual — binding it to several is structurally wrong.
    issues.push(
      issue(
        'ERROR',
        'SOLE_TRADER_MULTIPLE_INDIVIDUALS',
        'A sole-trader entity must be linked to exactly one individual.',
        node.id,
      ),
    );
  }
  return issues;
}

/**
 * Classify a single entity against its §6.3 / §6.4 validity rules.
 * Returns the §6.1 state plus the issues that produced it.
 */
export function classifyEntity(
  graph: EntityGraph,
  node: GraphNode,
  asOf: Date,
): ValidityResult {
  // `OTHER` is outside the supported grammar — recorded + flagged, never
  // mismodelled (§3, §4). Structural validation does not apply.
  if (node.type === 'OTHER' || node.unsupportedStructure) {
    return {
      state: 'VALID',
      issues: [
        issue(
          'WARNING',
          'UNSUPPORTED_STRUCTURE',
          'This entity is outside the supported structural grammar — recorded and flagged; structural validation does not apply.',
          node.id,
        ),
      ],
    };
  }

  let issues: ValidityIssue[];
  switch (node.type) {
    case 'SMSF':
      issues = classifySmsf(graph, node, asOf);
      break;
    case 'COMPANY':
    case 'FOREIGN_COMPANY':
      issues = classifyCompany(graph, node, asOf);
      break;
    case 'DISCRETIONARY_TRUST':
    case 'UNIT_TRUST':
    case 'FIXED_TRUST':
    case 'HYBRID_TRUST':
    case 'BARE_TRUST':
    case 'TESTAMENTARY_TRUST':
      issues = classifyTrust(graph, node, asOf);
      break;
    case 'DECEASED_ESTATE':
      issues = classifyDeceasedEstate(graph, node, asOf);
      break;
    case 'PARTNERSHIP':
      issues = classifyPartnership(graph, node, asOf);
      break;
    case 'SOLE_TRADER':
      issues = classifySoleTrader(graph, node, asOf);
      break;
    // Natural persons and the body-corporate types (incorporated
    // association, co-operative, strata, custodian platform) carry no
    // structural-edge requirements in the §6.4 grammar.
    default:
      issues = [];
      break;
  }
  return { state: deriveState(issues), issues };
}

// =============================================================================
// §6.5 — CYCLES + WHOLE-GRAPH CLASSIFICATION
// =============================================================================

/** Trustee control chains deeper than this are flagged (§6.5 safety ceiling). */
const TRUSTEE_CHAIN_MAX_DEPTH = 10;

export interface GraphValidityReport {
  /** Per-entity validity, keyed by entity id. */
  entities: Map<string, ValidityResult>;
  /** Per-edge validity, keyed by edge id. */
  edges: Map<string, ValidityResult>;
  /** A TRUSTEE_OF control-chain cycle (§6.5), or null — no entity may be its own trustee-ancestor. */
  trusteeCycle: string[] | null;
  /** Ownership cross-holding cycles (§6.5) — legal, recorded, never rejected. */
  ownershipCycles: string[][];
}

/**
 * Classify the whole graph — every entity, every edge, plus the §6.5
 * cycle rules. Cycle findings are folded into the per-entity results so
 * a consumer reading one entity's `ValidityResult` sees the cycle flag.
 *
 *  - A TRUSTEE_OF cycle is a structural break → ERROR on each entity in it.
 *  - An ownership (cross-holding) cycle is LEGAL → WARNING on each entity
 *    in it; the calc/tax engines must return UNCOMPUTED rather than
 *    recursively attribute through it (§6.5).
 */
export function classifyGraph(graph: EntityGraph, asOf: Date): GraphValidityReport {
  const entities = new Map<string, ValidityResult>();
  const edges = new Map<string, ValidityResult>();

  // Build mutable issue lists so cycle findings can be appended.
  const entityIssues = new Map<string, ValidityIssue[]>();
  for (const node of graph.nodes) {
    entityIssues.set(node.id, classifyEntity(graph, node, asOf).issues);
  }
  for (const edge of graph.edges) {
    edges.set(edge.id, classifyEdge(graph, edge, asOf));
  }

  // §6.5 — trustee control-chain cycle.
  const trusteeCycle = findTrusteeCycle(graph, asOf);
  if (trusteeCycle) {
    for (const entityId of trusteeCycle) {
      entityIssues.get(entityId)?.push(
        issue(
          'ERROR',
          'TRUSTEE_CYCLE',
          'This entity is part of a trustee control-chain cycle — no entity may be its own trustee-ancestor.',
          entityId,
        ),
      );
    }
  } else {
    // Depth ceiling — only meaningful when the chain is acyclic.
    for (const node of graph.nodes) {
      if (trusteeChainDepth(graph, node.id, asOf) > TRUSTEE_CHAIN_MAX_DEPTH) {
        entityIssues.get(node.id)?.push(
          issue(
            'WARNING',
            'TRUSTEE_CHAIN_DEPTH',
            `Trustee control chain exceeds the ${TRUSTEE_CHAIN_MAX_DEPTH}-deep safety ceiling.`,
            node.id,
          ),
        );
      }
    }
  }

  // §6.5 — ownership cross-holding cycles (legal; recorded + flagged).
  const ownershipCycles = findOwnershipCycles(graph, asOf);
  for (const cycle of ownershipCycles) {
    for (const entityId of cycle) {
      entityIssues.get(entityId)?.push(
        issue(
          'WARNING',
          'OWNERSHIP_CYCLE',
          'This entity is part of a circular cross-holding — recorded and legal, but value and tax attribution will return UNCOMPUTED until a cycle-resolution method is supplied.',
          entityId,
        ),
      );
    }
  }

  for (const [entityId, issues] of entityIssues) {
    entities.set(entityId, { state: deriveState(issues), issues });
  }

  return { entities, edges, trusteeCycle, ownershipCycles };
}

/** Longest TRUSTEE_OF chain rooted at `entityId` (0 if it administers nothing). */
function trusteeChainDepth(graph: EntityGraph, entityId: string, asOf: Date): number {
  const walk = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0; // a cycle is handled separately — stop here.
    seen.add(id);
    let deepest = 0;
    for (const e of edgesFrom(graph, id, asOf, 'TRUSTEE_OF')) {
      deepest = Math.max(deepest, 1 + walk(e.toEntityId, new Set(seen)));
    }
    return deepest;
  };
  return walk(entityId, new Set());
}
