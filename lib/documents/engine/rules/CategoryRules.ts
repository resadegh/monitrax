/**
 * Phase 25: Category Rules
 * Auto-categorize documents based on context
 */

import { CategoryRule, UploadContext, UploadSource } from '../types';
import { DocumentCategory } from '../../types';
import { prisma } from '@/lib/db';

// Expense category to document category mapping
const EXPENSE_CATEGORY_MAP: Record<string, DocumentCategory> = {
  INSURANCE: DocumentCategory.INSURANCE,
  RATES: DocumentCategory.TAX,
  LAND_TAX: DocumentCategory.TAX,
  LOAN_INTEREST: DocumentCategory.MORTGAGE,
  UTILITIES: DocumentCategory.STATEMENT,
  STRATA: DocumentCategory.INVOICE,
  HOUSING: DocumentCategory.RECEIPT,
  MAINTENANCE: DocumentCategory.RECEIPT,
  PERSONAL: DocumentCategory.RECEIPT,
  FOOD: DocumentCategory.RECEIPT,
  TRANSPORT: DocumentCategory.RECEIPT,
  ENTERTAINMENT: DocumentCategory.RECEIPT,
  REGISTRATION: DocumentCategory.RECEIPT,
  MODIFICATIONS: DocumentCategory.RECEIPT,
  REPAIRS: DocumentCategory.RECEIPT,
  DEPRECIATION: DocumentCategory.TAX,
  MANAGEMENT_FEES: DocumentCategory.INVOICE,
  ADVERTISING: DocumentCategory.RECEIPT,
  CLEANING: DocumentCategory.RECEIPT,
  GARDENING: DocumentCategory.RECEIPT,
  PEST_CONTROL: DocumentCategory.RECEIPT,
  LEGAL_FEES: DocumentCategory.CONTRACT,
  ACCOUNTING_FEES: DocumentCategory.TAX,
  TRAVEL: DocumentCategory.RECEIPT,
  OTHER: DocumentCategory.OTHER,
};

// Filename patterns for auto-detection
const FILENAME_PATTERNS: Array<{ pattern: RegExp; category: DocumentCategory }> = [
  { pattern: /contract|agreement|deed/i, category: DocumentCategory.CONTRACT },
  { pattern: /invoice|bill/i, category: DocumentCategory.INVOICE },
  { pattern: /receipt|paid/i, category: DocumentCategory.RECEIPT },
  { pattern: /statement|bank/i, category: DocumentCategory.STATEMENT },
  { pattern: /tax|ato|bas|itar/i, category: DocumentCategory.TAX },
  { pattern: /insurance|policy|pds/i, category: DocumentCategory.INSURANCE },
  { pattern: /mortgage|loan|settlement/i, category: DocumentCategory.MORTGAGE },
  { pattern: /lease|rental|tenant/i, category: DocumentCategory.LEASE },
  { pattern: /valuation|appraisal/i, category: DocumentCategory.VALUATION },
];

export const CategoryRules: CategoryRule[] = [
  // Priority 100: User explicitly specified category
  {
    name: 'user_specified',
    priority: 100,
    matches: (ctx: UploadContext) => !!ctx.userInput?.category,
    getCategory: (ctx: UploadContext) => ctx.userInput.category!,
  },

  // Priority 95: Expense form with expense category lookup
  {
    name: 'expense_category_lookup',
    priority: 95,
    matches: async (ctx: UploadContext) => {
      if (!ctx.entities?.expenseId) return false;
      // Check if we need to look up the expense
      if (!ctx._resolvedData?.expense) {
        try {
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
        } catch {
          return false;
        }
      }
      return !!ctx._resolvedData?.expense?.category;
    },
    getCategory: (ctx: UploadContext) => {
      const expenseCategory = ctx._resolvedData?.expense?.category || 'OTHER';
      return EXPENSE_CATEGORY_MAP[expenseCategory] || DocumentCategory.RECEIPT;
    },
  },

  // Priority 90: Bank import source
  {
    name: 'bank_import',
    priority: 90,
    matches: (ctx: UploadContext) => ctx.source === UploadSource.BANK_IMPORT,
    getCategory: () => DocumentCategory.STATEMENT,
  },

  // Priority 85: Loan form uploads
  {
    name: 'loan_form',
    priority: 85,
    matches: (ctx: UploadContext) =>
      ctx.source === UploadSource.LOAN_FORM || !!ctx.entities?.loanId,
    getCategory: () => DocumentCategory.MORTGAGE,
  },

  // Priority 80: Property form uploads (default to valuation)
  {
    name: 'property_form',
    priority: 80,
    matches: (ctx: UploadContext) =>
      ctx.source === UploadSource.PROPERTY_FORM &&
      !ctx.entities?.expenseId,
    getCategory: () => DocumentCategory.VALUATION,
  },

  // Priority 70: Income form uploads
  {
    name: 'income_form',
    priority: 70,
    matches: (ctx: UploadContext) =>
      ctx.source === UploadSource.INCOME_FORM || !!ctx.entities?.incomeId,
    getCategory: () => DocumentCategory.STATEMENT,
  },

  // Priority 60: Filename pattern matching - contracts
  {
    name: 'filename_contract',
    priority: 60,
    matches: (ctx: UploadContext) =>
      FILENAME_PATTERNS.find(p => p.category === DocumentCategory.CONTRACT)?.pattern.test(ctx.filename) || false,
    getCategory: () => DocumentCategory.CONTRACT,
  },

  // Priority 59: Filename pattern matching - tax
  {
    name: 'filename_tax',
    priority: 59,
    matches: (ctx: UploadContext) =>
      FILENAME_PATTERNS.find(p => p.category === DocumentCategory.TAX)?.pattern.test(ctx.filename) || false,
    getCategory: () => DocumentCategory.TAX,
  },

  // Priority 58: Filename pattern matching - insurance
  {
    name: 'filename_insurance',
    priority: 58,
    matches: (ctx: UploadContext) =>
      FILENAME_PATTERNS.find(p => p.category === DocumentCategory.INSURANCE)?.pattern.test(ctx.filename) || false,
    getCategory: () => DocumentCategory.INSURANCE,
  },

  // Priority 57: Filename pattern matching - invoice
  {
    name: 'filename_invoice',
    priority: 57,
    matches: (ctx: UploadContext) =>
      FILENAME_PATTERNS.find(p => p.category === DocumentCategory.INVOICE)?.pattern.test(ctx.filename) || false,
    getCategory: () => DocumentCategory.INVOICE,
  },

  // Priority 56: Filename pattern matching - receipt
  {
    name: 'filename_receipt',
    priority: 56,
    matches: (ctx: UploadContext) =>
      FILENAME_PATTERNS.find(p => p.category === DocumentCategory.RECEIPT)?.pattern.test(ctx.filename) || false,
    getCategory: () => DocumentCategory.RECEIPT,
  },

  // Priority 55: Filename pattern matching - statement
  {
    name: 'filename_statement',
    priority: 55,
    matches: (ctx: UploadContext) =>
      FILENAME_PATTERNS.find(p => p.category === DocumentCategory.STATEMENT)?.pattern.test(ctx.filename) || false,
    getCategory: () => DocumentCategory.STATEMENT,
  },

  // Priority 50: Default for expense uploads
  {
    name: 'expense_default',
    priority: 50,
    matches: (ctx: UploadContext) =>
      ctx.source === UploadSource.EXPENSE_FORM ||
      ctx.source === UploadSource.EXPENSE_DIALOG,
    getCategory: () => DocumentCategory.RECEIPT,
  },

  // Priority 0: Default fallback
  {
    name: 'default_other',
    priority: 0,
    matches: () => true,
    getCategory: () => DocumentCategory.OTHER,
  },
];

/**
 * Apply category rules to context and return the resolved category
 */
export async function resolveCategory(context: UploadContext): Promise<DocumentCategory> {
  const sortedRules = [...CategoryRules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const matches = await rule.matches(context);
    if (matches) {
      console.log(`[CategoryRules] Matched rule: ${rule.name} (priority: ${rule.priority})`);
      return rule.getCategory(context);
    }
  }

  // Fallback (should never reach here due to default rule)
  return DocumentCategory.OTHER;
}

/**
 * Get the document category for an expense category
 */
export function getDocumentCategoryForExpense(expenseCategory: string): DocumentCategory {
  return EXPENSE_CATEGORY_MAP[expenseCategory] || DocumentCategory.RECEIPT;
}
