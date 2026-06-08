/**
 * Phase 45 PR 2.B — lever-detail page smoke tests.
 *
 * Lightweight surface + copy verification. The interactive flow (slider
 * changes triggering scenario re-runs, chart hover tooltip, fund
 * selector clicks) is verified via Vercel preview manual + (deferred)
 * Playwright E2E.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PAGE_SOURCE = readFileSync(
  resolve(__dirname, '../../app/dashboard/cfo/what-if/[lever]/page.tsx'),
  'utf8',
);

const CONTEXT_ROUTE_SOURCE = readFileSync(
  resolve(__dirname, '../../app/api/cfo/scenarios/context/route.ts'),
  'utf8',
);

describe('Phase 45 PR 2.B — lever detail page', () => {
  it('imports the tenYearProjection composer for client-side chart', () => {
    expect(PAGE_SOURCE).toContain("from '@/lib/cfo/scenarios/tenYearProjection'");
    expect(PAGE_SOURCE).toContain('tenYearProjection');
  });

  it('imports recharts primitives for the chart', () => {
    expect(PAGE_SOURCE).toContain("from 'recharts'");
    expect(PAGE_SOURCE).toContain('LineChart');
    expect(PAGE_SOURCE).toContain('Line');
    expect(PAGE_SOURCE).toContain('Tooltip');
  });

  it('uses the canonical scenario API endpoints', () => {
    expect(PAGE_SOURCE).toContain("'/api/cfo/scenarios/context'");
    expect(PAGE_SOURCE).toContain("'/api/cfo/scenarios/run'");
  });

  it('debounces scenario re-runs on slider change (250ms)', () => {
    expect(PAGE_SOURCE).toContain('setTimeout');
    expect(PAGE_SOURCE).toContain('250');
  });

  it('passes auth token on every API call', () => {
    // Defence against the 2026-05-18 SessionExpiryHandler regression
    // (missing Authorization header → 401 → silent logout).
    expect(PAGE_SOURCE).toContain('Authorization: `Bearer ${token}`');
  });

  it('AFSL discipline — no prescriptive copy', () => {
    expect(PAGE_SOURCE).not.toMatch(/you should sacrifice/i);
    expect(PAGE_SOURCE).not.toMatch(/we recommend/i);
    expect(PAGE_SOURCE).toContain('Not financial advice');
  });

  it('renders the GAW footer with link to /legal/general-advice-warning', () => {
    expect(PAGE_SOURCE).toContain('/legal/general-advice-warning');
    expect(PAGE_SOURCE).toContain('General Advice Warning');
  });

  it('H3 cap-hard-stop tooltip surfaces carry-forward path', () => {
    expect(PAGE_SOURCE).toContain('carry-forward');
    expect(PAGE_SOURCE).toContain('Division 293');
  });

  it('H2 regime badge surfaces high-balance super tax + Royal Assent state', () => {
    expect(PAGE_SOURCE).toContain('High-balance super tax');
    expect(PAGE_SOURCE).toContain('Royal Assent');
  });

  it('H1 source line attribution beneath slider', () => {
    expect(PAGE_SOURCE).toContain('Your snapshot:');
  });

  it('Super-account selector surfaces SMSF-specific note', () => {
    expect(PAGE_SOURCE).toContain('member contribution form');
  });

  it('Assumptions panel collapsed by default', () => {
    expect(PAGE_SOURCE).toContain('How we computed this');
    expect(PAGE_SOURCE).toContain('useState(false)');
  });

  it('Stub copy for other 4 levers references PR 2.C', () => {
    expect(PAGE_SOURCE).toContain('PR 2.C');
    expect(PAGE_SOURCE).toContain('Salary-sacrifice is the showcase');
  });

  it('Uses §18.7.2 glass vocabulary (NOT cosmos)', () => {
    expect(PAGE_SOURCE).toContain('bg-card/70');
    expect(PAGE_SOURCE).toContain('backdrop-blur-xl');
    expect(PAGE_SOURCE).toContain('rounded-[20px]');
    // Defensive: no cosmos tokens leaked in (per Reza directive 2026-06-08)
    expect(PAGE_SOURCE).not.toContain('Open Account');
    expect(PAGE_SOURCE).not.toContain('Implement Strategy');
  });

  it('Defaults fund selection to largest non-SMSF account', () => {
    expect(PAGE_SOURCE).toContain("a.fundType !== 'SMSF'");
    expect(PAGE_SOURCE).toContain('largest');
  });

  it('Surfaces TSB > $3M Div 296 watch pill', () => {
    expect(PAGE_SOURCE).toContain('3_000_000');
    expect(PAGE_SOURCE).toContain('Div 296 watch');
  });
});

describe('Phase 45 PR 2.B — scenarios context API', () => {
  it('uses canonical SSOT getMasterFinancialSnapshot for snapshot data', () => {
    expect(CONTEXT_ROUTE_SOURCE).toContain('getMasterFinancialSnapshot');
  });

  it('returns un-deduplicated TSB (sums every super account)', () => {
    // The TSB fix from PR 2.A.1 — sum EVERY account regardless of fundType.
    expect(CONTEXT_ROUTE_SOURCE).toContain('totalSuperBalance');
    expect(CONTEXT_ROUTE_SOURCE).toContain('.reduce(');
  });

  it('Requires report.read permission per CLAUDE.md §12.5', () => {
    expect(CONTEXT_ROUTE_SOURCE).toContain("withPermission('report.read'");
  });

  it('Returns Universal API response format', () => {
    expect(CONTEXT_ROUTE_SOURCE).toContain('success: true');
    expect(CONTEXT_ROUTE_SOURCE).toContain('success: false');
  });
});
