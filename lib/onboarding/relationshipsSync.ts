/**
 * Phase 44 Part 1d — onboarding relationship-skeleton sync.
 *
 * Writes the wizard's relationship skeleton to the real
 * `EntityRelationship` table via the Part 1c `/api/entities/relationships`
 * route — the canonical writer (`entityRelationshipService`, the only
 * writer of the graph, §8.4). No tax/financial arithmetic (§8.3).
 *
 * The relationship step runs AFTER the entity step has persisted its
 * entities, so the `from`/`to` ids here are already real DB ids.
 *
 * Idempotent: a wizard resume re-POSTs; the service rejects a duplicate
 * edge with `DUPLICATE_EDGE` (409), which is treated as "already
 * recorded" — not a failure.
 *
 * Best-effort: a write failure is counted, never thrown. The relationship
 * skeleton is explicitly "finishable later in My Structure" (PHASE_44
 * §11, Q3) — onboarding must never trap the user on a transient error.
 */

import { isPersistedId } from './entitiesSync';
import type { RelationshipInput } from '@/components/onboarding/wizard/types';

export interface RelationshipsSyncResult {
  /** Edges newly written to the graph. */
  created: number;
  /** Edges already present (idempotent re-run) or dropped as invalid. */
  skipped: number;
  /** Edges that failed to write — surfaced as a console warning, not thrown. */
  failed: number;
}

/**
 * Persist the wizard relationship skeleton. Returns per-edge counts;
 * never throws — the caller decides whether to surface `failed`.
 */
export async function syncRelationships(
  token: string | null,
  relationships: RelationshipInput[],
): Promise<RelationshipsSyncResult> {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of relationships) {
    // Defensive — both ends must be real, persisted entities and
    // distinct. An unpersisted ref or a self-edge is dropped, not sent.
    if (
      !isPersistedId(r.fromEntityTempId) ||
      !isPersistedId(r.toEntityTempId) ||
      r.fromEntityTempId === r.toEntityTempId
    ) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch('/api/entities/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fromEntityId: r.fromEntityTempId,
          toEntityId: r.toEntityTempId,
          type: r.type,
        }),
      });
      if (res.ok) {
        created++;
        continue;
      }
      const body = (await res.json().catch(() => null)) as
        | { error?: { code?: string } }
        | null;
      if (body?.error?.code === 'DUPLICATE_EDGE') {
        // Idempotent — the edge is already in the graph.
        skipped++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { created, skipped, failed };
}
