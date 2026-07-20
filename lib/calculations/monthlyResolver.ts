/**
 * Canonical MONTHLY resolver (MON-009) — ONE source (CLAUDE.md §12.2.1, §19.1,
 * §19.4) for turning a money line (rent / an expense / a loan repayment) into a
 * true MONTHLY figure, regardless of its real cadence or how many records it is
 * split across.
 *
 * Reza directive 2026-07-03: *"Your solution and logic should cover everything
 * like expenses, loan repayments, rent — so if in a month we have 2 repayments
 * or the water rate is quarterly, regardless the calculation is correct and is
 * shown monthly."*
 *
 * The rule (universal, cadence-agnostic):
 *   • ≥2 reconciled transactions → read the cadence FROM THE DATES: a day-span
 *     average normalised to a month (×30.44 mean days/month). This is correct
 *     for ANY rhythm — fortnightly rent, two loan repayments in one month, a
 *     quarterly water rate — without anyone declaring the frequency.
 *   • Exactly 1 transaction → we have a real amount but cannot infer cadence
 *     from a single date, so normalise that ACTUAL amount by the DECLARED
 *     frequency (we still know it's "quarterly"). Never treat a lone quarterly
 *     payment as monthly.
 *   • 0 transactions → fall back to the DECLARED amount × frequency (the plan).
 *
 * Rent is resolved at the PROPERTY-STREAM level (pool ALL of a property's rental
 * transactions) so a stream fragmented across several Income records — the
 * "4 monthly rows" bug — is counted once and correctly, whatever the tenancy
 * count. Expenses and loans resolve per record (genuinely distinct lines).
 *
 * PURE: no DB, no fetch, no mutation. Modelled in the Neomatrix
 * (engine.monthlyResolver.resolveMonthly).
 */

import { toMonthly } from '@/lib/utils/frequencies';
import { calculateMonthlyAverage, DAYS_PER_MONTH } from '@/lib/calculations/actualsMonthlyAverage';
import type { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';

// MON-093 (VR-019 item 16): the day-span math itself now lives in the ONE
// producer `calculateMonthlyAverage` — this module keeps the actuals-first
// ORCHESTRATION (actual vs declared basis, cadence label, declared fallback).
// The resolver's private copy diverged three ways (no same-day guard, a
// different constant, and an advance-pair hole that fell through to
// declared-frequency annualisation of an unsorted first transaction — the
// Broadbeach ~4× rent inflation).
export { DAYS_PER_MONTH };

export type ResolverTx = { date: Date | string; amount: number };

export interface MonthlyResolution {
  /** The resolved monthly figure (always a real monthly rate). */
  monthly: number;
  /** 'actual' when derived from reconciled transactions, else 'declared'. */
  basis: 'actual' | 'declared';
  usedActuals: boolean;
  txCount: number;
  /** Mean days between transactions when inferable (≥2 tx), else null. */
  cadenceDays: number | null;
  /** A human cadence label from the detected interval, or null. */
  detectedFrequency: DetectedFrequency | null;
}

export type DetectedFrequency =
  | 'WEEKLY'
  | 'FORTNIGHTLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'ANNUAL'
  | 'IRREGULAR';

const ms = (d: Date | string) => new Date(d).getTime();

/**
 * Day-span monthly average from a cadence of transactions. Measures the true
 * rate of money flow over the observed window, so it is correct for any rhythm
 * and for multiple payments within a month.
 *
 * `isAdvance` (money received/paid in advance, e.g. rent) drops the trailing
 * payment so an incomplete final period doesn't drag the rate down.
 *
 * Returns null when the cadence can't be inferred (fewer than 2 usable
 * payments) — the caller then uses the declared-frequency fallback.
 */
export function daySpanMonthlyAverage(
  transactions: ResolverTx[],
  isAdvance = false,
): { monthly: number; cadenceDays: number | null } | null {
  if (!transactions || transactions.length < 2) return null;

  // MON-093: the monthly figure comes from THE one producer — identical to
  // the income page for every case, including the advance-pair (one completed
  // payment = one month's worth) and same-day sets (total, counted once).
  const monthly = calculateMonthlyAverage(transactions, isAdvance);
  if (monthly == null) return null;

  // The cadence LABEL reads the raw inter-payment rhythm (all N dates, N−1
  // gaps) — observable evidence, independent of the advance drop.
  const sorted = [...transactions].sort((a, b) => ms(a.date) - ms(b.date));
  const rawSpanDays = (ms(sorted[sorted.length - 1].date) - ms(sorted[0].date)) / 86_400_000;
  const cadenceDays = rawSpanDays >= 1 ? rawSpanDays / (sorted.length - 1) : null;

  return { monthly, cadenceDays };
}

/** Map a mean inter-payment interval (days) to a human cadence label. */
export function detectFrequency(cadenceDays: number | null): DetectedFrequency | null {
  if (cadenceDays == null || !Number.isFinite(cadenceDays) || cadenceDays <= 0) return null;
  if (cadenceDays <= 10) return 'WEEKLY';
  if (cadenceDays <= 20) return 'FORTNIGHTLY';
  if (cadenceDays <= 45) return 'MONTHLY';
  if (cadenceDays <= 135) return 'QUARTERLY';
  if (cadenceDays <= 270) return 'HALF_YEARLY';
  if (cadenceDays <= 400) return 'ANNUAL';
  return 'IRREGULAR';
}

export interface ResolveMonthlyInput {
  /** Declared monthly fallback (already monthly) — used when 0 transactions. */
  declaredMonthly: number;
  /** Declared frequency, used to normalise a single actual payment (1 tx). */
  cadenceHintFrequency?: Frequency | RepaymentFrequency | string | null;
  /** Reconciled transactions for this line/stream. */
  transactions?: ResolverTx[];
  /** Money in/out in advance (rent) vs arrears (expenses/loans). */
  isAdvance?: boolean;
}

/**
 * Resolve a money line to a true monthly figure (§19.1 actuals-first).
 */
export function resolveMonthly(input: ResolveMonthlyInput): MonthlyResolution {
  const txs = input.transactions ?? [];
  const txCount = txs.length;

  // ≥2 tx → cadence from the dates.
  const span = daySpanMonthlyAverage(txs, input.isAdvance);
  if (span) {
    return {
      monthly: span.monthly,
      basis: 'actual',
      usedActuals: true,
      txCount,
      cadenceDays: span.cadenceDays,
      detectedFrequency: detectFrequency(span.cadenceDays),
    };
  }

  // Exactly 1 usable tx → real amount, cadence assumed from the declared freq
  // (the lone-quarterly-water-rate doctrine: never treat a lone quarterly
  // payment as monthly). MON-093: reachable ONLY when txCount === 1 now — the
  // advance-pair no longer falls through here — and the amount is the LATEST
  // payment by date (deterministic; was unsorted array order).
  if (txCount >= 1) {
    const latest = [...txs].sort((a, b) => ms(a.date) - ms(b.date))[txs.length - 1];
    const amt = Math.abs(latest.amount);
    const freq = (input.cadenceHintFrequency ?? 'MONTHLY') as Frequency;
    return {
      monthly: toMonthly(amt, freq),
      basis: 'actual',
      usedActuals: true,
      txCount,
      cadenceDays: null,
      detectedFrequency: null,
    };
  }

  // 0 tx → declared plan.
  return {
    monthly: input.declaredMonthly,
    basis: 'declared',
    usedActuals: false,
    txCount: 0,
    cadenceDays: null,
    detectedFrequency: null,
  };
}
