'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'boolean' | 'range';
  options?: FilterOption[];
  placeholder?: string;
}

export interface ActiveFilter {
  key: string;
  value: string | string[] | boolean | { min?: number; max?: number };
  label: string;
}

export interface ListFilterProps<T> {
  data: T[];
  searchFields: (keyof T)[];
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  onFilteredData: (data: T[]) => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ListFilter<T extends Record<string, unknown>>({
  data,
  searchFields,
  searchPlaceholder = 'Search...',
  filters = [],
  onFilteredData,
  className = '',
}: ListFilterProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string | string[]>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Apply search and filters
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return;

      result = result.filter((item) => {
        const itemValue = item[key as keyof T];
        if (Array.isArray(value)) {
          return value.includes(String(itemValue));
        }
        if (value === '_all') return true;
        return String(itemValue) === value;
      });
    });

    return result;
  }, [data, searchQuery, activeFilters, searchFields]);

  // Notify parent of filtered data
  useMemo(() => {
    onFilteredData(filteredData);
  }, [filteredData, onFilteredData]);

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => {
      if (value === '_all' || !value) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const clearFilter = (key: string) => {
    setActiveFilters((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveFilters({});
  };

  const activeFilterCount = Object.keys(activeFilters).length;
  const hasActiveFilters = searchQuery.trim() || activeFilterCount > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search and Filter Bar */}
      <div className="flex gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Button */}
        {filters.length > 0 && (
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {filters.map((filter) => (
                  <div key={filter.key} className="space-y-1.5">
                    <label className="text-sm font-medium">{filter.label}</label>
                    {filter.type === 'select' && filter.options && (
                      <Select
                        value={activeFilters[filter.key] as string || '_all'}
                        onValueChange={(value) => handleFilterChange(filter.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={filter.placeholder || 'All'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">All</SelectItem>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredData.length} of {data.length} items
          </span>

          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {Object.entries(activeFilters).map(([key, value]) => {
            const filterConfig = filters.find((f) => f.key === key);
            const option = filterConfig?.options?.find((o) => o.value === value);
            return (
              <Badge key={key} variant="secondary" className="gap-1">
                {filterConfig?.label}: {option?.label || value}
                <button onClick={() => clearFilter(key)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PRESET FILTER CONFIGS
// =============================================================================

export const expenseFilterConfigs: FilterConfig[] = [
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'HOUSING', label: 'Housing' },
      { value: 'RATES', label: 'Rates' },
      { value: 'INSURANCE', label: 'Insurance' },
      { value: 'MAINTENANCE', label: 'Maintenance' },
      { value: 'PERSONAL', label: 'Personal' },
      { value: 'UTILITIES', label: 'Utilities' },
      { value: 'FOOD', label: 'Food' },
      { value: 'TRANSPORT', label: 'Transport' },
      { value: 'ENTERTAINMENT', label: 'Entertainment' },
      { value: 'STRATA', label: 'Strata' },
      { value: 'LAND_TAX', label: 'Land Tax' },
      { value: 'LOAN_INTEREST', label: 'Loan Interest' },
      { value: 'REGISTRATION', label: 'Registration' },
      { value: 'MODIFICATIONS', label: 'Modifications' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
  {
    key: 'sourceType',
    label: 'Source',
    type: 'select',
    options: [
      { value: 'GENERAL', label: 'General' },
      { value: 'PROPERTY', label: 'Property' },
      { value: 'LOAN', label: 'Loan' },
      { value: 'INVESTMENT', label: 'Investment' },
      { value: 'ASSET', label: 'Asset' },
    ],
  },
  {
    key: 'frequency',
    label: 'Frequency',
    type: 'select',
    options: [
      { value: 'WEEKLY', label: 'Weekly' },
      { value: 'FORTNIGHTLY', label: 'Fortnightly' },
      { value: 'MONTHLY', label: 'Monthly' },
      { value: 'QUARTERLY', label: 'Quarterly' },
      { value: 'ANNUAL', label: 'Annual' },
    ],
  },
];

export const incomeFilterConfigs: FilterConfig[] = [
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'SALARY', label: 'Salary' },
      { value: 'RENT', label: 'Rent' },
      { value: 'RENTAL', label: 'Rental' },
      { value: 'INVESTMENT', label: 'Investment' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
  {
    key: 'sourceType',
    label: 'Source',
    type: 'select',
    options: [
      { value: 'GENERAL', label: 'General' },
      { value: 'PROPERTY', label: 'Property' },
      { value: 'INVESTMENT', label: 'Investment' },
    ],
  },
  {
    key: 'frequency',
    label: 'Frequency',
    type: 'select',
    options: [
      { value: 'WEEKLY', label: 'Weekly' },
      { value: 'FORTNIGHTLY', label: 'Fortnightly' },
      { value: 'MONTHLY', label: 'Monthly' },
      { value: 'QUARTERLY', label: 'Quarterly' },
      { value: 'ANNUAL', label: 'Annual' },
    ],
  },
];

export const propertyFilterConfigs: FilterConfig[] = [
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'HOME', label: 'Home' },
      { value: 'INVESTMENT', label: 'Investment' },
    ],
  },
];

export const loanFilterConfigs: FilterConfig[] = [
  {
    key: 'type',
    label: 'Loan Type',
    type: 'select',
    options: [
      { value: 'HOME', label: 'Home Loan' },
      { value: 'INVESTMENT', label: 'Investment Loan' },
    ],
  },
  {
    key: 'rateType',
    label: 'Rate Type',
    type: 'select',
    options: [
      { value: 'FIXED', label: 'Fixed' },
      { value: 'VARIABLE', label: 'Variable' },
    ],
  },
];

export const assetFilterConfigs: FilterConfig[] = [
  {
    key: 'type',
    label: 'Asset Type',
    type: 'select',
    options: [
      { value: 'VEHICLE', label: 'Vehicle' },
      { value: 'ELECTRONICS', label: 'Electronics' },
      { value: 'FURNITURE', label: 'Furniture' },
      { value: 'EQUIPMENT', label: 'Equipment' },
      { value: 'COLLECTIBLE', label: 'Collectible' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'SOLD', label: 'Sold' },
      { value: 'WRITTEN_OFF', label: 'Written Off' },
    ],
  },
];

export const documentFilterConfigs: FilterConfig[] = [
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'CONTRACT', label: 'Contract' },
      { value: 'STATEMENT', label: 'Statement' },
      { value: 'RECEIPT', label: 'Receipt' },
      { value: 'TAX', label: 'Tax' },
      { value: 'PDS', label: 'PDS' },
      { value: 'VALUATION', label: 'Valuation' },
      { value: 'INSURANCE', label: 'Insurance' },
      { value: 'MORTGAGE', label: 'Mortgage' },
      { value: 'LEASE', label: 'Lease' },
      { value: 'INVOICE', label: 'Invoice' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
];
