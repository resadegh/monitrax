/**
 * Categories API
 * CRUD operations for user-defined expense and income categories
 *
 * GET    /api/categories         - List all categories (system + custom)
 * POST   /api/categories         - Create a new custom category
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, INCOME_TYPES, INCOME_TYPE_LABELS } from '@/lib/categories/unified';

// System categories - these are always available for all users
function getSystemCategories() {
  const expenseCategories = EXPENSE_CATEGORIES.map((code, index) => ({
    id: `system:expense:${code}`,
    code,
    name: EXPENSE_CATEGORY_LABELS[code],
    type: 'EXPENSE' as const,
    isSystem: true,
    isActive: true,
    sortOrder: index,
    color: null,
    icon: null,
    description: null,
  }));

  const incomeCategories = INCOME_TYPES.map((code, index) => ({
    id: `system:income:${code}`,
    code,
    name: INCOME_TYPE_LABELS[code],
    type: 'INCOME' as const,
    isSystem: true,
    isActive: true,
    sortOrder: index,
    color: null,
    icon: null,
    description: null,
  }));

  return [...expenseCategories, ...incomeCategories];
}

/**
 * GET /api/categories
 * Returns all categories (system + user-defined)
 * Query params:
 *   - type: 'EXPENSE' | 'INCOME' (optional filter)
 *   - includeSystem: 'true' | 'false' (default: true)
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const { searchParams } = new URL(request.url);
      const typeFilter = searchParams.get('type') as 'EXPENSE' | 'INCOME' | null;
      const includeSystem = searchParams.get('includeSystem') !== 'false';

      // Get user's custom categories
      const customCategories = await prisma.category.findMany({
        where: {
          userId: authReq.user!.userId,
          isActive: true,
          ...(typeFilter && { type: typeFilter }),
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });

      // Format custom categories
      const formattedCustom = customCategories.map(cat => ({
        id: cat.id,
        code: cat.code,
        name: cat.name,
        type: cat.type,
        isSystem: false,
        isActive: cat.isActive,
        sortOrder: cat.sortOrder,
        color: cat.color,
        icon: cat.icon,
        description: cat.description,
      }));

      // Get system categories if requested
      let systemCategories: ReturnType<typeof getSystemCategories> = [];
      if (includeSystem) {
        systemCategories = getSystemCategories();
        if (typeFilter) {
          systemCategories = systemCategories.filter(cat => cat.type === typeFilter);
        }
      }

      // Combine: system categories first, then custom
      const allCategories = [...systemCategories, ...formattedCustom];

      return NextResponse.json({
        success: true,
        data: allCategories,
        _meta: {
          totalCount: allCategories.length,
          systemCount: systemCategories.length,
          customCount: formattedCustom.length,
        },
      });
    } catch (error) {
      console.error('Get categories error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

/**
 * POST /api/categories
 * Create a new custom category
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { name, type, description, color, icon } = body;

      // Validate required fields
      if (!name || !type) {
        return NextResponse.json(
          { error: 'Name and type are required' },
          { status: 400 }
        );
      }

      // Validate type
      if (!['EXPENSE', 'INCOME'].includes(type)) {
        return NextResponse.json(
          { error: 'Type must be EXPENSE or INCOME' },
          { status: 400 }
        );
      }

      // Generate code from name (uppercase, underscores for spaces)
      const code = name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);

      // Check if code already exists for this user
      const existing = await prisma.category.findFirst({
        where: {
          userId: authReq.user!.userId,
          code,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }

      // Check if it conflicts with a system category
      const systemCodes = type === 'EXPENSE'
        ? EXPENSE_CATEGORIES
        : INCOME_TYPES;

      if (systemCodes.includes(code as never)) {
        return NextResponse.json(
          { error: 'This name conflicts with a system category' },
          { status: 409 }
        );
      }

      // Get next sort order
      const maxSortOrder = await prisma.category.aggregate({
        where: { userId: authReq.user!.userId, type },
        _max: { sortOrder: true },
      });

      const category = await prisma.category.create({
        data: {
          userId: authReq.user!.userId,
          name: name.trim(),
          code,
          type,
          description: description?.trim() || null,
          color: color || null,
          icon: icon || null,
          sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: category.id,
          code: category.code,
          name: category.name,
          type: category.type,
          isSystem: false,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
          color: category.color,
          icon: category.icon,
          description: category.description,
        },
        message: 'Category created successfully',
      });
    } catch (error) {
      console.error('Create category error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
