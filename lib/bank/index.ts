/**
 * Phase 18: Bank Transaction Import Module
 * Main exports for the bank transaction import system
 */

// Types
export * from './types';

// Parsers
export { parseCSV, suggestColumnMappings } from './parsers/csv';
export { parseQIF, isValidQIF } from './parsers/qif';

// Normalisation
export {
  normaliseTransactions,
  renormaliseMerchant,
  generateHash,
} from './normalisation';

// Categorisation
export {
  categoriseTransactions,
  getDefaultRules,
  getCategoryLevel1Options,
  getCategoryLevel2Options,
} from './categorisation';

// Duplicate Detection
export {
  checkForDuplicate,
  detectDuplicates,
  applyDuplicatePolicy,
  countPotentialDuplicates,
} from './duplicateDetection';

// Budget Comparison
export {
  compareAgainstBudget,
  generateMonthlyReport,
  generateHealthNarrative,
  getAvailableMonths,
} from './budgetComparison';

// Basiq Sync (Open Banking transaction priority)
export {
  syncBasiqTransactions,
  canAcceptManualImport,
  getTransactionSourceCounts,
} from './basiqSync';
