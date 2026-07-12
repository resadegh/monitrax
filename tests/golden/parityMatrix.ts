/**
 * NEOAUDIT §5 — THE PARITY MATRIX (generated from the Neomatrix, run on golden data).
 *
 * WHAT THIS OWNS (and nothing else — §1.2 non-overlap contract):
 *   R2 "value parity": for every semanticKey rendered at ≥2 surfaces, the SAME
 *   number must resolve to the SAME VALUE on the Golden Household, via each
 *   surface's OWN data path. This is STRICTLY DIFFERENT from what
 *   `neomatrix:check` A3b (graphlib.mjs:129) already owns — that is R1
 *   *structural* convergence ("same-key numbers trace to the same engine"). A3b
 *   proves the wiring; the parity matrix proves the wiring actually produces one
 *   value end-to-end (catches the MON-028 class: same engine, different inputs).
 *
 * GENERATED, NEVER HAND-LISTED (§5): the parity groups are built by reading
 * `financial-graph.json`'s `rendered-at` edges — add a tile to the graph and it
 * is automatically in the matrix. Coverage is a BUILD OUTPUT, not a claim
 * (§22.2.4).
 *
 * THE COVERAGE RATCHET (Reza directive 2026-07-12 — "keep NeoAudit getting more
 * complete as it grows to 100%"): every `rendered-at` surface in the graph MUST
 * be either (a) in SURFACE_RESOLVERS with a faithful golden-data extractor, or
 * (b) in KNOWN_UNRESOLVED with a stated reason + a plan growth item. A surface
 * that is in NEITHER fails the coverage test — so a new tile cannot enter the
 * graph without being covered OR visibly tracked as a gap. Each KNOWN_UNRESOLVED
 * entry is a documented coverage-growth task; the queue only shrinks.
 *
 * HONEST SCOPE (no false greens): a resolver returns what a surface renders on
 * golden data ONLY via a real path (a route's serialized JSON, or the master
 * service's assembly). Where the faithful value cannot be produced without
 * GUESSING a field/concept, the surface is DEFERRED (KNOWN_UNRESOLVED), never
 * resolved with a lookalike number — a guessed field is the exact false green
 * this matrix exists to prevent.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

/** Everything a resolver needs, precomputed once on the golden household. */
export interface ParityCtx {
  /** Real master service assembly (flat-select path). */
  master: MasterFinancialSnapshot;
  /** Real `GET /api/portfolio/snapshot` serialized JSON (the Home net-worth path). */
  portfolio: { netWorth: number; totalAssets: number; totalLiabilities: number };
  /** Real `GET /api/properties/[id]` → engine on the serialized payload (independent of master). */
  propertyDetailCashflow: number;
  /** Real `GET /api/safety-net` serialized `data.safetyScore.total`. */
  safetyScore: number;
}

/**
 * Faithful golden-data resolvers — each returns EXACTLY what that surface
 * renders, via that surface's own path. Two surfaces resolving from DIFFERENT
 * paths (route vs service) is what makes their parity assertion load-bearing;
 * two reading the same field is only a coverage entry, not an independent check
 * (called out where it applies).
 */
export const SURFACE_RESOLVERS: Record<string, (c: ParityCtx) => number> = {
  // netWorth — Home tile reads /api/portfolio/snapshot (independent of master).
  'ui.home.netWorthTile': (c) => c.portfolio.netWorth,

  // monthlyCashflow — dashboard tile reads the master snapshot.
  'ui.dashboard.cashflowTile': (c) => c.master.cashflow.monthlyCashflow,

  // savingsRate — dashboard tile reads the master snapshot.
  'ui.dashboard.savingsRateTile': (c) => c.master.cashflow.savingsRate,

  // monthlyInflow — dashboard income tile reads the master snapshot.
  'ui.dashboard.incomeTile': (c) => c.master.quickMetrics.monthlyIncome,

  // propertyCashflow — the load-bearing multi-surface group:
  //   detail  = the REAL /api/properties/[id] route → engine on serialized payload
  //   list    = master snapshot per-property cashflow
  //   tile    = master snapshot per-property cashflow
  // detail(route) vs tile(master) are INDEPENDENT paths converging on −$400.
  'ui.properties.detailCashflow': (c) => c.propertyDetailCashflow,
  'ui.properties.listTileCashflow': (c) => c.master.properties[0].monthlyCashflow,
  'ui.dashboard.propertyTileCashflow': (c) => c.master.properties[0].monthlyCashflow,

  // safetyScore — the REAL /api/safety-net route (no semanticKey → coverage + manifest tie only, no parity partner).
  'ui.safetyNet.safetyScore': (c) => c.safetyScore,
};

/**
 * Tracked coverage-growth deferrals. Each is a documented plan item — NEVER a
 * silent pass. A surface here is honestly "not yet resolved on golden data",
 * with the reason a faithful resolver isn't wired and where the growth lands.
 */
export const KNOWN_UNRESOLVED: Record<string, { reason: string; growth: string }> = {
  'ui.cashflow.hero': {
    reason:
      '/cashflow hero renders the canonical monthly cashflow + a page-derived savings rate; the route exposes a 30-day FORECAST summary, not a clean monthlyCashflow/savingsRate scalar. A faithful resolver needs the canonical-cashflow accessor — guessing a forecast field would be a false green.',
    growth: 'NeoAudit §8 growth: canonical-cashflow resolver for the /cashflow hero (monthlyCashflow + savingsRate)',
  },
  'ui.activity.cashflowTiles': {
    reason: 'The /activity This-month tiles read the activity route; no golden-data resolver is wired for it yet.',
    growth: 'NeoAudit §8 growth: /activity route resolver (monthlyCashflow tiles)',
  },
  'ui.dashboard.outgoingsTile': {
    reason:
      'canonicalCashflow.monthlyOutflow — the outflow concept (expenses vs expenses+repayments) must come from an explicit resolver, not a guessed master field.',
    growth: 'NeoAudit §8 growth: monthlyOutflow resolver',
  },
  'ui.dashboard.tax': {
    reason: 'taxPayable needs the tax engine run on the golden household — arrives with the step-5 CFO/tax reconciliation.',
    growth: 'NeoAudit §8 step-5: taxPayable resolver (tax engine on golden data)',
  },
  'ui.home.healthTile': {
    reason: 'healthScore — the health engine on golden data; the Home-tile-vs-CFO-score divergence is MON-030, deferred to step-5.',
    growth: 'MON-030 / NeoAudit §8 step-5: healthScore resolver',
  },
  'ui.cfo.scoreTile': {
    reason: 'cfoScore — the competing CFO score engine; MON-030, deferred to step-5.',
    growth: 'MON-030 / NeoAudit §8 step-5: cfoScore resolver',
  },
  'ui.dashboard.netWorthTrendTile': {
    reason: 'netWorthTrend needs historical net-worth snapshots — the golden book is single-point-in-time (no trend to compute).',
    growth: 'NeoAudit §8 growth: historical-snapshot golden fixtures so netWorthTrend can resolve',
  },
  'ui.cfo.monthlyProgress': {
    reason: 'netWorthTrend (same historical-fixture gap as the trend tile).',
    growth: 'NeoAudit §8 growth: historical-snapshot golden fixtures so netWorthTrend can resolve',
  },
  'ui.dashboard.moneyStoryHero': {
    reason: 'moneyStoryMargin / financialIndependence — needs the FI engine resolver on golden data.',
    growth: 'NeoAudit §8 growth: financialIndependence resolver (moneyStoryMargin)',
  },
  'ui.balances.hiddenWealth': {
    reason:
      'accessibilityBuckets renders a bucket SET (liquidToday / accessible / lockedLongTerm), not a single scalar; its ui-surface node carries no semanticKey, so it has no parity partner until per-bucket number nodes are modelled.',
    growth: 'NeoAudit §8 growth: model accessibilityBuckets number nodes (semanticKeys) + per-bucket resolver',
  },
};

/** Load the committed Neomatrix graph. */
export function loadGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const p = path.resolve(process.cwd(), 'docs/financial-logic/graph/financial-graph.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

interface GraphNode { id: string; kind: string; semanticKey?: string; label?: string }
interface GraphEdge { from: string; to: string; type: string }

export interface ParityGroups {
  /** semanticKey → the ui-surface ids that render it (from `rendered-at` edges). */
  groups: Map<string, string[]>;
  /** every distinct ui-surface that is a `rendered-at` target (the coverage denominator). */
  renderedSurfaces: string[];
}

/**
 * Build the parity groups from the graph: group every `rendered-at` target
 * ui-surface by ITS OWN semanticKey. Surfaces without a semanticKey are still
 * counted in `renderedSurfaces` (they need coverage) but form no parity group.
 */
export function buildParityGroups(graph: { nodes: GraphNode[]; edges: GraphEdge[] }): ParityGroups {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const renderedSurfaces = [...new Set(graph.edges.filter((e) => e.type === 'rendered-at').map((e) => e.to))];
  const groups = new Map<string, string[]>();
  for (const id of renderedSurfaces) {
    const key = byId.get(id)?.semanticKey;
    if (!key) continue; // no key → no parity group (still in renderedSurfaces for coverage)
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }
  return { groups, renderedSurfaces };
}
