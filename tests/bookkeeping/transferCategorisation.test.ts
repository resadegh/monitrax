import { describe, it, expect } from 'vitest';
import { confirmedTransferFields } from '@/lib/bookkeeping/transferCategorisation';

/**
 * SSOT contract for the field-set every transfer-marking path writes.
 *
 * Regression guard for the 2026-06-25 bug: a loan repayment marked
 * `isTransfer=true` (via the loan-ledger link) still showed
 * "Uncategorised / Not confirmed yet" because the link path set ONLY
 * `isTransfer` — not `categoryLevel1`, `userCorrectedCategory`, or
 * `confidenceScore`. Every path now spreads this helper so a confirmed
 * transfer is also a confirmed categorisation.
 */
describe('confirmedTransferFields — SSOT transfer field-set (§12.2.1)', () => {
  it('marks the row as an excluded transfer (isTransfer, §19.1)', () => {
    expect(confirmedTransferFields().isTransfer).toBe(true);
  });

  it('categorises it as a Transfer so it is not "Uncategorised"', () => {
    expect(confirmedTransferFields().categoryLevel1).toBe('Transfer');
  });

  it('confirms it so it is not "Not confirmed yet" and leaves the low band', () => {
    const f = confirmedTransferFields();
    expect(f.userCorrectedCategory).toBe(true);
    expect(f.confidenceScore).toBe(1.0);
  });

  it('defaults the sub-category to "Internal" for plain account-to-account moves', () => {
    expect(confirmedTransferFields().categoryLevel2).toBe('Internal');
  });

  it('labels loan-ledger links as "Loan repayment"', () => {
    expect(confirmedTransferFields({ level2: 'Loan repayment' }).categoryLevel2).toBe('Loan repayment');
  });

  it('writes the COMPLETE status field-set (no subset can drift back)', () => {
    expect(new Set(Object.keys(confirmedTransferFields()))).toEqual(
      new Set(['isTransfer', 'categoryLevel1', 'categoryLevel2', 'userCorrectedCategory', 'confidenceScore']),
    );
  });
});
