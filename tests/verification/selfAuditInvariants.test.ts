/**
 * NeoAudit R3-self — source guards for the self-audit computation and its two
 * endpoints (self + admin-targeted).
 *
 * The non-overlap contract (NEOAUDIT.md §1.2): the computation READS canonical
 * sources and asserts identities between them — it never computes a financial
 * figure of its own, and it exists in exactly ONE place (§12.2.1 / §12.3) that
 * both endpoints call. These locks keep that true.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const lib = read('lib/verification/selfAuditInvariants.ts');
const selfRoute = read('app/api/verify/invariants/route.ts');
const adminRoute = read('app/api/admin/neoaudit/route.ts');

describe('NeoAudit shared computation (lib/verification/selfAuditInvariants.ts)', () => {
  it('reads ONLY canonical sources (§12.2.1 — no local financial derivation)', () => {
    expect(lib).toContain('computeAccessibilityBuckets');
    expect(lib).toContain('getCanonicalMonthlyCashflow');
    expect(lib).toContain('getCanonicalSavingsRate');
    // No data access here — it takes a snapshot in, asserts identities out.
    expect(lib).not.toContain('prisma.');
    expect(lib).not.toContain('getMasterFinancialSnapshot');
  });

  it('asserts the core identities: net worth, buckets tie-out, equity sum', () => {
    expect(lib).toContain('nw.assets.total - nw.liabilities.total');
    expect(lib).toContain('buckets.liquidToday + buckets.accessible + buckets.lockedLongTerm');
    expect(lib).toContain('snapshot.propertyPortfolioEquity');
  });

  it('scans headline figures for NaN/Infinity', () => {
    expect(lib).toContain('Number.isFinite');
  });

  it('covers every area with cross-area invariants (breadth pass) + advisories', () => {
    expect(lib).toContain("'I8'");
    expect(lib).toContain("'I10'");
    expect(lib).toContain("'I12'");
    expect(lib).toContain('snapshot.emergencyFund');
    expect(lib).toContain('snapshot.expenses.monthly.all');
    expect(lib).toContain('snapshot.cashflow');
    expect(lib).toContain('advisories');
  });
});

describe('NeoAudit self endpoint (GET /api/verify/invariants)', () => {
  it('is guarded by withPermission (user-scoped, CDR posture §13.4)', () => {
    expect(selfRoute).toContain("withPermission('report.read'");
  });

  it('is a thin wrapper on the ONE shared computation (§12.3 — no second copy)', () => {
    expect(selfRoute).toContain('computeSelfAuditReport');
    expect(selfRoute).toContain('getMasterFinancialSnapshot(auth.userId)');
    // The invariant maths must NOT be re-implemented in the route.
    expect(selfRoute).not.toContain("'I1'");
  });
});

describe('NeoAudit admin-targeted endpoint (GET /api/admin/neoaudit)', () => {
  it('is admin-gated exactly like the user-detail endpoint (CDR §13)', () => {
    expect(adminRoute).toContain('isAdminPortalAccessible');
    expect(adminRoute).toContain('verifyAdminGCPAuth');
    expect(adminRoute).toContain("hasPermission(authResult.context.role, 'users:read')");
  });

  it('runs the SAME shared computation on the selected user (no divergence)', () => {
    expect(adminRoute).toContain('computeSelfAuditReport');
    expect(adminRoute).toContain('getMasterFinancialSnapshot(userId)');
    // No re-implemented invariant maths here either.
    expect(adminRoute).not.toContain("'I1'");
  });

  it('audit-logs the cross-user access with no financial figure in metadata (§13.2/§13.3)', () => {
    expect(adminRoute).toContain('adminAuditLog.create');
    expect(adminRoute).toContain("action: 'NEOAUDIT_RUN'");
    // Metadata carries only the PASS/FAIL shape — never a dollar figure.
    expect(adminRoute).toContain('pass: report.pass');
  });
});
