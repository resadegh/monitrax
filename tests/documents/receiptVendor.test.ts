/**
 * MON-191 Ring 0 — receipt vendor extraction prefers the merchant, never a
 * document-type word (M2 kept-depth PR-1, P-9 finding F5).
 *
 * Live evidence: a Bunnings receipt whose header OCR'd as a garbled
 * "** TAX Invnice **" had VENDOR extracted as 'Invnice' while BUNNINGS was
 * the page-dominant (and repeated) text. Amount and date were honest — those
 * paths are untouched and asserted unchanged here.
 *
 * Coverage: proves the vendor picker on OCR-text fixtures. Does NOT prove
 * the Vision OCR itself or the live re-scan — that is Ring-3.
 */
import { describe, it, expect } from 'vitest';
import { analyzeReceipt } from '@/lib/documents/intelligence/analyzers/receiptAnalyzer';

const BUNNINGS_TEXT = `** TAX Invnice **
BUNNINGS Smithfield
ABN 26 008 672 179
123 Sample Rd Smithfield
20/08/2026
Timber screws  $48.90
Paint 4L       $154.88
TOTAL  $203.78
EFT 20/08/26
www.BUNNINGS.com.au`;

describe('MON-191 — the merchant wins over document-type words', () => {
  it('the Bunnings class: garbled "Invnice" header is rejected; BUNNINGS chosen', async () => {
    const result = await analyzeReceipt(BUNNINGS_TEXT);
    const vendor = (result.extractedData as { vendor?: { value: string } }).vendor;
    expect(vendor?.value.toLowerCase()).toContain('bunnings');
    expect(vendor?.value.toLowerCase()).not.toContain('invnice');
  });

  it('clean doc-type words are rejected too (INVOICE / RECEIPT / Reciept)', async () => {
    for (const header of ['TAX INVOICE', 'RECEIPT', 'Reciept']) {
      const result = await analyzeReceipt(`${header}\nWOOLWORTHS Metro\nTOTAL $12.50`);
      const vendor = (result.extractedData as { vendor?: { value: string } }).vendor;
      expect(vendor?.value.toLowerCase()).toContain('woolworths');
    }
  });

  it('the explicit "TAX INVOICE - Name" label form still extracts the name', async () => {
    const result = await analyzeReceipt(`TAX INVOICE - Joes Plumbing\nTOTAL $480.00`);
    const vendor = (result.extractedData as { vendor?: { value: string } }).vendor;
    expect(vendor?.value.toLowerCase()).toContain('plumbing');
  });

  it('never invents: a doc-type-only text yields NO vendor (field stays empty)', async () => {
    const result = await analyzeReceipt(`** TAX INVOICE **\n123.45\n01/02/2026`);
    const vendor = (result.extractedData as { vendor?: unknown }).vendor;
    expect(vendor).toBeUndefined();
  });

  it('does not touch what works: amount + date still extract exactly', async () => {
    const result = await analyzeReceipt(BUNNINGS_TEXT);
    const data = result.extractedData as {
      total?: { value: number };
      date?: { value: string };
    };
    expect(data.total?.value).toBe(203.78);
    expect(data.date?.value).toContain('2026');
  });
});
