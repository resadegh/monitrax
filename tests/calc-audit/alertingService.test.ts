/**
 * Phase 41i.4 — Alerting service tests.
 *
 * Pure-logic locked in: severity threshold map, channel selection
 * based on env config, payload shape. Network calls (Slack webhook,
 * SendGrid) are gated by env vars — when those are unset (default
 * test env), `recordAlert` returns `{ delivered: false }` without
 * making any HTTP requests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveThreshold,
  meetsThreshold,
  recordAlert,
  buildSlackPayload,
  buildEmailBody,
} from '@/lib/calc-audit/alertingService';
import type { CalcAuditFinding } from '@prisma/client';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  // Strip alerting env vars so tests start from a known state.
  delete process.env.CALC_AUDIT_ALERT_THRESHOLD;
  delete process.env.SLACK_CALC_AUDIT_WEBHOOK_URL;
  delete process.env.SENDGRID_API_KEY;
  delete process.env.MONITRAX_CALC_AUDIT_ALERT_EMAIL;
});

afterEach(() => {
  // Restore original env to avoid leaking between tests.
  for (const k of Object.keys(process.env)) {
    if (
      k.startsWith('CALC_AUDIT_') ||
      k.startsWith('SLACK_') ||
      k === 'SENDGRID_API_KEY' ||
      k === 'MONITRAX_CALC_AUDIT_ALERT_EMAIL'
    ) {
      delete process.env[k];
    }
  }
  for (const [k, v] of Object.entries(ORIG_ENV)) {
    if (v !== undefined) process.env[k] = v;
  }
});

const baseFinding = (
  overrides: Partial<CalcAuditFinding> = {},
): CalcAuditFinding => ({
  id: 'test-finding-1',
  detectedAt: new Date('2026-05-07T12:00:00Z'),
  source: 'L1_DIFFERENTIAL',
  engineName: 'tax.capTracker',
  fixtureName: 'FY24-25 individual mid-cap',
  userId: null,
  severity: 'HIGH',
  resolution: 'OPEN',
  summary: 'tax.capTracker::FY24-25 individual mid-cap [FAIL] — concessional cap mismatch',
  failedAssertions: ['Concessional cap is $30,000'],
  errorMessage: null,
  adminNotes: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: new Date('2026-05-07T12:00:00Z'),
  updatedAt: new Date('2026-05-07T12:00:00Z'),
  ...overrides,
});

describe('resolveThreshold', () => {
  it('defaults to HIGH when env unset', () => {
    expect(resolveThreshold()).toBe('HIGH');
  });

  it('honours valid env override', () => {
    process.env.CALC_AUDIT_ALERT_THRESHOLD = 'CRITICAL';
    expect(resolveThreshold()).toBe('CRITICAL');
  });

  it('falls back to HIGH on invalid env value (no throw)', () => {
    process.env.CALC_AUDIT_ALERT_THRESHOLD = 'NOT_A_REAL_LEVEL';
    expect(resolveThreshold()).toBe('HIGH');
  });
});

describe('meetsThreshold', () => {
  it('CRITICAL ≥ HIGH (default threshold) → true', () => {
    expect(meetsThreshold('CRITICAL')).toBe(true);
  });

  it('HIGH ≥ HIGH → true (boundary)', () => {
    expect(meetsThreshold('HIGH')).toBe(true);
  });

  it('MEDIUM ≥ HIGH → false', () => {
    expect(meetsThreshold('MEDIUM')).toBe(false);
  });

  it('LOW ≥ HIGH → false', () => {
    expect(meetsThreshold('LOW')).toBe(false);
  });

  it('INFO ≥ HIGH → false', () => {
    expect(meetsThreshold('INFO')).toBe(false);
  });

  it('honours custom threshold argument over env', () => {
    expect(meetsThreshold('LOW', 'INFO')).toBe(true);
    expect(meetsThreshold('LOW', 'CRITICAL')).toBe(false);
  });
});

describe('recordAlert — threshold gating', () => {
  it('CRITICAL fires (attempted=true) even with no channels configured', async () => {
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'CRITICAL' }),
    });
    expect(r.attempted).toBe(true);
    expect(r.slack.configured).toBe(false);
    expect(r.email.configured).toBe(false);
  });

  it('MEDIUM does NOT fire under default threshold', async () => {
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'MEDIUM' }),
    });
    expect(r.attempted).toBe(false);
    expect(r.slack.delivered).toBe(false);
    expect(r.email.delivered).toBe(false);
  });

  it('LOW does NOT fire under default threshold', async () => {
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'LOW' }),
    });
    expect(r.attempted).toBe(false);
  });

  it('threshold lowered to LOW → MEDIUM finding fires', async () => {
    process.env.CALC_AUDIT_ALERT_THRESHOLD = 'LOW';
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'MEDIUM' }),
    });
    expect(r.attempted).toBe(true);
  });
});

describe('recordAlert — no channels configured (fire-and-forget safety)', () => {
  it('returns gracefully when no env vars set', async () => {
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(r.attempted).toBe(true);
    expect(r.slack.configured).toBe(false);
    expect(r.slack.delivered).toBe(false);
    expect(r.email.configured).toBe(false);
    expect(r.email.delivered).toBe(false);
  });

  it('Slack only configured', async () => {
    process.env.SLACK_CALC_AUDIT_WEBHOOK_URL = 'https://example.invalid/webhook';
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(r.slack.configured).toBe(true);
    // Delivery will fail (invalid host) but the call returns gracefully.
    expect(r.email.configured).toBe(false);
  });

  it('Email only configured (both env vars required)', async () => {
    process.env.SENDGRID_API_KEY = 'SG.fake';
    process.env.MONITRAX_CALC_AUDIT_ALERT_EMAIL = 'audit@monitrax.com.au';
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(r.email.configured).toBe(true);
    expect(r.slack.configured).toBe(false);
  });

  it('Email NOT configured if SENDGRID_API_KEY missing', async () => {
    process.env.MONITRAX_CALC_AUDIT_ALERT_EMAIL = 'audit@monitrax.com.au';
    // No SENDGRID_API_KEY
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(r.email.configured).toBe(false);
  });

  it('Email NOT configured if recipient email missing', async () => {
    process.env.SENDGRID_API_KEY = 'SG.fake';
    // No MONITRAX_CALC_AUDIT_ALERT_EMAIL
    const r = await recordAlert({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(r.email.configured).toBe(false);
  });
});

describe('buildSlackPayload', () => {
  it('CREATED + HIGH includes warning emoji + structured blocks', () => {
    const payload = buildSlackPayload({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(payload.text).toContain(':warning:');
    expect(payload.text).toContain('New finding');
    expect(payload.blocks).toBeDefined();
    expect(payload.blocks!.length).toBeGreaterThan(0);
  });

  it('CRITICAL uses rotating-light emoji', () => {
    const payload = buildSlackPayload({
      trigger: 'CREATED',
      finding: baseFinding({ severity: 'CRITICAL' }),
    });
    expect(payload.text).toContain(':rotating_light:');
  });

  it('ESCALATED_TO_FIX_REQUIRED labels the trigger', () => {
    const payload = buildSlackPayload({
      trigger: 'ESCALATED_TO_FIX_REQUIRED',
      finding: baseFinding({ severity: 'HIGH' }),
    });
    expect(payload.text).toContain('Escalated to FIX_REQUIRED');
  });

  it('includes engine + fixture + severity + summary in fields', () => {
    const payload = buildSlackPayload({
      trigger: 'CREATED',
      finding: baseFinding(),
    });
    const flat = JSON.stringify(payload);
    expect(flat).toContain('tax.capTracker');
    expect(flat).toContain('FY24-25 individual mid-cap');
    expect(flat).toContain('HIGH');
    expect(flat).toContain('concessional cap mismatch');
  });
});

describe('buildEmailBody', () => {
  it('CREATED triggers "new finding has been recorded" copy', () => {
    const body = buildEmailBody({
      trigger: 'CREATED',
      finding: baseFinding(),
    });
    expect(body).toContain('A new finding has been recorded');
  });

  it('ESCALATED_TO_FIX_REQUIRED triggers escalation copy', () => {
    const body = buildEmailBody({
      trigger: 'ESCALATED_TO_FIX_REQUIRED',
      finding: baseFinding(),
    });
    expect(body).toContain('escalated to FIX_REQUIRED');
  });

  it('renders engine + severity + finding id + admin portal link', () => {
    const body = buildEmailBody({
      trigger: 'CREATED',
      finding: baseFinding(),
    });
    expect(body).toContain('tax.capTracker');
    expect(body).toContain('HIGH');
    expect(body).toContain('test-finding-1');
    expect(body).toContain('/admin/calc-audit');
  });

  it('renders failed assertions when present', () => {
    const body = buildEmailBody({
      trigger: 'CREATED',
      finding: baseFinding({
        failedAssertions: ['cap is $30k', 'remaining is $8k'] as unknown as CalcAuditFinding['failedAssertions'],
      }),
    });
    expect(body).toContain('cap is $30k');
    expect(body).toContain('remaining is $8k');
  });
});
