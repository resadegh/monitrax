/**
 * Phase WX.4 — Wealth Universe semantic zoom.
 *
 * Pins the layout contract that fixes the "tiles shrink into an
 * unreadable smudge as node count grows" failure:
 *   - default (collapsed) layout emits NO asset satellites — entities
 *     carry `assetSummary` aggregates instead
 *   - `expandedEntityIds` unfolds exactly one constellation
 *   - `assetDetail: 'all'` restores the fully-expanded graph (the
 *     mobile bottom-sheet list depends on it)
 *   - loan principal never counts toward "$X held" (financial-adviser
 *     lens: debt is not held wealth)
 *   - >SATELLITE_RING_CAP satellites split into two rings
 *   - the collision pass keeps visible tiles from stacking
 */

import { describe, it, expect } from 'vitest';
import { layoutWealthExplorer } from '@/lib/data/wealthExplorerLayout';
import type {
  WealthGraphAsset,
  WealthGraphEntity,
  WealthGraphSnapshot,
} from '@/lib/services/wealthGraphService';

function entity(
  id: string,
  type: WealthGraphEntity['type'],
  overrides: Partial<WealthGraphEntity> = {},
): WealthGraphEntity {
  return {
    id,
    type,
    role: type === 'PERSONAL_NAME' ? 'PERSONAL' : 'HOLDING',
    name: id,
    abn: null,
    acn: null,
    trustType: null,
    parentEntityId: null,
    parentEntityName: null,
    ownedObjectsCount: { properties: 0, loans: 0, accounts: 0, investmentAccounts: 0, assets: 0 },
    ...overrides,
  } as WealthGraphEntity;
}

function asset(
  id: string,
  kind: WealthGraphAsset['kind'],
  ownerEntityId: string,
  value: number,
): WealthGraphAsset {
  return { id, kind, ownerEntityId, name: id, value, subtype: null, context: null };
}

function snapshot(overrides: Partial<WealthGraphSnapshot> = {}): WealthGraphSnapshot {
  return {
    asOf: '2026-06-10T00:00:00Z',
    userId: 'user-1',
    entities: [],
    assets: [],
    relationships: [],
    ownershipGroups: [],
    beneficialOverrides: [],
    moneyFlows: [],
    moneyFlowFy: '2025-26',
    moneyFlowFyOptions: ['2025-26'],
    ...overrides,
  } as WealthGraphSnapshot;
}

const baseSnapshot = () =>
  snapshot({
    entities: [
      entity('you', 'PERSONAL_NAME'),
      entity('trust', 'DISCRETIONARY_TRUST'),
      entity('smsf', 'SMSF'),
    ],
    assets: [
      asset('prop-1', 'property', 'trust', 1_400_000),
      asset('inv-1', 'investment-account', 'trust', 310_000),
      asset('cash-1', 'account', 'trust', 86_000),
      asset('loan-1', 'loan', 'trust', 612_000),
      asset('cash-2', 'account', 'smsf', 50_000),
    ],
  });

describe('Phase WX.4 — semantic zoom layout', () => {
  describe('Level 1 (collapsed, the default)', () => {
    it('emits no asset nodes', () => {
      const result = layoutWealthExplorer(baseSnapshot());
      expect(result.nodes.filter(n => n.tier === 'asset')).toHaveLength(0);
      expect(result.nodes.map(n => n.id).sort()).toEqual(['smsf', 'trust', 'you']);
    });

    it('aggregates holdings into assetSummary — loans count but their value does not', () => {
      const result = layoutWealthExplorer(baseSnapshot());
      const trust = result.nodes.find(n => n.id === 'trust')!;
      expect(trust.assetSummary).toEqual({
        count: 4, // property + investment + cash + loan
        totalValue: 1_400_000 + 310_000 + 86_000, // loan principal excluded
      });
      expect(trust.value).toBe('$1.8M held');
      expect(trust.isExpanded).toBe(false);
    });

    it('emits no holds ribbons for collapsed entities', () => {
      const result = layoutWealthExplorer(baseSnapshot());
      expect(result.relationships.filter(r => r.type === 'holds')).toHaveLength(0);
    });

    it('leaves entities without holdings unsummarised', () => {
      const result = layoutWealthExplorer(baseSnapshot());
      const you = result.nodes.find(n => n.id === 'you')!;
      expect(you.assetSummary).toBeUndefined();
      expect(you.value).toBeUndefined();
    });
  });

  describe('Level 2 (expandedEntityIds)', () => {
    it('unfolds only the requested constellation', () => {
      const result = layoutWealthExplorer(baseSnapshot(), { expandedEntityIds: ['trust'] });
      const assetNodes = result.nodes.filter(n => n.tier === 'asset');
      expect(assetNodes.map(n => n.id).sort()).toEqual(['cash-1', 'inv-1', 'loan-1', 'prop-1']);
      expect(assetNodes.every(n => n.parentNodeId === 'trust')).toBe(true);
      // The SMSF's holdings stay folded.
      expect(result.nodes.find(n => n.id === 'cash-2')).toBeUndefined();
    });

    it('marks the expanded entity and suppresses its "$X held" line', () => {
      const result = layoutWealthExplorer(baseSnapshot(), { expandedEntityIds: ['trust'] });
      const trust = result.nodes.find(n => n.id === 'trust')!;
      expect(trust.isExpanded).toBe(true);
      expect(trust.value).toBeUndefined();
      // Summary stays available (panel/list still read it).
      expect(trust.assetSummary?.count).toBe(4);
    });

    it('emits holds ribbons only for the unfolded constellation', () => {
      const result = layoutWealthExplorer(baseSnapshot(), { expandedEntityIds: ['trust'] });
      const holds = result.relationships.filter(r => r.type === 'holds');
      expect(holds).toHaveLength(4);
      expect(holds.every(r => r.from === 'trust')).toBe(true);
    });
  });

  describe("assetDetail: 'all' (pre-WX.4 behaviour, used by the mobile list)", () => {
    it('emits every asset node and holds ribbon', () => {
      const result = layoutWealthExplorer(baseSnapshot(), { assetDetail: 'all' });
      expect(result.nodes.filter(n => n.tier === 'asset')).toHaveLength(5);
      expect(result.relationships.filter(r => r.type === 'holds')).toHaveLength(5);
    });
  });

  describe('two-ring satellites', () => {
    it('places >8 assets of one class in two rings at Level 3 (outer ring further out)', () => {
      // WX.6 — focusing the ENTITY now bundles by class, so the
      // many-of-one-class spill happens one layer deeper: inside the
      // class bundle (Level 3 `cluster-<entity>-<kind>` focus scene).
      const many = snapshot({
        entities: [
          entity('you', 'PERSONAL_NAME'),
          entity('trust', 'DISCRETIONARY_TRUST'),
          entity('smsf', 'SMSF'),
        ],
        assets: Array.from({ length: 9 }, (_, i) =>
          asset(`a-${i}`, 'account', 'trust', 10_000),
        ),
      });
      // Focus the class bundle directly (the L3 scene the bundle opens).
      const result = layoutWealthExplorer(many, {
        expandedEntityIds: ['cluster-trust-account'],
      });
      const parent = result.nodes.find(n => n.id === 'cluster-trust-account')!;
      const sats = result.nodes.filter(n => n.tier === 'asset');
      expect(sats).toHaveLength(9);
      const dists = sats.map(s =>
        Math.hypot(s.position.x - parent.position.x, s.position.y - parent.position.y),
      );
      // The outer ring must remain meaningfully further out than the inner.
      const sorted = [...dists].sort((a, b) => a - b);
      expect(sorted[sorted.length - 1]).toBeGreaterThan(sorted[0] * 1.3);
    });
  });

  describe('cluster level (Phase WX.4.1 — ≤2 entities)', () => {
    // Reza's real shape (2026-06-10 mobile screenshot): ONE personal
    // entity holding everything directly. Entity-level collapse turned
    // the whole universe into a single tile with a "19" badge.
    const singleEntity = () =>
      snapshot({
        entities: [entity('you', 'PERSONAL_NAME')],
        assets: [
          asset('prop-1', 'property', 'you', 900_000),
          asset('prop-2', 'property', 'you', 700_000),
          asset('acc-1', 'account', 'you', 20_000),
          asset('acc-2', 'account', 'you', 30_000),
          asset('acc-3', 'account', 'you', 10_000),
          asset('inv-1', 'investment-account', 'you', 150_000),
          asset('loan-1', 'loan', 'you', 500_000),
          asset('loan-2', 'loan', 'you', 100_000),
        ],
      });

    it('clusters holdings by type instead of collapsing into the lone entity', () => {
      const result = layoutWealthExplorer(singleEntity());
      const clusters = result.nodes.filter(n => n.tier === 'cluster');
      expect(clusters.map(n => n.id).sort()).toEqual([
        'cluster-you-account',
        'cluster-you-loan',
        'cluster-you-property',
      ]);
      const accounts = clusters.find(n => n.id === 'cluster-you-account')!;
      expect(accounts.assetSummary).toEqual({ count: 3, totalValue: 60_000 });
      expect(accounts.shortName).toBe('Accounts');
      // Loan cluster reads "owing", never "held".
      const loans = clusters.find(n => n.id === 'cluster-you-loan')!;
      expect(loans.value).toBe('$600K owing');
    });

    it('renders singleton kinds directly — a cluster of one is noise', () => {
      const result = layoutWealthExplorer(singleEntity());
      expect(result.nodes.find(n => n.id === 'inv-1')).toBeDefined();
      expect(result.nodes.find(n => n.id === 'cluster-you-investment-account')).toBeUndefined();
    });

    it('hides the entity count badge but keeps its total line', () => {
      const result = layoutWealthExplorer(singleEntity());
      const you = result.nodes.find(n => n.id === 'you')!;
      expect(you.isExpanded).toBe(true); // suppresses the badge
      expect(you.value).toBe('$1.8M held'); // 900K+700K+60K+150K, loans excluded
    });

    it('expanding a cluster produces the FOCUSED SCENE (Phase WX.5 camera layer)', () => {
      const result = layoutWealthExplorer(singleEntity(), {
        expandedEntityIds: ['cluster-you-account'],
      });
      // The cluster re-centres as the scene's parent; its items ring it;
      // everything else leaves the stage (you are inside the bubble).
      const parent = result.nodes.find(n => n.id === 'cluster-you-account')!;
      // WX.5.3 — centre sits at y=52 so the ring clears the breadcrumb
      // text floating over the top band of the canvas.
      expect(parent.position).toEqual({ x: 50, y: 52 });
      expect(parent.isExpanded).toBe(true);
      const accountAssets = result.nodes.filter(
        n => n.tier === 'asset' && n.parentNodeId === 'cluster-you-account',
      );
      expect(accountAssets).toHaveLength(3);
      expect(result.nodes).toHaveLength(4); // parent + 3 satellites, nothing else
      const sceneRibbons = result.relationships.filter(r => r.id.startsWith('scene-holds-'));
      expect(sceneRibbons).toHaveLength(3);
      expect(sceneRibbons.every(r => r.from === 'cluster-you-account')).toBe(true);
    });

    it("never clusters in 'all' mode (the mobile list keeps real assets)", () => {
      const result = layoutWealthExplorer(singleEntity(), { assetDetail: 'all' });
      expect(result.nodes.filter(n => n.tier === 'cluster')).toHaveLength(0);
      expect(result.nodes.filter(n => n.tier === 'asset')).toHaveLength(8);
    });

    it('stays on entity-level collapse with 3+ entities', () => {
      const result = layoutWealthExplorer(baseSnapshot());
      expect(result.nodes.filter(n => n.tier === 'cluster')).toHaveLength(0);
    });

    // WX.5.3 (Reza 2026-06-11: "the first layer can be removed") — in
    // cluster mode the entity's all-holdings scene is a redundant
    // middle layer: the universe already splits the same holdings into
    // type clusters.
    it('marks the lone entity NOT expandable in cluster mode (clusters carry the way in)', () => {
      const result = layoutWealthExplorer(singleEntity());
      const you = result.nodes.find(n => n.id === 'you')!;
      expect(you.isExpandable).toBe(false);
      // The clusters themselves stay expandable.
      const clusters = result.nodes.filter(n => n.tier === 'cluster');
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.every(n => n.isExpandable)).toBe(true);
    });

    it('entity focus falls through to the universe in cluster mode (no all-holdings scene)', () => {
      const result = layoutWealthExplorer(singleEntity(), {
        expandedEntityIds: ['you'],
      });
      // No focused scene — the universe (with clusters) renders instead.
      expect(result.relationships.some(r => r.id.startsWith('scene-holds-'))).toBe(false);
      expect(result.nodes.filter(n => n.tier === 'cluster').length).toBeGreaterThan(0);
    });

    // Phase 47 F1 — the extended grammar renders with the right
    // universe vocabulary (the type label carries the precision).
    it('classifies the extended Phase 44 types into universe vocabulary', () => {
      const result = layoutWealthExplorer(
        snapshot({
          entities: [
            entity('you', 'PERSONAL_NAME'),
            entity('bare', 'BARE_TRUST'),
            entity('estate', 'DECEASED_ESTATE'),
            entity('custodian', 'CUSTODIAN_PLATFORM'),
            entity('foreign', 'FOREIGN_COMPANY', { role: 'OPERATING' }),
          ],
        }),
      );
      const byId = Object.fromEntries(result.nodes.map(n => [n.id, n]));
      expect(byId['bare'].type).toBe('trust');
      expect(byId['estate'].type).toBe('trust');
      expect(byId['custodian'].type).toBe('trustee-company');
      expect(byId['foreign'].type).toBe('other-company');
    });

    it('keeps entities expandable outside cluster mode (3+ entities)', () => {
      const result = layoutWealthExplorer(baseSnapshot());
      const expandables = result.nodes.filter(
        n => (n.tier === 'entity' || n.tier === 'individual') && n.assetSummary,
      );
      expect(expandables.length).toBeGreaterThan(0);
      expect(expandables.every(n => n.isExpandable)).toBe(true);
    });
  });

  describe('Phase 47 §4A — personal-tier ownership on the canvas', () => {
    // A joint property between the user and an INDIVIDUAL co-owner
    // (quick-created by the ownership picker) must be VISIBLE: the
    // co-owner renders as a person beside YOU, the group node carries
    // the aggregate, and the stake ribbons connect both owners.
    const jointSnapshot = () =>
      snapshot({
        entities: [
          entity('you', 'PERSONAL_NAME'),
          entity('sarah', 'INDIVIDUAL'),
        ],
        assets: [asset('prop-1', 'property', 'you', 1_400_000)],
        ownershipGroups: [
          {
            id: 'og1',
            ownedObjectType: 'property',
            ownedObjectId: 'prop-1',
            tenancyType: 'JOINT_TENANTS',
            stakes: [
              { entityId: 'you', sharePct: 50, survivorshipApplies: true },
              { entityId: 'sarah', sharePct: 50, survivorshipApplies: true },
            ],
          },
        ],
      } as Partial<WealthGraphSnapshot>);

    it('renders INDIVIDUAL co-owners as people, never companies', () => {
      const result = layoutWealthExplorer(jointSnapshot());
      const sarah = result.nodes.find(n => n.id === 'sarah')!;
      expect(sarah.type).toBe('individual');
      expect(sarah.tier).toBe('individual');
    });

    it('keeps YOU as the anchor regardless of entity order', () => {
      const flipped = jointSnapshot();
      flipped.entities.reverse(); // sarah first in fetch order
      const result = layoutWealthExplorer(flipped);
      expect(result.nodes.find(n => n.id === 'you')!.isAnchor).toBe(true);
      expect(result.nodes.find(n => n.id === 'sarah')!.isAnchor ?? false).toBe(false);
    });

    it('group node carries the Level 1 aggregate ("$X held" + badge) with warm naming', () => {
      const result = layoutWealthExplorer(jointSnapshot());
      const group = result.nodes.find(n => n.id === 'group-og1')!;
      expect(group.shortName).toBe('Joint');
      expect(group.assetSummary).toEqual({ count: 1, totalValue: 1_400_000 });
      expect(group.value).toBe('$1.4M held');
      // Both owners connect to the group via stake ribbons.
      const stakeRibbons = result.relationships.filter(r => r.to === 'group-og1');
      expect(stakeRibbons.map(r => r.from).sort()).toEqual(['sarah', 'you']);
    });

    it('unfolding the group reveals the jointly-held asset', () => {
      const result = layoutWealthExplorer(jointSnapshot(), {
        expandedEntityIds: ['group-og1'],
      });
      const prop = result.nodes.find(n => n.id === 'prop-1')!;
      expect(prop.parentNodeId).toBe('group-og1');
      const group = result.nodes.find(n => n.id === 'group-og1')!;
      expect(group.value).toBeUndefined(); // aggregate folds away when open
    });
  });

  describe('collision relaxation', () => {
    it('keeps visible tiles from stacking on top of each other', () => {
      const crowded = snapshot({
        entities: [
          entity('you', 'PERSONAL_NAME'),
          ...Array.from({ length: 6 }, (_, i) => entity(`co-${i}`, 'COMPANY')),
        ],
      });
      const result = layoutWealthExplorer(crowded);
      const nodes = result.nodes;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(
            a.position.x - b.position.x,
            a.position.y - b.position.y,
          );
          // No pair may sit closer than ~half the enforced min distance
          // (the pass is iterative, not exact — we assert "not stacked").
          const minDist = ((a.size + b.size) / 2 + 14) * 0.1;
          expect(dist).toBeGreaterThan(minDist * 0.5);
        }
      }
    });

    it('is deterministic — same input, same output', () => {
      const a = layoutWealthExplorer(baseSnapshot());
      const b = layoutWealthExplorer(baseSnapshot());
      expect(a.nodes.map(n => ({ id: n.id, ...n.position }))).toEqual(
        b.nodes.map(n => ({ id: n.id, ...n.position })),
      );
    });
  });
});

describe('Phase WX.6 — Level 2 asset-class bundles (2026-06-18)', () => {
  // Reza's case: a multi-entity universe (so NOT cluster mode) where one
  // entity holds many assets across classes. Focusing it used to dump
  // every raw tile at once ("messy"); now it groups them into per-class
  // bundle bubbles that zoom into their assets at Level 3.
  const bundleSnapshot = () =>
    snapshot({
      entities: [
        entity('you', 'PERSONAL_NAME'),
        entity('trust', 'DISCRETIONARY_TRUST'),
        entity('smsf', 'SMSF'),
      ],
      assets: [
        // YOU holds a mixed bag: 3 properties, 2 loans, 2 investments,
        // 1 vehicle, 1 cash account.
        asset('prop-1', 'property', 'you', 500_000),
        asset('prop-2', 'property', 'you', 400_000),
        asset('prop-3', 'property', 'you', 300_000),
        asset('loan-1', 'loan', 'you', 200_000),
        asset('loan-2', 'loan', 'you', 100_000),
        asset('inv-1', 'investment-account', 'you', 150_000),
        asset('inv-2', 'investment-account', 'you', 100_000),
        asset('car-1', 'asset', 'you', 80_000),
        asset('cash-1', 'account', 'you', 20_000),
        // the other entities just need a holding so they render at L1.
        asset('t-prop', 'property', 'trust', 900_000),
        asset('s-inv', 'investment-account', 'smsf', 250_000),
      ],
    });

  it('focusing an entity groups its holdings into per-class bundles, not raw tiles', () => {
    const result = layoutWealthExplorer(bundleSnapshot(), { expandedEntityIds: ['you'] });
    const bundles = result.nodes.filter(n => n.tier === 'cluster');
    expect(bundles.map(n => n.id).sort()).toEqual([
      'cluster-you-investment-account',
      'cluster-you-loan',
      'cluster-you-property',
    ]);
    expect(bundles.every(n => n.isExpandable && n.parentNodeId === 'you')).toBe(true);
    const props = bundles.find(n => n.id === 'cluster-you-property')!;
    expect(props.assetSummary).toEqual({ count: 3, totalValue: 1_200_000 });
    expect(props.shortName).toBe('Properties');
    expect(props.value).toBe('$1.2M');
    // The focused entity re-centres and nothing else is on stage.
    const centre = result.nodes.find(n => n.id === 'you')!;
    expect(centre.isExpanded).toBe(true);
    expect(centre.position).toEqual({ x: 50, y: 52 });
    expect(result.nodes.find(n => n.id === 'trust')).toBeUndefined();
    expect(result.nodes.find(n => n.id === 'smsf')).toBeUndefined();
  });

  it('renders single-asset classes directly — a "1 Vehicle" bundle is noise', () => {
    const result = layoutWealthExplorer(bundleSnapshot(), { expandedEntityIds: ['you'] });
    // car (1 'asset') + cash (1 'account') render as their own tiles…
    expect(result.nodes.find(n => n.id === 'car-1')?.tier).toBe('asset');
    expect(result.nodes.find(n => n.id === 'cash-1')?.tier).toBe('asset');
    // …not as bundles.
    expect(result.nodes.find(n => n.id === 'cluster-you-asset')).toBeUndefined();
    expect(result.nodes.find(n => n.id === 'cluster-you-account')).toBeUndefined();
  });

  it('loans bundle reads "owing" and never counts toward the held total', () => {
    const result = layoutWealthExplorer(bundleSnapshot(), { expandedEntityIds: ['you'] });
    const loans = result.nodes.find(n => n.id === 'cluster-you-loan')!;
    expect(loans.value).toBe('$300K owing');
    // held total on the centre excludes loan principal:
    // props 1.2M + invs 250K + car 80K + cash 20K = 1.55M
    const centre = result.nodes.find(n => n.id === 'you')!;
    expect(centre.assetSummary).toEqual({ count: 9, totalValue: 1_550_000 });
  });

  it('emits bundle "holds" ribbons from the entity to each bundle / direct asset', () => {
    const result = layoutWealthExplorer(bundleSnapshot(), { expandedEntityIds: ['you'] });
    const bundleRibbons = result.relationships.filter(r => r.id.startsWith('scene-bundle-'));
    expect(bundleRibbons).toHaveLength(3); // property, loan, investment bundles
    expect(bundleRibbons.every(r => r.from === 'you')).toBe(true);
    const directRibbons = result.relationships.filter(r => r.id.startsWith('scene-holds-'));
    expect(directRibbons.map(r => r.to).sort()).toEqual(['car-1', 'cash-1']);
  });

  it('Level 3: the focus STACK descends — [entity, bundle] opens the class scene', () => {
    const result = layoutWealthExplorer(bundleSnapshot(), {
      expandedEntityIds: ['you', 'cluster-you-property'],
    });
    // The LAST stack id is the active focus → the property class scene.
    const parent = result.nodes.find(n => n.id === 'cluster-you-property')!;
    expect(parent.isExpanded).toBe(true);
    expect(parent.position).toEqual({ x: 50, y: 52 });
    // Breadcrumb support: the cluster scene carries the entity name on
    // its subtitle so the canvas can render "Universe ‹ you ‹ Properties".
    expect(parent.subtitle).toBe('you');
    const propAssets = result.nodes.filter(
      n => n.tier === 'asset' && n.parentNodeId === 'cluster-you-property',
    );
    expect(propAssets.map(n => n.id).sort()).toEqual(['prop-1', 'prop-2', 'prop-3']);
    // Nothing from the entity layer leaks in.
    expect(result.nodes.find(n => n.id === 'cluster-you-loan')).toBeUndefined();
    expect(result.nodes.find(n => n.id === 'car-1')).toBeUndefined();
  });

  it('cluster mode (≤2 entities) is unaffected — bundles still live on the universe', () => {
    // A single-entity universe keeps the WX.4.1 behaviour: clusters on
    // L1, no entity-focus bundle scene.
    const single = snapshot({
      entities: [entity('you', 'PERSONAL_NAME')],
      assets: [
        asset('p1', 'property', 'you', 500_000),
        asset('p2', 'property', 'you', 400_000),
      ],
    });
    const focused = layoutWealthExplorer(single, { expandedEntityIds: ['you'] });
    // Entity focus falls through to the universe (clusters present), it
    // does NOT build the WX.6 bundle scene.
    expect(focused.relationships.some(r => r.id.startsWith('scene-bundle-'))).toBe(false);
    expect(focused.nodes.filter(n => n.tier === 'cluster').length).toBeGreaterThan(0);
  });
});

describe('Phase 47 E2 — per-entity tax status pass-through', () => {
  it('carries WealthGraphEntity.taxStatus onto the entity node', () => {
    const result = layoutWealthExplorer(
      snapshot({
        entities: [
          entity('you', 'PERSONAL_NAME', { taxStatus: { computed: true, caveatCount: 0 } }),
          entity('trust', 'DISCRETIONARY_TRUST', { taxStatus: { computed: false, caveatCount: 2 } }),
        ],
        assets: [asset('prop-1', 'property', 'trust', 1_000_000)],
      }),
    );
    expect(result.nodes.find(n => n.id === 'you')!.taxStatus).toEqual({ computed: true, caveatCount: 0 });
    expect(result.nodes.find(n => n.id === 'trust')!.taxStatus).toEqual({ computed: false, caveatCount: 2 });
  });

  it('leaves taxStatus undefined on the node when the entity has none', () => {
    const result = layoutWealthExplorer(
      snapshot({ entities: [entity('you', 'PERSONAL_NAME')] }),
    );
    expect(result.nodes.find(n => n.id === 'you')!.taxStatus).toBeUndefined();
  });
});

describe('Level-1 balanced orbit (Phase 47 universe recomposition, 2026-06-18)', () => {
  // A dense, mixed structure like Reza's Renew group: 1 person + 2 trusts +
  // 1 SMSF + 4 companies = 8 entities. The old zone-scatter overlapped at
  // this size; the orbit must place every tile cleanly around YOU.
  const denseSnapshot = () =>
    snapshot({
      entities: [
        entity('you', 'PERSONAL_NAME'),
        entity('t1', 'DISCRETIONARY_TRUST'),
        entity('t2', 'UNIT_TRUST'),
        entity('smsf', 'SMSF'),
        entity('c1', 'COMPANY'),
        entity('c2', 'COMPANY'),
        entity('c3', 'COMPANY'),
        entity('c4', 'COMPANY'),
      ],
      // one asset each so every entity carries a summary (and is rendered)
      assets: [
        asset('a1', 'property', 't1', 500_000),
        asset('a2', 'property', 't2', 400_000),
        asset('a3', 'investment-account', 'smsf', 300_000),
        asset('a4', 'property', 'c1', 200_000),
        asset('a5', 'property', 'c2', 200_000),
        asset('a6', 'property', 'c3', 200_000),
        asset('a7', 'property', 'you', 600_000),
      ],
    });

  function entityNodes(result: ReturnType<typeof layoutWealthExplorer>) {
    return result.nodes.filter(n => n.tier === 'entity' || n.tier === 'individual');
  }

  function assertNoOverlap(result: ReturnType<typeof layoutWealthExplorer>) {
    const tiles = entityNodes(result);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i], b = tiles[j];
        const dist = Math.hypot(
          a.position.x - b.position.x,
          a.position.y - b.position.y,
        );
        // Center-to-center separation in canvas-% must exceed the tiles'
        // combined radii (size px → % at 0.1). A small slack absorbs
        // edge-clamping. The bug was tiles stacking (dist ≈ 0).
        const minSep = ((a.size + b.size) / 2) * 0.1 * 0.8;
        expect(dist).toBeGreaterThan(minSep);
      }
    }
  }

  it('desktop: YOU is the centred anchor and no entity tiles overlap', () => {
    const result = layoutWealthExplorer(denseSnapshot(), { viewport: 'desktop' });
    const you = result.nodes.find(n => n.id === 'you')!;
    expect(you.isAnchor).toBe(true);
    expect(you.position).toEqual({ x: 50, y: 48 });
    expect(entityNodes(result).length).toBe(8);
    assertNoOverlap(result);
  });

  it('mobile: YOU is anchored low and the entities fan above it, no overlap', () => {
    const result = layoutWealthExplorer(denseSnapshot(), { viewport: 'mobile' });
    const you = result.nodes.find(n => n.id === 'you')!;
    expect(you.position).toEqual({ x: 50, y: 64 });
    // every orbiting entity sits above the low anchor
    const orbit = entityNodes(result).filter(n => n.id !== 'you');
    expect(orbit.length).toBe(7);
    expect(orbit.every(n => n.position.y < you.position.y)).toBe(true);
    assertNoOverlap(result);
  });

  it('defaults to the desktop orbit when no viewport is given', () => {
    const result = layoutWealthExplorer(denseSnapshot());
    expect(result.nodes.find(n => n.id === 'you')!.position).toEqual({ x: 50, y: 48 });
  });
});
