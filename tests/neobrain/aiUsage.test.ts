import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBreakdownRows, successRatePct } from '@/lib/ai/usage/summariseAiUsage';

/**
 * Neobrain Phase 54 — AI-usage telemetry. Pins the pure aggregation math
 * (cost share + success rate) and the fire-and-forget recorder's two
 * load-bearing guarantees: it coerces a malformed payload and it NEVER throws.
 */

describe('toBreakdownRows', () => {
  it('attaches cost share and sorts by cost descending', () => {
    const rows = [
      { key: 'cfo-advisor', calls: 5, totalTokens: 1000, estimatedCostUsd: 2 },
      { key: 'categorisation', calls: 500, totalTokens: 50000, estimatedCostUsd: 8 },
    ];
    const out = toBreakdownRows(rows, 10);
    expect(out.map((r) => r.key)).toEqual(['categorisation', 'cfo-advisor']); // biggest spender first
    expect(out[0].costSharePct).toBe(80);
    expect(out[1].costSharePct).toBe(20);
    expect(out.reduce((s, r) => s + r.costSharePct, 0)).toBe(100);
  });

  it('returns 0 shares when total cost is 0 (no divide-by-zero)', () => {
    const out = toBreakdownRows([{ key: 'unknown', calls: 0, totalTokens: 0, estimatedCostUsd: 0 }], 0);
    expect(out[0].costSharePct).toBe(0);
  });
});

describe('successRatePct', () => {
  it('is 100 when there were no calls', () => {
    expect(successRatePct(0, 0)).toBe(100);
  });
  it('computes the rate for a mix', () => {
    expect(successRatePct(10, 2)).toBe(80);
  });
  it('is 0 when every call failed', () => {
    expect(successRatePct(4, 4)).toBe(0);
  });
});

// --- recordAiUsage: coercion + never-throws -------------------------------

const createMock = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: { aiUsageEvent: { create: (args: unknown) => createMock(args) } },
}));

import { recordAiUsage } from '@/lib/ai/usage/recordAiUsage';

describe('recordAiUsage', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({});
  });

  it('coerces NaN/negative token counts and cost to 0 (never writes garbage)', () => {
    recordAiUsage({
      surface: 'categorisation',
      model: 'gemini-3.5-flash',
      promptTokens: Number.NaN,
      completionTokens: -50,
      totalTokens: Number.NaN,
      estimatedCostUsd: -1,
      userId: 'u1',
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data;
    expect(data.promptTokens).toBe(0);
    expect(data.completionTokens).toBe(0);
    expect(data.totalTokens).toBe(0);
    expect(data.estimatedCostUsd).toBe(0);
    expect(data.success).toBe(true); // defaults to true
  });

  it('passes through valid values and rounds fractional tokens', () => {
    recordAiUsage({
      surface: 'cfo-advisor',
      model: 'gemini-2.5-pro',
      promptTokens: 1200.6,
      completionTokens: 300,
      totalTokens: 1500.6,
      estimatedCostUsd: 0.0123,
      success: false,
    });
    const data = createMock.mock.calls[0][0].data;
    expect(data.promptTokens).toBe(1201);
    expect(data.estimatedCostUsd).toBe(0.0123);
    expect(data.userId).toBeNull(); // omitted → null (system call)
    expect(data.success).toBe(false);
  });

  it('NEVER throws even if the DB write rejects (fire-and-forget contract)', async () => {
    createMock.mockRejectedValue(new Error('db down'));
    expect(() =>
      recordAiUsage({
        surface: 'unknown',
        model: 'gemini-3.5-flash',
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        estimatedCostUsd: 0.001,
      }),
    ).not.toThrow();
    // let the rejected promise settle to prove the swallow handler catches it
    await new Promise((r) => setTimeout(r, 0));
  });
});
