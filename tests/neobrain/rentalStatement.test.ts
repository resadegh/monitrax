/**
 * Phase 59 §6 — Neobrain rental-statement parser: the grounding contract.
 *
 * The one rule (lib/neobrain/grounding.ts discipline): never emit a figure
 * that is not literally on the statement. These tests lock the pure
 * validator + payload builders (the AI call itself is orchestration —
 * exercised in prod behind isGeminiConfigured, refused when ungrounded).
 */
import { describe, it, expect } from 'vitest';
import {
  amountAppearsInText,
  groundRentalStatementParse,
  coerceRentalStatementDraft,
  buildItemisedStatementExpenses,
  type RentalStatementParse,
} from '../../lib/neobrain/rentalStatement';

/** A canonical AU agent owner-statement (the spec §3 numbers, itemised). */
const STATEMENT_TEXT = `
RAY WHITE PROPERTY MANAGEMENT — OWNER STATEMENT
Property: 12 Hilltop Rd, Cremorne NSW
Statement period: 1 – 14 June 2026

Rent collected (2 weeks @ $650.00)         $1,300.00
Less: Management fee (7%)                     $91.00
Less: Postage & sundries                      $11.00
Less: Water usage (tenant portion pending)    $98.00
Net disbursement to owner                  $1,100.00
`;

const GROUNDED_PARSE: RentalStatementParse = {
  grossRent: 1300,
  netDisbursement: 1100,
  lineItems: [
    { label: 'Management fee (7%)', amount: 91, category: 'PROPERTY_MANAGEMENT', capitalVsImmediate: 'immediate' },
    { label: 'Postage & sundries', amount: 11, category: 'PROPERTY_MANAGEMENT', capitalVsImmediate: 'immediate' },
    { label: 'Water usage', amount: 98, category: 'RATES', capitalVsImmediate: 'unknown' },
  ],
  period: { start: '2026-06-01', end: '2026-06-14', label: '1 – 14 June 2026' },
  agentName: 'Ray White Property Management',
  propertyAddress: '12 Hilltop Rd, Cremorne NSW',
};

describe('amountAppearsInText — formatting-tolerant literal matching', () => {
  it('matches grouped, ungrouped, $-prefixed and cents-less renderings', () => {
    expect(amountAppearsInText(1300, STATEMENT_TEXT)).toBe(true); // "$1,300.00"
    expect(amountAppearsInText(91, STATEMENT_TEXT)).toBe(true); // "$91.00"
    expect(amountAppearsInText(1234.56, 'total 1234.56 due')).toBe(true);
    expect(amountAppearsInText(1234.56, 'total $1,234.56 due')).toBe(true);
    expect(amountAppearsInText(1234, 'fee of 1,234 exactly')).toBe(true);
  });

  it('never matches a fragment inside a larger number', () => {
    expect(amountAppearsInText(234.56, 'total $1,234.56 due')).toBe(false);
    expect(amountAppearsInText(300, STATEMENT_TEXT)).toBe(false); // inside 1,300.00 only
  });

  it('rejects figures that are simply not on the page', () => {
    expect(amountAppearsInText(5200, STATEMENT_TEXT)).toBe(false);
    expect(amountAppearsInText(NaN, STATEMENT_TEXT)).toBe(false);
  });
});

describe('groundRentalStatementParse — refuse, never estimate', () => {
  it('accepts the fully-grounded, internally-reconciling parse', () => {
    const g = groundRentalStatementParse(GROUNDED_PARSE, STATEMENT_TEXT);
    expect(g.ok).toBe(true);
    expect(g.ungrounded).toEqual([]);
    expect(g.arithmeticGapAbs).toBeNull(); // 1300 − (91+11+98) = 1100 exactly
  });

  it('rejects a hallucinated line-item figure (not on the statement)', () => {
    const parse: RentalStatementParse = {
      ...GROUNDED_PARSE,
      lineItems: [
        ...GROUNDED_PARSE.lineItems.slice(0, 2),
        { label: 'Water usage', amount: 97.5, category: 'RATES' }, // invented
      ],
    };
    const g = groundRentalStatementParse(parse, STATEMENT_TEXT);
    expect(g.ok).toBe(false);
    expect(g.ungrounded).toHaveLength(1);
    expect(g.ungrounded[0].field).toContain('Water usage');
  });

  it('rejects a statement that does not reconcile (gross − costs ≠ net)', () => {
    const parse: RentalStatementParse = {
      ...GROUNDED_PARSE,
      lineItems: GROUNDED_PARSE.lineItems.slice(0, 2), // 91 + 11 only
    };
    const g = groundRentalStatementParse(parse, STATEMENT_TEXT);
    expect(g.ok).toBe(false);
    expect(g.arithmeticGapAbs).toBeCloseTo(98, 6); // the missing water line
  });
});

describe('coerceRentalStatementDraft — defensive typing of the AI draft', () => {
  it('coerces a valid draft and defaults unknown categories/hints', () => {
    const parse = coerceRentalStatementDraft({
      grossRent: { value: 1300 },
      netDisbursement: { value: 1100 },
      lineItems: {
        value: [
          { label: 'Management fee', amount: 91, category: 'PROPERTY_MANAGEMENT' } as never,
          { label: 'Mystery', amount: 109, category: 'NOT_A_CATEGORY' } as never,
        ],
      },
    });
    expect(parse?.lineItems).toHaveLength(2);
    expect(parse?.lineItems[1].category).toBe('OTHER');
    expect(parse?.lineItems[1].capitalVsImmediate).toBe('unknown');
  });

  it('refuses a draft with no gross/net (never invents them)', () => {
    expect(coerceRentalStatementDraft({ grossRent: { value: 1300 } })).toBeNull();
  });

  it('drops malformed rows (no label / non-positive amount)', () => {
    const parse = coerceRentalStatementDraft({
      grossRent: { value: 1300 },
      netDisbursement: { value: 1100 },
      lineItems: {
        value: [
          { label: 'Fee', amount: -5, category: 'OTHER' } as never,
          { label: 'Fee 2', amount: 200, category: 'OTHER' } as never,
        ],
      },
    });
    expect(parse?.lineItems).toHaveLength(1);
  });
});

describe('buildItemisedStatementExpenses — the Tier-1 itemised payloads', () => {
  const ctx = { userId: 'u1', ownerEntityId: 'le1', incomeStreamId: 'i-rent', propertyId: 'p1' };

  it('one one-off DERIVED (STATEMENT, itemised) row per line item, each with its own category', () => {
    const rows = buildItemisedStatementExpenses(ctx, GROUNDED_PARSE);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({
        derived: true,
        derivedSource: 'STATEMENT',
        itemised: true,
        isRecurring: false, // counted once (MON-037 semantics)
        derivedFromIncomeId: 'i-rent',
        propertyId: 'p1',
      });
    }
    expect(rows[0].category).toBe('PROPERTY_MANAGEMENT');
    expect(rows[2].category).toBe('RATES');
    expect(rows[0].name).toBe('Management fee (7%) — 1 – 14 June 2026');
  });

  it('a CAPITAL-hinted item is NOT defaulted deductible (spec §10 — never ruled here)', () => {
    const rows = buildItemisedStatementExpenses(ctx, {
      ...GROUNDED_PARSE,
      lineItems: [
        { label: 'New hot water system installation', amount: 200, category: 'MAINTENANCE', capitalVsImmediate: 'capital' },
      ],
    });
    expect(rows[0].isTaxDeductible).toBe(false);
    const immediate = buildItemisedStatementExpenses(ctx, GROUNDED_PARSE);
    expect(immediate.every((r) => r.isTaxDeductible)).toBe(true);
  });
});
