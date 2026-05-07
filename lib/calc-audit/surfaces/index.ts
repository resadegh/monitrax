/**
 * Phase 41i.6 — Surface-level audit registry public surface.
 *
 * Importing this module bootstraps the registry with the canonical
 * 41i.6a top-10 descriptors. The 41i.6c runtime audit harness imports
 * from here.
 *
 * **Reviewers reject any PR that:**
 *   - Adds a financial surface without a corresponding `SurfaceDescriptor`
 *     registration here (HR-3 extension — `PHASE_41_REGULATORY_ARCHITECTURE.md`
 *     invariant 11 / `PHASE_41I_6_SURFACE_AUDIT.md` §1).
 *   - Renames a `surfaceId` (the id is the audit-finding key — never rename).
 *   - Adds a descriptor with a duplicate `surfaceId` (the registry throws).
 */

import 'server-only';
import { surfaceRegistry, assertDescriptor } from './registry';
import {
  MASTER_SNAPSHOT_DESCRIPTORS,
} from './descriptors/masterSnapshotDescriptors';
import {
  CASHFLOW_DESCRIPTORS,
} from './descriptors/cashflowDescriptors';
import type { SurfaceDescriptor } from './types';

/**
 * Canonical descriptors registered at module load. Adding a surface
 * requires editing this list (and a reviewer for HR-3 extension).
 *
 * Phase 41i.6a ships 10 (top-10 highest-impact tiles).
 */
const CANONICAL_DESCRIPTORS: ReadonlyArray<SurfaceDescriptor> = [
  ...MASTER_SNAPSHOT_DESCRIPTORS, // 6
  ...CASHFLOW_DESCRIPTORS, // 4
];

/**
 * Bootstrap the registry. Idempotent — safe to call multiple times
 * during hot-reload (registry throws on duplicate registration so we
 * skip already-registered descriptors).
 */
export function bootstrapSurfaceRegistry(): void {
  for (const descriptor of CANONICAL_DESCRIPTORS) {
    assertDescriptor(descriptor);
    if (!surfaceRegistry.get(descriptor.surfaceId)) {
      surfaceRegistry.register(descriptor);
    }
  }
}

// Auto-bootstrap on import.
bootstrapSurfaceRegistry();

export { surfaceRegistry, assertDescriptor };
export {
  // Master-snapshot-backed
  netWorthTile,
  healthScoreTile,
  emergencyFundTile,
  investmentTotalTile,
  propertyEquityTile,
  taxEstimatedRefundTile,
  MASTER_SNAPSHOT_DESCRIPTORS,
} from './descriptors/masterSnapshotDescriptors';
export {
  cashflowMonthlyTile,
  incomeMonthlyTile,
  expenseMonthlyTile,
  debtTotalTile,
  CASHFLOW_DESCRIPTORS,
} from './descriptors/cashflowDescriptors';

// Re-export types
export type {
  SurfaceDescriptor,
  CanonicalSourceMetadata,
  DiffTolerance,
  RenderConditions,
  SurfaceValueKind,
} from './types';
export { DEFAULT_TOLERANCE_BY_KIND, exceedsTolerance } from './types';
