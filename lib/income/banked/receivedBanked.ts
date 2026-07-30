/**
 * MON-131 Tranche 1 — L1 RECEIVED-CASH banked engine (D17 / D20).
 *
 * Covers the income sources whose banked amount has NO rules of its own
 * beyond "cash as received": INVESTMENT (dividends, distributions, interest
 * — received cash ONLY; franking credits are a tax offset and belong to
 * Layer 3, NEVER added here) and OTHER.
 *
 * Business distributions: `IncomeType` has no distribution value — trust/
 * company distribution intelligence (incl. PSI attribution, Part 2-42) lives
 * in the LegalEntity distribution tables and the tax engine, outside income
 * rows. Recorded in the T1 coverage boundary as not-touched.
 *
 * The one-off gate (MON-128's root defect) runs through the CANONICAL
 * `monthlyRunRate` — never a local converter (Calc-SSOT Wall B2).
 *
 * PURE: no DB, no fetch (CLAUDE.md §6.4).
 */

import { monthlyRunRate } from '@/lib/utils/frequencies';
import { Decimal, toDecimal } from '@/lib/decimal';
import type { BankedIncomeRow, BankedRowResult } from './types';

export function computeReceivedBanked(
  row: BankedIncomeRow,
  source: 'investment' | 'other',
): BankedRowResult {
  const oneOff = row.isRecurring === false;
  const bankedAnnual = oneOff
    ? 0
    : monthlyRunRate({ amount: row.amount, frequency: row.frequency, isRecurring: row.isRecurring }) * 12;
  return {
    id: row.id,
    source,
    bankedAnnual,
    // Received-as-is: gross ≡ banked is TRUE for these sources (no
    // withholding on the way in; year-end tax is Layer 3's labelled estimate).
    grossAnnual: bankedAnnual,
    components: { payg: 0, help: 0, salarySacrifice: 0 },
    basis: 'DECLARED_RECEIVED',
    oneOffAmount: oneOff ? row.amount : 0,
    undetermined: [],
    flags: [],
  };
}

export interface ReceivedBankedDecimal {
  id?: string;
  source: 'investment' | 'other';
  bankedAnnual: Decimal;
  grossAnnual: Decimal;
  oneOffAmount: Decimal;
}

export function computeReceivedBankedDecimal(
  row: BankedIncomeRow,
  source: 'investment' | 'other',
): ReceivedBankedDecimal {
  const float = computeReceivedBanked(row, source);
  const banked = toDecimal(float.bankedAnnual) ?? new Decimal(0);
  return {
    id: row.id,
    source,
    bankedAnnual: banked,
    grossAnnual: banked,
    oneOffAmount: toDecimal(float.oneOffAmount) ?? new Decimal(0),
  };
}
