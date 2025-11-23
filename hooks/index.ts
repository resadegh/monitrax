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
