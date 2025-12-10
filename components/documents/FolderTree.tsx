'use client';

/**
 * FolderTree Component
 * Displays a navigable folder tree for document organization
 */

import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Home,
  Building2,
  Receipt,
  FileText,
  Landmark,
  PiggyBank,
  Calendar,
  Shield,
  FileCheck,
  Files,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentCategory } from '@/lib/documents/types';

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  icon?: React.ElementType;
  children?: FolderNode[];
  count?: number;
  type: 'root' | 'category' | 'fiscal-year' | 'entity';
}

// Category to icon mapping
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  CONTRACT: FileCheck,
  STATEMENT: FileText,
  RECEIPT: Receipt,
  TAX: Calendar,
  PDS: FileText,
  VALUATION: Building2,
  INSURANCE: Shield,
  MORTGAGE: Landmark,
  LEASE: FileText,
  INVOICE: Receipt,
  OTHER: Files,
};

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
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
};

interface FolderTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  documentCounts: Record<string, number>;
  className?: string;
}

export function FolderTree({
  currentPath,
  onNavigate,
  documentCounts,
  className,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['/', '/categories'])
  );

  // Build folder structure
  const folders: FolderNode[] = [
    {
      id: 'root',
      name: 'All Documents',
      path: '/',
      icon: Home,
      type: 'root',
      count: Object.values(documentCounts).reduce((a, b) => a + b, 0),
    },
    {
      id: 'categories',
      name: 'By Category',
      path: '/categories',
      icon: Folder,
      type: 'root',
      children: Object.values(DocumentCategory).map((cat) => ({
        id: `cat-${cat}`,
        name: CATEGORY_NAMES[cat] || cat,
        path: `/categories/${cat}`,
        icon: CATEGORY_ICONS[cat] || Files,
        type: 'category' as const,
        count: documentCounts[cat] || 0,
      })),
    },
    {
      id: 'fiscal-year',
      name: 'By Financial Year',
      path: '/fiscal-year',
      icon: Calendar,
      type: 'root',
      children: generateFiscalYears(documentCounts),
    },
    {
      id: 'entities',
      name: 'By Entity',
      path: '/entities',
      icon: Building2,
      type: 'root',
      children: [
        {
          id: 'entity-properties',
          name: 'Properties',
          path: '/entities/PROPERTY',
          icon: Building2,
          type: 'entity' as const,
          count: documentCounts['entity:PROPERTY'] || 0,
        },
        {
          id: 'entity-loans',
          name: 'Loans',
          path: '/entities/LOAN',
          icon: Landmark,
          type: 'entity' as const,
          count: documentCounts['entity:LOAN'] || 0,
        },
        {
          id: 'entity-expenses',
          name: 'Expenses',
          path: '/entities/EXPENSE',
          icon: Receipt,
          type: 'entity' as const,
          count: documentCounts['entity:EXPENSE'] || 0,
        },
        {
          id: 'entity-income',
          name: 'Income',
          path: '/entities/INCOME',
          icon: PiggyBank,
          type: 'entity' as const,
          count: documentCounts['entity:INCOME'] || 0,
        },
      ],
    },
  ];

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderFolder = (folder: FolderNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.path);
    const isActive = currentPath === folder.path;
    const hasChildren = folder.children && folder.children.length > 0;
    const Icon = folder.icon || Folder;

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleFolder(folder.path);
            }
            onNavigate(folder.path);
          }}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
            'hover:bg-muted',
            isActive && 'bg-primary/10 text-primary font-medium',
            !isActive && 'text-foreground'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          ) : (
            <span className="w-4" />
          )}
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-4 w-4 text-yellow-500" />
          ) : (
            <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
          )}
          <span className="flex-1 text-left truncate">{folder.name}</span>
          {folder.count !== undefined && folder.count > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {folder.count}
            </span>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div>
            {folder.children!.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-1', className)}>
      {folders.map((folder) => renderFolder(folder))}
    </div>
  );
}

// Generate fiscal year folders (Australian FY: July - June)
function generateFiscalYears(counts: Record<string, number>): FolderNode[] {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11

  // Australian FY: July (month 6) to June (month 5)
  const currentFY = currentMonth >= 6 ? currentYear : currentYear - 1;

  const years: FolderNode[] = [];
  for (let i = 0; i < 5; i++) {
    const fyStart = currentFY - i;
    const fyEnd = fyStart + 1;
    const fyLabel = `FY${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;
    years.push({
      id: `fy-${fyStart}`,
      name: fyLabel,
      path: `/fiscal-year/${fyStart}`,
      icon: Calendar,
      type: 'fiscal-year',
      count: counts[`fy:${fyStart}`] || 0,
    });
  }
  return years;
}

export default FolderTree;
