/**
 * Phase 41E.3 — Tax-treatment badge tests.
 *
 * Uses `react-dom/server.renderToString` for lightweight render checks
 * (same pattern as Phase 41h.3 AI-advisor UI tests).
 *
 * Asserts:
 *   - Renders the right label per regime variant.
 *   - At Stage 1 default (commencement flag false everywhere), every
 *     input combination renders "Grandfathered" (the FW-2 wall — no
 *     silent post-reform classifications until commencement is verified).
 *   - The `data-regime` attribute is set for instrumentation.
 *   - The helper exports (`getRegimeShortLabel`, `getRegimeDescription`)
 *     return non-empty strings for every regime variant.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TaxTreatmentBadge,
  getRegimeShortLabel,
  getRegimeDescription,
} from '@/components/wealth/TaxTreatmentBadge';

describe('Phase 41E.3 — TaxTreatmentBadge component', () => {
  it('renders a badge for pre-cut-over INVESTMENT property → Grandfathered', () => {
    const html = renderToString(
      <TaxTreatmentBadge
        propertyType="INVESTMENT"
        acquisitionContractDate="2020-01-01"
        isNewBuild={null}
        financialYear="2027-28"
      />,
    );
    expect(html).toContain('Grandfathered');
    expect(html).toContain('data-regime="PRE_REFORM_GRANDFATHERED"');
  });

  it('renders a badge for RENTAL (out-of-scope) → Grandfathered', () => {
    const html = renderToString(
      <TaxTreatmentBadge
        propertyType="RENTAL"
        acquisitionContractDate={null}
        isNewBuild={null}
        financialYear="2027-28"
      />,
    );
    expect(html).toContain('Grandfathered');
  });

  it('Stage 1 default — even post-cut-over contract → Grandfathered (FW-2 wall)', () => {
    // commencementVerified is false in every FY config at Stage 1, so
    // the regime classifier returns PRE_REFORM_GRANDFATHERED regardless
    // of contract date. This test pins the wall against silent
    // post-reform classifications.
    const html = renderToString(
      <TaxTreatmentBadge
        propertyType="INVESTMENT"
        acquisitionContractDate="2027-01-01" // post-cut-over
        isNewBuild={false}
        financialYear="2027-28"
      />,
    );
    expect(html).toContain('Grandfathered');
    expect(html).toContain('data-regime="PRE_REFORM_GRANDFATHERED"');
  });

  it('renders the size="sm" variant with smaller padding/text classes', () => {
    const html = renderToString(
      <TaxTreatmentBadge
        propertyType="INVESTMENT"
        acquisitionContractDate="2020-01-01"
        financialYear="2027-28"
        size="sm"
      />,
    );
    expect(html).toContain('px-2');
    expect(html).toContain('py-0.5');
  });

  it('sets aria-label for accessibility', () => {
    const html = renderToString(
      <TaxTreatmentBadge
        propertyType="INVESTMENT"
        acquisitionContractDate="2020-01-01"
        financialYear="2027-28"
      />,
    );
    expect(html).toContain('aria-label="Tax treatment: Grandfathered"');
  });

  it('defaults financialYear to current FY when not supplied', () => {
    // Should not throw + should render something sensible.
    const html = renderToString(
      <TaxTreatmentBadge
        propertyType="INVESTMENT"
        acquisitionContractDate="2020-01-01"
        isNewBuild={null}
      />,
    );
    expect(html).toContain('Grandfathered');
  });
});

describe('Phase 41E.3 — getRegimeShortLabel helper', () => {
  it('returns a non-empty short label for every regime variant', () => {
    expect(getRegimeShortLabel('PRE_REFORM_GRANDFATHERED').length).toBeGreaterThan(0);
    expect(getRegimeShortLabel('POST_REFORM_NEW_BUILD').length).toBeGreaterThan(0);
    expect(getRegimeShortLabel('POST_REFORM_RESTRICTED').length).toBeGreaterThan(0);
    expect(getRegimeShortLabel('UC_PROPERTY_CONTRACT_DATE_UNKNOWN').length).toBeGreaterThan(0);
    expect(getRegimeShortLabel('UC_NEW_BUILD_UNCONFIRMED').length).toBeGreaterThan(0);
  });

  it('grandfathered short label is "Grandfathered"', () => {
    expect(getRegimeShortLabel('PRE_REFORM_GRANDFATHERED')).toBe('Grandfathered');
  });
});

describe('Phase 41E.3 — getRegimeDescription helper', () => {
  it('returns a non-empty description for every regime variant', () => {
    expect(getRegimeDescription('PRE_REFORM_GRANDFATHERED').length).toBeGreaterThan(20);
    expect(getRegimeDescription('POST_REFORM_NEW_BUILD').length).toBeGreaterThan(20);
    expect(getRegimeDescription('POST_REFORM_RESTRICTED').length).toBeGreaterThan(20);
    expect(getRegimeDescription('UC_PROPERTY_CONTRACT_DATE_UNKNOWN').length).toBeGreaterThan(20);
    expect(getRegimeDescription('UC_NEW_BUILD_UNCONFIRMED').length).toBeGreaterThan(20);
  });

  it('descriptions never use recommendation verbs (D-2 wall)', () => {
    // Behavioural-psychologist lens — badge tooltips are FACTS, not
    // imperatives. Same wall the AI validator enforces at response
    // emission.
    const regimes = [
      'PRE_REFORM_GRANDFATHERED',
      'POST_REFORM_NEW_BUILD',
      'POST_REFORM_RESTRICTED',
      'UC_PROPERTY_CONTRACT_DATE_UNKNOWN',
      'UC_NEW_BUILD_UNCONFIRMED',
    ] as const;
    for (const r of regimes) {
      const desc = getRegimeDescription(r).toLowerCase();
      expect(desc).not.toMatch(/\byou should\b/);
      expect(desc).not.toMatch(/\bi recommend\b/);
      expect(desc).not.toMatch(/\btransfer to\b/);
    }
  });
});
