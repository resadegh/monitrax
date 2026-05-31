/**
 * Wealth Explorer — layout function.
 *
 * Pure function: given the user's real `LegalEntitySummary[]` from
 * `/api/entities`, returns positioned `WealthNode[]` + derived
 * `WealthRelationship[]` for the Wealth Universe canvas.
 *
 * Layout strategy:
 *   1. The user is always the gravitational anchor near centre-bottom.
 *   2. Entities cluster by role into spatial zones (corporate top-left,
 *      SMSF top-right, partnerships left-mid, sole-trader right-mid).
 *   3. Tile size scales with `ownedObjectsCount` — entities holding more
 *      wealth render larger (Apple Dock significance encoding).
 *   4. Parent → child relationships drive ribbon edges (sky for
 *      controls/trustee, emerald for owns, violet for beneficiary).
 *
 * Handles the empty/sparse case: 2 entities laid out cleanly, 20+
 * entities laid out without overlap, both look composed.
 */

import type {
  WealthNode,
  WealthNodeType,
  WealthRelationship,
} from './wealthExplorerTypes';

/** Subset of LegalEntitySummary that the layout actually needs. */
export interface LayoutEntityInput {
  id: string;
  name: string;
  type:
    | 'PERSONAL_NAME'
    | 'COMPANY'
    | 'DISCRETIONARY_TRUST'
    | 'UNIT_TRUST'
    | 'SMSF'
    | 'PARTNERSHIP'
    | 'SOLE_TRADER';
  role:
    | 'PERSONAL'
    | 'HOLDING'
    | 'OPERATING'
    | 'INVESTMENT'
    | 'SUPERANNUATION'
    | 'CORPORATE_TRUSTEE';
  abn: string | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  ownedObjectsCount: {
    properties: number;
    loans: number;
    accounts: number;
    investmentAccounts: number;
    assets: number;
  };
}

export interface LayoutResult {
  nodes: WealthNode[];
  relationships: WealthRelationship[];
  /** True when there's no real structure to render (only PERSONAL_NAME). */
  isEmpty: boolean;
}

/** Map LegalEntitySummary type+role into the WealthNode type vocabulary. */
function classifyEntity(
  e: Pick<LayoutEntityInput, 'type' | 'role'>,
): WealthNodeType {
  if (e.type === 'PERSONAL_NAME') return 'individual';
  if (e.type === 'SMSF') return 'smsf';
  if (e.type === 'DISCRETIONARY_TRUST' || e.type === 'UNIT_TRUST') return 'trust';
  // COMPANY / PARTNERSHIP / SOLE_TRADER — role decides
  if (e.role === 'HOLDING') return 'holding-company';
  if (e.role === 'CORPORATE_TRUSTEE') {
    // Could be trustee of a trust or an SMSF. Without explicit linkage,
    // default to trustee-company; the relationship phase below upgrades to
    // smsf-trustee-company when the entity is the parent of an SMSF.
    return 'trustee-company';
  }
  return 'other-company';
}

/** Tile size — scale with significance. */
function sizeFor(
  nodeType: WealthNodeType,
  ownedCount: number,
  isAnchor: boolean,
): number {
  if (isAnchor) return 96;
  if (nodeType === 'individual') return 76;
  if (nodeType === 'trust') return Math.min(88, 70 + ownedCount * 2);
  if (nodeType === 'smsf') return Math.min(84, 68 + ownedCount * 2);
  if (nodeType === 'trustee-company' || nodeType === 'smsf-trustee-company') return 52;
  if (nodeType === 'holding-company') return Math.min(72, 56 + ownedCount * 2);
  return Math.min(70, 56 + ownedCount * 2);
}

/** Spatial zones — % coords on a 100x100 canvas. */
const ZONES = {
  /** Companies + trusts cluster — upper-left arc. */
  corporate: { cx: 28, cy: 32, rx: 22, ry: 18 },
  /** SMSF cluster — upper-right arc. */
  smsf: { cx: 78, cy: 30, rx: 14, ry: 18 },
  /** Joint vehicles (partnership, joint trust) — mid-left. */
  joint: { cx: 18, cy: 56, rx: 10, ry: 12 },
  /** Sole trader — mid-right. */
  soleTrader: { cx: 84, cy: 56, rx: 8, ry: 10 },
  /** Individuals — centre-bottom band. */
  individuals: { cx: 50, cy: 68, rx: 16, ry: 6 },
};

/** Distribute N points along an elliptical arc inside a zone. */
function distributeInZone(
  zone: typeof ZONES.corporate,
  count: number,
  index: number,
): { x: number; y: number } {
  if (count === 1) return { x: zone.cx, y: zone.cy };
  // Use a partial arc — spread over ~140° so tiles don't crowd
  const startAngle = -Math.PI * 0.75;
  const endAngle = Math.PI * 0.05;
  const t = count > 1 ? index / (count - 1) : 0.5;
  const angle = startAngle + (endAngle - startAngle) * t;
  return {
    x: zone.cx + zone.rx * Math.cos(angle),
    y: zone.cy + zone.ry * Math.sin(angle),
  };
}

/**
 * Main layout. The caller hands in the LegalEntitySummary[] from the
 * API; we return positioned nodes + derived relationships.
 */
export function layoutWealthExplorer(entities: LayoutEntityInput[]): LayoutResult {
  // Phase 1 — partition entities by role/type.
  const personal: LayoutEntityInput[] = [];
  const corporate: LayoutEntityInput[] = []; // companies + trusts
  const smsfs: LayoutEntityInput[] = [];
  const joint: LayoutEntityInput[] = [];
  const soleTraders: LayoutEntityInput[] = [];

  for (const e of entities) {
    if (e.type === 'PERSONAL_NAME') personal.push(e);
    else if (e.type === 'SMSF') smsfs.push(e);
    else if (e.type === 'PARTNERSHIP') joint.push(e);
    else if (e.type === 'SOLE_TRADER') soleTraders.push(e);
    else corporate.push(e);
  }

  // Phase 2 — also identify SMSF-trustee companies (parent of an SMSF).
  const smsfParentIds = new Set(smsfs.map(s => s.parentEntityId).filter(Boolean));

  // Empty case: no real structure (just one personal-name entity).
  const isEmpty = corporate.length === 0 && smsfs.length === 0 &&
    joint.length === 0 && soleTraders.length === 0 && personal.length <= 1;

  // Phase 3 — assign positions.
  const nodes: WealthNode[] = [];

  // Individuals (PERSONAL_NAME) — first one is YOU anchor at zone centre.
  personal.forEach((e, idx) => {
    const nodeType = classifyEntity(e);
    const isAnchor = idx === 0;
    const ownedTotal = sumOwned(e.ownedObjectsCount);
    const size = sizeFor(nodeType, ownedTotal, isAnchor);
    const pos = personal.length === 1
      ? { x: ZONES.individuals.cx, y: ZONES.individuals.cy }
      : distributeInZone(ZONES.individuals, personal.length, idx);
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: isAnchor ? 'YOU' : e.name.split(' ')[0],
      subtitle: isAnchor ? 'You' : 'Household',
      position: pos,
      size,
      isAnchor,
    });
  });

  // Corporate cluster (companies + trusts).
  corporate.forEach((e, idx) => {
    let nodeType = classifyEntity(e);
    // Upgrade trustee companies that are parents of SMSFs.
    if (nodeType === 'trustee-company' && smsfParentIds.has(e.id)) {
      nodeType = 'smsf-trustee-company';
    }
    const ownedTotal = sumOwned(e.ownedObjectsCount);
    const size = sizeFor(nodeType, ownedTotal, false);
    const pos = distributeInZone(ZONES.corporate, corporate.length, idx);
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: shortenName(e.name),
      subtitle: subtitleFor(nodeType, e),
      position: pos,
      size,
    });
  });

  // SMSF cluster.
  smsfs.forEach((e, idx) => {
    const nodeType: WealthNodeType = 'smsf';
    const ownedTotal = sumOwned(e.ownedObjectsCount);
    const size = sizeFor(nodeType, ownedTotal, false);
    const pos = distributeInZone(ZONES.smsf, smsfs.length, idx);
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: shortenName(e.name),
      subtitle: 'Self-Managed Super Fund',
      position: pos,
      size,
    });
  });

  // Joint vehicles.
  joint.forEach((e, idx) => {
    const nodeType: WealthNodeType = 'other-company';
    const size = sizeFor(nodeType, sumOwned(e.ownedObjectsCount), false);
    const pos = distributeInZone(ZONES.joint, joint.length, idx);
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: shortenName(e.name),
      subtitle: 'Partnership',
      position: pos,
      size,
    });
  });

  // Sole traders.
  soleTraders.forEach((e, idx) => {
    const nodeType: WealthNodeType = 'other-company';
    const size = sizeFor(nodeType, sumOwned(e.ownedObjectsCount), false);
    const pos = distributeInZone(ZONES.soleTrader, soleTraders.length, idx);
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: shortenName(e.name),
      subtitle: 'Sole trader',
      position: pos,
      size,
    });
  });

  // Phase 4 — derive relationships.
  // Currently we only have parentEntityId from the API. That encodes
  // "trustee-of" / "shareholder-of" relationships in the Phase 41b
  // model. Richer relationships (beneficiary, member) will land when
  // the API exposes them; for now, parent edge is the single source.
  const relationships: WealthRelationship[] = [];
  for (const e of entities) {
    if (!e.parentEntityId) continue;
    const child = nodes.find(n => n.id === e.id);
    const parent = nodes.find(n => n.id === e.parentEntityId);
    if (!child || !parent) continue;

    // Trustee company → trust/SMSF: "ATF" (Acting as Trustee For)
    if (
      (parent.type === 'trustee-company' || parent.type === 'smsf-trustee-company') &&
      (child.type === 'trust' || child.type === 'smsf')
    ) {
      relationships.push({
        id: `r-atf-${parent.id}-${child.id}`,
        from: parent.id,
        to: child.id,
        type: 'trustee',
        label: 'ATF',
      });
      continue;
    }

    // Holding company → trustee-company / operating-company: "Owns"
    if (parent.type === 'holding-company') {
      relationships.push({
        id: `r-owns-${parent.id}-${child.id}`,
        from: parent.id,
        to: child.id,
        type: 'owns',
        label: 'Owns',
      });
      continue;
    }

    // Default fallback — "controls"
    relationships.push({
      id: `r-controls-${parent.id}-${child.id}`,
      from: parent.id,
      to: child.id,
      type: 'controls',
      label: 'Controls',
    });
  }

  return { nodes, relationships, isEmpty };
}

// ----- helpers ---------------------------------------------------------------

function sumOwned(c: LayoutEntityInput['ownedObjectsCount']): number {
  return c.properties + c.loans + c.accounts + c.investmentAccounts + c.assets;
}

function shortenName(name: string, max = 22): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trim() + '…';
}

function subtitleFor(
  nodeType: WealthNodeType,
  e: Pick<LayoutEntityInput, 'type' | 'role'>,
): string {
  if (nodeType === 'trust') {
    return e.type === 'DISCRETIONARY_TRUST' ? 'Discretionary Trust' : 'Unit Trust';
  }
  if (nodeType === 'holding-company') return 'Holding Co';
  if (nodeType === 'trustee-company') return 'Trustee Co';
  if (nodeType === 'smsf-trustee-company') return 'SMSF Trustee';
  if (nodeType === 'other-company') {
    if (e.role === 'OPERATING') return 'Operating';
    if (e.role === 'INVESTMENT') return 'Investment';
    return 'Company';
  }
  return '';
}
