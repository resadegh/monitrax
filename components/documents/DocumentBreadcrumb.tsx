'use client';

/**
 * DocumentBreadcrumb Component
 * Shows navigation breadcrumb for document folders
 */

import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface DocumentBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  className?: string;
}

// Path segment to display name mapping
const PATH_NAMES: Record<string, string> = {
  categories: 'Categories',
  'fiscal-year': 'Financial Year',
  entities: 'Entities',
  CONTRACT: 'Contracts',
  STATEMENT: 'Statements',
  RECEIPT: 'Receipts',
  TAX: 'Tax Documents',
  PDS: 'Product Disclosures',
  VALUATION: 'Valuations',
  INSURANCE: 'Insurance',
  MORTGAGE: 'Mortgage',
  LEASE: 'Leases',
  INVOICE: 'Invoices',
  OTHER: 'Other',
  PROPERTY: 'Properties',
  LOAN: 'Loans',
  EXPENSE: 'Expenses',
  INCOME: 'Income',
};

export function DocumentBreadcrumb({
  path,
  onNavigate,
  className,
}: DocumentBreadcrumbProps) {
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Documents', path: '/' },
    ];

    if (path === '/') return items;

    const segments = path.split('/').filter(Boolean);
    let currentPath = '';

    segments.forEach((segment) => {
      currentPath += `/${segment}`;

      // Handle fiscal year display
      if (segment.match(/^\d{4}$/)) {
        const year = parseInt(segment);
        items.push({
          label: `FY${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`,
          path: currentPath,
        });
      } else {
        items.push({
          label: PATH_NAMES[segment] || segment,
          path: currentPath,
        });
      }
    });

    return items;
  };

  const breadcrumbs = buildBreadcrumbs();

  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {breadcrumbs.map((item, index) => (
        <div key={item.path} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {index === 0 ? (
            <button
              onClick={() => onNavigate(item.path)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ) : index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <button
              onClick={() => onNavigate(item.path)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}

export default DocumentBreadcrumb;
