/**
 * Time-Series Engine
 * Phase 3 Foundation - Generate, interpolate, and merge time-series data
 *
 * Used by:
 * - Insights and forecasting
 * - Cashflow projections
 * - Health analysis
 * - Schedule merging
 */

// =============================================================================
// TYPES
// =============================================================================

export type TimeStep = 'day' | 'week' | 'month' | 'year';

export interface TimeSeriesEvent {
  date: Date;
  type: string;
  amount: number;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

export interface ProjectionConfig {
  startDate: Date;
  endDate: Date;
  step: TimeStep;
  initialValue: number;
  growthRate?: number; // Annual growth rate as decimal (e.g., 0.03 for 3%)
  inflationRate?: number; // Annual inflation rate
}

// =============================================================================
// SERIES GENERATION
// =============================================================================

/**
 * Generate a series of dates between start and end dates.
 *
 * @param start - Start date
 * @param end - End date
 * @param step - Time step (day, week, month, year)
 * @returns Array of dates at the specified intervals
 */
export function generateSeries(start: Date, end: Date, step: TimeStep): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    advanceDate(current, step);
  }

  return dates;
}

/**
 * Generate a monthly series for a specified number of months.
 *
 * @param startDate - Start date
 * @param months - Number of months to generate
 * @returns Array of dates
 */
export function generateMonthlySeries(startDate: Date, months: number): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  for (let i = 0; i < months; i++) {
    dates.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}

/**
 * Generate a yearly series for a specified number of years.
 *
 * @param startDate - Start date
 * @param years - Number of years to generate
 * @returns Array of dates
 */
export function generateYearlySeries(startDate: Date, years: number): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  for (let i = 0; i < years; i++) {
    dates.push(new Date(current));
    current.setFullYear(current.getFullYear() + 1);
  }

  return dates;
}

// =============================================================================
// INTERPOLATION
// =============================================================================

/**
 * Linear interpolation between two values.
 *
 * @param valueA - Start value
 * @param valueB - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function interpolate(valueA: number, valueB: number, t: number): number {
  // Clamp t to [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));
  return valueA + (valueB - valueA) * clampedT;
}

/**
 * Interpolate a value at a specific date between two time series points.
 *
 * @param pointA - Start point with date and value
 * @param pointB - End point with date and value
 * @param targetDate - Date to interpolate at
 * @returns Interpolated value
 */
export function interpolateAtDate(
  pointA: TimeSeriesPoint,
  pointB: TimeSeriesPoint,
  targetDate: Date
): number {
  const totalMs = pointB.date.getTime() - pointA.date.getTime();
  if (totalMs === 0) return pointA.value;

  const elapsedMs = targetDate.getTime() - pointA.date.getTime();
  const t = elapsedMs / totalMs;

  return interpolate(pointA.value, pointB.value, t);
}

/**
 * Ease-in-out interpolation for smoother transitions.
 *
 * @param valueA - Start value
 * @param valueB - End value
 * @param t - Interpolation factor (0-1)
 * @returns Smoothly interpolated value
 */
export function interpolateSmooth(valueA: number, valueB: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  // Smooth step function: 3t² - 2t³
  const smoothT = clampedT * clampedT * (3 - 2 * clampedT);
  return valueA + (valueB - valueA) * smoothT;
}

// =============================================================================
// SCHEDULE MERGING
// =============================================================================

/**
 * Merge multiple time-series event streams into a single chronological array.
 *
 * @param schedules - Array of event arrays to merge
 * @returns Merged and sorted array of events
 */
export function mergeSchedules(...schedules: TimeSeriesEvent[][]): TimeSeriesEvent[] {
  // Flatten all schedules
  const allEvents = schedules.flat();

  // Sort by date
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  return allEvents;
}

/**
 * Group merged events by date (same day).
 *
 * @param events - Array of time-series events
 * @returns Map of date strings to arrays of events
 */
export function groupEventsByDate(
  events: TimeSeriesEvent[]
): Map<string, TimeSeriesEvent[]> {
  const grouped = new Map<string, TimeSeriesEvent[]>();

  for (const event of events) {
    const dateKey = event.date.toISOString().split('T')[0];
    const existing = grouped.get(dateKey) || [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

/**
 * Aggregate events by type within a date range.
 *
 * @param events - Array of events
 * @param startDate - Start of range
 * @param endDate - End of range
 * @returns Object with total amounts by type
 */
export function aggregateByType(
  events: TimeSeriesEvent[],
  startDate: Date,
  endDate: Date
): Record<string, number> {
  const filtered = events.filter(
    (e) => e.date >= startDate && e.date <= endDate
  );

  const totals: Record<string, number> = {};
  for (const event of filtered) {
    totals[event.type] = (totals[event.type] || 0) + event.amount;
  }

  return totals;
}

// =============================================================================
// VALUE PROJECTIONS
// =============================================================================

/**
 * Project a value forward with compound growth.
 *
 * @param initialValue - Starting value
 * @param annualGrowthRate - Annual growth rate as decimal
 * @param years - Number of years to project
 * @returns Projected value
 */
export function projectValue(
  initialValue: number,
  annualGrowthRate: number,
  years: number
): number {
  return initialValue * Math.pow(1 + annualGrowthRate, years);
}

/**
 * Generate a projection time series with growth.
 *
 * @param config - Projection configuration
 * @returns Array of time series points
 */
export function generateProjection(config: ProjectionConfig): TimeSeriesPoint[] {
  const {
    startDate,
    endDate,
    step,
    initialValue,
    growthRate = 0,
    inflationRate = 0,
  } = config;

  const dates = generateSeries(startDate, endDate, step);
  const points: TimeSeriesPoint[] = [];

  // Net growth rate (growth minus inflation for real returns)
  const netGrowthRate = growthRate - inflationRate;

  // Calculate growth per step
  const periodsPerYear = getPeriodsPerYear(step);
  const growthPerPeriod = Math.pow(1 + netGrowthRate, 1 / periodsPerYear) - 1;

  let currentValue = initialValue;
  for (const date of dates) {
    points.push({ date: new Date(date), value: currentValue });
    currentValue *= 1 + growthPerPeriod;
  }

  return points;
}

/**
 * Generate forecast series with multiple scenarios.
 *
 * @param startDate - Start date
 * @param years - Number of years to forecast
 * @param initialValue - Starting value
 * @param scenarios - Object with scenario names and growth rates
 * @returns Object with scenario names and their projections
 */
export function generateScenarios(
  startDate: Date,
  years: number,
  initialValue: number,
  scenarios: Record<string, number>
): Record<string, TimeSeriesPoint[]> {
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + years);

  const results: Record<string, TimeSeriesPoint[]> = {};

  for (const [name, growthRate] of Object.entries(scenarios)) {
    results[name] = generateProjection({
      startDate,
      endDate,
      step: 'month',
      initialValue,
      growthRate,
    });
  }

  return results;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Advance a date by the specified step.
 */
function advanceDate(date: Date, step: TimeStep): void {
  switch (step) {
    case 'day':
      date.setDate(date.getDate() + 1);
      break;
    case 'week':
      date.setDate(date.getDate() + 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
}

/**
 * Get the number of periods per year for a given step.
 */
function getPeriodsPerYear(step: TimeStep): number {
  switch (step) {
    case 'day':
      return 365;
    case 'week':
      return 52;
    case 'month':
      return 12;
    case 'year':
      return 1;
  }
}

/**
 * Calculate the number of periods between two dates.
 *
 * @param start - Start date
 * @param end - End date
 * @param step - Time step
 * @returns Number of periods
 */
export function periodsBetween(start: Date, end: Date, step: TimeStep): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / msPerDay);

  switch (step) {
    case 'day':
      return daysDiff;
    case 'week':
      return Math.floor(daysDiff / 7);
    case 'month':
      return (
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth())
      );
    case 'year':
      return end.getFullYear() - start.getFullYear();
  }
}

/**
 * Get the start and end of a financial year (Australian: July 1 - June 30).
 *
 * @param date - Reference date
 * @returns Object with start and end dates
 */
export function getFinancialYear(date: Date): { start: Date; end: Date } {
  const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;

  return {
    start: new Date(year, 6, 1), // July 1
    end: new Date(year + 1, 5, 30), // June 30
  };
}

/**
 * Format a date range for display.
 *
 * @param start - Start date
 * @param end - End date
 * @returns Formatted string
 */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}
