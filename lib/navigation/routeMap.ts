/**
 * CMNF Route Map - Single Source of Truth
 * Phase 8 Task 10.8 - Cross-Module Navigation Framework
 *
 * All entity URLs must use this map. No hardcoded paths allowed.
 */

import { GRDCSEntityType } from '@/lib/grdcs';

export interface RouteConfig {
  basePath: string;
  dialogParam: string;
  defaultTab: string;
}

/**
 * Route configuration for each entity type
 */
export const ROUTE_MAP: Record<GRDCSEntityType, RouteConfig> = {
  property: {
    basePath: '/dashboard/properties',
    dialogParam: 'id',
    defaultTab: 'details',
  },
  loan: {
    basePath: '/dashboard/loans',
    dialogParam: 'id',
    defaultTab: 'overview',
  },
  income: {
    basePath: '/dashboard/income',
    dialogParam: 'id',
    defaultTab: 'details',
  },
  expense: {
    basePath: '/dashboard/expenses',
    dialogParam: 'id',
    defaultTab: 'details',
  },
  account: {
    basePath: '/dashboard/accounts',
    dialogParam: 'id',
    defaultTab: 'details',
  },
  investmentAccount: {
    basePath: '/dashboard/investments/accounts',
    dialogParam: 'id',
    defaultTab: 'overview',
  },
  investmentHolding: {
    basePath: '/dashboard/investments/holdings',
    dialogParam: 'id',
    defaultTab: 'details',
  },
  investmentTransaction: {
    basePath: '/dashboard/investments/transactions',
    dialogParam: 'id',
    defaultTab: 'details',
  },
  depreciationSchedule: {
    basePath: '/dashboard/properties',
    dialogParam: 'depId',
    defaultTab: 'depreciation',
  },
};

/**
 * Generate href for an entity using the route map
 */
export function getEntityHref(type: GRDCSEntityType, id: string): string {
  const config = ROUTE_MAP[type];
  return `${config.basePath}?${config.dialogParam}=${id}`;
}

/**
 * Parse href to extract entity type and id
 */
export function parseEntityHref(href: string): { type: GRDCSEntityType; id: string } | null {
  try {
    // Handle relative URLs
    const url = new URL(href, 'http://localhost');
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    // Find matching route
    for (const [type, config] of Object.entries(ROUTE_MAP)) {
      if (pathname === config.basePath || pathname.startsWith(config.basePath)) {
        const id = searchParams.get(config.dialogParam);
        if (id) {
          return { type: type as GRDCSEntityType, id };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get display name for entity type
 */
export function getEntityTypeDisplayName(type: GRDCSEntityType): string {
  const displayNames: Record<GRDCSEntityType, string> = {
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
  return displayNames[type] || type;
}

/**
 * Get icon name for entity type (for breadcrumbs)
 */
export function getEntityTypeIcon(type: GRDCSEntityType): string {
  const icons: Record<GRDCSEntityType, string> = {
    property: 'Building2',
    loan: 'Landmark',
    income: 'TrendingUp',
    expense: 'TrendingDown',
    account: 'Wallet',
    investmentAccount: 'Briefcase',
    investmentHolding: 'PieChart',
    investmentTransaction: 'ArrowLeftRight',
    depreciationSchedule: 'Calculator',
  };
  return icons[type] || 'Circle';
}
