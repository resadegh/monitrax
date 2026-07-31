/**
 * MON-131 Tranche 1 — L1 RENTAL banked engine (D17 / D20 / D26 / X6).
 *
 * Banked rental = rent cash actually received, resolved ACTUALS-FIRST at the
 * property-stream level by the ONE canonical per-property engine
 * (`computePropertyCashflow` — pooling, cadence resolution, managed-stream
 * gross-up). This module adds NO arithmetic of its own on the property path —
 * it names the quantity, applies the D26/X6 type-split rule, and gates
 * one-off non-property rows. Deleting a second rent producer, never adding one.
 *
 * THE THREE RENTAL QUANTITIES (T1 trace ruling — build brief §2.1: "if they
 * are two quantities, name both"; the trace found three):
 *   • rentalBankedActuals   — THIS engine's output (actuals-first, D17's
 *     banked basis; historically ≈$154,443/yr on live data).
 *   • rentalDeclaredRunRate — declared amount × frequency, one-off gated
 *     (the Income page's historical ≈$121,227/yr; exposed here per property
 *     as `declaredMonthly` so surfaces can label the plan as the plan).
 *   • rentalTaxableGrossDeclared — the tax position's basis (declared gross,
 *     one-offs once; ≈$121,881/yr). LAYER 3 — produced by
 *     `taxPositionCalculator`, untouched by this tranche.
 *
 * D26(b)/X6 — the RENTAL type split ALREADY EXISTS in the data model:
 * `PropertyType.RENTAL` = "user is renting this property (not owned)". A
 * tenanted residence MUST NOT produce rental income — any RENT/RENTAL income
 * row attached to one is EXCLUDED from banked rental and flagged
 * `MISATTACHED_TENANTED_RESIDENCE` for review (never silently re-included).
 *
 * X7 (D43) — availability facts (`genuinelyAvailableForRent`,
 * `availableDaysPerYear`) are INTAKE-ONLY this tranche: they do not change
 * banked cash (a vacant property banks $0 either way); they exist so the
 * negative-gearing producer (D43, later tranche) can distinguish the four
 * zero-rental states instead of guessing.
 *
 * PURE: no DB, no fetch (CLAUDE.md §6.4).
 */

import { monthlyRunRate } from '@/lib/utils/frequencies';
import {
  computePropertyCashflow,
  type CashflowExpense,
  type CashflowTransaction,
} from '@/lib/calculations/propertyCashflow';
import { Decimal, toDecimal } from '@/lib/decimal';
import type { BankedIncomeRow } from './types';

const RENT_TYPES = new Set(['RENT', 'RENTAL']);
/** PropertyType.RENTAL — the user RENTS this property (tenanted residence). */
const TENANTED_RESIDENCE_TYPE = 'RENTAL';

export interface RentalBankedProperty {
  id: string;
  type: string;
}

export interface RentalBankedInput {
  properties: RentalBankedProperty[];
  income: BankedIncomeRow[];
  /** Derived agent-cost expense rows (Phase 59) for the managed gross-up. */
  derivedAgentExpenses: CashflowExpense[];
  /** Reconciled transactions linked to income rows (actuals win). */
  transactions: CashflowTransaction[];
}

export interface PropertyRentalBanked {
  propertyId: string;
  bankedMonthly: number;
  bankedAnnual: number;
  /** The declared plan for the same stream (rentalDeclaredRunRate basis). */
  declaredMonthly: number;
  usedActuals: boolean;
}

export interface RentalBankedResult {
  source: 'rental';
  /** Σ per-property banked + gated non-property pass-through. Annual. */
  bankedAnnual: number;
  bankedMonthly: number;
  perProperty: PropertyRentalBanked[];
  /** Non-property RENT/RENTAL rows (declared run-rate basis, one-off gated). */
  nonPropertyBankedAnnual: number;
  /** One-off rental receipts counted once, never ×frequency. Annual value. */
  oneOffAmount: number;
  /** Income rows attached to a tenanted-residence property — EXCLUDED. */
  misattachedRows: Array<{ incomeId?: string; propertyId: string }>;
  flags: string[];
}

export function computeRentalBanked(input: RentalBankedInput): RentalBankedResult {
  const flags: string[] = [];
  const misattachedRows: RentalBankedResult['misattachedRows'] = [];
  const ownedProperties = input.properties.filter((p) => p.type !== TENANTED_RESIDENCE_TYPE);
  const tenantedIds = new Set(
    input.properties.filter((p) => p.type === TENANTED_RESIDENCE_TYPE).map((p) => p.id),
  );

  const rentalRowsFor = (propertyId: string) =>
    input.income.filter((i) => i.propertyId === propertyId && RENT_TYPES.has(i.type));

  // D26(b)/X6: rental income attached to a property the user RENTS is a
  // modelling error — excluded and flagged, never counted, never guessed away.
  for (const row of input.income) {
    if (row.propertyId && tenantedIds.has(row.propertyId) && RENT_TYPES.has(row.type)) {
      misattachedRows.push({ incomeId: row.id, propertyId: row.propertyId });
    }
  }
  if (misattachedRows.length > 0) flags.push('MISATTACHED_TENANTED_RESIDENCE');

  const perProperty: PropertyRentalBanked[] = [];
  for (const property of ownedProperties) {
    const rentalRows = rentalRowsFor(property.id);
    if (rentalRows.length === 0) continue;
    const incomeIds = new Set(rentalRows.map((r) => r.id));
    const rentalTx = input.transactions.filter((t) => t.incomeId && incomeIds.has(t.incomeId));
    // THE canonical per-property rent resolution — same call, same inputs as
    // the master snapshot's dedup and the property surfaces (§12.2.1).
    const cf = computePropertyCashflow({
      income: rentalRows.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        frequency: r.frequency,
        rentalMode: r.rentalMode,
      })),
      expenses: input.derivedAgentExpenses.filter(
        (e) => e.derivedFromIncomeId && incomeIds.has(e.derivedFromIncomeId),
      ),
      transactions: rentalTx,
    });
    perProperty.push({
      propertyId: property.id,
      bankedMonthly: cf.monthlyRent,
      bankedAnnual: cf.annualRent,
      declaredMonthly: rentalRows.reduce(
        (sum, r) => sum + monthlyRunRate({ amount: r.amount, frequency: r.frequency, isRecurring: r.isRecurring }),
        0,
      ),
      usedActuals: cf.usedActuals.income,
    });
  }

  // Non-property rental rows: declared run-rate, one-off gated (MON-128's
  // root defect — the gate — applied via the ONE canonical converter).
  let nonPropertyBankedAnnual = 0;
  let oneOffAmount = 0;
  for (const row of input.income) {
    if (!RENT_TYPES.has(row.type)) continue;
    if (row.propertyId && (tenantedIds.has(row.propertyId) || ownedProperties.some((p) => p.id === row.propertyId))) {
      continue; // handled (or excluded) above
    }
    if (row.isRecurring === false) {
      oneOffAmount += row.amount; // counted once, at face value — never ×frequency
    } else {
      nonPropertyBankedAnnual +=
        monthlyRunRate({ amount: row.amount, frequency: row.frequency, isRecurring: row.isRecurring }) * 12;
    }
  }

  const propertyAnnual = perProperty.reduce((sum, p) => sum + p.bankedAnnual, 0);
  const bankedAnnual = propertyAnnual + nonPropertyBankedAnnual;

  return {
    source: 'rental',
    bankedAnnual,
    bankedMonthly: bankedAnnual / 12,
    perProperty,
    nonPropertyBankedAnnual,
    oneOffAmount,
    misattachedRows,
    flags,
  };
}

// =============================================================================
// Decimal sibling. `computePropertyCashflow` has no Decimal twin yet
// (property-cashflow contract: "Decimal twin NOT ESTABLISHED") — per-property
// figures cross the boundary via toDecimal at full Float precision; the
// SUMMATION is Decimal. Recorded in the T1 scope boundary.
// =============================================================================

export interface RentalBankedResultDecimal {
  source: 'rental';
  bankedAnnual: Decimal;
  bankedMonthly: Decimal;
  nonPropertyBankedAnnual: Decimal;
  oneOffAmount: Decimal;
  misattachedRows: RentalBankedResult['misattachedRows'];
  flags: string[];
}

export function computeRentalBankedDecimal(input: RentalBankedInput): RentalBankedResultDecimal {
  const float = computeRentalBanked(input);
  const ZERO = new Decimal(0);
  const propertyAnnual = float.perProperty.reduce(
    (sum, p) => sum.plus(toDecimal(p.bankedAnnual) ?? ZERO),
    ZERO,
  );
  const nonProperty = toDecimal(float.nonPropertyBankedAnnual) ?? ZERO;
  const bankedAnnual = propertyAnnual.plus(nonProperty);
  return {
    source: 'rental',
    bankedAnnual,
    bankedMonthly: bankedAnnual.div(12),
    nonPropertyBankedAnnual: nonProperty,
    oneOffAmount: toDecimal(float.oneOffAmount) ?? ZERO,
    misattachedRows: float.misattachedRows,
    flags: float.flags,
  };
}
