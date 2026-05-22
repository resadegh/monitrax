/**
 * Phase 44 Part 1c — entity-structure canvas auto-layout (§11A point 5).
 *
 * A thin, pure adapter over `@dagrejs/dagre` — a layered/hierarchical
 * layout that keeps the canvas clean as the structure grows. The canvas
 * COMPUTES NOTHING financial (§8.3 / §11A); this is pure geometry.
 *
 * Manual nudge is allowed and persisted to `localStorage` (per device,
 * per user) — never required. A schema-backed layout store was
 * deliberately not built: Part 1c ships zero schema changes (the task's
 * hard constraint), and a per-device remembered nudge is honest about
 * what it is.
 */

import dagre from '@dagrejs/dagre';

/** Canvas box dimensions — must match `EntityCanvasNode`'s rendered size. */
export const NODE_WIDTH = 232;
export const NODE_HEIGHT = 112;

export interface XYPosition {
  x: number;
  y: number;
}

interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * Run a top-to-bottom layered layout. Controllers/owners land above the
 * entities they control/own — the accountant org-chart paradigm §11A
 * deliberately keeps. Returns top-left positions keyed by node id.
 * Disconnected nodes (no edges in the active lens) are still placed.
 */
export function layoutGraph(nodeIds: string[], edges: LayoutEdge[]): Map<string, XYPosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: 96, nodesep: 52, marginx: 28, marginy: 28 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of nodeIds) {
    g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, XYPosition>();
  for (const id of nodeIds) {
    const n = g.node(id);
    if (!n) {
      positions.set(id, { x: 0, y: 0 });
      continue;
    }
    // dagre returns the node centre; React Flow positions by top-left.
    positions.set(id, { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 });
  }
  return positions;
}

// =============================================================================
// MANUAL NUDGE PERSISTENCE (localStorage — per device, per user)
// =============================================================================

function nudgeKey(userId: string): string {
  return `monitrax:entity-canvas:nudge:${userId}`;
}

/** Load a user's saved manual node positions, or `{}` if none / unavailable. */
export function loadNudges(userId: string): Record<string, XYPosition> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(nudgeKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, XYPosition>) : {};
  } catch {
    return {};
  }
}

/** Persist a user's manual node positions. Silently no-ops if storage is unavailable. */
export function saveNudges(userId: string, nudges: Record<string, XYPosition>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(nudgeKey(userId), JSON.stringify(nudges));
  } catch {
    /* storage full / disabled — auto-layout still works, nudges just don't persist */
  }
}

/** Clear all saved nudges for a user (the "Reset layout" affordance). */
export function clearNudges(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(nudgeKey(userId));
  } catch {
    /* no-op */
  }
}
