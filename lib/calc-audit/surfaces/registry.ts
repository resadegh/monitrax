/**
 * Phase 41i.6 — Surface descriptor registry.
 *
 * Singleton holding every registered `SurfaceDescriptor`. Mirrors the
 * `calcEngineRegistry` pattern from 41i.0 + the `taxAdvisorToolRegistry`
 * pattern from 41h.0: code-reviewed, additions require editing the
 * bootstrap (`index.ts`).
 *
 * **Reviewers reject any PR that:**
 *   - Registers a duplicate `surfaceId` (the id is the audit key).
 *   - Registers a descriptor with an empty `surfaceId`, missing
 *     `route`, or missing `canonicalSource` fields.
 *   - Registers a financial surface WITHOUT a corresponding
 *     descriptor once 41i.6a ships (HR-3 extension — the
 *     trustworthiness commitment).
 */

import 'server-only';
import type { SurfaceDescriptor } from './types';

class SurfaceRegistry {
  private readonly descriptors: Map<string, SurfaceDescriptor> = new Map();

  register(descriptor: SurfaceDescriptor): void {
    assertDescriptor(descriptor);
    if (this.descriptors.has(descriptor.surfaceId)) {
      throw new Error(
        `[Phase 41i.6] Surface descriptor already registered: ${descriptor.surfaceId}. surfaceIds must be unique.`,
      );
    }
    this.descriptors.set(descriptor.surfaceId, descriptor);
  }

  get(surfaceId: string): SurfaceDescriptor | undefined {
    return this.descriptors.get(surfaceId);
  }

  list(): SurfaceDescriptor[] {
    return [...this.descriptors.values()].sort((a, b) =>
      a.surfaceId.localeCompare(b.surfaceId),
    );
  }

  /**
   * Group descriptors by route — used by the admin UI to show "all
   * surfaces on /dashboard/cfo" together when filtering.
   */
  byRoute(): Record<string, SurfaceDescriptor[]> {
    const buckets: Record<string, SurfaceDescriptor[]> = {};
    for (const d of this.list()) {
      if (!buckets[d.route]) buckets[d.route] = [];
      buckets[d.route].push(d);
    }
    return buckets;
  }

  /**
   * Group descriptors by canonical source service — used by the
   * static-analysis pass (41i.6b) to know which component imports
   * to expect for each canonical service.
   */
  byCanonicalService(): Record<string, SurfaceDescriptor[]> {
    const buckets: Record<string, SurfaceDescriptor[]> = {};
    for (const d of this.list()) {
      const key = d.canonicalSource.service;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(d);
    }
    return buckets;
  }

  size(): number {
    return this.descriptors.size;
  }

  /**
   * Test-only — clears the registry. Production code MUST NOT call
   * this. Tests use it to set up isolated registry state.
   */
  __testOnlyClear(): void {
    this.descriptors.clear();
  }
}

/**
 * Validate a SurfaceDescriptor's structural invariants. Called from
 * `register()` and exported so tests can validate descriptors before
 * they hit the registry.
 */
export function assertDescriptor(d: SurfaceDescriptor): void {
  if (!d.surfaceId || typeof d.surfaceId !== 'string' || d.surfaceId.trim().length === 0) {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.surfaceId must be a non-empty string.`,
    );
  }
  // surfaceId convention: dotted path like "tile.cashflow.monthly"
  if (!/^[a-zA-Z0-9._-]+$/.test(d.surfaceId)) {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.surfaceId "${d.surfaceId}" contains invalid characters. Use alphanumeric + dots + underscores + hyphens only.`,
    );
  }
  if (!d.description || typeof d.description !== 'string') {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.description must be a non-empty string for ${d.surfaceId}.`,
    );
  }
  if (!d.route || typeof d.route !== 'string' || !d.route.startsWith('/')) {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.route must start with "/" for ${d.surfaceId} (got "${d.route}").`,
    );
  }
  if (!d.canonicalSource) {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.canonicalSource is required for ${d.surfaceId}.`,
    );
  }
  if (
    !d.canonicalSource.service ||
    !d.canonicalSource.method ||
    !d.canonicalSource.fieldPath
  ) {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.canonicalSource must have non-empty service + method + fieldPath for ${d.surfaceId}.`,
    );
  }
  if (!d.canonicalSource.service.endsWith('.ts') && !d.canonicalSource.service.startsWith('/api/')) {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.canonicalSource.service must end with ".ts" (a module path) or start with "/api/" (an API route) for ${d.surfaceId}.`,
    );
  }
  if (typeof d.invokeCanonicalSource !== 'function') {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.invokeCanonicalSource must be a function for ${d.surfaceId}.`,
    );
  }
  if (typeof d.extractRenderedValue !== 'function') {
    throw new Error(
      `[Phase 41i.6] SurfaceDescriptor.extractRenderedValue must be a function for ${d.surfaceId}.`,
    );
  }
}

export const surfaceRegistry = new SurfaceRegistry();
