/**
 * Insights Components Module
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Exports all insight-related UI components.
 */

// InsightCard
export { InsightCard } from './InsightCard';
export type { InsightCardProps } from './InsightCard';

// InsightList
export { InsightList } from './InsightList';
export type { InsightListProps } from './InsightList';

// InsightSeverityMeter
export {
  InsightSeverityMeter,
  MiniSeverityMeter,
} from './InsightSeverityMeter';
export type {
  InsightSeverityMeterProps,
  MiniSeverityMeterProps,
} from './InsightSeverityMeter';

// InsightBadges
export {
  SeverityBadge,
  CategoryBadge,
  EntityCountBadge,
  MissingRelationIndicator,
  InsightBadgeGroup,
} from './InsightBadges';
export type {
  SeverityBadgeProps,
  CategoryBadgeProps,
  EntityCountBadgeProps,
  MissingRelationIndicatorProps,
  InsightBadgeGroupProps,
} from './InsightBadges';
