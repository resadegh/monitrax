/**
 * The ONE canonical window for property-cashflow actuals (MON-035, DECISION 2).
 *
 * Reza 2026-07-14: every property surface reads reconciled transactions over a
 * **trailing 12-month** window — the "current run-rate" (the financial-adviser
 * basis; lumpy transactions older than a year stop skewing the monthly average).
 *
 * Before this, the SAME engine (`computePropertyCashflow`) was fed THREE
 * different windows: all-time (property detail + list via `enrichPropertiesWithActuals`)
 * vs last-12-months (Home tile via `/api/portfolio/snapshot`, and the master
 * snapshot's `buildPropertyMetrics`). Same engine, different inputs → the same
 * property showed different Cashflow/yr + yield on different screens (MON-035/036).
 *
 * This module is the SINGLE SOURCE for the window: all three fetch sites import
 * `propertyActualsWindowStart()`, so the window is defined once. If the window
 * ever changes, it changes here — and every surface moves together. The
 * cross-surface parity test locks that they converge.
 */

/** The trailing window, in months, over which property actuals are read. */
export const PROPERTY_ACTUALS_WINDOW_MONTHS = 12;

/**
 * The `gte` date bound for the property-actuals window: `now` minus
 * {@link PROPERTY_ACTUALS_WINDOW_MONTHS} months. Pass `now` in tests for
 * determinism; defaults to the current time.
 */
export function propertyActualsWindowStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setMonth(start.getMonth() - PROPERTY_ACTUALS_WINDOW_MONTHS);
  return start;
}
