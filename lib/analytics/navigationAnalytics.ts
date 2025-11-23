/**
 * NAVIGATION ANALYTICS - Lightweight Telemetry
 * Phase 9 Task 9.6
 *
 * Captures navigation telemetry to support future AI personalization (Phase 11).
 *
 * Features:
 * - Entity-to-entity navigation flows
 * - Module visit tracking
 * - Broken link attempts
 * - Dead-end detection
 * - Common CMNF routes
 * - Back button behavior patterns
 *
 * Storage: Write-only in-memory event log (no backend)
 * All operations are async and non-blocking
 */

import { GRDCSEntityType } from '@/lib/grdcs';

// =============================================================================
// TYPES
// =============================================================================

export type NavigationEventType =
  | 'entity_view'           // User viewed an entity
  | 'entity_navigation'     // User navigated from one entity to another
  | 'module_visit'          // User visited a module page
  | 'back_navigation'       // User used back button
  | 'breadcrumb_click'      // User clicked breadcrumb
  | 'broken_link'           // Attempted navigation to non-existent entity
  | 'dead_end'              // User hit a page with no forward navigation options
  | 'tab_change'            // User changed tabs within entity dialog
  | 'dialog_open'           // User opened entity dialog
  | 'dialog_close'          // User closed entity dialog
  | 'linked_entity_click'   // User clicked a linked entity in LinkedDataPanel
  | 'search_navigation'     // User navigated via search
  | 'quick_action';         // User used a quick action

export interface NavigationEvent {
  id: string;
  type: NavigationEventType;
  timestamp: number;
  sessionId: string;

  // Entity context
  entityType?: GRDCSEntityType;
  entityId?: string;
  entityName?: string;

  // Source context (for navigation events)
  fromEntityType?: GRDCSEntityType;
  fromEntityId?: string;
  fromModule?: string;

  // Target context
  toEntityType?: GRDCSEntityType;
  toEntityId?: string;
  toModule?: string;

  // Navigation metadata
  tab?: string;
  breadcrumbDepth?: number;
  navigationMethod?: 'click' | 'back' | 'breadcrumb' | 'direct' | 'search';

  // Error context
  error?: string;
  failedHref?: string;

  // Timing
  durationMs?: number;
}

export interface ModuleVisitStats {
  module: string;
  visitCount: number;
  lastVisit: number;
  averageDurationMs: number;
  totalDurationMs: number;
}

export interface NavigationPath {
  path: string[];       // e.g., ['property', 'loan', 'expense']
  count: number;
  lastOccurrence: number;
}

export interface NavigationSummary {
  sessionId: string;
  sessionStartTime: number;
  totalEvents: number;
  totalNavigations: number;

  // Module stats
  moduleVisits: Record<string, ModuleVisitStats>;
  mostVisitedModules: Array<{ module: string; count: number }>;

  // Entity stats
  entitiesViewed: number;
  uniqueEntitiesViewed: Set<string>;
  entityViewsByType: Record<string, number>;

  // Navigation patterns
  commonPaths: NavigationPath[];
  averageBreadcrumbDepth: number;
  maxBreadcrumbDepth: number;

  // Back navigation
  backNavigationCount: number;
  backNavigationRate: number;

  // Errors & dead ends
  brokenLinkAttempts: number;
  deadEndEncounters: number;
  deadEndLocations: Array<{ entityType: string; entityId: string; count: number }>;

  // Session health
  navigationEfficiency: number;  // 0-100, higher is better
}

// =============================================================================
// IN-MEMORY STORAGE
// =============================================================================

// Event log - write-only, grows during session
let eventLog: NavigationEvent[] = [];

// Session tracking
let sessionId: string = generateSessionId();
let sessionStartTime: number = Date.now();

// Computed caches (updated lazily)
let summaryCache: NavigationSummary | null = null;
let summaryCacheTime: number = 0;
const CACHE_TTL_MS = 1000; // 1 second cache

// Entity visit tracking for dead-end detection
let lastEntityVisit: { type: GRDCSEntityType; id: string; time: number } | null = null;
let entityVisitDurations: Map<string, number[]> = new Map();

// =============================================================================
// HELPERS
// =============================================================================

function generateSessionId(): string {
  return `nav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function getEntityKey(type: GRDCSEntityType, id: string): string {
  return `${type}:${id}`;
}

// =============================================================================
// EVENT RECORDING (Async, Non-blocking)
// =============================================================================

/**
 * Record a navigation event asynchronously.
 * This function returns immediately and processes the event in the next microtask.
 */
export function recordNavigationEvent(
  event: Omit<NavigationEvent, 'id' | 'timestamp' | 'sessionId'>
): void {
  // Use queueMicrotask for async, non-blocking execution
  queueMicrotask(() => {
    const fullEvent: NavigationEvent = {
      ...event,
      id: generateEventId(),
      timestamp: Date.now(),
      sessionId,
    };

    eventLog.push(fullEvent);

    // Track entity visit durations
    if (event.type === 'entity_view' && event.entityType && event.entityId) {
      if (lastEntityVisit) {
        const duration = Date.now() - lastEntityVisit.time;
        const key = getEntityKey(lastEntityVisit.type, lastEntityVisit.id);
        const durations = entityVisitDurations.get(key) || [];
        durations.push(duration);
        entityVisitDurations.set(key, durations);
      }
      lastEntityVisit = {
        type: event.entityType,
        id: event.entityId,
        time: Date.now(),
      };
    }

    // Invalidate summary cache
    summaryCache = null;

    // Keep event log bounded (max 10000 events per session)
    if (eventLog.length > 10000) {
      eventLog = eventLog.slice(-5000);
    }
  });
}

// =============================================================================
// CONVENIENCE RECORDING FUNCTIONS
// =============================================================================

export function recordEntityView(
  entityType: GRDCSEntityType,
  entityId: string,
  entityName: string,
  tab?: string
): void {
  recordNavigationEvent({
    type: 'entity_view',
    entityType,
    entityId,
    entityName,
    tab,
  });
}

export function recordEntityNavigation(
  from: { type: GRDCSEntityType; id: string; module?: string },
  to: { type: GRDCSEntityType; id: string; module?: string },
  method: 'click' | 'back' | 'breadcrumb' | 'direct' | 'search' = 'click'
): void {
  recordNavigationEvent({
    type: 'entity_navigation',
    fromEntityType: from.type,
    fromEntityId: from.id,
    fromModule: from.module,
    toEntityType: to.type,
    toEntityId: to.id,
    toModule: to.module,
    navigationMethod: method,
  });
}

export function recordModuleVisit(module: string): void {
  recordNavigationEvent({
    type: 'module_visit',
    toModule: module,
  });
}

export function recordBackNavigation(breadcrumbDepth: number): void {
  recordNavigationEvent({
    type: 'back_navigation',
    breadcrumbDepth,
    navigationMethod: 'back',
  });
}

export function recordBreadcrumbClick(
  targetType: GRDCSEntityType,
  targetId: string,
  depth: number
): void {
  recordNavigationEvent({
    type: 'breadcrumb_click',
    toEntityType: targetType,
    toEntityId: targetId,
    breadcrumbDepth: depth,
    navigationMethod: 'breadcrumb',
  });
}

export function recordBrokenLink(
  failedHref: string,
  fromType?: GRDCSEntityType,
  fromId?: string
): void {
  recordNavigationEvent({
    type: 'broken_link',
    failedHref,
    fromEntityType: fromType,
    fromEntityId: fromId,
    error: `Failed to navigate to: ${failedHref}`,
  });
}

export function recordDeadEnd(
  entityType: GRDCSEntityType,
  entityId: string,
  entityName: string
): void {
  recordNavigationEvent({
    type: 'dead_end',
    entityType,
    entityId,
    entityName,
  });
}

export function recordTabChange(
  entityType: GRDCSEntityType,
  entityId: string,
  tab: string
): void {
  recordNavigationEvent({
    type: 'tab_change',
    entityType,
    entityId,
    tab,
  });
}

export function recordDialogOpen(
  entityType: GRDCSEntityType,
  entityId: string,
  entityName: string
): void {
  recordNavigationEvent({
    type: 'dialog_open',
    entityType,
    entityId,
    entityName,
  });
}

export function recordDialogClose(
  entityType: GRDCSEntityType,
  entityId: string,
  durationMs?: number
): void {
  recordNavigationEvent({
    type: 'dialog_close',
    entityType,
    entityId,
    durationMs,
  });
}

export function recordLinkedEntityClick(
  fromType: GRDCSEntityType,
  fromId: string,
  toType: GRDCSEntityType,
  toId: string,
  toName: string
): void {
  recordNavigationEvent({
    type: 'linked_entity_click',
    fromEntityType: fromType,
    fromEntityId: fromId,
    toEntityType: toType,
    toEntityId: toId,
    entityName: toName,
    navigationMethod: 'click',
  });
}

// =============================================================================
// SUMMARY GENERATION
// =============================================================================

/**
 * Generate a compact summary of navigation analytics.
 * Uses caching for performance.
 */
export function getNavigationSummary(): NavigationSummary {
  // Return cached summary if still valid
  if (summaryCache && Date.now() - summaryCacheTime < CACHE_TTL_MS) {
    return summaryCache;
  }

  const summary = computeNavigationSummary();
  summaryCache = summary;
  summaryCacheTime = Date.now();
  return summary;
}

function computeNavigationSummary(): NavigationSummary {
  const moduleVisits: Record<string, ModuleVisitStats> = {};
  const entityViewsByType: Record<string, number> = {};
  const uniqueEntities = new Set<string>();
  const pathCounts = new Map<string, { count: number; lastOccurrence: number }>();
  const deadEndLocations = new Map<string, { entityType: string; entityId: string; count: number }>();

  let totalNavigations = 0;
  let backNavigationCount = 0;
  let brokenLinkAttempts = 0;
  let deadEndEncounters = 0;
  let totalBreadcrumbDepth = 0;
  let breadcrumbDepthCount = 0;
  let maxBreadcrumbDepth = 0;

  // Track navigation paths
  const recentPath: string[] = [];

  for (const event of eventLog) {
    // Module visits
    if (event.type === 'module_visit' && event.toModule) {
      const module = event.toModule;
      if (!moduleVisits[module]) {
        moduleVisits[module] = {
          module,
          visitCount: 0,
          lastVisit: 0,
          averageDurationMs: 0,
          totalDurationMs: 0,
        };
      }
      moduleVisits[module].visitCount++;
      moduleVisits[module].lastVisit = event.timestamp;
    }

    // Entity views
    if (event.type === 'entity_view' && event.entityType && event.entityId) {
      const key = getEntityKey(event.entityType, event.entityId);
      uniqueEntities.add(key);
      entityViewsByType[event.entityType] = (entityViewsByType[event.entityType] || 0) + 1;

      // Track path
      recentPath.push(event.entityType);
      if (recentPath.length > 5) recentPath.shift();
      if (recentPath.length >= 2) {
        const pathKey = recentPath.slice(-3).join(' → ');
        const existing = pathCounts.get(pathKey) || { count: 0, lastOccurrence: 0 };
        pathCounts.set(pathKey, { count: existing.count + 1, lastOccurrence: event.timestamp });
      }
    }

    // Navigations
    if (event.type === 'entity_navigation') {
      totalNavigations++;
    }

    // Back navigation
    if (event.type === 'back_navigation') {
      backNavigationCount++;
    }

    // Breadcrumb tracking
    if (event.breadcrumbDepth !== undefined) {
      totalBreadcrumbDepth += event.breadcrumbDepth;
      breadcrumbDepthCount++;
      maxBreadcrumbDepth = Math.max(maxBreadcrumbDepth, event.breadcrumbDepth);
    }

    // Broken links
    if (event.type === 'broken_link') {
      brokenLinkAttempts++;
    }

    // Dead ends
    if (event.type === 'dead_end' && event.entityType && event.entityId) {
      deadEndEncounters++;
      const key = getEntityKey(event.entityType, event.entityId);
      const existing = deadEndLocations.get(key) || {
        entityType: event.entityType,
        entityId: event.entityId,
        count: 0,
      };
      existing.count++;
      deadEndLocations.set(key, existing);
    }
  }

  // Sort module visits
  const mostVisitedModules = Object.values(moduleVisits)
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 10)
    .map(m => ({ module: m.module, count: m.visitCount }));

  // Sort paths
  const commonPaths: NavigationPath[] = Array.from(pathCounts.entries())
    .map(([path, data]) => ({
      path: path.split(' → '),
      count: data.count,
      lastOccurrence: data.lastOccurrence,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate navigation efficiency
  // Higher efficiency = fewer back navigations, fewer broken links, fewer dead ends
  const totalInteractions = eventLog.length;
  const negativeInteractions = backNavigationCount + brokenLinkAttempts + deadEndEncounters;
  const navigationEfficiency = totalInteractions > 0
    ? Math.round(((totalInteractions - negativeInteractions) / totalInteractions) * 100)
    : 100;

  return {
    sessionId,
    sessionStartTime,
    totalEvents: eventLog.length,
    totalNavigations,
    moduleVisits,
    mostVisitedModules,
    entitiesViewed: uniqueEntities.size,
    uniqueEntitiesViewed: uniqueEntities,
    entityViewsByType,
    commonPaths,
    averageBreadcrumbDepth: breadcrumbDepthCount > 0
      ? Math.round((totalBreadcrumbDepth / breadcrumbDepthCount) * 10) / 10
      : 0,
    maxBreadcrumbDepth,
    backNavigationCount,
    backNavigationRate: totalNavigations > 0
      ? Math.round((backNavigationCount / totalNavigations) * 100)
      : 0,
    brokenLinkAttempts,
    deadEndEncounters,
    deadEndLocations: Array.from(deadEndLocations.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    navigationEfficiency,
  };
}

// =============================================================================
// RAW DATA ACCESS (for DevPanel)
// =============================================================================

/**
 * Get raw event log (for debugging/dev panel only)
 */
export function getEventLog(): NavigationEvent[] {
  return [...eventLog];
}

/**
 * Get recent events (last N)
 */
export function getRecentEvents(count: number = 50): NavigationEvent[] {
  return eventLog.slice(-count);
}

// =============================================================================
// RESET & SESSION MANAGEMENT
// =============================================================================

/**
 * Reset all navigation analytics
 */
export function resetNavigationAnalytics(): void {
  eventLog = [];
  sessionId = generateSessionId();
  sessionStartTime = Date.now();
  summaryCache = null;
  summaryCacheTime = 0;
  lastEntityVisit = null;
  entityVisitDurations.clear();
}

/**
 * Start a new session (keeps event log for reference)
 */
export function startNewSession(): void {
  sessionId = generateSessionId();
  sessionStartTime = Date.now();
  summaryCache = null;
  lastEntityVisit = null;
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return sessionId;
}

/**
 * Get session duration in milliseconds
 */
export function getSessionDuration(): number {
  return Date.now() - sessionStartTime;
}
