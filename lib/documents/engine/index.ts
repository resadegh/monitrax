/**
 * Phase 25: Document Management Engine
 * Public exports
 */

// Main engine
export {
  DocumentManagementEngine,
  getDocumentManagementEngine,
  createUploadContext,
  UploadSource,
} from './DocumentManagementEngine';

// Types
export type {
  UploadContext,
  EngineResult,
  ResolvedUploadConfig,
  EntityLink,
  EntityContext,
  UserInput,
  StorageRule,
  CategoryRule,
  LinkingRule,
  PathRule,
} from './types';

// Rule Engine (for testing/debugging)
export { RuleEngine, getRuleEngine } from './RuleEngine';

// Individual rules (for extension)
export { StorageRules, resolveStorageProvider } from './rules/StorageRules';
export { CategoryRules, resolveCategory, getDocumentCategoryForExpense } from './rules/CategoryRules';
export { LinkingRules, resolveLinks } from './rules/LinkingRules';
export { PathRules, resolveStoragePath, getAustralianFiscalYear } from './rules/PathRules';
