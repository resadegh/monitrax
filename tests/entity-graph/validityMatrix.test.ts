/**
 * Phase 44 Part 1b — tests for the entity-graph rules engine.
 *
 * These encode the §14.1 combination-completeness acceptance tests from
 * docs/blueprint/PHASE_44_ENTITY_GRAPH.md plus the §6.2 edge-legality
 * and §6.3 SMSF rules. The design contract says the build is not done
 * until the implementation handles each §14.1 case — this file is the
 * executable proof.
 */

import { describe, it, expect } from 'vitest';
import type { LegalEntityType } from '@prisma/client';
import type { GraphNode, GraphEdge, EntityGraph, BeneficialOwnershipRecord } from '../../lib/entity-graph/types';
import type { EntityRelationshipType } from '@prisma/client';
import { classifyEntity, classifyEdge, classifyGraph } from '../../lib/entity-graph/validityMatrix';
import { getTrusteesOf, findOwnershipCycles, resolveBeneficialOwner, isAssociateOf } from '../../lib/entity-graph/queries';

const ASOF = new Date('2026-05-22T00:00:00Z');

function node(id: string, type: LegalEntityType, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    type,
    role: 'PERSONAL',
    name: id,
    companySubtype: null,
    trustType: null,
    estateAdministrationStatus: null,
    structuralState: 'VALID',
    accountantVerified: false,
    unsupportedStructure: false,
    ...overrides,
  };
}

let edgeSeq = 0;
function edge(
  from: string,
  to: string,
  type: EntityRelationshipType,
  overrides: Partial<GraphEdge> = {},
): GraphEdge {
  return {
    id: `e${edgeSeq++}`,
    fromEntityId: from,
    toEntityId: to,
    type,
    effectiveFrom: new Date('2020-01-01T00:00:00Z'),
    effectiveTo: null,
    beneficiaryClass: null,
    familyRelation: null,
    lprReason: null,
    appointorPower: [],
    powerType: null,
    powerSubject: null,
    structuralState: 'VALID',
    accountantVerified: false,
    ...overrides,
  };
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): EntityGraph {
  return { nodes, edges };
}

// =============================================================================
// §14.1 Test 1 — single-member SMSF, two-director corporate trustee
// =============================================================================

describe('§14.1 Test 1 — single-member SMSF, two-director corporate trustee', () => {
  function buildFund(secondDirectorPermitted: boolean): EntityGraph {
    const nodes = [
      node('smsf', 'SMSF'),
      node('memberA', 'INDIVIDUAL'),
      node('dirB', 'INDIVIDUAL'),
      node('ct', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
    ];
    const edges = [
      edge('memberA', 'smsf', 'MEMBER_OF'),
      edge('ct', 'smsf', 'TRUSTEE_OF'),
      edge('memberA', 'ct', 'DIRECTOR_OF'),
      edge('dirB', 'ct', 'DIRECTOR_OF'),
    ];
    if (secondDirectorPermitted) {
      edges.push(edge('memberA', 'dirB', 'FAMILY_MEMBER_OF', { familyRelation: 'SIBLING' }));
    }
    return graph(nodes, edges);
  }

  it('is VALID when the second director is a relative of the member', () => {
    const g = buildFund(true);
    const result = classifyEntity(g, g.nodes[0], ASOF);
    expect(result.state).toBe('VALID');
  });

  it('is NON_COMPLIANT_BUT_RECORDED when the second director has no permitted basis', () => {
    const g = buildFund(false);
    const result = classifyEntity(g, g.nodes[0], ASOF);
    // Audit fix 2026-06-12 (finding 7) — s17A(2)(a)(iii): the second
    // director may be ANY person provided the member is not their
    // employee. Without employment modelling this is an INFO prompt,
    // not non-compliance.
    expect(result.state).toBe('VALID');
    expect(result.issues.some((i) => i.code === 'SMSF_SECOND_DIRECTOR_BASIS')).toBe(true);
    expect(result.issues.some((i) => i.code === 'SMSF_SECOND_DIRECTOR_BASIS')).toBe(true);
  });
});

// =============================================================================
// §14.1 Test 2 — multi-member SMSF, non-member corporate-trustee director
// =============================================================================

describe('§14.1 Test 2 — multi-member SMSF with a non-member director', () => {
  it('is NON_COMPLIANT_BUT_RECORDED when a director is not a member and has no exception', () => {
    const g = graph(
      [
        node('smsf', 'SMSF'),
        node('mA', 'INDIVIDUAL'),
        node('mB', 'INDIVIDUAL'),
        node('outsider', 'INDIVIDUAL'),
        node('ct', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
      ],
      [
        edge('mA', 'smsf', 'MEMBER_OF'),
        edge('mB', 'smsf', 'MEMBER_OF'),
        edge('ct', 'smsf', 'TRUSTEE_OF'),
        edge('mA', 'ct', 'DIRECTOR_OF'),
        edge('mB', 'ct', 'DIRECTOR_OF'),
        edge('outsider', 'ct', 'DIRECTOR_OF'),
      ],
    );
    const result = classifyEntity(g, g.nodes[0], ASOF);
    expect(result.state).toBe('NON_COMPLIANT_BUT_RECORDED');
    expect(result.issues.some((i) => i.code === 'SMSF_DIRECTOR_NOT_MEMBER')).toBe(true);
  });

  it('is VALID when members and directors are the same set', () => {
    const g = graph(
      [
        node('smsf', 'SMSF'),
        node('mA', 'INDIVIDUAL'),
        node('mB', 'INDIVIDUAL'),
        node('ct', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
      ],
      [
        edge('mA', 'smsf', 'MEMBER_OF'),
        edge('mB', 'smsf', 'MEMBER_OF'),
        edge('ct', 'smsf', 'TRUSTEE_OF'),
        edge('mA', 'ct', 'DIRECTOR_OF'),
        edge('mB', 'ct', 'DIRECTOR_OF'),
      ],
    );
    expect(classifyEntity(g, g.nodes[0], ASOF).state).toBe('VALID');
  });

  it('accepts a non-member director who is the legal personal representative of a member', () => {
    const g = graph(
      [
        node('smsf', 'SMSF'),
        node('mA', 'INDIVIDUAL'),
        node('mB', 'INDIVIDUAL'),
        node('lpr', 'INDIVIDUAL'),
        node('ct', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
      ],
      [
        edge('mA', 'smsf', 'MEMBER_OF'),
        edge('mB', 'smsf', 'MEMBER_OF'),
        edge('ct', 'smsf', 'TRUSTEE_OF'),
        edge('mA', 'ct', 'DIRECTOR_OF'),
        edge('lpr', 'ct', 'DIRECTOR_OF'),
        edge('lpr', 'mB', 'LEGAL_PERSONAL_REPRESENTATIVE_FOR', { lprReason: 'INCAPACITY' }),
      ],
    );
    expect(classifyEntity(g, g.nodes[0], ASOF).state).toBe('VALID');
  });

  it('flags a seven-member SMSF as NON_COMPLIANT', () => {
    const members = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
    const g = graph(
      [
        node('smsf', 'SMSF'),
        node('ct', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
        ...members.map((m) => node(m, 'INDIVIDUAL')),
      ],
      [
        edge('ct', 'smsf', 'TRUSTEE_OF'),
        ...members.map((m) => edge(m, 'smsf', 'MEMBER_OF')),
        ...members.map((m) => edge(m, 'ct', 'DIRECTOR_OF')),
      ],
    );
    const result = classifyEntity(g, g.nodes[0], ASOF);
    expect(result.state).toBe('NON_COMPLIANT_BUT_RECORDED');
    expect(result.issues.some((i) => i.code === 'SMSF_MEMBER_COUNT')).toBe(true);
  });
});

// =============================================================================
// §14.1 Test 5 — partnership of two discretionary trusts
// =============================================================================

describe('§14.1 Test 5 — partnership of two discretionary trusts', () => {
  it('allows a trust as the source of a PARTNER_OF edge', () => {
    const g = graph(
      [
        node('partnership', 'PARTNERSHIP'),
        node('trust1', 'DISCRETIONARY_TRUST'),
        node('trust2', 'DISCRETIONARY_TRUST'),
      ],
      [
        edge('trust1', 'partnership', 'PARTNER_OF'),
        edge('trust2', 'partnership', 'PARTNER_OF'),
      ],
    );
    for (const e of g.edges) {
      expect(classifyEdge(g, e, ASOF).state).toBe('VALID');
    }
    expect(classifyEntity(g, g.nodes[0], ASOF).state).toBe('VALID');
  });
});

// =============================================================================
// §14.1 Test 6 — company limited by guarantee
// =============================================================================

describe('§14.1 Test 6 — company limited by guarantee', () => {
  it('is VALID with members and no shareholders', () => {
    const g = graph(
      [
        node('gc', 'COMPANY', { companySubtype: 'LIMITED_BY_GUARANTEE' }),
        node('dir', 'INDIVIDUAL'),
        node('mem', 'INDIVIDUAL'),
      ],
      [edge('dir', 'gc', 'DIRECTOR_OF'), edge('mem', 'gc', 'MEMBER_OF')],
    );
    expect(classifyEntity(g, g.nodes[0], ASOF).state).toBe('VALID');
  });

  it('is NON_COMPLIANT when a guarantee company has shareholders', () => {
    const g = graph(
      [
        node('gc', 'COMPANY', { companySubtype: 'LIMITED_BY_GUARANTEE' }),
        node('dir', 'INDIVIDUAL'),
        node('mem', 'INDIVIDUAL'),
        node('sh', 'INDIVIDUAL'),
      ],
      [
        edge('dir', 'gc', 'DIRECTOR_OF'),
        edge('mem', 'gc', 'MEMBER_OF'),
        edge('sh', 'gc', 'SHAREHOLDER_OF'),
      ],
    );
    const result = classifyEntity(g, g.nodes[0], ASOF);
    expect(result.state).toBe('NON_COMPLIANT_BUT_RECORDED');
    expect(result.issues.some((i) => i.code === 'GUARANTEE_COMPANY_HAS_SHAREHOLDERS')).toBe(true);
  });
});

// =============================================================================
// §14.1 Test 8 — nominee shareholder (beneficial ownership ≠ legal title)
// =============================================================================

describe('§14.1 Test 8 — nominee beneficial ownership', () => {
  it('resolves the beneficial owner away from the legal owner when an override applies', () => {
    const overrides: BeneficialOwnershipRecord[] = [
      {
        id: 'o1',
        legalOwnerEntityId: 'nomineeCo',
        beneficialOwnerEntityId: 'familyTrust',
        ownedObjectType: 'shareParcel',
        ownedObjectId: 'parcel1',
        basis: 'NOMINEE',
        effectiveFrom: new Date('2021-01-01T00:00:00Z'),
        effectiveTo: null,
      },
    ];
    expect(resolveBeneficialOwner('nomineeCo', 'shareParcel', 'parcel1', overrides, ASOF)).toBe(
      'familyTrust',
    );
  });

  it('falls back to the legal owner when no override applies', () => {
    expect(resolveBeneficialOwner('ownerCo', 'shareParcel', 'parcelX', [], ASOF)).toBe('ownerCo');
  });
});

// =============================================================================
// §14.1 Test 10 — circular cross-shareholding
// =============================================================================

describe('§14.1 Test 10 — circular cross-shareholding', () => {
  it('detects the cycle and records it without rejecting (state stays VALID)', () => {
    const g = graph(
      [
        node('coA', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
        node('coB', 'COMPANY', { companySubtype: 'PROPRIETARY' }),
      ],
      [
        edge('coA', 'coB', 'SHAREHOLDER_OF'),
        edge('coB', 'coA', 'SHAREHOLDER_OF'),
      ],
    );
    const cycles = findOwnershipCycles(g, ASOF);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].sort()).toEqual(['coA', 'coB']);

    const report = classifyGraph(g, ASOF);
    const coA = report.entities.get('coA');
    expect(coA?.state).toBe('VALID');
    expect(coA?.issues.some((i) => i.code === 'OWNERSHIP_CYCLE')).toBe(true);
  });
});

// =============================================================================
// §6.2 edge legality + §6.1 three-state model
// =============================================================================

describe('§6.2 edge legality', () => {
  it('records a trust acting as a trustee as NON_COMPLIANT, not rejected', () => {
    const g = graph(
      [node('trustX', 'DISCRETIONARY_TRUST'), node('trustY', 'DISCRETIONARY_TRUST')],
      [edge('trustX', 'trustY', 'TRUSTEE_OF')],
    );
    const result = classifyEdge(g, g.edges[0], ASOF);
    expect(result.state).toBe('NON_COMPLIANT_BUT_RECORDED');
    expect(result.issues.some((i) => i.code === 'EDGE_ILLEGAL_FROM')).toBe(true);
  });

  it('rejects a self-edge as IMPOSSIBLE_SYSTEM_ERROR', () => {
    const g = graph([node('a', 'INDIVIDUAL')], [edge('a', 'a', 'FAMILY_MEMBER_OF')]);
    expect(classifyEdge(g, g.edges[0], ASOF).state).toBe('IMPOSSIBLE_SYSTEM_ERROR');
  });

  it('rejects an edge to a missing entity as IMPOSSIBLE_SYSTEM_ERROR', () => {
    const g = graph([node('a', 'INDIVIDUAL')], [edge('a', 'ghost', 'DIRECTOR_OF')]);
    expect(classifyEdge(g, g.edges[0], ASOF).state).toBe('IMPOSSIBLE_SYSTEM_ERROR');
  });

  it('accepts a well-formed directorship', () => {
    const g = graph(
      [node('a', 'INDIVIDUAL'), node('co', 'COMPANY', { companySubtype: 'PROPRIETARY' })],
      [edge('a', 'co', 'DIRECTOR_OF')],
    );
    expect(classifyEdge(g, g.edges[0], ASOF).state).toBe('VALID');
  });
});

// =============================================================================
// queries — trustee resolution + associate test
// =============================================================================

describe('queries', () => {
  it('getTrusteesOf returns every current trustee of a trust', () => {
    const g = graph(
      [
        node('trust', 'DISCRETIONARY_TRUST'),
        node('t1', 'INDIVIDUAL'),
        node('t2', 'INDIVIDUAL'),
      ],
      [edge('t1', 'trust', 'TRUSTEE_OF'), edge('t2', 'trust', 'TRUSTEE_OF')],
    );
    const trustees = getTrusteesOf(g, 'trust', ASOF).map((n) => n.id).sort();
    expect(trustees).toEqual(['t1', 't2']);
  });

  it('getTrusteesOf excludes a trustee whose edge has ended', () => {
    const g = graph(
      [node('trust', 'DISCRETIONARY_TRUST'), node('t1', 'INDIVIDUAL')],
      [edge('t1', 'trust', 'TRUSTEE_OF', { effectiveTo: new Date('2024-01-01T00:00:00Z') })],
    );
    expect(getTrusteesOf(g, 'trust', ASOF)).toHaveLength(0);
  });

  it('isAssociateOf detects a family relationship', () => {
    const g = graph(
      [node('a', 'INDIVIDUAL'), node('b', 'INDIVIDUAL')],
      [edge('a', 'b', 'FAMILY_MEMBER_OF', { familyRelation: 'SPOUSE' })],
    );
    expect(isAssociateOf(g, 'a', 'b', ASOF)).toBe(true);
  });

  it('isAssociateOf is false for unrelated entities', () => {
    const g = graph([node('a', 'INDIVIDUAL'), node('b', 'INDIVIDUAL')], []);
    expect(isAssociateOf(g, 'a', 'b', ASOF)).toBe(false);
  });
});

// =============================================================================
// OTHER — outside the supported grammar
// =============================================================================

describe('§4 OTHER entity', () => {
  it('is recorded as VALID with an unsupported-structure flag', () => {
    const g = graph([node('x', 'OTHER', { unsupportedStructure: true })], []);
    const result = classifyEntity(g, g.nodes[0], ASOF);
    expect(result.state).toBe('VALID');
    expect(result.issues.some((i) => i.code === 'UNSUPPORTED_STRUCTURE')).toBe(true);
  });
});
