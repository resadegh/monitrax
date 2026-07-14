/**
 * MON-048 — the frequency badge for the property "Cashflow rhythm / Recent
 * Activity" rows. ONE source (CLAUDE.md §12.2.1).
 *
 * The bug: the rhythm list built each row's cadence badge from the raw declared
 * `expense.frequency` field — which DEFAULTS to `MONTHLY`. So a ONE-OFF cost
 * (a battery install, a subdivision fee — categorised `isRecurring === false`)
 * rendered as "Monthly", exactly the thing it is not. A one-off is not part of
 * the monthly rhythm (MON-037 excludes it from the recurring run-rate); its
 * cadence must come from the CATEGORISATION signal (`isRecurring`), not the
 * declared-frequency default.
 *
 * Rule: `isRecurring === false` → "One-off" (never a frequency). Otherwise the
 * humanised declared frequency (the user's stated cadence for a recurring line).
 * The `=== false` gate is null-safe — undefined/null/true all mean recurring.
 */

export function activityFrequencyLabel(item: {
  frequency?: string | null;
  isRecurring?: boolean | null;
}): string {
  if (item.isRecurring === false) return 'One-off';
  const f = item.frequency ?? 'MONTHLY';
  return f.charAt(0) + f.slice(1).toLowerCase();
}
