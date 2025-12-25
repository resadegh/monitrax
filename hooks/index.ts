/**
 * Hooks Module
 * Exports all custom React hooks
 */

export {
  useCrossModuleNavigation,
} from './useCrossModuleNavigation';

export type {
  NavigateOptions,
  CrossModuleNavigation,
} from './useCrossModuleNavigation';

export {
  useUISyncEngine,
  getEntityWarnings,
} from './useUISyncEngine';

export type {
  UseUISyncEngineOptions,
  UseUISyncEngineReturn,
  EntityHealthInfo,
} from './useUISyncEngine';

export {
  useNavigationAnalytics,
} from './useNavigationAnalytics';

export type {
  UseNavigationAnalyticsReturn,
} from './useNavigationAnalytics';

export {
  useCategories,
  getCategoryDisplayName,
  isCustomCategoryId,
} from './useCategories';

export type {
  Category,
  UseCategoriesOptions,
  UseCategoriesReturn,
  CreateCategoryData,
  UpdateCategoryData,
} from './useCategories';
