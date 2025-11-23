'use client';

/**
 * INSIGHT LIST
 * Phase 9 Task 9.5 - Unified UI Components for Insights & Health
 *
 * Displays a filterable, sortable list of insights with:
 * - Severity filtering
 * - Category filtering
 * - Summary header
 * - Pagination support
 * - Empty state handling
 */

import React, { useState, useMemo } from 'react';
import {
  Filter,
  SortAsc,
  SortDesc,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InsightCard } from './InsightCard';
import { InsightItem, InsightSeverity, InsightsSummary } from '@/lib/sync/types';
import { GRDCSEntityType } from '@/lib/grdcs';

// =============================================================================
// TYPES
// =============================================================================

type SortOrder = 'severity' | 'category' | 'entities';
type FilterSeverity = InsightSeverity | 'all';
type FilterCategory = string | 'all';

// =============================================================================
// COMPONENT
// =============================================================================

export interface InsightListProps {
  /** List of insights to display */
  insights: InsightItem[];
  /** Summary counts */
  summary?: InsightsSummary;
  /** Title for the list */
  title?: string;
  /** Show filter controls */
  showFilters?: boolean;
  /** Show summary header */
  showSummary?: boolean;
  /** Use compact card style */
  compact?: boolean;
  /** Maximum items to show before pagination */
  pageSize?: number;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Callback when entity is clicked */
  onEntityClick?: (entityType: GRDCSEntityType, entityId: string, entityName: string) => void;
  /** Callback when fix action is clicked */
  onFixClick?: (insight: InsightItem) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
}

export function InsightList({
  insights,
  summary,
  title = 'Insights',
  showFilters = true,
  showSummary = true,
  compact = false,
  pageSize = 10,
  showRefresh = false,
  onRefresh,
  onEntityClick,
  onFixClick,
  isLoading = false,
  className = '',
}: InsightListProps) {
  // Filter and sort state
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('severity');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(insights.map(i => i.category));
    return Array.from(cats).sort();
  }, [insights]);

  // Filter and sort insights
  const filteredInsights = useMemo(() => {
    let result = [...insights];

    // Apply severity filter
    if (severityFilter !== 'all') {
      result = result.filter(i => i.severity === severityFilter);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      result = result.filter(i => i.category === categoryFilter);
    }

    // Sort
    const severityOrder: Record<InsightSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortOrder) {
        case 'severity':
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'entities':
          comparison = b.affectedEntities.length - a.affectedEntities.length;
          break;
      }
      return sortAsc ? -comparison : comparison;
    });

    return result;
  }, [insights, severityFilter, categoryFilter, sortOrder, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredInsights.length / pageSize);
  const paginatedInsights = filteredInsights.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [severityFilter, categoryFilter]);

  // Calculate summary if not provided
  const displaySummary = summary || {
    criticalCount: insights.filter(i => i.severity === 'critical').length,
    highCount: insights.filter(i => i.severity === 'high').length,
    mediumCount: insights.filter(i => i.severity === 'medium').length,
    lowCount: insights.filter(i => i.severity === 'low').length,
    totalCount: insights.length,
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
            {displaySummary.totalCount > 0 && (
              <Badge variant="secondary">{displaySummary.totalCount}</Badge>
            )}
          </CardTitle>
          {showRefresh && onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>

        {/* Summary badges */}
        {showSummary && displaySummary.totalCount > 0 && (
          <div className="flex gap-2 mt-2">
            {displaySummary.criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {displaySummary.criticalCount} Critical
              </Badge>
            )}
            {displaySummary.highCount > 0 && (
              <Badge variant="destructive" className="text-xs bg-orange-500">
                {displaySummary.highCount} High
              </Badge>
            )}
            {displaySummary.mediumCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {displaySummary.mediumCount} Medium
              </Badge>
            )}
            {displaySummary.lowCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {displaySummary.lowCount} Low
              </Badge>
            )}
          </div>
        )}

        {/* Filters */}
        {showFilters && insights.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as FilterSeverity)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat} className="capitalize">
                    {cat.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">By Severity</SelectItem>
                <SelectItem value="category">By Category</SelectItem>
                <SelectItem value="entities">By Entities</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSortAsc(!sortAsc)}
            >
              {sortAsc ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            {(severityFilter !== 'all' || categoryFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSeverityFilter('all');
                  setCategoryFilter('all');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredInsights.length === 0 && (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {insights.length === 0
                ? 'No insights available'
                : 'No insights match your filters'}
            </p>
          </div>
        )}

        {/* Insight cards */}
        {!isLoading && paginatedInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            compact={compact}
            showEntities={!compact}
            showFix={!compact}
            onEntityClick={onEntityClick}
            onFixClick={onFixClick}
          />
        ))}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredInsights.length)} of {filteredInsights.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InsightList;
