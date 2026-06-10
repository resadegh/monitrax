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
    it('places >6 satellites in two rings (outer ring further from the parent)', () => {
      const many = snapshot({
        entities: [entity('you', 'PERSONAL_NAME'), entity('trust', 'DISCRETIONARY_TRUST')],
        assets: Array.from({ length: 9 }, (_, i) =>
          asset(`a-${i}`, 'account', 'trust', 10_000),
        ),
      });
      const result = layoutWealthExplorer(many, { expandedEntityIds: ['trust'] });
      const trust = result.nodes.find(n => n.id === 'trust')!;
      const sats = result.nodes.filter(n => n.tier === 'asset');
      expect(sats).toHaveLength(9);
      const dists = sats.map(s =>
        Math.hypot(s.position.x - trust.position.x, s.position.y - trust.position.y),
      );
      // After collision relaxation the exact radii shift, but the outer
      // ring must remain meaningfully further out than the inner ring.
      const sorted = [...dists].sort((a, b) => a - b);
      expect(sorted[sorted.length - 1]).toBeGreaterThan(sorted[0] * 1.3);
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
