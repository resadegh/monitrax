/**
 * Phase 50 D.6 — SmartInbox component tests.
 *
 * Lightweight module-surface + source-spec tests (mirrors the codebase's
 * component-test style, e.g. TaxReformBanner.test.tsx). Full render/interaction
 * behaviour is covered by Vercel preview manual verification. These tests pin
 * the LOAD-BEARING autonomy contract (Reza 2026-06-18) so a future PR can't
 * silently turn the bulk-approve into a background writer.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SmartInbox } from '@/components/documents/SmartInbox';

const SRC = readFileSync(
  join(process.cwd(), 'components/documents/SmartInbox.tsx'),
  'utf8',
);

describe('Phase 50 D.6 — SmartInbox module surface', () => {
  it('exports the SmartInbox component', () => {
    expect(typeof SmartInbox).toBe('function');
    expect(SmartInbox.name).toBe('SmartInbox');
  });
});

describe('Phase 50 D.6 — autonomy contract (must not regress)', () => {
  it('reuses the D.3 confidence SSOT for banding (no inline magic thresholds)', () => {
    // MON-187: the row model (incl. the confidencePolicy banding) moved to
    // the pure, analyzer-typed inboxModel — the component consumes it.
    expect(SRC).toContain("from '@/lib/documents/intelligence/inboxModel'");
    const MODEL = readFileSync(
      join(process.cwd(), 'lib/documents/intelligence/inboxModel.ts'),
      'utf8',
    );
    expect(MODEL).toContain("from './confidencePolicy'");
    expect(MODEL).toContain('classifyConfidence'); // the model calls the D.3 SSOT
    // No re-hardcoded 0.9 / 0.7 thresholds — those belong to confidencePolicy.
    expect(SRC).not.toMatch(/>=\s*0\.9/);
    expect(SRC).not.toMatch(/>=\s*0\.7/);
  });

  it('pre-selects only the AUTO band (earned-autonomy convenience)', () => {
    expect(SRC).toContain("r.band === 'AUTO'");
  });

  it('keeps the "nothing is saved until you approve" reassurance copy', () => {
    expect(SRC).toContain('Nothing is saved until you do');
    expect(SRC).toContain('you stay in control');
  });

  it('confirms each item through the injected SSOT path, not a batch shortcut', () => {
    // onConfirm is the page's handleConfirmAnalysis (POST .../analyze/confirm).
    expect(SRC).toContain('onConfirm(r.analysisId, r.action');
    // Bulk approve loops per item — each is an explicit confirm.
    expect(SRC).toMatch(/for \(const r of toApprove\) await approveRow\(r\)/);
  });

  it('lets the user edit AI findings before approving (edits win over extracted data)', () => {
    // MON-187: the edits-win rule lives in the model's payload builder now.
    const MODEL2 = readFileSync(
      join(process.cwd(), 'lib/documents/intelligence/inboxModel.ts'),
      'utf8',
    );
    expect(MODEL2).toContain('edits win');
    expect(SRC).toContain('payloadFor');
  });
});
