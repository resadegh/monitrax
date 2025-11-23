'use client';

/**
 * USE NAVIGATION ANALYTICS HOOK
 * Phase 9 Task 9.6 - Navigation Analytics (Lightweight Telemetry)
 *
 * Hook that emits navigation events from NavigationContext.
 * Provides convenient methods for recording analytics from components.
 *
 * Usage:
 * const analytics = useNavigationAnalytics();
 * analytics.trackEntityView('property', '123', 'My Property');
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigationContext } from '@/contexts/NavigationContext';
import { GRDCSEntityType, GRDCSLinkedEntity } from '@/lib/grdcs';
import {
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
  getNavigationSummary,
  getRecentEvents,
  resetNavigationAnalytics,
  getSessionId,
  getSessionDuration,
  NavigationSummary,
  NavigationEvent,
} from '@/lib/analytics';

export interface UseNavigationAnalyticsReturn {
  // Tracking methods
  trackEntityView: (type: GRDCSEntityType, id: string, name: string, tab?: string) => void;
  trackNavigation: (
    from: { type: GRDCSEntityType; id: string },
    to: { type: GRDCSEntityType; id: string },
    method?: 'click' | 'back' | 'breadcrumb' | 'direct' | 'search'
  ) => void;
  trackModuleVisit: (module: string) => void;
  trackBackNavigation: () => void;
  trackBreadcrumbClick: (targetType: GRDCSEntityType, targetId: string) => void;
  trackBrokenLink: (failedHref: string) => void;
  trackDeadEnd: (type: GRDCSEntityType, id: string, name: string) => void;
  trackTabChange: (type: GRDCSEntityType, id: string, tab: string) => void;
  trackDialogOpen: (type: GRDCSEntityType, id: string, name: string) => void;
  trackDialogClose: (type: GRDCSEntityType, id: string) => void;
  trackLinkedEntityClick: (linkedEntity: GRDCSLinkedEntity) => void;

  // Summary access
  getSummary: () => NavigationSummary;
  getRecent: (count?: number) => NavigationEvent[];
  reset: () => void;

  // Session info
  sessionId: string;
  sessionDuration: number;

  // Current context
  currentEntity: { type: GRDCSEntityType; id: string; label: string } | null;
  breadcrumbDepth: number;
}

export function useNavigationAnalytics(): UseNavigationAnalyticsReturn {
  const { state, getCurrentEntity, getBreadcrumb } = useNavigationContext();

  // Track dialog open time for duration calculation
  const dialogOpenTimeRef = useRef<number | null>(null);
  const lastFromEntityRef = useRef<{ type: GRDCSEntityType; id: string } | null>(null);

  // Update lastFromEntity when current entity changes
  useEffect(() => {
    const current = getCurrentEntity();
    if (current) {
      lastFromEntityRef.current = { type: current.type, id: current.id };
    }
  }, [getCurrentEntity, state.navStack]);

  /**
   * Track entity view
   */
  const trackEntityView = useCallback(
    (type: GRDCSEntityType, id: string, name: string, tab?: string) => {
      recordEntityView(type, id, name, tab);
    },
    []
  );

  /**
   * Track navigation between entities
   */
  const trackNavigation = useCallback(
    (
      from: { type: GRDCSEntityType; id: string },
      to: { type: GRDCSEntityType; id: string },
      method: 'click' | 'back' | 'breadcrumb' | 'direct' | 'search' = 'click'
    ) => {
      recordEntityNavigation(from, to, method);
    },
    []
  );

  /**
   * Track module page visit
   */
  const trackModuleVisit = useCallback((module: string) => {
    recordModuleVisit(module);
  }, []);

  /**
   * Track back navigation
   */
  const trackBackNavigation = useCallback(() => {
    const breadcrumb = getBreadcrumb();
    recordBackNavigation(breadcrumb.length);

    // Also record as navigation if we have from/to
    if (breadcrumb.length >= 2) {
      const from = breadcrumb[breadcrumb.length - 1];
      const to = breadcrumb[breadcrumb.length - 2];
      recordEntityNavigation(
        { type: from.type, id: from.id },
        { type: to.type, id: to.id },
        'back'
      );
    }
  }, [getBreadcrumb]);

  /**
   * Track breadcrumb click
   */
  const trackBreadcrumbClick = useCallback(
    (targetType: GRDCSEntityType, targetId: string) => {
      const breadcrumb = getBreadcrumb();
      const targetIndex = breadcrumb.findIndex(
        b => b.type === targetType && b.id === targetId
      );
      recordBreadcrumbClick(targetType, targetId, targetIndex + 1);

      // Also record as navigation
      const current = getCurrentEntity();
      if (current) {
        recordEntityNavigation(
          { type: current.type, id: current.id },
          { type: targetType, id: targetId },
          'breadcrumb'
        );
      }
    },
    [getBreadcrumb, getCurrentEntity]
  );

  /**
   * Track broken link attempt
   */
  const trackBrokenLink = useCallback(
    (failedHref: string) => {
      const current = getCurrentEntity();
      recordBrokenLink(failedHref, current?.type, current?.id);
    },
    [getCurrentEntity]
  );

  /**
   * Track dead end (no forward navigation options)
   */
  const trackDeadEnd = useCallback(
    (type: GRDCSEntityType, id: string, name: string) => {
      recordDeadEnd(type, id, name);
    },
    []
  );

  /**
   * Track tab change
   */
  const trackTabChange = useCallback(
    (type: GRDCSEntityType, id: string, tab: string) => {
      recordTabChange(type, id, tab);
    },
    []
  );

  /**
   * Track dialog open
   */
  const trackDialogOpen = useCallback(
    (type: GRDCSEntityType, id: string, name: string) => {
      dialogOpenTimeRef.current = Date.now();
      recordDialogOpen(type, id, name);
    },
    []
  );

  /**
   * Track dialog close with duration
   */
  const trackDialogClose = useCallback(
    (type: GRDCSEntityType, id: string) => {
      const duration = dialogOpenTimeRef.current
        ? Date.now() - dialogOpenTimeRef.current
        : undefined;
      dialogOpenTimeRef.current = null;
      recordDialogClose(type, id, duration);
    },
    []
  );

  /**
   * Track linked entity click (from LinkedDataPanel)
   */
  const trackLinkedEntityClick = useCallback(
    (linkedEntity: GRDCSLinkedEntity) => {
      const current = getCurrentEntity();
      if (current) {
        recordLinkedEntityClick(
          current.type,
          current.id,
          linkedEntity.type,
          linkedEntity.id,
          linkedEntity.name
        );
      }
    },
    [getCurrentEntity]
  );

  /**
   * Get navigation summary
   */
  const getSummary = useCallback(() => {
    return getNavigationSummary();
  }, []);

  /**
   * Get recent events
   */
  const getRecent = useCallback((count: number = 50) => {
    return getRecentEvents(count);
  }, []);

  /**
   * Reset analytics
   */
  const reset = useCallback(() => {
    resetNavigationAnalytics();
  }, []);

  // Current entity from context
  const currentEntity = getCurrentEntity();
  const breadcrumb = getBreadcrumb();

  return {
    // Tracking methods
    trackEntityView,
    trackNavigation,
    trackModuleVisit,
    trackBackNavigation,
    trackBreadcrumbClick,
    trackBrokenLink,
    trackDeadEnd,
    trackTabChange,
    trackDialogOpen,
    trackDialogClose,
    trackLinkedEntityClick,

    // Summary access
    getSummary,
    getRecent,
    reset,

    // Session info
    sessionId: getSessionId(),
    sessionDuration: getSessionDuration(),

    // Current context
    currentEntity: currentEntity
      ? { type: currentEntity.type, id: currentEntity.id, label: currentEntity.label }
      : null,
    breadcrumbDepth: breadcrumb.length,
  };
}

export default useNavigationAnalytics;
