/**
 * Phase 42 PR1 — Tests for the canonical description normaliser + hash.
 *
 * The hash is the single source of truth for "what does it mean for two
 * transactions to be the same?" — it must be deterministic, must
 * collapse the kinds of bank-side jitter that cause false duplicates,
 * and must NOT collapse genuinely different transactions.
 *
 * The same logic is mirrored in the migration SQL backfill —
 * `prisma/migrations/20260510200000_phase_42_pr1_foundation/migration.sql`.
 * If you change anything in this file, change the SQL too.
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseDescription,
  computeDescriptionHash,
  isDedupSource,
  DEDUP_SOURCES,
} from '../../lib/bookkeeping/normaliseDescription';

describe('normaliseDescription', () => {
  it('lowercases', () => {
    expect(normaliseDescription('COLES SUPERMARKETS')).toBe('coles supermarkets');
  });

  it('replaces non-alphanumerics with single spaces', () => {
    expect(normaliseDescription('NAB-ATM #1234')).toBe('nab atm 1234');
    expect(normaliseDescription('coles/woolies@parramatta')).toBe('coles woolies parramatta');
  });

  it('collapses whitespace runs', () => {
    expect(normaliseDescription('NAB    ATM     1234')).toBe('nab atm 1234');
  });

  it('trims', () => {
    expect(normaliseDescription('   coles   ')).toBe('coles');
  });

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(120);
    expect(normaliseDescription(long).length).toBe(64);
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(normaliseDescription(null)).toBe('');
    expect(normaliseDescription(undefined)).toBe('');
    expect(normaliseDescription('')).toBe('');
  });

  it('collapses common bank-side jitter to the same canonical form', () => {
    const a = normaliseDescription('COLES 1234 BRUNSWICK');
    const b = normaliseDescription('coles 1234 brunswick');
    const c = normaliseDescription('Coles  1234  Brunswick');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('does NOT collapse genuinely different vendors', () => {
    expect(normaliseDescription('COLES BRUNSWICK')).not.toBe(
      normaliseDescription('WOOLIES BRUNSWICK')
    );
  });
});

describe('computeDescriptionHash', () => {
  it('returns a 32-char hex md5', () => {
    const hash = computeDescriptionHash({ description: 'Coles Supermarkets' });
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic', () => {
    const a = computeDescriptionHash({ description: 'Coles' });
    const b = computeDescriptionHash({ description: 'Coles' });
    expect(a).toBe(b);
  });

  it('prefers merchantStandardised over description', () => {
    const a = computeDescriptionHash({
      merchantStandardised: 'Coles',
      description: 'NAB-ATM #1234 PV9037 COLES BRUNSWICK',
    });
    const b = computeDescriptionHash({ description: 'Coles' });
    expect(a).toBe(b);
  });

  it('falls back to description when merchantStandardised is null', () => {
    const a = computeDescriptionHash({ merchantStandardised: null, description: 'Coles' });
    const b = computeDescriptionHash({ description: 'Coles' });
    expect(a).toBe(b);
  });

  it('produces the empty-string md5 for null/empty inputs', () => {
    // md5("") = d41d8cd98f00b204e9800998ecf8427e
    const empty = computeDescriptionHash({});
    expect(empty).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
});

describe('DEDUP_SOURCES', () => {
  it('includes QIF / CSV / OFX', () => {
    expect(DEDUP_SOURCES).toEqual(['QIF', 'CSV', 'OFX']);
  });

  it('isDedupSource type-guards correctly', () => {
    expect(isDedupSource('QIF')).toBe(true);
    expect(isDedupSource('CSV')).toBe(true);
    expect(isDedupSource('OFX')).toBe(true);
    expect(isDedupSource('BASIQ')).toBe(false);
    expect(isDedupSource('MANUAL')).toBe(false);
    expect(isDedupSource('BANK')).toBe(false);
    expect(isDedupSource('')).toBe(false);
  });
});
