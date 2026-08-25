'use client';

/**
 * FolderTree Component
 * Displays a navigable folder tree for document organization with entity drill-down
 */

import { useState, useMemo } from 'react';
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
  Banknote,
  TrendingUp,
  Car,
  Scale,
  CheckCircle2,
  XCircle,
  HelpCircle,
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
  type: 'root' | 'category' | 'fiscal-year' | 'entity' | 'entity-item';
}

export interface EntityInfo {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  parentName?: string;
  parentType?: string;
}

export interface UserEntities {
  properties: EntityInfo[];
  loans: EntityInfo[];
  expenses: EntityInfo[];
  income: EntityInfo[];
  accounts: EntityInfo[];
  investmentAccounts: EntityInfo[];
  assets?: EntityInfo[];
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

// Entity type to icon mapping
const ENTITY_ICONS: Record<string, React.ElementType> = {
  PROPERTY: Building2,
  LOAN: Landmark,
  EXPENSE: Receipt,
  INCOME: PiggyBank,
  ACCOUNT: Banknote,
  INVESTMENT_ACCOUNT: TrendingUp,
  ASSET: Car,
};

interface FolderTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  documentCounts: Record<string, number>;
  entities?: UserEntities;
  className?: string;
}

export function FolderTree({
  currentPath,
  onNavigate,
  documentCounts,
  entities,
  className,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['/', '/categories'])
  );

  // Build entity children with counts
  const buildEntityChildren = useMemo(() => {
    if (!entities) return null;

    const propertyChildren: FolderNode[] = entities.properties.map((prop) => ({
      id: `prop-${prop.id}`,
      name: prop.name,
      path: `/entities/PROPERTY/${prop.id}`,
      icon: Building2,
      type: 'entity-item' as const,
      count: documentCounts[`entity:PROPERTY:${prop.id}`] || 0,
    }));

    const loanChildren: FolderNode[] = entities.loans.map((loan) => ({
      id: `loan-${loan.id}`,
      name: loan.name,
      path: `/entities/LOAN/${loan.id}`,
      icon: Landmark,
      type: 'entity-item' as const,
      count: documentCounts[`entity:LOAN:${loan.id}`] || 0,
    }));

    // Group expenses by property
    const expensesByProperty: Record<string, EntityInfo[]> = {};
    const standaloneExpenses: EntityInfo[] = [];
    entities.expenses.forEach((exp) => {
      if (exp.parentId) {
        if (!expensesByProperty[exp.parentId]) {
          expensesByProperty[exp.parentId] = [];
        }
        expensesByProperty[exp.parentId].push(exp);
      } else {
        standaloneExpenses.push(exp);
      }
    });

    const expenseChildren: FolderNode[] = standaloneExpenses.map((exp) => ({
      id: `exp-${exp.id}`,
      name: exp.name,
      path: `/entities/EXPENSE/${exp.id}`,
      icon: Receipt,
      type: 'entity-item' as const,
      count: documentCounts[`entity:EXPENSE:${exp.id}`] || 0,
    }));

    // Group income by property
    const incomeByProperty: Record<string, EntityInfo[]> = {};
    const standaloneIncome: EntityInfo[] = [];
    entities.income.forEach((inc) => {
      if (inc.parentId) {
        if (!incomeByProperty[inc.parentId]) {
          incomeByProperty[inc.parentId] = [];
        }
        incomeByProperty[inc.parentId].push(inc);
      } else {
        standaloneIncome.push(inc);
      }
    });

    const incomeChildren: FolderNode[] = standaloneIncome.map((inc) => ({
      id: `inc-${inc.id}`,
      name: inc.name,
      path: `/entities/INCOME/${inc.id}`,
      icon: PiggyBank,
      type: 'entity-item' as const,
      count: documentCounts[`entity:INCOME:${inc.id}`] || 0,
    }));

    const accountChildren: FolderNode[] = entities.accounts.map((acc) => ({
      id: `acc-${acc.id}`,
      name: acc.name,
      path: `/entities/ACCOUNT/${acc.id}`,
      icon: Banknote,
      type: 'entity-item' as const,
      count: documentCounts[`entity:ACCOUNT:${acc.id}`] || 0,
    }));

    const investmentChildren: FolderNode[] = entities.investmentAccounts.map((ia) => ({
      id: `inv-${ia.id}`,
      name: ia.name,
      path: `/entities/INVESTMENT_ACCOUNT/${ia.id}`,
      icon: TrendingUp,
      type: 'entity-item' as const,
      count: documentCounts[`entity:INVESTMENT_ACCOUNT:${ia.id}`] || 0,
    }));

    // Build property nodes with nested expenses and income
    const propertyNodesWithNested: FolderNode[] = entities.properties.map((prop) => {
      const children: FolderNode[] = [];

      // Add expenses for this property
      const propExpenses = expensesByProperty[prop.id] || [];
      if (propExpenses.length > 0) {
        children.push({
          id: `prop-${prop.id}-expenses`,
          name: 'Expenses',
          path: `/entities/PROPERTY/${prop.id}/expenses`,
          icon: Receipt,
          type: 'entity' as const,
          count: propExpenses.reduce((sum, e) => sum + (documentCounts[`entity:EXPENSE:${e.id}`] || 0), 0),
          children: propExpenses.map((exp) => ({
            id: `exp-${exp.id}`,
            name: exp.name,
            path: `/entities/EXPENSE/${exp.id}`,
            icon: Receipt,
            type: 'entity-item' as const,
            count: documentCounts[`entity:EXPENSE:${exp.id}`] || 0,
          })),
        });
      }

      // Add income for this property
      const propIncome = incomeByProperty[prop.id] || [];
      if (propIncome.length > 0) {
        children.push({
          id: `prop-${prop.id}-income`,
          name: 'Income',
          path: `/entities/PROPERTY/${prop.id}/income`,
          icon: PiggyBank,
          type: 'entity' as const,
          count: propIncome.reduce((sum, i) => sum + (documentCounts[`entity:INCOME:${i.id}`] || 0), 0),
          children: propIncome.map((inc) => ({
            id: `inc-${inc.id}`,
            name: inc.name,
            path: `/entities/INCOME/${inc.id}`,
            icon: PiggyBank,
            type: 'entity-item' as const,
            count: documentCounts[`entity:INCOME:${inc.id}`] || 0,
          })),
        });
      }

      // Add loans for this property
      const propLoans = entities.loans.filter(l => l.parentId === prop.id);
      if (propLoans.length > 0) {
        children.push({
          id: `prop-${prop.id}-loans`,
          name: 'Loans',
          path: `/entities/PROPERTY/${prop.id}/loans`,
          icon: Landmark,
          type: 'entity' as const,
          count: propLoans.reduce((sum, l) => sum + (documentCounts[`entity:LOAN:${l.id}`] || 0), 0),
          children: propLoans.map((loan) => ({
            id: `loan-${loan.id}`,
            name: loan.name,
            path: `/entities/LOAN/${loan.id}`,
            icon: Landmark,
            type: 'entity-item' as const,
            count: documentCounts[`entity:LOAN:${loan.id}`] || 0,
          })),
        });
      }

      return {
        id: `prop-${prop.id}`,
        name: prop.name,
        path: `/entities/PROPERTY/${prop.id}`,
        icon: Building2,
        type: 'entity-item' as const,
        count: documentCounts[`entity:PROPERTY:${prop.id}`] || 0,
        children: children.length > 0 ? children : undefined,
      };
    });

    // Standalone loans (not linked to property)
    const standaloneLoans = entities.loans.filter(l => !l.parentId);
    const standaloneLoanChildren: FolderNode[] = standaloneLoans.map((loan) => ({
      id: `loan-${loan.id}`,
      name: loan.name,
      path: `/entities/LOAN/${loan.id}`,
      icon: Landmark,
      type: 'entity-item' as const,
      count: documentCounts[`entity:LOAN:${loan.id}`] || 0,
    }));

    // Assets (Phase 21 — e.g. a vehicle). A scanned receipt linked to an asset
    // files here instead of under generic Expenses.
    const assetChildren: FolderNode[] = (entities.assets ?? []).map((asset) => ({
      id: `asset-${asset.id}`,
      name: asset.name,
      path: `/entities/ASSET/${asset.id}`,
      icon: Car,
      type: 'entity-item' as const,
      count: documentCounts[`entity:ASSET:${asset.id}`] || 0,
    }));

    return {
      properties: propertyNodesWithNested,
      loans: standaloneLoanChildren,
      expenses: expenseChildren,
      income: incomeChildren,
      accounts: accountChildren,
      investments: investmentChildren,
      assets: assetChildren,
    };
  }, [entities, documentCounts]);

  // Build folder structure
  const folders: FolderNode[] = useMemo(() => {
    // MON-190: read THE total the page produces from the same documents list
    // the hero renders. The old reduce summed every non-entity/non-fy bucket —
    // which was the category buckets AND the tax-status buckets, each covering
    // every document once — so 'All Documents' showed exactly 2× (+2/upload).
    const baseTotal = documentCounts['total'] ?? 0;

    const result: FolderNode[] = [
      {
        id: 'root',
        name: 'All Documents',
        path: '/',
        icon: Home,
        type: 'root',
        count: baseTotal,
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
      // Phase 38 PR 4 — Tax-status lens (Deductible / Non-deductible /
      // Untagged). The 4th lens accountants asked for. Counts derived
      // client-side from `expenseTaxMap` in the documents page (see
      // `getDocumentTaxStatus`). Folder structure mirrors the existing
      // category/fiscal-year pattern — no special-casing.
      {
        id: 'tax-status',
        name: 'By Tax Status',
        path: '/tax-status',
        icon: Scale,
        type: 'root',
        children: [
          {
            id: 'tax-deductible',
            name: 'Deductible',
            path: '/tax-status/DEDUCTIBLE',
            icon: CheckCircle2,
            type: 'category' as const,
            count: documentCounts['tax:DEDUCTIBLE'] || 0,
          },
          {
            id: 'tax-non-deductible',
            name: 'Non-deductible',
            path: '/tax-status/NON_DEDUCTIBLE',
            icon: XCircle,
            type: 'category' as const,
            count: documentCounts['tax:NON_DEDUCTIBLE'] || 0,
          },
          {
            id: 'tax-untagged',
            name: 'Untagged',
            path: '/tax-status/UNTAGGED',
            icon: HelpCircle,
            type: 'category' as const,
            count: documentCounts['tax:UNTAGGED'] || 0,
          },
        ],
      },
    ];

    // Build entities section with drill-down
    const entityChildren: FolderNode[] = [];

    if (buildEntityChildren) {
      if (buildEntityChildren.properties.length > 0) {
        entityChildren.push({
          id: 'entity-properties',
          name: 'Properties',
          path: '/entities/PROPERTY',
          icon: Building2,
          type: 'entity' as const,
          count: documentCounts['entity:PROPERTY'] || 0,
          children: buildEntityChildren.properties,
        });
      }

      if ((buildEntityChildren.assets?.length ?? 0) > 0) {
        entityChildren.push({
          id: 'entity-assets',
          name: 'Assets',
          path: '/entities/ASSET',
          icon: Car,
          type: 'entity' as const,
          count: documentCounts['entity:ASSET'] || 0,
          children: buildEntityChildren.assets,
        });
      }

      if (buildEntityChildren.loans.length > 0) {
        entityChildren.push({
          id: 'entity-loans',
          name: 'Loans',
          path: '/entities/LOAN',
          icon: Landmark,
          type: 'entity' as const,
          count: documentCounts['entity:LOAN'] || 0,
          children: buildEntityChildren.loans,
        });
      }

      if (buildEntityChildren.expenses.length > 0) {
        entityChildren.push({
          id: 'entity-expenses',
          name: 'Expenses',
          path: '/entities/EXPENSE',
          icon: Receipt,
          type: 'entity' as const,
          count: documentCounts['entity:EXPENSE'] || 0,
          children: buildEntityChildren.expenses,
        });
      }

      if (buildEntityChildren.income.length > 0) {
        entityChildren.push({
          id: 'entity-income',
          name: 'Income',
          path: '/entities/INCOME',
          icon: PiggyBank,
          type: 'entity' as const,
          count: documentCounts['entity:INCOME'] || 0,
          children: buildEntityChildren.income,
        });
      }

      if (buildEntityChildren.accounts.length > 0) {
        entityChildren.push({
          id: 'entity-accounts',
          name: 'Bank Accounts',
          path: '/entities/ACCOUNT',
          icon: Banknote,
          type: 'entity' as const,
          count: documentCounts['entity:ACCOUNT'] || 0,
          children: buildEntityChildren.accounts,
        });
      }

      if (buildEntityChildren.investments.length > 0) {
        entityChildren.push({
          id: 'entity-investments',
          name: 'Investments',
          path: '/entities/INVESTMENT_ACCOUNT',
          icon: TrendingUp,
          type: 'entity' as const,
          count: documentCounts['entity:INVESTMENT_ACCOUNT'] || 0,
          children: buildEntityChildren.investments,
        });
      }
    }

    // Add entities section if there are any entities
    if (entityChildren.length > 0) {
      result.push({
        id: 'entities',
        name: 'By Entity',
        path: '/entities',
        icon: Building2,
        type: 'root',
        children: entityChildren,
      });
    } else {
      // Fallback to simple entity types if no entity data
      result.push({
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
      });
    }

    return result;
  }, [documentCounts, buildEntityChildren]);

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

    // Phase 38 PR 4 (2026-05-01) — folder-tree row redesign:
    //   • Apple typography (`tracking-[-0.01em]` on labels)
    //   • Active row: glass surface (`bg-primary/8`, `border-primary/15`)
    //     instead of flat coloured fill — reads as "selected card"
    //     rather than "highlighted text"
    //   • Top-level groups (`type === 'root'`) get an uppercase tracked-out
    //     label so the four lenses (Category / Year / Entity / Tax) feel
    //     like section headers rather than just nested folders
    //   • Count badge: tabular-nums + glass treatment matching the rest
    //     of the app
    //   • Subtle scale-in on chevron rotate
    const isTopLevel = folder.type === 'root' && depth === 0;

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
            'group w-full flex items-center gap-2 rounded-lg transition-colors',
            isTopLevel
              ? 'px-2 py-2 mt-2 first:mt-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70'
              : 'px-2 py-1.5 text-sm tracking-[-0.01em]',
            !isActive && !isTopLevel && 'text-foreground hover:bg-muted/50',
            isActive && 'bg-primary/8 text-primary font-medium border border-primary/15',
            !isActive && isTopLevel && 'hover:text-foreground hover:bg-muted/30'
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center text-muted-foreground/70 transition-transform">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 transition-transform" />
              ) : (
                <ChevronRight className="h-3 w-3 transition-transform" />
              )}
            </span>
          ) : (
            <span className="w-4" />
          )}
          {isExpanded && hasChildren ? (
            <FolderOpen className={cn('h-4 w-4', isTopLevel ? 'text-primary/80' : 'text-amber-500')} />
          ) : (
            <Icon
              className={cn(
                'h-4 w-4',
                isActive
                  ? 'text-primary'
                  : isTopLevel
                    ? 'text-primary/60'
                    : 'text-muted-foreground group-hover:text-foreground'
              )}
            />
          )}
          <span className="flex-1 text-left truncate">{folder.name}</span>
          {folder.count !== undefined && folder.count > 0 && (
            <span
              className={cn(
                'text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-md transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted/60 text-muted-foreground group-hover:bg-muted'
              )}
            >
              {folder.count}
            </span>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="mt-0.5">
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
