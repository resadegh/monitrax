/**
 * Wealth Graph Service — SSOT aggregator for the Wealth Universe canvas.
 *
 * Returns the user's full ownership graph in canvas-ready shape:
 *   - Entities (LegalEntity[])
 *   - Assets (Property / Loan / Account / InvestmentAccount / Asset)
 *     each carrying its `ownerEntityId`
 *   - Edges (EntityRelationship + parentEntityId fallback)
 *   - OwnershipGroups (joint ownership — Phase 44 Q1)
 *   - BeneficialOwnershipOverrides (Phase 44 Q2 — legal vs beneficial)
 *   - Money flows (Phase 2 — DistributionAllocation + DividendPayment)
 *
 * Returns SHAPE ONLY — no tax math, no calc engine. Phase 2 adds the
 * Money Flow lens data with Phase 41E reform-awareness gating per
 * CLAUDE.md §12.14 (FW-1 regime is a first-class input, FW-2 no silent
 * post-reform math).
 *
 * SSOT (CLAUDE.md §6.1 / §12.2): every route surfacing the wealth
 * graph MUST go through this service. Distinct concern from
 * `getMasterFinancialSnapshot()` (financial breakdowns) and the
 * `/api/portfolio/snapshot` SnapshotV2 (aggregated counts + GRDCS
 * linkage health) — see CLAUDE.md §12.2 "Two snapshot SSOTs, not
 * duplication." This is the third — the graph SSOT.
 *
 * Auth: callers (route handlers) MUST gate with
 * `withPermission(req, 'entity.read')`. Service itself is unauthenticated
 * and scopes by the userId argument.
 */

import { prisma } from '@/lib/db';
import {
  isPostCommencementFy,
} from '@/lib/tax-engine/config/reformConstants';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type {
  LegalEntityType,
  LegalEntityRole,
  TrustType,
  EntityRelationshipType,
  TenancyType,
  BeneficialOwnershipBasis,
  StructuralState,
} from '@prisma/client';

// ===========================================================================
// Public shape — what the API returns + what the canvas consumes
// ===========================================================================

export interface WealthGraphSnapshot {
  asOf: string;
  userId: string;
  entities: WealthGraphEntity[];
  assets: WealthGraphAsset[];
  relationships: WealthGraphEdge[];
  ownershipGroups: WealthGraphOwnershipGroup[];
  beneficialOverrides: WealthGraphBeneficialOverride[];
  /**
   * Phase 2 — Money Flow lens data. Aggregated cash flows from CONFIRMED
   * trustee resolutions (`DistributionAllocation`) and confirmed company
   * dividends (`DividendPayment`). One row per actual flow leg —
   * direction matches cash movement (trust → beneficiary, company →
   * shareholder).
   *
   * **§12.14 reform-awareness:** every flow carries `taxRegime` and an
   * optional `reformNotice`. The aggregator NEVER applies post-reform
   * math (no 30% min-tax computation, no indexation override). When a
   * post-reform regime would apply but the Bill has not assented, the
   * flow surfaces an UNCOMPUTED-style notice for the canvas to render
   * verbatim — the user sees the rule status, not a guess.
   *
   * Phase 2 enhancement — the snapshot now includes flows for **every**
   * FY that has CONFIRMED data; the canvas filters by selected FY at
   * render time. Each flow carries its own `taxRegime`/`reformNotice`
   * classified at that flow's FY, satisfying §12.14 FW-1 "regime is a
   * first-class input per FY."
   */
  moneyFlows: WealthGraphMoneyFlow[];
  /**
   * Default FY to display when the user first opens the Money Flow lens.
   * Resolves to the most recent FY with CONFIRMED data, falling back to
   * the current FY when no data exists.
   */
  moneyFlowFy: string;
  /**
   * All FYs that have at least one CONFIRMED distribution or dividend,
   * descending (most recent first). Drives the FY-slider tick strip.
   */
  moneyFlowFyOptions: string[];
}

export interface WealthGraphEntity {
  id: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  name: string;
  abn: string | null;
  acn: string | null;
  trustType: TrustType | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  ownedObjectsCount: {
    properties: number;
    loans: number;
    accounts: number;
    investmentAccounts: number;
    assets: number;
  };
}

export type WealthGraphAssetKind =
  | 'property'
  | 'loan'
  | 'account'
  | 'investment-account'
  | 'asset';

export interface WealthGraphAsset {
  id: string;
  kind: WealthGraphAssetKind;
  ownerEntityId: string;
  name: string;
  /** Current market value in AUD. For loans this is the principal owed (negative direction conceptually). */
  value: number;
  /** Short subtype label for UI, e.g. "Investment Property", "Vehicle", "Stock Portfolio". */
  subtype: string | null;
  /** Optional one-line context (address for properties, platform for investments). */
  context: string | null;
}

export interface WealthGraphEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: EntityRelationshipType | 'PARENT_OF'; // PARENT_OF is the parentEntityId fallback
  effectiveFrom: string;
  effectiveTo: string | null;
  state: StructuralState;
  accountantVerified: boolean;
  // Optional typed metadata copied through (subset)
  beneficiaryClass: string | null;
  ownershipPercent: number | null;
}

export interface WealthGraphOwnershipGroup {
  id: string;
  ownedObjectType: string; // 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset'
  ownedObjectId: string;
  tenancyType: TenancyType;
  stakes: Array<{ entityId: string; sharePct: number | null; survivorshipApplies: boolean }>;
}

export interface WealthGraphBeneficialOverride {
  id: string;
  legalOwnerEntityId: string;
  beneficialOwnerEntityId: string;
  ownedObjectType: string;
  ownedObjectId: string;
  basis: BeneficialOwnershipBasis;
  accountantVerified: boolean;
}

/**
 * Per-flow regime classification — drives Phase 41E §12.14 awareness in
 * the canvas. **First-class input** per FW-1: the canvas / any consumer
 * reads this directly instead of re-deriving it.
 *
 * - `PRE_REFORM` — the FY pre-dates the relevant measure's commencement.
 *   No reform math applies. Render normally.
 * - `POST_REFORM_VERIFIED` — the FY is on/after commencement AND the
 *   per-measure `commencementVerified` flag is true. Post-reform math
 *   may be applied by downstream engines; this service still does NOT
 *   compute it (Part 3 stays pure-shape).
 * - `POST_REFORM_PENDING` — the FY would trigger the measure BUT the
 *   Bill has not assented. **FW-2:** the aggregator returns the gross
 *   amount + a `reformNotice` so the canvas can surface "may be subject
 *   to 30% min tax — pending Royal Assent" verbatim. NEVER compute the
 *   post-reform number speculatively.
 */
export type MoneyFlowTaxRegime =
  | 'PRE_REFORM'
  | 'POST_REFORM_VERIFIED'
  | 'POST_REFORM_PENDING';

export interface WealthGraphMoneyFlow {
  id: string;
  kind: 'distribution' | 'dividend';
  /** Source entity (trust for distribution, company for dividend). */
  fromEntityId: string;
  /** Recipient entity (beneficiary or shareholder). */
  toEntityId: string;
  financialYear: string;
  /** Gross dollar amount of this flow leg. Always positive. */
  amount: number;
  /** When set, the flow carries franking credits (dividends + streamed). */
  frankingCredits: number | null;
  /**
   * Phase 41E regime classification for this flow. See
   * `MoneyFlowTaxRegime` doc. Always populated.
   */
  taxRegime: MoneyFlowTaxRegime;
  /**
   * Human-readable rule-status notice. Non-null only when
   * `taxRegime === 'POST_REFORM_PENDING'`. The canvas renders this
   * verbatim so the user sees the announced-but-not-yet-law caveat.
   * **NEVER** compute a post-reform amount in this service.
   */
  reformNotice: string | null;
}

// ===========================================================================
// Service
// ===========================================================================

/**
 * Returns the user's wealth-graph snapshot. Single read transaction.
 *
 * Filters:
 *   - All entities/assets/relationships scoped to `userId`
 *   - Relationships with `effectiveTo` in the past are EXCLUDED (only
 *     currently-effective edges render on the canvas; history can come
 *     later as a time-travel lens)
 *   - Properties marked SOLD / Loans marked CLOSED / Accounts marked
 *     CLOSED are EXCLUDED (canvas shows the live structure)
 */
export async function getWealthGraphSnapshot(userId: string): Promise<WealthGraphSnapshot> {
  const asOf = new Date();

  // Phase 2 enhancement — the canvas's initial FY-slider position.
  // Resolved below from the actually-loaded data so we open to a FY the
  // user can see. Falls back to the calendar current FY for empty datasets.
  const currentFy = currentFinancialYear(asOf);

  const [
    entitiesRaw,
    properties,
    loans,
    accounts,
    investmentAccounts,
    miscAssets,
    relationships,
    ownershipGroups,
    beneficialOverrides,
    distributionResolutions,
    dividendDistributions,
  // Promise.all (not $transaction(array) — the project's wrapped Prisma
  // client rejects the array form with "All elements of the array need
  // to be Prisma Client promises"; the WIF-backed adapter wraps each
  // query and the wrapper isn't recognised. For a read-only aggregator
  // we don't need transaction isolation anyway — parallel reads suffice.
  ] = await Promise.all([
    prisma.legalEntity.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        role: true,
        name: true,
        abn: true,
        acn: true,
        trustType: true,
        parentEntityId: true,
        parentEntity: { select: { name: true } },
        _count: {
          select: {
            properties: true,
            loans: true,
            accounts: true,
            investmentAccounts: true,
            assets: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.property.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        name: true,
        address: true,
        currentValue: true,
        type: true,
      },
    }),
    prisma.loan.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        name: true,
        principal: true,
        type: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        name: true,
        institution: true,
        currentBalance: true,
        type: true,
      },
    }),
    prisma.investmentAccount.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        name: true,
        platform: true,
        currency: true,
        // Aggregate current value from holdings
        holdings: {
          select: { currentValue: true, units: true, averagePrice: true },
        },
      },
    }),
    prisma.asset.findMany({
      where: { userId, status: 'ACTIVE' },
      select: {
        id: true,
        ownerEntityId: true,
        name: true,
        type: true,
        currentValue: true,
      },
    }),
    prisma.entityRelationship.findMany({
      where: {
        userId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
      select: {
        id: true,
        fromEntityId: true,
        toEntityId: true,
        type: true,
        effectiveFrom: true,
        effectiveTo: true,
        structuralState: true,
        accountantVerified: true,
        beneficiaryClass: true,
        partnerInterestPct: true,
      },
    }),
    prisma.ownershipGroup.findMany({
      where: {
        userId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
      select: {
        id: true,
        ownedObjectType: true,
        ownedObjectId: true,
        tenancyType: true,
        stakes: {
          select: {
            entityId: true,
            sharePct: true,
            survivorshipApplies: true,
          },
        },
      },
    }),
    prisma.beneficialOwnershipOverride.findMany({
      where: {
        userId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
      select: {
        id: true,
        legalOwnerEntityId: true,
        beneficialOwnerEntityId: true,
        ownedObjectType: true,
        ownedObjectId: true,
        basis: true,
        accountantVerified: true,
      },
    }),
    // Phase 2 — CONFIRMED trustee resolutions. DRAFT resolutions are
    // excluded: trustees haven't decided yet, so there is no money flow
    // to render. Phase 2 enhancement: fetch every FY (no
    // `financialYear` filter) so the FY-slider can scrub through
    // history without a refetch. The canvas filters by selected FY at
    // render time.
    prisma.distributionResolution.findMany({
      where: { userId, status: 'CONFIRMED' },
      select: {
        id: true,
        trustEntityId: true,
        financialYear: true,
        trustNetIncome: true,
        distributableIncome: true,
        allocations: {
          select: {
            id: true,
            beneficiaryEntityId: true,
            presentlyEntitledShare: true,
            streamedFrankedDividends: true,
            streamedCapitalGains: true,
          },
        },
      },
    }),
    prisma.dividendDistribution.findMany({
      where: { userId, status: 'CONFIRMED' },
      select: {
        id: true,
        companyEntityId: true,
        financialYear: true,
        payments: {
          select: {
            id: true,
            shareholderEntityId: true,
            amount: true,
            frankingCredits: true,
          },
        },
      },
    }),
  ]);

  // --- entities mapping
  const entities: WealthGraphEntity[] = entitiesRaw.map(e => ({
    id: e.id,
    type: e.type,
    role: e.role,
    name: e.name,
    abn: e.abn,
    acn: e.acn,
    trustType: e.trustType,
    parentEntityId: e.parentEntityId,
    parentEntityName: e.parentEntity?.name ?? null,
    ownedObjectsCount: {
      properties: e._count.properties,
      loans: e._count.loans,
      accounts: e._count.accounts,
      investmentAccounts: e._count.investmentAccounts,
      assets: e._count.assets,
    },
  }));

  // --- assets mapping (all 5 kinds → uniform shape)
  const assets: WealthGraphAsset[] = [
    ...properties.map(p => ({
      id: p.id,
      kind: 'property' as const,
      ownerEntityId: p.ownerEntityId,
      name: p.name,
      value: p.currentValue,
      subtype: prettyPropertyType(p.type),
      context: p.address ?? null,
    })),
    ...loans.map(l => ({
      id: l.id,
      kind: 'loan' as const,
      ownerEntityId: l.ownerEntityId,
      name: l.name,
      // Loans surface negative-direction wealth; we keep the principal
      // positive here and let the canvas/UI render the semantic.
      value: l.principal,
      subtype: prettyLoanType(l.type),
      context: null,
    })),
    ...accounts.map(a => ({
      id: a.id,
      kind: 'account' as const,
      ownerEntityId: a.ownerEntityId,
      name: a.name,
      value: a.currentBalance,
      subtype: prettyAccountType(a.type),
      context: a.institution ?? null,
    })),
    ...investmentAccounts.map(i => ({
      id: i.id,
      kind: 'investment-account' as const,
      ownerEntityId: i.ownerEntityId,
      name: i.name,
      value: sumHoldingsValue(i.holdings),
      subtype: 'Investment Portfolio',
      context: i.platform ?? null,
    })),
    ...miscAssets.map(a => ({
      id: a.id,
      kind: 'asset' as const,
      ownerEntityId: a.ownerEntityId,
      name: a.name,
      value: a.currentValue,
      subtype: prettyAssetType(a.type),
      context: null,
    })),
  ];

  // --- relationships mapping. We also synthesise PARENT_OF edges from
  // parentEntityId for entities that don't have an explicit relationship
  // row yet (legacy data from before the EntityRelationship migration).
  const explicit: WealthGraphEdge[] = relationships.map(r => ({
    id: r.id,
    fromEntityId: r.fromEntityId,
    toEntityId: r.toEntityId,
    type: r.type,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    state: r.structuralState,
    accountantVerified: r.accountantVerified,
    beneficiaryClass: r.beneficiaryClass,
    ownershipPercent: r.partnerInterestPct ? Number(r.partnerInterestPct) : null,
  }));

  // Build a set of (from,to) pairs already covered by explicit edges, so we
  // don't duplicate when synthesising the parent fallback.
  const explicitPairs = new Set(explicit.map(e => `${e.fromEntityId}|${e.toEntityId}`));
  const fallback: WealthGraphEdge[] = [];
  for (const e of entitiesRaw) {
    if (!e.parentEntityId) continue;
    const pair = `${e.parentEntityId}|${e.id}`;
    if (explicitPairs.has(pair)) continue;
    fallback.push({
      id: `parent-${e.id}`,
      fromEntityId: e.parentEntityId,
      toEntityId: e.id,
      type: 'PARENT_OF',
      effectiveFrom: asOf.toISOString(),
      effectiveTo: null,
      state: 'VALID',
      accountantVerified: false,
      beneficiaryClass: null,
      ownershipPercent: null,
    });
  }

  const allRelationships: WealthGraphEdge[] = [...explicit, ...fallback];

  // --- ownership groups
  const groups: WealthGraphOwnershipGroup[] = ownershipGroups.map(g => ({
    id: g.id,
    ownedObjectType: g.ownedObjectType,
    ownedObjectId: g.ownedObjectId,
    tenancyType: g.tenancyType,
    stakes: g.stakes.map(s => ({
      entityId: s.entityId,
      sharePct: s.sharePct ? Number(s.sharePct) : null,
      survivorshipApplies: s.survivorshipApplies,
    })),
  }));

  // --- beneficial overrides
  const overrides: WealthGraphBeneficialOverride[] = beneficialOverrides.map(b => ({
    id: b.id,
    legalOwnerEntityId: b.legalOwnerEntityId,
    beneficialOwnerEntityId: b.beneficialOwnerEntityId,
    ownedObjectType: b.ownedObjectType,
    ownedObjectId: b.ownedObjectId,
    basis: b.basis,
    accountantVerified: b.accountantVerified,
  }));

  // --- money flows (Phase 2)
  // Build a trust → trustType lookup for the §12.14 dispatch.
  const trustTypeByEntityId = new Map<string, TrustType | null>();
  for (const e of entitiesRaw) {
    trustTypeByEntityId.set(e.id, e.trustType);
  }
  const moneyFlows: WealthGraphMoneyFlow[] = [];
  for (const r of distributionResolutions) {
    const denom = r.distributableIncome != null
      ? Number(r.distributableIncome)
      : Number(r.trustNetIncome);
    if (!isFinite(denom) || denom <= 0) continue;
    const trustType = trustTypeByEntityId.get(r.trustEntityId) ?? null;
    for (const a of r.allocations) {
      const share = Number(a.presentlyEntitledShare);
      if (!isFinite(share) || share <= 0) continue;
      const amount = denom * share;
      const streamedFranked = a.streamedFrankedDividends != null
        ? Number(a.streamedFrankedDividends) : 0;
      const { taxRegime, reformNotice } = classifyDistributionRegime(
        r.financialYear,
        trustType,
      );
      moneyFlows.push({
        id: `mf-dist-${a.id}`,
        kind: 'distribution',
        fromEntityId: r.trustEntityId,
        toEntityId: a.beneficiaryEntityId,
        financialYear: r.financialYear,
        amount,
        frankingCredits: streamedFranked > 0 ? streamedFranked : null,
        taxRegime,
        reformNotice,
      });
    }
  }
  for (const d of dividendDistributions) {
    for (const p of d.payments) {
      const amount = Number(p.amount);
      if (!isFinite(amount) || amount <= 0) continue;
      const frankingCredits = Number(p.frankingCredits);
      moneyFlows.push({
        id: `mf-div-${p.id}`,
        kind: 'dividend',
        fromEntityId: d.companyEntityId,
        toEntityId: p.shareholderEntityId,
        financialYear: d.financialYear,
        amount,
        frankingCredits: isFinite(frankingCredits) && frankingCredits > 0
          ? frankingCredits : null,
        // Dividends are not within Measure 3's (TRUST_MINIMUM_TAX) scope —
        // that measure is trust-taxable-income only. Other measures don't
        // touch the company → shareholder cashflow either.
        taxRegime: 'PRE_REFORM',
        reformNotice: null,
      });
    }
  }

  // Phase 2 enhancement — derive the FY-slider state from the actual
  // flows we loaded. moneyFlowFyOptions = every FY with ≥1 flow,
  // descending. moneyFlowFy = the most recent FY with data, or the
  // calendar current FY when no flows exist (so the slider has a
  // sensible focal point even on empty datasets).
  const moneyFlowFyOptions = Array.from(new Set(moneyFlows.map(f => f.financialYear)))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const moneyFlowFy = moneyFlowFyOptions[0] ?? currentFy;

  return {
    asOf: asOf.toISOString(),
    userId,
    entities,
    assets,
    relationships: allRelationships,
    ownershipGroups: groups,
    beneficialOverrides: overrides,
    moneyFlows,
    moneyFlowFy,
    moneyFlowFyOptions,
  };
}

/**
 * §12.14 FW-1 / FW-2 dispatch for a trustee distribution.
 *
 * Measure 3 (`TRUST_MINIMUM_TAX`) applies only to DISCRETIONARY trusts,
 * for FYs at/after 1 Jul 2028 (FY 2028-29). When the FY is in scope but
 * the Bill has not assented (`trustMinTaxCommencementVerified === false`),
 * we mark the flow `POST_REFORM_PENDING` and attach a notice — the
 * canvas renders the notice; the engine never speculatively applies the
 * 30% min-tax math (mirrors the discipline in
 * `lib/tax-engine/divisions/trustMinimumTax.ts`).
 *
 * Exported for unit testing — this function carries the load-bearing
 * §12.14 FW-1 / FW-2 discipline for Phase 2's Money Flow lens.
 */
export function classifyDistributionRegime(
  fy: string,
  trustType: TrustType | null,
): { taxRegime: MoneyFlowTaxRegime; reformNotice: string | null } {
  // Non-discretionary trusts are not in Measure 3's scope — pre-reform.
  if (trustType !== 'DISCRETIONARY') {
    return { taxRegime: 'PRE_REFORM', reformNotice: null };
  }
  // FY pre-dates the measure — pre-reform.
  let measureActiveByDate = false;
  try {
    measureActiveByDate = isPostCommencementFy(fy, 'TRUST_MINIMUM_TAX');
  } catch {
    // Malformed FY string — treat as pre-reform; the canvas still renders
    // the gross amount, no speculative math.
    return { taxRegime: 'PRE_REFORM', reformNotice: null };
  }
  if (!measureActiveByDate) {
    return { taxRegime: 'PRE_REFORM', reformNotice: null };
  }
  // FY is in scope. Check the per-measure assent gate.
  const cfg = getTaxYearConfig(fy);
  if (cfg.trustMinTaxCommencementVerified) {
    return { taxRegime: 'POST_REFORM_VERIFIED', reformNotice: null };
  }
  return {
    taxRegime: 'POST_REFORM_PENDING',
    reformNotice:
      'This distribution would be subject to the 30% minimum tax on discretionary-trust ' +
      'taxable income (Phase 41E Measure 3) once the Bill receives Royal Assent. ' +
      'The amount shown is the gross resolution — Monitrax will not apply the post-reform ' +
      'math until the law commences.',
  };
}

// ===========================================================================
// helpers
// ===========================================================================

function sumHoldingsValue(
  holdings: Array<{ currentValue: number | null; units: number; averagePrice: number }>,
): number {
  return holdings.reduce((sum, h) => {
    if (h.currentValue != null) return sum + h.currentValue;
    return sum + h.units * h.averagePrice;
  }, 0);
}

function prettyPropertyType(t: string | null): string | null {
  if (!t) return null;
  return t.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

function prettyLoanType(t: string | null): string | null {
  if (!t) return null;
  return t.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

function prettyAccountType(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

function prettyAssetType(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

/**
 * AU financial year for a given date in canonical `YYYY-YY` form.
 * Mirrors `lib/depreciation/div40.ts:getFinancialYear` semantics (local
 * time) to keep FY rollover behaviour consistent across the codebase.
 */
function currentFinancialYear(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed; July = 6
  const lead = month >= 6 ? year : year - 1;
  return `${lead}-${String(lead + 1).slice(-2)}`;
}
