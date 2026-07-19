/**
 * MON-037 RC-B — near-duplicate expense dedup (the "Battery" class).
 *
 * Real-data symptom (VR-002): ONE real battery cost existed as THREE rows on
 * HOME — "Battery" / "Battery System" / "Battery Replacement" (document-import
 * estimate + transaction-link actual + manual), each $11,385 stored MONTHLY.
 * Both intake dedup guards matched only on (normalised) name EQUALITY /
 * exact-string+exact-amount, so every name variant minted a new row.
 *
 * Rings here:
 *  - Ring-0: the canonical near-duplicate decision (`isNearDuplicateEntry`)
 *    on the exact battery fixtures + the false-merge guards.
 *  - Ring-1 SOURCE-LOCK: BOTH intake paths (transaction-link route +
 *    document-import reconcile) consume the ONE decision (§12.2.1), and the
 *    doc-import expense create carries the MON-053 isRecurring passthrough.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { relatedMerchant, sameMerchant } from '../../lib/bank/merchantNormalize';
import { isNearDuplicateEntry } from '../../lib/utils/reconciliation';

describe('MON-037 RC-B · relatedMerchant (token containment, conservative)', () => {
  it('the battery fixtures: "Battery" relates to its variants', () => {
    expect(relatedMerchant('Battery', 'Battery System')).toBe(true);
    expect(relatedMerchant('Battery', 'Battery Replacement')).toBe(true);
    expect(relatedMerchant('Battery System', 'Battery')).toBe(true); // symmetric
  });

  it('containment only — partial overlap is NOT related', () => {
    expect(relatedMerchant('Home Insurance', 'Car Insurance')).toBe(false);
    expect(relatedMerchant('Battery System', 'Battery Replacement')).toBe(false); // {battery,system} ⊄ {battery,replacement}
  });

  it('normalisation carries through (case, suffixes, ABN blobs — MON-025)', () => {
    expect(relatedMerchant('QBE Insurance (Australia) Limited', 'Qbe Insurance abn 78 003 191 035')).toBe(true);
  });

  it('empty/blank never relates', () => {
    expect(relatedMerchant('', 'Battery')).toBe(false);
    expect(relatedMerchant(null, 'Battery')).toBe(false);
  });
});

describe('MON-037 RC-B · isNearDuplicateEntry (the ONE decision)', () => {
  const battery = { name: 'Battery', amount: 11385 };

  it('§19.2 ex.1 — the exact VR-002 case: estimate vs actual name variants, same amount', () => {
    expect(isNearDuplicateEntry({ name: 'Battery Replacement', amount: 11385 }, battery)).toBe(true);
    expect(isNearDuplicateEntry({ name: 'Battery System', amount: 11385 }, battery)).toBe(true);
  });

  it('§19.2 ex.2 — estimate-vs-actual drift within 10% still matches (11,385 vs 10,500)', () => {
    expect(isNearDuplicateEntry({ name: 'Battery System', amount: 10500 }, battery)).toBe(true);
  });

  it('§19.2 ex.3 — same-name but far amounts are NOT duplicates (two real battery costs)', () => {
    expect(isNearDuplicateEntry({ name: 'Battery', amount: 2500 }, battery)).toBe(false);
  });

  it('unrelated names never match, even at the same amount', () => {
    expect(isNearDuplicateEntry({ name: 'Painting Home', amount: 11385 }, battery)).toBe(false);
  });

  it('vendorName participates in the name pairing', () => {
    expect(
      isNearDuplicateEntry(
        { name: 'Invoice 4471', vendorName: 'Battery System', amount: 11385 },
        battery,
      ),
    ).toBe(true);
  });

  it('zero/absent amounts never match (no evidence)', () => {
    expect(isNearDuplicateEntry({ name: 'Battery', amount: 0 }, battery)).toBe(false);
  });

  it('sameMerchant equality still matches at tolerance edge inputs', () => {
    expect(sameMerchant('Battery', 'battery')).toBe(true);
    expect(isNearDuplicateEntry({ name: 'battery', amount: 11385 }, battery)).toBe(true);
  });
});

describe('MON-037 RC-B · Ring-1 SOURCE-LOCK: both intake paths use the ONE decision', () => {
  const root = resolve(__dirname, '../..');
  const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');

  it('the transaction-link route consumes the ONE decision (via classifyIntake source-signature policy — Mechanism A keystone)', () => {
    const src = read('app/api/transactions/[id]/link/route.ts');
    // Post-Mechanism-A the route reaches the decision through the canonical
    // classifier's source-signature policy (cross-scope with the scope
    // compatibility rule) — the chain is route → classifyIntake(streamPolicy
    // 'source-signature') → sameMerchant / isNearDuplicateEntry.
    expect(src).toMatch(/streamPolicy: 'source-signature'/);
    expect(src).toMatch(/from '@\/lib\/intake\/classifyIntake'/);
    const classifier = read('lib/intake/classifyIntake.ts');
    expect(classifier).toMatch(/isNearDuplicateEntry\(/);
    expect(classifier).toMatch(/from '@\/lib\/utils\/reconciliation'/);
  });

  it('the document-import reconcile consumes isNearDuplicateEntry (no exact-string findFirst left)', () => {
    const src = read('lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts');
    expect(src).toMatch(/isNearDuplicateEntry\(/);
    // the old exact-match shape must be gone from the EXPENSE branch
    expect(src).not.toMatch(/OR: \[\{ vendorName: name \}, \{ name \}\]/);
  });

  it('the doc-import expense create carries the MON-053 recurrence passthrough (one-off invoices expressible, via classifyIntake post-MON-078)', () => {
    const src = read('app/api/documents/analyze/confirm/route.ts');
    const expenseCreate = src.slice(
      src.indexOf('async function createExpenseFromAnalysis'),
      src.indexOf('async function createIncomeFromAnalysis'),
    );
    // The analyzer's explicit flag threads into the canonical classifier...
    expect(expenseCreate).toMatch(/declaredIsRecurring: data\.isRecurring != null \? Boolean\(data\.isRecurring\) : null/);
    // ...and the row is written from the classification, never a local default.
    expect(expenseCreate).toMatch(/isRecurring: intake\.isRecurring/);
  });
});
