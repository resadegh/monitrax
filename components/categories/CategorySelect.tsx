'use client';

/**
 * CategorySelect Component
 * A dropdown that displays both system and custom categories
 * with the ability to add new custom categories inline
 */

import { useState, useEffect } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCategories, Category } from '@/hooks/useCategories';

interface CategorySelectProps {
  type: 'EXPENSE' | 'INCOME';
  value: string | null;
  onChange: (value: string, isCustom: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
  sourceType?: string;  // For filtering (e.g., PROPERTY, LOAN)
  assetType?: string;   // For filtering asset-related expenses
}

export function CategorySelect({
  type,
  value,
  onChange,
  placeholder = 'Select category...',
  disabled = false,
  className = '',
  allowCustom = true,
}: CategorySelectProps) {
  const { categories, loading, createCategory } = useCategories({ type });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Separate system and custom categories
  const systemCategories = categories.filter(c => c.isSystem);
  const customCategories = categories.filter(c => !c.isSystem && c.isActive);

  // Find selected category for display
  const selectedCategory = categories.find(c =>
    c.id === value || c.code === value
  );

  const handleValueChange = (newValue: string) => {
    if (newValue === '__add_new__') {
      setShowAddDialog(true);
      return;
    }

    const category = categories.find(c => c.id === newValue || c.code === newValue);
    if (category) {
      // For custom categories, use the ID; for system, use the code
      const valueToSet = category.isSystem ? category.code : category.id;
      onChange(valueToSet, !category.isSystem);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setCreateError('Please enter a category name');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const result = await createCategory({
        name: newCategoryName.trim(),
        type,
        description: newCategoryDescription.trim() || undefined,
      });

      if (result) {
        // Select the newly created category
        onChange(result.id, true);
        setShowAddDialog(false);
        setNewCategoryName('');
        setNewCategoryDescription('');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  // Determine the display value for the select
  const displayValue = selectedCategory
    ? (selectedCategory.isSystem ? selectedCategory.code : selectedCategory.id)
    : value || '';

  return (
    <>
      <Select
        value={displayValue}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className={className}>
          {loading ? (
            <span className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : (
            <SelectValue placeholder={placeholder}>
              {selectedCategory?.name || placeholder}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          {/* System Categories */}
          <SelectGroup>
            <SelectLabel className="text-xs text-gray-500 uppercase tracking-wide">
              Standard Categories
            </SelectLabel>
            {systemCategories.map(category => (
              <SelectItem key={category.id} value={category.code}>
                <div className="flex items-center gap-2">
                  <span>{category.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>

          {/* Custom Categories */}
          {customCategories.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-xs text-gray-500 uppercase tracking-wide">
                  My Categories
                </SelectLabel>
                {customCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      {category.color && (
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <span>{category.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}

          {/* Add New Option */}
          {allowCustom && (
            <>
              <SelectSeparator />
              <SelectItem value="__add_new__" className="text-blue-600">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Add new category...</span>
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Add Category Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New {type === 'EXPENSE' ? 'Expense' : 'Income'} Category</DialogTitle>
            <DialogDescription>
              Create a custom category that will be available for all your {type.toLowerCase()}s.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name *</Label>
              <Input
                id="categoryName"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder={type === 'EXPENSE' ? 'e.g., Pet Care, Childcare' : 'e.g., Side Business, Royalties'}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Description (optional)</Label>
              <Textarea
                id="categoryDescription"
                value={newCategoryDescription}
                onChange={e => setNewCategoryDescription(e.target.value)}
                placeholder="Describe what this category is for..."
                rows={2}
              />
            </div>

            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setNewCategoryName('');
                setNewCategoryDescription('');
                setCreateError(null);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={creating || !newCategoryName.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Category
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Simple category display badge
 */
export function CategoryBadge({
  categoryId,
  categoryCode,
  type,
  className = '',
}: {
  categoryId?: string | null;
  categoryCode?: string | null;
  type: 'EXPENSE' | 'INCOME';
  className?: string;
}) {
  const { categories } = useCategories({ type });

  const category = categories.find(c =>
    (categoryId && c.id === categoryId) || (categoryCode && c.code === categoryCode)
  );

  if (!category) {
    return (
      <span className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 ${className}`}>
        {categoryCode || 'Uncategorized'}
      </span>
    );
  }

  const bgColor = category.color
    ? { backgroundColor: category.color + '20', color: category.color }
    : undefined;

  return (
    <span
      className={`px-2 py-1 text-xs rounded-full ${!category.color ? 'bg-blue-100 text-blue-800' : ''} ${className}`}
      style={bgColor}
    >
      {category.name}
    </span>
  );
}
