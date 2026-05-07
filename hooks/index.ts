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

// Phase 42 PR6.5 — mobile swipe gesture primitive
export {
  useSwipeGesture,
  prefersReducedMotion,
  SWIPE_THRESHOLD_PX,
  TAP_MAX_DRIFT_PX,
  LONG_PRESS_MS,
  DOUBLE_TAP_WINDOW_MS,
  HAPTIC_PULSE_MS,
} from './useSwipeGesture';

export type {
  SwipeHandlers,
  SwipeState,
} from './useSwipeGesture';
