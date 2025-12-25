/**
 * useCategories Hook
 * Provides centralized access to expense and income categories
 * Includes both system categories and user-defined custom categories
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

export interface Category {
  id: string;
  code: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  color: string | null;
  icon: string | null;
  description: string | null;
}

export interface UseCategoriesOptions {
  type?: 'EXPENSE' | 'INCOME';
  includeSystem?: boolean;
}

export interface UseCategoriesReturn {
  categories: Category[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCategory: (data: CreateCategoryData) => Promise<Category | null>;
  updateCategory: (id: string, data: UpdateCategoryData) => Promise<Category | null>;
  deleteCategory: (id: string, force?: boolean) => Promise<boolean>;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryByCode: (code: string, type: 'EXPENSE' | 'INCOME') => Category | undefined;
}

export interface CreateCategoryData {
  name: string;
  type: 'EXPENSE' | 'INCOME';
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesReturn {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { type, includeSystem = true } = options;

  const fetchCategories = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (!includeSystem) params.append('includeSystem', 'false');

      const response = await fetch(`/api/categories?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await response.json();

      if (response.ok && json.success) {
        setCategories(json.data);
      } else {
        setError(json.error || 'Failed to load categories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token, type, includeSystem]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(async (data: CreateCategoryData): Promise<Category | null> => {
    if (!token) return null;

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (response.ok && json.success) {
        // Add to local state
        setCategories(prev => [...prev, json.data]);
        return json.data;
      } else {
        throw new Error(json.error || 'Failed to create category');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
      return null;
    }
  }, [token]);

  const updateCategory = useCallback(async (id: string, data: UpdateCategoryData): Promise<Category | null> => {
    if (!token) return null;

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (response.ok && json.success) {
        // Update local state
        setCategories(prev => prev.map(cat => cat.id === id ? json.data : cat));
        return json.data;
      } else {
        throw new Error(json.error || 'Failed to update category');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
      return null;
    }
  }, [token]);

  const deleteCategory = useCallback(async (id: string, force = false): Promise<boolean> => {
    if (!token) return false;

    try {
      const url = force ? `/api/categories/${id}?force=true` : `/api/categories/${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await response.json();

      if (response.ok && json.success) {
        if (force) {
          // Remove from local state
          setCategories(prev => prev.filter(cat => cat.id !== id));
        } else {
          // Mark as inactive in local state
          setCategories(prev => prev.map(cat =>
            cat.id === id ? { ...cat, isActive: false } : cat
          ));
        }
        return true;
      } else {
        throw new Error(json.error || 'Failed to delete category');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      return false;
    }
  }, [token]);

  const getCategoryById = useCallback((id: string): Category | undefined => {
    return categories.find(cat => cat.id === id);
  }, [categories]);

  const getCategoryByCode = useCallback((code: string, catType: 'EXPENSE' | 'INCOME'): Category | undefined => {
    return categories.find(cat => cat.code === code && cat.type === catType);
  }, [categories]);

  // Derived values
  const expenseCategories = categories.filter(cat => cat.type === 'EXPENSE');
  const incomeCategories = categories.filter(cat => cat.type === 'INCOME');

  return {
    categories,
    expenseCategories,
    incomeCategories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoryByCode,
  };
}

/**
 * Helper function to get display name for a category
 * Works with both custom category IDs and system enum values
 */
export function getCategoryDisplayName(
  value: string | null | undefined,
  categories: Category[],
  type: 'EXPENSE' | 'INCOME'
): string {
  if (!value) return 'Uncategorized';

  // Check if it's a custom category ID (UUID format)
  const customCategory = categories.find(cat => cat.id === value);
  if (customCategory) return customCategory.name;

  // Check if it's a system category code
  const systemCategory = categories.find(cat =>
    cat.code === value && cat.type === type && cat.isSystem
  );
  if (systemCategory) return systemCategory.name;

  // Fallback: format the code as title case
  return value
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Helper to determine if a value is a custom category ID
 */
export function isCustomCategoryId(value: string): boolean {
  // UUID format check (simple version)
  return value.includes('-') && value.length === 36;
}
