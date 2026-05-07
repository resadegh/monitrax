/**
 * Phase 41i.6c — surfaceAudit harness tests.
 *
 * Tests the pure-logic branches of `runSurfaceAuditForUser` with
 * mocked Prisma + synthetic descriptors. Covers:
 *   - canonical-source throw → HIGH severity finding
 *   - extractRenderedValue throw → HIGH severity finding
 *   - null with skipWhenNull → SKIPPED
 *   - null without skipWhenNull → MEDIUM finding
 *   - 0 with skipWhenZero → SKIPPED
 *   - sane positive value → OK (no finding)
 *   - dedup pattern: existing OPEN finding → update (not create)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SurfaceDescriptor } from '@/lib/calc-audit/surfaces';

// Mock Prisma BEFORE importing the harness (so the harness picks up the mock).
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  default: {
    calcAuditFinding: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  },
}));

import { runSurfaceAuditForUser } from '@/lib/calc-audit/surfaceAudit';

beforeEach(() => {
  mockFindFirst.mockReset().mockResolvedValue(null);
  mockUpdate.mockReset().mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'fnd-existing', ...data, summary: (data as { summary: string }).summary }),
  );
  mockCreate.mockReset().mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'fnd-new', ...data, summary: (data as { summary: string }).summary }),
  );
  mockUserFindMany.mockReset().mockResolvedValue([]);
});

const baseDescriptor = (overrides: Partial<SurfaceDescriptor> = {}): SurfaceDescriptor => ({
  surfaceId: 'tile.test.foo',
  description: 'Test descriptor for harness unit tests',
  route: '/dashboard/test',
  kind: 'AUD',
  canonicalSource: {
    service: 'lib/services/testService.ts',
    method: 'getTestData',
    fieldPath: 'foo.bar',
  },
  invokeCanonicalSource: vi.fn().mockResolvedValue({ foo: { bar: 1000 } }),
  extractRenderedValue: (snap) =>
    (snap as { foo?: { bar?: number } } | null)?.foo?.bar ?? null,
  ...overrides,
});

describe('Phase 41i.6c — runSurfaceAuditForUser outcomes', () => {
  describe('canonical source throws', () => {
    it('records a HIGH severity finding when invokeCanonicalSource throws', async () => {
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      });
      const outcomes = await runSurfaceAuditForUser('user-1', { descriptors: [descriptor] });
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].outcome).toBe('FINDING');
      expect(outcomes[0].severity).toBe('HIGH');
      expect(outcomes[0].errorMessage).toContain('Database connection failed');
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('finding summary includes the surfaceId + canonical source', async () => {
      const descriptor = baseDescriptor({
        surfaceId: 'tile.cashflow.monthly',
        invokeCanonicalSource: vi.fn().mockRejectedValue(new Error('Boom')),
      });
      await runSurfaceAuditForUser('user-2', { descriptors: [descriptor] });
      const createCall = mockCreate.mock.calls[0]?.[0] as { data: { summary: string } };
      expect(createCall.data.summary).toContain('tile.cashflow.monthly');
      expect(createCall.data.summary).toContain('lib/services/testService.ts');
    });
  });

  describe('extractRenderedValue throws', () => {
    it('records HIGH severity when projection throws', async () => {
      const descriptor = baseDescriptor({
        extractRenderedValue: () => {
          throw new TypeError('Cannot read properties of undefined');
        },
      });
      const outcomes = await runSurfaceAuditForUser('user-3', { descriptors: [descriptor] });
      expect(outcomes[0].outcome).toBe('FINDING');
      expect(outcomes[0].severity).toBe('HIGH');
      expect(outcomes[0].errorMessage).toContain('Cannot read properties');
    });
  });

  describe('null handling', () => {
    it('SKIPS when canonical is null AND descriptor allows skipWhenNull', async () => {
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockResolvedValue({ foo: {} }),
        renderConditions: { skipWhenNull: true },
      });
      const outcomes = await runSurfaceAuditForUser('user-4', { descriptors: [descriptor] });
      expect(outcomes[0].outcome).toBe('SKIPPED');
      expect(outcomes[0].skipReason).toBe('NULL');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('records MEDIUM finding when canonical is null AND skipWhenNull is NOT set', async () => {
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockResolvedValue({ foo: {} }),
        renderConditions: undefined,
      });
      const outcomes = await runSurfaceAuditForUser('user-5', { descriptors: [descriptor] });
      expect(outcomes[0].outcome).toBe('FINDING');
      expect(outcomes[0].severity).toBe('MEDIUM');
      expect(outcomes[0].canonicalValue).toBeNull();
    });
  });

  describe('zero handling', () => {
    it('SKIPS when canonical is 0 AND descriptor allows skipWhenZero', async () => {
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockResolvedValue({ foo: { bar: 0 } }),
        renderConditions: { skipWhenZero: true },
      });
      const outcomes = await runSurfaceAuditForUser('user-6', { descriptors: [descriptor] });
      expect(outcomes[0].outcome).toBe('SKIPPED');
      expect(outcomes[0].skipReason).toBe('ZERO');
    });

    it('does NOT skip 0 when skipWhenZero is not set', async () => {
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockResolvedValue({ foo: { bar: 0 } }),
      });
      const outcomes = await runSurfaceAuditForUser('user-7', { descriptors: [descriptor] });
      expect(outcomes[0].outcome).toBe('OK');
      expect(outcomes[0].canonicalValue).toBe(0);
    });
  });

  describe('happy path', () => {
    it('returns OK with the canonical value when source + extractor succeed', async () => {
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockResolvedValue({ foo: { bar: 12345.67 } }),
      });
      const outcomes = await runSurfaceAuditForUser('user-8', { descriptors: [descriptor] });
      expect(outcomes[0].outcome).toBe('OK');
      expect(outcomes[0].canonicalValue).toBe(12345.67);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('iterates multiple descriptors in order', async () => {
      const d1 = baseDescriptor({ surfaceId: 'tile.a' });
      const d2 = baseDescriptor({ surfaceId: 'tile.b' });
      const d3 = baseDescriptor({ surfaceId: 'tile.c' });
      const outcomes = await runSurfaceAuditForUser('user-9', {
        descriptors: [d1, d2, d3],
      });
      expect(outcomes.map((o) => o.surfaceId)).toEqual(['tile.a', 'tile.b', 'tile.c']);
    });
  });

  describe('dedup pattern', () => {
    it('UPDATES an existing OPEN finding instead of creating a duplicate', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 'fnd-existing-123' });
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockRejectedValue(new Error('Boom')),
      });
      await runSurfaceAuditForUser('user-10', { descriptors: [descriptor] });
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockUpdate.mock.calls[0]?.[0]).toMatchObject({
        where: { id: 'fnd-existing-123' },
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('CREATES new finding when no existing OPEN row matches', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const descriptor = baseDescriptor({
        invokeCanonicalSource: vi.fn().mockRejectedValue(new Error('Boom')),
      });
      await runSurfaceAuditForUser('user-11', { descriptors: [descriptor] });
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('finds existing rows scoped to the same (source, engineName, userId)', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const descriptor = baseDescriptor({
        surfaceId: 'tile.scoped.test',
        invokeCanonicalSource: vi.fn().mockRejectedValue(new Error('Boom')),
      });
      await runSurfaceAuditForUser('user-scoped', { descriptors: [descriptor] });
      const findFirstCall = mockFindFirst.mock.calls[0]?.[0] as {
        where: { source: string; engineName: string; userId: string };
      };
      expect(findFirstCall.where.source).toBe('L4_SURFACE_AUDIT');
      expect(findFirstCall.where.engineName).toBe('tile.scoped.test');
      expect(findFirstCall.where.userId).toBe('user-scoped');
    });
  });
});
