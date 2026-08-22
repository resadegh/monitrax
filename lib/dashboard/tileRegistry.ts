/**
 * D-19 — the stage-aware dashboard tile registry (M3.4, built to the master
 * plan's spec block verbatim).
 *
 * ONE source of the tile decision (SSOT §12.2.1). The visibility law — THE
 * iron rule that stops the old Home's failure mode (widgets rendering against
 * gated APIs) from ever coming back:
 *
 *     visible = (requires === null || isModuleEnabled(requires)) && !suppressed(id)
 *
 * A tile toggle can only SUPPRESS a tile; it can NEVER force-show a tile
 * whose module is off. Fail-closed like moduleGate: an unreadable module
 * state reads as hidden. Suppression is admin cosmetics riding the SAME
 * GlobalFeatureFlag store (keys `TILE_SUPPRESS_<ID>` — no second flag
 * vocabulary, per D-19): flag enabled === tile suppressed.
 *
 * Staging ladder (each tile lights itself when its stage's module flips —
 * no deploy): v1 tiles carry `requires: null`; stage tiles are registered
 * DARK here and appear the moment Reza enables their module in the admin
 * panel.
 *
 * Consumers: app/dashboard/ScoreboardClient.tsx (renders visible tiles),
 * app/admin/feature-flags (the "Dashboard tiles" section),
 * app/api/feature-flags/modules (serves the suppression set).
 * Docs: MONITRAX_V1_MASTER_PLAN.md §4 M3.4 (the D-19 block).
 */
import type { ModuleKey } from '@/lib/featureFlags/moduleRegistry';

export type TileId =
  | 'portfolio'
  | 'property-cashflow'
  | 'eofy-readiness'
  | 'documents-status'
  | 'intake-queue'
  | 'tax-position'
  | 'housekeeping'
  | 'household-cashflow'
  | 'safety-net'
  | 'debt-freedom'
  | 'cfo-actions'
  | 'strategy'
  | 'wealth-universe'
  | 'investments';

export interface TileDef {
  id: TileId;
  /** Admin panel display name. */
  label: string;
  /** null = v1 core, always eligible. */
  requires: ModuleKey | null;
  stage: 'v1' | 'R2' | 'R3' | 'R4' | 'R5';
  /** Admin may hide it early; may NEVER force-show it. */
  suppressible?: boolean;
  /**
   * The tile's destination. v1 tiles target KEPT routes (the MON-163
   * dead-link guard's law); a stage tile's href is its module's own route,
   * which exists exactly when the tile is visible (visibility derives from
   * the same module flag that unhides the route — they flip together).
   */
  href: string;
  /** One-line description shown on link-style stage tiles. */
  description: string;
}

export const TILE_REGISTRY: readonly TileDef[] = [
  // ── v1 core (requires: null) — kept engines ONLY ──────────────────────────
  { id: 'portfolio', label: 'Portfolio summary', requires: null, stage: 'v1', suppressible: true, href: '/dashboard/properties', description: 'Property value, portfolio LVR and net worth at a glance.' },
  { id: 'property-cashflow', label: 'Per-property cashflow', requires: null, stage: 'v1', suppressible: true, href: '/dashboard/properties', description: 'Each property\'s monthly position from the one cashflow engine.' },
  { id: 'eofy-readiness', label: 'EOFY readiness', requires: null, stage: 'v1', suppressible: true, href: '/dashboard/reports', description: 'How much of the year is tax-ready — rows still needing review before the pack.' },
  { id: 'documents-status', label: 'Documents & evidence', requires: null, stage: 'v1', suppressible: true, href: '/dashboard/documents', description: 'Receipts and statements in the vault.' },
  { id: 'intake-queue', label: 'Intake queue', requires: null, stage: 'v1', suppressible: true, href: '/dashboard/activity', description: 'Imported rows waiting for your confirm.' },
  // ── stage tiles, registered DARK (light up when their module flips) ───────
  { id: 'tax-position', label: 'Tax position', requires: 'MODULE_TAX', stage: 'R2', suppressible: true, href: '/dashboard/tax', description: 'Your estimated tax position for the year.' },
  { id: 'housekeeping', label: 'Housekeeping review', requires: 'MODULE_HOUSEKEEPING', stage: 'R2', suppressible: true, href: '/dashboard/housekeeping', description: 'Uncategorised rows to review and confirm.' },
  { id: 'household-cashflow', label: 'Household cashflow', requires: 'MODULE_HOUSEHOLD', stage: 'R3', suppressible: true, href: '/cashflow', description: 'The household\'s monthly money story.' },
  { id: 'safety-net', label: 'Safety net', requires: 'MODULE_SAFETY_NET', stage: 'R3', suppressible: true, href: '/dashboard/safety-net', description: 'Emergency fund and bills cover.' },
  { id: 'debt-freedom', label: 'Debt freedom', requires: 'MODULE_DEBT_PLANNER', stage: 'R3', suppressible: true, href: '/dashboard/debt-planner', description: 'The payoff plan and progress.' },
  { id: 'cfo-actions', label: 'CFO actions', requires: 'MODULE_CFO', stage: 'R4', suppressible: true, href: '/dashboard/cfo', description: 'Recommended next actions.' },
  { id: 'strategy', label: 'Strategy', requires: 'MODULE_STRATEGY', stage: 'R4', suppressible: true, href: '/strategy', description: 'Long-range scenarios and plans.' },
  { id: 'wealth-universe', label: 'Wealth universe', requires: 'MODULE_ENTITIES', stage: 'R5', suppressible: true, href: '/dashboard/entities', description: 'Entities and the relationship graph.' },
  { id: 'investments', label: 'Investments', requires: 'MODULE_INVESTMENTS', stage: 'R5', suppressible: true, href: '/dashboard/investments', description: 'Portfolios, holdings and super.' },
] as const;

/** The suppression flag key for a tile (GlobalFeatureFlag; enabled = suppressed). */
export function tileSuppressFlagKey(id: TileId): string {
  return `TILE_SUPPRESS_${id.toUpperCase().replace(/-/g, '_')}`;
}

/**
 * THE visibility law (D-19). `enabledModules` is the session user's effective
 * map (`useEnabledModules()` client-side / the moduleGate server-side) —
 * `!== true` reads as OFF, so an unreadable module state fails CLOSED.
 * `suppressed` contains the tile ids whose suppress flag is enabled; a tile
 * in the set is hidden even when its module is on — and a tile NOT gated on
 * an enabled module can never be shown by any toggle state.
 */
export function isTileVisible(
  def: TileDef,
  enabledModules: Partial<Record<ModuleKey, boolean>>,
  suppressed: ReadonlySet<string>
): boolean {
  if (def.requires !== null && enabledModules[def.requires] !== true) return false;
  if (suppressed.has(def.id)) return false;
  return true;
}

/** Computed admin-panel state for one tile (the "Dashboard tiles" rows). */
export function tileAdminState(
  def: TileDef,
  enabledModules: Partial<Record<ModuleKey, boolean>>,
  suppressed: ReadonlySet<string>
): 'LIVE' | 'HIDDEN — module off' | 'SUPPRESSED' {
  if (def.requires !== null && enabledModules[def.requires] !== true) return 'HIDDEN — module off';
  if (suppressed.has(def.id)) return 'SUPPRESSED';
  return 'LIVE';
}
