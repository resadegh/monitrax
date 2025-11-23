/**
 * Warning Components Module
 * Phase 9 Tasks 9.4 & 9.5 - Real-Time Global Health Feed & Unified UI Components
 *
 * Exports all warning-related UI components.
 */

// GlobalWarningRibbon (Task 9.4)
export { GlobalWarningRibbon } from './GlobalWarningRibbon';
export type { GlobalWarningRibbonProps } from './GlobalWarningRibbon';

// DialogWarningBanner (Task 9.4)
export {
  DialogWarningBanner,
  EntityWarningBanner,
} from './DialogWarningBanner';
export type {
  DialogWarningBannerProps,
  EntityWarningBannerProps,
} from './DialogWarningBanner';

// WarningBanner - Unified (Task 9.5)
export {
  WarningBanner,
  CriticalWarning,
  HighWarning,
  Warning,
  InfoBanner,
  HealthAwareWarning,
} from './WarningBanner';
export type {
  WarningBannerProps,
  WarningLevel,
  WarningBannerAction,
  QuickWarningProps,
  HealthAwareWarningProps,
} from './WarningBanner';
