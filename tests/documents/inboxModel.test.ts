/**
 * MON-187/188 Ring 0 — the Smart Inbox row model + approve payload
 * (M2 kept-depth PR-1, P-9 findings F1/F2/F3).
 *
 * The class this kills: the component's LOCAL suggested-action type declared
 * `type` while the analyzers store `action` — `top?.type` was always
 * undefined, every row resolved actionless, every checkbox was born disabled,
 * and the whole intake pipeline was display-only on the live surface. The old
 * component test was source-scan only, so the field contract was never
 * exercised; these fixtures ARE the analyzer's real output shape.
 *
 * Coverage: proves the row model, action resolution, flatten and payload on
 * fixtures. Does NOT prove the rendered checkbox binding or the live approve
 * write — that is the brief's Ring-3 acceptance test (the stranded Bunnings
 * $203.78 item edited, selected, approved into FY2026-27).
 */
import { describe, it, expect } from 'vitest';
import {
  actionIdOf,
  buildInboxRows,
  flattenExtracted,
  payloadFor,
  type InboxDocument,
} from '@/lib/documents/intelligence/inboxModel';

// The REAL stored shape (types.ts SuggestedAction + receiptAnalyzer output):
// `action`, `label`, `prefilled`, `confidence` — NO `type` field.
const bunningsDoc: InboxDocument = {
  id: 'doc-1',
  originalFilename: 'View recent photos.png',
  analysis: {
    id: 'an-1',
    documentType: 'RECEIPT',
    overallConfidence: 0.62,
    extractedData: {
      vendor: { value: 'BUNNINGS', confidence: 0.75, source: 'ocr' },
      total: { value: 203.78, confidence: 0.9, source: 'ocr' },
      date: { value: '2026-08-20', confidence: 0.8, source: 'ocr' },
    },
    suggestedActions: [
      {
        action: 'CREATE_EXPENSE',
        label: 'Create Expense',
        prefilled: { vendor: 'BUNNINGS', amount: 203.78 },
        confidence: 0.75,
      },
    ],
  },
};

describe('MON-187 — action resolution reads the STORED field name', () => {
  it('a row with a real analyzer action is actionable (the F1 class)', () => {
    const rows = buildInboxRows([bunningsDoc]);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('CREATE_EXPENSE'); // was null via `.type`
    expect(rows[0].actionLabel).toBe('Add as expense');
  });

  it('actionIdOf prefers `action`, tolerates legacy `type`, rejects neither', () => {
    expect(actionIdOf({ action: 'CREATE_EXPENSE' })).toBe('CREATE_EXPENSE');
    expect(actionIdOf({ type: 'CREATE_INCOME' })).toBe('CREATE_INCOME');
    expect(actionIdOf({})).toBeNull();
    expect(actionIdOf(null)).toBeNull();
  });

  it('a row with NO suggested actions stays honestly unactionable', () => {
    const doc: InboxDocument = {
      ...bunningsDoc,
      analysis: { ...bunningsDoc.analysis!, suggestedActions: [] },
    };
    expect(buildInboxRows([doc])[0].action).toBeNull();
  });

  it('the highest-confidence action wins', () => {
    const doc: InboxDocument = {
      ...bunningsDoc,
      analysis: {
        ...bunningsDoc.analysis!,
        suggestedActions: [
          { action: 'LINK_TO_PROPERTY', label: 'Link', prefilled: {}, confidence: 0.4 },
          { action: 'CREATE_EXPENSE', label: 'Expense', prefilled: {}, confidence: 0.9 },
        ],
      },
    };
    expect(buildInboxRows([doc])[0].action).toBe('CREATE_EXPENSE');
  });

  it('row fields render flattened wrapped values (vendor/amount/date)', () => {
    const r = buildInboxRows([bunningsDoc])[0];
    expect(r.vendor).toBe('BUNNINGS');
    expect(r.amount).toBe('203.78'); // via the `total` key
    expect(r.date).toBe('2026-08-20');
  });
});

describe('MON-187 second leg — the approve payload is FLAT (the confirm route reads scalars)', () => {
  it('flattenExtracted unwraps every {value} field and passes scalars through', () => {
    expect(
      flattenExtracted({
        vendor: { value: 'BUNNINGS', confidence: 0.75 },
        total: { value: 203.78, confidence: 0.9 },
        plainField: 'kept',
      })
    ).toEqual({ vendor: 'BUNNINGS', total: 203.78, plainField: 'kept' });
  });

  it('payloadFor: unedited row → flat values + amount mirrored from total', () => {
    const r = buildInboxRows([bunningsDoc])[0];
    const p = payloadFor(r, undefined);
    // The old spread sent {value,confidence} objects → Number(data.amount)
    // was NaN and String(data.vendor) was "[object Object]".
    expect(p.vendor).toBe('BUNNINGS');
    expect(p.amount).toBe(203.78);
    expect(p.date).toBe('2026-08-20');
  });

  it('payloadFor: the user’s edits WIN over extraction (the acceptance path)', () => {
    const r = buildInboxRows([bunningsDoc])[0];
    const p = payloadFor(r, { vendor: 'Bunnings', date: '2026-08-20' });
    expect(p.vendor).toBe('Bunnings');
    expect(p.name).toBe('Bunnings'); // confirm route falls back to name
    expect(p.date).toBe('2026-08-20');
    expect(p.amount).toBe(203.78); // untouched fields survive, flat
  });
});
