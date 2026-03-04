/**
 * Category API - Individual operations
 * GET    /api/categories/[id]    - Get a single category
 * PUT    /api/categories/[id]    - Update a category
 * DELETE /api/categories/[id]    - Delete/deactivate a category
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/[id]
 * Get a single category by ID
 */
export const GET = withPermission<RouteContext>('settings.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;

      // Check if it's a system category
      if (id.startsWith('system:')) {
        return NextResponse.json(
          { error: 'System categories cannot be retrieved individually' },
          { status: 400 }
        );
      }

      const category = await prisma.category.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(category, auth.userId, 'Category');
      if (!ownershipResult.success) return ownershipResult.response;

      // Use verified resource (TypeScript knows it's non-null after success check)
      const verifiedCategory = ownershipResult.resource;

      return NextResponse.json({
        success: true,
        data: {
          id: verifiedCategory.id,
          code: verifiedCategory.code,
          name: verifiedCategory.name,
          type: verifiedCategory.type,
          isSystem: false,
          isActive: verifiedCategory.isActive,
          sortOrder: verifiedCategory.sortOrder,
          color: verifiedCategory.color,
          icon: verifiedCategory.icon,
          description: verifiedCategory.description,
        },
      });
    } catch (error) {
      console.error('Get category error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

/**
 * PUT /api/categories/[id]
 * Update a category
 */
export const PUT = withPermission<RouteContext>('settings.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = await request.json();
      const { name, description, color, icon, isActive, sortOrder } = body;

      // Check if it's a system category
      if (id.startsWith('system:')) {
        return NextResponse.json(
          { error: 'System categories cannot be modified' },
          { status: 400 }
        );
      }

      const category = await prisma.category.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(category, auth.userId, 'Category');
      if (!ownershipResult.success) return ownershipResult.response;

      // Prepare update data
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) {
        updateData.name = name.trim();
        // Update code based on new name
        updateData.code = name
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);

        // Check for duplicate code
        const existing = await prisma.category.findFirst({
          where: {
            userId: auth.userId,
            code: updateData.code as string,
            id: { not: id },
          },
        });

        if (existing) {
          return NextResponse.json(
            { error: 'A category with this name already exists' },
            { status: 409 }
          );
        }
      }

      if (description !== undefined) updateData.description = description?.trim() || null;
      if (color !== undefined) updateData.color = color || null;
      if (icon !== undefined) updateData.icon = icon || null;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10);

      const updated = await prisma.category.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          type: updated.type,
          isSystem: false,
          isActive: updated.isActive,
          sortOrder: updated.sortOrder,
          color: updated.color,
          icon: updated.icon,
          description: updated.description,
        },
        message: 'Category updated successfully',
      });
    } catch (error) {
      console.error('Update category error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

/**
 * DELETE /api/categories/[id]
 * Delete a category (soft delete - marks as inactive)
 * If force=true, permanently deletes if no expenses/income use it
 */
export const DELETE = withPermission<RouteContext>('settings.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const { searchParams } = new URL(request.url);
      const force = searchParams.get('force') === 'true';

      // Check if it's a system category
      if (id.startsWith('system:')) {
        return NextResponse.json(
          { error: 'System categories cannot be deleted' },
          { status: 400 }
        );
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          expenses: { select: { id: true }, take: 1 },
          income: { select: { id: true }, take: 1 },
        },
      });

      const ownershipResult = verifyOwnership(category, auth.userId, 'Category');
      if (!ownershipResult.success) return ownershipResult.response;

      // Use verified resource (TypeScript knows it's non-null after success check)
      const verifiedCategory = ownershipResult.resource;

      const hasExpenses = verifiedCategory.expenses.length > 0;
      const hasIncome = verifiedCategory.income.length > 0;
      const isInUse = hasExpenses || hasIncome;

      if (isInUse && force) {
        return NextResponse.json(
          { error: 'Cannot permanently delete a category that is in use. Reassign items first.' },
          { status: 400 }
        );
      }

      if (force && !isInUse) {
        // Permanent delete
        await prisma.category.delete({
          where: { id },
        });

        return NextResponse.json({
          success: true,
          message: 'Category permanently deleted',
        });
      }

      // Soft delete (deactivate)
      await prisma.category.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: isInUse
          ? 'Category deactivated (still referenced by existing items)'
          : 'Category deactivated',
      });
    } catch (error) {
      console.error('Delete category error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
