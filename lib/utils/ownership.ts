/**
 * Ownership Validation Utility
 * Centralized helper for validating resource ownership in API routes.
 *
 * Blueprint §5.1: Never Duplicate Logic
 * This utility replaces the repetitive ownership check patterns across 100+ API routes.
 */

import { NextResponse } from 'next/server';
import { notFound, forbidden } from './api-response';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Any resource that has a userId field for ownership
 */
export interface OwnedResource {
  userId: string;
  [key: string]: unknown;
}

/**
 * Result of ownership verification - either the resource or an error response
 */
export type OwnershipResult<T extends OwnedResource> =
  | { success: true; resource: T }
  | { success: false; response: NextResponse };

// =============================================================================
// OWNERSHIP VERIFICATION FUNCTIONS
// =============================================================================

/**
 * Verify direct ownership of a resource.
 *
 * Use this when checking if a directly fetched resource belongs to the user.
 *
 * @example
 * ```ts
 * const expense = await prisma.expense.findUnique({ where: { id } });
 * const result = verifyOwnership(expense, authReq.user!.userId, 'Expense');
 * if (!result.success) return result.response;
 * // result.resource is the expense, safe to use
 * ```
 *
 * @param resource - The resource to check (may be null if not found)
 * @param userId - The authenticated user's ID
 * @param resourceName - Human-readable resource name for error messages
 * @returns Success with resource, or error response (404 Not Found)
 */
export function verifyOwnership<T extends OwnedResource>(
  resource: T | null | undefined,
  userId: string,
  resourceName: string
): OwnershipResult<T> {
  // Not found or not owned - return 404 (masks existence for security)
  if (!resource || resource.userId !== userId) {
    return {
      success: false,
      response: notFound(resourceName),
    };
  }

  return {
    success: true,
    resource,
  };
}

/**
 * Verify ownership of an optional related entity.
 *
 * Use this when checking ownership of a related resource (e.g., propertyId, loanId)
 * that may or may not be provided.
 *
 * @example
 * ```ts
 * if (propertyId) {
 *   const property = await prisma.property.findUnique({ where: { id: propertyId } });
 *   const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
 *   if (!result.success) return result.response;
 * }
 * ```
 *
 * @param resource - The related resource (may be null if not found)
 * @param userId - The authenticated user's ID
 * @param resourceName - Human-readable resource name for error messages
 * @returns Success with resource, or error response (403 Forbidden for related entities)
 */
export function verifyRelatedOwnership<T extends OwnedResource>(
  resource: T | null | undefined,
  userId: string,
  resourceName: string
): OwnershipResult<T> {
  // Not found or not owned - return 403 for related entities
  if (!resource || resource.userId !== userId) {
    return {
      success: false,
      response: forbidden(`${resourceName} not found or unauthorized`),
    };
  }

  return {
    success: true,
    resource,
  };
}

/**
 * Verify indirect ownership through a parent entity.
 *
 * Use this when the resource doesn't have a direct userId but belongs
 * to a parent that does (e.g., holdings belong to investmentAccount).
 *
 * @example
 * ```ts
 * const holding = await prisma.holding.findUnique({
 *   where: { id },
 *   include: { investmentAccount: true }
 * });
 * const result = verifyIndirectOwnership(
 *   holding,
 *   holding?.investmentAccount,
 *   authReq.user!.userId,
 *   'Holding'
 * );
 * if (!result.success) return result.response;
 * ```
 *
 * @param resource - The child resource (may be null if not found)
 * @param parent - The parent resource with userId (may be null)
 * @param userId - The authenticated user's ID
 * @param resourceName - Human-readable resource name for error messages
 * @returns Success with resource, or error response (404 Not Found)
 */
export function verifyIndirectOwnership<T, P extends OwnedResource>(
  resource: T | null | undefined,
  parent: P | null | undefined,
  userId: string,
  resourceName: string
): { success: true; resource: T } | { success: false; response: NextResponse } {
  // Resource or parent not found, or parent not owned
  if (!resource || !parent || parent.userId !== userId) {
    return {
      success: false,
      response: notFound(resourceName),
    };
  }

  return {
    success: true,
    resource,
  };
}

// =============================================================================
// BATCH OWNERSHIP VERIFICATION
// =============================================================================

/**
 * Verify ownership of multiple resources in batch.
 *
 * Use this when validating arrays of IDs (e.g., bulk operations).
 *
 * @example
 * ```ts
 * const properties = await prisma.property.findMany({
 *   where: { id: { in: propertyIds } }
 * });
 * const result = verifyBatchOwnership(
 *   properties,
 *   propertyIds,
 *   authReq.user!.userId,
 *   'Property'
 * );
 * if (!result.success) return result.response;
 * ```
 *
 * @param resources - Array of resources found
 * @param requestedIds - Array of IDs that were requested
 * @param userId - The authenticated user's ID
 * @param resourceName - Human-readable resource name for error messages
 * @returns Success with resources, or error response
 */
export function verifyBatchOwnership<T extends OwnedResource & { id: string }>(
  resources: T[],
  requestedIds: string[],
  userId: string,
  resourceName: string
): { success: true; resources: T[] } | { success: false; response: NextResponse } {
  // Check all resources are owned by user
  const ownedResources = resources.filter(r => r.userId === userId);

  // If we didn't find all requested resources or some aren't owned
  if (ownedResources.length !== requestedIds.length) {
    const foundIds = new Set(ownedResources.map(r => r.id));
    const missingIds = requestedIds.filter(id => !foundIds.has(id));

    return {
      success: false,
      response: forbidden(
        `${resourceName}(s) not found or unauthorized: ${missingIds.join(', ')}`
      ),
    };
  }

  return {
    success: true,
    resources: ownedResources,
  };
}

// =============================================================================
// TYPE GUARD HELPERS
// =============================================================================

/**
 * Type guard to check if ownership result is successful
 */
export function isOwned<T extends OwnedResource>(
  result: OwnershipResult<T>
): result is { success: true; resource: T } {
  return result.success;
}

/**
 * Quick ownership check - returns boolean only
 * Use when you just need a boolean check, not the full result
 */
export function checkOwnership<T extends OwnedResource>(
  resource: T | null | undefined,
  userId: string
): resource is T {
  return resource !== null && resource !== undefined && resource.userId === userId;
}
