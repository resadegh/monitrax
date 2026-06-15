/**
 * Canonical asset-value + loan-balance helpers (Phase 3 fix PR1 — closes audit
 * findings L1-1 / L1-2 / L1-3 in `docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md`).
 *
 * SINGLE SOURCE for two questions every read-model re-asked differently:
 *   - "what is an investment holding worth?"  → {@link holdingMarketValue}
 *   - "what does a loan currently owe?"        → {@link loanBalance}
 *
 * These mirror the basis the canonical net-worth engine already uses
 * (`lib/calculations/netWorthCalculator.ts` — Float path, the live path):
 *   - holding value = `units × (currentPrice || averagePrice)` — live market
 *     price, falling back to cost basis (`calculateTotalAssets`, :127-131).
 *   - loan balance  = `Number(loan.principal || 0)` — note `Loan.principal` is
 *     schema-documented as "Current balance" (`prisma/schema.prisma`), so it IS
 *     the outstanding balance, not the original face amount
 *     (`calculateTotalLiabilities`, :192).
 *
 * Read-models MUST import these instead of re-deriving value, so every surface
 * (Wealth-Universe graph, report context, AI advisor) agrees with the dashboard
 * / master snapshot for the same input. The tests in
 * `tests/calculations/assetValuation.test.ts` pin each helper to the canonical
 * engine output for the same fixtures — do NOT change a formula here without
 * changing `netWorthCalculator` in lockstep.
 *
 * NOTE: this intentionally matches the **Float** canonical path (`||`, falsy).
 * The Decimal sibling uses `??` (nullish); they differ only at an exact `0`
 * value (audit L1-5), which is a separate, latent item that closes with the
 * Float-path retirement (Q-DEC). Matching the live Float path is what makes
 * these helpers equal to what users see today.
 */

export interface HoldingValueInput {
  units?: number | null;
  /** Live market price per unit. Preferred basis. */
  currentPrice?: number | null;
  /** Cost basis per unit. Fallback when no live price. */
  averagePrice?: number | null;
}

/**
 * Market value of a single holding: `units × (currentPrice || averagePrice)`.
 * Mirrors `netWorthCalculator.calculateTotalAssets` (Float path) exactly.
 */
export function holdingMarketValue(h: HoldingValueInput): number {
  const price = Number(h.currentPrice || h.averagePrice || 0);
  const units = Number(h.units || 0);
  return units * price;
}

/** Sum of {@link holdingMarketValue} over a set of holdings. */
export function sumHoldingsMarketValue(holdings: HoldingValueInput[]): number {
  return holdings.reduce((sum, h) => sum + holdingMarketValue(h), 0);
}

export interface LoanBalanceInput {
  /** Canonical field — `Loan.principal` IS the current balance (schema). */
  principal?: number | null;
  /** Some mapped shapes (e.g. report fetchers) alias the balance here. */
  currentBalance?: number | null;
  /** The AI-advisor snapshot shape names it `balance`. */
  balance?: number | null;
}

/**
 * Current outstanding balance of a loan. For the canonical raw `Loan` shape
 * (`{ principal }`) this returns `Number(principal || 0)` — identical to
 * `netWorthCalculator.calculateTotalLiabilities`. The extra `currentBalance` /
 * `balance` fallbacks let already-mapped read-model shapes use the same helper
 * without renaming; for the canonical input they never change the result.
 */
export function loanBalance(l: LoanBalanceInput): number {
  return Number(l.principal ?? l.currentBalance ?? l.balance ?? 0);
}

/** Sum of {@link loanBalance} over a set of loans. */
export function sumLoanBalances(loans: LoanBalanceInput[]): number {
  return loans.reduce((sum, l) => sum + loanBalance(l), 0);
}
