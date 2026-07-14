/**
 * NEOAUDIT §2 TIER 2 — the combinatorial mutation generator.
 *
 * Produces named, DETERMINISTIC mutations of the golden "Avalon" rows along the
 * §2 axes (frequency × ownership × loan type × one-offs × negative equity ×
 * entity-mix). Each returns a fresh deep clone so cases never bleed. The Tier-2
 * test runs BOTH the production snapshot AND the independent oracle on each and
 * asserts they agree — so a composition/mapping bug the mutation exposes fails.
 *
 * The mutations respect the oracle's honest scope (snapshotOracle.ts): no PAYG
 * income, ≤1 rental per property, declared basis — so on a CORRECT engine oracle
 * and production agree by construction, and any disagreement is a real finding.
 */
import { GOLDEN_DB } from '../goldenHousehold';

type Rows = Record<string, Record<string, unknown>[]>;
const clone = (): Rows => structuredClone(GOLDEN_DB) as unknown as Rows;
const FREQS = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'] as const;

export interface MutationCase { name: string; rows: Rows; }

/** The generated set — a curated matrix (each case is understandable + labelled). */
export function mutationCases(): MutationCase[] {
  const cases: MutationCase[] = [];
  const add = (name: string, fn: (r: Rows) => void) => { const r = clone(); fn(r); cases.push({ name, rows: r }); };

  // ── Axis: FREQUENCY — re-express income/expense/loan at each cadence ──
  for (const f of FREQS) {
    add(`income-freq-${f}`, (r) => { for (const i of r.income) i.frequency = f; });
    add(`expense-freq-${f}`, (r) => { for (const e of r.expense) e.frequency = f; });
    add(`loan-repayfreq-${f === 'QUARTERLY' || f === 'HALF_YEARLY' || f === 'ANNUAL' ? 'MONTHLY' : f}`,
      (r) => { for (const l of r.loan) l.repaymentFrequency = (f === 'QUARTERLY' || f === 'HALF_YEARLY' || f === 'ANNUAL') ? 'MONTHLY' : f; });
  }

  // ── Axis: OWNERSHIP — property type HOME vs INVESTMENT (must not change net worth) ──
  add('property-type-HOME', (r) => { r.property[0].type = 'HOME'; });
  add('property-type-INVESTMENT', (r) => { r.property[0].type = 'INVESTMENT'; });

  // ── Axis: LOAN TYPE — recategorise + secured/unsecured (net worth unchanged; only the mortgage/personal split moves) ──
  add('loan-type-HOME', (r) => { r.loan[0].type = 'HOME'; });
  add('loan-unsecure-mortgage', (r) => { r.loan[0].propertyId = null; r.loan[0].type = 'PERSONAL'; });
  add('loan-secure-personal', (r) => { r.loan[1].propertyId = 'p-avalon'; r.loan[1].type = 'INVESTMENT'; });

  // ── Axis: ONE-OFFS — non-recurring expenses MUST be excluded from monthly ──
  add('add-oneoff-expense', (r) => {
    r.expense.push({ id: 'e-oneoff', ownerEntityId: null, name: 'One-off legal', amount: 9000, frequency: 'MONTHLY', category: 'OTHER', isEssential: false, isRecurring: false, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null });
  });
  add('add-two-oneoffs', (r) => {
    for (const [id, amt] of [['e-o1', 5000], ['e-o2', 12000]] as [string, number][])
      r.expense.push({ id, ownerEntityId: null, name: id, amount: amt, frequency: 'ANNUAL', category: 'OTHER', isEssential: false, isRecurring: false, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null });
  });

  // ── Axis: NEGATIVE EQUITY — loan principal > property value (net worth goes negative on that asset) ──
  add('negative-equity', (r) => { r.loan[0].principal = 1_200_000; });
  add('deep-negative-equity', (r) => { r.property[0].currentValue = 100_000; r.loan[0].principal = 900_000; });

  // ── Axis: ENTITY MIX — extra rows that exercise the exclusions ──
  add('extra-smsf-excluded', (r) => { r.superannuationAccount.push({ id: 's-smsf2', ownerEntityId: null, currentBalance: 250_000, fundType: 'SMSF' }); });
  add('extra-industry-super-counted', (r) => { r.superannuationAccount.push({ id: 's-ind2', ownerEntityId: null, currentBalance: 60_000, fundType: 'INDUSTRY' }); });
  add('extra-sold-asset-excluded', (r) => { r.asset.push({ id: 'as-sold2', ownerEntityId: null, currentValue: 44_444, status: 'SOLD' }); });
  add('extra-active-asset-counted', (r) => { r.asset.push({ id: 'as-active2', ownerEntityId: null, currentValue: 8_000, status: 'ACTIVE' }); });
  // A CREDIT_CARD *account* is an ASSET (engine counts all accounts); a
  // CREDIT_CARD *loan* is the credit-card LIABILITY channel. Test both.
  add('extra-credit-card-account-asset', (r) => { r.account.push({ id: 'a-cc', ownerEntityId: null, name: 'Visa', type: 'CREDIT_CARD', currentBalance: 6_500, balanceSource: 'MANUAL', balanceLastUpdatedAt: new Date('2026-07-01T00:00:00Z') }); });
  add('extra-credit-card-loan-liability', (r) => { r.loan.push({ id: 'l-cc', ownerEntityId: null, name: 'Visa debt', principal: 8_000, minRepayment: 300, repaymentFrequency: 'MONTHLY', interestRateAnnual: 0.1999, type: 'CREDIT_CARD', isInterestOnly: false, propertyId: null, offsetAccountId: null }); });
  add('extra-savings-account', (r) => { r.account.push({ id: 'a-save2', ownerEntityId: null, name: 'Savings 2', type: 'SAVINGS', currentBalance: 33_000, balanceSource: 'MANUAL', balanceLastUpdatedAt: new Date('2026-07-01T00:00:00Z') }); });
  add('extra-investment-holding', (r) => { r.investmentHolding.push({ id: 'h-vgs', investmentAccount: { ownerEntityId: null }, ticker: 'VGS', units: 200, averagePrice: 90, currentPrice: 110, type: 'ETF' }); });

  // ── Combined — several axes at once (the true "combinatorial" case) ──
  add('combined-mix', (r) => {
    for (const i of r.income) i.frequency = 'FORTNIGHTLY';
    r.property[0].type = 'HOME';
    r.loan[0].principal = 1_050_000; // negative equity
    r.expense.push({ id: 'e-oneoff-c', ownerEntityId: null, name: 'One-off', amount: 4000, frequency: 'MONTHLY', category: 'OTHER', isEssential: false, isRecurring: false, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null });
    r.superannuationAccount.push({ id: 's-smsf3', ownerEntityId: null, currentBalance: 500_000, fundType: 'SMSF' });
    r.account.push({ id: 'a-cc2', ownerEntityId: null, name: 'MC', type: 'CREDIT_CARD', currentBalance: 2_000, balanceSource: 'MANUAL', balanceLastUpdatedAt: new Date('2026-07-01T00:00:00Z') });
  });

  return cases;
}
