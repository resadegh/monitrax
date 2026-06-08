/**
 * Phase 45.1 — Contextual entry points tests.
 *
 * Surface verification for:
 *   - lever-detail page reading `?loanId=X` / `?propertyId=Y` searchParams
 *   - LoanDetailDialog "What if?" affordance (refinance + payDown links)
 *   - Property strategy page "What if you sold this property?" card
 *   - Super page "What if you salary-sacrificed?" CTA
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const LEVER_DETAIL_SOURCE = readFileSync(
  resolve(__dirname, '../../app/dashboard/cfo/what-if/[lever]/page.tsx'),
  'utf8',
);

const LOAN_DIALOG_SOURCE = readFileSync(
  resolve(__dirname, '../../components/loans/LoanDetailDialog.tsx'),
  'utf8',
);

const PROPERTY_STRATEGY_SOURCE = readFileSync(
  resolve(__dirname, '../../app/dashboard/properties/[id]/strategy/page.tsx'),
  'utf8',
);

const SUPER_PAGE_SOURCE = readFileSync(
  resolve(__dirname, '../../app/dashboard/investments/super/page.tsx'),
  'utf8',
);

describe('Phase 45.1 — Lever-detail deep-link handling', () => {
  it('imports useSearchParams from next/navigation', () => {
    expect(LEVER_DETAIL_SOURCE).toContain('useSearchParams');
  });

  it('reads loanId from URL searchParams', () => {
    expect(LEVER_DETAIL_SOURCE).toContain("searchParams.get('loanId')");
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkLoanId');
  });

  it('reads propertyId from URL searchParams', () => {
    expect(LEVER_DETAIL_SOURCE).toContain("searchParams.get('propertyId')");
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkPropertyId');
  });

  it('deep-linked loan overrides the largest-balance default', () => {
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkedLoan');
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkedLoan ?? largestLoan');
  });

  it('deep-linked property overrides the largest-value default', () => {
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkedProperty');
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkedProperty ?? largestProperty');
  });

  it('context-fetch effect re-runs when deep-link IDs change', () => {
    expect(LEVER_DETAIL_SOURCE).toContain('deepLinkLoanId, deepLinkPropertyId');
  });
});

describe('Phase 45.1 — LoanDetailDialog "What if?" affordance', () => {
  it('renders WhatIfLoanAffordances on the Overview tab', () => {
    expect(LOAN_DIALOG_SOURCE).toContain('WhatIfLoanAffordances');
  });

  it('links to refinance lever with loanId pre-populated', () => {
    expect(LOAN_DIALOG_SOURCE).toContain('/dashboard/cfo/what-if/refinanceLoan?loanId=');
    expect(LOAN_DIALOG_SOURCE).toContain('encodeURIComponent(loanId)');
  });

  it('links to payDown lever with loanId pre-populated', () => {
    expect(LOAN_DIALOG_SOURCE).toContain('/dashboard/cfo/what-if/payDownLoan?loanId=');
  });

  it('uses per-lever sub-palette gradient (amber/rose for refinance, indigo/blue for payDown)', () => {
    expect(LOAN_DIALOG_SOURCE).toContain('from-amber-400/20 to-rose-400/20');
    expect(LOAN_DIALOG_SOURCE).toContain('from-indigo-400/20 to-blue-400/20');
  });

  it('AFSL discipline — no prescriptive copy', () => {
    expect(LOAN_DIALOG_SOURCE).not.toMatch(/you should refinance/i);
    expect(LOAN_DIALOG_SOURCE).not.toMatch(/we recommend/i);
  });

  it('CTA copy is information-only ("Model how a change...")', () => {
    expect(LOAN_DIALOG_SOURCE).toContain('Model how a change to');
  });
});

describe('Phase 45.1 — Property strategy "What If" card', () => {
  it('links to sellProperty lever with propertyId pre-populated', () => {
    expect(PROPERTY_STRATEGY_SOURCE).toContain('/dashboard/cfo/what-if/sellProperty?propertyId=');
    expect(PROPERTY_STRATEGY_SOURCE).toContain('encodeURIComponent(propertyId)');
  });

  it('Uses violet sub-palette (matches sellProperty lever tile)', () => {
    expect(PROPERTY_STRATEGY_SOURCE).toContain('border-violet-500/');
  });

  it('AFSL discipline — frames as model, not action', () => {
    expect(PROPERTY_STRATEGY_SOURCE).not.toMatch(/you should sell/i);
    expect(PROPERTY_STRATEGY_SOURCE).toContain('Model the capital gains');
  });
});

describe('Phase 45.1 — Super page "What If" CTA', () => {
  it('links to salarySacrificeToSuper lever', () => {
    expect(SUPER_PAGE_SOURCE).toContain('/dashboard/cfo/what-if/salarySacrificeToSuper');
  });

  it('CTA placed beneath the SuperCapMeter (cap-aware surface)', () => {
    // The CTA should appear AFTER SuperCapMeter in the source order
    const capMeterIdx = SUPER_PAGE_SOURCE.indexOf('<SuperCapMeter');
    const ctaIdx = SUPER_PAGE_SOURCE.indexOf('salarySacrificeToSuper');
    expect(capMeterIdx).toBeGreaterThan(-1);
    expect(ctaIdx).toBeGreaterThan(capMeterIdx);
  });

  it('Uses emerald/indigo gradient (matches salary-sacrifice lever tile)', () => {
    expect(SUPER_PAGE_SOURCE).toContain('from-emerald-400/20 to-indigo-400/20');
  });

  it('AFSL discipline — frames as question, not prescription', () => {
    expect(SUPER_PAGE_SOURCE).not.toMatch(/you should sacrifice/i);
    expect(SUPER_PAGE_SOURCE).toContain('What if you salary-sacrificed?');
  });
});
