/**
 * Entity Value Breakdown — net value contributed by each LegalEntity in
 * the user's ownership structure. Powers the dashboard's "Entity Value
 * Contribution" horizontal-bar chart (Workstream R-Charts-1).
 *
 * SSOT contract (CLAUDE.md §12.2 / §12.3):
 *   - Does NOT re-implement asset/liability summation. It reuses the
 *     canonical `calculateTotalAssets` / `calculateTotalLiabilities`
 *     from `netWorthCalculator.ts`, calling them once per entity via the
 *     `ownerEntityId` filter that those functions already expose
 *     (Phase 41e.0 audit C-3). This guarantees per-entity figures sum to
 *     the same portfolio totals the Net Worth tile shows.
 *   - Investment value uses `currentPrice ?? averagePrice` per holding —
 *     identical to the calculator's own rule.
 *
 * Honesty contract (financial-adviser lens):
 *   - An entity with no owned objects is omitted (not shown as a $0 bar).
 *   - Net value can be negative (a property-holding entity whose mortgage
 *     exceeds its equity) — the consumer renders that as a left-pointing
 *     amber bar, never red.
 */

import { prisma } from '@/lib/db';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  type PropertyInput,
  type AccountInput,
  type InvestmentInput,
  type AssetInput,
  type LoanInput,
} from '@/lib/calculations/netWorthCalculator';

export interface EntityValueRow {
  id: string;
  name: string;
  type: string;
  /** Gross asset value owned by this entity (AUD). */
  assetValue: number;
  /** Total liabilities owed by this entity (AUD). */
  liabilityValue: number;
  /** assetValue − liabilityValue. Can be negative. */
  netValue: number;
}

/**
 * Aggregate net value per LegalEntity for a user.
 *
 * @param userId Owning user
 * @returns Rows sorted by netValue descending. Empty array when the user
 *          has no entities with any owned objects.
 */
export async function getEntityValueBreakdown(
  userId: string
): Promise<EntityValueRow[]> {
  const [entities, properties, accounts, investmentAccounts, assets, loans] =
    await Promise.all([
      prisma.legalEntity.findMany({
        where: { userId },
        select: { id: true, name: true, type: true },
      }),
      prisma.property.findMany({
        where: { userId },
        select: { currentValue: true, ownerEntityId: true },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { currentBalance: true, type: true, ownerEntityId: true },
      }),
      prisma.investmentAccount.findMany({
        where: { userId },
        select: {
          ownerEntityId: true,
          holdings: {
            select: { units: true, currentPrice: true, averagePrice: true },
          },
        },
      }),
      prisma.asset.findMany({
        where: { userId },
        select: { currentValue: true, ownerEntityId: true },
      }),
      prisma.loan.findMany({
        where: { userId },
        select: {
          principal: true,
          type: true,
          propertyId: true,
          ownerEntityId: true,
        },
      }),
    ]);

  // Flatten holdings into the calculator's InvestmentInput shape, carrying
  // the owning account's entity onto each holding.
  const investments: InvestmentInput[] = investmentAccounts.flatMap((acc) =>
    acc.holdings.map((h) => ({
      units: h.units,
      currentPrice: h.currentPrice ?? undefined,
      averagePrice: h.averagePrice,
      ownerEntityId: acc.ownerEntityId,
    }))
  );

  const propertyInputs: PropertyInput[] = properties.map((p) => ({
    currentValue: p.currentValue,
    ownerEntityId: p.ownerEntityId,
  }));
  const accountInputs: AccountInput[] = accounts.map((a) => ({
    currentBalance: a.currentBalance,
    type: a.type,
    ownerEntityId: a.ownerEntityId,
  }));
  const assetInputs: AssetInput[] = assets.map((a) => ({
    currentValue: a.currentValue,
    ownerEntityId: a.ownerEntityId,
  }));
  const loanInputs: LoanInput[] = loans.map((l) => ({
    principal: l.principal,
    type: l.type,
    propertyId: l.propertyId,
    ownerEntityId: l.ownerEntityId,
  }));

  const rows: EntityValueRow[] = entities.map((entity) => {
    const entityAssets = calculateTotalAssets(
      propertyInputs,
      accountInputs,
      investments,
      [], // superannuation is folded into accounts/investments elsewhere
      assetInputs,
      entity.id
    );
    const entityLiabilities = calculateTotalLiabilities(loanInputs, entity.id);
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      assetValue: entityAssets.total,
      liabilityValue: entityLiabilities.total,
      netValue: entityAssets.total - entityLiabilities.total,
    };
  });

  // Drop entities that own nothing and owe nothing — a $0 bar is noise,
  // not signal (behaviour-psychologist lens).
  return rows
    .filter((r) => r.assetValue !== 0 || r.liabilityValue !== 0)
    .sort((a, b) => b.netValue - a.netValue);
}
