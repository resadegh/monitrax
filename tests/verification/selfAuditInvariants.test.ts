/**
 * NeoAudit R3-self — source guards for GET /api/verify/invariants.
 *
 * The endpoint's non-overlap contract (NEOAUDIT.md §1.2): it READS canonical
 * sources and asserts identities between them — it never computes a financial
 * figure of its own. These locks keep that true.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(
  path.join(ROOT, 'app/api/verify/invariants/route.ts'),
  'utf8',
);

describe('NeoAudit self-audit endpoint (R3-self)', () => {
  it('is guarded by withPermission (user-scoped, CDR posture §13.4)', () => {
    expect(src).toContain("withPermission('report.read'");
  });

  it('reads ONLY canonical sources (§12.2.1 — no local financial derivation)', () => {
    expect(src).toContain('getMasterFinancialSnapshot');
    expect(src).toContain('computeAccessibilityBuckets');
    expect(src).toContain('getCanonicalMonthlyCashflow');
    expect(src).toContain('getCanonicalSavingsRate');
    // No Prisma access — the snapshot is the only data source.
    expect(src).not.toContain('prisma.');
  });

  it('asserts the core identities: net worth, buckets tie-out, equity sum', () => {
    expect(src).toContain('nw.assets.total - nw.liabilities.total');
    expect(src).toContain('buckets.liquidToday + buckets.accessible + buckets.lockedLongTerm');
    expect(src).toContain('snapshot.propertyPortfolioEquity');
  });

  it('scans headline figures for NaN/Infinity', () => {
    expect(src).toContain('Number.isFinite');
  });

  it('identifies the audited account + emits plausibility advisories', () => {
    // Resolves "no way to tell which account it ran against" + flags the
    // consistent-but-wrong / test-account class the identity checks miss.
    expect(src).toContain('auditedAccount: auth.email');
    expect(src).toContain('advisories');
    expect(src).toContain('snapshot.counts.loans > 0 && nw.liabilities.total <= 0');
  });

  it('covers every area with cross-area invariants (breadth pass)', () => {
    // Emergency fund (I8/I9), expense additivity (I10/I11), cashflow identity (I12).
    expect(src).toContain("'I8'");
    expect(src).toContain("'I10'");
    expect(src).toContain("'I12'");
    expect(src).toContain('snapshot.emergencyFund');
    expect(src).toContain('snapshot.expenses.monthly.all');
    expect(src).toContain('snapshot.cashflow');
  });
});
