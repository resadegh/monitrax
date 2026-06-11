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
 *   7. SEMANTIC ZOOM (Phase WX.4, 2026-06-10). By default the layout is
 *      "Level 1 · Universe": asset satellites are NOT emitted — each
 *      entity/group node instead carries an `assetSummary` (count +
 *      non-loan total) that the canvas renders as a count badge and a
 *      "$X held" line. Passing `expandedEntityIds` unfolds the
 *      satellites of just those entities ("Level 2 · constellation"),
 *      in one arc for ≤5 assets or two concentric rings beyond that.
 *      `assetDetail: 'all'` restores the pre-WX.4 fully-expanded graph
 *      (used by the mobile bottom-sheet list, which enumerates assets).
 *      A final deterministic collision-relaxation pass keeps visible
 *      tiles from overlapping as structures grow.
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
 * Semantic-zoom SoT: screens `770687a1c73c42f0b4fd5686782bf5f3` (L1
 * desktop), `068403f1296440508b601c2fc32d5e20` (L2 desktop),
 * `e5ecb8d170cc4fbdbc336413cd9948d2` (L1 mobile),
 * `80c21d51c38242d883bec3d6875fabe6` (widget) —
 * `.stitch/designs/wealth-universe-zoom/*.{html,png}`.
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

export interface LayoutOptions {
  /**
   * Semantic-zoom detail level (Phase WX.4).
   *  - 'collapsed' (default) — Level 1: no asset satellites; entities
   *    carry `assetSummary` instead. Entities listed in
   *    `expandedEntityIds` still unfold their constellation.
   *  - 'all' — every asset rendered as its own node (pre-WX.4
   *    behaviour; used by list surfaces that enumerate assets).
   */
  assetDetail?: 'collapsed' | 'all';
  /**
   * Entity ids (or `group-<id>` synthetic ids) whose asset satellites
   * should unfold at Level 2. Ignored when `assetDetail` is 'all'.
   */
  expandedEntityIds?: ReadonlyArray<string>;
}

export interface LayoutResult {
  nodes: WealthNode[];
  relationships: WealthRelationship[];
  /** True when there's no real structure to render (only PERSONAL_NAME, no assets). */
  isEmpty: boolean;
  /**
   * Phase 2 enhancement — drives the canvas FY-slider. `fy` is the
   * default selection (most recent FY with CONFIRMED data); `fyOptions`
   * is every FY with data, descending. Passed through from the
   * service.
   */
  moneyFlowFy: string;
  moneyFlowFyOptions: string[];
}

/** Map LegalEntityType + role → canvas vocabulary. */
function classifyEntity(e: WealthGraphEntity): WealthNodeType {
  // INDIVIDUAL = a natural person modelled as an entity (Phase 47 §4A —
  // joint/shared co-owners quick-created by the ownership picker). They
  // are people, not companies — same vocabulary as the user's own tile.
  if (e.type === 'PERSONAL_NAME' || e.type === 'INDIVIDUAL') return 'individual';
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
    case 'super': return 'asset-investment'; // Phase 47 B1 — super on the universe
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

/** Spread N points across the lower arc below a parent. */
function arcBelow(
  parent: { x: number; y: number },
  count: number,
  radiusPct: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: parent.x, y: parent.y + radiusPct }];
  // Spread across the arc below the parent, skipping the top to keep
  // the label readable.
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

/**
 * Fan N points across the UPPER arc above a parent — used by the
 * cluster level (Phase WX.4.1) where the lone anchor entity sits in the
 * bottom band and its type-clusters spread above it, mirroring the
 * Stitch L1 composition (entities above YOU).
 */
function fanAbove(
  parent: { x: number; y: number },
  count: number,
  radiusPct: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: parent.x, y: parent.y - radiusPct }];
  const startAngle = -Math.PI * 0.9; // ~18° above horizontal-left
  const endAngle = -Math.PI * 0.1;   // ~18° above horizontal-right
  const step = (endAngle - startAngle) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + step * i;
    return {
      x: parent.x + radiusPct * 1.4 * Math.cos(angle),
      y: parent.y + radiusPct * Math.sin(angle),
    };
  });
}

/** Full ring around a centred parent — the focused-scene satellite layout. */
function ringAround(
  parent: { x: number; y: number },
  count: number,
  radiusPct: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: parent.x, y: parent.y + radiusPct }];
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return {
      // Slight horizontal stretch — canvases are wider than tall.
      x: parent.x + radiusPct * 1.25 * Math.cos(angle),
      y: parent.y + radiusPct * Math.sin(angle),
    };
  });
}

/** Satellites per ring before the constellation spills outward. */
const SATELLITE_RING_CAP = 6;

/**
 * Place N satellites around a parent position, biased to the lower
 * hemisphere (so assets sit "downstream" of their owning entity).
 * `radiusPct` = distance in canvas-percentage units. Beyond
 * SATELLITE_RING_CAP the satellites split into two concentric rings —
 * cramming one arc is exactly the overlap failure semantic zoom exists
 * to fix (Phase WX.4).
 */
function placeSatellites(
  parent: { x: number; y: number },
  count: number,
  radiusPct: number,
): Array<{ x: number; y: number }> {
  if (count <= SATELLITE_RING_CAP) return arcBelow(parent, count, radiusPct);
  const inner = arcBelow(parent, SATELLITE_RING_CAP, radiusPct);
  const outer = arcBelow(parent, count - SATELLITE_RING_CAP, radiusPct * 1.7);
  return [...inner, ...outer];
}

/**
 * Deterministic collision relaxation (Phase WX.4). Node positions are
 * canvas-% but sizes are px, so we approximate 1% ≈ 10px (the canvas
 * renders ≥1000px wide on desktop; on smaller surfaces tiles also
 * shrink, so the approximation degrades gracefully). Pairs closer than
 * their combined radii + a gap get pushed apart along their axis. The
 * YOU anchor never moves — it is the layout's gravitational fixpoint.
 * Mutates positions in place so `nodePositionById` references stay
 * valid.
 */
const PCT_PER_PX = 0.1;
function relaxCollisions(nodes: WealthNode[], iterations = 8): void {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const minDist = ((a.size + b.size) / 2 + 14) * PCT_PER_PX;
        let dx = b.position.x - a.position.x;
        let dy = b.position.y - a.position.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.01) {
          // Perfectly stacked — deterministic diagonal nudge.
          dx = 0.5;
          dy = 0.25;
          dist = Math.hypot(dx, dy);
        }
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        if (a.isAnchor) {
          nudge(b, ux * push * 2, uy * push * 2);
        } else if (b.isAnchor) {
          nudge(a, -ux * push * 2, -uy * push * 2);
        } else {
          nudge(a, -ux * push, -uy * push);
          nudge(b, ux * push, uy * push);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function nudge(n: WealthNode, dx: number, dy: number): void {
  n.position.x = Math.min(94, Math.max(6, n.position.x + dx));
  n.position.y = Math.min(92, Math.max(8, n.position.y + dy));
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

export function layoutWealthExplorer(
  snapshot: WealthGraphSnapshot,
  options: LayoutOptions = {},
): LayoutResult {
  const {
    entities,
    assets,
    relationships,
    ownershipGroups,
    beneficialOverrides,
    moneyFlows,
    moneyFlowFy,
    moneyFlowFyOptions,
  } = snapshot;

  // ---- Semantic zoom (Phase WX.4)
  const detail = options.assetDetail ?? 'collapsed';
  const expandedIds = new Set(options.expandedEntityIds ?? []);
  const isUnfolded = (parentNodeId: string): boolean =>
    detail === 'all' || expandedIds.has(parentNodeId);
  // Phase WX.5 (Reza 2026-06-10: "the camera moves to the next layer and
  // expands that bubble into the page") — a SINGLE expanded id in
  // collapsed mode produces a FOCUSED SCENE: the bubble re-centres and
  // enlarges, its items form a clean ring filling the canvas, and every
  // other node leaves the stage (you are INSIDE the bubble now — the
  // breadcrumb is the way back). The canvas animates between scenes with
  // a camera zoom; this function just returns each layer's composition.
  const focusId =
    detail === 'collapsed' && expandedIds.size === 1 ? [...expandedIds][0] : null;

  // Cluster level (Phase WX.4.1) — entity-level collapse only works
  // when there ARE entities to collapse into. A single-entity universe
  // (most users pre-trust) would collapse into one tile with a badge —
  // technically correct, completely useless. With ≤2 entities, Level 1
  // instead clusters each entity's holdings BY TYPE into aggregate
  // tiles ("3 Properties · $2.1M"); clicking a cluster unfolds that
  // type's assets. Keeps the canvas in the 3–9 tile sweet spot at any
  // structure size.
  const CLUSTER_MODE_MAX_ENTITIES = 2;
  const clusterMode = detail === 'collapsed' && entities.length <= CLUSTER_MODE_MAX_ENTITIES;

  // ---- Asset grouping — computed up-front so each entity/group tile
  // can carry its aggregate summary at Level 1. Build a map of
  // (objectType,objectId) → group so we know which assets route via a
  // group instead of directly from their ownerEntityId.
  const groupByOwnedObject = new Map<string, WealthGraphOwnershipGroup>();
  ownershipGroups.forEach(g => {
    groupByOwnedObject.set(`${g.ownedObjectType}:${g.ownedObjectId}`, g);
  });

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

  // Aggregate for the Level 1 count badge + "$X held" line. The value
  // sums NON-LOAN holdings only — loan principal is debt, and counting
  // it as "held" wealth would overstate (financial-adviser lens). The
  // count includes loans (they are real holdings to explore).
  const summarize = (
    held: WealthGraphAsset[] | undefined,
  ): { count: number; totalValue: number } | undefined => {
    if (!held || held.length === 0) return undefined;
    const totalValue = held
      .filter(a => a.kind !== 'loan')
      .reduce((sum, a) => sum + (isFinite(a.value) ? a.value : 0), 0);
    return { count: held.length, totalValue };
  };

  const personal: WealthGraphEntity[] = [];
  const corporate: WealthGraphEntity[] = [];
  const smsfs: WealthGraphEntity[] = [];
  const joint: WealthGraphEntity[] = [];
  const soleTraders: WealthGraphEntity[] = [];

  for (const e of entities) {
    // INDIVIDUAL co-owners (Phase 47 §4A) live in the personal band
    // beside the user — they are people, not corporate structures.
    if (e.type === 'PERSONAL_NAME' || e.type === 'INDIVIDUAL') personal.push(e);
    else if (e.type === 'SMSF') smsfs.push(e);
    else if (e.type === 'PARTNERSHIP') joint.push(e);
    else if (e.type === 'SOLE_TRADER') soleTraders.push(e);
    else corporate.push(e);
  }
  // The user's own PERSONAL_NAME tile is always the anchor — keep it
  // first regardless of fetch order so INDIVIDUAL co-owners never steal
  // the YOU ring.
  personal.sort((a, b) =>
    (a.type === 'PERSONAL_NAME' ? 0 : 1) - (b.type === 'PERSONAL_NAME' ? 0 : 1),
  );

  const smsfParentIds = new Set(smsfs.map(s => s.parentEntityId).filter(Boolean));

  const isEmpty = entities.length === 0 ||
    (corporate.length === 0 && smsfs.length === 0 &&
     joint.length === 0 && soleTraders.length === 0 &&
     personal.length <= 1 && assets.length === 0);

  // ---- Phase WX.5: focused-scene early return (the inner layer).
  // WX.5.3 (Reza 2026-06-11): centre sits at y=52 (was 42) so the top
  // satellite of the ring clears the breadcrumb / trail text that
  // floats over the top band of the canvas.
  if (focusId) {
    const CENTRE = { x: 50, y: 52 };
    let parentNode: WealthNode | null = null;
    let sceneAssets: WealthGraphAsset[] = [];

    if (focusId.startsWith('cluster-')) {
      // cluster-<entityId>-<kind> (kind itself may contain dashes, e.g.
      // investment-account — split off the known entity prefix instead).
      const rest = focusId.slice('cluster-'.length);
      const entity = entities.find(e => rest.startsWith(`${e.id}-`));
      const kind = entity ? (rest.slice(entity.id.length + 1) as WealthGraphAssetKind) : null;
      if (entity && kind) {
        sceneAssets = (ownedAssetsByEntity.get(entity.id) ?? []).filter(a => a.kind === kind);
        if (sceneAssets.length > 0) {
          parentNode = {
            id: focusId,
            type: classifyAsset(kind),
            name: clusterLabel(kind, sceneAssets.length),
            shortName: clusterShortLabel(kind),
            subtitle: entity.name,
            position: CENTRE,
            size: 72,
            tier: 'cluster',
            assetSummary: summarize(sceneAssets),
            isExpanded: true,
            parentNodeId: entity.id,
          };
        }
      }
    } else if (focusId.startsWith('group-')) {
      const gid = focusId.slice('group-'.length);
      const g = ownershipGroups.find(x => x.id === gid);
      sceneAssets = ownedAssetsByGroup.get(gid) ?? [];
      if (g && sceneAssets.length > 0) {
        parentNode = {
          id: focusId,
          type: 'ownership-group',
          name: g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'Shared',
          shortName: g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'Shared',
          subtitle: `${g.stakes.length} owners`,
          position: CENTRE,
          size: 64,
          tier: 'group',
          assetSummary: summarize(sceneAssets),
          isExpanded: true,
        };
      }
    } else {
      // WX.5.3 (Reza 2026-06-11: "the first layer can be removed") — in
      // cluster mode the universe already splits this entity's holdings
      // into per-type clusters, so the entity-level all-holdings scene
      // is a redundant, overcrowded middle layer (15 mixed satellites
      // at once). Skip it: fall through to the universe and let the
      // tap open the entity card instead. The scene still exists for
      // multi-entity universes where it's the only way in.
      const e = entities.find(x => x.id === focusId);
      sceneAssets = ownedAssetsByEntity.get(focusId) ?? [];
      if (e && sceneAssets.length > 0 && !clusterMode) {
        const nodeType = classifyEntity(e);
        parentNode = {
          id: e.id,
          type: nodeType,
          name: e.name,
          shortName: shortenName(e.name),
          subtitle: subtitleFor(nodeType, e),
          position: CENTRE,
          size: Math.min(110, sizeForEntity(nodeType, sceneAssets.length, false) * 1.3),
          tier: nodeType === 'individual' ? 'individual' : 'entity',
          assetSummary: summarize(sceneAssets),
          isExpanded: true,
        };
      }
    }

    if (parentNode) {
      const n = sceneAssets.length;
      const positions =
        n <= 8
          ? ringAround(CENTRE, n, 24)
          : [
              ...ringAround(CENTRE, 8, 19),
              ...ringAround(CENTRE, n - 8, 32),
            ];
      const sceneNodes: WealthNode[] = [parentNode];
      const sceneRibbons: WealthRelationship[] = [];
      sceneAssets.forEach((a, i) => {
        sceneNodes.push({
          id: a.id,
          type: classifyAsset(a.kind),
          name: a.name,
          shortName: shortenName(a.name, 16),
          subtitle: a.subtype ?? a.context ?? undefined,
          value: formatValue(a.value),
          position: positions[i],
          size: 56,
          ownerEntityId: a.ownerEntityId,
          tier: 'asset',
          parentNodeId: focusId,
        });
        sceneRibbons.push({
          id: `scene-holds-${a.id}`,
          from: focusId,
          to: a.id,
          type: 'holds',
          label: '',
        });
      });
      return {
        nodes: sceneNodes,
        relationships: sceneRibbons,
        isEmpty: false,
        moneyFlowFy,
        moneyFlowFyOptions,
      };
    }
    // Unknown / empty focus — fall through to the universe layout.
  }

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
    const summary = summarize(ownedAssetsByEntity.get(e.id));
    const expanded = !!summary && !clusterMode && isUnfolded(e.id);
    // In cluster mode the holdings render as per-type clusters around
    // the entity — keep the "$X held" total for context but hide the
    // count badge (the clusters carry their own).
    const clustered = !!summary && clusterMode;
    nodes.push({
      id: e.id,
      type: nodeType,
      name: e.name,
      shortName: isAnchor ? 'YOU' : shortenName(e.name),
      subtitle: subtitleFor(nodeType, e),
      // Level 1 aggregate line — suppressed once the constellation is
      // unfolded (the satellites then show their own values).
      value:
        summary && summary.totalValue > 0 && !expanded
          ? `${formatValue(summary.totalValue)} held`
          : undefined,
      position: pos,
      size,
      isAnchor,
      tier: nodeType === 'individual' ? 'individual' : 'entity',
      assetSummary: summary,
      isExpanded: expanded || clustered,
      // WX.5.3 — in cluster mode the per-type clusters are the way into
      // this entity's holdings; tapping the entity itself opens the
      // detail card, never the (removed) all-holdings scene.
      isExpandable: !!summary && !clusterMode,
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
    const groupSummary = summarize(ownedAssetsByGroup.get(g.id));
    const groupExpanded = !!groupSummary && isUnfolded(`group-${g.id}`);
    nodes.push({
      id: `group-${g.id}`,
      type: 'ownership-group',
      // Warm words (§14.3) — users see "Joint" / "Shared", never tenancy
      // jargon. The stake ribbons carry the percentages.
      name: g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'Shared',
      shortName: g.tenancyType === 'JOINT_TENANTS' ? 'Joint' : 'Shared',
      subtitle: `${g.stakes.length} owners`,
      // Level 1 aggregate line — same contract as entity tiles (WX.4).
      value:
        groupSummary && groupSummary.totalValue > 0 && !groupExpanded
          ? `${formatValue(groupSummary.totalValue)} held`
          : undefined,
      position: pos,
      size: 36,
      tier: 'group',
      assetSummary: groupSummary,
      isExpanded: groupExpanded,
      // Group-held assets never cluster — the group scene is the only
      // way into them, so groups with holdings stay expandable.
      isExpandable: !!groupSummary,
    });
  });

  // ---- Asset nodes — placed in satellite arc/rings below their owning
  // entity (or below the centroid of an OwnershipGroup if jointly
  // held). Semantic zoom: satellites only unfold for expanded parents
  // (or everywhere in 'all' mode).
  const assetPositionById = new Map<string, { x: number; y: number }>();
  // Assets routed via a type-cluster — their holds ribbon comes from the
  // cluster, not the entity (skip them in the entity→asset ribbon loop).
  const clusteredAssetIds = new Set<string>();
  // Ribbons created during cluster placement (the main ribbons array is
  // declared later); appended after its declaration.
  const clusterRibbons: WealthRelationship[] = [];

  // Place entity-owned assets
  ownedAssetsByEntity.forEach((assetsForEntity, entityId) => {
    const parentPos = nodePositionById.get(entityId);
    if (!parentPos) return;

    const pushAssetNode = (a: WealthGraphAsset, pos: { x: number; y: number }, parentNodeId: string) => {
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
        parentNodeId,
      });
    };

    if (clusterMode) {
      // ---- Cluster level (Phase WX.4.1): group this entity's holdings
      // by type. Kinds with a single asset render that asset directly
      // (a cluster of one is noise); kinds with ≥2 render an aggregate
      // cluster tile that unfolds on selection.
      const byKind = new Map<WealthGraphAssetKind, WealthGraphAsset[]>();
      for (const a of assetsForEntity) {
        const arr = byKind.get(a.kind) ?? [];
        arr.push(a);
        byKind.set(a.kind, arr);
      }
      const kinds = [...byKind.keys()];
      const ringPositions = fanAbove(parentPos, kinds.length, 26);
      kinds.forEach((kind, i) => {
        const kindAssets = byKind.get(kind)!;
        const pos = ringPositions[i];
        if (kindAssets.length === 1) {
          pushAssetNode(kindAssets[0], pos, entityId);
          return;
        }
        const clusterId = `cluster-${entityId}-${kind}`;
        const clusterExpanded = isUnfolded(clusterId);
        const totalValue = kindAssets.reduce(
          (s, a) => s + (isFinite(a.value) ? a.value : 0),
          0,
        );
        nodes.push({
          id: clusterId,
          type: classifyAsset(kind),
          name: clusterLabel(kind, kindAssets.length),
          shortName: clusterShortLabel(kind),
          subtitle: 'Tap to open',
          value:
            totalValue > 0
              ? `${formatValue(totalValue)}${kind === 'loan' ? ' owing' : ''}`
              : undefined,
          position: pos,
          size: 52,
          ownerEntityId: entityId,
          tier: 'cluster',
          parentNodeId: entityId,
          assetSummary: { count: kindAssets.length, totalValue },
          isExpanded: clusterExpanded,
          isExpandable: true,
        });
        clusterRibbons.push({
          id: `cluster-holds-${clusterId}`,
          from: entityId,
          to: clusterId,
          type: 'holds',
          label: 'Holds',
        });
        if (clusterExpanded) {
          const satPositions = placeSatellites(pos, kindAssets.length, 9);
          kindAssets.forEach((a, j) => {
            pushAssetNode(a, satPositions[j], clusterId);
            clusteredAssetIds.add(a.id);
            clusterRibbons.push({
              id: `cluster-asset-${a.id}`,
              from: clusterId,
              to: a.id,
              type: 'holds',
              label: '',
            });
          });
        }
      });
      return;
    }

    // ---- Entity-collapse level: satellites only for expanded entities.
    if (!isUnfolded(entityId)) return;
    const positions = placeSatellites(parentPos, assetsForEntity.length, 9);
    assetsForEntity.forEach((a, i) => {
      pushAssetNode(a, positions[i], entityId);
    });
  });

  // Place group-owned assets just below the group node
  ownedAssetsByGroup.forEach((assetsForGroup, groupId) => {
    if (!isUnfolded(`group-${groupId}`)) return;
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
        parentNodeId: `group-${groupId}`,
      });
    });
  });

  // ===== Ribbons =====

  const ribbons: WealthRelationship[] = [];

  // 0) Cluster-level ribbons (Phase WX.4.1) — entity → cluster and,
  //    when a cluster is unfolded, cluster → asset.
  ribbons.push(...clusterRibbons);

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

  // 2) Asset HOLDS edges — entity → asset. Assets routed via a type
  //    cluster already have their cluster → asset ribbon (above).
  ownedAssetsByEntity.forEach((assetsForEntity, entityId) => {
    for (const a of assetsForEntity) {
      if (clusteredAssetIds.has(a.id)) continue;
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
      financialYear: f.financialYear,
    });
  }

  // ---- Collision relaxation (Phase WX.4) — keep visible tiles from
  // overlapping as the structure grows. Runs last so it sees the final
  // node set (entities + groups + any unfolded satellites).
  relaxCollisions(nodes);

  return {
    nodes,
    relationships: ribbons,
    isEmpty,
    moneyFlowFy,
    moneyFlowFyOptions,
  };
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

/** Warm plural labels for type clusters (CLAUDE.md §14.3 warm words). */
const CLUSTER_LABELS: Record<WealthGraphAssetKind, [singular: string, plural: string]> = {
  property: ['Property', 'Properties'],
  loan: ['Loan', 'Loans'],
  account: ['Account', 'Accounts'],
  'investment-account': ['Investment', 'Investments'],
  asset: ['Asset', 'Other assets'],
  super: ['Super fund', 'Super'],
};

function clusterLabel(kind: WealthGraphAssetKind, count: number): string {
  const [singular, plural] = CLUSTER_LABELS[kind];
  return `${count} ${count === 1 ? singular : plural}`;
}

function clusterShortLabel(kind: WealthGraphAssetKind): string {
  return CLUSTER_LABELS[kind][1];
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
