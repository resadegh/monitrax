/**
 * M3 punch list — locks the scoreboard display rules (MON-180 §C-1 · MON-183 §C-4).
 *
 * Coverage: proves the PURE window-selection and ordering rules in
 * lib/dashboard/scoreboardDisplay.ts on fixtures. Does NOT prove the rendered
 * tiles or the live fetches — that is the brief's Ring-3 handout (scoreboard
 * on Reza's data: EOFY tile leads with the just-ended FY; strip shows all
 * properties worst-first).
 */
import { describe, it, expect } from 'vitest';
import {
  auFyLabel,
  auFyStartYear,
  isEofySeason,
  orderStripWorstFirst,
  resolveEofyTileState,
  type EofyWindowSlice,
} from '@/lib/dashboard/scoreboardDisplay';

const slice = (over: Partial<EofyWindowSlice>): EofyWindowSlice => ({
  fyLabel: 'FY2025-26',
  notReadyCount: 0,
  includedCount: 0,
  transactionsTotal: 0,
  ...over,
});

// The Ring-3 shape (2026-08-22): FY2025-26 with 35 included, 35 not-ready.
const JUST_ENDED = slice({ fyLabel: 'FY2025-26', includedCount: 35, notReadyCount: 35, transactionsTotal: 387 });
const CURRENT_EMPTY = slice({ fyLabel: 'FY2026-27' });
const CURRENT_WITH_ROWS = slice({ fyLabel: 'FY2026-27', includedCount: 12, notReadyCount: 3 });

const AUG = new Date('2026-08-22T00:00:00Z'); // in season (month 2 of FY)
const NOV = new Date('2026-11-15T00:00:00Z'); // out of season (month 5 of FY)

describe('MON-180 — the EOFY tile window rule (§C-1)', () => {
  it('AU FY helpers: July rolls the start year; label matches buildAuFyWindow', () => {
    expect(auFyStartYear(new Date('2026-06-30T23:59:59Z'))).toBe(2025);
    expect(auFyStartYear(new Date('2026-07-01T00:00:00Z'))).toBe(2026);
    expect(auFyLabel(2025)).toBe('FY2025-26');
    expect(auFyLabel(2026)).toBe('FY2026-27');
  });

  it('the season is July–October (within 4 months of FY start)', () => {
    expect(isEofySeason(new Date('2026-07-01T00:00:00Z'))).toBe(true);
    expect(isEofySeason(AUG)).toBe(true);
    expect(isEofySeason(new Date('2026-10-31T23:59:00Z'))).toBe(true);
    expect(isEofySeason(NOV)).toBe(false);
    expect(isEofySeason(new Date('2027-06-01T00:00:00Z'))).toBe(false);
  });

  it('in season with an empty current FY, the JUST-ENDED FY leads (the Ring-3 case)', () => {
    const state = resolveEofyTileState({ now: AUG, current: CURRENT_EMPTY, justEnded: JUST_ENDED });
    expect(state).toEqual({ kind: 'lead-just-ended', slice: JUST_ENDED });
  });

  it('an empty current FY NEVER renders the tax-ready claim', () => {
    // Out of season: honest empty, current FY's label.
    expect(resolveEofyTileState({ now: NOV, current: CURRENT_EMPTY, justEnded: JUST_ENDED }))
      .toEqual({ kind: 'no-rows-yet', fyLabel: 'FY2026-27' });
    // In season but the just-ended feed failed: still honest empty.
    expect(resolveEofyTileState({ now: AUG, current: CURRENT_EMPTY, justEnded: null }))
      .toEqual({ kind: 'no-rows-yet', fyLabel: 'FY2026-27' });
    // In season, just-ended FY itself empty: honest empty (nothing to lead with).
    expect(resolveEofyTileState({ now: AUG, current: CURRENT_EMPTY, justEnded: slice({ fyLabel: 'FY2025-26' }) }))
      .toEqual({ kind: 'no-rows-yet', fyLabel: 'FY2026-27' });
  });

  it('a current FY with rows displays normally, season or not', () => {
    expect(resolveEofyTileState({ now: AUG, current: CURRENT_WITH_ROWS, justEnded: JUST_ENDED }))
      .toEqual({ kind: 'current', slice: CURRENT_WITH_ROWS });
    expect(resolveEofyTileState({ now: NOV, current: CURRENT_WITH_ROWS, justEnded: null }))
      .toEqual({ kind: 'current', slice: CURRENT_WITH_ROWS });
  });

  it('both feeds down → unavailable; current feed down in season → just-ended still leads', () => {
    expect(resolveEofyTileState({ now: AUG, current: null, justEnded: null }))
      .toEqual({ kind: 'unavailable' });
    expect(resolveEofyTileState({ now: AUG, current: null, justEnded: JUST_ENDED }))
      .toEqual({ kind: 'lead-just-ended', slice: JUST_ENDED });
    // Current feed down OUT of season: label falls back to the computed FY.
    expect(resolveEofyTileState({ now: NOV, current: null, justEnded: JUST_ENDED }))
      .toEqual({ kind: 'no-rows-yet', fyLabel: 'FY2026-27' });
  });
});

describe('MON-183 — the strip renders ALL rows, worst monthly figure first (§C-4)', () => {
  it('orders ascending (biggest drain leads) and keeps every row', () => {
    const rows = [
      { id: 'a', monthly: 120 },
      { id: 'b', monthly: -1520 },
      { id: 'c', monthly: 0 },
      { id: 'd', monthly: -300 },
      { id: 'e', monthly: 980 },
      { id: 'f', monthly: -300.5 },
    ];
    const out = orderStripWorstFirst(rows);
    expect(out.map((r) => r.id)).toEqual(['b', 'f', 'd', 'c', 'a', 'e']);
    expect(out).toHaveLength(rows.length); // no silent cap — MON-183's defect
  });

  it('is stable on ties and does not mutate its input', () => {
    const rows = [
      { id: 'x', monthly: -10 },
      { id: 'y', monthly: -10 },
      { id: 'z', monthly: -20 },
    ];
    const before = rows.map((r) => r.id);
    const out = orderStripWorstFirst(rows);
    expect(out.map((r) => r.id)).toEqual(['z', 'x', 'y']); // x before y (stable)
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it('the client renders the full set — no slice() cap remains at the render site', () => {
    // Source pin: the MON-183 defect was a bare `slice(0, 4)` on the strip.
    // The strip must render orderStripWorstFirst over ALL properties.
    const src = require('node:fs').readFileSync('app/dashboard/ScoreboardClient.tsx', 'utf8');
    expect(src).toContain('orderStripWorstFirst');
    expect(src).not.toMatch(/properties[\s\S]{0,40}\.slice\s*\(\s*0\s*,/);
  });
});
