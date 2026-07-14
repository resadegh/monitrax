/**
 * MON-039c — the ONE rule for whether a property surface shows a "Cashflow / yr"
 * figure. §12.2.1: one source, so the property LIST tile, detail page and Home
 * tile agree (the bug was the list tile hiding a cashflow the other two showed).
 *
 * A property is income-producing — and therefore has a meaningful cashflow — when
 * it is a genuine INVESTMENT, OR when it carries rental income (`incomeCount > 0`)
 * even if it is typed HOME/primary-residence (a partially-let home, e.g. a granny
 * flat). A true owner-occupied home with no rent (`incomeCount === 0`, not
 * INVESTMENT) legitimately shows no cashflow line.
 *
 * Yield is a separate, stricter decision (investment-only) and is NOT governed by
 * this helper — a home's yield is not shown on the detail/Home surfaces either.
 */

export function shouldShowPropertyCashflow(input: {
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  incomeCount: number;
}): boolean {
  if (input.type === 'INVESTMENT') return true;
  return (input.incomeCount ?? 0) > 0;
}
