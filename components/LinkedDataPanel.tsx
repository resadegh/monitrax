'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Home,
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  PieChart,
  Receipt,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Link2Off,
  ChevronRight,
  Plus,
  Info,
} from 'lucide-react';
import type { GRDCSLinkedEntity, GRDCSMissingLink, GRDCSEntityType } from '@/lib/grdcs';

// Icon mapping for entity types
const ENTITY_ICONS: Record<GRDCSEntityType, React.ComponentType<{ className?: string }>> = {
  property: Home,
  loan: Banknote,
  income: TrendingUp,
  expense: TrendingDown,
  account: Wallet,
  investmentAccount: BarChart3,
  investmentHolding: PieChart,
  investmentTransaction: Receipt,
  depreciationSchedule: Calculator,
};

// Color mapping for entity types
const ENTITY_COLORS: Record<GRDCSEntityType, string> = {
  property: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  loan: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
  income: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  expense: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  account: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
  investmentAccount: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30',
  investmentHolding: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30',
  investmentTransaction: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30',
  depreciationSchedule: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
};

// Display names for entity types
const ENTITY_NAMES: Record<GRDCSEntityType, string> = {
  property: 'Property',
  loan: 'Loan',
  income: 'Income',
  expense: 'Expense',
  account: 'Account',
  investmentAccount: 'Investment Account',
  investmentHolding: 'Holding',
  investmentTransaction: 'Transaction',
  depreciationSchedule: 'Depreciation',
};

// Add link routes for each entity type
const ADD_LINK_ROUTES: Record<GRDCSEntityType, string> = {
  property: '/dashboard/properties',
  loan: '/dashboard/loans',
  income: '/dashboard/income',
  expense: '/dashboard/expenses',
  account: '/dashboard/accounts',
  investmentAccount: '/dashboard/investments/accounts',
  investmentHolding: '/dashboard/investments/holdings',
  investmentTransaction: '/dashboard/investments/transactions',
  depreciationSchedule: '/dashboard/properties',
};

interface LinkedDataPanelProps {
  linkedEntities: GRDCSLinkedEntity[];
  missingLinks: GRDCSMissingLink[];
  entityType: GRDCSEntityType;
  entityName: string;
  showHealthScore?: boolean;
  compact?: boolean;
}

/**
 * LinkedDataPanel - Universal UI component for displaying linked entities
 *
 * Features:
 * - Related entities list with icons
 * - One-click navigation across modules
 * - Missing-link warnings
 * - Relationship health score
 * - Value summaries
 * - Empty-state suggestions
 */
export function LinkedDataPanel({
  linkedEntities,
  missingLinks,
  entityType,
  entityName,
  showHealthScore = true,
  compact = false,
}: LinkedDataPanelProps) {
  // Calculate health score
  const totalPossibleLinks = linkedEntities.length + missingLinks.length;
  const healthScore = totalPossibleLinks > 0
    ? Math.round((linkedEntities.length / totalPossibleLinks) * 100)
    : 100;

  // Group linked entities by type
  const groupedEntities = linkedEntities.reduce((acc, entity) => {
    if (!acc[entity.type]) {
      acc[entity.type] = [];
    }
    acc[entity.type].push(entity);
    return acc;
  }, {} as Record<GRDCSEntityType, GRDCSLinkedEntity[]>);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Empty state
  if (linkedEntities.length === 0 && missingLinks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-3 rounded-full bg-muted mb-4">
            <Link2Off className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">No Linked Data</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            This {ENTITY_NAMES[entityType].toLowerCase()} has no linked entities yet.
            Link related data for better insights and tracking.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {entityType === 'property' && (
              <>
                <Link href="/dashboard/loans">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add Loan
                  </Button>
                </Link>
                <Link href="/dashboard/income">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add Income
                  </Button>
                </Link>
              </>
            )}
            {entityType === 'loan' && (
              <Link href="/dashboard/properties">
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3 w-3" />
                  Link Property
                </Button>
              </Link>
            )}
            {entityType === 'investmentAccount' && (
              <Link href="/dashboard/investments/holdings">
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3 w-3" />
                  Add Holding
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Compact Health Score */}
        {showHealthScore && (
          <div className="flex items-center gap-3 text-sm">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Linkage:</span>
            <span className={`font-semibold ${getHealthColor(healthScore)}`}>
              {healthScore}%
            </span>
            <span className="text-muted-foreground">
              ({linkedEntities.length} linked)
            </span>
          </div>
        )}

        {/* Compact Entity List */}
        <div className="flex flex-wrap gap-2">
          {linkedEntities.slice(0, 5).map((entity) => {
            const Icon = ENTITY_ICONS[entity.type];
            return (
              <Link key={entity.id} href={entity.href}>
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-secondary/80"
                >
                  <Icon className="h-3 w-3" />
                  {entity.name}
                </Badge>
              </Link>
            );
          })}
          {linkedEntities.length > 5 && (
            <Badge variant="outline">+{linkedEntities.length - 5} more</Badge>
          )}
        </div>

        {/* Compact Missing Links */}
        {missingLinks.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span>{missingLinks.length} missing link{missingLinks.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health Score Card */}
      {showHealthScore && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Relationship Health
              </CardTitle>
              <span className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
                {healthScore}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress
              value={healthScore}
              className="h-2"
              style={{
                ['--progress-background' as string]: getHealthProgressColor(healthScore),
              }}
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{linkedEntities.length} linked entities</span>
              <span>{missingLinks.length} missing links</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Entities by Type */}
      {Object.entries(groupedEntities).map(([type, entities]) => {
        const entityType = type as GRDCSEntityType;
        const Icon = ENTITY_ICONS[entityType];
        const colorClass = ENTITY_COLORS[entityType];

        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className={`p-1.5 rounded ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {ENTITY_NAMES[entityType]}
                  <Badge variant="secondary" className="ml-1">
                    {entities.length}
                  </Badge>
                </CardTitle>
                <Link href={ADD_LINK_ROUTES[entityType]}>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <Plus className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {entities.map((entity) => (
                  <Link
                    key={entity.id}
                    href={entity.href}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary">
                        {entity.name}
                      </p>
                      {entity.summary && (
                        <p className="text-xs text-muted-foreground truncate">
                          {entity.summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {entity.value !== undefined && (
                        <span className="text-sm font-semibold">
                          {formatCurrency(entity.value)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Missing Links Warning */}
      {missingLinks.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Missing Links
              <Badge variant="outline" className="ml-1 border-amber-300 text-amber-700">
                {missingLinks.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-amber-600/80 dark:text-amber-400/80">
              Complete these links for better insights and accurate calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {missingLinks.map((missing, index) => {
                const Icon = ENTITY_ICONS[missing.type];
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20"
                  >
                    <div className="p-1.5 rounded bg-amber-200/50 dark:bg-amber-800/50">
                      <Icon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        {missing.reason}
                      </p>
                      {missing.suggestedAction && (
                        <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
                          {missing.suggestedAction}
                        </p>
                      )}
                    </div>
                    <Link href={ADD_LINK_ROUTES[missing.type]}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          <span>
            Showing all linked data for &quot;{entityName}&quot;
          </span>
        </div>
        <div className="flex items-center gap-1">
          {healthScore === 100 ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span className="text-green-600">Fully linked</span>
            </>
          ) : (
            <>
              <Link2 className="h-3 w-3" />
              <span>{linkedEntities.length} of {totalPossibleLinks} linked</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LinkedDataPanel;
