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
 *
 * Returns SHAPE ONLY — no tax math, no calc engine. Phase 2 (separate PR)
 * adds DistributionAllocation + DividendPayment for the Money Flow lens
 * with Phase 41E reform-awareness gating per CLAUDE.md §12.14.
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
  ] = await prisma.$transaction([
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

  return {
    asOf: asOf.toISOString(),
    userId,
    entities,
    assets,
    relationships: allRelationships,
    ownershipGroups: groups,
    beneficialOverrides: overrides,
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
