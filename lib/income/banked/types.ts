/**
 * MON-131 Tranche 1 (MON-128) — BANKED INCOME types (D17 / D20).
 *
 * "Banked income" = cash that actually reaches the account (D17, supersedes
 * D9). NOT named "net income" — that phrase means after-tax everywhere else.
 *
 * Layering (D20):
 *   L1 source engines (salaryBanked · rentalBanked · receivedBanked) — one
 *      engine per source THAT HAS RULES OF ITS OWN; each computes a banked
 *      amount and nothing else.
 *   L2 aggregator (aggregator.ts) — pure summation; sources MUST sum to the
 *      total (permanent invariant).
 *   L3 tax engine — untouched by this module; tax is computed once, on the
 *      aggregate, never per source.
 *
 * Data-model honesty: `IncomeType` is SALARY | RENT | RENTAL | INVESTMENT |
 * OTHER. The build spec's "dividends" source maps to INVESTMENT (cash
 * received; franking credits are a Layer-3 offset, never cash) and "business
 * distributions" have no income-row representation — trust/company
 * distribution intelligence lives in the LegalEntity distribution tables and
 * stays outside this engine (recorded in the T1 coverage boundary).
 */

import type { TaxYearConfig } from '@/lib/tax-engine/types';

/** The FULL Income-row read the banked engines require. Every field the
 *  legacy producers variously dropped (the MON-137 class) is REQUIRED to be
 *  present in the type so an input-feed omission is a compile error, not a
 *  silent gross≡net degradation. Nullable = nullable in the schema. */
export interface BankedIncomeRow {
  id?: string;
  type: string;
  name?: string;
  /** Declared amount, per `frequency` period. */
  amount: number;
  frequency: string;
  /** MON-053/MON-128: false = one-off — contributes 0 to every run-rate. */
  isRecurring?: boolean | null;
  salaryType?: string | null;
  /** ALREADY-ANNUAL (schema contract — asymmetric with `amount`). */
  grossAmount?: number | null;
  /** ALREADY-ANNUAL (schema contract). */
  netAmount?: number | null;
  /** ALREADY-ANNUAL (schema contract). */
  paygWithholding?: number | null;
  /**
   * T1 FACT field: actual net pay from a payslip/bank credit, per the ROW'S
   * OWN `frequency` period (D33 — deliberately NOT the already-annual
   * convention of its siblings; that asymmetry is the #1 unit trap and new
   * fields do not extend it). A present FACT always wins over derivation.
   */
  actualNetPay?: number | null;
  /** ALREADY-ANNUAL pre-tax super sacrifice (existing schema field). */
  salarySacrifice?: number | null;
  /**
   * T1 FACT field: the earner has declared a study loan (HELP/STSL) to the
   * employer. null = UNDETERMINED — absence of the flag is NOT evidence of
   * absence of a loan (build brief §5); the derived HELP component is then
   * flagged undetermined, never asserted zero.
   */
  helpLoanDeclared?: boolean | null;
  isTaxable?: boolean;
  propertyId?: string | null;
  investmentAccountId?: string | null;
  ownerEntityId?: string | null;
  /** Phase 59 managed rentals — passed through to the rental engine. */
  rentalMode?: string | null;
}

/** Context the DERIVED salary path needs. Assembled by the caller (engines
 *  are pure — CLAUDE.md §6.4). */
export interface BankedContext {
  /** The FY config whose paygSchedule/helpRepayment govern derivation. */
  config: TaxYearConfig;
  /**
   * Repayment income (D42 C3) for the HELP band — computed via
   * `computeRepaymentIncome` from the canonical tax position. null =
   * not establishable → the HELP component renders UNDETERMINED.
   */
  repaymentIncome: number | null;
}

export type SalaryBankedBasis =
  | 'FACT_ACTUAL_NET_PAY'
  | 'FACT_NET_ENTERED'
  | 'DERIVED_SCHEDULE'
  | 'UNDETERMINED';

/** Per-row result shared by all L1 engines. All figures ANNUAL unless named. */
export interface BankedRowResult {
  id?: string;
  source: 'salary' | 'rental' | 'investment' | 'other';
  /** Annual banked run-rate — 0 for a one-off row (gated, never ×frequency). */
  bankedAnnual: number;
  /** Annual gross run-rate; null = gross not establishable (never fabricated). */
  grossAnnual: number | null;
  /** gross − banked wedge components, where derivable. Annual. */
  components: {
    payg: number | null;
    help: number | null;
    salarySacrifice: number;
  };
  basis: SalaryBankedBasis | 'DECLARED_RECEIVED' | 'ACTUALS_RESOLVED';
  /** One-off value counted ONCE (never in run-rates); 0 for recurring rows. */
  oneOffAmount: number;
  /** Named components that could not be established for this row. */
  undetermined: string[];
  flags: string[];
}
