/**
 * Income aggregation TYPES — the shapes the income breakdown surfaces read.
 *
 * MON-131 T1-B: the aggregation FUNCTIONS that lived here
 * (`aggregateIncome`, `aggregateIncomeBySource` + their Decimal siblings)
 * are DELETED, not deprecated (CLAUDE.md §12.1 / T1-B brief §2 "delete
 * legacy producers citing contract entries"). They were the legacy income
 * run-rate producer: stored-field trust (`grossAmount` / `netAmount` /
 * `paygWithholding` read verbatim whether or not they matched the row),
 * gross ≡ net for un-annotated salary rows (the VR-042 V3 wedge-loss
 * class), and no one-off gate (the MON-053 class). Contract authorities:
 *   - docs/architecture/contracts/income-gross-run-rate.md
 *   - docs/architecture/contracts/income-net-run-rate.md   (variant B)
 *   - docs/architecture/contracts/salary-take-home.md
 *
 * The ONE producer is now the banked-income engine
 * (`lib/income/banked/aggregator.ts`, D17/D20). `IncomeAggregation`
 * survives as the projection shape it emits via `projectAggregation`;
 * `IncomeInput` survives as the raw-row shape a few callers still type
 * against.
 */

export interface IncomeInput {
  amount: number;
  frequency: string;
  type?: string;
  salaryType?: string | null;
  netAmount?: number | null;
  grossAmount?: number | null;
  paygWithholding?: number | null;
  isTaxable?: boolean;
  propertyId?: string | null;
  investmentAccountId?: string | null;
  /** Phase 41a — `LegalEntity` ownership FK (Phase 41e.0 audit C-3). */
  ownerEntityId?: string | null;
}

export interface IncomeAggregation {
  grossTotal: number;
  /** BANKED since MON-131 T1-B (D17) — cash reaching the account. The
   *  field name survives this tranche for baseline path continuity. */
  netTotal: number;
  paygWithholding: number;
  byType: Record<string, { gross: number; net: number }>;
  taxableIncome: number;
  nonTaxableIncome: number;
}
