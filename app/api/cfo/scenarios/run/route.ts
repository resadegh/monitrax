/**
 * Phase 40 — POST /api/cfo/scenarios/run
 *
 * Runs a deterministic "what-if" scenario against the user's current
 * canonical snapshot and returns the projected impact. The AI advisor
 * suggests scenarios but does NOT compute their numbers — this endpoint
 * is the single place where scenario projections are produced, and it
 * uses pure functions in `lib/cfo/scenarios/`.
 *
 * Auth: requires `report.read` permission.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { resolveLoanCostsForUser } from '@/lib/services/loanCosts';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import {
  runScenarioDecimal,
  SCENARIO_TYPES,
  type AnyScenarioParams,
  type LoanView,
  type ScenarioType,
  type SuperAccountView,
} from '@/lib/cfo';
import { serializeDecimalsForJson } from '@/lib/decimal';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { listOwnershipGroups } from '@/lib/services/ownershipService';
import { listBeneficialOwnershipOverrides } from '@/lib/services/beneficialOwnershipService';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { toCgtEntityType, type PropertyOwner } from '@/lib/cfo/scenarios/propertyDisposalCgt';
import type { PropertyTaxContext } from '@/lib/cfo/scenarios/types';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

/**
 * Phase 45 PR 2.A.1 — un-deduplicated super accounts for the Div 296
 * TSB aggregation. The snapshot's `netWorth.assets.superannuation`
 * excludes SMSF member balances per Phase 39.5 (no double-counting
 * in net worth); Div 296 needs them included. See
 * `lib/cfo/scenarios/salarySacrificeToSuper.ts:sumSuperBalance` for
 * the resolution.
 */
async function fetchSuperAccounts(userId: string): Promise<SuperAccountView[]> {
  const accounts = await prisma.superannuationAccount.findMany({
    where: { userId },
    select: {
      id: true,
      fundName: true,
      currentBalance: true,
      fundType: true,
    },
  });
  return accounts.map((a) => ({
    id: a.id,
    name: a.fundName ?? undefined,
    currentBalance: Number(a.currentBalance ?? 0),
    fundType: (a.fundType as 'INDUSTRY' | 'RETAIL' | 'SMSF' | null) ?? null,
  }));
}

async function fetchLoanViews(userId: string): Promise<LoanView[]> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      principal: true,
      interestRateAnnual: true,
      termMonthsRemaining: true,
      minRepayment: true,
      type: true,
      repaymentFrequency: true,
      offsetAccount: { select: { currentBalance: true } },
    },
  });
  // Calc-SSOT Wall B1 + VR-013 F1/F2: the ONE resolved per-loan cost,
  // ACTUALS-FIRST — fed linked repayments over the canonical trailing-12-month
  // window (lib/services/loanCosts.ts); declared → interest floor only when no
  // repayments are linked. Same number as the property engine, every surface.
  const resolvedCosts = await resolveLoanCostsForUser(
    userId,
    loans.map((l) => ({
      id: l.id,
      principal: Number(l.principal ?? 0),
      interestRateAnnual: Number(l.interestRateAnnual ?? 0),
      minRepayment: Number(l.minRepayment ?? 0),
      repaymentFrequency: l.repaymentFrequency ?? 'MONTHLY',
    })),
  );
  return loans.map((l) => {
    const remaining = Number(l.termMonthsRemaining ?? 360);
    const minMonthlyRepayment = resolvedCosts.get(l.id)?.monthly ?? 0;
    return {
      id: l.id,
      name: l.name,
      principal: Number(l.principal),
      interestRate: Number(l.interestRateAnnual ?? 0),
      termMonths: remaining,
      remainingMonths: remaining,
      monthlyRepayment: minMonthlyRepayment,
      loanType: String(l.type ?? ''),
      offsetBalance: Number(l.offsetAccount?.currentBalance ?? 0),
    };
  });
}

/**
 * Phase 47 Stage D · D6 — build the per-property CGT + ownership context the
 * `sellProperty` lever needs to split capital gains across the property's
 * legal owners with the correct per-entity discount. Returns `[]` when the
 * property isn't found (the lever then falls back to its prior CGT flag).
 *
 * Reads the same `OwnershipGroup` / `BeneficialOwnershipOverride` the
 * entity-tax assembler reads (AD-2), so the lever and the per-entity tax page
 * agree on who owns what share. Picks the records active NOW (a What-If is a
 * present-day disposal).
 */
async function fetchPropertyTaxContexts(
  userId: string,
  propertyId: string,
): Promise<PropertyTaxContext[]> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId },
    select: {
      id: true,
      ownerEntityId: true,
      purchasePrice: true,
      purchaseDate: true,
      acquisitionContractDate: true,
    },
  });
  if (!property) return [];

  const now = new Date();
  const activeNow = (from: Date | null | undefined, to: Date | null | undefined) =>
    (!from || from <= now) && (to === null || to === undefined || to > now);

  const [allGroups, allOverrides, personalEntityId] = await Promise.all([
    listOwnershipGroups(userId),
    listBeneficialOwnershipOverrides(userId),
    getDefaultLegalEntityId(userId),
  ]);

  // Newest-first → first active match wins (mirrors the assembler).
  const group = allGroups.find(
    (g) =>
      g.ownedObjectType === 'property' &&
      g.ownedObjectId === propertyId &&
      activeNow(g.effectiveFrom, g.effectiveTo),
  );
  const override = allOverrides.find(
    (o) => o.ownedObjectId === propertyId && activeNow(o.effectiveFrom, o.effectiveTo),
  );

  // Candidate owners = legal owner + group stake holders + beneficial owner.
  const candidateIds = new Set<string>([property.ownerEntityId]);
  for (const s of group?.stakes ?? []) candidateIds.add(s.entityId);
  if (override) candidateIds.add(override.beneficialOwnerEntityId);

  const entities = await prisma.legalEntity.findMany({
    where: { id: { in: [...candidateIds] }, userId },
    select: { id: true, name: true, type: true, isForeignResident: true },
  });

  let hasApproximatedOwnerType = false;
  const owners: PropertyOwner[] = entities.map((e) => {
    const mapped = toCgtEntityType(e.type);
    if (mapped.approximated) hasApproximatedOwnerType = true;
    const isYou = e.id === personalEntityId;
    return {
      entityId: e.id,
      name: isYou ? 'You' : e.name,
      entityType: mapped.type,
      isYou,
      isComplying: true,
      isForeignResident: e.isForeignResident ?? false,
    };
  });

  return [
    {
      propertyId: property.id,
      costBase: Number(property.purchasePrice),
      acquisitionDate: (
        property.acquisitionContractDate ?? property.purchaseDate
      ).toISOString(),
      legalOwnerEntityId: property.ownerEntityId,
      owners,
      ownershipGroup: group
        ? {
            tenancyType: group.tenancyType as
              | 'SOLE'
              | 'JOINT_TENANTS'
              | 'TENANTS_IN_COMMON'
              | 'OTHER',
            stakes: group.stakes.map((s) => ({
              entityId: s.entityId,
              sharePct: s.sharePct ?? null,
            })),
          }
        : undefined,
      beneficialOverride: override
        ? {
            legalOwnerEntityId: override.legalOwnerEntityId,
            beneficialOwnerEntityId: override.beneficialOwnerEntityId,
            basis: override.basis,
          }
        : undefined,
      hasApproximatedOwnerType,
    },
  ];
}

export const POST = withPermission('report.read', async (request: NextRequest, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO', auth.userId);
    if (gateBlocked) return gateBlocked;
  let body: { type?: string; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Body must be JSON.' } },
      { status: 400 }
    );
  }

  const type = String(body?.type ?? '');
  if (!SCENARIO_TYPES.includes(type as ScenarioType)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_SCENARIO_TYPE',
          message: `Unknown scenario type "${type}". Valid: ${SCENARIO_TYPES.join(', ')}.`,
        },
      },
      { status: 400 }
    );
  }

  const params =
    body?.params && typeof body.params === 'object' ? (body.params as Record<string, unknown>) : {};

  try {
    const [snapshot, loans, superAccounts] = await Promise.all([
      getMasterFinancialSnapshot(auth.userId),
      fetchLoanViews(auth.userId),
      fetchSuperAccounts(auth.userId),
    ]);

    // Phase 47 Stage D · D6 — only the sellProperty lever needs the per-entity
    // CGT context; build it lazily so the other levers carry no extra queries.
    let propertyTaxContexts: PropertyTaxContext[] | undefined;
    let taxConfig: ReturnType<typeof getCurrentTaxYearConfig> | undefined;
    let currentFy: string | undefined;
    let userMarginalRate: number | undefined;
    if (type === 'sellProperty' && typeof params.propertyId === 'string') {
      taxConfig = getCurrentTaxYearConfig();
      currentFy = taxConfig.financialYear;
      userMarginalRate = (snapshot.tax.marginalTaxRate ?? 0) / 100;
      propertyTaxContexts = await fetchPropertyTaxContexts(auth.userId, params.propertyId);
    }

    // Q-DEC PR 3.C — Decimal scenario engine; serialize at the JSON
    // boundary. The response shape (impacts[*].{before,after,delta})
    // stays `number` — `serializeDecimalsForJson` rounds Decimal →
    // number at currency policy (2dp HALF_EVEN, ATO standard).
    //
    // Phase 45 PR 2.A.1 — superAccounts feeds the Div 296 TSB
    // aggregation in `salarySacrificeToSuper.ts`. Un-deduplicated
    // (includes SMSF member balances) per the ATO TSB definition.
    const result = runScenarioDecimal(
      { snapshot, loans, superAccounts, propertyTaxContexts, taxConfig, currentFy, userMarginalRate },
      {
        type,
        params,
      } as unknown as AnyScenarioParams,
    );

    createAuditLog({
      userId: auth.userId,
      action: 'CFO_SCENARIO_RUN',
      entityType: 'CFOScenario',
      entityId: result.type,
      metadata: sanitizeCdrMetadata({
        scenarioType: result.type,
        warningCount: result.warnings.length,
        impactCount: result.impacts.length,
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, data: serializeDecimalsForJson(result) });
  } catch (error) {
    console.error('[/api/cfo/scenarios/run] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SCENARIO_FAILED', message: 'Could not run the scenario.' },
      },
      { status: 500 }
    );
  }
});
