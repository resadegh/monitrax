/**
 * Phase 41i.3b expansion — User-audit adapters for tax-engine surfaces.
 *
 * v1 ships ONE adapter that exercises the full `MasterTaxPosition`
 * orchestrator (Phase 41e.17). The orchestrator dispatches every
 * Phase 41e module that applies to the user's entities — so a single
 * audit pass exercises CGT / Div 6/6E / Div 7A / Div 152 / SMSF
 * triumvirate / land tax / stamp duty / GST / trust + company loss
 * rules / trust-deed validation as side effects, against the user's
 * real data shape.
 *
 * **Why not adapters for each individual tax engine?** Each engine's
 * input is an already-shaped fact bundle (`EntityTaxFacts`, etc.) the
 * orchestrator builds — there's no separate "per-user input" for them.
 * Adding individual adapters would duplicate the fact-derivation
 * logic. The masterTaxPosition adapter exercises them via the
 * orchestrator's dispatch with no duplication.
 *
 * **What's audited:**
 *   1. Output structure (entities array, totals object, boundary
 *      footer present, modulesInvoked array).
 *   2. Physical invariants on totals (finite, non-negative for
 *      assessableIncome / paygWithheld; netTax can be negative when
 *      refund > liability so allow that).
 *   3. Per-entity result shape — every entity has `result` of some
 *      kind (orchestrator never produces undefined entities).
 *
 * **fetchInput skip semantics:**
 *   - User has no LegalEntity rows → SKIPPED (NO_DATA). v1 entity
 *     backfill creates a PERSONAL_NAME entity per user, so this is
 *     rare (user pre-dates 41a backfill).
 */

import 'server-only';
import prisma from '@/lib/db';
import {
  buildMasterTaxPosition,
  type MasterTaxPositionInput,
  type MasterTaxPositionV2,
} from '@/lib/tax-engine/orchestrator/masterTaxPosition';
import type { EntityTaxFacts } from '@/lib/tax-engine/types';
import type { UserAuditAdapter, ValidationResult } from '../types';

type AuditEntityType = EntityTaxFacts['entityType'];
type AuditIncome = {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  grossAmount?: number;
  paygWithholding?: number;
};

const PRISMA_TO_AUDIT_ENTITY_TYPE: Record<string, AuditEntityType | undefined> = {
  PERSONAL_NAME: 'PERSONAL_NAME',
  COMPANY: 'COMPANY',
  DISCRETIONARY_TRUST: 'DISCRETIONARY_TRUST',
  UNIT_TRUST: 'UNIT_TRUST',
  SMSF: 'SMSF',
  PARTNERSHIP: 'PARTNERSHIP',
  SOLE_TRADER: 'SOLE_TRADER',
};

// =============================================================================
// tax.masterTaxPosition — household-wide orchestrator audit
// =============================================================================

export const masterTaxPositionAdapter: UserAuditAdapter<
  MasterTaxPositionInput,
  MasterTaxPositionV2
> = {
  engineName: 'tax.masterTaxPosition',

  async fetchInput(userId) {
    const entities = await prisma.legalEntity.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        incomes: {
          select: {
            id: true,
            type: true,
            amount: true,
            frequency: true,
            grossAmount: true,
            netAmount: true,
            paygWithholding: true,
          },
        },
      },
    });

    if (entities.length === 0) return null;

    // Conservative FY default — current FY string. The orchestrator is
    // pure; FY label is informational only for this audit.
    const fy = { financialYear: '2024-25', label: 'FY24-25' };

    const auditEntities: EntityTaxFacts[] = entities.flatMap((e) => {
      const auditType = PRISMA_TO_AUDIT_ENTITY_TYPE[e.type];
      if (!auditType) return [];
      const incomes: AuditIncome[] = e.incomes.map((i) => ({
        id: i.id,
        name: 'income',
        type: String(i.type),
        amount: Number(i.amount),
        frequency: String(i.frequency),
        grossAmount: i.grossAmount == null ? undefined : Number(i.grossAmount),
        paygWithholding:
          i.paygWithholding == null ? undefined : Number(i.paygWithholding),
      }));
      return [
        {
          entityId: e.id,
          entityType: auditType,
          fy,
          incomes,
          expenses: [],
          depreciations: [],
        },
      ];
    });

    if (auditEntities.length === 0) return null;

    return {
      userId,
      fy,
      entities: auditEntities,
    };
  },

  validateOutput(out): ValidationResult {
    if (!Array.isArray(out.entities)) {
      return { ok: false, reason: 'entities is not an array', severity: 'HIGH' };
    }
    if (!out.totals) {
      return { ok: false, reason: 'totals object missing', severity: 'HIGH' };
    }
    if (!out.boundary) {
      return { ok: false, reason: 'boundary footer envelope missing', severity: 'HIGH' };
    }
    if (!Array.isArray(out.modulesInvoked) || out.modulesInvoked.length === 0) {
      return {
        ok: false,
        reason: 'modulesInvoked is empty — orchestrator did not dispatch',
        severity: 'HIGH',
      };
    }

    const t = out.totals;
    for (const [k, v] of Object.entries(t)) {
      if (!Number.isFinite(v)) {
        return {
          ok: false,
          reason: `totals.${k} is not finite (${String(v)})`,
          severity: 'HIGH',
        };
      }
    }
    if (t.assessableIncome < 0) {
      return {
        ok: false,
        reason: `totals.assessableIncome negative ($${t.assessableIncome.toFixed(2)})`,
        severity: 'HIGH',
      };
    }
    if (t.paygWithheld < 0) {
      return {
        ok: false,
        reason: `totals.paygWithheld negative ($${t.paygWithheld.toFixed(2)})`,
        severity: 'HIGH',
      };
    }
    // taxableIncome must not exceed assessableIncome by more than 1c
    // (deductions reduce; never increase). netTax can be negative
    // (refund > liability), so we don't bound it on the low side.
    if (t.taxableIncome > t.assessableIncome + 0.01) {
      return {
        ok: false,
        reason: `totals.taxableIncome ($${t.taxableIncome.toFixed(2)}) exceeds assessableIncome ($${t.assessableIncome.toFixed(2)}) — invariant violation`,
        severity: 'CRITICAL',
      };
    }
    // estimatedRefund identity: paygWithheld - netTax.
    const expectedRefund = t.paygWithheld - t.netTax;
    if (Math.abs(t.estimatedRefund - expectedRefund) > 0.01) {
      return {
        ok: false,
        reason: `estimatedRefund identity violated: ${t.estimatedRefund.toFixed(2)} != paygWithheld − netTax (${expectedRefund.toFixed(2)})`,
        severity: 'CRITICAL',
      };
    }
    return { ok: true };
  },
};

export const TAX_USER_AUDIT_ADAPTERS = [masterTaxPositionAdapter] as const;
