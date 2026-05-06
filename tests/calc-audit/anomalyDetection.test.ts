/**
 * Phase 41i.5 — L2 anomaly detection tests.
 *
 * Pure-logic tests for the two detection patterns. The DB-touching
 * `scanForAnomalies()` orchestrator is exercised via the helpers
 * here; full end-to-end via DB lands when a Prisma mock layer ships.
 */

import { describe, it, expect } from 'vitest';
import {
  detectHighFrequencyPatterns,
  detectRegressionPattern,
  DEFAULT_HIGH_FREQUENCY_THRESHOLD,
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_STABLE_PERIOD_DAYS,
  DEFAULT_REGRESSION_GAP_DAYS,
} from '@/lib/calc-audit/anomalyDetection';

const NOW = new Date('2026-05-07T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const f = (engineName: string, daysAgo: number) => ({
  engineName,
  detectedAt: new Date(NOW.getTime() - daysAgo * DAY),
});

// ============================================================
// detectHighFrequencyPatterns
// ============================================================

describe('detectHighFrequencyPatterns', () => {
  const baseOptions = {
    lookbackDays: 7,
    threshold: 5,
    detectedAt: NOW,
  };

  it('returns empty when no engine exceeds threshold', () => {
    const findings = [
      f('tax.capTracker', 1),
      f('tax.capTracker', 2),
      f('tax.gstCalculator', 1),
    ];
    const out = detectHighFrequencyPatterns(findings, baseOptions);
    expect(out).toEqual([]);
  });

  it('flags an engine with > threshold findings', () => {
    const findings = [
      f('tax.capTracker', 1),
      f('tax.capTracker', 2),
      f('tax.capTracker', 3),
      f('tax.capTracker', 4),
      f('tax.capTracker', 5),
      f('tax.capTracker', 6), // 6 findings, threshold 5
    ];
    const out = detectHighFrequencyPatterns(findings, baseOptions);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('HIGH_FREQUENCY');
    expect(out[0]!.engineName).toBe('tax.capTracker');
    expect(out[0]!.severity).toBe('MEDIUM');
  });

  it('boundary case — exactly threshold count does NOT fire (uses >, not >=)', () => {
    const findings = [
      f('tax.capTracker', 1),
      f('tax.capTracker', 2),
      f('tax.capTracker', 3),
      f('tax.capTracker', 4),
      f('tax.capTracker', 5), // exactly 5
    ];
    const out = detectHighFrequencyPatterns(findings, { ...baseOptions, threshold: 5 });
    expect(out).toEqual([]);
  });

  it('escalates to HIGH severity when count > 2× threshold', () => {
    // threshold 5; 11 findings (= 2.2× threshold)
    const findings = Array.from({ length: 11 }, (_, i) => f('tax.gstCalculator', i + 1));
    const out = detectHighFrequencyPatterns(findings, baseOptions);
    expect(out[0]!.severity).toBe('HIGH');
  });

  it('handles multiple engines independently', () => {
    const findings = [
      ...Array.from({ length: 6 }, (_, i) => f('tax.capTracker', i + 1)),
      ...Array.from({ length: 7 }, (_, i) => f('tax.gstCalculator', i + 1)),
      f('tax.div7aClassifier', 1), // only 1 — won't fire
    ];
    const out = detectHighFrequencyPatterns(findings, baseOptions);
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.engineName).sort()).toEqual([
      'tax.capTracker',
      'tax.gstCalculator',
    ]);
  });

  it('evidence includes findingCount + first/last detected dates', () => {
    const findings = [
      f('tax.capTracker', 1),
      f('tax.capTracker', 2),
      f('tax.capTracker', 3),
      f('tax.capTracker', 4),
      f('tax.capTracker', 5),
      f('tax.capTracker', 6),
    ];
    const out = detectHighFrequencyPatterns(findings, baseOptions);
    const evidence = out[0]!.evidence;
    expect(evidence.findingCount).toBe(6);
    expect(evidence.threshold).toBe(5);
    expect(evidence.lookbackDays).toBe(7);
    expect(typeof evidence.firstDetected).toBe('string');
    expect(typeof evidence.lastDetected).toBe('string');
  });
});

// ============================================================
// detectRegressionPattern
// ============================================================

describe('detectRegressionPattern', () => {
  const baseOptions = {
    engineName: 'tax.capTracker',
    lookbackDays: 7,
    stablePeriodDays: 30,
    regressionGapDays: 14,
    detectedAt: NOW,
  };

  it('fires when engine had a long quiet period before recent finding', () => {
    const earliestRecent = { detectedAt: new Date(NOW.getTime() - 2 * DAY) };
    // Prior finding 60 days ago — well before the 30-day stable threshold
    const priorFinding = { detectedAt: new Date(NOW.getTime() - 60 * DAY) };
    const out = detectRegressionPattern(earliestRecent, priorFinding, baseOptions);
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('REGRESSION_AFTER_STABLE_PERIOD');
    expect(out!.severity).toBe('HIGH');
  });

  it('fires when engine has NO prior findings (first-ever findings)', () => {
    const earliestRecent = { detectedAt: new Date(NOW.getTime() - 2 * DAY) };
    const out = detectRegressionPattern(earliestRecent, null, baseOptions);
    expect(out).not.toBeNull();
    expect(out!.summary).toMatch(/first-ever/);
  });

  it('does NOT fire when prior finding is recent (no stable period)', () => {
    const earliestRecent = { detectedAt: new Date(NOW.getTime() - 2 * DAY) };
    // Prior finding 20 days ago — NOT older than 30-day stable threshold
    const priorFinding = { detectedAt: new Date(NOW.getTime() - 20 * DAY) };
    const out = detectRegressionPattern(earliestRecent, priorFinding, baseOptions);
    expect(out).toBeNull();
  });

  it('does NOT fire when gap is below regressionGapDays', () => {
    const earliestRecent = { detectedAt: new Date(NOW.getTime() - 2 * DAY) };
    // Stable period: 35 days quiet, but gap from prior to recent is only 10 days
    const priorFinding = { detectedAt: new Date(NOW.getTime() - 12 * DAY) };
    // priorFinding at 12 days ago is INSIDE the lookback window (7), so caller filters it out.
    // This exercises the "prior is inside lookback" guard.
    const out = detectRegressionPattern(earliestRecent, priorFinding, baseOptions);
    expect(out).toBeNull();
  });

  it('evidence includes gap days + prior + new finding dates', () => {
    const earliestRecent = { detectedAt: new Date(NOW.getTime() - 2 * DAY) };
    const priorFinding = { detectedAt: new Date(NOW.getTime() - 50 * DAY) };
    const out = detectRegressionPattern(earliestRecent, priorFinding, baseOptions);
    expect(out!.evidence.gapDays).toBeGreaterThan(40);
    expect(out!.evidence.firstNewFinding).toContain('2026-05-05');
    expect(out!.evidence.previousFinding).toContain('2026-03-18');
  });

  it('returns null when prior finding is INSIDE the lookback window', () => {
    const earliestRecent = { detectedAt: new Date(NOW.getTime() - 2 * DAY) };
    // Prior finding 3 days ago — inside the 7-day lookback
    const priorFinding = { detectedAt: new Date(NOW.getTime() - 3 * DAY) };
    const out = detectRegressionPattern(earliestRecent, priorFinding, baseOptions);
    expect(out).toBeNull();
  });
});

// ============================================================
// Default constants
// ============================================================

describe('Default tuning constants', () => {
  it('lookback default is 7 days', () => {
    expect(DEFAULT_LOOKBACK_DAYS).toBe(7);
  });

  it('high-frequency threshold default is 5', () => {
    expect(DEFAULT_HIGH_FREQUENCY_THRESHOLD).toBe(5);
  });

  it('stable period default is 30 days', () => {
    expect(DEFAULT_STABLE_PERIOD_DAYS).toBe(30);
  });

  it('regression gap default is 14 days', () => {
    expect(DEFAULT_REGRESSION_GAP_DAYS).toBe(14);
  });

  it('stable period > regression gap (sanity — stable must outlast gap)', () => {
    expect(DEFAULT_STABLE_PERIOD_DAYS).toBeGreaterThan(DEFAULT_REGRESSION_GAP_DAYS);
  });
});
