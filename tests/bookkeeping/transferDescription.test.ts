import { describe, it, expect } from 'vitest';
import { isTransferDescription } from '../../lib/bookkeeping/transferCategorisation';

/**
 * SSOT transfer-description detector. Pins the recurring "transfer not
 * auto-recognised" bug: the prior cascade regex required the keyword BEFORE
 * to/from/between, so a bank description with the keyword at the END
 * ("To Reza Sadegh ... Transfer") was missed and rendered Uncategorised.
 * Detection is a SUGGESTION only — it never sets isTransfer (§19.1).
 */

describe('isTransferDescription — recognises transfers in any word order', () => {
  it('matches the exact regression case: keyword at the END', () => {
    // This is the live transaction Reza reported (2026-06-29).
    expect(isTransferDescription('To Reza Sadegh 01:51pm 20may Transfer')).toBe(true);
  });

  it('matches keyword-first formats too', () => {
    expect(isTransferDescription('Transfer to John Smith')).toBe(true);
    expect(isTransferDescription('Transfer from savings')).toBe(true);
    expect(isTransferDescription('Internal Transfer')).toBe(true);
    expect(isTransferDescription('TFR 12345')).toBe(true);
    expect(isTransferDescription('TRF to Acct 0019')).toBe(true);
  });

  it('matches the NPP / BPAY / Pay-Anyone family', () => {
    expect(isTransferDescription('OSKO Payment')).toBe(true);
    expect(isTransferDescription('PayID payment to Jane')).toBe(true);
    expect(isTransferDescription('Pay Anyone - rent')).toBe(true);
    expect(isTransferDescription('BPAY 0123 Origin Energy')).toBe(true);
    expect(isTransferDescription('Inter-account move')).toBe(true);
  });

  it('does NOT match merchants that merely contain the substring', () => {
    // \btransfer\b has no word boundary inside "transferwise".
    expect(isTransferDescription('TransferWise payment')).toBe(false);
    expect(isTransferDescription('Woolworths 1234 Sydney')).toBe(false);
    expect(isTransferDescription('Netflix subscription')).toBe(false);
    expect(isTransferDescription('Uber trip')).toBe(false);
  });

  it('does NOT flag direct debits as transfers (most are real bill payments)', () => {
    expect(isTransferDescription('Direct Debit AGL Energy')).toBe(false);
  });

  it('handles null / empty safely', () => {
    expect(isTransferDescription(null)).toBe(false);
    expect(isTransferDescription(undefined)).toBe(false);
    expect(isTransferDescription('')).toBe(false);
  });
});
