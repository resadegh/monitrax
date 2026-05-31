/**
 * Wealth Explorer — layout function.
 *
 * Pure function: given the user's `WealthGraphSnapshot` from
 * `/api/wealth-graph`, returns positioned `WealthNode[]` + derived
 * `WealthRelationship[]` for the canvas.
 *
 * Layout strategy:
 *   1. The user (PERSONAL_NAME #1) is the gravitational anchor at
 *      centre-bottom.
 *   2. Entities cluster by role/type into spatial zones (corporate
 *      top-left, SMSF top-right, partnerships left-mid, sole-trader
 *      right-mid, individuals centre-bottom band).
 *   3. Each owned asset gets its own node in a small radial cluster
 *      BELOW its owning entity. Cluster radius + angle spacing scale
 *      with asset count so 1 asset sits directly below, 5 assets fan
 *      across a 180° arc.
 *   4. Joint-ownership groups (Phase 44 Q1) render as synthetic
 *      `ownership-group` nodes positioned between their members; the
 *      owned asset connects via the group, not directly.
 *   5. Beneficial-ownership overrides (Phase 44 Q2) render as DUAL
 *      chains — the legal chain dimmed (slate), the beneficial chain
 *      full-strength (violet). Visibility toggleable from the canvas
 *      lens switcher (not handled here — layout returns both, canvas
 *      decides which to show).
 *   6. Tile size scales with `ownedObjectsCount` — entities holding
 *      more wealth render larger (Apple Dock significance encoding).
 *
 * Ribbons:
 *   - `EntityRelationship` rows drive typed edges
 *     (BENEFICIARY_OF → violet, SHAREHOLDER_OF → emerald, etc.)
 *   - `parentEntityId` fallback synthesised as PARENT_OF edges in the
 *     service when no explicit relationship row exists.
 *   - Asset HOLDS edges generated here from each asset's
 *     `ownerEntityId` (or via the `ownership-group` synthetic node
 *     when applicable).
 *
 * SoT: Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`.
 */

import type {
  WealthGraphAsset,
  WealthGraphAssetKind,
  WealthGraphBeneficialOverride,
  WealthGraphEdge,
  WealthGraphEntity,
  WealthGraphMoneyFlow,
  WealthGraphOwnershipGroup,
  WealthGraphSnapshot,
} from '@/lib/services/wealthGraphService';
import type {
  WealthNode,
  WealthNodeType,
  WealthRelationship,
  RelationshipType,
} from './wealthExplorerTypes';

export interface LayoutResult {
  nodes: WealthNode[];
  relationships: WealthRelationship[];
  /** True when there's no real structure to render (only PERSONAL_NAME, no assets). */
  isEmpty: boolean;
}

/** Map LegalEntityType + role → canvas vocabulary. */
function classifyEntity(e: WealthGraphEntity): WealthNodeType {
  if (e.type === 'PERSONAL_NAME') return 'individual';
  if (e.type === 'SMSF') return 'smsf';
  if (e.type === 'DISCRETIONARY_TRUST' || e.type === 'UNIT_TRUST') return 'trust';
  if (e.role === 'HOLDING') return 'holding-company';
  if (e.role === 'CORPORATE_TRUSTEE') return 'trustee-company';
  return 'other-company';
}

/** Asset kind → canvas vocabulary. */
function classifyAsset(kind: WealthGraphAssetKind): WealthNodeType {
  switch (kind) {
    case 'property': return 'asset-property';
    case 'loan': return 'asset-loan';
    case 'account': return 'asset-cash';
    case 'investment-account': return 'asset-investment';
    case 'asset': return 'asset-vehicle'; // Asset table is currently vehicles + misc
  }
}

/** Tile size — significance encoding. */
function sizeForEntity(nodeType: WealthNodeType, ownedCount: number, isAnchor: boolean): number {
  if (isAnchor) return 96;
  if (nodeType === 'individual') return 76;
  if (nodeType === 'trust') return Math.min(88, 70 + ownedCount * 2);
  if (nodeType === 'smsf') return Math.min(84, 68 + ownedCount * 2);
  if (nodeType === 'trustee-company' || nodeType === 'smsf-trustee-company') return 52;
  if (nodeType === 'holding-company') return Math.min(72, 56 + ownedCount * 2);
  return Math.min(70, 56 + ownedCount * 2);
}

function sizeForAsset(): number {
  return 52;
}

const ZONES = {
  corporate: { cx: 28, cy: 30, rx: 22, ry: 16 },
  smsf: { cx: 78, cy: 28, rx: 14, ry: 16 },
  joint: { cx: 16, cy: 50, rx: 8, ry: 10 },
  soleTrader: { cx: 84, cy: 50, rx: 8, ry: 10 },
  individuals: { cx: 50, cy: 74, rx: 14, ry: 4 },
};

function distributeInZone(
  zone: typeof ZONES.corporate,
  count: number,
  index: number,
): { x: number; y: number } {
  if (count === 1) return { x: zone.cx, y: zone.cy };
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
 * Place N satellites around a parent position, biased to the lower
 * hemisphere (so assets sit "downstream" of their owning entity).
 * `radiusPct` = distance in canvas-percentage units.
 */
function placeSatellites(
  parent: { x: number; y: number },
  count: number,
  radiusPct: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: parent.x, y: parent.y + radiusPct }];
  // Spread across 200° arc below the parent (from 350° → 190° going clockwise),
  // skipping the top to keep the label readable.
  const startAngle = Math.PI * 0.15; // ~27° below horizontal-right
  const endAngle = Math.PI * 0.85;   // ~27° below horizontal-left
  const step = (endAngle - startAngle) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + step * i;
    return {
      x: parent.x + radiusPct * Math.cos(angle),
      y: parent.y + radiusPct * Math.sin(angle),
    };
  });
}

function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** EntityRelationship type → ribbon colour bucket. */
function ribbonTypeFor(
  edgeType: WealthGraphEdge['type'],
): RelationshipType {
  switch (edgeType) {
    case 'TRUSTEE_OF':
    case 'APPOINTOR_OF':
    case 'GUARDIAN_OF':
    case 'POWER_HOLDER_OF':
    case 'DIRECTOR_OF':
    case 'SECRETARY_OF':
    case 'PUBLIC_OFFICER_OF':
    case 'LEGAL_PERSONAL_REPRESENTATIVE_FOR':
    case 'EXECUTOR_OF':
    case 'ADMINISTRATOR_OF':
      return 'controls';
    case 'SHAREHOLDER_OF':
    case 'UNITHOLDER_OF':
    case 'PARTNER_OF':
      return 'owns';
    case 'BENEFICIARY_OF':
      return 'beneficiary';
    case 'MEMBER_OF':
      return 'member';
    case 'FAMILY_MEMBER_OF':
    case 'ASSOCIATE_OF':
      return 'household';
    case 'SETTLOR_OF':
    case 'OPERATES_AS_SOLE_TRADER':
    case 'PARENT_OF':
    default:
      return 'controls';
  }
}

function shortLabel(edgeType: WealthGraphEdge['type']): string {
  const map: Partial<Record<WealthGraphEdge['type'], string>> = {
    TRUSTEE_OF: 'ATF',
    APPOINTOR_OF: 'Appointor',
    BENEFICIARY_OF: 'Beneficiary',
    SHAREHOLDER_OF: 'Shareholder',
    UNITHOLDER_OF: 'Unitholder',
    DIRECTOR_OF: 'Director',
    SECRETARY_OF: 'Secretary',
    MEMBER_OF: 'Member',
    PARTNER_OF: 'Partner',
    FAMILY_MEMBER_OF: 'Family',
    LEGAL_PERSONAL_REPRESENTATIVE_FOR: 'LPR',
    POWER_HOLDER_OF: 'Power holder',
    SETTLOR_OF: 'Settlor',
    GUARDIAN_OF: 'Guardian',
    EXECUTOR_OF: 'Executor',
    ADMINISTRATOR_OF: 'Administrator',
    PUBLIC_OFFICER_OF: 'Public officer',
    OPERATES_AS_SOLE_TRADER: 'Sole trader',
    ASSOCIATE_OF: 'Associate',
    PARENT_OF: 'Controls',
  };
  return map[edgeType] ?? 'Linked';
}

// ===========================================================================
// Main
// ===========================================================================

export function layoutWealthExplorer(snapshot: WealthGraphSnapshot): LayoutResult {
  const {
    entities,
    assets,
    relationships,
    ownershipGroups,
    beneficialOverrides,
    moneyFlows,
  } = snapshot;

  const personal: WealthGraphEntity[] = [];
  const corporate: WealthGraphEntity[] = [];
  const smsfs: WealthGraphEntity[] = [];
  const joint: WealthGraphEntity[] = [];
  const soleTraders: WealthGraphEntity[] = [];

  for (const e of entities) {
    if (e.type === 'PERSONAL_NAME') personal.push(e);
    else if (e.type === 'SMSF') smsfs.push(e);
    else if (e.type === 'PARTNERSHIP') joint.push(e);
    else if (e.type === 'SOLE_TRADER') soleTraders.push(e);
    else corporate.push(e);
  }

  const smsfParentIds = new Set(smsfs.map(s => s.parentEntityId).filter(Boolean));

  const isEmpty = entities.length === 0 ||
    (corporate.length === 0 && smsfs.length === 0 &&
     joint.length === 0 && soleTraders.length === 0 &&
     personal.length <= 1 && assets.length === 0);

  const nodes: WealthNode[] = [];
  const nodePositionById = new Map<string, { x: number; y: number }>();

  // ---- Entity nodes
  function pushEntity(
    e: WealthGraphEntity,
    nodeType: WealthNodeType,
    pos: { x: number; y: number },
    isAnchor: boolean,
  ) {
    const ownedTotal = sumOwned(e.ownedObjectsCount);
    const size = sizeForEntity(nodeType, ownedTotal, isAnchor);
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: isAnchor ? 'YOU' : shortenName(e.name),
      subtitle: subtitleFor(nodeType, e),
      position: pos,
      size,
      isAnchor,
      tier: nodeType === 'individual' ? 'individual' : 'entity',
    });
    nodePositionById.set(e.id, pos);
  }

  personal.forEach((e, idx) => {
    const nodeType = classifyEntity(e);
    const isAnchor = idx === 0;
    const pos = personal.length === 1
      ? { x: ZONES.individuals.cx, y: ZONES.individuals.cy }
      : distributeInZone(ZONES.individuals, personal.length, idx);
    pushEntity(e, nodeType, pos, isAnchor);
  });

  corporate.forEach((e, idx) => {
    let nodeType = classifyEntity(e);
    if (nodeType === 'trustee-company' && smsfParentIds.has(e.id)) {
      nodeType = 'smsf-trustee-company';
    }
    const pos = distributeInZone(ZONES.corporate, corporate.length, idx);
    pushEntity(e, nodeType, pos, false);
  });

  smsfs.forEach((e, idx) => {
    const pos = distributeInZone(ZONES.smsf, smsfs.length, idx);
    pushEntity(e, 'smsf', pos, false);
  });

  joint.forEach((e, idx) => {
    const pos = distributeInZone(ZONES.joint, joint.length, idx);
    pushEntity(e, 'other-company', pos, false);
  });

  soleTraders.forEach((e, idx) => {
    const pos = distributeInZone(ZONES.soleTrader, soleTraders.length, idx);
    pushEntity(e, 'other-company', pos, false);
  });

  // ---- Joint ownership groups (synthetic nodes between members)
  // Build a map of (objectType,objectId) → group so we know which assets
  // route via a group instead of directly from their ownerEntityId.
  const groupByOwnedObject = new Map<string, WealthGraphOwnershipGroup>();
  ownershipGroups.forEach(g => {
    groupByOwnedObject.set(`${g.ownedObjectType}:${g.ownedObjectId}`, g);
  });

  const groupNodePositionById = new Map<string, { x: number; y: number }>();
  ownershipGroups.forEach(g => {
    const memberPositions = g.stakes
      .map(s => nodePositionById.get(s.entityId))
      .filter((p): p is { x: number; y: number } => !!p);
    if (memberPositions.length < 2) return;
    // Position the group at the centroid of its members, nudged slightly
    // downward so the owned asset can sit just below.
    const cx = memberPositions.reduce((s, p) => s + p.x, 0) / memberPositions.length;
    const cy = memberPositions.reduce((s, p) => s + p.y, 0) / memberPositions.length + 3;
    const pos = { x: cx, y: cy };
    groupNodePositionById.set(g.id, pos);
    nodes.push({
      id: `group-${g.id}`,
      type: 'ownership-group',
      name: g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'Tenants in common',
      shortName: g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'TIC',
      subtitle: `${g.stakes.length} owners`,
      position: pos,
      size: 36,
      tier: 'group',
    });
  });

  // ---- Asset nodes — placed in satellite arc below their owning entity
  // (or below the centroid of an OwnershipGroup if jointly held).
  const ownedAssetsByEntity = new Map<string, WealthGraphAsset[]>();
  const ownedAssetsByGroup = new Map<string, WealthGraphAsset[]>();
  for (const a of assets) {
    const groupKey = `${a.kind === 'investment-account' ? 'investmentAccount' : a.kind}:${a.id}`;
    const group = groupByOwnedObject.get(groupKey);
    if (group) {
      const arr = ownedAssetsByGroup.get(group.id) ?? [];
      arr.push(a);
      ownedAssetsByGroup.set(group.id, arr);
    } else {
      const arr = ownedAssetsByEntity.get(a.ownerEntityId) ?? [];
      arr.push(a);
      ownedAssetsByEntity.set(a.ownerEntityId, arr);
    }
  }

  const assetPositionById = new Map<string, { x: number; y: number }>();

  // Place entity-owned assets
  ownedAssetsByEntity.forEach((assetsForEntity, entityId) => {
    const parentPos = nodePositionById.get(entityId);
    if (!parentPos) return;
    const positions = placeSatellites(parentPos, assetsForEntity.length, 9);
    assetsForEntity.forEach((a, i) => {
      const pos = positions[i];
      assetPositionById.set(a.id, pos);
      nodes.push({
        id: a.id,
        type: classifyAsset(a.kind),
        name: a.name,
        shortName: shortenName(a.name, 16),
        subtitle: a.subtype ?? a.context ?? undefined,
        value: formatValue(a.value),
        position: pos,
        size: sizeForAsset(),
        ownerEntityId: a.ownerEntityId,
        tier: 'asset',
      });
    });
  });

  // Place group-owned assets just below the group node
  ownedAssetsByGroup.forEach((assetsForGroup, groupId) => {
    const groupPos = groupNodePositionById.get(groupId);
    if (!groupPos) return;
    const positions = placeSatellites(groupPos, assetsForGroup.length, 7);
    assetsForGroup.forEach((a, i) => {
      const pos = positions[i];
      assetPositionById.set(a.id, pos);
      nodes.push({
        id: a.id,
        type: classifyAsset(a.kind),
        name: a.name,
        shortName: shortenName(a.name, 16),
        subtitle: a.subtype ?? a.context ?? undefined,
        value: formatValue(a.value),
        position: pos,
        size: sizeForAsset(),
        ownerEntityId: a.ownerEntityId,
        tier: 'asset',
      });
    });
  });

  // ===== Ribbons =====

  const ribbons: WealthRelationship[] = [];

  // 1) EntityRelationship + PARENT_OF fallback edges
  for (const r of relationships) {
    if (!nodePositionById.has(r.fromEntityId) || !nodePositionById.has(r.toEntityId)) continue;
    ribbons.push({
      id: `rel-${r.id}`,
      from: r.fromEntityId,
      to: r.toEntityId,
      type: ribbonTypeFor(r.type),
      label: shortLabel(r.type),
    });
  }

  // 2) Asset HOLDS edges — entity → asset
  ownedAssetsByEntity.forEach((assetsForEntity, entityId) => {
    for (const a of assetsForEntity) {
      if (!nodePositionById.has(entityId) || !assetPositionById.has(a.id)) continue;
      ribbons.push({
        id: `holds-${a.id}`,
        from: entityId,
        to: a.id,
        type: 'holds',
        label: 'Holds',
      });
    }
  });

  // 3) OwnershipGroup edges:
  //    member entity → group → asset
  ownershipGroups.forEach(g => {
    const groupNodeId = `group-${g.id}`;
    if (!groupNodePositionById.has(g.id)) return;
    g.stakes.forEach(s => {
      if (!nodePositionById.has(s.entityId)) return;
      ribbons.push({
        id: `og-stake-${g.id}-${s.entityId}`,
        from: s.entityId,
        to: groupNodeId,
        type: 'owns',
        label: s.sharePct != null ? `${s.sharePct.toFixed(1)}%` : (g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'Co-owner'),
      });
    });
    const groupAssets = ownedAssetsByGroup.get(g.id) ?? [];
    for (const a of groupAssets) {
      if (!assetPositionById.has(a.id)) continue;
      ribbons.push({
        id: `og-holds-${g.id}-${a.id}`,
        from: groupNodeId,
        to: a.id,
        type: 'holds',
        label: 'Holds',
      });
    }
  });

  // 4) Beneficial-ownership overrides — dual chain rendering
  //    Render the BENEFICIAL edge at full strength (violet).
  //    The legal edge already exists via ownerEntityId; the canvas can
  //    dim those when the override toggle is on. For now we add the
  //    beneficial edge with the 'beneficiary' ribbon type.
  for (const o of beneficialOverrides) {
    if (!nodePositionById.has(o.beneficialOwnerEntityId)) continue;
    // The "asset" id is the owned-object id; if we placed it as a node,
    // wire the beneficial edge there.
    if (!assetPositionById.has(o.ownedObjectId)) continue;
    ribbons.push({
      id: `boo-${o.id}`,
      from: o.beneficialOwnerEntityId,
      to: o.ownedObjectId,
      type: 'beneficiary',
      label: 'Beneficial owner',
    });
  }

  // 5) Money flows (Phase 2) — distribution + dividend ribbons. Direction
  //    matches cash movement: from trust / company to beneficiary /
  //    shareholder. We only emit a ribbon if both endpoints are nodes on
  //    the canvas — otherwise the user would see a flow into nowhere.
  for (const f of moneyFlows) {
    if (!nodePositionById.has(f.fromEntityId)) continue;
    if (!nodePositionById.has(f.toEntityId)) continue;
    ribbons.push({
      id: f.id,
      from: f.fromEntityId,
      to: f.toEntityId,
      type: f.kind === 'distribution' ? 'flow-distribution' : 'flow-dividend',
      label: flowLabel(f),
      amount: f.amount,
      reformNotice: f.reformNotice ?? undefined,
    });
  }

  return { nodes, relationships: ribbons, isEmpty };
}

// ===========================================================================
// helpers
// ===========================================================================

function sumOwned(c: WealthGraphEntity['ownedObjectsCount']): number {
  return c.properties + c.loans + c.accounts + c.investmentAccounts + c.assets;
}

function shortenName(name: string, max = 22): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trim() + '…';
}

function subtitleFor(nodeType: WealthNodeType, e: WealthGraphEntity): string {
  if (nodeType === 'trust') {
    return e.type === 'DISCRETIONARY_TRUST' ? 'Discretionary Trust' : 'Unit Trust';
  }
  if (nodeType === 'holding-company') return 'Holding Co';
  if (nodeType === 'trustee-company') return 'Trustee Co';
  if (nodeType === 'smsf-trustee-company') return 'SMSF Trustee';
  if (nodeType === 'smsf') return 'Self-Managed Super Fund';
  if (nodeType === 'other-company') {
    if (e.role === 'OPERATING') return 'Operating';
    if (e.role === 'INVESTMENT') return 'Investment';
    return 'Company';
  }
  return '';
}

function formatValue(value: number): string {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toFixed(0)}`;
}

/** Phase 2 — money-flow ribbon label. */
function flowLabel(f: WealthGraphMoneyFlow): string {
  const amount = formatValue(f.amount);
  const verb = f.kind === 'distribution' ? 'Distribution' : 'Dividend';
  return `${verb} ${amount}`;
}
