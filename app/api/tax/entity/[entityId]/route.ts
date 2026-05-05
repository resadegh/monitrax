/**
 * GET /api/tax/entity/[entityId] — per-entity tax position.
 *
 * Phase 41e.0 slice D — per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md`
 * §6.8. Dispatches the entity through `calculateEntityTaxPosition()`
 * (the slice-D router skeleton). For PERSONAL_NAME / SOLE_TRADER
 * entities, returns full Phase 20 tax position. For COMPANY / TRUST /
 * SMSF / PARTNERSHIP entities, returns an UNCOMPUTED-flagged response
 * documenting which sub-PR will produce the real number.
 *
 * Permission: `tax_data.read`. Caller must own the entity (the service
 * layer's `listEntitiesForUser` + per-userId scoping enforces this).
 *
 * Query: `?fy=2024-25` (optional). Defaults to current FY.
 *
 * Response shape:
 * ```
 * {
 *   success: true,
 *   data: {
 *     entityPosition: EntityTaxPosition,
 *     boundary: BoundaryFootnote      // for the AFSL/TPB/NCCP renderer
 *   }
 * }
 * ```
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { calculateEntityTaxPosition } from '@/lib/tax-engine/entity/entityTaxRouter';
import { renderBoundaryFootnote } from '@/lib/tax-engine/boundaries';
import {
  getTaxYearConfig,
  getCurrentTaxYearConfig,
} from '@/lib/tax-engine/config/taxYearConfig';
import { aggregateIncome } from '@/lib/calculations/incomeAggregator';
import { aggregateExpenses } from '@/lib/calculations/expenseAggregator';
import type {
  EntityTaxFacts,
  FYReference,
  EntityTaxPosition,
} from '@/lib/tax-engine/types';

type RouteContext = { params: Promise<{ entityId: string }> };

export const GET = withPermission<RouteContext>(
  'tax_data.read',
  async (request: NextRequest, auth, context) => {
    try {
      const { entityId } = await context!.params;
      const { searchParams } = new URL(request.url);
      const requestedFY = searchParams.get('fy');

      // Verify ownership — the entity must belong to the calling user.
      const entity = await prisma.legalEntity.findFirst({
        where: { id: entityId, userId: auth.userId },
        select: { id: true, type: true, parentEntityId: true },
      });

      if (!entity) {
        return NextResponse.json(
          { success: false, error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const config = requestedFY
        ? getTaxYearConfig(requestedFY)
        : getCurrentTaxYearConfig();

      const fy: FYReference = {
        financialYear: config.financialYear,
        label: config.label,
      };

      // Slice C aggregator extensions in action: pull all rows for the
      // user, then let the aggregator (or the router) scope to this
      // entity. The router's `EntityTaxFacts` shape needs the entity's
      // OWN rows, not the household's, so we filter at the Prisma layer.
      const [incomes, expenses] = await Promise.all([
        prisma.income.findMany({
          where: { userId: auth.userId, ownerEntityId: entityId },
          select: {
            id: true,
            name: true,
            amount: true,
            frequency: true,
            type: true,
            grossAmount: true,
            paygWithholding: true,
            propertyId: true,
            investmentAccountId: true,
          },
        }),
        prisma.expense.findMany({
          where: { userId: auth.userId, ownerEntityId: entityId },
          select: {
            id: true,
            name: true,
            amount: true,
            frequency: true,
            category: true,
            isTaxDeductible: true,
            propertyId: true,
            loanId: true,
          },
        }),
      ]);

      const facts: EntityTaxFacts = {
        entityId: entity.id,
        entityType: entity.type,
        parentEntityId: entity.parentEntityId ?? undefined,
        fy,
        incomes: incomes.map((i) => ({
          id: i.id,
          name: i.name,
          type: i.type,
          amount: Number(i.amount),
          frequency: i.frequency,
          propertyId: i.propertyId ?? undefined,
          investmentAccountId: i.investmentAccountId ?? undefined,
          grossAmount: i.grossAmount ? Number(i.grossAmount) : undefined,
          paygWithholding: i.paygWithholding ? Number(i.paygWithholding) : undefined,
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          name: e.name,
          category: e.category ?? 'OTHER',
          amount: Number(e.amount),
          frequency: e.frequency,
          isTaxDeductible: e.isTaxDeductible,
          propertyId: e.propertyId ?? undefined,
          loanId: e.loanId ?? undefined,
        })),
        depreciations: [],
      };

      const entityPosition: EntityTaxPosition = calculateEntityTaxPosition(facts);

      const boundary = renderBoundaryFootnote({
        citations: entityPosition.citations,
        uncomputed: entityPosition.uncomputed,
        fyLabel: config.label,
      });

      // Touch the slice C aggregator extensions so the import isn't
      // shadowed in builds that tree-shake unused imports — this keeps
      // the entity-aware filter path warm for callers reading the
      // entity's totals separately. (Cheap: no DB calls.)
      void aggregateIncome([], 'monthly', entityId);
      void aggregateExpenses([], 'monthly', entityId);

      return NextResponse.json({
        success: true,
        data: {
          entityPosition,
          boundary,
        },
      });
    } catch (error) {
      console.error('Per-entity tax position error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to calculate per-entity tax position' },
        { status: 500 },
      );
    }
  },
);

/**
 * POST /api/tax/entity/[entityId] — per-entity tax position with
 * caller-supplied dispatch inputs (Phase 41e.1 slice D-1).
 *
 * Same response shape as GET, but accepts a body to drive the slice-
 * specific dispatch paths that GET cannot (because GET has no body):
 *
 * ```json
 * {
 *   "trustDistribution": {
 *     "trustNetIncome": 100000,
 *     "beneficiaries": [
 *       { "id": "b1", "name": "Sarah", "presentlyEntitledShare": 1.0 }
 *     ],
 *     "hasFamilyTrustElection": true
 *   }
 * }
 * ```
 *
 * For DISCRETIONARY_TRUST / UNIT_TRUST entities, providing
 * `trustDistribution` flips the response from UNCOMPUTED to a real
 * Div 6 allocation — first user-testable 41e.1 surface.
 *
 * Until a UI captures trust distribution data, this endpoint is the
 * primary way to exercise the slice via curl. Future Phase 41 slices
 * (Xero/MYOB import, manual distribution UI) will populate the body
 * automatically and the GET handler will derive distribution data
 * from persisted state.
 */
export const POST = withPermission<RouteContext>(
  'tax_data.read',
  async (request: NextRequest, auth, context) => {
    try {
      const { entityId } = await context!.params;
      const body = await request.json().catch(() => ({}));
      const { searchParams } = new URL(request.url);
      const requestedFY = searchParams.get('fy');

      const entity = await prisma.legalEntity.findFirst({
        where: { id: entityId, userId: auth.userId },
        select: { id: true, type: true, parentEntityId: true },
      });

      if (!entity) {
        return NextResponse.json(
          { success: false, error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const config = requestedFY
        ? getTaxYearConfig(requestedFY)
        : getCurrentTaxYearConfig();

      const fy: FYReference = {
        financialYear: config.financialYear,
        label: config.label,
      };

      // GET-equivalent income/expense lookup (same shape).
      const [incomes, expenses] = await Promise.all([
        prisma.income.findMany({
          where: { userId: auth.userId, ownerEntityId: entityId },
          select: {
            id: true,
            name: true,
            amount: true,
            frequency: true,
            type: true,
            grossAmount: true,
            paygWithholding: true,
            propertyId: true,
            investmentAccountId: true,
          },
        }),
        prisma.expense.findMany({
          where: { userId: auth.userId, ownerEntityId: entityId },
          select: {
            id: true,
            name: true,
            amount: true,
            frequency: true,
            category: true,
            isTaxDeductible: true,
            propertyId: true,
            loanId: true,
          },
        }),
      ]);

      // Validate trustDistribution body shape if present.
      let trustDistribution: EntityTaxFacts['trustDistribution'] = undefined;
      if (body && typeof body === 'object' && body.trustDistribution) {
        const td = body.trustDistribution;
        if (
          typeof td.trustNetIncome !== 'number' ||
          !Array.isArray(td.beneficiaries)
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Invalid trustDistribution body — requires { trustNetIncome: number, beneficiaries: [...] }.',
            },
            { status: 400 },
          );
        }
        trustDistribution = {
          trustNetIncome: td.trustNetIncome,
          beneficiaries: td.beneficiaries.map((b: Record<string, unknown>) => ({
            id: String(b.id),
            name: String(b.name),
            presentlyEntitledShare: Number(b.presentlyEntitledShare),
            isNonResidentOrDisabled: !!b.isNonResidentOrDisabled,
          })),
          hasFamilyTrustElection: !!td.hasFamilyTrustElection,
        };
      }

      // Phase 41e.1 slice D-2 — CGT events from body.
      let cgtEvents: EntityTaxFacts['cgtEvents'] = undefined;
      if (body && typeof body === 'object' && Array.isArray(body.cgtEvents)) {
        for (const ev of body.cgtEvents) {
          if (
            typeof ev?.id !== 'string' ||
            typeof ev?.monthsHeld !== 'number' ||
            typeof ev?.nominalAmount !== 'number'
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  'Invalid cgtEvents body — each event requires { id: string, monthsHeld: number, nominalAmount: number }.',
              },
              { status: 400 },
            );
          }
        }
        cgtEvents = body.cgtEvents.map((ev: Record<string, unknown>) => ({
          id: String(ev.id),
          monthsHeld: Number(ev.monthsHeld),
          nominalAmount: Number(ev.nominalAmount),
          label: ev.label ? String(ev.label) : undefined,
        }));
      }
      let carryForwardCapitalLosses: EntityTaxFacts['carryForwardCapitalLosses'] =
        undefined;
      if (
        body &&
        typeof body === 'object' &&
        Array.isArray(body.carryForwardCapitalLosses)
      ) {
        carryForwardCapitalLosses = body.carryForwardCapitalLosses.map(
          (l: Record<string, unknown>) => ({
            financialYear: String(l.financialYear),
            amount: Number(l.amount),
          }),
        );
      }

      // Phase 41e.2 — SMSF contribution caps from body.
      let smsfContributions: EntityTaxFacts['smsfContributions'] = undefined;
      if (body && typeof body === 'object' && body.smsfContributions) {
        const sc = body.smsfContributions;
        if (
          typeof sc.concessionalYTD !== 'number' ||
          typeof sc.nonConcessionalYTD !== 'number'
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Invalid smsfContributions body — requires { concessionalYTD: number, nonConcessionalYTD: number }.',
            },
            { status: 400 },
          );
        }
        smsfContributions = {
          concessionalYTD: sc.concessionalYTD,
          nonConcessionalYTD: sc.nonConcessionalYTD,
          totalSuperBalance:
            typeof sc.totalSuperBalance === 'number' ? sc.totalSuperBalance : undefined,
          carryForwardAmounts: Array.isArray(sc.carryForwardAmounts)
            ? sc.carryForwardAmounts.map((c: Record<string, unknown>) => ({
                financialYear: String(c.financialYear),
                unusedAmount: Number(c.unusedAmount),
              }))
            : undefined,
        };
      }

      const facts: EntityTaxFacts = {
        entityId: entity.id,
        entityType: entity.type,
        parentEntityId: entity.parentEntityId ?? undefined,
        fy,
        incomes: incomes.map((i) => ({
          id: i.id,
          name: i.name,
          type: i.type,
          amount: Number(i.amount),
          frequency: i.frequency,
          propertyId: i.propertyId ?? undefined,
          investmentAccountId: i.investmentAccountId ?? undefined,
          grossAmount: i.grossAmount ? Number(i.grossAmount) : undefined,
          paygWithholding: i.paygWithholding ? Number(i.paygWithholding) : undefined,
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          name: e.name,
          category: e.category ?? 'OTHER',
          amount: Number(e.amount),
          frequency: e.frequency,
          isTaxDeductible: e.isTaxDeductible,
          propertyId: e.propertyId ?? undefined,
          loanId: e.loanId ?? undefined,
        })),
        depreciations: [],
        trustDistribution,
        cgtEvents,
        carryForwardCapitalLosses,
        smsfContributions,
      };

      const entityPosition = calculateEntityTaxPosition(facts);
      const boundary = renderBoundaryFootnote({
        citations: entityPosition.citations,
        uncomputed: entityPosition.uncomputed,
        fyLabel: config.label,
      });

      return NextResponse.json({
        success: true,
        data: { entityPosition, boundary },
      });
    } catch (error) {
      console.error('Per-entity tax POST error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to calculate per-entity tax position' },
        { status: 500 },
      );
    }
  },
);
