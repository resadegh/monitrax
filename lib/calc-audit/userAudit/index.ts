/**
 * Phase 41i.3b — Per-user audit public surface.
 *
 * Importing this module bootstraps the adapter registry. The API
 * route + admin UI import from here.
 *
 * **Reviewers reject any PR that:**
 *   - Adds a new calc engine without a corresponding adapter (or
 *     explicit "no per-user audit needed" justification in the PR
 *     description).
 *   - Renames an `engineName` (the id is the audit-finding key).
 *   - Adds a duplicate `engineName` (the registry throws).
 */

import 'server-only';
import { userAuditAdapterRegistry } from './registry';
import {
  CORE_USER_AUDIT_ADAPTERS,
} from './adapters/coreAdapters';
import {
  PROPERTY_USER_AUDIT_ADAPTERS,
} from './adapters/propertyAdapters';
import {
  TAX_USER_AUDIT_ADAPTERS,
} from './adapters/taxAdapters';
import type { UserAuditAdapter } from './types';

const CANONICAL_ADAPTERS: ReadonlyArray<UserAuditAdapter<unknown, unknown>> = [
  ...(CORE_USER_AUDIT_ADAPTERS as ReadonlyArray<UserAuditAdapter<unknown, unknown>>),
  ...(PROPERTY_USER_AUDIT_ADAPTERS as ReadonlyArray<UserAuditAdapter<unknown, unknown>>),
  ...(TAX_USER_AUDIT_ADAPTERS as ReadonlyArray<UserAuditAdapter<unknown, unknown>>),
];

/**
 * Bootstrap the adapter registry. Idempotent — safe for hot-reload
 * (skips already-registered adapters).
 */
export function bootstrapUserAuditRegistry(): void {
  for (const adapter of CANONICAL_ADAPTERS) {
    if (!userAuditAdapterRegistry.get(adapter.engineName)) {
      userAuditAdapterRegistry.register(adapter);
    }
  }
}

// Auto-bootstrap on import.
bootstrapUserAuditRegistry();

export { userAuditAdapterRegistry } from './registry';
export {
  netWorthAdapter,
  bankedIncomeAdapter,
  expenseAggregatorAdapter,
  loanAggregatorAdapter,
  CORE_USER_AUDIT_ADAPTERS,
} from './adapters/coreAdapters';
export {
  propertyLVRAdapter,
  propertyEquityAdapter,
  propertyRentalYieldAdapter,
  PROPERTY_USER_AUDIT_ADAPTERS,
} from './adapters/propertyAdapters';
export {
  masterTaxPositionAdapter,
  TAX_USER_AUDIT_ADAPTERS,
} from './adapters/taxAdapters';
export {
  runUserAudit,
  recordUserAuditFinding,
} from './harness';
export type {
  UserAuditAdapter,
  UserAuditOutcome,
  UserAuditReport,
  ValidationResult,
} from './types';
