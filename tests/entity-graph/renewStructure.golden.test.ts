/**
 * Phase 47 F-G — the GOLDEN acceptance test: Reza's advisor-drawn
 * "Renew Group Structure" chart, reproduced node-for-node in the
 * Phase 44 grammar and judged by the canonical engines.
 *
 * The chart (2026-06-12): trading company, bucket company, family
 * discretionary trust, two corporate trustees, SMSF, bare trust + bare
 * trustee holding an LRBA property for the SMSF, two individuals —
 * with directors, secretaries, shareholders (parcel detail [1 ORD] /
 * [500] / [50]), members, beneficiaries (incl. a company beneficiary),
 * ATF links and a spouse link.
 *
 * Asserts:
 *   1. every entity + edge classifies (no IMPOSSIBLE anywhere; the
 *      whole structure is representable),
 *   2. the SIS Act SMSF rules hold (corporate trustee whose directors
 *      are exactly the members),
 *   3. the universe layout renders every node with the right
 *      vocabulary (bare trust = trust, trustee companies = trustee
 *      vocabulary, individuals = people),
 *   4. the role templates make every chart row capturable for its type.
 *
 * Pure-layer test — graph shapes in memory, no DB. Service-level
 * persistence is covered by the Part 1b/2b service tests; the routes
 * are thin wrappers (§12.3).
 */

import { describe, it, expect } from 'vitest';
import type { EntityGraph, GraphNode, GraphEdge } from '@/lib/entity-graph/types';
import { classifyGraph } from '@/lib/entity-graph/validityMatrix';
import { roleTemplateFor } from '@/lib/entity-graph/roleTemplates';
import { layoutWealthExplorer } from '@/lib/data/wealthExplorerLayout';
import type { WealthGraphSnapshot } from '@/lib/services/wealthGraphService';

const ASOF = new Date('2026-06-12T00:00:00Z');

function node(
  id: string,
  type: GraphNode['type'],
  role: GraphNode['role'],
  overrides: Partial<GraphNode> = {},
): GraphNode {
  return {
    id,
    type,
    role,
    name: id,
    companySubtype: type === 'COMPANY' ? 'PROPRIETARY' : null,
    trustType:
      type === 'DISCRETIONARY_TRUST' ? 'DISCRETIONARY' : type === 'BARE_TRUST' ? 'OTHER' : null,
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
  type: GraphEdge['type'],
  to: string,
  overrides: Partial<GraphEdge> = {},
): GraphEdge {
  return {
    id: `e${++edgeSeq}`,
    fromEntityId: from,
    toEntityId: to,
    type,
    effectiveFrom: new Date('2019-03-14T00:00:00Z'),
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

/** The Renew chart as a Phase 44 graph. */
function renewGraph(): EntityGraph {
  const nodes: GraphNode[] = [
    node('reza', 'PERSONAL_NAME', 'PERSONAL'),
    node('newsha', 'INDIVIDUAL', 'PERSONAL'),
    node('group-holding', 'COMPANY', 'OPERATING'),    // trading company
    node('holding-co', 'COMPANY', 'HOLDING'),         // bucket company
    node('family-trust', 'DISCRETIONARY_TRUST', 'HOLDING'),
    node('investment-pty', 'COMPANY', 'CORPORATE_TRUSTEE'), // trustee of family trust
    node('smsf-pty', 'COMPANY', 'CORPORATE_TRUSTEE'), // SMSF trustee company
    node('renew-super', 'SMSF', 'SUPERANNUATION'),
    node('bare-pty', 'COMPANY', 'CORPORATE_TRUSTEE'), // bare trustee company
    node('bare-trust', 'BARE_TRUST', 'HOLDING'),      // LRBA holding trust
  ];

  const edges: GraphEdge[] = [
    // Family trust wiring
    edge('investment-pty', 'TRUSTEE_OF', 'family-trust'),
    edge('reza', 'BENEFICIARY_OF', 'family-trust', { beneficiaryClass: 'PRIMARY' }),
    edge('newsha', 'BENEFICIARY_OF', 'family-trust', { beneficiaryClass: 'PRIMARY' }),
    edge('holding-co', 'BENEFICIARY_OF', 'family-trust', { beneficiaryClass: 'GENERAL' }), // bucket company beneficiary
    // Trading company — trust holds the shares [100]
    edge('family-trust', 'SHAREHOLDER_OF', 'group-holding'),
    edge('reza', 'DIRECTOR_OF', 'group-holding'),
    // Corporate trustee (family trust) officers — [1 ORD] each
    edge('reza', 'DIRECTOR_OF', 'investment-pty'),
    edge('newsha', 'DIRECTOR_OF', 'investment-pty'),
    edge('reza', 'SHAREHOLDER_OF', 'investment-pty'),
    edge('newsha', 'SHAREHOLDER_OF', 'investment-pty'),
    // Bucket company — [500] each
    edge('reza', 'DIRECTOR_OF', 'holding-co'),
    edge('newsha', 'DIRECTOR_OF', 'holding-co'),
    edge('reza', 'SHAREHOLDER_OF', 'holding-co'),
    edge('newsha', 'SHAREHOLDER_OF', 'holding-co'),
    // SMSF — corporate trustee whose directors are exactly the members
    edge('smsf-pty', 'TRUSTEE_OF', 'renew-super'),
    edge('reza', 'MEMBER_OF', 'renew-super'),
    edge('newsha', 'MEMBER_OF', 'renew-super'),
    edge('reza', 'DIRECTOR_OF', 'smsf-pty'),
    edge('newsha', 'DIRECTOR_OF', 'smsf-pty'),
    edge('reza', 'SECRETARY_OF', 'smsf-pty'),
    edge('reza', 'SHAREHOLDER_OF', 'smsf-pty'), // [50] each
    edge('newsha', 'SHAREHOLDER_OF', 'smsf-pty'),
    // Bare trust (LRBA) — held for the SMSF
    edge('bare-pty', 'TRUSTEE_OF', 'bare-trust'),
    edge('renew-super', 'BENEFICIARY_OF', 'bare-trust'),
    edge('reza', 'DIRECTOR_OF', 'bare-pty'),
    edge('newsha', 'DIRECTOR_OF', 'bare-pty'),
    edge('reza', 'SECRETARY_OF', 'bare-pty'),
    edge('reza', 'SHAREHOLDER_OF', 'bare-pty'),
    edge('newsha', 'SHAREHOLDER_OF', 'bare-pty'),
    // Spouse link
    edge('reza', 'FAMILY_MEMBER_OF', 'newsha', { familyRelation: 'SPOUSE' }),
  ];

  return { nodes, edges };
}

describe('Phase 47 F-G — the Renew Group golden structure', () => {
  it('every entity and edge is representable — nothing classifies IMPOSSIBLE', () => {
    const report = classifyGraph(renewGraph(), ASOF);
    for (const [id, result] of report.entities) {
      expect(result.state, `entity ${id}: ${JSON.stringify(result.issues)}`).not.toBe(
        'IMPOSSIBLE_SYSTEM_ERROR',
      );
    }
    for (const [id, result] of report.edges) {
      expect(result.state, `edge ${id}: ${JSON.stringify(result.issues)}`).not.toBe(
        'IMPOSSIBLE_SYSTEM_ERROR',
      );
    }
    expect(report.trusteeCycle).toBeNull();
  });

  it('the SMSF passes the SIS Act member⇔director rules (corporate trustee)', () => {
    const report = classifyGraph(renewGraph(), ASOF);
    const smsf = report.entities.get('renew-super')!;
    expect(smsf.state, JSON.stringify(smsf.issues)).toBe('VALID');
  });

  it('the universe renders every chart node with the right vocabulary', () => {
    const g = renewGraph();
    const snapshot: WealthGraphSnapshot = {
      asOf: ASOF.toISOString(),
      userId: 'user-1',
      entities: g.nodes.map(n => ({
        id: n.id,
        type: n.type,
        role: n.role,
        name: n.name,
        abn: null,
        acn: null,
        trustType: n.trustType,
        parentEntityId: null,
        parentEntityName: null,
        ownedObjectsCount: {
          properties: 0,
          loans: 0,
          accounts: 0,
          investmentAccounts: 0,
          assets: 0,
        },
      })),
      assets: [
        {
          id: 'fairview',
          kind: 'property',
          ownerEntityId: 'bare-trust',
          name: '10 Fairview St, Guildford',
          value: 800_000,
          subtype: 'Investment Property',
          context: null,
        },
      ],
      relationships: g.edges.map(e => ({
        id: e.id,
        fromEntityId: e.fromEntityId,
        toEntityId: e.toEntityId,
        type: e.type,
        effectiveFrom: e.effectiveFrom.toISOString(),
        effectiveTo: null,
        state: 'VALID',
        accountantVerified: false,
        beneficiaryClass: e.beneficiaryClass,
        ownershipPercent: null,
      })),
      ownershipGroups: [],
      beneficialOverrides: [
        {
          id: 'bo1',
          legalOwnerEntityId: 'bare-trust',
          beneficialOwnerEntityId: 'renew-super',
          ownedObjectType: 'property',
          ownedObjectId: 'fairview',
          basis: 'BARE_TRUST',
          accountantVerified: false,
        },
      ],
      moneyFlows: [],
      moneyFlowFy: '',
      moneyFlowFyOptions: [],
    } as unknown as WealthGraphSnapshot;

    const layout = layoutWealthExplorer(snapshot);
    const byId = Object.fromEntries(layout.nodes.map(n => [n.id, n]));
    // All 10 chart entities render.
    for (const n of g.nodes) {
      expect(byId[n.id], `missing node ${n.id}`).toBeDefined();
    }
    // Vocabulary spot checks.
    expect(byId['reza'].type).toBe('individual');
    expect(byId['newsha'].type).toBe('individual');
    expect(byId['bare-trust'].type).toBe('trust');
    expect(byId['family-trust'].type).toBe('trust');
    expect(byId['renew-super'].type).toBe('smsf');
    expect(['trustee-company', 'smsf-trustee-company']).toContain(byId['smsf-pty'].type);
    expect(byId['investment-pty'].type).toBe('trustee-company');
  });

  it('every chart role row is capturable through its type template', () => {
    // Company file carries director/shareholder/secretary rows.
    const companyTypes = roleTemplateFor('COMPANY').flatMap(r => r.anyOf);
    expect(companyTypes).toEqual(
      expect.arrayContaining(['DIRECTOR_OF', 'SHAREHOLDER_OF', 'SECRETARY_OF']),
    );
    // Trust file carries trustee/beneficiary rows.
    expect(roleTemplateFor('DISCRETIONARY_TRUST').flatMap(r => r.anyOf)).toEqual(
      expect.arrayContaining(['TRUSTEE_OF', 'BENEFICIARY_OF']),
    );
    // SMSF file carries trustee/member rows.
    expect(roleTemplateFor('SMSF').flatMap(r => r.anyOf)).toEqual(
      expect.arrayContaining(['TRUSTEE_OF', 'MEMBER_OF']),
    );
    // Bare trust requires both trustee and held-for.
    expect(roleTemplateFor('BARE_TRUST').every(r => r.requirement === 'required')).toBe(true);
  });
});
