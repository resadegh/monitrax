/**
 * Phase 50 D.5a — RenewalReminderCard tests.
 *
 * Lightweight module-surface + source-spec tests (mirrors the codebase style,
 * e.g. SmartInbox.test.tsx). They pin the LOAD-BEARING contracts so a future PR
 * can't regress them: the autonomy framing, the calm "safety-net" palette (no
 * false urgency, no money-emerald), and the create-only reminder path.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RenewalReminderCard } from '@/components/documents/RenewalReminderCard';

const SRC = readFileSync(
  join(process.cwd(), 'components/documents/RenewalReminderCard.tsx'),
  'utf8',
);

describe('Phase 50 D.5a — RenewalReminderCard module surface', () => {
  it('exports the component', () => {
    expect(typeof RenewalReminderCard).toBe('function');
    expect(RenewalReminderCard.name).toBe('RenewalReminderCard');
  });
});

describe('Phase 50 D.5a — autonomy + tone contract (must not regress)', () => {
  it('keeps the suggest→confirm framing (editable date, explicit Set/Not now)', () => {
    expect(SRC).toContain('Set reminder');
    expect(SRC).toContain('Not now');
    // The date is an editable input, not a fixed label.
    expect(SRC).toContain("type=\"date\"");
  });

  it('uses the calm sky→teal "safety net" palette — NOT money-emerald, NOT urgent amber/red', () => {
    expect(SRC).toMatch(/from-sky-500 to-teal-500/);
    // No emerald (reserved for money) and no amber/red (no false urgency) on this card.
    expect(SRC).not.toMatch(/\bemerald-/);
    expect(SRC).not.toMatch(/\bamber-/);
    expect(SRC).not.toMatch(/\bred-/);
  });

  it('frames the nudge calmly (no manufactured urgency)', () => {
    expect(SRC).toContain('one less thing to carry');
    expect(SRC).toContain('Want a heads-up before this expires?');
  });
});

describe('Phase 50 D.5a — scan-flow wiring (create-only, reuses the engine)', () => {
  const SCAN = readFileSync(
    join(process.cwd(), 'components/documents/GlobalScanReceipt.tsx'),
    'utf8',
  );

  it('creates a custom reminder (CREATE, not an update — §12.11-safe)', () => {
    expect(SCAN).toContain("fetch('/api/reminders/custom'");
    expect(SCAN).toContain("method: 'POST'");
    // No PUT to an asset/property expiry column (would be a clobber risk in v1).
    expect(SCAN).not.toMatch(/vehicleInsuranceExpiry|buildingInsuranceExpiry/);
  });

  it('only offers the renewal step when a real ISO date was extracted', () => {
    expect(SCAN).toContain('isIsoDate(preview.renewalDate)');
    expect(SCAN).toMatch(/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  });
});
