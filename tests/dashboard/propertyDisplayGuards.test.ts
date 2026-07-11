/**
 * MON-022 (two confirmed display bugs) — a property surface must not show a
 * meaningless metric (§19.2 / display correctness; changesNumbers=false).
 *
 * (i) Owner-occupied HOME showed a rental "Yield 0.00%": the detail-page mini-grid
 *     gated Yield on !isRental (so HOME + INVESTMENT both showed it) — a PRIMARY
 *     RESIDENCE has no rental yield. Fixed: Yield gated on isInvestment (matches
 *     PropertyTile's rule). Equity + LVR remain for any owned property.
 * (ii) A $0 / unknown purchase showed a fabricated "+0.0%" green gain pill on the
 *     tile (rendered unconditionally) though the detail page already suppresses it.
 *     Fixed: the tile's pill is gated on purchasePrice > 0.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-022 (i): Yield only shows for investment properties, not a primary residence', () => {
  const src = read('app/dashboard/properties/[id]/page.tsx');
  it('the detail-page Yield MiniKpi is gated on isInvestment', () => {
    expect(src).toMatch(/isInvestment && \(\s*<MiniKpi label="Yield"/);
  });
});

describe('MON-022 (ii): the property tile hides the gain % when purchase is unknown', () => {
  const src = read('components/properties/PropertyTile.tsx');
  it('the tile gain pill is gated on purchasePrice > 0', () => {
    expect(src).toContain('property.purchasePrice > 0 &&');
  });
});
