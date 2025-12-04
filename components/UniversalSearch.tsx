'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Receipt,
  DollarSign,
  Home,
  Landmark,
  Car,
  TrendingUp,
  FileText,
  ArrowRight,
  Loader2,
  Command,
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'expense' | 'income' | 'property' | 'loan' | 'asset' | 'investment' | 'document' | 'holding';
  title: string;
  subtitle: string;
  meta?: Record<string, unknown>;
  url: string;
}

interface GroupedResults {
  expenses: SearchResult[];
  income: SearchResult[];
  properties: SearchResult[];
  loans: SearchResult[];
  assets: SearchResult[];
  investments: SearchResult[];
  documents: SearchResult[];
}

const typeIcons: Record<SearchResult['type'], React.ReactNode> = {
  expense: <Receipt className="h-4 w-4" />,
  income: <DollarSign className="h-4 w-4" />,
  property: <Home className="h-4 w-4" />,
  loan: <Landmark className="h-4 w-4" />,
  asset: <Car className="h-4 w-4" />,
  investment: <TrendingUp className="h-4 w-4" />,
  holding: <TrendingUp className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
};

const typeColors: Record<SearchResult['type'], string> = {
  expense: 'text-red-500',
  income: 'text-green-500',
  property: 'text-blue-500',
  loan: 'text-orange-500',
  asset: 'text-purple-500',
  investment: 'text-emerald-500',
  holding: 'text-emerald-500',
  document: 'text-gray-500',
};

const typeLabels: Record<string, string> = {
  expenses: 'Expenses',
  income: 'Income',
  properties: 'Properties',
  loans: 'Loans',
  assets: 'Assets',
  investments: 'Investments',
  documents: 'Documents',
};

interface UniversalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UniversalSearch({ open, onOpenChange }: UniversalSearchProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroupedResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Flatten results for keyboard navigation
  const flatResults = results
    ? [
        ...results.expenses,
        ...results.income,
        ...results.properties,
        ...results.loans,
        ...results.assets,
        ...results.investments,
        ...results.documents,
      ]
    : [];

  const search = useCallback(async (searchQuery: string) => {
    if (!token || searchQuery.length < 2) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setResults(data.grouped);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      router.push(flatResults[selectedIndex].url);
      onOpenChange(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    onOpenChange(false);
  };

  const hasResults = results && Object.values(results).some(arr => arr.length > 0);
  const totalResults = flatResults.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            placeholder="Search expenses, income, properties, loans, assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 h-14 text-base placeholder:text-muted-foreground/60"
          />
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Command className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Start typing to search across all your data</p>
              <p className="text-xs mt-1 opacity-60">Press ⌘K or Ctrl+K anytime to open</p>
            </div>
          ) : !hasResults && !isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No results found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1 opacity-60">Try different keywords</p>
            </div>
          ) : (
            <div className="py-2">
              {results && (Object.entries(results) as [string, SearchResult[]][]).map(([type, items]) => {
                if (items.length === 0) return null;
                const startIdx = flatResults.findIndex(r => r === items[0]);

                return (
                  <div key={type} className="mb-2">
                    <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {typeLabels[type]} ({items.length})
                    </div>
                    {items.map((result: SearchResult, idx: number) => {
                      const globalIdx = startIdx + idx;
                      const isSelected = globalIdx === selectedIndex;

                      return (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                            isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                          }`}
                        >
                          <span className={typeColors[result.type]}>
                            {typeIcons[result.type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.title}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {result.subtitle}
                            </div>
                          </div>
                          {isSelected && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasResults && (
          <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              <span>navigate</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
              <span>select</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">esc</kbd>
              <span>close</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Hook for keyboard shortcut
export function useUniversalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
