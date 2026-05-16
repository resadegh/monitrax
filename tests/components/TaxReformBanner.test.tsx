/**
 * Phase 41E.3 — TaxReformBanner component tests.
 *
 * Lightweight render-only tests. Since the banner is a client component
 * that fetches its dismissal state on mount, we test the static module
 * surface + assert the copy specification from Phase doc §11.1.
 *
 * Full integration testing (mounted on /dashboard/cfo, fetch behaviour,
 * dismissal persistence) is handled by E2E + Vercel preview manual
 * verification.
 */

import { describe, it, expect } from 'vitest';
import { TaxReformBanner } from '@/components/cfo/TaxReformBanner';

describe('Phase 41E.3 — TaxReformBanner module surface', () => {
  it('exports the TaxReformBanner component', () => {
    expect(typeof TaxReformBanner).toBe('function');
    expect(TaxReformBanner.name).toBe('TaxReformBanner');
  });
});

describe('Phase 41E.3 — TaxReformBanner copy spec (per Phase doc §11.1)', () => {
  // The component source is read directly to verify the copy is on
  // record. This protects against drift if a future PR softens the
  // calm framing into urgency.
  it('source contains the calm-framing headline', () => {
    // Read the component source — string-based assertion is the right
    // tool for "is the load-bearing copy still there?".
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../components/cfo/TaxReformBanner.tsx'),
      'utf8',
    );
    expect(source).toContain("you&apos;re already protected");
    expect(source).toContain('12 May 2026');
  });

  it('source contains the "Show me my position" CTA', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../components/cfo/TaxReformBanner.tsx'),
      'utf8',
    );
    expect(source).toContain('Show me my position');
  });

  it('source does NOT use urgency / manufactured-FOMO language (behaviour-psychologist guard)', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../components/cfo/TaxReformBanner.tsx'),
      'utf8',
    );
    // No "act now", no "limited time", no "deadline", no "miss out"
    expect(source).not.toMatch(/\bact now\b/i);
    expect(source).not.toMatch(/\blimited time\b/i);
    expect(source).not.toMatch(/\bdeadline\b/i);
    expect(source).not.toMatch(/\bmiss out\b/i);
    expect(source).not.toMatch(/\bcountdown\b/i);
    // Calm framing first; the architect-mode skill dissent ruling
    // (§11.2) explicitly rejected urgency copy.
  });

  it('source uses sky tone (calm) — not amber or rose (which would alarm)', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../components/cfo/TaxReformBanner.tsx'),
      'utf8',
    );
    expect(source).toMatch(/bg-sky/);
    expect(source).not.toMatch(/bg-amber/);
    expect(source).not.toMatch(/bg-rose/);
    expect(source).not.toMatch(/bg-red/);
  });
});
