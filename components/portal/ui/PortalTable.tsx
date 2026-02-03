/**
 * Phase 32: Portal Table Component
 *
 * MODULAR: A flexible, type-safe table component for the portal.
 * Supports sorting, pagination, and custom cell rendering.
 */

'use client';

import { ReactNode, useState, useMemo } from 'react';

// Column definition
export interface TableColumn<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => ReactNode;
}

// Table props
interface PortalTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  selectedRowKey?: string;
  sortable?: boolean;
  defaultSortKey?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

export function PortalTable<T extends object>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  selectedRowKey,
  sortable = false,
  defaultSortKey,
  defaultSortOrder = 'asc',
}: PortalTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortable || !sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortOrder, sortable]);

  const handleSort = (key: string) => {
    if (!sortable) return;

    const column = columns.find((c) => c.key === key);
    if (!column?.sortable) return;

    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (loading) {
    return <TableSkeleton columns={columns.length} rows={5} />;
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${
                  alignClasses[column.align || 'left']
                } ${column.sortable && sortable ? 'cursor-pointer hover:text-slate-700' : ''}`}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-1">
                  {column.header}
                  {sortable && column.sortable && sortKey === column.key && (
                    <span className="text-slate-400">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedData.map((item, index) => {
            const key = keyExtractor(item);
            const isSelected = selectedRowKey === key;

            return (
              <tr
                key={key}
                className={`
                  ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}
                  ${isSelected ? 'bg-blue-50' : ''}
                `}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-slate-900 ${alignClasses[column.align || 'left']}`}
                  >
                    {column.render
                      ? column.render(item, index)
                      : String((item as Record<string, unknown>)[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Table Skeleton for loading state
 */
function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="animate-pulse">
      <div className="border-b border-slate-200 py-3 flex gap-4 px-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b border-slate-100 py-4 flex gap-4 px-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 bg-slate-100 rounded flex-1"
              style={{ width: `${60 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Pagination Component
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 20,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || 0);

  const pages = useMemo(() => {
    const result: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);

      if (currentPage > 3) result.push('ellipsis');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) result.push(i);

      if (currentPage < totalPages - 2) result.push('ellipsis');

      result.push(totalPages);
    }

    return result;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-between py-3">
      {totalItems !== undefined && (
        <p className="text-sm text-slate-500">
          Showing {startItem} to {endItem} of {totalItems} results
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                currentPage === page
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
