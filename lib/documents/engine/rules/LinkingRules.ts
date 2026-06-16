/**
 * Phase 25: Linking Rules
 * Determine which entities to link documents to
 */

import { LinkingRule, UploadContext, EntityLink, UploadSource } from '../types';
import { LinkedEntityType } from '../../types';
import { prisma } from '@/lib/db';

export const LinkingRules: LinkingRule[] = [
  // Priority 100: Expense with potential cascade to property/loan
  {
    name: 'expense_with_cascade',
    priority: 100,
    matches: (ctx: UploadContext) => !!ctx.entities?.expenseId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      const links: EntityLink[] = [
        { entityType: LinkedEntityType.EXPENSE, entityId: ctx.entities.expenseId! },
      ];

      // Look up expense to get property/loan relationship
      try {
        if (!ctx._resolvedData?.expense) {
          const expense = await prisma.expense.findUnique({
            where: { id: ctx.entities.expenseId },
            select: { id: true, category: true, propertyId: true, loanId: true },
          });
          if (expense) {
            ctx._resolvedData = ctx._resolvedData || {};
            ctx._resolvedData.expense = {
              id: expense.id,
              category: expense.category,
              propertyId: expense.propertyId || undefined,
              loanId: expense.loanId || undefined,
            };
          }
        }

        // Add property link if expense is linked to property
        if (ctx._resolvedData?.expense?.propertyId) {
          links.push({
            entityType: LinkedEntityType.PROPERTY,
            entityId: ctx._resolvedData.expense.propertyId,
          });
        }

        // Add loan link if expense is linked to loan
        if (ctx._resolvedData?.expense?.loanId) {
          links.push({
            entityType: LinkedEntityType.LOAN,
            entityId: ctx._resolvedData.expense.loanId,
          });
        }
      } catch (error) {
        console.error('[LinkingRules] Error looking up expense:', error);
      }

      return links;
    },
  },

  // Priority 95: Direct property link
  {
    name: 'property_direct',
    priority: 95,
    matches: (ctx: UploadContext) =>
      !!ctx.entities?.propertyId && !ctx.entities?.expenseId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      return [
        { entityType: LinkedEntityType.PROPERTY, entityId: ctx.entities.propertyId! },
      ];
    },
  },

  // Priority 90: Loan direct link with potential cascade to property
  {
    name: 'loan_with_cascade',
    priority: 90,
    matches: (ctx: UploadContext) => !!ctx.entities?.loanId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      const links: EntityLink[] = [
        { entityType: LinkedEntityType.LOAN, entityId: ctx.entities.loanId! },
      ];

      // Look up loan to get property relationship
      try {
        const loan = await prisma.loan.findUnique({
          where: { id: ctx.entities.loanId },
          select: { propertyId: true },
        });

        if (loan?.propertyId) {
          links.push({
            entityType: LinkedEntityType.PROPERTY,
            entityId: loan.propertyId,
          });
        }
      } catch (error) {
        console.error('[LinkingRules] Error looking up loan:', error);
      }

      return links;
    },
  },

  // Priority 85: Income direct link with potential cascade to property
  {
    name: 'income_with_cascade',
    priority: 85,
    matches: (ctx: UploadContext) => !!ctx.entities?.incomeId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      const links: EntityLink[] = [
        { entityType: LinkedEntityType.INCOME, entityId: ctx.entities.incomeId! },
      ];

      // Look up income to get property relationship
      try {
        const income = await prisma.income.findUnique({
          where: { id: ctx.entities.incomeId },
          select: { propertyId: true },
        });

        if (income?.propertyId) {
          links.push({
            entityType: LinkedEntityType.PROPERTY,
            entityId: income.propertyId,
          });
        }
      } catch (error) {
        console.error('[LinkingRules] Error looking up income:', error);
      }

      return links;
    },
  },

  // Priority 80: Bank account link
  {
    name: 'account_direct',
    priority: 80,
    matches: (ctx: UploadContext) =>
      ctx.source === UploadSource.BANK_IMPORT && !!ctx.entities?.accountId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      return [
        { entityType: LinkedEntityType.ACCOUNT, entityId: ctx.entities.accountId! },
      ];
    },
  },

  // Priority 75: Offset account link
  {
    name: 'offset_account_direct',
    priority: 75,
    matches: (ctx: UploadContext) => !!ctx.entities?.offsetAccountId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      return [
        { entityType: LinkedEntityType.OFFSET_ACCOUNT, entityId: ctx.entities.offsetAccountId! },
      ];
    },
  },

  // Priority 70: Investment account link
  {
    name: 'investment_account_direct',
    priority: 70,
    matches: (ctx: UploadContext) => !!ctx.entities?.investmentAccountId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      const links: EntityLink[] = [
        { entityType: LinkedEntityType.INVESTMENT_ACCOUNT, entityId: ctx.entities.investmentAccountId! },
      ];

      // If also has holding, add that link
      if (ctx.entities?.investmentHoldingId) {
        links.push({
          entityType: LinkedEntityType.INVESTMENT_HOLDING,
          entityId: ctx.entities.investmentHoldingId,
        });
      }

      return links;
    },
  },

  // Priority 65: Investment holding link
  {
    name: 'investment_holding_direct',
    priority: 65,
    matches: (ctx: UploadContext) =>
      !!ctx.entities?.investmentHoldingId && !ctx.entities?.investmentAccountId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      const links: EntityLink[] = [
        { entityType: LinkedEntityType.INVESTMENT_HOLDING, entityId: ctx.entities.investmentHoldingId! },
      ];

      // Look up holding to get account relationship
      try {
        const holding = await prisma.investmentHolding.findUnique({
          where: { id: ctx.entities.investmentHoldingId },
          select: { investmentAccountId: true },
        });

        if (holding?.investmentAccountId) {
          links.push({
            entityType: LinkedEntityType.INVESTMENT_ACCOUNT,
            entityId: holding.investmentAccountId,
          });
        }
      } catch (error) {
        console.error('[LinkingRules] Error looking up investment holding:', error);
      }

      return links;
    },
  },

  // Priority 60: Transaction link
  {
    name: 'transaction_direct',
    priority: 60,
    matches: (ctx: UploadContext) => !!ctx.entities?.transactionId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      return [
        { entityType: LinkedEntityType.TRANSACTION, entityId: ctx.entities.transactionId! },
      ];
    },
  },

  // Priority 55: Asset link (vehicles, electronics, etc.). Phase A — lets a
  // document/receipt be tagged to a specific asset (e.g. a CTP policy or rego
  // notice on a vehicle).
  {
    name: 'asset_direct',
    priority: 55,
    matches: (ctx: UploadContext) => !!ctx.entities?.assetId,
    getLinks: async (ctx: UploadContext): Promise<EntityLink[]> => {
      return [
        { entityType: LinkedEntityType.ASSET, entityId: ctx.entities.assetId! },
      ];
    },
  },
];

/**
 * Apply linking rules to context and return all entity links
 */
export async function resolveLinks(context: UploadContext): Promise<EntityLink[]> {
  const allLinks: EntityLink[] = [];
  const sortedRules = [...LinkingRules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.matches(context)) {
      console.log(`[LinkingRules] Matched rule: ${rule.name} (priority: ${rule.priority})`);
      const links = await rule.getLinks(context);
      allLinks.push(...links);
    }
  }

  // Deduplicate links
  return deduplicateLinks(allLinks);
}

/**
 * Remove duplicate links
 */
function deduplicateLinks(links: EntityLink[]): EntityLink[] {
  const seen = new Set<string>();
  return links.filter(link => {
    const key = `${link.entityType}:${link.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
