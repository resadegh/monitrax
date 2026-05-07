/**
 * Phase 41i.3b — userAudit harness tests.
 *
 * Tests `runUserAudit` with a mocked Prisma + a synthetic
 * UserAuditAdapter + a synthetic CalcEngine. Covers each branch:
 *   - fetchInput throws → HIGH severity finding
 *   - fetchInput returns null → SKIPPED (NO_DATA)
 *   - engine.execute throws → HIGH severity finding
 *   - validateOutput returns ok:false → FINDING with adapter severity
 *   - validateOutput returns ok:true → OK (no finding)
 *   - dedup pattern: existing OPEN row → update (not create)
 *   - missing engine in calcEngineRegistry → SKIPPED (NO_ADAPTER)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserAuditAdapter } from '@/lib/calc-audit/userAudit/types';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/lib/db', () => ({
  default: {
    calcAuditFinding: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const mockEngineGet = vi.fn();
vi.mock('@/lib/calc-audit/registry', () => ({
  calcEngineRegistry: {
    get: (name: string) => mockEngineGet(name),
  },
}));

const mockAdapterList = vi.fn();
vi.mock('@/lib/calc-audit/userAudit/registry', () => ({
  userAuditAdapterRegistry: {
    list: () => mockAdapterList(),
  },
}));

import { runUserAudit, recordUserAuditFinding } from '@/lib/calc-audit/userAudit/harness';

beforeEach(() => {
  mockFindFirst.mockReset().mockResolvedValue(null);
  mockUpdate.mockReset().mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'fnd-existing', ...data }),
  );
  mockCreate.mockReset().mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'fnd-new', ...data }),
  );
  mockEngineGet.mockReset();
  mockAdapterList.mockReset().mockReturnValue([]);
});

const baseAdapter = (
  overrides: Partial<UserAuditAdapter<unknown, unknown>> = {},
): UserAuditAdapter<unknown, unknown> => ({
  engineName: 'test.engine',
  fetchInput: vi.fn().mockResolvedValue({ value: 100 }),
  validateOutput: vi.fn().mockReturnValue({ ok: true }),
  ...overrides,
});

const baseEngine = (executeImpl: (input: unknown) => unknown = (i) => i) => ({
  name: 'test.engine',
  description: 'test',
  category: 'CORE',
  sourcePath: 'test.ts',
  execute: vi.fn().mockImplementation(executeImpl),
  fixtures: [{ name: 'fx', input: {}, expected: {} }],
});

describe('Phase 41i.3b — runUserAudit outcomes', () => {
  it('records HIGH severity when fetchInput throws', async () => {
    const adapter = baseAdapter({
      fetchInput: vi.fn().mockRejectedValue(new Error('Database connection lost')),
    });
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(baseEngine());

    const report = await runUserAudit('user-1');

    expect(report.outcomes).toHaveLength(1);
    expect(report.outcomes[0].outcome).toBe('FINDING');
    expect(report.outcomes[0].severity).toBe('HIGH');
    expect(report.outcomes[0].errorMessage).toContain('Database connection lost');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('SKIPS when fetchInput returns null (NO_DATA)', async () => {
    const adapter = baseAdapter({ fetchInput: vi.fn().mockResolvedValue(null) });
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(baseEngine());

    const report = await runUserAudit('user-2');

    expect(report.outcomes[0].outcome).toBe('SKIPPED');
    expect(report.outcomes[0].skipReason).toBe('NO_DATA');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('SKIPS when engine is not registered (NO_ADAPTER)', async () => {
    const adapter = baseAdapter();
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(undefined);

    const report = await runUserAudit('user-3');

    expect(report.outcomes[0].outcome).toBe('SKIPPED');
    expect(report.outcomes[0].skipReason).toBe('NO_ADAPTER');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('records HIGH severity when engine.execute throws', async () => {
    const adapter = baseAdapter();
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(
      baseEngine(() => {
        throw new TypeError('Cannot read property of undefined');
      }),
    );

    const report = await runUserAudit('user-4');

    expect(report.outcomes[0].outcome).toBe('FINDING');
    expect(report.outcomes[0].severity).toBe('HIGH');
    expect(report.outcomes[0].errorMessage).toContain('Cannot read property');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('records FINDING with adapter severity when validateOutput returns ok:false', async () => {
    const adapter = baseAdapter({
      validateOutput: vi.fn().mockReturnValue({
        ok: false,
        reason: 'netWorth != assets - liabilities',
        severity: 'CRITICAL',
      }),
    });
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(baseEngine());

    const report = await runUserAudit('user-5');

    expect(report.outcomes[0].outcome).toBe('FINDING');
    expect(report.outcomes[0].severity).toBe('CRITICAL');
    expect(report.outcomes[0].summary).toContain('netWorth');
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { failedAssertions: unknown };
    };
    expect(createCall.data.failedAssertions).toBeDefined();
  });

  it('defaults severity to HIGH when validateOutput omits severity', async () => {
    const adapter = baseAdapter({
      validateOutput: vi.fn().mockReturnValue({ ok: false, reason: 'broken' }),
    });
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(baseEngine());

    const report = await runUserAudit('user-6');

    expect(report.outcomes[0].severity).toBe('HIGH');
  });

  it('returns OK when fetchInput + execute + validateOutput all succeed', async () => {
    const adapter = baseAdapter();
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(baseEngine());

    const report = await runUserAudit('user-7');

    expect(report.outcomes[0].outcome).toBe('OK');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns OK when adapter has no validateOutput at all', async () => {
    const adapter = baseAdapter({ validateOutput: undefined });
    mockAdapterList.mockReturnValue([adapter]);
    mockEngineGet.mockReturnValue(baseEngine());

    const report = await runUserAudit('user-8');

    expect(report.outcomes[0].outcome).toBe('OK');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('iterates multiple adapters, returns one outcome each', async () => {
    const a1 = baseAdapter({ engineName: 'core.a' });
    const a2 = baseAdapter({ engineName: 'core.b' });
    const a3 = baseAdapter({ engineName: 'core.c' });
    mockAdapterList.mockReturnValue([a1, a2, a3]);
    mockEngineGet.mockImplementation((name: string) => ({ ...baseEngine(), name }));

    const report = await runUserAudit('user-9');

    expect(report.outcomes.map((o) => o.engineName)).toEqual([
      'core.a',
      'core.b',
      'core.c',
    ]);
    expect(report.totals.enginesScanned).toBe(3);
  });

  it('aggregate totals correctly count findings vs skipped vs ok', async () => {
    const failing = baseAdapter({
      engineName: 'core.fail',
      validateOutput: vi.fn().mockReturnValue({ ok: false, reason: 'bad', severity: 'HIGH' }),
    });
    const skipping = baseAdapter({
      engineName: 'core.skip',
      fetchInput: vi.fn().mockResolvedValue(null),
    });
    const passing = baseAdapter({ engineName: 'core.pass' });
    mockAdapterList.mockReturnValue([failing, skipping, passing]);
    mockEngineGet.mockImplementation((name: string) => ({ ...baseEngine(), name }));

    const report = await runUserAudit('user-10');

    expect(report.totals.enginesScanned).toBe(3);
    expect(report.totals.findingsCreated).toBe(1);
    expect(report.totals.skipped).toBe(1);
    expect(report.totals.errors).toBe(1);
  });
});

describe('Phase 41i.3b — recordUserAuditFinding dedup', () => {
  it('UPDATES existing OPEN finding instead of creating duplicate', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'fnd-existing-123' });
    await recordUserAuditFinding({
      engineName: 'core.netWorth',
      userId: 'user-x',
      severity: 'HIGH',
      summary: 'Test failure',
    });
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'fnd-existing-123' },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('CREATES new finding when no existing OPEN row matches', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await recordUserAuditFinding({
      engineName: 'core.netWorth',
      userId: 'user-y',
      severity: 'MEDIUM',
      summary: 'Test failure',
    });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('scopes the dedup search to (source: L3_ON_DEMAND, engineName, userId)', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await recordUserAuditFinding({
      engineName: 'core.expenseAggregator',
      userId: 'user-scoped',
      severity: 'HIGH',
      summary: 'x',
    });
    const findFirstCall = mockFindFirst.mock.calls[0]?.[0] as {
      where: { source: string; engineName: string; userId: string; resolution: { in: string[] } };
    };
    expect(findFirstCall.where.source).toBe('L3_ON_DEMAND');
    expect(findFirstCall.where.engineName).toBe('core.expenseAggregator');
    expect(findFirstCall.where.userId).toBe('user-scoped');
    expect(findFirstCall.where.resolution.in).toEqual(['OPEN', 'INVESTIGATING']);
  });

  it('creates a new finding with resolution OPEN', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await recordUserAuditFinding({
      engineName: 'core.netWorth',
      userId: 'user-create',
      severity: 'CRITICAL',
      summary: 'identity failure',
    });
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { resolution: string; source: string };
    };
    expect(createCall.data.resolution).toBe('OPEN');
    expect(createCall.data.source).toBe('L3_ON_DEMAND');
  });
});
