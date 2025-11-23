/**
 * Analytics Module
 * Phase 9 Task 9.6 - Navigation Analytics (Lightweight Telemetry)
 *
 * Exports all analytics-related functions and types.
 */

export {
  // Types
  type NavigationEventType,
  type NavigationEvent,
  type ModuleVisitStats,
  type NavigationPath,
  type NavigationSummary,

  // Event recording
  recordNavigationEvent,
  recordEntityView,
  recordEntityNavigation,
  recordModuleVisit,
  recordBackNavigation,
  recordBreadcrumbClick,
  recordBrokenLink,
  recordDeadEnd,
  recordTabChange,
  recordDialogOpen,
  recordDialogClose,
  recordLinkedEntityClick,

  // Summary & data access
  getNavigationSummary,
  getEventLog,
  getRecentEvents,

  // Session management
  resetNavigationAnalytics,
  startNewSession,
  getSessionId,
  getSessionDuration,
} from './navigationAnalytics';
