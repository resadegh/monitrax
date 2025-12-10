/**
 * Phase 25: Path Rules
 * Generate storage paths based on context and links
 */

import { PathRule, UploadContext, EntityLink, UploadSource } from '../types';
import { LinkedEntityType, DocumentCategory } from '../../types';

// Category to folder name mapping
const CATEGORY_FOLDERS: Record<string, string> = {
  CONTRACT: 'contracts',
  STATEMENT: 'statements',
  RECEIPT: 'receipts',
  TAX: 'tax-documents',
  PDS: 'product-disclosures',
  VALUATION: 'valuations',
  INSURANCE: 'insurance',
  MORTGAGE: 'mortgage',
  LEASE: 'leases',
  INVOICE: 'invoices',
  OTHER: 'other',
};

/**
 * Get Australian fiscal year string (FY24-25 format)
 */
function getAustralianFiscalYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  // Australian FY: July (month 6) to June (month 5)
  const fyStart = month >= 6 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;
}

/**
 * Sanitize filename for use in storage path
 */
function sanitizeFilename(filename: string): string {
  // Remove any path components
  const baseName = filename.split('/').pop() || filename;

  // Replace special characters with underscores
  return baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
}

/**
 * Generate unique filename with timestamp
 */
function generatePathFilename(filename: string): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  return `${timestamp}_${sanitized}`;
}

export const PathRules: PathRule[] = [
  // Priority 100: Expense linked to property (most specific)
  {
    name: 'expense_property_path',
    priority: 100,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.EXPENSE) &&
      links.some(l => l.entityType === LinkedEntityType.PROPERTY),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const propertyLink = links.find(l => l.entityType === LinkedEntityType.PROPERTY)!;
      const expenseLink = links.find(l => l.entityType === LinkedEntityType.EXPENSE)!;
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/properties/${propertyLink.entityId}/expenses/${expenseLink.entityId}/${filename}`;
    },
  },

  // Priority 95: Expense linked to loan (loan documents)
  {
    name: 'expense_loan_path',
    priority: 95,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.EXPENSE) &&
      links.some(l => l.entityType === LinkedEntityType.LOAN) &&
      !links.some(l => l.entityType === LinkedEntityType.PROPERTY),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const loanLink = links.find(l => l.entityType === LinkedEntityType.LOAN)!;
      const expenseLink = links.find(l => l.entityType === LinkedEntityType.EXPENSE)!;
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/loans/${loanLink.entityId}/expenses/${expenseLink.entityId}/${filename}`;
    },
  },

  // Priority 90: Standalone expense (not linked to property or loan)
  {
    name: 'expense_standalone_path',
    priority: 90,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.EXPENSE) &&
      !links.some(l => l.entityType === LinkedEntityType.PROPERTY) &&
      !links.some(l => l.entityType === LinkedEntityType.LOAN),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const expenseLink = links.find(l => l.entityType === LinkedEntityType.EXPENSE)!;
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/expenses/${fiscalYear}/${expenseLink.entityId}/${filename}`;
    },
  },

  // Priority 85: Property document (no expense)
  {
    name: 'property_path',
    priority: 85,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.PROPERTY) &&
      !links.some(l => l.entityType === LinkedEntityType.EXPENSE),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const propertyLink = links.find(l => l.entityType === LinkedEntityType.PROPERTY)!;
      const categoryFolder = CATEGORY_FOLDERS[ctx.userInput?.category || 'OTHER'] || 'documents';
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/properties/${propertyLink.entityId}/${categoryFolder}/${filename}`;
    },
  },

  // Priority 80: Loan document
  {
    name: 'loan_path',
    priority: 80,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.LOAN) &&
      !links.some(l => l.entityType === LinkedEntityType.EXPENSE) &&
      !links.some(l => l.entityType === LinkedEntityType.PROPERTY),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const loanLink = links.find(l => l.entityType === LinkedEntityType.LOAN)!;
      const categoryFolder = CATEGORY_FOLDERS[ctx.userInput?.category || 'MORTGAGE'] || 'documents';
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/loans/${loanLink.entityId}/${categoryFolder}/${filename}`;
    },
  },

  // Priority 75: Income document
  {
    name: 'income_path',
    priority: 75,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.INCOME),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const incomeLink = links.find(l => l.entityType === LinkedEntityType.INCOME)!;
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/income/${fiscalYear}/${incomeLink.entityId}/${filename}`;
    },
  },

  // Priority 70: Bank account document
  {
    name: 'account_path',
    priority: 70,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.ACCOUNT),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const accountLink = links.find(l => l.entityType === LinkedEntityType.ACCOUNT)!;
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/accounts/${accountLink.entityId}/statements/${fiscalYear}/${filename}`;
    },
  },

  // Priority 65: Investment account document
  {
    name: 'investment_account_path',
    priority: 65,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.INVESTMENT_ACCOUNT),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const accountLink = links.find(l => l.entityType === LinkedEntityType.INVESTMENT_ACCOUNT)!;
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/investments/${accountLink.entityId}/statements/${fiscalYear}/${filename}`;
    },
  },

  // Priority 60: Investment holding document
  {
    name: 'investment_holding_path',
    priority: 60,
    matches: (_ctx: UploadContext, links: EntityLink[]) =>
      links.some(l => l.entityType === LinkedEntityType.INVESTMENT_HOLDING) &&
      !links.some(l => l.entityType === LinkedEntityType.INVESTMENT_ACCOUNT),
    generatePath: (ctx: UploadContext, links: EntityLink[]) => {
      const holdingLink = links.find(l => l.entityType === LinkedEntityType.INVESTMENT_HOLDING)!;
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/holdings/${holdingLink.entityId}/${filename}`;
    },
  },

  // Priority 55: Bank import path
  {
    name: 'bank_import_path',
    priority: 55,
    matches: (ctx: UploadContext) => ctx.source === UploadSource.BANK_IMPORT,
    generatePath: (ctx: UploadContext) => {
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/bank-imports/${fiscalYear}/${filename}`;
    },
  },

  // Priority 50: Category-based path with fiscal year
  {
    name: 'category_fiscal_year_path',
    priority: 50,
    matches: (ctx: UploadContext) => !!ctx.userInput?.category,
    generatePath: (ctx: UploadContext) => {
      const categoryFolder = CATEGORY_FOLDERS[ctx.userInput?.category || 'OTHER'];
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/documents/${fiscalYear}/${categoryFolder}/${filename}`;
    },
  },

  // Priority 0: Default fallback path
  {
    name: 'default_path',
    priority: 0,
    matches: () => true,
    generatePath: (ctx: UploadContext) => {
      const fiscalYear = getAustralianFiscalYear();
      const filename = generatePathFilename(ctx.filename);
      return `${ctx.userId}/documents/${fiscalYear}/other/${filename}`;
    },
  },
];

/**
 * Apply path rules to context and return the storage path
 */
export function resolveStoragePath(
  context: UploadContext,
  links: EntityLink[]
): string {
  const sortedRules = [...PathRules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.matches(context, links)) {
      console.log(`[PathRules] Matched rule: ${rule.name} (priority: ${rule.priority})`);
      return rule.generatePath(context, links);
    }
  }

  // Fallback (should never reach here due to default rule)
  const filename = generatePathFilename(context.filename);
  return `${context.userId}/documents/${filename}`;
}

// Export utility functions
export { getAustralianFiscalYear, sanitizeFilename, generatePathFilename };
