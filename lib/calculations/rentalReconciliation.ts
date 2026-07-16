/**
 * Phase 59 — Managed rental reconciliation: the ONE canonical producer of the
 * agent-cost gap (docs/blueprint/PHASE_59_MANAGED_RENTAL_INCOME.md §3–§5).
 *
 * An agent-managed rental never hits the bank as gross rent: the property
 * manager collects gross, deducts their costs (management fee, letting fee,
 * repairs, water), and disburses the NET — often on a different cadence than
 * the rent (weekly rent → fortnightly/monthly disbursement). The declared
 * gross stays the assessable income (ITAA 1997 s6-5); the gap between the
 * cadence-normalised gross and the net disbursement is the agent's costs —
 * usually deductible (ITAA 1997 s8-1), surfaced to the user for confirmation
 * (never silently ruled immediate-vs-capital — spec §10).
 *
 *   gap = grossDeclared(disbursement period) − netDisbursement
 *   e.g. $650/wk declared, $1,100/ft disbursed:
 *        650 × 52 ÷ 26 = 1,300/ft → gap = 200/ft → 5,200/yr deductible
 *
 * SSOT (§12.2.1): this file is the ONLY place the gap is computed. Cadence
 * normalisation reuses the canonical `toAnnual`/`periodsPerYear`
 * (lib/utils/frequencies.ts) and, for evidence-derived cadence, the ONE
 * canonical `detectFrequency` (lib/utils/reconciliation.ts — the same
 * producer `classifyIntake`'s C1 path uses). Never a second cadence path.
 * The Ring-1 source-lock (tests/tax/rentalReconciliationSourceLock.test.ts)
 * fails CI on a second producer.
 *
 * PURE (§6.4): no fetching, no mutation. Callers fetch the stream, the
 * disbursement transaction(s), and the learn-once AgentDisbursementRule and
 * pass them in.
 *
 * Neomatrix: engine.rentalReconciliation.reconcileManagedRental →
 * number.rental.agentCostDeduction → feeds the canonical tax position
 * (the derived Expense row, isTaxDeductible + propertyId, flows through
 * taxPositionCalculator's deductible-expense loop into deductions.property).
 */

import { Frequency } from '@/lib/types/prisma-enums';
import { toAnnual, toAnnualDecimal, periodsPerYear } from '@/lib/utils/frequencies';
import { detectFrequency } from '@/lib/utils/reconciliation';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// Materiality + tolerance constants (named, single home — never inline these)
// =============================================================================

/** A gap below this fraction of the period gross is rounding noise, not a
 *  reconciliation event (agent fees run ~5–8%; 1% is safely below any real
 *  management cost while ignoring cent-level drift). */
export const MATERIALITY_MIN_FRACTION = 0.01;

/** ...and a gap below this many dollars is never material on its own. */
export const MATERIALITY_MIN_DOLLARS = 5;

// =============================================================================
// Types
// =============================================================================

export interface AgentRuleLike {
  /** The confirmed gap per disbursement period the rule was learned on. */
  baselineGapAmount: number;
  /** Deviation tolerance as a fraction of baselineGapAmount (0.2 = ±20%). */
  tolerancePct: number;
}

export interface ManagedRentalReconciliationInput {
  /** DECLARED gross rent per its own period — `Income.amount` (e.g. 650). */
  declaredGrossAmount: number;
  /** Cadence of the declared gross — `Income.frequency` (e.g. WEEKLY). */
  declaredGrossFrequency: Frequency;
  /** The net bank credit being reconciled (e.g. 1100). */
  netDisbursementAmount: number;
  /** Explicit disbursement cadence, when the caller already knows it
   *  (e.g. from the stream's AgentDisbursementRule). Wins over evidence. */
  disbursementFrequency?: Frequency | null;
  /** Cadence EVIDENCE — dates of same-stream disbursements. With ≥2 dates
   *  the ONE canonical detector derives the cadence (C1 discipline). */
  disbursementDates?: Array<Date | string>;
  /** The stream's learn-once rule, if one exists (anomaly detection). */
  rule?: AgentRuleLike | null;
}

export interface ManagedRentalReconciliation {
  /** The cadence the gap is expressed in (resolved per the rules above). */
  disbursementFrequency: Frequency;
  /** Declared gross normalised to the disbursement period (e.g. 1300). */
  grossPerDisbursementPeriod: number;
  /** The agent-cost gap for ONE disbursement period (e.g. 200).
   *  Negative when the disbursement EXCEEDS the declared gross. */
  gap: number;
  /** The gap annualised at the disbursement cadence (e.g. 5200). */
  gapAnnual: number;
  /** True when the gap is big enough to be a real reconciliation event
   *  (≥ MATERIALITY_MIN_FRACTION of period gross AND ≥ MATERIALITY_MIN_DOLLARS). */
  material: boolean;
  /** True when a rule exists and this gap deviates from its baseline by
   *  more than tolerancePct — the anomaly re-confirm (likely a repair). */
  anomaly: boolean;
  /** gap − baselineGapAmount when anomalous (the likely one-off cost),
   *  else 0. Negative anomalies (gap SHRANK) also report their excess. */
  anomalyExcess: number;
}

// =============================================================================
// Cadence resolution (ONE path — explicit > evidence > declared cadence)
// =============================================================================

function resolveDisbursementFrequency(input: ManagedRentalReconciliationInput): Frequency {
  if (input.disbursementFrequency) return input.disbursementFrequency;

  const dates = (input.disbursementDates ?? [])
    .map((d) => (d instanceof Date ? d : new Date(d)))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length >= 2) {
    // The ONE canonical detector — same producer classifyIntake's C1 uses.
    return detectFrequency(dates).frequency;
  }

  // A lone disbursement with no known cadence: compare on the rent's own
  // cadence (gross per period = the declared amount itself). Conservative —
  // the first confirm establishes the real cadence in the rule.
  return input.declaredGrossFrequency;
}

// =============================================================================
// The engine (Float)
// =============================================================================

export function reconcileManagedRental(
  input: ManagedRentalReconciliationInput,
): ManagedRentalReconciliation {
  const disbursementFrequency = resolveDisbursementFrequency(input);

  const grossAnnual = toAnnual(input.declaredGrossAmount, input.declaredGrossFrequency);
  const grossPerDisbursementPeriod = grossAnnual / periodsPerYear(disbursementFrequency);

  const gap = grossPerDisbursementPeriod - input.netDisbursementAmount;
  const gapAnnual = toAnnual(gap, disbursementFrequency);

  const material =
    gap >= MATERIALITY_MIN_DOLLARS &&
    grossPerDisbursementPeriod > 0 &&
    gap / grossPerDisbursementPeriod >= MATERIALITY_MIN_FRACTION;

  let anomaly = false;
  let anomalyExcess = 0;
  if (input.rule && input.rule.baselineGapAmount > 0) {
    const deviation = gap - input.rule.baselineGapAmount;
    if (Math.abs(deviation) > input.rule.tolerancePct * input.rule.baselineGapAmount) {
      anomaly = true;
      anomalyExcess = deviation;
    }
  }

  return {
    disbursementFrequency,
    grossPerDisbursementPeriod,
    gap,
    gapAnnual,
    material,
    anomaly,
    anomalyExcess,
  };
}

// =============================================================================
// The engine (Decimal twin — §12.2.1: the two paths must never disagree)
// =============================================================================

export interface ManagedRentalReconciliationDecimal {
  disbursementFrequency: Frequency;
  grossPerDisbursementPeriod: Decimal;
  gap: Decimal;
  gapAnnual: Decimal;
  material: boolean;
  anomaly: boolean;
  anomalyExcess: Decimal;
}

export function reconcileManagedRentalDecimal(
  input: ManagedRentalReconciliationInput,
): ManagedRentalReconciliationDecimal {
  const disbursementFrequency = resolveDisbursementFrequency(input);

  const grossAnnual = toAnnualDecimal(input.declaredGrossAmount, input.declaredGrossFrequency);
  const grossPerDisbursementPeriod = grossAnnual.div(periodsPerYear(disbursementFrequency));

  const net = toDecimal(input.netDisbursementAmount) ?? new Decimal(0);
  const gap = grossPerDisbursementPeriod.minus(net);
  const gapAnnual = toAnnualDecimal(gap, disbursementFrequency);

  const material =
    gap.gte(MATERIALITY_MIN_DOLLARS) &&
    grossPerDisbursementPeriod.gt(0) &&
    gap.div(grossPerDisbursementPeriod).gte(MATERIALITY_MIN_FRACTION);

  let anomaly = false;
  let anomalyExcess = new Decimal(0);
  if (input.rule && input.rule.baselineGapAmount > 0) {
    const baseline = toDecimal(input.rule.baselineGapAmount) ?? new Decimal(0);
    const deviation = gap.minus(baseline);
    if (deviation.abs().gt(baseline.times(input.rule.tolerancePct))) {
      anomaly = true;
      anomalyExcess = deviation;
    }
  }

  return {
    disbursementFrequency,
    grossPerDisbursementPeriod,
    gap,
    gapAnnual,
    material,
    anomaly,
    anomalyExcess,
  };
}

// =============================================================================
// The ONE derived-expense shape (persisted by the confirm/auto-derive paths)
// =============================================================================

/** What the caller must supply about the stream to build the derived row. */
export interface DerivedExpenseContext {
  userId: string;
  ownerEntityId: string;
  incomeStreamId: string;
  propertyId?: string | null;
  managingAgentName?: string | null;
}

/**
 * Build the create-payload for the RECONCILIATION-derived agent-cost expense —
 * the single un-itemised estimate ("Agent management & property costs").
 * ONE shape, built here only, so every producer (confirm endpoint, silent
 * auto-derive) persists an identical row. Recurring at the disbursement
 * cadence → annualises to gap × periods/yr in the canonical tax engine.
 *
 * The row is `isTaxDeductible: true` + property-linked, so it flows into
 * `calculateTaxPosition().deductions.property` through the EXISTING
 * deductible-expense loop — the derived row IS the tax wiring; no second
 * producer touches the tax engine.
 */
export function buildDerivedAgentCostExpense(
  ctx: DerivedExpenseContext,
  reconciliation: Pick<ManagedRentalReconciliation, 'gap' | 'disbursementFrequency'>,
) {
  return {
    userId: ctx.userId,
    ownerEntityId: ctx.ownerEntityId,
    name: ctx.managingAgentName
      ? `Agent management & property costs — ${ctx.managingAgentName}`
      : 'Agent management & property costs',
    category: 'PROPERTY_MANAGEMENT' as const,
    sourceType: (ctx.propertyId ? 'PROPERTY' : 'GENERAL') as 'PROPERTY' | 'GENERAL',
    amount: reconciliation.gap,
    frequency: reconciliation.disbursementFrequency,
    isEssential: true,
    isTaxDeductible: true,
    isRecurring: true,
    derived: true,
    derivedSource: 'RECONCILIATION' as const,
    itemised: false,
    derivedFromIncomeId: ctx.incomeStreamId,
    propertyId: ctx.propertyId ?? null,
  };
}

/**
 * Build the create-payload for a one-off ANOMALY excess (the likely repair the
 * anomaly re-confirm surfaced). One-off (`isRecurring: false`) — counted ONCE
 * by the tax engine (MON-037 semantics), never annualised.
 */
export function buildAnomalyExcessExpense(
  ctx: DerivedExpenseContext,
  reconciliation: Pick<ManagedRentalReconciliation, 'anomalyExcess' | 'disbursementFrequency'>,
  label?: string | null,
) {
  return {
    userId: ctx.userId,
    ownerEntityId: ctx.ownerEntityId,
    name: label || 'Property costs — above usual agent deduction',
    category: 'PROPERTY_MANAGEMENT' as const,
    sourceType: (ctx.propertyId ? 'PROPERTY' : 'GENERAL') as 'PROPERTY' | 'GENERAL',
    amount: reconciliation.anomalyExcess,
    frequency: reconciliation.disbursementFrequency,
    isEssential: true,
    isTaxDeductible: true,
    isRecurring: false, // one-off — counted once (MON-037 semantics)
    derived: true,
    derivedSource: 'RECONCILIATION' as const,
    itemised: false,
    derivedFromIncomeId: ctx.incomeStreamId,
    propertyId: ctx.propertyId ?? null,
  };
}
