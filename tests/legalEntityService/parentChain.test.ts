/**
 * `parentEntityId` cycle-detection tests — Phase 41e.0 slice B.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §7.5, these
 * are the eight required tests for the validator. They drive the
 * walker via a faked `legalEntity.findUnique` that reads from an
 * in-memory chain map — no real Prisma client, no DB. Pure unit tests.
 *
 * The walker is the same code the service runs in production; faking
 * just the lookup is enough to exercise every Rule 1–3 path.
 */

import { describe, it, expect } from 'vitest';
import { validateParentChain } from '@/lib/services/legalEntityService';

/**
 * Build a minimal "Prisma-like" client that satisfies the validator's
 * type contract. Maps id → parentEntityId; missing keys behave as the
 * row not existing.
 */
function fakeClient(chain: Record<string, string | null>) {
  return {
    legalEntity: {
      findUnique: async ({
        where: { id },
      }: {
        where: { id: string };
      }) => {
        if (!(id in chain)) return null;
        return { parentEntityId: chain[id] };
      },
    },
  } as unknown as Parameters<typeof validateParentChain>[2];
}

describe('validateParentChain — audit §7.5 required tests', () => {
  it('1. self-parent rejected', async () => {
    const result = await validateParentChain('A', 'A', fakeClient({ A: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SELF_PARENT');
  });

  it('2. direct cycle rejected (A → B; update B parent to A)', async () => {
    // Chain currently: B → A (A is root). Update B's parent to A would
    // be fine on its own; but if we test the inverse — set A's parent to
    // B (and B already points at A) — that's a direct cycle.
    const chain: Record<string, string | null> = {
      A: null,
      B: 'A', // B → A
    };
    // Try to set A's parent to B → walker from B finds A == entityId.
    const result = await validateParentChain('A', 'B', fakeClient(chain));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CYCLE_DETECTED');
  });

  it('3. indirect cycle rejected (A → B → C; update C parent to A)', async () => {
    const chain: Record<string, string | null> = {
      A: null,
      B: 'A', // B → A
      C: 'B', // C → B → A
    };
    // Try to set A's parent to C → walker steps C → B → A == entityId.
    const result = await validateParentChain('A', 'C', fakeClient(chain));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CYCLE_DETECTED');
  });

  it('4. max depth (10) enforced — 11-deep chain rejected', async () => {
    // Build a chain N0 → N1 → … → N10 (rooted at N10).
    const chain: Record<string, string | null> = {};
    for (let i = 0; i < 10; i++) {
      chain[`N${i}`] = `N${i + 1}`;
    }
    chain.N10 = null;
    // Try to attach a new entity (id NEW) under N0 — walker steps N0 → N1 → … N10 (11 levels deep including N0).
    const result = await validateParentChain('NEW', 'N0', fakeClient(chain));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MAX_DEPTH_EXCEEDED');
  });

  it('5. valid corporate trustee — Pty Ltd → Trust', async () => {
    // Trust's parent = Pty Ltd; Pty Ltd is a root. Setting it on
    // creation: entityId=null, proposedParentId='PTY'.
    const chain: Record<string, string | null> = {
      PTY: null, // Pty Ltd is the trustee — no parent.
    };
    const result = await validateParentChain(null, 'PTY', fakeClient(chain));
    expect(result.ok).toBe(true);
  });

  it('6. valid SMSF corporate trustee — Pty Ltd → SMSF', async () => {
    const chain: Record<string, string | null> = {
      PTY_SMSF: null,
    };
    const result = await validateParentChain(null, 'PTY_SMSF', fakeClient(chain));
    expect(result.ok).toBe(true);
  });

  it('7. valid reparent without cycle — A → B exists; create C; set B parent to C', async () => {
    // Initial state: A → B (B is root).
    // We then create a new C (root). Now reparent B's parent to C.
    // Walker from C: C is root → ok. Chain becomes B → C.
    const chain: Record<string, string | null> = {
      A: 'B',
      B: null,
      C: null,
    };
    const result = await validateParentChain('B', 'C', fakeClient(chain));
    expect(result.ok).toBe(true);
  });

  it('8. walker terminates correctly on a 3-level valid chain', async () => {
    // Trust → Pty Ltd (corporate trustee). Setting it on a brand-new
    // Trust child entity (entityId=null) under "Trust" should walk:
    // Trust → Pty Ltd → null. Two-level depth, valid.
    const chain: Record<string, string | null> = {
      Trust: 'PtyLtd',
      PtyLtd: null,
    };
    const result = await validateParentChain(null, 'Trust', fakeClient(chain));
    expect(result.ok).toBe(true);
  });

  describe('extra coverage (not in §7.5 but worth pinning)', () => {
    it('null proposedParentId — trivially ok', async () => {
      const result = await validateParentChain('A', null, fakeClient({}));
      expect(result.ok).toBe(true);
    });

    it('parent id not found — surfaces PARENT_NOT_FOUND', async () => {
      const result = await validateParentChain('A', 'GHOST', fakeClient({ A: null }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('PARENT_NOT_FOUND');
    });

    it('detects cyclic chain that did NOT include entityId (already-broken state)', async () => {
      // X → Y → X (two unrelated rows that already form a cycle).
      const chain: Record<string, string | null> = {
        X: 'Y',
        Y: 'X',
      };
      // Try to attach NEW under X → walker visits X, then Y, then X again.
      // entityId='NEW' is never seen, but visited.has('X') triggers.
      const result = await validateParentChain('NEW', 'X', fakeClient(chain));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('CYCLE_DETECTED');
    });
  });
});
