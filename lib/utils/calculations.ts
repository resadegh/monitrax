import { Decimal, toDecimal } from '@/lib/decimal';

/**
 * Calculate Loan to Value Ratio (LVR)
 * @param loanBalance Total loan balance
 * @param propertyValue Current property value
 * @returns LVR as percentage (0-100)
 */
export function calculateLVR(loanBalance: number, propertyValue: number): number {
  // Guard `<= 0` (not just `=== 0`): a zero OR negative property value has no
  // meaningful LVR — return 0 rather than a negative ratio. This makes this the
  // single source for every LVR surface (the portfolio-snapshot route kept a
  // `<= 0` local copy — now deleted; SSOT §12.2.1).
  if (propertyValue <= 0) return 0;
  return (loanBalance / propertyValue) * 100;
}

/**
 * Calculate property equity — SIGNED (value − loan).
 *
 * MON-011: this previously floored at 0 (`Math.max(0, …)`), which HID negative
 * equity (a property that owes more than it's worth) and — because the portfolio
 * total `propertyPortfolioEquity` sums per-property equity — OVERSTATED total
 * equity by the floored shortfall (e.g. a −$37,076 property counted as $0). It
 * also disagreed with net worth (which uses global unfloored Σvalue − Σmortgages)
 * and with the properties page (already signed), and left `sellProperty`'s
 * `equity < 0` branch dead. Equity is value − loan by definition and is signed.
 *
 * @param propertyValue Current property value
 * @param loanBalance Total loan balance
 * @returns Equity amount (may be negative when the property is underwater)
 */
export function calculateEquity(propertyValue: number, loanBalance: number): number {
  return propertyValue - loanBalance;
}

/**
 * Calculate rental yield (annual)
 * @param annualRent Annual rental income
 * @param propertyValue Current property value
 * @returns Yield as percentage
 */
export function calculateRentalYield(annualRent: number, propertyValue: number): number {
  // Guard `<= 0` (not just `=== 0`) — SSOT for every rental-yield surface (the
  // portfolio-snapshot route kept a `<= 0` local copy — now deleted; §12.2.1).
  if (propertyValue <= 0) return 0;
  return (annualRent / propertyValue) * 100;
}

/**
 * Calculate effective principal for interest calculation
 * Accounts for offset balance reducing the interest-bearing amount
 * @param principal Loan principal
 * @param offsetBalance Offset account balance
 * @returns Effective principal for interest calculation
 */
export function calculateEffectivePrincipal(principal: number, offsetBalance: number): number {
  return Math.max(0, principal - offsetBalance);
}

/**
 * Calculate interest for a period
 * @param principal Principal amount
 * @param annualRate Annual interest rate (e.g., 0.0625 for 6.25%)
 * @param periodsPerYear Number of periods per year (12 for monthly, 26 for fortnightly, etc.)
 * @returns Interest amount for the period
 */
export function calculateInterestForPeriod(
  principal: number,
  annualRate: number,
  periodsPerYear: number
): number {
  const periodicRate = annualRate / periodsPerYear;
  return principal * periodicRate;
}

/**
 * Calculate monthly principal and interest repayment
 * @param principal Loan principal
 * @param annualRate Annual interest rate
 * @param termMonths Total loan term in months
 * @returns Monthly P&I repayment
 */
export function calculatePIRepayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (termMonths === 0 || annualRate === 0) return principal / Math.max(1, termMonths);

  const monthlyRate = annualRate / 12;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;

  return numerator / denominator;
}

// =============================================================================
// Q-DEC PR 2.E.1 — Decimal sibling primitives
// =============================================================================

/**
 * Decimal sibling of `calculateEffectivePrincipal`.
 * `max(0, principal - offsetBalance)`. Mirrors Float floor.
 */
export function calculateEffectivePrincipalDecimal(
  principal: number | string | Decimal,
  offsetBalance: number | string | Decimal,
): Decimal {
  const p = toDecimal(principal) ?? new Decimal(0);
  const o = toDecimal(offsetBalance) ?? new Decimal(0);
  return Decimal.max(new Decimal(0), p.minus(o));
}

/**
 * Decimal sibling of `calculateInterestForPeriod`.
 * `principal × (annualRate / periodsPerYear)`. Returns Decimal — no
 * rounding (callers decide).
 */
export function calculateInterestForPeriodDecimal(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal,
  periodsPerYear: number,
): Decimal {
  const p = toDecimal(principal) ?? new Decimal(0);
  const r = toDecimal(annualRate) ?? new Decimal(0);
  if (periodsPerYear === 0) return new Decimal(0);
  const periodicRate = r.div(periodsPerYear);
  return p.times(periodicRate);
}

/**
 * Decimal sibling of `calculatePIRepayment`. Exact amortising-annuity
 * formula via `Decimal.pow` with integer exponent. Degenerate cases
 * (`termMonths === 0` or `annualRate === 0`) fall back to straight-line
 * `principal / max(1, termMonths)` to mirror Float.
 */
export function calculatePIRepaymentDecimal(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal,
  termMonths: number,
): Decimal {
  const p = toDecimal(principal) ?? new Decimal(0);
  const r = toDecimal(annualRate) ?? new Decimal(0);

  if (termMonths === 0 || r.isZero()) {
    return p.div(Math.max(1, termMonths));
  }

  const monthlyRate = r.div(12);
  const onePlusRPow = new Decimal(1).plus(monthlyRate).pow(termMonths);
  const numerator = p.times(monthlyRate).times(onePlusRPow);
  const denominator = onePlusRPow.minus(1);

  return numerator.div(denominator);
}
