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
import { calculateEntityTaxPositionDecimal } from '@/lib/tax-engine/entity/entityTaxRouter';
import { renderBoundaryFootnote } from '@/lib/tax-engine/boundaries';
import {
  getTaxYearConfig,
  getCurrentTaxYearConfig,
} from '@/lib/tax-engine/config/taxYearConfig';
import { assembleEntityTaxFacts } from '@/lib/services/entityTaxFactsAssembler';
import { serializeDecimalsForJson } from '@/lib/decimal';
import type {
  EntityTaxFacts,
  FYReference,
} from '@/lib/tax-engine/types';

type RouteContext = { params: Promise<{ entityId: string }> };

export const GET = withPermission<RouteContext>(
  'tax_data.read',
  async (request: NextRequest, auth, context) => {
    try {
      const { entityId } = await context!.params;
      const { searchParams } = new URL(request.url);
      const requestedFY = searchParams.get('fy');

      const config = requestedFY
        ? getTaxYearConfig(requestedFY)
        : getCurrentTaxYearConfig();

      const fy: FYReference = {
        financialYear: config.financialYear,
        label: config.label,
      };

      // Phase 44 Part 2c-ii — `assembleEntityTaxFacts` is the SSOT for
      // building `EntityTaxFacts`. It reads the entity's income / expense
      // rows + the persisted Part 2 money-flow models
      // (`DistributionResolution`, `PrivateCompanyBenefit`) and returns a
      // fully-populated facts object — so a trust / company with persisted
      // data now returns REAL numbers, not `UNCOMPUTED`. It also performs
      // the ownership check (returns null when the entity is not owned by
      // the caller). The dead `parentEntityId` read is gone — no engine
      // module consumed it (PHASE_44_PART_2 §2.3).
      const facts = await assembleEntityTaxFacts(auth.userId, entityId, fy);
      if (!facts) {
        return NextResponse.json(
          { success: false, error: 'Entity not found.' },
          { status: 404 },
        );
      }

      // Q-DEC PR 3.B — Decimal cutover. Engine runs on Decimal end-to-
      // end; we serialize Decimal → number at the JSON boundary so the
      // public response shape is byte-compatible with the pre-cutover
      // Float response.
      const entityPosition = calculateEntityTaxPositionDecimal(facts);

      const boundary = renderBoundaryFootnote({
        citations: entityPosition.citations,
        uncomputed: entityPosition.uncomputed,
        fyLabel: config.label,
      });

      return NextResponse.json({
        success: true,
        data: serializeDecimalsForJson({ entityPosition, boundary }),
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
        select: { id: true, type: true },
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

      // Income/expense lookup (scoped to the entity).
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
            // Phase 41e.4 — streaming allocation per beneficiary
            streaming:
              b.streaming && typeof b.streaming === 'object'
                ? {
                    frankedDividends:
                      typeof (b.streaming as Record<string, unknown>).frankedDividends ===
                      'number'
                        ? (b.streaming as { frankedDividends: number }).frankedDividends
                        : undefined,
                    capitalGains:
                      typeof (b.streaming as Record<string, unknown>).capitalGains === 'number'
                        ? (b.streaming as { capitalGains: number }).capitalGains
                        : undefined,
                  }
                : undefined,
          })),
          hasFamilyTrustElection: !!td.hasFamilyTrustElection,
          characterPools:
            td.characterPools && typeof td.characterPools === 'object'
              ? {
                  frankedDividends:
                    typeof (td.characterPools as Record<string, unknown>).frankedDividends ===
                    'number'
                      ? (td.characterPools as { frankedDividends: number }).frankedDividends
                      : undefined,
                  capitalGains:
                    typeof (td.characterPools as Record<string, unknown>).capitalGains === 'number'
                      ? (td.characterPools as { capitalGains: number }).capitalGains
                      : undefined,
                }
              : undefined,
          streamingResolutionAt:
            typeof td.streamingResolutionAt === 'string'
              ? td.streamingResolutionAt
              : undefined,
          // Phase 41e.5
          isTestamentaryTrust: !!td.isTestamentaryTrust,
          s100aFacts: Array.isArray(td.s100aFacts)
            ? td.s100aFacts.map((f: Record<string, unknown>) => ({
                beneficiaryId: String(f.beneficiaryId),
                relationshipToController:
                  f.relationshipToController === 'CONTROLLER' ||
                  f.relationshipToController === 'IMMEDIATE_FAMILY' ||
                  f.relationshipToController === 'EXTENDED_FAMILY' ||
                  f.relationshipToController === 'UNRELATED'
                    ? f.relationshipToController
                    : undefined,
                isMinor: !!f.isMinor,
                beneficiaryReceivedFunds:
                  typeof f.beneficiaryReceivedFunds === 'boolean'
                    ? f.beneficiaryReceivedFunds
                    : undefined,
                unpaidPresentEntitlement: !!f.unpaidPresentEntitlement,
                fundsUsedByOther: !!f.fundsUsedByOther,
              }))
            : undefined,
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

      // Phase 41e.3 — high-income super tax inputs from body.
      let highIncomeSuper: EntityTaxFacts['highIncomeSuper'] = undefined;
      if (body && typeof body === 'object' && body.highIncomeSuper) {
        const h = body.highIncomeSuper;
        if (
          typeof h.div293Income !== 'number' ||
          typeof h.concessionalContributions !== 'number' ||
          typeof h.totalSuperBalance !== 'number'
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Invalid highIncomeSuper body — requires { div293Income, concessionalContributions, totalSuperBalance } as numbers.',
            },
            { status: 400 },
          );
        }
        highIncomeSuper = {
          div293Income: h.div293Income,
          concessionalContributions: h.concessionalContributions,
          totalSuperBalance: h.totalSuperBalance,
          tsbEarnings:
            typeof h.tsbEarnings === 'number' ? h.tsbEarnings : undefined,
          transferBalanceUsed:
            typeof h.transferBalanceUsed === 'number' ? h.transferBalanceUsed : undefined,
        };
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

      // Phase 41e.6 — Div 7A loans from body.
      let div7aLoans: EntityTaxFacts['div7aLoans'] = undefined;
      if (body && typeof body === 'object' && Array.isArray(body.div7aLoans)) {
        for (const l of body.div7aLoans) {
          if (
            typeof l?.loanId !== 'string' ||
            typeof l?.openingBalance !== 'number' ||
            typeof l?.yearsRemaining !== 'number' ||
            typeof l?.benchmarkRate !== 'number' ||
            typeof l?.paymentsMadeThisFy !== 'number' ||
            typeof l?.hasComplianceAgreement !== 'boolean'
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  'Invalid div7aLoans body — each loan requires { loanId: string, openingBalance: number, yearsRemaining: number, benchmarkRate: number, paymentsMadeThisFy: number, hasComplianceAgreement: boolean }.',
              },
              { status: 400 },
            );
          }
        }
        div7aLoans = body.div7aLoans.map((l: Record<string, unknown>) => ({
          loanId: String(l.loanId),
          loanLabel: l.loanLabel ? String(l.loanLabel) : undefined,
          openingBalance: Number(l.openingBalance),
          yearsRemaining: Number(l.yearsRemaining),
          benchmarkRate: Number(l.benchmarkRate),
          paymentsMadeThisFy: Number(l.paymentsMadeThisFy),
          hasComplianceAgreement: !!l.hasComplianceAgreement,
          isSubTrustUpe: !!l.isSubTrustUpe,
        }));
      }

      // Phase 44 Part 2c-i — SMSF fund-earnings income tax from body.
      // (Part 2c-ii's `entityTaxFactsAssembler` will derive this for the
      // GET path from persisted data; until then this is the testable
      // surface — same pattern as the other dispatch fields.)
      let smsfIncomeTax: EntityTaxFacts['smsfIncomeTax'] = undefined;
      if (body && typeof body === 'object' && body.smsfIncomeTax) {
        const s = body.smsfIncomeTax;
        if (
          typeof s.assessableInvestmentIncome !== 'number' ||
          typeof s.deductions !== 'number' ||
          typeof s.assessableContributions !== 'number' ||
          typeof s.nonArmsLengthIncome !== 'number' ||
          typeof s.isComplying !== 'boolean' ||
          typeof s.isInPensionPhase !== 'boolean'
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Invalid smsfIncomeTax body — requires { assessableInvestmentIncome, deductions, assessableContributions, nonArmsLengthIncome } as numbers and { isComplying, isInPensionPhase } as booleans.',
            },
            { status: 400 },
          );
        }
        smsfIncomeTax = {
          assessableInvestmentIncome: s.assessableInvestmentIncome,
          deductions: s.deductions,
          assessableContributions: s.assessableContributions,
          nonArmsLengthIncome: s.nonArmsLengthIncome,
          isComplying: s.isComplying,
          isInPensionPhase: s.isInPensionPhase,
          ecpiExemptProportion:
            typeof s.ecpiExemptProportion === 'number' ? s.ecpiExemptProportion : undefined,
        };
      }

      const facts: EntityTaxFacts = {
        entityId: entity.id,
        entityType: entity.type,
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
        highIncomeSuper,
        div7aLoans,
        smsfIncomeTax,
      };

      // Q-DEC PR 3.B — Decimal cutover (see GET handler note).
      const entityPosition = calculateEntityTaxPositionDecimal(facts);
      const boundary = renderBoundaryFootnote({
        citations: entityPosition.citations,
        uncomputed: entityPosition.uncomputed,
        fyLabel: config.label,
      });

      return NextResponse.json({
        success: true,
        data: serializeDecimalsForJson({ entityPosition, boundary }),
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
