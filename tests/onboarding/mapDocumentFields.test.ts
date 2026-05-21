/**
 * mapDocumentFields — Phase 12 Track G.5 tests.
 *
 * The document-upload accelerator's pure mapper from the
 * `/api/documents/analyze-for-form` `fieldMappings` record to one wizard
 * row. Verifies the enum validation, defensive defaults, money parsing,
 * and that a poor extraction degrades gracefully (never throws).
 */

import { describe, it, expect } from 'vitest';
import {
  mapDocumentToIncome,
  mapDocumentToExpense,
  type DocumentFieldMappings,
} from '@/lib/onboarding/mapDocumentFields';

describe('mapDocumentToIncome', () => {
  it('maps a complete payslip to a SALARY / GROSS row', () => {
    const fields: DocumentFieldMappings = {
      source: { value: 'Acme Pty Ltd', confidence: 0.95, source: 'ocr' },
      amount: { value: 3200, confidence: 0.9, source: 'ocr' },
      frequency: { value: 'FORTNIGHTLY', confidence: 0.8, source: 'ocr' },
    };
    const row = mapDocumentToIncome(fields);
    expect(row.name).toBe('Acme Pty Ltd');
    expect(row.type).toBe('SALARY');
    expect(row.salaryType).toBe('GROSS');
    expect(row.amount).toBe(3200);
    expect(row.frequency).toBe('FORTNIGHTLY');
    expect(row.id).toMatch(/^temp_/);
  });

  it('defaults frequency to FORTNIGHTLY when absent', () => {
    const row = mapDocumentToIncome({
      source: { value: 'Employer', confidence: 0.9, source: 'ocr' },
      amount: { value: 2000, confidence: 0.9, source: 'ocr' },
    });
    expect(row.frequency).toBe('FORTNIGHTLY');
  });

  it('falls back through source → description → generic name', () => {
    expect(
      mapDocumentToIncome({
        description: { value: 'Weekly wages', confidence: 0.7, source: 'ai_inference' },
      }).name,
    ).toBe('Weekly wages');
    expect(mapDocumentToIncome({}).name).toBe('Income from payslip');
  });

  it('parses a currency-formatted amount string', () => {
    const row = mapDocumentToIncome({
      amount: { value: '$1,234.50', confidence: 0.8, source: 'ocr' },
    });
    expect(row.amount).toBe(1234.5);
  });

  it('yields amount 0 when the amount is missing or unparseable', () => {
    expect(mapDocumentToIncome({}).amount).toBe(0);
    expect(
      mapDocumentToIncome({
        amount: { value: 'not a number', confidence: 0.1, source: 'ocr' },
      }).amount,
    ).toBe(0);
  });

  it('normalises a natural-language frequency variant', () => {
    expect(
      mapDocumentToIncome({
        frequency: { value: 'per week', confidence: 0.6, source: 'ai_inference' },
      }).frequency,
    ).toBe('WEEKLY');
  });
});

describe('mapDocumentToExpense', () => {
  it('maps a complete bill to an expense row', () => {
    const fields: DocumentFieldMappings = {
      vendor: { value: 'Origin Energy', confidence: 0.95, source: 'ocr' },
      amount: { value: 284.1, confidence: 0.9, source: 'ocr' },
      category: { value: 'UTILITIES', confidence: 0.85, source: 'ai_inference' },
      taxDeductible: { value: false, confidence: 0.7, source: 'ai_inference' },
    };
    const row = mapDocumentToExpense(fields);
    expect(row.name).toBe('Origin Energy');
    expect(row.category).toBe('UTILITIES');
    expect(row.amount).toBe(284.1);
    expect(row.frequency).toBe('MONTHLY');
    expect(row.isTaxDeductible).toBe(false);
    expect(row.id).toMatch(/^temp_/);
  });

  it('falls back to OTHER for an unrecognised category', () => {
    expect(
      mapDocumentToExpense({
        category: { value: 'GROCERY_SHOPPING', confidence: 0.5, source: 'ai_inference' },
      }).category,
    ).toBe('OTHER');
    expect(mapDocumentToExpense({}).category).toBe('OTHER');
  });

  it('omits isTaxDeductible when the document does not state it', () => {
    const row = mapDocumentToExpense({
      vendor: { value: 'Bunnings', confidence: 0.9, source: 'ocr' },
    });
    expect(row.isTaxDeductible).toBeUndefined();
  });

  it('coerces a string boolean for taxDeductible', () => {
    expect(
      mapDocumentToExpense({
        taxDeductible: { value: 'true', confidence: 0.6, source: 'ai_inference' },
      }).isTaxDeductible,
    ).toBe(true);
  });

  it('takes the magnitude of a negative amount', () => {
    expect(
      mapDocumentToExpense({
        amount: { value: -99.95, confidence: 0.8, source: 'ocr' },
      }).amount,
    ).toBe(99.95);
  });

  it('falls back through vendor → description → generic name', () => {
    expect(
      mapDocumentToExpense({
        description: { value: 'Hardware supplies', confidence: 0.7, source: 'ai_inference' },
      }).name,
    ).toBe('Hardware supplies');
    expect(mapDocumentToExpense({}).name).toBe('Expense from document');
  });
});
