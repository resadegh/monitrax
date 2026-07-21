/**
 * THE day-span monthly average — ONE producer (CLAUDE.md §12.2.1), one constant.
 *
 * Moved here from `lib/services/propertyActuals.ts` (MON-093 / VR-019 item 16):
 * `resolveMonthly` (property rent / expenses / loans) carried its OWN copy of
 * this math with three divergences from the income-page producer — a missing
 * same-day guard (MON-092), a different days-per-month constant (30.4375 vs
 * 30.44), and a hole where an ADVANCE pair (2 payments, trailing one dropped)
 * returned null and fell through to declared-frequency annualisation of an
 * UNSORTED first transaction. On Broadbeach that hole annualised a ~$2,614
 * monthly-magnitude payout by a mis-declared WEEKLY cadence → $11,328/mo
 * (~4× real) on the property surface while the income page showed $2,515 —
 * the VR-019 Sev-1. One producer, imported by both, ends the class.
 *
 * Semantics (unified, §19.2-tested in tests/calculations/actualsMonthlyAverage.test.ts):
 *   • N=0 → null (caller falls back to declared).
 *   • N=1 → the payment, counted as one month's worth.
 *   • All payments on ONE day → the total, one month's worth (no cadence
 *     evidence — never per-day extrapolated; MON-092).
 *   • isAdvance (rent) drops the trailing part-period payment; if ONE completed
 *     payment remains, it is one month's worth (identical to the income page).
 *   • Otherwise: sum ÷ (span + one mean interval) × DAYS_PER_MONTH.
 */

/** Mean days per month (365.25 / 12) — THE one day-span → month normaliser. */
export const DAYS_PER_MONTH = 365.25 / 12; // 30.4375

export type ActualTx = { date: Date | string; amount: number };

export function calculateMonthlyAverage(
  transactions: ActualTx[],
  isAdvance = false,
): number | null {
  if (transactions.length < 2) {
    return transactions.length === 1 ? Math.abs(transactions[0].amount) : null;
  }

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // MON-092: payments all landing on ONE day carry no cadence evidence — the
  // honest monthly figure is the total, counted as one month's worth.
  const fullSpanDays =
    (new Date(sortedTx[sortedTx.length - 1].date).getTime() -
      new Date(sortedTx[0].date).getTime()) /
    (1000 * 60 * 60 * 24);
  if (fullSpanDays < 1) {
    return sortedTx.reduce((s, tx) => s + Math.abs(tx.amount), 0);
  }

  const payments = isAdvance ? sortedTx.slice(0, -1) : sortedTx;
  if (payments.length < 1) return null;

  const sum = payments.reduce((s, tx) => s + Math.abs(tx.amount), 0);
  if (payments.length === 1) return sum;

  const firstDate = new Date(payments[0].date);
  const lastDate = new Date(payments[payments.length - 1].date);
  const daysSpan = Math.max(
    1,
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const avgInterval = daysSpan / (payments.length - 1);
  const totalDays = daysSpan + avgInterval;
  return (sum / totalDays) * DAYS_PER_MONTH;
}
