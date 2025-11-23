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
  RestorationState,
} from './useCrossModuleNavigation';

// Insights hooks (Phase 9 Task 9.3)
export {
  useInsights,
  useEntityInsights,
  useCriticalInsights,
  useModuleInsights,
} from './useInsights';
