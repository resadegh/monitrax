/**
 * Phase 41i — Calculation Audit System public surface.
 *
 * Importing this module bootstraps every calc engine across the app
 * (tax / core / property / etc.). The admin portal route imports
 * from here.
 *
 * Adding a new engine:
 *   1. Add an adapter file under `engines/` that calls
 *      `calcEngineRegistry.register(...)`.
 *   2. Import the adapter from this file (auto-bootstraps on import).
 *   3. Add at least one fixture with concrete hardcoded assertions
 *      from source authority (HR-3 — every engine must be auditable).
 */

// Importing each adapter module triggers the registration side
// effect via the top-level `calcEngineRegistry.register(...)` calls.
import './engines/tax';
import './engines/tax-divisions';
import './engines/tax-state';
import './engines/core';
import './engines/property';

export { calcEngineRegistry } from './registry';
export { runDifferential, runOne } from './runDifferential';
export type {
  CalcEngine,
  CalcFixture,
  CalcAssertion,
  CalcCategory,
  Severity,
  Resolution,
  AuditFinding,
  FixtureRunResult,
  DifferentialReport,
} from './types';
