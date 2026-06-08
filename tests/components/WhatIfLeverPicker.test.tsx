/**
 * Phase 45 PR 2.A — What If? lever picker page smoke tests.
 *
 * Lightweight surface + copy tests. Verifies the page source contains:
 *   - All 5 lever scenarios from Phase 45 scope §2
 *   - The General Advice Warning copy (AFSL discipline)
 *   - The "never what you should do" framing line (Q-HOOK-AFSL)
 *   - Per-lever TRAIL stage labels (§6.2 sub-palette mapping)
 *
 * Full interactive testing happens via Vercel preview + (PR 2.B) E2E.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PAGE_SOURCE = readFileSync(
  resolve(__dirname, '../../app/dashboard/cfo/what-if/page.tsx'),
  'utf8',
);

const LEVER_DETAIL_SOURCE = readFileSync(
  resolve(__dirname, '../../app/dashboard/cfo/what-if/[lever]/page.tsx'),
  'utf8',
);

describe('Phase 45 PR 2.A — lever picker page', () => {
  it('lists all 5 lever scenarios from Phase 45 §2', () => {
    expect(PAGE_SOURCE).toContain("id: 'refinanceLoan'");
    expect(PAGE_SOURCE).toContain("id: 'salarySacrificeToSuper'");
    expect(PAGE_SOURCE).toContain("id: 'sellProperty'");
    expect(PAGE_SOURCE).toContain("id: 'payDownLoan'");
    expect(PAGE_SOURCE).toContain("id: 'addInvestment'");
  });

  it('surfaces all 5 TRAIL-stage labels per §6.2 sub-palette mapping', () => {
    expect(PAGE_SOURCE).toContain('REDUCE · DEBT');
    expect(PAGE_SOURCE).toContain('INVEST · SUPER');
    expect(PAGE_SOURCE).toContain('LIVE · EXIT');
    expect(PAGE_SOURCE).toContain('ANCHOR · DEBT FREEDOM');
    expect(PAGE_SOURCE).toContain('INVEST · PROPERTY');
  });

  it('AFSL discipline — never says "you should"', () => {
    expect(PAGE_SOURCE).toContain('never what you should do');
    // Defence: the page MUST NOT contain prescriptive copy like
    // "you should refinance" / "you should sacrifice".
    expect(PAGE_SOURCE).not.toMatch(/you should refinance/i);
    expect(PAGE_SOURCE).not.toMatch(/you should sacrifice/i);
    expect(PAGE_SOURCE).not.toMatch(/you should sell/i);
  });

  it('surfaces the General Advice Warning card with linked GAW page', () => {
    expect(PAGE_SOURCE).toContain('Monitrax shows what changes');
    expect(PAGE_SOURCE).toContain('never personal advice');
    expect(PAGE_SOURCE).toContain('/legal/general-advice-warning');
    expect(PAGE_SOURCE).toContain('General Advice Warning');
  });

  it('uses static Tailwind class strings (Tailwind JIT can scan them)', () => {
    // Defence against the dynamic-class regression — if a future PR
    // re-introduces `${fromColor}/20` template interpolation, Tailwind
    // strips the class at build time and the gradient disappears in prod.
    expect(PAGE_SOURCE).toContain('bg-gradient-to-r from-amber-400 to-rose-400');
    expect(PAGE_SOURCE).toContain('bg-gradient-to-r from-emerald-400 to-indigo-400');
    expect(PAGE_SOURCE).toContain('bg-gradient-to-r from-violet-400 to-fuchsia-400');
    expect(PAGE_SOURCE).toContain('bg-gradient-to-r from-indigo-400 to-blue-400');
    expect(PAGE_SOURCE).toContain('bg-gradient-to-r from-teal-400 to-cyan-400');
  });

  it('uses the canonical §18.7.2 glass-card vocabulary', () => {
    expect(PAGE_SOURCE).toContain('bg-card/70');
    expect(PAGE_SOURCE).toContain('backdrop-blur-xl');
    expect(PAGE_SOURCE).toContain('rounded-[20px]');
    // Hover lift micro-motion
    expect(PAGE_SOURCE).toContain('hover:-translate-y-0.5');
  });

  it('routes to /dashboard/cfo/what-if/[lever] for each tile', () => {
    expect(PAGE_SOURCE).toContain('/dashboard/cfo/what-if/refinanceLoan');
    expect(PAGE_SOURCE).toContain('/dashboard/cfo/what-if/salarySacrificeToSuper');
    expect(PAGE_SOURCE).toContain('/dashboard/cfo/what-if/sellProperty');
    expect(PAGE_SOURCE).toContain('/dashboard/cfo/what-if/payDownLoan');
    expect(PAGE_SOURCE).toContain('/dashboard/cfo/what-if/addInvestment');
  });

  it('breadcrumb shows "My Guide · Decision support"', () => {
    expect(PAGE_SOURCE).toContain('My Guide · Decision support');
  });
});

describe('Phase 45 PR 2.A — lever detail route stub', () => {
  it('validates the [lever] param against the SCENARIO_TYPES whitelist', () => {
    expect(LEVER_DETAIL_SOURCE).toContain("SCENARIO_TYPES");
    expect(LEVER_DETAIL_SOURCE).toContain('isScenarioType');
  });

  it('renders "coming in PR 2.B" placeholder', () => {
    expect(LEVER_DETAIL_SOURCE).toContain('PR 2.B');
  });

  it('links back to the lever picker', () => {
    expect(LEVER_DETAIL_SOURCE).toContain('/dashboard/cfo/what-if');
    expect(LEVER_DETAIL_SOURCE).toContain('Back to lever picker');
  });

  it('handles unknown lever (404-style)', () => {
    expect(LEVER_DETAIL_SOURCE).toContain("Unknown lever");
    expect(LEVER_DETAIL_SOURCE).toContain("doesn&apos;t exist");
  });
});
