/**
 * Phase 41i.3b expansion — User-audit adapters for property metrics.
 *
 * Pattern: each property engine (`property.LVR` / `property.equity` /
 * `property.rentalYield`) is a pure per-property calc. The user-audit
 * adapter picks ONE representative property per user — the one most
 * likely to surface a calculation issue — and runs the engine with
 * that property's data, validating physical invariants.
 *
 * **Selection rule:** for LVR + equity, pick the property with the
 * **highest loan-to-value ratio** (most leveraged). For rental yield,
 * pick the property with the highest rent-to-value ratio (highest
 * yield → most likely to surface yield-calc edge cases).
 *
 * **fetchInput skip semantics:**
 *   - User has zero properties → SKIPPED (NO_DATA).
 *   - User has properties but none with a value > 0 → SKIPPED (NO_DATA).
 *
 * **What's audited:**
 *   - LVR: 0 ≤ result ≤ 500 (a 5x leveraged loan is the practical
 *     ceiling; anything beyond surfaces input-data corruption).
 *   - Equity: finite, no NaN/Infinity (can be negative — owner is
 *     underwater — that's allowed).
 *   - Rental yield: 0 ≤ result ≤ 100 (yield over 100% surfaces input
 *     corruption — annualRent > propertyValue).
 */

import 'server-only';
import prisma from '@/lib/db';
import { toAnnual } from '@/lib/utils/frequencies';
import type { UserAuditAdapter, ValidationResult } from '../types';

interface LVRInput {
  loanBalance: number;
  propertyValue: number;
}

async function pickMostLeveragedProperty(
  userId: string,
): Promise<{ propertyValue: number; loanBalance: number } | null> {
  const properties = await prisma.property.findMany({
    where: { userId },
    select: {
      id: true,
      currentValue: true,
      loans: { select: { principal: true } },
    },
  });
  if (properties.length === 0) return null;
  const candidates = properties
    .filter((p) => Number(p.currentValue) > 0)
    .map((p) => ({
      propertyValue: Number(p.currentValue),
      loanBalance: p.loans.reduce((sum, l) => sum + Number(l.principal), 0),
    }));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.loanBalance / b.propertyValue - a.loanBalance / a.propertyValue);
  return candidates[0];
}

// =============================================================================
// property.LVR
// =============================================================================

export const propertyLVRAdapter: UserAuditAdapter<LVRInput, number> = {
  engineName: 'property.LVR',

  async fetchInput(userId) {
    const pick = await pickMostLeveragedProperty(userId);
    if (!pick) return null;
    return { loanBalance: pick.loanBalance, propertyValue: pick.propertyValue };
  },

  validateOutput(result): ValidationResult {
    if (!Number.isFinite(result)) {
      return { ok: false, reason: 'LVR is not finite (NaN/Infinity)', severity: 'HIGH' };
    }
    if (result < 0) {
      return {
        ok: false,
        reason: `LVR negative (${result.toFixed(2)}) — invariant violation`,
        severity: 'HIGH',
      };
    }
    if (result > 500) {
      return {
        ok: false,
        reason: `LVR ${result.toFixed(2)} exceeds practical 500% ceiling — likely input corruption`,
        severity: 'HIGH',
      };
    }
    return { ok: true };
  },
};

// =============================================================================
// property.equity
// =============================================================================

interface EquityInput {
  propertyValue: number;
  loanBalance: number;
}

export const propertyEquityAdapter: UserAuditAdapter<EquityInput, number> = {
  engineName: 'property.equity',

  async fetchInput(userId) {
    const pick = await pickMostLeveragedProperty(userId);
    if (!pick) return null;
    return { propertyValue: pick.propertyValue, loanBalance: pick.loanBalance };
  },

  validateOutput(result): ValidationResult {
    if (!Number.isFinite(result)) {
      return { ok: false, reason: 'equity is not finite (NaN/Infinity)', severity: 'HIGH' };
    }
    return { ok: true };
  },
};

// =============================================================================
// property.rentalYield
// =============================================================================

interface YieldInput {
  annualRent: number;
  propertyValue: number;
}

export const propertyRentalYieldAdapter: UserAuditAdapter<YieldInput, number> = {
  engineName: 'property.rentalYield',

  async fetchInput(userId) {
    // Sum rental income per property (joined via Income.propertyId).
    const properties = await prisma.property.findMany({
      where: { userId },
      select: {
        id: true,
        currentValue: true,
        income: {
          where: { type: 'RENT' },
          select: { amount: true, frequency: true },
        },
      },
    });
    if (properties.length === 0) return null;

    const candidates = properties
      .filter((p) => Number(p.currentValue) > 0)
      .map((p) => {
        const annualRent = p.income.reduce((sum, inc) => {
          // Canonical annualisation per CLAUDE.md §6.2. Falls back to
          // raw amount if the Frequency enum doesn't recognise the
          // string (defensive against schema drift).
          try {
            return sum + toAnnual(Number(inc.amount), inc.frequency as never);
          } catch {
            return sum + Number(inc.amount);
          }
        }, 0);
        return { annualRent, propertyValue: Number(p.currentValue) };
      });
    if (candidates.length === 0) return null;
    // Pick the property with the highest yield (most likely to surface edge cases).
    candidates.sort((a, b) => b.annualRent / b.propertyValue - a.annualRent / a.propertyValue);
    return candidates[0];
  },

  validateOutput(result): ValidationResult {
    if (!Number.isFinite(result)) {
      return {
        ok: false,
        reason: 'rental yield is not finite (NaN/Infinity)',
        severity: 'HIGH',
      };
    }
    if (result < 0) {
      return {
        ok: false,
        reason: `rental yield negative (${result.toFixed(2)}%) — invariant violation`,
        severity: 'HIGH',
      };
    }
    if (result > 100) {
      return {
        ok: false,
        reason: `rental yield ${result.toFixed(2)}% exceeds 100% — likely input corruption (annualRent > propertyValue)`,
        severity: 'HIGH',
      };
    }
    return { ok: true };
  },
};

export const PROPERTY_USER_AUDIT_ADAPTERS = [
  propertyLVRAdapter,
  propertyEquityAdapter,
  propertyRentalYieldAdapter,
] as const;
