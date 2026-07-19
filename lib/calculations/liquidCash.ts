/**
 * THE canonical "liquid cash" producer — MON-031/064 (VR-017 re-fix).
 *
 * Definition (Reza, 2026-07-18): DEPLOYABLE cash — spendable-account balances
 * (LIQUID_ACCOUNT_TYPES) NET of revolving credit.
 *
 * Why this file exists (§12.2.1 — one formula, one place): revolving credit
 * has TWO representations in the data model, and the first fix (#1452) only
 * netted one of them:
 *
 *   1. A `Loan` with `type === 'CREDIT_CARD'` (positive `principal`) —
 *      classified into `netWorth.liabilities.creditCards` by
 *      `calculateTotalLiabilities` (lib/calculations/netWorthCalculator.ts).
 *   2. An `Account` with `type === 'CREDIT_CARD'` carrying a NEGATIVE
 *      `currentBalance` — it flows into `netWorth.assets.accounts`, so the
 *      loans-only `liabilities.creditCards` is 0 and a "− creditCards"
 *      netting is silently inert. This is the LIVE topology (VR-007 capture:
 *      "Qantas | Credit card | −$2,496" listed among the 3 accounts), and it
 *      is why VR-017 still saw Safety Net "Liquid savings" gross at $304,304
 *      while the deploy of #1452 was confirmed live.
 *
 * §19.2 worked example (live data, VR-017): gross spendable cash $304,304;
 * account-typed card −$2,496 → revolving credit $2,496 → net $301,808;
 * emergency months = 301,808 ÷ 25,973 burn = 11.62 → 11.6.
 *
 * Consumers: `getMasterFinancialSnapshot` (quickMetrics.liquidCash → Safety
 * Net, emergency fund, insights freeToday, CFO chat, accessibility buckets)
 * and `lib/cfo/scoreCalculator` (emergency-buffer dimension).
 *
 * A CREDIT_CARD account with a POSITIVE balance (overpaid card) contributes
 * zero revolving credit; the credit balance is not spendable-account cash
 * (CREDIT_CARD is not in LIQUID_ACCOUNT_TYPES) so it is excluded from gross.
 */

import { LIQUID_ACCOUNT_TYPES } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal, sumDecimal } from '@/lib/decimal';

export interface LiquidCashAccountInput {
  type?: string | null;
  currentBalance: number;
}

export interface LiquidCashResult {
  /** Σ balances of LIQUID_ACCOUNT_TYPES accounts (spendable, before cards). */
  gross: number;
  /** Card debt held as CREDIT_CARD-typed accounts with negative balances. */
  accountCardDebt: number;
  /** accountCardDebt + credit-card LOAN principal (the caller passes it). */
  revolvingCredit: number;
  /** THE canonical deployable figure: gross − revolvingCredit. */
  net: number;
}

/**
 * Compute the canonical deployable liquid cash.
 *
 * @param accounts            All of the user's accounts (any types; filtered here).
 * @param creditCardLoanTotal Credit-card debt held as LOANS — pass
 *                            `netWorth.liabilities.creditCards` (or
 *                            `calculateTotalLiabilities(loans).creditCards`).
 *                            Defaults to 0 for callers without loan data.
 */
export function computeLiquidCash(
  accounts: LiquidCashAccountInput[],
  creditCardLoanTotal = 0,
): LiquidCashResult {
  const gross = accounts
    .filter((a) => LIQUID_ACCOUNT_TYPES.includes(a.type as (typeof LIQUID_ACCOUNT_TYPES)[number]))
    .reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

  const accountCardDebt = accounts
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + Math.max(0, -Number(a.currentBalance || 0)), 0);

  const revolvingCredit = accountCardDebt + Math.max(0, creditCardLoanTotal);

  return { gross, accountCardDebt, revolvingCredit, net: gross - revolvingCredit };
}

// =============================================================================
// Q-DEC — Decimal sibling (same contract; end-to-end Decimal, no rounding)
// =============================================================================

export interface LiquidCashResultDecimal {
  gross: Decimal;
  accountCardDebt: Decimal;
  revolvingCredit: Decimal;
  net: Decimal;
}

/** Decimal sibling of `computeLiquidCash`. Same contract. */
export function computeLiquidCashDecimal(
  accounts: LiquidCashAccountInput[],
  creditCardLoanTotal: Decimal = new Decimal(0),
): LiquidCashResultDecimal {
  const ZERO = new Decimal(0);

  const gross = sumDecimal(
    accounts
      .filter((a) => LIQUID_ACCOUNT_TYPES.includes(a.type as (typeof LIQUID_ACCOUNT_TYPES)[number]))
      .map((a) => toDecimal(a.currentBalance)),
  );

  const accountCardDebt = sumDecimal(
    accounts
      .filter((a) => a.type === 'CREDIT_CARD')
      .map((a) => {
        const bal = toDecimal(a.currentBalance) ?? ZERO;
        return bal.isNegative() ? bal.negated() : ZERO;
      }),
  );

  const loanCc = creditCardLoanTotal.isNegative() ? ZERO : creditCardLoanTotal;
  const revolvingCredit = accountCardDebt.plus(loanCc);

  return { gross, accountCardDebt, revolvingCredit, net: gross.minus(revolvingCredit) };
}
