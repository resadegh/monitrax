/**
 * Phase 32B PR3 #9a — Tests for the pure alert engine.
 *
 * The engine is the deterministic core of the Practice alert stream.
 * These tests pin the five v1 trigger conditions + the thresholds +
 * the stateful-trigger graceful-no-op behaviour. The DB-touching
 * sweep runner is integration-tested separately; this file covers
 * `computeAlerts` only.
 */

import { describe, it, expect } from 'vitest';
import {
  computeAlerts,
  ALL_ENGINE_TRIGGER_KINDS,
  HEALTH_DROP_THRESHOLD,
  LVR_REFINANCE_CEILING,
  LVR_MIN_USABLE_EQUITY_AUD,
  type AlertEngineSnapshot,
  type AlertEnginePriorState,
  type AlertTriggerKind,
} from '@/lib/portal/alerts/alertEngine';

// A "healthy" baseline snapshot — no triggers should fire from this.
const HEALTHY: AlertEngineSnapshot = {
  monthlyCashflow: 2_500,
  monthlyIncome: 9_000,
  monthlyExpenses: 6_500,
  emergencyFundMonths: 4.2,
  propertyPortfolioValue: 1_200_000,
  propertyPortfolioEquity: 350_000,
  mortgageBalance: 850_000, // LVR ≈ 70.8% — in the refinance window, but...
  healthScore: 78,
  trailStage: 'I',
};

const ALL: readonly AlertTriggerKind[] = ALL_ENGINE_TRIGGER_KINDS;

describe('alertEngine — CASHFLOW_NEGATIVE', () => {
  it('does not fire when cashflow is positive or zero', () => {
    expect(computeAlerts({ snapshot: { ...HEALTHY, monthlyCashflow: 0 }, enabledTriggers: ['CASHFLOW_NEGATIVE'] })).toHaveLength(0);
    expect(computeAlerts({ snapshot: { ...HEALTHY, monthlyCashflow: 50 }, enabledTriggers: ['CASHFLOW_NEGATIVE'] })).toHaveLength(0);
  });

  it('fires critical when cashflow is negative', () => {
    const alerts = computeAlerts({ snapshot: { ...HEALTHY, monthlyCashflow: -340 }, enabledTriggers: ['CASHFLOW_NEGATIVE'] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].triggerKind).toBe('CASHFLOW_NEGATIVE');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].payload.monthlyCashflow).toBe(-340);
  });
});

describe('alertEngine — EMERGENCY_FUND_LOW', () => {
  it('does not fire at exactly 1 month or above', () => {
    expect(computeAlerts({ snapshot: { ...HEALTHY, emergencyFundMonths: 1 }, enabledTriggers: ['EMERGENCY_FUND_LOW'] })).toHaveLength(0);
    expect(computeAlerts({ snapshot: { ...HEALTHY, emergencyFundMonths: 1.5 }, enabledTriggers: ['EMERGENCY_FUND_LOW'] })).toHaveLength(0);
  });

  it('fires critical below 1 month', () => {
    const alerts = computeAlerts({ snapshot: { ...HEALTHY, emergencyFundMonths: 0.7 }, enabledTriggers: ['EMERGENCY_FUND_LOW'] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].triggerKind).toBe('EMERGENCY_FUND_LOW');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].payload.emergencyFundMonths).toBe(0.7);
  });
});

describe('alertEngine — LVR_REFINANCE_WINDOW', () => {
  it('does not fire when LVR is at or above the ceiling', () => {
    // LVR exactly 80%: 960k / 1.2m
    const at = computeAlerts({ snapshot: { ...HEALTHY, mortgageBalance: 960_000, propertyPortfolioEquity: 240_000 }, enabledTriggers: ['LVR_REFINANCE_WINDOW'] });
    expect(at).toHaveLength(0);
    // LVR above 80%
    const above = computeAlerts({ snapshot: { ...HEALTHY, mortgageBalance: 1_080_000, propertyPortfolioEquity: 120_000 }, enabledTriggers: ['LVR_REFINANCE_WINDOW'] });
    expect(above).toHaveLength(0);
  });

  it('does not fire when there is no property portfolio or no mortgage', () => {
    expect(computeAlerts({ snapshot: { ...HEALTHY, propertyPortfolioValue: 0, mortgageBalance: 0 }, enabledTriggers: ['LVR_REFINANCE_WINDOW'] })).toHaveLength(0);
    expect(computeAlerts({ snapshot: { ...HEALTHY, mortgageBalance: 0 }, enabledTriggers: ['LVR_REFINANCE_WINDOW'] })).toHaveLength(0);
  });

  it('does not fire when usable equity is below the floor', () => {
    // LVR 75% but only $10k equity — not worth flagging
    const alerts = computeAlerts({
      snapshot: { ...HEALTHY, propertyPortfolioValue: 40_000, mortgageBalance: 30_000, propertyPortfolioEquity: 10_000 },
      enabledTriggers: ['LVR_REFINANCE_WINDOW'],
    });
    expect(alerts).toHaveLength(0);
    expect(LVR_MIN_USABLE_EQUITY_AUD).toBe(20_000);
  });

  it('fires opportunity when LVR is in the window with meaningful equity', () => {
    const alerts = computeAlerts({
      // LVR ≈ 70.8% (850k / 1.2m), $350k equity
      snapshot: { ...HEALTHY, mortgageBalance: 850_000, propertyPortfolioEquity: 350_000 },
      enabledTriggers: ['LVR_REFINANCE_WINDOW'],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].triggerKind).toBe('LVR_REFINANCE_WINDOW');
    expect(alerts[0].severity).toBe('opportunity');
    expect(alerts[0].payload.lvr).toBe(71); // rounded
    expect(LVR_REFINANCE_CEILING).toBe(80);
  });
});

describe('alertEngine — HEALTH_DROP (stateful)', () => {
  it('does not fire without a prior baseline', () => {
    expect(computeAlerts({ snapshot: { ...HEALTHY, healthScore: 40 }, enabledTriggers: ['HEALTH_DROP'] })).toHaveLength(0);
    expect(computeAlerts({ snapshot: { ...HEALTHY, healthScore: 40 }, prior: null, enabledTriggers: ['HEALTH_DROP'] })).toHaveLength(0);
    expect(computeAlerts({ snapshot: { ...HEALTHY, healthScore: 40 }, prior: { healthScore: null, trailStage: 'R' }, enabledTriggers: ['HEALTH_DROP'] })).toHaveLength(0);
  });

  it('does not fire when the drop is below threshold', () => {
    const prior: AlertEnginePriorState = { healthScore: 78, trailStage: 'I' };
    // drop of 9 — just under
    const alerts = computeAlerts({ snapshot: { ...HEALTHY, healthScore: 69 }, prior, enabledTriggers: ['HEALTH_DROP'] });
    expect(alerts).toHaveLength(0);
    expect(HEALTH_DROP_THRESHOLD).toBe(10);
  });

  it('fires critical at exactly the threshold drop', () => {
    const prior: AlertEnginePriorState = { healthScore: 78, trailStage: 'I' };
    const alerts = computeAlerts({ snapshot: { ...HEALTHY, healthScore: 68 }, prior, enabledTriggers: ['HEALTH_DROP'] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].triggerKind).toBe('HEALTH_DROP');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].payload.healthDrop).toBe(10);
    expect(alerts[0].payload.priorHealthScore).toBe(78);
  });

  it('does not fire when health improved', () => {
    const prior: AlertEnginePriorState = { healthScore: 50, trailStage: 'R' };
    expect(computeAlerts({ snapshot: { ...HEALTHY, healthScore: 78 }, prior, enabledTriggers: ['HEALTH_DROP'] })).toHaveLength(0);
  });
});

describe('alertEngine — TRAIL_ADVANCED (stateful)', () => {
  it('does not fire without a prior baseline', () => {
    expect(computeAlerts({ snapshot: { ...HEALTHY, trailStage: 'R' }, enabledTriggers: ['TRAIL_ADVANCED'] })).toHaveLength(0);
    expect(computeAlerts({ snapshot: { ...HEALTHY, trailStage: 'R' }, prior: { healthScore: 50, trailStage: null }, enabledTriggers: ['TRAIL_ADVANCED'] })).toHaveLength(0);
  });

  it('does not fire when the stage is unchanged', () => {
    const prior: AlertEnginePriorState = { healthScore: 70, trailStage: 'R' };
    expect(computeAlerts({ snapshot: { ...HEALTHY, trailStage: 'R' }, prior, enabledTriggers: ['TRAIL_ADVANCED'] })).toHaveLength(0);
  });

  it('does not fire on regression', () => {
    const prior: AlertEnginePriorState = { healthScore: 70, trailStage: 'I' };
    expect(computeAlerts({ snapshot: { ...HEALTHY, trailStage: 'R' }, prior, enabledTriggers: ['TRAIL_ADVANCED'] })).toHaveLength(0);
  });

  it('fires milestone on advancement (T → R)', () => {
    const prior: AlertEnginePriorState = { healthScore: 55, trailStage: 'T' };
    const alerts = computeAlerts({ snapshot: { ...HEALTHY, trailStage: 'R' }, prior, enabledTriggers: ['TRAIL_ADVANCED'] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].triggerKind).toBe('TRAIL_ADVANCED');
    expect(alerts[0].severity).toBe('milestone');
    expect(alerts[0].payload.fromStage).toBe('T');
    expect(alerts[0].payload.toStage).toBe('R');
    expect(alerts[0].headline).toContain('TRACK → REDUCE');
  });

  it('fires on a multi-stage jump (R → I)', () => {
    const prior: AlertEnginePriorState = { healthScore: 60, trailStage: 'R' };
    const alerts = computeAlerts({ snapshot: { ...HEALTHY, trailStage: 'I' }, prior, enabledTriggers: ['TRAIL_ADVANCED'] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].payload.fromStage).toBe('R');
    expect(alerts[0].payload.toStage).toBe('I');
  });
});

describe('alertEngine — enabledTriggers gating', () => {
  it('only emits alerts whose kind is in enabledTriggers', () => {
    const distressed: AlertEngineSnapshot = {
      ...HEALTHY,
      monthlyCashflow: -500,
      emergencyFundMonths: 0.3,
    };
    // Both CASHFLOW_NEGATIVE and EMERGENCY_FUND_LOW would fire, but
    // only CASHFLOW_NEGATIVE is enabled.
    const alerts = computeAlerts({ snapshot: distressed, enabledTriggers: ['CASHFLOW_NEGATIVE'] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].triggerKind).toBe('CASHFLOW_NEGATIVE');
  });

  it('emits zero alerts when enabledTriggers is empty', () => {
    const distressed: AlertEngineSnapshot = { ...HEALTHY, monthlyCashflow: -500, emergencyFundMonths: 0.1 };
    expect(computeAlerts({ snapshot: distressed, enabledTriggers: [] })).toHaveLength(0);
  });

  it('emits multiple alerts in canonical kind order', () => {
    const distressed: AlertEngineSnapshot = { ...HEALTHY, monthlyCashflow: -500, emergencyFundMonths: 0.3, healthScore: 40 };
    const prior: AlertEnginePriorState = { healthScore: 75, trailStage: 'A' };
    const alerts = computeAlerts({ snapshot: distressed, prior, enabledTriggers: ALL });
    const kinds = alerts.map((a) => a.triggerKind);
    // CASHFLOW_NEGATIVE comes before EMERGENCY_FUND_LOW comes before HEALTH_DROP
    expect(kinds).toContain('CASHFLOW_NEGATIVE');
    expect(kinds).toContain('EMERGENCY_FUND_LOW');
    expect(kinds).toContain('HEALTH_DROP');
    expect(kinds.indexOf('CASHFLOW_NEGATIVE')).toBeLessThan(kinds.indexOf('EMERGENCY_FUND_LOW'));
    expect(kinds.indexOf('EMERGENCY_FUND_LOW')).toBeLessThan(kinds.indexOf('HEALTH_DROP'));
  });
});

describe('alertEngine — healthy baseline produces nothing', () => {
  it('a healthy snapshot with a matching prior fires no alerts', () => {
    const prior: AlertEnginePriorState = { healthScore: 78, trailStage: 'I' };
    // Reset LVR to be clearly NOT in the window for this test
    const fullyHealthy: AlertEngineSnapshot = { ...HEALTHY, mortgageBalance: 1_080_000, propertyPortfolioEquity: 120_000 };
    expect(computeAlerts({ snapshot: fullyHealthy, prior, enabledTriggers: ALL })).toHaveLength(0);
  });
});
