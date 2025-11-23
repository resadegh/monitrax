'use client';

/**
 * DEV NAVIGATION ANALYTICS PANEL
 * Phase 9 Task 9.6 - Navigation Analytics (Lightweight Telemetry)
 *
 * Feature-flagged development panel for visualizing navigation analytics.
 * Only renders when NEXT_PUBLIC_DEV_ANALYTICS_PANEL=true
 *
 * Shows:
 * - Session info (ID, duration)
 * - Top navigation paths
 * - Most visited modules
 * - Entity hops per session
 * - Dead-end attempts
 * - Breadcrumb depth averages
 * - Recent events log
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigationAnalytics } from '@/hooks/useNavigationAnalytics';
import { NavigationSummary, NavigationEvent, ModuleVisitStats } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  BarChart3,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  Navigation,
  MousePointer,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// FEATURE FLAG CHECK
// =============================================================================

const isDevPanelEnabled = process.env.NEXT_PUBLIC_DEV_ANALYTICS_PANEL === 'true';

// =============================================================================
// TYPES
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  variant?: 'default' | 'warning' | 'success';
}

interface EventRowProps {
  event: NavigationEvent;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({ title, value, icon, description, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-1',
        variant === 'warning' && 'border-yellow-500/50 bg-yellow-500/10',
        variant === 'success' && 'border-green-500/50 bg-green-500/10',
        variant === 'default' && 'border-border bg-card'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function EventRow({ event }: EventRowProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'entity_view':
        return <Activity className="h-3 w-3" />;
      case 'entity_navigation':
        return <Navigation className="h-3 w-3" />;
      case 'module_visit':
        return <Layers className="h-3 w-3" />;
      case 'back_navigation':
        return <ArrowLeft className="h-3 w-3" />;
      case 'breadcrumb_click':
        return <MousePointer className="h-3 w-3" />;
      case 'broken_link':
      case 'dead_end':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  const getEventLabel = (event: NavigationEvent) => {
    switch (event.type) {
      case 'entity_view':
        return `View: ${event.entityType}/${event.entityId?.slice(0, 6) || ''}`;
      case 'entity_navigation':
        return `Nav: ${event.fromEntityType}→${event.toEntityType}`;
      case 'module_visit':
        return `Module: ${event.toModule}`;
      case 'back_navigation':
        return `Back (depth: ${event.breadcrumbDepth})`;
      case 'breadcrumb_click':
        return `Breadcrumb: ${event.toEntityType}`;
      case 'broken_link':
        return `Broken: ${event.failedHref?.slice(0, 20)}...`;
      case 'dead_end':
        return `Dead end: ${event.entityType}`;
      case 'tab_change':
        return `Tab: ${event.tab}`;
      case 'dialog_open':
        return `Dialog open: ${event.entityType}`;
      case 'dialog_close':
        return `Dialog close: ${event.entityType}`;
      case 'linked_entity_click':
        return `Link click: ${event.toEntityType}`;
      default:
        return event.type;
    }
  };

  const timestamp = new Date(event.timestamp);
  const timeStr = timestamp.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex items-center gap-2 py-1 text-xs border-b border-border/50 last:border-0">
      {getEventIcon(event.type)}
      <span className="text-muted-foreground w-16 flex-shrink-0">{timeStr}</span>
      <span className="truncate">{getEventLabel(event)}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DevNavigationAnalyticsPanel() {
  // Don't render if feature flag is disabled
  if (!isDevPanelEnabled) {
    return null;
  }

  return <DevNavigationAnalyticsPanelInner />;
}

function DevNavigationAnalyticsPanelInner() {
  const analytics = useNavigationAnalytics();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [summary, setSummary] = useState<NavigationSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<NavigationEvent[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refresh data
  const refreshData = useCallback(() => {
    setSummary(analytics.getSummary());
    setRecentEvents(analytics.getRecent(20));
  }, [analytics]);

  // Auto-refresh every 2 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  // Manual refresh
  const handleRefresh = () => {
    refreshData();
  };

  // Reset analytics
  const handleReset = () => {
    analytics.reset();
    refreshData();
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  // Helper to get module visit count
  const getModuleVisitCount = (moduleVisits: Record<string, ModuleVisitStats>): number => {
    return Object.values(moduleVisits).reduce((sum, stats) => sum + stats.visitCount, 0);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          className="bg-background shadow-lg"
          onClick={() => setIsMinimized(false)}
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          Nav Analytics
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-xl border-2">
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Navigation Analytics
          <Badge variant="secondary" className="text-[10px] px-1">
            DEV
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className={cn('h-3 w-3', autoRefresh && 'animate-spin')} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-3">
        {/* Session Info */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Session: {analytics.sessionId.slice(0, 8)}...
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(analytics.sessionDuration)}
          </span>
        </div>

        {/* Current Entity */}
        {analytics.currentEntity && (
          <div className="text-xs bg-muted/50 rounded p-2">
            <span className="text-muted-foreground">Current: </span>
            <Badge variant="outline" className="text-[10px]">
              {analytics.currentEntity.type}
            </Badge>{' '}
            <span className="font-medium">{analytics.currentEntity.label}</span>
            <span className="text-muted-foreground ml-1">
              (depth: {analytics.breadcrumbDepth})
            </span>
          </div>
        )}

        {/* Stats Grid */}
        {summary && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              title="Total Events"
              value={summary.totalEvents}
              icon={<Activity className="h-3 w-3" />}
            />
            <StatCard
              title="Entities Viewed"
              value={summary.entitiesViewed}
              icon={<Navigation className="h-3 w-3" />}
            />
            <StatCard
              title="Navigations"
              value={summary.totalNavigations}
              icon={<MousePointer className="h-3 w-3" />}
            />
            <StatCard
              title="Back Nav"
              value={summary.backNavigationCount}
              icon={<ArrowLeft className="h-3 w-3" />}
            />
            <StatCard
              title="Broken Links"
              value={summary.brokenLinkAttempts}
              icon={<AlertTriangle className="h-3 w-3" />}
              variant={summary.brokenLinkAttempts > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Dead Ends"
              value={summary.deadEndEncounters}
              icon={<AlertTriangle className="h-3 w-3" />}
              variant={summary.deadEndEncounters > 0 ? 'warning' : 'default'}
            />
          </div>
        )}

        {/* Module Visits */}
        {summary && Object.keys(summary.moduleVisits).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Module Visits</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(summary.moduleVisits)
                .sort(([, a], [, b]) => b.visitCount - a.visitCount)
                .slice(0, 6)
                .map(([module, stats]) => (
                  <Badge key={module} variant="secondary" className="text-[10px]">
                    {module}: {stats.visitCount}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <>
            {/* Entity Type Stats */}
            {summary && Object.keys(summary.entityViewsByType).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Entity Types Viewed</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(summary.entityViewsByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-[10px]">
                        {type}: {count}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Averages */}
            {summary && (
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  title="Avg Breadcrumb Depth"
                  value={summary.averageBreadcrumbDepth.toFixed(1)}
                  icon={<Layers className="h-3 w-3" />}
                />
                <StatCard
                  title="Nav Efficiency"
                  value={`${summary.navigationEfficiency}%`}
                  icon={<Activity className="h-3 w-3" />}
                  variant={summary.navigationEfficiency >= 80 ? 'success' : 'default'}
                />
              </div>
            )}

            {/* Recent Events */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Recent Events</p>
              <div className="h-32 rounded border bg-muted/30 p-2 overflow-y-auto">
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No events recorded yet
                  </p>
                ) : (
                  recentEvents.map((event) => <EventRow key={event.id} event={event} />)
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-7"
                onClick={handleReset}
              >
                Reset
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default DevNavigationAnalyticsPanel;
